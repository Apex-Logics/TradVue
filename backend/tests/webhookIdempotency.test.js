/**
 * webhookIdempotency.test.js
 *
 * Regression tests (P0 2026-09 #3): webhook retries must be idempotent.
 *
 * A TradingView / NinjaTrader alert can be delivered more than once (the
 * sender retries on timeout, or a proxy replays the request). When the payload
 * carries a real external order id, re-processing it MUST NOT create a second
 * event or a duplicate trade. Idempotency is keyed on the persisted external
 * order_id, backed by a (user_id, order_id) uniqueness constraint at the DB
 * layer (see database/migrations/019_webhook_event_idempotency.sql).
 *
 * Placeholder order ids that TradingView strategy alerts emit (e.g. "Long",
 * "Short") are NOT unique per fill, so they must NOT trigger de-duplication.
 */

'use strict';

process.env.SUPABASE_URL              = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
process.env.JWT_SECRET                = 'test-jwt-secret';

// ── In-memory Supabase mock (supports webhook_events + webhook_trades) ────────
let db;
let seq;

function nextId() { return seq++; }

function matchesFilters(row, filters) {
  return filters.every(f => row[f.col] === f.val || String(row[f.col]) === String(f.val));
}

// Enforce the (user_id, order_id) partial-unique index in the mock so tests
// exercise the same guarantee the real DB provides.
function violatesUniqueOrderId(table, rowData) {
  if (table !== 'webhook_events') return false;
  if (rowData.order_id === null || rowData.order_id === undefined || rowData.order_id === '') return false;
  return db.webhook_events.some(
    r => r.user_id === rowData.user_id && r.order_id === rowData.order_id
  );
}

function makeChain(table) {
  const state = { table, filters: [], insertData: null, updateData: null, orderCol: null, orderAsc: true };

  function resolve() {
    if (state.updateData) {
      db[state.table]
        .filter(r => matchesFilters(r, state.filters))
        .forEach(r => Object.assign(r, state.updateData));
      return { data: null, error: null };
    }
    if (state.insertData) {
      if (violatesUniqueOrderId(state.table, state.insertData)) {
        return {
          data: null,
          error: { code: '23505', message: 'duplicate key value violates unique constraint "uniq_webhook_events_user_order"' },
        };
      }
      const row = { id: nextId(), ...state.insertData };
      db[state.table].push(row);
      return { data: row, error: null };
    }
    if (state.table === 'instruments') {
      const symFilter = state.filters.find(f => f.col === 'symbol');
      const row = symFilter ? (db.instruments.find(i => i.symbol === symFilter.val) || null) : null;
      return { data: row, error: null };
    }
    let rows = db[state.table] ? db[state.table].filter(r => matchesFilters(r, state.filters)) : [];
    if (state.orderCol) {
      rows = [...rows].sort((a, b) => {
        if (a[state.orderCol] < b[state.orderCol]) return state.orderAsc ? -1 : 1;
        if (a[state.orderCol] > b[state.orderCol]) return state.orderAsc ? 1 : -1;
        return 0;
      });
    }
    return { data: rows, error: null };
  }

  const chain = {};
  chain.select      = jest.fn(() => chain);
  chain.insert      = jest.fn((data) => { state.insertData = Array.isArray(data) ? data[0] : data; return chain; });
  chain.update      = jest.fn((data) => { state.updateData = data; return chain; });
  chain.delete      = jest.fn(() => chain);
  chain.eq          = jest.fn((col, val) => { state.filters.push({ col, val }); return chain; });
  chain.order       = jest.fn((col, opts = {}) => { state.orderCol = col; state.orderAsc = opts.ascending !== false; return Promise.resolve(resolve()); });
  chain.limit       = jest.fn(() => chain);
  chain.maybeSingle = jest.fn(() => {
    const result = resolve();
    if (Array.isArray(result.data)) return Promise.resolve({ data: result.data[0] || null, error: result.error });
    return Promise.resolve(result);
  });
  chain.single      = jest.fn(() => Promise.resolve(resolve()));
  chain.then        = (ok, err) => Promise.resolve(resolve()).then(ok, err);
  chain.catch       = (err) => Promise.resolve(resolve()).catch(err);
  return chain;
}

const mockSupabase = { from: jest.fn((table) => makeChain(table)) };

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockSupabase),
}));

const { ingestAndMatch, idempotencyKeyFor, parsePayload } = require('../routes/webhooks');

const USER_ID = 'idem-user-1';

