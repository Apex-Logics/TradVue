/**
 * Sentiment Route — /api/sentiment/:ticker
 *
 * Returns aggregated Marketaux sentiment for a given ticker.
 * Cached at the service layer for 1 hour; route-level Cache-Control
 * is set to 15 minutes so the browser/CDN also backs off.
 *
 * Marketaux free tier: ~100 req/day — do NOT call this in a tight loop.
 */

const express = require('express');
const router = express.Router();
const marketauxService = require('../services/marketaux');

// GET /api/sentiment/:ticker
router.get('/:ticker', async (req, res) => {
  const { ticker } = req.params;

  if (!ticker || !/^[A-Za-z0-9.\-]{1,10}$/.test(ticker)) {
    return res.status(400).json({ success: false, error: 'Invalid ticker symbol' });
  }

  try {
    const data = await marketauxService.getSentiment(ticker.toUpperCase());
    return res.json({ success: true, data });
  } catch (err) {
    console.error(`[Sentiment Route] Error for ${ticker}:`, err.message);
    return res.status(500).json({ success: false, error: 'Failed to fetch sentiment data' });
  }
});

module.exports = router;
