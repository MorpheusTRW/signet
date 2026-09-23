import type { Env } from "../env.js";
import type { TierConfig } from "../entitlements/types.js";

/**
 * Tutte le soglie, i prezzi e le bps della monetizzazione vivono in config
 * (env), mai hardcoded nel codice (CLAUDE.md, sezione Monetizzazione).
 */
export function buildTierConfig(env: Env): TierConfig {
  return {
    free: {
      signalDelaySeconds: env.FREE_SIGNAL_DELAY_SECONDS,
      maxSignalsPerDay: env.FREE_MAX_SIGNALS_PER_DAY,
      historyHours: env.FREE_HISTORY_HOURS,
      platformFeeBps: env.FREE_PLATFORM_FEE_BPS,
    },
    pro: {
      subscriptionDays: env.PRO_SUBSCRIPTION_DAYS,
      platformFeeBps: env.PRO_PLATFORM_FEE_BPS,
    },
    holder: {
      minSkrBalance: env.HOLDER_MIN_SKR,
      platformFeeBps: env.HOLDER_PLATFORM_FEE_BPS,
    },
  };
}
