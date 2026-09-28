import type { RiskLevel } from '@seeker-signal/shared'

// Design system "Obsidian Ember": nero caldo, vetro, luce arancione del logo.
// Tutte le schermate usano solo questi token (niente colori/font sparsi).

export const palette = {
  // Nero caldo del logo: lo sfondo coincide con quello dell'icona, così il logo si fonde.
  bg: '#0E0E10',
  surface: 'rgba(255,255,255,0.045)',
  surfaceStrong: 'rgba(255,255,255,0.075)',
  surfacePressed: 'rgba(255,255,255,0.10)',
  hairline: 'rgba(255,255,255,0.09)',
  hairlineStrong: 'rgba(255,255,255,0.16)',
  tabBar: '#151517',

  text: '#F6F3F0',
  textSecondary: '#ABA5A0',
  textTertiary: '#6E6863',

  // Brand (dal logo): arancione e arancione bruciato del bordo interno.
  accent: '#FF5B2E',
  accentSoft: 'rgba(255,91,46,0.14)',
  accentDeep: '#C34827',
  onAccent: '#0E0E10',

  // Semantica (rischio, PnL, esiti): volutamente distinta dall'arancione del brand.
  positive: '#3DDC97',
  positiveSoft: 'rgba(61,220,151,0.14)',
  warning: '#FFC247',
  warningSoft: 'rgba(255,194,71,0.14)',
  negative: '#FF3D6A',
  negativeSoft: 'rgba(255,61,106,0.14)',
  gold: '#F2C46D',
  goldSoft: 'rgba(242,196,109,0.14)',
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
  accent: ['#FF7448', '#FF5B2E'] as const,
  brand: ['#FF5B2E', '#C34827'] as const,
}

export const risk: Record<RiskLevel, { color: string; soft: string; label: string }> = {
  low: { color: palette.positive, soft: palette.positiveSoft, label: 'Low' },
  medium: { color: palette.warning, soft: palette.warningSoft, label: 'Medium' },
  high: { color: palette.negative, soft: palette.negativeSoft, label: 'High' },
}
