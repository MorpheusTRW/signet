import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import * as Haptics from 'expo-haptics'
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated'
import { router } from 'expo-router'
import { SymbolView } from 'expo-symbols'
import { gradients, palette, radius } from '@/constants/theme'
import { Text } from './text'

/** Valore con etichetta tecnica sopra. */
export function Metric({
  label,
  value,
  accent,
  mono = false,
}: {
  label: string
  value: string
  accent?: string
  mono?: boolean
}) {
  return (
    <View style={styles.metric}>
      <Text variant="label">{label}</Text>
      <Text variant={mono ? 'mono' : 'heading'} color={accent} numberOfLines={1} style={mono ? { fontSize: 14 } : null}>
        {value}
      </Text>
    </View>
  )
}

/** Chip selezionabile (importi rapidi, slippage). */
export function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={() => {
        void Haptics.selectionAsync()
        onPress()
      }}
      style={[styles.chip, selected ? styles.chipSelected : null]}
    >
      <Text variant="mono" color={selected ? palette.accent : palette.textSecondary} style={{ fontSize: 13 }}>
        {label}
      </Text>
    </Pressable>
  )
}

/** Piccolo tag informativo (metriche nella card del segnale). */
export function Tag({ children }: { children: ReactNode }) {
  return (
    <View style={styles.tag}>
      <Text variant="mono" style={{ fontSize: 11.5 }}>
        {children}
      </Text>
    </View>
  )
}

/** Avatar del token: immagine dai metadati se c'è, altrimenti iniziali; cornice a gradiente del brand. */
export function TokenAvatar({ symbol, imageUrl, size = 44 }: { symbol: string; imageUrl?: string; size?: number }) {
  const [failed, setFailed] = useState(false)
  const initials =
    symbol
      .replace(/[^A-Za-z0-9]/g, '')
      .slice(0, 2)
      .toUpperCase() || '?'
  const inner = size / 3 - 1.5
  return (
    <LinearGradient
      colors={gradients.brand}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ width: size, height: size, borderRadius: size / 3, padding: 1.5 }}
    >
      <View style={[styles.avatarInner, { borderRadius: inner, overflow: 'hidden' }]}>
        {imageUrl && !failed ? (
          <Image
            source={{ uri: imageUrl }}
            style={{ width: '100%', height: '100%' }}
            contentFit="cover"
            transition={200}
            cachePolicy="memory-disk"
            onError={() => setFailed(true)}
            accessibilityLabel={`${symbol} logo`}
          />
        ) : (
          <Text variant="heading" style={{ fontSize: size * 0.36 }}>
            {initials}
          </Text>
        )}
      </View>
    </LinearGradient>
  )
}

/** Punto pulsante "LIVE". */
export function LiveDot({ label = 'Live' }: { label?: string }) {
  const pulse = useSharedValue(0)
  useEffect(() => {
    pulse.set(withRepeat(withTiming(1, { duration: 1400, easing: Easing.out(Easing.quad) }), -1, false))
  }, [pulse])
  const halo = useAnimatedStyle(() => ({
    opacity: 0.6 * (1 - pulse.value),
    transform: [{ scale: 1 + pulse.value * 1.6 }],
  }))
  return (
    <View style={styles.live}>
      <View style={{ width: 8, height: 8 }}>
        <Animated.View style={[styles.liveHalo, halo]} />
        <View style={styles.liveCore} />
      </View>
      <Text variant="label" color={palette.accent}>
        {label}
      </Text>
    </View>
  )
}

/** Intestazione di schermata: micro-etichetta, titolo grande, elemento a destra. */
export function Header({ eyebrow, title, right }: { eyebrow?: ReactNode; title: string; right?: ReactNode }) {
  return (
    <View style={{ gap: 6 }}>
      <View style={styles.headerRow}>
        {typeof eyebrow === 'string' ? <Text variant="label">{eyebrow}</Text> : (eyebrow ?? <View />)}
        {right}
      </View>
      <Text variant="display">{title}</Text>
    </View>
  )
}

/** Barra con pulsante indietro per le schermate fuori dalle tab. */
export function BackBar({ title }: { title?: string }) {
  return (
    <View style={styles.backBar}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Indietro"
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        style={styles.backButton}
        hitSlop={8}
      >
        <SymbolView name={{ ios: 'chevron.left', android: 'arrow_back' }} tintColor={palette.text} size={20} />
      </Pressable>
      {title ? <Text variant="label">{title}</Text> : null}
    </View>
  )
}

/** Riga chiave/valore per riepiloghi. */
export function Row({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <View style={styles.row}>
      <Text variant="secondary">{label}</Text>
      <Text variant="body" color={valueColor} style={{ fontFamily: 'SpaceGrotesk_500Medium' }}>
        {value}
      </Text>
    </View>
  )
}

export function Divider() {
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: palette.hairlineStrong }} />
}

const styles = StyleSheet.create({
  metric: { flex: 1, gap: 6 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radius.pill,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.hairline,
  },
  chipSelected: { backgroundColor: palette.accentSoft, borderColor: palette.accent + '66' },
  tag: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radius.sm,
    backgroundColor: palette.surfaceStrong,
  },
  avatarInner: { flex: 1, backgroundColor: '#0B0F14', alignItems: 'center', justifyContent: 'center' },
  live: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  liveCore: { position: 'absolute', width: 8, height: 8, borderRadius: 4, backgroundColor: palette.accent },
  liveHalo: { position: 'absolute', width: 8, height: 8, borderRadius: 4, borderWidth: 1, borderColor: palette.accent },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 22 },
  backBar: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: palette.surfaceStrong,
    borderWidth: 1,
    borderColor: palette.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
})
