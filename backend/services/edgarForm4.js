/**
 * SEC EDGAR Form 4 Parser Service
 *
 * Fetches and parses Form 4 XML filings directly from SEC EDGAR.
 * Provides enriched insider trade data: title, price per share, transaction value, holdings.
 *
 * Data flow:
 *   1. Discover filings via EDGAR EFTS search API (returns XML filename in _id)
 *   2. Construct direct XML URL from _id and ciks
 *   3. Parse the Form 4 XML to extract all available fields
 *   4. Return enriched records
 *
 * SEC Rate Limits: max 10 req/sec — 110ms minimum between requests.
 * User-Agent: TradVue/1.0 (support@tradvue.com)
 */

'use strict';

const axios = require('axios');
const cache = require('./cache');

const SEC_USER_AGENT = 'TradVue/1.0 (support@tradvue.com)';
const SEC_BASE = 'https://www.sec.gov';
const EFTS_BASE = 'https://efts.sec.gov';

// Token-bucket: max 10 req/sec
let _lastRequestTime = 0;
const SEC_MIN_INTERVAL_MS = 110;

async function _secDelay() {
  const now = Date.now();
  const elapsed = now - _lastRequestTime;
  if (elapsed < SEC_MIN_INTERVAL_MS) {
    await new Promise(r => setTimeout(r, SEC_MIN_INTERVAL_MS - elapsed));
  }
  _lastRequestTime = Date.now();
}

const SEC_HEADERS = {
  'User-Agent': SEC_USER_AGENT,
  'Accept': 'application/json, text/xml, text/html, */*',
};

/**
 * Fetch a URL with SEC rate limiting and timeout.
 */
async function _secFetch(url, options = {}) {
  await _secDelay();
  return axios.get(url, {
    headers: SEC_HEADERS,
    timeout: options.timeout || 15000,
    ...options,
  });
}

// ─── XML Parsing Helpers ──────────────────────────────────────────────────────

/**
 * Extract the text content of an XML tag (first occurrence).
 * Handles both <tag>value</tag> and nested tags.
 */
function _extractXmlValue(xml, tag) {
  const re = new RegExp(`<${tag}[^>]*>([^<]*)<\\/${tag}>`, 'i');
  const m = xml.match(re);
  return m ? m[1].trim() : null;
}

/**
 * Extract multiple occurrences of a tag.
 */
function _extractXmlValues(xml, tag) {
  const re = new RegExp(`<${tag}[^>]*>([^<]*)<\\/${tag}>`, 'gi');
  const results = [];
  let m;
  while ((m = re.exec(xml)) !== null) {
    results.push(m[1].trim());
  }
  return results;
}

/**
 * Extract a block between opening and closing tags.
 */
function _extractXmlBlock(xml, tag) {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const m = xml.match(re);
  return m ? m[1] : null;
}

/**
 * Extract all blocks between opening and closing tags.
 */
function _extractXmlBlocks(xml, tag) {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi');
  const results = [];
  let m;
  while ((m = re.exec(xml)) !== null) {
    results.push(m[1]);
  }
  return results;
}

/**
 * Extract the first <value> child from within a named XML element block.
 * Handles the common Form 4 pattern: <elementName><value>DATA</value></elementName>
 */
function _extractNestedValue(xml, outerTag) {
  const block = _extractXmlBlock(xml, outerTag);
  if (!block) return null;
  return _extractXmlValue(block, 'value');
}

/**
 * Parse a Form 4 XML string into a structured trade record.
 * Returns null if essential fields are missing.
 */
