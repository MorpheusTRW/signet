import { useEffect } from 'react'
import { router } from 'expo-router'
import { Alert } from 'react-native'
import {
  getInitialNotification,
  getMessaging,
  onMessage,
  onNotificationOpenedApp,
  type RemoteMessage,
} from '@react-native-firebase/messaging'

function routeFromMessage(message: RemoteMessage | null): string | undefined {
  const route = message?.data?.route
  return typeof route === 'string' ? route : undefined
}

/**
 * Tap sulla notifica -> deep link a /signal/[id] (o /plans per il tipo
 * "limite raggiunto"), sia da cold start che da background (CLAUDE.md F3).
 * In foreground FCM non mostra da sé la notifica: qui la segnaliamo con un
 * Alert, così il segnale non passa inosservato.
 */
export function useNotificationDeepLink(): void {
  useEffect(() => {
    const messaging = getMessaging()

    getInitialNotification(messaging)
      .then((message) => {
        const route = routeFromMessage(message)
        if (route) router.push(route)
      })
      .catch((error: unknown) => {
        console.warn('Lettura notifica iniziale fallita:', error)
      })

    const unsubscribeOpened = onNotificationOpenedApp(messaging, (message) => {
      const route = routeFromMessage(message)
      if (route) router.push(route)
    })

    const unsubscribeForeground = onMessage(messaging, async (message) => {
      if (message.notification) {
        Alert.alert(message.notification.title ?? 'Seeker Signal', message.notification.body ?? '')
      }
    })

    return () => {
      unsubscribeOpened()
      unsubscribeForeground()
    }
  }, [])
}
