import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import {
  analyzeLaunch,
  bondingCurveAddress,
  DailyBudget,
  type EnhancedTransaction,
  fetchTokenHistory,
  launchedMints,
} from "../../src/ingest/helius/history.js";

// Risposte reali della Enhanced Transactions API (mainnet, 2026-09-26), ridotte ai campi usati.
const load = (name: string) =>
  JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8")) as EnhancedTransaction[];
const firstTxs = load("helius-first-txs.json");
const creates = load("helius-creator-creates.json");

const MINT = "65gyEJ4kWQm2HHHFkqKuX2d5D3eL7gEMku7vv7eYpump";
const CREATOR = "232oN4sAg4j7zsAyGvozF9r5vaLWtxrjPwfBpB9eDRXo";

describe("bondingCurveAddress", () => {
  it("coincide con la bonding curve reale da cui escono i token", () => {
    expect(bondingCurveAddress(MINT)).toBe("4GLK8gPquopDc88FfGpkpTsqPn2J9noMY44vFSdBSZEv");
  });
});

describe("analyzeLaunch", () => {
  const bondingCurve = bondingCurveAddress(MINT);
  const params = { mint: MINT, bondingCurve, creator: CREATOR, supply: 1_000_000_000 };

  it("metriche del lancio su dati reali", () => {
    const launch = analyzeLaunch(firstTxs, params)!;
    expect(launch.createSlot).toBe(450357528);
    expect(launch.snipers).toBe(1);
    // Il dev compra nella tx di creazione; nessun altro nello stesso slot.
    expect(launch.bundleWallets).toBe(0);
    expect(launch.devBuyPct).toBeGreaterThan(0);
    // Lo sniper riceve i token ma la fee la paga un altro wallet.
    expect(launch.linkedWallets).toBe(1);
  });

  it("bundle = acquisti di altri wallet nello stesso slot della creazione", () => {
    const base = firstTxs[0]!;
    const buy = (slot: number, to: string, amount: number, payer = to, err: unknown = null): EnhancedTransaction => ({
      ...base,
      type: "SWAP",
      slot,
      feePayer: payer,
      transactionError: err,
      tokenTransfers: [{ fromUserAccount: bondingCurve, toUserAccount: to, mint: MINT, tokenAmount: amount }],
    });
    const txs = [
      { ...base, tokenTransfers: [{ fromUserAccount: bondingCurve, toUserAccount: CREATOR, mint: MINT, tokenAmount: 30_000_000 }] },
      buy(base.slot, "A", 50_000_000),
      buy(base.slot, "B", 40_000_000, "A"),
      buy(base.slot + 3, "C", 10_000_000),
      buy(base.slot + 4, "D", 90_000_000),
      buy(base.slot + 1, "E", 90_000_000, "E", "x"),
    ];
    const launch = analyzeLaunch(txs, params)!;
    expect(launch.devBuyPct).toBe(3);
    expect(launch.bundleWallets).toBe(2);
    expect(launch.bundlePct).toBe(9);
    expect(launch.snipers).toBe(3);
    expect(launch.snipersPct).toBe(10);
    expect(launch.linkedWallets).toBe(1);
    expect(launch.earlyBuyers.sort()).toEqual(["A", "B", "C"]);
  });

  it("null se nelle tx non c'è la creazione", () => {
    expect(analyzeLaunch(firstTxs.slice(1), params)).toBeNull();
  });
});

describe("launchedMints", () => {
  it("estrae un mint per ogni CREATE pump.fun del dev (dati reali)", () => {
    const mints = launchedMints(creates, CREATOR);
    expect(mints).toHaveLength(creates.length);
    expect(new Set(mints).size).toBe(mints.length);
  });
});

describe("DailyBudget", () => {
  it("blocca oltre il limite e si azzera il giorno dopo", () => {
    let now = Date.parse("2026-09-26T10:00:00Z");
    const budget = new DailyBudget(4, () => now);
    expect(budget.tryConsume(2)).toBe(true);
    expect(budget.tryConsume(2)).toBe(true);
    expect(budget.tryConsume(2)).toBe(false);
    now = Date.parse("2026-09-27T00:00:01Z");
    expect(budget.tryConsume(2)).toBe(true);
  });
});

describe("fetchTokenHistory", () => {
  function deps(overrides: { creates?: () => Promise<EnhancedTransaction[]>; complete?: number[] } = {}) {
    const enhanced = vi.fn(async (address: string, query: Record<string, string>) => {
      if (query.type === "CREATE") {
        expect(query["lt-slot"]).toBe("450357528");
        return overrides.creates ? overrides.creates() : creates;
      }
      expect(address).toBe(bondingCurveAddress(MINT));
      return firstTxs;
    });
    const rpc = vi.fn(async (_method: string, params: unknown[]) => {
      const keys = params[0] as string[];
      const complete = overrides.complete ?? [];
      return {
        value: keys.map((_, i) => ({
          data: [Buffer.from([complete.includes(i) ? 1 : 0]).toString("base64"), "base64"],
        })),
      };
    });
    return { enhanced, rpc: rpc as never, budget: new DailyBudget(100) };
  }

  it("combina snipe, lanci precedenti e migrati", async () => {
    const result = await fetchTokenHistory(deps({ complete: [0, 5] }), { mint: MINT, creator: CREATOR, supply: 1e9 });
    expect(result.launch?.snipers).toBe(1);
    expect(result.previousLaunches).toBe(creates.length);
    expect(result.previousLaunchesMigrated).toBe(2);
  });

  it("se i lanci del dev falliscono, restano solo gli snipe", async () => {
    const result = await fetchTokenHistory(
      deps({ creates: () => Promise.reject(new Error("503")) }),
      { mint: MINT, creator: CREATOR, supply: 1e9 },
    );
    expect(result.launch?.snipers).toBe(1);
    expect(result.previousLaunches).toBeUndefined();
  });

  it("budget esaurito: nessuna chiamata e niente dati", async () => {
    const d = deps();
    d.budget = new DailyBudget(1);
    expect(await fetchTokenHistory(d, { mint: MINT, creator: CREATOR, supply: 1e9 })).toEqual({});
    expect(d.enhanced).not.toHaveBeenCalled();
  });
});
