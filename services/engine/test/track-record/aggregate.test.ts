import { describe, expect, it } from "vitest";
import type { TrackRecordEntry } from "../../src/db/track-records-repo.js";
import { computeTrackRecordStats } from "../../src/track-record/aggregate.js";

function makeEntry(overrides: Partial<TrackRecordEntry> = {}): TrackRecordEntry {
  return {
    id: "entry-1",
    signalId: "signal-1",
    category: "discarded",
    riskLevel: "high",
    createdAt: "2026-09-23T10:00:00.000Z",
    dueAt1h: "2026-09-23T11:00:00.000Z",
    dueAt24h: "2026-09-24T10:00:00.000Z",
    priceChange1hPct: null,
    priceChange24hPct: null,
    settled1h: false,
    settled24h: false,
    ...overrides,
  };
}

describe("computeTrackRecordStats", () => {
  it("matches the CLAUDE.md example shape: 'scartati 30, di cui 22 a -90% entro 24h'", () => {
    const severeCrash = (i: number) =>
      makeEntry({
        id: `d-${i}`,
        priceChange24hPct: -95,
        priceChange1hPct: -10,
        settled24h: true,
        settled1h: true,
      });
    const moderateLoss = (i: number) =>
      makeEntry({
        id: `d-mod-${i}`,
        priceChange24hPct: -50,
        priceChange1hPct: -10,
        settled24h: true,
        settled1h: true,
      });

    const entries = [
      ...Array.from({ length: 22 }, (_, i) => severeCrash(i)),
      ...Array.from({ length: 8 }, (_, i) => moderateLoss(i)),
    ];

    const stats = computeTrackRecordStats(entries);
    expect(stats.discarded.total).toBe(30);
    expect(stats.discarded.window24h.bigLossCount).toBe(22);
    expect(stats.discarded.window24h.settledCount).toBe(30);
  });

  it("separates discarded from signaled", () => {
    const entries = [
      makeEntry({ id: "d1", category: "discarded" }),
      makeEntry({ id: "s1", category: "signaled", riskLevel: "low" }),
      makeEntry({ id: "s2", category: "signaled", riskLevel: "medium" }),
    ];
    const stats = computeTrackRecordStats(entries);
    expect(stats.discarded.total).toBe(1);
    expect(stats.signaled.total).toBe(2);
  });

  it("only counts settled (non-null) values for averages and thresholds", () => {
    const entries = [
      makeEntry({ id: "unsettled", priceChange24hPct: null }),
      makeEntry({ id: "settled", priceChange24hPct: -20, settled24h: true }),
    ];
    const stats = computeTrackRecordStats(entries);
    expect(stats.discarded.total).toBe(2);
    expect(stats.discarded.window24h.settledCount).toBe(1);
    expect(stats.discarded.window24h.avgChangePct).toBe(-20);
  });

  it("computes avg and median correctly", () => {
    const entries = [
      makeEntry({ id: "a", priceChange24hPct: -10 }),
      makeEntry({ id: "b", priceChange24hPct: -20 }),
      makeEntry({ id: "c", priceChange24hPct: -30 }),
    ];
    const stats = computeTrackRecordStats(entries);
    expect(stats.discarded.window24h.avgChangePct).toBe(-20);
    expect(stats.discarded.window24h.medianChangePct).toBe(-20);
  });

  it("counts big gains (>= +100%) for signaled tokens", () => {
    const entries = [
      makeEntry({ id: "s1", category: "signaled", priceChange24hPct: 150 }),
      makeEntry({ id: "s2", category: "signaled", priceChange24hPct: 20 }),
    ];
    const stats = computeTrackRecordStats(entries);
    expect(stats.signaled.window24h.bigGainCount).toBe(1);
  });

  it("returns nulls/zeros for an empty category", () => {
    const stats = computeTrackRecordStats([]);
    expect(stats.discarded.total).toBe(0);
    expect(stats.discarded.window24h.avgChangePct).toBeNull();
    expect(stats.discarded.window24h.medianChangePct).toBeNull();
  });
});
