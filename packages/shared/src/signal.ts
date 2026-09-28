import { z } from "zod";
import { pubkeySchema } from "./pubkey.js";
import { riskReportSchema } from "./risk-report.js";

// Program monitorati (vedi CLAUDE.md — services/engine).
export const sourceProgramSchema = z.enum([
  "pump-fun",
  "pumpswap",
  "meteora-dbc",
  "meteora-damm",
  "raydium-launchlab",
]);
export type SourceProgram = z.infer<typeof sourceProgramSchema>;

export const signalSchema = z.object({
  id: z.string().uuid(),
  createdAt: z.string().datetime(),
  program: sourceProgramSchema,
  tokenMint: pubkeySchema,
  poolAddress: pubkeySchema,
  tokenSymbol: z.string().optional(),
  tokenName: z.string().optional(),
  // Immagine del token dai metadati (https; IPFS riscritto su un gateway funzionante).
  imageUrl: z.string().url().startsWith("https://").max(512).optional(),
  initialLiquiditySol: z.number().nonnegative(),
  riskReport: riskReportSchema,
  // Sintesi deterministica generata da template (nessun LLM nel percorso critico).
  summary: z.string().min(1),
});

export type Signal = z.infer<typeof signalSchema>;
