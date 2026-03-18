/**
 * Market Intelligence Routes
 *
 * Public endpoints (no JWT required) for:
 *   GET /api/economic-indicators  — FRED macroeconomic data
 *   GET /api/insider-trades       — Persistent DB (90-day rolling) + live fallback
 *   GET /api/earnings-calendar    — Upcoming earnings (Finnhub)
 *   GET /api/ipo-calendar         — Upcoming IPOs (Finnhub)
 *
 * Insider trades query params:
 *   page     (default: 1)
 *   limit    (default: 50, max: 200)
 *   from     (YYYY-MM-DD, max 90 days ago)
 *   to       (YYYY-MM-DD)
 *   symbol   (ticker filter)
 *   type     (buy | sell | award | gift)
 *   source   (edgar | finnhub)
 *
 * Rate limit: 100 req/min per IP
 */

'use strict';

const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();

const fredService = require('../services/fred');
const edgarForm4 = require('../services/edgarForm4');
const finnhub = require('../services/finnhub');
const insiderTradeStore = require('../services/insiderTradeStore');

// ─── Rate limit: 100 req/min per IP ──────────────────────────────────────────

const intelLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: { error: 'Too many requests. Please try again in a minute.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ─── Startup: ensure table exists ────────────────────────────────────────────

insiderTradeStore.ensureTable().catch(err => {
  console.error('[marketIntel] Failed to ensure insider_trades table:', err.message);
});

// ─── Background ingestion state ───────────────────────────────────────────────

const BATCH_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
let lastIngestionTime = 0;
let ingestionInFlight = false;

const DEFAULT_INSIDER_TICKERS = ['AAPL', 'MSFT', 'NVDA', 'TSLA', 'AMZN', 'META', 'GOOGL', 'JPM', 'V', 'SPY'];

/**
 * Normalize a raw Finnhub transaction record into a standard trade object.
 */
function _normalizeFinnhubTrade(t, ticker) {
  return {
    ticker,
    companyName: null,
    name: t.name || null,
    officerTitle: null,
    transactionType: t.transactionType || null,
    shares: Math.abs(t.change || 0) || null,
    pricePerShare: null,
    transactionValue: null,
    holdingsAfter: null,
    date: t.transactionDate || t.filingDate || new Date().toISOString().split('T')[0],
    source: 'Finnhub',
    filingUrl: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&company=${ticker}&type=4&dateb=&owner=include&count=10`,
  };
}

/**
 * Fetch Finnhub batch for all DEFAULT_INSIDER_TICKERS.
 */
async function _fetchFinnhubBatch() {
  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
  const allItems = [];

  for (const ticker of DEFAULT_INSIDER_TICKERS) {
    try {
      const result = await finnhub.getInsiderTransactions(ticker);
      const items = (result?.data || []).map(t => _normalizeFinnhubTrade(t, ticker));
      allItems.push(...items);
    } catch (err) {
      console.warn(`[InsiderBatch] Finnhub failed for ${ticker}:`, err.message);
    }
    await delay(200);
  }

  // Deduplicate by ticker+name+date+type
  const seen = new Set();
  return allItems.filter(item => {
    const key = `${item.ticker}:${item.name}:${item.date}:${item.transactionType}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Trigger a background fetch + ingest cycle.
 * Does not block the request. Guarded by a 30-min cooldown.
 */
function _triggerBackgroundIngest(symbol) {
  const now = Date.now();
  if (ingestionInFlight || (now - lastIngestionTime < BATCH_CACHE_TTL_MS)) return;
  ingestionInFlight = true;

  (async () => {
    try {
      let edgarTrades = [];
      let finnhubTrades = [];

      if (symbol) {
        const [edgarResult, finnhubResult] = await Promise.allSettled([
          edgarForm4.getInsiderTradesBySymbol(symbol),
          finnhub.getInsiderTransactions(symbol).then(r =>
            (r?.data || []).map(t => _normalizeFinnhubTrade(t, symbol))
          ),
        ]);
        edgarTrades = edgarResult.status === 'fulfilled' ? (edgarResult.value || []) : [];
        finnhubTrades = finnhubResult.status === 'fulfilled' ? (finnhubResult.value || []) : [];
      } else {
        const [edgarResult, finnhubResult] = await Promise.allSettled([
          edgarForm4.getBatchInsiderTrades({ count: 30, maxXmlFetch: 20 }),
          _fetchFinnhubBatch(),
        ]);
        edgarTrades = edgarResult.status === 'fulfilled' ? (edgarResult.value || []) : [];
        finnhubTrades = finnhubResult.status === 'fulfilled' ? (finnhubResult.value || []) : [];
      }

      await insiderTradeStore.runIngestionCycle(edgarTrades, finnhubTrades);
      lastIngestionTime = Date.now();
    } catch (err) {
      console.error('[InsiderBatch] Background ingest failed:', err.message);
    } finally {
      ingestionInFlight = false;
    }
  })();
}

// ─── Last-good-response cache (1 hour fallback for live fetch) ────────────────

const lastGoodCache = new Map();
const LAST_GOOD_TTL_MS = 60 * 60 * 1000;

function getLastGood(key) {
  const entry = lastGoodCache.get(key);
  if (!entry || Date.now() - entry.timestamp > LAST_GOOD_TTL_MS) {
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
  const page   = parseInt(req.query.page, 10) || 1;
  const limit  = Math.min(parseInt(req.query.limit, 10) || 50, 200);
  const from   = req.query.from || null;
  const to     = req.query.to || null;
  const type   = req.query.type || null;
  const source = req.query.source || null;

  try {
    // Check if the database has records
    const recordCount = await insiderTradeStore.getRecordCount();

    if (recordCount > 0) {
      // Serve from database (persistent, paginated)
      const { data, total, sources } = await insiderTradeStore.queryTrades({
        page, limit, from, to, symbol, type, source,
      });

      // Normalize DB rows to match the shape frontend expects
      const normalized = data.map(row => ({
        ticker: row.ticker,
        companyName: row.company_name,
        name: row.insider_name,
        officerTitle: row.officer_title,
        transactionType: row.transaction_type,
        shares: row.shares != null ? parseFloat(row.shares) : null,
        pricePerShare: row.price_per_share != null ? parseFloat(row.price_per_share) : null,
        transactionValue: row.transaction_value != null ? parseFloat(row.transaction_value) : null,
        holdingsAfter: row.holdings_after != null ? parseFloat(row.holdings_after) : null,
        date: row.filing_date ? row.filing_date.toISOString().split('T')[0] : null,
        filingUrl: row.filing_url,
        accessionNumber: row.accession_number,
        cik: row.cik,
        source: row.source,
        sourceApi: row.source_api,
        category: 'insider',
        filingType: '4',
      }));

      // Trigger a background refresh if data is stale (non-blocking)
      _triggerBackgroundIngest(symbol);

      return res.json({
        success: true,
        data: normalized,
        total,
        page,
        limit,
        hasMore: page * limit < total,
        sources,
      });
    }

    // ── First run: database is empty — fetch live and ingest ────────────────
    console.log('[Route] /insider-trades — first run, fetching live data');

    const cacheKey = `insider:${symbol || 'all'}`;
    let edgarData = [];
    let finnhubData = [];

    if (symbol) {
      const edgarPromise = Promise.race([
        edgarForm4.getInsiderTradesBySymbol(symbol),
        new Promise((_, reject) => setTimeout(() => reject(new Error('EDGAR timeout')), 10000)),
      ]);

      const [edgarResult, finnhubResult] = await Promise.allSettled([
        edgarPromise,
        finnhub.getInsiderTransactions(symbol).then(r =>
          (r?.data || []).map(t => _normalizeFinnhubTrade(t, symbol))
        ),
      ]);

      edgarData = edgarResult.status === 'fulfilled' ? (edgarResult.value || []) : [];
      finnhubData = finnhubResult.status === 'fulfilled' ? (finnhubResult.value || []) : [];
    } else {
      const edgarBatchPromise = Promise.race([
        edgarForm4.getBatchInsiderTrades({ count: 30, maxXmlFetch: 20 }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('EDGAR batch timeout')), 35000)),
      ]);

      const [edgarResult, finnhubResult] = await Promise.allSettled([
        edgarBatchPromise,
        _fetchFinnhubBatch(),
      ]);

      edgarData = edgarResult.status === 'fulfilled' ? (edgarResult.value || []) : [];
      finnhubData = finnhubResult.status === 'fulfilled' ? (finnhubResult.value || []) : [];
    }

    // Persist to database (fire-and-forget so we don't hold up the response)
    insiderTradeStore.runIngestionCycle(edgarData, finnhubData)
      .then(() => { lastIngestionTime = Date.now(); })
      .catch(err => console.warn('[Route] First-run ingest error:', err.message));

    const merged = deduplicateTrades([...edgarData, ...finnhubData]);
    merged.sort((a, b) => {
      const aScore = (a.ticker ? 1 : 0) + (a.shares ? 1 : 0) + (a.pricePerShare ? 2 : 0) + (a.transactionType ? 1 : 0);
      const bScore = (b.ticker ? 1 : 0) + (b.shares ? 1 : 0) + (b.pricePerShare ? 2 : 0) + (b.transactionType ? 1 : 0);
      if (bScore !== aScore) return bScore - aScore;
      return new Date(b.date) - new Date(a.date);
    });

    if (merged.length > 0) setLastGood(cacheKey, merged);
    const finalData = merged.length > 0 ? merged : (getLastGood(cacheKey) || []);

    // Apply client-side pagination on the live data slice
    const pageSlice = finalData.slice((page - 1) * limit, page * limit);

    return res.json({
      success: true,
      data: pageSlice,
      total: finalData.length,
      page,
      limit,
      hasMore: page * limit < finalData.length,
      sources: {
        edgar: edgarData.length,
        finnhub: finnhubData.length,
      },
    });
  } catch (err) {
    console.error('[Route] /insider-trades error:', err.message);
    const cached = getLastGood(`insider:${symbol || 'all'}`);
    if (cached) {
      const pageSlice = cached.slice((page - 1) * limit, page * limit);
      return res.json({
        success: true,
        data: pageSlice,
        total: cached.length,
        page,
        limit,
        hasMore: page * limit < cached.length,
        sources: { edgar: 0, finnhub: 0 },
        cached: true,
      });
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
