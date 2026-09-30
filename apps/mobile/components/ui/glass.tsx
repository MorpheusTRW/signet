import { StyleSheet, View, type ViewProps } from 'react-native'
import { palette, radius } from '@/constants/theme'

/** Pannello: superficie #1A1A1E con bordo sottile; `glow` tinge bordo e alone (come la card del segnale). */
export function Glass({ glow, style, children, ...rest }: ViewProps & { glow?: string }) {
  return (
    <View
      {...rest}
      style={[
        styles.base,
        glow
          ? {
              // Niente elevation: su Android l'ombra di una superficie traslucida si vede
              // attraverso il pannello (rettangolo scuro interno). Il bagliore è reso da
              // bordo e fondo tinti; shadow* resta solo per iOS.
              borderColor: glow,
              shadowColor: glow,
              shadowOpacity: 0.35,
              shadowRadius: 18,
              shadowOffset: { width: 0, height: 0 },
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
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: 18,
    gap: 10,
  },
})
