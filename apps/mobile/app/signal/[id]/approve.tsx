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
  fee_payer_mismatch: 'The transaction fee payer is not your wallet.',
  unresolvable_program: 'Could not resolve a program in the transaction.',
  amount_exceeds_cap: 'The amount exceeds what you approved for this entry.',
  fee_account_mismatch: 'The transaction does not include the expected fee account.',
  fee_bps_exceeds_cap: 'The actual fee exceeds the limit for your plan.',
  fee_simulation_failed: 'Could not verify the actual fee (simulation failed).',
}

function describeValidationFailure(reason: string): string {
  if (VALIDATION_REASON_LABELS[reason]) return VALIDATION_REASON_LABELS[reason]
  if (reason.startsWith('program_not_allowed:')) return `Program not allowlisted: ${reason.split(':')[1]}`
  if (reason.startsWith('unknown_transfer_destination:')) {
    return `Transfer to an unknown address: ${reason.split(':')[1]}`
  }
  return `Validation failed: ${reason}`
}

function Blocked({ title, message }: { title: string; message: string }) {
  return (
    <Screen tabBar={false}>
      <BackBar title="Confirm entry" />
      <Glass glow={palette.negative} style={{ marginTop: 12 }}>
        <Text variant="heading" color={palette.negative}>
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
      if (status.killSwitch) throw new Error('Trading paused by the service (kill switch on).')
      const { portfolio } = await getPositions()
      if (amountSol > portfolio.remainingSol) {
        throw new Error(
          `This would exceed the ${portfolio.maxExposureFraction * 100}% exposure limit: ${portfolio.remainingSol.toFixed(4)} SOL available.`,
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
        title="Kill switch on"
        message="New entries are blocked on this device. You can turn it off in Settings."
      />
    )
  }

  if (!pubkey) {
    return (
      <Screen tabBar={false}>
        <BackBar title="Confirm entry" />
        <Text variant="secondary">Connect your wallet to continue.</Text>
        <ConnectWalletButton />
      </Screen>
    )
  }

  if (buildQuery.isLoading) {
    return (
      <Screen tabBar={false}>
        <BackBar title="Confirm entry" />
        <Glass style={{ marginTop: 12, alignItems: 'center', paddingVertical: 40 }}>
          <Text variant="heading">Building the transaction…</Text>
          <Text variant="secondary">Fresh quote and blockhash, right now.</Text>
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
          : 'Unknown error'
    return <Blocked title="Swap unavailable" message={message} />
  }

  const build = buildQuery.data
  const receive =
    build.quote.outAmountUi !== null ? build.quote.outAmountUi.toLocaleString('en-US') : build.quote.outAmount

  return (
    <Screen scroll tabBar={false}>
      <BackBar title="Confirm entry" />

      <Animated.View entering={FadeInDown.duration(450)} style={{ gap: 6, marginTop: 8 }}>
        <Text variant="label">You spend</Text>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
          <Text variant="number" style={{ fontSize: 56, lineHeight: 60 }}>
            {build.amountSol}
          </Text>
          <Text variant="title" color={palette.textSecondary} style={{ marginBottom: 6 }}>
            SOL
          </Text>
        </View>
        <Text variant="secondary">You receive ~{receive} tokens</Text>
      </Animated.View>

      <Animated.View entering={FadeInDown.duration(450).delay(80)}>
        <Glass style={{ gap: 14 }}>
          <Row label="Platform fee" value={`${build.feeBps / 100}% · ${build.feeSol.toFixed(6)} SOL`} />
          <Divider />
          <Row label="Max slippage" value={`${build.quote.slippageBps / 100}%`} />
          <Divider />
          <Row label="Price impact" value={`${build.quote.priceImpactPct}%`} />
        </Glass>
      </Animated.View>

      {build.tradingMode === 'paper' ? (
        <Animated.View entering={FadeInDown.duration(450).delay(140)}>
          <Glass glow={palette.warning}>
            <Text variant="label" color={palette.warning}>
              Paper mode
            </Text>
            <Text variant="secondary">
              The transaction is built and verified but never signed or sent: no real funds move.
            </Text>
          </Glass>
        </Animated.View>
      ) : null}

      <Animated.View entering={FadeInDown.duration(450).delay(200)} style={{ gap: 10 }}>
        <AppActionButton
          title={build.tradingMode === 'paper' ? 'Verify (paper)' : 'Sign & send'}
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
                title: 'Validation failed: do not sign',
                description: describeValidationFailure(validation.reason),
              } as const
            }

            if (build.tradingMode === 'paper') {
              return {
                status: 'success',
                title: 'Transaction verified',
                description: 'All checks passed. No real transaction sent (paper mode).',
              } as const
            }

            const { context } = await connection.getLatestBlockhashAndContext()
            const signature = await signAndSendTransactions(transaction, context.slot)
            await connection.confirmTransaction(
              { signature, blockhash: build.blockhash, lastValidBlockHeight: build.lastValidBlockHeight },
              'confirmed',
            )

            return { status: 'success', title: 'Entry confirmed on-chain', description: signature } as const
          }}
        />
        <Text variant="caption" style={{ textAlign: 'center' }}>
          Before you sign, the app checks fee payer, programs, amount and recipients.
        </Text>
      </Animated.View>
    </Screen>
  )
}
