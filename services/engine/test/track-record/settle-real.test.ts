import { describe, expect, it, vi } from "vitest";
import { createDb } from "../../src/db/client.js";
import { MarketsRepo } from "../../src/db/markets-repo.js";
import { SignalsRepo } from "../../src/db/signals-repo.js";
import { TrackRecordsRepo } from "../../src/db/track-records-repo.js";
import { processLaunchEvent } from "../../src/signals/pipeline.js";
import { settleRealTrackRecords } from "../../src/track-record/settle-real.js";
import { makeRawLaunchEvent } from "../fixtures.js";

const T0 = new Date("2026-09-28T10:00:00.000Z");
const acc = (ui: string) => ({ data: { parsed: { info: { tokenAmount: { uiAmountString: ui } } } } });

function setup(priceSol = 0.0001) {
  const db = createDb(":memory:");
  const deps = {
    signalsRepo: new SignalsRepo(db),
    trackRecordsRepo: new TrackRecordsRepo(db),
    marketsRepo: new MarketsRepo(db),
  };
  processLaunchEvent(
    makeRawLaunchEvent({ id: "e1", createdAt: T0.toISOString(), market: { baseVault: "B", quoteVault: "Q", priceSol } }),
    deps,
  );
  return { db, ...deps };
}

describe("settleRealTrackRecords", () => {
  it("realizza +1h col prezzo reale della pool", async () => {
    const ctx = setup(0.0001);
    // Prezzo attuale 100 / 2.000.000 = 0.00005 → -50%
    const rpc = vi.fn(async () => ({ value: [acc("2000000"), acc("100")] }));
    const settled = await settleRealTrackRecords({ ...ctx, rpc: rpc as never }, new Date(T0.getTime() + 3_600_000 + 60_000));
    expect(settled).toBe(1);
    const [record] = ctx.trackRecordsRepo.list("real");
    expect(record?.settled1h).toBe(true);
    expect(record?.priceChange1hPct).toBe(-50);
    expect(record?.settled24h).toBe(false);
  });

  it("pool chiusa = -100%", async () => {
    const ctx = setup();
    const rpc = vi.fn(async () => ({ value: [null, null] }));
    await settleRealTrackRecords({ ...ctx, rpc: rpc as never }, new Date(T0.getTime() + 3_600_000 + 1000));
    expect(ctx.trackRecordsRepo.list("real")[0]?.priceChange1hPct).toBe(-100);
  });

  it("letture troppo in ritardo (server spento) vengono scartate, non falsate", async () => {
    const ctx = setup();
    const rpc = vi.fn();
    await settleRealTrackRecords({ ...ctx, rpc: rpc as never }, new Date(T0.getTime() + 3 * 3_600_000));
    const [record] = ctx.trackRecordsRepo.list("real");
    expect(record?.settled1h).toBe(true);
    expect(record?.priceChange1hPct).toBeNull();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("se l'RPC fallisce non scrive nulla e riprova al giro dopo", async () => {
    const ctx = setup();
    const rpc = vi.fn(async () => {
      throw new Error("503");
    });
    await expect(
      settleRealTrackRecords({ ...ctx, rpc: rpc as never }, new Date(T0.getTime() + 3_600_000 + 1000)),
    ).rejects.toThrow();
    expect(ctx.trackRecordsRepo.list("real")[0]?.settled1h).toBe(false);
  });
});
