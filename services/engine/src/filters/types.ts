export interface FilterCheck {
  id: string;
  /** true se il check NON ha rilevato un problema (segnale pulito su questo aspetto). */
  passed: boolean;
  reason: string;
  /** Punti di rischio aggiunti al punteggio totale se `passed` è false. */
  riskPoints: number;
}
