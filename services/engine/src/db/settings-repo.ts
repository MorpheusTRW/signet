import type { DbClient } from "./client.js";

/** Key/value persistente per stato operativo che deve sopravvivere ai riavvii (es. kill switch). */
export class SettingsRepo {
  constructor(private readonly db: DbClient) {}

  get(key: string): string | undefined {
    const row = this.db.prepare("SELECT value FROM settings WHERE key = ?").get(key) as
      | { value: string }
      | undefined;
    return row?.value;
  }

  set(key: string, value: string, now: Date = new Date()): void {
    this.db
      .prepare(
        `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      )
      .run(key, value, now.toISOString());
  }
}
