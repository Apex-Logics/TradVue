'use client'

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { trackLogout } from '../utils/analytics'
import { initFullSync, hydrateWatchlistFromApi, getSyncStatus, subscribeSyncStatus, resetJournalPullGate, type SyncStatus } from '../utils/cloudSync'
import {
  apiLogin,
  apiRegister,
  apiGetMeResult,
  apiAddToWatchlist,
  apiRemoveFromWatchlist,
  type AuthUser,
} from '../lib/api'
import { refreshStoredSession, subscribeAuthSession } from '../lib/authSession'
import { AUTH_REFRESH_TOKEN_KEY, AUTH_TOKEN_KEY, AUTH_USER_KEY, clearStoredAuth, persistStoredAuth } from '../utils/storageKeys'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface BackendWatchlistEntry {
  id: number       // backend watchlist row ID
  symbol: string
}

interface AuthContextValue {
  user: AuthUser | null
  token: string | null
  loading: boolean

  // Auth actions
  login: (email: string, password: string) => Promise<{ error?: string }>
  register: (email: string, password: string) => Promise<{ error?: string; needsConfirmation?: boolean }>
  logout: () => void

  // Watchlist sync
  backendWatchlist: BackendWatchlistEntry[]
  syncAddToWatchlist: (symbol: string) => Promise<void>
  syncRemoveFromWatchlist: (symbol: string) => Promise<void>
  loadWatchlistFromBackend: () => Promise<string[]>

  // Cloud sync status
  syncStatus: SyncStatus
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}

