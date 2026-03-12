/**
 * Market Alerts Service
 *
 * Detects unusual price movements and cross-references them with the
 * economic calendar to surface possible catalysts.
 *
 * Algorithm:
 *   1. Every 30 seconds, read current prices from the Finnhub quote cache
 *      (warmed by dataPrefetcher — no extra API calls).
 *   2. Store each price in a rolling 30-minute window (in-memory).
 *   3. Compare current price to the snapshot 5 min ago and 15 min ago.
 *   4. When change exceeds threshold (1% / 5min or 2% / 15min), emit an alert.
 *   5. Cross-reference today's High/Medium impact calendar events — if one
 *      fired in the last 15 minutes, attach it as the possible_catalyst.
 *   6. When an alert fires, also bust the news cache so the next poll
 *      returns fresh articles about the move.
 *
 * Stored state:
 *   priceHistory   Map<symbol, Array<{ts, price}>>  — last 30 min
 *   activeAlerts   Array<AlertObject>                — last 60 min, deduped
 */

'use strict';

const finnhub        = require('./finnhub');
const calendarService = require('./calendarService');
const newsService    = require('./newsService');

// ─── Config ───────────────────────────────────────────────────────────────────

/** Symbols checked for unusual moves every 30 s */
const ALERT_SYMBOLS = ['SPY', 'QQQ', 'DIA', 'IWM', 'AAPL', 'TSLA', 'NVDA'];

/** Rolling window kept in memory (milliseconds) */
const WINDOW_MS = 30 * 60 * 1000;          // 30 min

/** Alert expiry — alerts older than this are pruned from activeAlerts */
const ALERT_EXPIRY_MS = 60 * 60 * 1000;   // 60 min

/** Price-change thresholds that trigger an alert */
const THRESHOLDS = [
  { timeframeMs: 5  * 60 * 1000, minChangePct: 1.0, label: '5min'  },
  { timeframeMs: 15 * 60 * 1000, minChangePct: 2.0, label: '15min' },
];

/** How many ms of calendar-event recency counts as a possible catalyst */
const CATALYST_LOOKBACK_MS = 15 * 60 * 1000;

// ─── State ────────────────────────────────────────────────────────────────────

/** @type {Map<string, Array<{ts: number, price: number}>>} */
const priceHistory = new Map();

/** @type {Array<{id:string, symbol:string, change_pct:number, timeframe:string, direction:string, timestamp:string, possible_catalyst:string}>} */
let activeAlerts = [];

let _intervalId = null;
let _running    = false;
let _startedAt  = 0;  // timestamp of when monitoring began

/** Minimum warmup period before firing alerts (prevent startup false positives) */
const WARMUP_MS = 5 * 60 * 1000;  // 5 minutes

// ─── Price History Helpers ────────────────────────────────────────────────────

/**
 * Append a price snapshot and prune stale entries.
 */
function recordPrice(symbol, price) {
  if (!priceHistory.has(symbol)) priceHistory.set(symbol, []);
  const history = priceHistory.get(symbol);
  history.push({ ts: Date.now(), price });

  // Prune entries older than the window
  const cutoff = Date.now() - WINDOW_MS;
  const firstKeep = history.findIndex(e => e.ts >= cutoff);
  if (firstKeep > 0) history.splice(0, firstKeep);
}

/**
 * Get the price snapshot closest to `targetMs` milliseconds ago.
 * Returns null if there's no data in that timeframe.
 *
 * @param {string} symbol
 * @param {number} targetMs - e.g. 5 * 60 * 1000 for 5 min ago
 * @returns {number|null}
 */
function getPriceAgo(symbol, targetMs) {
  const history = priceHistory.get(symbol);
  if (!history || history.length < 2) return null;

  const targetTs = Date.now() - targetMs;
  // Find the entry closest to targetTs (but not newer)
  let best = null;
  for (const entry of history) {
    if (entry.ts <= targetTs) {
      best = entry;
    } else {
      break;
    }
  }
  return best ? best.price : null;
}

// ─── Calendar Cross-Reference ─────────────────────────────────────────────────

/**
 * Find today's high-impact calendar events that fired in the last 15 minutes.
 * Returns a short string like "CPI Report 8:30 AM" or empty string.
 *
 * @returns {Promise<string>}
 */
async function findRecentCatalyst() {
  try {
    const events = await calendarService.getTodaysEvents();
    const now = Date.now();
    const lookbackCutoff = now - CATALYST_LOOKBACK_MS;

    const highImpact = events.filter(e => {
      const impact = (e.impact || '').toString().toLowerCase();
      if (!['high', '3', 'medium', '2'].includes(impact)) return false;

      const eventTs = new Date(e.date).getTime();
      return eventTs > lookbackCutoff && eventTs <= now;
    });

    if (highImpact.length === 0) return '';

    // Pick the most recently fired event as the likely catalyst
    highImpact.sort((a, b) => new Date(b.date) - new Date(a.date));
    const evt = highImpact[0];
    const timeStr = new Date(evt.date).toLocaleTimeString('en-US', {
      hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York'
    });
    return `${evt.title} ${timeStr} ET`;
  } catch (err) {
    console.warn('[MarketAlerts] Calendar cross-reference failed:', err.message);
    return '';
  }
}

// ─── Alert Deduplication ──────────────────────────────────────────────────────

/**
 * Build a stable dedup key for an alert so we don't fire the same one twice.
 */
