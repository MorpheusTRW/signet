import type { Signal } from "@seeker-signal/shared";
import type { DbClient } from "./client.js";

interface SignalRow {
  id: string;
  created_at: string;
  program: Signal["program"];
  token_mint: string;
  pool_address: string;
  token_symbol: string | null;
  token_name: string | null;
  image_url: string | null;
  initial_liquidity_sol: number;
  risk_score: number;
  risk_level: Signal["riskReport"]["level"];
  risk_reasons: string;
  summary: string;
}

function rowToSignal(row: SignalRow): Signal {
  return {
    id: row.id,
    createdAt: row.created_at,
    program: row.program,
    tokenMint: row.token_mint,
    poolAddress: row.pool_address,
    ...(row.token_symbol !== null && { tokenSymbol: row.token_symbol }),
    ...(row.token_name !== null && { tokenName: row.token_name }),
    ...(row.image_url !== null && { imageUrl: row.image_url }),
    initialLiquiditySol: row.initial_liquidity_sol,
    riskReport: {
      score: row.risk_score,
      level: row.risk_level,
      reasons: JSON.parse(row.risk_reasons) as string[],
    },
    summary: row.summary,
  };
}

export class SignalsRepo {
  constructor(private readonly db: DbClient) {}

  insert(signal: Signal): void {
    this.db
      .prepare(
        `INSERT INTO signals (
          id, created_at, program, token_mint, pool_address,
          token_symbol, token_name, image_url, initial_liquidity_sol,
          risk_score, risk_level, risk_reasons, summary
        ) VALUES (
          @id, @createdAt, @program, @tokenMint, @poolAddress,
          @tokenSymbol, @tokenName, @imageUrl, @initialLiquiditySol,
          @riskScore, @riskLevel, @riskReasons, @summary
        )`,
      )
      .run({
        id: signal.id,
        createdAt: signal.createdAt,
        program: signal.program,
        tokenMint: signal.tokenMint,
        poolAddress: signal.poolAddress,
        tokenSymbol: signal.tokenSymbol ?? null,
        imageUrl: signal.imageUrl ?? null,
        tokenName: signal.tokenName ?? null,
        initialLiquiditySol: signal.initialLiquiditySol,
        riskScore: signal.riskReport.score,
        riskLevel: signal.riskReport.level,
        riskReasons: JSON.stringify(signal.riskReport.reasons),
        summary: signal.summary,
      });
  }

  findById(id: string): Signal | undefined {
    const row = this.db
      .prepare("SELECT * FROM signals WHERE id = ?")
      .get(id) as SignalRow | undefined;
    return row ? rowToSignal(row) : undefined;
  }

  list(limit: number): Signal[] {
    const rows = this.db
      .prepare("SELECT * FROM signals ORDER BY created_at DESC LIMIT ?")
      .all(limit) as SignalRow[];
    return rows.map(rowToSignal);
  }

  /** Segnali con createdAt >= sinceIso (o tutti, se sinceIso è null), più recenti prima. */
  listSince(sinceIso: string | null, limit: number): Signal[] {
    if (sinceIso === null) {
      return this.list(limit);
    }
    const rows = this.db
      .prepare(
        "SELECT * FROM signals WHERE created_at >= ? ORDER BY created_at DESC LIMIT ?",
      )
      .all(sinceIso, limit) as SignalRow[];
    return rows.map(rowToSignal);
  }
}
