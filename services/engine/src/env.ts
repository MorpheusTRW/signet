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
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  return envSchema.parse(source);
}
