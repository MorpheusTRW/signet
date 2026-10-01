import type { Signal } from "@seeker-signal/shared";
import type { TierLimits } from "./types.js";

export interface SelectSignalsParams {
  now: Date;
  /** Candidati già ordinati per createdAt decrescente (più recente prima). */
  candidatesDesc: Signal[];
  limits: TierLimits;
  /** Id dei segnali già consegnati oggi a questo wallet (solo rilevante se maxSignalsPerDay è impostato). */
  alreadyDeliveredIdsToday: ReadonlySet<string>;
  requestedLimit: number;
}

export interface SelectSignalsResult {
  signals: Signal[];
  /** Id dei segnali inclusi in questa risposta che non erano ancora stati consegnati oggi. */
  newlyDeliveredIds: string[];
}

/**
 * Applica ritardo, finestra di storico e limite giornaliero (FREE) a un feed
 * di segnali. PRO/HOLDER hanno `signalDelaySeconds: 0`, `maxSignalsPerDay:
 * null` e `historyHours: null`, quindi vedono tutto in tempo reale.
 */
export function selectSignalsForTier(
  params: SelectSignalsParams,
): SelectSignalsResult {
  const { now, candidatesDesc, limits, alreadyDeliveredIdsToday, requestedLimit } =
    params;

  const cutoff = new Date(now.getTime() - limits.signalDelaySeconds * 1000);
  const historyFloor =
    limits.historyHours != null
      ? new Date(now.getTime() - limits.historyHours * 3_600_000)
      : null;

  const eligible = candidatesDesc.filter((signal) => {
    const createdAt = new Date(signal.createdAt);
    if (createdAt > cutoff) return false;
    if (historyFloor && createdAt < historyFloor) return false;
    return true;
  });

  if (limits.maxSignalsPerDay == null) {
    return { signals: eligible.slice(0, requestedLimit), newlyDeliveredIds: [] };
  }

  // La quota giornaliera conta solo i segnali passati dai filtri: gli scartati (rischio
  // alto) non sono chiamate da seguire, si vedono sempre e non la consumano.
  const rejected = eligible.filter((s) => s.riskReport.level === "high");
  const passed = eligible.filter((s) => s.riskReport.level !== "high");
  const knownRejectedIds = new Set(candidatesDesc.filter((s) => s.riskReport.level === "high").map((s) => s.id));
  const usedQuota = [...alreadyDeliveredIdsToday].filter((id) => !knownRejectedIds.has(id)).length;

  const alreadyDelivered = passed.filter((s) => alreadyDeliveredIdsToday.has(s.id));
  const notYetDelivered = passed.filter((s) => !alreadyDeliveredIdsToday.has(s.id));
  const remainingQuota = Math.max(0, limits.maxSignalsPerDay - usedQuota);
  const newlyIncluded = notYetDelivered.slice(0, remainingQuota);

  const merged = [...alreadyDelivered, ...newlyIncluded, ...rejected]
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, requestedLimit);

  return { signals: merged, newlyDeliveredIds: newlyIncluded.map((s) => s.id) };
}
