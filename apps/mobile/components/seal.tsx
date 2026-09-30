import * as Haptics from 'expo-haptics'
import { useEffect } from 'react'
import Animated, { Easing, useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated'
import { Circle } from 'react-native-svg'
import { FingerprintRings } from '@/components/fingerprint-rings'
import { motion, palette } from '@/constants/theme'

/** Istante (ms) in cui il sigillo "tocca" la carta: lì parte la vibrazione secca. */
const IMPACT_MS = 220

/**
 * Sigillo arancione impresso come ceralacca. Va montato SOLO dopo che il wallet ha
 * firmato e inviato (signAndSendTransactions riuscita): è identico ogni volta e non
 * dipende mai da importo o profitto.
 */
export function Seal({ size = 220 }: { size?: number }) {
  const scale = useSharedValue(1.35)
  const opacity = useSharedValue(0)

  useEffect(() => {
    opacity.set(withTiming(1, { duration: IMPACT_MS, easing: Easing.out(Easing.quad) }))
    scale.set(
      withSequence(
        withTiming(0.94, { duration: IMPACT_MS, easing: Easing.in(Easing.cubic) }),
        withTiming(1, { duration: motion.slow - IMPACT_MS, easing: Easing.out(Easing.back(2)) }),
      ),
    )
    const impact = setTimeout(() => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)
    }, IMPACT_MS)
    return () => clearTimeout(impact)
  }, [opacity, scale])

  const style = useAnimatedStyle(() => ({ opacity: opacity.get(), transform: [{ scale: scale.get() }] }))

  return (
    <Animated.View style={style}>
      <FingerprintRings
        size={size}
        color={palette.onAccent}
        accessibilityLabel="Seal: transaction signed"
        underlay={
          <>
            <Circle cx={100} cy={100} r={96} fill={palette.accent} />
            <Circle cx={100} cy={100} r={85} fill="none" stroke={palette.onAccent} strokeOpacity={0.25} strokeWidth={2} />
          </>
        }
      />
    </Animated.View>
  )
}
