/**
 * Marketaux News & Sentiment Service
 *
 * Free tier: ~100 requests/day — cache aggressively!
 * Endpoint: https://api.marketaux.com/v1/news/all
 * Docs: https://www.marketaux.com/documentation
 *
 * Provides:
 *   - News articles with per-entity sentiment scores
 *   - Sentiment summary for a given symbol
 *
 * Cache TTLs:
 *   - News: 15 minutes  (marketaux:news:{symbols}:{limit})
 *   - Sentiment: 1 hour (marketaux:sentiment:{symbol})
 */

const axios = require('axios');
const cache = require('./cache');

const MARKETAUX_BASE = 'https://api.marketaux.com/v1';

class MarketauxService {
  constructor() {
    // Lazy read — env var may not be set at require time (Render, Docker, etc.)
    Object.defineProperty(this, 'apiKey', {
      get() { return process.env.MARKETAUX_API_KEY; },
      configurable: true,
    });
  }

  // ──────────────────────────────────────────
  // News Articles
  // ──────────────────────────────────────────

  /**
   * Fetch news articles with optional symbol filter.
   *
   * @param {object} opts
   * @param {string|string[]} [opts.symbols] - Ticker(s), e.g. 'AAPL' or ['AAPL','TSLA']
   * @param {number} [opts.limit=10]  - Max articles to return (1–50)
   * @param {number} [opts.page=1]    - Page number for pagination
   * @returns {Promise<object[]>} Array of articles in our standard format
   */
  async getNews({ symbols, limit = 10, page = 1 } = {}) {
    // Normalise symbols to a comma-separated string for the cache key
    const symbolsStr = Array.isArray(symbols)
      ? symbols.map(s => s.toUpperCase()).join(',')
      : (symbols ? symbols.toUpperCase() : '');

    const cacheKey = `marketaux:news:${symbolsStr}:${limit}:${page}`;

    return await cache.cacheAPICall(cacheKey, async () => {
      if (!this.apiKey) {
        console.warn('[Marketaux] No API key (MARKETAUX_API_KEY) — skipping');
        return [];
      }

      try {
        const params = {
          filter_entities: true,
          limit,
          page,
          language: 'en',
          api_token: this.apiKey,
        };

        if (symbolsStr) params.symbols = symbolsStr;

        const response = await axios.get(`${MARKETAUX_BASE}/news/all`, {
          params,
          timeout: 10000,
        });

        const articles = response.data?.data;
        if (!Array.isArray(articles)) return [];

        return articles.map(item => this._mapArticle(item));
      } catch (error) {
        if (error.response?.status === 429) {
          console.warn('[Marketaux] Rate limit hit — will rely on cache');
        } else {
          console.error('[Marketaux] getNews error:', error.message);
        }
        return [];
      }
    }, 15 * 60); // 15-minute cache
  }

  // ──────────────────────────────────────────
  // Sentiment Summary
  // ──────────────────────────────────────────

  /**
   * Aggregate sentiment for a symbol based on recent articles.
   *
   * @param {string} symbol - Ticker, e.g. 'AAPL'
   * @returns {Promise<{symbol, score, label, articles}>}
   */
  async getSentiment(symbol) {
    const upperSymbol = symbol.toUpperCase();
    const cacheKey = `marketaux:sentiment:${upperSymbol}`;

    return await cache.cacheAPICall(cacheKey, async () => {
      if (!this.apiKey) {
        console.warn('[Marketaux] No API key — skipping sentiment for', upperSymbol);
        return this._neutralSentiment(upperSymbol);
      }

      try {
        const articles = await this.getNews({ symbols: upperSymbol, limit: 25 });

        if (!articles || articles.length === 0) {
          return this._neutralSentiment(upperSymbol);
        }

        // Only include articles that actually have a sentiment score
        const scored = articles.filter(a => a.sentiment !== null && a.sentiment !== undefined);

        if (scored.length === 0) return this._neutralSentiment(upperSymbol);

        const avgScore = scored.reduce((sum, a) => sum + a.sentiment, 0) / scored.length;
        const label = this._sentimentLabel(avgScore);

        return {
          symbol: upperSymbol,
          score: parseFloat(avgScore.toFixed(4)),
          label,
          articles: scored.length,
        };
      } catch (error) {
        console.error(`[Marketaux] getSentiment error for ${upperSymbol}:`, error.message);
        return this._neutralSentiment(upperSymbol);
      }
    }, 60 * 60); // 1-hour cache
  }

  // ──────────────────────────────────────────
  // Private helpers
  // ──────────────────────────────────────────

  /**
   * Map a raw Marketaux article to our standard article format.
   * Matches the shape used by the Finnhub news methods.
   */
  _mapArticle(item) {
    // Pull the first entity for top-level sentiment fields
    const firstEntity = Array.isArray(item.entities) && item.entities.length > 0
      ? item.entities[0]
      : null;

    // Collect all entity symbols as the "related" list
    const related = Array.isArray(item.entities)
      ? item.entities.map(e => e.symbol).filter(Boolean)
      : [];

    // Convert ISO datetime → Unix timestamp (seconds, like Finnhub)
    let datetime = null;
    if (item.published_at) {
      const parsed = Date.parse(item.published_at);
      datetime = isNaN(parsed) ? null : Math.floor(parsed / 1000);
    }

    return {
      id: item.uuid || item.url || null,
      title: item.title || '',
      summary: item.description || '',
      url: item.url || '#',
      image: item.image_url || null,
      datetime,                                          // Unix timestamp (seconds)
      source: item.source || 'Marketaux',
      related,
      sentiment: firstEntity?.sentiment_score ?? null,   // e.g. 0.78
      sentimentLabel: firstEntity?.sentiment_label || null, // e.g. 'Positive'
      _source: 'marketaux',
    };
  }

  _neutralSentiment(symbol) {
    return { symbol, score: 0, label: 'Neutral', articles: 0 };
  }

  _sentimentLabel(score) {
    if (score >= 0.15) return 'Bullish';
    if (score <= -0.15) return 'Bearish';
    return 'Neutral';
  }
}

module.exports = new MarketauxService();
