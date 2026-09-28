import { Tabs } from 'expo-router'
import { StyleSheet, View, type ColorValue } from 'react-native'
import { SymbolView, type SymbolViewProps } from 'expo-symbols'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { fonts, palette, radius } from '@/constants/theme'

// Icone Material (Android) via expo-symbols; l'icona attiva ha un alone del colore accento.
function tabIcon(name: SymbolViewProps['name']) {
  return function TabIcon({ color, focused }: { color: ColorValue; focused: boolean; size: number }) {
    return (
      <View style={[styles.icon, focused ? styles.iconFocused : null]}>
        <SymbolView name={name} tintColor={color} size={22} />
      </View>
    )
  }
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets()
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: palette.bg },
        // Tab bar flottante: pannello scuro traslucido staccato dai bordi.
        tabBarStyle: {
          position: 'absolute',
          left: 16,
          right: 16,
          bottom: Math.max(insets.bottom, 12) + 4,
          marginHorizontal: 16,
          height: 70,
          paddingTop: 8,
          paddingBottom: 10,
          borderRadius: radius.xl,
          backgroundColor: palette.tabBar,
          borderTopWidth: 0,
          borderWidth: 1,
          borderColor: palette.hairline,
          elevation: 12,
          shadowColor: '#000',
          shadowOpacity: 0.5,
          shadowRadius: 20,
        },
        tabBarActiveTintColor: palette.mint,
        tabBarInactiveTintColor: palette.textTertiary,
        tabBarLabelStyle: { fontFamily: fonts.monoMedium, fontSize: 9.5, letterSpacing: 0.6 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Signals', tabBarIcon: tabIcon({ ios: 'bell', android: 'notifications' }) }}
      />
      <Tabs.Screen
        name="positions"
        options={{
          title: 'Positions',
          tabBarIcon: tabIcon({ ios: 'wallet.pass', android: 'account_balance_wallet' }),
        }}
      />
      <Tabs.Screen
        name="track-record"
        options={{ title: 'Track', tabBarIcon: tabIcon({ ios: 'chart.bar', android: 'query_stats' }) }}
      />
      <Tabs.Screen
        name="plans"
        options={{ title: 'Plans', tabBarIcon: tabIcon({ ios: 'star', android: 'workspace_premium' }) }}
      />
      <Tabs.Screen
        name="settings"
        options={{ title: 'Settings', tabBarIcon: tabIcon({ ios: 'gearshape', android: 'tune' }) }}
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

const styles = StyleSheet.create({
  icon: { width: 44, height: 30, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  iconFocused: { backgroundColor: palette.mintSoft },
})
