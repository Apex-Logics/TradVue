/**
 * Crypto Routes — powered by CoinGecko (free, no API key)
 *
 * GET /api/crypto/prices           — top coins by market cap
 * GET /api/crypto/prices/:symbol   — single coin price
 * GET /api/crypto/trending         — trending coins (24h search)
 * GET /api/crypto/snapshot         — combined top coins + trending
 * GET /api/crypto/history/:symbol  — price history (days=7)
 * GET /api/crypto/batch            — multi-symbol quick prices
 *
 * Attribution: Powered by CoinGecko
 */

const express = require('express');
const router = express.Router();
const coinGecko = require('../services/coinGecko');

// GET /api/crypto/prices?limit=10&currency=usd
router.get('/prices', async (req, res) => {
  try {
    const { limit = 10, currency = 'usd' } = req.query;

    const coins = await coinGecko.getTopCoins({
      limit: Math.min(parseInt(limit) || 10, 50),
      currency,
    });

    res.json({
      success: true,
      count: coins.length,
      currency: currency.toLowerCase(),
      data: coins,
      attribution: 'Powered by CoinGecko',
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[Crypto] /prices error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch crypto prices' });
  }
});

// GET /api/crypto/prices/:symbol?currency=usd
router.get('/prices/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const { currency = 'usd' } = req.query;

    const prices = await coinGecko.getPrices([symbol.toUpperCase()], currency);
    const data = prices[symbol.toUpperCase()];

    if (!data) {
      return res.status(404).json({
        success: false,
        error: `Symbol ${symbol.toUpperCase()} not found. Supported: BTC, ETH, BNB, SOL, XRP, ADA, DOGE, AVAX, LINK, DOT`,
      });
    }

    res.json({
      success: true,
      symbol: symbol.toUpperCase(),
      currency,
      data,
      attribution: 'Powered by CoinGecko',
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[Crypto] /prices/:symbol error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch coin price' });
  }
});

// GET /api/crypto/trending
router.get('/trending', async (req, res) => {
  try {
    const trending = await coinGecko.getTrending();

    res.json({
      success: true,
      count: trending.length,
      data: trending,
      attribution: 'Powered by CoinGecko',
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[Crypto] /trending error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch trending coins' });
  }
});

// GET /api/crypto/snapshot?limit=10
router.get('/snapshot', async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    const snapshot = await coinGecko.getCryptoSnapshot({
      limit: Math.min(parseInt(limit) || 10, 50),
    });

    res.json({
      success: true,
      ...snapshot,
    });
  } catch (err) {
    console.error('[Crypto] /snapshot error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch crypto snapshot' });
  }
});

// GET /api/crypto/history/:symbol?days=7&currency=usd
router.get('/history/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const { days = 7, currency = 'usd' } = req.query;

    const history = await coinGecko.getPriceHistory(symbol.toUpperCase(), {
      days: Math.min(parseInt(days) || 7, 365),
      currency,
    });

    if (!history) {
      return res.status(404).json({
        success: false,
        error: `Symbol ${symbol.toUpperCase()} not supported for history`,
      });
    }

    res.json({
      success: true,
      data: history,
      attribution: 'Powered by CoinGecko',
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[Crypto] /history error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch price history' });
  }
});

// GET /api/crypto/batch?symbols=BTC,ETH,SOL&currency=usd
router.get('/batch', async (req, res) => {
  try {
    const { symbols = 'BTC,ETH', currency = 'usd' } = req.query;

    const symbolList = symbols
      .split(',')
      .map(s => s.trim().toUpperCase())
      .filter(Boolean)
      .slice(0, 20); // Max 20 at once

    const prices = await coinGecko.getPrices(symbolList, currency);

    res.json({
      success: true,
      symbols: symbolList,
      currency,
      data: prices,
      attribution: 'Powered by CoinGecko',
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[Crypto] /batch error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch batch prices' });
  }
});

module.exports = router;
