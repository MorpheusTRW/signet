import { useQuery } from '@tanstack/react-query'
import { ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { appStyles, colors } from '@/constants/app-styles'
import { getTrackRecord } from '@/lib/api/client'
import type { CategoryStats } from '@/lib/api/types'

const REFETCH_INTERVAL_MS = 30_000

function formatPct(value: number | null): string {
  if (value === null) return '—'
  return `${value > 0 ? '+' : ''}${value}%`
}

export default function TrackRecordScreen() {
  const query = useQuery({
    queryKey: ['track-record'],
    queryFn: getTrackRecord,
    refetchInterval: REFETCH_INTERVAL_MS,
  })

  return (
    <SafeAreaView style={appStyles.screen}>
      <ScrollView contentContainerStyle={appStyles.stack}>
        <Text style={appStyles.title}>Track record</Text>

        {query.isLoading ? <Text style={appStyles.textMuted}>Caricamento…</Text> : null}
        {query.data ? <TrackRecordSummary discarded={query.data.discarded} signaled={query.data.signaled} /> : null}
      </ScrollView>
    </SafeAreaView>
  )
}

function TrackRecordSummary({ discarded, signaled }: { discarded: CategoryStats; signaled: CategoryStats }) {
  const d24 = discarded.window24h
  const s24 = signaled.window24h
  const rugCatchRatePct = d24.settledCount > 0 ? Math.round((d24.bigLossCount / d24.settledCount) * 100) : null

  return (
    <View style={appStyles.stack}>
      {/* La headline che deve convincere in 3 secondi: percentuale di rug catturati dai filtri. */}
      <View style={appStyles.card}>
        {rugCatchRatePct !== null ? (
          <>
            <Text style={appStyles.bigStatDanger}>{rugCatchRatePct}%</Text>
            <Text style={appStyles.body}>dei token scartati come rischio alto crolla oltre -90% entro 24h</Text>
          </>
        ) : (
          <Text style={appStyles.textMuted}>Non ci sono ancora abbastanza dati per una statistica.</Text>
        )}
        <Text style={appStyles.textMuted}>
          {discarded.total} scartati · {d24.settledCount} con esito a 24h · {d24.bigLossCount} a -90% o peggio
        </Text>
      </View>

      <View style={appStyles.card}>
        <Text style={appStyles.subtitle}>Segnali mostrati (rischio basso/medio)</Text>
        <Text
          style={[
            appStyles.body,
            { color: s24.avgChangePct !== null && s24.avgChangePct >= 0 ? colors.success : colors.text },
          ]}
        >
          {formatPct(s24.avgChangePct)} variazione media a 24h
        </Text>
        <Text style={appStyles.textMuted}>
          {signaled.total} segnalati · {s24.bigGainCount} raddoppiati o più
        </Text>
      </View>

      <View style={appStyles.card}>
        <Text style={appStyles.subtitle}>Dettaglio</Text>
        <Text style={appStyles.textMuted}>
          Scartati a 1h: {formatPct(discarded.window1h.avgChangePct)} medio ({discarded.window1h.settledCount} con
          esito)
        </Text>
        <Text style={appStyles.textMuted}>
          Segnalati a 1h: {formatPct(signaled.window1h.avgChangePct)} medio ({signaled.window1h.settledCount} con esito)
        </Text>
      </View>
    </View>
  )
}
