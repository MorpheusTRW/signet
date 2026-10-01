import type { RawLaunchEvent } from "../ingest/event-source.js";
import { TOP10_VERY_HIGH_PCT } from "./prefilter.js";
import type { FilterCheck } from "./types.js";

const WARN_THRESHOLD_PCT = 40;

/** % di supply detenuta collettivamente dai top 10 holder: più è alta, più il token è manipolabile. */
export function checkTopHolderConcentration(
  event: RawLaunchEvent,
): FilterCheck {
  if (event.unverified?.includes("holders")) {
    return {
      id: "top-holder-concentration",
      passed: false,
      reason: "Top holder distribution unverified",
      // Non verificato = non raccomandabile (ricalibrazione 2026-10-01).
      riskPoints: 70,
    };
  }
  const totalPct = event.topHolderPercentages.reduce((a, b) => a + b, 0);
  const rounded = Math.round(totalPct * 10) / 10;

  if (totalPct >= TOP10_VERY_HIGH_PCT) {
    return {
      id: "top-holder-concentration",
      passed: false,
      reason: `Top 10 holders own ${rounded}% of supply (very high concentration)`,
      riskPoints: 70,
    };
  }

  if (totalPct >= WARN_THRESHOLD_PCT) {
    return {
      id: "top-holder-concentration",
      passed: false,
      reason: `Top 10 holders own ${rounded}% of supply (high concentration)`,
      riskPoints: 18,
    };
  }

  return {
    id: "top-holder-concentration",
    passed: true,
    reason: `Top 10 holders own ${rounded}% of supply`,
    riskPoints: 0,
  };
}
