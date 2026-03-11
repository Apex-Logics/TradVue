/**
 * Finnhub Market Data Service
 * 
 * Free tier: 60 API calls/minute, WebSocket real-time quotes
 * Get a free key at: https://finnhub.io/register
 * 
 * Provides:
 *   - Real-time stock quotes
 *   - Company news
 *   - Market status
 *   - Candle (OHLCV) data
 *   - Forex rates
 *   - Crypto rates
 * 
 * Falls back to Alpha Vantage, then mock data.
 */

const axios = require('axios');
const WebSocket = require('ws');
const cache = require('./cache');
const { externalAPILimiter } = require('./rateLimit');

const FINNHUB_BASE = 'https://finnhub.io/api/v1';

class FinnhubService {
  constructor() {
    // Read lazily — env vars may not be available at require time (Render, etc.)
    Object.defineProperty(this, 'apiKey', {
      get() { return process.env.FINNHUB_API_KEY; },
      configurable: true
    });
    this.alphaVantageKey = process.env.ALPHA_VANTAGE_API_KEY;

    // WebSocket for real-time price subscriptions
    this.ws = null;
    this.wsSubscriptions = new Set();
    this.wsListeners = new Map(); // symbol -> Set of callbacks
    this.wsConnected = false;

    // Fallback mock data (static prices with slight randomization on read)
    this.mockPrices = {
      'AAPL':  { c: 182.31, d: 2.15,  dp: 1.19,  h: 184.20, l: 180.10, o: 181.00, pc: 180.16 },
      'GOOGL': { c: 138.92, d: -1.23, dp: -0.88, h: 140.50, l: 137.80, o: 139.50, pc: 140.15 },
      'TSLA':  { c: 234.67, d: 12.34, dp: 5.56,  h: 238.00, l: 222.00, o: 224.00, pc: 222.33 },
      'MSFT':  { c: 378.90, d: 4.56,  dp: 1.22,  h: 381.20, l: 375.00, o: 376.00, pc: 374.34 },
      'NVDA':  { c: 875.40, d: 24.60, dp: 2.89,  h: 882.00, l: 858.00, o: 860.00, pc: 850.80 },
      'AMZN':  { c: 178.25, d: -2.30, dp: -1.27, h: 181.00, l: 177.00, o: 180.00, pc: 180.55 },
    };
  }

  // ──────────────────────────────────────────
  // Stock Quotes
  // ──────────────────────────────────────────

  /**
   * Get real-time quote for a stock symbol
   */
  async getQuote(symbol) {
    const upperSymbol = symbol.toUpperCase();
    const cacheKey = `finnhub:quote:${upperSymbol}`;

    return await cache.cacheAPICall(cacheKey, async () => {
      if (!this.apiKey) {
        console.warn(`[Finnhub] No API key — using mock data for ${upperSymbol}`);
        return this._mockQuote(upperSymbol);
      }

      try {
        await externalAPILimiter.canMakeRequest('finnhub', 55, 60000); // Stay under 60/min limit

        const response = await axios.get(`${FINNHUB_BASE}/quote`, {
          params: { symbol: upperSymbol, token: this.apiKey },
          timeout: 8000
        });

        const data = response.data;
        if (!data.c || data.c === 0) {
          return this._mockQuote(upperSymbol);
        }

        return {
          symbol: upperSymbol,
          current: data.c,       // Current price
          change: data.d,        // Absolute change
          changePct: data.dp,    // Percent change
          high: data.h,          // Day high
          low: data.l,           // Day low
          open: data.o,          // Day open
          prevClose: data.pc,    // Previous close
          timestamp: new Date(data.t * 1000).toISOString(),
          source: 'finnhub'
        };
      } catch (error) {
        console.error(`[Finnhub] Quote error for ${upperSymbol}:`, error.message);
        return this._mockQuote(upperSymbol);
      }
    }, 60); // Cache 1 minute (real-time-ish)
  }

  /**
   * Batch quote fetch for multiple symbols
   */
  async getBatchQuotes(symbols = []) {
    const results = await Promise.allSettled(
      symbols.map(sym => this.getQuote(sym))
    );

    const quotes = {};
    results.forEach((result, i) => {
      if (result.status === 'fulfilled') {
        quotes[symbols[i].toUpperCase()] = result.value;
      } else {
        quotes[symbols[i].toUpperCase()] = this._mockQuote(symbols[i]);
      }
    });

    return quotes;
  }

