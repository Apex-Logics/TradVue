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
const alpaca       = require('./alpaca');
const coinGecko    = require('./coinGecko');
const calendarService  = require('./calendarService');
const { getAnalystRatings } = require('./analystRatings');
const axios        = require('axios');
const fredService     = require('./fred');
const secEdgar        = require('./secEdgar');
const finnhubService  = require('./finnhub');


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
  'SPY', 'QQQ', 'DIA', 'IWM', 'VOO', 'VTI', 'XLF', 'XLE', 'XLK', 'ARKK',
  // Mega cap
  'AAPL', 'GOOGL', 'TSLA', 'MSFT', 'META', 'NVDA', 'AMZN', 'NFLX', 'BRK.B',
  // Large cap popular
  'AMD', 'INTC', 'CRM', 'ORCL', 'UBER', 'COIN', 'SQ', 'SHOP', 'PLTR', 'SNOW',
  'PYPL', 'DIS', 'BA', 'NKE', 'JPM', 'BAC', 'GS', 'V', 'MA', 'WMT',
  'COST', 'HD', 'MCD', 'KO', 'PEP', 'JNJ', 'PFE', 'UNH', 'XOM', 'CVX',
  // Meme / high-interest
  'GME', 'AMC', 'RIVN', 'LCID', 'SOFI', 'HOOD', 'RBLX', 'ROKU',
  // Metals (NYSE ETFs)
  'GLD', 'SLV',
  // Volatility
  'VIX',
];

/** Top coins tracked by CoinGecko prefetch */
const TOP_COINS_LIMIT = 10;

/** Top tickers for insider data pre-warming — prioritised by market cap and dashboard activity */
const INSIDER_WARMUP_TICKERS = [
  // Mega cap
  'AAPL', 'MSFT', 'NVDA', 'AMZN', 'GOOGL', 'META', 'TSLA', 'BRK.B', 'AVGO', 'LLY',
  'JPM', 'V', 'UNH', 'XOM', 'MA', 'COST', 'HD', 'NFLX', 'PG', 'JNJ',
  // S&P 500 Top 21–50
  'ORCL', 'WMT', 'CRM', 'BAC', 'MRK', 'ABBV', 'CVX', 'KO', 'AMD', 'PEP',
  'CSCO', 'ACN', 'TMO', 'MCD', 'ABT', 'GS', 'ISRG', 'CAT', 'AXP', 'BKNG',
  'INTU', 'PFE', 'TXN', 'AMGN', 'SPGI', 'RTX', 'BLK', 'NOW', 'SCHW', 'DE',
  // Watchlist & portfolio defaults
  'SPY', 'QQQ', 'DIA', 'IWM',
  'INTC', 'PLTR', 'COIN', 'SQ', 'SHOP', 'UBER',
  'PYPL', 'DIS', 'BA', 'NKE', 'SNOW',
];

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
 * Every 30 seconds DURING market hours:
 *  - Batch quotes for top ~55 tickers (split into two halves to stay under 60 req/min)
 *  - Market status
 *  - Top 10 crypto prices (every other cycle)
 *
 * Finnhub free tier = 60 calls/min. With 55 tickers at 30s intervals, we fetch
 * ~28 tickers per cycle (alternating halves) = ~56 calls/min. Safe margin.
 */
let _highFreqCycle = 0;

