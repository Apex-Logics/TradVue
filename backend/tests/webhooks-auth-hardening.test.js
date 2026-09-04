/**
 * Q5 / Review B3–B5 — webhook IP allowlist, access-log redaction, auth-fail events.
 *
 * 1. Spoofed `X-Forwarded-For: 1.2.3.4, <real>` must not be treated as client 1.2.3.4.
 * 2. Morgan/access log for a token URL must not contain the raw token.
 * 3. Invalid/missing token: no trade applied; an auth_fail event is recorded.
 * 4. Valid token path still journals.
 */
'use strict';

process.env.SUPABASE_URL              = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
process.env.JWT_SECRET                = 'test-jwt-secret';

const request = require('supertest');
const express = require('express');
const morgan  = require('morgan');
const crypto  = require('crypto');

const {
  TRUST_PROXY_HOPS,
  hashWebhookToken,
  getSourceIP,
  redactWebhookPath,
  tokenLogId,
} = require('../lib/webhookSecurity');

// ── In-memory DB ─────────────────────────────────────────────────────────────
let db;
let seq;

function nextId() { return seq++; }

function matchesFilters(row, filters) {
  return filters.every(f => row[f.col] === f.val || String(row[f.col]) === String(f.val));
}

function makeChain(table) {
  const state = { table, filters: [], insertData: null, updateData: null, orderCol: null, orderAsc: true };

  function resolve() {
    if (state.updateData) {
      (db[state.table] || [])
        .filter(r => matchesFilters(r, state.filters))
        .forEach(r => Object.assign(r, state.updateData));
      return { data: null, error: null };
    }
    if (state.insertData) {
      const row = { id: nextId(), ...state.insertData };
      if (!db[state.table]) db[state.table] = [];
      db[state.table].push(row);
      return { data: row, error: null };
    }
    const rows = (db[state.table] || []).filter(r => matchesFilters(r, state.filters));
    return { data: rows, error: null, count: rows.length };
  }

  const chain = {};
  chain.select      = jest.fn(() => chain);
  chain.insert      = jest.fn((data) => { state.insertData = Array.isArray(data) ? data[0] : data; return chain; });
  chain.update      = jest.fn((data) => { state.updateData = data; return chain; });
  chain.delete      = jest.fn(() => chain);
  chain.eq          = jest.fn((col, val) => { state.filters.push({ col, val }); return chain; });
  chain.order       = jest.fn((col, opts = {}) => {
    state.orderCol = col;
    state.orderAsc = !(opts && opts.ascending === false);
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
  requireAuth: (req, _res, next) => { req.user = { id: 'user-hardening-1' }; next(); },
}));

const { receiverRouter } = require('../routes/webhooks');

const TV_IP   = '52.89.214.238';
const BAD_IP  = '1.2.3.4';
const LOCAL   = '127.0.0.1';
const USER_ID = 'user-hardening-1';
const PLAIN_TOKEN = crypto.randomBytes(16).toString('hex');

function resetDb() {
  seq = 1;
  db = {
    webhook_tokens: [{
      id: 1,
      user_id: USER_ID,
      token: PLAIN_TOKEN,
      is_active: true,
      trade_count: 0,
      label: 'TradingView',
    }],
    webhook_events: [],
    webhook_trades: [],
    instruments: [],
  };
  mockSupabase.from.mockImplementation((table) => makeChain(table));
}

beforeEach(resetDb);

function buildApp(opts = {}) {
  const app = express();
  app.set('trust proxy', opts.trustProxy !== undefined ? opts.trustProxy : TRUST_PROXY_HOPS);
  if (opts.morganStream) {
    morgan.token('redacted-url', (req) => redactWebhookPath(req.originalUrl || req.url || ''));
    app.use(morgan(':method :redacted-url', { stream: opts.morganStream }));
  }
  app.use('/api/webhook', receiverRouter);
  return app;
}

async function flushAsync() {
  await new Promise(r => setImmediate(r));
  await new Promise(r => setImmediate(r));
  await new Promise(r => setTimeout(r, 20));
}

// ══════════════════════════════════════════════════════════════════════════════
// Lib unit tests
// ══════════════════════════════════════════════════════════════════════════════

