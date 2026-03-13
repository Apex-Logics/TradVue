/**
 * Alpaca Market Data Service
 *
 * Primary market data source for US equities.
 * Finnhub is the fallback for anything Alpaca doesn't cover (forex, crypto, VIX).
 *
 * Free tier endpoints used:
 *   Snapshots (batch):  GET /v2/stocks/snapshots?symbols=AAPL,TSLA,...
 *   Bars (candles):     GET /v2/stocks/{symbol}/bars?timeframe=1Day&start=...&end=...
 *
 * API keys are read lazily from env vars so Render lazy-loading works correctly.
 */

'use strict';

const axios = require('axios');
const cache = require('./cache');

const ALPACA_DATA_BASE = 'https://data.alpaca.markets/v2';

/** Cache TTL in seconds — matches Finnhub's 60-second TTL so keys are interchangeable. */
const QUOTE_CACHE_TTL = 60;

/** Cache key prefix — intentionally matches Finnhub's prefix so the rest of the system
 *  doesn't know or care which source populated the cache. */
const QUOTE_CACHE_PREFIX = 'finnhub:quote:';

class AlpacaService {
  // ── Lazy credential access (supports Render lazy env var loading) ──────────

  get apiKey() { return process.env.ALPACA_API_KEY; }
  get secretKey() { return process.env.ALPACA_SECRET_KEY; }

  get _headers() {
    return {
      'APCA-API-KEY-ID':     this.apiKey,
      'APCA-API-SECRET-KEY': this.secretKey,
    };
  }

  // ── Public interface ───────────────────────────────────────────────────────

  /**
   * Get real-time quote for a single stock symbol.
   *
   * Uses the batch snapshot endpoint internally (same data, same cost) so we
   * get the full day bars needed to compute open/high/low/prevClose.
   *
   * Returns the same shape as finnhub.getQuote() so it's a drop-in source.
   * Does NOT cache — the caller (finnhub.getQuote via cacheAPICall) handles that.
   *
   * @param {string} symbol - e.g. 'AAPL'
   * @returns {Promise<object|null>} Finnhub-compatible quote or null on failure
   */
  async getQuote(symbol) {
    const upperSymbol = symbol.toUpperCase();

    if (!this.apiKey || !this.secretKey) {
      console.warn(`[Alpaca] No credentials — skipping single quote for ${upperSymbol}`);
      return null;
    }

    try {
      const response = await axios.get(`${ALPACA_DATA_BASE}/stocks/snapshots`, {
        headers: this._headers,
        params:  { symbols: upperSymbol },
        timeout: 8000,
      });

      const snap = response.data?.[upperSymbol];
      if (!snap) {
        console.warn(`[Alpaca] No snapshot data for ${upperSymbol}`);
        return null;
      }

      return this._mapSnapshot(upperSymbol, snap);
    } catch (err) {
      const status = err.response?.status;
      console.warn(`[Alpaca] getQuote ${upperSymbol} failed (HTTP ${status ?? 'N/A'}):`, err.message);
      return null;
    }
  }

  /**
   * Fetch quotes for multiple stock symbols in a SINGLE Alpaca API call.
   *
   * This is the efficiency win over Finnhub — one HTTP request for all symbols
   * instead of N separate calls.
   *
   * Results are cached under `finnhub:quote:SYM` (60 s TTL) so the rest of the
   * system (routes, prefetcher) gets a cache hit on the next request.
   *
   * @param {string[]} symbols - e.g. ['SPY', 'AAPL', 'TSLA']
   * @returns {Promise<Record<string, object>>} Map of SYMBOL → quote object
   */
  async getBatchQuotes(symbols = []) {
    if (!symbols.length) return {};

    // Deduplicate and uppercase
    const upperSymbols = [...new Set(symbols.map(s => s.toUpperCase()))];

    if (!this.apiKey || !this.secretKey) {
      console.warn('[Alpaca] No credentials — skipping batch quote fetch');
      return {};
    }

    try {
      const response = await axios.get(`${ALPACA_DATA_BASE}/stocks/snapshots`, {
        headers: this._headers,
        params:  { symbols: upperSymbols.join(',') },
        timeout: 10000,
      });

      const snapshots = response.data || {};
      const results   = {};

      for (const [sym, snap] of Object.entries(snapshots)) {
        const quote = this._mapSnapshot(sym, snap);
        if (quote) {
          results[sym] = quote;
          // Cache immediately so downstream cache lookups hit without re-fetching
          await cache.set(`${QUOTE_CACHE_PREFIX}${sym}`, quote, QUOTE_CACHE_TTL);
        }
      }

      const gotCount = Object.keys(results).length;
      const misCount = upperSymbols.length - gotCount;
      console.log(`[Alpaca] Batch snapshot: ${gotCount}/${upperSymbols.length} symbols fetched` +
        (misCount > 0 ? ` (${misCount} not returned by Alpaca)` : ''));

      return results;
    } catch (err) {
      const status = err.response?.status;
      console.error(`[Alpaca] getBatchQuotes failed (HTTP ${status ?? 'N/A'}):`, err.message);
      return {};
    }
  }

