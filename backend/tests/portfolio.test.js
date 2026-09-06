/**
 * Portfolio Routes Tests — UUID user_id (migration 022)
 *
 * Same residual class as watchlist PR #18: requireAuth sets req.user.id
 * to a Supabase Auth UUID. INTEGER portfolio_* user_id 500s:
 *   invalid input syntax for type integer: "e11316bf-..."
 */

const request = require('supertest');
const express = require('express');

const mockCreateClient = jest.fn();
const mockBackfill = jest.fn();
const mockGetLog = jest.fn();
const mockGetTotalForSymbol = jest.fn();

jest.mock('@supabase/supabase-js', () => ({
  createClient: (...args) => mockCreateClient(...args),
}));

jest.mock('../services/dividendLog', () => ({
  backfill: (...args) => mockBackfill(...args),
  getLog: (...args) => mockGetLog(...args),
  getTotalForSymbol: (...args) => mockGetTotalForSymbol(...args),
  upsertEntry: jest.fn(),
  updateEntry: jest.fn(),
  deleteEntry: jest.fn(),
  backfillAllHoldings: jest.fn(),
  confirmEntry: jest.fn(),
  processDRIP: jest.fn(),
}));

const AUTH_USER_UUID = 'e11316bf-5ba9-49d6-ac8d-333842a845f8';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

jest.mock('../middleware/auth', () => ({
  requireAuth: (req, _res, next) => {
    req.user = {
      id: 'e11316bf-5ba9-49d6-ac8d-333842a845f8',
      email: 'test@example.com',
      role: 'authenticated',
      subscription_tier: 'free',
    };
    next();
  },
  optionalAuth: (req, _res, next) => {
    req.user = {
      id: 'e11316bf-5ba9-49d6-ac8d-333842a845f8',
      email: 'test@example.com',
      role: 'authenticated',
      subscription_tier: 'free',
    };
    next();
  },
}));

const portfolioRouter = require('../routes/portfolio');

function createSupabaseMock(tableMap = {}) {
  return {
    from(tableName) {
      const table = tableMap[tableName];
      if (!table) throw new Error(`No mock configured for table: ${tableName}`);
      return table;
    },
  };
}

function makeSelectEqOrderOrder(result) {
  const chain = {
    select: jest.fn(() => chain),
    eq: jest.fn(() => chain),
    order: jest.fn(() => chain),
  };
  chain.order.mockReturnValueOnce(chain).mockResolvedValueOnce(result);
  return chain;
}

function makeUpsertSelectSingle(result) {
  const chain = {
    upsert: jest.fn(() => chain),
    select: jest.fn(() => chain),
    single: jest.fn(async () => result),
  };
  return chain;
}

const app = express();
app.use(express.json());
app.use('/api/portfolio', portfolioRouter);

beforeEach(() => {
  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
  mockCreateClient.mockReset();
  mockBackfill.mockReset();
  mockGetLog.mockReset();
  mockGetTotalForSymbol.mockReset();
  mockBackfill.mockResolvedValue({ inserted: 0, skipped: 0 });
  mockGetLog.mockResolvedValue([]);
});

afterEach(() => jest.clearAllMocks());

describe('GET /api/portfolio/holdings', () => {
  test('returns empty holdings when user has no rows', async () => {
    const chain = makeSelectEqOrderOrder({ data: [], error: null });
    mockCreateClient.mockReturnValueOnce(createSupabaseMock({
      portfolio_holdings: chain,
    }));

    const res = await request(app).get('/api/portfolio/holdings');

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ holdings: [] });
    expect(chain.eq).toHaveBeenCalledWith('user_id', AUTH_USER_UUID);
    expect(typeof chain.eq.mock.calls[0][1]).toBe('string');
    expect(Number.isInteger(chain.eq.mock.calls[0][1])).toBe(false);
  });

  test('filters by Supabase Auth UUID user_id, not a legacy integer', async () => {
    const chain = makeSelectEqOrderOrder({ data: [], error: null });
    mockCreateClient.mockReturnValueOnce(createSupabaseMock({
      portfolio_holdings: chain,
    }));

    const res = await request(app).get('/api/portfolio/holdings');

    expect(res.statusCode).toBe(200);
    expect(chain.eq).toHaveBeenCalledTimes(1);
    expect(chain.eq).toHaveBeenCalledWith('user_id', AUTH_USER_UUID);
    expect(chain.eq).not.toHaveBeenCalledWith('user_id', expect.any(Number));
    expect(chain.eq.mock.calls[0][1]).toMatch(UUID_RE);
  });
});

describe('POST /api/portfolio/holdings', () => {
  test('upserts with UUID user_id, not parseInt', async () => {
    const chain = makeUpsertSelectSingle({
      data: {
        id: 1,
        user_id: AUTH_USER_UUID,
        symbol: 'AAPL',
        shares: 10,
        avg_cost: 150,
      },
      error: null,
    });
    mockCreateClient.mockReturnValueOnce(createSupabaseMock({
      portfolio_holdings: chain,
    }));

    const res = await request(app)
      .post('/api/portfolio/holdings?backfill=false')
      .send({ symbol: 'AAPL', shares: 10, avg_cost: 150 });

    expect(res.statusCode).toBe(200);
    expect(res.body.holding.symbol).toBe('AAPL');
    expect(chain.upsert.mock.calls[0][0].user_id).toBe(AUTH_USER_UUID);
    expect(typeof chain.upsert.mock.calls[0][0].user_id).toBe('string');
    expect(chain.upsert.mock.calls[0][0].user_id).not.toEqual(expect.any(Number));
    expect(chain.upsert.mock.calls[0][0].user_id).toMatch(UUID_RE);
  });

  test('dividend backfill receives Auth UUID, not an integer', async () => {
    const chain = makeUpsertSelectSingle({
      data: { id: 1, user_id: AUTH_USER_UUID, symbol: 'KO', shares: 100, avg_cost: 50 },
      error: null,
    });
    mockCreateClient.mockReturnValueOnce(createSupabaseMock({
      portfolio_holdings: chain,
    }));

    const res = await request(app)
      .post('/api/portfolio/holdings')
      .send({ symbol: 'KO', shares: 100, avg_cost: 50, buy_date: '2021-01-01' });

    expect(res.statusCode).toBe(200);
    expect(mockBackfill).toHaveBeenCalled();
    expect(mockBackfill.mock.calls[0][0]).toBe(AUTH_USER_UUID);
    expect(typeof mockBackfill.mock.calls[0][0]).toBe('string');
    expect(Number.isInteger(mockBackfill.mock.calls[0][0])).toBe(false);
  });

  test('returns 400 when required fields are missing', async () => {
    const res = await request(app)
      .post('/api/portfolio/holdings')
      .send({ symbol: 'AAPL' });

    expect(res.statusCode).toBe(400);
    expect(mockCreateClient).not.toHaveBeenCalled();
  });
});

describe('GET /api/portfolio/dividend-log', () => {
  test('passes Auth UUID to dividendLog.getLog, not parseInt', async () => {
    mockGetLog.mockResolvedValueOnce([]);

    const res = await request(app).get('/api/portfolio/dividend-log?symbol=KO');

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ entries: [] });
    expect(mockGetLog).toHaveBeenCalledWith(AUTH_USER_UUID, { symbol: 'KO' });
    expect(mockGetLog.mock.calls[0][0]).toMatch(UUID_RE);
    expect(mockGetLog).not.toHaveBeenCalledWith(expect.any(Number), expect.anything());
  });
});
