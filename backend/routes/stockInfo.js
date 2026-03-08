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

module.exports = router;
