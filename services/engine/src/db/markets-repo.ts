import type { PoolVaults } from "../market/pool.js";
import type { DbClient } from "./client.js";

export interface Market extends PoolVaults {
  signalId: string;
  /** Prezzo (SOL per token) al momento della migrazione, dalle riserve iniziali della pool. */
  priceSolAtSignal: number;
}

interface MarketRow {
  signal_id: string;
  base_vault: string;
  quote_vault: string;
  price_sol_at_signal: number;
}

const toMarket = (row: MarketRow): Market => ({
  signalId: row.signal_id,
  baseVault: row.base_vault,
  quoteVault: row.quote_vault,
  priceSolAtSignal: row.price_sol_at_signal,
});

/** Vault della pool di ogni segnale reale: servono per leggerne il prezzo nel tempo. */
export class MarketsRepo {
  constructor(private readonly db: DbClient) {}

  insert(market: Market): void {
    this.db
      .prepare(
        `INSERT OR REPLACE INTO markets (signal_id, base_vault, quote_vault, price_sol_at_signal)
         VALUES (@signalId, @baseVault, @quoteVault, @priceSolAtSignal)`,
      )
      .run(market);
  }

  find(signalId: string): Market | undefined {
    const row = this.db.prepare("SELECT * FROM markets WHERE signal_id = ?").get(signalId) as MarketRow | undefined;
    return row ? toMarket(row) : undefined;
  }
}
