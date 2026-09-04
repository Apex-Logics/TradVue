/**
 * Q2 — last-write-wins journal blob (Review A4)
 *
 * PUT /api/user/data/:type used to upsert the full JSONB with no version
 * check. Two devices/tabs → later push silently discarded the other's trades.
 *
 * Locks:
 *   - matching expectedUpdatedAt / If-Match succeeds and returns new updated_at
 *   - stale precondition → 409 + current server copy (no overwrite)
 *   - two sequential PUTs with the same expected stamp: second is 409; merge
 *     retry keeps trades present on only one side
 *   - missing precondition still last-write-wins (old-client compat)
 *   - expectedUpdatedAt is stripped from the persisted blob
 *   - first write (no row) with expectedUpdatedAt: null succeeds
 *
 * In-memory user_data mock — no live Supabase, no prod writes.
 */

'use strict';

const request = require('supertest');
const express = require('express');

function rowKey(userId, dataType) {
  return `${userId}:${dataType}`;
}

function createUserDataMemory() {
  const rows = new Map();

  function from(table) {
    if (table !== 'user_data') throw new Error(`unexpected table: ${table}`);
    const ctx = { action: 'select', filters: {}, payload: null };

    const api = {
      select() { return api; },
      insert(payload) { ctx.action = 'insert'; ctx.payload = payload; return api; },
      update(payload) { ctx.action = 'update'; ctx.payload = payload; return api; },
      upsert(payload) { ctx.action = 'upsert'; ctx.payload = payload; return api; },
      eq(col, val) { ctx.filters[col] = val; return api; },
      maybeSingle() { return Promise.resolve(run(true)); },
      then(resolve, reject) { return Promise.resolve(run(false)).then(resolve, reject); },
    };

    function run(single) {
      const userId = ctx.filters.user_id || ctx.payload?.user_id;
      const dataType = ctx.filters.data_type || ctx.payload?.data_type;
      const k = rowKey(userId, dataType);

      if (ctx.action === 'select') {
        const row = rows.get(k) || null;
        return single ? { data: row, error: null } : { data: row ? [row] : [], error: null };
      }

      if (ctx.action === 'insert') {
        if (rows.has(k)) {
          return { data: null, error: { message: 'duplicate key', code: '23505' } };
        }
        const row = { ...ctx.payload };
        rows.set(k, row);
        return { data: row, error: null };
      }

      if (ctx.action === 'update') {
        const existing = rows.get(k);
        if (!existing) return { data: null, error: null };
        if (Object.prototype.hasOwnProperty.call(ctx.filters, 'updated_at')
            && existing.updated_at !== ctx.filters.updated_at) {
          return { data: null, error: null };
        }
        const row = { ...existing, ...ctx.payload };
        rows.set(k, row);
        return single ? { data: row, error: null } : { data: [row], error: null };
      }

      if (ctx.action === 'upsert') {
        const row = { ...ctx.payload };
        rows.set(rowKey(row.user_id, row.data_type), row);
        return { data: row, error: null };
      }

      return { data: null, error: { message: 'unknown action' } };
    }

    return api;
  }

  return { from, rows };
}

const mockMemory = createUserDataMemory();

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockMemory),
}));

jest.mock('../middleware/auth', () => ({
  requireAuth: (req, _res, next) => {
    req.user = { id: 'user-q2', email: 'q2@example.com' };
    next();
  },
}));

const { timestampsMatch, persistableBody, parseExpectedUpdatedAt } = require('../lib/userDataVersion');

describe('userDataVersion helpers', () => {
  test('timestampsMatch equates Z vs +00:00', () => {
    expect(timestampsMatch('2026-09-03T12:00:00.000Z', '2026-09-03T12:00:00+00:00')).toBe(true);
    expect(timestampsMatch('2026-09-03T12:00:00.000Z', '2026-09-03T12:00:01.000Z')).toBe(false);
    expect(timestampsMatch(null, null)).toBe(true);
    expect(timestampsMatch(null, '2026-09-03T12:00:00.000Z')).toBe(false);
  });

  test('persistableBody strips expectedUpdatedAt', () => {
    expect(persistableBody({ data: { trades: [1] }, expectedUpdatedAt: 'T1' }))
      .toEqual({ data: { trades: [1] } });
  });

  test('parseExpectedUpdatedAt reads If-Match, header, and body', () => {
    expect(parseExpectedUpdatedAt({ headers: {}, body: {} }).provided).toBe(false);
    expect(parseExpectedUpdatedAt({
      headers: { 'if-match': '"2026-09-03T12:00:00.000Z"' },
      body: {},
    })).toEqual({ provided: true, value: '2026-09-03T12:00:00.000Z' });
    expect(parseExpectedUpdatedAt({
      headers: { 'x-expected-updated-at': 'null' },
      body: {},
    })).toEqual({ provided: true, value: null });
    expect(parseExpectedUpdatedAt({
      headers: {},
      body: { expectedUpdatedAt: '2026-09-03T12:00:00.000Z' },
    })).toEqual({ provided: true, value: '2026-09-03T12:00:00.000Z' });
  });
});

