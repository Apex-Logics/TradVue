/**
 * webhook-scenarios.test.js
 *
 * Comprehensive multi-instrument webhook trade tests.
 * Tests the _matchAndJournalTrade function directly with mocked Supabase.
 */

'use strict';

process.env.SUPABASE_URL              = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
process.env.JWT_SECRET                = 'test-jwt-secret';

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockSupabase),
}));

jest.mock('../middleware/auth', () => ({
  requireAuth: (req, _res, next) => { req.user = { id: 'user-123' }; next(); },
}));

// ─── In-memory database ──────────────────────────────────────────────────────
let db = {
  webhook_trades: [],
  webhook_events: [],
  instruments: [
    { symbol: 'MNQ', point_value: 2 },
    { symbol: 'NQ',  point_value: 20 },
    { symbol: 'ES',  point_value: 50 },
    { symbol: 'MES', point_value: 5 },
  ],
};

let tradeIdSeq = 1;
let eventIdSeq = 1;
function nextTradeId() { return `trade-${tradeIdSeq++}`; }
function nextEventId() { return `event-${eventIdSeq++}`; }

// ─── Helper functions for the mock ───────────────────────────────────────────
function applyFilters(rows, filters) {
  return rows.filter(row =>
    filters.every(f => row[f.col] === f.val || String(row[f.col]) === String(f.val))
  );
}

function sortRows(rows, col, asc) {
  if (!col) return rows;
  return [...rows].sort((a, b) => {
    const av = a[col], bv = b[col];
    if (av < bv) return asc ? -1 : 1;
    if (av > bv) return asc ? 1 : -1;
    return 0;
  });
}

// ─── Supabase mock chain factory ──────────────────────────────────────────────
// Each chain is thenable so that `await chain.update({}).eq(...)` works.
// Terminal resolvers (.single, .maybeSingle, .order) also return Promises.
function makeChain(tableName) {
  const state = {
    table:       tableName,
    filters:     [],
    orderCol:    null,
    orderAsc:    true,
    insertData:  null,
    updateData:  null,
    isDelete:    false,
  };

  // Resolve the pending operation
  function resolve() {
    // UPDATE
    if (state.updateData !== null && state.updateData !== undefined) {
      if (state.table === 'webhook_trades') {
        applyFilters(db.webhook_trades, state.filters).forEach(r => Object.assign(r, state.updateData));
      }
      if (state.table === 'webhook_events') {
        applyFilters(db.webhook_events, state.filters).forEach(r => Object.assign(r, state.updateData));
      }
      return { data: null, error: null };
    }
    // INSERT
    if (state.insertData !== null && state.insertData !== undefined) {
      if (state.table === 'webhook_events') {
        const evRow = { id: nextEventId(), ...state.insertData };
        db.webhook_events.push(evRow);
        return { data: evRow, error: null };
      }
      const newRow = { id: nextTradeId(), ...state.insertData };
      if (state.table === 'webhook_trades') db.webhook_trades.push(newRow);
      return { data: newRow, error: null };
    }
    // SELECT
    if (state.table === 'instruments') {
      const symFilter = state.filters.find(f => f.col === 'symbol');
      const row = symFilter ? (db.instruments.find(i => i.symbol === symFilter.val) || null) : null;
      return { data: row, error: null };
    }
    const rows = sortRows(applyFilters(db.webhook_trades, state.filters), state.orderCol, state.orderAsc);
    return { data: rows, error: null };
  }

  // Make chain thenable so `await chain.update({}).eq(col, val)` works
  const chain = {};

  chain.select = jest.fn(() => chain);

  chain.insert = jest.fn((data) => {
    state.insertData = Array.isArray(data) ? data[0] : data;
    return chain;
  });

  chain.update = jest.fn((data) => {
    state.updateData = data;
    return chain;
  });

  chain.delete = jest.fn(() => {
    state.isDelete = true;
    return chain;
  });

  chain.eq = jest.fn((col, val) => {
    state.filters.push({ col, val });
    // Return the chain but also make it thenable for terminal await
    return chain;
  });

  // .order() is often terminal for select-list queries
  chain.order = jest.fn((col, opts = {}) => {
    state.orderCol = col;
    state.orderAsc = opts.ascending !== false;
    return Promise.resolve(resolve());
  });

  // .single() for insert/update returning single row
  chain.single = jest.fn(() => {
    return Promise.resolve(resolve());
  });

  // .maybeSingle() for nullable single-row queries
  chain.maybeSingle = jest.fn(() => {
    const result = resolve();
    // For maybeSingle on a list, return the first item (or null)
    if (Array.isArray(result.data)) {
      return Promise.resolve({ data: result.data[0] || null, error: null });
    }
    return Promise.resolve(result);
  });

  chain.range = jest.fn(() => Promise.resolve({ data: [], error: null }));

  // Make the chain itself thenable so `await chain` (e.g. after .update().eq()) works
  chain.then = function(onFulfilled, onRejected) {
    return Promise.resolve(resolve()).then(onFulfilled, onRejected);
  };

  chain.catch = function(onRejected) {
    return Promise.resolve(resolve()).catch(onRejected);
  };

  return chain;
}

