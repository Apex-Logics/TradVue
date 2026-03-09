/**
 * Stocks Route — Analyst Ratings & Stock Scoring
 * 
 * GET /api/stocks/:ticker/ratings  — Analyst consensus + price targets
 * GET /api/stocks/:ticker/score    — Composite stock score (1-100)
 */

const express = require('express');
const router = express.Router();
const { getAnalystRatings } = require('../services/analystRatings');
const { getStockScore } = require('../services/stockScore');

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

module.exports = router;
