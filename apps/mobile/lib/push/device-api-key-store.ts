import * as SecureStore from 'expo-secure-store'

const DEVICE_API_KEY_STORAGE_KEY = 'device-api-key'

// L'API key per device non è ancora applicata da nessuna route dell'engine
// (auth enforcement previsto per F4/F5): la conserviamo comunque in
// secure-store così è già pronta quando servirà.
export async function saveDeviceApiKey(apiKey: string): Promise<void> {
  await SecureStore.setItemAsync(DEVICE_API_KEY_STORAGE_KEY, apiKey)
}

export async function getDeviceApiKey(): Promise<string | null> {
  return SecureStore.getItemAsync(DEVICE_API_KEY_STORAGE_KEY)
}
