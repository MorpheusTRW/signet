import { Connection } from "@solana/web3.js";
import { createDb } from "./db/client.js";
import { DevicesRepo } from "./db/devices-repo.js";
import { SettingsRepo } from "./db/settings-repo.js";
import { MarketsRepo } from "./db/markets-repo.js";
import { UserPositionsRepo } from "./db/user-positions-repo.js";
import { PushNotificationsRepo } from "./db/push-notifications-repo.js";
import { SignalDeliveriesRepo } from "./db/signal-deliveries-repo.js";
import { SignalsRepo } from "./db/signals-repo.js";
import { SubscriptionsRepo } from "./db/subscriptions-repo.js";
import { TrackRecordsRepo } from "./db/track-records-repo.js";
import { buildTierConfig } from "./config/monetization.js";
import { createHolderChecker } from "./entitlements/holder-check.js";
import { createSkrHolderReader, NULL_SKR_HOLDER_READER } from "./entitlements/skr-holder.js";
import type { ResolveTierDeps } from "./entitlements/resolve-tier.js";
import { loadEnv } from "./env.js";
import type { EventSource } from "./ingest/event-source.js";
import { createRpcCall } from "./ingest/helius/rpc.js";
import { HeliusEventSource, heliusUrls } from "./ingest/helius/helius-event-source.js";
import { createEnhancedApi, DailyBudget } from "./ingest/helius/history.js";
import { SyntheticEventSource } from "./ingest/synthetic-event-source.js";
import type { PaperTradingConfig } from "./paper-trading/types.js";
import { startPushDispatcher } from "./push/dispatcher.js";
import { scheduleSignalPush } from "./push/schedule-signal-push.js";
import { createPushSender } from "./push/sender.js";
import { buildServer } from "./server.js";
import { KillSwitch } from "./safety/kill-switch.js";
import { RateLimiter } from "./safety/rate-limiter.js";
import { startRealTrackRecordSettler } from "./track-record/settle-real.js";
import { processLaunchEvent } from "./signals/pipeline.js";

const env = loadEnv();

const db = createDb(env.DATABASE_PATH);
const signalsRepo = new SignalsRepo(db);
const devicesRepo = new DevicesRepo(db);
const userPositionsRepo = new UserPositionsRepo(db);
const marketsRepo = new MarketsRepo(db);
const subscriptionsRepo = new SubscriptionsRepo(db);
const signalDeliveriesRepo = new SignalDeliveriesRepo(db);
const trackRecordsRepo = new TrackRecordsRepo(db);
const pushNotificationsRepo = new PushNotificationsRepo(db);

const killSwitch = new KillSwitch(new SettingsRepo(db), env.KILL_SWITCH);
const buildSwapRateLimiter = new RateLimiter(env.BUILD_SWAP_RATE_LIMIT_PER_MIN, 60_000);

const paperTradingConfig: PaperTradingConfig = {
  balanceSol: env.PAPER_BALANCE_SOL,
  maxExposureFraction: env.MAX_PORTFOLIO_EXPOSURE,
};

const tierConfig = buildTierConfig(env);

// Connessione RPC condivisa (verifica HOLDER + /build-swap). Senza
// SOLANA_RPC_URL entrambe degradano fail-soft invece di inventare un dato o
// costruire una tx senza poterla simulare/risolvere.
const connection = env.SOLANA_RPC_URL
  ? new Connection(env.SOLANA_RPC_URL, "confirmed")
  : undefined;

// Prezzi reali dalle pool (track record e posizioni): stesso RPC del resto dell'engine.
const priceRpc = env.SOLANA_RPC_URL ? createRpcCall(env.SOLANA_RPC_URL) : undefined;
const trackRecordSource = env.EVENT_SOURCE === "synthetic" ? "synthetic" : "real";

const skrHolderReader = connection ? createSkrHolderReader(connection) : NULL_SKR_HOLDER_READER;

