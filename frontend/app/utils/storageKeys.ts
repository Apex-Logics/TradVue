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