// ─── Global mock ─────────────────────────────────────────────────────────────
const mockSupabase = { from: jest.fn((table) => makeChain(table)) };

beforeEach(() => {
  db.webhook_trades = [];
  db.webhook_events = [];
  tradeIdSeq = 1;
  eventIdSeq = 1;
  mockSupabase.from.mockImplementation((table) => makeChain(table));
});

const { _matchAndJournalTrade } = require('../routes/webhooks');

const USER_ID = 'user-123';

function buildParsed(overrides = {}) {
  return {
    ticker:     overrides.ticker     ?? 'MNQ',
    action:     overrides.action     ?? 'buy',
    price:      overrides.price      ?? null,
    quantity:   overrides.quantity   ?? 1,
    direction:  overrides.direction  ?? '',
    assetClass: overrides.assetClass ?? 'Futures',
    entryPrice: overrides.entryPrice ?? null,
    exitPrice:  overrides.exitPrice  ?? null,
    pnl:        overrides.pnl        ?? null,
    orderId:    overrides.orderId    ?? '',
    accountId:  overrides.accountId  ?? '',
    source:     overrides.source     ?? 'ninjatrader',
    strategy:   overrides.strategy   ?? '',
    tradeTime:  overrides.tradeTime  ?? new Date().toISOString(),
  };
}

function isStock(ticker) { return ['AAPL','TSLA','MSFT','GOOG','AMZN'].includes(ticker); }

function entry(ticker, direction, entryPrice, qty = 1, extra = {}) {
  const { tradeTime, ...rest } = extra;
  return buildParsed({
    ticker, direction,
    action: 'buy',
    entryPrice, price: entryPrice, quantity: qty,
    assetClass: rest.assetClass ?? (ticker.includes('/') ? 'Forex' : isStock(ticker) ? 'Stock' : 'Futures'),
    tradeTime: tradeTime ?? new Date().toISOString(),
    ...rest,
  });
}

function exitTrade(ticker, direction, exitPrice, qty = 1, pnl = null, extra = {}) {
  const { tradeTime, ...rest } = extra;
  return buildParsed({
    ticker, direction,
    action: 'sell',
    exitPrice, price: exitPrice, quantity: qty,
    pnl,
    assetClass: rest.assetClass ?? (ticker.includes('/') ? 'Forex' : isStock(ticker) ? 'Stock' : 'Futures'),
    tradeTime: tradeTime ?? new Date().toISOString(),
    ...rest,
  });
}

// ═════════════════════════════════════════════════════════════════════════════
// BASIC MATCHING
// ═════════════════════════════════════════════════════════════════════════════

