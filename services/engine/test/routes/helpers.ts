import type { FastifyInstance } from "fastify";
import { createDb, type DbClient } from "../../src/db/client.js";
import { buildTierConfig } from "../../src/config/monetization.js";
import { DevicesRepo } from "../../src/db/devices-repo.js";
import { SignalDeliveriesRepo } from "../../src/db/signal-deliveries-repo.js";
import { SignalsRepo } from "../../src/db/signals-repo.js";
import { SubscriptionsRepo } from "../../src/db/subscriptions-repo.js";
import { TrackRecordsRepo } from "../../src/db/track-records-repo.js";
import type { HolderChecker } from "../../src/entitlements/holder-check.js";
import type { ResolveTierDeps } from "../../src/entitlements/resolve-tier.js";
import { loadEnv } from "../../src/env.js";
import { buildServer } from "../../src/server.js";

/** Mai holder, per default: i test che vogliono simulare un HOLDER passano un override. */
export const NEVER_HOLDER: HolderChecker = {
  async isHolder() {
    return false;
  },
};

export function createTestApp(overrides: { holderChecker?: HolderChecker } = {}): {
  app: FastifyInstance;
  db: DbClient;
  signalsRepo: SignalsRepo;
  devicesRepo: DevicesRepo;
  signalDeliveriesRepo: SignalDeliveriesRepo;
  subscriptionsRepo: SubscriptionsRepo;
  trackRecordsRepo: TrackRecordsRepo;
  resolveTierDeps: ResolveTierDeps;
} {
  const db = createDb(":memory:");
  const env = loadEnv({ NODE_ENV: "test" });

  const signalsRepo = new SignalsRepo(db);
  const devicesRepo = new DevicesRepo(db);
  const signalDeliveriesRepo = new SignalDeliveriesRepo(db);
  const subscriptionsRepo = new SubscriptionsRepo(db);
  const trackRecordsRepo = new TrackRecordsRepo(db);

  const resolveTierDeps: ResolveTierDeps = {
    subscriptionsRepo,
    holderChecker: overrides.holderChecker ?? NEVER_HOLDER,
    tierConfig: buildTierConfig(env),
  };

  const app = buildServer(env, {
    signalsRepo,
    devicesRepo,
    signalDeliveriesRepo,
    trackRecordsRepo,
    resolveTierDeps,
  });

  return {
    app,
    db,
    signalsRepo,
    devicesRepo,
    signalDeliveriesRepo,
    subscriptionsRepo,
    trackRecordsRepo,
    resolveTierDeps,
  };
}
