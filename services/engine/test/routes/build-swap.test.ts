import { afterEach, describe, expect, it, vi } from "vitest";
import { buildSignal } from "../../src/signals/build-signal.js";
import { makeRawLaunchEvent } from "../fixtures.js";
import {
  fakeJupiterBuildResponse,
  makeFakeConnection,
  mockFetchOnce,
  TAKER,
  TREASURY,
  TREASURY_FEE_ACCOUNT,
} from "./build-swap-fixtures.js";
import { createTestApp } from "./helpers.js";

function buildSwapDeps() {
  return {
    connection: makeFakeConnection(),
    treasuryWalletPubkey: TREASURY.toBase58(),
    jupiterApiBaseUrl: "https://fake-jupiter.test",
  };
}

describe("POST /build-swap", () => {
  let ctx: ReturnType<typeof createTestApp> | undefined;

  afterEach(async () => {
    vi.unstubAllGlobals();
    await ctx?.app.close();
    ctx?.db.close();
    ctx = undefined;
  });

  it("builds a transaction for a routable signal, with fee per the wallet's tier", async () => {
    ctx = createTestApp({ buildSwap: buildSwapDeps() });
    const signal = buildSignal(makeRawLaunchEvent({ program: "pumpswap" }));
    ctx.signalsRepo.insert(signal);
    mockFetchOnce(200, fakeJupiterBuildResponse());

    const response = await ctx.app.inject({
      method: "POST",
      url: "/build-swap",
      payload: {
        signalId: signal.id,
        pubkey: TAKER.toBase58(),
        amountSol: 0.5,
        slippageBps: 100,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.amountSol).toBe(0.5);
    expect(body.feeAccount).toBe(TREASURY_FEE_ACCOUNT.toBase58());
    expect(body.feeBps).toBe(75); // default FREE_PLATFORM_FEE_BPS
    expect(body.feeSol).toBeCloseTo(0.5 * (75 / 10_000), 9);
    expect(body.tradingMode).toBe("paper");
    expect(typeof body.transactionBase64).toBe("string");
    expect(body.transactionBase64.length).toBeGreaterThan(0);
    expect(body.quote.outAmount).toBe("123456789");
    expect(typeof body.blockhash).toBe("string");
    expect(body.lastValidBlockHeight).toBe(999);
  });

  it("passes platformFeeBps and feeAccount through to the Jupiter request", async () => {
    ctx = createTestApp({ buildSwap: buildSwapDeps() });
    const signal = buildSignal(makeRawLaunchEvent({ program: "pumpswap" }));
    ctx.signalsRepo.insert(signal);
    mockFetchOnce(200, fakeJupiterBuildResponse());

    await ctx.app.inject({
      method: "POST",
      url: "/build-swap",
      payload: { signalId: signal.id, pubkey: TAKER.toBase58(), amountSol: 0.5, slippageBps: 100 },
    });

    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    const requestedUrl = new URL(fetchMock.mock.calls[0]![0] as string);
    expect(requestedUrl.searchParams.get("platformFeeBps")).toBe("75");
    expect(requestedUrl.searchParams.get("feeAccount")).toBe(TREASURY_FEE_ACCOUNT.toBase58());
    expect(requestedUrl.searchParams.get("taker")).toBe(TAKER.toBase58());
  });

  it("rejects an invalid body", async () => {
    ctx = createTestApp({ buildSwap: buildSwapDeps() });
    const response = await ctx.app.inject({
      method: "POST",
      url: "/build-swap",
      payload: { signalId: "not-a-uuid" },
    });
    expect(response.statusCode).toBe(400);
  });

  it("returns 503 when RPC/treasury are not configured", async () => {
    ctx = createTestApp(); // nessun buildSwap override: connection/treasury undefined
    const response = await ctx.app.inject({
      method: "POST",
      url: "/build-swap",
      payload: {
        signalId: "5f2d5c9e-6c8a-4e9a-8f2c-1a2b3c4d5e6f",
        pubkey: TAKER.toBase58(),
        amountSol: 0.5,
        slippageBps: 100,
      },
    });
    expect(response.statusCode).toBe(503);
  });

  it("returns 404 for an unknown signal", async () => {
    ctx = createTestApp({ buildSwap: buildSwapDeps() });
    const response = await ctx.app.inject({
      method: "POST",
      url: "/build-swap",
      payload: {
        signalId: "5f2d5c9e-6c8a-4e9a-8f2c-1a2b3c4d5e6f",
        pubkey: TAKER.toBase58(),
        amountSol: 0.5,
        slippageBps: 100,
      },
    });
    expect(response.statusCode).toBe(404);
  });

  it("rejects a signal still in bonding curve (not routable by Jupiter)", async () => {
    ctx = createTestApp({ buildSwap: buildSwapDeps() });
    const signal = buildSignal(makeRawLaunchEvent({ program: "pump-fun" }));
    ctx.signalsRepo.insert(signal);

    const response = await ctx.app.inject({
      method: "POST",
      url: "/build-swap",
      payload: { signalId: signal.id, pubkey: TAKER.toBase58(), amountSol: 0.5, slippageBps: 100 },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json().error).toBe("not_routable");
  });

  it("rejects an amount that would exceed the 20% exposure limit", async () => {
    ctx = createTestApp({
      buildSwap: buildSwapDeps(),
      paperTradingConfig: { balanceSol: 10, maxExposureFraction: 0.2 }, // max 2 SOL
    });
    const signal = buildSignal(makeRawLaunchEvent({ program: "pumpswap" }));
    ctx.signalsRepo.insert(signal);

    const response = await ctx.app.inject({
      method: "POST",
      url: "/build-swap",
      payload: { signalId: signal.id, pubkey: TAKER.toBase58(), amountSol: 3, slippageBps: 100 },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json().error).toBe("exposure_limit_exceeded");
  });

  it("propagates a Jupiter API failure as 502", async () => {
    ctx = createTestApp({ buildSwap: buildSwapDeps() });
    const signal = buildSignal(makeRawLaunchEvent({ program: "pumpswap" }));
    ctx.signalsRepo.insert(signal);
    mockFetchOnce(500, { error: "internal" });

    const response = await ctx.app.inject({
      method: "POST",
      url: "/build-swap",
      payload: { signalId: signal.id, pubkey: TAKER.toBase58(), amountSol: 0.5, slippageBps: 100 },
    });

    expect(response.statusCode).toBe(502);
    expect(response.json().error).toBe("jupiter_error");
  });
});
