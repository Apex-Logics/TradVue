const express = require('express');
const router = express.Router();
const finnhubService = require('../services/finnhub');
const marketauxService = require('../services/marketaux');

// ─────────────────────────────────────────────────────────────────────────────
// Mock news fallback (used when all live sources fail)
// ─────────────────────────────────────────────────────────────────────────────
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
    published_at: new Date(Date.now() - 2 * 3600000).toISOString(),
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
    published_at: new Date(Date.now() - 4 * 3600000).toISOString(),
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
    published_at: new Date(Date.now() - 6 * 3600000).toISOString(),
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
    published_at: new Date(Date.now() - 8 * 3600000).toISOString(),
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
    published_at: new Date(Date.now() - 12 * 3600000).toISOString(),
    tags: ['ecb', 'european-union', 'monetary-policy', 'inflation']
  }
];

// ─────────────────────────────────────────────────────────────────────────────
// Deduplication helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute word-overlap ratio between two normalised title strings.
 * Both inputs must already be space-joined sorted-word strings.
 */
function wordOverlap(a, b) {
  const setA = new Set(a.split(' '));
  const setB = new Set(b.split(' '));
  const intersection = [...setA].filter(w => setB.has(w)).length;
  return intersection / Math.max(setA.size, setB.size, 1);
}

/**
 * Score an article by data richness so we can keep the better version
 * when two articles cover the same story.
 */
function articleScore(a) {
  let score = 0;
  if (a.sentiment !== undefined && a.sentiment !== null) score += 2;
  if (a.image || a.imageUrl) score += 1;
  const summary = a.summary || a.content || '';
  if (summary.length > 100) score += 1;
  return score;
}

/**
 * Normalise an article title for fuzzy matching:
 * lowercase → strip punctuation → tokenise → drop short words → sort → join
 */
function normaliseTitle(title = '') {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 3)
    .sort()
    .join(' ');
}

/**
 * Merge and deduplicate articles from multiple sources.
 * Strategy:
 *  1. Exact URL match → drop duplicate
 *  2. Fuzzy title match (>70 % word overlap) → keep higher-scored article
 * Returns deduplicated array sorted newest-first.
 */
function deduplicateArticles(articles) {
  const seen = new Map();   // normalised title → article
  const seenUrls = new Set();

  for (const article of articles) {
    const url = article.url;

    // 1. Skip exact URL dupes
    if (url && url !== '#' && seenUrls.has(url)) continue;
    if (url && url !== '#') seenUrls.add(url);

    // 2. Fuzzy title dedup
    const normalized = normaliseTitle(article.title);

    let isDupe = false;
    for (const [existingNorm, existingArticle] of seen) {
      if (wordOverlap(normalized, existingNorm) > 0.7) {
        // Keep the richer article
        if (articleScore(article) > articleScore(existingArticle)) {
          seen.delete(existingNorm);
          seen.set(normalized, article);
        }
        isDupe = true;
        break;
      }
    }

    if (!isDupe) seen.set(normalized, article);
  }

  return [...seen.values()];
}

// ─────────────────────────────────────────────────────────────────────────────
// Unified article mapper
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Normalise a Finnhub article (from getCompanyNews / getGeneralNews) into
 * the unified shape used in API responses.
 */
function mapFinnhubArticle(a, index, symbol) {
  // getCompanyNews returns { publishedAt } while getGeneralNews returns the same
  const publishedAt = a.publishedAt || (a.datetime
    ? (typeof a.datetime === 'number'
        ? new Date(a.datetime * 1000).toISOString()
        : a.datetime)
    : new Date().toISOString());

  return {
    id: a.id || String(index + 1),
    title: a.title || '',
    summary: a.summary || '',
    content: a.summary || '',
    source: a.source || 'Finnhub',
    url: a.url || '#',
    impact_score: 6.0,
    sentiment_score: a.sentimentScore || 0,
    published_at: publishedAt,
    tags: symbol
      ? [symbol.toLowerCase(), 'stocks']
      : (a.tags || ['general', 'markets']),
    imageUrl: a.imageUrl || a.image || null,
    sentiment: a.sentiment || null,
    sentimentLabel: a.sentimentLabel || null,
    _source: a._source || 'finnhub',
  };
}

/**
 * Normalise a Marketaux article into the unified shape.
 */