describe('PUT /api/user/data/:type version precondition (Q2)', () => {
  let app;

  beforeEach(() => {
    mockMemory.rows.clear();
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'anon-key';
    jest.isolateModules(() => {
      app = express();
      app.use(express.json());
      app.use('/api/user', require('../routes/userData'));
    });
  });

  function put(type, body, headers = {}) {
    const req = request(app)
      .put(`/api/user/data/${type}`)
      .set('Authorization', 'Bearer test-token');
    if (headers['If-Match']) req.set('If-Match', headers['If-Match']);
    if (headers['X-Expected-Updated-At']) req.set('X-Expected-Updated-At', headers['X-Expected-Updated-At']);
    return req.send(body);
  }

  test('first write with expectedUpdatedAt null creates the row', async () => {
    const res = await put('journal', {
      data: { trades: [{ id: 't1', symbol: 'ES' }] },
      expectedUpdatedAt: null,
    });
    expect(res.status).toBe(200);
    expect(res.body.type).toBe('journal');
    expect(res.body.updated_at).toBeTruthy();
    const stored = mockMemory.rows.get('user-q2:journal');
    expect(stored.data).toEqual({ data: { trades: [{ id: 't1', symbol: 'ES' }] } });
    expect(stored.data.expectedUpdatedAt).toBeUndefined();
  });

  test('matching If-Match / expectedUpdatedAt succeeds and advances updated_at', async () => {
    const first = await put('journal', {
      data: { trades: [{ id: 't1' }] },
      expectedUpdatedAt: null,
    });
    const t1 = first.body.updated_at;

    const second = await put('journal', {
      data: { trades: [{ id: 't1' }, { id: 't2' }] },
      expectedUpdatedAt: t1,
    }, { 'If-Match': t1 });

    expect(second.status).toBe(200);
    expect(second.body.updated_at).toBeTruthy();
    expect(mockMemory.rows.get('user-q2:journal').data.data.trades).toEqual([{ id: 't1' }, { id: 't2' }]);
  });

  test('stale expectedUpdatedAt returns 409 with server copy and does not overwrite', async () => {
    await put('journal', {
      data: { trades: [{ id: 'server-only' }] },
      expectedUpdatedAt: null,
    });
    const current = mockMemory.rows.get('user-q2:journal');

    const res = await put('journal', {
      data: { trades: [{ id: 'stale-client' }] },
      expectedUpdatedAt: '2020-01-01T00:00:00.000Z',
    });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('version_conflict');
    expect(res.body.updated_at).toBe(current.updated_at);
    expect(res.body.data).toEqual({ data: { trades: [{ id: 'server-only' }] } });
    expect(mockMemory.rows.get('user-q2:journal').data).toEqual({ data: { trades: [{ id: 'server-only' }] } });
  });

  test('two-device PUTs with the same expected stamp: second 409; merge retry keeps both trades', async () => {
    const seed = await put('journal', {
      data: { trades: [{ id: 'shared' }], notes: [] },
      expectedUpdatedAt: null,
    });
    const t0 = seed.body.updated_at;

    const deviceA = await put('journal', {
      data: { trades: [{ id: 'shared' }, { id: 'trade-A' }], notes: [] },
      expectedUpdatedAt: t0,
    });
    expect(deviceA.status).toBe(200);
    const tA = deviceA.body.updated_at;

    const deviceB = await put('journal', {
      data: { trades: [{ id: 'shared' }, { id: 'trade-B' }], notes: [] },
      expectedUpdatedAt: t0,
    });
    expect(deviceB.status).toBe(409);
    expect(deviceB.body.updated_at).toBe(tA);
    const serverTrades = deviceB.body.data.data.trades;
    expect(serverTrades.map(t => t.id)).toEqual(['shared', 'trade-A']);
    expect(serverTrades.map(t => t.id)).not.toContain('trade-B');

    // Client merge-by-id (same rule as frontend journalMerge): incoming wins
    // on same id; keep server-only ids.
    const incoming = [{ id: 'shared' }, { id: 'trade-B' }];
    const seen = new Set(incoming.map(t => t.id));
    const merged = [...incoming, ...serverTrades.filter(t => !seen.has(t.id))];

    const retry = await put('journal', {
      data: { trades: merged, notes: [] },
      expectedUpdatedAt: tA,
    });
    expect(retry.status).toBe(200);
    const saved = mockMemory.rows.get('user-q2:journal').data.data.trades.map(t => t.id);
    expect(saved).toEqual(expect.arrayContaining(['shared', 'trade-A', 'trade-B']));
    expect(saved).toHaveLength(3);
  });

  test('missing precondition still last-write-wins (old-client compat)', async () => {
    await put('journal', {
      data: { trades: [{ id: 'keep-me' }, { id: 'also-keep' }] },
      expectedUpdatedAt: null,
    });

    const res = await put('journal', {
      data: { trades: [{ id: 'old-client-only' }] },
    });
    expect(res.status).toBe(200);
    expect(mockMemory.rows.get('user-q2:journal').data.data.trades).toEqual([{ id: 'old-client-only' }]);
  });

  test('X-Expected-Updated-At header is honored when body field is absent', async () => {
    const first = await put('journal', { data: { trades: [{ id: 't1' }] } });
    const stale = await put('journal', { data: { trades: [{ id: 'nope' }] } }, {
      'X-Expected-Updated-At': '1999-01-01T00:00:00.000Z',
    });
    expect(stale.status).toBe(409);
    expect(mockMemory.rows.get('user-q2:journal').data.data.trades).toEqual([{ id: 't1' }]);

    const ok = await put('journal', { data: { trades: [{ id: 't1' }, { id: 't2' }] } }, {
      'X-Expected-Updated-At': first.body.updated_at,
    });
    expect(ok.status).toBe(200);
    expect(mockMemory.rows.get('user-q2:journal').data.data.trades.map(t => t.id)).toEqual(['t1', 't2']);
  });

  test('GET still returns updated_at (client precondition source)', async () => {
    await put('journal', { data: { trades: [{ id: 't1' }] }, expectedUpdatedAt: null });
    const res = await request(app)
      .get('/api/user/data/journal')
      .set('Authorization', 'Bearer test-token');
    expect(res.status).toBe(200);
    expect(res.body.updated_at).toBe(mockMemory.rows.get('user-q2:journal').updated_at);
    expect(res.body.data).toEqual({ data: { trades: [{ id: 't1' }] } });
  });
});
