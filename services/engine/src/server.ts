import Fastify, { type FastifyInstance } from "fastify";
import type { DevicesRepo } from "./db/devices-repo.js";
import type { MarketsRepo } from "./db/markets-repo.js";
import type { UserPositionsRepo } from "./db/user-positions-repo.js";
import type { RpcCall } from "./ingest/helius/rpc.js";
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
import { registerCallsRoutes } from "./routes/calls.js";
import { registerDevicesRoutes } from "./routes/devices.js";
import { registerEngagementRoutes } from "./routes/engagement.js";
import { RejectedOutcomes } from "./engagement/rejected-outcomes.js";
import { registerMeRoutes } from "./routes/me.js";
import { registerPrivacyRoute } from "./routes/privacy.js";
import { registerPositionsRoutes } from "./routes/positions.js";
import { registerSignalsRoutes } from "./routes/signals.js";
import { registerTrackRecordRoutes } from "./routes/track-record.js";

export interface ServerDeps {
  signalsRepo: SignalsRepo;
  devicesRepo: DevicesRepo;
  signalDeliveriesRepo: SignalDeliveriesRepo;
  trackRecordsRepo: TrackRecordsRepo;
  resolveTierDeps: ResolveTierDeps;
  userPositionsRepo: UserPositionsRepo;
  marketsRepo: MarketsRepo;
  paperTradingConfig: PaperTradingConfig;
  /** RPC per i prezzi reali delle pool (undefined = non configurato). */
  priceRpc: RpcCall | undefined;
  /** Quali marcature mostra /track-record: reali (adapter on-chain) o simulate (synthetic). */
  trackRecordSource: "real" | "synthetic";
  killSwitch: KillSwitch;
  buildSwapRateLimiter: RateLimiter;
  buildSwap: Pick<
    BuildSwapRouteDeps,
    "connection" | "treasuryWalletPubkey" | "jupiterApiBaseUrl" | "tradingMode"
  >;
}

export function buildServer(env: Env, deps: ServerDeps): FastifyInstance {
  const app = Fastify({
    // In produzione l'engine sta dietro il proxy di Fly.io: l'IP reale del client arriva in X-Forwarded-For.
    trustProxy: env.NODE_ENV === "production",
    logger: {
      level: env.NODE_ENV === "test" ? "silent" : env.LOG_LEVEL,
      // Mai loggare credenziali: chiave admin e API key dei device.
      redact: ["req.headers.authorization", "req.headers['x-api-key']"],
    },
  });

  app.get("/health", async () => ({ status: "ok" }));
  registerPrivacyRoute(app, env);

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
    userPositionsRepo: deps.userPositionsRepo,
    signalsRepo: deps.signalsRepo,
    marketsRepo: deps.marketsRepo,
    paperTradingConfig: deps.paperTradingConfig,
    resolveTierDeps: deps.resolveTierDeps,
    killSwitch: deps.killSwitch,
    tradingMode: deps.buildSwap.tradingMode,
    maxSwapSol: env.MAX_SWAP_SOL,
    rpc: deps.priceRpc,
  });
  registerCallsRoutes(app, {
    signalsRepo: deps.signalsRepo,
    trackRecordsRepo: deps.trackRecordsRepo,
    marketsRepo: deps.marketsRepo,
    resolveTierDeps: deps.resolveTierDeps,
    rpc: deps.priceRpc,
  });
  registerDevicesRoutes(app, deps.devicesRepo);
  registerEngagementRoutes(app, {
    signalsRepo: deps.signalsRepo,
    devicesRepo: deps.devicesRepo,
    userPositionsRepo: deps.userPositionsRepo,
    rejectedOutcomes: new RejectedOutcomes({
      trackRecordsRepo: deps.trackRecordsRepo,
      marketsRepo: deps.marketsRepo,
      rpc: deps.priceRpc,
      source: deps.trackRecordSource,
      cacheTtlMs: env.DODGED_CACHE_TTL_MS,
    }),
    tradingMode: deps.buildSwap.tradingMode,
    rugThresholdPct: env.RUG_THRESHOLD_PCT,
    panicSellWindowMinutes: env.PANIC_SELL_WINDOW_MINUTES,
    maxExposureFraction: deps.paperTradingConfig.maxExposureFraction,
  });
  registerMeRoutes(app, deps.resolveTierDeps, {
    signalsRepo: deps.signalsRepo,
    signalDeliveriesRepo: deps.signalDeliveriesRepo,
  });
  registerTrackRecordRoutes(app, deps.trackRecordsRepo, deps.trackRecordSource);
  registerBuildSwapRoute(app, {
    signalsRepo: deps.signalsRepo,
    userPositionsRepo: deps.userPositionsRepo,
    paperTradingConfig: deps.paperTradingConfig,
    resolveTierDeps: deps.resolveTierDeps,
    killSwitch: deps.killSwitch,
    rateLimiter: deps.buildSwapRateLimiter,
    maxSwapSol: env.MAX_SWAP_SOL,
    ...deps.buildSwap,
  });

  return app;
}
