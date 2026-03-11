/**
 * Analyst Ratings Service
 * 
 * Pulls analyst consensus data from Yahoo Finance and optionally Finnhub.
 * Returns: consensus rating, price target range, analyst count.
 * Cached for 1 hour.
 */

const axios = require('axios');
const cache = require('./cache');

const YAHOO_BASE = 'https://query2.finance.yahoo.com';
const FINNHUB_BASE = 'https://finnhub.io/api/v1';

const YAHOO_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
  'Accept': 'application/json',
};

/**
 * Map recommendationMean (1-5 scale) to a label.
 * 1 = Strong Buy, 2 = Buy, 3 = Hold, 4 = Sell, 5 = Strong Sell
 */
function getConsensusLabel(mean) {
  if (mean == null) return null;
  if (mean <= 1.5) return 'Strong Buy';
  if (mean <= 2.5) return 'Buy';
  if (mean <= 3.5) return 'Hold';
  if (mean <= 4.5) return 'Sell';
  return 'Strong Sell';
}

/**
 * Map consensus label to a color hint for frontend.
 */
function getConsensusColor(label) {
  const map = {
    'Strong Buy': '#16a34a',
    'Buy': '#22c55e',
    'Hold': '#eab308',
    'Sell': '#f97316',
    'Strong Sell': '#ef4444',
  };
  return map[label] || '#94a3b8';
}

/**
 * Fetch analyst ratings for a given ticker.
 * @param {string} ticker
 * @returns {Promise<Object>}
 */
