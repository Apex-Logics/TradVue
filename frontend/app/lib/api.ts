/**
 * API utilities for TradVue
 */

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
