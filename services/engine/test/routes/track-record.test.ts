import { afterEach, describe, expect, it } from "vitest";
import { buildSignal } from "../../src/signals/build-signal.js";
import { makeRawLaunchEvent } from "../fixtures.js";
import { createTestApp } from "./helpers.js";

describe("GET /track-record", () => {
  let ctx: ReturnType<typeof createTestApp> | undefined;

  afterEach(async () => {
    await ctx?.app.close();
    ctx?.db.close();
    ctx = undefined;
  });

  it("returns zeroed stats when there is nothing tracked yet", async () => {
    ctx = createTestApp();
    const response = await ctx.app.inject({ method: "GET", url: "/track-record" });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.discarded.total).toBe(0);
    expect(body.signaled.total).toBe(0);
  });

  it("settles due marks and reports aggregated stats", async () => {
    ctx = createTestApp();
    const createdAt = new Date(Date.now() - 25 * 3_600_000); // 25h fa: entrambe le finestre sono scadute
    const signal = buildSignal(
      makeRawLaunchEvent({
        topHolderPercentages: [70, 10, 5, 3, 2, 2, 1, 1, 1, 1],
        devWalletHistory: { previousLaunches: 15, previousRugs: 5, walletAgeDays: 0 },
        initialLiquiditySol: 0.2,
        snipedWalletsCount: 40,
        mintAuthorityRevoked: false,
        freezeAuthorityRevoked: false,
      }),
    );
    ctx.signalsRepo.insert(signal);
    ctx.trackRecordsRepo.insert({
      signalId: signal.id,
      category: "discarded",
      riskLevel: signal.riskReport.level,
      createdAt,
    });

    const response = await ctx.app.inject({ method: "GET", url: "/track-record" });
    const body = response.json();
    expect(body.discarded.total).toBe(1);
    expect(body.discarded.window24h.settledCount).toBe(1);
  });
});
