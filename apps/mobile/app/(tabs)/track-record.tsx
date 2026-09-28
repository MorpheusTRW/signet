import { useQuery } from '@tanstack/react-query'
import { View } from 'react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { Divider, Header, Metric, Row } from '@/components/ui/bits'
import { Glass } from '@/components/ui/glass'
import { Screen } from '@/components/ui/screen'
import { Text } from '@/components/ui/text'
import { palette } from '@/constants/theme'
import { getTrackRecord } from '@/lib/api/client'
import type { CategoryStats, TrackRecordStats } from '@/lib/api/types'
import { signedPct } from '@/lib/format'

const REFETCH_INTERVAL_MS = 30_000
/** Sotto questo numero di esiti una percentuale non è significativa: meglio non mostrarla. */
const MIN_SAMPLE = 10

export default function TrackRecordScreen() {
  const query = useQuery({ queryKey: ['track-record'], queryFn: getTrackRecord, refetchInterval: REFETCH_INTERVAL_MS })

  return (
    <Screen scroll>
      <Header
        eyebrow={query.data?.source === 'synthetic' ? 'Simulated data · dev only' : 'Measured on real pool prices'}
        title="Track record"
      />
      {query.data ? (
        <Summary stats={query.data} />
      ) : (
        <Text variant="secondary">{query.isError ? 'Service unreachable.' : 'Loading…'}</Text>
      )}
    </Screen>
  )
}

/** Valore o "—" se il campione è troppo piccolo. */
function sampled(stats: CategoryStats['window24h'], value: string): string {
  return stats.settledCount >= MIN_SAMPLE ? value : '—'
}

function Summary({ stats }: { stats: TrackRecordStats }) {
  const { discarded, signaled } = stats
  const d24 = discarded.window24h
  const s24 = signaled.window24h
  const enough = d24.settledCount >= MIN_SAMPLE
  const rugRatePct = enough ? Math.round((d24.bigLossCount / d24.settledCount) * 100) : null

  return (
    <View style={{ gap: 16 }}>
      {/* La headline che deve convincere in 3 secondi, solo se misurata su abbastanza dati reali. */}
      <Animated.View entering={FadeInDown.duration(450)}>
        <Glass glow={enough ? palette.negative : undefined} style={{ gap: 12 }}>
          <Text variant="label">Rugs avoided</Text>
          {rugRatePct !== null ? (
            <>
              <Text variant="number" color={palette.negative} style={{ fontSize: 64, lineHeight: 68 }}>
                {rugRatePct}%
              </Text>
              <Text variant="body">of tokens flagged as high risk dropped more than −90% within 24 hours.</Text>
            </>
          ) : (
            <>
              <Text variant="heading">Collecting real data</Text>
              <Text variant="secondary">
                Every signal is priced from its pool at launch, then again after 1 hour and 24 hours. The stat appears
                after {MIN_SAMPLE} measured outcomes ({d24.settledCount} so far).
              </Text>
            </>
          )}
          <Text variant="caption">
            {discarded.total} flagged · {d24.settledCount} with a 24h outcome · {d24.bigLossCount} at −90% or worse
          </Text>
        </Glass>
      </Animated.View>

      <Animated.View entering={FadeInDown.duration(450).delay(80)}>
        <Glass style={{ gap: 16 }}>
          <Text variant="label">Signals shown · low & medium risk</Text>
          <View style={{ flexDirection: 'row', gap: 16 }}>
            <Metric
              label="24h median"
              value={sampled(s24, signedPct(s24.medianChangePct))}
              accent={
                s24.settledCount >= MIN_SAMPLE && s24.medianChangePct !== null
                  ? s24.medianChangePct >= 0
                    ? palette.positive
                    : palette.negative
                  : undefined
              }
            />
            <Metric label="Measured" value={String(s24.settledCount)} />
            <Metric label="≥ 2x" value={sampled(s24, String(s24.bigGainCount))} accent={palette.positive} />
          </View>
        </Glass>
      </Animated.View>

      <Animated.View entering={FadeInDown.duration(450).delay(160)}>
        <Glass style={{ gap: 14 }}>
          <Text variant="label">Median after 1 hour</Text>
          <Row
            label={`Flagged (${discarded.window1h.settledCount})`}
            value={sampled(discarded.window1h, signedPct(discarded.window1h.medianChangePct))}
          />
          <Divider />
          <Row
            label={`Signaled (${signaled.window1h.settledCount})`}
            value={sampled(signaled.window1h, signedPct(signaled.window1h.medianChangePct))}
          />
        </Glass>
      </Animated.View>
    </View>
  )
}
