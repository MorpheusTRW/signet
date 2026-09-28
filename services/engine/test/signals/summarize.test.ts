import { describe, expect, it } from "vitest";
import { buildSummary } from "../../src/signals/summarize.js";
import { makeRawLaunchEvent } from "../fixtures.js";

describe("buildSummary", () => {
  it("matches the CLAUDE.md example template for a clean Meteora launch", () => {
    const event = makeRawLaunchEvent({
      program: "meteora-dbc",
      devWalletHistory: { previousLaunches: 1, previousRugs: 0, walletAgeDays: 90 },
      snipedWalletsCount: 3,
    });

    const summary = buildSummary(event, {
      score: 5,
      level: "low",
      reasons: ["ok"],
    });

    expect(summary).toBe(
      "New Meteora pool. Clean dev. 3 wallets sniped. Risk: Low.",
    );
  });

  it("is deterministic for the same input", () => {
    const event = makeRawLaunchEvent({ program: "pump-fun" });
    const riskReport = { score: 10, level: "low" as const, reasons: ["ok"] };

    expect(buildSummary(event, riskReport)).toBe(buildSummary(event, riskReport));
  });

  it("reflects dev rugs and high risk level", () => {
    const event = makeRawLaunchEvent({
      program: "raydium-launchlab",
      devWalletHistory: { previousLaunches: 10, previousRugs: 4, walletAgeDays: 0 },
      snipedWalletsCount: 0,
    });

    const summary = buildSummary(event, {
      score: 90,
      level: "high",
      reasons: ["x"],
    });

    expect(summary).toBe(
      "New Raydium LaunchLab pool. Dev with 4 previous rugs. No snipes detected. Risk: High.",
    );
  });

  it("reports the dev launch history found on-chain", () => {
    const event = makeRawLaunchEvent({
      program: "pumpswap",
      devWalletHistory: { previousLaunches: 26, previousLaunchesMigrated: 1, previousRugs: 0, walletAgeDays: 9 },
      snipedWalletsCount: 1,
      unverified: ["dev-rugs"],
    });
    expect(buildSummary(event, { score: 60, level: "medium", reasons: [] })).toBe(
      "New PumpSwap pool. Dev: at least 26 launches, 1 migrated. 1 wallet sniped. Risk: Medium.",
    );
  });
});
