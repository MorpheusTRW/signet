/**
 * Backtest dei filtri su migrazioni pump.fun → PumpSwap reali e recenti.
 * Per ogni migrazione: metriche del lancio (come le calcola l'engine) + esito,
 * cioè prezzo attuale (DexScreener) rispetto al prezzo alla migrazione.
 *
 * Uso: pnpm tsx --env-file=../../.env scripts/backtest-migrations.ts [maxTokens] [minAgeMin]
 * Costo: ~2 chiamate Enhanced (200 crediti) + ~10 RPC per token.
 */
import { writeFileSync } from "node:fs";
import { fetchMintInfo, fetchTopHolderPercentages } from "../src/ingest/helius/enrich.js";
import { PUMP_WITHDRAW_AUTHORITY } from "../src/ingest/helius/helius-event-source.js";
import {
  analyzeLaunch,
  bondingCurveAddress,
  countMigrated,
  createEnhancedApi,
  launchedMints,
} from "../src/ingest/helius/history.js";
import { parseCreatePool, type RawTransaction } from "../src/ingest/helius/parse-create-pool.js";
import { createRpcCall } from "../src/ingest/helius/rpc.js";

const key = process.env.HELIUS_API_KEY;
if (!key) throw new Error("HELIUS_API_KEY mancante");
const maxTokens = Number(process.argv[2] ?? 60);
const minAgeMin = Number(process.argv[3] ?? 90);

const rawRpc = createRpcCall(`https://mainnet.helius-rpc.com/?api-key=${key}`);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
// Piano gratuito: 10 richieste/s. Serializza con una piccola pausa e riprova sui 429.
const rpc = (async <T>(method: string, params: unknown[]): Promise<T> => {
  for (let attempt = 0; ; attempt++) {
    await sleep(130);
    try {
      return await rawRpc<T>(method, params);
    } catch (error) {
      if (attempt < 4 && String(error).includes("429")) { await sleep(1500 * (attempt + 1)); continue; }
      throw error;
    }
  }
}) as typeof rawRpc;
const enhancedRaw = createEnhancedApi(key);
const enhanced: typeof enhancedRaw = async (a, q) => { await sleep(250); return enhancedRaw(a, q); };

async function walletFirstSeen(wallet: string): Promise<number | null> {
  let before: string | undefined;
  let oldest: number | null = null;
  for (let page = 0; page < 3; page++) {
    const sigs = await rpc<{ signature: string; blockTime: number | null }[]>("getSignaturesForAddress", [
      wallet, { limit: 1000, ...(before && { before }) },
    ]);
    const last = sigs[sigs.length - 1];
    if (!last) break;
    oldest = last.blockTime; before = last.signature;
    if (sigs.length < 1000) break;
  }
  return oldest;
}

async function main() {
  const now = Date.now() / 1000;
  const sigs = await rpc<{ signature: string; blockTime: number; err: unknown }[]>("getSignaturesForAddress", [
    PUMP_WITHDRAW_AUTHORITY, { limit: 1000 },
  ]);
  const candidates = sigs.filter((s) => !s.err && now - s.blockTime > minAgeMin * 60);
  console.error(`firme: ${sigs.length}, candidate (ok, più vecchie di ${minAgeMin} min): ${candidates.length}`);

  const rows: Record<string, unknown>[] = [];
  for (const s of candidates) {
    if (rows.length >= maxTokens) break;
    const tx = await rpc<RawTransaction | null>("getTransaction", [s.signature, { encoding: "json", maxSupportedTransactionVersion: 1 }]);
    const pool = tx && parseCreatePool(tx);
    if (!pool) continue;
    try {
      const mint = await fetchMintInfo(rpc, pool.tokenMint);
      if (!mint) continue;
      const supply = Number(mint.supplyRaw) / 10 ** mint.decimals;
      const bc = bondingCurveAddress(pool.tokenMint);
      const first = await enhanced(bc, { "sort-order": "asc", limit: "40" });
      const launch = analyzeLaunch(first, { mint: pool.tokenMint, bondingCurve: bc, creator: pool.coinCreator, supply });
      if (!launch) continue;
      const creates = await enhanced(pool.coinCreator, { type: "CREATE", limit: "100", "lt-slot": String(launch.createSlot) });
      const prevMints = launchedMints(creates, pool.coinCreator).filter((m) => m !== pool.tokenMint);
      const prevMigrated = await countMigrated(rpc, prevMints);
      const devFirstSeen = await walletFirstSeen(pool.coinCreator);
      const top = await fetchTopHolderPercentages(rpc, pool.tokenMint, mint.supplyRaw, [pool.poolBaseVault]);
      const migrationPrice = pool.initialLiquiditySol / (Number(pool.initialTokenAmountRaw) / 10 ** mint.decimals);
      rows.push({
        mint: pool.tokenMint, symbol: mint.symbol ?? "",
        migratedAt: pool.blockTime, liquiditySol: Number(pool.initialLiquiditySol.toFixed(2)),
        minutesToMigrate: Math.round(((pool.blockTime ?? 0) - launch.createTime) / 60),
        devFundedSecBeforeLaunch: devFirstSeen ? launch.createTime - devFirstSeen : null,
        prevLaunches: prevMints.length, prevMigrated,
        devBuyPct: launch.devBuyPct, bundleWallets: launch.bundleWallets, bundlePct: launch.bundlePct,
        snipers: launch.snipers, snipersPct: launch.snipersPct, linkedWallets: launch.linkedWallets,
        top10PctNow: Number(top.reduce((a, b) => a + b, 0).toFixed(1)),
        migrationPrice,
      });
      console.error(`${rows.length}. ${mint.symbol ?? pool.tokenMint.slice(0, 6)} bundle ${launch.bundlePct}% dev ${launch.devBuyPct}%`);
    } catch (error) {
      console.error("skip", pool.tokenMint, String(error).slice(0, 120));
    }
  }

  // Esito: prezzo attuale in SOL (DexScreener, batch da 30).
  for (let i = 0; i < rows.length; i += 30) {
    const batch = rows.slice(i, i + 30);
    const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${batch.map((r) => r.mint).join(",")}`);
    const json = (await res.json()) as { pairs?: { baseToken: { address: string }; priceNative: string; liquidity?: { usd?: number } }[] };
    for (const row of batch) {
      const pairs = (json.pairs ?? []).filter((p) => p.baseToken.address === row.mint);
      const best = pairs.sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))[0];
      row.priceRatioNow = best ? Number((Number(best.priceNative) / (row.migrationPrice as number)).toFixed(3)) : null;
      row.ageMin = Math.round((now - (row.migratedAt as number)) / 60);
    }
  }
  const out = new URL("../data/backtest.json", import.meta.url);
  writeFileSync(out, JSON.stringify(rows, null, 1));
  console.error(`salvati ${rows.length} token in ${out.pathname}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
