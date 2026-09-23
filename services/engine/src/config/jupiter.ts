import { JUPITER_PROGRAM_ID as SHARED_JUPITER_PROGRAM_ID, type SourceProgram } from "@seeker-signal/shared";

/**
 * Verificato sulla doc ufficiale Jupiter il 2026-09-24. Il flusso "classico"
 * quote+/swap (Metis) risulta deprecato ("no longer actively maintained,
 * superseded by Swap V2"). Fra i due percorsi di Swap V2:
 * - Meta-Aggregator (/order + /execute): fee piattaforma automatica e non
 *   configurabile (basata sulla coppia di token), più un fee referral
 *   opzionale ma con minimo 50bps e setup on-chain via referral program —
 *   non compatibile con le fee per-tier di CLAUDE.md (HOLDER 30bps < 50bps).
 * - Router (/build): "Jupiter does not charge swap fees" di suo; l'integratore
 *   passa `platformFeeBps` + `feeAccount` (un qualsiasi token account che
 *   controlla, non serve il referral program) e la fee finisce dentro la
 *   swap instruction. Fonte: https://developers.jup.ag/docs/swap/build/index.md
 * Usiamo /build: è l'unico che permette fee arbitrarie sotto il nostro
 * controllo, come descritto in CLAUDE.md.
 */
export const JUPITER_BUILD_ENDPOINT = "/swap/v2/build";

/** Program Jupiter Aggregator v6 su mainnet-beta (stessa costante di @seeker-signal/shared). */
export const JUPITER_PROGRAM_ID = SHARED_JUPITER_PROGRAM_ID;

/**
 * Jupiter instrada solo pool AMM, non i token ancora in bonding curve
 * (verificato: nessun routing diretto per pump.fun pre-migrazione; supporta
 * invece PumpSwap dopo la migrazione — "Jupiter Spot now supports trading of
 * tokens on PumpSwap"). Meteora DBC e Raydium LaunchLab sono anch'essi
 * meccanismi a bonding curve pre-migrazione: trattati allo stesso modo finché
 * non verificato il contrario.
 */
export const JUPITER_ROUTABLE_PROGRAMS: readonly SourceProgram[] = [
  "pumpswap",
  "meteora-damm",
];

export function isJupiterRoutable(program: SourceProgram): boolean {
  return JUPITER_ROUTABLE_PROGRAMS.includes(program);
}
