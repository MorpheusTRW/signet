import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import {
  analyzeSnipes,
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

describe("analyzeSnipes", () => {
  const bondingCurve = bondingCurveAddress(MINT);

  it("conta i wallet che ricevono il token nei primi blocchi, escluso il dev (dati reali)", () => {
    expect(analyzeSnipes(firstTxs, { mint: MINT, bondingCurve, creator: CREATOR })).toEqual({
      createSlot: 450357528,
      snipers: 1,
    });
  });

  it("ignora acquisti dopo la finestra e tx fallite", () => {
    const base = firstTxs[0]!;
    const buy = (slot: number, to: string, err: unknown = null): EnhancedTransaction => ({
      ...base,
      type: "SWAP",
      slot,
      transactionError: err,
      tokenTransfers: [{ fromUserAccount: bondingCurve, toUserAccount: to, mint: MINT, tokenAmount: 1 }],
    });
    const txs = [base, buy(base.slot, "A"), buy(base.slot + 3, "B"), buy(base.slot + 4, "C"), buy(base.slot + 1, "D", "x")];
    expect(analyzeSnipes(txs, { mint: MINT, bondingCurve, creator: CREATOR })?.snipers).toBe(2);
  });

  it("null se nelle tx non c'è la creazione", () => {
    expect(analyzeSnipes(firstTxs.slice(1), { mint: MINT, bondingCurve, creator: CREATOR })).toBeNull();
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
    const result = await fetchTokenHistory(deps({ complete: [0, 5] }), { mint: MINT, creator: CREATOR });
    expect(result).toEqual({ snipers: 1, previousLaunches: creates.length, previousLaunchesMigrated: 2 });
  });

  it("se i lanci del dev falliscono, restano solo gli snipe", async () => {
    const result = await fetchTokenHistory(
      deps({ creates: () => Promise.reject(new Error("503")) }),
      { mint: MINT, creator: CREATOR },
    );
    expect(result).toEqual({ snipers: 1 });
  });

  it("budget esaurito: nessuna chiamata e niente dati", async () => {
    const d = deps();
    d.budget = new DailyBudget(1);
    expect(await fetchTokenHistory(d, { mint: MINT, creator: CREATOR })).toEqual({});
    expect(d.enhanced).not.toHaveBeenCalled();
  });
});
