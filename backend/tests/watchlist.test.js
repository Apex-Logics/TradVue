/**
 * Watchlist Routes Tests
 *
 * Covers: GET, POST, PUT /:id/alerts, DELETE /:id, GET /performance
 *
 * Mocks: Supabase client, finnhub, auth middleware
 */

const request = require('supertest');
const express = require('express');

const mockCreateClient = jest.fn();

jest.mock('@supabase/supabase-js', () => ({
  createClient: (...args) => mockCreateClient(...args),
}));

jest.mock('../services/finnhub', () => ({
  getQuote: jest.fn(),
  getBatchQuotes: jest.fn(),
}));

jest.mock('../middleware/auth', () => ({
  requireAuth: (req, _res, next) => {
    req.user = { id: 'user-uuid-1', email: 'test@example.com', role: 'authenticated', subscription_tier: 'free' };
    next();
  },
  optionalAuth: (req, _res, next) => {
    req.user = { id: 'user-uuid-1', email: 'test@example.com', role: 'authenticated', subscription_tier: 'free' };
    next();
  },
}));

const finnhub = require('../services/finnhub');
const watchlistRouter = require('../routes/watchlist');

function createSupabaseMock(tableMap = {}) {
  return {
    from(tableName) {
      const table = tableMap[tableName];
      if (!table) throw new Error(`No mock configured for table: ${tableName}`);
      return table;
    },
  };
}

function makeSelectEqEq(result) {
  const chain = {
    select: jest.fn(() => chain),
    eq: jest.fn(() => chain),
  };
  chain.eq.mockReturnValueOnce(chain).mockResolvedValueOnce(result);
  return chain;
}

function makeSelectEqOrder(result) {
  const chain = {
    select: jest.fn(() => chain),
    eq: jest.fn(() => chain),
    order: jest.fn(async () => result),
  };
  return chain;
}

function makeSelectEq(result) {
  const chain = {
    select: jest.fn(() => chain),
    eq: jest.fn(async () => result),
  };
  return chain;
}

function makeInsertSelect(result) {
  const chain = {
    insert: jest.fn(() => chain),
    select: jest.fn(async () => result),
  };
  return chain;
}

function makeUpdateEqEqSelect(result) {
  const chain = {
    update: jest.fn(() => chain),
    eq: jest.fn(() => chain),
    select: jest.fn(async () => result),
  };
  chain.eq.mockReturnValueOnce(chain).mockReturnValueOnce(chain);
  return chain;
}

function makeDeleteEqEqSelect(result) {
  const chain = {
    delete: jest.fn(() => chain),
    eq: jest.fn(() => chain),
    select: jest.fn(async () => result),
  };
  chain.eq.mockReturnValueOnce(chain).mockReturnValueOnce(chain);
  return chain;
}

const app = express();
app.use(express.json());
app.use('/api/watchlist', watchlistRouter);

beforeEach(() => {
  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
  mockCreateClient.mockReset();
});

afterEach(() => jest.clearAllMocks());

const MOCK_JOINED_ROW = {
  id: 1,
  alert_threshold_up: null,
  alert_threshold_down: null,
  notes: null,
  purchase_price: null,
  created_at: new Date().toISOString(),
  instruments: {
    symbol: 'AAPL',
    name: 'Apple Inc.',
    type: 'stock',
    exchange: 'NASDAQ',
  },
};

const MOCK_QUOTE = {
  current: 178.5,
  change: 1.2,
  changePct: 0.68,
  source: 'finnhub',
};

describe('GET /api/watchlist', () => {
  test('returns empty watchlist when user has no items', async () => {
    mockCreateClient.mockReturnValueOnce(createSupabaseMock({
      watchlists: makeSelectEqOrder({ data: [], error: null }),
    }));

    const res = await request(app).get('/api/watchlist');

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ watchlist: [], total_items: 0 });
  });

  test('returns enriched watchlist items with live quotes', async () => {
    mockCreateClient.mockReturnValueOnce(createSupabaseMock({
      watchlists: makeSelectEqOrder({ data: [MOCK_JOINED_ROW], error: null }),
    }));
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

  test('returns 500 when supabase query fails', async () => {
    mockCreateClient.mockReturnValueOnce(createSupabaseMock({
      watchlists: makeSelectEqOrder({ data: null, error: { message: 'DB down' } }),
    }));

    const res = await request(app).get('/api/watchlist');

    expect(res.statusCode).toBe(500);
    expect(res.body).toHaveProperty('error');
  });
});

