import type { MarketsRepo } from "../db/markets-repo.js";
import type { TrackRecordEntry, TrackRecordsRepo } from "../db/track-records-repo.js";
import type { RpcCall } from "../ingest/helius/rpc.js";
import { readPoolReserves, spotPriceSol } from "../market/pool.js";

/**
 * Oltre questa finestra dalla scadenza la marcatura è "mancata" (es. server spento):
 * meglio escluderla che registrare come "prezzo a 1h" un prezzo letto 5 ore dopo.
 */
export const LATE_WINDOW_1H_MS = 15 * 60_000;
export const LATE_WINDOW_24H_MS = 2 * 3_600_000;

type Mark = { entry: TrackRecordEntry; window: "1h" | "24h" };

/** Realizza le marcature +1h/+24h dei segnali reali leggendo il prezzo dalla pool. */
export async function settleRealTrackRecords(
  deps: { trackRecordsRepo: TrackRecordsRepo; marketsRepo: MarketsRepo; rpc: RpcCall },
  now: Date = new Date(),
): Promise<number> {
  const { trackRecordsRepo, marketsRepo } = deps;
  const settle = (mark: Mark, value: number | null) =>
    mark.window === "1h" ? trackRecordsRepo.settle1h(mark.entry.id, value) : trackRecordsRepo.settle24h(mark.entry.id, value);

  const marks: Mark[] = [];
  for (const entry of trackRecordsRepo.listDueForSettlement(now, "real")) {
    for (const window of ["1h", "24h"] as const) {
      const settled = window === "1h" ? entry.settled1h : entry.settled24h;
      const due = new Date(window === "1h" ? entry.dueAt1h : entry.dueAt24h).getTime();
      if (settled || due > now.getTime()) continue;
      const lateness = now.getTime() - due;
      if (lateness > (window === "1h" ? LATE_WINDOW_1H_MS : LATE_WINDOW_24H_MS)) {
        settle({ entry, window }, null);
      } else {
        marks.push({ entry, window });
      }
    }
  }

  const readable = marks
    .map((mark) => ({ mark, market: marketsRepo.find(mark.entry.signalId) }))
    .filter((item) => {
      if (item.market && item.mark.entry.priceSolAtSignal) return true;
      settle(item.mark, null);
      return false;
    });
  if (readable.length === 0) return 0;

  // Se l'RPC fallisce lancia: nessuna marcatura viene scritta e si riprova al giro dopo.
  const reserves = await readPoolReserves(deps.rpc, readable.map((item) => item.market!));
  readable.forEach(({ mark }, index) => {
    const pool = reserves[index];
    // Pool chiusa o vault vuoto: la liquidità è stata ritirata, per chi deteneva il token vale zero.
    const change = pool ? (spotPriceSol(pool) / mark.entry.priceSolAtSignal! - 1) * 100 : -100;
    settle(mark, Number(change.toFixed(2)));
  });
  return readable.length;
}

export function startRealTrackRecordSettler(
  deps: { trackRecordsRepo: TrackRecordsRepo; marketsRepo: MarketsRepo; rpc: RpcCall },
  intervalMs: number,
  logger: { warn(obj: object, msg: string): void },
): () => void {
  let running = false;
  const timer = setInterval(() => {
    if (running) return;
    running = true;
    settleRealTrackRecords(deps)
      .catch((err: unknown) => logger.warn({ err }, "track record: lettura prezzi fallita, riprovo"))
      .finally(() => {
        running = false;
      });
  }, intervalMs);
  timer.unref?.();
  return () => clearInterval(timer);
}
