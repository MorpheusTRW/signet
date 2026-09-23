import type { TrackRecordsRepo } from "../db/track-records-repo.js";
import { generateSyntheticOutcome } from "./generate-outcome.js";

/**
 * Realizza le marcature +1h/+24h scadute. In synthetic mode l'esito è
 * generato in modo deterministico e realistico (generate-outcome.ts); un
 * futuro adapter "live" sostituirebbe questa chiamata con una lettura del
 * prezzo reale del token in quell'istante.
 */
export function settleDueTrackRecords(
  repo: TrackRecordsRepo,
  now: Date = new Date(),
): void {
  for (const entry of repo.listDueForSettlement(now)) {
    const outcome = generateSyntheticOutcome(entry.signalId, entry.category);

    if (!entry.settled1h && new Date(entry.dueAt1h) <= now) {
      repo.settle1h(entry.id, outcome.priceChange1hPct);
    }
    if (!entry.settled24h && new Date(entry.dueAt24h) <= now) {
      repo.settle24h(entry.id, outcome.priceChange24hPct);
    }
  }
}
