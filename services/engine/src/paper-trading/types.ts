export interface PaperTradingConfig {
  /** Saldo virtuale di partenza di ogni wallet in paper mode, in SOL. */
  balanceSol: number;
  /** Frazione massima del portafoglio esponibile in posizioni aperte (es. 0.2 = 20%). */
  maxExposureFraction: number;
}
