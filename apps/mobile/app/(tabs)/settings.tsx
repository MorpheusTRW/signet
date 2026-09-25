import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { ScrollView, Switch, Text, TextInput, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { appStyles, colors } from '@/constants/app-styles'
import { getStatus } from '@/lib/api/client'
import { useSettings } from '@/lib/settings/settings'

const inputStyle = {
  color: colors.text,
  fontSize: 20,
  borderBottomWidth: 1,
  borderBottomColor: colors.border,
  paddingVertical: 6,
}

export default function SettingsScreen() {
  const { loaded } = useSettings()
  // I campi si inizializzano dai valori salvati: montarli solo a caricamento finito.
  if (!loaded) {
    return (
      <SafeAreaView style={appStyles.screen}>
        <Text style={appStyles.textMuted}>Caricamento…</Text>
      </SafeAreaView>
    )
  }
  return <SettingsForm />
}

function SettingsForm() {
  const { settings, update } = useSettings()
  const [size, setSize] = useState(String(settings.defaultSizeSol))
  const [slippage, setSlippage] = useState(String(settings.slippageBps))
  const status = useQuery({ queryKey: ['status'], queryFn: getStatus, refetchInterval: 15_000 })

  function commitSize() {
    const value = Number(size)
    if (Number.isFinite(value) && value > 0) update({ defaultSizeSol: value })
    else setSize(String(settings.defaultSizeSol))
  }
  function commitSlippage() {
    const value = Math.round(Number(slippage))
    if (Number.isFinite(value) && value > 0 && value <= 5000) update({ slippageBps: value })
    else setSlippage(String(settings.slippageBps))
  }

  return (
    <SafeAreaView style={appStyles.screen}>
      <ScrollView contentContainerStyle={appStyles.stack}>
        <Text style={appStyles.title}>Impostazioni</Text>

        <View style={appStyles.card}>
          <Text style={appStyles.subtitle}>Size di default (SOL)</Text>
          <TextInput
            style={inputStyle}
            keyboardType="decimal-pad"
            value={size}
            onChangeText={setSize}
            onEndEditing={commitSize}
          />
          <Text style={appStyles.subtitle}>Slippage di default (bps, 100 = 1%)</Text>
          <TextInput
            style={inputStyle}
            keyboardType="number-pad"
            value={slippage}
            onChangeText={setSlippage}
            onEndEditing={commitSlippage}
          />
        </View>

        <View style={appStyles.card}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={[appStyles.body, { fontWeight: '700' }]}>Kill switch</Text>
            <Switch value={settings.killSwitch} onValueChange={(v) => update({ killSwitch: v })} />
          </View>
          <Text style={appStyles.textMuted}>
            Blocca tutte le nuove entry su questo dispositivo. Non tocca le posizioni già aperte.
          </Text>
        </View>

        <View style={appStyles.card}>
          <Text style={appStyles.body}>Servizio</Text>
          {status.data ? (
            <>
              <Text style={status.data.killSwitch ? appStyles.textDanger : appStyles.textSuccess}>
                {status.data.killSwitch ? 'Trading sospeso dal servizio' : 'Trading attivo'}
              </Text>
              <Text style={appStyles.textMuted}>Modalità: {status.data.tradingMode}</Text>
            </>
          ) : (
            <Text style={appStyles.textMuted}>{status.isError ? 'Servizio non raggiungibile' : 'Caricamento…'}</Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
