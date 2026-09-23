import { afterEach, describe, expect, it } from "vitest";
import { buildSignal } from "../../src/signals/build-signal.js";
import { makeRawLaunchEvent } from "../fixtures.js";
import { createTestApp } from "./helpers.js";

const WALLET = "9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin";

function insertSignalMinutesAgo(
  ctx: ReturnType<typeof createTestApp>,
  id: string,
  minutesAgo: number,
) {
  const createdAt = new Date(Date.now() - minutesAgo * 60_000).toISOString();
  const signal = buildSignal(makeRawLaunchEvent({ id, createdAt }));
  ctx.signalsRepo.insert(signal);
  return signal;
}

describe("GET /signals?pubkey=... (tier-aware)", () => {
  let ctx: ReturnType<typeof createTestApp> | undefined;

  afterEach(async () => {
    await ctx?.app.close();
    ctx?.db.close();
    ctx = undefined;
  });

  it("without pubkey: returns the raw feed, unfiltered (backward compatible with F1)", async () => {
    ctx = createTestApp();
    insertSignalMinutesAgo(ctx, "s1", 0.01); // appena creato

    const response = await ctx.app.inject({ method: "GET", url: "/signals" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toHaveLength(1);
  });

  it("FREE wallet: a signal created seconds ago is hidden until the delay elapses", async () => {
    ctx = createTestApp();
    insertSignalMinutesAgo(ctx, "s1", 0.01); // 0.6s fa, delay default 45s

    const response = await ctx.app.inject({
      method: "GET",
      url: `/signals?pubkey=${WALLET}`,
    });
    expect(response.json()).toHaveLength(0);
  });

  it("FREE wallet: sees a signal once the delay has elapsed", async () => {
    ctx = createTestApp();
    const signal = insertSignalMinutesAgo(ctx, "s1", 5); // 5 min fa, ben oltre il delay di 45s

    const response = await ctx.app.inject({
      method: "GET",
      url: `/signals?pubkey=${WALLET}`,
    });
    const body = response.json() as { id: string }[];
    expect(body.map((s) => s.id)).toEqual([signal.id]);
  });

  it("HOLDER wallet: sees signals in real time, no delay", async () => {
    ctx = createTestApp({ holderChecker: { async isHolder() { return true; } } });
    insertSignalMinutesAgo(ctx, "s1", 0.01);

    const response = await ctx.app.inject({
      method: "GET",
      url: `/signals?pubkey=${WALLET}`,
    });
    expect(response.json()).toHaveLength(1);
  });

  it("FREE wallet: daily limit caps how many new signals become visible", async () => {
    ctx = createTestApp();
    for (let i = 0; i < 25; i++) {
      insertSignalMinutesAgo(ctx, `s${i}`, 5 + i);
    }

    const response = await ctx.app.inject({
      method: "GET",
      url: `/signals?pubkey=${WALLET}&limit=100`,
    });
    const body = response.json() as unknown[];
    // default FREE_MAX_SIGNALS_PER_DAY = 20
    expect(body.length).toBeLessThanOrEqual(20);
  });

  it("FREE wallet: a second request shows the same signals already delivered today", async () => {
    ctx = createTestApp();
    for (let i = 0; i < 5; i++) {
      insertSignalMinutesAgo(ctx, `s${i}`, 5 + i);
    }

    const first = await ctx.app.inject({
      method: "GET",
      url: `/signals?pubkey=${WALLET}`,
    });
    const second = await ctx.app.inject({
      method: "GET",
      url: `/signals?pubkey=${WALLET}`,
    });
    expect(second.json()).toEqual(first.json());
  });
});
