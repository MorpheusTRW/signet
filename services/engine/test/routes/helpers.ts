import type { Connection } from "@solana/web3.js";
import type { FastifyInstance } from "fastify";
import { createDb, type DbClient } from "../../src/db/client.js";
import { buildTierConfig } from "../../src/config/monetization.js";
import { DevicesRepo } from "../../src/db/devices-repo.js";
import { MarketsRepo } from "../../src/db/markets-repo.js";
import { SettingsRepo } from "../../src/db/settings-repo.js";
import { UserPositionsRepo } from "../../src/db/user-positions-repo.js";
import { KillSwitch } from "../../src/safety/kill-switch.js";
import { RateLimiter } from "../../src/safety/rate-limiter.js";
import { SignalDeliveriesRepo } from "../../src/db/signal-deliveries-repo.js";
import { SignalsRepo } from "../../src/db/signals-repo.js";
import { SubscriptionsRepo } from "../../src/db/subscriptions-repo.js";
import { TrackRecordsRepo } from "../../src/db/track-records-repo.js";
import type { HolderChecker } from "../../src/entitlements/holder-check.js";
import type { ResolveTierDeps } from "../../src/entitlements/resolve-tier.js";
import { loadEnv } from "../../src/env.js";
import type { RpcCall } from "../../src/ingest/helius/rpc.js";
import type { PaperTradingConfig } from "../../src/paper-trading/types.js";
import { buildServer } from "../../src/server.js";

/** Mai holder, per default: i test che vogliono simulare un HOLDER passano un override. */
export const NEVER_HOLDER: HolderChecker = {
  async isHolder() {
    return false;
  },
};

export function createTestApp(
  overrides: {
    holderChecker?: HolderChecker;
    paperTradingConfig?: Partial<PaperTradingConfig>;
    env?: NodeJS.ProcessEnv;
    rateLimit?: number;
    priceRpc?: RpcCall;
    trackRecordSource?: "real" | "synthetic";
    buildSwap?: {
      connection?: Connection;
      treasuryWalletPubkey?: string;
      jupiterApiBaseUrl?: string;
      tradingMode?: "paper" | "live";
    };
  } = {},
): {
  app: FastifyInstance;
  db: DbClient;
  signalsRepo: SignalsRepo;
  devicesRepo: DevicesRepo;
  signalDeliveriesRepo: SignalDeliveriesRepo;
  subscriptionsRepo: SubscriptionsRepo;
  trackRecordsRepo: TrackRecordsRepo;
  userPositionsRepo: UserPositionsRepo;
  marketsRepo: MarketsRepo;
  resolveTierDeps: ResolveTierDeps;
  killSwitch: KillSwitch;
} {
  const db = createDb(":memory:");
  const env = loadEnv({ NODE_ENV: "test", ...overrides.env });

  const signalsRepo = new SignalsRepo(db);
  const devicesRepo = new DevicesRepo(db);
  const signalDeliveriesRepo = new SignalDeliveriesRepo(db);
  const subscriptionsRepo = new SubscriptionsRepo(db);
  const trackRecordsRepo = new TrackRecordsRepo(db);
  const userPositionsRepo = new UserPositionsRepo(db);
  const marketsRepo = new MarketsRepo(db);

  const resolveTierDeps: ResolveTierDeps = {
    subscriptionsRepo,
    holderChecker: overrides.holderChecker ?? NEVER_HOLDER,
    tierConfig: buildTierConfig(env),
  };

  const paperTradingConfig: PaperTradingConfig = {
    balanceSol: env.PAPER_BALANCE_SOL,
    maxExposureFraction: env.MAX_PORTFOLIO_EXPOSURE,
    ...overrides.paperTradingConfig,
  };

  const killSwitch = new KillSwitch(new SettingsRepo(db), env.KILL_SWITCH);

  const app = buildServer(env, {
    killSwitch,
    buildSwapRateLimiter: new RateLimiter(overrides.rateLimit ?? 1000, 60_000),
    signalsRepo,
    devicesRepo,
    signalDeliveriesRepo,
    trackRecordsRepo,
    resolveTierDeps,
    userPositionsRepo,
    marketsRepo,
    paperTradingConfig,
    priceRpc: overrides.priceRpc,
    trackRecordSource: overrides.trackRecordSource ?? "synthetic",
    buildSwap: {
      connection: overrides.buildSwap?.connection,
      treasuryWalletPubkey: overrides.buildSwap?.treasuryWalletPubkey,
      jupiterApiBaseUrl: overrides.buildSwap?.jupiterApiBaseUrl ?? env.JUPITER_API_BASE_URL,
      tradingMode: overrides.buildSwap?.tradingMode ?? env.TRADING_MODE,
    },
  });

  return {
    app,
    db,
    signalsRepo,
    devicesRepo,
    signalDeliveriesRepo,
    subscriptionsRepo,
    trackRecordsRepo,
    userPositionsRepo,
    marketsRepo,
    resolveTierDeps,
    killSwitch,
  };
}
