/** Alert Service & Routes Tests */
const request = require('supertest');
const express = require('express');

const mockSelectQueue = [];
const mockSingleQueue = [];
const mockCountQueue = [];
const mockMutationQueue = [];

function makeSupabaseChain() {
  const state = { mode: 'select' };
  const chain = {
    select: jest.fn().mockImplementation(function (...args) {
      const options = args[1] || {};
      state.mode = options.head && options.count ? 'count' : 'select';
      return chain;
    }),
    gt: jest.fn().mockImplementation(() => chain),
    eq: jest.fn().mockImplementation(() => chain),
    order: jest.fn().mockImplementation(() => chain),
    limit: jest.fn().mockImplementation(() => chain),
    upsert: jest.fn().mockImplementation(() => { state.mode = 'single'; return chain; }),
    update: jest.fn().mockImplementation(() => { state.mode = 'mutation'; return chain; }),
    in: jest.fn().mockImplementation(() => { state.mode = 'mutation'; return chain; }),
    single: jest.fn().mockImplementation(() => { state.mode = 'single'; return chain; }),
    then: (resolve, reject) => {
      const result = state.mode === 'count'
        ? (mockCountQueue.shift() || { count: 0, error: null })
        : state.mode === 'single'
          ? (mockSingleQueue.shift() || { data: null, error: null })
          : state.mode === 'mutation'
            ? (mockMutationQueue.shift() || { error: null })
            : (mockSelectQueue.shift() || { data: [], error: null });
      return Promise.resolve(result).then(resolve, reject);
    },
  };
  return chain;
}

const mockSupabaseClient = { from: jest.fn(() => makeSupabaseChain()) };
jest.mock('@supabase/supabase-js', () => ({ createClient: jest.fn(() => mockSupabaseClient) }));
jest.mock('../services/rssFeedAggregator', () => ({ getAggregatedNews: jest.fn() }));
jest.mock('../services/cache', () => ({
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue(undefined),
  del: jest.fn().mockResolvedValue(undefined),
}));

const { classifyCategory, scoreUrgency, transformToAlert, CATEGORY_KEYWORDS, HIGH_URGENCY_KEYWORDS } = require('../services/alertService');
const alertsRouter = require('../routes/alerts');

const app = express();
app.use(express.json());
app.use((req, res, next) => { req.user = req.headers['x-test-user'] ? JSON.parse(req.headers['x-test-user']) : null; next(); });
app.use('/api/alerts', alertsRouter);

afterEach(() => {
  jest.clearAllMocks();
  mockSelectQueue.length = 0;
  mockSingleQueue.length = 0;
  mockCountQueue.length = 0;
  mockMutationQueue.length = 0;
});

describe('classifyCategory()', () => {
  test('classifies Fed-related text as FED', () => expect(classifyCategory('the fomc meeting signals rate hike next quarter').category).toBe('FED'));
  test('classifies Trump tariff text as POLITICAL', () => expect(classifyCategory('trump announces new tariff on chinese goods').category).toBe('POLITICAL'));
  test('classifies jobs report as ECONOMIC', () => expect(classifyCategory('nonfarm payroll jobs report beats expectations').category).toBe('ECONOMIC'));
  test('classifies earnings beat as EARNINGS', () => expect(classifyCategory('apple q3 results earnings eps beat analyst forecast').category).toBe('EARNINGS'));
  test('defaults to BREAKING when no keywords match but impact is assigned', () => { const r = classifyCategory('market update today mid-afternoon session'); expect(r.category).toBe('BREAKING'); expect(r.keywordsHit).toHaveLength(0); });
  test('returns matched keywords in keywordsHit', () => expect(classifyCategory('federal reserve rate hike powell remarks').keywordsHit).toContain('powell'));
  test('prefers FED over POLITICAL when both match (priority)', () => expect(classifyCategory('federal reserve tariff impact on monetary policy').category).toBe('FED'));
});