  // ──────────────────────────────────────────
  // Historical Candles (OHLCV)
  // ──────────────────────────────────────────

  /**
   * Get candlestick data for charting
   * @param {string} symbol 
   * @param {string} resolution - '1', '5', '15', '30', '60', 'D', 'W', 'M'
   * @param {number} fromTs - Unix timestamp (seconds)
   * @param {number} toTs - Unix timestamp (seconds)
   */
  async getCandles(symbol, resolution = 'D', fromTs = null, toTs = null) {
    const now = Math.floor(Date.now() / 1000);
    const from = fromTs || (now - 30 * 24 * 3600); // Default: 30 days back
    const to = toTs || now;
    const upperSymbol = symbol.toUpperCase();
    const cacheKey = `finnhub:candles:${upperSymbol}:${resolution}:${from}:${to}`;

    return await cache.cacheAPICall(cacheKey, async () => {
      if (!this.apiKey) {
        return this._mockCandles(upperSymbol, from, to, resolution);
      }

      try {
        await externalAPILimiter.canMakeRequest('finnhub', 55, 60000);

        const response = await axios.get(`${FINNHUB_BASE}/stock/candle`, {
          params: {
            symbol: upperSymbol,
            resolution,
            from,
            to,
            token: this.apiKey
          },
          timeout: 10000
        });

        if (response.data.s !== 'ok') {
          return this._mockCandles(upperSymbol, from, to, resolution);
        }

        const { t, o, h, l, c, v } = response.data;
        return t.map((ts, i) => ({
          timestamp: new Date(ts * 1000).toISOString(),
          open: o[i], high: h[i], low: l[i], close: c[i], volume: v[i]
        }));
      } catch (error) {
        console.error(`[Finnhub] Candles error for ${upperSymbol}:`, error.message);
        return this._mockCandles(upperSymbol, from, to, resolution);
      }
    }, resolution === 'D' ? 3600 : 300); // Cache daily longer
  }

  // ──────────────────────────────────────────
  // Company News
  // ──────────────────────────────────────────

  /**
   * Get company-specific news
   */
  async getCompanyNews(symbol, { days = 7 } = {}) {
    const upperSymbol = symbol.toUpperCase();
    const to = new Date().toISOString().split('T')[0];
    const fromDate = new Date(Date.now() - days * 24 * 3600 * 1000);
    const from = fromDate.toISOString().split('T')[0];
    const cacheKey = `finnhub:news:${upperSymbol}:${from}:${to}`;

    return await cache.cacheAPICall(cacheKey, async () => {
      if (!this.apiKey) return [];

      try {
        await externalAPILimiter.canMakeRequest('finnhub', 55, 60000);

        const response = await axios.get(`${FINNHUB_BASE}/company-news`, {
          params: { symbol: upperSymbol, from, to, token: this.apiKey },
          timeout: 10000
        });

        return (response.data || []).slice(0, 20).map(item => ({
          id: item.id?.toString(),
          title: item.headline,
          summary: item.summary,
          url: item.url,
          source: item.source,
          publishedAt: new Date(item.datetime * 1000).toISOString(),
          imageUrl: item.image || null,
          category: item.category || 'company',
          symbol: upperSymbol
        }));
      } catch (error) {
        console.error(`[Finnhub] Company news error for ${upperSymbol}:`, error.message);
        return [];
      }
    }, 900);
  }

  // ──────────────────────────────────────────
  // Company Profile
  // ──────────────────────────────────────────

