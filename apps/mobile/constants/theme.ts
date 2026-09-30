import type { RiskLevel } from '@seeker-signal/shared'

// Design system dei mockup (design/screens): nero, avorio e l'arancione del sigillo.
// Arancione = azioni e firma, avorio = dati, nero = sfondo. Tutte le schermate usano
// solo questi token (niente colori/font sparsi).

export const palette = {
  bg: '#0E0E10',
  surface: '#1A1A1E',
  surfaceStrong: '#222227',
  surfacePressed: '#2A2A30',
  hairline: '#2A2A30',
  hairlineStrong: '#3A3A42',
  radarTrack: '#1C1C20',
  tabBar: '#0E0E10',

  // Avorio per i dati, grigio caldo per il testo secondario.
  text: '#F2EEE6',
  textSecondary: '#B3AEA5',
  textTertiary: '#7C776F',

  accent: '#FF5B2E',
  accentSoft: 'rgba(255,91,46,0.14)',
  accentGlow: 'rgba(255,91,46,0.18)',
  accentDeep: '#C34827',
  onAccent: '#0E0E10',

  // Superfici avorio (schermata Rug schivati): testo scuro e arancione bruciato leggibile.
  ivory: '#F2EEE6',
  ivoryCard: '#FBF9F4',
  ivoryBorder: '#DCD6CB',
  ivoryDivider: '#E6E0D5',
  onIvory: '#0E0E10',
  onIvoryMuted: '#5C574F',
  accentOnIvory: '#B8401C',

  // Semantica (rischio, PnL, esiti): il rischio è sempre scritto anche a parole.
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
  // Unbounded per titoli e numeri grandi, DM Sans per il testo, JetBrains Mono per i dati tecnici.
  display: 'Unbounded_600SemiBold',
  displayMedium: 'Unbounded_500Medium',
  light: 'DMSans_400Regular',
  regular: 'DMSans_400Regular',
  medium: 'DMSans_500Medium',
  semibold: 'DMSans_700Bold',
  bold: 'DMSans_700Bold',
  mono: 'JetBrainsMono_500Medium',
  monoMedium: 'JetBrainsMono_500Medium',
} as const

/** Durate delle animazioni: sempre brevi, mai legate a importi o profitti. */
export const motion = { fast: 200, base: 300, slow: 400 } as const

export const radius = { sm: 10, md: 16, lg: 22, xl: 28, pill: 999 } as const
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const

/** Spazio da lasciare in fondo alle schermate per la tab bar flottante. */
export const TAB_BAR_CLEARANCE = 96

export const gradients = {
  accent: ['#FF7448', '#FF5B2E'] as const,
  brand: ['#FF5B2E', '#C34827'] as const,
}

export const risk: Record<RiskLevel, { color: string; soft: string; label: string }> = {
  low: { color: palette.positive, soft: palette.positiveSoft, label: 'Low' },
  medium: { color: palette.warning, soft: palette.warningSoft, label: 'Medium' },
  high: { color: palette.negative, soft: palette.negativeSoft, label: 'High' },
}
