import { Tabs } from 'expo-router'
import type { ColorValue } from 'react-native'
import { SymbolView, type SymbolViewProps } from 'expo-symbols'
import { colors } from '@/constants/app-styles'

// Icone Material (Android) via expo-symbols: senza tabBarIcon la tab bar mostra un glifo mancante.
function tabIcon(name: SymbolViewProps['name']) {
  return function TabIcon({ color, size }: { color: ColorValue; size: number }) {
    return <SymbolView name={name} tintColor={color} size={size} />
  }
}

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
      <Tabs.Screen
        name="index"
        options={{ title: 'Segnali', tabBarIcon: tabIcon({ ios: 'bell', android: 'notifications' }) }}
      />
      <Tabs.Screen
        name="positions"
        options={{
          title: 'Posizioni',
          tabBarIcon: tabIcon({ ios: 'wallet.pass', android: 'account_balance_wallet' }),
        }}
      />
      <Tabs.Screen
        name="track-record"
        options={{ title: 'Track record', tabBarIcon: tabIcon({ ios: 'chart.bar', android: 'query_stats' }) }}
      />
      <Tabs.Screen
        name="plans"
        options={{ title: 'Piani', tabBarIcon: tabIcon({ ios: 'star', android: 'workspace_premium' }) }}
      />
      <Tabs.Screen
        name="settings"
        options={{ title: 'Impostazioni', tabBarIcon: tabIcon({ ios: 'gearshape', android: 'settings' }) }}
      />
      {/* Solo in sviluppo: firma una tx di prova su mainnet, non va mostrata agli utenti della build release. */}
      <Tabs.Screen
        name="debug"
        options={{
          title: 'Debug',
          href: __DEV__ ? undefined : null,
          tabBarIcon: tabIcon({ ios: 'ladybug', android: 'bug_report' }),
        }}
      />
    </Tabs>
  )
}
