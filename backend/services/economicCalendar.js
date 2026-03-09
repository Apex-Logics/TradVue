/**
 * Economic Calendar Service
 * 
 * Sources:
 *   1. ForexFactory RSS feed (unofficial, but reliable for forex traders)
 *   2. FRED (Federal Reserve Economic Data) - free, official
 *   3. Investing.com RSS calendar feed
 * 
 * Falls back to curated mock data when external feeds are unavailable.
 */

const axios = require('axios');
const RSSParser = require('rss-parser');
const cache = require('./cache');

const parser = new RSSParser({
  customFields: {
    item: [
      ['category', 'category'],
      ['impact', 'impact'],
      ['currency', 'currency'],
      ['actual', 'actual'],
      ['forecast', 'forecast'],
      ['previous', 'previous'],
    ]
  },
  timeout: 10000,
  headers: {
    'User-Agent': 'TradVue/1.0 (tradvue.io; economic-calendar-bot)'
  }
});

// Impact level normalization
const IMPACT_MAP = {
  high: 3, medium: 2, low: 1,
  'High': 3, 'Medium': 2, 'Low': 1,
  '3': 3, '2': 2, '1': 1
};

class EconomicCalendarService {
  constructor() {
    this.fredApiKey = process.env.FRED_API_KEY; // Free at fred.stlouisfed.org

    // RSS / iCal sources (free, no key needed)
    this.feedSources = [
      {
        name: 'ForexFactory',
        url: 'https://nfs.faireconomy.media/ff_calendar_thisweek.xml',
        parser: 'forexfactory',
        priority: 1
      },
      {
        name: 'FXStreet',
        url: 'https://www.fxstreet.com/rss/economic-calendar',
        parser: 'generic',
        priority: 2
      }
    ];

    // Curated mock events for fallback — realistic economic calendar structure
    this.mockEvents = this._buildMockEvents();
  }

  /**
   * Get upcoming economic events for the current week
   */
  async getUpcomingEvents({ days = 7, currencies = null, minImpact = 1 } = {}) {
    const cacheKey = `calendar:upcoming:${days}:${currencies?.join(',') || 'all'}:${minImpact}`;

    return await cache.cacheAPICall(cacheKey, async () => {
      const events = await this._fetchFromForexFactory();

      const cutoff = new Date(Date.now() + days * 24 * 3600 * 1000);
      const now = new Date();

      let filtered = events.filter(e => {
        const eventTime = new Date(e.datetime);
        return eventTime >= now && eventTime <= cutoff && e.impact >= minImpact;
      });

      if (currencies && currencies.length > 0) {
        filtered = filtered.filter(e =>
          currencies.map(c => c.toUpperCase()).includes(e.currency.toUpperCase())
        );
      }

      return filtered.sort((a, b) => new Date(a.datetime) - new Date(b.datetime));
    }, 1800); // Cache 30 minutes — calendar changes infrequently
  }

  /**
   * Get high-impact events only (impact level 3)
   */
  async getHighImpactEvents({ days = 7 } = {}) {
    return this.getUpcomingEvents({ days, minImpact: 3 });
  }

  /**
   * Get today's events
   */
  async getTodaysEvents({ currencies = null } = {}) {
    const cacheKey = `calendar:today:${currencies?.join(',') || 'all'}`;

    return await cache.cacheAPICall(cacheKey, async () => {
      const events = await this._fetchFromForexFactory();

      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const endOfDay = new Date(startOfDay.getTime() + 24 * 3600 * 1000);

      let filtered = events.filter(e => {
        const t = new Date(e.datetime);
        return t >= startOfDay && t < endOfDay;
      });

      if (currencies?.length) {
        filtered = filtered.filter(e =>
          currencies.map(c => c.toUpperCase()).includes(e.currency.toUpperCase())
        );
      }

      return filtered.sort((a, b) => new Date(a.datetime) - new Date(b.datetime));
    }, 900); // Cache 15 minutes for today's events
  }

  /**
   * Fetch from ForexFactory's public XML feed
   */
  async _fetchFromForexFactory() {
    try {
      const feed = await parser.parseURL(this.feedSources[0].url);

      if (!feed.items || feed.items.length === 0) {
        console.warn('[EconCal] ForexFactory returned empty feed, using mock data');
        return this.mockEvents;
      }

      return feed.items.map(item => this._normalizeForexFactoryItem(item));
    } catch (error) {
      console.warn(`[EconCal] ForexFactory fetch failed: ${error.message} — using mock data`);
      return this.mockEvents;
    }
  }

