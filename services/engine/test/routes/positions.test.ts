import { afterEach, describe, expect, it, vi } from "vitest";
import { processLaunchEvent } from "../../src/signals/pipeline.js";
import { makeRawLaunchEvent } from "../fixtures.js";
import { createTestApp } from "./helpers.js";

const WALLET = "9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin";
const OTHER = "5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1";
const acc = (ui: string) => ({ data: { parsed: { info: { tokenAmount: { uiAmountString: ui } } } } });

/** RPC finto: la pool ha `base` token e `quote` SOL (modificabili fra una chiamata e l'altra). */
function fakePool(pool: { base: number; quote: number }) {
  return vi.fn(async () => ({ value: [acc(String(pool.base)), acc(String(pool.quote))] }));
}

describe("posizioni paper per wallet", () => {
  let ctx: ReturnType<typeof createTestApp> | undefined;
  afterEach(async () => {
    await ctx?.app.close();
    ctx?.db.close();
    ctx = undefined;
  });

  function seed(rpc: ReturnType<typeof fakePool>) {
    ctx = createTestApp({ priceRpc: rpc as never, paperTradingConfig: { balanceSol: 10, maxExposureFraction: 0.2 } });
    return processLaunchEvent(
      makeRawLaunchEvent({ id: "p1", tokenSymbol: "ABC", market: { baseVault: "B", quoteVault: "Q", priceSol: 0.0001 } }),
      ctx,
    );
  }

  it("senza posizioni aperte dall'utente la lista è vuota (il server non apre nulla da solo)", async () => {
    seed(fakePool({ base: 1_000_000, quote: 100 }));
    const res = await ctx!.app.inject({ method: "GET", url: `/positions?pubkey=${WALLET}` });
    expect(res.statusCode).toBe(200);
    expect(res.json().positions).toEqual([]);
    expect(res.json().portfolio).toMatchObject({ balanceSol: 10, openExposureSol: 0, remainingSol: 2 });
  });

  it("apre al prezzo reale (fee inclusa), segue il valore e chiude con PnL reale", async () => {
    const pool = { base: 1_000_000, quote: 100 };
    const signal = seed(fakePool(pool));

    const open = await ctx!.app.inject({
      method: "POST",
      url: "/positions/paper",
      payload: { signalId: signal.id, pubkey: WALLET, amountSol: 1 },
    });
    expect(open.statusCode).toBe(201);
    const id = open.json().id as string;
    // 1 SOL meno fee FREE 0,75% su pool 1M token / 100 SOL
    expect(open.json().tokenAmount).toBeCloseTo((1_000_000 * 0.9925) / (100 + 0.9925), 3);

    // Il prezzo raddoppia: la posizione vale di più.
    pool.base = 500_000;
    const list = await ctx!.app.inject({ method: "GET", url: `/positions?pubkey=${WALLET}` });
    const [pos] = list.json().positions;
    expect(pos.status).toBe("open");
    expect(pos.tokenSymbol).toBe("ABC");
    expect(pos.pnlSol).toBeGreaterThan(0.9);
    expect(list.json().portfolio.openExposureSol).toBe(1);

    // Solo il proprietario può chiudere.
    const wrong = await ctx!.app.inject({ method: "POST", url: `/positions/${id}/close`, payload: { pubkey: OTHER } });
    expect(wrong.statusCode).toBe(404);
    const close = await ctx!.app.inject({ method: "POST", url: `/positions/${id}/close`, payload: { pubkey: WALLET } });
    expect(close.statusCode).toBe(200);
    expect(close.json().status).toBe("closed");

    const after = await ctx!.app.inject({ method: "GET", url: `/positions?pubkey=${WALLET}` });
    expect(after.json().portfolio.realizedPnlSol).toBeGreaterThan(0.9);
    expect(after.json().portfolio.openExposureSol).toBe(0);
  });

  it("rispetta il limite del 20% del portafoglio del wallet", async () => {
    const signal = seed(fakePool({ base: 1_000_000, quote: 100 }));
    const res = await ctx!.app.inject({
      method: "POST",
      url: "/positions/paper",
      payload: { signalId: signal.id, pubkey: WALLET, amountSol: 3 },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().error).toBe("exposure_limit_exceeded");
  });

  it("niente posizioni paper su segnali senza dati di mercato né in live mode", async () => {
    const signal = seed(fakePool({ base: 1_000_000, quote: 100 }));
    const synthetic = processLaunchEvent(makeRawLaunchEvent({ id: "nomkt" }), ctx!);
    const noMarket = await ctx!.app.inject({
      method: "POST",
      url: "/positions/paper",
      payload: { signalId: synthetic.id, pubkey: WALLET, amountSol: 1 },
    });
    expect(noMarket.json().error).toBe("no_market");
    await ctx!.app.close();
    ctx!.db.close();

    ctx = createTestApp({ priceRpc: fakePool({ base: 1, quote: 1 }) as never, buildSwap: { tradingMode: "live" } });
    const live = await ctx.app.inject({
      method: "POST",
      url: "/positions/paper",
      payload: { signalId: signal.id, pubkey: WALLET, amountSol: 1 },
    });
    expect(live.json().error).toBe("not_paper_mode");
  });

  it("400 senza pubkey", async () => {
    seed(fakePool({ base: 1, quote: 1 }));
    const res = await ctx!.app.inject({ method: "GET", url: "/positions" });
    expect(res.statusCode).toBe(400);
  });
});