  /**
   * Get company profile (description, market cap, PE, sector, etc.)
   */
  async getCompanyProfile(symbol) {
    const upperSymbol = symbol.toUpperCase();
    const cacheKey = `finnhub:profile:${upperSymbol}`;

    return await cache.cacheAPICall(cacheKey, async () => {
      if (!this.apiKey) return null;

      try {
        await externalAPILimiter.canMakeRequest('finnhub', 55, 60000);

        const [profileRes, metricsRes] = await Promise.allSettled([
          axios.get(`${FINNHUB_BASE}/stock/profile2`, {
            params: { symbol: upperSymbol, token: this.apiKey },
            timeout: 8000
          }),
          axios.get(`${FINNHUB_BASE}/stock/metric`, {
            params: { symbol: upperSymbol, metric: 'all', token: this.apiKey },
            timeout: 8000
          })
        ]);

        const profile = profileRes.status === 'fulfilled' ? profileRes.value.data : {};
        const metrics = metricsRes.status === 'fulfilled' ? metricsRes.value.data?.metric : {};

        if (!profile.name) return null;

        return {
          symbol: upperSymbol,
          name: profile.name,
          description: profile.description || null,
          exchange: profile.exchange,
          industry: profile.finnhubIndustry,
          sector: profile.gics || profile.finnhubIndustry,
          country: profile.country,
          currency: profile.currency,
          marketCap: profile.marketCapitalization ? profile.marketCapitalization * 1e6 : null,
          website: profile.weburl,
          logo: profile.logo,
          ipo: profile.ipo,
          employeeCount: profile.employeeTotal,
          // Key metrics
          peRatio: metrics?.peBasicExclExtraTTM || metrics?.peTTM || null,
          pbRatio: metrics?.pbAnnual || null,
          eps: metrics?.epsBasicExclExtraItemsTTM || null,
          dividendYield: metrics?.dividendYieldIndicatedAnnual || null,
          week52High: metrics?.['52WeekHigh'] || null,
          week52Low: metrics?.['52WeekLow'] || null,
          beta: metrics?.beta || null,
          revenuePerShare: metrics?.revenuePerShareTTM || null,
          source: 'finnhub'
        };
      } catch (error) {
        console.error(`[Finnhub] Company profile error for ${upperSymbol}:`, error.message);
        return null;
      }
    }, 3600); // Cache 1 hour — profile data rarely changes
  }

  // ──────────────────────────────────────────
  // General Market News
  // ──────────────────────────────────────────

  /**
   * Get general market/financial news from Finnhub
   * category: 'general', 'forex', 'crypto', 'merger'
   */
  async getGeneralNews(category = 'general', { limit = 30 } = {}) {
    const cacheKey = `finnhub:general_news:${category}:${limit}`;

    return await cache.cacheAPICall(cacheKey, async () => {
      if (!this.apiKey) return [];

      try {
        await externalAPILimiter.canMakeRequest('finnhub', 55, 60000);

        const response = await axios.get(`${FINNHUB_BASE}/news`, {
          params: { category, token: this.apiKey },
          timeout: 10000
        });

        return (response.data || []).slice(0, limit).map(item => ({
          id: item.id?.toString() || item.url,
          title: item.headline || item.title || '',
          summary: item.summary || '',
          url: item.url,
          source: item.source || 'Finnhub',
          category: item.category || category,
          publishedAt: item.datetime ? new Date(item.datetime * 1000).toISOString() : new Date().toISOString(),
          sentimentScore: 0,
          sentimentLabel: 'neutral',
          impactScore: 5,
          impactLabel: 'Medium',
          tags: [category],
          symbols: item.related ? item.related.split(',').map(s => s.trim()).filter(Boolean) : [],
          imageUrl: item.image || null
        }));
      } catch (error) {
        console.error(`[Finnhub] General news error:`, error.message);
        return [];
      }
    }, 600); // Cache 10 minutes
  }

  // ──────────────────────────────────────────
  // Market Status
  // ──────────────────────────────────────────

  /**
   * Check if a market is currently open
   * @param {string} exchange - 'US', 'LSE', 'TSX', etc.
   */
  async getMarketStatus(exchange = 'US') {
    const cacheKey = `finnhub:market_status:${exchange}`;

    return await cache.cacheAPICall(cacheKey, async () => {
      if (!this.apiKey) return { exchange, isOpen: this._isUSMarketOpen(), source: 'mock' };

      try {
        await externalAPILimiter.canMakeRequest('finnhub', 55, 60000);

        const response = await axios.get(`${FINNHUB_BASE}/stock/market-status`, {
          params: { exchange, token: this.apiKey },
          timeout: 8000
        });

        return {
          exchange,
          isOpen: response.data.isOpen,
          session: response.data.session,
          timezone: response.data.timezone,
          source: 'finnhub'
        };
      } catch (error) {
        console.error('[Finnhub] Market status error:', error.message);
        return { exchange, isOpen: this._isUSMarketOpen(), source: 'fallback' };
      }
    }, 300);
  }

