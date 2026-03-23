/**
 * Trading Tools Routes
 *
 * GET /api/tools/screener        - Stock screener with metric filters
 * GET /api/tools/fear-greed      - Crypto Fear & Greed Index (proxy)
 * GET /api/tools/gas             - Ethereum gas fees (proxy)
 * GET /api/tools/earnings        - Earnings calendar (Finnhub)
 * GET /api/tools/correlation     - Asset correlation matrix
 * GET /api/tools/currency-rates  - FX rates for currency strength
 */

const express = require('express');
const router = express.Router();
const axios = require('axios');
const cache = require('../services/cache');
const finnhubService = require('../services/finnhub');

const FINNHUB_BASE = 'https://finnhub.io/api/v1';
const finnhubKey = () => process.env.FINNHUB_API_KEY || '';

// ── Helper: safe axios get with timeout ──────────────────────────────────────
async function safeFetch(url, params = {}, timeoutMs = 8000) {
  const res = await axios.get(url, { params, timeout: timeoutMs });
  return res.data;
}

// ── Curated stock universe (major S&P 500 constituents) ──────────────────────
const STOCK_UNIVERSE = [
  { symbol: 'AAPL', name: 'Apple Inc.', sector: 'Technology' },
  { symbol: 'MSFT', name: 'Microsoft Corp.', sector: 'Technology' },
  { symbol: 'NVDA', name: 'NVIDIA Corp.', sector: 'Technology' },
  { symbol: 'GOOGL', name: 'Alphabet Inc.', sector: 'Technology' },
  { symbol: 'META', name: 'Meta Platforms', sector: 'Technology' },
  { symbol: 'AMZN', name: 'Amazon.com', sector: 'Technology' },
  { symbol: 'TSLA', name: 'Tesla Inc.', sector: 'Technology' },
  { symbol: 'AMD', name: 'Advanced Micro Devices', sector: 'Technology' },
  { symbol: 'INTC', name: 'Intel Corp.', sector: 'Technology' },
  { symbol: 'CRM', name: 'Salesforce Inc.', sector: 'Technology' },
  { symbol: 'ORCL', name: 'Oracle Corp.', sector: 'Technology' },
  { symbol: 'ADBE', name: 'Adobe Inc.', sector: 'Technology' },
  { symbol: 'NFLX', name: 'Netflix Inc.', sector: 'Technology' },
  { symbol: 'QCOM', name: 'Qualcomm Inc.', sector: 'Technology' },
  { symbol: 'AVGO', name: 'Broadcom Inc.', sector: 'Technology' },
  { symbol: 'JPM', name: 'JPMorgan Chase', sector: 'Financial' },
  { symbol: 'BAC', name: 'Bank of America', sector: 'Financial' },
  { symbol: 'GS', name: 'Goldman Sachs', sector: 'Financial' },
  { symbol: 'MS', name: 'Morgan Stanley', sector: 'Financial' },
  { symbol: 'WFC', name: 'Wells Fargo', sector: 'Financial' },
  { symbol: 'V', name: 'Visa Inc.', sector: 'Financial' },
  { symbol: 'MA', name: 'Mastercard Inc.', sector: 'Financial' },
  { symbol: 'BRK.B', name: 'Berkshire Hathaway', sector: 'Financial' },
  { symbol: 'AXP', name: 'American Express', sector: 'Financial' },
  { symbol: 'BLK', name: 'BlackRock Inc.', sector: 'Financial' },
  { symbol: 'JNJ', name: 'Johnson & Johnson', sector: 'Healthcare' },
  { symbol: 'UNH', name: 'UnitedHealth Group', sector: 'Healthcare' },
  { symbol: 'PFE', name: 'Pfizer Inc.', sector: 'Healthcare' },
  { symbol: 'ABBV', name: 'AbbVie Inc.', sector: 'Healthcare' },
  { symbol: 'MRK', name: 'Merck & Co.', sector: 'Healthcare' },
  { symbol: 'LLY', name: 'Eli Lilly', sector: 'Healthcare' },
  { symbol: 'TMO', name: 'Thermo Fisher Scientific', sector: 'Healthcare' },
  { symbol: 'ABT', name: 'Abbott Laboratories', sector: 'Healthcare' },
  { symbol: 'AMGN', name: 'Amgen Inc.', sector: 'Healthcare' },
  { symbol: 'GILD', name: 'Gilead Sciences', sector: 'Healthcare' },
  { symbol: 'XOM', name: 'Exxon Mobil', sector: 'Energy' },
  { symbol: 'CVX', name: 'Chevron Corp.', sector: 'Energy' },
  { symbol: 'COP', name: 'ConocoPhillips', sector: 'Energy' },
  { symbol: 'SLB', name: 'Schlumberger', sector: 'Energy' },
  { symbol: 'EOG', name: 'EOG Resources', sector: 'Energy' },
  { symbol: 'WMT', name: 'Walmart Inc.', sector: 'Consumer' },
  { symbol: 'AMZN', name: 'Amazon.com', sector: 'Consumer' },
  { symbol: 'HD', name: 'Home Depot', sector: 'Consumer' },
  { symbol: 'COST', name: 'Costco Wholesale', sector: 'Consumer' },
  { symbol: 'MCD', name: "McDonald's Corp.", sector: 'Consumer' },
  { symbol: 'NKE', name: 'Nike Inc.', sector: 'Consumer' },
  { symbol: 'SBUX', name: 'Starbucks Corp.', sector: 'Consumer' },
  { symbol: 'TGT', name: 'Target Corp.', sector: 'Consumer' },
  { symbol: 'PG', name: 'Procter & Gamble', sector: 'Consumer' },
  { symbol: 'KO', name: 'Coca-Cola Co.', sector: 'Consumer' },
  { symbol: 'PEP', name: 'PepsiCo Inc.', sector: 'Consumer' },
  { symbol: 'CAT', name: 'Caterpillar Inc.', sector: 'Industrials' },
  { symbol: 'BA', name: 'Boeing Co.', sector: 'Industrials' },
  { symbol: 'GE', name: 'General Electric', sector: 'Industrials' },
  { symbol: 'HON', name: 'Honeywell International', sector: 'Industrials' },
  { symbol: 'UPS', name: 'United Parcel Service', sector: 'Industrials' },
  { symbol: 'LMT', name: 'Lockheed Martin', sector: 'Industrials' },
  { symbol: 'RTX', name: 'Raytheon Technologies', sector: 'Industrials' },
  { symbol: 'NEE', name: 'NextEra Energy', sector: 'Utilities' },
  { symbol: 'DUK', name: 'Duke Energy', sector: 'Utilities' },
  { symbol: 'SO', name: 'Southern Company', sector: 'Utilities' },
  { symbol: 'SPG', name: 'Simon Property Group', sector: 'Real Estate' },
  { symbol: 'PLD', name: 'Prologis Inc.', sector: 'Real Estate' },
  { symbol: 'AMT', name: 'American Tower', sector: 'Real Estate' },
  { symbol: 'LIN', name: 'Linde PLC', sector: 'Materials' },
  { symbol: 'APD', name: 'Air Products', sector: 'Materials' },
  { symbol: 'FCX', name: 'Freeport-McMoRan', sector: 'Materials' },
];

