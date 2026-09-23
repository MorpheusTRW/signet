import { useQuery } from '@tanstack/react-query'
import { ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useMobileWallet } from '@wallet-ui/react-native-web3js'
import { AppActionButton } from '@/components/app-action-button'
import { appStyles, colors } from '@/constants/app-styles'
import { getMeTier } from '@/lib/api/client'
import type { Tier } from '@/lib/api/types'

// Vantaggi e fee di default per tier (allineati a CLAUDE.md / .env.example
// dell'engine: FREE_PLATFORM_FEE_BPS=75, PRO_PLATFORM_FEE_BPS=50,
// HOLDER_PLATFORM_FEE_BPS=30). Sono valori di default configurabili lato
// server: qui sono mostrati come riferimento, "tier attuale" è l'unico dato
// live (da GET /me/tier).
const PLANS: {
  tier: Tier
  title: string
  subtitle: string
  feeBps: number
  benefits: string[]
}[] = [
  {
    tier: 'free',
    title: 'FREE',
    subtitle: 'Per iniziare',
    feeBps: 75,
    benefits: ['Segnali con ritardo', 'Solo filtri base', 'Storico ultime 24h'],
  },
  {
    tier: 'pro',
    title: 'PRO',
    subtitle: 'Abbonamento 30 giorni · USDC o SKR',
    feeBps: 50,
    benefits: ['Segnali in tempo reale', 'Filtri personalizzati', 'Storico completo'],
  },
  {
    tier: 'holder',
    title: 'HOLDER',
    subtitle: 'SKR in saldo o in stake',
    feeBps: 30,
    benefits: ['Tutti i vantaggi PRO, gratis', 'Fee più basse sugli swap'],
  },
]

export default function PlansScreen() {
  const { account } = useMobileWallet()
  const pubkey = account?.address.toBase58()

  const tierQuery = useQuery({
    queryKey: ['me-tier', pubkey],
    queryFn: () => getMeTier(pubkey!),
    enabled: !!pubkey,
  })

  return (
    <SafeAreaView style={appStyles.screen}>
      <ScrollView contentContainerStyle={appStyles.stack}>
        <Text style={appStyles.title}>Piani</Text>
        {!pubkey ? <Text style={appStyles.textMuted}>Connetti il wallet per vedere il tuo piano attuale.</Text> : null}

        {PLANS.map((plan) => {
          const isCurrent = tierQuery.data?.tier === plan.tier
          return (
            <View
              key={plan.tier}
              style={[appStyles.card, isCurrent ? { borderColor: colors.accent, borderWidth: 2 } : null]}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={[appStyles.body, { fontWeight: '700' }]}>{plan.title}</Text>
                {isCurrent ? <Text style={{ color: colors.accent, fontWeight: '700' }}>Piano attuale</Text> : null}
              </View>
              <Text style={appStyles.textMuted}>{plan.subtitle}</Text>
              <View style={{ gap: 2 }}>
                {plan.benefits.map((benefit) => (
                  <Text key={benefit} style={appStyles.body}>
                    • {benefit}
                  </Text>
                ))}
              </View>
              <Text style={appStyles.textMuted}>Fee piattaforma sugli swap: {plan.feeBps / 100}%</Text>
              {plan.tier !== 'free' ? (
                <AppActionButton title="Acquista (presto disponibile)" disabled onPress={async () => {}} />
              ) : null}
            </View>
          )
        })}
      </ScrollView>
    </SafeAreaView>
  )
}
