import { useMobileWallet } from '@wallet-ui/react-native-web3js'
import { AppActionButton } from '@/components/app-action-button'

export function ConnectWalletButton() {
  const { connect } = useMobileWallet()
  return (
    <AppActionButton
      title="Connect wallet"
      onPress={async () => {
        await connect()
      }}
    />
  )
}