// ── GET /api/tools/screener ───────────────────────────────────────────────────
router.get('/screener', async (req, res) => {
  try {
    const {
      minPE = '', maxPE = '',
      minYield = '', maxYield = '',
      sector = '',
      minPrice = '', maxPrice = '',
      minMarketCap = '', maxMarketCap = '',
      limit = '50'
    } = req.query;

    const cacheKey = `tools:screener:${JSON.stringify(req.query)}`;
    const cached = await cache.get(cacheKey);
    if (cached) return res.json(cached);

    // Filter universe by sector first (cheap)
    let universe = STOCK_UNIVERSE;
    if (sector) {
      universe = universe.filter(s => s.sector.toLowerCase() === sector.toLowerCase());
    }
    // Deduplicate
    universe = universe.filter((s, i, arr) => arr.findIndex(x => x.symbol === s.symbol) === i);

    // Fetch metrics for filtered universe (Finnhub basic financials + quote)
    const apiKey = finnhubKey();
    const results = [];

    // Batch fetch — limit to first 30 to avoid rate limiting
    const batchSize = Math.min(universe.length, 30);
    const toFetch = universe.slice(0, batchSize);

    await Promise.allSettled(toFetch.map(async (stock) => {
      try {
        const metricCacheKey = `tools:metric:${stock.symbol}`;
        let metricData = await cache.get(metricCacheKey);

        if (!metricData && apiKey) {
          const [metricRes, quoteRes] = await Promise.allSettled([
            safeFetch(`${FINNHUB_BASE}/stock/metric`, { symbol: stock.symbol, metric: 'all', token: apiKey }),
            safeFetch(`${FINNHUB_BASE}/quote`, { symbol: stock.symbol, token: apiKey }),
          ]);

          const metrics = metricRes.status === 'fulfilled' ? metricRes.value?.metric || {} : {};
          const quote = quoteRes.status === 'fulfilled' ? quoteRes.value || {} : {};

          const price = quote.c || 0;
          metricData = {
            price,
            change: quote.dp || 0,
            pe: metrics['peBasicExclExtraTTM'] || metrics['peTTM'] || null,
            divYield: metrics['dividendYieldIndicatedAnnual'] || null,
            marketCap: metrics['marketCapitalization'] || null,
            eps: metrics['epsBasicExclExtraItemsTTM'] || null,
            revenue: metrics['revenueTTM'] || null,
          };

          // Only cache if we got a valid price — prevents stale zero-price entries
          if (price > 0) {
            await cache.set(metricCacheKey, metricData, 6 * 60 * 60);
          }
        }

        // If metricData is missing or price is still 0, try finnhubService quote (has mock fallback)
        if (!metricData || metricData.price === 0) {
          try {
            const liveQuote = await finnhubService.getQuote(stock.symbol);
            const base = metricData || {};
            metricData = {
              ...base,
              price: liveQuote.current || base.price || 0,
              change: liveQuote.changePct || base.change || 0,
            };
          } catch (e) {
            // Last resort: keep what we have or use fallback
            if (!metricData) {
              metricData = { price: 0, change: 0, pe: null, divYield: null, marketCap: null, eps: null };
            }
          }
        }

        // Apply numeric filters
        const price = metricData.price || 0;
        const pe = metricData.pe;
        const divYield = metricData.divYield || 0;
        const marketCap = metricData.marketCap || 0; // in millions

        if (minPrice && price < parseFloat(minPrice)) return;
        if (maxPrice && price > parseFloat(maxPrice)) return;
        if (minPE && pe !== null && pe < parseFloat(minPE)) return;
        if (maxPE && pe !== null && pe > parseFloat(maxPE)) return;
        if (minYield && divYield < parseFloat(minYield)) return;
        if (maxYield && divYield > parseFloat(maxYield)) return;
        if (minMarketCap && marketCap < parseFloat(minMarketCap)) return;
        if (maxMarketCap && marketCap > parseFloat(maxMarketCap)) return;

        results.push({
          symbol: stock.symbol,
          name: stock.name,
          sector: stock.sector,
          price: parseFloat(price.toFixed(2)),
          change: parseFloat((metricData.change || 0).toFixed(2)),
          pe: pe !== null ? parseFloat(pe.toFixed(2)) : null,
          divYield: parseFloat(divYield.toFixed(3)),
          marketCap: parseFloat((marketCap / 1000).toFixed(1)), // convert to billions
          eps: metricData.eps ? parseFloat(metricData.eps.toFixed(2)) : null,
        });
      } catch (e) {
        // Skip individual stock errors
      }
    }));

    const response = {
      success: true,
      count: results.length,
      data: results.sort((a, b) => (b.marketCap || 0) - (a.marketCap || 0)).slice(0, parseInt(limit)),
      timestamp: new Date().toISOString(),
    };

    await cache.set(cacheKey, response, 60 * 15); // 15 min cache
    res.json(response);
  } catch (error) {
    console.error('[Tools] /screener error:', error.message);
    res.status(500).json({ success: false, error: 'Screener failed', details: error.message });
  }
});

