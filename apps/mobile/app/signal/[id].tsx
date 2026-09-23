import { useLocalSearchParams } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import type { RiskLevel } from '@seeker-signal/shared'
import { appStyles, colors } from '@/constants/app-styles'
import { getSignal } from '@/lib/api/client'

const RISK_LABELS: Record<RiskLevel, string> = { low: 'Basso', medium: 'Medio', high: 'Alto' }
const RISK_COLORS: Record<RiskLevel, string> = { low: colors.success, medium: colors.warning, high: colors.danger }

export default function SignalDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const query = useQuery({
    queryKey: ['signal', id],
    queryFn: () => getSignal(id),
    enabled: !!id,
  })

  if (query.isLoading) {
    return (
      <SafeAreaView style={appStyles.screen}>
        <Text style={appStyles.textMuted}>Caricamento…</Text>
      </SafeAreaView>
    )
  }

  if (query.isError || !query.data) {
    return (
      <SafeAreaView style={appStyles.screen}>
        <Text style={appStyles.textDanger}>Segnale non trovato.</Text>
      </SafeAreaView>
    )
  }

  const signal = query.data
  const riskColor = RISK_COLORS[signal.riskReport.level]

  return (
    <SafeAreaView style={appStyles.screen}>
      <ScrollView contentContainerStyle={appStyles.stack}>
        <Text style={appStyles.title}>{signal.tokenName ?? signal.tokenSymbol ?? 'Token'}</Text>
        <Text style={appStyles.subtitle}>
          {signal.program} · {signal.tokenMint}
        </Text>

        <View style={appStyles.card}>
          <Text style={[appStyles.body, { color: riskColor, fontWeight: '700' }]}>
            Rischio {RISK_LABELS[signal.riskReport.level]} · {signal.riskReport.score}/100
          </Text>
          {signal.riskReport.reasons.map((reason) => (
            <Text key={reason} style={appStyles.textMuted}>
              • {reason}
            </Text>
          ))}
        </View>

        <View style={appStyles.card}>
          <Text style={appStyles.body}>{signal.summary}</Text>
        </View>

        <View style={appStyles.card}>
          <Text style={appStyles.textMuted}>Liquidità iniziale: {signal.initialLiquiditySol} SOL</Text>
          <Text style={appStyles.textMuted}>Pool: {signal.poolAddress}</Text>
          <Text style={appStyles.textMuted}>Creato: {new Date(signal.createdAt).toLocaleString()}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
