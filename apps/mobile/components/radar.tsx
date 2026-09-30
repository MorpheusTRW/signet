import { useFocusEffect } from 'expo-router'
import { useCallback, useEffect, useRef } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated'
import Svg, { Circle, Path } from 'react-native-svg'
import { FingerprintRings } from '@/components/fingerprint-rings'
import { motion, palette } from '@/constants/theme'

/** Ogni quanto parte un impulso del radar (l'impulso in sé dura `motion.slow`). */
const PULSE_EVERY_MS = 2400
const SWEEP_STEP_DEG = 45
/** Opacità degli anelli accesi dal centro verso l'esterno, come nel mockup. */
const LIT_OPACITY = [1, 1, 0.7, 0.45]

/**
 * Radar del feed: gli anelli dell'impronta pulsano dal centro verso l'esterno e la
 * lancetta avanza di un passo a ogni impulso. `scanned` è il contatore dei token
 * valutati: quando cresce compare un punto sul radar.
 */
export function Radar({ size = 200, scanned }: { size?: number; scanned: number | undefined }) {
  const wave = useSharedValue(-1)
  const sweep = useSharedValue(0)
  const blip = useSharedValue(0)

  useFocusEffect(
    useCallback(() => {
      const pulse = () => {
        wave.set(-1)
        wave.set(withTiming(6, { duration: motion.slow, easing: Easing.out(Easing.quad) }))
        sweep.set(withTiming(sweep.get() + SWEEP_STEP_DEG, { duration: motion.slow, easing: Easing.out(Easing.cubic) }))
      }
      pulse()
      const timer = setInterval(pulse, PULSE_EVERY_MS)
      return () => clearInterval(timer)
    }, [wave, sweep]),
  )

  // Nuovi token valutati dall'ultimo aggiornamento: il punto appare e si spegne.
  const lastScanned = useRef<number | undefined>(undefined)
  useEffect(() => {
    if (scanned === undefined) return
    if (lastScanned.current !== undefined && scanned > lastScanned.current) {
      blip.set(
        withSequence(
          withTiming(1, { duration: motion.fast }),
          withDelay(1600, withTiming(0, { duration: motion.slow })),
        ),
      )
    }
    lastScanned.current = scanned
  }, [scanned, blip])

  const sweepStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${sweep.get()}deg` }] }))
  const blipStyle = useAnimatedStyle(() => ({ opacity: blip.get() }))

  return (
    <View style={{ width: size, height: size }} accessibilityRole="image" accessibilityLabel="Live radar scanning new launches">
      <Svg viewBox="0 0 200 200" width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={100} cy={100} r={92} stroke={palette.radarTrack} strokeWidth={2} fill="none" />
      </Svg>
      <FingerprintRings
        size={size}
        strokeWidth={5}
        color={palette.accent}
        dimColor={palette.hairline}
        lit={4}
        ringOpacity={(position) => LIT_OPACITY[position] ?? 0}
        wave={wave}
        style={StyleSheet.absoluteFill}
      />
      <Animated.View style={[StyleSheet.absoluteFill, sweepStyle]} pointerEvents="none">
        <Svg viewBox="0 0 200 200" width={size} height={size}>
          <Path d="M100 100 L100 8" stroke={palette.accent} strokeWidth={2} strokeOpacity={0.6} strokeLinecap="round" />
        </Svg>
        <Animated.View style={[StyleSheet.absoluteFill, blipStyle]}>
          <Svg viewBox="0 0 200 200" width={size} height={size}>
            {/* Appena dietro la lancetta: il token appena "visto". */}
            <Circle cx={78} cy={36} r={5} fill={palette.accent} />
          </Svg>
        </Animated.View>
      </Animated.View>
    </View>
  )
}
