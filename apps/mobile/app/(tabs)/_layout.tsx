import { Tabs } from 'expo-router'
import { colors } from '@/constants/app-styles'

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        headerShadowVisible: false,
        tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.border },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Segnali' }} />
      <Tabs.Screen name="positions" options={{ title: 'Posizioni' }} />
      <Tabs.Screen name="track-record" options={{ title: 'Track record' }} />
      <Tabs.Screen name="plans" options={{ title: 'Piani' }} />
      <Tabs.Screen name="settings" options={{ title: 'Impostazioni' }} />
      {/* Solo in sviluppo: firma una tx di prova su mainnet, non va mostrata agli utenti della build release. */}
      <Tabs.Screen name="debug" options={{ title: 'Debug', href: __DEV__ ? undefined : null }} />
    </Tabs>
  )
}
