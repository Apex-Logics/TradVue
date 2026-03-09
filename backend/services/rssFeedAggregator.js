/**
 * RSS Feed Aggregator
 * 
 * Pulls financial news from multiple RSS sources + optionally NewsAPI.
 * Normalizes into a unified article schema with basic NLP (sentiment, tags, impact).
 * 
 * Free-tier sources (no API key needed):
 *   - Reuters Business/Markets RSS
 *   - MarketWatch
 *   - Investing.com
 *   - CoinDesk (crypto)
 *   - FXStreet (forex)
 * 
 * Paid (optional enhancement):
 *   - NewsAPI.org ($449/mo for production, $0 for dev)
 */

const RSSParser = require('rss-parser');
const axios = require('axios');
const cache = require('./cache');
const finnhub = require('./finnhub');

const parser = new RSSParser({
  timeout: 12000,
  headers: {
    'User-Agent': 'TradVue/1.0 (tradvue.io; news-aggregator)'
  }
});

// ─────────────────────────────────────────────
// RSS Feed Registry (Expanded 2026-03-08)
// All feeds are publicly available RSS - legal to consume
// ─────────────────────────────────────────────
const RSS_FEEDS = [
  // ═══════════════════════════════════════════
  // GENERAL MARKETS & STOCKS
  // ═══════════════════════════════════════════
  {
    name: 'Yahoo Finance',
    url: 'https://finance.yahoo.com/news/rssindex',
    category: 'markets',
    tags: ['markets', 'stocks', 'finance'],
    weight: 1.3,
    maxItems: 8   // Cap to prevent one source dominating
  },
  {
    name: 'MarketWatch',
    url: 'https://feeds.content.dowjones.io/public/rss/mw_realtimeheadlines',
    category: 'markets',
    tags: ['markets', 'stocks', 'trading'],
    weight: 1.2
  },
  {
    name: 'MarketWatch Top Stories',
    url: 'https://feeds.content.dowjones.io/public/rss/mw_topstories',
    category: 'markets',
    tags: ['markets', 'stocks', 'breaking'],
    weight: 1.3
  },
  {
    name: 'CNBC',
    url: 'https://www.cnbc.com/id/100003114/device/rss/rss.html',
    category: 'business',
    tags: ['business', 'markets', 'economy'],
    weight: 1.2
  },
  {
    name: 'CNBC World',
    url: 'https://www.cnbc.com/id/100727362/device/rss/rss.html',
    category: 'markets',
    tags: ['markets', 'global', 'international'],
    weight: 1.1
  },
  {
    name: 'Seeking Alpha Market News',
    url: 'https://seekingalpha.com/market_currents.xml',
    category: 'markets',
    tags: ['markets', 'stocks', 'analysis'],
    weight: 1.2
  },
  {
    name: 'Seeking Alpha Top Ideas',
    url: 'https://seekingalpha.com/feed.xml',
    category: 'stocks',
    tags: ['stocks', 'analysis', 'investing'],
    weight: 1.1,
    maxItems: 8
  },
  {
    name: 'WSJ Markets',
    url: 'https://feeds.a.dj.com/rss/RSSMarketsMain.xml',
    category: 'markets',
    tags: ['markets', 'stocks', 'breaking'],
    weight: 1.3
  },
  {
    name: 'Bloomberg Markets',
    url: 'https://feeds.bloomberg.com/markets/news.rss',
    category: 'markets',
    tags: ['markets', 'stocks', 'global'],
    weight: 1.3
  },
  {
    name: 'Financial Times',
    url: 'https://www.ft.com/rss/home',
    category: 'markets',
    tags: ['markets', 'global', 'analysis'],
    weight: 1.2
  },
  {
    name: 'Business Insider Markets',
    url: 'https://markets.businessinsider.com/rss/news',
    category: 'markets',
    tags: ['markets', 'stocks', 'business'],
    weight: 1.1
  },
  {
    name: 'Benzinga',
    url: 'https://www.benzinga.com/feed',
    category: 'markets',
    tags: ['markets', 'stocks', 'trading'],
    weight: 1.1
  },
  
  // ═══════════════════════════════════════════
  // CRYPTO
  // ═══════════════════════════════════════════
  {
    name: 'CoinDesk',
    url: 'https://www.coindesk.com/arc/outboundfeeds/rss/',
    category: 'crypto',
    tags: ['crypto', 'bitcoin', 'blockchain'],
    weight: 1.1
  },
  {
    name: 'Cointelegraph',
    url: 'https://cointelegraph.com/rss',
    category: 'crypto',
    tags: ['crypto', 'bitcoin', 'altcoins'],
    weight: 1.1
  },
  {
    name: 'The Block',
    url: 'https://www.theblock.co/rss.xml',
    category: 'crypto',
    tags: ['crypto', 'defi', 'institutional'],
    weight: 1.2
  },
  {
    name: 'Decrypt',
    url: 'https://decrypt.co/feed',
    category: 'crypto',
    tags: ['crypto', 'web3', 'defi'],
    weight: 1.0
  },
  {
    name: 'Bitcoin Magazine',
    url: 'https://bitcoinmagazine.com/feed',
    category: 'crypto',
    tags: ['bitcoin', 'crypto'],
    weight: 1.0
  },
  {
    name: 'CryptoNews',
    url: 'https://cryptonews.com/news/feed/',
    category: 'crypto',
    tags: ['crypto', 'altcoins', 'blockchain'],
    weight: 1.0
  },
  {
    name: 'NewsBTC',
    url: 'https://www.newsbtc.com/feed/',
    category: 'crypto',
    tags: ['bitcoin', 'crypto', 'trading'],
    weight: 1.0
  },
  
  // ═══════════════════════════════════════════
  // FOREX
  // ═══════════════════════════════════════════
  // Note: FXStreet returns 403 from cloud/datacenter IPs - removed
  {
    name: 'ForexLive',
    url: 'https://www.forexlive.com/feed/',
    category: 'forex',
    tags: ['forex', 'currency', 'central-banks'],
    weight: 1.2
  },
  {
    name: 'ForexCrunch',
    url: 'https://www.forexcrunch.com/feed/',
    category: 'forex',
    tags: ['forex', 'currency', 'trading', 'technical-analysis'],
    weight: 1.1
  },
  
  // ═══════════════════════════════════════════
  // ECONOMY & MACRO
  // ═══════════════════════════════════════════
  {
    name: 'Investing.com Economy',
    url: 'https://www.investing.com/rss/news_285.rss',
    category: 'economy',
    tags: ['economy', 'macroeconomics'],
    weight: 1.15
  },
  {
    name: 'Investing.com Commodities',
    url: 'https://www.investing.com/rss/news_25.rss',
    category: 'commodities',
    tags: ['commodities', 'oil', 'gold'],
    weight: 1.1
  },
  {
    name: 'Investing.com Forex',
    url: 'https://www.investing.com/rss/news_1.rss',
    category: 'forex',
    tags: ['forex', 'currencies'],
    weight: 1.1
  },
  
  // ═══════════════════════════════════════════
  // CENTRAL BANKS & GOVERNMENT
  // ═══════════════════════════════════════════
  {
    name: 'Federal Reserve News',
    url: 'https://www.federalreserve.gov/feeds/press_all.xml',
    category: 'central-banks',
    tags: ['fed', 'central-banks', 'monetary-policy', 'interest-rates'],
    weight: 1.5  // High impact - direct from source
  },
  {
    name: 'ECB Press Releases',
    url: 'https://www.ecb.europa.eu/rss/press.html',
    category: 'central-banks',
    tags: ['ecb', 'central-banks', 'euro', 'monetary-policy'],
    weight: 1.4
  },
  {
    name: 'Bank of England News',
    url: 'https://www.bankofengland.co.uk/rss/news',
    category: 'central-banks',
    tags: ['boe', 'central-banks', 'gbp', 'monetary-policy'],
    weight: 1.4
  },
  
  // ═══════════════════════════════════════════
  // ALTERNATIVE / COMMENTARY
  // ═══════════════════════════════════════════
  {
    name: 'Zero Hedge',
    url: 'https://feeds.feedburner.com/zerohedge/feed',
    category: 'markets',
    tags: ['markets', 'alternative', 'macro'],
    weight: 0.9  // Lower weight - opinion-heavy
  },
  {
    name: 'Calculated Risk',
    url: 'https://www.calculatedriskblog.com/feeds/posts/default',
    category: 'economy',
    tags: ['economy', 'housing', 'macro', 'data'],
    weight: 1.1
  },
];

