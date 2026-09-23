import Fastify, { type FastifyInstance } from "fastify";
import type { DevicesRepo } from "./db/devices-repo.js";
import type { PaperTradesRepo } from "./db/paper-trades-repo.js";
import type { SignalDeliveriesRepo } from "./db/signal-deliveries-repo.js";
import type { SignalsRepo } from "./db/signals-repo.js";
import type { TrackRecordsRepo } from "./db/track-records-repo.js";
import type { ResolveTierDeps } from "./entitlements/resolve-tier.js";
import type { Env } from "./env.js";
import type { PaperTradingConfig } from "./paper-trading/types.js";
import { registerBuildSwapRoute, type BuildSwapRouteDeps } from "./routes/build-swap.js";
import { registerDevicesRoutes } from "./routes/devices.js";
import { registerMeRoutes } from "./routes/me.js";
import { registerSignalsRoutes } from "./routes/signals.js";
import { registerTrackRecordRoutes } from "./routes/track-record.js";

export interface ServerDeps {
  signalsRepo: SignalsRepo;
  devicesRepo: DevicesRepo;
  signalDeliveriesRepo: SignalDeliveriesRepo;
  trackRecordsRepo: TrackRecordsRepo;
  resolveTierDeps: ResolveTierDeps;
  paperTradesRepo: PaperTradesRepo;
  paperTradingConfig: PaperTradingConfig;
  buildSwap: Pick<
    BuildSwapRouteDeps,
    "connection" | "treasuryWalletPubkey" | "jupiterApiBaseUrl" | "tradingMode"
  >;
}

export function buildServer(env: Env, deps: ServerDeps): FastifyInstance {
  const app = Fastify({
    logger: {
      level: env.NODE_ENV === "test" ? "silent" : env.LOG_LEVEL,
    },
  });

  app.get("/health", async () => ({ status: "ok" }));

  registerSignalsRoutes(app, {
    signalsRepo: deps.signalsRepo,
    signalDeliveriesRepo: deps.signalDeliveriesRepo,
    resolveTierDeps: deps.resolveTierDeps,
  });
  registerDevicesRoutes(app, deps.devicesRepo);
  registerMeRoutes(app, deps.resolveTierDeps);
  registerTrackRecordRoutes(app, deps.trackRecordsRepo);
  registerBuildSwapRoute(app, {
    signalsRepo: deps.signalsRepo,
    paperTradesRepo: deps.paperTradesRepo,
    paperTradingConfig: deps.paperTradingConfig,
    resolveTierDeps: deps.resolveTierDeps,
    ...deps.buildSwap,
  });

  return app;
}
