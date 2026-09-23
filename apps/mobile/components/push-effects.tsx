import { useNotificationDeepLink } from '@/lib/push/use-notification-deep-link'
import { useRegisterPushToken } from '@/lib/push/use-register-push-token'

/** Effetti globali per la push (registrazione token, tap -> deep link). Nessun render. */
export function PushEffects() {
  useRegisterPushToken()
  useNotificationDeepLink()
  return null
}
