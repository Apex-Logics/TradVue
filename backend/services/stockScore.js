/**
 * Stock Scoring Service
 * 
 * Calculates a composite score (1-100) based on:
 *   - Value (25%): P/E ratio vs sector average
 *   - Growth (25%): Revenue/earnings growth rate
 *   - Momentum (25%): 50-day vs 200-day MA, RSI
 *   - Profitability (25%): Profit margin, ROE
 * 
 * Data sourced from Yahoo Finance quoteSummary modules.
 * Cached for 24 hours.
 */

const axios = require('axios');
const cache = require('./cache');

const YAHOO_BASE = 'https://query2.finance.yahoo.com';

const YAHOO_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
  'Accept': 'application/json',
};

// Sector average P/E ratios (approximate 2024-2025 benchmarks)
const SECTOR_PE = {
  'Technology':               30,
  'Information Technology':   30,
  'Financial Services':       15,
  'Financials':               15,
  'Healthcare':               22,
  'Health Care':              22,
  'Energy':                   12,
  'Consumer Cyclical':        22,
  'Consumer Discretionary':   22,
  'Consumer Defensive':       20,
  'Consumer Staples':         20,
  'Industrials':              20,
  'Communication Services':   18,
  'Utilities':                16,
  'Real Estate':              35,
  'Basic Materials':          18,
  'Materials':                18,
  _default:                   20,
};

/**
 * Clamp a value to 0-100 range.
 */
function clamp(val) {
  return Math.max(0, Math.min(100, Math.round(val)));
}

/**
 * Score P/E: lower P/E relative to sector = higher score.
 * PE <= 0 or null = neutral (50).
 */
function scoreValue(pe, sector) {
  if (!pe || pe <= 0) return { score: 50, details: { pe: null, sectorAvg: null, note: 'No P/E data' } };
  
  const sectorAvg = SECTOR_PE[sector] || SECTOR_PE._default;
  const ratio = pe / sectorAvg;
  
  // ratio < 0.5 → undervalued (100), ratio=1 → fairly valued (60), ratio > 2 → overvalued (10)
  let score;
  if (ratio <= 0.5) score = 95;
  else if (ratio <= 0.75) score = 80 + (0.75 - ratio) * 60;
  else if (ratio <= 1.0) score = 60 + (1.0 - ratio) * 80;
  else if (ratio <= 1.5) score = 40 + (1.5 - ratio) * 40;
  else if (ratio <= 2.0) score = 20 + (2.0 - ratio) * 40;
  else score = Math.max(5, 20 - (ratio - 2.0) * 10);

  return {
    score: clamp(score),
    details: { pe: parseFloat(pe.toFixed(2)), sectorAvg, ratio: parseFloat(ratio.toFixed(2)) },
  };
}

/**
 * Score Growth: revenue and earnings growth rates.
 * Higher growth = higher score.
 */
function scoreGrowth(revenueGrowth, earningsGrowth) {
  const scores = [];
  const details = {};

  if (revenueGrowth != null) {
    const rg = revenueGrowth * 100; // convert to pct
    details.revenueGrowthPct = parseFloat(rg.toFixed(2));
    // 0% → 40, 10% → 60, 25% → 80, 50%+ → 95
    if (rg >= 50) scores.push(95);
    else if (rg >= 25) scores.push(75 + (rg - 25) * 0.8);
    else if (rg >= 10) scores.push(55 + (rg - 10) * 1.33);
    else if (rg >= 0) scores.push(35 + rg * 2);
    else scores.push(Math.max(5, 35 + rg)); // negative growth
  }

  if (earningsGrowth != null) {
    const eg = earningsGrowth * 100;
    details.earningsGrowthPct = parseFloat(eg.toFixed(2));
    if (eg >= 50) scores.push(95);
    else if (eg >= 25) scores.push(75 + (eg - 25) * 0.8);
    else if (eg >= 10) scores.push(55 + (eg - 10) * 1.33);
    else if (eg >= 0) scores.push(35 + eg * 2);
    else scores.push(Math.max(5, 35 + eg * 0.5));
  }

  if (scores.length === 0) return { score: 50, details: { note: 'No growth data' } };
  
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  return { score: clamp(avg), details };
}

/**
 * Score Momentum: 50d vs 200d MA and RSI-like indicators.
 * Price above 200d MA and 50d > 200d (golden cross) = bullish.
 */
function scoreMomentum(currentPrice, fiftyDayAvg, twoHundredDayAvg) {
  const details = {};
  const scores = [];

  if (currentPrice && fiftyDayAvg) {
    const pctAbove50 = ((currentPrice - fiftyDayAvg) / fiftyDayAvg) * 100;
    details.pctAbove50dMA = parseFloat(pctAbove50.toFixed(2));
    details.fiftyDayAvg = parseFloat(fiftyDayAvg.toFixed(2));
    // Between -10% and +10% = moderate, beyond = strong signal
    scores.push(clamp(50 + pctAbove50 * 3));
  }

  if (currentPrice && twoHundredDayAvg) {
    const pctAbove200 = ((currentPrice - twoHundredDayAvg) / twoHundredDayAvg) * 100;
    details.pctAbove200dMA = parseFloat(pctAbove200.toFixed(2));
    details.twoHundredDayAvg = parseFloat(twoHundredDayAvg.toFixed(2));
    scores.push(clamp(50 + pctAbove200 * 2));
  }

  if (fiftyDayAvg && twoHundredDayAvg) {
    // Golden cross bonus
    const maRatio = fiftyDayAvg / twoHundredDayAvg;
    details.goldenCross = maRatio > 1;
    details.deathCross = maRatio < 1;
    if (maRatio > 1.02) scores.push(75);      // Golden cross
    else if (maRatio > 1) scores.push(60);
    else if (maRatio > 0.98) scores.push(40);
    else scores.push(25);                       // Death cross
  }

  if (scores.length === 0) return { score: 50, details: { note: 'No momentum data' } };

  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  return { score: clamp(avg), details };
}

