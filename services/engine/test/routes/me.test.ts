import { afterEach, describe, expect, it } from "vitest";
import { createTestApp } from "./helpers.js";

const WALLET = "9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin";

describe("GET /me/tier", () => {
  let ctx: ReturnType<typeof createTestApp> | undefined;

  afterEach(async () => {
    await ctx?.app.close();
    ctx?.db.close();
    ctx = undefined;
  });

  it("defaults to free for a wallet with no subscription", async () => {
    ctx = createTestApp();
    const response = await ctx.app.inject({
      method: "GET",
      url: `/me/tier?pubkey=${WALLET}`,
    });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.tier).toBe("free");
    expect(body.expiresAt).toBeNull();
    expect(body.limits.maxSignalsPerDay).toBeGreaterThan(0);
  });

  it("returns pro with expiresAt for an active subscription", async () => {
    ctx = createTestApp();
    ctx.subscriptionsRepo.insert({
      walletPubkey: WALLET,
      expiresAt: "2099-01-01T00:00:00.000Z",
      paymentSignature: "sig-1",
    });

    const response = await ctx.app.inject({
      method: "GET",
      url: `/me/tier?pubkey=${WALLET}`,
    });
    const body = response.json();
    expect(body.tier).toBe("pro");
    expect(body.expiresAt).toBe("2099-01-01T00:00:00.000Z");
  });

  it("returns holder when the holder checker says so, even without a subscription", async () => {
    ctx = createTestApp({ holderChecker: { async isHolder() { return true; } } });
    const response = await ctx.app.inject({
      method: "GET",
      url: `/me/tier?pubkey=${WALLET}`,
    });
    expect(response.json().tier).toBe("holder");
  });

  it("rejects a missing pubkey", async () => {
    ctx = createTestApp();
    const response = await ctx.app.inject({ method: "GET", url: "/me/tier" });
    expect(response.statusCode).toBe(400);
  });

  it("rejects an invalid pubkey", async () => {
    ctx = createTestApp();
    const response = await ctx.app.inject({
      method: "GET",
      url: "/me/tier?pubkey=not-a-pubkey",
    });
    expect(response.statusCode).toBe(400);
  });
});