describe('webhookSecurity helpers', () => {
  test('hashWebhookToken is sha256 hex and does not equal the plaintext', () => {
    const hashed = hashWebhookToken(PLAIN_TOKEN);
    expect(hashed).toHaveLength(64);
    expect(hashed).toMatch(/^[a-f0-9]{64}$/);
    expect(hashed).not.toBe(PLAIN_TOKEN);
    expect(hashWebhookToken(PLAIN_TOKEN)).toBe(hashed);
  });

  test('tokenLogId is a prefix of the hash, never the raw token', () => {
    const id = tokenLogId(PLAIN_TOKEN);
    expect(PLAIN_TOKEN.startsWith(id)).toBe(false);
    expect(hashWebhookToken(PLAIN_TOKEN).startsWith(id)).toBe(true);
  });

  test('getSourceIP uses req.ip (last untrusted hop), not leftmost XFF', () => {
    const req = {
      ip: TV_IP,
      headers: { 'x-forwarded-for': `${BAD_IP}, ${TV_IP}` },
      socket: { remoteAddress: '10.0.0.1' },
    };
    expect(getSourceIP(req)).toBe(TV_IP);
  });

  test('getSourceIP strips IPv4-mapped IPv6 prefix', () => {
    expect(getSourceIP({ ip: '::ffff:127.0.0.1' })).toBe('127.0.0.1');
  });

  test('redactWebhookPath strips tv/nt token segments and query stays', () => {
    const token = PLAIN_TOKEN;
    expect(redactWebhookPath(`/api/webhook/nt/${token}`)).toBe('/api/webhook/nt/[REDACTED]');
    expect(redactWebhookPath(`/api/webhook/tv/${token}?x=1`)).toBe('/api/webhook/tv/[REDACTED]?x=1');
    expect(redactWebhookPath(`/api/webhook/nt/${token}`)).not.toContain(token);
    expect(redactWebhookPath('/api/health')).toBe('/api/health');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// B3 — XFF spoof / last untrusted hop
// ══════════════════════════════════════════════════════════════════════════════

describe('B3: IP allowlist uses last untrusted hop', () => {
  let app;
  beforeAll(() => { app = buildApp(); });

  test('spoofed X-Forwarded-For: 1.2.3.4, <TV real> is NOT treated as client 1.2.3.4', async () => {
    // Attacker prepended BAD_IP; the real connecting client (last untrusted hop) is TV.
    const res = await request(app)
      .post(`/api/webhook/tv/${PLAIN_TOKEN}`)
      .set('X-Forwarded-For', `${BAD_IP}, ${TV_IP}`)
      .set('Content-Type', 'text/plain')
      .send('buy AAPL 187.42 100');

    expect(res.status).not.toBe(403);
    expect(res.status).toBe(200);
  });

  test('spoofed X-Forwarded-For: <TV>, 1.2.3.4 does not satisfy allowlist as TV', async () => {
    // Classic spoof: leftmost is a TV IP, real client is BAD_IP.
    const res = await request(app)
      .post(`/api/webhook/tv/${PLAIN_TOKEN}`)
      .set('X-Forwarded-For', `${TV_IP}, ${BAD_IP}`)
      .set('Content-Type', 'text/plain')
      .send('buy AAPL 187.42 100');

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Forbidden');
    expect(db.webhook_trades).toHaveLength(0);
  });

  test('single X-Forwarded-For TV IP is accepted (Render client IP)', async () => {
    const res = await request(app)
      .post(`/api/webhook/tv/${PLAIN_TOKEN}`)
      .set('X-Forwarded-For', TV_IP)
      .set('Content-Type', 'text/plain')
      .send('buy AAPL 187.42 100');
    expect(res.status).toBe(200);
  });

  test('single X-Forwarded-For 1.2.3.4 is rejected', async () => {
    const res = await request(app)
      .post(`/api/webhook/tv/${PLAIN_TOKEN}`)
      .set('X-Forwarded-For', BAD_IP)
      .set('Content-Type', 'text/plain')
      .send('buy AAPL 187.42 100');
    expect(res.status).toBe(403);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// B4 — morgan / access log redaction
// ══════════════════════════════════════════════════════════════════════════════

describe('B4: token path redacted in access logs', () => {
  test('morgan output for a token URL does not contain the raw token', async () => {
    const chunks = [];
    const app = buildApp({
      morganStream: { write: (s) => { chunks.push(String(s)); } },
    });

    await request(app)
      .post(`/api/webhook/nt/${PLAIN_TOKEN}`)
      .set('Content-Type', 'text/plain')
      .send(JSON.stringify({ ticker: 'MNQ', action: 'buy', price: 1, source: 'ninjatrader' }));

    const out = chunks.join('');
    expect(out).not.toContain(PLAIN_TOKEN);
    expect(out).toContain('[REDACTED]');
    expect(out).toMatch(/\/api\/webhook\/nt\/\[REDACTED\]/);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// B5 — auth-fail events; no trade on bad token; valid path still journals
// ══════════════════════════════════════════════════════════════════════════════

describe('B5: auth-fail is recorded; trades only on valid token', () => {
  let app;
  beforeAll(() => { app = buildApp(); });

  test('invalid TV token: 200 ack, no trade, auth_fail event row', async () => {
    const res = await request(app)
      .post('/api/webhook/tv/deadbeefdeadbeefdeadbeefdeadbeef')
      .set('X-Forwarded-For', LOCAL)
      .set('Content-Type', 'text/plain')
      .send('buy AAPL 187.42 100');

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(db.webhook_trades).toHaveLength(0);
    const fails = db.webhook_events.filter(e => e.status === 'auth_fail');
    expect(fails.length).toBeGreaterThanOrEqual(1);
    expect(fails[0].error_message).toMatch(/auth_fail/);
    expect(fails[0].token_id).toBeNull();
  });

  test('inactive TV token: 200 ack, no trade, auth_fail attributed to user', async () => {
    db.webhook_tokens[0].is_active = false;

    const res = await request(app)
      .post(`/api/webhook/tv/${PLAIN_TOKEN}`)
      .set('X-Forwarded-For', LOCAL)
      .set('Content-Type', 'text/plain')
      .send('buy AAPL 187.42 100');

    expect(res.status).toBe(200);
    expect(db.webhook_trades).toHaveLength(0);
    const fail = db.webhook_events.find(e => e.status === 'auth_fail');
    expect(fail).toBeTruthy();
    expect(fail.user_id).toBe(USER_ID);
    expect(fail.token_id).toBe(1);
    expect(fail.error_message).toMatch(/inactive/);
  });

  test('invalid NT token: 401, no trade, auth_fail event row', async () => {
    const res = await request(app)
      .post('/api/webhook/nt/deadbeefdeadbeefdeadbeefdeadbeef')
      .set('Content-Type', 'text/plain')
      .send('buy MNQ 24300 1');

    expect(res.status).toBe(401);
    expect(db.webhook_trades).toHaveLength(0);
    const fails = db.webhook_events.filter(e => e.status === 'auth_fail');
    expect(fails.length).toBeGreaterThanOrEqual(1);
    expect(fails[0].error_message).toMatch(/auth_fail/);
  });

  test('valid TV token still journals a trade', async () => {
    const res = await request(app)
      .post(`/api/webhook/tv/${PLAIN_TOKEN}`)
      .set('X-Forwarded-For', LOCAL)
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ ticker: 'AAPL', action: 'buy', price: 187.42, quantity: 10 }));

    expect(res.status).toBe(200);
    await flushAsync();

    expect(db.webhook_events.some(e => e.status === 'auth_fail')).toBe(false);
    expect(db.webhook_trades.length).toBeGreaterThanOrEqual(1);
    expect(db.webhook_trades[0].symbol).toBe('AAPL');
    expect(db.webhook_trades[0].user_id).toBe(USER_ID);
  });

  test('dual-read: SHA-256 stored token still verifies the plaintext URL secret', async () => {
    const hashed = hashWebhookToken(PLAIN_TOKEN);
    db.webhook_tokens[0].token = hashed;

    const res = await request(app)
      .post(`/api/webhook/tv/${PLAIN_TOKEN}`)
      .set('X-Forwarded-For', LOCAL)
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ ticker: 'MSFT', action: 'buy', price: 400, quantity: 1 }));

    expect(res.status).toBe(200);
    await flushAsync();
    expect(db.webhook_trades.some(t => t.symbol === 'MSFT')).toBe(true);
    expect(db.webhook_events.some(e => e.status === 'auth_fail')).toBe(false);
  });
});
