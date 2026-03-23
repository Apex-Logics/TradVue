/**
 * Tests: insiderTradeStore.js
 */
'use strict';

const mockHeadCountQueue = [];
const mockSelectQueue = [];
const mockUpsertQueue = [];
const mockDeleteQueue = [];
const chains = [];

function makeChain(table) {
  const state = { table, filters: [], rangeArgs: null, mode: 'select' };
  const chain = {
    __state: state,
    select: jest.fn().mockImplementation(function (...args) {
      const options = args[1] || {};
      if (options.head && options.count) state.mode = 'count';
      else if (args[0] === 'source') state.mode = 'source';
      else state.mode = 'select';
      return chain;
    }),
    upsert: jest.fn().mockImplementation(() => Promise.resolve(mockUpsertQueue.shift() || { error: null })),
    delete: jest.fn().mockImplementation(() => { state.mode = 'delete'; return chain; }),
    gte: jest.fn().mockImplementation((field, value) => { state.filters.push(['gte', field, value]); return chain; }),
    lte: jest.fn().mockImplementation((field, value) => { state.filters.push(['lte', field, value]); return chain; }),
    eq: jest.fn().mockImplementation((field, value) => { state.filters.push(['eq', field, value]); return chain; }),
    ilike: jest.fn().mockImplementation((field, value) => { state.filters.push(['ilike', field, value]); return chain; }),
    or: jest.fn().mockImplementation((value) => { state.filters.push(['or', value]); return chain; }),
    order: jest.fn().mockImplementation(() => chain),
    range: jest.fn().mockImplementation((from, to) => { state.rangeArgs = [from, to]; return chain; }),
    limit: jest.fn().mockImplementation(() => chain),
    lt: jest.fn().mockImplementation(() => chain),
    then: (resolve, reject) => {
      const result = state.mode === 'count'
        ? (mockHeadCountQueue.shift() || { count: 0, error: null })
        : state.mode === 'source'
          ? (mockSelectQueue.shift() || { data: [], error: null })
          : state.mode === 'delete'
            ? (mockDeleteQueue.shift() || { count: 0, error: null })
            : (mockSelectQueue.shift() || { data: [], error: null });
      return Promise.resolve(result).then(resolve, reject);
    },
  };
  chains.push(chain);
  return chain;
}

const mockSupabaseClient = { from: jest.fn((table) => makeChain(table)) };

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockSupabaseClient),
}));

jest.mock('../services/db', () => ({ query: jest.fn() }));

const store = require('../services/insiderTradeStore');

beforeEach(() => {
  jest.clearAllMocks();
  mockHeadCountQueue.length = 0;
  mockSelectQueue.length = 0;
  mockUpsertQueue.length = 0;
  mockDeleteQueue.length = 0;
  chains.length = 0;
});

describe('ingestFromEdgar', () => {
  test('returns zeros for empty input', async () => {
    await expect(store.ingestFromEdgar([])).resolves.toEqual({ inserted: 0, skipped: 0 });
    expect(mockSupabaseClient.from).not.toHaveBeenCalled();
  });

  test('skips records missing required fields', async () => {
    const result = await store.ingestFromEdgar([
      { ticker: 'AAPL' },
      { ticker: '', name: 'John', date: '2026-01-01', transactionType: 'Buy' },
      { ticker: 'MSFT', name: 'Jane', date: null, transactionType: 'Sell' },
    ]);
    expect(result).toEqual({ inserted: 0, skipped: 3 });
  });

  test('inserts a valid EDGAR record', async () => {
    mockUpsertQueue.push({ error: null });
    const result = await store.ingestFromEdgar([{ ticker: 'AAPL', name: 'Tim Cook', date: '2026-03-01', transactionType: 'Sell', companyName: 'Apple Inc.', officerTitle: 'CEO', shares: 100000, pricePerShare: 215.5, transactionValue: 21550000, holdingsAfter: 3000000, filingUrl: 'https://www.sec.gov/Archives/edgar/data/320193/000162828026019134/wk-form4.xml' }]);
    expect(result).toEqual({ inserted: 1, skipped: 0 });
    const payload = chains[0].upsert.mock.calls[0][0];
    expect(payload.accession_number).toBe('0001628280-26-019134');
    expect(payload.cik).toBe('320193');
  });

  test('counts skipped when upsert returns error', async () => {
    mockUpsertQueue.push({ error: { message: 'duplicate' } });
    await expect(store.ingestFromEdgar([{ ticker: 'TSLA', name: 'Elon Musk', date: '2026-03-10', transactionType: 'Buy' }])).resolves.toEqual({ inserted: 0, skipped: 1 });
  });

  test('uppercases ticker', async () => {
    mockUpsertQueue.push({ error: null });
    await store.ingestFromEdgar([{ ticker: 'nvda', name: 'Jensen Huang', date: '2026-03-05', transactionType: 'Sell' }]);
    expect(chains[0].upsert.mock.calls[0][0].ticker).toBe('NVDA');
  });
});

