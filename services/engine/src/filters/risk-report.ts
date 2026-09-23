import type { RiskReport } from "@seeker-signal/shared";
import type { RawLaunchEvent } from "../ingest/event-source.js";
import { checkAuthorities } from "./authorities.js";
import { checkDevWalletHistory } from "./dev-wallet-history.js";
import { checkInitialLiquidity } from "./initial-liquidity.js";
import { checkSnipedWallets } from "./sniped-wallets.js";
import { checkTopHolderConcentration } from "./top-holder-concentration.js";
import type { FilterCheck } from "./types.js";

const MEDIUM_THRESHOLD = 34;
const HIGH_THRESHOLD = 67;

export const RISK_FILTERS: ((event: RawLaunchEvent) => FilterCheck)[] = [
  checkTopHolderConcentration,
  checkDevWalletHistory,
  checkInitialLiquidity,
  checkSnipedWallets,
  checkAuthorities,
];

export function computeRiskReport(event: RawLaunchEvent): RiskReport {
  const checks = RISK_FILTERS.map((filter) => filter(event));

  const score = Math.min(
    100,
    checks.reduce((sum, check) => sum + check.riskPoints, 0),
  );

  const level = score >= HIGH_THRESHOLD
    ? "high"
    : score >= MEDIUM_THRESHOLD
      ? "medium"
      : "low";

  const failedReasons = checks.filter((c) => !c.passed).map((c) => c.reason);
  const reasons =
    failedReasons.length > 0
      ? failedReasons
      : ["Nessun segnale di rischio rilevato dai filtri"];

  return { score, level, reasons };
}
