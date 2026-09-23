import type { Signal } from "@seeker-signal/shared";
import type { PaperTradesRepo } from "../db/paper-trades-repo.js";
import type { SignalsRepo } from "../db/signals-repo.js";
import type { RawLaunchEvent } from "../ingest/event-source.js";
import {
  computeEntrySize,
  isSignalApprovable,
  simulatePaperTrade,
} from "../paper-trading/engine.js";
import type { PaperTradingConfig } from "../paper-trading/types.js";
import { buildSignal } from "./build-signal.js";

export interface SignalPipelineDeps {
  signalsRepo: SignalsRepo;
  paperTradesRepo: PaperTradesRepo;
  paperTradingConfig: PaperTradingConfig;
}

/**
 * Trasforma un evento di ingest grezzo in un Signal, lo persiste e — se il
 * rischio lo consente e c'è margine nel limite di esposizione — apre una
 * posizione di paper trading simulata.
 */
export function processLaunchEvent(
  event: RawLaunchEvent,
  deps: SignalPipelineDeps,
): Signal {
  const signal = buildSignal(event);
  deps.signalsRepo.insert(signal);

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
