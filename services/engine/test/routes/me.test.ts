import { afterEach, describe, expect, it } from "vitest";
import { processLaunchEvent } from "../../src/signals/pipeline.js";
import { makeRawLaunchEvent } from "../fixtures.js";
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

  it("signalsToday conta solo i segnali passati consegnati oggi (non gli scartati)", async () => {
    ctx = createTestApp();
    const now = new Date().toISOString();
    const passed = processLaunchEvent(makeRawLaunchEvent({ id: "p", createdAt: now }), ctx);
    const rejected = processLaunchEvent(
      makeRawLaunchEvent({ id: "r", createdAt: now, pumpMigration: true, initialLiquiditySol: 5 }),
      ctx,
    );
    expect(rejected.riskReport.level).toBe("high");
    ctx.signalDeliveriesRepo.record(WALLET, [passed.id, rejected.id], new Date());
    const response = await ctx.app.inject({ method: "GET", url: `/me/tier?pubkey=${WALLET}` });
    expect(response.json().signalsToday).toBe(1);
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
