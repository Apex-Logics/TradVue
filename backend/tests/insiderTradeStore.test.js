/**
 * Tests: insiderTradeStore.js
 *
 * Verifies:
 * - ingestFromEdgar: inserts valid records, skips incomplete records
 * - ingestFromFinnhub: inserts valid records, skips if EDGAR record exists
 * - queryTrades: pagination, date filter, source filter, 90-day cap
 * - pruneOldRecords: deletes old records, keeps recent ones
 * - getRecordCount: returns total row count
 * - runIngestionCycle: runs both ingestions then prunes
 */

'use strict';

// Mock the db module before requiring the store
const mockQuery = jest.fn();
jest.mock('../services/db', () => ({
  query: mockQuery,
}));

const store = require('../services/insiderTradeStore');

beforeEach(() => {
  mockQuery.mockReset();
});

// ─── ingestFromEdgar ──────────────────────────────────────────────────────────

describe('ingestFromEdgar', () => {
  test('returns zeros for empty input', async () => {
    const result = await store.ingestFromEdgar([]);
    expect(result).toEqual({ inserted: 0, skipped: 0 });
    expect(mockQuery).not.toHaveBeenCalled();
  });

  test('skips records missing required fields', async () => {
    const trades = [
      { ticker: 'AAPL' },                          // missing name, date, type
      { ticker: '', name: 'John', date: '2026-01-01', transactionType: 'Buy' }, // empty ticker
      { ticker: 'MSFT', name: 'Jane', date: null, transactionType: 'Sell' },    // null date
    ];
    const result = await store.ingestFromEdgar(trades);
    expect(result.skipped).toBe(3);
    expect(result.inserted).toBe(0);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  test('inserts a valid EDGAR record', async () => {
    mockQuery.mockResolvedValueOnce({ rowCount: 1 }); // INSERT
    const trades = [{
      ticker: 'AAPL',
      name: 'Tim Cook',
      date: '2026-03-01',
      transactionType: 'Sell',
      companyName: 'Apple Inc.',
      officerTitle: 'CEO',
      shares: 100000,
      pricePerShare: 215.50,
      transactionValue: 21550000,
      holdingsAfter: 3000000,
      filingUrl: 'https://www.sec.gov/Archives/edgar/data/320193/000162828026019134/wk-form4.xml',
    }];
    const result = await store.ingestFromEdgar(trades);
    expect(result.inserted).toBe(1);
    expect(result.skipped).toBe(0);
    // Verify accession number was extracted from URL
    const callArgs = mockQuery.mock.calls[0][1];
    expect(callArgs[11]).toBe('0001628280-26-019134'); // accession_number
    expect(callArgs[12]).toBe('320193');                // cik
  });

  test('counts skipped when ON CONFLICT fires (rowCount 0)', async () => {
    mockQuery.mockResolvedValueOnce({ rowCount: 0 }); // conflict, no insert
    const trades = [{
      ticker: 'TSLA',
      name: 'Elon Musk',
      date: '2026-03-10',
      transactionType: 'Buy',
      filingUrl: null,
    }];
    const result = await store.ingestFromEdgar(trades);
    expect(result.inserted).toBe(0);
    expect(result.skipped).toBe(1);
  });

  test('uppercases ticker', async () => {
    mockQuery.mockResolvedValueOnce({ rowCount: 1 });
    const trades = [{
      ticker: 'nvda',
      name: 'Jensen Huang',
      date: '2026-03-05',
      transactionType: 'Sell',
    }];
    await store.ingestFromEdgar(trades);
    const callArgs = mockQuery.mock.calls[0][1];
    expect(callArgs[0]).toBe('NVDA');
  });
});

// ─── ingestFromFinnhub ────────────────────────────────────────────────────────

describe('ingestFromFinnhub', () => {
  test('returns zeros for empty input', async () => {
    const result = await store.ingestFromFinnhub([]);
    expect(result).toEqual({ inserted: 0, skipped: 0 });
  });

  test('skips if EDGAR record already exists for same trade', async () => {
    // First query = EDGAR dedup check, returns a hit
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 42 }] });
    const trades = [{
      ticker: 'AAPL',
      name: 'Tim Cook',
      date: '2026-03-01',
      transactionType: 'Sell',
    }];
    const result = await store.ingestFromFinnhub(trades);
    expect(result.skipped).toBe(1);
    expect(result.inserted).toBe(0);
    // INSERT should NOT have been called
    expect(mockQuery.mock.calls.length).toBe(1); // only the SELECT
  });

  test('inserts Finnhub record when no EDGAR duplicate', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] })         // EDGAR dedup check: no hit
      .mockResolvedValueOnce({ rowCount: 1 });     // INSERT
    const trades = [{
      ticker: 'META',
      name: 'Mark Zuckerberg',
      date: '2026-03-12',
      transactionType: 'Sell',
      shares: 500000,
    }];
    const result = await store.ingestFromFinnhub(trades);
    expect(result.inserted).toBe(1);
    expect(result.skipped).toBe(0);
  });

  test('skips records missing required fields', async () => {
    const trades = [
      { ticker: 'META', name: 'Mark', transactionType: 'Sell' }, // missing date
    ];
    const result = await store.ingestFromFinnhub(trades);
    expect(result.skipped).toBe(1);
    expect(mockQuery).not.toHaveBeenCalled();
  });
});

// ─── pruneOldRecords ──────────────────────────────────────────────────────────

