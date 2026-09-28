import * as Haptics from 'expo-haptics'
import { useState } from 'react'
import { View } from 'react-native'
import { AppStatus, type AppStatusProps } from '@/components/app-status'
import { Button } from '@/components/ui/button'
import { formatError } from '@/utils/format-error'

/**
 * Pulsante che esegue un'azione async, evita rejection non gestite, si disabilita
 * mentre è in corso e mostra l'esito sotto di sé.
 */
export function AppActionButton({
  disabled,
  onPress,
  title,
  variant = 'primary',
}: {
  disabled?: boolean
  onPress: () => Promise<AppStatusProps | void>
  title: string
  variant?: 'primary' | 'ghost' | 'danger'
}) {
  const [isLoading, setIsLoading] = useState(false)
  const [status, setStatus] = useState<AppStatusProps | null>(null)

  async function submit() {
    if (isLoading) return
    setIsLoading(true)
    setStatus(null)
    try {
      const result = (await onPress()) ?? null
      setStatus(result)
      if (result) {
        void Haptics.notificationAsync(
          result.status === 'success'
            ? Haptics.NotificationFeedbackType.Success
            : Haptics.NotificationFeedbackType.Error,
        )
      }
    } catch (error) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      setStatus({ description: formatError(error), status: 'danger', title: `${title}: failed` })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <View style={{ gap: 12 }}>
      <Button title={title} variant={variant} loading={isLoading} disabled={disabled} onPress={() => void submit()} />
      {status ? <AppStatus {...status} /> : null}
    </View>
  )
}
