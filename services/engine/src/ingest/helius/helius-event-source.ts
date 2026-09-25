import WebSocket from "ws";
import type { EventSource, RawLaunchEvent } from "../event-source.js";
import { fetchMintInfo, fetchTopHolderPercentages, fetchWalletAgeDays } from "./enrich.js";
import { parseCreatePool, type RawTransaction } from "./parse-create-pool.js";
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
        { encoding: "json", maxSupportedTransactionVersion: 0, commitment: "confirmed" },
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

    const [topHolderPercentages, walletAgeDays] = await Promise.all([
      fetchTopHolderPercentages(rpc, pool.tokenMint, mint.supplyRaw, [pool.poolBaseVault]),
      fetchWalletAgeDays(rpc, pool.coinCreator, this.now() / 1000),
    ]);

    return {
      id: signature,
      program: "pumpswap",
      tokenMint: pool.tokenMint,
      poolAddress: pool.pool,
      ...(mint.symbol && { tokenSymbol: mint.symbol }),
      ...(mint.name && { tokenName: mint.name }),
      createdAt: new Date((pool.blockTime ?? this.now() / 1000) * 1000).toISOString(),
      initialLiquiditySol: pool.initialLiquiditySol,
      topHolderPercentages,
      // previousLaunches/previousRugs non sono ricostruibili con poche chiamate RPC:
      // restano a 0 ma il segnale è marcato "non verificato" (vedi `unverified`).
      devWalletHistory: { previousLaunches: 0, previousRugs: 0, walletAgeDays },
      snipedWalletsCount: 0,
      mintAuthorityRevoked: mint.mintAuthorityRevoked,
      freezeAuthorityRevoked: mint.freezeAuthorityRevoked,
      unverified: ["dev-history", "snipes"],
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
