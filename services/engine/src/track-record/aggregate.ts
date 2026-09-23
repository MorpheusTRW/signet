import type { TrackRecordEntry } from "../db/track-records-repo.js";

export interface CategoryWindowStats {
  settledCount: number;
  avgChangePct: number | null;
  medianChangePct: number | null;
  /** Numero di esiti <= -90% (rug/crollo severo). */
  bigLossCount: number;
  /** Numero di esiti >= +100% (almeno raddoppiato). */
  bigGainCount: number;
}

export interface CategoryStats {
  total: number;
  window1h: CategoryWindowStats;
  window24h: CategoryWindowStats;
}

export interface TrackRecordStats {
  discarded: CategoryStats;
  signaled: CategoryStats;
}

const BIG_LOSS_THRESHOLD_PCT = -90;
const BIG_GAIN_THRESHOLD_PCT = 100;

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1]! + sorted[mid]!) / 2
    : sorted[mid]!;
}

function windowStats(values: (number | null)[]): CategoryWindowStats {
  const settled = values.filter((v): v is number => v !== null);
  return {
    settledCount: settled.length,
    avgChangePct:
      settled.length > 0
        ? Number((settled.reduce((a, b) => a + b, 0) / settled.length).toFixed(2))
        : null,
    medianChangePct: median(settled),
    bigLossCount: settled.filter((v) => v <= BIG_LOSS_THRESHOLD_PCT).length,
    bigGainCount: settled.filter((v) => v >= BIG_GAIN_THRESHOLD_PCT).length,
  };
}

/** Aggregazione pura: nessun accesso a DB, opera solo sulle righe già lette. */
export function computeTrackRecordStats(
  entries: TrackRecordEntry[],
): TrackRecordStats {
  const discarded = entries.filter((e) => e.category === "discarded");
  const signaled = entries.filter((e) => e.category === "signaled");

  return {
    discarded: {
      total: discarded.length,
      window1h: windowStats(discarded.map((e) => e.priceChange1hPct)),
      window24h: windowStats(discarded.map((e) => e.priceChange24hPct)),
    },
    signaled: {
      total: signaled.length,
      window1h: windowStats(signaled.map((e) => e.priceChange1hPct)),
      window24h: windowStats(signaled.map((e) => e.priceChange24hPct)),
    },
  };
}
