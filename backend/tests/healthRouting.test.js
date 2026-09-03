/**
 * Health vs market-intel routing
 *
 * A generic app.use('/api', marketIntel) can swallow GET /api/health if the
 * intel router has (or later gains) a catch-all. These tests pin the contract:
 *   - intel is namespaced under /api/intel
 *   - /api/health and /health return the real health JSON, never intel output
 */

'use strict';

const fs = require('fs');
const path = require('path');
const request = require('supertest');
const express = require('express');
const { getHealthBuildIdentity } = require('../lib/buildIdentity');

const SERVER_JS = path.join(__dirname, '../server.js');
const INTEL_ROUTE = path.join(__dirname, '../routes/marketIntel.js');
const FRONTEND_INTEL = path.join(__dirname, '../../frontend/app/components/MarketIntel.tsx');

jest.mock('../services/insiderTradeStore', () => ({
  ensureTable: jest.fn().mockResolvedValue(undefined),
  getRecordCount: jest.fn().mockResolvedValue(1),
  queryTrades: jest.fn().mockResolvedValue({ data: [], total: 0, sources: { edgar: 0, finnhub: 0 } }),
  runIngestionCycle: jest.fn().mockResolvedValue({}),
}));

jest.mock('../services/fred', () => ({
  getAllIndicators: jest.fn().mockResolvedValue({ available: true, indicators: [] }),
}));

jest.mock('../services/edgarForm4', () => ({
  getInsiderTradesBySymbol: jest.fn().mockResolvedValue([]),
  getBatchInsiderTrades: jest.fn().mockResolvedValue([]),
}));

jest.mock('../services/finnhub', () => ({
  getInsiderTransactions: jest.fn().mockResolvedValue({ data: [] }),
  getEarningsCalendar: jest.fn().mockResolvedValue({ earningsCalendar: [] }),
  getIPOCalendar: jest.fn().mockResolvedValue({ ipoCalendar: [] }),
}));

jest.mock('../services/cache', () => ({
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue(undefined),
}));

function sendHealth(_req, res) {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: 'TradVue API',
    build: getHealthBuildIdentity(),
  });
}

function expectRealHealthJson(body) {
  expect(body).toEqual(expect.objectContaining({
    status: 'OK',
    service: 'TradVue API',
  }));
  expect(body).toHaveProperty('timestamp');
  expect(Number.isNaN(Date.parse(body.timestamp))).toBe(false);
  expect(body).toHaveProperty('build');
  expect(typeof body.build).toBe('string');
  expect(body.build.length).toBeGreaterThan(0);
  // Market-intel envelope must never leak through
  expect(body.success).toBeUndefined();
  expect(body.data).toBeUndefined();
  expect(body.shadowed).toBeUndefined();
}

function intelRouterWithCatchAll() {
  const router = express.Router();
  router.get('/economic-indicators', (_req, res) => res.json({ success: true, data: [] }));
  router.get('/insider-trades', (_req, res) => res.json({ success: true, data: [] }));
  router.get('/earnings-calendar', (_req, res) => res.json({ success: true, data: [] }));
  router.get('/ipo-calendar', (_req, res) => res.json({ success: true, data: [] }));
  // Catch-all: the failure mode of mounting this router at bare /api
  router.use((req, res) => {
    res.json({ success: true, data: [], shadowed: true, intelPath: req.path });
  });
  return router;
}

