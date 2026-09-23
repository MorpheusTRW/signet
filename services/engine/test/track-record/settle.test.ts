import { afterEach, describe, expect, it } from "vitest";
import { createDb, type DbClient } from "../../src/db/client.js";
import { SignalsRepo } from "../../src/db/signals-repo.js";
import { TrackRecordsRepo } from "../../src/db/track-records-repo.js";
import { buildSignal } from "../../src/signals/build-signal.js";
import { settleDueTrackRecords } from "../../src/track-record/settle.js";
import { makeRawLaunchEvent } from "../fixtures.js";

function setup(createdAt: Date) {
  const db: DbClient = createDb(":memory:");
  const signalsRepo = new SignalsRepo(db);
  const trackRecordsRepo = new TrackRecordsRepo(db);

  const signal = buildSignal(
    makeRawLaunchEvent({ createdAt: createdAt.toISOString() }),
  );
  signalsRepo.insert(signal);

  return { db, signal, trackRecordsRepo };
}

describe("settleDueTrackRecords", () => {
  let db: DbClient | undefined;

  afterEach(() => {
    db?.close();
    db = undefined;
  });

  it("leaves marks untouched before they are due", () => {
    const createdAt = new Date("2026-09-23T10:00:00.000Z");
    const ctx = setup(createdAt);
    db = ctx.db;
    ctx.trackRecordsRepo.insert({
      signalId: ctx.signal.id,
      category: "discarded",
      riskLevel: "high",
      createdAt,
    });

    settleDueTrackRecords(ctx.trackRecordsRepo, createdAt); // stesso istante: nulla è ancora dovuto

    const [entry] = ctx.trackRecordsRepo.list();
    expect(entry!.settled1h).toBe(false);
    expect(entry!.settled24h).toBe(false);
  });

  it("settles the 1h mark once it's due, leaving 24h pending", () => {
    const createdAt = new Date("2026-09-23T10:00:00.000Z");
    const ctx = setup(createdAt);
    db = ctx.db;
    ctx.trackRecordsRepo.insert({
      signalId: ctx.signal.id,
      category: "discarded",
      riskLevel: "high",
      createdAt,
    });

    settleDueTrackRecords(
      ctx.trackRecordsRepo,
      new Date(createdAt.getTime() + 61 * 60_000), // +61 min
    );

    const [entry] = ctx.trackRecordsRepo.list();
    expect(entry!.settled1h).toBe(true);
    expect(entry!.priceChange1hPct).not.toBeNull();
    expect(entry!.settled24h).toBe(false);
    expect(entry!.priceChange24hPct).toBeNull();
  });

  it("settles both marks once 24h have passed", () => {
    const createdAt = new Date("2026-09-23T10:00:00.000Z");
    const ctx = setup(createdAt);
    db = ctx.db;
    ctx.trackRecordsRepo.insert({
      signalId: ctx.signal.id,
      category: "discarded",
      riskLevel: "high",
      createdAt,
    });

    settleDueTrackRecords(
      ctx.trackRecordsRepo,
      new Date(createdAt.getTime() + 25 * 3_600_000),
    );

    const [entry] = ctx.trackRecordsRepo.list();
    expect(entry!.settled1h).toBe(true);
    expect(entry!.settled24h).toBe(true);
    expect(entry!.priceChange24hPct).toBeLessThan(0); // "discarded" -> sempre negativo
  });

  it("is idempotent: settling twice doesn't change already-settled values", () => {
    const createdAt = new Date("2026-09-23T10:00:00.000Z");
    const ctx = setup(createdAt);
    db = ctx.db;
    ctx.trackRecordsRepo.insert({
      signalId: ctx.signal.id,
      category: "signaled",
      riskLevel: "low",
      createdAt,
    });
    const settleAt = new Date(createdAt.getTime() + 25 * 3_600_000);

    settleDueTrackRecords(ctx.trackRecordsRepo, settleAt);
    const [first] = ctx.trackRecordsRepo.list();

    settleDueTrackRecords(ctx.trackRecordsRepo, settleAt);
    const [second] = ctx.trackRecordsRepo.list();

    expect(second).toEqual(first);
  });

  it("works end to end from a real pipeline-built signal", () => {
    const createdAt = new Date("2026-09-23T10:00:00.000Z");
    const ctx = setup(createdAt);
    db = ctx.db;
    ctx.trackRecordsRepo.insert({
      signalId: ctx.signal.id,
      category: "signaled",
      riskLevel: ctx.signal.riskReport.level,
      createdAt,
    });

    settleDueTrackRecords(
      ctx.trackRecordsRepo,
      new Date(createdAt.getTime() + 25 * 3_600_000),
    );

    const [entry] = ctx.trackRecordsRepo.list();
    expect(entry!.settled24h).toBe(true);
  });
});