// ── GET /api/tools/earnings ──────────────────────────────────────────────────
router.get('/earnings', async (req, res) => {
  try {
    const { from, to, symbol } = req.query;

    const now = new Date();
    const fromDate = from || now.toISOString().split('T')[0];
    const toDate = to || new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const cacheKey = `tools:earnings:${fromDate}:${toDate}`;
    const cached = await cache.get(cacheKey);
    if (cached) {
      const data = symbol
        ? { ...cached, data: cached.data.filter(e => e.symbol?.toUpperCase().includes(symbol.toUpperCase())) }
        : cached;
      return res.json(data);
    }

    const apiKey = finnhubKey();
    let earnings = [];

    if (apiKey) {
      const data = await safeFetch(`${FINNHUB_BASE}/calendar/earnings`, {
        from: fromDate, to: toDate, token: apiKey
      });
      earnings = (data.earningsCalendar || []).slice(0, 100).map(e => ({
        date: e.date,
        symbol: e.symbol,
        name: e.name || e.symbol,
        epsEstimate: e.epsEstimate,
        epsActual: e.epsActual,
        revenueEstimate: e.revenueEstimate,
        revenueActual: e.revenueActual,
        time: e.hour === 'bmo' ? 'BMO' : e.hour === 'amc' ? 'AMC' : 'Unknown',
      }));
    } else {
      return res.status(503).json({
        success: false,
        error: 'Live earnings data unavailable',
        message: 'This endpoint no longer returns mock earnings data in production.',
      });
    }

    const response = { success: true, count: earnings.length, data: earnings, timestamp: new Date().toISOString() };
    await cache.set(cacheKey, response, 60 * 60); // 1 hour cache

    const filtered = symbol
      ? { ...response, data: response.data.filter(e => e.symbol?.toUpperCase().includes(symbol.toUpperCase())) }
      : response;
    res.json(filtered);
  } catch (error) {
    console.error('[Tools] /earnings error:', error.message);
    res.status(500).json({ success: false, error: 'Earnings fetch failed', details: error.message });
  }
});

