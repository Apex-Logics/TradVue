/**
 * Stocks Route — Analyst Ratings & Stock Scoring
 *
 * GET /api/stocks/:ticker/ratings   — Analyst consensus + price targets
 * GET /api/stocks/:ticker/score     — Composite stock score (1-100)
 * GET /api/stocks/:ticker/analysis  — Composite analysis (ratings + score combined)
 * GET /api/stocks/history           — Historical daily closing prices for correlation
 *   Query params:
 *     symbols  (required) comma-separated list, e.g. AAPL,MSFT,NVDA
 *     range    (optional) 1mo | 3mo | 6mo | 1y  (default: 3mo)
 */

const express = require('express');
const router = express.Router();
const { getAnalystRatings } = require('../services/analystRatings');
const { getStockScore } = require('../services/stockScore');
const alpaca = require('../services/alpaca');
const cache = require('../services/cache');

// ── History (for Correlation Matrix) ─────────────────────────────────────────

const HISTORY_CACHE_TTL = 3600; // 1 hour

/** Convert a range string to a lookback in days. */
function rangeToDays(range) {
  const map = { '1mo': 30, '3mo': 90, '6mo': 180, '1y': 365 };
  return map[range] || 90;
}

/**
 * GET /api/stocks/history?symbols=AAPL,MSFT&range=3mo
 *
 * Returns daily closing prices for each requested symbol.
 * Response:
 *   { success: true, data: { AAPL: [150.1, 151.3, ...], MSFT: [...] }, missing: [] }
 */
router.get('/history', async (req, res) => {
  try {
    const symbolsParam = (req.query.symbols || '').trim();
    const range        = (req.query.range   || '3mo').trim();

    if (!symbolsParam) {
      return res.status(400).json({ success: false, error: 'symbols query param is required' });
    }

    const TICKER_RE = /^[A-Za-z.\-]{1,10}$/;
    const symbols = [...new Set(
      symbolsParam.split(',').map(s => s.trim().toUpperCase()).filter(s => TICKER_RE.test(s))
    )];

    if (symbols.length === 0) {
      return res.status(400).json({ success: false, error: 'No valid symbols provided' });
    }
    if (symbols.length > 10) {
      return res.status(400).json({ success: false, error: 'Maximum 10 symbols per request' });
    }

    const days     = rangeToDays(range);
    const nowTs    = Math.floor(Date.now() / 1000);
    const fromTs   = nowTs - days * 24 * 3600;
    const cacheKey = `stocks:history:${symbols.sort().join(',')}:${range}`;

    // ── Cache hit? ─────────────────────────────────────────────────────────
    const cached = await cache.get(cacheKey);
    if (cached) {
      return res.json({ success: true, cached: true, ...cached });
    }

    // ── Fetch from Alpaca in parallel ──────────────────────────────────────
    const results = await Promise.allSettled(
      symbols.map(sym => alpaca.getCandles(sym, 'D', fromTs, nowTs))
    );

    const data    = {};
    const missing = [];

    results.forEach((result, i) => {
      const sym = symbols[i];
      if (result.status === 'fulfilled' && result.value && result.value.length >= 5) {
        data[sym] = result.value.map(bar => bar.close);
      } else {
        missing.push(sym);
      }
    });

    const payload = { data, missing };
    if (Object.keys(data).length > 0) {
      await cache.set(cacheKey, payload, HISTORY_CACHE_TTL);
    }

    res.json({ success: true, cached: false, ...payload });
  } catch (err) {
    console.error('[Stocks/History] Error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to fetch historical prices' });
  }
});

// Validate ticker: letters, dots, hyphens, 1-10 chars
const TICKER_RE = /^[A-Za-z.\-]{1,10}$/;

// ── Analyst Ratings ───────────────────────────────────────────────────────────

router.get('/:ticker/ratings', async (req, res) => {
  try {
    const { ticker } = req.params;

    if (!ticker || !TICKER_RE.test(ticker)) {
      return res.status(400).json({ error: 'Invalid ticker', ticker });
    }

    const data = await getAnalystRatings(ticker);
    res.json({ success: true, data });
  } catch (error) {
    console.error(`[Stocks/Ratings] Error for ${req.params.ticker}:`, error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch analyst ratings',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal error',
    });
  }
});

// ── Stock Score ───────────────────────────────────────────────────────────────

router.get('/:ticker/score', async (req, res) => {
  try {
    const { ticker } = req.params;

    if (!ticker || !TICKER_RE.test(ticker)) {
      return res.status(400).json({ error: 'Invalid ticker', ticker });
    }

    const data = await getStockScore(ticker);
    res.json({ success: true, data });
  } catch (error) {
    console.error(`[Stocks/Score] Error for ${req.params.ticker}:`, error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to calculate stock score',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal error',
    });
  }
});

// ── Stock Analysis (composite) ────────────────────────────────────────────────

router.get('/:ticker/analysis', async (req, res) => {
  try {
    const { ticker } = req.params;

    if (!ticker || !TICKER_RE.test(ticker)) {
      return res.status(400).json({ error: 'Invalid ticker', ticker });
    }

    // Fetch ratings and score in parallel — partial data is fine
    const [ratingsResult, scoreResult] = await Promise.allSettled([
      getAnalystRatings(ticker),
      getStockScore(ticker),
    ]);

    const ratings = ratingsResult.status === 'fulfilled' ? ratingsResult.value : null;
    const score   = scoreResult.status === 'fulfilled'   ? scoreResult.value   : null;

    if (!ratings && !score) {
      return res.status(503).json({
        success: false,
        error: 'Could not fetch analysis data — both data sources unavailable',
        ticker: ticker.toUpperCase(),
      });
    }

    // Build a quick summary from whatever we have
    const summary = {
      consensus:     ratings?.consensus?.label    ?? null,
      priceTarget:   ratings?.priceTargets?.mean  ?? null,
      upside:        ratings?.priceTargets?.upsidePct ?? null,
      analystCount:  ratings?.analystCount        ?? null,
      compositeScore: score?.score                ?? null,
      scoreLabel:    score?.label                 ?? null,
    };

    res.json({
      success: true,
      data: {
        ticker: ticker.toUpperCase(),
        summary,
        ratings,
        score,
        fetchedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error(`[Stocks/Analysis] Error for ${req.params.ticker}:`, error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch stock analysis',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal error',
    });
  }
});

module.exports = router;
