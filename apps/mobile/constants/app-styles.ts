import { StyleSheet } from 'react-native'
import { fonts, palette, radius } from './theme'

// Alias retrocompatibili verso il design system (constants/theme.ts).
export const colors = {
  background: palette.bg,
  card: palette.surface,
  border: palette.hairline,
  text: palette.text,
  textMuted: palette.textSecondary,
  danger: palette.negative,
  success: palette.positive,
  accent: palette.accent,
  accentMuted: palette.accentSoft,
  warning: palette.warning,
  warningMuted: palette.warningSoft,
}

export const appStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.bg, gap: 16, paddingHorizontal: 20 },
  stack: { gap: 12 },
  card: {
    backgroundColor: palette.surface,
    borderColor: palette.hairline,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 18,
    gap: 8,
  },
  title: { color: palette.text, fontSize: 30, fontFamily: fonts.bold, letterSpacing: -0.8 },
  subtitle: { color: palette.textSecondary, fontSize: 15, fontFamily: fonts.regular },
  body: { color: palette.text, fontSize: 16, fontFamily: fonts.regular },
  textMuted: { color: palette.textSecondary, fontSize: 14, fontFamily: fonts.regular },
  textDanger: { color: palette.negative, fontFamily: fonts.medium },
  textSuccess: { color: palette.positive, fontFamily: fonts.medium },
  bigStat: { color: palette.text, fontSize: 48, fontFamily: fonts.bold, letterSpacing: -1.5 },
  bigStatDanger: { color: palette.negative, fontSize: 48, fontFamily: fonts.bold, letterSpacing: -1.5 },
})
