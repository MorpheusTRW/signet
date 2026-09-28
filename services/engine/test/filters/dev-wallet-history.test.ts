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
    expect(result.reason).toBe("Clean dev");
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
    expect(result.reason).toBe("Dev with 6 previous rugs");
    expect(result.riskPoints).toBe(50);
  });

  it("flags a serial launcher (many launches, almost none migrated)", () => {
    const event = makeRawLaunchEvent({
      devWalletHistory: { previousLaunches: 26, previousLaunchesMigrated: 1, previousRugs: 0, walletAgeDays: 9 },
      unverified: ["dev-rugs"],
    });
    const result = checkDevWalletHistory(event);
    expect(result.passed).toBe(false);
    expect(result.reason).toBe("Serial dev: at least 26 previous launches, 1 migrated");
    expect(result.riskPoints).toBe(50);
  });

  it("flags a dev with a few launches and none migrated", () => {
    const event = makeRawLaunchEvent({
      devWalletHistory: { previousLaunches: 4, previousLaunchesMigrated: 0, previousRugs: 0, walletAgeDays: 60 },
      unverified: ["dev-rugs"],
    });
    expect(checkDevWalletHistory(event).riskPoints).toBe(12);
  });

  it("does not call a dev clean when rugs are unverified", () => {
    const event = makeRawLaunchEvent({
      devWalletHistory: { previousLaunches: 2, previousLaunchesMigrated: 1, previousRugs: 0, walletAgeDays: 60 },
      unverified: ["dev-rugs"],
    });
    const result = checkDevWalletHistory(event);
    expect(result.passed).toBe(false);
    expect(result.reason).toContain("unverified");
    expect(result.riskPoints).toBe(5);
  });
});
