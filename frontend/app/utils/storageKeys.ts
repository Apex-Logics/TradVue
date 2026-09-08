export const AUTH_TOKEN_KEY = 'cg_token'
export const AUTH_USER_KEY = 'cg_user'
export const AUTH_REFRESH_TOKEN_KEY = 'cg_refresh_token'

export function getStoredAuthToken(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return localStorage.getItem(AUTH_TOKEN_KEY)
  } catch {
    return null
  }
}

export function getStoredRefreshToken(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return localStorage.getItem(AUTH_REFRESH_TOKEN_KEY)
  } catch {
    return null
  }
}

export function persistStoredAuth(token: string, user?: unknown, refreshToken?: string | null) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(AUTH_TOKEN_KEY, token)
    if (user !== undefined) {
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user))
    }
    // undefined = leave the existing refresh token (access-token-only persist).
    // null/empty = caller wants it cleared.
    if (refreshToken) {
      localStorage.setItem(AUTH_REFRESH_TOKEN_KEY, refreshToken)
    } else if (refreshToken === null || refreshToken === '') {
      localStorage.removeItem(AUTH_REFRESH_TOKEN_KEY)
    }
  } catch {}
}

export function clearStoredAuth() {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(AUTH_TOKEN_KEY)
    localStorage.removeItem(AUTH_USER_KEY)
    localStorage.removeItem(AUTH_REFRESH_TOKEN_KEY)
  } catch {}
}
