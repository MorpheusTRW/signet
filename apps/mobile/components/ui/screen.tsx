import type { ReactElement, ReactNode } from 'react'
import { ScrollView, StyleSheet, View, type RefreshControlProps } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { palette, TAB_BAR_CLEARANCE } from '@/constants/theme'

/** Sfondo del design system: nero pieno, come nei mockup. */
export function Backdrop() {
  return <View style={[StyleSheet.absoluteFill, { backgroundColor: palette.bg }]} pointerEvents="none" />
}

/**
 * Contenitore di ogni schermata: sfondo, margini e safe area.
 * `scroll` avvolge in ScrollView; `tabBar` lascia spazio alla tab bar flottante.
 */
export function Screen({
  children,
  scroll = false,
  tabBar = true,
  refreshControl,
}: {
  children: ReactNode
  scroll?: boolean
  tabBar?: boolean
  refreshControl?: ReactElement<RefreshControlProps>
}) {
  const insets = useSafeAreaInsets()
  const padding = {
    paddingTop: insets.top + 12,
    paddingHorizontal: 20,
    paddingBottom: tabBar ? TAB_BAR_CLEARANCE : insets.bottom + 24,
  }
  return (
    <View style={{ flex: 1 }}>
      <Backdrop />
      {scroll ? (
        <ScrollView
          contentContainerStyle={[padding, { gap: 16 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={refreshControl}
        >
          {children}
        </ScrollView>
      ) : (
        <View
          style={[
            { flex: 1, gap: 16 },
            { paddingTop: padding.paddingTop, paddingHorizontal: 20 },
          ]}
        >
          {children}
        </View>
      )}
    </View>
  )
}
