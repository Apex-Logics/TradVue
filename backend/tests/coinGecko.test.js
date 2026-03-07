/**
 * CoinGecko Service & Crypto Routes Tests
 *
 * TDD: Tests written first, then implementation validated.
 * Mocks axios (create-instance pattern) to avoid live network calls.
 *
 * Covers:
 *   - CoinGeckoService normalization & fallback
 *   - GET /api/crypto/prices
 *   - GET /api/crypto/prices/:symbol
 *   - GET /api/crypto/trending
 *   - GET /api/crypto/snapshot
 *   - GET /api/crypto/batch
 */

const request = require('supertest');
const express = require('express');

// ── Mock cache to pass-through (must come before any requires) ────────────────
jest.mock('../services/cache', () => ({
  cacheAPICall: jest.fn(async (_key, fn) => fn()),
}));

// ── We mock the coinGecko SERVICE directly for route tests ────────────────────
// This avoids axios.create() isolation headaches.
jest.mock('../services/coinGecko');

const coinGecko = require('../services/coinGecko');
const cryptoRouter = require('../routes/crypto');

const app = express();
app.use(express.json());
app.use('/api/crypto', cryptoRouter);

// ── Fixtures ──────────────────────────────────────────────────────────────────
const MOCK_TOP_COINS = [
  {
    id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin', image: null,
    price: 67420.5, marketCap: 1320000000000, marketCapRank: 1,
    volume24h: 28500000000, change1h: 0.12, change24h: -1.23, change7d: 3.45,
    high24h: 68000, low24h: 66800, ath: 69000, athDate: '2021-11-10T00:00:00.000Z',
    circulatingSupply: 19600000, lastUpdated: new Date().toISOString(),
  },
  {
    id: 'ethereum', symbol: 'ETH', name: 'Ethereum', image: null,
    price: 3512.8, marketCap: 422000000000, marketCapRank: 2,
    volume24h: 15200000000, change1h: 0.05, change24h: 2.14, change7d: 5.67,
    high24h: 3580, low24h: 3450, ath: 4878, athDate: '2021-11-10T00:00:00.000Z',
    circulatingSupply: 120000000, lastUpdated: new Date().toISOString(),
  },
];

const MOCK_PRICES = {
  BTC: { price: 67420.5, change24h: -1.23, volume24h: 28500000000, marketCap: 1320000000000 },
  ETH: { price: 3512.8,  change24h: 2.14,  volume24h: 15200000000, marketCap: 422000000000 },
};

const MOCK_TRENDING = [
  { id: 'solana',   symbol: 'SOL',  name: 'Solana',   rank: 5, thumb: null, score: 0 },
  { id: 'dogecoin', symbol: 'DOGE', name: 'Dogecoin', rank: 8, thumb: null, score: 1 },
];

const MOCK_SNAPSHOT = {
  topCoins: MOCK_TOP_COINS,
  trending: MOCK_TRENDING,
  source: 'CoinGecko',
  attribution: 'Powered by CoinGecko',
  timestamp: new Date().toISOString(),
};

beforeEach(() => {
  jest.clearAllMocks();

  // Default mock implementations
  coinGecko.getTopCoins.mockResolvedValue(MOCK_TOP_COINS);
  coinGecko.getPrices.mockResolvedValue(MOCK_PRICES);
  coinGecko.getTrending.mockResolvedValue(MOCK_TRENDING);
  coinGecko.getCryptoSnapshot.mockResolvedValue(MOCK_SNAPSHOT);
  coinGecko.getPriceHistory.mockResolvedValue({
    symbol: 'BTC', currency: 'usd', days: 7,
    prices: [
      { timestamp: new Date(Date.now() - 86400000).toISOString(), price: 65000 },
      { timestamp: new Date().toISOString(), price: 67420.5 },
    ],
  });
});

