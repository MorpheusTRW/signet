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

/** Età compatta per i mockup: "12s", "40m", "3h", "2d". */
export function compactAge(iso: string, now: number = Date.now()): string {
  const seconds = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000))
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  return `${Math.floor(hours / 24)}d`
}

/** Variazione negativa col segno meno tipografico: "−96%". */
export function dropPct(value: number): string {
  const rounded = Math.round(value)
  return rounded < 0 ? `−${Math.abs(rounded)}%` : `+${rounded}%`
}

/** "$BONK" dal simbolo, altrimenti il nome, altrimenti "$TOKEN". */
export function tokenTicker(symbol: string | null | undefined, name?: string | null): string {
  const value = symbol?.trim() || name?.trim()
  return value ? `$${value.replace(/^\$/, '')}` : '$TOKEN'
}

/** Motivo di scarto breve per una riga: toglie la spiegazione fra parentesi finale. */
export function shortReason(reason: string): string {
  return reason.replace(/\s*\([^)]*\)\s*$/, '')
}

export function formatCount(value: number): string {
  return value.toLocaleString('en-US')
}