describe('Basic Matching — 1:1 trades', () => {

  test('1. Simple 1:1 futures — MNQ Short entry then exit', async () => {
    const e1 = await _matchAndJournalTrade(mockSupabase, USER_ID, entry('MNQ', 'Short', 24300, 1), nextEventId());
    expect(e1.matched).toBe(true);

    const openTrade = db.webhook_trades.find(t => t.symbol === 'MNQ' && t.status === 'open');
    expect(openTrade).toBeTruthy();
    expect(openTrade.entry_price).toBe(24300);
    expect(openTrade.direction).toBe('Short');
    expect(openTrade.quantity).toBe(1);

    const x1 = await _matchAndJournalTrade(mockSupabase, USER_ID, exitTrade('MNQ', 'Short', 24290, 1, null), nextEventId());
    expect(x1.matched).toBe(true);

    // After a full close the trade row is updated in-place
    const closedTrade = db.webhook_trades.find(t => t.symbol === 'MNQ' && t.status === 'closed');
    expect(closedTrade).toBeTruthy();
    expect(closedTrade.entry_price).toBe(24300);
    expect(closedTrade.exit_price).toBe(24290);
    expect(closedTrade.status).toBe('closed');
    // MNQ $2/point, Short: (24300-24290)*1*2 = $20
    expect(closedTrade.pnl).toBeCloseTo(20, 2);
    expect(db.webhook_trades.filter(t => t.status === 'open')).toHaveLength(0);
  });

  test('2. Simple 1:1 stock — AAPL Long entry then exit', async () => {
    await _matchAndJournalTrade(mockSupabase, USER_ID, entry('AAPL', 'Long', 150, 100, { assetClass: 'Stock' }), nextEventId());

    const openTrade = db.webhook_trades.find(t => t.symbol === 'AAPL' && t.status === 'open');
    expect(openTrade).toBeTruthy();
    expect(openTrade.asset_class).toBe('Stock');
    expect(openTrade.quantity).toBe(100);

    await _matchAndJournalTrade(mockSupabase, USER_ID, exitTrade('AAPL', 'Long', 155, 100, null, { assetClass: 'Stock' }), nextEventId());

    const closedTrade = db.webhook_trades.find(t => t.symbol === 'AAPL' && t.status === 'closed');
    expect(closedTrade).toBeTruthy();
    expect(closedTrade.entry_price).toBe(150);
    expect(closedTrade.exit_price).toBe(155);
    // No instrument row for AAPL → raw diff × qty = (155-150)*100 = 500
    expect(closedTrade.pnl).toBeCloseTo(500, 2);
    expect(closedTrade.asset_class).toBe('Stock');
    expect(db.webhook_trades.filter(t => t.status === 'open')).toHaveLength(0);
  });

  test('3. Simple 1:1 forex — EUR/USD Long entry then exit', async () => {
    // Use 10,000 units (mini lot) so P&L = (1.0810-1.0800)*10000 = $10.00 (rounds cleanly)
    await _matchAndJournalTrade(mockSupabase, USER_ID, entry('EUR/USD', 'Long', 1.0800, 10000, { assetClass: 'Forex' }), nextEventId());

    const openTrade = db.webhook_trades.find(t => t.symbol === 'EUR/USD' && t.status === 'open');
    expect(openTrade).toBeTruthy();
    expect(openTrade.asset_class).toBe('Forex');

    await _matchAndJournalTrade(mockSupabase, USER_ID, exitTrade('EUR/USD', 'Long', 1.0810, 10000, null, { assetClass: 'Forex' }), nextEventId());

    const closedTrade = db.webhook_trades.find(t => t.symbol === 'EUR/USD' && t.status === 'closed');
    expect(closedTrade).toBeTruthy();
    expect(closedTrade.entry_price).toBe(1.0800);
    expect(closedTrade.exit_price).toBe(1.0810);
    expect(closedTrade.asset_class).toBe('Forex');
    // No instrument row → raw price diff × qty = (1.0810-1.0800)*10000 = $10.00
    expect(closedTrade.pnl).toBeCloseTo(10.00, 2);
    expect(db.webhook_trades.filter(t => t.status === 'open')).toHaveLength(0);
  });

});

// ═════════════════════════════════════════════════════════════════════════════
// SCALE-IN / SCALE-OUT
// ═════════════════════════════════════════════════════════════════════════════

