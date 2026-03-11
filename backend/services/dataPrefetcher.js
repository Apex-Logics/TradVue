/**
 * Background Data Prefetcher
 *
 * Pre-fetches and warms the cache for the most frequently accessed market data
 * so that the first user who hits the site already gets a fast, cached response.
 *
 * SCALING NOTES:
 *   At  100 users → in-memory cache handles it fine; all users share the same
 *                   prefetched data — no per-user cost.
 *   At 1000 users → add Redis on Railway ($5/month add-on) so multiple dyno
 *                   instances share a single cache instead of each maintaining
 *                   their own warm copy.
 *   At 10000 users → dedicated Redis cluster + CDN edge caching for market data
 *                    + WebSocket push for real-time prices to avoid per-request
 *                    Finnhub calls entirely.
 */

'use strict';

const cache        = require('./cache');
const finnhub      = require('./finnhub');
const coinGecko    = require('./coinGecko');
const calendarService  = require('./calendarService');
const { getAnalystRatings } = require('./analystRatings');
const axios        = require('axios');

// ─── Config ──────────────────────────────────────────────────────────────────

/**
 * Default watchlist — mirrors DEFAULT_WATCHLIST in the frontend (app/page.tsx).
 * All 18 symbols are pre-warmed so the first user to load the app hits the cache
 * instead of waiting for live Finnhub calls.
 *
 * Crypto (BTC, ETH) and forex pairs (EURUSD, GBPUSD) are intentionally excluded
 * here because they come from different endpoints (CoinGecko / OANDA).
 * They are warmed separately in prefetchLowFrequency().
 */
const WATCHLIST = [
  // Index ETFs
  'SPY', 'QQQ', 'DIA', 'IWM',
  // Big tech
  'AAPL', 'GOOGL', 'TSLA', 'MSFT', 'META', 'NVDA', 'AMZN',
  // Metals (NYSE ETFs)
  'GLD', 'SLV',
  // Volatility
  'VIX',
];

/** Top coins tracked by CoinGecko prefetch */
const TOP_COINS_LIMIT = 10;

/** Popular tickers for analyst-ratings prefetch (runs every 6 h — keep short to save API quota) */
const ANALYST_TICKERS = ['AAPL', 'MSFT', 'NVDA', 'GOOGL', 'TSLA', 'AMZN', 'META'];

/** US market hours (ET) — only run the 60-second cycle during trading hours */
const MARKET_OPEN_HOUR  = 9.5;  // 09:30
const MARKET_CLOSE_HOUR = 16.0; // 16:00

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isMarketHours() {
  const et = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const day  = et.getDay();                             // 0=Sun … 6=Sat
  const hour = et.getHours() + et.getMinutes() / 60;
  return day >= 1 && day <= 5 && hour >= MARKET_OPEN_HOUR && hour < MARKET_CLOSE_HOUR;
}

/** Safely call an async function; never throws */
async function safe(label, fn) {
  try {
    return await fn();
  } catch (err) {
    console.error(`[Prefetch] ${label} failed:`, err.message);
    return null;
  }
}

// ─── Prefetch Cycles ─────────────────────────────────────────────────────────

/**
 * Every 60 seconds DURING market hours:
 *  - Batch quotes for the default watchlist
 *  - Market status
 *  - Top 10 crypto prices
 */
async function prefetchHighFrequency() {
  if (!isMarketHours()) return;

  let quotesCount = 0;
  let cryptoCount = 0;

  // Batch quotes — getQuote() caches each symbol individually under `finnhub:quote:SYM`.
  // Calling getBatchQuotes() on the full default watchlist ensures all symbols are fresh
  // before any user requests them.  Shared cache: 1 refresh serves all concurrent users.
  await safe('batch quotes', async () => {
    const quotes = await finnhub.getBatchQuotes(WATCHLIST);
    quotesCount = Object.keys(quotes).length;
  });

  // Market status
  await safe('market status', () => finnhub.getMarketStatus('US'));

  // Top 10 crypto prices via CoinGecko
  await safe('crypto prices', async () => {
    const coins = await coinGecko.getTopCoins({ limit: TOP_COINS_LIMIT });
    cryptoCount = Array.isArray(coins) ? coins.length : 0;
  });

  console.log(`[Prefetch] 60s cycle — warmed ${quotesCount}/${WATCHLIST.length} stock quotes, ${cryptoCount} crypto prices`);
}

/**
 * Every 5 minutes:
 *  - Market movers (gainers / losers)
 *  - General market news feed
 *  - Fear & Greed index
 */
