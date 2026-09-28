import { type Connection, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import type { UserPositionsRepo } from "../db/user-positions-repo.js";
import { paperPortfolio, remainingExposureSol } from "../paper-trading/engine.js";
import type { PaperTradingConfig } from "../paper-trading/types.js";

export interface ExposureDeps {
  tradingMode: "paper" | "live";
  userPositionsRepo: UserPositionsRepo;
  paperTradingConfig: PaperTradingConfig;
  /** Serve solo in live (saldo reale del wallet). */
  connection: Connection | undefined;
}

/**
 * Margine residuo di UN wallet sotto il limite di esposizione (CLAUDE.md, principio 3).
 * Paper: saldo virtuale + PnL realizzato, meno le posizioni paper aperte.
 * Live: 20% del saldo SOL reale del wallet (le posizioni live non sono ancora tracciate).
 */
export async function remainingForWallet(pubkey: string, deps: ExposureDeps): Promise<number> {
  if (deps.tradingMode === "paper") {
    return paperPortfolio(deps.userPositionsRepo.listByWallet(pubkey, "paper"), deps.paperTradingConfig).remainingSol;
  }
  if (!deps.connection) throw new Error("RPC non configurato: impossibile leggere il saldo del wallet");
  const balanceSol = (await deps.connection.getBalance(new PublicKey(pubkey))) / LAMPORTS_PER_SOL;
  return remainingExposureSol(balanceSol, 0, deps.paperTradingConfig.maxExposureFraction);
}
