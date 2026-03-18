/**
 * Insider Trade Store — Persistent Supabase ingestion service.
 *
 * Rolling 90-day window: records older than 90 days are pruned after every
 * ingestion cycle to keep the table small (~5,000–10,000 rows, ~5MB max).
 *
 * Every record has a traceable source for liability:
 *   - filing_url:        direct link to the SEC Form 4 XML file
 *   - accession_number:  SEC unique filing identifier (e.g. 0001628280-26-019134)
 *   - cik:               SEC Central Index Key for the company
 *   - source:            'SEC EDGAR' | 'Finnhub'
 *   - source_api:        'EFTS' | 'Finnhub'
 */

'use strict';

const db = require('./db');

// ─── Table Bootstrap ──────────────────────────────────────────────────────────

async function ensureTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS insider_trades (
      id SERIAL PRIMARY KEY,
      ticker VARCHAR(10) NOT NULL,
      company_name VARCHAR(255),
      insider_name VARCHAR(255) NOT NULL,
      officer_title VARCHAR(255),
      transaction_type VARCHAR(50) NOT NULL,
      shares NUMERIC,
      price_per_share NUMERIC(12,4),
      transaction_value NUMERIC(14,2),
      holdings_after NUMERIC,
      filing_date DATE NOT NULL,
      filing_url TEXT,
      accession_number VARCHAR(30),
      cik VARCHAR(15),
      source VARCHAR(20) NOT NULL DEFAULT 'SEC EDGAR',
      source_api VARCHAR(20),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(ticker, insider_name, filing_date, transaction_type, shares)
    )
  `);

  await db.query(`CREATE INDEX IF NOT EXISTS idx_insider_trades_ticker ON insider_trades(ticker)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_insider_trades_date ON insider_trades(filing_date DESC)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_insider_trades_type ON insider_trades(transaction_type)`);

  // RLS: public read — SEC filings are public data, no user-level access control needed
  try {
    await db.query(`ALTER TABLE insider_trades ENABLE ROW LEVEL SECURITY`);
    await db.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_policies
          WHERE tablename = 'insider_trades' AND policyname = 'public_read'
        ) THEN
          CREATE POLICY public_read ON insider_trades FOR SELECT USING (true);
        END IF;
      END
      $$
    `);
  } catch (err) {
    // Non-fatal: may fail if running as non-superuser
    console.warn('[InsiderTradeStore] RLS setup skipped (non-fatal):', err.message);
  }

  console.log('[InsiderTradeStore] Table ready: insider_trades');
}

// ─── 90-Day Pruning ───────────────────────────────────────────────────────────

/**
 * Delete records older than 90 days.
 * Called after every ingestion cycle to keep the table within ~5MB.
 * Estimated max rows: ~10,000 * 500 bytes = 5MB.
 */
