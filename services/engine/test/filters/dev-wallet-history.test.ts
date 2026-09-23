import { describe, expect, it } from "vitest";
import { checkDevWalletHistory } from "../../src/filters/dev-wallet-history.js";
import { makeRawLaunchEvent } from "../fixtures.js";

describe("checkDevWalletHistory", () => {
  it("passes for a clean, established dev wallet", () => {
    const event = makeRawLaunchEvent({
      devWalletHistory: { previousLaunches: 3, previousRugs: 0, walletAgeDays: 200 },
    });
    const result = checkDevWalletHistory(event);
    expect(result.passed).toBe(true);
    expect(result.reason).toBe("Dev pulito");
  });

  it("flags a brand-new wallet with no history", () => {
    const event = makeRawLaunchEvent({
      devWalletHistory: { previousLaunches: 0, previousRugs: 0, walletAgeDays: 1 },
    });
    const result = checkDevWalletHistory(event);
    expect(result.passed).toBe(false);
    expect(result.riskPoints).toBe(12);
  });

  it("flags a dev with previous rugs (obvious rug pattern) with high risk points", () => {
    const event = makeRawLaunchEvent({
      devWalletHistory: { previousLaunches: 20, previousRugs: 6, walletAgeDays: 1 },
    });
    const result = checkDevWalletHistory(event);
    expect(result.passed).toBe(false);
    expect(result.reason).toBe("Dev con 6 rug precedenti");
    expect(result.riskPoints).toBe(50);
  });
});
