import type { FastifyInstance } from "fastify";
import { createDb, type DbClient } from "../../src/db/client.js";
import { DevicesRepo } from "../../src/db/devices-repo.js";
import { SignalsRepo } from "../../src/db/signals-repo.js";
import { loadEnv } from "../../src/env.js";
import { buildServer } from "../../src/server.js";

export function createTestApp(): {
  app: FastifyInstance;
  db: DbClient;
  signalsRepo: SignalsRepo;
  devicesRepo: DevicesRepo;
} {
  const db = createDb(":memory:");
  const signalsRepo = new SignalsRepo(db);
  const devicesRepo = new DevicesRepo(db);
  const app = buildServer(loadEnv({ NODE_ENV: "test" }), {
    signalsRepo,
    devicesRepo,
  });
  return { app, db, signalsRepo, devicesRepo };
}
