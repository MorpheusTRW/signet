import { clusterApiUrl } from '@solana/web3.js'
import type { SolanaCluster } from '@wallet-ui/react-native-web3js'

// Tutte le soglie/URL di config, non nel codice (coerente con CLAUDE.md).
export class AppConfig {
  static name = 'Signet'
  static uri = 'https://seekersignal.app'

  // Mainnet-beta: Jupiter instrada solo su mainnet (nessuna liquidità reale
  // su devnet) e i token pump.fun/PumpSwap/Meteora esistono solo lì. Da F4 il
  // bottone di debug (F2) firma quindi su mainnet — una fee reale (trascurabile,
  // ~0.000005 SOL) invece che gratuita su devnet. L'RPC pubblico di
  // clusterApiUrl ha rate limit stretti: sovrascrivibile con
  // EXPO_PUBLIC_SOLANA_RPC_URL per un endpoint dedicato in produzione.
  static cluster: SolanaCluster = {
    id: 'solana:mainnet',
    label: 'Mainnet',
    url: process.env.EXPO_PUBLIC_SOLANA_RPC_URL ?? clusterApiUrl('mainnet-beta'),
  }

  static engineApiUrl = process.env.EXPO_PUBLIC_ENGINE_API_URL ?? 'http://localhost:3000'
}
