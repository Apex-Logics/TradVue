/**
 * Economic Calendar Routes
 *
 * GET /api/calendar/events       — Comprehensive events (earnings + speeches + economic)
 * GET /api/calendar/earnings     — Earnings-only events
 * GET /api/calendar/today        — Today's events (real data, no mocks)
 * GET /api/calendar/upcoming     — Events for next N days
 * GET /api/calendar/high-impact  — High-impact events only
 * GET /api/calendar/macro        — Macro indicator snapshot (FRED data)
 *
 * All event endpoints return the SAME schema:
 *   { success, count, events[], filters, timestamp }
 *
 * The /today and /upcoming endpoints now delegate to calendarService
 * (ForexFactory JSON + Finnhub) instead of the old XML-based parser
 * that was silently falling back to mock data.
 */

const express = require('express');
const router = express.Router();
const calendarService = require('../services/calendarService');
const economicCalendar = require('../services/economicCalendar');
const fmp = require('../services/fmp');

// ─── In-memory cache ──────────────────────────────────────────────────────────

const eventsCache = new Map();
const CACHE_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours — calendar events don't change frequently

/**
 * Get current ET date as YYYY-MM-DD string.
 * Used to auto-bust cache when the date rolls over in Eastern Time.
 */
function getETDateStr() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}

function getCacheKey(from, to, type) {
  // Include ET date in key so cache auto-invalidates at midnight ET
  return `${from}|${to}|${type}|${getETDateStr()}`;
}

