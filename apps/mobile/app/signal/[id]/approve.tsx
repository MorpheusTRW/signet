import { router, useLocalSearchParams } from 'expo-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import * as Haptics from 'expo-haptics'
import { useEffect, useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import Animated, { Easing, FadeIn, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { LAMPORTS_PER_SOL, VersionedTransaction } from '@solana/web3.js'
import { JUPITER_SWAP_ALLOWED_PROGRAMS, validateSwapTx } from '@seeker-signal/shared'
import { useMobileWallet } from '@wallet-ui/react-native-web3js'
import { ConnectWalletButton } from '@/components/connect-wallet-button'
import { FingerprintGlyph, FingerprintRings } from '@/components/fingerprint-rings'
import { Seal } from '@/components/seal'
import { BackBar } from '@/components/ui/bits'
import { Button } from '@/components/ui/button'
import { Glass } from '@/components/ui/glass'
import { Screen } from '@/components/ui/screen'
import { Text } from '@/components/ui/text'
import { motion, palette } from '@/constants/theme'
import {
  buildSwap,
  BuildSwapError,
  getPositions,
  getSignal,
  getStatus,
  openPaperPosition,
} from '@/lib/api/client'
import type { BuildSwapResponse } from '@/lib/api/types'
import { tokenTicker } from '@/lib/format'
import { useSettings } from '@/lib/settings/settings'
import { formatError } from '@/utils/format-error'

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

/** Jupiter restituisce l'impatto in punti percentuali come stringa a piena precisione. */
function formatImpact(raw: string): string {
  const value = Math.abs(Number(raw))
  if (!Number.isFinite(value)) return `${raw}%`
  return value < 0.01 ? '<0.01%' : `${value.toFixed(2)}%`
}

type Check = { ok: true; feeUnverified: boolean } | { ok: false; message: string }
type Phase =
  | { name: 'ready' }
  | { name: 'signing' }
  | { name: 'sealed'; signature: string; confirmedIn: number | null; confirmError: string | null }
  | { name: 'paper-recorded'; feeUnverified: boolean }

function deserialize(build: BuildSwapResponse) {
  return VersionedTransaction.deserialize(new Uint8Array(Buffer.from(build.transactionBase64, 'base64')))
}

function Blocked({ title, message }: { title: string; message: string }) {
  return (
    <Screen tabBar={false}>
      <BackBar title="Approve entry" />
      <Glass glow={palette.negative} style={{ marginTop: 12 }}>
        <Text variant="heading" color={palette.negative}>
          {title}
        </Text>
        <Text variant="secondary">{message}</Text>
      </Glass>
    </Screen>
  )
}

function DetailRow({ label, value, color, last }: { label: string; value: string; color?: string; last?: boolean }) {
  return (
    <View style={[styles.row, !last && styles.rowDivider]}>
      <Text variant="secondary">{label}</Text>
      <Text variant="body" color={color} numberOfLines={1} style={{ flexShrink: 1, textAlign: 'right' }}>
        {value}
      </Text>
    </View>
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
  const queryClient = useQueryClient()
  const insets = useSafeAreaInsets()
  const [phase, setPhase] = useState<Phase>({ name: 'ready' })
  const [actionError, setActionError] = useState<string | null>(null)

  const signalQuery = useQuery({ queryKey: ['signal', id], queryFn: () => getSignal(id), enabled: !!id })

  const buildQuery = useQuery({
    queryKey: ['build-swap', id, pubkey, amountSol, slippageBps],
    queryFn: async () => {
      // Ricontrollo lato app (CLAUDE.md, principio 3): il server applica già gli
      // stessi limiti, ma l'app non si fida ciecamente e blocca prima di costruire.
      const status = await getStatus()
      if (status.killSwitch) throw new Error('Trading paused by the service (kill switch on).')
      const { portfolio } = await getPositions(pubkey!)
      // Paper: portafoglio virtuale del wallet. Live: 20% del saldo SOL reale, letto qui dalla chain.
      const remaining =
        status.tradingMode === 'paper'
          ? portfolio.remainingSol
          : ((await connection.getBalance(account!.address)) / LAMPORTS_PER_SOL) * portfolio.maxExposureFraction
      if (amountSol > remaining) {
        throw new Error(
          `This would exceed the ${portfolio.maxExposureFraction * 100}% exposure limit: ${remaining.toFixed(4)} SOL available.`,
        )
      }
      return buildSwap({ signalId: id, pubkey: pubkey!, amountSol, slippageBps })
    },
    enabled: !settings.killSwitch && !!pubkey && Number.isFinite(amountSol) && Number.isFinite(slippageBps),
    retry: false,
    // Una tx costruita non va mai sostituita di nascosto mentre l'utente la sta guardando.
    staleTime: Infinity,
    gcTime: 0,
  })
  const build = buildQuery.data

  // Controllo sul dispositivo PRIMA di mostrare il pulsante di firma (CLAUDE.md, principio 2).
  const checkQuery = useQuery({
    queryKey: ['validate-swap', build?.transactionBase64],
    queryFn: async (): Promise<Check> => {
      const validation = await validateSwapTx(deserialize(build!), {
        userPubkey: pubkey!,
        maxSol: amountSol,
        allowedPrograms: JUPITER_SWAP_ALLOWED_PROGRAMS as string[],
        expectedFeeAccount: build!.feeAccount,
        maxFeeBps: build!.feeBps,
        connection,
      })
      if (validation.valid) return { ok: true, feeUnverified: false }
      // La simulazione della fee è il penultimo controllo: se fallisce lì, fee payer,
      // program, destinatari, importo e account fee sono già stati verificati. Fallisce
      // di sicuro con un wallet senza SOL (AccountNotFound). In paper non si firma nulla,
      // quindi quel solo caso è tollerato e dichiarato; in live resta un blocco.
      if (build!.tradingMode === 'paper' && validation.reason === 'fee_simulation_failed') {
        return { ok: true, feeUnverified: true }
      }
      return { ok: false, message: describeValidationFailure(validation.reason) }
    },
    enabled: !!build && !!pubkey,
    retry: false,
    staleTime: Infinity,
    gcTime: 0,
  })
  const check = checkQuery.data

  // Anelli dell'impronta: si accendono dal centro man mano che la transazione è pronta e verificata.
  const lit = useSharedValue(0)
  useEffect(() => {
    if (phase.name === 'signing') {
      // In attesa del Seed Vault: gli anelli esterni si riempiono uno alla volta.
      lit.set(withRepeat(withTiming(6, { duration: motion.slow * 3, easing: Easing.linear }), -1, false))
    } else if (buildQuery.isLoading || checkQuery.isLoading) {
      lit.set(withRepeat(withTiming(2, { duration: motion.slow * 2 }), -1, true))
    } else if (check?.ok) {
      lit.set(withTiming(3, { duration: motion.base }))
    } else {
      lit.set(withTiming(0, { duration: motion.base }))
    }
  }, [lit, phase.name, buildQuery.isLoading, checkQuery.isLoading, check?.ok])

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
        <BackBar title="Approve entry" />
        <Text variant="secondary">Connect your wallet to continue.</Text>
        <ConnectWalletButton />
      </Screen>
    )
  }

  if (buildQuery.isError) {
    const error = buildQuery.error
    const message = error instanceof BuildSwapError ? (error.body.message ?? error.body.error) : formatError(error)
    return <Blocked title="Swap unavailable" message={message} />
  }

  const ticker = signalQuery.data ? tokenTicker(signalQuery.data.tokenSymbol, signalQuery.data.tokenName) : '…'
  const paper = build?.tradingMode === 'paper'
  const checkLabel = checkQuery.isLoading || !build
    ? 'Checking…'
    : checkQuery.isError
      ? 'Error'
      : check?.ok
        ? check.feeUnverified
          ? 'Passed · fee sim skipped'
          : 'Passed'
        : 'Failed'

  async function recordPaper() {
    setActionError(null)
    try {
      await openPaperPosition({ signalId: id, pubkey: pubkey!, amountSol })
      void queryClient.invalidateQueries({ queryKey: ['positions'] })
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      setPhase({ name: 'paper-recorded', feeUnverified: check?.ok === true && check.feeUnverified })
    } catch (error) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      setActionError(formatError(error))
    }
  }

  async function signLive() {
    if (!build || !check?.ok) return
    setActionError(null)
    setPhase({ name: 'signing' })
    let signature: string
    try {
      const { context } = await connection.getLatestBlockhashAndContext()
      // La richiesta dell'impronta la mostra il wallet (Seed Vault), non l'app.
      signature = await signAndSendTransactions(deserialize(build), context.slot)
    } catch (error) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      setActionError(formatError(error))
      setPhase({ name: 'ready' })
      return
    }

    // Solo ora, con la firma inviata, il sigillo si imprime.
    setPhase({ name: 'sealed', signature, confirmedIn: null, confirmError: null })
    const sentAt = Date.now()
    try {
      const result = await connection.confirmTransaction(
        { signature, blockhash: build.blockhash, lastValidBlockHeight: build.lastValidBlockHeight },
        'confirmed',
      )
      if (result.value.err) throw new Error(`Transaction failed on-chain: ${JSON.stringify(result.value.err)}`)
      setPhase({ name: 'sealed', signature, confirmedIn: (Date.now() - sentAt) / 1000, confirmError: null })
      void queryClient.invalidateQueries({ queryKey: ['positions'] })
    } catch (error) {
      setPhase({ name: 'sealed', signature, confirmedIn: null, confirmError: formatError(error) })
    }
  }

  const done = phase.name === 'sealed' || phase.name === 'paper-recorded'

  return (
    <Screen tabBar={false}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, gap: 20, paddingBottom: insets.bottom + 28 }}
        showsVerticalScrollIndicator={false}
      >
        {!done ? <BackBar /> : null}

        <View style={{ gap: 6 }}>
          <Text variant="label">{`Approve entry · ${ticker}`}</Text>
          <Text variant="number">{`${amountSol} SOL`}</Text>
        </View>

        <View style={styles.details}>
          <DetailRow
            label="Platform fee"
            value={build ? `${build.feeBps / 100}% · ${build.feeSol.toFixed(4)} SOL` : '…'}
          />
          <DetailRow label="Max slippage" value={`${slippageBps / 100}%`} />
          <DetailRow label="Price impact" value={build ? formatImpact(build.quote.priceImpactPct) : '…'} />
          <DetailRow
            label="On-device check"
            value={checkLabel}
            color={check && !check.ok ? palette.negative : undefined}
            last
          />
        </View>

        {check && !check.ok ? (
          <Glass glow={palette.negative}>
            <Text variant="heading" color={palette.negative}>
              Do not sign
            </Text>
            <Text variant="secondary">{check.message}</Text>
          </Glass>
        ) : null}

        <View style={styles.stage}>
          {phase.name === 'sealed' ? (
            <>
              <Seal />
              <Animated.View entering={FadeIn.duration(motion.base).delay(motion.fast)} style={{ alignItems: 'center', gap: 6 }}>
                <Text variant="title">Sealed.</Text>
                <Text variant="mono" style={{ textAlign: 'center' }}>
                  {phase.confirmedIn !== null
                    ? `Confirmed on-chain · ${phase.confirmedIn.toFixed(1)}s`
                    : phase.confirmError
                      ? 'Sent · confirmation not seen yet'
                      : 'Sent · confirming on-chain…'}
                </Text>
                {phase.confirmError ? (
                  <Text variant="caption" style={{ textAlign: 'center' }} selectable>
                    {`${phase.confirmError}\n${phase.signature}`}
                  </Text>
                ) : null}
              </Animated.View>
            </>
          ) : phase.name === 'paper-recorded' ? (
            <Animated.View entering={FadeIn.duration(motion.base)} style={{ alignItems: 'center', gap: 18 }}>
              {/* Nessuna firma in paper mode: niente sigillo, solo l'impronta a riposo. */}
              <FingerprintRings size={180} color={palette.hairlineStrong} accessibilityLabel="Paper entry, not signed" />
              <View style={{ alignItems: 'center', gap: 6 }}>
                <Text variant="heading">Paper entry recorded</Text>
                <Text variant="secondary" style={{ textAlign: 'center' }}>
                  {phase.feeUnverified
                    ? 'Nothing was signed or sent. Checks passed (fee simulation skipped: this wallet has no SOL). Follow it in Positions.'
                    : 'Nothing was signed or sent. Tracked at the real pool price in Positions.'}
                </Text>
              </View>
            </Animated.View>
          ) : (
            <>
              <FingerprintRings
                size={220}
                color={palette.accent}
                dimColor={palette.hairlineStrong}
                lit={lit}
                accessibilityLabel="Fingerprint, waiting for signature"
              />
              <Text variant="secondary" style={styles.prompt}>
                {phase.name === 'signing'
                  ? 'Waiting for Seed Vault…'
                  : paper
                    ? 'Paper mode: the transaction is built and checked, never signed or sent.'
                    : check?.ok
                      ? 'Touch the sensor to sign with Seed Vault'
                      : 'Building a fresh transaction and checking it on this device…'}
              </Text>
            </>
          )}
        </View>

        {actionError ? (
          <Text variant="secondary" color={palette.negative} style={{ textAlign: 'center' }} selectable>
            {actionError}
          </Text>
        ) : null}

        {done ? (
          <Button title="Back to feed" variant="ghost" onPress={() => router.dismissTo('/')} />
        ) : paper ? (
          <Button
            title="Record paper entry"
            disabled={!check?.ok}
            loading={checkQuery.isLoading}
            onPress={() => void recordPaper()}
          />
        ) : (
          <Button
            title="Sign with Seed Vault"
            icon={<FingerprintGlyph color={palette.onAccent} />}
            disabled={!check?.ok || phase.name === 'signing'}
            loading={phase.name === 'signing' || buildQuery.isLoading || checkQuery.isLoading}
            onPress={() => void signLive()}
          />
        )}
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  details: {
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.hairline,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, paddingVertical: 12 },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: palette.hairline },
  stage: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', gap: 18, minHeight: 300 },
  prompt: { fontSize: 17, textAlign: 'center', maxWidth: 300 },
})
