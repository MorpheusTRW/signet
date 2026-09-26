import { PublicKey } from "@solana/web3.js";
import { PROGRAM_IDS } from "../../config/programs.js";
import type { RpcCall } from "./rpc.js";

/**
 * Storico di un token pump.fun e del suo dev tramite la Enhanced Transactions API
 * di Helius (`GET /v0/addresses/{address}/transactions`, verificata dal vivo il
 * 2026-09-26: supporta `sort-order=asc`, `type=CREATE`, `lt-slot`). Costa 100
 * crediti a chiamata: qui ne servono 2 per segnale.
 */

/** Sottoinsieme della risposta Enhanced Transactions usato qui. */
export interface EnhancedTransaction {
  signature: string;
  slot: number;
  type: string;
  source: string;
  feePayer: string;
  /** Unix seconds. */
  timestamp?: number;
  transactionError: unknown;
  tokenTransfers: {
    fromUserAccount: string | null;
    toUserAccount: string | null;
    mint: string;
    tokenAmount: number;
  }[];
}

export type EnhancedApi = (address: string, query: Record<string, string>) => Promise<EnhancedTransaction[]>;

export function createEnhancedApi(apiKey: string, fetchImpl: typeof fetch = fetch): EnhancedApi {
  return async (address, query) => {
    const params = new URLSearchParams({ "api-key": apiKey, ...query });
    const response = await fetchImpl(
      `https://api-mainnet.helius-rpc.com/v0/addresses/${address}/transactions?${params}`,
    );
    if (!response.ok) throw new Error(`Enhanced Transactions -> HTTP ${response.status}`);
    const json: unknown = await response.json();
    if (!Array.isArray(json)) throw new Error("Enhanced Transactions: risposta inattesa");
    return json as EnhancedTransaction[];
  };
}

const PUMP_PROGRAM = new PublicKey(PROGRAM_IDS["pump-fun"]);

/** PDA della bonding curve pump.fun: seeds ["bonding-curve", mint] (IDL ufficiale, idl/pump.json). */
export function bondingCurveAddress(mint: string): string {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("bonding-curve"), new PublicKey(mint).toBuffer()],
    PUMP_PROGRAM,
  );
  return pda.toBase58();
}

/** Slot dopo la creazione (incluso quello di creazione + i successivi) considerati "primi blocchi". */
export const SNIPE_WINDOW_SLOTS = 3;
const FIRST_TXS_LIMIT = 40;

export interface LaunchAnalysis {
  createSlot: number;
  /** Unix seconds della tx di creazione. */
  createTime: number;
  /** Wallet distinti (escluso il dev) che ricevono il token entro SNIPE_WINDOW_SLOTS. */
  snipers: number;
  /** % supply comprata dagli sniper (escluso il dev) entro SNIPE_WINDOW_SLOTS. */
  snipersPct: number;
  /** Wallet (escluso il dev) che comprano nello STESSO slot della creazione: solo un bundle concordato col dev ci riesce. */
  bundleWallets: number;
  bundlePct: number;
  /** % supply ricevuta dal dev nello slot di creazione (dev buy). */
  devBuyPct: number;
  /** Destinatari degli acquisti iniziali la cui fee è pagata da un altro wallet (stesso operatore dietro più wallet). */
  linkedWallets: number;
  /** Destinatari degli acquisti iniziali (escluso il dev): servono per controllare quanto detengono ancora. */
  earlyBuyers: string[];
}

/**
 * Metriche del lancio dalle prime tx della bonding curve (ordine crescente).
 * Si usa il destinatario del token e non il fee payer: i bot pagano spesso le fee da
 * un wallet diverso da quello che riceve (e questo stesso fatto li collega fra loro).
 * Pura, testata su dati reali.
 */
