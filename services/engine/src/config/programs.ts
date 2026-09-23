import type { SourceProgram } from "@seeker-signal/shared";

/**
 * Program ID reali su Solana mainnet-beta, verificati sulla documentazione
 * ufficiale (o repo ufficiale del progetto) il 2026-09-23. Anche se in F1
 * l'ingest usa solo l'adapter `synthetic`, questi ID sono la base per gli
 * adapter on-chain (`helius-ws`, `yellowstone-grpc`) di F5 — vanno
 * ri-verificati prima di quell'uso, i program possono essere aggiornati.
 *
 * Fonti:
 * - pump.fun: https://docs.solanatracker.io/guides/pumpfun-program (ID citato
 *   in modo consistente anche da IDL/tooling di terze parti)
 * - PumpSwap: https://docs.solanatracker.io/guides/pumpfun-amm
 * - Meteora DBC: https://docs.meteora.ag/developer-guides/dbc (doc ufficiale)
 * - Meteora DAMM v2: https://github.com/MeteoraAg/damm-v2 (repo ufficiale,
 *   sezione Deployments)
 * - Raydium LaunchLab: doc ufficiale su https://docs.raydium.io/products/launchlab
 *   rimanda a reference/program-addresses (non raggiungibile al momento della
 *   verifica); ID confermato in modo incrociato da più integrazioni di terze
 *   parti indipendenti (Shyft, Bitquery, Chainstack). Ri-verificare sulla doc
 *   Raydium primaria prima dell'uso on-chain in F5.
 */
export const PROGRAM_IDS: Record<SourceProgram, string> = {
  "pump-fun": "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P",
  pumpswap: "pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA",
  "meteora-dbc": "dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN",
  "meteora-damm": "cpamdpZCGKUy5JxQXB4dcpGPiikHawvSWAd6mEn1sGG",
  "raydium-launchlab": "LanMV9sAd7wArD4vJFi2qDdfnVhFxYSUg6eADduJ3uj",
};

export const MONITORED_PROGRAMS: SourceProgram[] = Object.keys(
  PROGRAM_IDS,
) as SourceProgram[];
