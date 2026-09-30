import { pubkeySchema, type Signal } from "@seeker-signal/shared";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { DevicesRepo } from "../db/devices-repo.js";
import type { SignalsRepo } from "../db/signals-repo.js";
import type { UserPositionsRepo } from "../db/user-positions-repo.js";
import {
  computeDisciplineStreak,
  DAY_MS,
  type DisciplineStreak,
  isoWeek,
  isRug,
  startOfUtcDay,
} from "../engagement/discipline.js";
import type { RejectedOutcomes } from "../engagement/rejected-outcomes.js";

export interface EngagementRouteDeps {
  signalsRepo: SignalsRepo;
  devicesRepo: DevicesRepo;
  userPositionsRepo: UserPositionsRepo;
  rejectedOutcomes: RejectedOutcomes;
  tradingMode: "paper" | "live";
  rugThresholdPct: number;
  panicSellWindowMinutes: number;
  maxExposureFraction: number;
}

const RECENT_REJECTED = 5;
const MAX_RUGS_LISTED = 20;
const optionalPubkey = z.object({ pubkey: pubkeySchema.optional() });
const requiredPubkey = z.object({ pubkey: pubkeySchema });

/** Motivo principale dello scarto: i motivi arrivano già ordinati dal più pesante. */
function rejectedItem(signal: Signal) {
  return {
    signalId: signal.id,
    tokenSymbol: signal.tokenSymbol ?? null,
    tokenName: signal.tokenName ?? null,
    imageUrl: signal.imageUrl ?? null,
    reason: signal.riskReport.reasons[0] ?? "High risk",
    createdAt: signal.createdAt,
  };
}

/**
 * Radar, rug schivati e recap. Nessun dato dipende da importi o profitti del wallet:
 * si misurano i token evitati e la costanza, non il volume.
 */
export function registerEngagementRoutes(app: FastifyInstance, deps: EngagementRouteDeps): void {
  function streakFor(pubkey: string, now: Date): DisciplineStreak {
    const positions = deps.userPositionsRepo.listByWallet(pubkey, deps.tradingMode, 10_000);
    const firstSeen = [deps.devicesRepo.findByWallet(pubkey)?.createdAt, ...positions.map((p) => p.openedAt)]
      .filter((iso): iso is string => !!iso)
      .sort()[0];
    return computeDisciplineStreak({
      firstSeenAt: firstSeen ?? null,
      positions,
      now,
      panicSellWindowMs: deps.panicSellWindowMinutes * 60_000,
    });
  }

  app.get("/radar", async () => {
    const since = startOfUtcDay(new Date()).toISOString();
    const { total, high } = deps.signalsRepo.countSince(since);
    return {
      since,
      scannedToday: total,
      rejectedToday: high,
      recentRejected: deps.signalsRepo.listRecentByLevel("high", RECENT_REJECTED).map(rejectedItem),
    };
  });

  app.get("/dodged", async (request, reply) => {
    const query = optionalPubkey.safeParse(request.query);
    if (!query.success) return reply.status(400).send({ error: "invalid_query" });
    const now = new Date();
    const outcomes = await deps.rejectedOutcomes.listSince(new Date(now.getTime() - DAY_MS).toISOString(), now);
    const rugs = outcomes.filter((o) => isRug(o.changePct, deps.rugThresholdPct));

    return {
      windowHours: 24,
      rugThresholdPct: deps.rugThresholdPct,
      rejectedCount: outcomes.length,
      rugCount: rugs.length,
      rugs: rugs.slice(0, MAX_RUGS_LISTED).flatMap((rug) => {
        const signal = deps.signalsRepo.findById(rug.signalId);
        return signal ? [{ ...rejectedItem(signal), changePct: rug.changePct! }] : [];
      }),
      streak: query.data.pubkey
        ? {
            ...streakFor(query.data.pubkey, now),
            panicSellWindowMinutes: deps.panicSellWindowMinutes,
            maxExposureFraction: deps.maxExposureFraction,
          }
        : null,
    };
  });

  app.get("/recap", async (request, reply) => {
    const query = requiredPubkey.safeParse(request.query);
    if (!query.success) return reply.status(400).send({ error: "invalid_query" });
    const now = new Date();
    const { year, week, start } = isoWeek(now);
    const outcomes = await deps.rejectedOutcomes.listSince(start.toISOString(), now);
    const approved = deps.userPositionsRepo
      .listByWallet(query.data.pubkey, deps.tradingMode, 10_000)
      .filter((p) => p.openedAt >= start.toISOString()).length;

    return {
      year,
      week,
      weekStart: start.toISOString(),
      rugsDodged: outcomes.filter((o) => isRug(o.changePct, deps.rugThresholdPct)).length,
      signalsApproved: approved,
      streakDays: streakFor(query.data.pubkey, now).days,
    };
  });
}
