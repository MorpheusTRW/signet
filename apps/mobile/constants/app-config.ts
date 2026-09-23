import { clusterApiUrl } from '@solana/web3.js'
import type { SolanaCluster } from '@wallet-ui/react-native-web3js'

// Tutte le soglie/URL di config, non nel codice (coerente con CLAUDE.md).
export class AppConfig {
  static name = 'Seeker Signal'
  static uri = 'https://seekersignal.app'

  // Devnet per sviluppo/test del bottone di debug (F2). Il passaggio a
  // mainnet-beta per il live trading è previsto in F5, dietro flag esplicito.
  static cluster: SolanaCluster = {
    id: 'solana:devnet',
    label: 'Devnet',
    url: clusterApiUrl('devnet'),
  }

  static engineApiUrl = process.env.EXPO_PUBLIC_ENGINE_API_URL ?? 'http://localhost:3000'
}
