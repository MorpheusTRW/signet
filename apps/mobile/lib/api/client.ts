import type { Signal } from '@seeker-signal/shared'
import { AppConfig } from '@/constants/app-config'
import type { MeTierResponse, TrackRecordStats } from './types'

async function request<T>(path: string): Promise<T> {
  const response = await fetch(`${AppConfig.engineApiUrl}${path}`)
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

export function getTrackRecord(): Promise<TrackRecordStats> {
  return request<TrackRecordStats>('/track-record')
}
