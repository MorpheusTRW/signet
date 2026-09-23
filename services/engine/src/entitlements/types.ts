export type Tier = "free" | "pro" | "holder";

export interface TierLimits {
  /** Ritardo, in secondi, prima che un segnale sia visibile a questo tier. */
  signalDelaySeconds: number;
  /** Numero massimo di segnali nuovi al giorno, null = illimitato. */
  maxSignalsPerDay: number | null;
  /** Profondità dello storico consultabile, in ore. null = completo. */
  historyHours: number | null;
  /** Se il tier può usare filtri personalizzati (oltre a quelli base). */
  customFilters: boolean;
  /** Fee piattaforma sugli swap, in basis points, per questo tier. */
  platformFeeBps: number;
}

export interface TierConfig {
  free: {
    signalDelaySeconds: number;
    maxSignalsPerDay: number;
    historyHours: number;
    platformFeeBps: number;
  };
  pro: {
    subscriptionDays: number;
    platformFeeBps: number;
  };
  holder: {
    minSkrBalance: number;
    platformFeeBps: number;
  };
}
