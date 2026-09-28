import { randomUUID } from "node:crypto";
import type { DbClient } from "./client.js";

export type PositionMode = "paper" | "live";
export type PositionStatus = "open" | "closed";

export interface UserPosition {
  id: string;
  walletPubkey: string;
  signalId: string;
  mode: PositionMode;
  sizeSol: number;
  tokenAmount: number;
  entryPriceSol: number;
  status: PositionStatus;
  openedAt: string;
  closedAt: string | null;
  /** SOL ottenuti alla chiusura (fill simulato sulle riserve reali). */
  exitValueSol: number | null;
}

interface Row {
  id: string;
  wallet_pubkey: string;
  signal_id: string;
  mode: PositionMode;
  size_sol: number;
  token_amount: number;
  entry_price_sol: number;
  status: PositionStatus;
  opened_at: string;
  closed_at: string | null;
  exit_value_sol: number | null;
}

const toPosition = (r: Row): UserPosition => ({
  id: r.id,
  walletPubkey: r.wallet_pubkey,
  signalId: r.signal_id,
  mode: r.mode,
  sizeSol: r.size_sol,
  tokenAmount: r.token_amount,
  entryPriceSol: r.entry_price_sol,
  status: r.status,
  openedAt: r.opened_at,
  closedAt: r.closed_at,
  exitValueSol: r.exit_value_sol,
});

/** Posizioni aperte dall'utente stesso (mai in automatico dal server). */
export class UserPositionsRepo {
  constructor(private readonly db: DbClient) {}

  open(params: Omit<UserPosition, "id" | "status" | "openedAt" | "closedAt" | "exitValueSol">, now = new Date()): UserPosition {
    const position: UserPosition = {
      ...params,
      id: randomUUID(),
      status: "open",
      openedAt: now.toISOString(),
      closedAt: null,
      exitValueSol: null,
    };
    this.db
      .prepare(
        `INSERT INTO user_positions (
          id, wallet_pubkey, signal_id, mode, size_sol, token_amount, entry_price_sol,
          status, opened_at, closed_at, exit_value_sol
        ) VALUES (
          @id, @walletPubkey, @signalId, @mode, @sizeSol, @tokenAmount, @entryPriceSol,
          @status, @openedAt, @closedAt, @exitValueSol
        )`,
      )
      .run(position);
    return position;
  }

  close(id: string, exitValueSol: number, now = new Date()): void {
    this.db
      .prepare(
        `UPDATE user_positions SET status = 'closed', closed_at = ?, exit_value_sol = ?
         WHERE id = ? AND status = 'open'`,
      )
      .run(now.toISOString(), exitValueSol, id);
  }

  find(id: string): UserPosition | undefined {
    const row = this.db.prepare("SELECT * FROM user_positions WHERE id = ?").get(id) as Row | undefined;
    return row ? toPosition(row) : undefined;
  }

  listByWallet(walletPubkey: string, mode: PositionMode, limit = 100): UserPosition[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM user_positions WHERE wallet_pubkey = ? AND mode = ?
         ORDER BY (status = 'open') DESC, opened_at DESC LIMIT ?`,
      )
      .all(walletPubkey, mode, limit) as Row[];
    return rows.map(toPosition);
  }
}