function parseForm4Xml(xml, filingUrl) {
  if (!xml || xml.trim().length === 0) return null;

  // Issuer info
  const issuerBlock = _extractXmlBlock(xml, 'issuer') || xml;
  const ticker = _extractXmlValue(issuerBlock, 'issuerTradingSymbol');
  const companyName = _extractXmlValue(issuerBlock, 'issuerName');

  // Reporting owner info
  const ownerBlock = _extractXmlBlock(xml, 'reportingOwner') || xml;
  const ownerIdBlock = _extractXmlBlock(ownerBlock, 'reportingOwnerId') || ownerBlock;
  const ownerRelBlock = _extractXmlBlock(ownerBlock, 'reportingOwnerRelationship') || ownerBlock;

  const insiderName = _extractXmlValue(ownerIdBlock, 'rptOwnerName');
  const title = _extractXmlValue(ownerRelBlock, 'officerTitle');
  const isDirector = _extractXmlValue(ownerRelBlock, 'isDirector') === '1';
  const isOfficer = _extractXmlValue(ownerRelBlock, 'isOfficer') === '1';
  const isTenPercentOwner = _extractXmlValue(ownerRelBlock, 'isTenPercentOwner') === '1';

  // Non-derivative transactions — may have multiple
  const txBlocks = _extractXmlBlocks(xml, 'nonDerivativeTransaction');

  // Signature date as fallback date
  const sigBlock = _extractXmlBlock(xml, 'ownerSignature') || xml;
  const signatureDate = _extractXmlValue(sigBlock, 'signatureDate');

  if (!ticker && !companyName) return null;

  // Build one record per non-derivative transaction
  const records = [];

  for (const txBlock of txBlocks) {
    const amountsBlock = _extractXmlBlock(txBlock, 'transactionAmounts') || txBlock;
    const postAmountsBlock = _extractXmlBlock(txBlock, 'postTransactionAmounts') || txBlock;
    const codingBlock = _extractXmlBlock(txBlock, 'transactionCoding') || txBlock;

    // Extract nested <value> tags from each named element
    const sharesStr = _extractNestedValue(amountsBlock, 'transactionShares');
    const priceStr = _extractNestedValue(amountsBlock, 'transactionPricePerShare');
    const adCode = _extractNestedValue(amountsBlock, 'transactionAcquiredDisposedCode');
    const holdingsStr = _extractNestedValue(postAmountsBlock, 'sharesOwnedFollowingTransaction');
    const txDate = _extractNestedValue(txBlock, 'transactionDate') || signatureDate;
    const txCode = _extractXmlValue(codingBlock, 'transactionCode');

    // Parse numeric values — only accept what's actually in the XML
    const sharesRaw = sharesStr !== null ? parseFloat(sharesStr) : null;
    const priceRaw = priceStr !== null ? parseFloat(priceStr) : null;
    const holdingsRaw = holdingsStr !== null ? parseFloat(holdingsStr) : null;

    // Zero shares means no actual trade (e.g., derivative exercise with no cash exchange)
    const shares = sharesRaw !== null && !isNaN(sharesRaw) && sharesRaw > 0 ? sharesRaw : null;
    const pricePerShare = priceRaw !== null && !isNaN(priceRaw) && priceRaw > 0 ? priceRaw : null;
    const holdingsAfter = holdingsRaw !== null && !isNaN(holdingsRaw) ? holdingsRaw : null;

    // Transaction value: only compute if both shares and price are present and non-zero
    const priceValid = pricePerShare !== null && !isNaN(pricePerShare) && pricePerShare > 0;
    const sharesValid = shares !== null && !isNaN(shares) && shares > 0;
    const transactionValue = sharesValid && priceValid
      ? Math.round(shares * pricePerShare * 100) / 100
      : null;

    // Normalize transaction type from A/D code or transaction code
    let transactionType = null;
    const acquiredCode = (adCode || '').toUpperCase();
    const tCode = (txCode || '').toUpperCase();

    if (acquiredCode === 'A') transactionType = 'Buy';
    else if (acquiredCode === 'D') transactionType = 'Sell';
    else if (tCode === 'A') transactionType = 'Buy';
    else if (tCode === 'S') transactionType = 'Sell';
    else if (tCode === 'M') transactionType = 'Option Exercise';
    else if (tCode === 'G') transactionType = 'Gift';
    else if (tCode === 'F') transactionType = 'Tax Withholding';
    else if (tCode === 'D') transactionType = 'Sell (to issuer)';
    else if (tCode === 'I') transactionType = 'Discretionary';
    else if (tCode === 'J') transactionType = 'Other';
    else if (tCode === 'P') transactionType = 'Buy';
    else if (tCode === 'W') transactionType = 'Will/Trust';
    else if (tCode === 'X') transactionType = 'Option Exercise';
    else if (tCode === 'Z') transactionType = 'Trust';

    records.push({
      ticker: ticker || null,
      companyName: companyName || null,
      name: insiderName || null,
      officerTitle: title || null,
      isDirector,
      isOfficer,
      isTenPercentOwner,
      transactionType,
      shares,
      pricePerShare,
      transactionValue,
      holdingsAfter,
      date: txDate || signatureDate || null,
      source: 'SEC EDGAR',
      filingUrl: filingUrl || null,
      // Legacy fields for compatibility
      category: 'insider',
      filingType: '4',
    });
  }

  // If no non-derivative transactions, return a minimal record
  if (records.length === 0) {
    return [{
      ticker: ticker || null,
      companyName: companyName || null,
      name: insiderName || null,
      officerTitle: title || null,
      isDirector,
      isOfficer,
      isTenPercentOwner,
      transactionType: null,
      shares: null,
      pricePerShare: null,
      transactionValue: null,
      holdingsAfter: null,
      date: signatureDate || null,
      source: 'SEC EDGAR',
      filingUrl: filingUrl || null,
      category: 'insider',
      filingType: '4',
    }];
  }

  return records;
}

// ─── EFTS Search API ──────────────────────────────────────────────────────────

/**
 * Search EDGAR EFTS for Form 4 filings.
 * Returns an array of { xmlUrl, fileDate } objects.
 *
 * @param {string} query      - Search query (empty string for all filings)
 * @param {string} startdt    - Start date YYYY-MM-DD
 * @param {string} enddt      - End date YYYY-MM-DD
 * @param {number} limit      - Max results to return
 */
