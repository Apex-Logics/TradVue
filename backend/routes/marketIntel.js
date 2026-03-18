/**
 * Market Intelligence Routes
 *
 * Public endpoints (no JWT required) for:
 *   GET /api/economic-indicators  — FRED macroeconomic data
 *   GET /api/insider-trades       — SEC EDGAR + Finnhub insider transactions
 *   GET /api/earnings-calendar    — Upcoming earnings (Finnhub)
 *   GET /api/ipo-calendar         — Upcoming IPOs (Finnhub)
 *
 * Rate limit: 100 req/min per IP (via express-rate-limit)
 */

'use strict';

const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();

const fredService = require('../services/fred');
const secEdgar = require('../services/secEdgar');
const finnhub = require('../services/finnhub');

// ─── Per-route rate limit: 100 req/min per IP ─────────────────────────────────

const intelLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  message: { error: 'Too many requests. Please try again in a minute.' },
  standardHeaders: true,
  legacyHeaders: false,
});


// ─── Last-good-response cache (1 hour) ────────────────────────────────────────
// If the upstream source (SEC EDGAR) is temporarily down or returns empty,
// serve the last successful response to avoid showing empty tables.

const lastGoodCache = new Map(); // key -> { data, timestamp }
const LAST_GOOD_TTL_MS = 60 * 60 * 1000; // 1 hour

function getLastGood(key) {
  const entry = lastGoodCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > LAST_GOOD_TTL_MS) {
    lastGoodCache.delete(key);
    return null;
  }
  return entry.data;
}

function setLastGood(key, data) {
  if (data && Array.isArray(data) && data.length > 0) {
    lastGoodCache.set(key, { data, timestamp: Date.now() });
  }
}

// ─── Default tickers for general insider feed ─────────────────────────────────

const DEFAULT_INSIDER_TICKERS = ['AAPL', 'MSFT', 'NVDA', 'TSLA', 'AMZN', 'META', 'GOOGL', 'JPM', 'V', 'SPY'];
const BATCH_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
let batchInsiderCache = null; // { data, timestamp }

/**
 * Fetch Finnhub insider trades for all DEFAULT_INSIDER_TICKERS with 200ms delay between each call.
 * Results are merged, deduplicated, and sorted by date descending.
 * Cached for 30 minutes.
 */