function mapMarketauxArticle(a, index) {
  const publishedAt = a.datetime
    ? new Date(a.datetime * 1000).toISOString()
    : new Date().toISOString();

  return {
    id: a.id || String(index + 1),
    title: a.title || '',
    summary: a.summary || '',
    content: a.summary || '',
    source: a.source || 'Marketaux',
    url: a.url || '#',
    impact_score: 6.0,
    sentiment_score: a.sentiment || 0,
    published_at: publishedAt,
    tags: (a.related || []).map(s => s.toLowerCase()),
    imageUrl: a.image || null,
    sentiment: a.sentiment || null,
    sentimentLabel: a.sentimentLabel || null,
    _source: 'marketaux',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Routes
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/news
 * Returns merged, deduplicated news from Finnhub + Marketaux.
 */
router.get('/', async (req, res) => {
  try {
    const {
      limit = 20,
      offset = 0,
      category,
      symbol,
      min_impact = 0,
      sort = 'published_at',
    } = req.query;

    const parsedLimit  = parseInt(limit, 10);
    const parsedOffset = parseInt(offset, 10);

    // ── Symbol-specific: fetch from Finnhub + Marketaux in parallel ──────────
    if (symbol) {
      const upperSymbol = symbol.toUpperCase();

      const [finnhubArticles, marketauxArticles] = await Promise.allSettled([
        finnhubService.getCompanyNews(upperSymbol, { days: 7 }),
        marketauxService.getNews({ symbols: upperSymbol, limit: parsedLimit }),
      ]);

      const finnhub = finnhubArticles.status === 'fulfilled' && finnhubArticles.value?.length > 0
        ? finnhubArticles.value.map((a, i) => mapFinnhubArticle(a, i, upperSymbol))
        : [];

      const marketaux = marketauxArticles.status === 'fulfilled' && marketauxArticles.value?.length > 0
        ? marketauxArticles.value.map((a, i) => mapMarketauxArticle(a, i))
        : [];

      if (finnhubArticles.status === 'rejected') {
        console.warn(`[News] Finnhub company news failed for ${upperSymbol}:`, finnhubArticles.reason?.message);
      }
      if (marketauxArticles.status === 'rejected') {
        console.warn(`[News] Marketaux news failed for ${upperSymbol}:`, marketauxArticles.reason?.message);
      }

      // If both failed, fall through to mock
      if (finnhub.length === 0 && marketaux.length === 0) {
        // fall through below
      } else {
        const merged = deduplicateArticles([...finnhub, ...marketaux])
          .sort((a, b) => new Date(b.published_at) - new Date(a.published_at))
          .slice(0, parsedLimit);

        return res.json({
          articles: merged,
          total: merged.length,
          limit: parsedLimit,
          offset: parsedOffset,
          has_more: false,
          sources: ['finnhub', 'marketaux'],
        });
      }
    }

    // ── General/market news ───────────────────────────────────────────────────
    const isGeneral = !category || category === 'general' || category === 'all';

    if (isGeneral) {
      const [finnhubResult, marketauxResult] = await Promise.allSettled([
        finnhubService.getGeneralNews('general', { limit: parsedLimit }),
        marketauxService.getNews({ limit: parsedLimit }),
      ]);

      const finnhub = finnhubResult.status === 'fulfilled' && finnhubResult.value?.length > 0
        ? finnhubResult.value.map((a, i) => mapFinnhubArticle(a, i, null))
        : [];

      const marketaux = marketauxResult.status === 'fulfilled' && marketauxResult.value?.length > 0
        ? marketauxResult.value.map((a, i) => mapMarketauxArticle(a, i))
        : [];

      if (finnhubResult.status === 'rejected') {
        console.warn('[News] Finnhub general news failed:', finnhubResult.reason?.message);
      }
      if (marketauxResult.status === 'rejected') {
        console.warn('[News] Marketaux general news failed:', marketauxResult.reason?.message);
      }

      if (finnhub.length > 0 || marketaux.length > 0) {
        const merged = deduplicateArticles([...finnhub, ...marketaux])
          .sort((a, b) => new Date(b.published_at) - new Date(a.published_at));

        const paginated = merged.slice(parsedOffset, parsedOffset + parsedLimit);

        return res.json({
          articles: paginated,
          total: merged.length,
          limit: parsedLimit,
          offset: parsedOffset,
          has_more: parsedOffset + parsedLimit < merged.length,
          sources: ['finnhub', 'marketaux'],
        });
      }
    }

    // ── Fallback: mock data ───────────────────────────────────────────────────
    let filteredNews = [...mockNews];

    if (category && !isGeneral) {
      filteredNews = filteredNews.filter(article =>
        article.tags.some(tag => tag.includes(category.toLowerCase()))
      );
    }

    if (min_impact > 0) {
      filteredNews = filteredNews.filter(article =>
        article.impact_score >= parseFloat(min_impact)
      );
    }

    if (sort === 'impact_score') {
      filteredNews.sort((a, b) => b.impact_score - a.impact_score);
    } else {
      filteredNews.sort((a, b) => new Date(b.published_at) - new Date(a.published_at));
    }

    const paginatedNews = filteredNews.slice(parsedOffset, parsedOffset + parsedLimit);

    return res.json({
      articles: paginatedNews,
      total: filteredNews.length,
      limit: parsedLimit,
      offset: parsedOffset,
      has_more: parsedOffset + parsedLimit < filteredNews.length,
      sources: ['mock'],
    });

  } catch (error) {
    console.error('[News] Error fetching news:', error);
    res.status(500).json({ error: 'Failed to fetch news articles' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/news/search
 */
router.get('/search', (req, res) => {
  try {
    const { q, limit = 10 } = req.query;

    if (!q) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    const searchTerm = q.toLowerCase();
    const searchResults = mockNews
      .filter(article =>
        article.title.toLowerCase().includes(searchTerm) ||
        article.summary.toLowerCase().includes(searchTerm) ||
        article.content.toLowerCase().includes(searchTerm) ||
        article.tags.some(tag => tag.includes(searchTerm))
      )
      .slice(0, parseInt(limit, 10));

    res.json({
      query: q,
      results: searchResults,
      total_found: searchResults.length,
    });

  } catch (error) {
    console.error('[News] Error searching news:', error);
    res.status(500).json({ error: 'Failed to search news articles' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/news/sentiment/:symbol
 * Returns aggregated sentiment for a symbol using Marketaux data when available.
 */
router.get('/sentiment/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const upperSymbol = symbol.toUpperCase();

    // Try Marketaux sentiment first
    try {
      const sentiment = await marketauxService.getSentiment(upperSymbol);
      if (sentiment && sentiment.articles > 0) {
        return res.json({
          symbol: upperSymbol,
          sentiment_score: sentiment.score,
          sentiment_label: sentiment.label.toLowerCase(),
          confidence: Math.min(sentiment.articles * 0.1, 1),
          article_count: sentiment.articles,
          articles: [],
          source: 'marketaux',
        });
      }
    } catch (e) {
      console.warn(`[News] Marketaux sentiment failed for ${upperSymbol}:`, e.message);
    }

    // Fallback: mock-based sentiment
    const symbolLower = upperSymbol.toLowerCase();
    const relevantArticles = mockNews.filter(article =>
      article.title.toLowerCase().includes(symbolLower) ||
      article.content.toLowerCase().includes(symbolLower) ||
      article.tags.some(tag => tag.includes(symbolLower))
    );

    if (relevantArticles.length === 0) {
      return res.json({
        symbol: upperSymbol,
        sentiment_score: 0,
        sentiment_label: 'neutral',
        confidence: 0,
        article_count: 0,
        articles: [],
        source: 'mock',
      });
    }

    const avgSentiment =
      relevantArticles.reduce((sum, a) => sum + a.sentiment_score, 0) /
      relevantArticles.length;

    let sentimentLabel = 'neutral';
    if (avgSentiment > 0.2) sentimentLabel = 'positive';
    else if (avgSentiment < -0.2) sentimentLabel = 'negative';

    res.json({
      symbol: upperSymbol,
      sentiment_score: parseFloat(avgSentiment.toFixed(3)),
      sentiment_label: sentimentLabel,
      confidence: Math.min(relevantArticles.length * 0.2, 1),
      article_count: relevantArticles.length,
      articles: relevantArticles.slice(0, 5),
      source: 'mock',
    });

  } catch (error) {
    console.error('[News] Error analyzing sentiment:', error);
    res.status(500).json({ error: 'Failed to analyze sentiment' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/news/impact
 */
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
      total_found: highImpactNews.length,
    });

  } catch (error) {
    console.error('[News] Error fetching impact news:', error);
    res.status(500).json({ error: 'Failed to fetch impact news' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/news/:id
 */
router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const article = mockNews.find(article => article.id === parseInt(id, 10));

    if (!article) {
      return res.status(404).json({ error: 'Article not found' });
    }

    res.json(article);

  } catch (error) {
    console.error('[News] Error fetching article:', error);
    res.status(500).json({ error: 'Failed to fetch article' });
  }
});

module.exports = router;
