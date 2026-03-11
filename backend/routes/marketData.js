/**
 * Market Data Routes (Finnhub-backed)
 *
 * GET /api/market-data/quote/:symbol          - Real-time quote
 * GET /api/market-data/batch                  - Batch quotes (?symbols=SPY,AAPL,...)
 * GET /api/market-data/candles/:symbol        - OHLCV candlestick data
 * GET /api/market-data/status                 - Market open/close status
 * GET /api/market-data/news/:symbol           - Company news from Finnhub
 * GET /api/market-data/profile/:symbol        - Company profile + key metrics
 * GET /api/market-data/movers                 - Top movers (gainers/losers)
 *
 * ─── Shared quote cache ─────────────────────────────────────────────────────
 * Cache keys follow the pattern `finnhub:quote:SYM` (defined in finnhub.js).
 * The cache is NOT per-user — every user requesting the same symbol within the
 * 60-second TTL window hits the same cache entry.  This means:
 *
 *   User A requests PLTR → 1 Finnhub call → cached for 60 s
 *   User B requests PLTR 30 s later       → 0 Finnhub calls, served from cache
 *   48-symbol watchlist, 40 already cached → only 8 Finnhub calls
 *
 * The prefetcher (dataPrefetcher.js) keeps the 18-symbol default watchlist warm
 * so common symbols are almost always served from cache.
 */

'use strict';

const express = require('express');
const router  = express.Router();
const finnhub = require('../services/finnhub');
const cache   = require('../services/cache');

// ─── Constants ───────────────────────────────────────────────────────────────

const DEFAULT_STOCK_SYMBOLS  = ['AAPL', 'GOOGL', 'TSLA', 'MSFT', 'NVDA', 'AMZN'];
const DEFAULT_FOREX_SYMBOLS  = ['OANDA:EUR_USD', 'OANDA:GBP_USD', 'OANDA:USD_JPY'];
const DEFAULT_CRYPTO_SYMBOLS = ['BINANCE:BTCUSDT', 'BINANCE:ETHUSDT', 'BINANCE:SOLUSDT'];

/** Maximum symbols accepted per batch request. */
const MAX_BATCH_SYMBOLS = 100;

/** How many Finnhub calls to run in parallel for cache-miss symbols. */
const BATCH_CONCURRENCY = 5;

/** Cache key prefix — must match what finnhub.js uses so prefetcher and batch share the same entries. */
const QUOTE_CACHE_PREFIX = 'finnhub:quote:';

// ─── Cache-control header helpers ────────────────────────────────────────────

function marketDataHeaders(res) {
  res.set('Cache-Control', 'public, max-age=30');
}
function newsHeaders(res) {
  res.set('Cache-Control', 'public, max-age=120');
}
function staticDataHeaders(res) {
  res.set('Cache-Control', 'public, max-age=3600');
}

// ─── Smart shared-cache batch fetch ──────────────────────────────────────────

/**
 * Batch-fetches quotes for `symbols` with a two-phase strategy:
 *
 * Phase 1 — Parallel cache scan
 *   Check every symbol against the shared server-side cache simultaneously.
 *   This is a fast Map/Redis lookup; no Finnhub calls are made here.
 *
 * Phase 2 — Targeted Finnhub fetch (cache misses only)
 *   Only symbols that are absent from (or expired in) the cache are fetched
 *   from Finnhub.  Results are stored with a 60-second TTL and shared across
 *   all concurrent requests.
 *
 * Returns: { quotes, cacheHits, cacheMisses, finnhubCalls }
 */