async function prefetchHighFrequency() {
  if (!isMarketHours()) return;
  _highFreqCycle++;

  let quotesCount = 0;
  let cryptoCount = 0;

  // Split watchlist into two halves, alternate each cycle
  const mid = Math.ceil(WATCHLIST.length / 2);
  const batch = _highFreqCycle % 2 === 0
    ? WATCHLIST.slice(0, mid)
    : WATCHLIST.slice(mid);

  await safe('batch quotes', async () => {
    // Separate stock symbols from anything Alpaca can't handle (VIX uses Yahoo, no Alpaca support)
    const stockBatch   = batch.filter(s => alpaca.constructor.isStockSymbol(s));
    const specialBatch = batch.filter(s => !alpaca.constructor.isStockSymbol(s));

    // Use Alpaca's batch snapshot endpoint — ONE call for all stock symbols
    // instead of N individual Finnhub calls. Major rate-limit savings.
    let alpacaQuotes = {};
    if (stockBatch.length > 0) {
      alpacaQuotes = await alpaca.getBatchQuotes(stockBatch);
      quotesCount += Object.keys(alpacaQuotes).length;
    }

    // Fall back to Finnhub for any stocks Alpaca missed + special symbols (VIX, etc.)
    const alpacaMisses = stockBatch.filter(s => !alpacaQuotes[s]);
    const finnhubBatch = [...alpacaMisses, ...specialBatch];
    if (finnhubBatch.length > 0) {
      const fallbackQuotes = await finnhub.getBatchQuotes(finnhubBatch);
      quotesCount += Object.keys(fallbackQuotes).length;
    }
  });

  // Market status every cycle
  await safe('market status', () => finnhub.getMarketStatus('US'));

  // Crypto every other cycle (CoinGecko has its own rate limits)
  if (_highFreqCycle % 2 === 0) {
    await safe('crypto prices', async () => {
      const coins = await coinGecko.getTopCoins({ limit: TOP_COINS_LIMIT });
      cryptoCount = Array.isArray(coins) ? coins.length : 0;
    });
  }

  console.log(`[Prefetch] 30s cycle #${_highFreqCycle} — warmed ${quotesCount}/${batch.length} quotes${cryptoCount ? `, ${cryptoCount} crypto` : ''} (half ${_highFreqCycle % 2 + 1}/2)`);
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
  // Use Alpaca batch for stocks (1 call) + Finnhub fallback for specials (VIX etc.)
  await safe('market movers', async () => {
    const stockSymbols   = WATCHLIST.filter(s => alpaca.constructor.isStockSymbol(s));
    const specialSymbols = WATCHLIST.filter(s => !alpaca.constructor.isStockSymbol(s));

    const alpacaQuotes = stockSymbols.length > 0
      ? await alpaca.getBatchQuotes(stockSymbols)
      : {};

    const alpacaMisses = stockSymbols.filter(s => !alpacaQuotes[s]);
    const finnhubBatch = [...alpacaMisses, ...specialSymbols];
    if (finnhubBatch.length > 0) {
      await finnhub.getBatchQuotes(finnhubBatch);
    }
  });

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


/**
 * Every 15 minutes:
 *  - FRED economic indicators (1h cache but warm on start)
 *  - SEC EDGAR insider trades
 *  - Finnhub earnings + IPO calendars
 */
async function prefetchMarketIntel() {
  // FRED economic indicators
  await safe('FRED indicators', () => fredService.getAllIndicators());

  // SEC EDGAR insider trades (Form 4)
  await safe('SEC insider trades', () => secEdgar.getInsiderTrades({ count: 40 }));

  // Finnhub earnings + IPO calendars
  await safe('earnings calendar', () => finnhub.getEarningsCalendar());
  await safe('IPO calendar', () => finnhub.getIPOCalendar());

  console.log('[Prefetch] 15m intel cycle — updated FRED, SEC insider trades, earnings/IPO calendars');
}

/**
 * Every 5 hours (matching cache TTL):
 *  - Pre-warm Finnhub insider transactions cache for all top tickers
 *  - Fetches sequentially with 600ms delays to respect rate limits
 *  - Logs cache hits/misses for monitoring
 */
async function prefetchInsiderTrades() {
  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
  let hits = 0;
  let misses = 0;
  let errors = 0;

  console.log(`[Prefetch] Insider trade pre-warm starting for ${INSIDER_WARMUP_TICKERS.length} tickers...`);

  for (const ticker of INSIDER_WARMUP_TICKERS) {
    const cacheKey = `finnhub:insider_transactions:${ticker}`;
    try {
      const cached = await cache.get(cacheKey);
      if (cached !== null) {
        hits++;
        continue; // Already warm — skip API call
      }

      // Cache miss — fetch from Finnhub
      const result = await safe(`insider:${ticker}`, () => finnhub.getInsiderTransactions(ticker));
      if (result) {
        misses++;
        console.log(`[Prefetch] [MISS] insider:${ticker} — fetched ${result.data?.length || 0} trades`);
      } else {
        errors++;
      }

      // 600ms delay between API calls — same rate limit discipline as stockInfo
      await delay(600);
    } catch (err) {
      errors++;
      console.warn(`[Prefetch] insider:${ticker} error:`, err.message);
      await delay(600);
    }
  }

  console.log(`[Prefetch] Insider pre-warm done — ${hits} cache hits, ${misses} API fetches, ${errors} errors`);
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
  prefetchMarketIntel().catch(() => {});
  prefetchInsiderTrades().catch(() => {}); // Pre-warm insider data on boot

  // ── Schedule recurring cycles ──
  setInterval(() => prefetchHighFrequency().catch(() => {}), 30 * 1000);           // 30 s — keep quotes fresh
  setInterval(() => prefetchMediumFrequency().catch(() => {}), 5 * 60 * 1000);    // 5 min
  setInterval(() => prefetchLowFrequency().catch(() => {}), 15 * 60 * 1000);      // 15 min (was 30)
  setInterval(() => prefetchRareData().catch(() => {}), 6 * 60 * 60 * 1000);      // 6 h
  setInterval(() => prefetchMarketIntel().catch(() => {}), 15 * 60 * 1000);        // 15 min — FRED, SEC, calendars
  setInterval(() => prefetchInsiderTrades().catch(() => {}), 5 * 60 * 60 * 1000); // 5 h — insider trading cache refresh

  console.log('[Prefetch] Scheduler running. High-freq cycles active during market hours (09:30–16:00 ET).');
}

module.exports = { start };
