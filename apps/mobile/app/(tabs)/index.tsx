import { useQuery } from '@tanstack/react-query'
import * as Haptics from 'expo-haptics'
import { router } from 'expo-router'
import { useEffect, useRef } from 'react'
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native'
import Animated, { FadeIn } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { Signal } from '@seeker-signal/shared'
import { useMobileWallet } from '@wallet-ui/react-native-web3js'
import { ConnectHero } from '@/components/connect-hero'
import { Radar } from '@/components/radar'
import { SignalCard } from '@/components/signal-card'
import { Text } from '@/components/ui/text'
import { fonts, motion, palette, radius, risk } from '@/constants/theme'
import { getMeTier, getRadar, getSignals } from '@/lib/api/client'
import type { MeTierResponse } from '@/lib/api/types'
import { compactAge, formatCount, shortReason, tokenTicker } from '@/lib/format'
import { useSettings } from '@/lib/settings/settings'

const REFETCH_INTERVAL_MS = 15_000
const EARLIER_SIGNALS = 8

function TierPill({ tier }: { tier: MeTierResponse }) {
  const free = tier.tier === 'free'
  const delay = tier.limits.signalDelaySeconds
  return (
    <Pressable
      onPress={() => router.push('/plans')}
      accessibilityRole="button"
      accessibilityLabel={`Plan: ${tier.tier}. Open plans`}
      style={[styles.tier, free ? styles.tierFree : styles.tierPaid]}
    >
      <Text variant="label" color={free ? palette.text : palette.onAccent}>
        {free && delay > 0 ? `Free · ${delay}s delay` : tier.tier}
      </Text>
    </Pressable>
  )
}

/** Riga di lista come nel mockup: token a sinistra, dato in grigio a destra. */
function ListRow({ title, detail, last, onPress }: { title: string; detail: string; last?: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, !last && styles.rowDivider, pressed && { opacity: 0.7 }]}>
      <Text variant="body" numberOfLines={1} style={{ flexShrink: 0, maxWidth: '45%' }}>
        {title}
      </Text>
      <Text variant="secondary" numberOfLines={1} style={{ flex: 1, textAlign: 'right' }}>
        {detail}
      </Text>
    </Pressable>
  )
}

export default function FeedScreen() {
  const { account } = useMobileWallet()
  const pubkey = account?.address.toBase58()
  const insets = useSafeAreaInsets()
  const { settings } = useSettings()

  const tierQuery = useQuery({ queryKey: ['me-tier', pubkey], queryFn: () => getMeTier(pubkey!), enabled: !!pubkey })
  const radarQuery = useQuery({ queryKey: ['radar'], queryFn: getRadar, refetchInterval: REFETCH_INTERVAL_MS })
  const signalsQuery = useQuery({
    queryKey: ['signals', pubkey],
    queryFn: () => getSignals({ pubkey, limit: 50 }),
    enabled: !!pubkey,
    refetchInterval: REFETCH_INTERVAL_MS,
  })

  // Solo i segnali che hanno passato i filtri: gli scartati stanno nella lista "Just rejected".
  const passed = (signalsQuery.data ?? []).filter((s: Signal) => s.riskReport.level !== 'high')
  const latest = passed[0]

  // Un segnale nuovo mentre il feed è aperto: vibrazione leggera, una volta sola.
  const seenLatest = useRef<string | undefined>(undefined)
  useEffect(() => {
    if (!latest) return
    if (seenLatest.current && seenLatest.current !== latest.id) {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    }
    seenLatest.current = latest.id
  }, [latest])

  if (!pubkey) return <ConnectHero />

  const radar = radarQuery.data
  const rejected = radar?.recentRejected.slice(0, 3) ?? []
  const earlier = passed.slice(1, 1 + EARLIER_SIGNALS)

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={signalsQuery.isRefetching}
            onRefresh={() => {
              void signalsQuery.refetch()
              void radarQuery.refetch()
            }}
            tintColor={palette.accent}
            colors={[palette.accent]}
            progressBackgroundColor={palette.surface}
          />
        }
      >
        <View style={styles.header}>
          <Text style={styles.wordmark}>signet</Text>
          {tierQuery.data ? <TierPill tier={tierQuery.data} /> : null}
        </View>

        <View style={styles.radar}>
          <Radar scanned={radar?.scannedToday} />
          <View style={styles.live}>
            <View style={styles.liveDot} />
            <Text variant="mono" style={{ letterSpacing: 1 }}>
              {radar
                ? `LIVE · ${formatCount(radar.scannedToday)} scanned today · ${formatCount(radar.rejectedToday)} rejected`
                : radarQuery.isError
                  ? 'Radar offline · retrying'
                  : 'LIVE · tuning in…'}
            </Text>
          </View>
        </View>

        {latest ? (
          // key = id: un nuovo segnale rimonta la card e ne rilancia l'ingresso.
          <SignalCard
            key={latest.id}
            signal={latest}
            amountSol={settings.defaultSizeSol}
            slippageBps={settings.slippageBps}
          />
        ) : (
          <Animated.View entering={FadeIn.duration(motion.base)} style={styles.waiting}>
            <Text variant="heading">{signalsQuery.isLoading ? 'Tuning in…' : 'Listening to the chain'}</Text>
            <Text variant="secondary">
              {signalsQuery.isError
                ? 'Service unreachable. Retrying shortly.'
                : 'A signal lands here as soon as a new token passes the filters.'}
            </Text>
          </Animated.View>
        )}

        {rejected.length > 0 ? (
          <View style={styles.section}>
            <Text variant="label">Just rejected · High risk</Text>
            {rejected.map((token, index) => (
              <ListRow
                key={token.signalId}
                title={tokenTicker(token.tokenSymbol, token.tokenName)}
                detail={shortReason(token.reason)}
                last={index === rejected.length - 1}
                onPress={() => router.push(`/signal/${token.signalId}`)}
              />
            ))}
          </View>
        ) : null}

        {earlier.length > 0 ? (
          <View style={styles.section}>
            <Text variant="label">Earlier signals</Text>
            {earlier.map((signal, index) => (
              <ListRow
                key={signal.id}
                title={tokenTicker(signal.tokenSymbol, signal.tokenName)}
                detail={`Risk: ${risk[signal.riskReport.level].label} · ${compactAge(signal.createdAt)}`}
                last={index === earlier.length - 1}
                onPress={() => router.push(`/signal/${signal.id}`)}
              />
            ))}
          </View>
        ) : null}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  wordmark: { fontFamily: fonts.display, fontSize: 22, letterSpacing: -0.5, color: palette.text },
  tier: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill },
  tierPaid: { backgroundColor: palette.accent },
  tierFree: { borderWidth: 1, borderColor: palette.hairlineStrong },
  radar: { alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 20 },
  live: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: palette.accent },
  waiting: {
    marginHorizontal: 16,
    padding: 18,
    gap: 6,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: palette.hairline,
    backgroundColor: palette.surface,
  },
  section: { gap: 8, paddingHorizontal: 20, paddingTop: 20 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16, paddingVertical: 12 },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: palette.hairline },
})