async function batchQuotesSharedCache(symbols, concurrency = BATCH_CONCURRENCY) {
  const results   = {};
  const cacheKeys = symbols.map(s => `${QUOTE_CACHE_PREFIX}${s.toUpperCase()}`);

  // ── Phase 1: parallel cache scan ─────────────────────────────────────────
  const cacheChecks = await Promise.all(
    symbols.map(async (sym, i) => {
      const hit = await cache.get(cacheKeys[i]);
      return { sym: sym.toUpperCase(), hit };
    })
  );

  const hits   = cacheChecks.filter(c => c.hit !== null);
  const misses = cacheChecks.filter(c => c.hit === null).map(c => c.sym);

  // Populate cache hits immediately
  for (const { sym, hit } of hits) {
    results[sym] = hit;
  }

  // ── Phase 2: fetch only cache misses, up to `concurrency` in parallel ────
  if (misses.length > 0) {
    const chunks = [];
    for (let i = 0; i < misses.length; i += concurrency) {
      chunks.push(misses.slice(i, i + concurrency));
    }

    for (const chunk of chunks) {
      const settled = await Promise.allSettled(
        chunk.map(sym => finnhub.getQuote(sym))
      );
      settled.forEach((r, idx) => {
        const sym = chunk[idx];
        if (r.status === 'fulfilled' && r.value) {
          results[sym] = r.value;
          // Note: finnhub.getQuote() already calls cache.set() internally via
          // cache.cacheAPICall(), so we don't need to cache here again.
        } else {
          // Symbol unavailable — return a graceful stub so the UI shows "—"
          results[sym] = {
            symbol:    sym,
            current:   null,
            change:    null,
            changePct: null,
            source:    'unavailable',
            error:     r.reason?.message || 'no data',
          };
        }
      });
    }
  }

  return {
    quotes:      results,
    cacheHits:   hits.length,
    cacheMisses: misses.length,
    finnhubCalls: misses.length,   // upper bound — getQuote may have hit its own cache
  };
}

// ─── Routes ──────────────────────────────────────────────────────────────────

// GET /api/market-data/quote/:symbol
router.get('/quote/:symbol', async (req, res) => {
  try {
    const symbol = req.params.symbol.toUpperCase();
    const quote  = await finnhub.getQuote(symbol);

    marketDataHeaders(res);
    res.json({ success: true, data: quote, timestamp: new Date().toISOString() });
  } catch (err) {
    console.error('[MarketData] /quote error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to fetch quote' });
  }
});

// GET /api/market-data/batch?symbols=SPY,QQQ,AAPL,...
//
// Supports up to MAX_BATCH_SYMBOLS (100) symbols per request.
// Cache hits cost 0 Finnhub calls — the shared server-side cache serves them
// instantly.  The response includes debug counters (cacheHits/cacheMisses) so
// we can monitor efficiency in logs / developer tools.
router.get('/batch', async (req, res) => {
  try {
    const { symbols, type = 'stocks' } = req.query;

    let symbolList;
    if (symbols) {
      symbolList = symbols
        .split(',')
        .map(s => s.trim().toUpperCase())
        .filter(Boolean)
        .slice(0, MAX_BATCH_SYMBOLS);
    } else {
      symbolList = type === 'crypto' ? DEFAULT_CRYPTO_SYMBOLS
        : type === 'forex'  ? DEFAULT_FOREX_SYMBOLS
        : DEFAULT_STOCK_SYMBOLS;
    }

    if (symbolList.length === 0) {
      return res.status(400).json({ success: false, error: 'No symbols provided' });
    }

    const { quotes, cacheHits, cacheMisses, finnhubCalls } = await batchQuotesSharedCache(symbolList);

    // Log cache efficiency for monitoring (only when there were actual misses)
    if (cacheMisses > 0) {
      console.log(
        `[MarketData/batch] ${symbolList.length} symbols — ` +
        `${cacheHits} cached, ${cacheMisses} fetched from Finnhub`
      );
    }

    marketDataHeaders(res);
    res.json({
      success:     true,
      count:       Object.keys(quotes).length,
      data:        quotes,
      _cache:      { hits: cacheHits, misses: cacheMisses, finnhubCalls },
      timestamp:   new Date().toISOString(),
    });
  } catch (err) {
    console.error('[MarketData] /batch error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to fetch batch quotes' });
  }
});

