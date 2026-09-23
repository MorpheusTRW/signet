import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";

const MIGRATIONS = `
CREATE TABLE IF NOT EXISTS signals (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  program TEXT NOT NULL,
  token_mint TEXT NOT NULL,
  pool_address TEXT NOT NULL,
  token_symbol TEXT,
  token_name TEXT,
  initial_liquidity_sol REAL NOT NULL,
  risk_score REAL NOT NULL,
  risk_level TEXT NOT NULL,
  risk_reasons TEXT NOT NULL,
  summary TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_signals_created_at ON signals(created_at DESC);

CREATE TABLE IF NOT EXISTS devices (
  id TEXT PRIMARY KEY,
  wallet_pubkey TEXT NOT NULL UNIQUE,
  fcm_token TEXT NOT NULL,
  api_key_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS paper_trades (
  id TEXT PRIMARY KEY,
  signal_id TEXT NOT NULL REFERENCES signals(id),
  size_sol REAL NOT NULL,
  outcome_multiplier REAL NOT NULL,
  pnl_sol REAL NOT NULL,
  status TEXT NOT NULL,
  opened_at TEXT NOT NULL,
  closes_at TEXT NOT NULL,
  closed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_paper_trades_signal_id ON paper_trades(signal_id);
CREATE INDEX IF NOT EXISTS idx_paper_trades_status ON paper_trades(status);

CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY,
  wallet_pubkey TEXT NOT NULL,
  tier TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  payment_signature TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_wallet ON subscriptions(wallet_pubkey, expires_at DESC);

CREATE TABLE IF NOT EXISTS signal_deliveries (
  wallet_pubkey TEXT NOT NULL,
  signal_id TEXT NOT NULL,
  delivered_at TEXT NOT NULL,
  PRIMARY KEY (wallet_pubkey, signal_id)
);

CREATE INDEX IF NOT EXISTS idx_signal_deliveries_wallet_day ON signal_deliveries(wallet_pubkey, delivered_at);

CREATE TABLE IF NOT EXISTS track_records (
  id TEXT PRIMARY KEY,
  signal_id TEXT NOT NULL REFERENCES signals(id),
  category TEXT NOT NULL,
  risk_level TEXT NOT NULL,
  created_at TEXT NOT NULL,
  due_at_1h TEXT NOT NULL,
  due_at_24h TEXT NOT NULL,
  price_change_1h_pct REAL,
  price_change_24h_pct REAL,
  settled_1h INTEGER NOT NULL DEFAULT 0,
  settled_24h INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_track_records_category ON track_records(category);
CREATE INDEX IF NOT EXISTS idx_track_records_settle ON track_records(settled_1h, settled_24h);
`;

export type DbClient = Database.Database;

export function createDb(path: string): DbClient {
  if (path !== ":memory:") {
    mkdirSync(dirname(path), { recursive: true });
  }
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.exec(MIGRATIONS);
  return db;
}
