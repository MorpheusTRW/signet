import { useQuery } from '@tanstack/react-query'
import { StyleSheet, View } from 'react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { Header, Metric, TokenAvatar } from '@/components/ui/bits'
import { Glass } from '@/components/ui/glass'
import { Screen } from '@/components/ui/screen'
import { Text } from '@/components/ui/text'
import { palette, radius } from '@/constants/theme'
import { formatSol, timeAgo } from '@/lib/format'

import { getPositions } from '@/lib/api/client'

export default function PositionsScreen() {
  const query = useQuery({ queryKey: ['positions'], queryFn: getPositions, refetchInterval: 15_000 })

  if (!query.data) {
    return (
      <Screen>
        <Header eyebrow="Portfolio" title="Positions" />
        <Text variant="secondary">{query.isError ? 'Could not load positions.' : 'Loading…'}</Text>
      </Screen>
    )
  }

  const { portfolio, positions } = query.data
  const maxPct = portfolio.maxExposureFraction * 100
  const usedPct = portfolio.valueSol > 0 ? (portfolio.openExposureSol / portfolio.valueSol) * 100 : 0
  const fill = Math.min(1, usedPct / maxPct)
  const pnlColor = portfolio.realizedPnlSol >= 0 ? palette.positive : palette.negative

  return (
    <Screen scroll>
      <Header eyebrow="Simulated portfolio" title="Positions" />

      <Animated.View entering={FadeInDown.duration(450)}>
        <Glass style={{ gap: 18 }}>
          <Text variant="label">Open exposure</Text>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
            <Text variant="number">{usedPct.toFixed(1)}%</Text>
            <Text variant="secondary" style={{ marginBottom: 8 }}>
              of {maxPct}% max
            </Text>
          </View>
          {/* Barra verso il limite di esposizione (principio 3 di CLAUDE.md). */}
          <View style={styles.track}>
            <View
              style={[
                styles.fill,
                {
                  width: `${Math.max(2, fill * 100)}%`,
                  backgroundColor: fill > 0.85 ? palette.warning : palette.accent,
                  shadowColor: fill > 0.85 ? palette.warning : palette.accent,
                },
              ]}
            />
          </View>
          <View style={{ flexDirection: 'row', gap: 16 }}>
            <Metric label="Open" value={formatSol(portfolio.openExposureSol)} />
            <Metric label="Available" value={formatSol(portfolio.remainingSol)} />
            <Metric
              label="PnL"
              value={`${portfolio.realizedPnlSol >= 0 ? '+' : ''}${portfolio.realizedPnlSol.toFixed(3)}`}
              accent={pnlColor}
            />
          </View>
        </Glass>
      </Animated.View>

      <Text variant="label" style={{ marginTop: 4 }}>
        History
      </Text>
      {positions.length === 0 ? <Text variant="secondary">No positions yet.</Text> : null}
      {positions.map((p, index) => {
        const symbol = p.tokenSymbol?.trim() || p.tokenName?.trim() || 'Token'
        const open = p.status === 'open'
        const pnlUp = p.pnlSol >= 0
        return (
          <Animated.View key={p.id} entering={FadeInDown.duration(420).delay(Math.min(index, 8) * 40)}>
            <Glass style={styles.row}>
              <TokenAvatar symbol={symbol} size={40} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="heading" numberOfLines={1}>
                  {symbol}
                </Text>
                <Text variant="caption">
                  {formatSol(p.sizeSol)} ·{' '}
                  {open
                    ? `closes ${new Date(p.closesAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`
                    : timeAgo(p.closedAt ?? p.openedAt)}
                </Text>
              </View>
              {open ? (
                <View style={[styles.badge, { backgroundColor: palette.accentSoft }]}>
                  <Text variant="label" color={palette.accent}>
                    Open
                  </Text>
                </View>
              ) : (
                <View style={{ alignItems: 'flex-end' }}>
                  <Text variant="heading" color={pnlUp ? palette.positive : palette.negative}>
                    {pnlUp ? '+' : ''}
                    {p.pnlSol.toFixed(3)}
                  </Text>
                  <Text variant="caption">{p.outcomeMultiplier}x</Text>
                </View>
              )}
            </Glass>
          </Animated.View>
        )
      })}
    </Screen>
  )
}

const styles = StyleSheet.create({
  track: { height: 8, borderRadius: 4, backgroundColor: palette.hairline, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4, shadowOpacity: 0.8, shadowRadius: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  badge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill },
})
