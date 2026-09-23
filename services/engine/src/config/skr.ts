/**
 * Indirizzi del token SKR e del programma di staking, verificati sulla
 * documentazione ufficiale Solana Mobile il 2026-09-23.
 *
 * Fonti:
 * - Mint SKR e tabella "Program addresses" (Staking Program, Stake Config,
 *   Stake Vault, Guardian Pool):
 *   https://docs.solanamobile.com/solana-mobile-stack/skr.md
 * - Staking Program ID confermato in modo incrociato dal post ufficiale
 *   @solanamobile: https://x.com/solanamobile/status/2013796419778511231
 * - Layout account (`UserStake`, `StakeConfig`) e seed della PDA `user_stake`
 *   (["user_stake", stake_config, user, guardian_pool]) dall'IDL Anchor
 *   pubblico del programma, incluso nel sample ufficiale:
 *   https://github.com/solana-mobile/react-native-samples/tree/main/skr-staking
 *   (file `program/idl.json`).
 *
 * Lo stake è quindi leggibile on-chain (getProgramAccounts con filtro sul
 * campo `user`, decodifica manuale del layout `UserStake`/`StakeConfig`), ma
 * la doc pubblica non fornisce un client-lib pronta all'uso: il sample
 * ufficiale genera il client via Codama dall'IDL. Qui decodifichiamo i campi
 * necessari a mano, seguendo esattamente l'ordine e le dimensioni dei campi
 * dell'IDL (vedi entitlements/skr-holder.ts).
 */
export const SKR_MINT = "SKRbvo6Gf7GondiT3BbTfuRDPqLWei4j2Qy2NPGZhW3";
export const SKR_STAKING_PROGRAM_ID = "SKRskrmtL83pcL4YqLWt6iPefDqwXQWHSw9S9vz94BZ";
export const SKR_STAKE_CONFIG_ADDRESS = "4HQy82s9CHTv1GsYKnANHMiHfhcqesYkK6sB3RDSYyqw";

/** Discriminatore Anchor (8 byte) dell'account `UserStake`, dall'IDL. */
export const USER_STAKE_DISCRIMINATOR = Buffer.from([
  102, 53, 163, 107, 9, 138, 87, 153,
]);

/** Scala del `share_price` in StakeConfig ("scaled, e.g., 1e9" nell'IDL). */
export const SHARE_PRICE_SCALE = 1_000_000_000n;
