import { StyleSheet } from 'react-native'

// Palette dark, minimale, testo grande (CLAUDE.md, apps/mobile).
export const colors = {
  background: '#0B0B0F',
  card: '#17171F',
  border: '#2A2A34',
  text: '#F2F2F5',
  textMuted: '#9A9AA6',
  danger: '#F87171',
  success: '#34D399',
  accent: '#14F195',
  accentMuted: 'rgba(20, 241, 149, 0.16)',
  warning: '#FBBF24',
  warningMuted: 'rgba(251, 191, 36, 0.16)',
}

export const appStyles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
    gap: 16,
    paddingHorizontal: 16,
  },
  stack: {
    gap: 10,
  },
  card: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    gap: 8,
  },
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '700',
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 15,
  },
  body: {
    color: colors.text,
    fontSize: 17,
  },
  textMuted: {
    color: colors.textMuted,
    fontSize: 14,
  },
  textDanger: {
    color: colors.danger,
  },
  textSuccess: {
    color: colors.success,
  },
  bigStat: {
    color: colors.text,
    fontSize: 44,
    fontWeight: '800',
  },
  bigStatDanger: {
    color: colors.danger,
    fontSize: 44,
    fontWeight: '800',
  },
})
