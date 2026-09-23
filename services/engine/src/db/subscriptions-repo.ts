import { randomUUID } from "node:crypto";
import type { DbClient } from "./client.js";

export interface SubscriptionRecord {
  id: string;
  walletPubkey: string;
  tier: "pro";
  expiresAt: string;
  paymentSignature: string;
  createdAt: string;
}

interface SubscriptionRow {
  id: string;
  wallet_pubkey: string;
  tier: "pro";
  expires_at: string;
  payment_signature: string;
  created_at: string;
}

function rowToSubscription(row: SubscriptionRow): SubscriptionRecord {
  return {
    id: row.id,
    walletPubkey: row.wallet_pubkey,
    tier: row.tier,
    expiresAt: row.expires_at,
    paymentSignature: row.payment_signature,
    createdAt: row.created_at,
  };
}

export class SubscriptionsRepo {
  constructor(private readonly db: DbClient) {}

  insert(params: {
    walletPubkey: string;
    expiresAt: string;
    paymentSignature: string;
  }): SubscriptionRecord {
    const record: SubscriptionRecord = {
      id: randomUUID(),
      walletPubkey: params.walletPubkey,
      tier: "pro",
      expiresAt: params.expiresAt,
      paymentSignature: params.paymentSignature,
      createdAt: new Date().toISOString(),
    };

    this.db
      .prepare(
        `INSERT INTO subscriptions (id, wallet_pubkey, tier, expires_at, payment_signature, created_at)
         VALUES (@id, @walletPubkey, @tier, @expiresAt, @paymentSignature, @createdAt)`,
      )
      .run(record);

    return record;
  }

  /** L'abbonamento PRO attivo più recente per un wallet, o undefined se nessuno è valido ora. */
  findActiveByWallet(
    walletPubkey: string,
    now: Date = new Date(),
  ): SubscriptionRecord | undefined {
    const row = this.db
      .prepare(
        `SELECT * FROM subscriptions
         WHERE wallet_pubkey = ? AND tier = 'pro' AND expires_at > ?
         ORDER BY expires_at DESC LIMIT 1`,
      )
      .get(walletPubkey, now.toISOString()) as SubscriptionRow | undefined;

    return row ? rowToSubscription(row) : undefined;
  }
}