async function fetchBatchInsiderTrades() {
  // Return cached batch if fresh
  if (batchInsiderCache && (Date.now() - batchInsiderCache.timestamp < BATCH_CACHE_TTL_MS)) {
    return batchInsiderCache.data;
  }

  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
  const allItems = [];

  for (const ticker of DEFAULT_INSIDER_TICKERS) {
    try {
      const result = await finnhub.getInsiderTransactions(ticker);
      const items = (result?.data || []).map(t => ({
        title: `${t.transactionType}: ${ticker} — ${t.name}`,
        summary: `${t.transactionType} ${Math.abs(t.change || 0).toLocaleString()} shares on ${t.transactionDate || 'N/A'}`,
        url: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&company=${ticker}&type=4&dateb=&owner=include&count=10`,
        source: 'Finnhub',
        category: 'insider',
        ticker,
        filingType: '4',
        date: t.transactionDate || t.filingDate || new Date().toISOString(),
        transactionType: t.transactionType,
        shares: Math.abs(t.change || 0),
        name: t.name,
      }));
      allItems.push(...items);
    } catch (err) {
      console.warn(`[BatchInsider] Failed to fetch ${ticker}:`, err.message);
    }
    await delay(200);
  }

  // Deduplicate by (ticker + name + date + transactionType)
  const seen = new Set();
  const deduped = allItems.filter(item => {
    const key = `${item.ticker}:${item.name}:${item.date}:${item.transactionType}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).sort((a, b) => new Date(b.date) - new Date(a.date));

  batchInsiderCache = { data: deduped, timestamp: Date.now() };
  return deduped;
}

// ─── GET /api/economic-indicators ────────────────────────────────────────────

router.get('/economic-indicators', intelLimiter, async (req, res) => {
  try {
    const data = await fredService.getAllIndicators();
    return res.json({ success: true, data });
  } catch (err) {
    console.error('[Route] /economic-indicators error:', err.message);
    return res.status(500).json({ success: false, error: 'Failed to fetch economic indicators' });
  }
});

// ─── GET /api/insider-trades ──────────────────────────────────────────────────

router.get('/insider-trades', intelLimiter, async (req, res) => {
  const symbol = req.query.symbol ? req.query.symbol.toUpperCase().trim() : null;

  const cacheKey = `insider:${symbol || 'all'}`;

  try {
    // Fetch SEC EDGAR + Finnhub in parallel
    // For no-symbol: batch-fetch Finnhub for curated tickers (cached 30 min)
    // For symbol: fetch single-symbol Finnhub (cached 15 min by finnhub service)
    const [secData, finnhubBatch] = await Promise.allSettled([
      secEdgar.getRecentActivity({ symbol }),
      symbol
        ? finnhub.getInsiderTransactions(symbol).then(result =>
            (result?.data || []).map(t => ({
              title: `${t.transactionType}: ${symbol} — ${t.name}`,
              summary: `${t.transactionType} ${Math.abs(t.change || 0).toLocaleString()} shares on ${t.transactionDate || 'N/A'}`,
              url: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&company=${symbol}&type=4&dateb=&owner=include&count=10`,
              source: 'Finnhub',
              category: 'insider',
              ticker: symbol,
              filingType: '4',
              date: t.transactionDate || t.filingDate || new Date().toISOString(),
              transactionType: t.transactionType,
              shares: Math.abs(t.change || 0),
              name: t.name,
            }))
          )
        : fetchBatchInsiderTrades(),
    ]);

    const secItems = secData.status === 'fulfilled' ? secData.value : [];
    const finnhubItems = finnhubBatch.status === 'fulfilled' ? (finnhubBatch.value || []) : [];

    // Merge: Finnhub data takes priority. Deduplicate by (ticker+name+date+transactionType) for Finnhub,
    // then merge SEC items that don't duplicate existing Finnhub entries.
    const seen = new Set();
    // Add Finnhub items first (priority)
    const combined = [...finnhubItems].filter(item => {
      const key = `${item.ticker}:${item.name}:${item.date}:${item.transactionType}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    // Append SEC items that aren't duplicated
    for (const item of secItems) {
      const key = `${item.title}:${item.date}`;
      if (!seen.has(key)) {
        seen.add(key);
        combined.push(item);
      }
    }
    combined.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Save to last-good cache if we got results
    if (combined.length > 0) {
      setLastGood(cacheKey, combined);
    }

    // If empty (upstream flaky), try last-good cache
    const finalData = combined.length > 0 ? combined : (getLastGood(cacheKey) || []);

    return res.json({
      success: true,
      data: finalData,
      symbol: symbol || null,
      count: finalData.length,
      cached: combined.length === 0 && finalData.length > 0,
    });
  } catch (err) {
    console.error('[Route] /insider-trades error:', err.message);
    // Try last-good cache on error
    const cached = getLastGood(cacheKey);
    if (cached) {
      return res.json({ success: true, data: cached, symbol: symbol || null, count: cached.length, cached: true });
    }
    return res.status(500).json({ success: false, error: 'Failed to fetch insider trades' });
  }
});

// ─── GET /api/earnings-calendar ──────────────────────────────────────────────

router.get('/earnings-calendar', intelLimiter, async (req, res) => {
  const { from, to } = req.query;

  try {
    const data = await finnhub.getEarningsCalendar({ from, to });
    return res.json({ success: true, data });
  } catch (err) {
    console.error('[Route] /earnings-calendar error:', err.message);
    return res.status(500).json({ success: false, error: 'Failed to fetch earnings calendar' });
  }
});

// ─── GET /api/ipo-calendar ────────────────────────────────────────────────────

router.get('/ipo-calendar', intelLimiter, async (req, res) => {
  const { from, to } = req.query;

  try {
    const data = await finnhub.getIPOCalendar({ from, to });
    return res.json({ success: true, data });
  } catch (err) {
    console.error('[Route] /ipo-calendar error:', err.message);
    return res.status(500).json({ success: false, error: 'Failed to fetch IPO calendar' });
  }
});

module.exports = router;
