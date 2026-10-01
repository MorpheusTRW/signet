/*
 * Ricalibrazione del 2026-10-01 su 1.133 chiamate reali con esito a +1h (verifica:
 * regole ricavate dalla prima metà delle 24h, controllate sulla seconda):
 * - oggi "Low" e "Medium" crollavano oltre il 90% quanto gli "High" (75–79% contro 72%);
 * - la maggior parte passava solo perché l'analisi del lancio non era stata fatta
 *   (budget Helius esaurito presto, speso anche su finte migrazioni da 0,1 SOL);
 * - top 10 sotto il 65% e dev con wallet non creato il giorno stesso: 57–65% di crolli
 *   contro 77–79%; con l'analisi del lancio fatta e superata: 44% (campione piccolo).
 * Restano euristiche: nessun filtro rende sicura una memecoin.
 */

/** Liquidità di una migrazione pump.fun standard: ~85 SOL. Molto meno è anomalo. */
export const MIN_NORMAL_MIGRATION_LIQUIDITY_SOL = 80;
/** Top 10 holder (pool esclusa) a partire da questa % della supply: concentrazione molto alta. */
export const TOP10_VERY_HIGH_PCT = 65;
/** Wallet del dev più giovane di così (in giorni interi) = creato per il lancio. */
export const MIN_DEV_WALLET_AGE_DAYS = 1;

export interface PrefilterInput {
  initialLiquiditySol: number;
  /** null = distribuzione non leggibile. */
  topHolderPercentages: number[] | null;
  devWalletAgeDays: number;
}

/**
 * Controlli economici fatti prima dell'analisi del lancio (chiamate Helius costose, con
 * budget giornaliero): l'analisi si spende solo su chi può ancora diventare un segnale.
 * Restituisce il motivo per cui NON analizzare, o null se il token merita l'analisi.
 */
export function skipLaunchAnalysisReason(input: PrefilterInput): string | null {
  if (input.initialLiquiditySol < MIN_NORMAL_MIGRATION_LIQUIDITY_SOL) return "abnormal-liquidity";
  if (input.topHolderPercentages === null) return "holders-unverified";
  const top10 = input.topHolderPercentages.reduce((a, b) => a + b, 0);
  if (top10 >= TOP10_VERY_HIGH_PCT) return "top10-very-high";
  if (input.devWalletAgeDays < MIN_DEV_WALLET_AGE_DAYS) return "fresh-dev-wallet";
  return null;
}
