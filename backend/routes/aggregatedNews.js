/**
 * Aggregated News Routes (RSS + Marketaux/Finnhub supplement)
 * 
 * GET /api/feed/news                     - Aggregated feed from all RSS sources
 * GET /api/feed/news/symbol/:symbol      - Symbol-specific news
 * GET /api/feed/news/sentiment/:symbol   - Sentiment analysis for symbol
 * GET /api/feed/news/categories          - Available news categories
 */

const express = require('express');
const router = express.Router();
const rssFeedAggregator = require('../services/rssFeedAggregator');

function isForceRefresh(query) {
  const v = query?.refresh ?? query?.force;
  return v === '1' || v === 'true';
}

// GET /api/feed/news?limit=30&category=crypto&minImpact=4&refresh=1
router.get('/', async (req, res) => {
  try {
    const { limit = 30, category, minImpact = 0 } = req.query;
    const force = isForceRefresh(req.query);
    if (force) res.set('Cache-Control', 'private, no-cache');

    const articles = await rssFeedAggregator.getAggregatedNews({
      limit: Math.min(parseInt(limit) || 30, 100),
      category: category || null,
      minImpact: parseFloat(minImpact) || 0,
      force,
    });

    res.json({
      success: true,
      count: articles.length,
      data: articles,
      sources: [...new Set(articles.map(a => a.source))],
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Feed] /news error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch news feed' });
  }
});

// GET /api/feed/news/categories
router.get('/categories', (req, res) => {
  res.json({
    success: true,
    categories: ['business', 'markets', 'crypto', 'forex', 'economy', 'stocks', 'general']
  });
});

// GET /api/feed/news/symbol/:symbol?limit=15
router.get('/symbol/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const { limit = 15 } = req.query;
    const force = isForceRefresh(req.query);
    if (force) res.set('Cache-Control', 'private, no-cache');

    const articles = await rssFeedAggregator.getNewsBySymbol(symbol, {
      limit: Math.min(parseInt(limit) || 15, 50),
      force,
    });

    res.json({
      success: true,
      symbol: symbol.toUpperCase(),
      count: articles.length,
      data: articles,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Feed] /news/symbol error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch symbol news' });
  }
});

// GET /api/feed/news/sentiment/:symbol
router.get('/sentiment/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const sentiment = await rssFeedAggregator.getSymbolSentiment(symbol);

    res.json({
      success: true,
      data: sentiment,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Feed] /news/sentiment error:', error);
    res.status(500).json({ success: false, error: 'Failed to analyze sentiment' });
  }
});

module.exports = router;
