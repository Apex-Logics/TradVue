/**
 * Shared access-token refresh + one-shot 401/403 retry.
 *
 * Used by AuthContext hydrate, journal user-data sync, and webhook events
 * so expired JWTs either recover via POST /api/auth/refresh or clear the
 * zombie signed-in session.
 */

import { apiRefresh, type AuthUser } from './api'
import {
  clearStoredAuth,
  getStoredRefreshToken,
} from '../utils/storageKeys'

export type AuthSessionEvent =
  | { type: 'refreshed'; token: string; user: AuthUser }
  | { type: 'cleared' }

const listeners = new Set<(event: AuthSessionEvent) => void>()

export function subscribeAuthSession(fn: (event: AuthSessionEvent) => void): () => void {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}

function emit(event: AuthSessionEvent): void {
  listeners.forEach(fn => fn(event))
}

export function isAuthFailureStatus(status: number): boolean {
  return status === 401 || status === 403
}

let refreshInFlight: Promise<{ token: string; user: AuthUser } | null> | null = null

/**
 * One refresh at a time. Concurrent 401/403 callers share this promise.
 * Returns the new access token + user, or null if refresh is impossible.
 */
export async function refreshStoredSession(): Promise<{ token: string; user: AuthUser } | null> {
  if (refreshInFlight) return refreshInFlight

  refreshInFlight = (async () => {
    const refreshToken = getStoredRefreshToken()
    if (!refreshToken) return null
    const res = await apiRefresh(refreshToken)
    const token = res.session?.access_token
    const user = res.user
    if (!token || !user) return null
    emit({ type: 'refreshed', token, user })
    return { token, user }
  })()

  try {
    return await refreshInFlight
  } finally {
    refreshInFlight = null
  }
}

export function clearExpiredSession(): void {
  clearStoredAuth()
  emit({ type: 'cleared' })
}

/**
 * Run `fetch`, and on 401/403 try a single refresh+retry.
 * If the retry still fails auth (or refresh is unavailable), clear the session.
 */
export async function fetchWithSessionRetry(url: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(url, init)
  if (!isAuthFailureStatus(res.status)) return res

  const refreshed = await refreshStoredSession()
  if (!refreshed) {
    clearExpiredSession()
    return res
  }

  const headers = new Headers(init?.headers)
  headers.set('Authorization', `Bearer ${refreshed.token}`)
  const retry = await fetch(url, { ...init, headers })
  if (isAuthFailureStatus(retry.status)) {
    clearExpiredSession()
  }
  return retry
}
