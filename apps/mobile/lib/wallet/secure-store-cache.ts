import { PublicKey } from '@solana/web3.js'
import * as SecureStore from 'expo-secure-store'
import type { Cache } from '@wallet-ui/react-native-web3js'

const DEFAULT_STORAGE_KEY = 'authorization-cache'

/**
 * Ricostruisce i campi `publicKey` in istanze `PublicKey` dopo JSON.parse.
 * Replica esattamente il `cacheReviver` interno di
 * `@wallet-ui/react-native-web3js` (non esportato pubblicamente), così la
 * cache resta compatibile col resto della libreria: senza questo, il
 * `WalletAuthorization` letto da secure-store avrebbe `publicKey` come
 * stringa invece che come `PublicKey`.
 */
function cacheReviver(key: string, value: unknown): unknown {
  if (key === 'publicKey' && typeof value === 'string') {
    return new PublicKey(value)
  }
  return value
}

/**
 * Cache dell'autorizzazione MWA (auth_token incluso) su expo-secure-store
 * invece del default AsyncStorage di `@wallet-ui/react-native-web3js`
 * (CLAUDE.md: "auth_token salvato in modo sicuro").
 */
export function createSecureStoreCache<T>(storageKey: string = DEFAULT_STORAGE_KEY): Cache<T> {
  return {
    async clear() {
      await SecureStore.deleteItemAsync(storageKey)
    },
    async get() {
      const raw = await SecureStore.getItemAsync(storageKey)
      if (!raw) {
        return undefined
      }
      try {
        return JSON.parse(raw, cacheReviver) as T
      } catch (error) {
        console.warn(`Failed to parse secure-store cache for key ${storageKey}:`, error)
        return undefined
      }
    },
    async set(value: T) {
      await SecureStore.setItemAsync(storageKey, JSON.stringify(value))
    },
  }
}