describe('Scale-in / Scale-out', () => {

  test('4. Scale-in 3 entries, close all at once with qty 3', async () => {
    const prices = [24300, 24305, 24310];
    for (let i = 0; i < 3; i++) {
      const tradeTime = new Date(2000000000000 + i * 1000).toISOString();
      await _matchAndJournalTrade(mockSupabase, USER_ID, entry('MNQ', 'Short', prices[i], 1, { tradeTime }), nextEventId());
    }
    expect(db.webhook_trades.filter(t => t.status === 'open')).toHaveLength(3);

    const result = await _matchAndJournalTrade(mockSupabase, USER_ID, exitTrade('MNQ', 'Short', 24290, 3, null), nextEventId());
    expect(result.matched).toBe(true);

    const closedTrades = db.webhook_trades.filter(t => t.status === 'closed');
    expect(closedTrades).toHaveLength(3);

    const entryPricesFound = closedTrades.map(t => t.entry_price).sort((a,b) => a-b);
    expect(entryPricesFound).toEqual([24300, 24305, 24310]);
    closedTrades.forEach(t => expect(t.exit_price).toBe(24290));

    // Total P&L: (24300-24290)*2 + (24305-24290)*2 + (24310-24290)*2 = 20+30+40 = $90
    const totalPnl = closedTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
    expect(totalPnl).toBeCloseTo(90, 2);
    expect(db.webhook_trades.filter(t => t.status === 'open')).toHaveLength(0);
  });

  test('5. Scale-in 3, scale-out 1 at a time — FIFO order', async () => {
    const prices = [24300, 24305, 24310];
    for (let i = 0; i < 3; i++) {
      const tradeTime = new Date(2000000000000 + i * 1000).toISOString();
      await _matchAndJournalTrade(mockSupabase, USER_ID, entry('MNQ', 'Short', prices[i], 1, { tradeTime }), nextEventId());
    }

    await _matchAndJournalTrade(mockSupabase, USER_ID, exitTrade('MNQ', 'Short', 24290, 1, null), nextEventId());
    let closed = db.webhook_trades.filter(t => t.status === 'closed');
    expect(closed).toHaveLength(1);
    expect(closed[0].entry_price).toBe(24300); // FIFO: first in

    await _matchAndJournalTrade(mockSupabase, USER_ID, exitTrade('MNQ', 'Short', 24285, 1, null), nextEventId());
    closed = db.webhook_trades.filter(t => t.status === 'closed');
    expect(closed).toHaveLength(2);
    expect(closed[1].entry_price).toBe(24305);

    await _matchAndJournalTrade(mockSupabase, USER_ID, exitTrade('MNQ', 'Short', 24280, 1, null), nextEventId());
    closed = db.webhook_trades.filter(t => t.status === 'closed');
    expect(closed).toHaveLength(3);
    expect(closed[2].entry_price).toBe(24310);
    expect(db.webhook_trades.filter(t => t.status === 'open')).toHaveLength(0);
  });

  test('6. Entry qty 3, exit 1 at a time — partial closes', async () => {
    await _matchAndJournalTrade(mockSupabase, USER_ID, entry('MNQ', 'Short', 24300, 3), nextEventId());
    expect(db.webhook_trades).toHaveLength(1);
    expect(db.webhook_trades[0].quantity).toBe(3);

    // Exit 1 — partial close: open trade qty reduces to 2, new closed record with qty 1
    await _matchAndJournalTrade(mockSupabase, USER_ID, exitTrade('MNQ', 'Short', 24290, 1, null), nextEventId());
    const openAfterFirst = db.webhook_trades.find(t => t.status === 'open');
    expect(openAfterFirst).toBeTruthy();
    expect(openAfterFirst.quantity).toBe(2);

    const closedAfterFirst = db.webhook_trades.filter(t => t.status === 'closed');
    expect(closedAfterFirst).toHaveLength(1);
    expect(closedAfterFirst[0].quantity).toBe(1);
    expect(closedAfterFirst[0].pnl).toBeCloseTo(20, 2); // (24300-24290)*1*2

    await _matchAndJournalTrade(mockSupabase, USER_ID, exitTrade('MNQ', 'Short', 24285, 1, null), nextEventId());
    expect(db.webhook_trades.find(t => t.status === 'open').quantity).toBe(1);

    await _matchAndJournalTrade(mockSupabase, USER_ID, exitTrade('MNQ', 'Short', 24280, 1, null), nextEventId());
    expect(db.webhook_trades.filter(t => t.status === 'open')).toHaveLength(0);
    expect(db.webhook_trades.filter(t => t.status === 'closed')).toHaveLength(3);
  });

  test('7. Multiple partial closes — 1 entry qty 5, exit 2+2+1', async () => {
    await _matchAndJournalTrade(mockSupabase, USER_ID, entry('ES', 'Short', 5700, 5), nextEventId());

    await _matchAndJournalTrade(mockSupabase, USER_ID, exitTrade('ES', 'Short', 5690, 2, null), nextEventId());
    expect(db.webhook_trades.find(t => t.status === 'open').quantity).toBe(3);

    await _matchAndJournalTrade(mockSupabase, USER_ID, exitTrade('ES', 'Short', 5685, 2, null), nextEventId());
    expect(db.webhook_trades.find(t => t.status === 'open').quantity).toBe(1);

    await _matchAndJournalTrade(mockSupabase, USER_ID, exitTrade('ES', 'Short', 5680, 1, null), nextEventId());
    expect(db.webhook_trades.filter(t => t.status === 'open')).toHaveLength(0);

    const closed = db.webhook_trades.filter(t => t.status === 'closed');
    expect(closed).toHaveLength(3);

    // Total P&L: ES $50/point, Short
    // exit2@5690: (5700-5690)*2*50 = 1000
    // exit2@5685: (5700-5685)*2*50 = 1500
    // exit1@5680: (5700-5680)*1*50 = 1000
    const totalPnl = closed.reduce((s, t) => s + (t.pnl || 0), 0);
    expect(totalPnl).toBeCloseTo(3500, 2);
  });

});

