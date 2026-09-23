import { describe, expect, it } from "vitest";
import { getTierLimits } from "../../src/entitlements/tier-limits.js";
import { makeTierConfig } from "./fixtures.js";

describe("getTierLimits", () => {
  const config = makeTierConfig();

  it("free: applies delay, daily limit and 24h history from config", () => {
    const limits = getTierLimits("free", config);
    expect(limits).toEqual({
      signalDelaySeconds: 45,
      maxSignalsPerDay: 3,
      historyHours: 24,
      customFilters: false,
      platformFeeBps: 75,
    });
  });

  it("pro: real-time, unlimited, full history, custom filters", () => {
    const limits = getTierLimits("pro", config);
    expect(limits).toEqual({
      signalDelaySeconds: 0,
      maxSignalsPerDay: null,
      historyHours: null,
      customFilters: true,
      platformFeeBps: 50,
    });
  });

  it("holder: same real-time entitlements as pro, with its own fee", () => {
    const limits = getTierLimits("holder", config);
    expect(limits).toEqual({
      signalDelaySeconds: 0,
      maxSignalsPerDay: null,
      historyHours: null,
      customFilters: true,
      platformFeeBps: 30,
    });
  });

  it("reads thresholds and bps from config, not hardcoded", () => {
    const customConfig = makeTierConfig({
      free: {
        signalDelaySeconds: 120,
        maxSignalsPerDay: 5,
        historyHours: 12,
        platformFeeBps: 99,
      },
    });
    expect(getTierLimits("free", customConfig).signalDelaySeconds).toBe(120);
    expect(getTierLimits("free", customConfig).platformFeeBps).toBe(99);
  });
});
