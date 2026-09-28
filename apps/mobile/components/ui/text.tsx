import { Text as RNText, type TextProps, type TextStyle } from 'react-native'
import { fonts, palette } from '@/constants/theme'

const variants = {
  display: { fontFamily: fonts.bold, fontSize: 36, lineHeight: 40, letterSpacing: -1.2, color: palette.text },
  title: { fontFamily: fonts.bold, fontSize: 26, lineHeight: 31, letterSpacing: -0.7, color: palette.text },
  heading: { fontFamily: fonts.semibold, fontSize: 18, lineHeight: 23, letterSpacing: -0.3, color: palette.text },
  body: { fontFamily: fonts.regular, fontSize: 15.5, lineHeight: 22, color: palette.text },
  secondary: { fontFamily: fonts.regular, fontSize: 14.5, lineHeight: 20, color: palette.textSecondary },
  caption: { fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 16, color: palette.textTertiary },
  // Micro-etichette tecniche, maiuscole e spaziate.
  label: { fontFamily: fonts.monoMedium, fontSize: 10.5, letterSpacing: 1.6, color: palette.textTertiary },
  mono: { fontFamily: fonts.mono, fontSize: 12.5, color: palette.textSecondary },
  // Numeri grandi (prezzi, punteggi, percentuali).
  number: { fontFamily: fonts.bold, fontSize: 44, lineHeight: 48, letterSpacing: -1.6, color: palette.text },
} satisfies Record<string, TextStyle>

export type TextVariant = keyof typeof variants

export function Text({
  variant = 'body',
  color,
  style,
  children,
  ...rest
}: TextProps & { variant?: TextVariant; color?: string }) {
  const content = variant === 'label' && typeof children === 'string' ? children.toUpperCase() : children
  return (
    <RNText {...rest} style={[variants[variant], color ? { color } : null, style]}>
      {content}
    </RNText>
  )
}
