import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { SignalsRepo } from "../db/signals-repo.js";

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export function registerSignalsRoutes(
  app: FastifyInstance,
  signalsRepo: SignalsRepo,
): void {
  app.get("/signals", async (request, reply) => {
    const query = listQuerySchema.safeParse(request.query);
    if (!query.success) {
      return reply
        .status(400)
        .send({ error: "invalid_query", details: query.error.flatten() });
    }
    return signalsRepo.list(query.data.limit);
  });

  app.get<{ Params: { id: string } }>(
    "/signals/:id",
    async (request, reply) => {
      const signal = signalsRepo.findById(request.params.id);
      if (!signal) {
        return reply.status(404).send({ error: "not_found" });
      }
      return signal;
    },
  );
}
