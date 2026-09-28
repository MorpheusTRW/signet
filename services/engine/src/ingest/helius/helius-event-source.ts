import WebSocket from "ws";
import type { EventSource, LaunchPattern, RawLaunchEvent, UnverifiedAspect } from "../event-source.js";
import { fetchMintInfo, fetchTopHolderPercentages, fetchWalletFirstSeen, walletAgeDays } from "./enrich.js";
import { type DailyBudget, type EnhancedApi, fetchTokenHistory, type TokenHistory } from "./history.js";
import { parseCreatePool, type RawTransaction } from "./parse-create-pool.js";
import { fetchTokenImage } from "./token-image.js";
import type { RpcCall } from "./rpc.js";

/**
 * Wallet `withdraw_authority` di pump.fun: firma ogni `migrate` (bonding curve →
 * PumpSwap) e compare solo lì, quindi `logsSubscribe` su questo indirizzo dà un
 * flusso a basso volume di sole migrazioni. Letto on-chain dal campo
 * `withdraw_authority` dell'account Global del program pump.fun (PDA seed "global")
 * il 2026-09-25 — se pump.fun lo ruota, va riletto da lì.
 */
export const PUMP_WITHDRAW_AUTHORITY = "39azUYFWPz3VHgKCf3VChUwbpURdCHRxjWVowf5jUJjg";

const KEEPALIVE_MS = 60_000; // la doc Helius raccomanda un ping almeno ogni minuto (timeout inattività 10 min)
const RECONNECT_MIN_MS = 1_000;
const RECONNECT_MAX_MS = 30_000;
const TX_FETCH_ATTEMPTS = 4;
const TX_FETCH_DELAY_MS = 1_500;
const MAX_SEEN = 2_000;

export interface Logger {
  info(obj: object, msg: string): void;
  warn(obj: object, msg: string): void;
}

export interface HeliusEventSourceOptions {
  wsUrl: string;
  rpc: RpcCall;
  logger: Logger;
  /** Storico snipe/dev (Enhanced Transactions). Se assente, quegli aspetti restano non verificati. */
  history?: { enhanced: EnhancedApi; budget: DailyBudget };
  /** Iniettabili nei test. */
  createWebSocket?: (url: string) => WebSocket;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
}

interface LogsNotification {
  method?: string;
  params?: {
    result?: { value?: { signature: string; err: unknown; logs: string[] | null } };
  };
}

/**
 * Adapter `helius-ws`: sottoscrive `logsSubscribe` (mentions = wallet di
 * migrazione pump.fun), per ogni migrazione riuscita legge la tx, ne estrae la
 * pool PumpSwap creata (instradabile da Jupiter) e la arricchisce con dati
 * on-chain per i filtri di rischio.
 */
export class HeliusEventSource implements EventSource {
  private ws: WebSocket | undefined;
  private stopped = true;
  private keepalive: NodeJS.Timeout | undefined;
  private reconnectTimer: NodeJS.Timeout | undefined;
  private reconnectDelay = RECONNECT_MIN_MS;
  private readonly seen = new Set<string>();
  private onEvent: ((event: RawLaunchEvent) => void) | undefined;

  private readonly createWebSocket: (url: string) => WebSocket;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly now: () => number;

  constructor(private readonly options: HeliusEventSourceOptions) {
    this.createWebSocket = options.createWebSocket ?? ((url) => new WebSocket(url));
    this.sleep = options.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
    this.now = options.now ?? Date.now;
  }

  start(onEvent: (event: RawLaunchEvent) => void): void {
    this.onEvent = onEvent;
    this.stopped = false;
    this.connect();
  }

  stop(): void {
    this.stopped = true;
    clearInterval(this.keepalive);
    clearTimeout(this.reconnectTimer);
    this.ws?.removeAllListeners();
    this.ws?.close();
    this.ws = undefined;
  }

