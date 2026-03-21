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
const alpacaService = require('./alpaca');

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
   * Get real-time quote for a stock symbol.
   * Routes forex pairs to getForexQuote() and VIX to getVixQuote()
   * before hitting Finnhub (free tier doesn't support those).
   */
  async getQuote(symbol) {
    const upperSymbol = symbol.toUpperCase();

    // ── Special routing ──────────────────────────────────────────────────────

    // Index symbols → ETF equivalents (Finnhub free tier doesn't support indices)
    const INDEX_TO_ETF = {
      'DJI': 'DIA', '^DJI': 'DIA', '.DJI': 'DIA', 'DJIA': 'DIA',
      'IXIC': 'QQQ', '^IXIC': 'QQQ', 'COMP': 'QQQ', 'NDX': 'QQQ',
      'GSPC': 'SPY', '^GSPC': 'SPY', 'SPX': 'SPY',
      'RUT': 'IWM', '^RUT': 'IWM',
      'TNX': 'TLT', '^TNX': 'TLT',
    };
    if (INDEX_TO_ETF[upperSymbol]) {
      const etf = INDEX_TO_ETF[upperSymbol];
      const quote = await this.getQuote(etf);
      return { ...quote, symbol: upperSymbol, _mappedFrom: etf };
    }

    if (this._isForexSymbol(upperSymbol)) {
      return this.getForexQuote(upperSymbol);
    }
    if (upperSymbol === 'VIX' || upperSymbol === '^VIX') {
      return this.getVixQuote();
    }
    // ────────────────────────────────────────────────────────────────────────

    const cacheKey = `finnhub:quote:${upperSymbol}`;

    return await cache.cacheAPICall(cacheKey, async () => {
      // ── Try Alpaca first for US equity symbols ──────────────────────────
      // Alpaca doesn't support forex pairs, crypto, or VIX — those stay on Finnhub.
      if (alpacaService.constructor.isStockSymbol(upperSymbol)) {
        try {
          const alpacaQuote = await alpacaService.getQuote(upperSymbol);
          if (alpacaQuote && alpacaQuote.current != null) {
            return alpacaQuote; // cacheAPICall will store this under finnhub:quote:SYM
          }
          console.warn(`[Finnhub] Alpaca returned no data for ${upperSymbol}, falling back to Finnhub`);
        } catch (alpacaErr) {
          console.warn(`[Finnhub] Alpaca error for ${upperSymbol}, falling back to Finnhub:`, alpacaErr.message);
        }
      }
      // ── Fallback: Finnhub ───────────────────────────────────────────────

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
   * Detect if a symbol is a forex pair (e.g. EURUSD, GBPUSD, USDJPY).
   * Matches exactly 6 uppercase letters that look like two 3-letter currency codes.
   */
  _isForexSymbol(symbol) {
    const CURRENCIES = new Set([
      'USD','EUR','GBP','JPY','CAD','AUD','CHF','NZD','CNY','HKD',
      'SEK','NOK','DKK','SGD','MXN','ZAR','BRL','INR','RUB','TRY',
    ]);
    if (!/^[A-Z]{6}$/.test(symbol)) return false;
    const base = symbol.slice(0, 3);
    const quote = symbol.slice(3, 6);
    return CURRENCIES.has(base) && CURRENCIES.has(quote);
  }

  /**
   * Fetch forex exchange rate using the free open.er-api.com (no key required).
   * Caches for 60 seconds.
   */
  async getForexQuote(pair) {
    const upperPair = pair.toUpperCase();
    const cacheKey = `forex:quote:${upperPair}`;

    return await cache.cacheAPICall(cacheKey, async () => {
      const base = upperPair.slice(0, 3);
      const quote = upperPair.slice(3, 6);

      try {
        const response = await axios.get(`https://open.er-api.com/v6/latest/${base}`, {
          timeout: 8000
        });

        const rates = response.data?.rates;
        if (!rates || !rates[quote]) {
          console.warn(`[Forex] Rate not found for ${upperPair}`);
          return this._naQuote(upperPair);
        }

        const current = rates[quote];
        // Derive a rough change from USD baseline (open.er-api doesn't give daily change)
        return {
          symbol: upperPair,
          current,
          change: 0,
          changePct: 0,
          high: current,
          low: current,
          open: current,
          prevClose: current,
          timestamp: new Date().toISOString(),
          source: 'open.er-api'
        };
      } catch (error) {
        console.error(`[Forex] Quote error for ${upperPair}:`, error.message);
        return this._naQuote(upperPair);
      }
    }, 60); // Cache 60 seconds
  }

  /**
   * Fetch VIX from Yahoo Finance's free chart endpoint.
   * Falls back to "N/A" instead of the misleading $100 mock.
   */
  async getVixQuote() {
    const cacheKey = 'vix:quote';

    return await cache.cacheAPICall(cacheKey, async () => {
      try {
        const response = await axios.get(
          'https://query1.finance.yahoo.com/v8/finance/chart/%5EVIX',
          {
            params: { range: '1d', interval: '1m' },
            timeout: 8000,
            headers: { 'User-Agent': 'Mozilla/5.0' }
          }
        );

        const result = response.data?.chart?.result?.[0];
        const meta = result?.meta;
        if (!meta || !meta.regularMarketPrice) {
          return this._naQuote('VIX');
        }

        const current = meta.regularMarketPrice;
        const prevClose = meta.chartPreviousClose || meta.previousClose || current;
        const change = current - prevClose;
        const changePct = prevClose > 0 ? (change / prevClose) * 100 : 0;

        return {
          symbol: 'VIX',
          current,
          change: parseFloat(change.toFixed(2)),
          changePct: parseFloat(changePct.toFixed(2)),
          high: meta.regularMarketDayHigh || current,
          low: meta.regularMarketDayLow || current,
          open: meta.regularMarketOpen || current,
          prevClose,
          timestamp: new Date().toISOString(),
          source: 'yahoo'
        };
      } catch (error) {
        console.error('[VIX] Quote error:', error.message);
        // Try fallback with different Yahoo endpoint
        try {
          const r2 = await axios.get(
            'https://query2.finance.yahoo.com/v8/finance/chart/%5EVIX',
            { params: { range: '1d', interval: '5m' }, timeout: 6000, headers: { 'User-Agent': 'Mozilla/5.0' } }
          );
          const meta2 = r2.data?.chart?.result?.[0]?.meta;
          if (meta2?.regularMarketPrice) {
            const current = meta2.regularMarketPrice;
            const prevClose = meta2.chartPreviousClose || current;
            return {
              symbol: 'VIX', current,
              change: parseFloat((current - prevClose).toFixed(2)),
              changePct: parseFloat((prevClose > 0 ? ((current - prevClose) / prevClose) * 100 : 0).toFixed(2)),
              high: meta2.regularMarketDayHigh || current,
              low: meta2.regularMarketDayLow || current,
              open: meta2.regularMarketOpen || current,
              prevClose,
              timestamp: new Date().toISOString(),
              source: 'yahoo2'
            };
          }
        } catch (_) { /* ignore second fallback failure */ }
        return this._naQuote('VIX');
      }
    }, 60); // Cache 60 seconds
  }

  /**
   * Return an "N/A" quote object instead of a misleading $100 mock.
   */
  _naQuote(symbol) {
    return {
      symbol,
      current: null,
      change: null,
      changePct: null,
      high: null,
      low: null,
      open: null,
      prevClose: null,
      timestamp: new Date().toISOString(),
      source: 'n/a'
    };
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
      // Return null values instead of fake $100 — frontend should show "N/A"
      return {
        symbol, current: null, change: null, changePct: null,
        high: null, low: null, open: null, prevClose: null,
        timestamp: new Date().toISOString(), source: 'unavailable'
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

  // ──────────────────────────────────────────
  // Insider Transactions (Form 4 via Finnhub)
  // ──────────────────────────────────────────

  /**
   * Get insider transactions for a symbol.
   * Cache: 30 minutes
   */
  async getInsiderTransactions(symbol) {
    const upperSymbol = symbol.toUpperCase();
    const cacheKey = `finnhub:insider_transactions:${upperSymbol}`;

    return await cache.cacheAPICall(cacheKey, async () => {
      if (!this.apiKey) return { symbol: upperSymbol, data: [], source: 'finnhub' };

      try {
        await externalAPILimiter.canMakeRequest('finnhub', 55, 60000);

        const response = await axios.get(`${FINNHUB_BASE}/stock/insider-transactions`, {
          params: { symbol: upperSymbol, token: this.apiKey },
          timeout: 10000
        });

        const transactions = (response.data?.data || []).map(t => ({
          symbol: upperSymbol,
          name: t.name || '',
          share: t.share || 0,
          change: t.change || 0,
          filingDate: t.filingDate || null,
          transactionDate: t.transactionDate || null,
          transactionCode: t.transactionCode || '',
          transactionType: t.transactionCode === 'P' ? 'Buy' :
                           t.transactionCode === 'S' ? 'Sell' :
                           t.transactionCode === 'A' ? 'Award' : t.transactionCode || 'Other',
          value: t.share && t.change ? Math.abs(t.change * (t.share / Math.abs(t.share || 1))) : null,
          source: 'finnhub'
        }));

        return { symbol: upperSymbol, data: transactions, source: 'finnhub' };
      } catch (error) {
        console.error(`[Finnhub] Insider transactions error for ${upperSymbol}:`, error.message);
        return { symbol: upperSymbol, data: [], source: 'finnhub', error: error.message };
      }
    }, 5 * 60 * 60); // 5 hour cache — insider data changes slowly
  }

  // ──────────────────────────────────────────
  // Earnings Calendar
  // ──────────────────────────────────────────

  /**
   * Get earnings calendar for a date range.
   * Cache: 1 hour
   */
  async getEarningsCalendar({ from = null, to = null } = {}) {
    const today = new Date();
    const nextWeek = new Date(today.getTime() + 7 * 24 * 3600 * 1000);
    const fromDate = from || today.toISOString().split('T')[0];
    const toDate = to || nextWeek.toISOString().split('T')[0];
    const cacheKey = `finnhub:earnings_calendar:${fromDate}:${toDate}`;

    return await cache.cacheAPICall(cacheKey, async () => {
      if (!this.apiKey) return { earningsCalendar: [], source: 'finnhub' };

      try {
        await externalAPILimiter.canMakeRequest('finnhub', 55, 60000);

        const response = await axios.get(`${FINNHUB_BASE}/calendar/earnings`, {
          params: { from: fromDate, to: toDate, token: this.apiKey },
          timeout: 10000
        });

        const earnings = (response.data?.earningsCalendar || []).map(e => ({
          symbol: e.symbol || '',
          date: e.date || '',
          hour: e.hour || '',
          epsEstimate: e.epsEstimate || null,
          epsActual: e.epsActual || null,
          revenueEstimate: e.revenueEstimate || null,
          revenueActual: e.revenueActual || null,
          year: e.year || null,
          quarter: e.quarter || null,
          source: 'finnhub'
        }));

        return { earningsCalendar: earnings, from: fromDate, to: toDate, source: 'finnhub' };
      } catch (error) {
        console.error('[Finnhub] Earnings calendar error:', error.message);
        return { earningsCalendar: [], source: 'finnhub', error: error.message };
      }
    }, 60 * 60); // 1 hour cache
  }

  // ──────────────────────────────────────────
  // IPO Calendar
  // ──────────────────────────────────────────

  /**
   * Get upcoming IPO calendar for a date range.
   * Cache: 1 hour
   */
  async getIPOCalendar({ from = null, to = null } = {}) {
    const today = new Date();
    const nextWeek = new Date(today.getTime() + 7 * 24 * 3600 * 1000);
    const fromDate = from || today.toISOString().split('T')[0];
    const toDate = to || nextWeek.toISOString().split('T')[0];
    const cacheKey = `finnhub:ipo_calendar:${fromDate}:${toDate}`;

    return await cache.cacheAPICall(cacheKey, async () => {
      if (!this.apiKey) return { ipoCalendar: [], source: 'finnhub' };

      try {
        await externalAPILimiter.canMakeRequest('finnhub', 55, 60000);

        const response = await axios.get(`${FINNHUB_BASE}/calendar/ipo`, {
          params: { from: fromDate, to: toDate, token: this.apiKey },
          timeout: 10000
        });

        const ipos = (response.data?.ipoCalendar || []).map(ipo => ({
          symbol: ipo.symbol || '',
          name: ipo.name || '',
          date: ipo.date || '',
          price: ipo.price || null,
          status: ipo.status || '',
          numberOfShares: ipo.numberOfShares || null,
          totalSharesValue: ipo.totalSharesValue || null,
          exchange: ipo.exchange || '',
          source: 'finnhub'
        }));

        return { ipoCalendar: ipos, from: fromDate, to: toDate, source: 'finnhub' };
      } catch (error) {
        console.error('[Finnhub] IPO calendar error:', error.message);
        return { ipoCalendar: [], source: 'finnhub', error: error.message };
      }
    }, 60 * 60); // 1 hour cache
  }

  // ──────────────────────────────────────────
  // SEC Filings (via Finnhub)
  // ──────────────────────────────────────────

  /**
   * Get SEC filings for a symbol via Finnhub.
   * Cache: 30 minutes
   */
  async getSECFilings(symbol) {
    const upperSymbol = symbol.toUpperCase();
    const cacheKey = `finnhub:sec_filings:${upperSymbol}`;

    return await cache.cacheAPICall(cacheKey, async () => {
      if (!this.apiKey) return [];

      try {
        await externalAPILimiter.canMakeRequest('finnhub', 55, 60000);

        const response = await axios.get(`${FINNHUB_BASE}/stock/filings`, {
          params: { symbol: upperSymbol, token: this.apiKey },
          timeout: 10000
        });

        return (response.data || []).map(f => ({
          symbol: upperSymbol,
          accessNumber: f.accessNumber || '',
          filedDate: f.filedDate || '',
          acceptedDate: f.acceptedDate || '',
          reportType: f.form || '',
          url: f.reportUrl || '',
          name: f.name || '',
          source: 'finnhub'
        }));
      } catch (error) {
        console.error(`[Finnhub] SEC filings error for ${upperSymbol}:`, error.message);
        return [];
      }
    }, 30 * 60); // 30 min cache
  }



}

module.exports = new FinnhubService();
