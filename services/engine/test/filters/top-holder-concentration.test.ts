import { describe, expect, it } from "vitest";
import { checkTopHolderConcentration } from "../../src/filters/top-holder-concentration.js";
import { makeRawLaunchEvent } from "../fixtures.js";

describe("checkTopHolderConcentration", () => {
  it("passes when top 10 holders own a modest share", () => {
    const event = makeRawLaunchEvent({
      topHolderPercentages: [3, 3, 3, 3, 3, 3, 3, 3, 3, 3],
    });
    const result = checkTopHolderConcentration(event);
    expect(result.passed).toBe(true);
    expect(result.riskPoints).toBe(0);
  });

  it("flags elevated concentration between 40% and 65%", () => {
    const event = makeRawLaunchEvent({
      topHolderPercentages: [10, 8, 6, 5, 5, 5, 4, 3, 2, 2],
    });
    const result = checkTopHolderConcentration(event);
    expect(result.passed).toBe(false);
    expect(result.riskPoints).toBe(18);
  });

  it("flags very high concentration (obvious rug pattern)", () => {
    const event = makeRawLaunchEvent({
      topHolderPercentages: [70, 5, 3, 2, 2, 1, 1, 1, 1, 1],
    });
    const result = checkTopHolderConcentration(event);
    expect(result.passed).toBe(false);
    expect(result.riskPoints).toBe(70);
    expect(result.reason).toContain("87");
  });
});