  private connect(): void {
    const ws = this.createWebSocket(this.options.wsUrl);
    this.ws = ws;

    ws.on("open", () => {
      this.reconnectDelay = RECONNECT_MIN_MS;
      ws.send(
        JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "logsSubscribe",
          params: [{ mentions: [PUMP_WITHDRAW_AUTHORITY] }, { commitment: "confirmed" }],
        }),
      );
      this.keepalive = setInterval(() => ws.ping(), KEEPALIVE_MS);
      this.keepalive.unref?.();
      this.options.logger.info({}, "helius-ws connesso, in ascolto delle migrazioni pump.fun");
    });

    ws.on("message", (raw) => {
      this.handleMessage(raw.toString()).catch((error: unknown) => {
        this.options.logger.warn({ err: error }, "helius-ws: errore nel gestire un messaggio");
      });
    });

    ws.on("error", (error) => {
      this.options.logger.warn({ err: error }, "helius-ws: errore socket");
    });

    ws.on("close", () => {
      clearInterval(this.keepalive);
      if (this.stopped) return;
      this.options.logger.warn({ retryInMs: this.reconnectDelay }, "helius-ws chiuso, riconnessione");
      this.reconnectTimer = setTimeout(() => this.connect(), this.reconnectDelay);
      this.reconnectTimer.unref?.();
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, RECONNECT_MAX_MS);
    });
  }

  /** Esposto per i test: elabora un singolo messaggio del WebSocket. */
  async handleMessage(raw: string): Promise<void> {
    const message = JSON.parse(raw) as LogsNotification;
    if (message.method !== "logsNotification") return;
    const value = message.params?.result?.value;
    if (!value || value.err) return;
    // Il wallet compare anche in tx che non creano una pool (es. migrate già eseguita da un altro bot).
    if (!value.logs?.some((line) => line.includes("Instruction: CreatePool"))) return;
    if (this.seen.has(value.signature)) return;
    this.seen.add(value.signature);
    if (this.seen.size > MAX_SEEN) {
      const oldest = this.seen.values().next().value;
      if (oldest !== undefined) this.seen.delete(oldest);
    }

    const event = await this.buildEvent(value.signature);
    if (event) this.onEvent?.(event);
  }

  private async fetchTransaction(signature: string): Promise<RawTransaction | null> {
    // Con commitment "confirmed" la tx può non essere ancora leggibile subito dopo la notifica.
    for (let attempt = 0; attempt < TX_FETCH_ATTEMPTS; attempt++) {
      const tx = await this.options.rpc<RawTransaction | null>("getTransaction", [
        signature,
        // v1: nuovo formato di transazione (2026), stessa struttura json di v0 (verificato dal vivo).
        { encoding: "json", maxSupportedTransactionVersion: 1, commitment: "confirmed" },
      ]);
      if (tx) return tx;
      await this.sleep(TX_FETCH_DELAY_MS * (attempt + 1));
    }
    return null;
  }

  private async buildEvent(signature: string): Promise<RawLaunchEvent | null> {
    const tx = await this.fetchTransaction(signature);
    if (!tx) {
      this.options.logger.warn({ signature }, "helius-ws: tx non recuperabile, evento scartato");
      return null;
    }
    const pool = parseCreatePool(tx);
    if (!pool) return null;

    const { rpc } = this.options;
    const mint = await fetchMintInfo(rpc, pool.tokenMint);
    if (!mint) {
      this.options.logger.warn({ signature, mint: pool.tokenMint }, "helius-ws: mint non leggibile");
      return null;
    }

    const [topHolderPercentages, devFirstSeen, history, imageUrl] = await Promise.all([
      // Può fallire (es. "not a Token mint" su alcuni mint appena migrati): non scartare
      // tutto il segnale, marca solo la distribuzione come non verificata.
      fetchTopHolderPercentages(rpc, pool.tokenMint, mint.supplyRaw, [pool.poolBaseVault]).catch(
        (): number[] | null => null,
      ),
      fetchWalletFirstSeen(rpc, pool.coinCreator).catch((): number | null => null),
      this.options.history
        ? fetchTokenHistory(
            { ...this.options.history, rpc },
            {
              mint: pool.tokenMint,
              creator: pool.coinCreator,
              supply: Number(mint.supplyRaw) / 10 ** mint.decimals,
            },
          ).catch((): TokenHistory => ({}))
        : Promise.resolve<TokenHistory>({}),
      mint.uri ? fetchTokenImage(mint.uri) : Promise.resolve(undefined),
    ]);
    const { previousLaunches, previousLaunchesMigrated, launch: analysis } = history;
    const snipers = analysis?.snipers;

    // I rug precedenti non sono ricostruibili in modo affidabile: sempre "non verificati".
    const unverified: UnverifiedAspect[] = ["dev-rugs"];
    if (previousLaunches === undefined) unverified.push("dev-launches");
    if (snipers === undefined) unverified.push("snipes");
    if (topHolderPercentages === null) unverified.push("holders");

    const launch: LaunchPattern | undefined =
      analysis && analysis.createTime > 0
        ? {
            minutesToMigrate: Math.max(
              0,
              Math.round(((pool.blockTime ?? this.now() / 1000) - analysis.createTime) / 60),
            ),
            bundleWallets: analysis.bundleWallets,
            bundlePct: analysis.bundlePct,
            devBuyPct: analysis.devBuyPct,
            snipersPct: analysis.snipersPct,
            linkedWallets: analysis.linkedWallets,
            devFundedMinutesBeforeLaunch:
              devFirstSeen === null ? null : (analysis.createTime - devFirstSeen) / 60,
          }
        : undefined;

    return {
      id: signature,
      program: "pumpswap",
      tokenMint: pool.tokenMint,
      poolAddress: pool.pool,
      ...(mint.symbol && { tokenSymbol: mint.symbol }),
      ...(mint.name && { tokenName: mint.name }),
      ...(imageUrl && { imageUrl }),
      createdAt: new Date((pool.blockTime ?? this.now() / 1000) * 1000).toISOString(),
      initialLiquiditySol: pool.initialLiquiditySol,
      topHolderPercentages: topHolderPercentages ?? [],
      devWalletHistory: {
        previousLaunches: previousLaunches ?? 0,
        ...(previousLaunchesMigrated !== undefined && { previousLaunchesMigrated }),
        previousRugs: 0,
        walletAgeDays: walletAgeDays(devFirstSeen, this.now() / 1000),
      },
      snipedWalletsCount: snipers ?? 0,
      mintAuthorityRevoked: mint.mintAuthorityRevoked,
      freezeAuthorityRevoked: mint.freezeAuthorityRevoked,
      unverified,
      pumpMigration: true,
      ...(launch && { launch }),
    };
  }
}

export function heliusUrls(apiKey: string): { rpcUrl: string; wsUrl: string } {
  const key = encodeURIComponent(apiKey);
  return {
    rpcUrl: `https://mainnet.helius-rpc.com/?api-key=${key}`,
    wsUrl: `wss://mainnet.helius-rpc.com/?api-key=${key}`,
  };
}
