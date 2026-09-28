import { afterEach, describe, expect, it, vi } from "vitest";
import { buildSignal } from "../../src/signals/build-signal.js";
import { makeRawLaunchEvent } from "../fixtures.js";
import { makeFakeConnection, TAKER, TREASURY } from "./build-swap-fixtures.js";
import { createTestApp } from "./helpers.js";
import { RateLimiter } from "../../src/safety/rate-limiter.js";

const ADMIN_KEY = "a".repeat(20);

function swapPayload(signalId: string, amountSol = 0.5) {
  return { signalId, pubkey: TAKER.toBase58(), amountSol, slippageBps: 100 };
}

function deps() {
  return {
    connection: makeFakeConnection(),
    treasuryWalletPubkey: TREASURY.toBase58(),
    jupiterApiBaseUrl: "https://fake-jupiter.test",
  };
}

describe("kill switch, cap e rate limit", () => {
  let ctx: ReturnType<typeof createTestApp> | undefined;
  afterEach(async () => {
    vi.unstubAllGlobals();
    await ctx?.app.close();
    ctx?.db.close();
    ctx = undefined;
  });

  it("GET /status espone lo stato", async () => {
    ctx = createTestApp();
    const res = await ctx.app.inject({ method: "GET", url: "/status" });
    expect(res.json()).toEqual({ killSwitch: false, tradingMode: "paper" });
  });

  it("KILL_SWITCH=true blocca /build-swap prima di qualsiasi chiamata esterna", async () => {
    ctx = createTestApp({ env: { KILL_SWITCH: "true" }, buildSwap: deps() });
    const signal = buildSignal(makeRawLaunchEvent({ program: "pumpswap" }));
    ctx.signalsRepo.insert(signal);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const res = await ctx.app.inject({ method: "POST", url: "/build-swap", payload: swapPayload(signal.id) });
    expect(res.statusCode).toBe(503);
    expect(res.json().error).toBe("kill_switch_active");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("l'admin può attivare il kill switch; senza chiave giusta 401", async () => {
    ctx = createTestApp({ env: { ADMIN_API_KEY: ADMIN_KEY } });
    const bad = await ctx.app.inject({
      method: "POST",
      url: "/admin/kill-switch",
      headers: { authorization: "Bearer wrong" },
      payload: { active: true },
    });
    expect(bad.statusCode).toBe(401);
    expect(ctx.killSwitch.isActive()).toBe(false);

    const ok = await ctx.app.inject({
      method: "POST",
      url: "/admin/kill-switch",
      headers: { authorization: `Bearer ${ADMIN_KEY}` },
      payload: { active: true },
    });
    expect(ok.statusCode).toBe(200);
    expect(ctx.killSwitch.isActive()).toBe(true);
    const status = await ctx.app.inject({ method: "GET", url: "/status" });
    expect(status.json().killSwitch).toBe(true);
  });

  it("senza ADMIN_API_KEY l'endpoint admin non esiste", async () => {
    ctx = createTestApp();
    const res = await ctx.app.inject({ method: "POST", url: "/admin/kill-switch", payload: { active: false } });
    expect(res.statusCode).toBe(404);
  });

  it("rifiuta importi sopra MAX_SWAP_SOL", async () => {
    ctx = createTestApp({ env: { MAX_SWAP_SOL: "1" }, buildSwap: deps(), paperTradingConfig: { balanceSol: 1000 } });
    const signal = buildSignal(makeRawLaunchEvent({ program: "pumpswap" }));
    ctx.signalsRepo.insert(signal);
    const res = await ctx.app.inject({ method: "POST", url: "/build-swap", payload: swapPayload(signal.id, 2) });
    expect(res.statusCode).toBe(409);
    expect(res.json().error).toBe("amount_exceeds_cap");
  });

  it("applica il rate limit per wallet", async () => {
    ctx = createTestApp({ rateLimit: 1, buildSwap: deps() });
    const signal = buildSignal(makeRawLaunchEvent({ program: "pumpswap" }));
    ctx.signalsRepo.insert(signal);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 500 })));
    await ctx.app.inject({ method: "POST", url: "/build-swap", payload: swapPayload(signal.id) });
    const second = await ctx.app.inject({ method: "POST", url: "/build-swap", payload: swapPayload(signal.id) });
    expect(second.statusCode).toBe(429);
  });
});

describe("RateLimiter", () => {
  it("libera la finestra col passare del tempo", () => {
    let now = 0;
    const rl = new RateLimiter(2, 1000, () => now);
    expect(rl.tryAcquire("k")).toBe(true);
    expect(rl.tryAcquire("k")).toBe(true);
    expect(rl.tryAcquire("k")).toBe(false);
    expect(rl.tryAcquire("other")).toBe(true);
    now = 1001;
    expect(rl.tryAcquire("k")).toBe(true);
  });
});
