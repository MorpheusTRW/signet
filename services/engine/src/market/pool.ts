import type { RpcCall } from "../ingest/helius/rpc.js";

/**
 * Prezzo reale di un token letto direttamente dalla pool on-chain (nessun servizio
 * terzo): rapporto fra i saldi dei due vault della pool PumpSwap (token base e wSOL).
 */
export interface PoolVaults {
  baseVault: string;
  quoteVault: string;
}

export interface PoolReserves {
  /** Token nel vault base (unità UI). */
  base: number;
  /** SOL nel vault quote. */
  quote: number;
}

interface ParsedTokenAccount {
  data: { parsed?: { info?: { tokenAmount?: { uiAmountString?: string } } } };
}

const MAX_ACCOUNTS_PER_CALL = 100;

/**
 * Riserve correnti per ogni pool. `null` = pool chiusa o vault vuoto (liquidità
 * ritirata): per chi detiene il token equivale a valore zero.
 * Lancia se l'RPC fallisce: meglio non registrare nulla che registrare un dato falso.
 */
export async function readPoolReserves(rpc: RpcCall, pools: PoolVaults[]): Promise<(PoolReserves | null)[]> {
  const keys = pools.flatMap((p) => [p.baseVault, p.quoteVault]);
  const accounts: (ParsedTokenAccount | null)[] = [];
  for (let i = 0; i < keys.length; i += MAX_ACCOUNTS_PER_CALL) {
    const result = await rpc<{ value: (ParsedTokenAccount | null)[] }>("getMultipleAccounts", [
      keys.slice(i, i + MAX_ACCOUNTS_PER_CALL),
      { encoding: "jsonParsed", commitment: "confirmed" },
    ]);
    accounts.push(...result.value);
  }
  const amount = (account: ParsedTokenAccount | null | undefined): number | null => {
    const raw = account?.data.parsed?.info?.tokenAmount?.uiAmountString;
    return raw === undefined ? null : Number(raw);
  };
  return pools.map((_, index) => {
    const base = amount(accounts[index * 2]);
    const quote = amount(accounts[index * 2 + 1]);
    if (base === null || quote === null || base <= 0 || quote <= 0) return null;
    return { base, quote };
  });
}

/** Prezzo spot in SOL per token. */
export function spotPriceSol(reserves: PoolReserves): number {
  return reserves.quote / reserves.base;
}

/**
 * Fill simulato a prodotto costante (x·y=k) sulle riserve reali: include l'impatto
 * sul prezzo della propria size. Le fee della pool non sono incluse (stima leggermente
 * ottimistica, dichiarata nell'app come "simulazione").
 */
export function simulateBuy(reserves: PoolReserves, solIn: number): number {
  return (reserves.base * solIn) / (reserves.quote + solIn);
}

export function simulateSell(reserves: PoolReserves, tokensIn: number): number {
  return (reserves.quote * tokensIn) / (reserves.base + tokensIn);
}
