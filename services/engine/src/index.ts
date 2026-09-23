import { createDb } from "./db/client.js";
import { DevicesRepo } from "./db/devices-repo.js";
import { PaperTradesRepo } from "./db/paper-trades-repo.js";
import { SignalsRepo } from "./db/signals-repo.js";
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
    paperTradingConfig: {
      portfolioValueSol: env.PAPER_PORTFOLIO_SOL,
      maxExposureFraction: env.MAX_PORTFOLIO_EXPOSURE,
      defaultPositionSizeSol: env.PAPER_DEFAULT_POSITION_SOL,
    },
  });
});

const app = buildServer(env, { signalsRepo, devicesRepo });

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