describe('POST /api/watchlist', () => {
  test('adds a valid instrument to the watchlist', async () => {
    const watchlists = {
      select: jest.fn()
        .mockReturnValueOnce({
          eq: jest.fn(() => ({
            eq: jest.fn(async () => ({ data: [], error: null })),
          })),
        })
        .mockReturnValueOnce({
          eq: jest.fn(async () => ({ count: 2, error: null })),
        }),
      insert: jest.fn(() => ({
        select: jest.fn(async () => ({
          data: [{ id: 42, alert_threshold_up: null, alert_threshold_down: null, notes: null, purchase_price: null, created_at: new Date().toISOString() }],
          error: null,
        })),
      })),
    };

    mockCreateClient.mockReturnValueOnce(createSupabaseMock({
      instruments: makeSelectEqEq({
        data: [{ id: 10, symbol: 'AAPL', name: 'Apple Inc.', type: 'stock', exchange: 'NASDAQ' }],
        error: null,
      }),
      watchlists,
    }));
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
    mockCreateClient.mockReturnValueOnce(createSupabaseMock({
      instruments: makeSelectEqEq({ data: [], error: null }),
    }));

    const res = await request(app).post('/api/watchlist').send({ symbol: 'UNKN' });

    expect(res.statusCode).toBe(404);
    expect(res.body.error).toMatch(/not found/i);
  });

  test('returns 409 when instrument is already in watchlist', async () => {
    const watchlists = {
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          eq: jest.fn(async () => ({ data: [{ id: 1 }], error: null })),
        })),
      })),
    };

    mockCreateClient.mockReturnValueOnce(createSupabaseMock({
      instruments: makeSelectEqEq({
        data: [{ id: 10, symbol: 'AAPL', name: 'Apple Inc.', type: 'stock', exchange: 'NASDAQ' }],
        error: null,
      }),
      watchlists,
    }));

    const res = await request(app).post('/api/watchlist').send({ symbol: 'AAPL' });

    expect(res.statusCode).toBe(409);
    expect(res.body.error).toMatch(/already/i);
  });

  test('returns 403 when free tier limit (10 items) is reached', async () => {
    const watchlists = {
      select: jest.fn()
        .mockReturnValueOnce({
          eq: jest.fn(() => ({
            eq: jest.fn(async () => ({ data: [], error: null })),
          })),
        })
        .mockReturnValueOnce({
          eq: jest.fn(async () => ({ count: 10, error: null })),
        }),
    };

    mockCreateClient.mockReturnValueOnce(createSupabaseMock({
      instruments: makeSelectEqEq({
        data: [{ id: 10, symbol: 'AAPL', name: 'Apple Inc.', type: 'stock', exchange: 'NASDAQ' }],
        error: null,
      }),
      watchlists,
    }));

    const res = await request(app).post('/api/watchlist').send({ symbol: 'AAPL' });

    expect(res.statusCode).toBe(403);
    expect(res.body.error).toMatch(/free tier/i);
  });
});

describe('PUT /api/watchlist/:id/alerts', () => {
  test('updates alert thresholds for owned watchlist item', async () => {
    mockCreateClient.mockReturnValueOnce(createSupabaseMock({
      watchlists: makeUpdateEqEqSelect({ data: [{ id: 1, alert_threshold_up: 200, alert_threshold_down: 150 }], error: null }),
    }));

    const res = await request(app)
      .put('/api/watchlist/1/alerts')
      .send({ alert_threshold_up: 200, alert_threshold_down: 150 });

    expect(res.statusCode).toBe(200);
    expect(res.body.message).toMatch(/updated/i);
  });

  test('returns 404 when item not found or not owned', async () => {
    mockCreateClient.mockReturnValueOnce(createSupabaseMock({
      watchlists: makeUpdateEqEqSelect({ data: [], error: null }),
    }));

    const res = await request(app)
      .put('/api/watchlist/999/alerts')
      .send({ alert_threshold_up: 200 });

    expect(res.statusCode).toBe(404);
  });
});

describe('DELETE /api/watchlist/:id', () => {
  test('removes watchlist item and returns removed id', async () => {
    mockCreateClient.mockReturnValueOnce(createSupabaseMock({
      watchlists: makeDeleteEqEqSelect({ data: [{ id: 1 }], error: null }),
    }));

    const res = await request(app).delete('/api/watchlist/1');

    expect(res.statusCode).toBe(200);
    expect(res.body.removed_id).toBe(1);
  });

  test('returns 404 when item not found or not owned', async () => {
    mockCreateClient.mockReturnValueOnce(createSupabaseMock({
      watchlists: makeDeleteEqEqSelect({ data: [], error: null }),
    }));

    const res = await request(app).delete('/api/watchlist/999');

    expect(res.statusCode).toBe(404);
  });
});

describe('GET /api/watchlist/performance', () => {
  test('returns empty summary when watchlist is empty', async () => {
    mockCreateClient.mockReturnValueOnce(createSupabaseMock({
      watchlists: makeSelectEq({ data: [], error: null }),
    }));

    const res = await request(app).get('/api/watchlist/performance');

    expect(res.statusCode).toBe(200);
    expect(res.body.summary.total_items).toBe(0);
    expect(res.body.items).toEqual([]);
  });

  test('calculates P&L correctly for tracked items', async () => {
    mockCreateClient.mockReturnValueOnce(createSupabaseMock({
      watchlists: makeSelectEq({
        data: [{ ...MOCK_JOINED_ROW, purchase_price: '160.00' }],
        error: null,
      }),
    }));
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