  /**
   * Get OHLCV bar data for charting.
   *
   * Mirrors the interface of finnhub.getCandles() but uses Alpaca's bars endpoint.
   * Resolution strings follow Finnhub convention ('1', '5', '15', '30', '60', 'D', 'W', 'M').
   *
   * Returns an array of { timestamp, open, high, low, close, volume } objects,
   * or null on failure (let the caller fall back to Finnhub).
   *
   * @param {string} symbol
   * @param {string} resolution - Finnhub-style resolution string
   * @param {number|null} fromTs - Unix timestamp in seconds
   * @param {number|null} toTs   - Unix timestamp in seconds
   * @returns {Promise<Array|null>}
   */
  async getCandles(symbol, resolution = 'D', fromTs = null, toTs = null) {
    const upperSymbol = symbol.toUpperCase();

    if (!this.apiKey || !this.secretKey) {
      console.warn(`[Alpaca] No credentials — skipping candles for ${upperSymbol}`);
      return null;
    }

    const now  = Math.floor(Date.now() / 1000);
    const from = fromTs || (now - 30 * 24 * 3600);
    const to   = toTs   || now;

    const startDate = new Date(from * 1000).toISOString().split('T')[0];
    const endDate   = new Date(to   * 1000).toISOString().split('T')[0];
    const timeframe = this._mapResolution(resolution);

    try {
      const response = await axios.get(`${ALPACA_DATA_BASE}/stocks/${upperSymbol}/bars`, {
        headers: this._headers,
        params:  { timeframe, start: startDate, end: endDate, limit: 1000, adjustment: 'split' },
        timeout: 10000,
      });

      const bars = response.data?.bars || [];
      if (!bars.length) {
        console.warn(`[Alpaca] getCandles: no bars returned for ${upperSymbol}`);
        return null;
      }

      return bars.map(bar => ({
        timestamp: bar.t,
        open:      bar.o,
        high:      bar.h,
        low:       bar.l,
        close:     bar.c,
        volume:    bar.v,
      }));
    } catch (err) {
      const status = err.response?.status;
      console.error(`[Alpaca] getCandles ${upperSymbol} failed (HTTP ${status ?? 'N/A'}):`, err.message);
      return null;
    }
  }

  // ── Internal helpers ───────────────────────────────────────────────────────

  /**
   * Map an Alpaca snapshot object to the Finnhub-compatible quote format.
   *
   * Alpaca snapshot → our format:
   *   c  (current)   = latestTrade.p
   *   o  (open)      = dailyBar.o
   *   h  (high)      = dailyBar.h
   *   l  (low)       = dailyBar.l
   *   pc (prevClose) = prevDailyBar.c
   *   d  (change)    = c - pc
   *   dp (changePct) = (d / pc) * 100
   *
   * Returns null if essential fields are missing.
   */
  _mapSnapshot(symbol, snap) {
    if (!snap) return null;

    const c  = snap.latestTrade?.p;
    const pc = snap.prevDailyBar?.c;

    // Can't compute meaningful quote without a current price and previous close
    if (c == null || pc == null || pc === 0) return null;

    const d  = parseFloat((c - pc).toFixed(4));
    const dp = parseFloat(((c - pc) / pc * 100).toFixed(4));

    return {
      symbol:    symbol.toUpperCase(),
      current:   c,
      change:    d,
      changePct: dp,
      high:      snap.dailyBar?.h   ?? c,
      low:       snap.dailyBar?.l   ?? c,
      open:      snap.dailyBar?.o   ?? c,
      prevClose: pc,
      timestamp: snap.latestTrade?.t ?? new Date().toISOString(),
      source:    'alpaca',
    };
  }

  /**
   * Map Finnhub resolution strings to Alpaca timeframe strings.
   * Finnhub: '1' | '5' | '15' | '30' | '60' | 'D' | 'W' | 'M'
   * Alpaca:  '1Min' | '5Min' | '15Min' | '30Min' | '1Hour' | '1Day' | '1Week' | '1Month'
   */
  _mapResolution(resolution) {
    const map = {
      '1':  '1Min',
      '5':  '5Min',
      '15': '15Min',
      '30': '30Min',
      '60': '1Hour',
      'D':  '1Day',
      'W':  '1Week',
      'M':  '1Month',
    };
    return map[resolution] || '1Day';
  }

  /**
   * Returns true if this symbol is a plain US equity that Alpaca supports.
   * Excludes: forex (OANDA:EUR_USD), crypto (BINANCE:BTCUSDT), VIX.
   */
  static isStockSymbol(symbol) {
    if (!symbol || typeof symbol !== 'string') return false;
    const upper = symbol.toUpperCase();
    if (upper.includes(':')) return false;            // forex/crypto provider prefix
    if (upper === 'VIX' || upper === '^VIX') return false; // VIX from Yahoo
    return true;
  }
}

module.exports = new AlpacaService();
