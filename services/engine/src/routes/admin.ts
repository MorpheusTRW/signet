import { timingSafeEqual } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { KillSwitch } from "../safety/kill-switch.js";

const bodySchema = z.object({ active: z.boolean() });

function keysMatch(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function registerAdminRoutes(
  app: FastifyInstance,
  deps: { killSwitch: KillSwitch; adminApiKey: string | undefined; tradingMode: "paper" | "live" },
): void {
  // Pubblico e senza dati sensibili: l'app lo legge per mostrare lo stato.
  app.get("/status", async () => ({
    killSwitch: deps.killSwitch.isActive(),
    tradingMode: deps.tradingMode,
  }));

  // Senza ADMIN_API_KEY l'endpoint non esiste affatto.
  if (!deps.adminApiKey) return;
  const adminApiKey = deps.adminApiKey;

  app.post("/admin/kill-switch", async (request, reply) => {
    const header = request.headers.authorization ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    if (!keysMatch(token, adminApiKey)) {
      return reply.status(401).send({ error: "unauthorized" });
    }
    const body = bodySchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({ error: "invalid_body" });
    }
    deps.killSwitch.set(body.data.active);
    request.log.warn({ killSwitch: body.data.active }, "kill switch modificato via admin");
    return { killSwitch: deps.killSwitch.isActive() };
  });
}
