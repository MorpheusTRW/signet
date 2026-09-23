import type { DbClient } from "./client.js";

function startOfUtcDay(now: Date): string {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  ).toISOString();
}

export class SignalDeliveriesRepo {
  constructor(private readonly db: DbClient) {}

  record(walletPubkey: string, signalIds: string[], now: Date = new Date()): void {
    if (signalIds.length === 0) return;
    const insert = this.db.prepare(
      `INSERT OR IGNORE INTO signal_deliveries (wallet_pubkey, signal_id, delivered_at)
       VALUES (?, ?, ?)`,
    );
    const insertMany = this.db.transaction((ids: string[]) => {
      for (const signalId of ids) {
        insert.run(walletPubkey, signalId, now.toISOString());
      }
    });
    insertMany(signalIds);
  }

  /** Id dei segnali già consegnati a questo wallet dall'inizio della giornata UTC corrente. */
  listDeliveredTodayIds(walletPubkey: string, now: Date = new Date()): Set<string> {
    const rows = this.db
      .prepare(
        `SELECT signal_id FROM signal_deliveries
         WHERE wallet_pubkey = ? AND delivered_at >= ?`,
      )
      .all(walletPubkey, startOfUtcDay(now)) as { signal_id: string }[];
    return new Set(rows.map((r) => r.signal_id));
  }
}