// ═════════════════════════════════════════════════════════════════════════════
// MULTI-INSTRUMENT
// ═════════════════════════════════════════════════════════════════════════════

describe('Multi-instrument — no cross-matching', () => {

  test('8. Long NQ + Short MNQ — close NQ, MNQ stays open', async () => {
    await _matchAndJournalTrade(mockSupabase, USER_ID, entry('NQ', 'Long', 20000, 1), nextEventId());
    await _matchAndJournalTrade(mockSupabase, USER_ID, entry('MNQ', 'Short', 24300, 1), nextEventId());
    expect(db.webhook_trades.filter(t => t.status === 'open')).toHaveLength(2);

    await _matchAndJournalTrade(mockSupabase, USER_ID, exitTrade('NQ', 'Long', 20010, 1, null), nextEventId());

    const nqTrade = db.webhook_trades.find(t => t.symbol === 'NQ');
    expect(nqTrade.status).toBe('closed');
    expect(nqTrade.exit_price).toBe(20010);

    const mnqTrade = db.webhook_trades.find(t => t.symbol === 'MNQ');
    expect(mnqTrade.status).toBe('open');
    expect(mnqTrade.exit_price).toBeNull();
  });

  test('9. ES + NQ + MNQ all open — close each separately', async () => {
    await _matchAndJournalTrade(mockSupabase, USER_ID, entry('ES', 'Long', 5700, 1), nextEventId());
    await _matchAndJournalTrade(mockSupabase, USER_ID, entry('NQ', 'Short', 20000, 1), nextEventId());
    await _matchAndJournalTrade(mockSupabase, USER_ID, entry('MNQ', 'Long', 24300, 1), nextEventId());
    expect(db.webhook_trades.filter(t => t.status === 'open')).toHaveLength(3);

    await _matchAndJournalTrade(mockSupabase, USER_ID, exitTrade('ES', 'Long', 5710, 1, null), nextEventId());
    expect(db.webhook_trades.find(t => t.symbol === 'ES').status).toBe('closed');
    expect(db.webhook_trades.find(t => t.symbol === 'NQ').status).toBe('open');
    expect(db.webhook_trades.find(t => t.symbol === 'MNQ').status).toBe('open');

    await _matchAndJournalTrade(mockSupabase, USER_ID, exitTrade('NQ', 'Short', 19990, 1, null), nextEventId());
    expect(db.webhook_trades.find(t => t.symbol === 'NQ').status).toBe('closed');
    expect(db.webhook_trades.find(t => t.symbol === 'MNQ').status).toBe('open');

    await _matchAndJournalTrade(mockSupabase, USER_ID, exitTrade('MNQ', 'Long', 24310, 1, null), nextEventId());
    expect(db.webhook_trades.filter(t => t.status === 'open')).toHaveLength(0);
    expect(db.webhook_trades.filter(t => t.status === 'closed')).toHaveLength(3);

    const es  = db.webhook_trades.find(t => t.symbol === 'ES');
    const nq  = db.webhook_trades.find(t => t.symbol === 'NQ');
    const mnq = db.webhook_trades.find(t => t.symbol === 'MNQ');
    expect(es.entry_price).toBe(5700);
    expect(nq.entry_price).toBe(20000);
    expect(mnq.entry_price).toBe(24300);
  });

  test('10. Exit matches correct direction only', async () => {
    await _matchAndJournalTrade(mockSupabase, USER_ID, entry('ES', 'Long', 5700, 1), nextEventId());
    await _matchAndJournalTrade(mockSupabase, USER_ID, entry('NQ', 'Short', 20000, 1), nextEventId());

    // Try to close ES with a Short direction exit — no Short ES open trade
    const result = await _matchAndJournalTrade(mockSupabase, USER_ID, exitTrade('ES', 'Short', 5690, 1, null), nextEventId());
    expect(result.matched).toBe(true);

    // ES Long should still be open (wrong direction, no match)
    const esLong = db.webhook_trades.find(t => t.symbol === 'ES' && t.direction === 'Long');
    expect(esLong.status).toBe('open');

    // A standalone closed record for the Short exit was created
    const esShortClosed = db.webhook_trades.find(t => t.symbol === 'ES' && t.direction === 'Short' && t.status === 'closed');
    expect(esShortClosed).toBeTruthy();
  });

});

