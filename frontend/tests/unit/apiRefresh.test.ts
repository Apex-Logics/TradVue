import { API_BASE, apiGetMeResult, apiRefresh } from '../../app/lib/api'
import { AUTH_REFRESH_TOKEN_KEY, AUTH_TOKEN_KEY, AUTH_USER_KEY } from '../../app/utils/storageKeys'

const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, val: string) => { store[key] = val },
    removeItem: (key: string) => { delete store[key] },
    clear: () => { store = {} },
  }
})()
Object.defineProperty(window, 'localStorage', { value: localStorageMock, configurable: true })
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, configurable: true })

const USER = {
  id: 'u1',
  email: 'qa@tradvue.com',
  name: null,
  email_verified: true,
  created_at: '2026-01-01T00:00:00.000Z',
  tier: 'free' as const,
}

describe('apiRefresh', () => {
  beforeEach(() => {
    localStorageMock.clear()
    jest.clearAllMocks()
  })

  test('POSTs /api/auth/refresh and persists the new session', async () => {
    localStorageMock.setItem(AUTH_REFRESH_TOKEN_KEY, 'old-rt')
    ;(global as any).fetch = jest.fn(async (url: string, init?: { method?: string; body?: string }) => {
      expect(String(url)).toBe(`${API_BASE}/api/auth/refresh`)
      expect(init?.method).toBe('POST')
      expect(JSON.parse(init?.body || '{}')).toEqual({ refreshToken: 'old-rt' })
      return {
        ok: true,
        json: async () => ({
          message: 'Token refreshed',
          session: { access_token: 'new-at', refresh_token: 'new-rt', expires_in: 3600, token_type: 'bearer' },
          user: USER,
        }),
      }
    })

    const res = await apiRefresh('old-rt')
    expect(res.session?.access_token).toBe('new-at')
    expect(res.user?.email).toBe('qa@tradvue.com')
    expect(localStorageMock.getItem(AUTH_TOKEN_KEY)).toBe('new-at')
    expect(localStorageMock.getItem(AUTH_REFRESH_TOKEN_KEY)).toBe('new-rt')
    expect(JSON.parse(localStorageMock.getItem(AUTH_USER_KEY) || '{}').email).toBe('qa@tradvue.com')
  })

  test('does not persist on an expired refresh token', async () => {
    localStorageMock.setItem(AUTH_TOKEN_KEY, 'stale')
    localStorageMock.setItem(AUTH_REFRESH_TOKEN_KEY, 'dead-rt')
    ;(global as any).fetch = jest.fn(async () => ({
      ok: false,
      json: async () => ({ error: 'Invalid or expired refresh token' }),
    }))

    const res = await apiRefresh('dead-rt')
    expect(res.session).toBeNull()
    expect(res.error).toMatch(/expired refresh token/i)
    expect(localStorageMock.getItem(AUTH_TOKEN_KEY)).toBe('stale')
    expect(localStorageMock.getItem(AUTH_REFRESH_TOKEN_KEY)).toBe('dead-rt')
  })
})

describe('apiGetMeResult', () => {
  test('classifies 403 as an auth failure', async () => {
    ;(global as any).fetch = jest.fn(async () => ({
      ok: false,
      status: 403,
      json: async () => ({ error: 'Invalid or expired token' }),
    }))
    await expect(apiGetMeResult('stale')).resolves.toEqual({ ok: false, reason: 'auth' })
  })

  test('classifies a network error separately from auth', async () => {
    ;(global as any).fetch = jest.fn(async () => { throw new TypeError('Failed to fetch') })
    await expect(apiGetMeResult('tok')).resolves.toEqual({ ok: false, reason: 'error' })
  })
})
