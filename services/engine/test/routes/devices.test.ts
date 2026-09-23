import { createHash } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { createTestApp } from "./helpers.js";

const VALID_PUBKEY = "9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin";

describe("POST /devices", () => {
  let ctx: ReturnType<typeof createTestApp> | undefined;

  afterEach(async () => {
    await ctx?.app.close();
    ctx?.db.close();
    ctx = undefined;
  });

  it("registers a device and returns a plaintext api key", async () => {
    ctx = createTestApp();
    const response = await ctx.app.inject({
      method: "POST",
      url: "/devices",
      payload: { fcmToken: "fcm-token-1", walletPubkey: VALID_PUBKEY },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json() as {
      deviceId: string;
      walletPubkey: string;
      apiKey: string;
    };
    expect(body.walletPubkey).toBe(VALID_PUBKEY);
    expect(body.apiKey).toMatch(/^[0-9a-f]{64}$/);
  });

  it("stores only a hash of the api key, never the plaintext", async () => {
    ctx = createTestApp();
    const response = await ctx.app.inject({
      method: "POST",
      url: "/devices",
      payload: { fcmToken: "fcm-token-1", walletPubkey: VALID_PUBKEY },
    });
    const { apiKey } = response.json() as { apiKey: string };
    const expectedHash = createHash("sha256").update(apiKey).digest("hex");

    const row = ctx.db
      .prepare("SELECT api_key_hash FROM devices WHERE wallet_pubkey = ?")
      .get(VALID_PUBKEY) as { api_key_hash: string };

    expect(row.api_key_hash).toBe(expectedHash);
    expect(row.api_key_hash).not.toBe(apiKey);
  });

  it("re-registering the same wallet updates the fcm token and rotates the key", async () => {
    ctx = createTestApp();
    const first = await ctx.app.inject({
      method: "POST",
      url: "/devices",
      payload: { fcmToken: "fcm-token-1", walletPubkey: VALID_PUBKEY },
    });
    const second = await ctx.app.inject({
      method: "POST",
      url: "/devices",
      payload: { fcmToken: "fcm-token-2", walletPubkey: VALID_PUBKEY },
    });

    const firstBody = first.json() as { deviceId: string; apiKey: string };
    const secondBody = second.json() as { deviceId: string; apiKey: string };

    expect(secondBody.deviceId).toBe(firstBody.deviceId);
    expect(secondBody.apiKey).not.toBe(firstBody.apiKey);

    const row = ctx.db
      .prepare("SELECT fcm_token FROM devices WHERE wallet_pubkey = ?")
      .get(VALID_PUBKEY) as { fcm_token: string };
    expect(row.fcm_token).toBe("fcm-token-2");
  });

  it("rejects an invalid wallet pubkey", async () => {
    ctx = createTestApp();
    const response = await ctx.app.inject({
      method: "POST",
      url: "/devices",
      payload: { fcmToken: "fcm-token-1", walletPubkey: "not-a-pubkey" },
    });
    expect(response.statusCode).toBe(400);
  });
});
