import { View } from 'react-native'
import { Text } from '@/components/ui/text'
import { palette, radius } from '@/constants/theme'
import type { Tier } from '@/lib/api/types'

const TIER: Record<Tier, { label: string; color: string; soft: string }> = {
  free: { label: 'FREE', color: palette.textSecondary, soft: palette.surfaceStrong },
  pro: { label: 'PRO', color: palette.accent, soft: palette.accentSoft },
  holder: { label: 'HOLDER', color: palette.gold, soft: palette.goldSoft },
}

export function TierBadge({ tier, delaySeconds }: { tier: Tier; delaySeconds?: number | null }) {
  const { label, color, soft } = TIER[tier]
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        alignSelf: 'flex-start',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: radius.pill,
        backgroundColor: soft,
        borderWidth: 1,
        borderColor: color + '40',
      }}
    >
      <Text variant="label" color={color}>
        {label}
      </Text>
      {tier === 'free' && delaySeconds ? (
        <Text variant="mono" color={color + 'CC'} style={{ fontSize: 11.5 }}>
          · {delaySeconds}s delay
        </Text>
      ) : null}
    </View>
  )
}
