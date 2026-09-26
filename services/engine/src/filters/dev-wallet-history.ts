import type { RawLaunchEvent } from "../ingest/event-source.js";
import type { FilterCheck } from "./types.js";

const YOUNG_WALLET_DAYS = 7;
const SERIAL_LAUNCHES = 10;
const SERIAL_MAX_MIGRATION_RATE = 0.1;
const REPEAT_LAUNCHES = 3;

function launchesLabel(launches: number, migrated: number): string {
  const m = migrated === 1 ? "1 migrato" : `${migrated} migrati`;
  return `almeno ${launches} lanci precedenti, ${m}`;
}

/** Storico del wallet dev: rug precedenti, lanci seriali e wallet appena creato sono forti segnali di rischio. */
export function checkDevWalletHistory(event: RawLaunchEvent): FilterCheck {
  const { previousRugs, walletAgeDays, previousLaunches, previousLaunchesMigrated } =
    event.devWalletHistory;

  if (previousRugs > 0) {
    return {
      id: "dev-wallet-history",
      passed: false,
      reason: `Dev con ${previousRugs} rug precedenti`,
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
        reason: `Dev seriale: ${launchesLabel(previousLaunches, previousLaunchesMigrated)}`,
        riskPoints: 25,
      };
    }
    if (previousLaunches >= REPEAT_LAUNCHES && previousLaunchesMigrated === 0) {
      return {
        id: "dev-wallet-history",
        passed: false,
        reason: `Dev con ${launchesLabel(previousLaunches, 0)}`,
        riskPoints: 12,
      };
    }
  }

  if (walletAgeDays < YOUNG_WALLET_DAYS) {
    return {
      id: "dev-wallet-history",
      passed: false,
      reason: `Wallet dev creato ${walletAgeDays} giorni fa (nessuno storico)`,
      riskPoints: 12,
    };
  }

  // I rug non sono verificabili on-chain in modo affidabile: non dichiarare "pulito".
  if (event.unverified?.includes("dev-rugs") || event.unverified?.includes("dev-launches")) {
    return {
      id: "dev-wallet-history",
      passed: false,
      reason: `Storico rug del dev non verificato (wallet attivo da ${walletAgeDays} giorni)`,
      riskPoints: 5,
    };
  }

  return {
    id: "dev-wallet-history",
    passed: true,
    reason: "Dev pulito",
    riskPoints: 0,
  };
}
