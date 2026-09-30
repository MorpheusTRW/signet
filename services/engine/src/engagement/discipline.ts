/**
 * Metriche di "buone decisioni" (radar, rug schivati, streak, recap). Funzioni pure:
 * nessuna dipende da importi o profitti, così niente nell'app può premiare il volume.
 */

export const DAY_MS = 86_400_000;

export function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/** Settimana ISO 8601 (lunedì 00:00 UTC) che contiene `date`. */
export function isoWeek(date: Date): { year: number; week: number; start: Date } {
  const day = startOfUtcDay(date);
  const weekday = (day.getUTCDay() + 6) % 7; // lunedì = 0
  const start = new Date(day.getTime() - weekday * DAY_MS);
  // L'anno ISO è quello del giovedì della stessa settimana.
  const thursday = new Date(start.getTime() + 3 * DAY_MS);
  const year = thursday.getUTCFullYear();
  const firstThursday = new Date(Date.UTC(year, 0, 4));
  const firstWeekStart = new Date(
    firstThursday.getTime() - ((firstThursday.getUTCDay() + 6) % 7) * DAY_MS,
  );
  const week = Math.round((start.getTime() - firstWeekStart.getTime()) / (7 * DAY_MS)) + 1;
  return { year, week, start };
}

export interface ClosedTradeLike {
  sizeSol: number;
  openedAt: string;
  closedAt: string | null;
  exitValueSol: number | null;
}

/** Chiusura in perdita a pochi minuti dall'apertura: la reazione d'impulso che la streak scoraggia. */
export function isPanicSell(position: ClosedTradeLike, windowMs: number): boolean {
  if (position.closedAt === null || position.exitValueSol === null) return false;
  const heldMs = new Date(position.closedAt).getTime() - new Date(position.openedAt).getTime();
  return heldMs <= windowMs && position.exitValueSol < position.sizeSol;
}

export interface DisciplineStreak {
  /** Giorni consecutivi (UTC, oggi incluso) senza panic sell dal primo utilizzo. 0 = nessuna attività o panic sell oggi. */
  days: number;
  /** Ultimi 7 giorni, dal più vecchio a oggi: true se il giorno è dentro la streak. */
  lastSevenDays: boolean[];
}

/**
 * La streak NON richiede di tradare: conta i giorni dal primo utilizzo (o dall'ultimo
 * panic sell), quindi non spinge mai ad aprire posizioni. Il tetto del 20% è imposto
 * dal server a ogni entry, per cui ogni giorno della streak lo rispetta per costruzione.
 */
export function computeDisciplineStreak(params: {
  firstSeenAt: string | null;
  positions: ClosedTradeLike[];
  now: Date;
  panicSellWindowMs: number;
}): DisciplineStreak {
  const today = startOfUtcDay(params.now).getTime();
  const empty: DisciplineStreak = { days: 0, lastSevenDays: Array.from({ length: 7 }, () => false) };
  if (params.firstSeenAt === null) return empty;

  let streakStart = startOfUtcDay(new Date(params.firstSeenAt)).getTime();
  for (const position of params.positions) {
    if (!isPanicSell(position, params.panicSellWindowMs)) continue;
    const dayAfter = startOfUtcDay(new Date(position.closedAt!)).getTime() + DAY_MS;
    streakStart = Math.max(streakStart, dayAfter);
  }
  if (streakStart > today) return empty;

  return {
    days: Math.round((today - streakStart) / DAY_MS) + 1,
    lastSevenDays: Array.from({ length: 7 }, (_, i) => today - (6 - i) * DAY_MS >= streakStart),
  };
}

/** Un token scartato è un rug schivato se è crollato almeno della soglia (o la pool è stata svuotata). */
export function isRug(changePct: number | null, thresholdPct: number): boolean {
  return changePct !== null && changePct <= thresholdPct;
}