async function _eftsSearchForm4(query, startdt, enddt, limit = 30) {
  const q = query ? `"${encodeURIComponent(query)}"` : '';
  const url = `${EFTS_BASE}/LATEST/search-index?q=${q}&forms=4&dateRange=custom&startdt=${startdt}&enddt=${enddt}`;

  let hits = [];
  try {
    const resp = await _secFetch(url, { timeout: 15000 });
    hits = resp.data?.hits?.hits || [];
  } catch (err) {
    console.error('[EDGAR Form4] EFTS search error:', err.message);
    return [];
  }

  const results = [];
  for (const hit of hits.slice(0, limit)) {
    const id = hit._id || '';       // e.g. "0001628280-26-019134:wk-form4_1773845585.xml"
    const source = hit._source || {};
    const colonIdx = id.indexOf(':');
    if (colonIdx === -1) continue;

    const accessionDashed = id.slice(0, colonIdx);   // "0001628280-26-019134"
    const filename = id.slice(colonIdx + 1);          // "wk-form4_1773845585.xml"

    if (!filename.endsWith('.xml')) continue;

    const accessionNoDashes = accessionDashed.replace(/-/g, ''); // "000162828026019134"

    // Use the second CIK (issuer) when available; fall back to first
    const ciks = source.ciks || [];
    const rawCik = ciks.length >= 2 ? ciks[ciks.length - 1] : (ciks[0] || null);
    if (!rawCik) continue;

    const cik = parseInt(rawCik, 10).toString(); // strip leading zeros

    const xmlUrl = `${SEC_BASE}/Archives/edgar/data/${cik}/${accessionNoDashes}/${filename}`;
    results.push({ xmlUrl, fileDate: source.file_date || null });
  }

  return results;
}

/**
 * Fetch and parse a Form 4 XML file from a direct URL.
 */
async function _fetchAndParseXml(xmlUrl) {
  try {
    const resp = await _secFetch(xmlUrl, { timeout: 12000 });
    const xml = typeof resp.data === 'string' ? resp.data : JSON.stringify(resp.data);
    return parseForm4Xml(xml, xmlUrl);
  } catch (err) {
    return null;
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Get enriched insider trades for a batch of recent Form 4 filings.
 * Discovers filings via EFTS search API (returns XML filename directly in _id).
 * Cache: 30 minutes.
 *
 * @param {Object} opts
 * @param {number} opts.count       - Number of EFTS results to process (default 30)
 * @param {number} opts.maxXmlFetch - Max XML files to actually fetch (default 25)
 */
async function getBatchInsiderTrades({ count = 30, maxXmlFetch = 25 } = {}) {
  const cacheKey = `edgar:form4:batch:v3:${count}:${maxXmlFetch}`;

  return cache.cacheAPICall(cacheKey, async () => {
    const startTime = Date.now();

    const today = new Date().toISOString().split('T')[0];
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString().split('T')[0];

    const filings = await _eftsSearchForm4('', sevenDaysAgo, today, count);

    if (filings.length === 0) {
      console.warn('[EDGAR Form4] EFTS returned no filings');
      return [];
    }

    const results = [];
    const toFetch = filings.slice(0, maxXmlFetch);

    for (const filing of toFetch) {
      // Abort if taking too long (>25s budget for XML fetching)
      if (Date.now() - startTime > 25000) {
        console.warn('[EDGAR Form4] Batch timeout — returning partial results');
        break;
      }

      try {
        const parsed = await _fetchAndParseXml(filing.xmlUrl);
        if (parsed && parsed.length > 0) {
          for (const record of parsed) {
            if (!record.date && filing.fileDate) record.date = filing.fileDate;
            results.push(record);
          }
        }
      } catch (err) {
        console.warn('[EDGAR Form4] Error processing filing:', filing.xmlUrl, err.message);
      }
    }

    return results;
  }, 5 * 60 * 60); // 5 hour cache — batch Form 4 data is semi-static
}

/**
 * Get enriched insider trades for a specific ticker symbol.
 * Cache: 15 minutes.
 */
async function getInsiderTradesBySymbol(symbol) {
  const cacheKey = `edgar:form4:symbol:v2:${symbol.toUpperCase()}`;

  return cache.cacheAPICall(cacheKey, async () => {
    const upperSymbol = symbol.toUpperCase();

    const today = new Date().toISOString().split('T')[0];
    const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 3600 * 1000).toISOString().split('T')[0];

    const filings = await _eftsSearchForm4(upperSymbol, sixMonthsAgo, today, 20);

    if (filings.length === 0) {
      console.warn(`[EDGAR Form4] No EFTS filings found for symbol: ${upperSymbol}`);
      return [];
    }

    const results = [];

    for (const filing of filings.slice(0, 15)) {
      try {
        const parsed = await _fetchAndParseXml(filing.xmlUrl);
        if (parsed && parsed.length > 0) {
          for (const record of parsed) {
            if (!record.date && filing.fileDate) record.date = filing.fileDate;
            results.push(record);
          }
        }
      } catch (err) {
        console.warn('[EDGAR Form4] Symbol filing error:', filing.xmlUrl, err.message);
      }
    }

    return results;
  }, 5 * 60 * 60); // 5 hour cache — per-symbol Form 4 data changes slowly
}

module.exports = {
  getBatchInsiderTrades,
  getInsiderTradesBySymbol,
  parseForm4Xml, // exported for testing
};
