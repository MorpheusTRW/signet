import Fastify, { type FastifyInstance } from "fastify";
import type { Env } from "./env.js";

export function buildServer(env: Env): FastifyInstance {
  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL,
    },
  });

  app.get("/health", async () => ({ status: "ok" }));

  return app;
}
