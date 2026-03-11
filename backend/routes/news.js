const express = require('express');
const axios = require('axios');
const router = express.Router();
const finnhubService = require('../services/finnhub');

// Mock news data (replace with real API integration later)
const mockNews = [
  {
    id: 1,
    title: "Federal Reserve Signals Potential Interest Rate Changes",
    summary: "The Federal Reserve indicates possible adjustments to interest rates amid changing economic conditions, impacting forex and equity markets.",
    content: "Federal Reserve officials have suggested that monetary policy adjustments may be necessary to address current economic conditions...",
    source: "Reuters",
    url: "https://reuters.com/sample-1",
    impact_score: 8.5,
    sentiment_score: -0.2,
    published_at: new Date(Date.now() - 2 * 3600000).toISOString(), // 2 hours ago
    tags: ['federal-reserve', 'interest-rates', 'monetary-policy']
  },
  {
    id: 2,
    title: "Bitcoin Reaches New Monthly High Amid Institutional Interest",
    summary: "Bitcoin surges to monthly highs as institutional investors increase cryptocurrency allocations.",
    content: "Bitcoin has reached its highest level this month following increased institutional adoption...",
    source: "CoinDesk",
    url: "https://coindesk.com/sample-2",
    impact_score: 7.2,
    sentiment_score: 0.6,
    published_at: new Date(Date.now() - 4 * 3600000).toISOString(), // 4 hours ago
    tags: ['bitcoin', 'cryptocurrency', 'institutional-investment']
  },
  {
    id: 3,
    title: "Oil Prices Decline on Supply Concerns",
    summary: "Crude oil prices fall as global supply concerns outweigh demand factors.",
    content: "Oil prices have declined significantly due to concerns over global supply chains and production levels...",
    source: "Bloomberg",
    url: "https://bloomberg.com/sample-3",
    impact_score: 6.8,
    sentiment_score: -0.4,
    published_at: new Date(Date.now() - 6 * 3600000).toISOString(), // 6 hours ago
    tags: ['oil', 'commodities', 'supply-chain']
  },
  {
    id: 4,
    title: "Tech Stocks Rally on AI Investment News",
    summary: "Technology stocks surge following announcements of increased AI infrastructure investments.",
    content: "Major technology companies have announced significant investments in artificial intelligence infrastructure...",
    source: "Financial Times",
    url: "https://ft.com/sample-4",
    impact_score: 7.9,
    sentiment_score: 0.7,
    published_at: new Date(Date.now() - 8 * 3600000).toISOString(), // 8 hours ago
    tags: ['technology', 'ai', 'stocks', 'investment']
  },
  {
    id: 5,
    title: "European Central Bank Maintains Current Policy Stance",
    summary: "ECB keeps interest rates unchanged while monitoring inflation data closely.",
    content: "The European Central Bank has decided to maintain its current monetary policy stance...",
    source: "MarketWatch",
    url: "https://marketwatch.com/sample-5",
    impact_score: 6.5,
    sentiment_score: 0.1,
    published_at: new Date(Date.now() - 12 * 3600000).toISOString(), // 12 hours ago
    tags: ['ecb', 'european-union', 'monetary-policy', 'inflation']
  }
];

// Get latest news articles
router.get('/', async (req, res) => {
  try {
    const {
      limit = 20,
      offset = 0,
      category,
      symbol,
      min_impact = 0,
      sort = 'published_at'
    } = req.query;

    // ── Stock-specific news: fetch from Finnhub company-news ─────────────────
    if (symbol) {
      try {
        const articles = await finnhubService.getCompanyNews(symbol.toUpperCase(), { days: 7 });
        if (articles && articles.length > 0) {
          const mapped = articles.slice(0, parseInt(limit)).map((a, i) => ({
            id: a.id || i + 1,
            title: a.title || '',
            summary: a.summary || '',
            content: a.summary || '',
            source: a.source || 'Finnhub',
            url: a.url || '#',
            impact_score: 6.0,
            sentiment_score: 0,
            published_at: a.publishedAt || new Date().toISOString(),
            tags: [symbol.toLowerCase(), 'stocks'],
            imageUrl: a.imageUrl || null,
          }));
          return res.json({
            articles: mapped,
            total: mapped.length,
            limit: parseInt(limit),
            offset: parseInt(offset),
            has_more: false,
            source: 'finnhub',
          });
        }
      } catch (e) {
        console.warn(`[News] Finnhub company news failed for ${symbol}:`, e.message);
      }
      // Fall through to mock if Finnhub fails
    }

    // ── General/market news: try Finnhub general news first ─────────────────
    const isGeneral = !category || category === 'general' || category === 'all';
    if (isGeneral) {
      try {
        const articles = await finnhubService.getGeneralNews('general', { limit: parseInt(limit) });
        if (articles && articles.length > 0) {
          const mapped = articles.slice(parseInt(offset), parseInt(offset) + parseInt(limit)).map((a, i) => ({
            id: a.id || i + 1,
            title: a.title || '',
            summary: a.summary || '',
            content: a.summary || '',
            source: a.source || 'Finnhub',
            url: a.url || '#',
            impact_score: 6.0,
            sentiment_score: 0,
            published_at: a.publishedAt || new Date().toISOString(),
            tags: ['general', 'markets'],
          }));
          return res.json({
            articles: mapped,
            total: mapped.length,
            limit: parseInt(limit),
            offset: parseInt(offset),
            has_more: false,
            source: 'finnhub',
          });
        }
      } catch (e) {
        console.warn('[News] Finnhub general news failed:', e.message);
      }
    }

    // ── Fallback: filter mock news by category/tags ───────────────────────────
    let filteredNews = [...mockNews];

    // 'general' and 'all' should return everything; only filter on specific categories
    if (category && !isGeneral) {
      filteredNews = filteredNews.filter(article =>
        article.tags.some(tag => tag.includes(category.toLowerCase()))
      );
    }

    // Filter by minimum impact score
    if (min_impact > 0) {
      filteredNews = filteredNews.filter(article =>
        article.impact_score >= parseFloat(min_impact)
      );
    }

    // Sort articles
    if (sort === 'impact_score') {
      filteredNews.sort((a, b) => b.impact_score - a.impact_score);
    } else if (sort === 'published_at') {
      filteredNews.sort((a, b) => new Date(b.published_at) - new Date(a.published_at));
    }

    // Apply pagination
    const startIndex = parseInt(offset);
    const endIndex = startIndex + parseInt(limit);
    const paginatedNews = filteredNews.slice(startIndex, endIndex);

    res.json({
      articles: paginatedNews,
      total: filteredNews.length,
      limit: parseInt(limit),
      offset: parseInt(offset),
      has_more: endIndex < filteredNews.length,
      source: 'mock',
    });

  } catch (error) {
    console.error('Error fetching news:', error);
    res.status(500).json({ error: 'Failed to fetch news articles' });
  }
});

