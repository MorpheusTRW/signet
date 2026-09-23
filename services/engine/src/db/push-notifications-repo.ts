import { randomUUID } from "node:crypto";
import type { DbClient } from "./client.js";

export type PushType = "signal" | "limit-reached";
export type PushStatus = "pending" | "sent" | "failed";

export interface PushNotificationRecord {
  id: string;
  deviceId: string;
  walletPubkey: string;
  signalId: string | null;
  type: PushType;
  title: string;
  body: string;
  data: Record<string, string>;
  scheduledAt: string;
  sentAt: string | null;
  status: PushStatus;
  error: string | null;
}

interface PushNotificationRow {
  id: string;
  device_id: string;
  wallet_pubkey: string;
  signal_id: string | null;
  type: PushType;
  title: string;
  body: string;
  data_json: string;
  scheduled_at: string;
  sent_at: string | null;
  status: PushStatus;
  error: string | null;
}

function rowToRecord(row: PushNotificationRow): PushNotificationRecord {
  return {
    id: row.id,
    deviceId: row.device_id,
    walletPubkey: row.wallet_pubkey,
    signalId: row.signal_id,
    type: row.type,
    title: row.title,
    body: row.body,
    data: JSON.parse(row.data_json) as Record<string, string>,
    scheduledAt: row.scheduled_at,
    sentAt: row.sent_at,
    status: row.status,
    error: row.error,
  };
}

function startOfUtcDay(now: Date): string {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  ).toISOString();
}

export class PushNotificationsRepo {
  constructor(private readonly db: DbClient) {}

  schedule(params: {
    deviceId: string;
    walletPubkey: string;
    signalId: string | null;
    type: PushType;
    title: string;
    body: string;
    data: Record<string, string>;
    scheduledAt: Date;
  }): PushNotificationRecord {
    const record: PushNotificationRecord = {
      id: randomUUID(),
      deviceId: params.deviceId,
      walletPubkey: params.walletPubkey,
      signalId: params.signalId,
      type: params.type,
      title: params.title,
      body: params.body,
      data: params.data,
      scheduledAt: params.scheduledAt.toISOString(),
      sentAt: null,
      status: "pending",
      error: null,
    };

    this.db
      .prepare(
        `INSERT INTO push_notifications (
          id, device_id, wallet_pubkey, signal_id, type, title, body,
          data_json, scheduled_at, sent_at, status, error
        ) VALUES (
          @id, @deviceId, @walletPubkey, @signalId, @type, @title, @body,
          @dataJson, @scheduledAt, @sentAt, @status, @error
        )`,
      )
      .run({ ...record, dataJson: JSON.stringify(record.data) });

    return record;
  }

  /** True se esiste già una notifica di questo tipo per il device, pianificata da oggi (UTC) in poi. */
  hasScheduledToday(deviceId: string, type: PushType, now: Date = new Date()): boolean {
    const row = this.db
      .prepare(
        `SELECT 1 FROM push_notifications
         WHERE device_id = ? AND type = ? AND scheduled_at >= ?
         LIMIT 1`,
      )
      .get(deviceId, type, startOfUtcDay(now));
    return row !== undefined;
  }

  listDue(now: Date = new Date()): PushNotificationRecord[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM push_notifications WHERE status = 'pending' AND scheduled_at <= ?
         ORDER BY scheduled_at ASC`,
      )
      .all(now.toISOString()) as PushNotificationRow[];
    return rows.map(rowToRecord);
  }

  markSent(id: string, sentAt: Date = new Date()): void {
    this.db
      .prepare(
        `UPDATE push_notifications SET status = 'sent', sent_at = ? WHERE id = ?`,
      )
      .run(sentAt.toISOString(), id);
  }

  markFailed(id: string, error: string): void {
    this.db
      .prepare(`UPDATE push_notifications SET status = 'failed', error = ? WHERE id = ?`)
      .run(error, id);
  }

  list(limit = 10_000): PushNotificationRecord[] {
    const rows = this.db
      .prepare(`SELECT * FROM push_notifications ORDER BY scheduled_at DESC LIMIT ?`)
      .all(limit) as PushNotificationRow[];
    return rows.map(rowToRecord);
  }
}
