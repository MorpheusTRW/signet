import { randomUUID } from "node:crypto";
import type { RiskLevel, RiskReport, Signal } from "@seeker-signal/shared";
import { hashStringToSeed, mulberry32, type Rng } from "../ingest/synthetic/rng.js";
import type { PaperTrade, PaperTradingConfig } from "./types.js";

/** Un segnale "high" risk non viene mai auto-approvato per il paper trading. */
export function isSignalApprovable(riskReport: RiskReport): boolean {
  return riskReport.level !== "high";
}

/**
 * Quanto è possibile investire in una nuova entry senza superare il limite di
 * esposizione (CLAUDE.md, principio 3): mai più di `maxExposureFraction` del
 * portafoglio in posizioni aperte. Ritorna 0 se non c'è più margine.
 */
export function computeEntrySize(
  currentOpenExposureSol: number,
  config: PaperTradingConfig,
): number {
  const maxExposureSol = config.portfolioValueSol * config.maxExposureFraction;
  const remaining = maxExposureSol - currentOpenExposureSol;
  if (remaining <= 0) return 0;
  return Math.min(config.defaultPositionSizeSol, remaining);
}

const OUTCOME_RANGE_BY_LEVEL: Record<RiskLevel, [number, number]> = {
  low: [0.7, 3.0],
  medium: [0.4, 2.0],
  high: [0.05, 1.5],
};

function sampleOutcomeMultiplier(level: RiskLevel, rng: Rng): number {
  const [min, max] = OUTCOME_RANGE_BY_LEVEL[level];
  return min + rng() * (max - min);
}

const MIN_HOLDING_MINUTES = 5;
const MAX_HOLDING_MINUTES = 90;

/**
 * Apre una posizione di paper trading: l'esito (multiplier/PnL) e la durata
 * della simulazione sono deterministici rispetto a `signal.id` + size, così
 * la funzione resta pura e testabile. La posizione resta "open" fino a
 * `closesAt`: è così che il limite di esposizione del 20% (principio 3 di
 * CLAUDE.md) ha un effetto reale fra segnali concorrenti, invece di essere
 * azzerato immediatamente da una chiusura sincrona.
 */
export function simulatePaperTrade(
  signal: Signal,
  sizeSol: number,
  now: Date = new Date(),
): PaperTrade {
  const rng = mulberry32(hashStringToSeed(`${signal.id}:${sizeSol}`));
  const outcomeMultiplier = Number(
    sampleOutcomeMultiplier(signal.riskReport.level, rng).toFixed(4),
  );
  const holdingMinutes = Math.round(
    MIN_HOLDING_MINUTES + rng() * (MAX_HOLDING_MINUTES - MIN_HOLDING_MINUTES),
  );
  const pnlSol = Number((sizeSol * (outcomeMultiplier - 1)).toFixed(6));
  const closesAt = new Date(now.getTime() + holdingMinutes * 60_000);

  return {
    id: randomUUID(),
    signalId: signal.id,
    sizeSol,
    outcomeMultiplier,
    pnlSol,
    status: "open",
    openedAt: now.toISOString(),
    closesAt: closesAt.toISOString(),
    closedAt: null,
  };
}
