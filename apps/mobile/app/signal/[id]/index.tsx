import { useState } from 'react'
import { router, useLocalSearchParams } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { ScrollView, Text, TextInput, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import type { RiskLevel } from '@seeker-signal/shared'
import { AppActionButton } from '@/components/app-action-button'
import { appStyles, colors } from '@/constants/app-styles'
import { getSignal } from '@/lib/api/client'
import { useSettings } from '@/lib/settings/settings'

const RISK_LABELS: Record<RiskLevel, string> = { low: 'Basso', medium: 'Medio', high: 'Alto' }
const RISK_COLORS: Record<RiskLevel, string> = { low: colors.success, medium: colors.warning, high: colors.danger }

const inputStyle = {
  color: colors.text,
  fontSize: 20,
  borderBottomWidth: 1,
  borderBottomColor: colors.border,
  paddingVertical: 6,
}

export default function SignalDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const query = useQuery({
    queryKey: ['signal', id],
    queryFn: () => getSignal(id),
    enabled: !!id,
  })

  const { settings } = useSettings()
  const [amountSol, setAmountSol] = useState(String(settings.defaultSizeSol))
  const [slippageBps, setSlippageBps] = useState(String(settings.slippageBps))

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

        <View style={appStyles.card}>
          <Text style={appStyles.subtitle}>Importo (SOL)</Text>
          <TextInput style={inputStyle} keyboardType="decimal-pad" value={amountSol} onChangeText={setAmountSol} />
          <Text style={appStyles.subtitle}>Slippage (bps)</Text>
          <TextInput style={inputStyle} keyboardType="number-pad" value={slippageBps} onChangeText={setSlippageBps} />
          <AppActionButton
            title="Approva Entry"
            onPress={async () => {
              router.push({
                pathname: '/signal/[id]/approve',
                params: { id: signal.id, amountSol, slippageBps },
              })
            }}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
