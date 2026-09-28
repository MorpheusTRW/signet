import { StyleSheet, View } from 'react-native'
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated'
import { ConnectWalletButton } from '@/components/connect-wallet-button'
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
        <Animated.View entering={FadeIn.duration(700)} style={styles.mark}>
          {[0, 1, 2].map((ring) => (
            <View
              key={ring}
              style={[
                styles.ring,
                {
                  width: 64 + ring * 44,
                  height: 64 + ring * 44,
                  borderRadius: (64 + ring * 44) / 2,
                  opacity: 0.9 - ring * 0.3,
                },
              ]}
            />
          ))}
          <View style={styles.core} />
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(600).delay(150)} style={{ gap: 14 }}>
          <Text variant="label" color={palette.mint}>
            Seeker Signal
          </Text>
          <Text variant="display" style={{ fontSize: 40, lineHeight: 44 }}>
            Segnali on-chain.{'\n'}Firmi tu, in un tocco.
          </Text>
          <Text variant="secondary" style={{ fontSize: 16, lineHeight: 23 }}>
            {subtitle ?? 'Ogni nuovo token passa filtri anti-rug in tempo reale. Le tue chiavi restano nel Seed Vault.'}
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
  mark: { width: 152, height: 152, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  ring: { position: 'absolute', borderWidth: 1.5, borderColor: palette.mint + '66' },
  core: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: palette.mint,
    shadowColor: palette.mint,
    shadowOpacity: 1,
    shadowRadius: 18,
    elevation: 10,
  },
})
