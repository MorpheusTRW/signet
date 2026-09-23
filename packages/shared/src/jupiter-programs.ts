import { ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { ComputeBudgetProgram, SystemProgram } from "@solana/web3.js";

/**
 * Program ID Jupiter Aggregator v6 su mainnet-beta. Verificato sulla doc
 * ufficiale (developers.jup.ag) e confermato dal vivo: appare come
 * `swapInstruction.programId` in una risposta reale di
 * GET https://api.jup.ag/swap/v2/build (verificato 2026-09-24).
 */
export const JUPITER_PROGRAM_ID = "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4";

/**
 * Allowlist minima per una transazione di swap costruita da Jupiter /build:
 * oltre al program Jupiter stesso, una tx reale include sempre (verificato
 * dal vivo) System Program (wrap/unwrap SOL), Associated Token Program
 * (creazione ATA) e Token Program (transfer/close). ComputeBudget imposta il
 * prezzo delle compute unit. Gli ultimi quattro sono costanti stabili delle
 * librerie ufficiali, non stringhe indovinate.
 */
export const JUPITER_SWAP_ALLOWED_PROGRAMS: readonly string[] = [
  JUPITER_PROGRAM_ID,
  SystemProgram.programId.toBase58(),
  ComputeBudgetProgram.programId.toBase58(),
  TOKEN_PROGRAM_ID.toBase58(),
  ASSOCIATED_TOKEN_PROGRAM_ID.toBase58(),
];
