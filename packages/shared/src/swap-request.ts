import { z } from "zod";
import { pubkeySchema } from "./pubkey.js";

// Input di POST /build-swap: la transazione viene costruita fresca al momento
// della richiesta (blockhash e quote aggiornati), mai pre-costruita.
export const swapRequestSchema = z.object({
  signalId: z.string().uuid(),
  pubkey: pubkeySchema,
  amountSol: z.number().positive(),
  slippageBps: z.number().int().min(0).max(10_000),
});

export type SwapRequest = z.infer<typeof swapRequestSchema>;
