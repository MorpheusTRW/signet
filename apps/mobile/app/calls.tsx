import { useInfiniteQuery } from '@tanstack/react-query'
import { router } from 'expo-router'
import { useState } from 'react'
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useMobileWallet } from '@wallet-ui/react-native-web3js'
import { ConnectWalletButton } from '@/components/connect-wallet-button'
import { BackBar, Chip, TokenAvatar } from '@/components/ui/bits'
import { Button } from '@/components/ui/button'
import { Glass } from '@/components/ui/glass'
import { Backdrop } from '@/components/ui/screen'
import { Text } from '@/components/ui/text'
import { palette, risk } from '@/constants/theme'
import { getCalls } from '@/lib/api/client'
import type { CallOutcome, CallsFilter, CallsResponse } from '@/lib/api/types'
import { compactAge, formatCount, signedPct, tokenTicker } from '@/lib/format'

const FILTERS: { value: CallsFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'passed', label: 'Passed' },
  { value: 'rejected', label: 'Rejected' },
]

function pctColor(value: number | null) {
  if (value === null) return palette.textTertiary
  return value >= 0 ? palette.positive : palette.negative
}

/** Esito misurato on-chain: adesso in grande, +1h / +24h sotto. Anche quando è andato male. */
function Outcome({ outcome }: { outcome: CallOutcome }) {
  return (
    <View style={{ alignItems: 'flex-end', gap: 2 }}>
      <Text variant="mono" color={pctColor(outcome.nowPct)} style={{ fontSize: 15 }}>
        {outcome.nowPct === null ? 'Now —' : `Now ${signedPct(outcome.nowPct, 0)}`}
      </Text>
      <Text variant="caption">
        {`1h ${signedPct(outcome.change1hPct, 0)} · 24h ${signedPct(outcome.change24hPct, 0)}`}
      </Text>
    </View>
  )
}

function Summary({ page }: { page: CallsResponse }) {
  return (
    <Text variant="mono">
      {`${formatCount(page.counts.total)} calls · ${formatCount(page.counts.passed)} passed · ${formatCount(page.counts.rejected)} rejected`}
    </Text>
  )
}

export default function CallsScreen() {
  const { account } = useMobileWallet()
  const pubkey = account?.address.toBase58()
  const insets = useSafeAreaInsets()
  const [filter, setFilter] = useState<CallsFilter>('all')

  const query = useInfiniteQuery({
    queryKey: ['calls', pubkey, filter],
    queryFn: ({ pageParam }) => getCalls({ pubkey: pubkey!, filter, before: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextBefore ?? undefined,
    enabled: !!pubkey,
  })

  const first = query.data?.pages[0]
  const calls = query.data?.pages.flatMap((page) => page.calls) ?? []
  const limited = first?.windowHours != null

  const header = (
    <View style={{ gap: 14, marginBottom: 6 }}>
      <BackBar />
      <View style={{ gap: 6 }}>
        <Text variant="label">{limited ? `All calls · last ${first.windowHours}h` : 'All calls · all time'}</Text>
        <Text variant="display">Calls</Text>
        {first ? <Summary page={first} /> : null}
      </View>
      <View style={styles.filters}>
        {FILTERS.map((option) => (
          <Chip
            key={option.value}
            label={option.label}
            selected={filter === option.value}
            onPress={() => setFilter(option.value)}
          />
        ))}
      </View>
      <Text variant="caption">Price change since each call, read on-chain from its pool.</Text>
    </View>
  )

  if (!pubkey) {
    return (
      <View style={[styles.root, { paddingTop: insets.top + 12 }]}>
        <Backdrop />
        <BackBar />
        <Text variant="secondary">Connect your wallet to see your calls.</Text>
        <ConnectWalletButton />
      </View>
    )
  }

  return (
    <View style={{ flex: 1 }}>
      <Backdrop />
      <FlatList
        data={calls}
        keyExtractor={(item) => item.signal.id}
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 20, paddingBottom: insets.bottom + 28 }}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={header}
        renderItem={({ item, index }) => {
          const { signal } = item
          const ticker = tokenTicker(signal.tokenSymbol, signal.tokenName)
          return (
            <Pressable
              onPress={() => router.push(`/signal/${signal.id}`)}
              style={({ pressed }) => [
                styles.row,
                index < calls.length - 1 && styles.divider,
                pressed && { opacity: 0.7 },
              ]}
            >
              <TokenAvatar symbol={ticker.slice(1)} imageUrl={signal.imageUrl} size={36} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="heading" numberOfLines={1}>
                  {ticker}
                </Text>
                <Text variant="caption" numberOfLines={1}>
                  {`${signal.riskReport.level === 'high' ? 'Rejected' : 'Passed'} · Risk: ${risk[signal.riskReport.level].label} · ${compactAge(signal.createdAt)}`}
                </Text>
              </View>
              <Outcome outcome={item.outcome} />
            </Pressable>
          )
        }}
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage()
        }}
        refreshControl={
          <RefreshControl
            refreshing={query.isRefetching && !query.isFetchingNextPage}
            onRefresh={() => void query.refetch()}
            tintColor={palette.accent}
            colors={[palette.accent]}
            progressBackgroundColor={palette.surface}
          />
        }
        ListEmptyComponent={
          <Text variant="secondary" style={{ paddingVertical: 24 }}>
            {query.isLoading ? 'Loading calls…' : query.isError ? 'Service unreachable. Pull to retry.' : 'No calls yet.'}
          </Text>
        }
        ListFooterComponent={
          query.isFetchingNextPage ? (
            <ActivityIndicator color={palette.accent} style={{ paddingVertical: 20 }} />
          ) : limited && !query.hasNextPage && calls.length > 0 ? (
            <Glass style={{ marginTop: 20, gap: 12 }}>
              <Text variant="heading">Older calls are on Pro</Text>
              <Text variant="secondary">
                {`Free shows the last ${first.windowHours}h${first.delaySeconds > 0 ? `, ${first.delaySeconds}s after each call` : ''}. Pro and SKR Holders see every call since launch, in real time.`}
              </Text>
              <Button title="See plans" variant="ghost" onPress={() => router.push('/plans')} />
            </Glass>
          ) : null
        }
      />
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 20, gap: 16 },
  filters: { flexDirection: 'row', gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  divider: { borderBottomWidth: 1, borderBottomColor: palette.hairline },
})
