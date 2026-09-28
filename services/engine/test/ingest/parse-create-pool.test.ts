import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseCreatePool, type RawTransaction } from "../../src/ingest/helius/parse-create-pool.js";

// Transazione reale di mainnet (migrazione pump.fun → PumpSwap, istruzione Migrate con CPI a CreatePool).
const fixture = JSON.parse(
  readFileSync(new URL("./fixtures/pump-migrate-tx.json", import.meta.url), "utf8"),
) as RawTransaction;

describe("parseCreatePool", () => {
  it("estrae pool, mint e liquidità da una migrazione reale (CPI inner)", () => {
    const parsed = parseCreatePool(fixture);
    expect(parsed).not.toBeNull();
    expect(parsed!.pool).toMatch(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/);
    expect(parsed!.tokenMint).toMatch(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/);
    expect(parsed!.coinCreator).toMatch(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/);
    // Valori verificati a mano sulla tx reale (saldi post-tx dei vault della pool).
    expect(parsed!.pool).toBe("DQcEekyuLxWCVUTmgpZQpyuJduFvi9K7sJWCcjobU7fx");
    expect(parsed!.tokenMint).toBe("65gyEJ4kWQm2HHHFkqKuX2d5D3eL7gEMku7vv7eYpump");
    expect(parsed!.poolBaseVault.startsWith("3ryWxbRnMC")).toBe(true);
    // Vault wSOL: nei saldi post-tx detiene esattamente la liquidità iniziale (0.637116159 SOL).
    expect(parsed!.poolQuoteVault.startsWith("626NFrT2hF")).toBe(true);
    expect(parsed!.initialLiquiditySol).toBeCloseTo(0.637116159, 9);
    // Saldo post-tx del vault token della pool: 206.900.000 token (6 decimali).
    expect(parsed!.initialTokenAmountRaw).toBe(206_900_000_000_000n);
    expect(parsed!.blockTime).toBe(1790340912);
  });

  it("ignora transazioni fallite", () => {
    const failed = { ...fixture, meta: { ...fixture.meta!, err: { InstructionError: [0, "x"] } } };
    expect(parseCreatePool(failed)).toBeNull();
  });

  it("ritorna null se non c'è create_pool", () => {
    const stripped: RawTransaction = {
      ...fixture,
      meta: { ...fixture.meta!, innerInstructions: [] },
    };
    expect(parseCreatePool(stripped)).toBeNull();
  });
});
