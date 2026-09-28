import { pubkeySchema } from "@seeker-signal/shared";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { MarketsRepo } from "../db/markets-repo.js";
import type { SignalsRepo } from "../db/signals-repo.js";
import type { UserPosition, UserPositionsRepo } from "../db/user-positions-repo.js";
import type { ResolveTierDeps } from "../entitlements/resolve-tier.js";
import { resolveTier } from "../entitlements/resolve-tier.js";
import type { RpcCall } from "../ingest/helius/rpc.js";
import { type PoolReserves, readPoolReserves, simulateBuy, simulateSell } from "../market/pool.js";
import { paperPortfolio } from "../paper-trading/engine.js";
import type { PaperTradingConfig } from "../paper-trading/types.js";
import type { KillSwitch } from "../safety/kill-switch.js";

export interface PositionsRouteDeps {
  userPositionsRepo: UserPositionsRepo;
  signalsRepo: SignalsRepo;
  marketsRepo: MarketsRepo;
  paperTradingConfig: PaperTradingConfig;
  resolveTierDeps: ResolveTierDeps;
  killSwitch: KillSwitch;
  tradingMode: "paper" | "live";
  maxSwapSol: number;
  /** RPC per le riserve reali delle pool; undefined = prezzi non disponibili. */
  rpc: RpcCall | undefined;
}

const listQuery = z.object({ pubkey: pubkeySchema });
const openBody = z.object({
  signalId: z.string().uuid(),
  pubkey: pubkeySchema,
  amountSol: z.number().positive(),
});
const closeBody = z.object({ pubkey: pubkeySchema });

/**
 * Posizioni dell'utente (mai aperte in automatico dal server). In paper mode una
 * posizione si apre quando l'utente conferma "Verify (paper)": il fill è simulato
 * sulle riserve REALI della pool in quell'istante (prodotto costante, fee di
 * piattaforma inclusa), e valore/PnL seguono il prezzo reale.
 */