function parseServerIntelMount() {
  const src = fs.readFileSync(SERVER_JS, 'utf8');
  const match = src.match(
    /app\.use\(\s*['"](\/api(?:\/intel)?)['"]\s*,\s*require\(\s*['"]\.\/routes\/marketIntel['"]\s*\)/
  );
  expect(match).not.toBeNull();
  const intelIdx = match.index;
  const apiHealthIdx = src.indexOf("app.get('/api/health'");
  const healthIdx = src.indexOf("app.get('/health'");
  return {
    src,
    intelMount: match[1],
    intelBeforeApiHealth: intelIdx < apiHealthIdx,
    hasApiHealth: apiHealthIdx !== -1,
    hasHealth: healthIdx !== -1,
  };
}

function buildAppFromServerMountOrder() {
  const { intelMount, intelBeforeApiHealth } = parseServerIntelMount();
  const app = express();
  const intel = intelRouterWithCatchAll();
  if (intelBeforeApiHealth) {
    app.use(intelMount, intel);
    app.get('/api/health', sendHealth);
    app.get('/health', sendHealth);
  } else {
    app.get('/api/health', sendHealth);
    app.get('/health', sendHealth);
    app.use(intelMount, intel);
  }
  app.use((_req, res) => res.status(404).json({ error: 'Route not found' }));
  return { app, intelMount };
}

describe('server.js market-intel mount', () => {
  test('namespaces market intel under /api/intel (not bare /api)', () => {
    const { intelMount, src } = parseServerIntelMount();
    expect(intelMount).toBe('/api/intel');
    expect(src).not.toMatch(
      /app\.use\(\s*['"]\/api['"]\s*,\s*require\(\s*['"]\.\/routes\/marketIntel['"]\s*\)/
    );
  });

  test('/api/health handler is the real health payload, not a thin stub', () => {
    const src = fs.readFileSync(SERVER_JS, 'utf8');
    const apiHealthIdx = src.indexOf("app.get('/api/health'");
    const healthIdx = src.indexOf("app.get('/health'");
    expect(apiHealthIdx).toBeGreaterThan(-1);
    expect(healthIdx).toBeGreaterThan(-1);

    const apiHealthSlice = src.slice(apiHealthIdx, healthIdx);
    const usesSharedHandler = /sendHealth|healthPayload|getHealthBuildIdentity/.test(apiHealthSlice);
    const hasTimestampAndBuild = /timestamp/.test(apiHealthSlice) && /build/.test(apiHealthSlice);
    expect(usesSharedHandler || hasTimestampAndBuild).toBe(true);
  });
});

describe('GET /api/health vs market-intel catch-all (server.js mount order)', () => {
  test('GET /api/health returns real health JSON, not market-intel output', async () => {
    const { app } = buildAppFromServerMountOrder();
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expectRealHealthJson(res.body);
  });

  test('GET /health returns the same real health JSON', async () => {
    const { app } = buildAppFromServerMountOrder();
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expectRealHealthJson(res.body);
  });

  test('intel catch-all cannot steal /api/health when namespaced', async () => {
    const { app, intelMount } = buildAppFromServerMountOrder();
    expect(intelMount).toBe('/api/intel');

    const stolen = await request(app).get('/api/health');
    expect(stolen.body.shadowed).toBeUndefined();
    expectRealHealthJson(stolen.body);

    const intelHit = await request(app).get('/api/intel/does-not-exist');
    expect(intelHit.body.shadowed).toBe(true);
  });
});

describe('real marketIntel router under /api/intel', () => {
  let app;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.get('/api/health', sendHealth);
    app.get('/health', sendHealth);
    app.use('/api/intel', require('../routes/marketIntel'));
    app.use((_req, res) => res.status(404).json({ error: 'Route not found' }));
  });

  test('GET /api/health still hits the health handler when intel is mounted', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expectRealHealthJson(res.body);
  });

  test('GET /health still hits the health handler when intel is mounted', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expectRealHealthJson(res.body);
  });

  test('intel endpoints live under /api/intel, not /api', async () => {
    const namespaced = await request(app).get('/api/intel/economic-indicators');
    expect(namespaced.status).not.toBe(404);
    expect(namespaced.body.success).toBe(true);

    const oldPath = await request(app).get('/api/economic-indicators');
    expect(oldPath.status).toBe(404);
  });
});

describe('callers of market-intel paths', () => {
  test('marketIntel route comments document /api/intel prefix', () => {
    const src = fs.readFileSync(INTEL_ROUTE, 'utf8');
    expect(src).toMatch(/\/api\/intel\/economic-indicators/);
    expect(src).toMatch(/\/api\/intel\/insider-trades/);
    expect(src).toMatch(/\/api\/intel\/earnings-calendar/);
    expect(src).toMatch(/\/api\/intel\/ipo-calendar/);
  });

  test('frontend MarketIntel fetches namespaced /api/intel paths', () => {
    const src = fs.readFileSync(FRONTEND_INTEL, 'utf8');
    expect(src).toContain('/api/intel/insider-trades');
    expect(src).toContain('/api/intel/earnings-calendar');
    expect(src).toContain('/api/intel/economic-indicators');
    expect(src).toContain('/api/intel/ipo-calendar');
    expect(src).not.toMatch(/\$\{API_BASE\}\/api\/(insider-trades|earnings-calendar|economic-indicators|ipo-calendar)/);
  });
});
