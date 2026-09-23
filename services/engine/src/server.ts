import Fastify, { type FastifyInstance } from "fastify";
import type { DevicesRepo } from "./db/devices-repo.js";
import type { SignalsRepo } from "./db/signals-repo.js";
import type { Env } from "./env.js";
import { registerDevicesRoutes } from "./routes/devices.js";
import { registerSignalsRoutes } from "./routes/signals.js";

export interface ServerDeps {
  signalsRepo: SignalsRepo;
  devicesRepo: DevicesRepo;
}

export function buildServer(env: Env, deps: ServerDeps): FastifyInstance {
  const app = Fastify({
    logger: {
      level: env.NODE_ENV === "test" ? "silent" : env.LOG_LEVEL,
    },
  });

  app.get("/health", async () => ({ status: "ok" }));

  registerSignalsRoutes(app, deps.signalsRepo);
  registerDevicesRoutes(app, deps.devicesRepo);

  return app;
}
