/**
 * Economic Calendar Route Tests
 * 
 * TDD: Tests written first to define expected behavior.
 * Covers: GET /api/calendar/today, /api/calendar/upcoming, /api/calendar/high-impact
 * 
 * Mocks the economicCalendar service to isolate route logic.
 * Skips tests if FINNHUB_API_KEY is not set (required by economicCalendar service).
 */

const skipIfNoApiKey = !process.env.FINNHUB_API_KEY;

const request = require('supertest');
const express = require('express');

// Mock both calendar services BEFORE importing routes
jest.mock('../services/economicCalendar', () => ({
  getUpcomingEvents: jest.fn(),
  getTodaysEvents: jest.fn(),
  getHighImpactEvents: jest.fn(),
  getMacroSnapshot: jest.fn(),
}));

jest.mock('../services/calendarService', () => ({
  getEvents: jest.fn(),
  getEarnings: jest.fn(),
  getTodaysEvents: jest.fn(),
  getUpcomingEvents: jest.fn(),
  getHighImpactEvents: jest.fn(),
}));

jest.mock('../services/fmp', () => ({
  getHighImpactEvents: jest.fn(),
}));

const economicCalendar = require('../services/economicCalendar');
const calendarService = require('../services/calendarService');

function buildTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/calendar', require('../routes/calendar'));
  return app;
}

const mockEvents = [
  {
    id: 'evt-001',
    title: 'US CPI (YoY)',
    currency: 'USD',
    impact: 3,
    date: new Date().toISOString(),
    actual: '3.2%',
    forecast: '3.1%',
    previous: '3.4%',
    source: 'forexfactory'
  },
  {
    id: 'evt-002',
    title: 'ECB Interest Rate Decision',
    currency: 'EUR',
    impact: 3,
    date: new Date().toISOString(),
    actual: null,
    forecast: '4.50%',
    previous: '4.50%',
    source: 'forexfactory'
  }
];

// ──────────────────────────────────────────
// GET /api/calendar/today
// ──────────────────────────────────────────

(skipIfNoApiKey ? describe.skip : describe)('GET /api/calendar/today', () => {
  let app;
  beforeEach(() => { app = buildTestApp(); });
  afterEach(() => jest.clearAllMocks());

  test('returns today\'s events with success envelope', async () => {
    calendarService.getTodaysEvents.mockResolvedValueOnce(mockEvents);

    const res = await request(app).get('/api/calendar/today');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.count).toBe(2);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.date).toBeDefined();
    expect(res.body.timestamp).toBeDefined();
  });

  test('filters by currency when ?currencies= is passed', async () => {
    calendarService.getTodaysEvents.mockResolvedValueOnce(
      mockEvents.filter(e => e.currency === 'USD')
    );

    const res = await request(app).get('/api/calendar/today?currencies=USD');

    expect(res.status).toBe(200);
    // Verify the service was called with the currency filter
    expect(calendarService.getTodaysEvents).toHaveBeenCalledWith(
      expect.objectContaining({ currencies: ['USD'] })
    );
  });

  test('returns empty array when no events today', async () => {
    calendarService.getTodaysEvents.mockResolvedValueOnce([]);

    const res = await request(app).get('/api/calendar/today');
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(0);
    expect(res.body.data).toEqual([]);
  });

  test('returns 500 on service error', async () => {
    calendarService.getTodaysEvents.mockRejectedValueOnce(new Error('Feed unavailable'));

    const res = await request(app).get('/api/calendar/today');
    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });
});

// ──────────────────────────────────────────
// GET /api/calendar/upcoming
// ──────────────────────────────────────────

(skipIfNoApiKey ? describe.skip : describe)('GET /api/calendar/upcoming', () => {
  let app;
  beforeEach(() => { app = buildTestApp(); });
  afterEach(() => jest.clearAllMocks());

  test('returns upcoming events for default 7 days', async () => {
    calendarService.getUpcomingEvents.mockResolvedValueOnce(mockEvents);

    const res = await request(app).get('/api/calendar/upcoming');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(2);
    expect(calendarService.getUpcomingEvents).toHaveBeenCalledWith(
      expect.objectContaining({ days: 7 })
    );
  });

  test('respects ?days= parameter', async () => {
    calendarService.getUpcomingEvents.mockResolvedValueOnce(mockEvents);

    await request(app).get('/api/calendar/upcoming?days=14');

    expect(calendarService.getUpcomingEvents).toHaveBeenCalledWith(
      expect.objectContaining({ days: 14 })
    );
  });

  test('caps days at 60 to prevent abuse', async () => {
    calendarService.getUpcomingEvents.mockResolvedValueOnce(mockEvents);

    await request(app).get('/api/calendar/upcoming?days=999');

    expect(calendarService.getUpcomingEvents).toHaveBeenCalledWith(
      expect.objectContaining({ days: 60 })
    );
  });

  test('respects ?minImpact= filter', async () => {
    calendarService.getUpcomingEvents.mockResolvedValueOnce([mockEvents[0]]);

    const res = await request(app).get('/api/calendar/upcoming?minImpact=3');

    expect(res.status).toBe(200);
    expect(calendarService.getUpcomingEvents).toHaveBeenCalledWith(
      expect.objectContaining({ minImpact: 3 })
    );
  });

  test('passes multiple currency filters', async () => {
    calendarService.getUpcomingEvents.mockResolvedValueOnce(mockEvents);

    await request(app).get('/api/calendar/upcoming?currencies=USD,EUR');

    expect(calendarService.getUpcomingEvents).toHaveBeenCalledWith(
      expect.objectContaining({ currencies: ['USD', 'EUR'] })
    );
  });

  test('returns 500 on service error', async () => {
    calendarService.getUpcomingEvents.mockRejectedValueOnce(new Error('Service down'));

    const res = await request(app).get('/api/calendar/upcoming');
    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });
});

// ──────────────────────────────────────────
// GET /api/calendar/high-impact
// ──────────────────────────────────────────

(skipIfNoApiKey ? describe.skip : describe)('GET /api/calendar/high-impact', () => {
  let app;
  beforeEach(() => { app = buildTestApp(); });
  afterEach(() => jest.clearAllMocks());

  test('returns only high-impact events', async () => {
    const highImpactOnly = mockEvents.filter(e => e.impact === 3);
    calendarService.getHighImpactEvents.mockResolvedValueOnce(highImpactOnly);

    const res = await request(app).get('/api/calendar/high-impact');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.every(e => e.impact === 3)).toBe(true);
  });

  test('caps days at 14', async () => {
    calendarService.getHighImpactEvents.mockResolvedValueOnce([]);

    await request(app).get('/api/calendar/high-impact?days=100');

    expect(calendarService.getHighImpactEvents).toHaveBeenCalledWith(
      expect.objectContaining({ days: 14 })
    );
  });

  test('defaults to 3 days', async () => {
    calendarService.getHighImpactEvents.mockResolvedValueOnce([]);

    await request(app).get('/api/calendar/high-impact');

    expect(calendarService.getHighImpactEvents).toHaveBeenCalledWith(
      expect.objectContaining({ days: 3 })
    );
  });
});
