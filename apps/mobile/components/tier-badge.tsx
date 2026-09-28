import { View } from 'react-native'
import { Text } from '@/components/ui/text'
import { palette, radius } from '@/constants/theme'
import type { Tier } from '@/lib/api/types'

const TIER: Record<Tier, { label: string; color: string; soft: string }> = {
  free: { label: 'FREE', color: palette.amber, soft: palette.amberSoft },
  pro: { label: 'PRO', color: palette.mint, soft: palette.mintSoft },
  holder: { label: 'HOLDER', color: palette.violet, soft: palette.violetSoft },
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
        <Text variant="label" color={color + 'CC'}>
          {`Ritardo ${delaySeconds}s`}
        </Text>
      ) : null}
    </View>
  )
}
