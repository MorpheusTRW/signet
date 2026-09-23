import type { Tier, TierConfig, TierLimits } from "./types.js";

export function getTierLimits(tier: Tier, config: TierConfig): TierLimits {
  switch (tier) {
    case "free":
      return {
        signalDelaySeconds: config.free.signalDelaySeconds,
        maxSignalsPerDay: config.free.maxSignalsPerDay,
        historyHours: config.free.historyHours,
        customFilters: false,
        platformFeeBps: config.free.platformFeeBps,
      };
    case "pro":
      return {
        signalDelaySeconds: 0,
        maxSignalsPerDay: null,
        historyHours: null,
        customFilters: true,
        platformFeeBps: config.pro.platformFeeBps,
      };
    case "holder":
      return {
        signalDelaySeconds: 0,
        maxSignalsPerDay: null,
        historyHours: null,
        customFilters: true,
        platformFeeBps: config.holder.platformFeeBps,
      };
  }
}
