import type { RawLaunchEvent } from "../ingest/event-source.js";
import type { FilterCheck } from "./types.js";

const WARN_SNIPE_COUNT = 10;
const HIGH_SNIPE_COUNT = 20;

/** Wallet che comprano nei primissimi blocchi: spesso bot coordinati con il dev. */
export function checkSnipedWallets(event: RawLaunchEvent): FilterCheck {
  const { snipedWalletsCount } = event;

  if (event.unverified?.includes("snipes")) {
    return {
      id: "sniped-wallets",
      passed: false,
      reason: "Snipe nei primi blocchi non verificati",
      riskPoints: 0,
    };
  }

  if (snipedWalletsCount >= HIGH_SNIPE_COUNT) {
    return {
      id: "sniped-wallets",
      passed: false,
      reason: `Snipe di ${snipedWalletsCount} wallet nei primi blocchi`,
      riskPoints: 25,
    };
  }

  if (snipedWalletsCount >= WARN_SNIPE_COUNT) {
    return {
      id: "sniped-wallets",
      passed: false,
      reason: `Snipe di ${snipedWalletsCount} wallet nei primi blocchi`,
      riskPoints: 12,
    };
  }

  return {
    id: "sniped-wallets",
    passed: true,
    reason:
      snipedWalletsCount > 0
        ? `Snipe di ${snipedWalletsCount} wallet`
        : "Nessuno snipe rilevato",
    riskPoints: 0,
  };
}
