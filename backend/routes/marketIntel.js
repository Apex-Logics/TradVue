/**
 * Market Intelligence Routes
 *
 * Public endpoints (no JWT required) for:
 *   GET /api/economic-indicators  — FRED macroeconomic data
 *   GET /api/insider-trades       — SEC EDGAR Form 4 XML (primary) + Finnhub (fallback)
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
const edgarForm4 = require('../services/edgarForm4');
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

const lastGoodCache = new Map();
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
let batchFinnhubCache = null; // { data, timestamp }

/**
 * Fetch Finnhub insider trades for all DEFAULT_INSIDER_TICKERS.
 * Used as fallback when EDGAR is unavailable or too slow.
 */
async function fetchFinnhubBatch() {
  if (batchFinnhubCache && (Date.now() - batchFinnhubCache.timestamp < BATCH_CACHE_TTL_MS)) {
    return batchFinnhubCache.data;
  }

  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
  const allItems = [];

  for (const ticker of DEFAULT_INSIDER_TICKERS) {
    try {
      const result = await finnhub.getInsiderTransactions(ticker);
      const items = (result?.data || []).map(t => ({
        ticker,
        companyName: null,
        name: t.name || null,
        officerTitle: null,
        isDirector: false,
        isOfficer: false,
        isTenPercentOwner: false,
        transactionType: t.transactionType || null,
        shares: Math.abs(t.change || 0) || null,
        pricePerShare: null,
        transactionValue: null,
        holdingsAfter: null,
        date: t.transactionDate || t.filingDate || new Date().toISOString().split('T')[0],
        source: 'Finnhub',
        filingUrl: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&company=${ticker}&type=4&dateb=&owner=include&count=10`,
        category: 'insider',
        filingType: '4',
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

  batchFinnhubCache = { data: deduped, timestamp: Date.now() };
  return deduped;
}

/**
 * Deduplicate merged EDGAR + Finnhub results.
 * Dedup key: ticker + name + date + transactionType
 */
function deduplicateTrades(items) {
  const seen = new Set();
  return items.filter(item => {
    const key = `${(item.ticker || '').toUpperCase()}:${(item.name || '').toLowerCase()}:${item.date}:${(item.transactionType || '').toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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
    let edgarData = [];
    let finnhubData = [];

    if (symbol) {
      // Symbol-specific: try EDGAR Form 4 parser first, then Finnhub
      const edgarPromise = Promise.race([
        edgarForm4.getInsiderTradesBySymbol(symbol),
        new Promise((_, reject) => setTimeout(() => reject(new Error('EDGAR timeout')), 10000)),
      ]);

      const [edgarResult, finnhubResult] = await Promise.allSettled([
        edgarPromise,
        finnhub.getInsiderTransactions(symbol).then(result =>
          (result?.data || []).map(t => ({
            ticker: symbol,
            companyName: null,
            name: t.name || null,
            officerTitle: null,
            isDirector: false,
            isOfficer: false,
            isTenPercentOwner: false,
            transactionType: t.transactionType || null,
            shares: Math.abs(t.change || 0) || null,
            pricePerShare: null,
            transactionValue: null,
            holdingsAfter: null,
            date: t.transactionDate || t.filingDate || new Date().toISOString().split('T')[0],
            source: 'Finnhub',
            filingUrl: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&company=${symbol}&type=4&dateb=&owner=include&count=10`,
            category: 'insider',
            filingType: '4',
          }))
        ),
      ]);

      edgarData = edgarResult.status === 'fulfilled' ? (edgarResult.value || []) : [];
      finnhubData = finnhubResult.status === 'fulfilled' ? (finnhubResult.value || []) : [];

      if (edgarResult.status === 'rejected') {
        console.warn('[Route] /insider-trades EDGAR failed for symbol:', edgarResult.reason?.message);
      }
    } else {
      // Batch: EDGAR is primary (30 most recent), Finnhub is fallback
      const edgarBatchPromise = Promise.race([
        edgarForm4.getBatchInsiderTrades({ count: 30, maxXmlFetch: 20 }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('EDGAR batch timeout')), 35000)),
      ]);

      const [edgarResult, finnhubResult] = await Promise.allSettled([
        edgarBatchPromise,
        fetchFinnhubBatch(),
      ]);

      edgarData = edgarResult.status === 'fulfilled' ? (edgarResult.value || []) : [];
      finnhubData = finnhubResult.status === 'fulfilled' ? (finnhubResult.value || []) : [];

      if (edgarResult.status === 'rejected') {
        console.warn('[Route] /insider-trades EDGAR batch failed:', edgarResult.reason?.message);
      }
    }

    // Merge: EDGAR first (richer data), then Finnhub items that don't duplicate
    const merged = deduplicateTrades([...edgarData, ...finnhubData]);

    // Sort: records with richer data (ticker + shares + price) first, then by date desc
    merged.sort((a, b) => {
      const aScore = (a.ticker ? 1 : 0) + (a.shares ? 1 : 0) + (a.pricePerShare ? 2 : 0) + (a.transactionType ? 1 : 0);
      const bScore = (b.ticker ? 1 : 0) + (b.shares ? 1 : 0) + (b.pricePerShare ? 2 : 0) + (b.transactionType ? 1 : 0);
      if (bScore !== aScore) return bScore - aScore;
      return new Date(b.date) - new Date(a.date);
    });

    if (merged.length > 0) setLastGood(cacheKey, merged);

    const finalData = merged.length > 0 ? merged : (getLastGood(cacheKey) || []);

    return res.json({
      success: true,
      data: finalData,
      symbol: symbol || null,
      count: finalData.length,
      cached: merged.length === 0 && finalData.length > 0,
      sources: {
        edgar: edgarData.length,
        finnhub: finnhubData.length,
      },
    });
  } catch (err) {
    console.error('[Route] /insider-trades error:', err.message);
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