// ─────────────────────────────────────────────
// Simple Financial NLP
// ─────────────────────────────────────────────
const SENTIMENT_POSITIVE = [
  'surge', 'soar', 'rally', 'gain', 'rise', 'jump', 'bull', 'boost',
  'growth', 'profit', 'record high', 'beat', 'exceed', 'strong', 'upgrade',
  'outperform', 'buy', 'accumulate', 'positive', 'recovery', 'rebound'
];

const SENTIMENT_NEGATIVE = [
  'crash', 'plunge', 'fall', 'drop', 'decline', 'bear', 'loss', 'cut',
  'miss', 'weak', 'recession', 'default', 'downgrade', 'sell', 'underperform',
  'warning', 'risk', 'concern', 'uncertainty', 'negative', 'fear', 'collapse'
];

const HIGH_IMPACT_KEYWORDS = [
  'federal reserve', 'fed rate', 'interest rate', 'central bank', 'rate hike', 'rate cut',
  'cpi', 'inflation', 'gdp', 'non-farm payroll', 'nfp', 'unemployment',
  'earnings beat', 'earnings miss', 'bankruptcy', 'merger', 'acquisition',
  'war', 'sanctions', 'crisis', 'bailout', 'default', 'emergency'
];

const SYMBOL_KEYWORD_MAP = {
  'AAPL': ['apple', 'iphone', 'tim cook', 'app store'],
  'GOOGL': ['google', 'alphabet', 'youtube', 'gemini', 'waymo'],
  'TSLA': ['tesla', 'elon musk', 'electric vehicle', 'ev'],
  'MSFT': ['microsoft', 'azure', 'satya nadella', 'copilot'],
  'NVDA': ['nvidia', 'gpu', 'cuda', 'jensen huang'],
  'BTC': ['bitcoin', 'btc', 'crypto', 'satoshi'],
  'ETH': ['ethereum', 'ether', 'vitalik', 'defi', 'nft'],
  'EUR/USD': ['euro', 'eurusd', 'ecb', 'european central bank'],
  'GBP/USD': ['pound', 'sterling', 'bank of england', 'boe'],
  'USD/JPY': ['yen', 'bank of japan', 'boj'],
  'GOLD': ['gold', 'xau', 'precious metal', 'bullion'],
  'OIL': ['crude oil', 'wti', 'brent', 'opec', 'petroleum']
};

