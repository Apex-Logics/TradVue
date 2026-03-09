/**
 * Stock Info Route
 * GET /api/stock-info/:symbol
 * 
 * Returns comprehensive stock data (price, dividends, company info, metrics).
 * Cached 15 minutes. Combines Finnhub + Yahoo Finance.
 */

const express = require('express');
const router = express.Router();
const { getStockInfo } = require('../services/stockInfo');

// Validate symbol: letters, dots, hyphens, 1-10 chars
const SYMBOL_RE = /^[A-Za-z.\-]{1,10}$/;

router.get('/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;

    if (!symbol || !SYMBOL_RE.test(symbol)) {
      return res.status(400).json({ error: 'Invalid symbol', symbol });
    }

    const data = await getStockInfo(symbol);

    if (!data) {
      return res.status(404).json({ error: 'Stock not found', symbol });
    }

    res.json(data);
  } catch (error) {
    console.error(`[StockInfo Route] Error for ${req.params.symbol}:`, error.message);
    res.status(500).json({
      error: 'Failed to fetch stock info',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal error',
    });
  }
});

// ─── Benchmark price history ──────────────────────────────────────────────────
// GET /api/stock-info/benchmark/:symbol?range=1y

router.get('/benchmark/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const range = req.query.range || '1y';

    if (!symbol || !SYMBOL_RE.test(symbol)) {
      return res.status(400).json({ error: 'Invalid symbol' });
    }

    const VALID_RANGES = ['1mo', '3mo', '6mo', 'ytd', '1y', '5y'];
    if (!VALID_RANGES.includes(range)) {
      return res.status(400).json({ error: 'Invalid range' });
    }

    const url = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=1d`;
    const resp = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; TradVue/1.0)' },
      signal: AbortSignal.timeout(8000),
    });

    if (!resp.ok) {
      return res.status(502).json({ error: 'Failed to fetch from Yahoo Finance' });
    }

    const data = await resp.json();
    const result = data?.chart?.result?.[0];

    if (!result) {
      return res.status(404).json({ error: 'No data for symbol' });
    }

    const timestamps = result.timestamp || [];
    const closes = result.indicators?.quote?.[0]?.close || [];

    const prices = timestamps
      .map((ts, i) => ({
        date: new Date(ts * 1000).toISOString().slice(0, 10),
        close: closes[i],
      }))
      .filter(p => p.close != null);

    res.json({ symbol: symbol.toUpperCase(), range, prices });
  } catch (error) {
    console.error(`[Benchmark] Error:`, error.message);
    res.status(500).json({ error: 'Failed to fetch benchmark data' });
  }
});

module.exports = router;
