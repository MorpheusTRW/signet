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
      <Header eyebrow="Prestazioni dei filtri" title="Track record" />
      {query.data ? (
        <Summary discarded={query.data.discarded} signaled={query.data.signaled} />
      ) : (
        <Text variant="secondary">{query.isError ? 'Servizio non raggiungibile.' : 'Caricamento…'}</Text>
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
          <Text variant="label">Rug evitati</Text>
          {rugCatchRatePct !== null ? (
            <>
              <Text variant="number" color={palette.red} style={{ fontSize: 64, lineHeight: 68 }}>
                {rugCatchRatePct}%
              </Text>
              <Text variant="body">dei token scartati come rischio alto crolla oltre −90% entro 24 ore.</Text>
            </>
          ) : (
            <Text variant="secondary">Servono ancora un po&apos; di dati per questa statistica.</Text>
          )}
          <Text variant="caption">
            {discarded.total} scartati · {d24.settledCount} con esito a 24h · {d24.bigLossCount} a −90% o peggio
          </Text>
        </Glass>
      </Animated.View>

      <Animated.View entering={FadeInDown.duration(450).delay(80)}>
        <Glass style={{ gap: 16 }}>
          <Text variant="label">Segnali mostrati · rischio basso e medio</Text>
          <View style={{ flexDirection: 'row', gap: 16 }}>
            <Metric
              label="Media 24h"
              value={signedPct(s24.avgChangePct)}
              accent={s24.avgChangePct !== null && s24.avgChangePct >= 0 ? palette.mint : palette.red}
            />
            <Metric label="Segnalati" value={String(signaled.total)} />
            <Metric label="≥ 2x" value={String(s24.bigGainCount)} accent={palette.mint} />
          </View>
        </Glass>
      </Animated.View>

      <Animated.View entering={FadeInDown.duration(450).delay(160)}>
        <Glass style={{ gap: 14 }}>
          <Text variant="label">Dopo 1 ora</Text>
          <Row
            label={`Scartati (${discarded.window1h.settledCount})`}
            value={signedPct(discarded.window1h.avgChangePct)}
          />
          <Divider />
          <Row
            label={`Segnalati (${signaled.window1h.settledCount})`}
            value={signedPct(signaled.window1h.avgChangePct)}
          />
        </Glass>
      </Animated.View>
    </View>
  )
}
