import { describe, expect, it } from "vitest";
import { createDb, type DbClient } from "../../src/db/client.js";
import { PaperTradesRepo } from "../../src/db/paper-trades-repo.js";
import { SignalsRepo } from "../../src/db/signals-repo.js";
import { TrackRecordsRepo } from "../../src/db/track-records-repo.js";
import type { PaperTradingConfig } from "../../src/paper-trading/types.js";
import { processLaunchEvent } from "../../src/signals/pipeline.js";
import { makeRawLaunchEvent } from "../fixtures.js";

function setup() {
  const db: DbClient = createDb(":memory:");
  const signalsRepo = new SignalsRepo(db);
  const paperTradesRepo = new PaperTradesRepo(db);
  const trackRecordsRepo = new TrackRecordsRepo(db);
  const paperTradingConfig: PaperTradingConfig = {
    portfolioValueSol: 100,
    maxExposureFraction: 0.2, // max 20 SOL open
    defaultPositionSizeSol: 5,
  };
  return { db, signalsRepo, paperTradesRepo, trackRecordsRepo, paperTradingConfig };
}

describe("processLaunchEvent", () => {
  it("always persists the signal, even when not approvable", () => {
    const ctx = setup();
    const rugEvent = makeRawLaunchEvent({
      id: "rug-1",
      topHolderPercentages: [70, 10, 5, 3, 2, 2, 1, 1, 1, 1],
      devWalletHistory: { previousLaunches: 15, previousRugs: 5, walletAgeDays: 0 },
      initialLiquiditySol: 0.2,
      snipedWalletsCount: 40,
      mintAuthorityRevoked: false,
      freezeAuthorityRevoked: false,
    });

    const signal = processLaunchEvent(rugEvent, ctx);

    expect(signal.riskReport.level).toBe("high");
    expect(ctx.signalsRepo.findById(signal.id)).toBeDefined();
    expect(ctx.paperTradesRepo.listBySignalId(signal.id)).toHaveLength(0);

    const trackRecords = ctx.trackRecordsRepo.list();
    expect(trackRecords).toHaveLength(1);
    expect(trackRecords[0]!.category).toBe("discarded");
    ctx.db.close();
  });

  it("opens a paper trade for an approvable signal with room in the exposure limit", () => {
    const ctx = setup();
    const cleanEvent = makeRawLaunchEvent({ id: "clean-1" });

    const signal = processLaunchEvent(cleanEvent, ctx);
    const trades = ctx.paperTradesRepo.listBySignalId(signal.id);

    expect(signal.riskReport.level).toBe("low");
    expect(trades).toHaveLength(1);
    expect(trades[0]!.sizeSol).toBe(5);
    expect(trades[0]!.status).toBe("open");

    const trackRecords = ctx.trackRecordsRepo.list();
    expect(trackRecords).toHaveLength(1);
    expect(trackRecords[0]!.category).toBe("signaled");
    ctx.db.close();
  });

  it("never lets total open exposure exceed the 20% portfolio limit across many signals", () => {
    const ctx = setup();

    for (let i = 0; i < 10; i++) {
      processLaunchEvent(makeRawLaunchEvent({ id: `clean-${i}` }), ctx);
    }

    const openExposure = ctx.paperTradesRepo.sumOpenExposureSol();
    const maxAllowed =
      ctx.paperTradingConfig.portfolioValueSol *
      ctx.paperTradingConfig.maxExposureFraction;

    expect(openExposure).toBeLessThanOrEqual(maxAllowed);
    // con size 5 SOL e limite 20 SOL, al massimo 4 posizioni possono restare aperte
    expect(ctx.paperTradesRepo.list(100).filter((t) => t.status === "open")).toHaveLength(4);
    ctx.db.close();
  });
});