beforeEach(() => {
  db = { webhook_events: [], webhook_trades: [], instruments: [] };
  seq = 1;
  mockSupabase.from.mockImplementation((table) => makeChain(table));
});

function entry(orderId, overrides = {}) {
  return Object.assign(parsePayload(JSON.stringify({
    ticker: 'AAPL', action: 'buy', price: 185, quantity: 100,
    order_id: orderId, source: 'ninjatrader', direction: 'Long',
  })), overrides);
}

function ingest(parsed) {
  return ingestAndMatch(mockSupabase, {
    tokenId: 1,
    userId: USER_ID,
    sourceIP: '127.0.0.1',
    rawPayload: { raw: 'test' },
    parsed,
  });
}

describe('idempotencyKeyFor()', () => {
  test('real external order ids are idempotent keys', () => {
    expect(idempotencyKeyFor({ orderId: 'NT-ORDER-12345' })).toBe('NT-ORDER-12345');
    expect(idempotencyKeyFor({ orderId: '987654321' })).toBe('987654321');
  });

  test('empty / missing order id is not an idempotency key', () => {
    expect(idempotencyKeyFor({ orderId: '' })).toBeNull();
    expect(idempotencyKeyFor({})).toBeNull();
    expect(idempotencyKeyFor({ orderId: '   ' })).toBeNull();
  });

  test('TradingView direction/action placeholders are NOT idempotency keys', () => {
    for (const placeholder of ['Long', 'short', 'BUY', 'sell', 'entry', 'Exit', 'flat', 'close']) {
      expect(idempotencyKeyFor({ orderId: placeholder })).toBeNull();
    }
  });
});

describe('Webhook ingestion idempotency (P0 #3)', () => {
  test('first ingest with a real order id creates one event and one trade', async () => {
    const r = await ingest(entry('NT-ORDER-1'));
    expect(r.duplicate).toBeFalsy();
    expect(db.webhook_events).toHaveLength(1);
    expect(db.webhook_events[0].order_id).toBe('NT-ORDER-1');
    expect(db.webhook_trades).toHaveLength(1);
  });

  test('retry with the SAME order id is a no-op (no duplicate event or trade)', async () => {
    await ingest(entry('NT-ORDER-1'));
    const retry = await ingest(entry('NT-ORDER-1'));

    expect(retry.duplicate).toBe(true);
    expect(retry.matched).toBeFalsy();
    // Still exactly one event and one trade — the retry did not duplicate.
    expect(db.webhook_events).toHaveLength(1);
    expect(db.webhook_trades).toHaveLength(1);
  });

  test('three retries of the same order id → still one trade', async () => {
    await ingest(entry('NT-ORDER-42'));
    await ingest(entry('NT-ORDER-42'));
    await ingest(entry('NT-ORDER-42'));
    await ingest(entry('NT-ORDER-42'));
    expect(db.webhook_trades).toHaveLength(1);
    expect(db.webhook_events).toHaveLength(1);
  });

  test('distinct order ids each create their own trade', async () => {
    await ingest(entry('NT-ORDER-1'));
    await ingest(entry('NT-ORDER-2'));
    await ingest(entry('NT-ORDER-3'));
    expect(db.webhook_events).toHaveLength(3);
    expect(db.webhook_trades).toHaveLength(3);
  });

  test('placeholder order ids ("Long") are NOT de-duplicated', async () => {
    // Two legitimately distinct TradingView entries that both carry the
    // strategy placeholder order_id "Long" must both be journaled.
    await ingest(entry('Long', { ticker: 'AAPL' }));
    await ingest(entry('Long', { ticker: 'TSLA' }));
    expect(db.webhook_trades).toHaveLength(2);
    // order_id column left NULL for placeholders so the unique index ignores them.
    expect(db.webhook_events.every(e => e.order_id === null)).toBe(true);
  });

  test('payloads without an order id are never de-duplicated', async () => {
    await ingest(entry(''));
    await ingest(entry(''));
    expect(db.webhook_trades).toHaveLength(2);
  });

  test('DB unique-violation on a racing retry is swallowed as a duplicate', async () => {
    // Simulate the check-then-insert race: pre-seed an event row with the same
    // (user_id, order_id) so the insert hits the unique constraint directly.
    db.webhook_events.push({ id: nextId(), user_id: USER_ID, order_id: 'RACE-1', status: 'received' });
    const r = await ingest(entry('RACE-1'));
    expect(r.duplicate).toBe(true);
    // No new trade created despite the insert attempt.
    expect(db.webhook_trades).toHaveLength(0);
  });
});
