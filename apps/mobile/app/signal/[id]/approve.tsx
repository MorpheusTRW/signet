import { useLocalSearchParams } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { VersionedTransaction } from '@solana/web3.js'
import { JUPITER_SWAP_ALLOWED_PROGRAMS, validateSwapTx } from '@seeker-signal/shared'
import { useMobileWallet } from '@wallet-ui/react-native-web3js'
import { AppActionButton } from '@/components/app-action-button'
import { ConnectWalletButton } from '@/components/connect-wallet-button'
import { appStyles } from '@/constants/app-styles'
import { buildSwap, BuildSwapError } from '@/lib/api/client'

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
  if (reason.startsWith('program_not_allowed:')) {
    return `Program non in allowlist: ${reason.split(':')[1]}`
  }
  if (reason.startsWith('unknown_transfer_destination:')) {
    return `Trasferimento verso un indirizzo sconosciuto: ${reason.split(':')[1]}`
  }
  return `Validazione fallita: ${reason}`
}

export default function ApproveEntryScreen() {
  const {
    id,
    amountSol: amountSolParam,
    slippageBps: slippageBpsParam,
  } = useLocalSearchParams<{
    id: string
    amountSol: string
    slippageBps: string
  }>()
  const amountSol = Number(amountSolParam)
  const slippageBps = Number(slippageBpsParam)

  const { account, connection, signAndSendTransactions } = useMobileWallet()
  const pubkey = account?.address.toBase58()

  const buildQuery = useQuery({
    queryKey: ['build-swap', id, pubkey, amountSol, slippageBps],
    queryFn: () => buildSwap({ signalId: id, pubkey: pubkey!, amountSol, slippageBps }),
    enabled: !!pubkey && Number.isFinite(amountSol) && Number.isFinite(slippageBps),
    retry: false,
  })

  if (!pubkey) {
    return (
      <SafeAreaView style={appStyles.screen}>
        <View style={[appStyles.stack, { flex: 1, justifyContent: 'center' }]}>
          <Text style={appStyles.subtitle}>Connetti il wallet per continuare.</Text>
          <ConnectWalletButton />
        </View>
      </SafeAreaView>
    )
  }

  if (buildQuery.isLoading) {
    return (
      <SafeAreaView style={appStyles.screen}>
        <Text style={appStyles.textMuted}>Costruzione della transazione…</Text>
      </SafeAreaView>
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
    return (
      <SafeAreaView style={appStyles.screen}>
        <Text style={appStyles.textDanger}>Impossibile costruire lo swap: {message}</Text>
      </SafeAreaView>
    )
  }

  const build = buildQuery.data

  return (
    <SafeAreaView style={appStyles.screen}>
      <View style={appStyles.stack}>
        <Text style={appStyles.title}>Conferma entry</Text>

        <View style={appStyles.card}>
          <Text style={appStyles.bigStat}>{build.amountSol} SOL</Text>
          <Text style={appStyles.textMuted}>Importo che verrà speso</Text>
        </View>

        <View style={appStyles.card}>
          <Text style={appStyles.body}>
            Fee piattaforma: {build.feeBps / 100}% · {build.feeSol.toFixed(6)} SOL
          </Text>
          <Text style={appStyles.body}>Slippage: {build.quote.slippageBps / 100}%</Text>
          <Text style={appStyles.textMuted}>
            Ricevi circa {build.quote.outAmountUi !== null ? build.quote.outAmountUi : build.quote.outAmount}
          </Text>
          <Text style={appStyles.textMuted}>Impatto sul prezzo: {build.quote.priceImpactPct}</Text>
        </View>

        {build.tradingMode === 'paper' ? (
          <View style={appStyles.card}>
            <Text style={appStyles.textMuted}>
              Modalità paper: la transazione viene validata ma non firmata né inviata on-chain.
            </Text>
          </View>
        ) : null}

        <AppActionButton
          title="Conferma"
          onPress={async () => {
            const transaction = VersionedTransaction.deserialize(Buffer.from(build.transactionBase64, 'base64'))

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
                title: 'Validazione fallita',
                description: describeValidationFailure(validation.reason),
              } as const
            }

            if (build.tradingMode === 'paper') {
              return {
                status: 'success',
                title: 'Paper mode',
                description: 'Validato. Nessuna transazione reale inviata (TRADING_MODE=paper).',
              } as const
            }

            const { context } = await connection.getLatestBlockhashAndContext()
            const signature = await signAndSendTransactions(transaction, context.slot)
            await connection.confirmTransaction(
              { signature, blockhash: build.blockhash, lastValidBlockHeight: build.lastValidBlockHeight },
              'confirmed',
            )

            return { status: 'success', title: 'Tx confermata', description: signature } as const
          }}
        />
      </View>
    </SafeAreaView>
  )
}
