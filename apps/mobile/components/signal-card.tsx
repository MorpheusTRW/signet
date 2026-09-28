import { Pressable, StyleSheet, View } from 'react-native'
import { router } from 'expo-router'
import Animated, { FadeInDown } from 'react-native-reanimated'
import type { Signal } from '@seeker-signal/shared'
import { Glass } from '@/components/ui/glass'
import { Tag, TokenAvatar } from '@/components/ui/bits'
import { RiskPill } from '@/components/ui/risk'
import { Text } from '@/components/ui/text'
import { risk } from '@/constants/theme'
import { formatSol, timeAgo } from '@/lib/format'

/** Card del feed: leggibile in 2 secondi (token, rischio, sintesi, tre numeri). */
export function SignalCard({ signal, index = 0 }: { signal: Signal; index?: number }) {
  const level = signal.riskReport.level
  const symbol = signal.tokenSymbol?.trim() || signal.tokenName?.trim() || 'Token'

  return (
    <Animated.View entering={FadeInDown.duration(420).delay(Math.min(index, 8) * 45)}>
      <Pressable
        onPress={() => router.push(`/signal/${signal.id}`)}
        style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.985 : 1 }] }]}
      >
        <Glass style={styles.card}>
          {/* Filo luminoso del colore di rischio sul bordo sinistro. */}
          <View style={[styles.edge, { backgroundColor: risk[level].color, shadowColor: risk[level].color }]} />

          <View style={styles.top}>
            <TokenAvatar symbol={symbol} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="heading" numberOfLines={1}>
                {symbol}
              </Text>
              <Text variant="caption" numberOfLines={1}>
                {signal.tokenName && signal.tokenName !== symbol ? `${signal.tokenName} · ` : ''}
                {timeAgo(signal.createdAt)}
              </Text>
            </View>
            <RiskPill level={level} compact />
          </View>

          <Text variant="secondary" numberOfLines={2}>
            {signal.summary}
          </Text>

          <View style={styles.tags}>
            <Tag>LIQ {formatSol(signal.initialLiquiditySol)}</Tag>
            <Tag>SCORE {signal.riskReport.score}</Tag>
            <Tag>{signal.program.toUpperCase()}</Tag>
          </View>
        </Glass>
      </Pressable>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  card: { overflow: 'hidden', paddingLeft: 20, gap: 12 },
  edge: {
    position: 'absolute',
    left: 0,
    top: 18,
    bottom: 18,
    width: 3,
    borderTopRightRadius: 3,
    borderBottomRightRadius: 3,
    shadowOpacity: 0.9,
    shadowRadius: 8,
  },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
})
