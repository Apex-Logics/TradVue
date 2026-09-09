'use strict';

/**
 * Watchlist quote batch + single-quote query form.
 *
 * Pins the 2026-09-09 prod incident: SPY/QQQ/DIA/IWM rendered as "—" because
 * unpriced stubs were cached and returned as quote objects.
 */

const request = require('supertest');
const express = require('express');

jest.mock('../services/cache', () => {
  const store = new Map();
  return {
    _store: store,
    get: jest.fn(async (key) => (store.has(key) ? store.get(key) : null)),
    set: jest.fn(async (key, value) => { store.set(key, value); }),
    del: jest.fn(async (key) => { store.delete(key); }),
    cacheAPICall: jest.fn(async (_k, fn) => fn()),
  };
});

jest.mock('../services/alpaca', () => {
  function AlpacaCtor() {}
  AlpacaCtor.isStockSymbol = jest.fn((s) => typeof s === 'string' && !String(s).includes(':'));
  const svc = {
    getBatchQuotes: jest.fn().mockResolvedValue({}),
    getQuote: jest.fn().mockResolvedValue(null),
  };
  Object.defineProperty(svc, 'constructor', { value: AlpacaCtor });
  return svc;
});

jest.mock('../services/finnhub', () => ({
  getQuote: jest.fn().mockResolvedValue(null),
}));

const cache = require('../services/cache');
const alpaca = require('../services/alpaca');
const finnhub = require('../services/finnhub');
const marketData = require('../routes/marketData');

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/market-data', marketData);
  return app;
}

function priced(sym, current = 500) {
  return {
    symbol: sym,
    current,
    change: 1.5,
    changePct: 0.3,
    high: current + 1,
    low: current - 1,
    open: current,
    prevClose: current - 1.5,
    timestamp: new Date().toISOString(),
    source: 'alpaca',
  };
}

const STUB = {
  symbol: 'SPY',
  current: null,
  change: null,
  changePct: null,
  source: 'unavailable',
};

beforeEach(() => {
  cache._store.clear();
  jest.clearAllMocks();
  alpaca.getBatchQuotes.mockResolvedValue({});
  alpaca.constructor.isStockSymbol.mockImplementation((s) => typeof s === 'string' && !String(s).includes(':'));
  finnhub.getQuote.mockResolvedValue(null);
});

describe('GET /api/market-data/batch quote shape', () => {
  test('returns Alpaca current/changePct for SPY,QQQ,DIA,IWM', async () => {
    alpaca.getBatchQuotes.mockResolvedValue({
      SPY: priced('SPY', 523.41),
      QQQ: priced('QQQ', 448.12),
      DIA: priced('DIA', 389.05),
      IWM: priced('IWM', 210.77),
    });

    const res = await request(buildApp()).get('/api/market-data/batch?symbols=SPY,QQQ,DIA,IWM');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.SPY).toMatchObject({ current: 523.41, changePct: 0.3, source: 'alpaca' });
    expect(res.body.data.QQQ.current).toBe(448.12);
    expect(res.body.data.DIA.current).toBe(389.05);
    expect(res.body.data.IWM.current).toBe(210.77);
  });

  test('cached unpriced stub is treated as a miss and replaced by Alpaca', async () => {
    cache._store.set('finnhub:quote:SPY', STUB);
    alpaca.getBatchQuotes.mockResolvedValue({ SPY: priced('SPY', 523.41) });

    const res = await request(buildApp()).get('/api/market-data/batch?symbols=SPY');

    expect(res.status).toBe(200);
    expect(res.body.data.SPY.current).toBe(523.41);
    expect(res.body.data.SPY.changePct).toBe(0.3);
    expect(alpaca.getBatchQuotes).toHaveBeenCalled();
    expect(cache.del).toHaveBeenCalledWith('finnhub:quote:SPY');
  });

  test('does not put unpriced stubs in data (FE would render green dashes)', async () => {
    alpaca.getBatchQuotes.mockResolvedValue({});
    finnhub.getQuote.mockResolvedValue(STUB);

    const res = await request(buildApp()).get('/api/market-data/batch?symbols=SPY');

    expect(res.status).toBe(200);
    expect(res.body.data.SPY).toBeUndefined();
    expect(res.body.data).toEqual({});
  });

  test('normalizes Finnhub raw { c, dp } cache hits to current/changePct', async () => {
    cache._store.set('finnhub:quote:AAPL', {
      symbol: 'AAPL',
      c: 150.25,
      d: 2.5,
      dp: 1.69,
      source: 'finnhub',
    });

    const res = await request(buildApp()).get('/api/market-data/batch?symbols=AAPL');

    expect(res.status).toBe(200);
    expect(res.body.data.AAPL).toMatchObject({ current: 150.25, change: 2.5, changePct: 1.69 });
    expect(alpaca.getBatchQuotes).not.toHaveBeenCalled();
  });
});

describe('GET /api/market-data/quote query vs path', () => {
  test('GET /quote?symbol=SPY returns the same priced payload as /quote/SPY', async () => {
    finnhub.getQuote.mockResolvedValue(priced('SPY', 523.41));

    const query = await request(buildApp()).get('/api/market-data/quote?symbol=SPY');
    const path = await request(buildApp()).get('/api/market-data/quote/SPY');

    expect(query.status).toBe(200);
    expect(path.status).toBe(200);
    expect(query.body.success).toBe(true);
    expect(query.body.data.current).toBe(523.41);
    expect(path.body.data.current).toBe(523.41);
  });

  test('GET /quote without a symbol is 400', async () => {
    const res = await request(buildApp()).get('/api/market-data/quote');
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});