// ─────────────────────────────────────────────
// Service Class
// ─────────────────────────────────────────────
class RSSFeedAggregator {
  constructor() {
    const rawKey = process.env.NEWS_API_KEY || '';
    // Only use NewsAPI key if it's been set (not placeholder)
    this.newsAPIKey = (rawKey && !rawKey.startsWith('REPLACE_')) ? rawKey : null;
    this.feeds = RSS_FEEDS;
    this._articleCache = new Map(); // Dedup by URL across fetch cycles
  }

  /**
   * Fetch and aggregate news from all RSS sources
   */
  async getAggregatedNews({ limit = 30, category = null, minImpact = 0 } = {}) {
    const cacheKey = `rss:aggregated:${category || 'all'}:${minImpact}:${limit}`;

    return await cache.cacheAPICall(cacheKey, async () => {
      const feedsToFetch = category
        ? this.feeds.filter(f => f.category === category || f.tags.includes(category))
        : this.feeds;

      // Fetch all feeds concurrently with per-feed error isolation
      const feedResults = await Promise.allSettled(
        feedsToFetch.map(feed => this._fetchFeed(feed))
      );

      const allArticles = [];
      feedResults.forEach((result, i) => {
        if (result.status === 'fulfilled') {
          allArticles.push(...result.value);
        } else {
          console.warn(`[RSS] Feed "${feedsToFetch[i].name}" failed: ${result.reason?.message}`);
        }
      });

      // If too few articles, supplement with Finnhub news
      const finnhubCategoryMap = {
        'crypto': 'crypto',
        'forex': 'forex',
        null: 'general',
        undefined: 'general',
        'business': 'general',
        'markets': 'general',
        'economy': 'general',
        'stocks': 'general'
      };
      const finnhubCat = finnhubCategoryMap[category] || 'general';

      if (allArticles.length < 10) {
        try {
          const finnhubNews = await finnhub.getGeneralNews(finnhubCat, { limit: 30 });
          allArticles.push(...finnhubNews);
        } catch (e) {
          console.warn('[RSS] Finnhub news supplement failed:', e.message);
        }
      }

      // If still no articles, fall back to NewsAPI (if key is properly configured)
      if (allArticles.length === 0 && this.newsAPIKey) {
        console.info('[RSS] All feeds failed, falling back to NewsAPI');
        return await this._fetchFromNewsAPI({ limit });
      }

      // Deduplicate by URL
      const seen = new Set();
      const deduped = allArticles.filter(a => {
        if (seen.has(a.url)) return false;
        seen.add(a.url);
        return true;
      });

      // Filter by impact
      const filtered = minImpact > 0
        ? deduped.filter(a => a.impactScore >= minImpact)
        : deduped;

      // Sort by published date descending, then impact
      filtered.sort((a, b) => {
        const timeDiff = new Date(b.publishedAt) - new Date(a.publishedAt);
        if (Math.abs(timeDiff) > 3600000) return timeDiff; // 1-hour threshold
        return b.impactScore - a.impactScore;
      });

      return filtered.slice(0, limit);
    }, 600); // Cache 10 minutes
  }

