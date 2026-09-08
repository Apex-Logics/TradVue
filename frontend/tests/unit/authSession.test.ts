import { fetchWithSessionRetry, refreshStoredSession } from '../../app/lib/authSession'
import { AUTH_REFRESH_TOKEN_KEY, AUTH_TOKEN_KEY, persistStoredAuth } from '../../app/utils/storageKeys'

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

describe('fetchWithSessionRetry', () => {
  beforeEach(() => {
    localStorageMock.clear()
    jest.clearAllMocks()
  })

  test('retries once after refresh on 403, then succeeds', async () => {
    persistStoredAuth('stale', USER, 'rt')
    const calls: { url: string; auth: string | null }[] = []
    ;(global as any).fetch = jest.fn(async (url: string, init?: { method?: string; headers?: HeadersInit; body?: string }) => {
      const headers = init?.headers instanceof Headers
        ? init.headers
        : new Headers(init?.headers as HeadersInit)
      const auth = headers.get('Authorization')
      calls.push({ url: String(url), auth })
      if (String(url).includes('/api/auth/refresh')) {
        return {
          ok: true,
          json: async () => ({
            session: { access_token: 'fresh', refresh_token: 'rt2', expires_in: 3600, token_type: 'bearer' },
            user: USER,
          }),
        }
      }
      if (auth === 'Bearer stale') {
        return { ok: false, status: 403, json: async () => ({ error: 'Invalid or expired token' }) }
      }
      return { ok: true, status: 200, json: async () => ({ events: [] }) }
    })

    const res = await fetchWithSessionRetry('https://api.test/api/webhooks/events', {
      headers: { Authorization: 'Bearer stale' },
    })
    expect(res.ok).toBe(true)
    expect(calls.filter(c => c.url.includes('/api/auth/refresh'))).toHaveLength(1)
    expect(calls.filter(c => c.url.includes('/api/webhooks/events')).map(c => c.auth)).toEqual([
      'Bearer stale',
      'Bearer fresh',
    ])
    expect(localStorageMock.getItem(AUTH_TOKEN_KEY)).toBe('fresh')
  })

  test('clears the session when refresh is impossible', async () => {
    localStorageMock.setItem(AUTH_TOKEN_KEY, 'stale')
    localStorageMock.setItem(AUTH_REFRESH_TOKEN_KEY, 'dead')
    ;(global as any).fetch = jest.fn(async (url: string) => {
      if (String(url).includes('/api/auth/refresh')) {
        return { ok: false, status: 401, json: async () => ({ error: 'Invalid or expired refresh token' }) }
      }
      return { ok: false, status: 403, json: async () => ({ error: 'Invalid or expired token' }) }
    })

    const res = await fetchWithSessionRetry('https://api.test/api/user/data/journal', {
      headers: { Authorization: 'Bearer stale' },
    })
    expect(res.status).toBe(403)
    expect(localStorageMock.getItem(AUTH_TOKEN_KEY)).toBeNull()
    expect(localStorageMock.getItem(AUTH_REFRESH_TOKEN_KEY)).toBeNull()
  })

  test('coalesces concurrent refresh attempts into one POST', async () => {
    persistStoredAuth('stale', USER, 'rt')
    let refreshCalls = 0
    let releaseRefresh = () => {}
    const refreshGate = new Promise<void>(resolve => { releaseRefresh = resolve })
    ;(global as any).fetch = jest.fn(async (url: string, init?: { headers?: HeadersInit }) => {
      if (String(url).includes('/api/auth/refresh')) {
        refreshCalls += 1
        await refreshGate
        return {
          ok: true,
          json: async () => ({
            session: { access_token: 'fresh', refresh_token: 'rt2', expires_in: 3600, token_type: 'bearer' },
            user: USER,
          }),
        }
      }
      const headers = new Headers(init?.headers as HeadersInit)
      if (headers.get('Authorization') === 'Bearer stale') {
        return { ok: false, status: 403, json: async () => ({ error: 'Invalid or expired token' }) }
      }
      return { ok: true, json: async () => ({ events: [] }) }
    })

    const a = fetchWithSessionRetry('https://api.test/events', { headers: { Authorization: 'Bearer stale' } })
    const b = fetchWithSessionRetry('https://api.test/journal', { headers: { Authorization: 'Bearer stale' } })
    await Promise.resolve()
    await Promise.resolve()
    expect(refreshCalls).toBe(1)
    releaseRefresh()
    const [resA, resB] = await Promise.all([a, b])
    expect(resA.ok).toBe(true)
    expect(resB.ok).toBe(true)
    expect(refreshCalls).toBe(1)
  })
})

describe('refreshStoredSession', () => {
  beforeEach(() => {
    localStorageMock.clear()
  })

  test('returns null without calling the API when no refresh token is stored', async () => {
    ;(global as any).fetch = jest.fn()
    await expect(refreshStoredSession()).resolves.toBeNull()
    expect((global as any).fetch).not.toHaveBeenCalled()
  })
})
