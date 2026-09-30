import { router } from 'expo-router'
import { useEffect } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import Animated, { FadeInDown, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated'
import type { RiskLevel, Signal } from '@seeker-signal/shared'
import { FingerprintGlyph } from '@/components/fingerprint-rings'
import { TokenAvatar } from '@/components/ui/bits'
import { Text } from '@/components/ui/text'
import { fonts, motion, palette, radius, risk } from '@/constants/theme'
import { compactAge, tokenTicker } from '@/lib/format'

/** Colore del badge: avorio per il rischio basso (come il mockup), semantico per gli altri. */
const BADGE_COLOR: Record<RiskLevel, string> = {
  low: palette.text,
  medium: palette.warning,
  high: palette.negative,
}

/** "Risk: Low" sempre scritto a parole; alla comparsa della card il bordo "si accende". */
export function RiskBadge({ level }: { level: RiskLevel }) {
  const glow = useSharedValue(0.25)
  useEffect(() => {
    glow.set(withDelay(motion.fast, withTiming(1, { duration: motion.base })))
  }, [glow])
  const style = useAnimatedStyle(() => ({ opacity: glow.get() }))
  const color = BADGE_COLOR[level]
  return (
    <Animated.View style={[styles.badge, { borderColor: color }, style]}>
      <Text variant="mono" color={color} style={{ fontSize: 12 }}>
        Risk: {risk[level].label}
      </Text>
    </Animated.View>
  )
}

/** Card "NEW SIGNAL" del feed: leggibile in 2 secondi, un'unica azione. */
export function SignalCard({
  signal,
  amountSol,
  slippageBps,
}: {
  signal: Signal
  amountSol: number
  slippageBps: number
}) {
  const ticker = tokenTicker(signal.tokenSymbol, signal.tokenName)
  const level = signal.riskReport.level

  return (
    <Animated.View entering={FadeInDown.duration(motion.base)} style={styles.shadow}>
      <Pressable
        onPress={() => router.push(`/signal/${signal.id}`)}
        style={({ pressed }) => [styles.card, { opacity: pressed ? 0.9 : 1 }]}
        accessibilityHint="Opens the signal details"
      >
        <View style={styles.top}>
          <Text variant="label" color={palette.accent}>
            {`New signal · ${compactAge(signal.createdAt)}`}
          </Text>
          <RiskBadge level={level} />
        </View>

        <View style={styles.titleRow}>
          <TokenAvatar symbol={ticker.slice(1)} imageUrl={signal.imageUrl} size={34} />
          <Text variant="title" numberOfLines={1} style={{ flex: 1 }}>
            {ticker}
          </Text>
        </View>

        <Text variant="mono" color={palette.text} style={styles.summary} numberOfLines={3}>
          {signal.summary}
        </Text>

        <Pressable
          accessibilityRole="button"
          onPress={() =>
            router.push({
              pathname: '/signal/[id]/approve',
              params: { id: signal.id, amountSol: String(amountSol), slippageBps: String(slippageBps) },
            })
          }
          style={({ pressed }) => [styles.approve, { opacity: pressed ? 0.85 : 1 }]}
        >
          <FingerprintGlyph color={palette.onAccent} />
          <Text style={styles.approveLabel}>Approve Entry · {amountSol} SOL</Text>
        </Pressable>
      </Pressable>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  shadow: {
    marginHorizontal: 16,
    borderRadius: 22,
    shadowColor: palette.accent,
    shadowOpacity: 0.18,
    shadowRadius: 40,
    shadowOffset: { width: 0, height: 0 },
  },
  card: {
    gap: 14,
    padding: 18,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.accent,
    borderRadius: 22,
  },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  summary: { fontSize: 15, lineHeight: 22 },
  badge: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 4 },
  approve: {
    height: 56,
    borderRadius: radius.md,
    backgroundColor: palette.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  approveLabel: { fontFamily: fonts.display, fontSize: 15, color: palette.onAccent },
})
