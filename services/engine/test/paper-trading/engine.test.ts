import type { Signal } from "@seeker-signal/shared";
import { describe, expect, it } from "vitest";
import {
  computeEntrySize,
  isSignalApprovable,
  simulatePaperTrade,
} from "../../src/paper-trading/engine.js";
import type { PaperTradingConfig } from "../../src/paper-trading/types.js";

function makeSignal(overrides: Partial<Signal> = {}): Signal {
  return {
    id: "signal-1",
    createdAt: "2026-09-23T10:00:00.000Z",
    program: "pump-fun",
    tokenMint: "9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin",
    poolAddress: "5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1",
    initialLiquiditySol: 10,
    riskReport: { score: 10, level: "low", reasons: ["ok"] },
    summary: "test",
    ...overrides,
  };
}

describe("isSignalApprovable", () => {
  it("approves low and medium risk", () => {
    expect(isSignalApprovable({ score: 5, level: "low", reasons: ["x"] })).toBe(true);
    expect(isSignalApprovable({ score: 50, level: "medium", reasons: ["x"] })).toBe(true);
  });

  it("rejects high risk", () => {
    expect(isSignalApprovable({ score: 90, level: "high", reasons: ["x"] })).toBe(false);
  });
});

describe("computeEntrySize", () => {
  const config: PaperTradingConfig = {
    portfolioValueSol: 100,
    maxExposureFraction: 0.2,
    defaultPositionSizeSol: 5,
  };

  it("allows the default size when there is room", () => {
    expect(computeEntrySize(0, config)).toBe(5);
  });

  it("caps the size to the remaining exposure budget", () => {
    // max exposure = 20 SOL, already 17 open -> only 3 left
    expect(computeEntrySize(17, config)).toBe(3);
  });

  it("returns 0 once the 20% exposure limit is reached", () => {
    expect(computeEntrySize(20, config)).toBe(0);
    expect(computeEntrySize(25, config)).toBe(0);
  });
});

describe("simulatePaperTrade", () => {
  it("is deterministic for the same signal id and size", () => {
    const signal = makeSignal();
    const a = simulatePaperTrade(signal, 5, new Date("2026-09-23T10:00:00.000Z"));
    const b = simulatePaperTrade(signal, 5, new Date("2026-09-23T10:00:00.000Z"));
    expect(a.outcomeMultiplier).toBe(b.outcomeMultiplier);
    expect(a.pnlSol).toBe(b.pnlSol);
    expect(a.closesAt).toBe(b.closesAt);
  });

  it("opens the trade in 'open' status with closesAt after openedAt", () => {
    const signal = makeSignal();
    const now = new Date("2026-09-23T10:00:00.000Z");
    const trade = simulatePaperTrade(signal, 5, now);
    expect(trade.status).toBe("open");
    expect(trade.closedAt).toBeNull();
    expect(new Date(trade.closesAt).getTime()).toBeGreaterThan(now.getTime());
  });

  it("computes pnlSol consistently with sizeSol and outcomeMultiplier", () => {
    const signal = makeSignal();
    const trade = simulatePaperTrade(signal, 5, new Date("2026-09-23T10:00:00.000Z"));
    expect(trade.pnlSol).toBeCloseTo(5 * (trade.outcomeMultiplier - 1), 6);
  });
});
