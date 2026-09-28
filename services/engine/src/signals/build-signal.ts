import { randomUUID } from "node:crypto";
import { type Signal, signalSchema } from "@seeker-signal/shared";
import { computeRiskReport } from "../filters/risk-report.js";
import type { RawLaunchEvent } from "../ingest/event-source.js";
import { buildSummary } from "./summarize.js";

/** Applica i filtri e la sintesi a un evento grezzo, producendo un Signal validato. */
export function buildSignal(event: RawLaunchEvent): Signal {
  const riskReport = computeRiskReport(event);

  const signal: Signal = {
    id: randomUUID(),
    createdAt: event.createdAt,
    program: event.program,
    tokenMint: event.tokenMint,
    poolAddress: event.poolAddress,
    ...(event.tokenSymbol !== undefined && { tokenSymbol: event.tokenSymbol }),
    ...(event.tokenName !== undefined && { tokenName: event.tokenName }),
    ...(event.imageUrl !== undefined && { imageUrl: event.imageUrl }),
    initialLiquiditySol: event.initialLiquiditySol,
    riskReport,
    summary: buildSummary(event, riskReport),
  };

  return signalSchema.parse(signal);
}
