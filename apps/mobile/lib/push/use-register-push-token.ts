import { useEffect, useRef } from 'react'
import { useMobileWallet } from '@wallet-ui/react-native-web3js'
import {
  AuthorizationStatus,
  getMessaging,
  getToken,
  onTokenRefresh,
  requestPermission,
} from '@react-native-firebase/messaging'
import { registerDevice } from '@/lib/api/client'
import { saveDeviceApiKey } from './device-api-key-store'

// `requestPermission` è segnato deprecated nella doc corrente di React Native
// Firebase (che suggerisce expo-notifications/react-native-permissions per il
// solo permesso), ma resta funzionante ed è l'unica via che copre sia
// Android 13+ (POST_NOTIFICATIONS) sia iOS senza aggiungere un'altra libreria
// solo per questo.
async function requestNotificationPermission(): Promise<boolean> {
  const authStatus = await requestPermission(getMessaging())
  return authStatus === AuthorizationStatus.AUTHORIZED || authStatus === AuthorizationStatus.PROVISIONAL
}

async function registerToken(fcmToken: string, walletPubkey: string): Promise<void> {
  const response = await registerDevice({ fcmToken, walletPubkey })
  await saveDeviceApiKey(response.apiKey)
}

/**
 * Registra il token FCM su POST /devices non appena il wallet è connesso
 * (CLAUDE.md F3: "registrazione token all'avvio"), e ri-registra se il
 * sistema ruota il token FCM.
 */
export function useRegisterPushToken(): void {
  const { account } = useMobileWallet()
  const walletPubkey = account?.address.toBase58()
  const registeredForRef = useRef<string | undefined>(undefined)

  useEffect(() => {
    const pubkey = walletPubkey
    if (!pubkey) {
      return
    }

    let cancelled = false

    async function initialRegister(walletPubkey: string): Promise<void> {
      if (registeredForRef.current === walletPubkey) {
        return
      }
      const granted = await requestNotificationPermission()
      if (!granted || cancelled) {
        return
      }
      const fcmToken = await getToken(getMessaging())
      if (cancelled) {
        return
      }
      await registerToken(fcmToken, walletPubkey)
      registeredForRef.current = walletPubkey
    }

    initialRegister(pubkey).catch((error: unknown) => {
      console.warn('Registrazione push fallita:', error)
    })

    const unsubscribe = onTokenRefresh(getMessaging(), (refreshedToken) => {
      registerToken(refreshedToken, pubkey).catch((error: unknown) => {
        console.warn('Rinnovo registrazione push fallito:', error)
      })
    })

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [walletPubkey])
}
