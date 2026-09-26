import { PublicKey } from '@solana/web3.js'
import * as SecureStore from 'expo-secure-store'
import type { Cache } from '@wallet-ui/react-native-web3js'

const DEFAULT_STORAGE_KEY = 'authorization-cache'

/**
 * Ricostruisce in istanze `PublicKey` i campi che la libreria salva come
 * PublicKey (serializzati da JSON.stringify come stringa base58).
 *
 * Il `cacheReviver` interno di `@wallet-ui/react-native-web3js` ricostruisce
 * solo `publicKey`, ma l'account salvato ha anche `address`, sempre una
 * PublicKey (`getAccountFromAuthorizedAccount`). Senza questo, alla riapertura
 * dell'app `account.address` è una stringa e `account.address.toBase58()`
 * manda in crash l'avvio (bug riprodotto sul Seeker il 2026-09-26).
 * `addressBase64` resta stringa: è un campo diverso.
 */
function cacheReviver(key: string, value: unknown): unknown {
  if ((key === 'publicKey' || key === 'address') && typeof value === 'string') {
    try {
      return new PublicKey(value)
    } catch {
      return value
    }
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
