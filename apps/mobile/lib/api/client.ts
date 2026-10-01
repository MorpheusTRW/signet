import type { Signal, SwapRequest } from '@seeker-signal/shared'
import { AppConfig } from '@/constants/app-config'
import type {
  BuildSwapErrorBody,
  BuildSwapResponse,
  CallsFilter,
  CallsResponse,
  DodgedResponse,
  EngineStatus,
  MeTierResponse,
  PositionsResponse,
  RadarResponse,
  RecapResponse,
  RegisterDeviceResponse,
  TrackRecordStats,
} from './types'

export class BuildSwapError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: BuildSwapErrorBody,
  ) {
    super(body.message ?? body.error)
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${AppConfig.engineApiUrl}${path}`, init)
  if (!response.ok) {
    throw new Error(`Engine API ${path} -> ${response.status}`)
  }
  return (await response.json()) as T
}

export function getSignals(params: { pubkey?: string; limit?: number } = {}): Promise<Signal[]> {
  const query = new URLSearchParams()
  if (params.pubkey) query.set('pubkey', params.pubkey)
  if (params.limit) query.set('limit', String(params.limit))
  const qs = query.toString()
  return request<Signal[]>(`/signals${qs ? `?${qs}` : ''}`)
}

export function getSignal(id: string): Promise<Signal> {
  return request<Signal>(`/signals/${encodeURIComponent(id)}`)
}

export function getMeTier(pubkey: string): Promise<MeTierResponse> {
  return request<MeTierResponse>(`/me/tier?pubkey=${encodeURIComponent(pubkey)}`)
}

export function getStatus(): Promise<EngineStatus> {
  return request<EngineStatus>('/status')
}

export function getPositions(pubkey: string): Promise<PositionsResponse> {
  return request<PositionsResponse>(`/positions?pubkey=${encodeURIComponent(pubkey)}`)
}

/** Errore dell'engine col messaggio leggibile restituito dal server. */
async function postJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${AppConfig.engineApiUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = (await response.json()) as T & { message?: string; error?: string }
  if (!response.ok) throw new Error(json.message ?? json.error ?? `Engine API ${path} -> ${response.status}`)
  return json
}

/** Apre una posizione paper al prezzo reale della pool (solo in paper mode). */
export function openPaperPosition(params: { signalId: string; pubkey: string; amountSol: number }) {
  return postJson<{ id: string; tokenAmount: number; entryPriceSol: number }>('/positions/paper', params)
}

export function closePosition(id: string, pubkey: string) {
  return postJson<{ id: string; pnlSol: number }>(`/positions/${encodeURIComponent(id)}/close`, { pubkey })
}

export function getRadar(): Promise<RadarResponse> {
  return request<RadarResponse>('/radar')
}

export function getDodged(pubkey?: string): Promise<DodgedResponse> {
  return request<DodgedResponse>(`/dodged${pubkey ? `?pubkey=${encodeURIComponent(pubkey)}` : ''}`)
}

export function getRecap(pubkey: string): Promise<RecapResponse> {
  return request<RecapResponse>(`/recap?pubkey=${encodeURIComponent(pubkey)}`)
}

export function getCalls(params: { pubkey: string; filter: CallsFilter; before?: string }): Promise<CallsResponse> {
  const query = new URLSearchParams({ pubkey: params.pubkey, filter: params.filter })
  if (params.before) query.set('before', params.before)
  return request<CallsResponse>(`/calls?${query.toString()}`)
}

export function getTrackRecord(): Promise<TrackRecordStats> {
  return request<TrackRecordStats>('/track-record')
}

export function registerDevice(params: { fcmToken: string; walletPubkey: string }): Promise<RegisterDeviceResponse> {
  return request<RegisterDeviceResponse>('/devices', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
}

export async function buildSwap(params: SwapRequest): Promise<BuildSwapResponse> {
  const response = await fetch(`${AppConfig.engineApiUrl}/build-swap`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
  const json = await response.json()
  if (!response.ok) {
    throw new BuildSwapError(response.status, json as BuildSwapErrorBody)
  }
  return json as BuildSwapResponse
}