// ── GET /api/crypto/prices ────────────────────────────────────────────────────
describe('GET /api/crypto/prices', () => {
  test('returns list of top coins', async () => {
    const res = await request(app).get('/api/crypto/prices');

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.count).toBe(2);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.attribution).toContain('CoinGecko');
    expect(res.body.timestamp).toBeDefined();
  });

  test('returns normalized coin schema', async () => {
    const res = await request(app).get('/api/crypto/prices');

    const coin = res.body.data[0];
    expect(coin.symbol).toBe('BTC');
    expect(coin.price).toBe(67420.5);
    expect(coin).toHaveProperty('change24h');
    expect(coin).toHaveProperty('marketCap');
  });

  test('caps limit at 50 and forwards to service', async () => {
    await request(app).get('/api/crypto/prices?limit=999');
    expect(coinGecko.getTopCoins).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 50 })
    );
  });

  test('passes currency param to service', async () => {
    await request(app).get('/api/crypto/prices?currency=eur');
    expect(coinGecko.getTopCoins).toHaveBeenCalledWith(
      expect.objectContaining({ currency: 'eur' })
    );
  });

  test('returns 500 on service failure', async () => {
    coinGecko.getTopCoins.mockRejectedValueOnce(new Error('CoinGecko down'));
    const res = await request(app).get('/api/crypto/prices');
    expect(res.statusCode).toBe(500);
    expect(res.body.success).toBe(false);
  });
});

// ── GET /api/crypto/prices/:symbol ───────────────────────────────────────────
describe('GET /api/crypto/prices/:symbol', () => {
  test('returns price for known symbol BTC', async () => {
    const res = await request(app).get('/api/crypto/prices/BTC');

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.symbol).toBe('BTC');
    expect(res.body.data).toHaveProperty('price');
    expect(res.body.data).toHaveProperty('change24h');
    expect(res.body.data.price).toBe(67420.5);
  });

  test('returns price for ETH', async () => {
    const res = await request(app).get('/api/crypto/prices/ETH');
    expect(res.statusCode).toBe(200);
    expect(res.body.symbol).toBe('ETH');
    expect(res.body.data.price).toBe(3512.8);
  });

  test('returns 404 for unknown symbol', async () => {
    coinGecko.getPrices.mockResolvedValueOnce({}); // No matching symbol
    const res = await request(app).get('/api/crypto/prices/FAKECOIN');

    expect(res.statusCode).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain('FAKECOIN');
  });

  test('returns 500 on service failure', async () => {
    coinGecko.getPrices.mockRejectedValueOnce(new Error('API error'));
    const res = await request(app).get('/api/crypto/prices/BTC');
    expect(res.statusCode).toBe(500);
    expect(res.body.success).toBe(false);
  });
});

// ── GET /api/crypto/trending ──────────────────────────────────────────────────
describe('GET /api/crypto/trending', () => {
  test('returns trending coins list', async () => {
    const res = await request(app).get('/api/crypto/trending');

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBe(2);
    expect(res.body.data[0]).toHaveProperty('symbol');
    expect(res.body.data[0]).toHaveProperty('name');
    expect(res.body.data[0]).toHaveProperty('rank');
  });

  test('all symbols are uppercase', async () => {
    const res = await request(app).get('/api/crypto/trending');
    res.body.data.forEach(coin => {
      expect(coin.symbol).toBe(coin.symbol.toUpperCase());
    });
  });

  test('returns empty array when trending returns nothing', async () => {
    coinGecko.getTrending.mockResolvedValueOnce([]);
    const res = await request(app).get('/api/crypto/trending');

    expect(res.statusCode).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  test('returns 500 on service failure', async () => {
    coinGecko.getTrending.mockRejectedValueOnce(new Error('trending error'));
    const res = await request(app).get('/api/crypto/trending');
    expect(res.statusCode).toBe(500);
    expect(res.body.success).toBe(false);
  });
});

// ── GET /api/crypto/snapshot ──────────────────────────────────────────────────
describe('GET /api/crypto/snapshot', () => {
  test('returns combined snapshot with topCoins and trending', async () => {
    const res = await request(app).get('/api/crypto/snapshot');

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.topCoins)).toBe(true);
    expect(Array.isArray(res.body.trending)).toBe(true);
    expect(res.body.attribution).toContain('CoinGecko');
    expect(res.body.timestamp).toBeDefined();
  });

  test('passes limit to service', async () => {
    await request(app).get('/api/crypto/snapshot?limit=5');
    expect(coinGecko.getCryptoSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 5 })
    );
  });

  test('caps limit at 50', async () => {
    await request(app).get('/api/crypto/snapshot?limit=999');
    expect(coinGecko.getCryptoSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 50 })
    );
  });

  test('returns 500 on service failure', async () => {
    coinGecko.getCryptoSnapshot.mockRejectedValueOnce(new Error('snapshot error'));
    const res = await request(app).get('/api/crypto/snapshot');
    expect(res.statusCode).toBe(500);
    expect(res.body.success).toBe(false);
  });
});

