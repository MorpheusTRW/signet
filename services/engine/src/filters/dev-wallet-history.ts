import type { RawLaunchEvent } from "../ingest/event-source.js";
import type { FilterCheck } from "./types.js";

const YOUNG_WALLET_DAYS = 7;
const SERIAL_LAUNCHES = 10;
const SERIAL_MAX_MIGRATION_RATE = 0.1;
const REPEAT_LAUNCHES = 3;

function launchesLabel(launches: number, migrated: number): string {
  const m = `${migrated} migrated`;
  const l = launches === 1 ? "1 previous launch" : `${launches} previous launches`;
  return `at least ${l}, ${m}`;
}

/** Storico del wallet dev: rug precedenti, lanci seriali e wallet appena creato sono forti segnali di rischio. */
export function checkDevWalletHistory(event: RawLaunchEvent): FilterCheck {
  const { previousRugs, walletAgeDays, previousLaunches, previousLaunchesMigrated } =
    event.devWalletHistory;

  if (previousRugs > 0) {
    return {
      id: "dev-wallet-history",
      passed: false,
      reason: `Dev with ${previousRugs} previous rugs`,
      riskPoints: Math.min(50, 20 + previousRugs * 10),
    };
  }

  if (previousLaunchesMigrated !== undefined && !event.unverified?.includes("dev-launches")) {
    // Lanciatore seriale: tanti token, quasi nessuno arriva alla migrazione.
    if (
      previousLaunches >= SERIAL_LAUNCHES &&
      previousLaunchesMigrated / previousLaunches < SERIAL_MAX_MIGRATION_RATE
    ) {
      return {
        id: "dev-wallet-history",
        passed: false,
        reason: `Serial dev: ${launchesLabel(previousLaunches, previousLaunchesMigrated)}`,
        // Backtest 2026-09-26: tutti i token di dev seriali hanno perso oltre l'80%.
        riskPoints: 50,
      };
    }
    if (previousLaunches >= REPEAT_LAUNCHES && previousLaunchesMigrated === 0) {
      return {
        id: "dev-wallet-history",
        passed: false,
        reason: `Dev with ${launchesLabel(previousLaunches, 0)}`,
        riskPoints: 12,
      };
    }
  }

  // Con l'analisi del lancio, il wallet usa e getta è valutato da fresh-dev-wallet (in minuti).
  if (walletAgeDays < YOUNG_WALLET_DAYS && !event.launch) {
    return {
      id: "dev-wallet-history",
      passed: false,
      reason: `Dev wallet created ${walletAgeDays} days ago (no history)`,
      riskPoints: 12,
    };
  }

  // I rug non sono verificabili on-chain in modo affidabile: non dichiarare "pulito".
  if (event.unverified?.includes("dev-rugs") || event.unverified?.includes("dev-launches")) {
    return {
      id: "dev-wallet-history",
      passed: false,
      reason: `Dev rug history unverified (wallet active for ${walletAgeDays} days)`,
      riskPoints: 5,
    };
  }

  return {
    id: "dev-wallet-history",
    passed: true,
    reason: "Clean dev",
    riskPoints: 0,
  };
}
