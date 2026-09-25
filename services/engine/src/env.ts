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
  JUPITER_API_BASE_URL: z.string().default("https://api.jup.ag"),
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

  // /build-swap (F4): wallet che incassa la platform fee (come ATA wSOL).
  // Opzionale: se assente, /build-swap risponde 503 invece di costruire una
  // tx senza un posto dove incassare la fee.
  TREASURY_WALLET_PUBKEY: z.string().optional(),

  // Hardening (F5). KILL_SWITCH=true forza lo stop all'avvio; poi lo stato è
  // persistito e modificabile a runtime da POST /admin/kill-switch.
  KILL_SWITCH: z.enum(["true", "false"]).default("false").transform((v) => v === "true"),
  // Chiave per gli endpoint /admin/*. Se assente gli endpoint admin non esistono (404).
  ADMIN_API_KEY: z.string().min(16).optional(),
  // Tetto assoluto per singola richiesta /build-swap, indipendente dal limite del 20%.
  MAX_SWAP_SOL: z.coerce.number().positive().default(5),
  // Rate limit di /build-swap per wallet (richieste al minuto).
  BUILD_SWAP_RATE_LIMIT_PER_MIN: z.coerce.number().int().positive().default(10),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  // Un "KEY=" vuoto in .env (tutte le chiavi opzionali in .env.example sono
  // scritte così) va trattato come "non impostato", non come stringa vuota:
  // altrimenti z.string().default(...) non scatta mai (il default si applica
  // solo a `undefined`, non a ""), e i controlli fail-soft basati su troncamento
  // vero/falso restano comunque corretti ma il valore letto sarebbe "" invece
  // che il default atteso.
  const normalized = Object.fromEntries(
    Object.entries(source).map(([key, value]) => [key, value === "" ? undefined : value]),
  );
  return envSchema.parse(normalized);
}
