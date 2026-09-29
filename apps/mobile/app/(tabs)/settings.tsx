import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { StyleSheet, Switch, TextInput, View } from 'react-native'
import { useMobileWallet } from '@wallet-ui/react-native-web3js'
import { ConnectWalletButton } from '@/components/connect-wallet-button'
import { Chip, Divider, Header, Row } from '@/components/ui/bits'
import { Button } from '@/components/ui/button'
import { shortAddress } from '@/lib/format'
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
        <Header eyebrow="Preferences" title="Settings" />
      </Screen>
    )
  }
  return <SettingsForm />
}

function SettingsForm() {
  const { settings, update } = useSettings()
  const [size, setSize] = useState(String(settings.defaultSizeSol))
  const status = useQuery({ queryKey: ['status'], queryFn: getStatus, refetchInterval: 15_000 })
  const { account, disconnect } = useMobileWallet()
  const pubkey = account?.address.toBase58()

  function commitSize() {
    const value = Number(size.replace(',', '.'))
    if (Number.isFinite(value) && value > 0) update({ defaultSizeSol: value })
    else setSize(String(settings.defaultSizeSol))
  }

  const serviceOk = status.data && !status.data.killSwitch

  return (
    <Screen scroll>
      <Header eyebrow="Preferences" title="Settings" />

      <Glass style={{ gap: 14 }}>
        <Text variant="label">Wallet</Text>
        {pubkey ? (
          <>
            <Row label="Connected" value={shortAddress(pubkey, 6)} valueColor={palette.positive} />
            <Button title="Disconnect" variant="ghost" onPress={() => void disconnect()} />
          </>
        ) : (
          <ConnectWalletButton />
        )}
      </Glass>

      <Glass style={{ gap: 16 }}>
        <Text variant="label">Default amount</Text>
        <View style={styles.amountRow}>
          <TextInput
            style={styles.amountInput}
            keyboardType="decimal-pad"
            value={size}
            onChangeText={setSize}
            onEndEditing={commitSize}
            selectionColor={palette.accent}
          />
          <Text variant="heading" color={palette.textSecondary}>
            SOL
          </Text>
        </View>
        <Divider />
        <Text variant="label">Default slippage</Text>
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

      <Glass glow={settings.killSwitch ? palette.negative : undefined} style={{ gap: 10 }}>
        <View style={styles.switchRow}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text variant="heading" color={settings.killSwitch ? palette.negative : palette.text}>
              Kill switch
            </Text>
            <Text variant="secondary">Blocks every new entry on this phone. Open positions are kept.</Text>
          </View>
          <Switch
            value={settings.killSwitch}
            onValueChange={(v) => update({ killSwitch: v })}
            trackColor={{ false: palette.surfaceStrong, true: palette.negative + '88' }}
            thumbColor={settings.killSwitch ? palette.negative : palette.textSecondary}
          />
        </View>
      </Glass>

      <Glass style={{ gap: 14 }}>
        <Text variant="label">Service</Text>
        <Row
          label="Status"
          value={status.data ? (serviceOk ? 'Operational' : 'Trading paused') : status.isError ? 'Unreachable' : '…'}
          valueColor={status.data ? (serviceOk ? palette.positive : palette.negative) : palette.textSecondary}
        />
        <Divider />
        <Row
          label="Mode"
          value={status.data ? (status.data.tradingMode === 'paper' ? 'Paper (simulated)' : 'Live') : '…'}
          valueColor={status.data?.tradingMode === 'live' ? palette.warning : undefined}
        />
      </Glass>

      <Glass style={{ gap: 8 }}>
        <Text variant="label">Disclaimer</Text>
        <Text variant="secondary">
          Signet is not financial advice. Signals are generated automatically from rules on on-chain data and guarantee
          no outcome: newly launched tokens are extremely risky and you can lose your entire amount. We never hold your
          keys: every trade is signed by you in your own wallet. A platform fee applies to every swap and is always
          shown before you sign.
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
