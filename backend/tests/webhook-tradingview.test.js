/**
 * webhook-tradingview.test.js
 *
 * Comprehensive TradingView webhook integration tests.
 * Covers all TV-specific payload formats, trading scenarios, edge cases, and P&L.
 *
 * Mirrors the quality standard of webhook-scenarios.test.js (25+ scenarios).
 * Tests both the HTTP receiver route and the _matchAndJournalTrade core logic.
 */

'use strict';

process.env.SUPABASE_URL              = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
process.env.JWT_SECRET                = 'test-jwt-secret';

const request = require('supertest');
const express = require('express');
const crypto  = require('crypto');

// ── In-memory database ────────────────────────────────────────────────────────
let db = {
  webhook_trades: [],
  webhook_events: [],
  instruments: [
    { symbol: 'MNQ', point_value: 2 },
    { symbol: 'NQ',  point_value: 20 },
    { symbol: 'ES',  point_value: 50 },
    // AAPL, TSLA, NVDA intentionally absent → stock P&L = (exit-entry)*qty
  ],
};

let tradeIdSeq = 1;
let eventIdSeq = 1;
function nextTradeId() { return `tv-trade-${tradeIdSeq++}`; }
function nextEventId() { return `tv-event-${eventIdSeq++}`; }

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

function makeChain(tableName) {
  const state = {
    table:      tableName,
    filters:    [],
    orderCol:   null,
    orderAsc:   true,
    insertData: null,
    updateData: null,
  };

  function resolve() {
    if (state.updateData !== null && state.updateData !== undefined) {
      if (state.table === 'webhook_trades') {
        applyFilters(db.webhook_trades, state.filters).forEach(r => Object.assign(r, state.updateData));
      }
      if (state.table === 'webhook_events') {
        applyFilters(db.webhook_events, state.filters).forEach(r => Object.assign(r, state.updateData));
      }
      return { data: null, error: null };
    }
    if (state.insertData !== null && state.insertData !== undefined) {
      if (state.table === 'webhook_events') {
        const evRow = { id: nextEventId(), ...state.insertData };
        db.webhook_events.push(evRow);
        return { data: evRow, error: null };
      }
      if (state.table === 'webhook_trades') {
        const newRow = { id: nextTradeId(), ...state.insertData };
        db.webhook_trades.push(newRow);
        return { data: newRow, error: null };
      }
      if (state.table === 'webhook_tokens') {
        return { data: { id: 99, token: 'gen-token', label: 'Test', is_active: true, created_at: new Date().toISOString() }, error: null };
      }
      return { data: { id: nextTradeId(), ...state.insertData }, error: null };
    }
    if (state.table === 'instruments') {
      const symFilter = state.filters.find(f => f.col === 'symbol');
      const row = symFilter ? (db.instruments.find(i => i.symbol === symFilter.val) || null) : null;
      return { data: row, error: null };
    }
    if (state.table === 'webhook_tokens') {
      return { data: [], count: 0, error: null };
    }
    const rows = sortRows(applyFilters(db.webhook_trades, state.filters), state.orderCol, state.orderAsc);
    return { data: rows, error: null };
  }

  const chain = {};
  chain.select      = jest.fn(() => chain);
  chain.insert      = jest.fn((data) => { state.insertData = Array.isArray(data) ? data[0] : data; return chain; });
  chain.update      = jest.fn((data) => { state.updateData = data; return chain; });
  chain.delete      = jest.fn(() => chain);
  chain.eq          = jest.fn((col, val) => { state.filters.push({ col, val }); return chain; });
  chain.order       = jest.fn((col, opts = {}) => {
    state.orderCol = col;
    state.orderAsc = opts.ascending !== false;
    return Promise.resolve(resolve());
  });
  chain.single      = jest.fn(() => Promise.resolve(resolve()));
  chain.maybeSingle = jest.fn(() => {
    const result = resolve();
    if (Array.isArray(result.data)) {
      return Promise.resolve({ data: result.data[0] || null, error: null });
    }
    return Promise.resolve(result);
  });
  chain.range = jest.fn(() => Promise.resolve({ data: [], error: null }));
  chain.limit = jest.fn(() => chain);
  chain.then  = (ok, err) => Promise.resolve(resolve()).then(ok, err);
  chain.catch = (err) => Promise.resolve(resolve()).catch(err);

  return chain;
}

const mockSupabase = { from: jest.fn((table) => makeChain(table)) };

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockSupabase),
}));

jest.mock('../middleware/auth', () => ({
  requireAuth: (req, _res, next) => { req.user = { id: 'tv-user-123' }; next(); },
}));

beforeEach(() => {
  db.webhook_trades = [];
  db.webhook_events = [];
  tradeIdSeq = 1;
  eventIdSeq = 1;
  mockSupabase.from.mockImplementation((table) => makeChain(table));
});