  /**
   * Normalize ForexFactory XML item to our standard event schema
   */
  _normalizeForexFactoryItem(item) {
    const impact = IMPACT_MAP[item.impact] || IMPACT_MAP[item.category] || 1;
    const currency = item.currency || item.title?.match(/\b(USD|EUR|GBP|JPY|CHF|CAD|AUD|NZD)\b/)?.[1] || 'USD';

    return {
      id: item.guid || item.link || `${Date.now()}-${Math.random()}`,
      title: item.title || 'Economic Event',
      currency,
      impact, // 1=low, 2=medium, 3=high
      impactLabel: ['', 'Low', 'Medium', 'High'][impact],
      datetime: item.isoDate || item.pubDate || new Date().toISOString(),
      actual: item.actual || null,
      forecast: item.forecast || null,
      previous: item.previous || null,
      description: item.contentSnippet || item.content || '',
      source: 'ForexFactory',
      url: item.link || null
    };
  }

  /**
   * Fetch key US economic indicators from FRED (free, no rate limit concerns)
   * Great for: CPI, NFP, GDP, Fed Funds Rate, Unemployment
   */
  async getFREDIndicator(seriesId, { limit = 10 } = {}) {
    if (!this.fredApiKey) {
      console.warn('[EconCal] No FRED API key — get one free at fred.stlouisfed.org');
      return null;
    }

    const cacheKey = `fred:${seriesId}:${limit}`;
    return await cache.cacheAPICall(cacheKey, async () => {
      const response = await axios.get('https://api.stlouisfed.org/fred/series/observations', {
        params: {
          series_id: seriesId,
          api_key: this.fredApiKey,
          file_type: 'json',
          limit,
          sort_order: 'desc'
        },
        timeout: 10000
      });

      return response.data.observations?.map(obs => ({
        date: obs.date,
        value: obs.value === '.' ? null : parseFloat(obs.value),
        series: seriesId
      })) || [];
    }, 3600); // Cache 1 hour — FRED data doesn't change that often
  }

  /**
   * Get key macro indicator bundle (useful for AI context)
   */
  async getMacroSnapshot() {
    const cacheKey = 'calendar:macro_snapshot';
    return await cache.cacheAPICall(cacheKey, async () => {
      const indicators = {};

      if (this.fredApiKey) {
        const [cpi, unemployment, fedFunds] = await Promise.allSettled([
          this.getFREDIndicator('CPIAUCSL', { limit: 3 }),  // CPI
          this.getFREDIndicator('UNRATE', { limit: 3 }),     // Unemployment
          this.getFREDIndicator('FEDFUNDS', { limit: 3 })    // Fed Funds Rate
        ]);

        indicators.cpi = cpi.status === 'fulfilled' ? cpi.value : null;
        indicators.unemployment = unemployment.status === 'fulfilled' ? unemployment.value : null;
        indicators.fedFunds = fedFunds.status === 'fulfilled' ? fedFunds.value : null;
      }

      // Always include upcoming high-impact events
      indicators.upcomingHighImpact = await this.getHighImpactEvents({ days: 3 });

      return {
        indicators,
        lastUpdated: new Date().toISOString()
      };
    }, 3600);
  }

  _buildMockEvents() {
    const now = new Date();
    const addHours = (h) => new Date(now.getTime() + h * 3600 * 1000).toISOString();

    return [
      {
        id: 'mock-1', title: 'Non-Farm Payrolls', currency: 'USD', impact: 3,
        impactLabel: 'High', datetime: addHours(6), actual: null,
        forecast: '195K', previous: '187K', source: 'Mock', url: null
      },
      {
        id: 'mock-2', title: 'CPI (MoM)', currency: 'USD', impact: 3,
        impactLabel: 'High', datetime: addHours(24), actual: null,
        forecast: '0.3%', previous: '0.4%', source: 'Mock', url: null
      },
      {
        id: 'mock-3', title: 'ECB Interest Rate Decision', currency: 'EUR', impact: 3,
        impactLabel: 'High', datetime: addHours(48), actual: null,
        forecast: '4.50%', previous: '4.50%', source: 'Mock', url: null
      },
      {
        id: 'mock-4', title: 'Unemployment Claims', currency: 'USD', impact: 2,
        impactLabel: 'Medium', datetime: addHours(30), actual: null,
        forecast: '215K', previous: '220K', source: 'Mock', url: null
      },
      {
        id: 'mock-5', title: 'GDP (QoQ)', currency: 'USD', impact: 3,
        impactLabel: 'High', datetime: addHours(72), actual: null,
        forecast: '2.4%', previous: '2.1%', source: 'Mock', url: null
      },
      {
        id: 'mock-6', title: 'BOE Rate Decision', currency: 'GBP', impact: 3,
        impactLabel: 'High', datetime: addHours(96), actual: null,
        forecast: '5.25%', previous: '5.25%', source: 'Mock', url: null
      },
      {
        id: 'mock-7', title: 'ISM Manufacturing PMI', currency: 'USD', impact: 2,
        impactLabel: 'Medium', datetime: addHours(12), actual: null,
        forecast: '48.5', previous: '47.8', source: 'Mock', url: null
      }
    ];
  }
}

module.exports = new EconomicCalendarService();
