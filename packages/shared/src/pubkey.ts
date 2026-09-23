import { z } from "zod";

// Formato base58 di una chiave pubblica Solana (32 byte -> 32-44 caratteri base58).
const BASE58_PUBKEY_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export const pubkeySchema = z
  .string()
  .regex(BASE58_PUBKEY_REGEX, "Pubkey Solana non valida (base58)");

export type Pubkey = z.infer<typeof pubkeySchema>;
