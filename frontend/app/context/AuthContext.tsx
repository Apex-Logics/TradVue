'use client'

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import {
  apiLogin,
  apiRegister,
  apiGetWatchlist,
  apiAddToWatchlist,
  apiRemoveFromWatchlist,
  type AuthUser,
  type WatchlistItem,
} from '../lib/api'

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
  register: (email: string, password: string) => Promise<{ error?: string }>
  logout: () => void

  // Watchlist sync
  backendWatchlist: BackendWatchlistEntry[]
  syncAddToWatchlist: (symbol: string) => Promise<void>
  syncRemoveFromWatchlist: (symbol: string) => Promise<void>
  loadWatchlistFromBackend: () => Promise<string[]>
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
  const didInit = useRef(false)

  // ── Hydrate from localStorage ─────────────────────────────────────────────
  useEffect(() => {
    if (didInit.current) return
    didInit.current = true
    try {
      const storedToken = localStorage.getItem('cg_token')
      const storedUser  = localStorage.getItem('cg_user')
      if (storedToken && storedUser) {
        setToken(storedToken)
        setUser(JSON.parse(storedUser))
      }
    } catch {}
    setLoading(false)
  }, [])

  // ── Load watchlist from backend after login ───────────────────────────────
  const loadWatchlistFromBackend = useCallback(async (): Promise<string[]> => {
    if (!token) return []
    try {
      const res = await apiGetWatchlist(token)
      if (res.error || !res.watchlist) return []
      const entries = res.watchlist.map(item => ({
        id: item.id,
        symbol: item.symbol.toUpperCase(),
      }))
      setBackendWatchlist(entries)
      return entries.map(e => e.symbol)
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
  function persistAuth(tok: string, usr: AuthUser) {
    try {
      localStorage.setItem('cg_token', tok)
      localStorage.setItem('cg_user', JSON.stringify(usr))
    } catch {}
  }

  function clearAuth() {
    try {
      localStorage.removeItem('cg_token')
      localStorage.removeItem('cg_user')
    } catch {}
  }

  // ── Login ─────────────────────────────────────────────────────────────────
  const login = useCallback(async (email: string, password: string) => {
    try {
      const res = await apiLogin(email, password)
      if (res.error) return { error: res.error }
      if (!res.token || !res.user) return { error: 'Invalid response from server' }
      setToken(res.token)
      setUser(res.user)
      persistAuth(res.token, res.user)
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
      if (!res.token || !res.user) return { error: 'Invalid response from server' }
      setToken(res.token)
      setUser(res.user)
      persistAuth(res.token, res.user)
      return {}
    } catch {
      return { error: 'Network error — please try again' }
    }
  }, [])

  // ── Logout ────────────────────────────────────────────────────────────────
  const logout = useCallback(() => {
    setToken(null)
    setUser(null)
    setBackendWatchlist([])
    clearAuth()
  }, [])

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
    }}>
      {children}
    </AuthContext.Provider>
  )
}
