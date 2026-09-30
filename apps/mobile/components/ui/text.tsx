import { Text as RNText, type TextProps, type TextStyle } from 'react-native'
import { fonts, palette } from '@/constants/theme'

const variants = {
  display: { fontFamily: fonts.display, fontSize: 34, lineHeight: 40, letterSpacing: -1.2, color: palette.text },
  title: { fontFamily: fonts.display, fontSize: 24, lineHeight: 30, letterSpacing: -0.6, color: palette.text },
  heading: { fontFamily: fonts.bold, fontSize: 17, lineHeight: 22, letterSpacing: -0.1, color: palette.text },
  body: { fontFamily: fonts.regular, fontSize: 15.5, lineHeight: 22, color: palette.text },
  secondary: { fontFamily: fonts.regular, fontSize: 14.5, lineHeight: 20, color: palette.textSecondary },
  caption: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 17, color: palette.textTertiary },
  // Micro-etichette tecniche, maiuscole e spaziate (come nei mockup).
  label: { fontFamily: fonts.monoMedium, fontSize: 12, letterSpacing: 2, color: palette.textSecondary },
  mono: { fontFamily: fonts.mono, fontSize: 13, color: palette.textSecondary },
  // Numeri grandi (importi, contatori, percentuali).
  number: { fontFamily: fonts.display, fontSize: 44, lineHeight: 52, letterSpacing: -1.5, color: palette.text },
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