// ── Provider ──────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [backendWatchlist, setBackendWatchlist] = useState<BackendWatchlistEntry[]>([])
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(() => getSyncStatus())
  const didInit = useRef(false)

  const clearSessionState = useCallback(() => {
    resetJournalPullGate()
    setToken(null)
    setUser(null)
    setBackendWatchlist([])
    clearStoredAuth()
  }, [])

  // Subscribe to cloud sync status changes
  useEffect(() => {
    return subscribeSyncStatus(setSyncStatus)
  }, [])

  // Journal / events 401/403 retry may refresh or clear the session out of band.
  useEffect(() => {
    return subscribeAuthSession(event => {
      if (event.type === 'refreshed') {
        setToken(event.token)
        setUser(event.user)
        return
      }
      resetJournalPullGate()
      setToken(null)
      setUser(null)
      setBackendWatchlist([])
    })
  }, [])

  async function applyFreshSession(tok: string, usr: AuthUser, refreshToken?: string | null) {
    setToken(tok)
    setUser(usr)
    persistStoredAuth(tok, usr, refreshToken)
    initFullSync(tok)
  }

  async function recoverOrClearSession(): Promise<boolean> {
    const refreshed = await refreshStoredSession()
    if (refreshed) {
      // apiRefresh already persisted; still kick a full sync with the new token.
      setToken(refreshed.token)
      setUser(refreshed.user)
      initFullSync(refreshed.token)
      return true
    }
    clearSessionState()
    return false
  }

  // ── Hydrate from localStorage ─────────────────────────────────────────────
  useEffect(() => {
    if (didInit.current) return
    didInit.current = true

    let cancelled = false

    const hydrateAuth = async () => {
      try {
        const storedToken = localStorage.getItem(AUTH_TOKEN_KEY) // cg_ = legacy prefix from ChartGenius era (now TradVue); kept to avoid breaking existing user data
        const storedUser  = localStorage.getItem(AUTH_USER_KEY)  // cg_ = legacy prefix from ChartGenius era (now TradVue); kept to avoid breaking existing user data

        if (!storedToken) return

        if (storedUser) {
          if (cancelled) return
          setToken(storedToken)
          setUser(JSON.parse(storedUser))
          // Trigger initial cloud sync for returning logged-in users.
          // Fire-and-forget; journal PUTs wait for pullComplete in cloudSync.
          // 401/403 on journal GET retries refresh once (fetchWithSessionRetry).
          initFullSync(storedToken)

          // Background /me: pick up tier/admin changes, or refresh/clear a stale JWT.
          apiGetMeResult(storedToken).then(async result => {
            if (cancelled) return
            if (result.ok) {
              setUser(result.user)
              persistStoredAuth(storedToken, result.user, localStorage.getItem(AUTH_REFRESH_TOKEN_KEY))
              return
            }
            const recovered = await refreshStoredSession()
            if (cancelled) return
            if (recovered) {
              setToken(recovered.token)
              setUser(recovered.user)
              initFullSync(recovered.token)
              return
            }
            if (result.reason === 'auth') clearSessionState()
          }).catch(() => {})

          return
        }

        const me = await apiGetMeResult(storedToken)
        if (cancelled) return
        if (me.ok) {
          await applyFreshSession(storedToken, me.user, localStorage.getItem(AUTH_REFRESH_TOKEN_KEY))
          return
        }
        await recoverOrClearSession()
      } catch {
        clearSessionState()
      }
    }

    hydrateAuth().finally(() => {
      if (!cancelled) setLoading(false)
    })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hydrate once on mount
  }, [])

  // ── Load watchlist from backend after login ───────────────────────────────
  const loadWatchlistFromBackend = useCallback(async (): Promise<string[]> => {
    if (!token) return []
    try {
      // Q4/A6: sole Auth path that hydrates cg_wl from GET /api/watchlist.
      const { symbols, entries } = await hydrateWatchlistFromApi(token)
      setBackendWatchlist(entries)
      return symbols
    } catch {
      return []
    }
  }, [token])

  // Load backend watchlist when token is ready
  useEffect(() => {
    if (token) {
      loadWatchlistFromBackend()
    } else {
      setBackendWatchlist([])
    }
  }, [token, loadWatchlistFromBackend])

  // ── Persist auth to localStorage ──────────────────────────────────────────
  function persistAuth(tok: string, usr: AuthUser, refreshToken?: string | null) {
    persistStoredAuth(tok, usr, refreshToken)
  }

  // ── Login ─────────────────────────────────────────────────────────────────
  const login = useCallback(async (email: string, password: string) => {
    try {
      const res = await apiLogin(email, password)
      if (res.error) return { error: res.error }
      const accessToken = res.session?.access_token
      if (!accessToken || !res.user) {
        return { error: 'Invalid response from server — please try again' }
      }
      setToken(accessToken)
      setUser(res.user)
      persistAuth(accessToken, res.user, res.session?.refresh_token)
      // Fire-and-forget; journal PUTs wait for pullComplete in cloudSync.
      initFullSync(accessToken)
      return {}
    } catch {
      return { error: 'Network error — please try again' }
    }
  }, [])

  // ── Register ──────────────────────────────────────────────────────────────
  const register = useCallback(async (email: string, password: string) => {
    try {
      const res = await apiRegister(email, password)
      if (res.error) return { error: res.error }

      // Email confirmation required — session is null until user confirms
      if (res.needs_confirmation) {
        return { needsConfirmation: true }
      }

      const accessToken = res.session?.access_token
      if (!accessToken || !res.user) {
        return { error: 'Invalid response from server — please try again' }
      }
      setToken(accessToken)
      setUser(res.user)
      persistAuth(accessToken, res.user, res.session?.refresh_token)
      // Fire-and-forget; journal PUTs wait for pullComplete in cloudSync.
      initFullSync(accessToken)
      return {}
    } catch {
      return { error: 'Network error — please try again' }
    }
  }, [])

  // ── Logout ────────────────────────────────────────────────────────────────
  const logout = useCallback(() => {
    trackLogout()
    clearSessionState()
  }, [clearSessionState])

  // ── Watchlist Sync: Add ───────────────────────────────────────────────────
  const syncAddToWatchlist = useCallback(async (symbol: string) => {
    if (!token) return
    try {
      const res = await apiAddToWatchlist(token, symbol)
      if (res.item) {
        setBackendWatchlist(prev => {
          if (prev.some(e => e.symbol.toUpperCase() === symbol.toUpperCase())) return prev
          return [...prev, { id: res.item!.id, symbol: symbol.toUpperCase() }]
        })
      }
    } catch {
      // Fail silently — localStorage is still updated
    }
  }, [token])

  // ── Watchlist Sync: Remove ────────────────────────────────────────────────
  const syncRemoveFromWatchlist = useCallback(async (symbol: string) => {
    if (!token) return
    const entry = backendWatchlist.find(e => e.symbol.toUpperCase() === symbol.toUpperCase())
    if (!entry) return
    try {
      await apiRemoveFromWatchlist(token, entry.id)
      setBackendWatchlist(prev => prev.filter(e => e.id !== entry.id))
    } catch {
      // Fail silently
    }
  }, [token, backendWatchlist])

  return (
    <AuthContext.Provider value={{
      user,
      token,
      loading,
      login,
      register,
      logout,
      backendWatchlist,
      syncAddToWatchlist,
      syncRemoveFromWatchlist,
      loadWatchlistFromBackend,
      syncStatus,
    }}>
      {children}
    </AuthContext.Provider>
  )
}
