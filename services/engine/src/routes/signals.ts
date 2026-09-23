import { pubkeySchema } from "@seeker-signal/shared";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { SignalDeliveriesRepo } from "../db/signal-deliveries-repo.js";
import type { SignalsRepo } from "../db/signals-repo.js";
import type { ResolveTierDeps } from "../entitlements/resolve-tier.js";
import { resolveTier } from "../entitlements/resolve-tier.js";
import { selectSignalsForTier } from "../entitlements/signal-distribution.js";

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  pubkey: pubkeySchema.optional(),
});

/** Pool di candidati generoso da cui applicare ritardo/storico/limite giornaliero. */
const CANDIDATE_POOL_SIZE = 500;

export interface SignalsRouteDeps {
  signalsRepo: SignalsRepo;
  signalDeliveriesRepo: SignalDeliveriesRepo;
  resolveTierDeps: ResolveTierDeps;
}

export function registerSignalsRoutes(
  app: FastifyInstance,
  deps: SignalsRouteDeps,
): void {
  app.get("/signals", async (request, reply) => {
    const query = listQuerySchema.safeParse(request.query);
    if (!query.success) {
      return reply
        .status(400)
        .send({ error: "invalid_query", details: query.error.flatten() });
    }

    // Senza pubkey: feed grezzo, non tier-aware (uso interno/ops).
    if (!query.data.pubkey) {
      return deps.signalsRepo.list(query.data.limit);
    }

    const now = new Date();
    const { pubkey, limit } = query.data;
    const { limits } = await resolveTier(pubkey, deps.resolveTierDeps, now);

    const sinceIso =
      limits.historyHours != null
        ? new Date(now.getTime() - limits.historyHours * 3_600_000).toISOString()
        : null;
    const candidatesDesc = deps.signalsRepo.listSince(sinceIso, CANDIDATE_POOL_SIZE);
    const alreadyDeliveredIdsToday = deps.signalDeliveriesRepo.listDeliveredTodayIds(
      pubkey,
      now,
    );

    const { signals, newlyDeliveredIds } = selectSignalsForTier({
      now,
      candidatesDesc,
      limits,
      alreadyDeliveredIdsToday,
      requestedLimit: limit,
    });

    deps.signalDeliveriesRepo.record(pubkey, newlyDeliveredIds, now);

    return signals;
  });

  app.get<{ Params: { id: string } }>(
    "/signals/:id",
    async (request, reply) => {
      const signal = deps.signalsRepo.findById(request.params.id);
      if (!signal) {
        return reply.status(404).send({ error: "not_found" });
      }
      return signal;
    },
  );
}
