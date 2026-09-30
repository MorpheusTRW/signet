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
  // Tetto giornaliero di chiamate Enhanced Transactions (100 crediti l'una, 2 per segnale):
  // 200 = max ~20k crediti/giorno, dentro il piano gratuito da 1M/mese. Oltre, snipe e
  // storico dev restano "non verificati" fino al giorno dopo.
  HELIUS_ENHANCED_DAILY_LIMIT: z.coerce.number().int().nonnegative().default(200),
  JUPITER_API_BASE_URL: z.string().default("https://api.jup.ag"),
  FIREBASE_PROJECT_ID: z.string().optional(),
  FIREBASE_CLIENT_EMAIL: z.string().optional(),
  FIREBASE_PRIVATE_KEY: z.string().optional(),
  DATABASE_PATH: z.string().default("./data/seeker-signal.db"),
  MAX_PORTFOLIO_EXPOSURE: z.coerce.number().min(0).max(1).default(0.2),
  // Paper mode: saldo virtuale di partenza di ogni wallet (le posizioni le apre solo l'utente).
  PAPER_BALANCE_SOL: z.coerce.number().positive().default(10),
  // Intervallo (ms) del settlement delle marcature di track record reali (prezzo dalla pool).
  TRACK_RECORD_SETTLE_INTERVAL_MS: z.coerce.number().int().positive().default(60_000),
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
  // I segnali ad alto rischio restano nel feed; con "true" generano anche la push.
  PUSH_HIGH_RISK_SIGNALS: z.enum(["true", "false"]).default("false").transform((v) => v === "true"),

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

  // Engagement (radar, rug schivati, recap): premia le buone decisioni, mai il volume.
  // Un token scartato conta come "rug schivato" se il suo prezzo scende almeno di questa %.
  RUG_THRESHOLD_PCT: z.coerce.number().min(-100).max(0).default(-90),
  // Chiusura in perdita entro N minuti dall'apertura = "panic sell": azzera la streak di disciplina.
  PANIC_SELL_WINDOW_MINUTES: z.coerce.number().positive().default(15),
  // Le riserve delle pool per /dodged sono rilette al massimo ogni N ms (condivise fra i wallet).
  DODGED_CACHE_TTL_MS: z.coerce.number().int().positive().default(60_000),

  // Privacy policy servita su GET /privacy (richiesta dalla Publisher Policy del
  // dApp Store). Senza entrambi i campi la pagina non viene pubblicata (404).
  PRIVACY_CONTROLLER_NAME: z.string().optional(),
  PRIVACY_CONTACT_EMAIL: z.string().email().optional(),
  PRIVACY_LAST_UPDATED: z.string().optional(),
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
