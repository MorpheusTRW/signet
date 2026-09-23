import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace"])
    .default("info"),
  TRADING_MODE: z.enum(["paper", "live"]).default("paper"),
  EVENT_SOURCE: z
    .enum(["synthetic", "helius-ws", "yellowstone-grpc"])
    .default("synthetic"),
  HELIUS_API_KEY: z.string().optional(),
  JUPITER_API_BASE_URL: z.string().optional(),
  FIREBASE_PROJECT_ID: z.string().optional(),
  FIREBASE_CLIENT_EMAIL: z.string().optional(),
  FIREBASE_PRIVATE_KEY: z.string().optional(),
  DATABASE_PATH: z.string().default("./data/seeker-signal.db"),
  MAX_PORTFOLIO_EXPOSURE: z.coerce.number().min(0).max(1).default(0.2),
  // Paper trading (F1): portafoglio simulato, nessun fondo reale coinvolto.
  PAPER_PORTFOLIO_SOL: z.coerce.number().positive().default(100),
  PAPER_DEFAULT_POSITION_SOL: z.coerce.number().positive().default(2),
  SYNTHETIC_INTERVAL_MS: z.coerce.number().int().positive().default(8000),

  // RPC per letture on-chain reali (saldo/stake SKR per il tier HOLDER).
  // Opzionale: se assente, la verifica HOLDER degrada a "non holder" (fail-closed).
  SOLANA_RPC_URL: z.string().optional(),

  // Monetizzazione (CLAUDE.md, sezione Monetizzazione): soglie e bps in config.
  FREE_SIGNAL_DELAY_SECONDS: z.coerce.number().int().nonnegative().default(45),
  FREE_MAX_SIGNALS_PER_DAY: z.coerce.number().int().positive().default(20),
  FREE_HISTORY_HOURS: z.coerce.number().positive().default(24),
  PRO_SUBSCRIPTION_DAYS: z.coerce.number().int().positive().default(30),
  HOLDER_MIN_SKR: z.coerce.number().positive().default(10_000),
  FREE_PLATFORM_FEE_BPS: z.coerce.number().int().min(0).max(10_000).default(75),
  PRO_PLATFORM_FEE_BPS: z.coerce.number().int().min(0).max(10_000).default(50),
  HOLDER_PLATFORM_FEE_BPS: z.coerce.number().int().min(0).max(10_000).default(30),
  HOLDER_CACHE_TTL_MS: z.coerce.number().int().positive().default(10 * 60 * 1000),

  // Push FCM (F3): intervallo di polling delle notifiche pianificate e dovute.
  PUSH_DISPATCH_INTERVAL_MS: z.coerce.number().int().positive().default(5000),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  return envSchema.parse(source);
}