// ── GET /api/crypto/batch ─────────────────────────────────────────────────────
describe('GET /api/crypto/batch', () => {
  test('returns prices for multiple symbols', async () => {
    const res = await request(app).get('/api/crypto/batch?symbols=BTC,ETH');

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('BTC');
    expect(res.body.data).toHaveProperty('ETH');
    expect(res.body.symbols).toContain('BTC');
    expect(res.body.symbols).toContain('ETH');
  });

  test('normalizes symbols to uppercase', async () => {
    await request(app).get('/api/crypto/batch?symbols=btc,eth');
    expect(coinGecko.getPrices).toHaveBeenCalledWith(
      expect.arrayContaining(['BTC', 'ETH']),
      expect.any(String)
    );
  });

  test('caps at 20 symbols', async () => {
    const manySymbols = Array.from({ length: 30 }, (_, i) => `COIN${i}`).join(',');
    coinGecko.getPrices.mockResolvedValueOnce({});

    const res = await request(app).get(`/api/crypto/batch?symbols=${manySymbols}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.symbols.length).toBeLessThanOrEqual(20);
  });

  test('passes currency to service', async () => {
    await request(app).get('/api/crypto/batch?symbols=BTC&currency=eur');
    expect(coinGecko.getPrices).toHaveBeenCalledWith(
      expect.any(Array),
      'eur'
    );
  });

  test('returns 500 on service failure', async () => {
    coinGecko.getPrices.mockRejectedValueOnce(new Error('batch error'));
    const res = await request(app).get('/api/crypto/batch?symbols=BTC,ETH');
    expect(res.statusCode).toBe(500);
    expect(res.body.success).toBe(false);
  });
});

// ── CoinGeckoService unit tests (real service, mocked axios) ──────────────────
describe('CoinGeckoService unit tests', () => {
  let service;

  beforeAll(() => {
    // Restore real service module for unit tests
    jest.unmock('../services/coinGecko');
    jest.resetModules();

    // Mock axios with a controlled httpClient
    jest.doMock('axios', () => {
      const mockGet = jest.fn();
      const mockAxios = {
        create: jest.fn(() => ({
          get: mockGet,
          interceptors: { response: { use: jest.fn() } },
        })),
        get: mockGet,
      };
      return mockAxios;
    });

    jest.doMock('../services/cache', () => ({
      cacheAPICall: jest.fn(async (_key, fn) => fn()),
    }));

    service = require('../services/coinGecko');
  });

  afterAll(() => {
    jest.resetModules();
  });

  test('getTopCoins returns mock fallback when API fails', async () => {
    // No mock setup → service's httpClient.get will throw
    const coins = await service.getTopCoins({ limit: 5 });
    expect(Array.isArray(coins)).toBe(true);
    expect(coins.length).toBeGreaterThan(0);
    expect(coins[0]).toHaveProperty('symbol');
    expect(coins[0]).toHaveProperty('price');
  });

  test('mock fallback coins have all required fields', async () => {
    const coins = await service._getMockPrices(3);
    const required = ['id', 'symbol', 'name', 'price', 'marketCap', 'change24h', 'volume24h'];
    coins.forEach(coin => {
      required.forEach(field => {
        expect(coin).toHaveProperty(field);
      });
    });
  });

  test('_normalizeCoin maps CoinGecko schema to our schema', async () => {
    const raw = {
      id: 'bitcoin',
      symbol: 'btc',
      name: 'Bitcoin',
      image: 'https://coingecko.com/btc.png',
      current_price: 67420.5,
      market_cap: 1320000000000,
      market_cap_rank: 1,
      total_volume: 28500000000,
      high_24h: 68000,
      low_24h: 66800,
      price_change_percentage_1h_in_currency: 0.12,
      price_change_percentage_24h: -1.23,
      price_change_percentage_7d_in_currency: 3.45,
      ath: 69000,
      ath_date: '2021-11-10T00:00:00.000Z',
      circulating_supply: 19600000,
      last_updated: new Date().toISOString(),
    };

    const normalized = service._normalizeCoin(raw);

    expect(normalized.symbol).toBe('BTC'); // uppercase
    expect(normalized.price).toBe(67420.5);
    expect(normalized.change24h).toBe(-1.23);
    expect(normalized.marketCap).toBe(1320000000000);
    expect(normalized.id).toBe('bitcoin');
  });

  test('mock fallback limits correctly', async () => {
    const coins3 = await service._getMockPrices(3);
    const coins7 = await service._getMockPrices(7);
    expect(coins3.length).toBe(3);
    expect(coins7.length).toBe(7);
  });
});
