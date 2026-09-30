import { Tabs } from 'expo-router'
import { Text } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { fonts, palette } from '@/constants/theme'

/** Tab bar dei mockup: solo testo, bordo superiore sottile, voce attiva in arancione. */
export default function TabsLayout() {
  const insets = useSafeAreaInsets()
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: palette.bg },
        tabBarStyle: {
          backgroundColor: palette.tabBar,
          borderTopWidth: 1,
          borderTopColor: palette.hairline,
          height: 60 + Math.max(insets.bottom, 12),
          paddingTop: 8,
          paddingBottom: Math.max(insets.bottom, 12),
          paddingHorizontal: 8,
          elevation: 0,
        },
        tabBarIcon: () => null,
        tabBarIconStyle: { display: 'none' },
        tabBarActiveTintColor: palette.accent,
        tabBarInactiveTintColor: palette.textSecondary,
        tabBarLabel: ({ focused, color, children }) => (
          <Text style={{ fontFamily: focused ? fonts.bold : fonts.regular, fontSize: 12, color }}>{children}</Text>
        ),
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Feed' }} />
      <Tabs.Screen name="dodged" options={{ title: 'Dodged' }} />
      <Tabs.Screen name="recap" options={{ title: 'Recap' }} />
      <Tabs.Screen name="positions" options={{ title: 'Positions' }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
      {/* Solo in sviluppo: firma una tx di prova su mainnet, non va mostrata agli utenti della build release. */}
      <Tabs.Screen name="debug" options={{ title: 'Debug', href: __DEV__ ? undefined : null }} />
    </Tabs>
  )
}