function alertKey(symbol, timeframe, direction) {
  // Round timestamp to nearest 5-min bucket to allow re-fire after 5 min
  const bucket = Math.floor(Date.now() / (5 * 60 * 1000));
  return `${symbol}:${timeframe}:${direction}:${bucket}`;
}

const firedAlerts = new Set();

// ─── Core Check Loop ──────────────────────────────────────────────────────────

async function runCheckCycle() {
  if (_running) return;
  _running = true;

  try {
    // Don't fire alerts during warmup period — need price history to be meaningful
    const inWarmup = (Date.now() - _startedAt) < WARMUP_MS;
    const newAlerts = [];

    for (const symbol of ALERT_SYMBOLS) {
      let currentPrice;
      try {
        const quote = await finnhub.getQuote(symbol);
        currentPrice = quote?.c || quote?.current;
        if (!currentPrice || currentPrice <= 0) continue;
      } catch {
        continue;
      }

      // Record in rolling window
      recordPrice(symbol, currentPrice);

      // Check each threshold
      for (const { timeframeMs, minChangePct, label } of THRESHOLDS) {
        const oldPrice = getPriceAgo(symbol, timeframeMs);
        if (!oldPrice || oldPrice <= 0) continue;

        const changePct = ((currentPrice - oldPrice) / oldPrice) * 100;
        const absChange = Math.abs(changePct);

        // Sanity check: reject absurd moves (>20%) — likely bad data or cache startup artifact
        if (absChange > 20) {
          console.warn(`[MarketAlerts] Ignoring ${symbol} ${changePct.toFixed(2)}% move — likely bad data`);
          continue;
        }

        if (absChange < minChangePct) continue;

        // Skip alerts during warmup period
        if (inWarmup) continue;

        const direction = changePct > 0 ? 'up' : 'down';
        const key = alertKey(symbol, label, direction);

        if (firedAlerts.has(key)) continue;
        firedAlerts.add(key);

        // Find possible catalyst from calendar
        const possible_catalyst = await findRecentCatalyst();

        const alert = {
          id:               key,
          symbol,
          change_pct:       parseFloat(changePct.toFixed(2)),
          timeframe:        label,
          direction,
          timestamp:        new Date().toISOString(),
          possible_catalyst,
        };

        newAlerts.push(alert);

        // Bust news cache so fresh articles surface immediately
        newsService.forceRefreshBreaking().catch(() => {});
        newsService.refreshNewsForSymbol(symbol).catch(() => {});

        console.info(`[MarketAlerts] 🚨 ${symbol} ${changePct > 0 ? '+' : ''}${changePct.toFixed(2)}% in ${label}${possible_catalyst ? ` — catalyst: ${possible_catalyst}` : ''}`);
      }
    }

    // Append new alerts and prune stale ones
    if (newAlerts.length > 0) {
      activeAlerts.push(...newAlerts);
    }

    const cutoff = Date.now() - ALERT_EXPIRY_MS;
    activeAlerts = activeAlerts.filter(a => new Date(a.timestamp).getTime() > cutoff);

    // Also prune old fired keys (keep memory bounded)
    if (firedAlerts.size > 500) {
      // Clear oldest half — simple approach for a small in-memory set
      const arr = [...firedAlerts];
      arr.slice(0, 250).forEach(k => firedAlerts.delete(k));
    }
  } catch (err) {
    console.error('[MarketAlerts] Check cycle error:', err.message);
  } finally {
    _running = false;
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Get currently active market alerts (fired in last 60 min).
 * @returns {Array}
 */
function getActiveAlerts() {
  const cutoff = Date.now() - ALERT_EXPIRY_MS;
  return activeAlerts
    .filter(a => new Date(a.timestamp).getTime() > cutoff)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

/**
 * Get upcoming high-impact calendar events in the next N hours.
 * @param {number} hours - Look-ahead window (default 2)
 * @returns {Promise<Array>}
 */
async function getUpcomingHighImpactEvents(hours = 2) {
  try {
    const events = await calendarService.getTodaysEvents();
    const now    = Date.now();
    const cutoff = now + hours * 60 * 60 * 1000;

    return events
      .filter(e => {
        const ts     = new Date(e.date).getTime();
        const impact = (e.impact || '').toString().toLowerCase();
        const isHigh = ['high', '3', 'medium', '2'].includes(impact);
        return isHigh && ts > now && ts <= cutoff;
      })
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .slice(0, 10);
  } catch (err) {
    console.error('[MarketAlerts] Upcoming events fetch failed:', err.message);
    return [];
  }
}

/**
 * Start the 30-second price check loop.
 */
function start() {
  if (_intervalId) return;
  _startedAt = Date.now();
  console.info('[MarketAlerts] Starting market alert monitor (30s interval, 5min warmup)...');

  // Run once immediately (warmup — collects prices but won't fire alerts)
  runCheckCycle().catch(() => {});

  _intervalId = setInterval(() => {
    runCheckCycle().catch(() => {});
  }, 30 * 1000);
}

/**
 * Stop the check loop (for tests / clean shutdown).
 */
function stop() {
  if (_intervalId) {
    clearInterval(_intervalId);
    _intervalId = null;
    console.info('[MarketAlerts] Monitor stopped.');
  }
}

module.exports = {
  start,
  stop,
  getActiveAlerts,
  getUpcomingHighImpactEvents,
  runCheckCycle,   // exported for testing
  ALERT_SYMBOLS,
};