async function getAnalystRatings(ticker) {
  const upper = ticker.toUpperCase();
  const cacheKey = `analyst:ratings:${upper}`;

  return cache.cacheAPICall(cacheKey, async () => {
    const apiKey = process.env.FINNHUB_API_KEY;

    // Fire Yahoo + Finnhub in parallel (3 requests total)
    const [yahooRes, finnhubRes, finnhubTargetRes] = await Promise.allSettled([
      // Yahoo Finance quote summary — includes analyst data in the quote
      axios.get(`${YAHOO_BASE}/v10/finance/quoteSummary/${upper}`, {
        params: { modules: 'financialData' },
        headers: YAHOO_HEADERS,
        timeout: 10000,
      }),
      // Finnhub recommendation trends
      apiKey
        ? axios.get(`${FINNHUB_BASE}/stock/recommendation`, {
            params: { symbol: upper, token: apiKey },
            timeout: 8000,
          })
        : Promise.reject(new Error('No FINNHUB_API_KEY')),
      // Finnhub price targets (free tier supports this)
      apiKey
        ? axios.get(`${FINNHUB_BASE}/stock/price-target`, {
            params: { symbol: upper, token: apiKey },
            timeout: 8000,
          })
        : Promise.reject(new Error('No FINNHUB_API_KEY')),
    ]);

    // ─── Parse Yahoo Finance ──────────────────────────────────────────
    let yahoo = {
      recommendationMean: null,
      recommendationKey: null,
      targetHighPrice: null,
      targetLowPrice: null,
      targetMeanPrice: null,
      targetMedianPrice: null,
      numberOfAnalystOpinions: null,
      currentPrice: null,
    };

    if (yahooRes.status === 'fulfilled') {
      try {
        const fd = yahooRes.value.data?.quoteSummary?.result?.[0]?.financialData;
        if (fd) {
          yahoo.recommendationMean = fd.recommendationMean?.raw ?? null;
          yahoo.recommendationKey = fd.recommendationKey ?? null;
          yahoo.targetHighPrice = fd.targetHighPrice?.raw ?? null;
          yahoo.targetLowPrice = fd.targetLowPrice?.raw ?? null;
          yahoo.targetMeanPrice = fd.targetMeanPrice?.raw ?? null;
          yahoo.targetMedianPrice = fd.targetMedianPrice?.raw ?? null;
          yahoo.numberOfAnalystOpinions = fd.numberOfAnalystOpinions?.raw ?? null;
          yahoo.currentPrice = fd.currentPrice?.raw ?? null;
        }
      } catch (e) {
        console.warn(`[AnalystRatings] Yahoo parse error for ${upper}:`, e.message);
      }
    } else {
      console.warn(`[AnalystRatings] Yahoo failed for ${upper}:`, yahooRes.reason?.message);
    }

    // ─── Parse Finnhub recommendation trends ──────────────────────────
    let finnhub = {
      trends: [],
      latestPeriod: null,
    };

    if (finnhubRes.status === 'fulfilled') {
      try {
        const data = finnhubRes.value.data;
        if (Array.isArray(data) && data.length > 0) {
          // Data comes sorted by period descending — latest first
          finnhub.trends = data.slice(0, 4).map(t => ({
            period: t.period,
            strongBuy: t.strongBuy || 0,
            buy: t.buy || 0,
            hold: t.hold || 0,
            sell: t.sell || 0,
            strongSell: t.strongSell || 0,
          }));
          finnhub.latestPeriod = data[0].period;
        }
      } catch (e) {
        console.warn(`[AnalystRatings] Finnhub trends parse error for ${upper}:`, e.message);
      }
    } else {
      console.warn(`[AnalystRatings] Finnhub trends failed for ${upper}:`, finnhubRes.reason?.message);
    }

    // ─── Parse Finnhub price targets ────────────────────────────────
    let finnhubTargets = {
      targetHigh: null,
      targetLow: null,
      targetMean: null,
      targetMedian: null,
      lastUpdated: null,
    };

    if (finnhubTargetRes.status === 'fulfilled') {
      try {
        const td = finnhubTargetRes.value.data;
        if (td && (td.targetMean || td.targetHigh)) {
          finnhubTargets = {
            targetHigh:   td.targetHigh   || null,
            targetLow:    td.targetLow    || null,
            targetMean:   td.targetMean   || null,
            targetMedian: td.targetMedian || null,
            lastUpdated:  td.lastUpdated  || null,
          };
        }
      } catch (e) {
        console.warn(`[AnalystRatings] Finnhub price-target parse error for ${upper}:`, e.message);
      }
    } else {
      console.warn(`[AnalystRatings] Finnhub price-target failed for ${upper}:`, finnhubTargetRes.reason?.message);
    }

    // ─── Build unified response ───────────────────────────────────────

    // Consensus: prefer Yahoo's recommendationMean; if missing, derive from Finnhub trends
    let recommendationMean = yahoo.recommendationMean;
    if (recommendationMean == null && finnhub.trends.length > 0) {
      const t = finnhub.trends[0];
      const total = t.strongBuy + t.buy + t.hold + t.sell + t.strongSell;
      if (total > 0) {
        // Weighted: strongBuy=1, buy=2, hold=3, sell=4, strongSell=5
        const weighted = (t.strongBuy * 1 + t.buy * 2 + t.hold * 3 + t.sell * 4 + t.strongSell * 5) / total;
        recommendationMean = parseFloat(weighted.toFixed(2));
      }
    }

    const consensusLabel = getConsensusLabel(recommendationMean);

    // Price targets: prefer Yahoo, fall back to Finnhub targets
    const targetHigh   = yahoo.targetHighPrice   ?? finnhubTargets.targetHigh;
    const targetLow    = yahoo.targetLowPrice    ?? finnhubTargets.targetLow;
    const targetMean   = yahoo.targetMeanPrice   ?? finnhubTargets.targetMean;
    const targetMedian = yahoo.targetMedianPrice ?? finnhubTargets.targetMedian;

    // Calculate upside/downside from mean target
    let upsidePct = null;
    if (yahoo.currentPrice && targetMean) {
      upsidePct = parseFloat(
        (((targetMean - yahoo.currentPrice) / yahoo.currentPrice) * 100).toFixed(2)
      );
    }

    // Latest Finnhub breakdown (if available)
    const latestTrend = finnhub.trends[0] || null;
    const totalRatings = latestTrend
      ? latestTrend.strongBuy + latestTrend.buy + latestTrend.hold + latestTrend.sell + latestTrend.strongSell
      : null;

    return {
      symbol: upper,
      consensus: {
        label: consensusLabel,
        mean: recommendationMean,
        key: yahoo.recommendationKey || (consensusLabel ? consensusLabel.toLowerCase().replace(' ', '_') : null),
        color: getConsensusColor(consensusLabel),
      },
      priceTargets: {
        high:         targetHigh,
        low:          targetLow,
        mean:         targetMean,
        median:       targetMedian,
        currentPrice: yahoo.currentPrice,
        upsidePct,
      },
      analystCount: yahoo.numberOfAnalystOpinions || totalRatings,
      // Finnhub detailed breakdown
      distribution: latestTrend
        ? {
            strongBuy:  latestTrend.strongBuy,
            buy:        latestTrend.buy,
            hold:       latestTrend.hold,
            sell:       latestTrend.sell,
            strongSell: latestTrend.strongSell,
            total:      totalRatings,
            period:     finnhub.latestPeriod,
          }
        : null,
      // Historical trends (last 4 periods)
      trends: finnhub.trends,
      fetchedAt: new Date().toISOString(),
    };
  }, 60 * 60); // 1 hour cache
}

module.exports = { getAnalystRatings };
