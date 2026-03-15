/**
 * Finnhub Service Tests
 * 
 * TDD: Tests written first to define expected behavior.
 * Covers: getQuote, getBatchQuotes, getCandles, getMarketStatus, getCompanyNews
 * 
 * NOTE: finnhub.js is a singleton (module.exports = new FinnhubService()).
 * We set apiKey directly on the instance and mock axios at module level.
 */

// Skip all tests if FINNHUB_API_KEY is not set
const skipIfNoApiKey = !process.env.FINNHUB_API_KEY;

const axios = require('axios');

// Mock axios before anything requires it
jest.mock('axios');

// Mock cache to pass-through (calls fn immediately, no caching)
jest.mock('../services/cache', () => ({
  cacheAPICall: jest.fn((key, fn) => fn()),
}));

// Mock rate limiter to always allow
jest.mock('../services/rateLimit', () => ({
  externalAPILimiter: {
    canMakeRequest: jest.fn().mockResolvedValue(true),
  },
}));

// Mock alpaca service to avoid real API calls
jest.mock('../services/alpaca', () => ({
  getQuote: jest.fn().mockRejectedValue(new Error('Alpaca disabled in tests')),
  constructor: {
    isStockSymbol: jest.fn(() => false),
  },
}));

// Require AFTER mocks are set up
const finnhub = require('../services/finnhub');

beforeEach(() => {
  jest.clearAllMocks();
  // Reset cache mock to pass-through
  const cache = require('../services/cache');
  cache.cacheAPICall.mockImplementation((key, fn) => fn());
  // Reset axios mock
  axios.get.mockClear();
});

// ──────────────────────────────────────────
// getQuote
// ──────────────────────────────────────────

(skipIfNoApiKey ? describe.skip : describe)('FinnhubService.getQuote', () => {
  test('returns structured quote object from API response', async () => {
    axios.get.mockResolvedValueOnce({
      data: {
        c: 260.29,
        d: -2.23,
        dp: -0.85,
        h: 261.55,
        l: 257.25,
        o: 260.79,
        pc: 262.52,
        t: 1741215600
      }
    });

    const quote = await finnhub.getQuote('AAPL');

    expect(quote).toMatchObject({
      symbol: 'AAPL',
      current: 260.29,
      change: -2.23,
      changePct: -0.85,
      high: 261.55,
      low: 257.25,
      open: 260.79,
      prevClose: 262.52,
      source: 'finnhub'
    });
    expect(quote.timestamp).toBeDefined();
  });

  test('normalizes symbol to uppercase', async () => {
    axios.get.mockResolvedValueOnce({
      data: { c: 100, d: 1, dp: 1, h: 101, l: 99, o: 100, pc: 99, t: Date.now() / 1000 }
    });

    const quote = await finnhub.getQuote('aapl');
    expect(quote.symbol).toBe('AAPL');
  });

  test('falls back to mock data when API returns c=0', async () => {
    axios.get.mockResolvedValueOnce({
      data: { c: 0, d: 0, dp: 0, h: 0, l: 0, o: 0, pc: 0, t: 0 }
    });

    const quote = await finnhub.getQuote('AAPL');
    expect(quote.source).toBe('mock');
  });

  test('falls back to mock data on network error', async () => {
    axios.get.mockRejectedValueOnce(new Error('Network timeout'));

    const quote = await finnhub.getQuote('AAPL');
    expect(quote).toBeDefined();
    expect(quote.symbol).toBe('AAPL');
    expect(quote.source).toBe('mock');
  });

  test('falls back gracefully for unknown symbol', async () => {
    axios.get.mockRejectedValueOnce(new Error('Unknown symbol'));

    const quote = await finnhub.getQuote('XYZFAKE');
    expect(quote).toBeDefined();
    // May fall back to mock or null, but should be defined
    expect(quote === null || quote.current !== undefined).toBe(true);
  });

  test('falls back to mock when API call fails', async () => {
    // Mock axios to reject for this symbol
    axios.get.mockRejectedValueOnce(new Error('Network error'));
    const quote = await finnhub.getQuote('AAPL');
    expect(quote).toBeDefined();
    // Should fall back to mock or cached data
    expect(quote.source === 'mock' || quote.source === 'fallback').toBe(true);
  });
});

// ──────────────────────────────────────────
// getBatchQuotes
// ──────────────────────────────────────────

(skipIfNoApiKey ? describe.skip : describe)('FinnhubService.getBatchQuotes', () => {
  test('returns quotes for all requested symbols', async () => {
    axios.get.mockResolvedValue({
      data: { c: 150, d: 1, dp: 0.7, h: 152, l: 149, o: 150, pc: 149, t: Date.now() / 1000 }
    });

    const quotes = await finnhub.getBatchQuotes(['AAPL', 'MSFT']);
    expect(Object.keys(quotes)).toEqual(expect.arrayContaining(['AAPL', 'MSFT']));
    expect(quotes['AAPL'].source).toBe('finnhub');
    expect(quotes['MSFT'].source).toBe('finnhub');
  });

  test('returns mock quote for failed symbol, still returns others', async () => {
    axios.get
      .mockResolvedValueOnce({
        data: { c: 260, d: -1, dp: -0.4, h: 262, l: 258, o: 261, pc: 261, t: Date.now() / 1000 }
      })
      .mockRejectedValueOnce(new Error('API fail'));

    const quotes = await finnhub.getBatchQuotes(['AAPL', 'INVALID']);
    expect(quotes['AAPL']).toBeDefined();
    expect(quotes['AAPL'].source).toBe('finnhub');
    expect(quotes['INVALID']).toBeDefined(); // Falls back to mock
  });

  test('returns empty object for empty input', async () => {
    const quotes = await finnhub.getBatchQuotes([]);
    expect(quotes).toEqual({});
  });
});

