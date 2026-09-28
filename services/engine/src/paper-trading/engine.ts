import type { UserPosition } from "../db/user-positions-repo.js";
import type { PaperTradingConfig } from "./types.js";

/** Margine residuo, in SOL, prima di toccare il limite di esposizione (principio 3). */
export function remainingExposureSol(
  portfolioValueSol: number,
  openExposureSol: number,
  maxExposureFraction: number,
): number {
  return Math.max(0, portfolioValueSol * maxExposureFraction - openExposureSol);
}

export interface PaperPortfolio {
  /** Saldo virtuale iniziale + PnL realizzato. */
  balanceSol: number;
  openExposureSol: number;
  realizedPnlSol: number;
  remainingSol: number;
}

/**
 * Portafoglio paper di UN wallet, dalle sole posizioni aperte dall'utente. Il limite
 * del 20% (CLAUDE.md, principio 3) si applica al saldo virtuale + PnL realizzato.
 */
export function paperPortfolio(positions: UserPosition[], config: PaperTradingConfig): PaperPortfolio {
  const realizedPnlSol = positions
    .filter((p) => p.status === "closed" && p.exitValueSol !== null)
    .reduce((sum, p) => sum + (p.exitValueSol! - p.sizeSol), 0);
  const openExposureSol = positions.filter((p) => p.status === "open").reduce((sum, p) => sum + p.sizeSol, 0);
  const balanceSol = config.balanceSol + realizedPnlSol;
  return {
    balanceSol: Number(balanceSol.toFixed(6)),
    openExposureSol: Number(openExposureSol.toFixed(6)),
    realizedPnlSol: Number(realizedPnlSol.toFixed(6)),
    remainingSol: Number(remainingExposureSol(balanceSol, openExposureSol, config.maxExposureFraction).toFixed(6)),
  };
}
