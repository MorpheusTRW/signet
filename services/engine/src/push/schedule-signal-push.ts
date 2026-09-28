import type { RiskLevel, Signal } from "@seeker-signal/shared";
import type { DevicesRepo } from "../db/devices-repo.js";
import type { PushNotificationsRepo } from "../db/push-notifications-repo.js";
import type { SignalDeliveriesRepo } from "../db/signal-deliveries-repo.js";
import { resolveTier, type ResolveTierDeps } from "../entitlements/resolve-tier.js";

export interface SchedulePushDeps {
  /** Se false (default) i segnali ad alto rischio restano nel feed ma non generano push. */
  pushHighRisk?: boolean;
  devicesRepo: DevicesRepo;
  pushNotificationsRepo: PushNotificationsRepo;
  signalDeliveriesRepo: SignalDeliveriesRepo;
  resolveTierDeps: ResolveTierDeps;
}

const RISK_LABELS: Record<RiskLevel, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

function buildSignalNotification(signal: Signal) {
  return {
    title: `New signal · ${RISK_LABELS[signal.riskReport.level]} risk`,
    body: signal.summary,
    data: {
      type: "signal",
      signalId: signal.id,
      summary: signal.summary,
      risk: signal.riskReport.level,
      route: `/signal/${signal.id}`,
    },
  };
}

const LIMIT_REACHED_NOTIFICATION = {
  title: "Daily limit reached",
  body: "You've seen all of today's FREE signals. Go Pro for unlimited real-time signals.",
  data: {
    type: "limit-reached",
    route: "/plans",
  },
};

/**
 * Pianifica la consegna push di un nuovo segnale per ogni device registrato,
 * rispettando il tier del wallet (CLAUDE.md, F3): PRO/HOLDER subito, FREE dopo
 * il ritardo configurato e solo se resta margine nel limite giornaliero. Al
 * FREE che con questo segnale esaurisce il limite viene pianificata anche
 * (una sola volta al giorno) la notifica di upgrade.
 */
export async function scheduleSignalPush(
  signal: Signal,
  deps: SchedulePushDeps,
  now: Date = new Date(),
): Promise<void> {
  if (signal.riskReport.level === "high" && !deps.pushHighRisk) return;
  const notification = buildSignalNotification(signal);

  for (const device of deps.devicesRepo.listAll()) {
    const { tier, limits } = await resolveTier(device.walletPubkey, deps.resolveTierDeps, now);

    if (tier !== "free") {
      deps.pushNotificationsRepo.schedule({
        deviceId: device.id,
        walletPubkey: device.walletPubkey,
        signalId: signal.id,
        type: "signal",
        ...notification,
        scheduledAt: now,
      });
      continue;
    }

    if (limits.maxSignalsPerDay === null) {
      continue; // non dovrebbe accadere per il tier free, ma resta un no-op sicuro
    }

    const deliveredToday = deps.signalDeliveriesRepo.listDeliveredTodayIds(
      device.walletPubkey,
      now,
    );
    if (deliveredToday.size >= limits.maxSignalsPerDay) {
      continue; // quota già esaurita, l'utente è già stato notificato oggi
    }

    // Riserva subito la quota (stesso contatore usato da GET /signals, vedi
    // signal-deliveries-repo): evita corse fra più segnali ravvicinati.
    deps.signalDeliveriesRepo.record(device.walletPubkey, [signal.id], now);

    const scheduledAt = new Date(now.getTime() + limits.signalDelaySeconds * 1000);
    deps.pushNotificationsRepo.schedule({
      deviceId: device.id,
      walletPubkey: device.walletPubkey,
      signalId: signal.id,
      type: "signal",
      ...notification,
      scheduledAt,
    });

    const justReachedLimit = deliveredToday.size + 1 >= limits.maxSignalsPerDay;
    if (
      justReachedLimit &&
      !deps.pushNotificationsRepo.hasScheduledToday(device.id, "limit-reached", now)
    ) {
      deps.pushNotificationsRepo.schedule({
        deviceId: device.id,
        walletPubkey: device.walletPubkey,
        signalId: null,
        type: "limit-reached",
        ...LIMIT_REACHED_NOTIFICATION,
        scheduledAt,
      });
    }
  }
}
