import Fastify, { type FastifyInstance } from "fastify";
import type { DevicesRepo } from "./db/devices-repo.js";
import type { PaperTradesRepo } from "./db/paper-trades-repo.js";
import type { SignalDeliveriesRepo } from "./db/signal-deliveries-repo.js";
import type { SignalsRepo } from "./db/signals-repo.js";
import type { TrackRecordsRepo } from "./db/track-records-repo.js";
import type { ResolveTierDeps } from "./entitlements/resolve-tier.js";
import type { Env } from "./env.js";
import type { PaperTradingConfig } from "./paper-trading/types.js";
import { registerAdminRoutes } from "./routes/admin.js";
import type { KillSwitch } from "./safety/kill-switch.js";
import type { RateLimiter } from "./safety/rate-limiter.js";
import { registerBuildSwapRoute, type BuildSwapRouteDeps } from "./routes/build-swap.js";
import { registerDevicesRoutes } from "./routes/devices.js";
import { registerMeRoutes } from "./routes/me.js";
import { registerPositionsRoutes } from "./routes/positions.js";
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
  killSwitch: KillSwitch;
  buildSwapRateLimiter: RateLimiter;
  buildSwap: Pick<
    BuildSwapRouteDeps,
    "connection" | "treasuryWalletPubkey" | "jupiterApiBaseUrl" | "tradingMode"
  >;
}

export function buildServer(env: Env, deps: ServerDeps): FastifyInstance {
  const app = Fastify({
    logger: {
      level: env.NODE_ENV === "test" ? "silent" : env.LOG_LEVEL,
      // Mai loggare credenziali: chiave admin e API key dei device.
      redact: ["req.headers.authorization", "req.headers['x-api-key']"],
    },
  });

  app.get("/health", async () => ({ status: "ok" }));

  registerAdminRoutes(app, {
    killSwitch: deps.killSwitch,
    adminApiKey: env.ADMIN_API_KEY,
    tradingMode: deps.buildSwap.tradingMode,
  });
  registerSignalsRoutes(app, {
    signalsRepo: deps.signalsRepo,
    signalDeliveriesRepo: deps.signalDeliveriesRepo,
    resolveTierDeps: deps.resolveTierDeps,
  });
  registerPositionsRoutes(app, {
    paperTradesRepo: deps.paperTradesRepo,
    signalsRepo: deps.signalsRepo,
    paperTradingConfig: deps.paperTradingConfig,
  });
  registerDevicesRoutes(app, deps.devicesRepo);
  registerMeRoutes(app, deps.resolveTierDeps);
  registerTrackRecordRoutes(app, deps.trackRecordsRepo);
  registerBuildSwapRoute(app, {
    signalsRepo: deps.signalsRepo,
    paperTradesRepo: deps.paperTradesRepo,
    paperTradingConfig: deps.paperTradingConfig,
    resolveTierDeps: deps.resolveTierDeps,
    killSwitch: deps.killSwitch,
    rateLimiter: deps.buildSwapRateLimiter,
    maxSwapSol: env.MAX_SWAP_SOL,
    ...deps.buildSwap,
  });

  return app;
}
