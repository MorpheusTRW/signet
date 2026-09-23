import './polyfill'
import { getMessaging, setBackgroundMessageHandler } from '@react-native-firebase/messaging'
import 'expo-router/entry'

// Va registrato qui, nell'entry file, non in un componente: gestisce i
// messaggi FCM ricevuti mentre l'app è in background o chiusa (CLAUDE.md F3).
setBackgroundMessageHandler(getMessaging(), async () => {})
