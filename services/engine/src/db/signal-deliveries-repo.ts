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

  /**
   * Id dei segnali passati dai filtri già consegnati a questo wallet dall'inizio della
   * giornata UTC: è il contatore della quota FREE (feed e push). I token scartati
   * (rischio alto) non sono chiamate da seguire e non consumano quota.
   */
  listDeliveredTodayIds(walletPubkey: string, now: Date = new Date()): Set<string> {
    const rows = this.db
      .prepare(
        `SELECT d.signal_id FROM signal_deliveries d
         JOIN signals s ON s.id = d.signal_id
         WHERE d.wallet_pubkey = ? AND d.delivered_at >= ? AND s.risk_level != 'high'`,
      )
      .all(walletPubkey, startOfUtcDay(now)) as { signal_id: string }[];
    return new Set(rows.map((r) => r.signal_id));
  }
}
