/**
 * Watchlist Routes Tests
 *
 * TDD: Tests written first to define expected behavior.
 * Covers: GET, POST, PUT /:id/alerts, DELETE /:id, GET /performance
 *
 * Mocks: db, finnhub, auth middleware
 */

const request = require('supertest');
const express = require('express');

// ── Mocks ────────────────────────────────────────────────────────────────────
jest.mock('../services/db', () => ({ query: jest.fn() }));
jest.mock('../services/finnhub', () => ({
  getQuote: jest.fn(),
  getBatchQuotes: jest.fn(),
}));

// Bypass JWT auth: inject req.user
jest.mock('../routes/auth', () => ({
  authenticateToken: (req, _res, next) => {
    req.user = { userId: 'user-uuid-1', subscription_tier: 'free' };
    next();
  },
}));

const db = require('../services/db');
const finnhub = require('../services/finnhub');
const watchlistRouter = require('../routes/watchlist');

// Minimal express app
const app = express();
app.use(express.json());
app.use('/api/watchlist', watchlistRouter);

afterEach(() => jest.clearAllMocks());

// ── Fixtures ─────────────────────────────────────────────────────────────────
const MOCK_ROW = {
  id: 1,
  symbol: 'AAPL',
  name: 'Apple Inc.',
  type: 'stock',
  exchange: 'NASDAQ',
  alert_threshold_up: null,
  alert_threshold_down: null,
  notes: null,
  purchase_price: null,
  created_at: new Date().toISOString(),
};

const MOCK_QUOTE = {
  current: 178.5,
  change: 1.2,
  changePct: 0.68,
  source: 'finnhub',
};

// ── GET /api/watchlist ────────────────────────────────────────────────────────
describe('GET /api/watchlist', () => {
  test('returns empty watchlist when user has no items', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app).get('/api/watchlist');

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ watchlist: [], total_items: 0 });
  });

  test('returns enriched watchlist items with live quotes', async () => {
    db.query.mockResolvedValueOnce({ rows: [MOCK_ROW] });
    finnhub.getBatchQuotes.mockResolvedValueOnce({ AAPL: MOCK_QUOTE });

    const res = await request(app).get('/api/watchlist');

    expect(res.statusCode).toBe(200);
    expect(res.body.total_items).toBe(1);
    const item = res.body.watchlist[0];
    expect(item.symbol).toBe('AAPL');
    expect(item.current_price).toBe(178.5);
    expect(item.change).toBe(1.2);
    expect(item.quote_source).toBe('finnhub');
  });

  test('returns 500 when db query fails', async () => {
    db.query.mockRejectedValueOnce(new Error('DB down'));

    const res = await request(app).get('/api/watchlist');

    expect(res.statusCode).toBe(500);
    expect(res.body).toHaveProperty('error');
  });
});

