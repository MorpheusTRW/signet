import { Text, View } from 'react-native'
import { colors } from '@/constants/app-styles'
import type { Tier } from '@/lib/api/types'

const TIER_LABELS: Record<Tier, string> = {
  free: 'FREE',
  pro: 'PRO',
  holder: 'HOLDER',
}

export function TierBadge({ tier, delaySeconds }: { tier: Tier; delaySeconds?: number | null }) {
  const isFree = tier === 'free'
  const tint = isFree ? colors.warning : colors.accent
  const background = isFree ? colors.warningMuted : colors.accentMuted

  return (
    <View
      style={{
        alignSelf: 'flex-start',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 999,
        backgroundColor: background,
      }}
    >
      <Text style={{ color: tint, fontWeight: '700', fontSize: 12 }}>{TIER_LABELS[tier]}</Text>
      {isFree && delaySeconds ? <Text style={{ color: tint, fontSize: 12 }}>· Delayed {delaySeconds}s</Text> : null}
    </View>
  )
}