export function registerPositionsRoutes(app: FastifyInstance, deps: PositionsRouteDeps): void {
  async function reservesFor(positions: UserPosition[]): Promise<Map<string, PoolReserves | null>> {
    const result = new Map<string, PoolReserves | null>();
    if (!deps.rpc) return result;
    const withMarket = positions
      .map((p) => ({ id: p.id, market: deps.marketsRepo.find(p.signalId) }))
      .filter((x): x is { id: string; market: NonNullable<typeof x.market> } => !!x.market);
    if (withMarket.length === 0) return result;
    const reserves = await readPoolReserves(deps.rpc, withMarket.map((x) => x.market));
    withMarket.forEach((x, i) => result.set(x.id, reserves[i] ?? null));
    return result;
  }

  app.get("/positions", async (request, reply) => {
    const query = listQuery.safeParse(request.query);
    if (!query.success) return reply.status(400).send({ error: "invalid_query" });

    const positions = deps.userPositionsRepo.listByWallet(query.data.pubkey, "paper");
    const open = positions.filter((p) => p.status === "open");
    let reserves = new Map<string, PoolReserves | null>();
    try {
      reserves = await reservesFor(open);
    } catch (error) {
      request.log.warn({ err: error }, "positions: riserve non leggibili");
    }

    const items = positions.map((p) => {
      const signal = deps.signalsRepo.findById(p.signalId);
      let valueSol: number | null = null;
      if (p.status === "closed") valueSol = p.exitValueSol;
      else if (reserves.has(p.id)) {
        const pool = reserves.get(p.id);
        valueSol = pool ? simulateSell(pool, p.tokenAmount) : 0;
      }
      const pnlSol = valueSol === null ? null : valueSol - p.sizeSol;
      return {
        id: p.id,
        signalId: p.signalId,
        tokenSymbol: signal?.tokenSymbol ?? null,
        tokenName: signal?.tokenName ?? null,
        imageUrl: signal?.imageUrl ?? null,
        status: p.status,
        sizeSol: p.sizeSol,
        tokenAmount: p.tokenAmount,
        entryPriceSol: p.entryPriceSol,
        openedAt: p.openedAt,
        closedAt: p.closedAt,
        valueSol: valueSol === null ? null : Number(valueSol.toFixed(6)),
        pnlSol: pnlSol === null ? null : Number(pnlSol.toFixed(6)),
        pnlPct: pnlSol === null ? null : Number(((pnlSol / p.sizeSol) * 100).toFixed(2)),
      };
    });

    const openItems = items.filter((i) => i.status === "open");
    const unrealizedPnlSol = openItems.every((i) => i.pnlSol !== null)
      ? Number(openItems.reduce((sum, i) => sum + (i.pnlSol ?? 0), 0).toFixed(6))
      : null;

    return {
      mode: deps.tradingMode,
      portfolio: {
        ...paperPortfolio(positions, deps.paperTradingConfig),
        startingBalanceSol: deps.paperTradingConfig.balanceSol,
        maxExposureFraction: deps.paperTradingConfig.maxExposureFraction,
        unrealizedPnlSol,
      },
      positions: items,
    };
  });

  app.post("/positions/paper", async (request, reply) => {
    const body = openBody.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: "invalid_body" });
    const { signalId, pubkey, amountSol } = body.data;

    if (deps.tradingMode !== "paper") {
      return reply.status(409).send({ error: "not_paper_mode", message: "Paper positions are only available in paper mode." });
    }
    if (deps.killSwitch.isActive()) {
      return reply.status(503).send({ error: "kill_switch_active", message: "Trading is temporarily paused." });
    }
    if (amountSol > deps.maxSwapSol) {
      return reply.status(409).send({ error: "amount_exceeds_cap", message: `Maximum amount per trade: ${deps.maxSwapSol} SOL` });
    }
    const signal = deps.signalsRepo.findById(signalId);
    const market = deps.marketsRepo.find(signalId);
    if (!signal || !market || !deps.rpc) {
      return reply.status(409).send({ error: "no_market", message: "Live price data is not available for this signal." });
    }

    const portfolio = paperPortfolio(deps.userPositionsRepo.listByWallet(pubkey, "paper"), deps.paperTradingConfig);
    if (amountSol > portfolio.remainingSol) {
      return reply.status(409).send({
        error: "exposure_limit_exceeded",
        message: `Portfolio exposure limit (${deps.paperTradingConfig.maxExposureFraction * 100}%) exceeded: ${portfolio.remainingSol.toFixed(4)} SOL remaining`,
        remainingSol: portfolio.remainingSol,
      });
    }

    const [pool] = await readPoolReserves(deps.rpc, [market]);
    if (!pool) {
      return reply.status(409).send({ error: "pool_closed", message: "The pool has no liquidity left." });
    }

    // Stessa fee di piattaforma che si pagherebbe davvero con il tier del wallet.
    const { limits } = await resolveTier(pubkey, deps.resolveTierDeps);
    const tokens = simulateBuy(pool, amountSol * (1 - limits.platformFeeBps / 10_000));
    const position = deps.userPositionsRepo.open({
      walletPubkey: pubkey,
      signalId,
      mode: "paper",
      sizeSol: amountSol,
      tokenAmount: tokens,
      entryPriceSol: amountSol / tokens,
    });
    request.log.info({ pubkey, signalId, amountSol }, "posizione paper aperta");
    return reply.status(201).send(position);
  });

  app.post<{ Params: { id: string } }>("/positions/:id/close", async (request, reply) => {
    const body = closeBody.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: "invalid_body" });
    const position = deps.userPositionsRepo.find(request.params.id);
    if (!position || position.walletPubkey !== body.data.pubkey) {
      return reply.status(404).send({ error: "position_not_found" });
    }
    if (position.status !== "open") return reply.status(409).send({ error: "already_closed" });
    const market = deps.marketsRepo.find(position.signalId);
    if (!market || !deps.rpc) {
      return reply.status(409).send({ error: "no_market", message: "Live price data is not available." });
    }
    const [pool] = await readPoolReserves(deps.rpc, [market]);
    const exitValueSol = pool ? simulateSell(pool, position.tokenAmount) : 0;
    deps.userPositionsRepo.close(position.id, exitValueSol);
    return reply.send({ ...deps.userPositionsRepo.find(position.id), pnlSol: exitValueSol - position.sizeSol });
  });
}
