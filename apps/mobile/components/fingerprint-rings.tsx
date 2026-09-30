import type { ReactNode } from 'react'
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { useAnimatedProps, type SharedValue } from 'react-native-reanimated'
import Svg, { Circle, G, Path } from 'react-native-svg'

/**
 * Gli anelli spezzati dell'impronta del logo (viewBox 200×200, centro 100,100).
 * Stesso motivo per il radar del feed, l'impronta della firma, il sigillo e il recap:
 * così tutta l'app sembra un unico oggetto.
 */
export const FINGERPRINT_RINGS = [
  { r: 12, dash: [52, 24], rotate: -100 },
  { r: 24, dash: [118, 33], rotate: -70 },
  { r: 36, dash: [160, 22, 36, 8], rotate: -120 },
  { r: 48, dash: [210, 26, 50, 16], rotate: -80 },
  { r: 60, dash: [250, 34, 60, 33], rotate: -110 },
  { r: 72, dash: [120, 40, 230, 62], rotate: -60 },
  { r: 96, dash: [180, 44, 290, 90], rotate: -40 },
] as const

/** I sei anelli dell'impronta (senza l'anello esterno del recap). */
export const PRINT_RINGS = [0, 1, 2, 3, 4, 5] as const

const AnimatedCircle = Animated.createAnimatedComponent(Circle)

function clamp01(value: number) {
  'worklet'
  return Math.min(1, Math.max(0, value))
}

function Ring({
  index,
  position,
  color,
  strokeWidth,
  baseOpacity,
  lit,
  wave,
}: {
  index: number
  position: number
  color: string
  strokeWidth: number
  baseOpacity: number
  lit: SharedValue<number> | number
  wave?: SharedValue<number>
}) {
  const ring = FINGERPRINT_RINGS[index]!
  const animatedProps = useAnimatedProps(() => {
    const litCount = typeof lit === 'number' ? lit : lit.get()
    // Riempimento dal centro: l'anello si accende quando il conteggio lo supera (frazioni = dissolvenza).
    const fill = clamp01(litCount - position) * baseOpacity
    // Onda del radar: chi è vicino alla sua posizione si illumina per un istante.
    const bump = wave ? clamp01(1 - Math.abs(wave.get() - position)) * 0.55 : 0
    return { strokeOpacity: Math.min(1, fill + bump) }
  })
  return (
    <AnimatedCircle
      cx={100}
      cy={100}
      r={ring.r}
      stroke={color}
      strokeWidth={strokeWidth}
      strokeDasharray={ring.dash}
      strokeLinecap="round"
      fill="none"
      transform={`rotate(${ring.rotate} 100 100)`}
      animatedProps={animatedProps}
    />
  )
}

export function FingerprintRings({
  size,
  rings = PRINT_RINGS,
  color,
  dimColor,
  strokeWidth = 7,
  lit = rings.length,
  ringOpacity,
  wave,
  underlay,
  overlay,
  style,
  accessibilityLabel,
}: {
  size: number
  /** Indici in FINGERPRINT_RINGS, dal più interno al più esterno. */
  rings?: readonly number[]
  /** Colore degli anelli accesi. */
  color: string
  /** Colore degli anelli spenti (omesso = spenti invisibili). */
  dimColor?: string
  strokeWidth?: number
  /** Quanti anelli sono accesi a partire dal centro; frazionario per animare il riempimento. */
  lit?: SharedValue<number> | number
  /** Opacità dell'anello acceso, per posizione (default 1). */
  ringOpacity?: (position: number) => number
  /** Posizione (in anelli) di un'onda che scorre dal centro verso l'esterno. */
  wave?: SharedValue<number>
  /** Elementi SVG disegnati sotto / sopra gli anelli (disco del sigillo, lancetta del radar…). */
  underlay?: ReactNode
  overlay?: ReactNode
  style?: StyleProp<ViewStyle>
  accessibilityLabel?: string
}) {
  return (
    <View
      style={[{ width: size, height: size }, style]}
      accessible={!!accessibilityLabel}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityLabel ? 'image' : undefined}
    >
      <Svg viewBox="0 0 200 200" width={size} height={size} style={StyleSheet.absoluteFill}>
        {underlay}
        {dimColor ? (
          <G fill="none" stroke={dimColor} strokeWidth={strokeWidth} strokeLinecap="round">
            {rings.map((index) => {
              const ring = FINGERPRINT_RINGS[index]!
              return (
                <Circle
                  key={index}
                  cx={100}
                  cy={100}
                  r={ring.r}
                  strokeDasharray={ring.dash}
                  transform={`rotate(${ring.rotate} 100 100)`}
                />
              )
            })}
          </G>
        ) : null}
        {rings.map((index, position) => (
          <Ring
            key={index}
            index={index}
            position={position}
            color={color}
            strokeWidth={strokeWidth}
            baseOpacity={ringOpacity?.(position) ?? 1}
            lit={lit}
            wave={wave}
          />
        ))}
        {overlay}
      </Svg>
    </View>
  )
}

/** Piccola impronta per i pulsanti di firma (24×24, tratto del colore del testo del pulsante). */
export function FingerprintGlyph({ color, size = 20 }: { color: string; size?: number }) {
  return (
    <Svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round">
      <Path d="M12 4a8 8 0 0 0-8 8" />
      <Path d="M12 4a8 8 0 0 1 8 8v2" />
      <Path d="M8 12a4 4 0 0 1 8 0v3" />
      <Path d="M12 12v6" />
      <Path d="M8 15v2" />
    </Svg>
  )
}
