import { useQuery } from '@tanstack/react-query'
import { ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { appStyles, colors } from '@/constants/app-styles'
import { getPositions } from '@/lib/api/client'

export default function PositionsScreen() {
  const query = useQuery({ queryKey: ['positions'], queryFn: getPositions, refetchInterval: 15_000 })

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
        <Text style={appStyles.textDanger}>Impossibile caricare le posizioni.</Text>
      </SafeAreaView>
    )
  }

  const { portfolio, positions } = query.data
  const usedPct = portfolio.valueSol > 0 ? (portfolio.openExposureSol / portfolio.valueSol) * 100 : 0

  return (
    <SafeAreaView style={appStyles.screen}>
      <ScrollView contentContainerStyle={appStyles.stack}>
        <Text style={appStyles.title}>Posizioni</Text>
        <View style={appStyles.card}>
          <Text style={appStyles.bigStat}>{usedPct.toFixed(1)}%</Text>
          <Text style={appStyles.textMuted}>
            Esposizione aperta (max {portfolio.maxExposureFraction * 100}%) · {portfolio.openExposureSol.toFixed(2)} /{' '}
            {portfolio.valueSol} SOL
          </Text>
          <Text style={appStyles.textMuted}>
            PnL realizzato: {portfolio.realizedPnlSol >= 0 ? '+' : ''}
            {portfolio.realizedPnlSol.toFixed(3)} SOL
          </Text>
          <Text style={appStyles.textMuted}>Portafoglio simulato (paper mode).</Text>
        </View>

        {positions.length === 0 ? <Text style={appStyles.textMuted}>Nessuna posizione.</Text> : null}
        {positions.map((p) => (
          <View key={p.id} style={appStyles.card}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={[appStyles.body, { fontWeight: '700' }]}>{p.tokenSymbol ?? p.tokenName ?? 'Token'}</Text>
              <Text style={{ color: p.status === 'open' ? colors.accent : colors.textMuted, fontWeight: '700' }}>
                {p.status === 'open' ? 'Aperta' : 'Chiusa'}
              </Text>
            </View>
            <Text style={appStyles.textMuted}>Size: {p.sizeSol} SOL</Text>
            {p.status === 'closed' ? (
              <Text style={{ color: p.pnlSol >= 0 ? colors.success : colors.danger }}>
                PnL: {p.pnlSol >= 0 ? '+' : ''}
                {p.pnlSol.toFixed(3)} SOL ({p.outcomeMultiplier}x)
              </Text>
            ) : (
              <Text style={appStyles.textMuted}>Chiude: {new Date(p.closesAt).toLocaleTimeString()}</Text>
            )}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  )
}
