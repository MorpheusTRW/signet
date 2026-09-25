import { NATIVE_MINT } from "@solana/spl-token";
import bs58 from "bs58";
import { PROGRAM_IDS } from "../../config/programs.js";

/**
 * Discriminator dell'istruzione `create_pool` di PumpSwap, dall'IDL ufficiale
 * (github.com/pump-fun/pump-public-docs, idl/pump_amm.json, verificato 2026-09-25).
 */
const CREATE_POOL_DISCRIMINATOR = Buffer.from([233, 146, 209, 142, 207, 104, 64, 188]);

// Indici degli account di create_pool secondo lo stesso IDL.
const ACC_POOL = 0;
const ACC_BASE_MINT = 3;
const ACC_QUOTE_MINT = 4;
const ACC_POOL_BASE_TOKEN_ACCOUNT = 9;

/** Subset di `getTransaction` (encoding "json") che serve al parsing. */
export interface RawTransaction {
  blockTime: number | null;
  transaction: {
    message: {
      accountKeys: string[];
      instructions: RawInstruction[];
    };
  };
  meta: {
    err: unknown;
    innerInstructions: { index: number; instructions: RawInstruction[] }[] | null;
    loadedAddresses?: { writable: string[]; readonly: string[] };
  } | null;
}

export interface RawInstruction {
  programIdIndex: number;
  accounts: number[];
  data: string;
}

export interface ParsedCreatePool {
  pool: string;
  tokenMint: string;
  /** Token account (vault) della pool che detiene il token base: da escludere dai top holder. */
  poolBaseVault: string;
  coinCreator: string;
  initialLiquiditySol: number;
  blockTime: number | null;
}

const U16 = 2;
const U64 = 8;
const PUBKEY = 32;

/**
 * Cerca (fra istruzioni esterne e inner/CPI: la migrazione pump.fun → PumpSwap
 * arriva come CPI) un `create_pool` di PumpSwap con quote wSOL e ne estrae i dati.
 * Layout degli argomenti (IDL): index u16, base_amount_in u64, quote_amount_in u64,
 * coin_creator pubkey. Ritorna null se la tx non contiene una pool SOL nuova.
 */
export function parseCreatePool(tx: RawTransaction): ParsedCreatePool | null {
  if (!tx.meta || tx.meta.err) return null;

  const keys = [
    ...tx.transaction.message.accountKeys,
    ...(tx.meta.loadedAddresses?.writable ?? []),
    ...(tx.meta.loadedAddresses?.readonly ?? []),
  ];
  const instructions = [
    ...tx.transaction.message.instructions,
    ...(tx.meta.innerInstructions ?? []).flatMap((inner) => inner.instructions),
  ];

  for (const ix of instructions) {
    if (keys[ix.programIdIndex] !== PROGRAM_IDS.pumpswap) continue;
    const data = Buffer.from(bs58.decode(ix.data));
    if (!data.subarray(0, 8).equals(CREATE_POOL_DISCRIMINATOR)) continue;
    if (data.length < 8 + U16 + U64 + U64 + PUBKEY) continue;

    const account = (i: number): string | undefined => {
      const index = ix.accounts[i];
      return index === undefined ? undefined : keys[index];
    };
    const pool = account(ACC_POOL);
    const baseMint = account(ACC_BASE_MINT);
    const quoteMint = account(ACC_QUOTE_MINT);
    const poolBaseVault = account(ACC_POOL_BASE_TOKEN_ACCOUNT);
    if (!pool || !baseMint || !quoteMint || !poolBaseVault) continue;

    // Solo pool con quote wSOL: la liquidità è espressa in SOL e Jupiter/`/build-swap` partono da SOL.
    if (quoteMint !== NATIVE_MINT.toBase58()) continue;

    const quoteAmountIn = data.readBigUInt64LE(8 + U16 + U64);
    const coinCreator = bs58.encode(data.subarray(8 + U16 + U64 + U64, 8 + U16 + U64 + U64 + PUBKEY));

    return {
      pool,
      tokenMint: baseMint,
      poolBaseVault,
      coinCreator,
      initialLiquiditySol: Number(quoteAmountIn) / 1_000_000_000,
      blockTime: tx.blockTime,
    };
  }
  return null;
}
