import { describe, expect, it } from "vitest";
import {
  riskReportSchema,
  signalSchema,
  swapRequestSchema,
} from "../src/index.js";

const validPubkey = "9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin";

describe("riskReportSchema", () => {
  it("accepts a valid risk report", () => {
    const result = riskReportSchema.safeParse({
      score: 12,
      level: "low",
      reasons: ["Mint authority revocata", "Nessun snipe rilevato"],
    });
    expect(result.success).toBe(true);
  });

  it("rejects an empty reasons list", () => {
    const result = riskReportSchema.safeParse({
      score: 12,
      level: "low",
      reasons: [],
    });
    expect(result.success).toBe(false);
  });
});

describe("signalSchema", () => {
  it("accepts a well-formed signal", () => {
    const result = signalSchema.safeParse({
      id: "5f2d5c9e-6c8a-4e9a-8f2c-1a2b3c4d5e6f",
      createdAt: new Date().toISOString(),
      program: "pump-fun",
      tokenMint: validPubkey,
      poolAddress: validPubkey,
      initialLiquiditySol: 5.2,
      riskReport: {
        score: 20,
        level: "low",
        reasons: ["Dev wallet pulito"],
      },
      summary: "Nuova pool pump.fun. Dev pulito. Rischio: Basso.",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid pubkey", () => {
    const result = signalSchema.safeParse({
      id: "5f2d5c9e-6c8a-4e9a-8f2c-1a2b3c4d5e6f",
      createdAt: new Date().toISOString(),
      program: "pump-fun",
      tokenMint: "not-a-pubkey",
      poolAddress: validPubkey,
      initialLiquiditySol: 5.2,
      riskReport: { score: 20, level: "low", reasons: ["ok"] },
      summary: "test",
    });
    expect(result.success).toBe(false);
  });
});

describe("swapRequestSchema", () => {
  it("accepts a valid swap request", () => {
    const result = swapRequestSchema.safeParse({
      signalId: "5f2d5c9e-6c8a-4e9a-8f2c-1a2b3c4d5e6f",
      pubkey: validPubkey,
      amountSol: 0.5,
      slippageBps: 100,
    });
    expect(result.success).toBe(true);
  });

  it("rejects a negative amount", () => {
    const result = swapRequestSchema.safeParse({
      signalId: "5f2d5c9e-6c8a-4e9a-8f2c-1a2b3c4d5e6f",
      pubkey: validPubkey,
      amountSol: -1,
      slippageBps: 100,
    });
    expect(result.success).toBe(false);
  });

  it("rejects slippageBps above 10000", () => {
    const result = swapRequestSchema.safeParse({
      signalId: "5f2d5c9e-6c8a-4e9a-8f2c-1a2b3c4d5e6f",
      pubkey: validPubkey,
      amountSol: 0.5,
      slippageBps: 10_001,
    });
    expect(result.success).toBe(false);
  });
});
