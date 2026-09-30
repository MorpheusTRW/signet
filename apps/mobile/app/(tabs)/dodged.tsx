import { useQuery } from '@tanstack/react-query'
import { router, useFocusEffect } from 'expo-router'
import { setStatusBarStyle } from 'expo-status-bar'
import { useCallback } from 'react'
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useMobileWallet } from '@wallet-ui/react-native-web3js'
import { Text } from '@/components/ui/text'
import { fonts, motion, palette, radius } from '@/constants/theme'
import { getDodged } from '@/lib/api/client'
import type { DisciplineStreak } from '@/lib/api/types'
import { compactAge, dropPct, shortReason, tokenTicker } from '@/lib/format'

const REFETCH_INTERVAL_MS = 60_000

function StreakCard({ streak }: { streak: DisciplineStreak }) {
  const cap = Math.round(streak.maxExposureFraction * 100)
  return (
    <View style={styles.streak}>
      <View style={styles.streakTop}>
        <Text variant="label">Discipline streak</Text>
        <Text style={styles.streakDays}>{`${streak.days} ${streak.days === 1 ? 'day' : 'days'}`}</Text>
      </View>
      <View style={styles.bars} accessibilityLabel={`${streak.lastSevenDays.filter(Boolean).length} of the last 7 days in streak`}>
        {streak.lastSevenDays.map((inStreak, index) => (
          <View key={index} style={[styles.bar, { backgroundColor: inStreak ? palette.accent : palette.hairline }]} />
        ))}
      </View>
      <Text variant="secondary">
        {streak.days > 0
          ? `No panic sells, every entry inside your ${cap}% exposure cap.`
          : 'Starts today: no panic sells, every entry inside your cap.'}
      </Text>
      <Text variant="caption">Panic sell = closing at a loss within {streak.panicSellWindowMinutes} min of entry.</Text>
    </View>
  )
}

export default function DodgedScreen() {
  const { account } = useMobileWallet()
  const pubkey = account?.address.toBase58()
  const insets = useSafeAreaInsets()
  const query = useQuery({
    queryKey: ['dodged', pubkey],
    queryFn: () => getDodged(pubkey),
    refetchInterval: REFETCH_INTERVAL_MS,
  })

  // Schermata avorio: icone della status bar scure finché è in primo piano.
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle('dark')
      return () => setStatusBarStyle('light')
    }, []),
  )

  const data = query.data
  const count = data?.rugCount ?? 0

  return (
    <View style={{ flex: 1, backgroundColor: palette.ivory }}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 20 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={query.isRefetching}
            onRefresh={() => void query.refetch()}
            tintColor={palette.accentOnIvory}
            colors={[palette.accentOnIvory]}
          />
        }
      >
        <View style={{ gap: 8 }}>
          <Text variant="label" color={palette.accentOnIvory}>
            Last 24h Signet kept you out of
          </Text>
          <View style={styles.hero}>
            <Text style={styles.count}>{data ? String(count) : '–'}</Text>
            <Text style={styles.unit}>{count === 1 ? 'rug' : 'rugs'}</Text>
          </View>
        </View>

        {data && data.rugs.length > 0 ? (
          <View style={styles.list}>
            {data.rugs.map((rug, index) => (
              <Animated.View key={rug.signalId} entering={FadeInDown.duration(motion.base).delay(Math.min(index, 6) * 40)}>
                <Pressable
                  onPress={() => router.push(`/signal/${rug.signalId}`)}
                  style={({ pressed }) => [
                    styles.rugRow,
                    index < data.rugs.length - 1 && styles.rugDivider,
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text variant="heading" color={palette.onIvory} numberOfLines={1}>
                      {tokenTicker(rug.tokenSymbol, rug.tokenName)}
                    </Text>
                    <Text variant="caption" color={palette.onIvoryMuted} numberOfLines={1}>
                      {`High risk · ${shortReason(rug.reason)}`}
                    </Text>
                  </View>
                  <Text variant="mono" color={palette.accentOnIvory} style={{ fontSize: 16 }}>
                    {`${dropPct(rug.changePct)} · ${compactAge(rug.createdAt)}`}
                  </Text>
                </Pressable>
              </Animated.View>
            ))}
          </View>
        ) : (
          <View style={[styles.list, styles.empty]}>
            <Text variant="secondary" color={palette.onIvoryMuted}>
              {query.isError
                ? 'Service unreachable. Retrying shortly.'
                : query.isLoading
                  ? 'Reading pool prices…'
                  : `No rejected token has fallen ${Math.abs(data?.rugThresholdPct ?? 90)}%+ in the last 24h. Yet.`}
            </Text>
          </View>
        )}

        {data?.streak ? <StreakCard streak={data.streak} /> : null}

        <Text variant="caption" color={palette.onIvoryMuted} style={{ textAlign: 'center' }}>
          {data
            ? `Tokens rated High risk (never pushed to you) that then fell ${Math.abs(data.rugThresholdPct)}%+. ${data.rejectedCount} rejected in 24h, prices read on-chain from each pool.`
            : 'Outcomes are tracked on-chain after each rejection.'}
        </Text>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingBottom: 28, gap: 22 },
  hero: { flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  count: { fontFamily: fonts.display, fontSize: 96, lineHeight: 100, letterSpacing: -4, color: palette.onIvory },
  unit: { fontFamily: fonts.display, fontSize: 28, lineHeight: 34, color: palette.onIvory, paddingBottom: 12 },
  list: {
    backgroundColor: palette.ivoryCard,
    borderWidth: 1,
    borderColor: palette.ivoryBorder,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  empty: { paddingVertical: 18 },
  rugRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingVertical: 14 },
  rugDivider: { borderBottomWidth: 1, borderBottomColor: palette.ivoryDivider },
  streak: { gap: 12, backgroundColor: palette.bg, borderRadius: 20, padding: 18 },
  streakTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  streakDays: { fontFamily: fonts.display, fontSize: 20, color: palette.accent },
  bars: { flexDirection: 'row', gap: 6 },
  bar: { flex: 1, height: 10, borderRadius: radius.sm / 2 },
})
