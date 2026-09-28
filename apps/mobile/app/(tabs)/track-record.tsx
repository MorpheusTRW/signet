import { useQuery } from '@tanstack/react-query'
import { View } from 'react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { Divider, Header, Metric, Row } from '@/components/ui/bits'
import { Glass } from '@/components/ui/glass'
import { Screen } from '@/components/ui/screen'
import { Text } from '@/components/ui/text'
import { palette } from '@/constants/theme'
import { getTrackRecord } from '@/lib/api/client'
import type { CategoryStats } from '@/lib/api/types'
import { signedPct } from '@/lib/format'

const REFETCH_INTERVAL_MS = 30_000

export default function TrackRecordScreen() {
  const query = useQuery({ queryKey: ['track-record'], queryFn: getTrackRecord, refetchInterval: REFETCH_INTERVAL_MS })

  return (
    <Screen scroll>
      <Header eyebrow="Filter performance" title="Track record" />
      {query.data ? (
        <Summary discarded={query.data.discarded} signaled={query.data.signaled} />
      ) : (
        <Text variant="secondary">{query.isError ? 'Service unreachable.' : 'Loading…'}</Text>
      )}
    </Screen>
  )
}

function Summary({ discarded, signaled }: { discarded: CategoryStats; signaled: CategoryStats }) {
  const d24 = discarded.window24h
  const s24 = signaled.window24h
  const rugCatchRatePct = d24.settledCount > 0 ? Math.round((d24.bigLossCount / d24.settledCount) * 100) : null

  return (
    <View style={{ gap: 16 }}>
      {/* La headline che deve convincere in 3 secondi. */}
      <Animated.View entering={FadeInDown.duration(450)}>
        <Glass glow={palette.red} style={{ gap: 12 }}>
          <Text variant="label">Rugs avoided</Text>
          {rugCatchRatePct !== null ? (
            <>
              <Text variant="number" color={palette.red} style={{ fontSize: 64, lineHeight: 68 }}>
                {rugCatchRatePct}%
              </Text>
              <Text variant="body">of tokens flagged as high risk drop more than −90% within 24 hours.</Text>
            </>
          ) : (
            <Text variant="secondary">Not enough data yet for this stat.</Text>
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
              label="24h avg"
              value={signedPct(s24.avgChangePct)}
              accent={s24.avgChangePct !== null && s24.avgChangePct >= 0 ? palette.mint : palette.red}
            />
            <Metric label="Signaled" value={String(signaled.total)} />
            <Metric label="≥ 2x" value={String(s24.bigGainCount)} accent={palette.mint} />
          </View>
        </Glass>
      </Animated.View>

      <Animated.View entering={FadeInDown.duration(450).delay(160)}>
        <Glass style={{ gap: 14 }}>
          <Text variant="label">After 1 hour</Text>
          <Row
            label={`Flagged (${discarded.window1h.settledCount})`}
            value={signedPct(discarded.window1h.avgChangePct)}
          />
          <Divider />
          <Row
            label={`Signaled (${signaled.window1h.settledCount})`}
            value={signedPct(signaled.window1h.avgChangePct)}
          />
        </Glass>
      </Animated.View>
    </View>
  )
}