async function prefetchMediumFrequency() {
  let newsCount    = 0;

  // Market movers (top gainers/losers from watchlist)
  await safe('market movers', () => finnhub.getBatchQuotes(WATCHLIST));

  // General market news (uses finnhub general news; RSS aggregator has its own cache)
  await safe('news feed', async () => {
    const news = await finnhub.getGeneralNews('general', { limit: 30 });
    newsCount = Array.isArray(news) ? news.length : 0;
  });

  // Fear & Greed index — proxy the alternative.me API ourselves so other
  // parts of the app just hit our cache.
  await safe('fear & greed', async () => {
    const cacheKey = 'tools:fear-greed:30';
    const existing = await cache.get(cacheKey);
    if (existing) return; // still fresh

    const response = await axios.get('https://api.alternative.me/fng/?limit=30&format=json', {
      timeout: 10000
    });
    const data = response.data;

    const payload = {
      success: true,
      current: data.data?.[0] ? {
        value: parseInt(data.data[0].value),
        classification: data.data[0].value_classification,
        timestamp: data.data[0].timestamp,
      } : null,
      history: (data.data || []).map(d => ({
        value: parseInt(d.value),
        classification: d.value_classification,
        timestamp: parseInt(d.timestamp),
        date: new Date(parseInt(d.timestamp) * 1000).toISOString().split('T')[0],
      })),
      timestamp: new Date().toISOString(),
    };

    await cache.set(cacheKey, payload, 60 * 30); // 30 min TTL
  });

  console.log(`[Prefetch] 5m cycle — updated movers, ${newsCount} news items, fear & greed`);
}

/**
 * Every 30 minutes:
 *  - Economic calendar events
 *  - Forex rates (EUR/USD, GBP/USD via Finnhub batch)
 *  - Metals (GLD, SLV as stock quotes)
 *  - VIX
 */
async function prefetchLowFrequency() {
  let calCount = 0;

  // Economic calendar (today ± 3 days)
  await safe('calendar events', async () => {
    const today  = new Date();
    const from   = new Date(today); from.setDate(from.getDate() - 1);
    const to     = new Date(today); to.setDate(to.getDate() + 3);

    const toDateStr = d => d.toISOString().split('T')[0];
    const events = await calendarService.getEvents({
      from: toDateStr(from),
      to:   toDateStr(to),
      type: 'all'
    });
    calCount = Array.isArray(events) ? events.length : 0;
  });

  // Forex rates — Finnhub uses OANDA symbols ("OANDA:EUR_USD" → stored as "EURUSD" on frontend).
  // Warming these means the first user to load the watchlist gets a cached forex rate.
  await safe('forex rates', () =>
    finnhub.getBatchQuotes(['OANDA:EUR_USD', 'OANDA:GBP_USD', 'OANDA:USD_JPY'])
  );

  // Metals — GLD and SLV are NYSE ETFs and come through the stock batch endpoint.
  // Already in WATCHLIST but explicitly refreshed here to ensure 30-min cadence
  // even outside market hours.
  await safe('metals (GLD/SLV)', () => finnhub.getBatchQuotes(['GLD', 'SLV']));

  // VIX index
  await safe('VIX', () => finnhub.getQuote('VIX'));

  console.log(`[Prefetch] 30m cycle — updated calendar (${calCount} events), forex, metals, VIX`);
}

/**
 * Every 6 hours:
 *  - Company profiles for watchlist stocks
 *  - Analyst ratings for popular tickers
 */
async function prefetchRareData() {
  let profileCount = 0;
  let ratingsCount = 0;

  // Company profiles — spread calls to avoid rate-limiting
  for (const symbol of WATCHLIST) {
    const result = await safe(`profile:${symbol}`, () => finnhub.getCompanyProfile(symbol));
    if (result) profileCount++;
    // Small delay to stay well under Finnhub's 60 req/min free-tier limit
    await new Promise(r => setTimeout(r, 1100));
  }

  // Analyst ratings
  for (const ticker of ANALYST_TICKERS) {
    const result = await safe(`ratings:${ticker}`, () => getAnalystRatings(ticker));
    if (result) ratingsCount++;
    await new Promise(r => setTimeout(r, 1100));
  }

  console.log(`[Prefetch] 6h cycle — updated ${profileCount} profiles, ${ratingsCount} analyst ratings`);
}

// ─── Scheduler ───────────────────────────────────────────────────────────────

let _started = false;

/**
 * Start the background prefetch service.
 *
 * Called from server.js inside the 15-second startup delay so the healthcheck
 * passes before we begin firing external API calls.
 */
function start() {
  if (_started) return;
  _started = true;

  console.log('[Prefetch] Starting background data prefetcher...');

  // ── Run first cycles immediately (data already warm before first user) ──
  prefetchHighFrequency().catch(() => {});
  prefetchMediumFrequency().catch(() => {});
  prefetchLowFrequency().catch(() => {});
  prefetchRareData().catch(() => {});

  // ── Schedule recurring cycles ──
  setInterval(() => prefetchHighFrequency().catch(() => {}), 60 * 1000);          // 60 s
  setInterval(() => prefetchMediumFrequency().catch(() => {}), 5 * 60 * 1000);    // 5 min
  setInterval(() => prefetchLowFrequency().catch(() => {}), 30 * 60 * 1000);      // 30 min
  setInterval(() => prefetchRareData().catch(() => {}), 6 * 60 * 60 * 1000);      // 6 h

  console.log('[Prefetch] Scheduler running. High-freq cycles active during market hours (09:30–16:00 ET).');
}

module.exports = { start };
