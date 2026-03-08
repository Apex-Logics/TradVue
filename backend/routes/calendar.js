/**
 * Economic Calendar Routes
 * GET /api/calendar/upcoming         - Events for next N days (legacy)
 * GET /api/calendar/today            - Today's events
 * GET /api/calendar/high-impact      - High-impact events only (impact=3)
 * GET /api/calendar/macro            - Macro indicator snapshot (FRED data)
 * GET /api/calendar/events           - Comprehensive events (earnings + speeches + economic)
 * GET /api/calendar/earnings         - Earnings-only events
 */

const express = require('express');
const router = express.Router();
const economicCalendar = require('../services/economicCalendar');
const calendarService = require('../services/calendarService');

// ─── NEW: Comprehensive events endpoint ────────────────────────────────────

// GET /api/calendar/events?from=YYYY-MM-DD&to=YYYY-MM-DD&type=all
router.get('/events', async (req, res) => {
  try {
    const { from, to, type = 'all' } = req.query;

    // Default: next 30 days if not specified
    const now = new Date();
    const fromStr = from || now.toISOString().slice(0, 10);
    const toStr = to || new Date(now.getTime() + 30 * 24 * 3600 * 1000).toISOString().slice(0, 10);

    const events = await calendarService.getEvents({ from: fromStr, to: toStr, type });

    res.json({
      success: true,
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
    const fromStr = from || now.toISOString().slice(0, 10);
    const toStr = to || new Date(now.getTime() + 30 * 24 * 3600 * 1000).toISOString().slice(0, 10);

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

// GET /api/calendar/upcoming?days=7&currencies=USD,EUR&minImpact=2
router.get('/upcoming', async (req, res) => {
  try {
    const { days = 7, currencies, minImpact = 1 } = req.query;

    const currencyList = currencies
      ? currencies.split(',').map(c => c.trim().toUpperCase())
      : null;

    const events = await economicCalendar.getUpcomingEvents({
      days: Math.min(parseInt(days) || 7, 30),
      currencies: currencyList,
      minImpact: parseInt(minImpact) || 1
    });

    res.json({
      success: true,
      count: events.length,
      data: events,
      filters: { days, currencies: currencyList, minImpact },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Calendar] /upcoming error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch calendar events' });
  }
});

// GET /api/calendar/today?currencies=USD
router.get('/today', async (req, res) => {
  try {
    const { currencies } = req.query;
    const currencyList = currencies
      ? currencies.split(',').map(c => c.trim().toUpperCase())
      : null;

    const events = await economicCalendar.getTodaysEvents({ currencies: currencyList });

    res.json({
      success: true,
      count: events.length,
      data: events,
      date: new Date().toISOString().split('T')[0],
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Calendar] /today error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch today\'s events' });
  }
});

// GET /api/calendar/high-impact?days=3
router.get('/high-impact', async (req, res) => {
  try {
    const { days = 3 } = req.query;

    const events = await economicCalendar.getHighImpactEvents({
      days: Math.min(parseInt(days) || 3, 14)
    });

    res.json({
      success: true,
      count: events.length,
      data: events,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Calendar] /high-impact error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch high-impact events' });
  }
});

// GET /api/calendar/macro - Macro snapshot (FRED indicators + upcoming high-impact)
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
