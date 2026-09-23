export interface PaperTrade {
  id: string;
  signalId: string;
  sizeSol: number;
  outcomeMultiplier: number;
  pnlSol: number;
  status: "open" | "closed";
  openedAt: string;
  /** Quando la posizione simulata si chiude e il PnL diventa realizzato. */
  closesAt: string;
  closedAt: string | null;
}

export interface PaperTradingConfig {
  /** Valore totale (simulato) del portafoglio, in SOL. */
  portfolioValueSol: number;
  /** Frazione massima del portafoglio esponibile in posizioni aperte (es. 0.2 = 20%). */
  maxExposureFraction: number;
  /** Size di default per una nuova entry, in SOL. */
  defaultPositionSizeSol: number;
}