function getCached(key) {
  const entry = eventsCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    eventsCache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(key, data) {
  eventsCache.set(key, { data, timestamp: Date.now() });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toDateStr(d) {
  return d.toISOString().slice(0, 10);
}

// ─── Comprehensive events endpoint ───────────────────────────────────────────

// GET /api/calendar/events?from=YYYY-MM-DD&to=YYYY-MM-DD&type=all&page=1&limit=200
router.get('/events', async (req, res) => {
  try {
    const { from, to, type = 'all' } = req.query;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(2000, Math.max(1, parseInt(req.query.limit) || 200));

    const now = new Date();
    const fromStr = from || toDateStr(now);
    const toStr = to || toDateStr(new Date(now.getTime() + 30 * 24 * 3600 * 1000));

    const cacheKey = getCacheKey(fromStr, toStr, type);
    let allEvents = getCached(cacheKey);

    if (!allEvents) {
      allEvents = await calendarService.getEvents({ from: fromStr, to: toStr, type });
      setCache(cacheKey, allEvents);
    }

    const total = allEvents.length;
    const totalPages = Math.ceil(total / limit);
    const offset = (page - 1) * limit;
    const events = allEvents.slice(offset, offset + limit);

    res.json({
      success: true,
      total,
      page,
      limit,
      totalPages,
      count: events.length,
      events,
      filters: { from: fromStr, to: toStr, type },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Calendar] /events error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch calendar events' });
  }
});

// GET /api/calendar/earnings?from=YYYY-MM-DD&to=YYYY-MM-DD
router.get('/earnings', async (req, res) => {
  try {
    const { from, to } = req.query;
    const now = new Date();
    const fromStr = from || toDateStr(now);
    const toStr = to || toDateStr(new Date(now.getTime() + 30 * 24 * 3600 * 1000));

    const events = await calendarService.getEarnings({ from: fromStr, to: toStr });

    res.json({
      success: true,
      count: events.length,
      events,
      filters: { from: fromStr, to: toStr },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Calendar] /earnings error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch earnings events' });
  }
});

// GET /api/calendar/today?currencies=USD,EUR
// Returns today's events using real ForexFactory + Finnhub data (no mocks)
router.get('/today', async (req, res) => {
  try {
    const { currencies } = req.query;
    const currencyList = currencies
      ? currencies.split(',').map(c => c.trim().toUpperCase())
      : null;

    // Use calendarService directly — getTodaysEvents delegates to getEvents
    // which uses FF JSON API (not the broken XML path that returned mocks)
    const events = await calendarService.getTodaysEvents({ currencies: currencyList });

    // Normalize field names: calendarService returns {country} but old schema used {currency}
    // Include both for backwards compatibility
    const normalized = events.map(e => ({
      ...e,
      currency: e.country || e.currency || 'USD',
      datetime: e.date,
      impactLabel: e.impact,
      impact: ['Low', 'Medium', 'High', 'Holiday'].includes(e.impact) ? e.impact : 'Low'
    }));

    res.json({
      success: true,
      count: normalized.length,
      events: normalized,   // new field name
      data: normalized,     // legacy field name (some frontend code uses .data)
      date: new Date().toISOString().split('T')[0],
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Calendar] /today error:', error);
    res.status(500).json({ success: false, error: "Failed to fetch today's events" });
  }
});

// GET /api/calendar/upcoming?days=7&currencies=USD,EUR&minImpact=1
// Returns events for next N days — real data, no mocks
router.get('/upcoming', async (req, res) => {
  try {
    const { days = 7, currencies, minImpact = 1 } = req.query;

    const currencyList = currencies
      ? currencies.split(',').map(c => c.trim().toUpperCase())
      : null;

    // Delegate to calendarService (FF JSON + Finnhub)
    const events = await calendarService.getUpcomingEvents({
      days: Math.min(parseInt(days) || 7, 60),
      currencies: currencyList,
      minImpact: parseInt(minImpact) || 1
    });

    // Normalize field names for backwards compatibility
    const normalized = events.map(e => ({
      ...e,
      currency: e.country || e.currency || 'USD',
      datetime: e.date,
      impactLabel: e.impact,
      impact: e.impact
    }));

    res.json({
      success: true,
      count: normalized.length,
      events: normalized,   // new field name
      data: normalized,     // legacy field name
      filters: { days, currencies: currencyList, minImpact },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Calendar] /upcoming error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch calendar events' });
  }
});

// GET /api/calendar/high-impact?days=3
router.get('/high-impact', async (req, res) => {
  try {
    const { days = 3 } = req.query;
    const events = await calendarService.getHighImpactEvents({
      days: Math.min(parseInt(days) || 3, 14)
    });

    res.json({
      success: true,
      count: events.length,
      events,
      data: events, // legacy
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Calendar] /high-impact error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch high-impact events' });
  }
});

// GET /api/calendar/market-status — Current market session + upcoming holidays
// Cache: 5 minutes (baked into fmp.getMarketStatus)
router.get('/market-status', async (req, res) => {
  try {
    const CACHE_KEY = 'route:market-status';
    let result = eventsCache.get(CACHE_KEY);
    const FIVE_MIN = 5 * 60 * 1000;
    if (result && Date.now() - result.timestamp < FIVE_MIN) {
      return res.json(result.data);
    }

    const [status, holidays] = await Promise.all([
      fmp.getMarketStatus(),
      fmp.getMarketHolidays({
        from: new Date().toISOString().slice(0, 10),
        to:   new Date(Date.now() + 90 * 24 * 3600 * 1000).toISOString().slice(0, 10),
      }),
    ]);

    const payload = {
      success:   true,
      isOpen:    status.isOpen,
      session:   status.session,
      nextOpen:  status.nextOpen  || null,
      nextClose: status.nextClose || null,
      holidayName: status.holidayName || null,
      holidays:  holidays.map(h => ({
        date:  h.date.slice(0, 10),
        title: h.title,
      })),
      timestamp: new Date().toISOString(),
    };

    eventsCache.set(CACHE_KEY, { data: payload, timestamp: Date.now() });
    res.json(payload);
  } catch (error) {
    console.error('[Calendar] /market-status error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch market status' });
  }
});

// GET /api/calendar/macro — Macro snapshot (FRED indicators + upcoming high-impact)
router.get('/macro', async (req, res) => {
  try {
    const snapshot = await economicCalendar.getMacroSnapshot();
    res.json({
      success: true,
      data: snapshot,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Calendar] /macro error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch macro snapshot' });
  }
});

module.exports = router;