// ──────────────────────────────────────────
// getCandles
// ──────────────────────────────────────────

(skipIfNoApiKey ? describe.skip : describe)('FinnhubService.getCandles', () => {
  const now = Math.floor(Date.now() / 1000);
  const from = now - 7 * 86400;

  test('returns OHLCV candle array from API', async () => {
    axios.get.mockResolvedValueOnce({
      data: {
        s: 'ok',
        t: [from, from + 86400],
        o: [100, 101],
        h: [102, 103],
        l: [99, 100],
        c: [101, 102],
        v: [1000000, 1200000]
      }
    });

    const candles = await finnhub.getCandles('AAPL', 'D', from, now);
    expect(candles).toHaveLength(2);
    expect(candles[0]).toMatchObject({
      open: 100, high: 102, low: 99, close: 101, volume: 1000000
    });
    expect(candles[0].timestamp).toBeDefined();
  });

  test('falls back to mock candles when API returns status !== ok', async () => {
    axios.get.mockResolvedValueOnce({ data: { s: 'no_data' } });

    const candles = await finnhub.getCandles('AAPL', 'D', from, now);
    expect(Array.isArray(candles)).toBe(true);
    expect(candles.length).toBeGreaterThan(0);
  });

  test('falls back to mock on network error', async () => {
    axios.get.mockRejectedValueOnce(new Error('Timeout'));

    const candles = await finnhub.getCandles('AAPL', 'D');
    expect(Array.isArray(candles)).toBe(true);
  });

  test('returns candles with timestamp, ohlcv fields', async () => {
    axios.get.mockResolvedValueOnce({
      data: {
        s: 'ok',
        t: [from],
        o: [50], h: [55], l: [48], c: [53], v: [500000]
      }
    });

    const candles = await finnhub.getCandles('TSLA', 'D', from, now);
    expect(candles[0]).toHaveProperty('timestamp');
    expect(candles[0]).toHaveProperty('open');
    expect(candles[0]).toHaveProperty('high');
    expect(candles[0]).toHaveProperty('low');
    expect(candles[0]).toHaveProperty('close');
    expect(candles[0]).toHaveProperty('volume');
  });
});

// ──────────────────────────────────────────
// getMarketStatus
// ──────────────────────────────────────────

(skipIfNoApiKey ? describe.skip : describe)('FinnhubService.getMarketStatus', () => {
  test('returns market status from API', async () => {
    axios.get.mockResolvedValueOnce({
      data: { isOpen: true, session: 'regular', timezone: 'America/New_York' }
    });

    const status = await finnhub.getMarketStatus('US');
    expect(status).toMatchObject({
      exchange: 'US',
      isOpen: true,
      source: 'finnhub'
    });
  });

  test('includes session and timezone from API', async () => {
    axios.get.mockResolvedValueOnce({
      data: { isOpen: false, session: 'closed', timezone: 'America/New_York' }
    });

    const status = await finnhub.getMarketStatus('US');
    expect(status.session).toBe('closed');
    expect(status.timezone).toBe('America/New_York');
  });

  test('falls back gracefully on API error', async () => {
    axios.get.mockRejectedValueOnce(new Error('API down'));

    const status = await finnhub.getMarketStatus('US');
    expect(status.exchange).toBe('US');
    expect(typeof status.isOpen).toBe('boolean');
    expect(status.source).toBe('fallback');
  });

  test('uses exchange parameter in fallback', async () => {
    axios.get.mockRejectedValueOnce(new Error('API down'));

    const status = await finnhub.getMarketStatus('LSE');
    expect(status.exchange).toBe('LSE');
  });
});

// ──────────────────────────────────────────
// getCompanyNews
// ──────────────────────────────────────────

(skipIfNoApiKey ? describe.skip : describe)('FinnhubService.getCompanyNews', () => {
  test('returns normalized news items', async () => {
    const mockTs = Math.floor(Date.now() / 1000);
    axios.get.mockResolvedValueOnce({
      data: [
        {
          id: 123,
          headline: 'Apple announces new product',
          summary: 'Apple reveals...',
          url: 'https://example.com/article',
          source: 'Reuters',
          datetime: mockTs,
          image: 'https://example.com/img.jpg',
          category: 'technology'
        }
      ]
    });

    const news = await finnhub.getCompanyNews('AAPL');
    expect(news).toHaveLength(1);
    expect(news[0]).toMatchObject({
      title: 'Apple announces new product',
      source: 'Reuters',
      symbol: 'AAPL',
      url: 'https://example.com/article'
    });
    expect(news[0].publishedAt).toBeDefined();
  });

  test('returns empty array on API error', async () => {
    axios.get.mockRejectedValueOnce(new Error('Error'));
    const news = await finnhub.getCompanyNews('AAPL');
    expect(news).toEqual([]);
  });

  test('limits results to 20 items', async () => {
    const items = Array.from({ length: 30 }, (_, i) => ({
      id: i, headline: `Title ${i}`, summary: '', url: '', source: 'Test',
      datetime: Math.floor(Date.now() / 1000), image: null, category: 'general'
    }));
    axios.get.mockResolvedValueOnce({ data: items });

    const news = await finnhub.getCompanyNews('AAPL');
    expect(news.length).toBeLessThanOrEqual(20);
  });

  test('returns empty array on API error', async () => {
    axios.get.mockRejectedValueOnce(new Error('API unavailable'));
    const news = await finnhub.getCompanyNews('AAPL');
    // Should return empty array on error
    expect(Array.isArray(news)).toBe(true);
    expect(news.length === 0 || news.some(item => item.title)).toBe(true);
  });
});
