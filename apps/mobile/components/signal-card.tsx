import { Pressable, Text, View } from 'react-native'
import { router } from 'expo-router'
import type { RiskLevel, Signal } from '@seeker-signal/shared'
import { appStyles, colors } from '@/constants/app-styles'

const RISK_COLORS: Record<RiskLevel, string> = {
  low: colors.success,
  medium: colors.warning,
  high: colors.danger,
}

const RISK_LABELS: Record<RiskLevel, string> = {
  low: 'Basso',
  medium: 'Medio',
  high: 'Alto',
}

export function SignalCard({ signal }: { signal: Signal }) {
  const riskColor = RISK_COLORS[signal.riskReport.level]

  return (
    <Pressable style={appStyles.card} onPress={() => router.push(`/signal/${signal.id}`)}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={[appStyles.body, { fontWeight: '700' }]}>{signal.tokenSymbol ?? signal.tokenName ?? 'Token'}</Text>
        <Text style={{ color: riskColor, fontWeight: '700' }}>{RISK_LABELS[signal.riskReport.level]}</Text>
      </View>
      <Text style={appStyles.textMuted}>{signal.summary}</Text>
    </Pressable>
  )
}
