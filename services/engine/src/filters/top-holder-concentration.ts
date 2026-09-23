import type { RawLaunchEvent } from "../ingest/event-source.js";
import type { FilterCheck } from "./types.js";

const WARN_THRESHOLD_PCT = 40;
const HIGH_THRESHOLD_PCT = 65;

/** % di supply detenuta collettivamente dai top 10 holder: più è alta, più il token è manipolabile. */
export function checkTopHolderConcentration(
  event: RawLaunchEvent,
): FilterCheck {
  const totalPct = event.topHolderPercentages.reduce((a, b) => a + b, 0);
  const rounded = Math.round(totalPct * 10) / 10;

  if (totalPct >= HIGH_THRESHOLD_PCT) {
    return {
      id: "top-holder-concentration",
      passed: false,
      reason: `Top 10 holder detengono ${rounded}% della supply (concentrazione molto alta)`,
      riskPoints: 35,
    };
  }

  if (totalPct >= WARN_THRESHOLD_PCT) {
    return {
      id: "top-holder-concentration",
      passed: false,
      reason: `Top 10 holder detengono ${rounded}% della supply (concentrazione elevata)`,
      riskPoints: 18,
    };
  }

  return {
    id: "top-holder-concentration",
    passed: true,
    reason: `Top 10 holder detengono ${rounded}% della supply`,
    riskPoints: 0,
  };
}