describe('pruneOldRecords', () => {
  test('executes DELETE for records older than 90 days', async () => {
    mockQuery.mockResolvedValueOnce({ rowCount: 47 });
    const pruned = await store.pruneOldRecords();
    expect(pruned).toBe(47);
    const sql = mockQuery.mock.calls[0][0];
    expect(sql).toMatch(/DELETE FROM insider_trades/i);
    expect(sql).toMatch(/90 days/i);
  });

  test('returns 0 and does not throw on db error', async () => {
    mockQuery.mockRejectedValueOnce(new Error('DB error'));
    const pruned = await store.pruneOldRecords();
    expect(pruned).toBe(0);
  });
});

// ─── getRecordCount ───────────────────────────────────────────────────────────

describe('getRecordCount', () => {
  test('returns total row count', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ cnt: '4231' }] });
    const count = await store.getRecordCount();
    expect(count).toBe(4231);
  });

  test('returns 0 on error', async () => {
    mockQuery.mockRejectedValueOnce(new Error('DB error'));
    const count = await store.getRecordCount();
    expect(count).toBe(0);
  });
});

// ─── queryTrades ─────────────────────────────────────────────────────────────

describe('queryTrades', () => {
  function mockQueryResult(rows = [], total = 0, sourceCounts = []) {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ total: String(total) }] })  // COUNT
      .mockResolvedValueOnce({ rows })                              // data
      .mockResolvedValueOnce({ rows: sourceCounts });               // source breakdown
  }

  test('returns paginated data', async () => {
    const fakeRow = {
      id: 1, ticker: 'AAPL', company_name: 'Apple Inc.', insider_name: 'Tim Cook',
      officer_title: 'CEO', transaction_type: 'Sell', shares: '100000',
      price_per_share: '215.5000', transaction_value: '21550000.00', holdings_after: '3000000',
      filing_date: new Date('2026-03-01'), filing_url: 'https://sec.gov/test',
      accession_number: '0001628280-26-019134', cik: '320193',
      source: 'SEC EDGAR', source_api: 'EFTS', created_at: new Date(),
    };
    mockQueryResult([fakeRow], 1, [
      { source: 'SEC EDGAR', cnt: '1' },
    ]);
    const result = await store.queryTrades({ page: 1, limit: 50 });
    expect(result.total).toBe(1);
    expect(result.data).toHaveLength(1);
    expect(result.sources.edgar).toBe(1);
    expect(result.sources.finnhub).toBe(0);
  });

  test('enforces 90-day floor on from date', async () => {
    mockQueryResult([], 0, []);
    // from = 200 days ago — should be overridden to 90 days ago
    const from200 = new Date(Date.now() - 200 * 24 * 3600 * 1000).toISOString().split('T')[0];
    await store.queryTrades({ from: from200 });
    // The WHERE clause should include filing_date >= [90 days ago], not 200 days
    const countSql = mockQuery.mock.calls[0][0];
    expect(countSql).toMatch(/filing_date >= \$1/);
    const countParams = mockQuery.mock.calls[0][1];
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString().split('T')[0];
    expect(countParams[0]).toBe(ninetyDaysAgo);
  });

  test('limits max records per page to 200', async () => {
    mockQueryResult([], 0, []);
    await store.queryTrades({ limit: 999 });
    // LIMIT clause should be $idx with value 200
    const dataSql = mockQuery.mock.calls[1][0];
    const dataParams = mockQuery.mock.calls[1][1];
    // Last two params are limit and offset
    const limitParam = dataParams[dataParams.length - 2];
    expect(limitParam).toBe(200);
  });

  test('applies ticker filter', async () => {
    mockQueryResult([], 0, []);
    await store.queryTrades({ symbol: 'nvda' });
    const countParams = mockQuery.mock.calls[0][1];
    expect(countParams).toContain('NVDA');
  });

  test('applies edgar source filter', async () => {
    mockQueryResult([], 0, []);
    await store.queryTrades({ source: 'edgar' });
    const countSql = mockQuery.mock.calls[0][0];
    expect(countSql).toMatch(/source = 'SEC EDGAR'/);
  });

  test('applies finnhub source filter', async () => {
    mockQueryResult([], 0, []);
    await store.queryTrades({ source: 'finnhub' });
    const countSql = mockQuery.mock.calls[0][0];
    expect(countSql).toMatch(/source = 'Finnhub'/);
  });
});

// ─── runIngestionCycle ────────────────────────────────────────────────────────

describe('runIngestionCycle', () => {
  test('runs ingestFromEdgar, ingestFromFinnhub, then pruneOldRecords', async () => {
    // ingestFromEdgar: 1 INSERT
    mockQuery.mockResolvedValueOnce({ rowCount: 1 });
    // ingestFromFinnhub: EDGAR dedup check + INSERT
    mockQuery.mockResolvedValueOnce({ rows: [] });
    mockQuery.mockResolvedValueOnce({ rowCount: 1 });
    // pruneOldRecords: DELETE
    mockQuery.mockResolvedValueOnce({ rowCount: 3 });

    const edgarTrades = [{
      ticker: 'AAPL', name: 'Tim Cook', date: '2026-03-01', transactionType: 'Sell', filingUrl: null,
    }];
    const finnhubTrades = [{
      ticker: 'META', name: 'Mark Zuckerberg', date: '2026-03-12', transactionType: 'Sell',
    }];

    const result = await store.runIngestionCycle(edgarTrades, finnhubTrades);
    expect(result.edgarResult.inserted).toBe(1);
    expect(result.finnhubResult.inserted).toBe(1);
    expect(result.pruned).toBe(3);
    // Ensure all 4 DB calls were made
    expect(mockQuery).toHaveBeenCalledTimes(4);
  });
});
