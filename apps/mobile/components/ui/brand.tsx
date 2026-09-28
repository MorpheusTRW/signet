import { Image, View } from 'react-native'
import { Text } from './text'

const mark = require('@/assets/images/logo-mark.png')
const glow = require('@/assets/images/glow.png')

/** Logo (disco arancione) con alone opzionale. */
export function LogoMark({ size = 24, glowing = false }: { size?: number; glowing?: boolean }) {
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {glowing ? (
        <Image
          source={glow}
          style={{ position: 'absolute', width: size * 2.6, height: size * 2.6 }}
          resizeMode="contain"
        />
      ) : null}
      <Image source={mark} style={{ width: size, height: size }} resizeMode="contain" />
    </View>
  )
}

/** Logo + nome, per le intestazioni. */
export function Wordmark() {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <LogoMark size={18} />
      <Text variant="label">Signet</Text>
    </View>
  )
}
