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
