/**
 * Q6 (P1-C) — portfolio DRIP correctness
 *
 * Locks:
 *   - backfill compounds later payments only when an auditable reinvest
 *     price is known (caller map / history field / existing drip_price)
 *   - current/market price is never used as a silent proxy
 *   - totalDividends counts eligible (post buy_date) payments only
 *   - processDRIP success updates holdings + log
 *   - forced holdings failure unclaims the log (retry-safe)
 *   - concurrent / retry calls do not double-increment shares
 *
 * In-memory Supabase mock — no live DB, no prod writes.
 */

'use strict';

process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';

jest.mock('../services/stockInfo', () => ({
  getStockInfo: jest.fn(),
}));

const { getStockInfo } = require('../services/stockInfo');

let db;
let seq;
let failHoldingUpdate = false;

function nextId() {
  return seq++;
}

function matches(row, filters) {
  return Object.entries(filters).every(([key, val]) => {
    if (key.startsWith('gte:')) return String(row[key.slice(4)]) >= String(val);
    if (key.startsWith('lte:')) return String(row[key.slice(4)]) <= String(val);
    return row[key] == val;
  });
}

function makeChain(table) {
  const state = {
    table,
    action: 'select',
    filters: {},
    payload: null,
    limit: null,
    headCount: false,
  };

  function run(single) {
    if (!db[state.table]) db[state.table] = [];
    const rows = db[state.table];

    if (state.action === 'select') {
      let found = rows.filter((r) => matches(r, state.filters));
      if (state.limit) found = found.slice(0, state.limit);
      if (state.headCount) return { count: found.length, data: null, error: null };
      return single
        ? { data: found[0] || null, error: null }
        : { data: found, error: null };
    }

    if (state.action === 'upsert') {
      const payload = state.payload;
      const idx = rows.findIndex(
        (r) =>
          r.user_id == payload.user_id
          && r.symbol === payload.symbol
          && r.payment_date === payload.payment_date
      );
      let row;
      if (idx >= 0) {
        rows[idx] = { ...rows[idx], ...payload };
        row = rows[idx];
      } else {
        row = { id: nextId(), drip_reinvested: false, ...payload };
        rows.push(row);
      }
      return { data: row, error: null };
    }

    if (state.action === 'update') {
      if (state.table === 'portfolio_holdings' && failHoldingUpdate) {
        failHoldingUpdate = false;
        return { data: null, error: { message: 'forced holding update failure' } };
      }
      const matched = rows.filter((r) => matches(r, state.filters));
      matched.forEach((r) => Object.assign(r, state.payload));
      return single
        ? { data: matched[0] || null, error: null }
        : { data: matched, error: null };
    }

    return { data: null, error: { message: `unknown action ${state.action}` } };
  }

  const chain = {
    select(columns, options) {
      if (options && options.head && options.count) state.headCount = true;
      return chain;
    },
    insert(payload) {
      state.action = 'insert';
      state.payload = payload;
      return chain;
    },
    update(payload) {
      state.action = 'update';
      state.payload = payload;
      return chain;
    },
    upsert(payload) {
      state.action = 'upsert';
      state.payload = payload;
      return chain;
    },
    eq(col, val) {
      state.filters[col] = val;
      return chain;
    },
    gte(col, val) {
      state.filters[`gte:${col}`] = val;
      return chain;
    },
    lte(col, val) {
      state.filters[`lte:${col}`] = val;
      return chain;
    },
    order() { return chain; },
    limit(n) {
      state.limit = n;
      return chain;
    },
    maybeSingle() { return Promise.resolve(run(true)); },
    single() { return Promise.resolve(run(true)); },
    then(resolve, reject) {
      return Promise.resolve(run(false)).then(resolve, reject);
    },
  };
  return chain;
}

const mockClient = { from: jest.fn((table) => makeChain(table)) };

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockClient),
}));

const dividendLog = require('../services/dividendLog');