// ── GET /api/tools/fear-greed ────────────────────────────────────────────────
router.get('/fear-greed', async (req, res) => {
  try {
    const { limit = '30' } = req.query;
    const cacheKey = `tools:fear-greed:${limit}`;
    const cached = await cache.get(cacheKey);
    if (cached) return res.json(cached);

    const data = await safeFetch(`https://api.alternative.me/fng/?limit=${limit}&format=json`);

    const response = {
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

    await cache.set(cacheKey, response, 60 * 30); // 30 min cache
    res.json(response);
  } catch (error) {
    console.error('[Tools] /fear-greed error:', error.message);
    res.status(503).json({
      success: false,
      error: 'Fear & Greed data unavailable',
      message: 'This endpoint no longer returns fabricated fallback values in production.',
    });
  }
});

// ── GET /api/tools/gas ───────────────────────────────────────────────────────
router.get('/gas', async (req, res) => {
  try {
    const cacheKey = 'tools:gas-fees';
    const cached = await cache.get(cacheKey);
    if (cached) return res.json(cached);

    let gasData = null;

    // Try etherscan first (free with key)
    const etherscanKey = process.env.ETHERSCAN_API_KEY;
    if (etherscanKey) {
      try {
        const data = await safeFetch('https://api.etherscan.io/api', {
          module: 'gastracker', action: 'gasoracle', apikey: etherscanKey
        });
        if (data.status === '1') {
          gasData = {
            slow: parseFloat(data.result.SafeGasPrice),
            standard: parseFloat(data.result.ProposeGasPrice),
            fast: parseFloat(data.result.FastGasPrice),
            source: 'etherscan',
          };
        }
      } catch (e) { /* fall through */ }
    }

    // Fallback: blocknative gas API (no key needed)
    if (!gasData) {
      try {
        const data = await safeFetch('https://api.blocknative.com/gasprices/blockprices', {}, 5000);
        const bp = data.blockPrices?.[0]?.estimatedPrices;
        if (bp) {
          gasData = {
            slow: bp[3]?.price || bp[2]?.price || 20,
            standard: bp[1]?.price || 25,
            fast: bp[0]?.price || 35,
            source: 'blocknative',
          };
        }
      } catch (e) { /* fall through */ }
    }

    if (!gasData) {
      return res.status(503).json({
        success: false,
        error: 'Gas fee data unavailable',
        message: 'Live Ethereum gas data is temporarily unavailable. TradVue does not return fallback gas prices in production.',
      });
    }

    // USD conversion is still an estimate until we wire a live ETH/USD feed.
    const ethPrice = 3000;
    const gasUnits = 21000;
    const response = {
      success: true,
      prices: {
        slow: { gwei: gasData.slow, usd: parseFloat(((gasData.slow * gasUnits * ethPrice) / 1e9).toFixed(2)) },
        standard: { gwei: gasData.standard, usd: parseFloat(((gasData.standard * gasUnits * ethPrice) / 1e9).toFixed(2)) },
        fast: { gwei: gasData.fast, usd: parseFloat(((gasData.fast * gasUnits * ethPrice) / 1e9).toFixed(2)) },
      },
      ethPrice,
      ethPriceSource: 'estimated',
      source: gasData.source,
      timestamp: new Date().toISOString(),
    };

    await cache.set(cacheKey, response, 60); // 1 min cache for gas prices
    res.json(response);
  } catch (error) {
    console.error('[Tools] /gas error:', error.message);
    res.status(500).json({ success: false, error: 'Gas fee fetch failed' });
  }
});

// ── GET /api/tools/correlation ───────────────────────────────────────────────
router.get('/correlation', async (req, res) => {
  try {
    const cacheKey = 'tools:correlation:matrix';
    const cached = await cache.get(cacheKey);
    if (cached) return res.json(cached);

    const assets = [
      { symbol: 'SPY', name: 'S&P 500', type: 'stock' },
      { symbol: 'QQQ', name: 'Nasdaq 100', type: 'stock' },
      { symbol: 'GLD', name: 'Gold', type: 'stock' },
      { symbol: 'USO', name: 'Oil', type: 'stock' },
      { symbol: 'TLT', name: 'Bonds (20yr)', type: 'stock' },
      { symbol: 'BINANCE:BTCUSDT', name: 'Bitcoin', type: 'crypto' },
      { symbol: 'BINANCE:ETHUSDT', name: 'Ethereum', type: 'crypto' },
    ];

    const apiKey = finnhubKey();
    const to = Math.floor(Date.now() / 1000);
    const from = to - 90 * 24 * 60 * 60; // 90 days

    // Fetch candles for each asset
    const priceArrays = {};
    if (apiKey) {
      await Promise.allSettled(assets.map(async (asset) => {
        try {
          const data = await safeFetch(`${FINNHUB_BASE}/stock/candle`, {
            symbol: asset.symbol, resolution: 'D', from, to, token: apiKey
          });
          if (data.s === 'ok' && data.c?.length > 10) {
            priceArrays[asset.symbol] = data.c;
          }
        } catch (e) { /* skip */ }
      }));
    }

    // Calculate returns and correlations
    const getReturns = (prices) => {
      if (!prices || prices.length < 2) return null;
      return prices.slice(1).map((p, i) => (p - prices[i]) / prices[i]);
    };

    const pearsonCorr = (a, b) => {
      const minLen = Math.min(a.length, b.length);
      const x = a.slice(-minLen);
      const y = b.slice(-minLen);
      const n = minLen;
      const meanX = x.reduce((s, v) => s + v, 0) / n;
      const meanY = y.reduce((s, v) => s + v, 0) / n;
      let num = 0, denX = 0, denY = 0;
      for (let i = 0; i < n; i++) {
        const dx = x[i] - meanX, dy = y[i] - meanY;
        num += dx * dy;
        denX += dx * dx;
        denY += dy * dy;
      }
      const denom = Math.sqrt(denX * denY);
      return denom === 0 ? 0 : parseFloat((num / denom).toFixed(3));
    };

    // Build correlation matrix — use mock data if not enough real data
    const hasRealData = Object.keys(priceArrays).length >= 3;

    let matrix;
    if (hasRealData) {
      const returns = {};
      assets.forEach(a => { returns[a.symbol] = getReturns(priceArrays[a.symbol]); });

      matrix = assets.map(a => ({
        asset: a.name,
        symbol: a.symbol,
        correlations: assets.map(b => {
          const ra = returns[a.symbol];
          const rb = returns[b.symbol];
          if (!ra || !rb) return { asset: b.name, value: a.symbol === b.symbol ? 1 : null };
          return { asset: b.name, value: a.symbol === b.symbol ? 1 : pearsonCorr(ra, rb) };
        }),
      }));
    } else {
      // Well-known typical correlations (approximate)
      const knownCorr = {
        'SPY-QQQ': 0.95, 'SPY-GLD': -0.05, 'SPY-USO': 0.35, 'SPY-TLT': -0.20,
        'SPY-BINANCE:BTCUSDT': 0.45, 'SPY-BINANCE:ETHUSDT': 0.42,
        'QQQ-GLD': -0.08, 'QQQ-USO': 0.28, 'QQQ-TLT': -0.22,
        'QQQ-BINANCE:BTCUSDT': 0.52, 'QQQ-BINANCE:ETHUSDT': 0.48,
        'GLD-USO': 0.25, 'GLD-TLT': 0.30, 'GLD-BINANCE:BTCUSDT': 0.20, 'GLD-BINANCE:ETHUSDT': 0.18,
        'USO-TLT': -0.15, 'USO-BINANCE:BTCUSDT': 0.12, 'USO-BINANCE:ETHUSDT': 0.10,
        'TLT-BINANCE:BTCUSDT': -0.05, 'TLT-BINANCE:ETHUSDT': -0.03,
        'BINANCE:BTCUSDT-BINANCE:ETHUSDT': 0.88,
      };

      matrix = assets.map(a => ({
        asset: a.name, symbol: a.symbol,
        correlations: assets.map(b => {
          if (a.symbol === b.symbol) return { asset: b.name, value: 1 };
          const key = [a.symbol, b.symbol].sort().join('-');
          const rev = [b.symbol, a.symbol].sort().join('-');
          return { asset: b.name, value: knownCorr[key] ?? knownCorr[rev] ?? 0 };
        }),
      }));
    }

    const response = {
      success: true,
      assets: assets.map(a => a.name),
      matrix,
      period: '90 days',
      dataSource: hasRealData ? 'live' : 'estimated',
      timestamp: new Date().toISOString(),
    };

    await cache.set(cacheKey, response, 60 * 60 * 6); // 6 hour cache
    res.json(response);
  } catch (error) {
    console.error('[Tools] /correlation error:', error.message);
    res.status(500).json({ success: false, error: 'Correlation calculation failed' });
  }
});

// ── GET /api/tools/currency-rates ───────────────────────────────────────────
router.get('/currency-rates', async (req, res) => {
  try {
    const cacheKey = 'tools:currency-rates';
    const cached = await cache.get(cacheKey);
    if (cached) return res.json(cached);

    const data = await safeFetch('https://open.er-api.com/v6/latest/USD');

    const currencies = ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'AUD', 'CAD', 'NZD'];
    const rates = {};
    currencies.forEach(c => { rates[c] = data.rates?.[c] || 1; });

    const response = {
      success: true,
      base: 'USD',
      rates,
      timestamp: new Date().toISOString(),
    };

    await cache.set(cacheKey, response, 60 * 60); // 1 hour cache
    res.json(response);
  } catch (error) {
    console.error('[Tools] /currency-rates error:', error.message);
    res.status(503).json({
      success: false,
      error: 'Currency rates unavailable',
      message: 'This endpoint no longer returns approximate fallback exchange rates in production.',
    });
  }
});

