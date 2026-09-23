import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import 'react-native-reanimated'
import { AppProviders } from '@/components/app-providers'
import { PushEffects } from '@/components/push-effects'
import { colors } from '@/constants/app-styles'

export default function RootLayout() {
  return (
    <AppProviders>
      <PushEffects />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="signal/[id]" options={{ title: 'Segnale' }} />
      </Stack>
      <StatusBar style="light" />
    </AppProviders>
  )
}
