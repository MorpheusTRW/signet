import type { RiskReport, SourceProgram } from "@seeker-signal/shared";
import type { RawLaunchEvent } from "../ingest/event-source.js";

const PROGRAM_LABELS: Record<SourceProgram, string> = {
  "pump-fun": "pump.fun",
  pumpswap: "PumpSwap",
  "meteora-dbc": "Meteora",
  "meteora-damm": "Meteora",
  "raydium-launchlab": "Raydium LaunchLab",
};

const RISK_LEVEL_LABELS: Record<RiskReport["level"], string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

function devClause(event: RawLaunchEvent): string {
  const { previousRugs, previousLaunches, previousLaunchesMigrated } = event.devWalletHistory;
  if (previousRugs > 0) return `Dev with ${previousRugs} previous rugs`;
  if (event.unverified?.includes("dev-launches")) return "Dev history unverified";
  if (previousLaunchesMigrated !== undefined) {
    if (previousLaunches === 0) return "No previous dev launches found";
    const launches = previousLaunches === 1 ? "1 launch" : `${previousLaunches} launches`;
    return `Dev: at least ${launches}, ${previousLaunchesMigrated} migrated`;
  }
  if (event.unverified?.includes("dev-rugs")) return "Dev history unverified";
  return "Clean dev";
}

function snipeClause(event: RawLaunchEvent): string {
  const { snipedWalletsCount } = event;
  if (event.unverified?.includes("snipes")) return "Snipes unverified";
  return snipedWalletsCount > 0
    ? `${snipedWalletsCount} ${snipedWalletsCount === 1 ? "wallet" : "wallets"} sniped`
    : "No snipes detected";
}

/** I fattori di rischio più forti emersi dal backtest vanno in testa alla sintesi. */
function launchClauses(event: RawLaunchEvent): string[] {
  const clauses: string[] = [];
  if (event.launch && event.launch.minutesToMigrate <= 2) {
    clauses.push(`Migrated ${event.launch.minutesToMigrate} min after launch.`);
  }
  if (event.launch && event.launch.bundlePct >= 10) {
    clauses.push(`Bundle ${event.launch.bundlePct}% at launch.`);
  }
  return clauses;
}

/**
 * Sintesi deterministica da template (nessun LLM nel percorso critico), es.:
 * "New Meteora pool. Clean dev. 3 wallets sniped. Risk: Low."
 */
export function buildSummary(
  event: RawLaunchEvent,
  riskReport: RiskReport,
): string {
  const programLabel = PROGRAM_LABELS[event.program];
  const riskLabel = RISK_LEVEL_LABELS[riskReport.level];

  return [
    `New ${programLabel} pool.`,
    ...launchClauses(event),
    `${devClause(event)}.`,
    `${snipeClause(event)}.`,
    `Risk: ${riskLabel}.`,
  ].join(" ");
}
