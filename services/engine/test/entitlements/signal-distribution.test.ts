import type { Signal } from "@seeker-signal/shared";
import { describe, expect, it } from "vitest";
import { selectSignalsForTier } from "../../src/entitlements/signal-distribution.js";
import { getTierLimits } from "../../src/entitlements/tier-limits.js";
import { makeTierConfig } from "./fixtures.js";

const NOW = new Date("2026-09-23T12:00:00.000Z");

function makeSignal(id: string, minutesAgo: number): Signal {
  return {
    id,
    createdAt: new Date(NOW.getTime() - minutesAgo * 60_000).toISOString(),
    program: "pump-fun",
    tokenMint: "9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin",
    poolAddress: "5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1",
    initialLiquiditySol: 5,
    riskReport: { score: 10, level: "low", reasons: ["ok"] },
    summary: "test",
  };
}

describe("selectSignalsForTier", () => {
  const tierConfig = makeTierConfig({
    free: {
      signalDelaySeconds: 45,
      maxSignalsPerDay: 2,
      historyHours: 24,
      platformFeeBps: 75,
    },
  });
  const freeLimits = getTierLimits("free", tierConfig);
  const proLimits = getTierLimits("pro", tierConfig);

  it("FREE: hides signals created within the delay window", () => {
    const candidates = [makeSignal("recent", 0.1), makeSignal("old-enough", 2)];
    const { signals } = selectSignalsForTier({
      now: NOW,
      candidatesDesc: candidates,
      limits: freeLimits,
      alreadyDeliveredIdsToday: new Set(),
      requestedLimit: 50,
    });
    expect(signals.map((s) => s.id)).toEqual(["old-enough"]);
  });

  it("FREE: excludes signals older than the history window", () => {
    const candidates = [makeSignal("in-window", 60), makeSignal("too-old", 25 * 60)];
    const { signals } = selectSignalsForTier({
      now: NOW,
      candidatesDesc: candidates,
      limits: freeLimits,
      alreadyDeliveredIdsToday: new Set(),
      requestedLimit: 50,
    });
    expect(signals.map((s) => s.id)).toEqual(["in-window"]);
  });

  it("FREE: caps new signals to maxSignalsPerDay and reports them as newly delivered", () => {
    const candidates = [
      makeSignal("s1", 10),
      makeSignal("s2", 20),
      makeSignal("s3", 30),
    ];
    const { signals, newlyDeliveredIds } = selectSignalsForTier({
      now: NOW,
      candidatesDesc: candidates,
      limits: freeLimits,
      alreadyDeliveredIdsToday: new Set(),
      requestedLimit: 50,
    });
    expect(signals).toHaveLength(2);
    expect(newlyDeliveredIds).toHaveLength(2);
  });

  it("FREE: still shows signals already delivered today, without counting them again", () => {
    const candidates = [
      makeSignal("s1", 10),
      makeSignal("s2", 20),
      makeSignal("s3", 30),
    ];
    const { signals, newlyDeliveredIds } = selectSignalsForTier({
      now: NOW,
      candidatesDesc: candidates,
      limits: freeLimits,
      alreadyDeliveredIdsToday: new Set(["s1", "s2"]),
      requestedLimit: 50,
    });
    // quota (2) already consumed by s1/s2: no new signal should be added
    expect(signals.map((s) => s.id).sort()).toEqual(["s1", "s2"]);
    expect(newlyDeliveredIds).toHaveLength(0);
  });

  it("FREE: quota of 0 once the daily limit is already met", () => {
    const candidates = [makeSignal("s1", 10), makeSignal("s2", 20), makeSignal("s3", 30)];
    const { newlyDeliveredIds } = selectSignalsForTier({
      now: NOW,
      candidatesDesc: candidates,
      limits: freeLimits,
      alreadyDeliveredIdsToday: new Set(["already-1", "already-2"]),
      requestedLimit: 50,
    });
    expect(newlyDeliveredIds).toHaveLength(0);
  });

  it("PRO/HOLDER: no delay, no daily limit, no history floor", () => {
    const candidates = [makeSignal("just-now", 0), makeSignal("very-old", 1000 * 60)];
    const { signals, newlyDeliveredIds } = selectSignalsForTier({
      now: NOW,
      candidatesDesc: candidates,
      limits: proLimits,
      alreadyDeliveredIdsToday: new Set(),
      requestedLimit: 50,
    });
    expect(signals.map((s) => s.id)).toEqual(["just-now", "very-old"]);
    expect(newlyDeliveredIds).toHaveLength(0); // PRO/HOLDER non tracciano consegne giornaliere
  });

  it("respects requestedLimit", () => {
    const candidates = [makeSignal("a", 1), makeSignal("b", 2), makeSignal("c", 3)];
    const { signals } = selectSignalsForTier({
      now: NOW,
      candidatesDesc: candidates,
      limits: proLimits,
      alreadyDeliveredIdsToday: new Set(),
      requestedLimit: 2,
    });
    expect(signals).toHaveLength(2);
  });
});

describe("selectSignalsForTier — quota FREE e token scartati", () => {
  const tierConfig = makeTierConfig({
    free: { signalDelaySeconds: 0, maxSignalsPerDay: 2, historyHours: 24, platformFeeBps: 75 },
  });
  const freeLimits = getTierLimits("free", tierConfig);
  const signal = (id: string, minutesAgo: number, level: "low" | "high"): Signal => ({
    id,
    createdAt: new Date(NOW.getTime() - minutesAgo * 60_000).toISOString(),
    program: "pumpswap",
    tokenMint: "9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin",
    poolAddress: "5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1",
    initialLiquiditySol: 85,
    riskReport: { score: level === "high" ? 90 : 10, level, reasons: ["r"] },
    summary: "s",
  });

  it("gli scartati si vedono sempre e non consumano la quota", () => {
    const candidates = [signal("h1", 1, "high"), signal("h2", 2, "high"), signal("p1", 3, "low"), signal("p2", 4, "low"), signal("p3", 5, "low")];
    const { signals, newlyDeliveredIds } = selectSignalsForTier({
      now: NOW,
      candidatesDesc: candidates,
      limits: freeLimits,
      alreadyDeliveredIdsToday: new Set(),
      requestedLimit: 50,
    });
    expect(signals.map((s) => s.id)).toEqual(["h1", "h2", "p1", "p2"]);
    expect(newlyDeliveredIds).toEqual(["p1", "p2"]);
  });

});
