import { useQuery } from '@tanstack/react-query'
import { FlatList, RefreshControl, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useMobileWallet } from '@wallet-ui/react-native-web3js'
import { ConnectWalletButton } from '@/components/connect-wallet-button'
import { SignalCard } from '@/components/signal-card'
import { TierBadge } from '@/components/tier-badge'
import { appStyles, colors } from '@/constants/app-styles'
import { getMeTier, getSignals } from '@/lib/api/client'

const SIGNALS_REFETCH_INTERVAL_MS = 15_000

export default function FeedScreen() {
  const { account } = useMobileWallet()
  const pubkey = account?.address.toBase58()

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

  if (!pubkey) {
    return (
      <SafeAreaView style={appStyles.screen}>
        <View style={[appStyles.stack, { flex: 1, justifyContent: 'center' }]}>
          <Text style={appStyles.title}>Seeker Signal</Text>
          <Text style={appStyles.subtitle}>Connetti il wallet per vedere i segnali in arrivo.</Text>
          <ConnectWalletButton />
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={appStyles.screen}>
      <View style={appStyles.stack}>
        <Text style={appStyles.title}>Segnali</Text>
        {tierQuery.data ? (
          <TierBadge tier={tierQuery.data.tier} delaySeconds={tierQuery.data.limits.signalDelaySeconds} />
        ) : null}
      </View>
      <FlatList
        data={signalsQuery.data ?? []}
        keyExtractor={(signal) => signal.id}
        contentContainerStyle={{ gap: 10, paddingBottom: 24 }}
        renderItem={({ item }) => <SignalCard signal={item} />}
        refreshControl={
          <RefreshControl
            refreshing={signalsQuery.isFetching}
            onRefresh={() => void signalsQuery.refetch()}
            tintColor={colors.text}
          />
        }
        ListEmptyComponent={
          <Text style={appStyles.textMuted}>
            {signalsQuery.isLoading ? 'Caricamento…' : 'Nessun segnale ancora. Torna a breve.'}
          </Text>
        }
      />
    </SafeAreaView>
  )
}
