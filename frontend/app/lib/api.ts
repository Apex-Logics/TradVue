/**
 * API utilities for TradVue
 */

export const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

export interface AuthUser {
  id: string
  email: string
  subscription_tier: 'free' | 'pro'
  verified: boolean
  created_at: string
}

export interface AuthResponse {
  token: string
  user: AuthUser
  message?: string
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
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  return res.json()
}

export async function apiRegister(email: string, password: string): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  return res.json()
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
