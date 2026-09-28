import { View } from 'react-native'
import { Text } from '@/components/ui/text'
import { palette, radius } from '@/constants/theme'

export type AppStatusProps = {
  description: string
  status: 'danger' | 'success'
  title: string
}

/** Esito di un'azione: banner colorato sotto il pulsante. */
export function AppStatus({ description, status, title }: AppStatusProps) {
  const color = status === 'danger' ? palette.red : palette.mint
  return (
    <View
      style={{
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: color + '44',
        backgroundColor: status === 'danger' ? palette.redSoft : palette.mintSoft,
        padding: 14,
        gap: 4,
      }}
    >
      <Text variant="heading" color={color} style={{ fontSize: 15.5 }}>
        {title}
      </Text>
      <Text variant="secondary" selectable>
        {description}
      </Text>
    </View>
  )
}
