import { afterEach, describe, expect, it, vi } from "vitest";
import { processLaunchEvent } from "../../src/signals/pipeline.js";
import { makeRawLaunchEvent } from "../fixtures.js";
import { createTestApp } from "./helpers.js";

const WALLET = "9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin";
const acc = (ui: string) => ({ data: { parsed: { info: { tokenAmount: { uiAmountString: ui } } } } });
const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();
const HOLDER = { async isHolder() { return true; } };

interface CallsBody {
  tier: string;
  windowHours: number | null;
  counts: { total: number; passed: number; rejected: number };
  calls: { signal: { tokenSymbol: string }; outcome: { change1hPct: number | null; nowPct: number | null } }[];
  nextBefore: string | null;
}

describe("GET /calls (storico delle chiamate per tier)", () => {
  let ctx: ReturnType<typeof createTestApp> | undefined;
  afterEach(async () => {
    await ctx?.app.close();
    ctx?.db.close();
    ctx = undefined;
  });

  function seed(holder: boolean) {
    // Prezzo attuale: 100 SOL / 2.000.000 token = 0.00005 → -50% sul prezzo al segnale.
    const rpc = vi.fn(async (_method: string, params: unknown[]) => ({
      value: (params[0] as string[]).map((_, i) => (i % 2 === 0 ? acc("2000000") : acc("100"))),
    }));
    ctx = createTestApp({ priceRpc: rpc as never, holderChecker: holder ? HOLDER : undefined });
    const market = (id: string) => ({ baseVault: `B${id}`, quoteVault: `Q${id}`, priceSol: 0.0001 });
    for (const [id, symbol, hours, rejected] of [
      ["a", "NEW", 1, false],
      ["b", "BAD", 2, true],
      ["c", "OLD", 30, false],
      ["d", "OLDER", 72, false],
    ] as const) {
      processLaunchEvent(
        makeRawLaunchEvent({
          id,
          tokenSymbol: symbol,
          createdAt: hoursAgo(hours),
          market: market(id),
          ...(rejected ? { pumpMigration: true, initialLiquiditySol: 5 } : {}),
        }),
        ctx,
      );
    }
    return rpc;
  }

  const get = async (query: string) => {
    const res = await ctx!.app.inject({ method: "GET", url: `/calls?pubkey=${WALLET}${query}` });
    expect(res.statusCode).toBe(200);
    return res.json() as CallsBody;
  };

  it("FREE vede solo le ultime 24h, con conteggi ed esito attuale letto dalla pool", async () => {
    seed(false);
    const body = await get("");
    expect(body.tier).toBe("free");
    expect(body.windowHours).toBe(24);
    expect(body.calls.map((c) => c.signal.tokenSymbol)).toEqual(["NEW", "BAD"]);
    expect(body.counts).toEqual({ total: 2, passed: 1, rejected: 1 });
    expect(body.calls[0]!.outcome.nowPct).toBe(-50);
  });

  it("HOLDER/PRO vede tutto lo storico, paginato col cursore", async () => {
    seed(true);
    const first = await get("&limit=3");
    expect(first.windowHours).toBeNull();
    expect(first.counts.total).toBe(4);
    expect(first.calls.map((c) => c.signal.tokenSymbol)).toEqual(["NEW", "BAD", "OLD"]);
    const second = await get(`&limit=3&before=${encodeURIComponent(first.nextBefore!)}`);
    expect(second.calls.map((c) => c.signal.tokenSymbol)).toEqual(["OLDER"]);
    expect(second.nextBefore).toBeNull();
  });

  it("filtra fra chiamate passate e scartate", async () => {
    seed(true);
    expect((await get("&filter=rejected")).calls.map((c) => c.signal.tokenSymbol)).toEqual(["BAD"]);
    expect((await get("&filter=passed")).calls).toHaveLength(3);
  });

  it("se l'RPC fallisce l'esito attuale è null, non inventato", async () => {
    seed(false).mockRejectedValue(new Error("503"));
    const body = await get("");
    expect(body.calls[0]!.outcome.nowPct).toBeNull();
  });
});
