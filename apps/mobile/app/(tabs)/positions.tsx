import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { StyleSheet, View } from 'react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { useMobileWallet } from '@wallet-ui/react-native-web3js'
import { AppStatus } from '@/components/app-status'
import { ConnectHero } from '@/components/connect-hero'
import { Header, Metric, TokenAvatar } from '@/components/ui/bits'
import { Button } from '@/components/ui/button'
import { Glass } from '@/components/ui/glass'
import { Screen } from '@/components/ui/screen'
import { Text } from '@/components/ui/text'
import { palette, radius } from '@/constants/theme'
import { closePosition, getPositions } from '@/lib/api/client'
import type { PositionItem } from '@/lib/api/types'
import { formatSol, timeAgo } from '@/lib/format'

const signedSol = (value: number | null) =>
  value === null ? '—' : `${value >= 0 ? '+' : ''}${value.toFixed(value !== 0 && Math.abs(value) < 0.01 ? 4 : 3)}`
const pnlColor = (value: number | null) =>
  value === null ? palette.textSecondary : value >= 0 ? palette.positive : palette.negative

export default function PositionsScreen() {
  const { account } = useMobileWallet()
  const pubkey = account?.address.toBase58()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['positions', pubkey],
    queryFn: () => getPositions(pubkey!),
    enabled: !!pubkey,
    refetchInterval: 15_000,
  })

  const close = useMutation({
    mutationFn: (id: string) => closePosition(id, pubkey!),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['positions'] }),
  })

  if (!pubkey) return <ConnectHero subtitle="Connect your wallet to see the positions you open." />

  if (!query.data) {
    return (
      <Screen>
        <Header eyebrow="Portfolio" title="Positions" />
        <Text variant="secondary">{query.isError ? 'Could not load positions.' : 'Loading…'}</Text>
      </Screen>
    )
  }

  const { portfolio, positions, mode } = query.data
  const maxPct = portfolio.maxExposureFraction * 100
  const limitSol = portfolio.balanceSol * portfolio.maxExposureFraction
  const fill = limitSol > 0 ? Math.min(1, portfolio.openExposureSol / limitSol) : 0
  const open = positions.filter((p) => p.status === 'open')
  const closed = positions.filter((p) => p.status === 'closed')

  return (
    <Screen scroll>
      <Header eyebrow={mode === 'paper' ? 'Paper portfolio · real prices' : 'Portfolio'} title="Positions" />

      <Animated.View entering={FadeInDown.duration(450)}>
        <Glass style={{ gap: 18 }}>
          <Text variant="label">Paper balance</Text>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
            <Text variant="number">{portfolio.balanceSol.toFixed(2)}</Text>
            <Text variant="title" color={palette.textSecondary} style={{ marginBottom: 4 }}>
              SOL
            </Text>
          </View>
          <View style={{ gap: 8 }}>
            <View style={styles.track}>
              <View
                style={[
                  styles.fill,
                  {
                    width: `${Math.max(2, fill * 100)}%`,
                    backgroundColor: fill > 0.85 ? palette.warning : palette.accent,
                  },
                ]}
              />
            </View>
            <Text variant="caption">
              {formatSol(portfolio.openExposureSol)} open of {formatSol(limitSol)} max ({maxPct}% limit)
            </Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 16 }}>
            <Metric
              label="Unrealized"
              value={signedSol(portfolio.unrealizedPnlSol)}
              accent={pnlColor(portfolio.unrealizedPnlSol)}
            />
            <Metric
              label="Realized"
              value={signedSol(portfolio.realizedPnlSol)}
              accent={pnlColor(portfolio.realizedPnlSol)}
            />
            <Metric label="Available" value={formatSol(portfolio.remainingSol)} />
          </View>
        </Glass>
      </Animated.View>

      {close.isError ? (
        <AppStatus status="danger" title="Could not close" description={(close.error as Error).message} />
      ) : null}

      {positions.length === 0 ? (
        <Glass style={{ alignItems: 'center', paddingVertical: 32, gap: 8 }}>
          <Text variant="heading">No positions yet</Text>
          <Text variant="secondary" style={{ textAlign: 'center' }}>
            Open a signal and tap “Approve entry” to start a paper position at the real market price.
          </Text>
        </Glass>
      ) : null}

      {open.length > 0 ? <Text variant="label">Open</Text> : null}
      {open.map((p, index) => (
        <PositionRow
          key={p.id}
          position={p}
          index={index}
          closing={close.isPending && close.variables === p.id}
          onClose={() => close.mutate(p.id)}
        />
      ))}

      {closed.length > 0 ? (
        <Text variant="label" style={{ marginTop: 4 }}>
          Closed
        </Text>
      ) : null}
      {closed.map((p, index) => (
        <PositionRow key={p.id} position={p} index={index} />
      ))}
    </Screen>
  )
}

function PositionRow({
  position: p,
  index,
  closing,
  onClose,
}: {
  position: PositionItem
  index: number
  closing?: boolean
  onClose?: () => void
}) {
  const symbol = p.tokenSymbol?.trim() || p.tokenName?.trim() || 'Token'
  return (
    <Animated.View entering={FadeInDown.duration(420).delay(Math.min(index, 8) * 40)}>
      <Glass style={{ gap: 14 }}>
        <View style={styles.row}>
          <TokenAvatar symbol={symbol} imageUrl={p.imageUrl ?? undefined} size={40} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="heading" numberOfLines={1}>
              {symbol}
            </Text>
            <Text variant="caption">
              {formatSol(p.sizeSol)} ·{' '}
              {p.status === 'open' ? `opened ${timeAgo(p.openedAt)}` : `closed ${timeAgo(p.closedAt ?? p.openedAt)}`}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text variant="heading" color={pnlColor(p.pnlSol)}>
              {signedSol(p.pnlSol)}
            </Text>
            <Text variant="caption">
              {p.pnlPct === null ? 'price n/a' : `${p.pnlPct >= 0 ? '+' : ''}${p.pnlPct.toFixed(1)}%`}
            </Text>
          </View>
        </View>
        {onClose ? (
          <Button title={closing ? 'Closing…' : 'Close position'} variant="ghost" loading={closing} onPress={onClose} />
        ) : null}
      </Glass>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  track: { height: 8, borderRadius: radius.sm, backgroundColor: palette.hairline, overflow: 'hidden' },
  fill: { height: 8, borderRadius: radius.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
})