const { receiverRouter, managementRouter, _matchAndJournalTrade, parsePayload } = require('../routes/webhooks');

function buildApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.use('/api/webhook', receiverRouter);
  app.use('/api/webhooks', managementRouter);
  return app;
}

const TV_IP    = '52.89.214.238';
const LOCAL_IP = '127.0.0.1';
const BAD_IP   = '1.2.3.4';
const USER_ID  = 'tv-user-123';

function buildParsed(overrides = {}) {
  return {
    ticker:     overrides.ticker     !== undefined ? overrides.ticker     : 'AAPL',
    action:     overrides.action     !== undefined ? overrides.action     : 'buy',
    price:      overrides.price      !== undefined ? overrides.price      : null,
    quantity:   overrides.quantity   !== undefined ? overrides.quantity   : 1,
    direction:  overrides.direction  !== undefined ? overrides.direction  : '',
    assetClass: overrides.assetClass !== undefined ? overrides.assetClass : 'Stock',
    entryPrice: overrides.entryPrice !== undefined ? overrides.entryPrice : null,
    exitPrice:  overrides.exitPrice  !== undefined ? overrides.exitPrice  : null,
    pnl:        overrides.pnl        !== undefined ? overrides.pnl        : null,
    orderId:    overrides.orderId    !== undefined ? overrides.orderId    : '',
    accountId:  overrides.accountId  !== undefined ? overrides.accountId  : '',
    source:     overrides.source     !== undefined ? overrides.source     : 'tradingview',
    strategy:   overrides.strategy   !== undefined ? overrides.strategy   : '',
    tradeTime:  overrides.tradeTime  !== undefined ? overrides.tradeTime  : new Date().toISOString(),
  };
}

function stockEntry(ticker, direction, price, qty, extra) {
  qty = qty !== undefined ? qty : 1;
  extra = extra || {};
  return buildParsed(Object.assign({ ticker, direction, action: 'buy', price, entryPrice: price, quantity: qty, assetClass: 'Stock' }, extra));
}

function stockExit(ticker, direction, price, qty, pnl, extra) {
  qty = qty !== undefined ? qty : 1;
  pnl = pnl !== undefined ? pnl : null;
  extra = extra || {};
  return buildParsed(Object.assign({ ticker, direction, action: 'sell', price, exitPrice: price, quantity: qty, pnl, assetClass: 'Stock' }, extra));
}

