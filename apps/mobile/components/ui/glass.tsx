import { StyleSheet, View, type ViewProps } from 'react-native'
import { palette, radius } from '@/constants/theme'

/** Pannello "vetro": superficie traslucida con bordo sottile; `glow` tinge bordo e alone. */
export function Glass({ glow, style, children, ...rest }: ViewProps & { glow?: string }) {
  return (
    <View
      {...rest}
      style={[
        styles.base,
        glow
          ? {
              borderColor: glow + '55',
              shadowColor: glow,
              shadowOpacity: 0.35,
              shadowRadius: 18,
              shadowOffset: { width: 0, height: 0 },
              elevation: 6,
            }
          : null,
        style,
      ]}
    >
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: palette.surface,
    borderColor: palette.hairline,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderRadius: radius.lg,
    padding: 18,
    gap: 10,
  },
})