describe('ingestFromFinnhub', () => {
  test('returns zeros for empty input', async () => {
    await expect(store.ingestFromFinnhub([])).resolves.toEqual({ inserted: 0, skipped: 0 });
  });

  test('skips if EDGAR record already exists for same trade', async () => {
    mockSelectQueue.push({ data: [{ id: 42 }], error: null });
    const result = await store.ingestFromFinnhub([{ ticker: 'AAPL', name: 'Tim Cook', date: '2026-03-01', transactionType: 'Sell' }]);
    expect(result).toEqual({ inserted: 0, skipped: 1 });
    expect(chains).toHaveLength(1);
  });

  test('inserts Finnhub record when no EDGAR duplicate', async () => {
    mockSelectQueue.push({ data: [], error: null });
    mockUpsertQueue.push({ error: null });
    const result = await store.ingestFromFinnhub([{ ticker: 'META', name: 'Mark Zuckerberg', date: '2026-03-12', transactionType: 'Sell', shares: 500000 }]);
    expect(result).toEqual({ inserted: 1, skipped: 0 });
  });

  test('skips records missing required fields', async () => {
    await expect(store.ingestFromFinnhub([{ ticker: 'META', name: 'Mark', transactionType: 'Sell' }])).resolves.toEqual({ inserted: 0, skipped: 1 });
  });
});

describe('pruneOldRecords', () => {
  test('executes DELETE for records older than 90 days', async () => {
    mockDeleteQueue.push({ count: 47, error: null });
    await expect(store.pruneOldRecords()).resolves.toBe(47);
  });

  test('returns 0 and does not throw on db error', async () => {
    mockDeleteQueue.push({ count: 0, error: { message: 'DB error' } });
    await expect(store.pruneOldRecords()).resolves.toBe(0);
  });
});

describe('getRecordCount', () => {
  test('returns total row count', async () => {
    mockHeadCountQueue.push({ count: 4231, error: null });
    await expect(store.getRecordCount()).resolves.toBe(4231);
  });

  test('returns 0 on error', async () => {
    mockHeadCountQueue.push({ count: 0, error: { message: 'DB error' } });
    await expect(store.getRecordCount()).resolves.toBe(0);
  });
});

describe('queryTrades', () => {
  function queueQuery(rows = [], total = 0, sourceRows = []) {
    mockHeadCountQueue.push({ count: total, error: null });
    mockSelectQueue.push({ data: rows, error: null });
    mockSelectQueue.push({ data: sourceRows, error: null });
  }

  test('returns paginated data', async () => {
    queueQuery([{ id: 1, ticker: 'AAPL', company_name: 'Apple Inc.', insider_name: 'Tim Cook', officer_title: 'CEO', transaction_type: 'Sell', shares: '100000', price_per_share: '215.5000', transaction_value: '21550000.00', holdings_after: '3000000', filing_date: new Date('2026-03-01'), filing_url: 'https://sec.gov/test', accession_number: '0001628280-26-019134', cik: '320193', source: 'SEC EDGAR', source_api: 'EFTS', created_at: new Date() }], 1, [{ source: 'SEC EDGAR' }]);
    const result = await store.queryTrades({ page: 1, limit: 50 });
    expect(result.total).toBe(1);
    expect(result.data).toHaveLength(1);
    expect(result.sources.edgar).toBe(1);
    expect(result.sources.finnhub).toBe(0);
  });

  test('enforces 90-day floor on from date', async () => {
    queueQuery([], 0, []);
    const from200 = new Date(Date.now() - 200 * 24 * 3600 * 1000).toISOString().split('T')[0];
    await store.queryTrades({ from: from200 });
    const effective = new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString().split('T')[0];
    expect(chains[0].__state.filters).toContainEqual(['gte', 'filing_date', effective]);
  });

  test('limits max records per page to 200', async () => {
    queueQuery([], 0, []);
    await store.queryTrades({ limit: 999 });
    expect(chains[1].__state.rangeArgs).toEqual([0, 199]);
  });

  test('applies ticker filter', async () => {
    queueQuery([], 0, []);
    await store.queryTrades({ symbol: 'nvda' });
    expect(chains[0].__state.filters).toContainEqual(['eq', 'ticker', 'NVDA']);
  });

  test('applies edgar source filter', async () => {
    queueQuery([], 0, []);
    await store.queryTrades({ source: 'edgar' });
    expect(chains[0].__state.filters).toContainEqual(['eq', 'source', 'SEC EDGAR']);
  });

  test('applies finnhub source filter', async () => {
    queueQuery([], 0, []);
    await store.queryTrades({ source: 'finnhub' });
    expect(chains[0].__state.filters).toContainEqual(['eq', 'source', 'Finnhub']);
  });
});

describe('runIngestionCycle', () => {
  test('runs ingestFromEdgar, ingestFromFinnhub, then pruneOldRecords', async () => {
    mockUpsertQueue.push({ error: null });
    mockSelectQueue.push({ data: [], error: null });
    mockUpsertQueue.push({ error: null });
    mockDeleteQueue.push({ count: 3, error: null });

    const result = await store.runIngestionCycle(
      [{ ticker: 'AAPL', name: 'Tim Cook', date: '2026-03-01', transactionType: 'Sell' }],
      [{ ticker: 'META', name: 'Mark Zuckerberg', date: '2026-03-12', transactionType: 'Sell' }]
    );

    expect(result.edgarResult.inserted).toBe(1);
    expect(result.finnhubResult.inserted).toBe(1);
    expect(result.pruned).toBe(3);
  });
});