// ── GET /api/tools/sectors ───────────────────────────────────────────────────
router.get('/sectors', async (req, res) => {
  try {
    const cacheKey = 'tools:sectors';
    const cached = await cache.get(cacheKey);
    if (cached) return res.json(cached);

    const apiKey = finnhubKey();
    let sectors = null;
    let dataSource = 'mock';

    // Try Finnhub sector performance endpoint (may require premium)
    if (apiKey) {
      try {
        const data = await safeFetch(`${FINNHUB_BASE}/sector-performance`, { token: apiKey }, 5000);
        if (Array.isArray(data) && data.length > 0) {
          sectors = data.map(s => ({
            name: s.sector,
            change: parseFloat((parseFloat(s.changesPercentage) || 0).toFixed(2)),
            ytdChange: null,
            _source: 'finnhub',
          }));
          dataSource = 'finnhub';
        }
      } catch (e) {
        console.warn('[Tools] Finnhub sector-performance unavailable:', e.message);
      }
    }

    if (!sectors) {
      return res.status(503).json({
        success: false,
        error: 'Sector performance unavailable',
        message: 'This endpoint no longer returns representative fallback sector data in production.',
      });
    }

    const response = {
      success: true,
      data: sectors,
      dataSource,
      _isMock: dataSource === 'mock',
      timestamp: new Date().toISOString(),
    };

    await cache.set(cacheKey, response, 60 * 15); // 15 min cache
    res.json(response);
  } catch (error) {
    console.error('[Tools] /sectors error:', error.message);
    res.status(500).json({ success: false, error: 'Sectors fetch failed', details: error.message });
  }
});

