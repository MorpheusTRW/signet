import type { PaperTrade } from "../paper-trading/types.js";
import type { DbClient } from "./client.js";

interface PaperTradeRow {
  id: string;
  signal_id: string;
  size_sol: number;
  outcome_multiplier: number;
  pnl_sol: number;
  status: PaperTrade["status"];
  opened_at: string;
  closes_at: string;
  closed_at: string | null;
}

function rowToTrade(row: PaperTradeRow): PaperTrade {
  return {
    id: row.id,
    signalId: row.signal_id,
    sizeSol: row.size_sol,
    outcomeMultiplier: row.outcome_multiplier,
    pnlSol: row.pnl_sol,
    status: row.status,
    openedAt: row.opened_at,
    closesAt: row.closes_at,
    closedAt: row.closed_at,
  };
}

export class PaperTradesRepo {
  constructor(private readonly db: DbClient) {}

  insert(trade: PaperTrade): void {
    this.db
      .prepare(
        `INSERT INTO paper_trades (
          id, signal_id, size_sol, outcome_multiplier, pnl_sol,
          status, opened_at, closes_at, closed_at
        ) VALUES (
          @id, @signalId, @sizeSol, @outcomeMultiplier, @pnlSol,
          @status, @openedAt, @closesAt, @closedAt
        )`,
      )
      .run({ ...trade, closedAt: trade.closedAt });
  }

  /** Chiude (realizza il PnL di) le posizioni la cui `closesAt` è già passata. */
  settleDueTrades(now: Date = new Date()): void {
    this.db
      .prepare(
        `UPDATE paper_trades SET status = 'closed', closed_at = ?
         WHERE status = 'open' AND closes_at <= ?`,
      )
      .run(now.toISOString(), now.toISOString());
  }

  /** Esposizione corrente in SOL sulle posizioni ancora aperte. */
  sumOpenExposureSol(now: Date = new Date()): number {
    this.settleDueTrades(now);
    const row = this.db
      .prepare(
        `SELECT COALESCE(SUM(size_sol), 0) AS total FROM paper_trades WHERE status = 'open'`,
      )
      .get() as { total: number };
    return row.total;
  }

  listBySignalId(signalId: string): PaperTrade[] {
    const rows = this.db
      .prepare("SELECT * FROM paper_trades WHERE signal_id = ? ORDER BY opened_at DESC")
      .all(signalId) as PaperTradeRow[];
    return rows.map(rowToTrade);
  }

  list(limit: number): PaperTrade[] {
    const rows = this.db
      .prepare("SELECT * FROM paper_trades ORDER BY opened_at DESC LIMIT ?")
      .all(limit) as PaperTradeRow[];
    return rows.map(rowToTrade);
  }
}
