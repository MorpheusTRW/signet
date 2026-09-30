import type { MarketsRepo } from "../db/markets-repo.js";
import type { TrackRecordSource, TrackRecordsRepo } from "../db/track-records-repo.js";
import type { RpcCall } from "../ingest/helius/rpc.js";
import { readPoolReserves, spotPriceSol } from "../market/pool.js";
import { settleDueTrackRecords } from "../track-record/settle.js";
import { DAY_MS } from "./discipline.js";

export interface RejectedOutcome {
  signalId: string;
  createdAt: string;
  /** Variazione di prezzo dallo scarto; null = non ancora misurabile. */
  changePct: number | null;
}

export interface RejectedOutcomesDeps {
  trackRecordsRepo: TrackRecordsRepo;
  marketsRepo: MarketsRepo;
  rpc: RpcCall | undefined;
  source: TrackRecordSource;
  cacheTtlMs: number;
}

/**
 * Cosa è successo ai token scartati (rischio alto). Per quelli delle ultime 24h il prezzo
 * è letto adesso dalla pool (condiviso fra i wallet e riletto al massimo ogni `cacheTtlMs`);
 * per i più vecchi vale l'ultima marcatura del track record (+24h, altrimenti +1h).
 */
export class RejectedOutcomes {
  private cache: { at: number; changes: Map<string, number> } | null = null;
  private inFlight: Promise<Map<string, number>> | null = null;

  constructor(private readonly deps: RejectedOutcomesDeps) {}

  async listSince(sinceIso: string, now: Date = new Date()): Promise<RejectedOutcome[]> {
    if (this.deps.source === "synthetic") settleDueTrackRecords(this.deps.trackRecordsRepo, now);
    const live = await this.liveChanges(now);
    return this.deps.trackRecordsRepo.listSince(this.deps.source, "discarded", sinceIso).map((entry) => ({
      signalId: entry.signalId,
      createdAt: entry.createdAt,
      changePct: live.get(entry.signalId) ?? entry.priceChange24hPct ?? entry.priceChange1hPct,
    }));
  }

  private async liveChanges(now: Date): Promise<Map<string, number>> {
    if (!this.deps.rpc || this.deps.source !== "real") return new Map();
    if (this.cache && now.getTime() - this.cache.at < this.deps.cacheTtlMs) return this.cache.changes;
    this.inFlight ??= this.readLive(this.deps.rpc, now).finally(() => {
      this.inFlight = null;
    });
    return this.inFlight;
  }

  private async readLive(rpc: RpcCall, now: Date): Promise<Map<string, number>> {
    const since = new Date(now.getTime() - DAY_MS).toISOString();
    const markets = this.deps.trackRecordsRepo
      .listSince("real", "discarded", since)
      .map((entry) => this.deps.marketsRepo.find(entry.signalId))
      .filter((market): market is NonNullable<typeof market> => !!market && market.priceSolAtSignal > 0);

    const changes = new Map<string, number>();
    try {
      const reserves = await readPoolReserves(rpc, markets);
      markets.forEach((market, index) => {
        const pool = reserves[index];
        // Pool chiusa o vault vuoto: liquidità ritirata, per chi deteneva il token vale zero.
        const change = pool ? (spotPriceSol(pool) / market.priceSolAtSignal - 1) * 100 : -100;
        changes.set(market.signalId, Number(change.toFixed(2)));
      });
    } catch {
      // RPC non raggiungibile: si usano le marcature già registrate, senza inventare prezzi.
      return this.cache?.changes ?? changes;
    }
    this.cache = { at: now.getTime(), changes };
    return changes;
  }
}
