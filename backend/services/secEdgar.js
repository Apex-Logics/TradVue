/**
 * SEC EDGAR Data Service
 *
 * Fetches insider trades (Form 4), significant filings (13F, S-1, 8-K)
 * from SEC EDGAR RSS feeds and full-text search API.
 *
 * SEC Rate Limits: max 10 req/sec — enforced via token-bucket delay.
 * User-Agent must include contact email per SEC policy.
 */

'use strict';

const axios = require('axios');
const RssParser = require('rss-parser');
const cache = require('./cache');

const SEC_USER_AGENT = 'TradVue/1.0 (support@tradvue.com)';
const SEC_BASE = 'https://www.sec.gov';
const SEC_EFTS = 'https://efts.sec.gov';

// Token-bucket: max 10 req/sec to SEC
let _secLastRequestTime = 0;
const SEC_MIN_INTERVAL_MS = 110; // ~9 req/sec to stay safely under 10

async function _secDelay() {
  const now = Date.now();
  const elapsed = now - _secLastRequestTime;
  if (elapsed < SEC_MIN_INTERVAL_MS) {
    await new Promise(r => setTimeout(r, SEC_MIN_INTERVAL_MS - elapsed));
  }
  _secLastRequestTime = Date.now();
}

const rssParser = new RssParser({
  headers: { 'User-Agent': SEC_USER_AGENT },
  timeout: 15000,
  customFields: {
    item: [
      ['filing-type', 'filingType'],
      ['filing-date', 'filingDate'],
      ['filing-href', 'filingHref'],
      ['company-name', 'companyName'],
      ['form-type', 'formType'],
    ],
  },
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Extract ticker from SEC filing title/summary.
 * EDGAR often embeds the CIK but not always the ticker — we do best-effort extraction.
 */
function _extractTicker(title = '', summary = '') {
  // Try parenthesized ticker pattern: "Company Name (TICK)"
  const m = (title + ' ' + summary).match(/\(([A-Z]{1,5})\)/);
  return m ? m[1] : null;
}

function _extractFilingType(title = '', formType = '') {
  if (formType) return formType.toUpperCase().trim();
  const types = ['4', '13F', '13G', '13D', 'S-1', '8-K', '10-K', '10-Q', 'S-11', 'SC 13'];
  for (const t of types) {
    if (title.includes(t)) return t;
  }
  return 'OTHER';
}

function _normalizeItem(item, category, filingType) {
  return {
    title: item.title || '',
    summary: item.contentSnippet || item.content || item.summary || '',
    url: item.link || item.filingHref || '',
    source: 'SEC EDGAR',
    category,
    ticker: _extractTicker(item.title, item.contentSnippet || ''),
    filingType: _extractFilingType(item.title || '', filingType || item.filingType || ''),
    date: item.isoDate || item.pubDate || new Date().toISOString(),
    companyName: item.companyName || item['company-name'] || null,
  };
}

// ─── Core Fetchers ────────────────────────────────────────────────────────────

/**
 * Fetch Form 4 (insider transactions) from SEC EDGAR RSS feed.
 * Cache: 15 minutes
 */
async function getInsiderTrades({ count = 40 } = {}) {
  const cacheKey = `sec:insider_trades:${count}`;

  return cache.cacheAPICall(cacheKey, async () => {
    await _secDelay();

    const url = `${SEC_BASE}/cgi-bin/browse-edgar?action=getcurrent&type=4&dateb=&owner=include&count=${count}&search_text=&output=atom`;

    try {
      const feed = await rssParser.parseURL(url);
      return (feed.items || []).map(item => _normalizeItem(item, 'insider', '4'));
    } catch (err) {
      console.error('[SEC EDGAR] Insider trades fetch error:', err.message);
      return [];
    }
  }, 5 * 60 * 60); // 5 hour cache — insider trades are filed daily, not per-minute
}

/**
 * Fetch significant filings (13F, S-1, 8-K) from SEC EDGAR RSS.
 * Cache: 15 minutes each type
 */
async function getFilingsByType(formType, { count = 20 } = {}) {
  const cacheKey = `sec:filings:${formType}:${count}`;

  return cache.cacheAPICall(cacheKey, async () => {
    await _secDelay();

    const encodedType = encodeURIComponent(formType);
    const url = `${SEC_BASE}/cgi-bin/browse-edgar?action=getcurrent&type=${encodedType}&dateb=&owner=include&count=${count}&search_text=&output=atom`;

    try {
      const feed = await rssParser.parseURL(url);
      return (feed.items || []).map(item => _normalizeItem(item, 'filing', formType));
    } catch (err) {
      console.error(`[SEC EDGAR] Filings fetch error (${formType}):`, err.message);
      return [];
    }
  }, 15 * 60);
}

/**
 * Full-text search of SEC filings.
 * Cache: 15 minutes
 */
async function searchFilings({ query = 'insider', startDate = null, endDate = null, limit = 20 } = {}) {
  const today = new Date().toISOString().split('T')[0];
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString().split('T')[0];
  const start = startDate || thirtyDaysAgo;
  const end = endDate || today;

  const cacheKey = `sec:search:${query}:${start}:${end}:${limit}`;

  return cache.cacheAPICall(cacheKey, async () => {
    await _secDelay();

    const url = `${SEC_EFTS}/LATEST/search-index?q=${encodeURIComponent(JSON.stringify(query))}&dateRange=custom&startdt=${start}&enddt=${end}`;

    try {
      const response = await axios.get(url, {
        headers: { 'User-Agent': SEC_USER_AGENT },
        timeout: 12000,
      });

      const hits = response.data?.hits?.hits || [];
      return hits.slice(0, limit).map(hit => {
        const src = hit._source || {};
        return {
          title: src.display_names?.join(', ') || src.entity_name || src.file_date || 'SEC Filing',
          summary: src.period_of_report ? `Period: ${src.period_of_report}` : '',
          url: src.file_num ? `${SEC_BASE}/cgi-bin/browse-edgar?action=getcompany&filenum=${src.file_num}&type=&dateb=&owner=include&count=10` : '',
          source: 'SEC EDGAR',
          category: 'filing',
          ticker: null,
          filingType: src.form_type || 'OTHER',
          date: src.file_date || new Date().toISOString(),
          companyName: Array.isArray(src.display_names) ? src.display_names[0] : null,
        };
      });
    } catch (err) {
      console.error('[SEC EDGAR] Full-text search error:', err.message);
      return [];
    }
  }, 15 * 60);
}

/**
 * Get recent insider trades + significant filings combined.
 * Used by the /api/insider-trades route (SEC portion).
 */
async function getRecentActivity({ symbol = null } = {}) {
  const cacheKey = `sec:recent_activity:${symbol || 'all'}`;

  return cache.cacheAPICall(cacheKey, async () => {
    // Fetch insider trades and some filing types in parallel (with SEC delay between each)
    const [insiderTrades, filings8K] = await Promise.allSettled([
      getInsiderTrades({ count: 40 }),
      getFilingsByType('8-K', { count: 20 }),
    ]);

    const trades = insiderTrades.status === 'fulfilled' ? insiderTrades.value : [];
    const eightK = filings8K.status === 'fulfilled' ? filings8K.value : [];

    let combined = [...trades, ...eightK].sort((a, b) => new Date(b.date) - new Date(a.date));

    // Filter by symbol if provided
    if (symbol) {
      const upperSym = symbol.toUpperCase();
      combined = combined.filter(item =>
        item.ticker === upperSym ||
        (item.title || '').toUpperCase().includes(upperSym) ||
        (item.companyName || '').toUpperCase().includes(upperSym)
      );
    }

    return combined;
  }, 15 * 60);
}

module.exports = {
  getInsiderTrades,
  getFilingsByType,
  searchFilings,
  getRecentActivity,
};
