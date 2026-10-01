import type { Signal } from '@seeker-signal/shared'

// Tipi di risposta specifici dell'engine, non presenti in @seeker-signal/shared
// (che copre solo Signal/RiskReport/SwapRequest). Devono restare in sync a
// mano con services/engine/src/entitlements/types.ts e
// services/engine/src/track-record/aggregate.ts.

export type Tier = 'free' | 'pro' | 'holder'

export interface TierLimits {
  signalDelaySeconds: number
  maxSignalsPerDay: number | null
  historyHours: number | null
  customFilters: boolean
  platformFeeBps: number
}

export interface MeTierResponse {
  pubkey: string
  tier: Tier
  expiresAt: string | null
  limits: TierLimits
  /** Segnali passati dai filtri già ricevuti oggi (UTC): quota FREE. */
  signalsToday: number
}

export interface CategoryWindowStats {
  settledCount: number
  avgChangePct: number | null
  medianChangePct: number | null
  bigLossCount: number
  bigGainCount: number
}

export interface CategoryStats {
  total: number
  window1h: CategoryWindowStats
  window24h: CategoryWindowStats
}

export interface TrackRecordStats {
  /** "real" = prezzi letti dalle pool on-chain; "synthetic" = solo in sviluppo. */
  source: 'real' | 'synthetic'
  discarded: CategoryStats
  signaled: CategoryStats
}

export interface RegisterDeviceResponse {
  deviceId: string
  walletPubkey: string
  apiKey: string
  createdAt: string
}

export interface BuildSwapQuote {
  outAmount: string
  outAmountUi: number | null
  otherAmountThreshold: string
  priceImpactPct: string
  slippageBps: number
}

export interface BuildSwapResponse {
  transactionBase64: string
  amountSol: number
  feeBps: number
  feeSol: number
  feeAccount: string
  blockhash: string
  lastValidBlockHeight: number
  quote: BuildSwapQuote
  tradingMode: 'paper' | 'live'
}

export interface BuildSwapErrorBody {
  error: string
  message?: string
  remainingSol?: number
}

export interface EngineStatus {
  killSwitch: boolean
  tradingMode: 'paper' | 'live'
}

// In sync con services/engine/src/routes/positions.ts.
export interface PortfolioSummary {
  /** Saldo virtuale iniziale + PnL realizzato (paper). */
  balanceSol: number
  startingBalanceSol: number
  maxExposureFraction: number
  openExposureSol: number
  remainingSol: number
  realizedPnlSol: number
  /** null se i prezzi delle pool non sono leggibili in questo momento. */
  unrealizedPnlSol: number | null
}

export interface PositionItem {
  id: string
  signalId: string
  tokenSymbol: string | null
  tokenName: string | null
  imageUrl: string | null
  status: 'open' | 'closed'
  sizeSol: number
  tokenAmount: number
  entryPriceSol: number
  openedAt: string
  closedAt: string | null
  /** Valore attuale (aperta) o incassato (chiusa); null se il prezzo non è leggibile. */
  valueSol: number | null
  pnlSol: number | null
  pnlPct: number | null
}

export interface PositionsResponse {
  mode: 'paper' | 'live'
  portfolio: PortfolioSummary
  positions: PositionItem[]
}

// In sync con services/engine/src/routes/engagement.ts.
export interface RejectedToken {
  signalId: string
  tokenSymbol: string | null
  tokenName: string | null
  imageUrl: string | null
  /** Motivo più pesante dello scarto. */
  reason: string
  createdAt: string
}

export interface RadarResponse {
  since: string
  scannedToday: number
  rejectedToday: number
  recentRejected: RejectedToken[]
}

export interface DisciplineStreak {
  days: number
  /** Ultimi 7 giorni (dal più vecchio a oggi): true se dentro la streak. */
  lastSevenDays: boolean[]
  panicSellWindowMinutes: number
  maxExposureFraction: number
}

export interface DodgedResponse {
  windowHours: number
  rugThresholdPct: number
  rejectedCount: number
  rugCount: number
  rugs: (RejectedToken & { changePct: number })[]
  streak: DisciplineStreak | null
}

export interface RecapResponse {
  year: number
  week: number
  weekStart: string
  rugsDodged: number
  signalsApproved: number
  streakDays: number
}

// In sync con services/engine/src/routes/calls.ts.
export type CallsFilter = 'all' | 'passed' | 'rejected'

export interface CallOutcome {
  change1hPct: number | null
  change24hPct: number | null
  /** Variazione dal segnale a adesso, letta dalla pool (null = non leggibile). */
  nowPct: number | null
}

export interface CallsResponse {
  tier: Tier
  /** null = storico completo (PRO/HOLDER). */
  windowHours: number | null
  delaySeconds: number
  counts: { total: number; passed: number; rejected: number }
  calls: { signal: Signal; outcome: CallOutcome }[]
  nextBefore: string | null
}
