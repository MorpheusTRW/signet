import { riskReportSchema } from "@seeker-signal/shared";
import { describe, expect, it } from "vitest";
import { computeRiskReport } from "../../src/filters/risk-report.js";
import { makeRawLaunchEvent } from "../fixtures.js";

describe("computeRiskReport", () => {
  it("produces a low-risk report for a clean launch", () => {
    const report = computeRiskReport(
      makeRawLaunchEvent({
        topHolderPercentages: [3, 3, 3, 3, 3, 3, 3, 3, 3, 3],
        devWalletHistory: { previousLaunches: 2, previousRugs: 0, walletAgeDays: 200 },
        initialLiquiditySol: 20,
        snipedWalletsCount: 0,
        mintAuthorityRevoked: true,
        freezeAuthorityRevoked: true,
      }),
    );

    expect(riskReportSchema.safeParse(report).success).toBe(true);
    expect(report.level).toBe("low");
    expect(report.score).toBe(0);
    expect(report.reasons).toEqual([
      "Nessun segnale di rischio rilevato dai filtri",
    ]);
  });

  it("produces a high-risk report for an obvious rug", () => {
    const report = computeRiskReport(
      makeRawLaunchEvent({
        topHolderPercentages: [70, 10, 5, 3, 2, 2, 1, 1, 1, 1],
        devWalletHistory: { previousLaunches: 15, previousRugs: 5, walletAgeDays: 0 },
        initialLiquiditySol: 0.2,
        snipedWalletsCount: 40,
        mintAuthorityRevoked: false,
        freezeAuthorityRevoked: false,
      }),
    );

    expect(riskReportSchema.safeParse(report).success).toBe(true);
    expect(report.level).toBe("high");
    expect(report.score).toBe(100);
    expect(report.reasons.length).toBeGreaterThanOrEqual(4);
  });

  it("caps the score at 100", () => {
    const report = computeRiskReport(
      makeRawLaunchEvent({
        topHolderPercentages: [95, 1, 1, 1, 1, 1, 0, 0, 0, 0],
        devWalletHistory: { previousLaunches: 30, previousRugs: 20, walletAgeDays: 0 },
        initialLiquiditySol: 0.01,
        snipedWalletsCount: 100,
        mintAuthorityRevoked: false,
        freezeAuthorityRevoked: false,
      }),
    );

    expect(report.score).toBeLessThanOrEqual(100);
  });
});
