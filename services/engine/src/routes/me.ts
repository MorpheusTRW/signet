import { pubkeySchema } from "@seeker-signal/shared";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { ResolveTierDeps } from "../entitlements/resolve-tier.js";
import { resolveTier } from "../entitlements/resolve-tier.js";

const tierQuerySchema = z.object({ pubkey: pubkeySchema });

export function registerMeRoutes(
  app: FastifyInstance,
  deps: ResolveTierDeps,
): void {
  app.get("/me/tier", async (request, reply) => {
    const query = tierQuerySchema.safeParse(request.query);
    if (!query.success) {
      return reply
        .status(400)
        .send({ error: "invalid_query", details: query.error.flatten() });
    }

    const resolution = await resolveTier(query.data.pubkey, deps);

    return {
      pubkey: query.data.pubkey,
      tier: resolution.tier,
      expiresAt: resolution.expiresAt,
      limits: resolution.limits,
    };
  });
}