describe('scoreUrgency()', () => {
  test('returns HIGH for FOMC keyword hit', () => expect(scoreUrgency('fomc emergency meeting', ['fomc'], 9).urgency).toBe('HIGH'));
  test('returns HIGH for high RSS impact score alone', () => expect(scoreUrgency('some market event', ['tariff'], 9).urgency).toBe('HIGH'));
  test('returns MEDIUM for moderate keyword match', () => expect(scoreUrgency('central bank guidance', ['central bank', 'bond market'], 3).urgency).toBe('MEDIUM'));
  test('returns LOW for minimal signal', () => expect(scoreUrgency('tech stocks', [], 1).urgency).toBe('LOW'));
  test('urgencyScore is a non-negative number', () => { const s = scoreUrgency('inflation cpi data', ['inflation', 'cpi'], 7).urgencyScore; expect(s).toBeGreaterThanOrEqual(0); expect(s).toBeLessThanOrEqual(100); });
});

describe('transformToAlert()', () => {
  const article = { id: 'article-xyz', title: 'Federal Reserve Raises Rates by 25 Basis Points', summary: 'FOMC vote is unanimous. Fed rate now at 5.5%. Powell press conference scheduled.', url: 'https://reuters.com/fed-rate', source: 'Reuters Business', impactScore: 9.2, sentimentScore: -0.1, sentimentLabel: 'neutral', symbols: ['SPY', 'TLT'], tags: ['fed', 'rates'], publishedAt: '2025-09-01T14:00:00.000Z' };
  test('transforms a high-impact article into an alert object', () => { const alert = transformToAlert(article); expect(alert.category).toBe('FED'); expect(alert.urgency).toBe('HIGH'); expect(alert.external_id).toBe('article-xyz'); });
  test('includes keywords_hit array', () => expect(Array.isArray(transformToAlert(article).keywords_hit)).toBe(true));
  test('returns null for low-impact non-matching articles', () => expect(transformToAlert({ id: 'low-xyz', title: 'Company X launches new website', summary: 'A technology company updated its website.', impactScore: 1, sentimentScore: 0, sentimentLabel: 'neutral', symbols: [], tags: [], publishedAt: new Date().toISOString(), source: 'BlogPost' })).toBeNull());
  test('preserves symbols and tags from original article', () => { const alert = transformToAlert(article); expect(alert.symbols).toContain('SPY'); expect(alert.symbols).toContain('TLT'); });
});

describe('GET /api/alerts', () => {
  const MOCK_ALERTS = [
    { id: 1, title: 'Fed Raises Rates', category: 'FED', urgency: 'HIGH', urgency_score: 85, source: 'Reuters', published_at: new Date().toISOString(), created_at: new Date().toISOString(), is_read: false, keywords_hit: ['fomc', 'rate hike'], symbols: ['SPY'] },
    { id: 2, title: 'Trump Signs Tariff Order', category: 'POLITICAL', urgency: 'HIGH', urgency_score: 75, source: 'MarketWatch', published_at: new Date().toISOString(), created_at: new Date().toISOString(), is_read: false, keywords_hit: ['trump', 'tariff'], symbols: [] },
  ];
  test('returns 200 with alert list', async () => { mockSelectQueue.push({ data: MOCK_ALERTS, error: null }); const res = await request(app).get('/api/alerts'); expect(res.status).toBe(200); expect(res.body.data).toHaveLength(2); });
  test('filters by category via query param', async () => { mockSelectQueue.push({ data: [MOCK_ALERTS[0]], error: null }); const res = await request(app).get('/api/alerts?category=FED'); expect(res.status).toBe(200); expect(mockSupabaseClient.from.mock.results.at(-1).value.eq).toHaveBeenCalledWith('category', 'FED'); });
  test('filters by urgency via query param', async () => { mockSelectQueue.push({ data: MOCK_ALERTS, error: null }); const res = await request(app).get('/api/alerts?urgency=HIGH'); expect(res.status).toBe(200); expect(mockSupabaseClient.from.mock.results.at(-1).value.eq).toHaveBeenCalledWith('urgency', 'HIGH'); });
  test('returns empty array when no alerts', async () => { mockSelectQueue.push({ data: [], error: null }); const res = await request(app).get('/api/alerts'); expect(res.status).toBe(200); expect(res.body.data).toHaveLength(0); });
  test('handles DB errors gracefully with 500', async () => { mockSelectQueue.push({ data: null, error: { message: 'Supabase down' } }); const res = await request(app).get('/api/alerts'); expect(res.status).toBe(500); expect(res.body.success).toBe(false); });
});

