import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { PropsWithChildren, useMemo } from 'react'
import { MobileWalletProvider, type WalletAuthorization } from '@wallet-ui/react-native-web3js'
import { AppConfig } from '@/constants/app-config'
import { SettingsProvider } from '@/lib/settings/settings'
import { createSecureStoreCache } from '@/lib/wallet/secure-store-cache'

const identity = { name: AppConfig.name, uri: AppConfig.uri }
const queryClient = new QueryClient()

export function AppProviders({ children }: PropsWithChildren) {
  // Creata una sola volta: SecureStore fa I/O nativo, non va ricreata ad ogni render.
  const authorizationCache = useMemo(() => createSecureStoreCache<WalletAuthorization | undefined>(), [])

  return (
    <QueryClientProvider client={queryClient}>
      <MobileWalletProvider
        chain={AppConfig.cluster.id}
        endpoint={AppConfig.cluster.url}
        identity={identity}
        cache={authorizationCache}
      >
        <SettingsProvider>{children}</SettingsProvider>
      </MobileWalletProvider>
    </QueryClientProvider>
  )
}
