import { useQuery } from '@tanstack/react-query'
import { FlatList, RefreshControl, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useMobileWallet } from '@wallet-ui/react-native-web3js'
import { ConnectHero } from '@/components/connect-hero'
import { SignalCard } from '@/components/signal-card'
import { TierBadge } from '@/components/tier-badge'
import { Header, LiveDot } from '@/components/ui/bits'
import { Glass } from '@/components/ui/glass'
import { Backdrop } from '@/components/ui/screen'
import { Text } from '@/components/ui/text'
import { palette, TAB_BAR_CLEARANCE } from '@/constants/theme'
import { getMeTier, getSignals } from '@/lib/api/client'

const SIGNALS_REFETCH_INTERVAL_MS = 15_000

export default function FeedScreen() {
  const { account } = useMobileWallet()
  const pubkey = account?.address.toBase58()
  const insets = useSafeAreaInsets()

  const tierQuery = useQuery({
    queryKey: ['me-tier', pubkey],
    queryFn: () => getMeTier(pubkey!),
    enabled: !!pubkey,
  })

  const signalsQuery = useQuery({
    queryKey: ['signals', pubkey],
    queryFn: () => getSignals({ pubkey, limit: 50 }),
    enabled: !!pubkey,
    refetchInterval: SIGNALS_REFETCH_INTERVAL_MS,
  })

  if (!pubkey) return <ConnectHero />

  return (
    <View style={{ flex: 1 }}>
      <Backdrop />
      <FlatList
        data={signalsQuery.data ?? []}
        keyExtractor={(signal) => signal.id}
        contentContainerStyle={{
          paddingTop: insets.top + 12,
          paddingHorizontal: 20,
          paddingBottom: TAB_BAR_CLEARANCE,
          gap: 12,
        }}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={{ gap: 14, marginBottom: 8 }}>
            <Header eyebrow="Seeker Signal" title="Segnali" right={<LiveDot />} />
            {tierQuery.data ? (
              <TierBadge tier={tierQuery.data.tier} delaySeconds={tierQuery.data.limits.signalDelaySeconds} />
            ) : null}
          </View>
        }
        renderItem={({ item, index }) => <SignalCard signal={item} index={index} />}
        refreshControl={
          <RefreshControl
            refreshing={signalsQuery.isRefetching}
            onRefresh={() => void signalsQuery.refetch()}
            tintColor={palette.mint}
            colors={[palette.mint]}
            progressBackgroundColor="#0B0F14"
          />
        }
        ListEmptyComponent={
          <Glass style={{ alignItems: 'center', paddingVertical: 36, gap: 8 }}>
            <Text variant="heading">{signalsQuery.isLoading ? 'Sintonizzazione…' : 'In ascolto della chain'}</Text>
            <Text variant="secondary" style={{ textAlign: 'center' }}>
              {signalsQuery.isError
                ? 'Servizio non raggiungibile. Riprova tra poco.'
                : 'I nuovi token compariranno qui appena superano i filtri.'}
            </Text>
          </Glass>
        }
      />
    </View>
  )
}