// ── POST /api/watchlist ───────────────────────────────────────────────────────
describe('POST /api/watchlist', () => {
  test('adds a valid instrument to the watchlist', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ id: 10, symbol: 'AAPL', name: 'Apple Inc.', type: 'stock', exchange: 'NASDAQ' }] }) // instrument lookup
      .mockResolvedValueOnce({ rows: [] })                              // duplicate check
      .mockResolvedValueOnce({ rows: [{ count: '2' }] })               // free tier count
      .mockResolvedValueOnce({ rows: [{ id: 42, alert_threshold_up: null, alert_threshold_down: null, notes: null, purchase_price: null, created_at: new Date().toISOString() }] }); // INSERT

    finnhub.getQuote.mockResolvedValueOnce(MOCK_QUOTE);

    const res = await request(app)
      .post('/api/watchlist')
      .send({ symbol: 'AAPL' });

    expect(res.statusCode).toBe(201);
    expect(res.body.message).toBe('Added to watchlist');
    expect(res.body.item.symbol).toBe('AAPL');
    expect(res.body.item.current_price).toBe(178.5);
  });

  test('returns 400 when symbol is missing', async () => {
    const res = await request(app).post('/api/watchlist').send({});
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/symbol/i);
  });

  test('returns 404 when symbol not found in instruments table', async () => {
    db.query.mockResolvedValueOnce({ rows: [] }); // no instrument

    const res = await request(app).post('/api/watchlist').send({ symbol: 'UNKN' });

    expect(res.statusCode).toBe(404);
    expect(res.body.error).toMatch(/not found/i);
  });

  test('returns 409 when instrument is already in watchlist', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ id: 10, symbol: 'AAPL', name: 'Apple Inc.', type: 'stock', exchange: 'NASDAQ' }] }) // instrument
      .mockResolvedValueOnce({ rows: [{ id: 1 }] }); // existing entry

    const res = await request(app).post('/api/watchlist').send({ symbol: 'AAPL' });

    expect(res.statusCode).toBe(409);
    expect(res.body.error).toMatch(/already/i);
  });

  test('returns 403 when free tier limit (10 items) is reached', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ id: 10, symbol: 'AAPL', name: 'Apple Inc.', type: 'stock', exchange: 'NASDAQ' }] }) // instrument
      .mockResolvedValueOnce({ rows: [] })              // not duplicate
      .mockResolvedValueOnce({ rows: [{ count: '10' }] }); // at limit

    const res = await request(app).post('/api/watchlist').send({ symbol: 'AAPL' });

    expect(res.statusCode).toBe(403);
    expect(res.body.error).toMatch(/free tier/i);
  });
});

// ── PUT /api/watchlist/:id/alerts ─────────────────────────────────────────────
describe('PUT /api/watchlist/:id/alerts', () => {
  test('updates alert thresholds for owned watchlist item', async () => {
    db.query.mockResolvedValueOnce({
      rows: [{ id: 1, alert_threshold_up: 200, alert_threshold_down: 150 }],
    });

    const res = await request(app)
      .put('/api/watchlist/1/alerts')
      .send({ alert_threshold_up: 200, alert_threshold_down: 150 });

    expect(res.statusCode).toBe(200);
    expect(res.body.message).toMatch(/updated/i);
  });

  test('returns 404 when item not found or not owned', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .put('/api/watchlist/999/alerts')
      .send({ alert_threshold_up: 200 });

    expect(res.statusCode).toBe(404);
  });
});

// ── DELETE /api/watchlist/:id ─────────────────────────────────────────────────
describe('DELETE /api/watchlist/:id', () => {
  test('removes watchlist item and returns removed id', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

    const res = await request(app).delete('/api/watchlist/1');

    expect(res.statusCode).toBe(200);
    expect(res.body.removed_id).toBe(1);
  });

  test('returns 404 when item not found or not owned', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app).delete('/api/watchlist/999');

    expect(res.statusCode).toBe(404);
  });
});

// ── GET /api/watchlist/performance ───────────────────────────────────────────
describe('GET /api/watchlist/performance', () => {
  test('returns empty summary when watchlist is empty', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app).get('/api/watchlist/performance');

    expect(res.statusCode).toBe(200);
    expect(res.body.summary.total_items).toBe(0);
    expect(res.body.items).toEqual([]);
  });

  test('calculates P&L correctly for tracked items', async () => {
    db.query.mockResolvedValueOnce({
      rows: [{ ...MOCK_ROW, purchase_price: '160.00' }],
    });
    finnhub.getBatchQuotes.mockResolvedValueOnce({ AAPL: MOCK_QUOTE });

    const res = await request(app).get('/api/watchlist/performance');

    expect(res.statusCode).toBe(200);
    const { summary } = res.body;
    expect(summary.total_items).toBe(1);
    expect(summary.tracked_items).toBe(1);
    expect(summary.total_investment).toBe(160);
    expect(summary.total_current_value).toBe(178.5);
    expect(summary.total_change).toBeCloseTo(18.5, 2);
    expect(summary.total_change_percent).toBeCloseTo(11.56, 1);
  });
});
