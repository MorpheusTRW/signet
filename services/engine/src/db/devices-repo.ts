import { randomUUID } from "node:crypto";
import type { DbClient } from "./client.js";

export interface DeviceRecord {
  id: string;
  walletPubkey: string;
  fcmToken: string;
  createdAt: string;
  updatedAt: string;
}

export class DevicesRepo {
  constructor(private readonly db: DbClient) {}

  /**
   * Registra o aggiorna un device per una pubkey wallet. Ogni chiamata rigenera
   * l'API key (ne viene salvato solo l'hash): il chiamante deve conservare il
   * valore in chiaro restituito da `register`, che non può più essere letto.
   */
  upsert(params: {
    walletPubkey: string;
    fcmToken: string;
    apiKeyHash: string;
  }): DeviceRecord {
    const now = new Date().toISOString();
    const existing = this.db
      .prepare("SELECT id, created_at FROM devices WHERE wallet_pubkey = ?")
      .get(params.walletPubkey) as
      | { id: string; created_at: string }
      | undefined;

    const id = existing?.id ?? randomUUID();
    const createdAt = existing?.created_at ?? now;

    this.db
      .prepare(
        `INSERT INTO devices (id, wallet_pubkey, fcm_token, api_key_hash, created_at, updated_at)
         VALUES (@id, @walletPubkey, @fcmToken, @apiKeyHash, @createdAt, @updatedAt)
         ON CONFLICT(wallet_pubkey) DO UPDATE SET
           fcm_token = excluded.fcm_token,
           api_key_hash = excluded.api_key_hash,
           updated_at = excluded.updated_at`,
      )
      .run({
        id,
        walletPubkey: params.walletPubkey,
        fcmToken: params.fcmToken,
        apiKeyHash: params.apiKeyHash,
        createdAt,
        updatedAt: now,
      });

    return {
      id,
      walletPubkey: params.walletPubkey,
      fcmToken: params.fcmToken,
      createdAt,
      updatedAt: now,
    };
  }
}
