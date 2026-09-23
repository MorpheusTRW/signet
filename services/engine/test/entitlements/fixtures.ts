import type { TierConfig } from "../../src/entitlements/types.js";

export function makeTierConfig(overrides: Partial<TierConfig> = {}): TierConfig {
  return {
    free: {
      signalDelaySeconds: 45,
      maxSignalsPerDay: 3,
      historyHours: 24,
      platformFeeBps: 75,
    },
    pro: {
      subscriptionDays: 30,
      platformFeeBps: 50,
    },
    holder: {
      minSkrBalance: 10_000,
      platformFeeBps: 30,
    },
    ...overrides,
  };
}
