/**
 * Stock Info Service
 * 
 * Combines Finnhub + Yahoo Finance to provide comprehensive stock data:
 *   - Company name, sector, logo (Finnhub profile)
 *   - PE ratio, dividend metrics (Finnhub metrics)
 *   - Current price, 52W range, dividend history (Yahoo Finance)
 * 
 * Cached for 15 minutes.
 */

const axios = require('axios');
const cache = require('./cache');

const FINNHUB_BASE = 'https://finnhub.io/api/v1';
const YAHOO_BASE = 'https://query2.finance.yahoo.com';

/**
 * Fetch comprehensive stock info for a symbol.
 * @param {string} symbol - Stock ticker (e.g. "AAPL")
 * @returns {Promise<Object>} Stock info object
 */
async function getStockInfo(symbol) {
  const upperSymbol = symbol.toUpperCase();
  const cacheKey = `stockinfo:v2:${upperSymbol}`;

  return await cache.cacheAPICall(cacheKey, async () => {
    const apiKey = process.env.FINNHUB_API_KEY;

    // Fire all requests in parallel
    const [finnhubProfileRes, finnhubMetricsRes, yahooRes] = await Promise.allSettled([
      apiKey
        ? axios.get(`${FINNHUB_BASE}/stock/profile2`, {
            params: { symbol: upperSymbol, token: apiKey },
            timeout: 8000,
          })
        : Promise.reject(new Error('No FINNHUB_API_KEY')),

      apiKey
        ? axios.get(`${FINNHUB_BASE}/stock/metric`, {
            params: { symbol: upperSymbol, metric: 'all', token: apiKey },
            timeout: 8000,
          })
        : Promise.reject(new Error('No FINNHUB_API_KEY')),

      axios.get(`${YAHOO_BASE}/v8/finance/chart/${upperSymbol}`, {
        params: { range: '5y', interval: '3mo', events: 'div' },
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          'Accept': 'application/json',
        },
        timeout: 10000,
      }),
    ]);

    // Parse Finnhub profile
    const profile =
      finnhubProfileRes.status === 'fulfilled' ? finnhubProfileRes.value.data || {} : {};

    // Parse Finnhub metrics
    const metrics =
      finnhubMetricsRes.status === 'fulfilled'
        ? finnhubMetricsRes.value.data?.metric || {}
        : {};

    if (finnhubProfileRes.status === 'rejected') {
      console.warn(`[StockInfo] Finnhub profile failed for ${upperSymbol}:`, finnhubProfileRes.reason?.message);
    }
    if (finnhubMetricsRes.status === 'rejected') {
      console.warn(`[StockInfo] Finnhub metrics failed for ${upperSymbol}:`, finnhubMetricsRes.reason?.message);
    }

    // Parse Yahoo Finance
    let currentPrice = null;
    let previousClose = null;
    let week52High = null;
    let week52Low = null;
    let dividendHistory = [];

    if (yahooRes.status === 'fulfilled') {
      try {
        const result = yahooRes.value.data?.chart?.result?.[0];
        if (result) {
          const meta = result.meta || {};
          currentPrice = meta.regularMarketPrice || null;
          previousClose = meta.chartPreviousClose || meta.previousClose || null;
          week52High = meta.fiftyTwoWeekHigh || null;
          week52Low = meta.fiftyTwoWeekLow || null;

          // Extract dividend events
          const divEvents = result.events?.dividends || {};
          dividendHistory = Object.values(divEvents)
            .map(div => ({
              date: new Date(div.date * 1000).toISOString().split('T')[0],
              amount: parseFloat(div.amount.toFixed(6)),
            }))
            .sort((a, b) => b.date.localeCompare(a.date)); // newest first
        }
      } catch (parseErr) {
        console.warn(`[StockInfo] Yahoo parse error for ${upperSymbol}:`, parseErr.message);
      }
    } else {
      console.warn(`[StockInfo] Yahoo Finance failed for ${upperSymbol}:`, yahooRes.reason?.message);
    }

    // Fallback 52W from Finnhub metrics
    if (!week52High && metrics['52WeekHigh']) week52High = metrics['52WeekHigh'];
    if (!week52Low && metrics['52WeekLow']) week52Low = metrics['52WeekLow'];

    // Calculate 5Y dividend growth rate (CAGR)
    let dividendGrowthRate5Y = null;
    if (dividendHistory.length >= 4) {
      const now = new Date();

      const oneYearAgo = new Date(now);
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

      const fiveYearsAgo = new Date(now);
      fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);

      const sixYearsAgo = new Date(now);
      sixYearsAgo.setFullYear(sixYearsAgo.getFullYear() - 6);

      const recentAnnual = dividendHistory
        .filter(d => new Date(d.date) >= oneYearAgo)
        .reduce((s, d) => s + d.amount, 0);

      const oldAnnual = dividendHistory
        .filter(d => {
          const dt = new Date(d.date);
          return dt >= sixYearsAgo && dt < fiveYearsAgo;
        })
        .reduce((s, d) => s + d.amount, 0);

      if (oldAnnual > 0 && recentAnnual > 0) {
        dividendGrowthRate5Y = parseFloat(
          (Math.pow(recentAnnual / oldAnnual, 1 / 5) * 100 - 100).toFixed(2)
        );
      }
    }

    const dayChange =
      currentPrice != null && previousClose != null
        ? parseFloat((currentPrice - previousClose).toFixed(4))
        : null;

    const dayChangePct =
      currentPrice != null && previousClose != null && previousClose !== 0
        ? parseFloat((((currentPrice - previousClose) / previousClose) * 100).toFixed(4))
        : null;

    return {
      symbol: upperSymbol,
      companyName: profile.name || upperSymbol,
      sector: profile.finnhubIndustry || null,
      industry: profile.finnhubIndustry || null,
      logo: profile.logo || null,
      exchange: profile.exchange || null,
      currency: profile.currency || 'USD',
      currentPrice: currentPrice ? parseFloat(currentPrice.toFixed(4)) : null,
      previousClose: previousClose ? parseFloat(previousClose.toFixed(4)) : null,
      dayChange,
      dayChangePct,
      '52WeekHigh': week52High ? parseFloat(week52High.toFixed(4)) : null,
      '52WeekLow': week52Low ? parseFloat(week52Low.toFixed(4)) : null,
      peRatio: metrics.peBasicExclExtraTTM || metrics.peTTM || null,
      dividendPerShareAnnual: metrics.dividendPerShareAnnual || null,
      dividendYield: metrics.dividendYieldIndicatedAnnual || null,
      dividendGrowthRate5Y,
      dividendHistory,
      fetchedAt: new Date().toISOString(),
    };
  }, 15 * 60); // 15 minute cache
}

module.exports = { getStockInfo };
