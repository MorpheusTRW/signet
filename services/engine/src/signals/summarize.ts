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
  low: "Basso",
  medium: "Medio",
  high: "Alto",
};

function devClause(event: RawLaunchEvent): string {
  const { previousRugs, previousLaunches, previousLaunchesMigrated } = event.devWalletHistory;
  if (previousRugs > 0) return `Dev con ${previousRugs} rug precedenti`;
  if (event.unverified?.includes("dev-launches")) return "Storico dev non verificato";
  if (previousLaunchesMigrated !== undefined) {
    if (previousLaunches === 0) return "Nessun lancio precedente del dev trovato";
    const migrated = previousLaunchesMigrated === 1 ? "1 migrato" : `${previousLaunchesMigrated} migrati`;
    return `Dev con almeno ${previousLaunches} lanci, ${migrated}`;
  }
  if (event.unverified?.includes("dev-rugs")) return "Storico dev non verificato";
  return "Dev pulito";
}

function snipeClause(event: RawLaunchEvent): string {
  const { snipedWalletsCount } = event;
  if (event.unverified?.includes("snipes")) return "Snipe non verificati";
  return snipedWalletsCount > 0
    ? `Snipe di ${snipedWalletsCount} wallet`
    : "Nessuno snipe rilevato";
}

/**
 * Sintesi deterministica da template (nessun LLM nel percorso critico), es.:
 * "Nuova pool Meteora. Dev pulito. Snipe di 3 wallet. Rischio: Basso."
 */
export function buildSummary(
  event: RawLaunchEvent,
  riskReport: RiskReport,
): string {
  const programLabel = PROGRAM_LABELS[event.program];
  const riskLabel = RISK_LEVEL_LABELS[riskReport.level];

  return [
    `Nuova pool ${programLabel}.`,
    `${devClause(event)}.`,
    `${snipeClause(event)}.`,
    `Rischio: ${riskLabel}.`,
  ].join(" ");
}
