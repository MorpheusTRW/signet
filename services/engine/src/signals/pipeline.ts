import type { Signal } from "@seeker-signal/shared";
import type { PaperTradesRepo } from "../db/paper-trades-repo.js";
import type { SignalsRepo } from "../db/signals-repo.js";
import type { TrackRecordsRepo } from "../db/track-records-repo.js";
import type { RawLaunchEvent } from "../ingest/event-source.js";
import {
  computeEntrySize,
  isSignalApprovable,
  simulatePaperTrade,
} from "../paper-trading/engine.js";
import type { PaperTradingConfig } from "../paper-trading/types.js";
import type { TrackRecordCategory } from "../track-record/generate-outcome.js";
import { buildSignal } from "./build-signal.js";

export interface SignalPipelineDeps {
  signalsRepo: SignalsRepo;
  paperTradesRepo: PaperTradesRepo;
  paperTradingConfig: PaperTradingConfig;
  trackRecordsRepo: TrackRecordsRepo;
}

/** "high" risk viene scartato (non promosso come segnale); il resto è "segnalato". */
function trackRecordCategoryFor(signal: Signal): TrackRecordCategory {
  return signal.riskReport.level === "high" ? "discarded" : "signaled";
}

/**
 * Trasforma un evento di ingest grezzo in un Signal, lo persiste e — se il
 * rischio lo consente e c'è margine nel limite di esposizione — apre una
 * posizione di paper trading simulata. Registra anche una marcatura di
 * track record (per la stickiness, vedi CLAUDE.md) che verrà realizzata a
 * +1h/+24h con il prezzo del token in quel momento.
 */
export function processLaunchEvent(
  event: RawLaunchEvent,
  deps: SignalPipelineDeps,
): Signal {
  const signal = buildSignal(event);
  deps.signalsRepo.insert(signal);

  deps.trackRecordsRepo.insert({
    signalId: signal.id,
    category: trackRecordCategoryFor(signal),
    riskLevel: signal.riskReport.level,
    createdAt: new Date(signal.createdAt),
  });

  if (isSignalApprovable(signal.riskReport)) {
    const openExposureSol = deps.paperTradesRepo.sumOpenExposureSol();
    const sizeSol = computeEntrySize(openExposureSol, deps.paperTradingConfig);
    if (sizeSol > 0) {
      const trade = simulatePaperTrade(signal, sizeSol);
      deps.paperTradesRepo.insert(trade);
    }
  }

  return signal;
}
