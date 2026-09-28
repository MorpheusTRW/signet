import type { RiskLevel } from '@seeker-signal/shared'

// Design system "Obsidian": nero profondo, vetro, luce verde/viola di Solana.
// Tutte le schermate usano solo questi token (niente colori/font sparsi).

export const palette = {
  bg: '#05070A',
  surface: 'rgba(255,255,255,0.045)',
  surfaceStrong: 'rgba(255,255,255,0.075)',
  surfacePressed: 'rgba(255,255,255,0.10)',
  hairline: 'rgba(255,255,255,0.09)',
  hairlineStrong: 'rgba(255,255,255,0.16)',
  tabBar: '#0B0E13',

  text: '#F4F6FA',
  textSecondary: '#A3ACBA',
  textTertiary: '#606A79',

  mint: '#19FB9B',
  mintSoft: 'rgba(25,251,155,0.14)',
  violet: '#9945FF',
  violetSoft: 'rgba(153,69,255,0.16)',
  cyan: '#00D1FF',
  amber: '#FFB547',
  amberSoft: 'rgba(255,181,71,0.14)',
  red: '#FF4D6D',
  redSoft: 'rgba(255,77,109,0.14)',
  onAccent: '#031109',
} as const

export const fonts = {
  light: 'SpaceGrotesk_300Light',
  regular: 'SpaceGrotesk_400Regular',
  medium: 'SpaceGrotesk_500Medium',
  semibold: 'SpaceGrotesk_600SemiBold',
  bold: 'SpaceGrotesk_700Bold',
  mono: 'JetBrainsMono_400Regular',
  monoMedium: 'JetBrainsMono_500Medium',
} as const

export const radius = { sm: 10, md: 16, lg: 22, xl: 28, pill: 999 } as const
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const

/** Spazio da lasciare in fondo alle schermate per la tab bar flottante. */
export const TAB_BAR_CLEARANCE = 120

export const gradients = {
  accent: ['#19FB9B', '#00D1FF'] as const,
  brand: ['#19FB9B', '#9945FF'] as const,
}

export const risk: Record<RiskLevel, { color: string; soft: string; label: string }> = {
  low: { color: palette.mint, soft: palette.mintSoft, label: 'Low' },
  medium: { color: palette.amber, soft: palette.amberSoft, label: 'Medium' },
  high: { color: palette.red, soft: palette.redSoft, label: 'High' },
}
