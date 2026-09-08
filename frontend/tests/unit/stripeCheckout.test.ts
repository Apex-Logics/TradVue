import {
  CHECKOUT_UNAVAILABLE_MESSAGE,
  createCheckoutSession,
  fetchStripePrices,
} from '../../app/lib/stripeCheckout'
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
  created_at: '2026-09-01T00:00:00.000Z',
  tier: 'free' as const,
}

const LIVE_PRICES = {
  available: true,
  monthly: { priceId: 'price_monthlyABC123', amount: 24, currency: 'usd', interval: 'month', label: 'Monthly' },
  annual: {
    priceId: 'price_annualXYZ456',
    amount: 201.6,
    amountPerMonth: 16.8,
    currency: 'usd',
    interval: 'year',
    label: 'Annual',
    savingsPercent: 30,
  },
}

describe('fetchStripePrices', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  test('returns live price IDs when Stripe is configured', async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => LIVE_PRICES,
    })) as unknown as typeof fetch

    const result = await fetchStripePrices()
    expect(result.available).toBe(true)
    if (result.available) {
      expect(result.prices.monthly.priceId).toBe('price_monthlyABC123')
      expect(result.prices.annual.priceId).toBe('price_annualXYZ456')
      expect(result.prices.monthly.amount).toBe(24)
      expect(result.prices.annual.amount).toBe(201.6)
    }
  })

  test('treats missing Stripe config as a disabled checkout, not a load failure', async () => {
    global.fetch = jest.fn(async () => ({
      ok: false,
      status: 503,
      json: async () => ({
        available: false,
        code: 'STRIPE_NOT_CONFIGURED',
        error: 'Checkout is unavailable',
      }),
    })) as unknown as typeof fetch

    const result = await fetchStripePrices()
    expect(result).toEqual({ available: false, message: CHECKOUT_UNAVAILABLE_MESSAGE })
    expect(result.available).toBe(false)
    if (!result.available) {
      expect(result.message).not.toMatch(/Failed to load pricing/i)
    }
  })

  test('treats a 500 prices payload without monthly/annual as unavailable', async () => {
    global.fetch = jest.fn(async () => ({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Failed to fetch prices', details: 'STRIPE_SECRET_KEY is not set' }),
    })) as unknown as typeof fetch

    const result = await fetchStripePrices()
    expect(result.available).toBe(false)
    if (!result.available) {
      expect(result.message).toBe(CHECKOUT_UNAVAILABLE_MESSAGE)
    }
  })
})

describe('createCheckoutSession', () => {
  beforeEach(() => {
    localStorageMock.clear()
    persistStoredAuth('stale', USER, 'rt')
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  test('retries once on stale JWT then returns the Stripe URL', async () => {
    const calls: { url: string; auth: string | null }[] = []
    global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
      const headers = init?.headers instanceof Headers
        ? init.headers
        : new Headers(init?.headers as HeadersInit)
      const auth = headers.get('Authorization')
      calls.push({ url: String(url), auth })
      if (String(url).includes('/api/auth/refresh')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            session: { access_token: 'fresh', refresh_token: 'rt2', expires_in: 3600, token_type: 'bearer' },
            user: USER,
          }),
        }
      }
      if (auth === 'Bearer stale') {
        return { ok: false, status: 401, json: async () => ({ error: 'Authentication required' }) }
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ url: 'https://checkout.stripe.com/c/pay/cs_test', sessionId: 'cs_test' }),
      }
    }) as unknown as typeof fetch

    const result = await createCheckoutSession({ token: 'stale', priceId: 'price_monthlyABC123' })
    expect(result.url).toBe('https://checkout.stripe.com/c/pay/cs_test')
    expect(calls.filter(c => c.url.includes('/api/auth/refresh'))).toHaveLength(1)
    expect(localStorageMock.getItem(AUTH_TOKEN_KEY)).toBe('fresh')
    expect(localStorageMock.getItem(AUTH_REFRESH_TOKEN_KEY)).toBe('rt2')
  })

  test('maps Stripe-not-configured to the disabled-checkout message', async () => {
    global.fetch = jest.fn(async () => ({
      ok: false,
      status: 503,
      json: async () => ({ available: false, code: 'STRIPE_NOT_CONFIGURED', error: 'Checkout is unavailable' }),
    })) as unknown as typeof fetch

    await expect(createCheckoutSession({ token: 'fresh', priceId: 'price_monthlyABC123' }))
      .rejects.toThrow(CHECKOUT_UNAVAILABLE_MESSAGE)
  })
})
