import * as Haptics from 'expo-haptics'
import { LinearGradient } from 'expo-linear-gradient'
import type { ReactNode } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated'
import { gradients, palette, radius } from '@/constants/theme'
import { Text } from './text'

const AnimatedPressable = Animated.createAnimatedComponent(Pressable)

type Variant = 'primary' | 'ghost' | 'danger'

/** Pulsante del design system: leggera compressione + vibrazione al tocco. */
export function Button({
  title,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  icon,
}: {
  title: string
  onPress: () => void
  variant?: Variant
  loading?: boolean
  disabled?: boolean
  icon?: ReactNode
}) {
  const scale = useSharedValue(1)
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }))
  const inactive = disabled || loading

  const label = (
    <View style={styles.content}>
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? palette.onAccent : palette.text} />
      ) : (
        <>
          {icon}
          <Text
            variant="heading"
            color={variant === 'primary' ? palette.onAccent : variant === 'danger' ? palette.negative : palette.text}
            style={styles.label}
          >
            {title}
          </Text>
        </>
      )}
    </View>
  )

  return (
    <AnimatedPressable
      accessibilityRole="button"
      disabled={inactive}
      onPressIn={() => {
        scale.set(withSpring(0.97, { damping: 18, stiffness: 320 }))
      }}
      onPressOut={() => {
        scale.set(withSpring(1, { damping: 18, stiffness: 320 }))
      }}
      onPress={() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
        onPress()
      }}
      style={[animated, { opacity: disabled ? 0.4 : 1 }]}
    >
      {variant === 'primary' ? (
        <LinearGradient colors={gradients.accent} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.base}>
          {label}
        </LinearGradient>
      ) : (
        <View style={[styles.base, variant === 'danger' ? styles.danger : styles.ghost]}>{label}</View>
      )}
    </AnimatedPressable>
  )
}

const styles = StyleSheet.create({
  base: { height: 56, borderRadius: radius.md + 2, alignItems: 'center', justifyContent: 'center' },
  content: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { fontSize: 16.5 },
  ghost: { backgroundColor: palette.surfaceStrong, borderWidth: 1, borderColor: palette.hairlineStrong },
  danger: { backgroundColor: palette.negativeSoft, borderWidth: 1, borderColor: palette.negative + '55' },
})