  /**
   * Get news relevant to a specific symbol
   */
  async getNewsBySymbol(symbol, { limit = 15 } = {}) {
    const cacheKey = `rss:symbol:${symbol.toUpperCase()}:${limit}`;

    return await cache.cacheAPICall(cacheKey, async () => {
      const allNews = await this.getAggregatedNews({ limit: 200 });
      const keywords = SYMBOL_KEYWORD_MAP[symbol.toUpperCase()] || [symbol.toLowerCase()];

      const relevant = allNews.filter(article => {
        const text = `${article.title} ${article.summary}`.toLowerCase();
        return keywords.some(kw => text.includes(kw));
      });

      // Always supplement with Finnhub company news
      try {
        const companyNews = await finnhub.getCompanyNews(symbol, { days: 7 });
        const normalized = companyNews.map(item => ({
          id: item.id || item.url,
          title: item.title || '',
          summary: item.summary || '',
          url: item.url,
          source: item.source || 'Finnhub',
          category: 'stocks',
          publishedAt: item.publishedAt,
          sentimentScore: this._scoreSentiment((item.title + ' ' + (item.summary || '')).toLowerCase()),
          sentimentLabel: 'neutral',
          impactScore: 5,
          impactLabel: 'Medium',
          tags: ['stocks'],
          symbols: [symbol.toUpperCase()],
          imageUrl: item.imageUrl || null
        }));

        const merged = [...relevant, ...normalized];
        const seen = new Set();
        const deduped = merged.filter(a => {
          const key = a.url || a.id;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        return deduped.slice(0, limit);
      } catch (e) {
        console.warn(`[RSS] Finnhub company news for ${symbol} failed:`, e.message);
      }

      // If NewsAPI available and we have fewer than 5 results, supplement
      if (relevant.length < 5 && this.newsAPIKey && this.newsAPIKey !== 'REPLACE_WITH_YOUR_NEWSAPI_KEY') {
        const supplemental = await this._fetchFromNewsAPI({ q: symbol, limit: 10 });
        const merged = [...relevant, ...supplemental];
        const seen = new Set(relevant.map(a => a.url));
        return merged.filter(a => {
          if (seen.has(a.url)) return false;
          seen.add(a.url);
          return true;
        }).slice(0, limit);
      }

      return relevant.slice(0, limit);
    }, 900);
  }

  /**
   * Get aggregate sentiment for a symbol
   */
  async getSymbolSentiment(symbol) {
    const articles = await this.getNewsBySymbol(symbol, { limit: 30 });

    if (articles.length === 0) {
      return { symbol, score: 0, label: 'neutral', confidence: 0, articleCount: 0 };
    }

    const totalSentiment = articles.reduce((sum, a) => sum + a.sentimentScore, 0);
    const avgSentiment = totalSentiment / articles.length;
    const confidence = Math.min(articles.length / 20, 1); // max confidence at 20 articles

    return {
      symbol: symbol.toUpperCase(),
      score: parseFloat(avgSentiment.toFixed(3)),
      label: avgSentiment > 0.15 ? 'bullish' : avgSentiment < -0.15 ? 'bearish' : 'neutral',
      confidence: parseFloat(confidence.toFixed(2)),
      articleCount: articles.length,
      topArticles: articles.slice(0, 5)
    };
  }

  /**
   * Fetch a single RSS feed and normalize items
   */
  async _fetchFeed(feedConfig) {
    const feed = await parser.parseURL(feedConfig.url);
    const maxItems = feedConfig.maxItems || 12; // Default 12 per feed for source diversity
    return (feed.items || []).slice(0, maxItems).map(item =>
      this._normalizeArticle(item, feedConfig)
    );
  }

  /**
   * Normalize an RSS item to our unified article schema
   */
  _normalizeArticle(item, feedConfig) {
    const title = item.title || '';
    const summary = item.contentSnippet || item.content || item.summary || '';
    const text = `${title} ${summary}`.toLowerCase();

    const sentimentScore = this._scoreSentiment(text);
    const impactScore = this._scoreImpact(text, feedConfig.weight);
    const tags = this._extractTags(text, feedConfig.tags);
    const symbols = this._detectSymbols(text);

    return {
      id: item.guid || item.link || `rss-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      title,
      summary: summary.slice(0, 500),
      url: item.link || null,
      source: feedConfig.name,
      category: feedConfig.category,
      publishedAt: item.isoDate || item.pubDate || new Date().toISOString(),
      sentimentScore,
      sentimentLabel: sentimentScore > 0.15 ? 'bullish' : sentimentScore < -0.15 ? 'bearish' : 'neutral',
      impactScore: parseFloat(impactScore.toFixed(1)),
      impactLabel: impactScore >= 7 ? 'High' : impactScore >= 4 ? 'Medium' : 'Low',
      tags,
      symbols,
      imageUrl: item.enclosure?.url || null
    };
  }

  _scoreSentiment(text) {
    const pos = SENTIMENT_POSITIVE.filter(w => text.includes(w)).length;
    const neg = SENTIMENT_NEGATIVE.filter(w => text.includes(w)).length;
    const total = pos + neg;
    if (total === 0) return 0;
    return parseFloat(((pos - neg) / total).toFixed(3));
  }

  _scoreImpact(text, weight = 1.0) {
    const highKeywordHits = HIGH_IMPACT_KEYWORDS.filter(kw => text.includes(kw)).length;
    const baseScore = Math.min(highKeywordHits * 2.5, 10);
    return Math.min(baseScore * weight, 10);
  }

  _extractTags(text, sourceTags = []) {
    const allKeywords = Object.values(SYMBOL_KEYWORD_MAP).flat();
    const domainTags = ['stocks', 'crypto', 'forex', 'bonds', 'commodities', 'economy',
      'fed', 'central bank', 'earnings', 'ipo', 'merger', 'acquisition', 'inflation', 'gdp'];

    const detected = [...domainTags, ...allKeywords].filter(kw => text.includes(kw));
    return [...new Set([...sourceTags, ...detected])].slice(0, 10);
  }

  _detectSymbols(text) {
    const detected = [];
    for (const [symbol, keywords] of Object.entries(SYMBOL_KEYWORD_MAP)) {
      if (keywords.some(kw => text.includes(kw))) {
        detected.push(symbol);
      }
    }
    return detected;
  }

  /**
   * NewsAPI fallback (when RSS fails or for symbol-specific deep search)
   */
  async _fetchFromNewsAPI({ q = 'finance markets trading', limit = 20 } = {}) {
    if (!this.newsAPIKey) return [];

    try {
      const response = await axios.get('https://newsapi.org/v2/everything', {
        params: {
          q,
          language: 'en',
          sortBy: 'publishedAt',
          pageSize: Math.min(limit, 100),
          apiKey: this.newsAPIKey
        },
        timeout: 10000
      });

      return (response.data.articles || []).map(article => ({
        id: article.url,
        title: article.title || '',
        summary: article.description || '',
        url: article.url,
        source: article.source?.name || 'NewsAPI',
        category: 'general',
        publishedAt: article.publishedAt,
        sentimentScore: this._scoreSentiment((article.title + ' ' + article.description).toLowerCase()),
        sentimentLabel: 'neutral',
        impactScore: this._scoreImpact((article.title + ' ' + article.description).toLowerCase()),
        impactLabel: 'Medium',
        tags: this._extractTags((article.title + ' ' + article.description).toLowerCase()),
        symbols: this._detectSymbols((article.title + ' ' + article.description).toLowerCase()),
        imageUrl: article.urlToImage || null
      }));
    } catch (error) {
      console.error('[RSS] NewsAPI error:', error.message);
      return [];
    }
  }
}

module.exports = new RSSFeedAggregator();