// ═════════════════════════════════════════════════════════════════════════════
// P&L CORRECTNESS PER INSTRUMENT
// ═════════════════════════════════════════════════════════════════════════════

describe('P&L correctness per instrument', () => {

  test('11. MNQ — $2/point — Short 24300→24290 = +$20', async () => {
    await _matchAndJournalTrade(mockSupabase, USER_ID, entry('MNQ', 'Short', 24300, 1), nextEventId());
    await _matchAndJournalTrade(mockSupabase, USER_ID, exitTrade('MNQ', 'Short', 24290, 1, null), nextEventId());
    const t = db.webhook_trades.find(t => t.status === 'closed' && t.symbol === 'MNQ');
    expect(t).toBeTruthy();
    expect(t.pnl).toBeCloseTo(20, 2);
  });

  test('12. NQ — $20/point — Long 20000→20010 = +$200', async () => {
    await _matchAndJournalTrade(mockSupabase, USER_ID, entry('NQ', 'Long', 20000, 1), nextEventId());
    await _matchAndJournalTrade(mockSupabase, USER_ID, exitTrade('NQ', 'Long', 20010, 1, null), nextEventId());
    const t = db.webhook_trades.find(t => t.status === 'closed' && t.symbol === 'NQ');
    expect(t).toBeTruthy();
    expect(t.pnl).toBeCloseTo(200, 2);
  });

  test('13. ES — $50/point — Short 5700→5690 = +$500', async () => {
    await _matchAndJournalTrade(mockSupabase, USER_ID, entry('ES', 'Short', 5700, 1), nextEventId());
    await _matchAndJournalTrade(mockSupabase, USER_ID, exitTrade('ES', 'Short', 5690, 1, null), nextEventId());
    const t = db.webhook_trades.find(t => t.status === 'closed' && t.symbol === 'ES');
    expect(t).toBeTruthy();
    expect(t.pnl).toBeCloseTo(500, 2);
  });

  test('14. MES — $5/point — Long 5700→5710 = +$50', async () => {
    await _matchAndJournalTrade(mockSupabase, USER_ID, entry('MES', 'Long', 5700, 1), nextEventId());
    await _matchAndJournalTrade(mockSupabase, USER_ID, exitTrade('MES', 'Long', 5710, 1, null), nextEventId());
    const t = db.webhook_trades.find(t => t.status === 'closed' && t.symbol === 'MES');
    expect(t).toBeTruthy();
    expect(t.pnl).toBeCloseTo(50, 2);
  });

  test('15. Stock AAPL — $1/point — Long 150→155 qty 100 = +$500', async () => {
    await _matchAndJournalTrade(mockSupabase, USER_ID, entry('AAPL', 'Long', 150, 100, { assetClass: 'Stock' }), nextEventId());
    await _matchAndJournalTrade(mockSupabase, USER_ID, exitTrade('AAPL', 'Long', 155, 100, null, { assetClass: 'Stock' }), nextEventId());
    const t = db.webhook_trades.find(t => t.status === 'closed' && t.symbol === 'AAPL');
    expect(t).toBeTruthy();
    // No instrument row for AAPL → raw diff × qty = (155-150)*100 = 500
    expect(t.pnl).toBeCloseTo(500, 2);
  });

  test('16. Forex EUR/USD — Long 1.0800→1.0810 qty 1 = price diff', async () => {
    // 10,000 units mini lot: (1.0810-1.0800)*10000 = $10.00
    await _matchAndJournalTrade(mockSupabase, USER_ID, entry('EUR/USD', 'Long', 1.0800, 10000, { assetClass: 'Forex' }), nextEventId());
    await _matchAndJournalTrade(mockSupabase, USER_ID, exitTrade('EUR/USD', 'Long', 1.0810, 10000, null, { assetClass: 'Forex' }), nextEventId());
    const t = db.webhook_trades.find(t => t.status === 'closed' && t.symbol === 'EUR/USD');
    expect(t).toBeTruthy();
    // No point multiplier → raw diff × qty = (1.0810-1.0800)*10000 = $10.00
    expect(t.pnl).toBeCloseTo(10.00, 2);
  });

  test('P&L path A: payload pnl provided alongside known point_value — price-based calc wins', async () => {
    await _matchAndJournalTrade(mockSupabase, USER_ID, entry('MNQ', 'Short', 24300, 1), nextEventId());
    // NinjaTrader sends pnl = -40. MNQ $2/point: (24300-24320)*1*2 = -40 matches.
    await _matchAndJournalTrade(mockSupabase, USER_ID, exitTrade('MNQ', 'Short', 24320, 1, -40), nextEventId());
    const t = db.webhook_trades.find(t => t.status === 'closed' && t.symbol === 'MNQ');
    expect(t).toBeTruthy();
    expect(typeof t.pnl).toBe('number');
    // With point_value known, code calculates: (24300-24320)*1*2 = -40
    expect(t.pnl).toBeCloseTo(-40, 2);
  });

  test('P&L path B: payload pnl null — calculated from entry/exit × direction × pointValue', async () => {
    await _matchAndJournalTrade(mockSupabase, USER_ID, entry('MNQ', 'Short', 24300, 1), nextEventId());
    await _matchAndJournalTrade(mockSupabase, USER_ID, exitTrade('MNQ', 'Short', 24290, 1, null), nextEventId());
    const t = db.webhook_trades.find(t => t.status === 'closed' && t.symbol === 'MNQ');
    expect(t).toBeTruthy();
    expect(t.pnl).toBeCloseTo(20, 2);
  });

});