// ═══════════════════════════════════════════════════════════════════════════════
// PART 1: PAYLOAD PARSER UNIT TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe('TV-1: Payload Parser — format coverage', () => {

  test('TV-1.1: Simple JSON with qty field', () => {
    const result = parsePayload(JSON.stringify({
      ticker: 'AAPL', action: 'buy', price: 185.50, qty: 100
    }));
    expect(result).not.toBeNull();
    expect(result.ticker).toBe('AAPL');
    expect(result.action).toBe('buy');
    expect(result.price).toBe(185.50);
    expect(result.quantity).toBe(100);
  });

  test('TV-1.2: Strategy placeholders — contracts field parsed as quantity', () => {
    const result = parsePayload(JSON.stringify({
      ticker: 'AAPL', action: 'buy', price: 185.50,
      contracts: 100, order_id: 'Long', position_size: 100
    }));
    expect(result).not.toBeNull();
    expect(result.quantity).toBe(100);
    expect(result.orderId).toBe('Long');
  });

  test('TV-1.3: Pine Script alert_message — "entry_long" → action=buy', () => {
    const result = parsePayload(JSON.stringify({
      message: 'entry_long', ticker: 'AAPL', price: 185.50
    }));
    expect(result).not.toBeNull();
    expect(result.ticker).toBe('AAPL');
    expect(result.action).toBe('buy');
    expect(result.price).toBe(185.50);
  });

  test('TV-1.4: Pine Script alert_message — "exit_short" → action=sell', () => {
    const result = parsePayload(JSON.stringify({
      message: 'exit_short', ticker: 'TSLA', price: 360.00
    }));
    expect(result).not.toBeNull();
    expect(result.action).toBe('sell');
  });

  test('TV-1.5: Plain text format "buy AAPL 185.50 100"', () => {
    const result = parsePayload('buy AAPL 185.50 100');
    expect(result).not.toBeNull();
    expect(result.ticker).toBe('AAPL');
    expect(result.action).toBe('buy');
    expect(result.price).toBe(185.50);
    expect(result.quantity).toBe(100);
  });

  test('TV-1.6: Complex JSON with position field', () => {
    const result = parsePayload(JSON.stringify({
      ticker: 'AAPL', action: 'buy', price: 185.50,
      qty: 100, position: 'long'
    }));
    expect(result).not.toBeNull();
    expect(result.position).toBe('long');
    expect(result.quantity).toBe(100);
  });

  test('TV-1.7: Full Pine Script strategy payload', () => {
    const result = parsePayload(JSON.stringify({
      ticker: 'AAPL', action: 'buy', price: 185.50,
      qty: 100, position_size: 100, order_id: 'Long',
      time: '2024-01-15T14:30:00Z', source: 'tradingview'
    }));
    expect(result).not.toBeNull();
    expect(result.source).toBe('tradingview');
    expect(result.quantity).toBe(100);
  });

  test('TV-1.8: Missing ticker → null', () => {
    expect(parsePayload(JSON.stringify({ action: 'buy', price: 185 }))).toBeNull();
  });

  test('TV-1.9: Empty/null body → null', () => {
    expect(parsePayload('')).toBeNull();
    expect(parsePayload(null)).toBeNull();
  });

  test('TV-1.10: Plain text without quantity still parses', () => {
    const result = parsePayload('sell TSLA 370');
    expect(result).not.toBeNull();
    expect(result.ticker).toBe('TSLA');
    expect(result.action).toBe('sell');
    expect(result.quantity).toBeNull();
  });

  // ── Regression (P0 2026-09 #4): Pine exit_long must parse as exit/sell ──────
  // Bug: the message parser checked `long` (buy) before `exit`, so an
  // `exit_long` alert was misread as a BUY/entry instead of a SELL/exit,
  // opening a phantom position instead of closing the real one.
  test('TV-1.11: Pine alert_message "exit_long" → action=sell (not buy)', () => {
    const result = parsePayload(JSON.stringify({
      message: 'exit_long', ticker: 'AAPL', price: 190.00
    }));
    expect(result).not.toBeNull();
    expect(result.ticker).toBe('AAPL');
    expect(result.action).toBe('sell');
  });

  test('TV-1.12: Pine alert_message "entry_long" still → action=buy', () => {
    const result = parsePayload(JSON.stringify({
      message: 'entry_long', ticker: 'AAPL', price: 185.50
    }));
    expect(result).not.toBeNull();
    expect(result.action).toBe('buy');
  });

  test('TV-1.13: Pine alert_message "exit_short" still → action=sell', () => {
    const result = parsePayload(JSON.stringify({
      message: 'exit_short', ticker: 'TSLA', price: 360.00
    }));
    expect(result).not.toBeNull();
    expect(result.action).toBe('sell');
  });

  test('TV-1.14: Pine alert_message "close_long" → action=sell', () => {
    const result = parsePayload(JSON.stringify({
      message: 'close_long', ticker: 'NVDA', price: 900.00
    }));
    expect(result).not.toBeNull();
    expect(result.action).toBe('sell');
  });

  test('TV-1.15: bare "long"/"short" direction words unchanged (long→buy, short→sell)', () => {
    const longResult = parsePayload(JSON.stringify({ message: 'long', ticker: 'AAPL', price: 100 }));
    const shortResult = parsePayload(JSON.stringify({ message: 'short', ticker: 'AAPL', price: 100 }));
    expect(longResult.action).toBe('buy');
    expect(shortResult.action).toBe('sell');
  });

});

// ═══════════════════════════════════════════════════════════════════════════════
// PART 2: HTTP RECEIVER — IP ALLOWLIST
// ═══════════════════════════════════════════════════════════════════════════════

describe('TV-2: IP Allowlist', () => {
  let app;
  beforeAll(() => { app = buildApp(); });
  const TOKEN = crypto.randomBytes(16).toString('hex');

  test('TV-2.1: Non-TradingView IP rejected (403)', async () => {
    const res = await request(app)
      .post('/api/webhook/tv/' + TOKEN)
      .set('X-Forwarded-For', BAD_IP)
      .send('buy AAPL 185 100');
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Forbidden');
  });

  test('TV-2.2: Private 192.168.x.x IP rejected', async () => {
    const res = await request(app)
      .post('/api/webhook/tv/' + TOKEN)
      .set('X-Forwarded-For', '192.168.1.1')
      .send('buy AAPL 185 100');
    expect(res.status).toBe(403);
  });

  test('TV-2.3: All 4 TradingView IPs accepted', async () => {
    const tvIPs = ['52.89.214.238', '34.212.75.30', '54.218.53.128', '52.32.178.7'];
    for (const ip of tvIPs) {
      const res = await request(app)
        .post('/api/webhook/tv/' + TOKEN)
        .set('X-Forwarded-For', ip)
        .send('buy AAPL 185 100');
      expect(res.status).toBe(200);
    }
  });

  test('TV-2.4: Localhost accepted for dev/CI', async () => {
    const res = await request(app)
      .post('/api/webhook/tv/' + TOKEN)
      .set('X-Forwarded-For', LOCAL_IP)
      .send('buy AAPL 185 100');
    expect(res.status).toBe(200);
  });

  test('TV-2.5: Forwarded list — last untrusted hop (TV first + other last = blocked)', async () => {
    const res = await request(app)
      .post('/api/webhook/tv/' + TOKEN)
      .set('X-Forwarded-For', TV_IP + ', 10.0.0.1')
      .send('sell AAPL 190 100');
    expect(res.status).toBe(403);
  });

  test('TV-2.6: Forwarded list — spoofed 1.2.3.4 first does not win; TV last is allowed', async () => {
    const res = await request(app)
      .post('/api/webhook/tv/' + TOKEN)
      .set('X-Forwarded-For', BAD_IP + ', ' + TV_IP)
      .send('sell AAPL 190 100');
    expect(res.status).toBe(200);
  });

});

