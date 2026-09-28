import type { RiskLevel } from '@seeker-signal/shared'
import { StyleSheet, View } from 'react-native'
import { palette, radius, risk } from '@/constants/theme'
import { Text } from './text'

/** Pill con punto luminoso: livello di rischio leggibile a colpo d'occhio. */
export function RiskPill({ level, compact = false }: { level: RiskLevel; compact?: boolean }) {
  const { color, soft, label } = risk[level]
  return (
    <View style={[styles.pill, { backgroundColor: soft, borderColor: color + '40' }]}>
      <View style={[styles.dot, { backgroundColor: color, shadowColor: color }]} />
      <Text variant="label" color={color} style={{ letterSpacing: 1.2 }}>
        {compact ? label : `Rischio ${label}`}
      </Text>
    </View>
  )
}

const SEGMENTS = 24

/** Indicatore a segmenti: quanti "accesi" su 24 in base al punteggio 0–100. */
export function RiskMeter({ score, level }: { score: number; level: RiskLevel }) {
  const lit = Math.max(1, Math.round((Math.min(100, Math.max(0, score)) / 100) * SEGMENTS))
  const { color } = risk[level]
  return (
    <View style={styles.meter}>
      {Array.from({ length: SEGMENTS }, (_, i) => (
        <View
          key={i}
          style={[
            styles.segment,
            i < lit
              ? { backgroundColor: color, opacity: 0.45 + (0.55 * (i + 1)) / lit, shadowColor: color }
              : { backgroundColor: palette.hairline },
          ]}
        />
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  dot: { width: 7, height: 7, borderRadius: 4, shadowOpacity: 0.9, shadowRadius: 6, elevation: 3 },
  meter: { flexDirection: 'row', gap: 3, height: 22, alignItems: 'stretch' },
  segment: { flex: 1, borderRadius: 3, shadowOpacity: 0.6, shadowRadius: 4 },
})