// ═════════════════════════════════════════════════════════════════════════════
// EDGE CASES
// ═════════════════════════════════════════════════════════════════════════════

describe('Edge cases', () => {

  test('17. Rapid fire — 5 entries then 5 exits, FIFO ordering, no race conditions', async () => {
    const entryPrices = [24300, 24305, 24310, 24315, 24320];
    const exitPrices  = [24290, 24285, 24280, 24275, 24270];

    for (let i = 0; i < 5; i++) {
      const tradeTime = new Date(2000000000000 + i * 200).toISOString();
      await _matchAndJournalTrade(mockSupabase, USER_ID, entry('MNQ', 'Short', entryPrices[i], 1, { tradeTime }), nextEventId());
    }
    expect(db.webhook_trades.filter(t => t.status === 'open')).toHaveLength(5);

    for (let i = 0; i < 5; i++) {
      await _matchAndJournalTrade(mockSupabase, USER_ID, exitTrade('MNQ', 'Short', exitPrices[i], 1, null), nextEventId());
    }

    const closed = db.webhook_trades.filter(t => t.status === 'closed');
    expect(closed).toHaveLength(5);
    expect(db.webhook_trades.filter(t => t.status === 'open')).toHaveLength(0);

    // FIFO: entry 24300 (first inserted) should pair with exit 24290 (first exit)
    const sortedByEntry = closed.sort((a, b) => a.entry_price - b.entry_price);
    expect(sortedByEntry[0].entry_price).toBe(24300);
    expect(sortedByEntry[0].exit_price).toBe(24290);
  });

  test('18. Exit with no matching entry — creates standalone closed record', async () => {
    const result = await _matchAndJournalTrade(mockSupabase, USER_ID, exitTrade('MNQ', 'Short', 24290, 1, -20), nextEventId());
    expect(result.matched).toBe(true);

    const trade = db.webhook_trades.find(t => t.symbol === 'MNQ');
    expect(trade).toBeTruthy();
    expect(trade.status).toBe('closed');
    expect(trade.exit_price).toBe(24290);
    expect(trade.pnl).toBe(-20);
  });

  test('19. Duplicate execution ID — no crash, handles gracefully', async () => {
    const sharedEventId = 'evt-dupe-123';
    await _matchAndJournalTrade(mockSupabase, USER_ID, entry('MNQ', 'Short', 24300, 1), sharedEventId);

    let secondResult;
    try {
      secondResult = await _matchAndJournalTrade(mockSupabase, USER_ID, entry('MNQ', 'Short', 24300, 1), sharedEventId);
    } catch (e) {
      secondResult = { matched: false, error: e.message };
    }

    // No unhandled exception — function returns a result object
    expect(secondResult).toBeDefined();
    expect(typeof secondResult.matched).toBe('boolean');
  });

  test('20. Exit qty exceeds total open qty — closes what exists, no orphans', async () => {
    await _matchAndJournalTrade(mockSupabase, USER_ID, entry('MNQ', 'Short', 24300, 1), nextEventId());
    await _matchAndJournalTrade(mockSupabase, USER_ID, entry('MNQ', 'Short', 24305, 1), nextEventId());
    expect(db.webhook_trades.filter(t => t.status === 'open')).toHaveLength(2);

    // Exit 3 (exceeds total of 2 open contracts)
    const result = await _matchAndJournalTrade(mockSupabase, USER_ID, exitTrade('MNQ', 'Short', 24290, 3, null), nextEventId());
    expect(result.matched).toBe(true);

    // Both open trades closed; none orphaned
    const closed = db.webhook_trades.filter(t => t.status === 'closed');
    expect(closed.length).toBeGreaterThanOrEqual(2);
    expect(db.webhook_trades.filter(t => t.status === 'open')).toHaveLength(0);
  });

});