// ═══════════════════════════════════════════════════════════════════════════════
// PART 3: 3-SECOND TIMEOUT COMPLIANCE
// ═══════════════════════════════════════════════════════════════════════════════

describe('TV-3: Immediate 200 response (3-second timeout)', () => {
  let app;
  beforeAll(() => { app = buildApp(); });
  const TOKEN = crypto.randomBytes(16).toString('hex');

  test('TV-3.1: Returns 200 immediately for invalid token', async () => {
    const start = Date.now();
    const res = await request(app)
      .post('/api/webhook/tv/invalid-token-xyz')
      .set('X-Forwarded-For', LOCAL_IP)
      .send('buy AAPL 185 100');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(Date.now() - start).toBeLessThan(3000);
  });

  test('TV-3.2: Returns 200 immediately for valid token (processing is async)', async () => {
    const res = await request(app)
      .post('/api/webhook/tv/' + TOKEN)
      .set('X-Forwarded-For', LOCAL_IP)
      .send(JSON.stringify({ ticker: 'AAPL', action: 'buy', price: 185, qty: 100 }));
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  test('TV-3.3: NT route synchronously validates token before responding', async () => {
    // NT has no 3s constraint — returns 401 for bad tokens before sending response
    const res = await request(app)
      .post('/api/webhook/nt/invalid-token-xyz')
      .set('Content-Type', 'text/plain')
      .send('buy AAPL 185 100');
    expect(res.status).toBe(401);
  });

});

// ═══════════════════════════════════════════════════════════════════════════════
// PART 4: RATE LIMITING
// ═══════════════════════════════════════════════════════════════════════════════

describe('TV-4: Rate limiting — 30 req/min per token', () => {
  let app;
  beforeAll(() => { app = buildApp(); });

  test('TV-4.1: Exactly 30 allowed, 31st is 429', async () => {
    const token = crypto.randomBytes(16).toString('hex');
    for (let i = 0; i < 30; i++) {
      const res = await request(app)
        .post('/api/webhook/tv/' + token)
        .set('X-Forwarded-For', LOCAL_IP)
        .send('buy AAPL 185');
      expect(res.status).toBe(200);
    }
    const res = await request(app)
      .post('/api/webhook/tv/' + token)
      .set('X-Forwarded-For', LOCAL_IP)
      .send('buy AAPL 185');
    expect(res.status).toBe(429);
  });

  test('TV-4.2: Different tokens have independent counters', async () => {
    const tokenA = crypto.randomBytes(16).toString('hex');
    const tokenB = crypto.randomBytes(16).toString('hex');
    for (let i = 0; i < 30; i++) {
      await request(app)
        .post('/api/webhook/tv/' + tokenA)
        .set('X-Forwarded-For', LOCAL_IP)
        .send('buy AAPL 185');
    }
    const res = await request(app)
      .post('/api/webhook/tv/' + tokenB)
      .set('X-Forwarded-For', LOCAL_IP)
      .send('buy AAPL 185');
    expect(res.status).toBe(200);
  });

});

// ═══════════════════════════════════════════════════════════════════════════════
// PART 5: PAYLOAD SIZE & EDGE CASES
// ═══════════════════════════════════════════════════════════════════════════════

describe('TV-5: Payload size and edge cases', () => {
  let app;
  beforeAll(() => { app = buildApp(); });
  const TOKEN = crypto.randomBytes(16).toString('hex');

  test('TV-5.1: Payload over 10KB rejected (413)', async () => {
    const bigPayload = 'x'.repeat(11 * 1024);
    const res = await request(app)
      .post('/api/webhook/tv/' + TOKEN)
      .set('X-Forwarded-For', LOCAL_IP)
      .set('Content-Type', 'text/plain')
      .send(bigPayload);
    expect(res.status).toBe(413);
  });

  test('TV-5.2: Empty body — returns 200, no crash', async () => {
    const res = await request(app)
      .post('/api/webhook/tv/' + TOKEN)
      .set('X-Forwarded-For', LOCAL_IP)
      .set('Content-Type', 'text/plain')
      .send('');
    expect(res.status).toBe(200);
  });

  test('TV-5.3: Malformed JSON — returns 200, handles gracefully', async () => {
    const res = await request(app)
      .post('/api/webhook/tv/' + TOKEN)
      .set('X-Forwarded-For', LOCAL_IP)
      .set('Content-Type', 'application/json')
      .send('{ invalid json here');
    expect(res.status).toBe(200);
  });

});

// ═══════════════════════════════════════════════════════════════════════════════
// PART 6: SIMPLE 1:1 STOCK ENTRY/EXIT
// ═══════════════════════════════════════════════════════════════════════════════

describe('TV-6: Simple 1:1 stock trade lifecycle', () => {

  test('TV-6.1: AAPL Long entry then exit', async () => {
    const e1 = await _matchAndJournalTrade(
      mockSupabase, USER_ID,
      stockEntry('AAPL', 'Long', 185, 100),
      nextEventId()
    );
    expect(e1.matched).toBe(true);

    const openTrade = db.webhook_trades.find(t => t.symbol === 'AAPL' && t.status === 'open');
    expect(openTrade).toBeTruthy();
    expect(openTrade.direction).toBe('Long');
    expect(openTrade.entry_price).toBe(185);
    expect(openTrade.quantity).toBe(100);
    expect(openTrade.source).toBe('tradingview');

    const x1 = await _matchAndJournalTrade(
      mockSupabase, USER_ID,
      stockExit('AAPL', 'Long', 190, 100),
      nextEventId()
    );
    expect(x1.matched).toBe(true);

    const closedTrade = db.webhook_trades.find(t => t.symbol === 'AAPL' && t.status === 'closed');
    expect(closedTrade).toBeTruthy();
    expect(closedTrade.entry_price).toBe(185);
    expect(closedTrade.exit_price).toBe(190);
    expect(closedTrade.pnl).toBeCloseTo(500, 2);
    expect(db.webhook_trades.filter(t => t.status === 'open')).toHaveLength(0);
  });

});

// ═══════════════════════════════════════════════════════════════════════════════
// PART 7: SCALE-IN 3, CLOSE ALL AT ONCE
// ═══════════════════════════════════════════════════════════════════════════════

describe('TV-7: Scale-in 3 entries, close all at once', () => {

  test('TV-7.1: AAPL Long — 3 entries then qty=3 exit', async () => {
    var prices = [185, 186, 187];
    for (var i = 0; i < 3; i++) {
      var tradeTime = new Date(2000000000000 + i * 1000).toISOString();
      await _matchAndJournalTrade(
        mockSupabase, USER_ID,
        stockEntry('AAPL', 'Long', prices[i], 1, { tradeTime: tradeTime }),
        nextEventId()
      );
    }
    expect(db.webhook_trades.filter(t => t.status === 'open')).toHaveLength(3);

    const result = await _matchAndJournalTrade(
      mockSupabase, USER_ID,
      stockExit('AAPL', 'Long', 190, 3),
      nextEventId()
    );
    expect(result.matched).toBe(true);

    const closed = db.webhook_trades.filter(t => t.status === 'closed');
    expect(closed).toHaveLength(3);
    closed.forEach(t => expect(t.exit_price).toBe(190));
    // P&L: (190-185)*1 + (190-186)*1 + (190-187)*1 = 5+4+3 = $12
    const totalPnl = closed.reduce((s, t) => s + (t.pnl || 0), 0);
    expect(totalPnl).toBeCloseTo(12, 2);
    expect(db.webhook_trades.filter(t => t.status === 'open')).toHaveLength(0);
  });

});

// ═══════════════════════════════════════════════════════════════════════════════
// PART 8: SCALE-IN 3, SCALE-OUT 1 AT A TIME (FIFO)
// ═══════════════════════════════════════════════════════════════════════════════

describe('TV-8: Scale-in 3, scale-out 1 at a time (FIFO)', () => {

  test('TV-8.1: TSLA Long FIFO exit order', async () => {
    var prices = [185, 186, 187];
    for (var i = 0; i < 3; i++) {
      var tradeTime = new Date(2000000000000 + i * 1000).toISOString();
      await _matchAndJournalTrade(
        mockSupabase, USER_ID,
        stockEntry('TSLA', 'Long', prices[i], 1, { tradeTime: tradeTime }),
        nextEventId()
      );
    }

    await _matchAndJournalTrade(
      mockSupabase, USER_ID,
      stockExit('TSLA', 'Long', 190, 1),
      nextEventId()
    );
    var closed = db.webhook_trades.filter(t => t.status === 'closed');
    expect(closed).toHaveLength(1);
    expect(closed[0].entry_price).toBe(185);

    await _matchAndJournalTrade(
      mockSupabase, USER_ID,
      stockExit('TSLA', 'Long', 192, 1),
      nextEventId()
    );
    closed = db.webhook_trades.filter(t => t.status === 'closed');
    expect(closed).toHaveLength(2);
    expect(closed[1].entry_price).toBe(186);

    await _matchAndJournalTrade(
      mockSupabase, USER_ID,
      stockExit('TSLA', 'Long', 194, 1),
      nextEventId()
    );
    closed = db.webhook_trades.filter(t => t.status === 'closed');
    expect(closed).toHaveLength(3);
    expect(closed[2].entry_price).toBe(187);
    expect(db.webhook_trades.filter(t => t.status === 'open')).toHaveLength(0);
  });

});

// ═══════════════════════════════════════════════════════════════════════════════
// PART 9: MULTI-INSTRUMENT — NO CROSS-MATCHING
// ═══════════════════════════════════════════════════════════════════════════════

describe('TV-9: Multi-instrument — no cross-matching', () => {

  test('TV-9.1: AAPL Long + TSLA Long — close AAPL, TSLA stays open', async () => {
    await _matchAndJournalTrade(mockSupabase, USER_ID, stockEntry('AAPL', 'Long', 185, 100), nextEventId());
    await _matchAndJournalTrade(mockSupabase, USER_ID, stockEntry('TSLA', 'Long', 370, 50), nextEventId());
    expect(db.webhook_trades.filter(t => t.status === 'open')).toHaveLength(2);

    await _matchAndJournalTrade(mockSupabase, USER_ID, stockExit('AAPL', 'Long', 190, 100), nextEventId());

    const aapl = db.webhook_trades.find(t => t.symbol === 'AAPL');
    expect(aapl.status).toBe('closed');
    expect(aapl.pnl).toBeCloseTo(500, 2);

    const tsla = db.webhook_trades.find(t => t.symbol === 'TSLA');
    expect(tsla.status).toBe('open');
    expect(tsla.exit_price).toBeNull();
  });

  test('TV-9.2: AAPL Long + TSLA Short — both closed independently', async () => {
    await _matchAndJournalTrade(mockSupabase, USER_ID, stockEntry('AAPL', 'Long', 185, 100), nextEventId());
    await _matchAndJournalTrade(mockSupabase, USER_ID, stockEntry('TSLA', 'Short', 370, 50), nextEventId());

    await _matchAndJournalTrade(mockSupabase, USER_ID, stockExit('AAPL', 'Long', 190, 100), nextEventId());
    await _matchAndJournalTrade(mockSupabase, USER_ID, stockExit('TSLA', 'Short', 360, 50), nextEventId());

    const aapl = db.webhook_trades.find(t => t.symbol === 'AAPL');
    const tsla = db.webhook_trades.find(t => t.symbol === 'TSLA');
    expect(aapl.status).toBe('closed');
    expect(tsla.status).toBe('closed');
    // AAPL: (190-185)*100 = +$500
    expect(aapl.pnl).toBeCloseTo(500, 2);
    // TSLA Short: (370-360)*50 = +$500
    expect(tsla.pnl).toBeCloseTo(500, 2);
  });

});

// ═══════════════════════════════════════════════════════════════════════════════
// PART 10: P&L ACCURACY
// ═══════════════════════════════════════════════════════════════════════════════

describe('TV-10: P&L accuracy — stock trades', () => {

  test('TV-10.1: Long AAPL — entry 185, exit 190, qty 100 = +$500', async () => {
    await _matchAndJournalTrade(mockSupabase, USER_ID, stockEntry('AAPL', 'Long', 185, 100), nextEventId());
    await _matchAndJournalTrade(mockSupabase, USER_ID, stockExit('AAPL', 'Long', 190, 100), nextEventId());
    const t = db.webhook_trades.find(t => t.symbol === 'AAPL' && t.status === 'closed');
    expect(t).toBeTruthy();
    expect(t.pnl).toBeCloseTo(500, 2);
  });

  test('TV-10.2: Short TSLA — entry 370, exit 360, qty 50 = +$500', async () => {
    await _matchAndJournalTrade(mockSupabase, USER_ID, stockEntry('TSLA', 'Short', 370, 50), nextEventId());
    await _matchAndJournalTrade(mockSupabase, USER_ID, stockExit('TSLA', 'Short', 360, 50), nextEventId());
    const t = db.webhook_trades.find(t => t.symbol === 'TSLA' && t.status === 'closed');
    expect(t).toBeTruthy();
    // Short win: (370-360)*50 = +$500
    expect(t.pnl).toBeCloseTo(500, 2);
  });

  test('TV-10.3: Loss — Long NVDA entry 900, exit 880, qty 10 = -$200', async () => {
    await _matchAndJournalTrade(mockSupabase, USER_ID, stockEntry('NVDA', 'Long', 900, 10), nextEventId());
    await _matchAndJournalTrade(mockSupabase, USER_ID, stockExit('NVDA', 'Long', 880, 10), nextEventId());
    const t = db.webhook_trades.find(t => t.symbol === 'NVDA' && t.status === 'closed');
    expect(t).toBeTruthy();
    // Long loss: (880-900)*10 = -$200
    expect(t.pnl).toBeCloseTo(-200, 2);
  });

  test('TV-10.4: Short loss — Short AAPL entry 185, exit 195, qty 100 = -$1000', async () => {
    await _matchAndJournalTrade(mockSupabase, USER_ID, stockEntry('AAPL', 'Short', 185, 100), nextEventId());
    await _matchAndJournalTrade(mockSupabase, USER_ID, stockExit('AAPL', 'Short', 195, 100), nextEventId());
    const t = db.webhook_trades.find(t => t.symbol === 'AAPL' && t.status === 'closed');
    expect(t).toBeTruthy();
    // Short loss: (185-195)*100 = -$1000
    expect(t.pnl).toBeCloseTo(-1000, 2);
  });

  test('TV-10.5: Entry notes say "TradingView" not "NinjaTrader"', async () => {
    await _matchAndJournalTrade(mockSupabase, USER_ID, stockEntry('AAPL', 'Long', 185, 100), nextEventId());
    const t = db.webhook_trades.find(t => t.symbol === 'AAPL');
    expect(t.notes).toContain('TradingView');
    expect(t.notes).not.toContain('NinjaTrader');
  });

  test('TV-10.6: Partial close notes say "TradingView" not "NinjaTrader"', async () => {
    await _matchAndJournalTrade(mockSupabase, USER_ID, stockEntry('AAPL', 'Long', 185, 3), nextEventId());
    await _matchAndJournalTrade(mockSupabase, USER_ID, stockExit('AAPL', 'Long', 190, 1), nextEventId());
    const partialClosed = db.webhook_trades.find(t => t.status === 'closed');
    expect(partialClosed).toBeTruthy();
    expect(partialClosed.notes).toContain('TradingView');
    expect(partialClosed.notes).not.toContain('NinjaTrader');
  });

});

// ═══════════════════════════════════════════════════════════════════════════════
// PART 11: TV DIRECTION FALLBACK
// ═══════════════════════════════════════════════════════════════════════════════

describe('TV-11: Direction fallback (no direction in TV payload)', () => {

  test('TV-11.1: buy without direction → Long trade created', async () => {
    const parsed = buildParsed({
      ticker: 'AAPL', action: 'buy', price: 185, quantity: 100,
      direction: '', source: 'tradingview', entryPrice: 185,
    });
    await _matchAndJournalTrade(mockSupabase, USER_ID, parsed, nextEventId());
    const t = db.webhook_trades.find(t => t.symbol === 'AAPL');
    expect(t.direction).toBe('Long');
  });

  test('TV-11.2: sell without direction → closes open Long', async () => {
    await _matchAndJournalTrade(
      mockSupabase, USER_ID,
      buildParsed({ ticker: 'AAPL', action: 'buy', price: 185, quantity: 100, direction: '', source: 'tradingview', entryPrice: 185 }),
      nextEventId()
    );
    const result = await _matchAndJournalTrade(
      mockSupabase, USER_ID,
      buildParsed({ ticker: 'AAPL', action: 'sell', price: 190, quantity: 100, direction: '', source: 'tradingview', exitPrice: 190 }),
      nextEventId()
    );
    expect(result.matched).toBe(true);
    const closed = db.webhook_trades.find(t => t.symbol === 'AAPL' && t.status === 'closed');
    expect(closed).toBeTruthy();
    expect(closed.direction).toBe('Long');
    expect(closed.pnl).toBeCloseTo(500, 2);
  });

  test('TV-11.3: sell without direction, no Long open → falls back to Short', async () => {
    await _matchAndJournalTrade(
      mockSupabase, USER_ID,
      buildParsed({ ticker: 'TSLA', action: 'buy', price: 370, quantity: 50, direction: 'Short', source: 'tradingview', entryPrice: 370 }),
      nextEventId()
    );
    const result = await _matchAndJournalTrade(
      mockSupabase, USER_ID,
      buildParsed({ ticker: 'TSLA', action: 'sell', price: 360, quantity: 50, direction: '', source: 'tradingview', exitPrice: 360 }),
      nextEventId()
    );
    expect(result.matched).toBe(true);
    const closed = db.webhook_trades.find(t => t.symbol === 'TSLA' && t.status === 'closed');
    expect(closed).toBeTruthy();
    // Short: (370-360)*50 = +$500
    expect(closed.pnl).toBeCloseTo(500, 2);
  });

});

// ═══════════════════════════════════════════════════════════════════════════════
// PART 12: TV/NT COEXISTENCE
// ═══════════════════════════════════════════════════════════════════════════════

describe('TV-12: TV and NT routes coexist', () => {
  let app;
  beforeAll(() => { app = buildApp(); });

  test('TV-12.1: NT route returns 401 for bad tokens (token is the auth)', async () => {
    const res = await request(app)
      .post('/api/webhook/nt/bad-token')
      .set('Content-Type', 'text/plain')
      .send('buy AAPL 185 100');
    expect(res.status).toBe(401);
  });

  test('TV-12.2: NT route with bad IP returns 401 not 403 (no IP block on NT)', async () => {
    const res = await request(app)
      .post('/api/webhook/nt/bad-nt-token')
      .set('X-Forwarded-For', BAD_IP)
      .set('Content-Type', 'text/plain')
      .send('buy MNQ 24300 1');
    // 401 = token failed, NOT 403 = IP blocked
    expect(res.status).toBe(401);
  });

  test('TV-12.3: TV route with bad IP → 403 (IP checked first)', async () => {
    const res = await request(app)
      .post('/api/webhook/tv/any-token')
      .set('X-Forwarded-For', BAD_IP)
      .send('buy AAPL 185 100');
    expect(res.status).toBe(403);
  });

  test('TV-12.4: TV source tag set to "tradingview" in trade record', async () => {
    const parsed = buildParsed({
      ticker: 'AAPL', action: 'buy', price: 185, quantity: 100,
      source: 'tradingview', direction: 'Long', entryPrice: 185,
    });
    await _matchAndJournalTrade(mockSupabase, USER_ID, parsed, nextEventId());
    const t = db.webhook_trades.find(t => t.symbol === 'AAPL');
    expect(t.source).toBe('tradingview');
  });

  test('TV-12.5: NT source tag set to "ninjatrader" in trade record', async () => {
    const parsed = buildParsed({
      ticker: 'MNQ', action: 'buy', price: 24300, quantity: 1,
      source: 'ninjatrader', direction: 'Short', entryPrice: 24300,
      assetClass: 'Futures',
    });
    await _matchAndJournalTrade(mockSupabase, USER_ID, parsed, nextEventId());
    const t = db.webhook_trades.find(t => t.symbol === 'MNQ');
    expect(t.source).toBe('ninjatrader');
  });

});

// ═══════════════════════════════════════════════════════════════════════════════
// PART 13: EXIT BEFORE ENTRY
// ═══════════════════════════════════════════════════════════════════════════════

describe('TV-13: Exit before entry — standalone closed record', () => {

  test('TV-13.1: Exit with no open trade → standalone closed record created', async () => {
    const result = await _matchAndJournalTrade(
      mockSupabase, USER_ID,
      stockExit('AAPL', 'Long', 190, 100),
      nextEventId()
    );
    expect(result.matched).toBe(true);
    const t = db.webhook_trades.find(t => t.symbol === 'AAPL');
    expect(t).toBeTruthy();
    expect(t.status).toBe('closed');
    expect(t.exit_price).toBe(190);
  });

});

// ═══════════════════════════════════════════════════════════════════════════════
// PART 14: PARTIAL CLOSE
// ═══════════════════════════════════════════════════════════════════════════════

describe('TV-14: Partial close — qty 3 entry, exit 1+1+1', () => {

  test('TV-14.1: Single entry qty 3, three partial exits', async () => {
    await _matchAndJournalTrade(mockSupabase, USER_ID, stockEntry('AAPL', 'Long', 185, 3), nextEventId());
    expect(db.webhook_trades[0].quantity).toBe(3);

    await _matchAndJournalTrade(mockSupabase, USER_ID, stockExit('AAPL', 'Long', 190, 1), nextEventId());
    const openAfter1 = db.webhook_trades.find(t => t.status === 'open');
    expect(openAfter1.quantity).toBe(2);
    const closedAfter1 = db.webhook_trades.filter(t => t.status === 'closed');
    expect(closedAfter1).toHaveLength(1);
    expect(closedAfter1[0].quantity).toBe(1);
    expect(closedAfter1[0].pnl).toBeCloseTo(5, 2);

    await _matchAndJournalTrade(mockSupabase, USER_ID, stockExit('AAPL', 'Long', 192, 1), nextEventId());
    expect(db.webhook_trades.find(t => t.status === 'open').quantity).toBe(1);

    await _matchAndJournalTrade(mockSupabase, USER_ID, stockExit('AAPL', 'Long', 194, 1), nextEventId());
    expect(db.webhook_trades.filter(t => t.status === 'open')).toHaveLength(0);
    expect(db.webhook_trades.filter(t => t.status === 'closed')).toHaveLength(3);
  });

});
