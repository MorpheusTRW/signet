import type { RawLaunchEvent } from "../ingest/event-source.js";
import type { FilterCheck } from "./types.js";

const LOW_LIQUIDITY_SOL = 1;
const VERY_LOW_LIQUIDITY_SOL = 0.3;

/** Liquidità iniziale della pool: molto bassa significa slippage estremo e facilità di rug. */
export function checkInitialLiquidity(event: RawLaunchEvent): FilterCheck {
  const { initialLiquiditySol } = event;

  if (initialLiquiditySol < VERY_LOW_LIQUIDITY_SOL) {
    return {
      id: "initial-liquidity",
      passed: false,
      reason: `Very low initial liquidity (${initialLiquiditySol} SOL)`,
      riskPoints: 25,
    };
  }

  if (initialLiquiditySol < LOW_LIQUIDITY_SOL) {
    return {
      id: "initial-liquidity",
      passed: false,
      reason: `Low initial liquidity (${initialLiquiditySol} SOL)`,
      riskPoints: 12,
    };
  }

  return {
    id: "initial-liquidity",
    passed: true,
    reason: `Adequate initial liquidity (${initialLiquiditySol} SOL)`,
    riskPoints: 0,
  };
}