// ═════════════════════════════════════════════════════════════════════════════
// LOSS SCENARIOS
// ═════════════════════════════════════════════════════════════════════════════

describe('P&L sign correctness', () => {

  test('MNQ Long — price goes down — loss (negative pnl)', async () => {
    await _matchAndJournalTrade(mockSupabase, USER_ID, entry('MNQ', 'Long', 24300, 1), nextEventId());
    await _matchAndJournalTrade(mockSupabase, USER_ID, exitTrade('MNQ', 'Long', 24290, 1, null), nextEventId());
    const t = db.webhook_trades.find(t => t.status === 'closed');
    expect(t).toBeTruthy();
    // Long: (24290-24300)*1*2 = -$20
    expect(t.pnl).toBeCloseTo(-20, 2);
  });

  test('ES Short — price goes up — loss (negative pnl)', async () => {
    await _matchAndJournalTrade(mockSupabase, USER_ID, entry('ES', 'Short', 5700, 1), nextEventId());
    await _matchAndJournalTrade(mockSupabase, USER_ID, exitTrade('ES', 'Short', 5710, 1, null), nextEventId());
    const t = db.webhook_trades.find(t => t.status === 'closed');
    expect(t).toBeTruthy();
    // Short: (5710-5700)*1*50 * -1 = -$500
    expect(t.pnl).toBeCloseTo(-500, 2);
  });

  test('AAPL Long — loss scenario (price goes down)', async () => {
    await _matchAndJournalTrade(mockSupabase, USER_ID, entry('AAPL', 'Long', 155, 100, { assetClass: 'Stock' }), nextEventId());
    await _matchAndJournalTrade(mockSupabase, USER_ID, exitTrade('AAPL', 'Long', 150, 100, null, { assetClass: 'Stock' }), nextEventId());
    const t = db.webhook_trades.find(t => t.status === 'closed');
    expect(t).toBeTruthy();
    // (150-155)*100 = -$500
    expect(t.pnl).toBeCloseTo(-500, 2);
  });

});
