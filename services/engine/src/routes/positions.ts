import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { PaperTradesRepo } from "../db/paper-trades-repo.js";
import type { SignalsRepo } from "../db/signals-repo.js";
import { remainingExposureSol } from "../paper-trading/engine.js";
import type { PaperTradingConfig } from "../paper-trading/types.js";

const querySchema = z.object({ limit: z.coerce.number().int().min(1).max(200).default(50) });

/**
 * Posizioni del portafoglio di paper trading (unico portafoglio, non per
 * wallet: in paper mode nessun fondo reale è coinvolto) + il riepilogo di
 * esposizione che l'app usa per ricontrollare il limite del 20% (principio 3).
 */
export function registerPositionsRoutes(
  app: FastifyInstance,
  deps: {
    paperTradesRepo: PaperTradesRepo;
    signalsRepo: SignalsRepo;
    paperTradingConfig: PaperTradingConfig;
  },
): void {
  app.get("/positions", async (request, reply) => {
    const query = querySchema.safeParse(request.query);
    if (!query.success) {
      return reply.status(400).send({ error: "invalid_query" });
    }

    const openExposureSol = deps.paperTradesRepo.sumOpenExposureSol();
    const trades = deps.paperTradesRepo.list(query.data.limit);

    const positions = trades.map((trade) => {
      const signal = deps.signalsRepo.findById(trade.signalId);
      return {
        ...trade,
        tokenSymbol: signal?.tokenSymbol ?? null,
        tokenName: signal?.tokenName ?? null,
      };
    });

    const realizedPnlSol = positions
      .filter((p) => p.status === "closed")
      .reduce((sum, p) => sum + p.pnlSol, 0);

    return {
      portfolio: {
        valueSol: deps.paperTradingConfig.portfolioValueSol,
        maxExposureFraction: deps.paperTradingConfig.maxExposureFraction,
        openExposureSol,
        remainingSol: remainingExposureSol(openExposureSol, deps.paperTradingConfig),
        realizedPnlSol: Number(realizedPnlSol.toFixed(6)),
      },
      positions,
    };
  });
}
