import { useLocalSearchParams } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { View } from 'react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { VersionedTransaction } from '@solana/web3.js'
import { JUPITER_SWAP_ALLOWED_PROGRAMS, validateSwapTx } from '@seeker-signal/shared'
import { useMobileWallet } from '@wallet-ui/react-native-web3js'
import { AppActionButton } from '@/components/app-action-button'
import { ConnectWalletButton } from '@/components/connect-wallet-button'
import { BackBar, Divider, Row } from '@/components/ui/bits'
import { Glass } from '@/components/ui/glass'
import { Screen } from '@/components/ui/screen'
import { Text } from '@/components/ui/text'
import { palette } from '@/constants/theme'
import { buildSwap, BuildSwapError, getPositions, getStatus } from '@/lib/api/client'
import { useSettings } from '@/lib/settings/settings'

const VALIDATION_REASON_LABELS: Record<string, string> = {
  fee_payer_mismatch: 'Il fee payer della transazione non è il tuo wallet.',
  unresolvable_program: 'Impossibile risolvere un program della transazione.',
  amount_exceeds_cap: "L'importo supera quanto hai approvato per questa entry.",
  fee_account_mismatch: "La transazione non include l'account fee atteso.",
  fee_bps_exceeds_cap: 'La fee reale supera il limite consentito per il tuo tier.',
  fee_simulation_failed: 'Non è stato possibile verificare la fee reale (simulazione fallita).',
}

function describeValidationFailure(reason: string): string {
  if (VALIDATION_REASON_LABELS[reason]) return VALIDATION_REASON_LABELS[reason]
  if (reason.startsWith('program_not_allowed:')) return `Program non in allowlist: ${reason.split(':')[1]}`
  if (reason.startsWith('unknown_transfer_destination:')) {
    return `Trasferimento verso un indirizzo sconosciuto: ${reason.split(':')[1]}`
  }
  return `Validazione fallita: ${reason}`
}

function Blocked({ title, message }: { title: string; message: string }) {
  return (
    <Screen tabBar={false}>
      <BackBar title="Conferma entry" />
      <Glass glow={palette.red} style={{ marginTop: 12 }}>
        <Text variant="heading" color={palette.red}>
          {title}
        </Text>
        <Text variant="secondary">{message}</Text>
      </Glass>
    </Screen>
  )
}

