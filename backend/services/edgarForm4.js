/**
 * SEC EDGAR Form 4 Parser Service
 *
 * Fetches and parses Form 4 XML filings directly from SEC EDGAR.
 * Provides enriched insider trade data: title, price per share, transaction value, holdings.
 *
 * Data flow:
 *   1. Discover filings via existing RSS feed (secEdgar.js pattern)
 *   2. For each filing, fetch the filing index page to find the XML filename
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

// ─── EDGAR Filing Index Fetcher ───────────────────────────────────────────────

/**
 * Given a filing index URL (e.g. https://www.sec.gov/Archives/edgar/data/CIK/ACCESSION-idx.htm),
 * fetch the filing index JSON/HTML to find the Form 4 XML filename.
 *
 * EDGAR filing index JSON endpoint:
 * https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=...&type=4&...
 *
 * For accession-based index:
 * https://www.sec.gov/Archives/edgar/data/{CIK}/{accession-no-dashes}/
 * The index JSON: https://data.sec.gov/submissions/CIK{padded10}.json
 *
 * Simpler: fetch {accessionUrl}-index.json
 */
async function _fetchFilingXmlUrl(filingIndexUrl) {
  // Convert the filing URL to a JSON index URL
  // Input: https://www.sec.gov/Archives/edgar/data/CIK/ACCESSION-nnn.txt
  // or:    https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=...
  // We want the accession folder listing

  try {
    // Pattern: .../Archives/edgar/data/{cik}/{accession}/
    const archivesMatch = filingIndexUrl.match(/\/Archives\/edgar\/data\/(\d+)\/([0-9-]+)/);
    if (!archivesMatch) return null;

    const cik = archivesMatch[1];
    const accessionRaw = archivesMatch[2];
    const accessionNoDashes = accessionRaw.replace(/-/g, '');
    const accessionDashed = accessionNoDashes.replace(/(\d{10})(\d{18})/, '$1-$2')
      .replace(/^(\d+)-(\d{10})(\d{8})$/, '$1-$2-$3'); // try to normalize

    // The JSON index for this filing
    const indexJsonUrl = `${SEC_BASE}/Archives/edgar/data/${cik}/${accessionNoDashes}/${accessionNoDashes}-index.json`;

    const resp = await _secFetch(indexJsonUrl, { timeout: 10000 });
    const indexData = resp.data;

    if (indexData && indexData.directory && indexData.directory.item) {
      const items = Array.isArray(indexData.directory.item)
        ? indexData.directory.item
        : [indexData.directory.item];

      // Find the XML file (Form 4 XML is usually named like "wf-form4-*.xml" or just "*.xml")
      const xmlFile = items.find(f =>
        f.name && f.name.endsWith('.xml') &&
        !f.name.toLowerCase().includes('primary_doc') &&
        (f.type === '4' || f.name.toLowerCase().includes('form4') || f.name.toLowerCase().includes('wf-form4') || !f.name.toLowerCase().includes('filing'))
      ) || items.find(f => f.name && f.name.endsWith('.xml'));

      if (xmlFile) {
        return `${SEC_BASE}/Archives/edgar/data/${cik}/${accessionNoDashes}/${xmlFile.name}`;
      }
    }
    return null;
  } catch (err) {
    // Silently fail — filing XML URL resolution is best-effort
    return null;
  }
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

/**
 * Convert an 18-digit accession number to the dashed SEC format.
 * Example: "000035419026000093" -> "0000354190-26-000093"
 */
function _toDashedAccession(acc) {
  const clean = acc.replace(/-/g, '');
  if (clean.length !== 18) return acc; // already dashed or unknown format
  return `${clean.slice(0, 10)}-${clean.slice(10, 12)}-${clean.slice(12)}`;
}

// ─── RSS Feed Discovery ───────────────────────────────────────────────────────

/**
 * Fetch the EDGAR RSS feed of recent Form 4 filings.
 * Returns raw RSS items with filing URLs.
 */
async function _fetchRssFeed(count = 40) {
  const url = `${SEC_BASE}/cgi-bin/browse-edgar?action=getcurrent&type=4&dateb=&owner=include&count=${count}&search_text=&output=atom`;

  const resp = await _secFetch(url, { timeout: 20000 });
  const xml = resp.data;

  // Parse entries from Atom feed
  const entries = _extractXmlBlocks(xml, 'entry');
  return entries.map(entry => {
    const title = _extractXmlValue(entry, 'title') || '';
    const link = (() => {
      const m = entry.match(/<link[^>]+href="([^"]+)"/i);
      return m ? m[1] : null;
    })();
    const updated = _extractXmlValue(entry, 'updated') || '';
    const summary = _extractXmlValue(entry, 'summary') || '';

    // Extract CIK and accession from link
    // URL: /Archives/edgar/data/{CIK}/{AccNoDashes}/{AccDashed}-index.htm
    let cik = null, accession = null, accessionDashed = null;
    if (link) {
      const archMatch = link.match(/\/Archives\/edgar\/data\/(\d+)\/(\d{18})\//);
      if (archMatch) {
        cik = archMatch[1];
        accession = archMatch[2]; // 18-digit no-dashes version
        // Extract the dashed version from the filename
        const dashedMatch = link.match(/\/(\d{10}-\d{2}-\d{6})-index\./);
        accessionDashed = dashedMatch ? dashedMatch[1] : _toDashedAccession(accession);
      }
    }

    return { title, link, updated, summary, cik, accession, accessionDashed };
  });
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Given a filing index URL (the HTML index page from SEC EDGAR),
 * fetch it and extract the XML filename for the Form 4 document.
 * Returns null if not found.
 */
async function _findXmlFromIndex(indexUrl) {
  try {
    const resp = await _secFetch(indexUrl, { timeout: 8000 });
    const html = typeof resp.data === 'string' ? resp.data : '';

    // Look for .xml links that are NOT the XSL-transformed version
    // Pattern: href="/Archives/edgar/data/.../something.xml" (not in xslF345X05 dir)
    const xmlMatches = [...html.matchAll(/href="(\/Archives\/edgar\/data\/[^"]+\.xml)"/gi)];
    for (const m of xmlMatches) {
      const href = m[1];
      if (!href.includes('/xslF345X05/')) {
        return SEC_BASE + href;
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Get enriched insider trades for a batch of recent Form 4 filings.
 * Discovers filings via RSS, enriches each with XML parse.
 * Cache: 30 minutes.
 *
 * @param {Object} opts
 * @param {number} opts.count  - Number of RSS entries to process (default 40)
 * @param {number} opts.maxXmlFetch - Max XML files to actually fetch (default 25)
 */
async function getBatchInsiderTrades({ count = 40, maxXmlFetch = 25 } = {}) {
  const cacheKey = `edgar:form4:batch:v2:${count}:${maxXmlFetch}`;

  return cache.cacheAPICall(cacheKey, async () => {
    const startTime = Date.now();

    let rssItems;
    try {
      rssItems = await _fetchRssFeed(count);
    } catch (err) {
      console.error('[EDGAR Form4] RSS fetch error:', err.message);
      return [];
    }

    // Deduplicate by accession number — the RSS returns both reporter and issuer entries
    const seen = new Set();
    const uniqueItems = [];
    for (const item of rssItems) {
      // Use accession or link as dedup key
      const key = item.accessionDashed || item.link || item.title;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueItems.push(item);
      }
    }

    const results = [];
    const toFetch = uniqueItems.slice(0, maxXmlFetch);

    for (const item of toFetch) {
      // Abort if taking too long (>9s budget for XML fetching)
      if (Date.now() - startTime > 9000) {
        console.warn('[EDGAR Form4] Batch timeout — returning partial results');
        break;
      }

      try {
        let xmlUrl = null;

        // Strategy: fetch the filing index HTML to find the XML file
        if (item.link) {
          xmlUrl = await _findXmlFromIndex(item.link);
        }

        if (xmlUrl) {
          const parsed = await _fetchAndParseXml(xmlUrl);
          if (parsed && parsed.length > 0) {
            const filingLink = item.link || xmlUrl;
            for (const record of parsed) {
              record.filingUrl = record.filingUrl || filingLink;
              if (!record.date && item.updated) {
                record.date = item.updated.split('T')[0];
              }
              results.push(record);
            }
            continue;
          }
        }

        // Fallback: minimal record from RSS data
        results.push({
          ticker: null,
          companyName: null,
          name: null,
          officerTitle: null,
          isDirector: false,
          isOfficer: false,
          isTenPercentOwner: false,
          transactionType: null,
          shares: null,
          pricePerShare: null,
          transactionValue: null,
          holdingsAfter: null,
          date: item.updated ? item.updated.split('T')[0] : null,
          source: 'SEC EDGAR',
          filingUrl: item.link || null,
          category: 'insider',
          filingType: '4',
          _rssTitle: item.title,
        });
      } catch (err) {
        console.warn('[EDGAR Form4] Error processing filing:', err.message);
      }
    }

    return results;
  }, 30 * 60); // 30 min cache
}

/**
 * Get enriched insider trades for a specific ticker symbol.
 * Cache: 15 minutes.
 */
async function getInsiderTradesBySymbol(symbol) {
  const cacheKey = `edgar:form4:symbol:${symbol.toUpperCase()}`;

  return cache.cacheAPICall(cacheKey, async () => {
    const upperSymbol = symbol.toUpperCase();

    // Use EDGAR full-text search to find recent Form 4 filings for this company
    const today = new Date().toISOString().split('T')[0];
    const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 3600 * 1000).toISOString().split('T')[0];

    let filings = [];

    try {
      await _secDelay();
      // Search by ticker symbol using EDGAR EFTS
      const searchUrl = `https://efts.sec.gov/LATEST/search-index?q=%22${encodeURIComponent(upperSymbol)}%22&forms=4&dateRange=custom&startdt=${sixMonthsAgo}&enddt=${today}&hits.hits._source=period_of_report,file_date,entity_name,file_num&hits.hits.total.value=true`;
      const resp = await axios.get(searchUrl, {
        headers: SEC_HEADERS,
        timeout: 12000,
      });
      _lastRequestTime = Date.now();

      const hits = resp.data?.hits?.hits || [];
      filings = hits.slice(0, 20).map(h => ({
        entityId: h._source?.entity_id,
        cik: h._id ? h._id.split(':')[0] : null,
        accession: h._id ? h._id.split(':')[1] : null,
        fileDate: h._source?.file_date,
      }));
    } catch (err) {
      // Fall back to CIK-based RSS search
      try {
        const atomUrl = `${SEC_BASE}/cgi-bin/browse-edgar?company=&CIK=${encodeURIComponent(upperSymbol)}&type=4&dateb=&owner=include&count=20&search_text=&action=getcompany&output=atom`;
        const resp = await _secFetch(atomUrl, { timeout: 15000 });
        const xml = resp.data;

        const entries = _extractXmlBlocks(xml, 'entry');
        for (const entry of entries.slice(0, 15)) {
          const link = (() => {
            const m = entry.match(/<link[^>]+href="([^"]+)"/i);
            return m ? m[1] : null;
          })();
          if (!link) continue;

          const cikMatch = link.match(/CIK=(\d+)/i) || link.match(/\/data\/(\d+)\//);
          const accMatch = link.match(/accession-number=([0-9-]+)/i);

          filings.push({
            cik: cikMatch ? cikMatch[1] : null,
            accession: accMatch ? accMatch[1] : null,
            link,
          });
        }
      } catch (err2) {
        console.error('[EDGAR Form4] Symbol search error:', err2.message);
        return [];
      }
    }

    const results = [];

    for (const filing of filings.slice(0, 15)) {
      // Need either a link or cik+accession to proceed
      if (!filing.link && (!filing.cik || !filing.accession)) continue;

      try {
        let xmlUrl = null;

        if (filing.link) {
          // Use the filing index HTML to find the XML
          xmlUrl = await _findXmlFromIndex(filing.link);
        } else if (filing.cik && filing.accession) {
          const accNoDashes = filing.accession.replace(/-/g, '');
          const accDashed = _toDashedAccession(accNoDashes);
          const indexUrl = `${SEC_BASE}/Archives/edgar/data/${filing.cik}/${accNoDashes}/${accDashed}-index.htm`;
          xmlUrl = await _findXmlFromIndex(indexUrl);
        }

        if (xmlUrl) {
          const parsed = await _fetchAndParseXml(xmlUrl);
          if (parsed) {
            for (const record of parsed) {
              if (!record.date && filing.fileDate) record.date = filing.fileDate;
              results.push(record);
            }
          }
        }
      } catch (err) {
        console.warn('[EDGAR Form4] Symbol filing error:', err.message);
      }
    }

    return results;
  }, 15 * 60); // 15 min cache
}

module.exports = {
  getBatchInsiderTrades,
  getInsiderTradesBySymbol,
  parseForm4Xml, // exported for testing
};
