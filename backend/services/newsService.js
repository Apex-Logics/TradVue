/**
 * NewsService — internal news helper
 *
 * NOTE: NewsAPI.org has been removed. Their free tier TOS prohibits production
 * use. News is now sourced from Finnhub (routes/news.js) and Marketaux
 * (services/marketaux.js).
 *
 * This service retains utility methods (sentiment analysis, tag extraction,
 * mock data) used by other parts of the backend.
 */

const cache = require('./cache');

class NewsService {
  constructor() {
    // Mock news data used as last-resort fallback
    this.mockNews = [
      {
        id: 1,
        title: "Federal Reserve Signals Potential Interest Rate Changes",
        summary: "The Federal Reserve indicates possible adjustments to interest rates amid changing economic conditions.",
        content: "Federal Reserve officials are considering policy adjustments as economic indicators show mixed signals...",
        url: "#",
        source: "Reuters",
        publishedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        impact: 8.5,
        sentiment: "neutral",
        tags: ["federal-reserve", "interest-rates", "monetary-policy"]
      },
      {
        id: 2,
        title: "Bitcoin Reaches New Monthly High Amid Institutional Interest",
        summary: "Bitcoin surges to monthly highs as institutional investors increase cryptocurrency allocations.",
        content: "Bitcoin has reached its highest level this month as major institutional investors continue to expand their cryptocurrency holdings...",
        url: "#",
        source: "CoinDesk",
        publishedAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
        impact: 7.2,
        sentiment: "positive",
        tags: ["bitcoin", "cryptocurrency", "institutional-investment"]
      },
      {
        id: 3,
        title: "Tech Earnings Season Shows Mixed Results",
        summary: "Major technology companies report varied quarterly results with some exceeding expectations.",
        content: "The latest tech earnings season reveals a mixed landscape with some companies surpassing analyst expectations while others face challenges...",
        url: "#",
        source: "Bloomberg",
        publishedAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
        impact: 6.8,
        sentiment: "neutral",
        tags: ["technology", "earnings", "stocks"]
      },
      {
        id: 4,
        title: "Oil Prices Fluctuate on Supply Chain Concerns",
        summary: "Crude oil prices show volatility amid ongoing supply chain disruptions and geopolitical tensions.",
        content: "Oil markets continue to experience volatility as supply chain issues and geopolitical factors create uncertainty...",
        url: "#",
        source: "Energy News",
        publishedAt: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
        impact: 7.5,
        sentiment: "negative",
        tags: ["oil", "commodities", "supply-chain"]
      },
      {
        id: 5,
        title: "European Markets Open Higher on Economic Data",
        summary: "European stock markets start the day with gains following positive economic indicators from the region.",
        content: "European markets opened with positive momentum after the release of encouraging economic data from key eurozone countries...",
        url: "#",
        source: "Financial Times",
        publishedAt: new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString(),
        impact: 6.3,
        sentiment: "positive",
        tags: ["european-markets", "economic-data", "stocks"]
      }
    ];
  }

  // ──────────────────────────────────────────
  // Public API (consumed by other services)
  // ──────────────────────────────────────────

  async getLatestNews(limit = 20, category = 'all') {
    const cacheKey = `news:latest:${category}:${limit}`;
    return await cache.cacheAPICall(cacheKey, async () => {
      return this.getMockNewsData(limit);
    }, 600);
  }

  async getNewsBySymbol(symbol, limit = 10) {
    const cacheKey = `news:symbol:${symbol}:${limit}`;
    return await cache.cacheAPICall(cacheKey, async () => {
      return this.getMockNewsData(limit).filter(article =>
        article.tags.some(tag =>
          tag.toLowerCase().includes(symbol.toLowerCase()) ||
          symbol.toLowerCase().includes(tag)
        )
      );
    }, 900);
  }

  async getMarketMovingNews(impactThreshold = 7.0) {
    const allNews = await this.getLatestNews(50);
    return allNews
      .filter(article => article.impact >= impactThreshold)
      .sort((a, b) => b.impact - a.impact);
  }

  async getBreakingNews(limit = 15) {
    const cacheKey = `news:breaking:${limit}`;
    return await cache.cacheAPICall(cacheKey, async () => {
      return this.getMockNewsData(limit);
    }, 60);
  }

  async refreshNewsForSymbol(symbol, limit = 10) {
    const cacheKey = `news:symbol:${symbol}:${limit}`;
    await cache.del(cacheKey);
    return this.getNewsBySymbol(symbol, limit);
  }

  async forceRefreshBreaking() {
    await cache.del('news:breaking:15');
    return this.getBreakingNews(15);
  }

  // ──────────────────────────────────────────
  // Utility helpers (used internally + by other services)
  // ──────────────────────────────────────────

  analyzeSentiment(text) {
    const positiveWords = ['gain', 'rise', 'up', 'growth', 'positive', 'surge', 'bull', 'increase'];
    const negativeWords = ['fall', 'drop', 'down', 'decline', 'negative', 'crash', 'bear', 'decrease'];
    const lowerText = text.toLowerCase();
    const positiveCount = positiveWords.filter(w => lowerText.includes(w)).length;
    const negativeCount = negativeWords.filter(w => lowerText.includes(w)).length;
    if (positiveCount > negativeCount) return 'positive';
    if (negativeCount > positiveCount) return 'negative';
    return 'neutral';
  }

  extractTags(text) {
    const keywords = [
      'bitcoin', 'ethereum', 'crypto', 'cryptocurrency',
      'forex', 'trading', 'stocks', 'markets',
      'federal-reserve', 'interest-rates', 'inflation',
      'oil', 'gold', 'commodities', 'technology'
    ];
    const lowerText = text.toLowerCase();
    return keywords.filter(keyword => lowerText.includes(keyword));
  }

  getSymbolKeywords(symbol) {
    const keywordMap = {
      'EUR/USD': 'euro dollar forex',
      'GBP/USD': 'pound sterling forex',
      'BTC': 'bitcoin cryptocurrency',
      'ETH': 'ethereum cryptocurrency',
      'AAPL': 'apple technology',
      'GOOGL': 'google alphabet technology',
      'TSLA': 'tesla electric vehicle',
      'GOLD': 'gold precious metals',
      'OIL': 'oil crude energy'
    };
    return keywordMap[symbol] || symbol;
  }

  getMockNewsData(limit) {
    const shuffled = [...this.mockNews].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(limit, shuffled.length));
  }
}

module.exports = new NewsService();
