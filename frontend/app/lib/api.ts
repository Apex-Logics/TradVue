/**
 * API utilities for TradVue
 */

import { getStoredRefreshToken, persistStoredAuth } from '../utils/storageKeys'

export const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

export interface AuthUser {
  id: string
  email: string
  name: string | null
  email_verified: boolean
  created_at: string
  tier: 'free' | 'pro'
  is_admin?: boolean
}

export interface AuthSession {
  access_token: string
  refresh_token: string
  expires_in: number
  token_type: string
}

export interface AuthResponse {
  message?: string
  session: AuthSession | null
  user: AuthUser | null
  needs_confirmation?: boolean
  error?: string
}

export interface WatchlistItem {
  id: number
  symbol: string
  name: string
  type: string
  current_price: number
  change: number | null
  change_pct: number | null
}

export interface WatchlistResponse {
  watchlist: WatchlistItem[]
  total_items: number
  error?: string
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export async function apiLogin(email: string, password: string): Promise<AuthResponse> {
  try {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    if (res.status === 503) {
      return { session: null, user: null, error: 'Sign-in is coming soon! Stay tuned.' }
    }
    if (res.status === 429) {
      return { session: null, user: null, error: 'Too many attempts. Please wait 15 minutes before trying again.' }
    }
    const data = await res.json()
    return data
  } catch {
    return { session: null, user: null, error: 'Network error — could not reach server.' }
  }
}

export async function apiRegister(email: string, password: string): Promise<AuthResponse> {
  try {
    const res = await fetch(`${API_BASE}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    if (res.status === 503) {
      return { session: null, user: null, error: 'Account creation is coming soon! Stay tuned.' }
    }
    if (res.status === 429) {
      return { session: null, user: null, error: 'Too many attempts. Please wait 15 minutes before trying again.' }
    }
    const data = await res.json()
    return data
  } catch {
    return { session: null, user: null, error: 'Network error — could not reach server.' }
  }
}

export type MeResult =
  | { ok: true; user: AuthUser }
  | { ok: false; reason: 'auth' | 'error' }

export async function apiGetMeResult(token: string): Promise<MeResult> {
  try {
    const res = await fetch(`${API_BASE}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.status === 401 || res.status === 403) {
      return { ok: false, reason: 'auth' }
    }
    if (!res.ok) return { ok: false, reason: 'error' }
    const data = await res.json()
    const user = data.user as AuthUser | null | undefined
    if (!user) return { ok: false, reason: 'error' }
    return { ok: true, user }
  } catch {
    return { ok: false, reason: 'error' }
  }
}

export async function apiGetMe(token: string): Promise<AuthUser | null> {
  const result = await apiGetMeResult(token)
  return result.ok ? result.user : null
}

/**
 * Exchange a refresh token for a new session and persist it.
 * Does not clear storage on failure — callers decide whether to log out.
 */
export async function apiRefresh(refreshToken: string): Promise<AuthResponse> {
  try {
    const res = await fetch(`${API_BASE}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    })
    const data = await res.json().catch(() => ({})) as AuthResponse & { error?: string }
    if (!res.ok) {
      return {
        session: null,
        user: null,
        error: data.error || 'Invalid or expired refresh token',
      }
    }
    const accessToken = data.session?.access_token
    if (!accessToken || !data.user) {
      return { session: null, user: null, error: 'Invalid response from server — please try again' }
    }
    persistStoredAuth(
      accessToken,
      data.user,
      data.session?.refresh_token || getStoredRefreshToken(),
    )
    return data
  } catch {
    return { session: null, user: null, error: 'Network error — could not reach server.' }
  }
}

export async function apiGetWatchlist(token: string): Promise<WatchlistResponse> {
  const res = await fetch(`${API_BASE}/api/watchlist`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  return res.json()
}

export async function apiAddToWatchlist(token: string, symbol: string): Promise<{ item?: WatchlistItem; error?: string }> {
  const res = await fetch(`${API_BASE}/api/watchlist`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ symbol }),
  })
  return res.json()
}

export async function apiRemoveFromWatchlist(token: string, id: number): Promise<{ error?: string }> {
  const res = await fetch(`${API_BASE}/api/watchlist/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
  return res.json()
}
// Deploy trigger: 2026-03-10T04:26:18Z
