import { randomUUID } from "node:crypto";
import type { RiskLevel } from "@seeker-signal/shared";
import type { TrackRecordCategory } from "../track-record/generate-outcome.js";
import type { DbClient } from "./client.js";

export type TrackRecordSource = "synthetic" | "real";

export interface TrackRecordEntry {
  id: string;
  source: TrackRecordSource;
  /** Prezzo alla migrazione (solo per source "real"). */
  priceSolAtSignal: number | null;
  signalId: string;
  category: TrackRecordCategory;
  riskLevel: RiskLevel;
  createdAt: string;
  dueAt1h: string;
  dueAt24h: string;
  priceChange1hPct: number | null;
  priceChange24hPct: number | null;
  settled1h: boolean;
  settled24h: boolean;
}

interface TrackRecordRow {
  id: string;
  source: TrackRecordSource;
  price_sol_at_signal: number | null;
  signal_id: string;
  category: TrackRecordCategory;
  risk_level: RiskLevel;
  created_at: string;
  due_at_1h: string;
  due_at_24h: string;
  price_change_1h_pct: number | null;
  price_change_24h_pct: number | null;
  settled_1h: 0 | 1;
  settled_24h: 0 | 1;
}

function rowToEntry(row: TrackRecordRow): TrackRecordEntry {
  return {
    id: row.id,
    source: row.source,
    priceSolAtSignal: row.price_sol_at_signal,
    signalId: row.signal_id,
    category: row.category,
    riskLevel: row.risk_level,
    createdAt: row.created_at,
    dueAt1h: row.due_at_1h,
    dueAt24h: row.due_at_24h,
    priceChange1hPct: row.price_change_1h_pct,
    priceChange24hPct: row.price_change_24h_pct,
    settled1h: row.settled_1h === 1,
    settled24h: row.settled_24h === 1,
  };
}

export class TrackRecordsRepo {
  constructor(private readonly db: DbClient) {}

  insert(params: {
    signalId: string;
    category: TrackRecordCategory;
    riskLevel: RiskLevel;
    createdAt: Date;
    source?: TrackRecordSource;
    priceSolAtSignal?: number | null;
  }): TrackRecordEntry {
    const dueAt1h = new Date(params.createdAt.getTime() + 3_600_000);
    const dueAt24h = new Date(params.createdAt.getTime() + 24 * 3_600_000);

    const entry: TrackRecordEntry = {
      id: randomUUID(),
      source: params.source ?? "synthetic",
      priceSolAtSignal: params.priceSolAtSignal ?? null,
      signalId: params.signalId,
      category: params.category,
      riskLevel: params.riskLevel,
      createdAt: params.createdAt.toISOString(),
      dueAt1h: dueAt1h.toISOString(),
      dueAt24h: dueAt24h.toISOString(),
      priceChange1hPct: null,
      priceChange24hPct: null,
      settled1h: false,
      settled24h: false,
    };

    this.db
      .prepare(
        `INSERT INTO track_records (
          id, source, price_sol_at_signal, signal_id, category, risk_level, created_at, due_at_1h, due_at_24h,
          price_change_1h_pct, price_change_24h_pct, settled_1h, settled_24h
        ) VALUES (
          @id, @source, @priceSolAtSignal, @signalId, @category, @riskLevel, @createdAt, @dueAt1h, @dueAt24h,
          @priceChange1hPct, @priceChange24hPct, 0, 0
        )`,
      )
      .run(entry);

    return entry;
  }

  /** Righe con marcatura +1h o +24h scaduta e non ancora realizzata. */
  listDueForSettlement(now: Date = new Date(), source: TrackRecordSource = "synthetic"): TrackRecordEntry[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM track_records
         WHERE source = ? AND ((settled_1h = 0 AND due_at_1h <= ?)
            OR (settled_24h = 0 AND due_at_24h <= ?))`,
      )
      .all(source, now.toISOString(), now.toISOString()) as TrackRecordRow[];
    return rows.map(rowToEntry);
  }

  /** `null` = marcatura mancata (letta troppo tardi o non leggibile): esclusa dalle statistiche. */
  settle1h(id: string, priceChangePct: number | null): void {
    this.db
      .prepare(
        `UPDATE track_records SET price_change_1h_pct = ?, settled_1h = 1 WHERE id = ?`,
      )
      .run(priceChangePct, id);
  }

  settle24h(id: string, priceChangePct: number | null): void {
    this.db
      .prepare(
        `UPDATE track_records SET price_change_24h_pct = ?, settled_24h = 1 WHERE id = ?`,
      )
      .run(priceChangePct, id);
  }

  list(source: TrackRecordSource = "synthetic", limit = 10_000): TrackRecordEntry[] {
    const rows = this.db
      .prepare(`SELECT * FROM track_records WHERE source = ? ORDER BY created_at DESC LIMIT ?`)
      .all(source, limit) as TrackRecordRow[];
    return rows.map(rowToEntry);
  }

  /** Marcature di una categoria create da `sinceIso`, più recenti prima. */
  listSince(source: TrackRecordSource, category: TrackRecordCategory, sinceIso: string): TrackRecordEntry[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM track_records WHERE source = ? AND category = ? AND created_at >= ?
         ORDER BY created_at DESC`,
      )
      .all(source, category, sinceIso) as TrackRecordRow[];
    return rows.map(rowToEntry);
  }

  /** Marcatura di ogni segnale richiesto (al più una per segnale). */
  findBySignalIds(signalIds: string[]): Map<string, TrackRecordEntry> {
    if (signalIds.length === 0) return new Map();
    const rows = this.db
      .prepare(`SELECT * FROM track_records WHERE signal_id IN (${signalIds.map(() => "?").join(",")})`)
      .all(...signalIds) as TrackRecordRow[];
    return new Map(rows.map((row) => [row.signal_id, rowToEntry(row)]));
  }
}
