import { apiFetch, ApiError, clearApiFetchCache } from '../../app/lib/apiFetch'

const BATCH = 'http://localhost:3001/api/market-data/batch?symbols=SPY,QQQ'
const NEWS = 'http://localhost:3001/api/feed/news?limit=10'

function jsonOk(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }
}

describe('apiFetch live-quote caching', () => {
  const realNow = Date.now
  let now = 1_000_000

  beforeEach(() => {
    clearApiFetchCache()
    now = 1_000_000
    Date.now = () => now
    jest.spyOn(console, 'error').mockImplementation(() => {})
    jest.spyOn(console, 'info').mockImplementation(() => {})
    jest.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    Date.now = realNow
    jest.restoreAllMocks()
  })

  test('success path always hits the network and does not read through the 5-min map', async () => {
    const fetchMock = jest.fn()
      .mockResolvedValueOnce(jsonOk({ success: true, data: { SPY: { current: 500 } } }))
      .mockResolvedValueOnce(jsonOk({ success: true, data: { SPY: { current: 501 } } }))
    global.fetch = fetchMock as unknown as typeof fetch

    const a = await apiFetch<any>(BATCH)
    const b = await apiFetch<any>(BATCH)

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(a.data.SPY.current).toBe(500)
    expect(b.data.SPY.current).toBe(501)
    expect(fetchMock.mock.calls[0][1]).toEqual(expect.objectContaining({ cache: 'no-store' }))
    expect(fetchMock.mock.calls[1][1]).toEqual(expect.objectContaining({ cache: 'no-store' }))
  })

  test('caller cache option can override the no-store default', async () => {
    const fetchMock = jest.fn().mockResolvedValue(jsonOk({ ok: true }))
    global.fetch = fetchMock as unknown as typeof fetch
    await apiFetch(NEWS, { cache: 'force-cache' })
    expect(fetchMock.mock.calls[0][1]).toEqual(expect.objectContaining({ cache: 'force-cache' }))
  })

  test('304 returns the in-memory body instead of throwing', async () => {
    const fetchMock = jest.fn()
      .mockResolvedValueOnce(jsonOk({ success: true, data: { SPY: { current: 500 } } }))
      .mockResolvedValueOnce({ ok: false, status: 304, json: async () => { throw new Error('empty') } })
    global.fetch = fetchMock as unknown as typeof fetch

    await apiFetch(BATCH)
    const cached = await apiFetch<any>(BATCH)
    expect(cached.data.SPY.current).toBe(500)
  })

  test('network error serves market-data stale only within the 60s quote TTL', async () => {
    const fetchMock = jest.fn()
      .mockResolvedValueOnce(jsonOk({ success: true, data: { SPY: { current: 500 } } }))
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
    global.fetch = fetchMock as unknown as typeof fetch

    await apiFetch(BATCH)
    now += 10_000
    const stale = await apiFetch<any>(BATCH)
    expect(stale.data.SPY.current).toBe(500)

    now += 51_000
    await expect(apiFetch(BATCH)).rejects.toBeInstanceOf(ApiError)
  })

  test('non-quote endpoints still allow 5-min stale fallback', async () => {
    const fetchMock = jest.fn()
      .mockResolvedValueOnce(jsonOk({ articles: [1] }))
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
    global.fetch = fetchMock as unknown as typeof fetch

    await apiFetch(NEWS)
    now += 61_000
    const stale = await apiFetch<any>(NEWS)
    expect(stale.articles).toEqual([1])
  })
})
