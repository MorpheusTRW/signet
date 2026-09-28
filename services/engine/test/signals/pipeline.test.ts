import { describe, expect, it } from "vitest";
import { createDb } from "../../src/db/client.js";
import { MarketsRepo } from "../../src/db/markets-repo.js";
import { SignalsRepo } from "../../src/db/signals-repo.js";
import { TrackRecordsRepo } from "../../src/db/track-records-repo.js";
import { processLaunchEvent } from "../../src/signals/pipeline.js";
import { makeRawLaunchEvent } from "../fixtures.js";

function setup() {
  const db = createDb(":memory:");
  return {
    db,
    signalsRepo: new SignalsRepo(db),
    trackRecordsRepo: new TrackRecordsRepo(db),
    marketsRepo: new MarketsRepo(db),
  };
}

describe("processLaunchEvent", () => {
  it("senza dati di mercato (synthetic) persiste il segnale con una marcatura simulata", () => {
    const ctx = setup();
    const signal = processLaunchEvent(makeRawLaunchEvent({ id: "s-1" }), ctx);
    expect(ctx.signalsRepo.findById(signal.id)).toBeDefined();
    expect(ctx.trackRecordsRepo.list("synthetic")).toHaveLength(1);
    expect(ctx.trackRecordsRepo.list("real")).toHaveLength(0);
    expect(ctx.marketsRepo.find(signal.id)).toBeUndefined();
    ctx.db.close();
  });

  it("con dati di mercato salva i vault della pool e una marcatura reale col prezzo di partenza", () => {
    const ctx = setup();
    const market = { baseVault: "BASE", quoteVault: "QUOTE", priceSol: 0.0000004 };
    const signal = processLaunchEvent(makeRawLaunchEvent({ id: "r-1", market }), ctx);
    expect(ctx.marketsRepo.find(signal.id)).toEqual({
      signalId: signal.id,
      baseVault: "BASE",
      quoteVault: "QUOTE",
      priceSolAtSignal: 0.0000004,
    });
    const [record] = ctx.trackRecordsRepo.list("real");
    expect(record?.priceSolAtSignal).toBe(0.0000004);
    expect(record?.category).toBe("signaled");
    ctx.db.close();
  });

  it("il rischio alto finisce fra gli scartati", () => {
    const ctx = setup();
    const signal = processLaunchEvent(
      makeRawLaunchEvent({
        id: "rug-1",
        topHolderPercentages: [70, 10, 5, 3, 2, 2, 1, 1, 1, 1],
        devWalletHistory: { previousLaunches: 15, previousRugs: 5, walletAgeDays: 0 },
        initialLiquiditySol: 0.2,
        snipedWalletsCount: 40,
        mintAuthorityRevoked: false,
        freezeAuthorityRevoked: false,
      }),
      ctx,
    );
    expect(signal.riskReport.level).toBe("high");
    expect(ctx.trackRecordsRepo.list()[0]!.category).toBe("discarded");
    ctx.db.close();
  });
});
