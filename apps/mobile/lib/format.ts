/** "just now", "3m ago", "2h ago", "4d ago". */
export function timeAgo(iso: string, now: number = Date.now()): string {
  const seconds = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000))
  if (seconds < 45) return 'just now'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

export function shortAddress(address: string, chars = 4): string {
  return address.length <= chars * 2 + 1 ? address : `${address.slice(0, chars)}…${address.slice(-chars)}`
}

export function formatSol(value: number): string {
  if (value === 0) return '0 SOL'
  const digits = value >= 100 ? 0 : value >= 1 ? 2 : 4
  return `${value.toFixed(digits)} SOL`
}

export function signedPct(value: number | null, digits = 1): string {
  if (value === null) return '—'
  return `${value > 0 ? '+' : ''}${value.toFixed(digits)}%`
}
