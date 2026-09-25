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

export interface PortfolioSummary {
  valueSol: number
  maxExposureFraction: number
  openExposureSol: number
  remainingSol: number
  realizedPnlSol: number
}

export interface PositionItem {
  id: string
  signalId: string
  sizeSol: number
  outcomeMultiplier: number
  pnlSol: number
  status: 'open' | 'closed'
  openedAt: string
  closesAt: string
  closedAt: string | null
  tokenSymbol: string | null
  tokenName: string | null
}

export interface PositionsResponse {
  portfolio: PortfolioSummary
  positions: PositionItem[]
}