export function analyzeLaunch(
  txs: EnhancedTransaction[],
  params: { mint: string; bondingCurve: string; creator: string; supply: number },
): LaunchAnalysis | null {
  const create = txs.find((tx) => tx.type === "CREATE" && !tx.transactionError);
  if (!create || params.supply <= 0) return null;

  const early = new Map<string, number>();
  const bundle = new Map<string, number>();
  const linked = new Set<string>();
  let devBuy = 0;

  for (const tx of txs) {
    if (tx.transactionError || tx.slot > create.slot + SNIPE_WINDOW_SLOTS) continue;
    for (const transfer of tx.tokenTransfers) {
      const to = transfer.toUserAccount;
      if (transfer.mint !== params.mint || transfer.fromUserAccount !== params.bondingCurve || !to) continue;
      if (to === params.creator) {
        if (tx.slot === create.slot) devBuy += transfer.tokenAmount;
        continue;
      }
      early.set(to, (early.get(to) ?? 0) + transfer.tokenAmount);
      if (tx.slot === create.slot) bundle.set(to, (bundle.get(to) ?? 0) + transfer.tokenAmount);
      if (tx.feePayer !== to) linked.add(to);
    }
  }

  const pct = (amount: number) => Number(((amount / params.supply) * 100).toFixed(2));
  const sum = (m: Map<string, number>) => [...m.values()].reduce((a, b) => a + b, 0);
  return {
    createSlot: create.slot,
    createTime: create.timestamp ?? 0,
    snipers: early.size,
    snipersPct: pct(sum(early)),
    bundleWallets: bundle.size,
    bundlePct: pct(sum(bundle)),
    devBuyPct: pct(devBuy),
    linkedWallets: linked.size,
    earlyBuyers: [...early.keys()],
  };
}

/** Mint creati dal dev nelle tx CREATE di pump.fun (il token che il dev riceve dalla sua bonding curve). */
export function launchedMints(txs: EnhancedTransaction[], creator: string): string[] {
  const mints = new Set<string>();
  for (const tx of txs) {
    if (tx.type !== "CREATE" || tx.source !== "PUMP_FUN" || tx.transactionError) continue;
    const mint =
      tx.tokenTransfers.find((t) => t.toUserAccount === creator)?.mint ?? tx.tokenTransfers[0]?.mint;
    if (mint) mints.add(mint);
  }
  return [...mints];
}

/** Offset del campo `complete` nell'account BondingCurve: discriminator(8) + 5 × u64 (IDL ufficiale). */
const COMPLETE_OFFSET = 48;

export async function countMigrated(rpc: RpcCall, mints: string[]): Promise<number> {
  if (mints.length === 0) return 0;
  const result = await rpc<{ value: ({ data: [string, string] } | null)[] }>("getMultipleAccounts", [
    mints.map(bondingCurveAddress),
    { encoding: "base64", dataSlice: { offset: COMPLETE_OFFSET, length: 1 }, commitment: "confirmed" },
  ]);
  return result.value.filter((account) => account && Buffer.from(account.data[0], "base64")[0] === 1)
    .length;
}

/** Tetto giornaliero di chiamate Enhanced (100 crediti l'una) per non esaurire il piano Helius. */
export class DailyBudget {
  private day = "";
  private used = 0;

  constructor(
    private readonly limit: number,
    private readonly now: () => number = Date.now,
  ) {}

  tryConsume(calls: number): boolean {
    const today = new Date(this.now()).toISOString().slice(0, 10);
    if (today !== this.day) {
      this.day = today;
      this.used = 0;
    }
    if (this.used + calls > this.limit) return false;
    this.used += calls;
    return true;
  }
}

export interface TokenHistory {
  launch?: LaunchAnalysis;
  previousLaunches?: number;
  previousLaunchesMigrated?: number;
}

/**
 * Analisi del lancio + lanci precedenti del dev (solo quelli creati prima di questo token).
 * Ogni parte che fallisce resta semplicemente assente: il chiamante la marca "non verificata".
 * I lanci trovati sono un minimo: l'API filtra per tipo su una finestra di tx e può
 * restituire meno risultati di quelli esistenti.
 */
export async function fetchTokenHistory(
  deps: { enhanced: EnhancedApi; rpc: RpcCall; budget: DailyBudget },
  params: { mint: string; creator: string; supply: number },
): Promise<TokenHistory> {
  if (!deps.budget.tryConsume(2)) return {};
  const bondingCurve = bondingCurveAddress(params.mint);

  let launch: LaunchAnalysis | null = null;
  try {
    const firstTxs = await deps.enhanced(bondingCurve, {
      "sort-order": "asc",
      limit: String(FIRST_TXS_LIMIT),
    });
    launch = analyzeLaunch(firstTxs, { ...params, bondingCurve });
  } catch {
    launch = null;
  }
  // Senza lo slot di creazione non si possono separare i lanci precedenti da questo.
  if (!launch) return {};

  try {
    const creates = await deps.enhanced(params.creator, {
      type: "CREATE",
      limit: "100",
      "lt-slot": String(launch.createSlot),
    });
    const mints = launchedMints(creates, params.creator).filter((m) => m !== params.mint);
    const migrated = await countMigrated(deps.rpc, mints);
    return { launch, previousLaunches: mints.length, previousLaunchesMigrated: migrated };
  } catch {
    return { launch };
  }
}
