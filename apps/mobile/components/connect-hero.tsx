import { StyleSheet, View } from 'react-native'
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated'
import { ConnectWalletButton } from '@/components/connect-wallet-button'
import { LogoMark } from '@/components/ui/brand'
import { Backdrop } from '@/components/ui/screen'
import { Text } from '@/components/ui/text'
import { palette } from '@/constants/theme'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

/** Schermata di benvenuto quando il wallet non è connesso. */
export function ConnectHero({ subtitle }: { subtitle?: string }) {
  const insets = useSafeAreaInsets()
  return (
    <View style={{ flex: 1 }}>
      <Backdrop />
      <View style={[styles.body, { paddingTop: insets.top + 40, paddingBottom: 140 }]}>
        <Animated.View entering={FadeIn.duration(800)} style={styles.mark}>
          <LogoMark size={132} glowing />
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(600).delay(150)} style={{ gap: 14 }}>
          <Text variant="label" color={palette.accent}>
            Signet
          </Text>
          <Text variant="display" style={{ fontSize: 40, lineHeight: 44 }}>
            On-chain signals.{'\n'}You sign, in one tap.
          </Text>
          <Text variant="secondary" style={{ fontSize: 16, lineHeight: 23 }}>
            {subtitle ??
              'Every new token runs through real-time anti-rug filters. Your keys never leave the Seed Vault.'}
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(600).delay(300)}>
          <ConnectWalletButton />
        </Animated.View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  body: { flex: 1, paddingHorizontal: 24, justifyContent: 'flex-end', gap: 32 },
  mark: { width: 160, height: 160, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
})
