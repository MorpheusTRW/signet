import { DMSans_400Regular, DMSans_500Medium, DMSans_700Bold } from '@expo-google-fonts/dm-sans'
import { JetBrainsMono_500Medium } from '@expo-google-fonts/jetbrains-mono'
import { Unbounded_500Medium, Unbounded_600SemiBold } from '@expo-google-fonts/unbounded'
import { useFonts } from 'expo-font'
import { Stack } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { StatusBar } from 'expo-status-bar'
import { useEffect } from 'react'
import 'react-native-reanimated'
import { AppProviders } from '@/components/app-providers'
import { PushEffects } from '@/components/push-effects'
import { palette } from '@/constants/theme'

void SplashScreen.preventAutoHideAsync()

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Unbounded_500Medium,
    Unbounded_600SemiBold,
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_700Bold,
    JetBrainsMono_500Medium,
  })
  const ready = fontsLoaded || !!fontError

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync()
  }, [ready])

  // Se i font non si caricano si prosegue con quelli di sistema invece di bloccare l'app.
  if (!ready) return null

  return (
    <AppProviders>
      <PushEffects />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: palette.bg },
          animation: 'fade_from_bottom',
        }}
      />
      <StatusBar style="light" />
    </AppProviders>
  )
}