// Search news articles
router.get('/search', (req, res) => {
  try {
    const { q, limit = 10 } = req.query;

    if (!q) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    const searchTerm = q.toLowerCase();
    const searchResults = mockNews.filter(article => 
      article.title.toLowerCase().includes(searchTerm) ||
      article.summary.toLowerCase().includes(searchTerm) ||
      article.content.toLowerCase().includes(searchTerm) ||
      article.tags.some(tag => tag.includes(searchTerm))
    ).slice(0, parseInt(limit));

    res.json({
      query: q,
      results: searchResults,
      total_found: searchResults.length
    });

  } catch (error) {
    console.error('Error searching news:', error);
    res.status(500).json({ error: 'Failed to search news articles' });
  }
});

// Get sentiment analysis for a specific symbol
router.get('/sentiment/:symbol', (req, res) => {
  try {
    const { symbol } = req.params;
    const symbolLower = symbol.toLowerCase();

    // Filter articles mentioning the symbol
    const relevantArticles = mockNews.filter(article => 
      article.title.toLowerCase().includes(symbolLower) ||
      article.content.toLowerCase().includes(symbolLower) ||
      article.tags.some(tag => tag.includes(symbolLower))
    );

    if (relevantArticles.length === 0) {
      return res.json({
        symbol: symbol.toUpperCase(),
        sentiment_score: 0,
        sentiment_label: 'neutral',
        confidence: 0,
        article_count: 0,
        articles: []
      });
    }

    // Calculate aggregate sentiment
    const totalSentiment = relevantArticles.reduce((sum, article) => sum + article.sentiment_score, 0);
    const avgSentiment = totalSentiment / relevantArticles.length;
    
    let sentimentLabel = 'neutral';
    if (avgSentiment > 0.2) sentimentLabel = 'positive';
    else if (avgSentiment < -0.2) sentimentLabel = 'negative';

    res.json({
      symbol: symbol.toUpperCase(),
      sentiment_score: parseFloat(avgSentiment.toFixed(3)),
      sentiment_label: sentimentLabel,
      confidence: Math.min(relevantArticles.length * 0.2, 1), // Simple confidence based on article count
      article_count: relevantArticles.length,
      articles: relevantArticles.slice(0, 5) // Return top 5 relevant articles
    });

  } catch (error) {
    console.error('Error analyzing sentiment:', error);
    res.status(500).json({ error: 'Failed to analyze sentiment' });
  }
});

// Get high-impact news alerts
router.get('/impact', (req, res) => {
  try {
    const { min_score = 7.0 } = req.query;

    const highImpactNews = mockNews
      .filter(article => article.impact_score >= parseFloat(min_score))
      .sort((a, b) => b.impact_score - a.impact_score)
      .slice(0, 10);

    res.json({
      alerts: highImpactNews,
      min_impact_score: parseFloat(min_score),
      total_found: highImpactNews.length
    });

  } catch (error) {
    console.error('Error fetching impact news:', error);
    res.status(500).json({ error: 'Failed to fetch impact news' });
  }
});

// Get news article by ID
router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const article = mockNews.find(article => article.id === parseInt(id));

    if (!article) {
      return res.status(404).json({ error: 'Article not found' });
    }

    res.json(article);

  } catch (error) {
    console.error('Error fetching article:', error);
    res.status(500).json({ error: 'Failed to fetch article' });
  }
});

module.exports = router;