import { describe, expect, it, vi } from "vitest";
import { readPoolReserves, simulateBuy, simulateSell, spotPriceSol } from "../../src/market/pool.js";

const acc = (ui: string) => ({ data: { parsed: { info: { tokenAmount: { uiAmountString: ui } } } } });

describe("pool", () => {
  it("legge le riserve a coppie base/quote e segnala le pool chiuse o vuote", async () => {
    const rpc = vi.fn(async () => ({ value: [acc("206900000"), acc("85"), acc("0"), acc("10"), null, acc("1")] }));
    const reserves = await readPoolReserves(rpc as never, [
      { baseVault: "B1", quoteVault: "Q1" },
      { baseVault: "B2", quoteVault: "Q2" },
      { baseVault: "B3", quoteVault: "Q3" },
    ]);
    expect(reserves[0]).toEqual({ base: 206900000, quote: 85 });
    expect(reserves[1]).toBeNull(); // vault token vuoto
    expect(reserves[2]).toBeNull(); // account chiuso
    expect((rpc.mock.calls[0] as unknown[])[1]).toEqual([["B1", "Q1", "B2", "Q2", "B3", "Q3"], expect.anything()]);
  });

  it("prezzo spot e fill a prodotto costante (con impatto sul prezzo)", () => {
    const pool = { base: 1_000_000, quote: 100 };
    expect(spotPriceSol(pool)).toBe(0.0001);
    const tokens = simulateBuy(pool, 10);
    expect(tokens).toBeCloseTo(90_909.09, 1); // meno dei 100k al prezzo spot: impatto
    // Rivendere subito sulle riserve aggiornate restituisce esattamente i SOL spesi.
    expect(simulateSell({ base: pool.base - tokens, quote: pool.quote + 10 }, tokens)).toBeCloseTo(10, 6);
  });
});