const USER = 'e11316bf-5ba9-49d6-ac8d-333842a845f8';
const SYM = 'KO';

function seedHolding(shares = 100) {
  db.portfolio_holdings.push({
    id: nextId(),
    user_id: USER,
    symbol: SYM,
    shares,
    drip_enabled: true,
  });
}

function seedLogEntry({
  id = 1,
  total_received = 50,
  drip_reinvested = false,
  drip_shares_added = null,
  drip_price = null,
} = {}) {
  const row = {
    id,
    user_id: USER,
    symbol: SYM,
    payment_date: '2024-06-15',
    dividend_per_share: 0.5,
    shares_held: 100,
    total_received,
    drip_reinvested,
    drip_shares_added,
    drip_price,
    is_confirmed: false,
  };
  db.portfolio_dividend_log.push(row);
  return row;
}

function mockHistory(payments, extras = {}) {
  getStockInfo.mockResolvedValue({
    symbol: SYM,
    currentPrice: extras.currentPrice ?? 999.99,
    dividendHistory: payments,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  db = {
    portfolio_dividend_log: [],
    portfolio_holdings: [],
  };
  seq = 1;
  failHoldingUpdate = false;
  getStockInfo.mockReset();
});

describe('resolveAuditableReinvestPrice', () => {
  test('accepts caller map, then history fields; never current/market proxies', () => {
    expect(dividendLog.resolveAuditableReinvestPrice(
      { date: '2024-03-01', currentPrice: 10, marketPrice: 11, close: 12 },
      { '2024-03-01': 50 }
    )).toBe(50);

    expect(dividendLog.resolveAuditableReinvestPrice(
      { date: '2024-03-01', reinvestPrice: 48.5 }
    )).toBe(48.5);

    expect(dividendLog.resolveAuditableReinvestPrice(
      { date: '2024-03-01', price: 47 },
      null,
      46
    )).toBe(47);

    expect(dividendLog.resolveAuditableReinvestPrice(
      { date: '2024-03-01' },
      null,
      46
    )).toBe(46);

    expect(dividendLog.resolveAuditableReinvestPrice({
      date: '2024-03-01',
      currentPrice: 100,
      marketPrice: 100,
      close: 100,
    })).toBeNull();

    expect(dividendLog.resolveAuditableReinvestPrice(
      { date: '2024-03-01' },
      { '2024-03-01': 0 }
    )).toBeNull();

    expect(dividendLog.resolveAuditableReinvestPrice(
      { date: '2024-03-01', price: -5 }
    )).toBeNull();
  });
});

describe('computeDripShares', () => {
  test('matches ledger formula total_received / price', () => {
    expect(dividendLog.computeDripShares(50, 25)).toBe(2);
    expect(dividendLog.computeDripShares(33.3333, 100)).toBe(0.333333);
    expect(dividendLog.computeDripShares(50, 0)).toBeNull();
    expect(dividendLog.computeDripShares(50, -1)).toBeNull();
  });
});

describe('backfill compounding', () => {
  test('compounds later payments when auditable prices are provided', async () => {
    mockHistory([
      { date: '2024-09-01', amount: 1 },
      { date: '2024-03-01', amount: 1 },
      { date: '2024-06-01', amount: 1 },
    ]);

    const result = await dividendLog.backfill(USER, {
      symbol: SYM,
      shares: 100,
      buy_date: '2024-01-01',
      drip_enabled: true,
      reinvestPrices: {
        '2024-03-01': 50,
        '2024-06-01': 50,
        '2024-09-01': 50,
      },
    });

    expect(result.inserted).toBe(3);
    expect(result.errors).toBe(0);
    expect(result.dripCompounded).toBe(3);
    expect(result.dripSkippedNoPrice).toBe(0);
    expect(result.totalDividends).toBe(3);
    expect(result.endingShares).toBe(106.1208);

    const rows = [...db.portfolio_dividend_log].sort((a, b) => a.payment_date.localeCompare(b.payment_date));
    expect(rows.map((r) => r.shares_held)).toEqual([100, 102, 104.04]);
    expect(rows.map((r) => r.total_received)).toEqual([100, 102, 104.04]);
  });

  test('does not compound when drip is on but no auditable price exists', async () => {
    mockHistory([
      { date: '2024-03-01', amount: 1 },
      { date: '2024-06-01', amount: 1 },
    ], { currentPrice: 75 });

    const result = await dividendLog.backfill(USER, {
      symbol: SYM,
      shares: 100,
      drip_enabled: true,
    });

    expect(result.dripCompounded).toBe(0);
    expect(result.dripSkippedNoPrice).toBe(2);
    expect(result.endingShares).toBe(100);
    expect(db.portfolio_dividend_log.every((r) => r.shares_held === 100)).toBe(true);
    expect(db.portfolio_dividend_log.every((r) => r.total_received === 100)).toBe(true);
  });

  test('compounds from a history-row price field without inventing the rest', async () => {
    mockHistory([
      { date: '2024-03-01', amount: 1, reinvestPrice: 50 },
      { date: '2024-06-01', amount: 1 },
    ]);

    const result = await dividendLog.backfill(USER, {
      symbol: 'ko',
      shares: 100,
      drip_enabled: true,
    });

    expect(result.dripCompounded).toBe(1);
    expect(result.dripSkippedNoPrice).toBe(1);
    expect(result.endingShares).toBe(102);

    const rows = [...db.portfolio_dividend_log].sort((a, b) => a.payment_date.localeCompare(b.payment_date));
    expect(rows[0].shares_held).toBe(100);
    expect(rows[1].shares_held).toBe(102);
    expect(rows[1].total_received).toBe(102);
  });

  test('uses an existing ledger drip_price as an auditable source', async () => {
    db.portfolio_dividend_log.push({
      id: nextId(),
      user_id: USER,
      symbol: SYM,
      payment_date: '2024-03-01',
      drip_price: 50,
      drip_reinvested: true,
      is_confirmed: true,
      shares_held: 100,
      total_received: 100,
      dividend_per_share: 1,
    });
    mockHistory([
      { date: '2024-03-01', amount: 1 },
      { date: '2024-06-01', amount: 1 },
    ]);

    const result = await dividendLog.backfill(USER, {
      symbol: SYM,
      shares: 100,
      drip_enabled: true,
    });

    expect(result.skipped).toBe(1);
    expect(result.inserted).toBe(1);
    expect(result.dripCompounded).toBe(1);
    const june = db.portfolio_dividend_log.find((r) => r.payment_date === '2024-06-01');
    expect(june.shares_held).toBe(102);
  });
});

describe('backfill skipped dates', () => {
  test('does not count pre-buy payments in totalDividends', async () => {
    mockHistory([
      { date: '2024-03-01', amount: 1 },
      { date: '2024-06-01', amount: 1 },
      { date: '2024-09-01', amount: 1 },
    ]);

    const result = await dividendLog.backfill(USER, {
      symbol: SYM,
      shares: 100,
      buy_date: '2024-04-01',
      drip_enabled: false,
    });

    expect(result.preBuySkipped).toBe(1);
    expect(result.totalDividends).toBe(2);
    expect(result.inserted).toBe(2);
    expect(db.portfolio_dividend_log).toHaveLength(2);
    expect(db.portfolio_dividend_log.some((r) => r.payment_date === '2024-03-01')).toBe(false);
  });

  test('all dates before buy_date → totalDividends 0, not history length', async () => {
    mockHistory([
      { date: '2023-03-01', amount: 1 },
      { date: '2023-06-01', amount: 1 },
    ]);

    const result = await dividendLog.backfill(USER, {
      symbol: SYM,
      shares: 100,
      buy_date: '2024-01-01',
    });

    expect(result.totalDividends).toBe(0);
    expect(result.preBuySkipped).toBe(2);
    expect(result.inserted).toBe(0);
  });
});

describe('processDRIP', () => {
  test('success marks the log and increments holdings', async () => {
    seedHolding(100);
    seedLogEntry({ total_received: 50 });

    const result = await dividendLog.processDRIP(USER, 1, 25);

    expect(result).toMatchObject({
      symbol: SYM,
      dripSharesAdded: 2,
      priceAtPayment: 25,
      totalReceived: 50,
      newShares: 102,
      alreadyProcessed: false,
    });
    expect(db.portfolio_dividend_log[0].drip_reinvested).toBe(true);
    expect(db.portfolio_dividend_log[0].drip_shares_added).toBe(2);
    expect(db.portfolio_dividend_log[0].drip_price).toBe(25);
    expect(db.portfolio_holdings[0].shares).toBe(102);
  });

  test('forced holding-update failure does not leave reinvested-but-shares-missing', async () => {
    seedHolding(100);
    seedLogEntry({ total_received: 50 });
    failHoldingUpdate = true;

    await expect(dividendLog.processDRIP(USER, 1, 25))
      .rejects.toThrow('forced holding update failure');

    expect(db.portfolio_dividend_log[0].drip_reinvested).toBe(false);
    expect(db.portfolio_dividend_log[0].drip_shares_added).toBeNull();
    expect(db.portfolio_dividend_log[0].drip_price).toBeNull();
    expect(db.portfolio_holdings[0].shares).toBe(100);

    const retry = await dividendLog.processDRIP(USER, 1, 25);
    expect(retry.alreadyProcessed).toBe(false);
    expect(retry.newShares).toBe(102);
    expect(db.portfolio_dividend_log[0].drip_reinvested).toBe(true);
    expect(db.portfolio_holdings[0].shares).toBe(102);
  });

  test('retry after success is idempotent and does not double-increment', async () => {
    seedHolding(100);
    seedLogEntry({ total_received: 50 });

    await dividendLog.processDRIP(USER, 1, 25);
    const again = await dividendLog.processDRIP(USER, 1, 25);

    expect(again.alreadyProcessed).toBe(true);
    expect(again.dripSharesAdded).toBe(2);
    expect(db.portfolio_holdings[0].shares).toBe(102);
  });

  test('concurrent callers: only one increment (CAS winner)', async () => {
    seedHolding(100);
    seedLogEntry({ total_received: 50 });

    const [a, b] = await Promise.all([
      dividendLog.processDRIP(USER, 1, 25),
      dividendLog.processDRIP(USER, 1, 25),
    ]);

    const processed = [a, b].filter((r) => !r.alreadyProcessed);
    const replayed = [a, b].filter((r) => r.alreadyProcessed);
    expect(processed).toHaveLength(1);
    expect(replayed).toHaveLength(1);
    expect(db.portfolio_holdings[0].shares).toBe(102);
    expect(db.portfolio_dividend_log[0].drip_reinvested).toBe(true);
  });

  test('missing holding unclaims so retry is possible after the holding exists', async () => {
    seedLogEntry({ total_received: 50 });

    await expect(dividendLog.processDRIP(USER, 1, 25))
      .rejects.toThrow('Holding not found for symbol');

    expect(db.portfolio_dividend_log[0].drip_reinvested).toBe(false);

    seedHolding(100);
    const result = await dividendLog.processDRIP(USER, 1, 25);
    expect(result.newShares).toBe(102);
  });

  test('rejects non-positive price before touching state', async () => {
    seedHolding(100);
    seedLogEntry({ total_received: 50 });

    await expect(dividendLog.processDRIP(USER, 1, 0)).rejects.toThrow('Invalid price');
    await expect(dividendLog.processDRIP(USER, 1, -10)).rejects.toThrow('Invalid price');
    expect(db.portfolio_dividend_log[0].drip_reinvested).toBe(false);
    expect(db.portfolio_holdings[0].shares).toBe(100);
  });
});
