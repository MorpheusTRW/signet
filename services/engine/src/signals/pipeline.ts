import type { Signal } from "@seeker-signal/shared";
import type { MarketsRepo } from "../db/markets-repo.js";
import type { SignalsRepo } from "../db/signals-repo.js";
import type { TrackRecordsRepo } from "../db/track-records-repo.js";
import type { RawLaunchEvent } from "../ingest/event-source.js";
import type { TrackRecordCategory } from "../track-record/generate-outcome.js";
import { buildSignal } from "./build-signal.js";

export interface SignalPipelineDeps {
  signalsRepo: SignalsRepo;
  trackRecordsRepo: TrackRecordsRepo;
  marketsRepo: MarketsRepo;
}

/** "high" risk viene scartato (non promosso come segnale); il resto è "segnalato". */
function trackRecordCategoryFor(signal: Signal): TrackRecordCategory {
  return signal.riskReport.level === "high" ? "discarded" : "signaled";
}

/**
 * Trasforma un evento di ingest in un Signal e lo persiste, con una marcatura di track
 * record realizzata a +1h/+24h. Con dati di mercato (adapter on-chain) la marcatura è
 * "real" e userà il prezzo della pool; senza (synthetic) resta simulata.
 * Il server non apre MAI posizioni da solo: le posizioni sono solo quelle dell'utente.
 */
export function processLaunchEvent(event: RawLaunchEvent, deps: SignalPipelineDeps): Signal {
  const signal = buildSignal(event);
  deps.signalsRepo.insert(signal);

  if (event.market) {
    deps.marketsRepo.insert({
      signalId: signal.id,
      baseVault: event.market.baseVault,
      quoteVault: event.market.quoteVault,
      priceSolAtSignal: event.market.priceSol,
    });
  }

  deps.trackRecordsRepo.insert({
    signalId: signal.id,
    category: trackRecordCategoryFor(signal),
    riskLevel: signal.riskReport.level,
    createdAt: new Date(signal.createdAt),
    source: event.market ? "real" : "synthetic",
    priceSolAtSignal: event.market?.priceSol ?? null,
  });

  return signal;
}
