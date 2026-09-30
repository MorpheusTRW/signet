import { describe, expect, it } from "vitest";
import { computeDisciplineStreak, isoWeek, isPanicSell, isRug } from "../../src/engagement/discipline.js";

const NOW = new Date("2026-09-30T18:00:00.000Z");
const WINDOW = 15 * 60_000;

describe("isoWeek", () => {
  it("usa settimane ISO che iniziano il lunedì (UTC)", () => {
    expect(isoWeek(NOW)).toEqual({ year: 2026, week: 40, start: new Date("2026-09-28T00:00:00.000Z") });
    // 1 gennaio 2027 è venerdì: appartiene alla settimana 53 del 2026.
    expect(isoWeek(new Date("2027-01-01T12:00:00Z"))).toMatchObject({ year: 2026, week: 53 });
  });
});

describe("isPanicSell", () => {
  const trade = (minutes: number, exit: number) => ({
    sizeSol: 1,
    openedAt: "2026-09-30T10:00:00.000Z",
    closedAt: new Date(Date.parse("2026-09-30T10:00:00.000Z") + minutes * 60_000).toISOString(),
    exitValueSol: exit,
  });
  it("chiusura in perdita entro la finestra", () => expect(isPanicSell(trade(5, 0.7), WINDOW)).toBe(true));
  it("chiusura in profitto non è panic", () => expect(isPanicSell(trade(5, 1.3), WINDOW)).toBe(false));
  it("chiusura in perdita dopo la finestra non è panic", () => expect(isPanicSell(trade(60, 0.7), WINDOW)).toBe(false));
});

describe("computeDisciplineStreak", () => {
  it("senza attività la streak è zero", () => {
    const streak = computeDisciplineStreak({ firstSeenAt: null, positions: [], now: NOW, panicSellWindowMs: WINDOW });
    expect(streak.days).toBe(0);
    expect(streak.lastSevenDays).toEqual([false, false, false, false, false, false, false]);
  });

  it("conta i giorni dal primo utilizzo senza richiedere trade", () => {
    const streak = computeDisciplineStreak({
      firstSeenAt: "2026-09-28T22:00:00.000Z",
      positions: [],
      now: NOW,
      panicSellWindowMs: WINDOW,
    });
    expect(streak.days).toBe(3);
    expect(streak.lastSevenDays).toEqual([false, false, false, false, true, true, true]);
  });

  it("un panic sell la fa ripartire dal giorno dopo", () => {
    const streak = computeDisciplineStreak({
      firstSeenAt: "2026-09-01T00:00:00.000Z",
      positions: [
        { sizeSol: 1, openedAt: "2026-09-27T10:00:00.000Z", closedAt: "2026-09-27T10:05:00.000Z", exitValueSol: 0.5 },
      ],
      now: NOW,
      panicSellWindowMs: WINDOW,
    });
    expect(streak.days).toBe(3);
  });

  it("un panic sell oggi azzera la streak", () => {
    const streak = computeDisciplineStreak({
      firstSeenAt: "2026-09-01T00:00:00.000Z",
      positions: [
        { sizeSol: 1, openedAt: "2026-09-30T10:00:00.000Z", closedAt: "2026-09-30T10:01:00.000Z", exitValueSol: 0.9 },
      ],
      now: NOW,
      panicSellWindowMs: WINDOW,
    });
    expect(streak.days).toBe(0);
  });
});

describe("isRug", () => {
  it("usa la soglia configurata e ignora gli esiti ancora ignoti", () => {
    expect(isRug(-95, -90)).toBe(true);
    expect(isRug(-90, -90)).toBe(true);
    expect(isRug(-50, -90)).toBe(false);
    expect(isRug(null, -90)).toBe(false);
  });
});
