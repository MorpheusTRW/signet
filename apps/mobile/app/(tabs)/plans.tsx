import { useQuery } from '@tanstack/react-query'
import { StyleSheet, View } from 'react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { useMobileWallet } from '@wallet-ui/react-native-web3js'
import { SymbolView } from 'expo-symbols'
import { Header } from '@/components/ui/bits'
import { Button } from '@/components/ui/button'
import { Glass } from '@/components/ui/glass'
import { Screen } from '@/components/ui/screen'
import { Text } from '@/components/ui/text'
import { palette, radius } from '@/constants/theme'
import { getMeTier } from '@/lib/api/client'
import type { Tier } from '@/lib/api/types'

// Fee di default per tier (allineate a .env.example dell'engine): sono valori di
// riferimento configurabili lato server; "piano attuale" è l'unico dato live.
const PLANS: { tier: Tier; title: string; subtitle: string; feeBps: number; color: string; benefits: string[] }[] = [
  {
    tier: 'free',
    title: 'Free',
    subtitle: 'Get started',
    feeBps: 75,
    color: palette.textSecondary,
    benefits: ['Delayed signals', 'Basic filters', 'Last 24h history'],
  },
  {
    tier: 'pro',
    title: 'Pro',
    subtitle: '30 days · USDC or SKR',
    feeBps: 50,
    color: palette.mint,
    benefits: ['Real-time signals', 'Custom filters', 'Full history'],
  },
  {
    tier: 'holder',
    title: 'Holder',
    subtitle: 'Hold or stake SKR',
    feeBps: 30,
    color: palette.violet,
    benefits: ['Everything in Pro, free', 'Lowest swap fees'],
  },
]

export default function PlansScreen() {
  const { account } = useMobileWallet()
  const pubkey = account?.address.toBase58()
  const tierQuery = useQuery({ queryKey: ['me-tier', pubkey], queryFn: () => getMeTier(pubkey!), enabled: !!pubkey })

  return (
    <Screen scroll>
      <Header eyebrow="Access" title="Plans" />
      {!pubkey ? <Text variant="secondary">Connect your wallet to see your current plan.</Text> : null}

      {PLANS.map((plan, index) => {
        const isCurrent = tierQuery.data?.tier === plan.tier
        return (
          <Animated.View key={plan.tier} entering={FadeInDown.duration(450).delay(index * 70)}>
            <Glass glow={isCurrent ? plan.color : undefined} style={{ gap: 14 }}>
              <View style={styles.top}>
                <View style={{ gap: 2 }}>
                  <Text variant="title" color={plan.tier === 'free' ? palette.text : plan.color}>
                    {plan.title}
                  </Text>
                  <Text variant="caption">{plan.subtitle}</Text>
                </View>
                {isCurrent ? (
                  <View style={[styles.current, { borderColor: plan.color + '66' }]}>
                    <Text variant="label" color={plan.color}>
                      Current
                    </Text>
                  </View>
                ) : null}
              </View>

              <View style={{ gap: 8 }}>
                {plan.benefits.map((benefit) => (
                  <View key={benefit} style={styles.benefit}>
                    <SymbolView
                      name={{ ios: 'checkmark', android: 'check' }}
                      tintColor={plan.tier === 'free' ? palette.textSecondary : plan.color}
                      size={16}
                    />
                    <Text variant="body">{benefit}</Text>
                  </View>
                ))}
              </View>

              <Text variant="mono">SWAP FEE {plan.feeBps / 100}%</Text>
              {plan.tier !== 'free' && !isCurrent ? (
                <Button title="Coming soon" variant="ghost" disabled onPress={() => {}} />
              ) : null}
            </Glass>
          </Animated.View>
        )
      })}
    </Screen>
  )
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  current: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill, borderWidth: 1 },
  benefit: { flexDirection: 'row', alignItems: 'center', gap: 10 },
})
