import type { RawLaunchEvent } from "../ingest/event-source.js";
import type { FilterCheck } from "./types.js";

const YOUNG_WALLET_DAYS = 7;

/** Storico del wallet dev: rug precedenti e wallet appena creato sono forti segnali di rischio. */
export function checkDevWalletHistory(event: RawLaunchEvent): FilterCheck {
  const { previousRugs, walletAgeDays } = event.devWalletHistory;

  if (previousRugs > 0) {
    return {
      id: "dev-wallet-history",
      passed: false,
      reason: `Dev con ${previousRugs} rug precedenti`,
      riskPoints: Math.min(50, 20 + previousRugs * 10),
    };
  }

  if (walletAgeDays < YOUNG_WALLET_DAYS) {
    return {
      id: "dev-wallet-history",
      passed: false,
      reason: `Wallet dev creato ${walletAgeDays} giorni fa (nessuno storico)`,
      riskPoints: 12,
    };
  }

  return {
    id: "dev-wallet-history",
    passed: true,
    reason: "Dev pulito",
    riskPoints: 0,
  };
}