describe('GET /api/alerts/count', () => {
  test('returns unread HIGH count', async () => { mockCountQueue.push({ count: 5, error: null }); const res = await request(app).get('/api/alerts/count'); expect(res.status).toBe(200); expect(res.body.count).toBe(5); });
});

describe('GET /api/alerts/live (SSE)', () => {
  test('returns SSE headers', done => { const http = require('http'); const server = app.listen(0, () => { const port = server.address().port; const req = http.get(`http://localhost:${port}/api/alerts/live`, res => { expect(res.headers['content-type']).toContain('text/event-stream'); expect(res.headers['cache-control']).toContain('no-cache'); req.destroy(); server.close(done); }); req.on('error', () => server.close(done)); }); }, 5000);
});

describe('POST /api/alerts/subscribe', () => {
  const sub = { id: 1, user_id: 42, categories: ['FED', 'ECONOMIC'], urgencies: ['HIGH'], sound_enabled: true, email_enabled: false, push_enabled: true };
  test('requires authentication', async () => expect((await request(app).post('/api/alerts/subscribe').send({ categories: ['FED'] })).status).toBe(401));
  test('saves subscription for authenticated user', async () => { mockSingleQueue.push({ data: sub, error: null }); const res = await request(app).post('/api/alerts/subscribe').set('x-test-user', JSON.stringify({ id: 42, email: 'test@example.com' })).send({ categories: ['FED', 'ECONOMIC'], urgencies: ['HIGH'], sound_enabled: true }); expect(res.status).toBe(200); expect(res.body.success).toBe(true); });
  test('validates categories array contains valid values', async () => expect((await request(app).post('/api/alerts/subscribe').set('x-test-user', JSON.stringify({ id: 42 })).send({ categories: ['INVALID_CATEGORY'] })).status).toBe(400));
  test('validates urgencies array', async () => expect((await request(app).post('/api/alerts/subscribe').set('x-test-user', JSON.stringify({ id: 42 })).send({ urgencies: ['CRITICAL'] })).status).toBe(400));
});

describe('PATCH /api/alerts/read', () => {
  test('marks alerts as read', async () => { mockMutationQueue.push({ error: null }); const res = await request(app).patch('/api/alerts/read').set('x-test-user', JSON.stringify({ id: 42, email: 'test@example.com' })).send({ ids: [1, 2, 3] }); expect(res.status).toBe(200); expect(res.body.success).toBe(true); });
  test('returns 400 for missing ids', async () => expect((await request(app).patch('/api/alerts/read').set('x-test-user', JSON.stringify({ id: 42, email: 'test@example.com' })).send({})).status).toBe(400));
});

describe('CATEGORY_KEYWORDS coverage', () => {
  test('all categories have keywords', () => ['POLITICAL', 'FED', 'ECONOMIC', 'EARNINGS', 'BREAKING'].forEach(cat => expect(CATEGORY_KEYWORDS[cat].length).toBeGreaterThan(5)));
  test('HIGH_URGENCY_KEYWORDS is a Set with entries', () => { expect(HIGH_URGENCY_KEYWORDS instanceof Set).toBe(true); expect(HIGH_URGENCY_KEYWORDS.size).toBeGreaterThan(10); });
});