const holderChecker = createHolderChecker(
  skrHolderReader,
  tierConfig,
  env.HOLDER_CACHE_TTL_MS,
);

const resolveTierDeps: ResolveTierDeps = {
  subscriptionsRepo,
  holderChecker,
  tierConfig,
};

const app = buildServer(env, {
  signalsRepo,
  devicesRepo,
  signalDeliveriesRepo,
  trackRecordsRepo,
  resolveTierDeps,
  userPositionsRepo,
  marketsRepo,
  paperTradingConfig,
  priceRpc,
  trackRecordSource,
  killSwitch,
  buildSwapRateLimiter,
  buildSwap: {
    connection,
    treasuryWalletPubkey: env.TREASURY_WALLET_PUBKEY,
    jupiterApiBaseUrl: env.JUPITER_API_BASE_URL,
    tradingMode: env.TRADING_MODE,
  },
});

// Senza credenziali FIREBASE_* configurate, il sender fallisce ogni invio: le
// notifiche restano pianificate ("pending") ma non partono mai (fail-soft,
// stesso pattern della verifica HOLDER).
const pushSender = createPushSender(env);
const stopPushDispatcher = startPushDispatcher(
  { pushNotificationsRepo, devicesRepo, sender: pushSender },
  env.PUSH_DISPATCH_INTERVAL_MS,
  app.log,
);

function createEventSource(): EventSource {
  switch (env.EVENT_SOURCE) {
    case "synthetic":
      return new SyntheticEventSource({
        intervalMs: env.SYNTHETIC_INTERVAL_MS,
      });
    case "helius-ws": {
      if (!env.HELIUS_API_KEY) {
        throw new Error("EVENT_SOURCE=helius-ws richiede HELIUS_API_KEY");
      }
      const { rpcUrl, wsUrl } = heliusUrls(env.HELIUS_API_KEY);
      return new HeliusEventSource({
        wsUrl,
        rpc: createRpcCall(rpcUrl),
        logger: app.log,
        history: {
          enhanced: createEnhancedApi(env.HELIUS_API_KEY),
          budget: new DailyBudget(env.HELIUS_ENHANCED_DAILY_LIMIT),
        },
      });
    }
    case "yellowstone-grpc":
      throw new Error(
        `Adapter EVENT_SOURCE="${env.EVENT_SOURCE}" non ancora implementato`,
      );
  }
}

const eventSource = createEventSource();
eventSource.start((event) => {
  const signal = processLaunchEvent(event, {
    signalsRepo,
    trackRecordsRepo,
    marketsRepo,
  });

  scheduleSignalPush(signal, {
    devicesRepo,
    pushNotificationsRepo,
    signalDeliveriesRepo,
    resolveTierDeps,
    pushHighRisk: env.PUSH_HIGH_RISK_SIGNALS,
  }).catch((error: unknown) => {
    app.log.warn({ err: error }, "scheduleSignalPush fallito");
  });
});

const stopTrackRecordSettler = priceRpc
  ? startRealTrackRecordSettler(
      { trackRecordsRepo, marketsRepo, rpc: priceRpc },
      env.TRACK_RECORD_SETTLE_INTERVAL_MS,
      app.log,
    )
  : () => {};

app.addHook("onClose", async () => {
  stopPushDispatcher();
  stopTrackRecordSettler();
  await eventSource.stop();
  db.close();
});

// Fly.io (e Docker) fermano il processo con un segnale: chiudere il server fa
// scattare onClose, che ferma ingest/dispatcher e chiude SQLite in modo pulito.
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    app.log.info({ signal }, "arresto in corso");
    app
      .close()
      .then(() => process.exit(0))
      .catch((err: unknown) => {
        app.log.error(err);
        process.exit(1);
      });
  });
}

app
  .listen({ port: env.PORT, host: "0.0.0.0" })
  .catch((err: unknown) => {
    app.log.error(err);
    process.exit(1);
  });
