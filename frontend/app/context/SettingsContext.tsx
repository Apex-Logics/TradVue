'use client'

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { setManualTimezone } from '../lib/timezone'

// ── Types ─────────────────────────────────────────────────────────────────────

export type Theme = 'dark' | 'light'
export type DefaultMarket = 'US' | 'Crypto' | 'Forex'

export interface Settings {
  theme: Theme
  notificationsEnabled: boolean
  notificationPermission: NotificationPermission | 'unknown'
  defaultMarket: DefaultMarket
  /** IANA timezone override (null = use device auto-detection) */
  timezone: string | null
  /** AI Trade Coach — when false, no trade data is sent to OpenAI (Privacy Policy §6.3 and §9) */
  aiCoachEnabled: boolean
}

interface SettingsContextValue {
  settings: Settings
  setTheme: (t: Theme) => void
  setDefaultMarket: (m: DefaultMarket) => void
  requestNotifications: () => Promise<boolean>
  setNotificationsEnabled: (v: boolean) => void
  /** Set a manual timezone override. Pass null to use device timezone. */
  setTimezone: (tz: string | null) => void
  /** Toggle AI Coach data processing. When false, no data goes to OpenAI. */
  setAiCoachEnabled: (enabled: boolean) => void
  settingsOpen: boolean
  openSettings: () => void
  closeSettings: () => void
}

const DEFAULT_SETTINGS: Settings = {
  theme: 'dark',
  notificationsEnabled: false,
  notificationPermission: 'unknown',
  defaultMarket: 'US',
  timezone: null,
  aiCoachEnabled: true,
}

const SettingsContext = createContext<SettingsContextValue | null>(null)

export function useSettings() {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings must be used inside SettingsProvider')
  return ctx
}

// ── Provider ──────────────────────────────────────────────────────────────────

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

  // ── Load from localStorage ────────────────────────────────────────────────
  useEffect(() => {
    try {
      const stored = localStorage.getItem('cg_settings') // cg_ = legacy prefix from ChartGenius era (now TradVue); kept to avoid breaking existing user data
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<Settings>
        setSettings(prev => ({ ...prev, ...parsed }))
      }
    } catch {}

    // Check current notification permission
    if ('Notification' in window) {
      setSettings(prev => ({
        ...prev,
        notificationPermission: Notification.permission,
      }))
    }

    setMounted(true)
  }, [])

  // ── Apply theme to <html> ─────────────────────────────────────────────────
  useEffect(() => {
    if (!mounted) return
    const root = document.documentElement
    if (settings.theme === 'light') {
      root.classList.add('theme-light')
      root.classList.remove('theme-dark')
    } else {
      root.classList.add('theme-dark')
      root.classList.remove('theme-light')
    }
  }, [settings.theme, mounted])

  // ── Persist settings ──────────────────────────────────────────────────────
  function persist(updated: Settings) {
    try {
      localStorage.setItem('cg_settings', JSON.stringify(updated))
    } catch {}
  }

  function update(patch: Partial<Settings>) {
    setSettings(prev => {
      const next = { ...prev, ...patch }
      persist(next)
      return next
    })
  }

  const setTheme = useCallback((t: Theme) => update({ theme: t }), [])
  const setDefaultMarket = useCallback((m: DefaultMarket) => update({ defaultMarket: m }), [])
  const setNotificationsEnabled = useCallback((v: boolean) => update({ notificationsEnabled: v }), [])
  const setTimezone = useCallback((tz: string | null) => {
    setManualTimezone(tz)
    update({ timezone: tz })
  }, [])

  const setAiCoachEnabled = useCallback((enabled: boolean) => {
    update({ aiCoachEnabled: enabled })
  }, [])

  const requestNotifications = useCallback(async (): Promise<boolean> => {
    if (!('Notification' in window)) return false
    try {
      const permission = await Notification.requestPermission()
      update({ notificationPermission: permission, notificationsEnabled: permission === 'granted' })
      return permission === 'granted'
    } catch {
      return false
    }
  }, [])

  return (
    <SettingsContext.Provider value={{
      settings,
      setTheme,
      setDefaultMarket,
      requestNotifications,
      setNotificationsEnabled,
      setTimezone,
      setAiCoachEnabled,
      settingsOpen,
      openSettings: () => setSettingsOpen(true),
      closeSettings: () => setSettingsOpen(false),
    }}>
      {children}
    </SettingsContext.Provider>
  )
}