export default function ApproveEntryScreen() {
  const {
    id,
    amountSol: amountSolParam,
    slippageBps: slippageBpsParam,
  } = useLocalSearchParams<{ id: string; amountSol: string; slippageBps: string }>()
  const amountSol = Number(amountSolParam)
  const slippageBps = Number(slippageBpsParam)

  const { account, connection, signAndSendTransactions } = useMobileWallet()
  const pubkey = account?.address.toBase58()
  const { settings } = useSettings()

  const buildQuery = useQuery({
    queryKey: ['build-swap', id, pubkey, amountSol, slippageBps],
    queryFn: async () => {
      // Ricontrollo lato app (CLAUDE.md, principio 3): il server applica già gli
      // stessi limiti, ma l'app non si fida ciecamente e blocca prima di costruire.
      const status = await getStatus()
      if (status.killSwitch) throw new Error('Trading sospeso dal servizio (kill switch attivo).')
      const { portfolio } = await getPositions()
      if (amountSol > portfolio.remainingSol) {
        throw new Error(
          `Supereresti il limite del ${portfolio.maxExposureFraction * 100}% di esposizione: margine residuo ${portfolio.remainingSol.toFixed(4)} SOL.`,
        )
      }
      return buildSwap({ signalId: id, pubkey: pubkey!, amountSol, slippageBps })
    },
    enabled: !settings.killSwitch && !!pubkey && Number.isFinite(amountSol) && Number.isFinite(slippageBps),
    retry: false,
  })

  if (settings.killSwitch) {
    return (
      <Blocked
        title="Kill switch attivo"
        message="Nuove entry bloccate su questo dispositivo. Puoi disattivarlo da Opzioni."
      />
    )
  }

  if (!pubkey) {
    return (
      <Screen tabBar={false}>
        <BackBar title="Conferma entry" />
        <Text variant="secondary">Connetti il wallet per continuare.</Text>
        <ConnectWalletButton />
      </Screen>
    )
  }

  if (buildQuery.isLoading) {
    return (
      <Screen tabBar={false}>
        <BackBar title="Conferma entry" />
        <Glass style={{ marginTop: 12, alignItems: 'center', paddingVertical: 40 }}>
          <Text variant="heading">Costruzione della transazione…</Text>
          <Text variant="secondary">Quote e blockhash aggiornati in questo istante.</Text>
        </Glass>
      </Screen>
    )
  }

  if (buildQuery.isError || !buildQuery.data) {
    const error = buildQuery.error
    const message =
      error instanceof BuildSwapError
        ? (error.body.message ?? error.body.error)
        : error instanceof Error
          ? error.message
          : 'Errore sconosciuto'
    return <Blocked title="Swap non disponibile" message={message} />
  }

  const build = buildQuery.data
  const receive =
    build.quote.outAmountUi !== null ? build.quote.outAmountUi.toLocaleString('it-IT') : build.quote.outAmount

  return (
    <Screen scroll tabBar={false}>
      <BackBar title="Conferma entry" />

      <Animated.View entering={FadeInDown.duration(450)} style={{ gap: 6, marginTop: 8 }}>
        <Text variant="label">Spendi</Text>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
          <Text variant="number" style={{ fontSize: 56, lineHeight: 60 }}>
            {build.amountSol}
          </Text>
          <Text variant="title" color={palette.textSecondary} style={{ marginBottom: 6 }}>
            SOL
          </Text>
        </View>
        <Text variant="secondary">Ricevi circa {receive} token</Text>
      </Animated.View>

      <Animated.View entering={FadeInDown.duration(450).delay(80)}>
        <Glass style={{ gap: 14 }}>
          <Row label="Fee piattaforma" value={`${build.feeBps / 100}% · ${build.feeSol.toFixed(6)} SOL`} />
          <Divider />
          <Row label="Slippage massimo" value={`${build.quote.slippageBps / 100}%`} />
          <Divider />
          <Row label="Impatto sul prezzo" value={`${build.quote.priceImpactPct}%`} />
        </Glass>
      </Animated.View>

      {build.tradingMode === 'paper' ? (
        <Animated.View entering={FadeInDown.duration(450).delay(140)}>
          <Glass glow={palette.amber}>
            <Text variant="label" color={palette.amber}>
              Modalità paper
            </Text>
            <Text variant="secondary">
              La transazione viene costruita e verificata, ma non firmata né inviata: nessun fondo reale si muove.
            </Text>
          </Glass>
        </Animated.View>
      ) : null}

      <Animated.View entering={FadeInDown.duration(450).delay(200)} style={{ gap: 10 }}>
        <AppActionButton
          title={build.tradingMode === 'paper' ? 'Verifica (paper)' : 'Firma e invia'}
          onPress={async () => {
            const transaction = VersionedTransaction.deserialize(
              new Uint8Array(Buffer.from(build.transactionBase64, 'base64')),
            )

            const validation = await validateSwapTx(transaction, {
              userPubkey: pubkey,
              maxSol: amountSol,
              allowedPrograms: JUPITER_SWAP_ALLOWED_PROGRAMS as string[],
              expectedFeeAccount: build.feeAccount,
              maxFeeBps: build.feeBps,
              connection,
            })

            if (!validation.valid) {
              return {
                status: 'danger',
                title: 'Validazione fallita: non firmare',
                description: describeValidationFailure(validation.reason),
              } as const
            }

            if (build.tradingMode === 'paper') {
              return {
                status: 'success',
                title: 'Transazione verificata',
                description: 'Tutti i controlli superati. Nessuna transazione reale inviata (paper mode).',
              } as const
            }

            const { context } = await connection.getLatestBlockhashAndContext()
            const signature = await signAndSendTransactions(transaction, context.slot)
            await connection.confirmTransaction(
              { signature, blockhash: build.blockhash, lastValidBlockHeight: build.lastValidBlockHeight },
              'confirmed',
            )

            return { status: 'success', title: 'Entry confermata on-chain', description: signature } as const
          }}
        />
        <Text variant="caption" style={{ textAlign: 'center' }}>
          Prima della firma l&apos;app verifica fee payer, program, importo e destinatari.
        </Text>
      </Animated.View>
    </Screen>
  )
}
