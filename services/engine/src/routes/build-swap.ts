import {
  getAssociatedTokenAddressSync,
  getMint,
  NATIVE_MINT,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { type Connection, PublicKey } from "@solana/web3.js";
import { swapRequestSchema } from "@seeker-signal/shared";
import type { FastifyInstance } from "fastify";
import { isJupiterRoutable } from "../config/jupiter.js";
import type { PaperTradesRepo } from "../db/paper-trades-repo.js";
import type { SignalsRepo } from "../db/signals-repo.js";
import type { ResolveTierDeps } from "../entitlements/resolve-tier.js";
import { resolveTier } from "../entitlements/resolve-tier.js";
import { remainingExposureSol } from "../paper-trading/engine.js";
import type { PaperTradingConfig } from "../paper-trading/types.js";
import { buildVersionedTransaction } from "../swap/build-transaction.js";
import type { KillSwitch } from "../safety/kill-switch.js";
import type { RateLimiter } from "../safety/rate-limiter.js";
import { buildJupiterSwap } from "../swap/jupiter-client.js";

export interface BuildSwapRouteDeps {
  signalsRepo: SignalsRepo;
  paperTradesRepo: PaperTradesRepo;
  paperTradingConfig: PaperTradingConfig;
  resolveTierDeps: ResolveTierDeps;
  /** undefined se SOLANA_RPC_URL non è configurato. */
  connection: Connection | undefined;
  /** undefined se TREASURY_WALLET_PUBKEY non è configurato. */
  treasuryWalletPubkey: string | undefined;
  jupiterApiBaseUrl: string;
  tradingMode: "paper" | "live";
  killSwitch: KillSwitch;
  rateLimiter: RateLimiter;
  /** Tetto assoluto per singola richiesta, oltre al limite del 20% del portafoglio. */
  maxSwapSol: number;
}

export function registerBuildSwapRoute(app: FastifyInstance, deps: BuildSwapRouteDeps): void {
  app.post("/build-swap", async (request, reply) => {
    const body = swapRequestSchema.safeParse(request.body);
    if (!body.success) {
      return reply
        .status(400)
        .send({ error: "invalid_body", details: body.error.flatten() });
    }

    // Il kill switch viene prima di tutto: niente costruzione, niente chiamate esterne.
    if (deps.killSwitch.isActive()) {
      request.log.warn({ pubkey: body.data.pubkey }, "build-swap bloccato: kill switch attivo");
      return reply.status(503).send({
        error: "kill_switch_active",
        message: "Trading temporaneamente sospeso.",
      });
    }

    if (!deps.rateLimiter.tryAcquire(body.data.pubkey)) {
      return reply.status(429).send({
        error: "rate_limited",
        message: "Troppe richieste, riprova tra un minuto.",
      });
    }

    if (body.data.amountSol > deps.maxSwapSol) {
      return reply.status(409).send({
        error: "amount_exceeds_cap",
        message: `Importo massimo per singola operazione: ${deps.maxSwapSol} SOL`,
        maxSol: deps.maxSwapSol,
      });
    }

    if (!deps.connection || !deps.treasuryWalletPubkey) {
      return reply.status(503).send({
        error: "not_configured",
        message: "SOLANA_RPC_URL e/o TREASURY_WALLET_PUBKEY non configurati",
      });
    }
    const connection = deps.connection;
    const treasuryWalletPubkey = deps.treasuryWalletPubkey;

    const { signalId, pubkey, amountSol, slippageBps } = body.data;

    const signal = deps.signalsRepo.findById(signalId);
    if (!signal) {
      return reply.status(404).send({ error: "signal_not_found" });
    }

    // Jupiter instrada solo pool AMM: i token ancora in bonding curve (pump.fun
    // pre-migrazione, Meteora DBC, Raydium LaunchLab) richiedono un adapter
    // dedicato, non ancora implementato. Vedi src/config/jupiter.ts.
    if (!isJupiterRoutable(signal.program)) {
      return reply.status(409).send({
        error: "not_routable",
        message: `Il program "${signal.program}" è ancora in bonding curve: Jupiter non lo instrada. Serve un adapter dedicato (non ancora implementato, vedi PROGRESS.md).`,
      });
    }

    // Controllo del limite del 20% PRIMA di costruire la transazione (CLAUDE.md, principio 3).
    const openExposureSol = deps.paperTradesRepo.sumOpenExposureSol();
    const remaining = remainingExposureSol(openExposureSol, deps.paperTradingConfig);
    if (amountSol > remaining) {
      return reply.status(409).send({
        error: "exposure_limit_exceeded",
        message: `Limite di esposizione del 20% del portafoglio superato: margine residuo ${remaining.toFixed(4)} SOL`,
        remainingSol: remaining,
      });
    }

    const { limits } = await resolveTier(pubkey, deps.resolveTierDeps);

    const treasuryPubkey = new PublicKey(treasuryWalletPubkey);
    const feeAccount = getAssociatedTokenAddressSync(NATIVE_MINT, treasuryPubkey);
    const amountLamports = BigInt(Math.round(amountSol * 1_000_000_000));

    let jupiterResponse;
    try {
      jupiterResponse = await buildJupiterSwap(deps.jupiterApiBaseUrl, {
        inputMint: NATIVE_MINT.toBase58(),
        outputMint: signal.tokenMint,
        amountLamports,
        taker: pubkey,
        slippageBps,
        platformFeeBps: limits.platformFeeBps,
        feeAccount: feeAccount.toBase58(),
      });
    } catch (error) {
      request.log.warn({ err: error }, "Jupiter /build fallito");
      return reply.status(502).send({
        error: "jupiter_error",
        message: error instanceof Error ? error.message : String(error),
      });
    }

    const transaction = await buildVersionedTransaction(connection, pubkey, jupiterResponse);
    const transactionBase64 = Buffer.from(transaction.serialize()).toString("base64");

    const feeSol =
      limits.platformFeeBps > 0
        ? Number(((amountSol * limits.platformFeeBps) / 10_000).toFixed(9))
        : 0;

    let outAmountUi: number | null = null;
    try {
      const mintKey = new PublicKey(signal.tokenMint);
      // I mint nuovi sono spesso Token-2022: getMint legge solo il program indicato.
      const mint = await getMint(connection, mintKey, undefined, TOKEN_PROGRAM_ID).catch(() =>
        getMint(connection, mintKey, undefined, TOKEN_2022_PROGRAM_ID),
      );
      outAmountUi = Number(jupiterResponse.outAmount) / 10 ** mint.decimals;
    } catch {
      outAmountUi = null;
    }

    request.log.info(
      {
        signalId,
        pubkey,
        amountSol,
        feeBps: limits.platformFeeBps,
        tradingMode: deps.tradingMode,
      },
      "build-swap: tx costruita",
    );

    return reply.status(200).send({
      transactionBase64,
      amountSol,
      feeBps: limits.platformFeeBps,
      feeSol,
      feeAccount: feeAccount.toBase58(),
      // Per confermare la tx dopo l'invio: connection.confirmTransaction({signature, blockhash, lastValidBlockHeight}).
      blockhash: transaction.message.recentBlockhash,
      lastValidBlockHeight: jupiterResponse.blockhashWithMetadata.lastValidBlockHeight,
      quote: {
        outAmount: jupiterResponse.outAmount,
        outAmountUi,
        otherAmountThreshold: jupiterResponse.otherAmountThreshold,
        priceImpactPct: jupiterResponse.priceImpactPct,
        slippageBps,
      },
      tradingMode: deps.tradingMode,
    });
  });
}
