import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { StyleSheet, Switch, TextInput, View } from 'react-native'
import { Chip, Divider, Header, Row } from '@/components/ui/bits'
import { Glass } from '@/components/ui/glass'
import { Screen } from '@/components/ui/screen'
import { Text } from '@/components/ui/text'
import { fonts, palette } from '@/constants/theme'
import { getStatus } from '@/lib/api/client'
import { useSettings } from '@/lib/settings/settings'

const SLIPPAGE_PRESETS = [50, 100, 200, 500]

export default function SettingsScreen() {
  const { loaded } = useSettings()
  // I campi si inizializzano dai valori salvati: montarli solo a caricamento finito.
  if (!loaded) {
    return (
      <Screen>
        <Header eyebrow="Preferenze" title="Opzioni" />
      </Screen>
    )
  }
  return <SettingsForm />
}

function SettingsForm() {
  const { settings, update } = useSettings()
  const [size, setSize] = useState(String(settings.defaultSizeSol))
  const status = useQuery({ queryKey: ['status'], queryFn: getStatus, refetchInterval: 15_000 })

  function commitSize() {
    const value = Number(size.replace(',', '.'))
    if (Number.isFinite(value) && value > 0) update({ defaultSizeSol: value })
    else setSize(String(settings.defaultSizeSol))
  }

  const serviceOk = status.data && !status.data.killSwitch

  return (
    <Screen scroll>
      <Header eyebrow="Preferenze" title="Opzioni" />

      <Glass style={{ gap: 16 }}>
        <Text variant="label">Importo predefinito</Text>
        <View style={styles.amountRow}>
          <TextInput
            style={styles.amountInput}
            keyboardType="decimal-pad"
            value={size}
            onChangeText={setSize}
            onEndEditing={commitSize}
            selectionColor={palette.mint}
          />
          <Text variant="heading" color={palette.textSecondary}>
            SOL
          </Text>
        </View>
        <Divider />
        <Text variant="label">Slippage predefinito</Text>
        <View style={styles.chips}>
          {SLIPPAGE_PRESETS.map((bps) => (
            <Chip
              key={bps}
              label={`${bps / 100}%`}
              selected={settings.slippageBps === bps}
              onPress={() => update({ slippageBps: bps })}
            />
          ))}
        </View>
      </Glass>

      <Glass glow={settings.killSwitch ? palette.red : undefined} style={{ gap: 10 }}>
        <View style={styles.switchRow}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text variant="heading" color={settings.killSwitch ? palette.red : palette.text}>
              Kill switch
            </Text>
            <Text variant="secondary">Blocca ogni nuova entry su questo telefono. Le posizioni aperte restano.</Text>
          </View>
          <Switch
            value={settings.killSwitch}
            onValueChange={(v) => update({ killSwitch: v })}
            trackColor={{ false: palette.surfaceStrong, true: palette.red + '88' }}
            thumbColor={settings.killSwitch ? palette.red : palette.textSecondary}
          />
        </View>
      </Glass>

      <Glass style={{ gap: 14 }}>
        <Text variant="label">Servizio</Text>
        <Row
          label="Stato"
          value={
            status.data ? (serviceOk ? 'Operativo' : 'Trading sospeso') : status.isError ? 'Non raggiungibile' : '…'
          }
          valueColor={status.data ? (serviceOk ? palette.mint : palette.red) : palette.textSecondary}
        />
        <Divider />
        <Row
          label="Modalità"
          value={status.data ? (status.data.tradingMode === 'paper' ? 'Paper (simulata)' : 'Live') : '…'}
          valueColor={status.data?.tradingMode === 'live' ? palette.amber : undefined}
        />
      </Glass>

      <Glass style={{ gap: 8 }}>
        <Text variant="label">Avvertenze</Text>
        <Text variant="secondary">
          Seeker Signal non è consulenza finanziaria. I segnali sono generati automaticamente da regole sui dati
          on-chain e non garantiscono alcun risultato: i token appena lanciati sono estremamente rischiosi e puoi
          perdere l&apos;intero importo. Non gestiamo mai le tue chiavi: ogni operazione è firmata da te dal tuo wallet.
          Su ogni swap è applicata una fee di piattaforma, mostrata prima della firma.
        </Text>
      </Glass>
    </Screen>
  )
}

const styles = StyleSheet.create({
  amountRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  amountInput: {
    flex: 1,
    color: palette.text,
    fontFamily: fonts.bold,
    fontSize: 34,
    letterSpacing: -1,
    paddingVertical: 0,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
})