/**
 * Score Profitability: profit margin, ROE, gross margin.
 */
function scoreProfitability(profitMargin, roe, grossMargin) {
  const details = {};
  const scores = [];

  if (profitMargin != null) {
    const pm = profitMargin * 100;
    details.profitMarginPct = parseFloat(pm.toFixed(2));
    // 0% → 30, 10% → 55, 20% → 75, 30%+ → 90
    if (pm >= 30) scores.push(90);
    else if (pm >= 20) scores.push(70 + (pm - 20) * 2);
    else if (pm >= 10) scores.push(50 + (pm - 10) * 2);
    else if (pm >= 0) scores.push(25 + pm * 2.5);
    else scores.push(Math.max(5, 25 + pm)); // negative margins
  }

  if (roe != null) {
    const r = roe * 100;
    details.roePct = parseFloat(r.toFixed(2));
    // ROE: 0% → 30, 15% → 60, 25% → 80, 40%+ → 95
    if (r >= 40) scores.push(95);
    else if (r >= 25) scores.push(75 + (r - 25) * 1.33);
    else if (r >= 15) scores.push(55 + (r - 15) * 2);
    else if (r >= 0) scores.push(25 + r * 2);
    else scores.push(Math.max(5, 25 + r * 0.5));
  }

  if (grossMargin != null) {
    const gm = grossMargin * 100;
    details.grossMarginPct = parseFloat(gm.toFixed(2));
    if (gm >= 60) scores.push(90);
    else if (gm >= 40) scores.push(65 + (gm - 40) * 1.25);
    else if (gm >= 20) scores.push(40 + (gm - 20) * 1.25);
    else scores.push(Math.max(10, 40 - (20 - gm)));
  }

  if (scores.length === 0) return { score: 50, details: { note: 'No profitability data' } };

  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  return { score: clamp(avg), details };
}

/**
 * Calculate composite stock score for a ticker.
 * @param {string} ticker
 * @returns {Promise<Object>}
 */
async function getStockScore(ticker) {
  const upper = ticker.toUpperCase();
  const cacheKey = `stock:score:v1:${upper}`;

  return cache.cacheAPICall(cacheKey, async () => {
    // Fetch multiple Yahoo Finance modules in one call
    const modules = [
      'financialData',
      'defaultKeyStatistics', 
      'summaryDetail',
      'assetProfile',
    ].join(',');

    let data = {};

    try {
      const res = await axios.get(`${YAHOO_BASE}/v10/finance/quoteSummary/${upper}`, {
        params: { modules },
        headers: YAHOO_HEADERS,
        timeout: 12000,
      });

      const result = res.data?.quoteSummary?.result?.[0];
      if (!result) {
        return { symbol: upper, error: 'No data available', totalScore: null };
      }

      const fd = result.financialData || {};
      const ks = result.defaultKeyStatistics || {};
      const sd = result.summaryDetail || {};
      const ap = result.assetProfile || {};

      // Extract raw values
      const currentPrice = fd.currentPrice?.raw ?? null;
      const pe = sd.trailingPE?.raw ?? sd.forwardPE?.raw ?? null;
      const sector = ap.sector || null;
      const revenueGrowth = fd.revenueGrowth?.raw ?? null;
      const earningsGrowth = fd.earningsGrowth?.raw ?? ks.earningsQuarterlyGrowth?.raw ?? null;
      const fiftyDayAvg = sd.fiftyDayAverage?.raw ?? null;
      const twoHundredDayAvg = sd.twoHundredDayAverage?.raw ?? null;
      const profitMargin = fd.profitMargins?.raw ?? null;
      const roe = fd.returnOnEquity?.raw ?? null;
      const grossMargin = fd.grossMargins?.raw ?? null;

      // Score each dimension
      const value = scoreValue(pe, sector);
      const growth = scoreGrowth(revenueGrowth, earningsGrowth);
      const momentum = scoreMomentum(currentPrice, fiftyDayAvg, twoHundredDayAvg);
      const profitability = scoreProfitability(profitMargin, roe, grossMargin);

      // Weighted composite (equal weights)
      const totalScore = clamp(
        value.score * 0.25 +
        growth.score * 0.25 +
        momentum.score * 0.25 +
        profitability.score * 0.25
      );

      // Grade label
      let grade;
      if (totalScore >= 80) grade = 'A';
      else if (totalScore >= 65) grade = 'B';
      else if (totalScore >= 50) grade = 'C';
      else if (totalScore >= 35) grade = 'D';
      else grade = 'F';

      return {
        symbol: upper,
        totalScore,
        grade,
        breakdown: {
          value: { score: value.score, weight: 25, ...value.details },
          growth: { score: growth.score, weight: 25, ...growth.details },
          momentum: { score: momentum.score, weight: 25, ...momentum.details },
          profitability: { score: profitability.score, weight: 25, ...profitability.details },
        },
        meta: {
          sector,
          currentPrice,
        },
        fetchedAt: new Date().toISOString(),
      };
    } catch (error) {
      console.error(`[StockScore] Error for ${upper}:`, error.message);
      return { symbol: upper, error: error.message, totalScore: null };
    }
  }, 24 * 60 * 60); // 24 hour cache
}

module.exports = { getStockScore };