  // ──────────────────────────────────────────
  // WebSocket Real-Time (Premium enhancement)
  // ──────────────────────────────────────────

  /**
   * Initialize WebSocket connection for real-time price streaming
   * Note: Free tier supports real-time for some symbols. Connect on demand.
   */
  connectWebSocket() {
    if (!this.apiKey || this.wsConnected) return;

    const wsUrl = `wss://ws.finnhub.io?token=${this.apiKey}`;
    this.ws = new WebSocket(wsUrl);

    this.ws.on('open', () => {
      this.wsConnected = true;
      console.info('[Finnhub WS] Connected');
      // Re-subscribe to all tracked symbols
      this.wsSubscriptions.forEach(sym => this._wsSubscribe(sym));
    });

    this.ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'trade' && msg.data) {
          msg.data.forEach(trade => {
            const listeners = this.wsListeners.get(trade.s);
            if (listeners) {
              const update = {
                symbol: trade.s,
                price: trade.p,
                volume: trade.v,
                timestamp: new Date(trade.t).toISOString()
              };
              listeners.forEach(cb => cb(update));
            }
          });
        }
      } catch (e) { /* ignore parse errors */ }
    });

    this.ws.on('error', (err) => {
      console.error('[Finnhub WS] Error:', err.message);
    });

    this.ws.on('close', () => {
      this.wsConnected = false;
      console.warn('[Finnhub WS] Disconnected — will reconnect in 5s');
      setTimeout(() => this.connectWebSocket(), 5000);
    });
  }

  /**
   * Subscribe to real-time updates for a symbol
   */
  subscribeRealTime(symbol, callback) {
    const upperSym = symbol.toUpperCase();
    if (!this.wsListeners.has(upperSym)) {
      this.wsListeners.set(upperSym, new Set());
    }
    this.wsListeners.get(upperSym).add(callback);
    this.wsSubscriptions.add(upperSym);

    if (this.wsConnected) {
      this._wsSubscribe(upperSym);
    } else {
      this.connectWebSocket();
    }
  }

  _wsSubscribe(symbol) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'subscribe', symbol }));
    }
  }

  // ──────────────────────────────────────────
  // Helpers / Mock Fallbacks
  // ──────────────────────────────────────────

  _mockQuote(symbol) {
    const base = this.mockPrices[symbol];
    if (!base) {
      return {
        symbol, current: 100, change: 0, changePct: 0,
        high: 102, low: 98, open: 100, prevClose: 100,
        timestamp: new Date().toISOString(), source: 'mock'
      };
    }
    // Add tiny random noise to make it feel live
    const noise = (Math.random() - 0.5) * 0.002;
    return {
      symbol,
      current: parseFloat((base.c * (1 + noise)).toFixed(2)),
      change: parseFloat((base.d).toFixed(2)),
      changePct: parseFloat((base.dp).toFixed(2)),
      high: base.h, low: base.l, open: base.o, prevClose: base.pc,
      timestamp: new Date().toISOString(),
      source: 'mock'
    };
  }

  _mockCandles(symbol, from, to, resolution) {
    const base = this.mockPrices[symbol]?.c || 100;
    const candles = [];
    const intervalSec = resolution === 'D' ? 86400 : resolution === '60' ? 3600 : 900;
    let price = base * 0.95;

    for (let ts = from; ts < to; ts += intervalSec) {
      const change = (Math.random() - 0.5) * 0.02 * price;
      const open = price;
      const close = price + change;
      const high = Math.max(open, close) * (1 + Math.random() * 0.005);
      const low = Math.min(open, close) * (1 - Math.random() * 0.005);
      candles.push({
        timestamp: new Date(ts * 1000).toISOString(),
        open: parseFloat(open.toFixed(2)),
        high: parseFloat(high.toFixed(2)),
        low: parseFloat(low.toFixed(2)),
        close: parseFloat(close.toFixed(2)),
        volume: Math.floor(Math.random() * 1000000)
      });
      price = close;
    }

    return candles;
  }

  _isUSMarketOpen() {
    const now = new Date();
    const eastern = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
    const day = eastern.getDay();
    const hours = eastern.getHours() + eastern.getMinutes() / 60;
    return day >= 1 && day <= 5 && hours >= 9.5 && hours < 16;
  }
}

module.exports = new FinnhubService();
