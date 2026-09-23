import { Connection } from "@solana/web3.js";
import { createDb } from "./db/client.js";
import { DevicesRepo } from "./db/devices-repo.js";
import { PaperTradesRepo } from "./db/paper-trades-repo.js";
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
import { SyntheticEventSource } from "./ingest/synthetic-event-source.js";
import { buildServer } from "./server.js";
import { processLaunchEvent } from "./signals/pipeline.js";

const env = loadEnv();

const db = createDb(env.DATABASE_PATH);
const signalsRepo = new SignalsRepo(db);
const devicesRepo = new DevicesRepo(db);
const paperTradesRepo = new PaperTradesRepo(db);
const subscriptionsRepo = new SubscriptionsRepo(db);
const signalDeliveriesRepo = new SignalDeliveriesRepo(db);
const trackRecordsRepo = new TrackRecordsRepo(db);

const tierConfig = buildTierConfig(env);

// Verifica HOLDER: senza SOLANA_RPC_URL non c'è modo di leggere saldo/stake
// SKR reali, quindi si degrada a "mai holder" (fail-closed) invece di inventare
// un dato. Vedi src/entitlements/skr-holder.ts per le fonti sugli indirizzi.
const skrHolderReader = env.SOLANA_RPC_URL
  ? createSkrHolderReader(new Connection(env.SOLANA_RPC_URL, "confirmed"))
  : NULL_SKR_HOLDER_READER;

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

function createEventSource(): EventSource {
  switch (env.EVENT_SOURCE) {
    case "synthetic":
      return new SyntheticEventSource({
        intervalMs: env.SYNTHETIC_INTERVAL_MS,
      });
    case "helius-ws":
    case "yellowstone-grpc":
      throw new Error(
        `Adapter EVENT_SOURCE="${env.EVENT_SOURCE}" non ancora implementato (previsto per F5)`,
      );
  }
}

const eventSource = createEventSource();
eventSource.start((event) => {
  processLaunchEvent(event, {
    signalsRepo,
    paperTradesRepo,
    trackRecordsRepo,
    paperTradingConfig: {
      portfolioValueSol: env.PAPER_PORTFOLIO_SOL,
      maxExposureFraction: env.MAX_PORTFOLIO_EXPOSURE,
      defaultPositionSizeSol: env.PAPER_DEFAULT_POSITION_SOL,
    },
  });
});

const app = buildServer(env, {
  signalsRepo,
  devicesRepo,
  signalDeliveriesRepo,
  trackRecordsRepo,
  resolveTierDeps,
});

app.addHook("onClose", async () => {
  await eventSource.stop();
  db.close();
});

app
  .listen({ port: env.PORT, host: "0.0.0.0" })
  .catch((err: unknown) => {
    app.log.error(err);
    process.exit(1);
  });
