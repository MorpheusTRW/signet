import { TransactionMessage, VersionedTransaction } from '@solana/web3.js'
import { createMemoInstruction } from '@solana/spl-memo'
import { Text, View } from 'react-native'
import { Screen } from '@/components/ui/screen'
import { useMobileWallet } from '@wallet-ui/react-native-web3js'
import { AppActionButton } from '@/components/app-action-button'
import { ConnectWalletButton } from '@/components/connect-wallet-button'
import { AppConfig } from '@/constants/app-config'
import { appStyles } from '@/constants/app-styles'
import { ellipsify } from '@/utils/ellipsify'

export default function DebugScreen() {
  const { account, connection, signAndSendTransactions } = useMobileWallet()

  return (
    <Screen>
      <View style={appStyles.stack}>
        <Text style={appStyles.title}>Debug</Text>
        <Text style={appStyles.textMuted}>
          Signs a minimal transaction (memo, {AppConfig.cluster.label}) to test biometric signing via Mobile Wallet
          Adapter sul Seeker. Non muove fondi.
        </Text>

        {!account ? (
          <ConnectWalletButton />
        ) : (
          <View style={appStyles.stack}>
            <View style={appStyles.card}>
              <Text style={appStyles.textMuted}>Connesso: {ellipsify(account.address.toBase58(), 8)}</Text>
            </View>
            <AppActionButton
              title="Sign debug tx (memo)"
              onPress={async () => {
                const {
                  context: { slot: minContextSlot },
                  value: latestBlockhash,
                } = await connection.getLatestBlockhashAndContext()

                const message = new TransactionMessage({
                  payerKey: account.address,
                  recentBlockhash: latestBlockhash.blockhash,
                  instructions: [createMemoInstruction(`seeker-signal debug ${new Date().toISOString()}`)],
                }).compileToLegacyMessage()

                const signature = await signAndSendTransactions(new VersionedTransaction(message), minContextSlot)

                await connection.confirmTransaction({ signature, ...latestBlockhash }, 'confirmed')

                return { description: signature, status: 'success', title: 'Tx confirmed' } as const
              }}
            />
          </View>
        )}
      </View>
    </Screen>
  )
}
