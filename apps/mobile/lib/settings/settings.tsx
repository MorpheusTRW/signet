import AsyncStorage from '@react-native-async-storage/async-storage'
import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from 'react'

export interface AppSettings {
  defaultSizeSol: number
  slippageBps: number
  /** Kill switch locale: blocca "Approva Entry" su questo dispositivo, indipendentemente dal server. */
  killSwitch: boolean
}

export const DEFAULT_SETTINGS: AppSettings = { defaultSizeSol: 0.1, slippageBps: 100, killSwitch: false }

const STORAGE_KEY = 'app-settings'

/** Ripulisce un valore letto da storage: campi mancanti/invalidi tornano al default. */
export function parseSettings(raw: string | null): AppSettings {
  if (!raw) return DEFAULT_SETTINGS
  try {
    const json = JSON.parse(raw) as Partial<AppSettings>
    return {
      defaultSizeSol:
        typeof json.defaultSizeSol === 'number' && json.defaultSizeSol > 0
          ? json.defaultSizeSol
          : DEFAULT_SETTINGS.defaultSizeSol,
      slippageBps:
        typeof json.slippageBps === 'number' && json.slippageBps > 0 && json.slippageBps <= 5000
          ? json.slippageBps
          : DEFAULT_SETTINGS.slippageBps,
      killSwitch: json.killSwitch === true,
    }
  } catch {
    return DEFAULT_SETTINGS
  }
}

interface SettingsContextValue {
  settings: AppSettings
  loaded: boolean
  update: (patch: Partial<AppSettings>) => void
}

const SettingsContext = createContext<SettingsContextValue | null>(null)

export function SettingsProvider({ children }: PropsWithChildren) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => setSettings(parseSettings(raw)))
      .catch(() => {})
      .finally(() => setLoaded(true))
  }, [])

  const update = useCallback((patch: Partial<AppSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch }
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {})
      return next
    })
  }, [])

  const value = useMemo(() => ({ settings, loaded, update }), [settings, loaded, update])
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings must be used inside SettingsProvider')
  return ctx
}