// GET /api/market-data/candles/:symbol?resolution=D&from=...&to=...
router.get('/candles/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const { resolution = 'D', from, to } = req.query;

    const validResolutions = ['1', '5', '15', '30', '60', 'D', 'W', 'M'];
    if (!validResolutions.includes(resolution)) {
      return res.status(400).json({
        success: false,
        error: `Invalid resolution. Use one of: ${validResolutions.join(', ')}`
      });
    }

    const candles = await finnhub.getCandles(
      symbol, resolution,
      from ? parseInt(from, 10) : null,
      to   ? parseInt(to, 10)   : null
    );

    const maxAge = ['D', 'W', 'M'].includes(resolution) ? 3600 : 120;
    res.set('Cache-Control', `public, max-age=${maxAge}`);

    res.json({
      success: true, symbol: symbol.toUpperCase(), resolution,
      count: candles.length, data: candles,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('[MarketData] /candles error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to fetch candle data' });
  }
});

// GET /api/market-data/status?exchange=US
router.get('/status', async (req, res) => {
  try {
    const { exchange = 'US' } = req.query;
    const status = await finnhub.getMarketStatus(exchange);

    marketDataHeaders(res);
    res.json({ success: true, data: status, timestamp: new Date().toISOString() });
  } catch (err) {
    console.error('[MarketData] /status error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to fetch market status' });
  }
});

// GET /api/market-data/news/:symbol?days=7
router.get('/news/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const days = Math.min(parseInt(req.query.days, 10) || 7, 30);
    const news = await finnhub.getCompanyNews(symbol, { days });

    newsHeaders(res);
    res.json({
      success: true, symbol: symbol.toUpperCase(),
      count: news.length, data: news,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('[MarketData] /news error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to fetch company news' });
  }
});

// GET /api/market-data/profile/:symbol
router.get('/profile/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const profile = await finnhub.getCompanyProfile(symbol);

    if (!profile) {
      return res.json({
        success: false, error: 'No profile data available',
        symbol: symbol.toUpperCase()
      });
    }

    staticDataHeaders(res);
    res.json({ success: true, data: profile, timestamp: new Date().toISOString() });
  } catch (err) {
    console.error('[MarketData] /profile error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to fetch company profile' });
  }
});

// GET /api/market-data/movers?symbols=...
//
// Returns top 5 gainers and top 5 losers from the provided (or default) symbol list.
// Uses the same shared-cache batch path — no wasted Finnhub calls.
router.get('/movers', async (req, res) => {
  try {
    const { symbols } = req.query;
    const symbolList = symbols
      ? symbols.split(',').map(s => s.trim().toUpperCase()).filter(Boolean)
      : DEFAULT_STOCK_SYMBOLS;

    const { quotes } = await batchQuotesSharedCache(symbolList);
    const quoteList  = Object.values(quotes).filter(q => q.changePct != null);

    quoteList.sort((a, b) => b.changePct - a.changePct);
    const gainers = quoteList.filter(q => q.changePct > 0).slice(0, 5);
    const losers  = quoteList.filter(q => q.changePct < 0).reverse().slice(0, 5);

    marketDataHeaders(res);
    res.json({ success: true, gainers, losers, timestamp: new Date().toISOString() });
  } catch (err) {
    console.error('[MarketData] /movers error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to fetch movers' });
  }
});

// ─── Cache stats endpoint (internal / debug) ─────────────────────────────────

// GET /api/market-data/cache-stats?symbols=SPY,AAPL,...
// Returns which symbols are cached and their approximate TTL (memory cache only).
// Useful for debugging prefetch coverage without hitting Finnhub.
router.get('/cache-stats', async (req, res) => {
  try {
    const { symbols } = req.query;
    if (!symbols) {
      return res.json({ success: false, error: 'Provide ?symbols= list' });
    }

    const symList = symbols.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
    const stats   = {};

    await Promise.all(
      symList.map(async sym => {
        const hit = await cache.get(`${QUOTE_CACHE_PREFIX}${sym}`);
        stats[sym] = hit !== null ? 'cached' : 'miss';
      })
    );

    res.json({ success: true, stats, total: symList.length, timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