async function pruneOldRecords() {
  try {
    const result = await db.query(
      `DELETE FROM insider_trades WHERE filing_date < NOW() - INTERVAL '90 days'`
    );
    if (result.rowCount > 0) {
      console.log(`[InsiderTradeStore] Pruned ${result.rowCount} records older than 90 days`);
    }
    return result.rowCount;
  } catch (err) {
    console.warn('[InsiderTradeStore] Prune error (non-fatal):', err.message);
    return 0;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function _extractAccessionFromUrl(url) {
  if (!url) return null;
  // Pattern: /Archives/edgar/data/{cik}/{18-digit-accession}/{filename}
  const m = url.match(/\/Archives\/edgar\/data\/\d+\/(\d{18})\//);
  if (!m) return null;
  const raw = m[1]; // e.g. "000162828026019134"
  return `${raw.slice(0, 10)}-${raw.slice(10, 12)}-${raw.slice(12)}`; // "0001628280-26-019134"
}

function _extractCikFromUrl(url) {
  if (!url) return null;
  const m = url.match(/\/Archives\/edgar\/data\/(\d+)\//);
  return m ? m[1] : null;
}

// ─── Ingestion: EDGAR ─────────────────────────────────────────────────────────

/**
 * Ingest EDGAR Form 4 trades into the database.
 * Requires: ticker, insider_name, filing_date, transaction_type.
 * Uses ON CONFLICT DO NOTHING — no overwrites, no duplicates.
 */
async function ingestFromEdgar(trades) {
  if (!trades || trades.length === 0) return { inserted: 0, skipped: 0 };

  let inserted = 0;
  let skipped = 0;

  for (const trade of trades) {
    const ticker = (trade.ticker || '').trim().toUpperCase();
    const insiderName = (trade.name || '').trim();
    const filingDate = trade.date || null;
    const transactionType = (trade.transactionType || '').trim();

    if (!ticker || !insiderName || !filingDate || !transactionType) {
      skipped++;
      continue;
    }

    const filingUrl = trade.filingUrl || null;
    const accessionNumber = _extractAccessionFromUrl(filingUrl);
    const cik = _extractCikFromUrl(filingUrl);

    try {
      const result = await db.query(
        `INSERT INTO insider_trades (
          ticker, company_name, insider_name, officer_title,
          transaction_type, shares, price_per_share, transaction_value,
          holdings_after, filing_date, filing_url, accession_number,
          cik, source, source_api
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'SEC EDGAR','EFTS')
        ON CONFLICT (ticker, insider_name, filing_date, transaction_type, shares)
        DO NOTHING`,
        [
          ticker,
          trade.companyName || null,
          insiderName,
          trade.officerTitle || null,
          transactionType,
          trade.shares || null,
          trade.pricePerShare || null,
          trade.transactionValue || null,
          trade.holdingsAfter || null,
          filingDate,
          filingUrl,
          accessionNumber,
          cik,
        ]
      );
      if (result.rowCount > 0) inserted++;
      else skipped++;
    } catch (err) {
      console.warn('[InsiderTradeStore] EDGAR insert error:', err.message, { ticker, insiderName, filingDate });
      skipped++;
    }
  }

  console.log(`[InsiderTradeStore] EDGAR ingest — inserted: ${inserted}, skipped: ${skipped}`);
  return { inserted, skipped };
}

// ─── Ingestion: Finnhub ───────────────────────────────────────────────────────

/**
 * Ingest Finnhub trades into the database.
 * Finnhub has less data: no filing_url, no accession_number, no officer_title.
 * If a matching EDGAR record already exists, skip the Finnhub duplicate.
 */
async function ingestFromFinnhub(trades) {
  if (!trades || trades.length === 0) return { inserted: 0, skipped: 0 };

  let inserted = 0;
  let skipped = 0;

  for (const trade of trades) {
    const ticker = (trade.ticker || '').trim().toUpperCase();
    const insiderName = (trade.name || '').trim();
    const filingDate = trade.date || null;
    const transactionType = (trade.transactionType || '').trim();

    if (!ticker || !insiderName || !filingDate || !transactionType) {
      skipped++;
      continue;
    }

    try {
      // Prefer EDGAR — skip if a richer record already covers this trade
      const existing = await db.query(
        `SELECT id FROM insider_trades
         WHERE ticker = $1
           AND LOWER(insider_name) = LOWER($2)
           AND filing_date = $3
           AND LOWER(transaction_type) = LOWER($4)
           AND source = 'SEC EDGAR'
         LIMIT 1`,
        [ticker, insiderName, filingDate, transactionType]
      );

      if (existing.rows.length > 0) {
        skipped++;
        continue;
      }

      const result = await db.query(
        `INSERT INTO insider_trades (
          ticker, company_name, insider_name, officer_title,
          transaction_type, shares, price_per_share, transaction_value,
          holdings_after, filing_date, filing_url, accession_number,
          cik, source, source_api
        ) VALUES ($1,$2,$3,NULL,$4,$5,NULL,NULL,NULL,$6,$7,NULL,NULL,'Finnhub','Finnhub')
        ON CONFLICT (ticker, insider_name, filing_date, transaction_type, shares)
        DO NOTHING`,
        [
          ticker,
          trade.companyName || null,
          insiderName,
          transactionType,
          trade.shares || null,
          filingDate,
          trade.filingUrl || null,
        ]
      );
      if (result.rowCount > 0) inserted++;
      else skipped++;
    } catch (err) {
      console.warn('[InsiderTradeStore] Finnhub insert error:', err.message, { ticker, insiderName, filingDate });
      skipped++;
    }
  }

  console.log(`[InsiderTradeStore] Finnhub ingest — inserted: ${inserted}, skipped: ${skipped}`);
  return { inserted, skipped };
}

// ─── Full Ingestion Cycle ─────────────────────────────────────────────────────

/**
 * Run a full ingestion cycle: ingest EDGAR + Finnhub, then prune old records.
 * Call this after every successful fetch.
 */
async function runIngestionCycle(edgarTrades, finnhubTrades) {
  const edgarResult = await ingestFromEdgar(edgarTrades);
  const finnhubResult = await ingestFromFinnhub(finnhubTrades);
  const pruned = await pruneOldRecords();
  return { edgarResult, finnhubResult, pruned };
}

// ─── Query: Paginated Records ─────────────────────────────────────────────────

/**
 * Query persisted insider trades with pagination and filters.
 * All date filters are capped at 90 days — the storage window.
 *
 * @param {Object} opts
 * @param {number} opts.page    - 1-indexed page number (default 1)
 * @param {number} opts.limit   - Records per page, max 200 (default 50)
 * @param {string} opts.from    - Start date YYYY-MM-DD (max 90 days ago)
 * @param {string} opts.to      - End date YYYY-MM-DD
 * @param {string} opts.symbol  - Filter by ticker
 * @param {string} opts.type    - Filter by transaction_type (buy/sell/award/gift)
 * @param {string} opts.source  - Filter by source (edgar/finnhub)
 * @returns {{ data, total, sources }}
 */
async function queryTrades({ page = 1, limit = 50, from, to, symbol, type, source } = {}) {
  const safeLimit = Math.min(Math.max(1, parseInt(limit, 10) || 50), 200);
  const safePage = Math.max(1, parseInt(page, 10) || 1);
  const offset = (safePage - 1) * safeLimit;

  // Hard floor: never return data older than 90 days
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString().split('T')[0];
  const effectiveFrom = from && from > ninetyDaysAgo ? from : ninetyDaysAgo;

  const conditions = [`filing_date >= $1`];
  const params = [effectiveFrom];
  let idx = 2;

  if (to) {
    conditions.push(`filing_date <= $${idx++}`);
    params.push(to);
  }

  if (symbol) {
    conditions.push(`ticker = $${idx++}`);
    params.push(symbol.toUpperCase().trim());
  }

  if (type) {
    const t = type.toLowerCase();
    if (t === 'buy') {
      conditions.push(`(LOWER(transaction_type) LIKE '%buy%' OR LOWER(transaction_type) LIKE '%purchase%')`);
    } else if (t === 'sell') {
      conditions.push(`(LOWER(transaction_type) LIKE '%sell%' OR LOWER(transaction_type) LIKE '%sale%')`);
    } else if (t === 'award') {
      conditions.push(`LOWER(transaction_type) LIKE '%award%'`);
    } else if (t === 'gift') {
      conditions.push(`LOWER(transaction_type) LIKE '%gift%'`);
    } else {
      conditions.push(`LOWER(transaction_type) = LOWER($${idx++})`);
      params.push(type);
    }
  }

  if (source) {
    const s = source.toLowerCase();
    if (s === 'edgar') conditions.push(`source = 'SEC EDGAR'`);
    else if (s === 'finnhub') conditions.push(`source = 'Finnhub'`);
  }

  const where = `WHERE ${conditions.join(' AND ')}`;

  const countResult = await db.query(
    `SELECT COUNT(*) as total FROM insider_trades ${where}`,
    params
  );
  const total = parseInt(countResult.rows[0].total, 10);

  const dataResult = await db.query(
    `SELECT
      id, ticker, company_name, insider_name, officer_title,
      transaction_type, shares, price_per_share, transaction_value,
      holdings_after, filing_date, filing_url, accession_number,
      cik, source, source_api, created_at
    FROM insider_trades
    ${where}
    ORDER BY filing_date DESC, id DESC
    LIMIT $${idx++} OFFSET $${idx++}`,
    [...params, safeLimit, offset]
  );

  // Source breakdown totals (across entire table, not just current filter)
  const sourceResult = await db.query(
    `SELECT source, COUNT(*) as cnt FROM insider_trades GROUP BY source`
  );
  const sources = { edgar: 0, finnhub: 0 };
  for (const row of sourceResult.rows) {
    if (row.source === 'SEC EDGAR') sources.edgar = parseInt(row.cnt, 10);
    else if (row.source === 'Finnhub') sources.finnhub = parseInt(row.cnt, 10);
  }

  return { data: dataResult.rows, total, sources };
}

/**
 * Return total record count. Used to detect first-run (empty table).
 */
async function getRecordCount() {
  try {
    const result = await db.query('SELECT COUNT(*) as cnt FROM insider_trades');
    return parseInt(result.rows[0].cnt, 10);
  } catch (err) {
    return 0;
  }
}

module.exports = {
  ensureTable,
  ingestFromEdgar,
  ingestFromFinnhub,
  runIngestionCycle,
  pruneOldRecords,
  queryTrades,
  getRecordCount,
};