// ── GET /api/tools/heatmap ───────────────────────────────────────────────────
router.get('/heatmap', async (req, res) => {
  try {
    const cacheKey = 'tools:heatmap';
    const cached = await cache.get(cacheKey);
    if (cached) return res.json(cached);

    // Representative sector change baselines
    const sectorBaselines = {
      Technology:    1.24, Financial: 0.78, Healthcare: -0.32,
      Energy:       -1.15, Consumer:  0.45, Industrials:  0.63,
      Utilities:     0.28, 'Real Estate': -0.87, Materials: -0.55,
    };

    // Deduplicate universe
    const uniqueStocks = STOCK_UNIVERSE.filter(
      (s, i, arr) => arr.findIndex(x => x.symbol === s.symbol) === i
    );

    // Group by sector
    const sectorMap = {};
    uniqueStocks.forEach(stock => {
      if (!sectorMap[stock.sector]) sectorMap[stock.sector] = [];
      sectorMap[stock.sector].push({ symbol: stock.symbol, name: stock.name, change: null });
    });

    // Attempt to enrich with cached Finnhub quote data (no live calls here)
    await Promise.allSettled(
      uniqueStocks.map(async (stock) => {
        try {
          const quoteCacheKey = `finnhub:quote:${stock.symbol}`;
          const quote = await cache.get(quoteCacheKey);
          if (quote && typeof quote.changePct === 'number' && quote.changePct !== 0) {
            const entry = sectorMap[stock.sector]?.find(s => s.symbol === stock.symbol);
            if (entry) entry.change = parseFloat(quote.changePct.toFixed(2));
          }
        } catch (_) { /* skip */ }
      })
    );

    // Fill any remaining nulls with sector-consistent seeded values
    const heatmapData = Object.entries(sectorMap).map(([sector, stocks]) => {
      const base = sectorBaselines[sector] ?? 0;
      return {
        sector,
        sectorChange: parseFloat(base.toFixed(2)),
        stocks: stocks.map(s => ({
          symbol: s.symbol,
          name: s.name,
          change: s.change !== null
            ? s.change
            : parseFloat((base + (Math.random() - 0.5) * 1.5).toFixed(2)),
        })),
      };
    });

    const response = {
      success: true,
      data: heatmapData,
      _isMock: true, // Prices are seeded/cached — not guaranteed live
      timestamp: new Date().toISOString(),
    };

    await cache.set(cacheKey, response, 60 * 5); // 5 min cache
    res.json(response);
  } catch (error) {
    console.error('[Tools] /heatmap error:', error.message);
    res.status(500).json({ success: false, error: 'Heatmap fetch failed', details: error.message });
  }
});

module.exports = router;
