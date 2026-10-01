import { pubkeySchema, type Signal } from "@seeker-signal/shared";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { MarketsRepo } from "../db/markets-repo.js";
import type { SignalsRepo } from "../db/signals-repo.js";
import type { TrackRecordsRepo } from "../db/track-records-repo.js";
import type { ResolveTierDeps } from "../entitlements/resolve-tier.js";
import { resolveTier } from "../entitlements/resolve-tier.js";
import type { RpcCall } from "../ingest/helius/rpc.js";
import { readPoolReserves, spotPriceSol } from "../market/pool.js";

export interface CallsRouteDeps {
  signalsRepo: SignalsRepo;
  trackRecordsRepo: TrackRecordsRepo;
  marketsRepo: MarketsRepo;
  resolveTierDeps: ResolveTierDeps;
  /** RPC per il prezzo attuale delle pool della pagina; undefined = non disponibile. */
  rpc: RpcCall | undefined;
}

const querySchema = z.object({
  pubkey: pubkeySchema,
  filter: z.enum(["all", "passed", "rejected"]).default("all"),
  before: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(30),
});

export interface CallOutcome {
  /** Variazione dal segnale a +1h / +24h (null = non ancora misurata o mancata). */
  change1hPct: number | null;
  change24hPct: number | null;
  /** Variazione dal segnale a adesso, letta dalla pool (null = non leggibile). */
  nowPct: number | null;
}

/**
 * Storico delle chiamate per il wallet, coi limiti del suo tier: FREE vede le ultime
 * `historyHours` (24h di default) e col suo ritardo; PRO/HOLDER tutto, da sempre.
 * Ogni chiamata porta il suo esito misurato on-chain, anche quando è andato male.
 */
export function registerCallsRoutes(app: FastifyInstance, deps: CallsRouteDeps): void {
  async function nowChanges(signals: Signal[]): Promise<Map<string, number>> {
    const result = new Map<string, number>();
    if (!deps.rpc) return result;
    const markets = signals
      .map((s) => deps.marketsRepo.find(s.id))
      .filter((m): m is NonNullable<typeof m> => !!m && m.priceSolAtSignal > 0);
    if (markets.length === 0) return result;
    const reserves = await readPoolReserves(deps.rpc, markets);
    markets.forEach((market, index) => {
      const pool = reserves[index];
      // Pool chiusa o vault vuoto: liquidità ritirata, per chi deteneva il token vale zero.
      const change = pool ? (spotPriceSol(pool) / market.priceSolAtSignal - 1) * 100 : -100;
      result.set(market.signalId, Number(change.toFixed(2)));
    });
    return result;
  }

  app.get("/calls", async (request, reply) => {
    const query = querySchema.safeParse(request.query);
    if (!query.success) return reply.status(400).send({ error: "invalid_query" });
    const { pubkey, filter, before, limit } = query.data;

    const now = new Date();
    const { tier, limits } = await resolveTier(pubkey, deps.resolveTierDeps, now);
    const sinceIso =
      limits.historyHours != null ? new Date(now.getTime() - limits.historyHours * 3_600_000).toISOString() : null;
    const untilIso = new Date(now.getTime() - limits.signalDelaySeconds * 1000).toISOString();

    const page = deps.signalsRepo.listPage({ sinceIso, untilIso, beforeIso: before ?? null, filter, limit });
    const marks = deps.trackRecordsRepo.findBySignalIds(page.map((s) => s.id));
    let live = new Map<string, number>();
    try {
      live = await nowChanges(page);
    } catch (error) {
      request.log.warn({ err: error }, "calls: prezzi attuali non leggibili");
    }

    const { total, rejected } = deps.signalsRepo.countWindow({ sinceIso, untilIso });
    return {
      tier,
      windowHours: limits.historyHours,
      delaySeconds: limits.signalDelaySeconds,
      counts: { total, passed: total - rejected, rejected },
      calls: page.map((signal) => {
        const mark = marks.get(signal.id);
        const outcome: CallOutcome = {
          change1hPct: mark?.priceChange1hPct ?? null,
          change24hPct: mark?.priceChange24hPct ?? null,
          nowPct: live.get(signal.id) ?? null,
        };
        return { signal, outcome };
      }),
      nextBefore: page.length === limit ? page[page.length - 1]!.createdAt : null,
    };
  });
}
