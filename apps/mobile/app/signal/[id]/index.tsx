import { useState } from 'react'
import { router, useLocalSearchParams } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { Linking, Pressable, StyleSheet, TextInput, View } from 'react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'
import Clipboard from '@react-native-clipboard/clipboard'
import * as Haptics from 'expo-haptics'
import { SymbolView } from 'expo-symbols'
import { BackBar, Chip, Metric, TokenAvatar } from '@/components/ui/bits'
import { Button } from '@/components/ui/button'
import { Glass } from '@/components/ui/glass'
import { RiskMeter, RiskPill } from '@/components/ui/risk'
import { Screen } from '@/components/ui/screen'
import { Text } from '@/components/ui/text'
import { fonts, palette, radius, risk } from '@/constants/theme'
import { getSignal } from '@/lib/api/client'
import { formatSol, shortAddress, timeAgo } from '@/lib/format'
import { launchPage } from '@/lib/launch-page'
import { useSettings } from '@/lib/settings/settings'

const AMOUNT_PRESETS = [0.05, 0.1, 0.25, 0.5]
const SLIPPAGE_PRESETS = [50, 100, 200, 500]

export default function SignalDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const query = useQuery({ queryKey: ['signal', id], queryFn: () => getSignal(id), enabled: !!id })

  const { settings } = useSettings()
  const [amountSol, setAmountSol] = useState(String(settings.defaultSizeSol))
  const [slippageBps, setSlippageBps] = useState(settings.slippageBps)
  const [copied, setCopied] = useState(false)

  if (query.isLoading || query.isError || !query.data) {
    return (
      <Screen tabBar={false}>
        <BackBar />
        <Text variant="secondary">{query.isLoading ? 'Loading…' : 'Signal not found.'}</Text>
      </Screen>
    )
  }

  const signal = query.data
  const level = signal.riskReport.level
  const symbol = signal.tokenSymbol?.trim() || signal.tokenName?.trim() || 'Token'
  const page = launchPage(signal)
  const amount = Number(amountSol.replace(',', '.'))
  const amountValid = Number.isFinite(amount) && amount > 0

  return (
    <Screen scroll tabBar={false}>
      <BackBar title="Signal" />

      {/* Hero del token */}
      <Animated.View entering={FadeInDown.duration(450)} style={styles.hero}>
        <TokenAvatar symbol={symbol} imageUrl={signal.imageUrl} size={64} />
        <View style={{ flex: 1, gap: 4 }}>
          <Text variant="title" numberOfLines={1}>
            {symbol}
          </Text>
          <Pressable
            onPress={() => {
              Clipboard.setString(signal.tokenMint)
              void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
              setCopied(true)
            }}
            style={styles.mint}
          >
            <Text variant="mono">{shortAddress(signal.tokenMint, 6)}</Text>
            <SymbolView
              name={{ ios: copied ? 'checkmark' : 'doc.on.doc', android: copied ? 'check' : 'content_copy' }}
              tintColor={copied ? palette.accent : palette.textTertiary}
              size={14}
            />
          </Pressable>
        </View>
      </Animated.View>

      <Animated.View entering={FadeInDown.duration(450).delay(60)}>
        <Button
          title={page.label}
          variant="ghost"
          onPress={() => void Linking.openURL(page.url)}
          icon={
            <SymbolView name={{ ios: 'arrow.up.right', android: 'north_east' }} tintColor={palette.text} size={18} />
          }
        />
      </Animated.View>

      {/* Rischio: numero grande + indicatore a segmenti + motivi */}
      <Animated.View entering={FadeInDown.duration(450).delay(120)}>
        <Glass glow={risk[level].color} style={{ gap: 16 }}>
          <View style={styles.riskTop}>
            <View>
              <Text variant="label">Risk score</Text>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 4 }}>
                <Text variant="number" color={risk[level].color}>
                  {signal.riskReport.score}
                </Text>
                <Text variant="secondary" style={{ marginBottom: 8 }}>
                  /100
                </Text>
              </View>
            </View>
            <RiskPill level={level} />
          </View>
          <RiskMeter score={signal.riskReport.score} level={level} />
          <View style={{ gap: 10 }}>
            {signal.riskReport.reasons.map((reason) => (
              <View key={reason} style={styles.reason}>
                <View style={[styles.reasonDot, { backgroundColor: risk[level].color }]} />
                <Text variant="secondary" style={{ flex: 1 }}>
                  {reason}
                </Text>
              </View>
            ))}
          </View>
        </Glass>
      </Animated.View>

      <Animated.View entering={FadeInDown.duration(450).delay(180)}>
        <Glass>
          <Text variant="label">Summary</Text>
          <Text variant="body">{signal.summary}</Text>
        </Glass>
      </Animated.View>

      <Animated.View entering={FadeInDown.duration(450).delay(240)}>
        <Glass style={{ gap: 18 }}>
          <View style={styles.grid}>
            <Metric label="Liquidity" value={formatSol(signal.initialLiquiditySol)} />
            <Metric label="Detected" value={timeAgo(signal.createdAt)} />
          </View>
          <View style={styles.grid}>
            <Metric label="Pool" value={shortAddress(signal.poolAddress)} mono />
            <Metric label="Venue" value={signal.program} mono />
          </View>
        </Glass>
      </Animated.View>

      {/* Entry: importo, slippage, azione principale */}
      <Animated.View entering={FadeInDown.duration(450).delay(300)}>
        <Glass style={{ gap: 16 }}>
          <Text variant="label">Amount</Text>
          <View style={styles.amountRow}>
            <TextInput
              style={styles.amountInput}
              keyboardType="decimal-pad"
              value={amountSol}
              onChangeText={setAmountSol}
              selectionColor={palette.accent}
              placeholder="0.0"
              placeholderTextColor={palette.textTertiary}
            />
            <Text variant="heading" color={palette.textSecondary}>
              SOL
            </Text>
          </View>
          <View style={styles.chips}>
            {AMOUNT_PRESETS.map((preset) => (
              <Chip
                key={preset}
                label={`${preset}`}
                selected={amount === preset}
                onPress={() => setAmountSol(String(preset))}
              />
            ))}
          </View>

          <Text variant="label">Max slippage</Text>
          <View style={styles.chips}>
            {SLIPPAGE_PRESETS.map((bps) => (
              <Chip
                key={bps}
                label={`${bps / 100}%`}
                selected={slippageBps === bps}
                onPress={() => setSlippageBps(bps)}
              />
            ))}
          </View>

          <Button
            title="Approve entry"
            disabled={!amountValid}
            onPress={() =>
              router.push({
                pathname: '/signal/[id]/approve',
                params: { id: signal.id, amountSol: String(amount), slippageBps: String(slippageBps) },
              })
            }
          />
          <Text variant="caption" style={{ textAlign: 'center' }}>
            The transaction is built on the spot and verified before you sign.
          </Text>
        </Glass>
      </Animated.View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  hero: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 4 },
  mint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.sm,
    backgroundColor: palette.surface,
  },
  riskTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  reason: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  reasonDot: { width: 5, height: 5, borderRadius: 3, marginTop: 8 },
  grid: { flexDirection: 'row', gap: 16 },
  amountRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  amountInput: {
    flex: 1,
    color: palette.text,
    fontFamily: fonts.bold,
    fontSize: 40,
    letterSpacing: -1.2,
    paddingVertical: 0,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
})
