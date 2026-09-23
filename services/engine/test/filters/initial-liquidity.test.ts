import { describe, expect, it } from "vitest";
import { checkInitialLiquidity } from "../../src/filters/initial-liquidity.js";
import { makeRawLaunchEvent } from "../fixtures.js";

describe("checkInitialLiquidity", () => {
  it("passes for adequate liquidity", () => {
    const result = checkInitialLiquidity(
      makeRawLaunchEvent({ initialLiquiditySol: 15 }),
    );
    expect(result.passed).toBe(true);
    expect(result.riskPoints).toBe(0);
  });

  it("flags low liquidity", () => {
    const result = checkInitialLiquidity(
      makeRawLaunchEvent({ initialLiquiditySol: 0.5 }),
    );
    expect(result.passed).toBe(false);
    expect(result.riskPoints).toBe(12);
  });

  it("flags very low liquidity (obvious rug pattern)", () => {
    const result = checkInitialLiquidity(
      makeRawLaunchEvent({ initialLiquiditySol: 0.15 }),
    );
    expect(result.passed).toBe(false);
    expect(result.riskPoints).toBe(25);
  });
});
