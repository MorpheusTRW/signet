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
      // Senza analisi del lancio (bundle, sniper, dev buy) il token non è raccomandabile:
      // prima passava come "Low" solo perché non era stato controllato.
      reason: "Launch not analyzed (bundles, snipers, dev buy)",
      riskPoints: 70,
    };
  }

  if (snipedWalletsCount >= HIGH_SNIPE_COUNT) {
    return {
      id: "sniped-wallets",
      passed: false,
      reason: `${snipedWalletsCount} ${snipedWalletsCount === 1 ? "wallet" : "wallets"} sniped in the first blocks`,
      riskPoints: 25,
    };
  }

  if (snipedWalletsCount >= WARN_SNIPE_COUNT) {
    return {
      id: "sniped-wallets",
      passed: false,
      reason: `${snipedWalletsCount} ${snipedWalletsCount === 1 ? "wallet" : "wallets"} sniped in the first blocks`,
      riskPoints: 12,
    };
  }

  return {
    id: "sniped-wallets",
    passed: true,
    reason:
      snipedWalletsCount > 0
        ? `${snipedWalletsCount} ${snipedWalletsCount === 1 ? "wallet" : "wallets"} sniped`
        : "No snipes detected",
    riskPoints: 0,
  };
}
