import type { Signal } from '@seeker-signal/shared'

/**
 * Pagina del launchpad dove è nato il token. I token pump.fun (anche dopo la
 * migrazione su PumpSwap) hanno la pagina `pump.fun/coin/<mint>` (verificata
 * 2026-09-26); per gli altri program si ripiega sulla pagina del token su Solscan.
 */
export function launchPage(signal: Pick<Signal, 'program' | 'tokenMint'>): { label: string; url: string } {
  const mint = encodeURIComponent(signal.tokenMint)
  if (signal.program === 'pump-fun' || signal.program === 'pumpswap') {
    return { label: 'Apri su pump.fun', url: `https://pump.fun/coin/${mint}` }
  }
  return { label: 'Apri su Solscan', url: `https://solscan.io/token/${mint}` }
}
