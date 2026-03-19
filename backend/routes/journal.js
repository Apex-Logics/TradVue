/**
 * Journal Routes — CSV Trade Import
 * 
 * POST /api/journal/import  — Upload CSV, parse trades, return normalized entries
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const { parse } = require('csv-parse/sync');
const { optionalAuth } = require('../middleware/auth');

// ── Multer config: 5MB max, CSV only ─────────────────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are accepted'));
    }
  },
});

// ── Format Parsers ────────────────────────────────────────────────────────────

/**
 * Generic format:
 * date, ticker, side (buy/sell), quantity, price, total, fees
 */
function parseGeneric(records) {
  const trades = [];
  for (const row of records) {
    const keys = Object.keys(row);
    // Flexible column matching (case-insensitive, trimmed)
    const get = (candidates) => {
      for (const c of candidates) {
        const found = keys.find(k => k.trim().toLowerCase() === c.toLowerCase());
        if (found && row[found] != null && String(row[found]).trim() !== '') return String(row[found]).trim();
      }
      return '';
    };

    const date = get(['date', 'trade_date', 'trade date', 'execution date']);
    const ticker = get(['ticker', 'symbol', 'stock', 'instrument']);
    const side = get(['side', 'direction', 'action', 'type', 'buy/sell']);
    const quantity = get(['quantity', 'qty', 'shares', 'size', 'position_size']);
    const price = get(['price', 'fill_price', 'fill price', 'execution_price', 'avg_price']);
    const total = get(['total', 'amount', 'net_amount', 'net amount', 'proceeds']);
    const fees = get(['fees', 'commission', 'commissions', 'fee']);

    if (!date || !ticker || !side) continue;

    const qty = parseFloat(quantity) || 0;
    const px = parseFloat(price) || 0;
    const totalAmt = parseFloat(total) || (qty * px);
    const feeAmt = parseFloat(fees) || 0;

    trades.push({
      date: normalizeDate(date),
      time: '',
      symbol: ticker.toUpperCase(),
      side: normalizeSide(side),
      quantity: qty,
      price: px,
      total: totalAmt,
      fees: feeAmt,
    });
  }
  return trades;
}

/**
 * Robinhood format:
 * Activity Date, Process Date, Settle Date, Instrument, Description,
 * Trans Code, Quantity, Price, Amount
 */
function parseRobinhood(records) {
  const trades = [];
  for (const row of records) {
    const keys = Object.keys(row);
    const get = (candidates) => {
      for (const c of candidates) {
        const found = keys.find(k => k.trim().toLowerCase().includes(c.toLowerCase()));
        if (found && row[found] != null && String(row[found]).trim() !== '') return String(row[found]).trim();
      }
      return '';
    };

    const date = get(['Activity Date', 'activity']);
    const instrument = get(['Instrument', 'Symbol', 'instrument']);
    const desc = get(['Description', 'description', 'desc']);
    const transCode = get(['Trans Code', 'trans', 'transaction']);
    const quantity = get(['Quantity', 'qty']);
    const price = get(['Price', 'price']);
    const amount = get(['Amount', 'amount']);

    // Only include buy/sell transactions
    const code = transCode.toUpperCase();
    if (!code.includes('BUY') && !code.includes('SELL') && !code.includes('STO') && !code.includes('STC')) {
      // Check description for buy/sell signals
      const descUp = desc.toUpperCase();
      if (!descUp.includes('BUY') && !descUp.includes('SELL') && !descUp.includes('BOUGHT') && !descUp.includes('SOLD')) {
        continue;
      }
    }

    if (!date || !instrument) continue;

    const qty = Math.abs(parseFloat(quantity) || 0);
    const px = parseFloat(price?.replace('$', '').replace(',', '')) || 0;
    const amt = parseFloat(amount?.replace('$', '').replace(',', '').replace('(', '-').replace(')', '')) || 0;

    let side = 'buy';
    if (code.includes('SELL') || code.includes('STC') || desc.toUpperCase().includes('SELL') || desc.toUpperCase().includes('SOLD')) {
      side = 'sell';
    }

    trades.push({
      date: normalizeDate(date),
      time: '',
      symbol: instrument.toUpperCase(),
      side,
      quantity: qty,
      price: px,
      total: Math.abs(amt),
      fees: 0, // Robinhood is commission-free
    });
  }
  return trades;
}

/**
 * Interactive Brokers format (Activity Statement - Trades section):
 * Symbol, Date/Time, Quantity, T. Price, C. Price, Proceeds, Comm/Fee, Basis, Realized P&L, Code
 */
function parseInteractiveBrokers(records) {
  const trades = [];
  for (const row of records) {
    const keys = Object.keys(row);
    const get = (candidates) => {
      for (const c of candidates) {
        const found = keys.find(k => k.trim().toLowerCase().includes(c.toLowerCase()));
        if (found && row[found] != null && String(row[found]).trim() !== '') return String(row[found]).trim();
      }
      return '';
    };

    // Skip header/summary rows
    const header = get(['Header', 'DataDiscriminator', 'header']);
    if (header && (header.toLowerCase() === 'header' || header.toLowerCase() === 'total' || header.toLowerCase() === 'subtotal')) {
      continue;
    }

    const symbol = get(['Symbol', 'symbol']);
    const dateTime = get(['Date/Time', 'DateTime', 'TradeDate', 'date']);
    const quantity = get(['Quantity', 'qty']);
    const tPrice = get(['T. Price', 'Trade Price', 'Price', 'price']);
    const proceeds = get(['Proceeds', 'proceeds']);
    const commFee = get(['Comm/Fee', 'Commission', 'Comm', 'comm', 'fee']);
    const realizedPnl = get(['Realized P&L', 'Realized P/L', 'realized']);

    if (!symbol || !dateTime) continue;

    const qty = parseFloat(quantity?.replace(',', '')) || 0;
    const px = parseFloat(tPrice?.replace(',', '')) || 0;
    const proc = parseFloat(proceeds?.replace(',', '')) || 0;
    const comm = Math.abs(parseFloat(commFee?.replace(',', '')) || 0);

    // Parse IB date format (YYYY-MM-DD, HH:MM:SS or MM/DD/YYYY)
    let dateStr = '', timeStr = '';
    if (dateTime.includes(',')) {
      const parts = dateTime.split(',');
      dateStr = parts[0].trim();
      timeStr = parts[1]?.trim() || '';
    } else if (dateTime.includes(' ')) {
      const parts = dateTime.split(' ');
      dateStr = parts[0].trim();
      timeStr = parts[1]?.trim() || '';
    } else {
      dateStr = dateTime;
    }

    trades.push({
      date: normalizeDate(dateStr),
      time: timeStr.slice(0, 5), // HH:MM
      symbol: symbol.toUpperCase().split(' ')[0], // Remove option suffixes for now
      side: qty >= 0 ? 'buy' : 'sell',
      quantity: Math.abs(qty),
      price: px,
      total: Math.abs(proc),
      fees: comm,
    });
  }
  return trades;
}


/**
 * Robinhood Activity Report format (real Robinhood account export):
 * Activity Date, Process Date, Settle Date, Instrument, Description,
 * Trans Code, Quantity, Price, Amount
 *
 * Trans Codes: Buy/Sell (stocks), BTO/BTC (buy option), STO/STC (sell option)
 * Non-trade codes to skip: CDIV, ACATS, JNLS, DFEE, MLD, MISC, SPL, etc.
 */
function parseRobinhoodActivity(records) {
  const BUY_CODES  = new Set(['BUY', 'BTO', 'BTC'])
  const SELL_CODES = new Set(['SELL', 'STO', 'STC'])

  const trades = [];
  for (const row of records) {
    const keys = Object.keys(row);
    const get = (candidates) => {
      for (const c of candidates) {
        const found = keys.find(k => k.trim().toLowerCase().includes(c.toLowerCase()));
        if (found && row[found] != null && String(row[found]).trim() !== '') return String(row[found]).trim();
      }
      return '';
    };

    const activityDate = get(['Activity Date', 'activity date']);
    const instrument   = get(['Instrument', 'instrument', 'Symbol', 'symbol']).toUpperCase();
    const description  = get(['Description', 'description']);
    const transCode    = get(['Trans Code', 'trans code', 'transcode']).toUpperCase().trim();
    const quantity     = get(['Quantity', 'quantity', 'qty']);
    const price        = get(['Price', 'price']);
    const amount       = get(['Amount', 'amount']);

    // Must have a date and instrument
    if (!activityDate || !instrument) continue;

    // Determine side from Trans Code
    let side;
    if (BUY_CODES.has(transCode)) {
      side = 'buy';
    } else if (SELL_CODES.has(transCode)) {
      side = 'sell';
    } else {
      // Check description fallback for ambiguous codes
      const descUp = description.toUpperCase();
      if (descUp.includes('BOUGHT') || descUp.includes('BUY')) side = 'buy';
      else if (descUp.includes('SOLD') || descUp.includes('SELL')) side = 'sell';
      else continue; // skip non-trade rows (dividends, transfers, fees)
    }

    const qty = Math.abs(parseFloat(quantity) || 0);
    const px  = parseFloat(price.replace('$', '').replace(',', '')) || 0;
    const amt = Math.abs(parseFloat(amount.replace('$', '').replace(',', '').replace('(', '-').replace(')', '')) || 0);

    if (qty === 0 && px === 0) continue; // skip empty rows

    trades.push({
      date: normalizeDate(activityDate),
      time: '',
      symbol: instrument,
      side,
      quantity: qty,
      price: px || (qty > 0 ? amt / qty : 0),
      total: amt || qty * px,
      fees: 0,  // Robinhood is commission-free
    });
  }
  return trades;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function normalizeDate(raw) {
  if (!raw) return '';
  // Try parsing common formats
  const cleaned = raw.trim();

  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) return cleaned;

  // MM/DD/YYYY or M/D/YYYY
  const mdyMatch = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdyMatch) {
    return `${mdyMatch[3]}-${mdyMatch[1].padStart(2, '0')}-${mdyMatch[2].padStart(2, '0')}`;
  }

  // DD/MM/YYYY (ambiguous — assume MM/DD for US brokers)
  // MM-DD-YYYY
  const mdyDash = cleaned.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (mdyDash) {
    return `${mdyDash[3]}-${mdyDash[1].padStart(2, '0')}-${mdyDash[2].padStart(2, '0')}`;
  }

  // YYYYMMDD
  const compact = cleaned.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (compact) {
    return `${compact[1]}-${compact[2]}-${compact[3]}`;
  }

  // Fall back to Date constructor
  try {
    const d = new Date(cleaned);
    if (!isNaN(d.getTime())) {
      return d.toISOString().slice(0, 10);
    }
  } catch {}

  return cleaned;
}

function normalizeSide(raw) {
  const s = raw.toLowerCase().trim();
  if (s.includes('buy') || s.includes('long') || s === 'b') return 'buy';
  if (s.includes('sell') || s.includes('short') || s === 's') return 'sell';
  return s;
}

/**
 * Group buy/sell pairs by symbol+date into round-trip trades
 * Returns trade objects compatible with the frontend Trade type
 */
function pairTrades(rawTrades) {
  // Group by symbol
  const bySymbol = {};
  rawTrades.forEach(t => {
    if (!bySymbol[t.symbol]) bySymbol[t.symbol] = [];
    bySymbol[t.symbol].push(t);
  });

  const paired = [];
  for (const [symbol, trades] of Object.entries(bySymbol)) {
    const buys = trades.filter(t => t.side === 'buy').sort((a, b) => a.date.localeCompare(b.date));
    const sells = trades.filter(t => t.side === 'sell').sort((a, b) => a.date.localeCompare(b.date));

    // Match buys with sells
    const minPairs = Math.min(buys.length, sells.length);
    for (let i = 0; i < minPairs; i++) {
      const buy = buys[i];
      const sell = sells[i];
      const qty = Math.min(buy.quantity, sell.quantity) || buy.quantity || sell.quantity;
      const pnl = (sell.price - buy.price) * qty - (buy.fees + sell.fees);

      paired.push({
        date: buy.date,
        time: buy.time || sell.time || '',
        symbol,
        assetClass: 'Stock',
        direction: 'Long',
        entryPrice: buy.price,
        exitPrice: sell.price,
        positionSize: qty,
        stopLoss: 0,
        takeProfit: 0,
        commissions: buy.fees + sell.fees,
        pnl: Math.round(pnl * 100) / 100,
        rMultiple: 0,
        pctGainLoss: buy.price ? Math.round(((sell.price - buy.price) / buy.price) * 10000) / 100 : 0,
        holdMinutes: 0,
        setupTag: '',
        mistakeTag: 'None',
        rating: 3,
        notes: `Imported from CSV`,
      });
    }

    // Unmatched trades — add as single-leg entries
    const unmatchedBuys = buys.slice(minPairs);
    const unmatchedSells = sells.slice(minPairs);

    [...unmatchedBuys, ...unmatchedSells].forEach(t => {
      paired.push({
        date: t.date,
        time: t.time || '',
        symbol,
        assetClass: 'Stock',
        direction: t.side === 'buy' ? 'Long' : 'Short',
        entryPrice: t.price,
        exitPrice: 0,
        positionSize: t.quantity,
        stopLoss: 0,
        takeProfit: 0,
        commissions: t.fees,
        pnl: 0,
        rMultiple: 0,
        pctGainLoss: 0,
        holdMinutes: 0,
        setupTag: '',
        mistakeTag: 'None',
        rating: 3,
        notes: `Imported from CSV (unmatched ${t.side})`,
        _unmatched: true,
      });
    });
  }

  return paired;
}

// ── Routes ────────────────────────────────────────────────────────────────────

/**
 * POST /api/journal/import
 * Body: multipart form with `file` (CSV) and `format` (generic|robinhood|ibkr)
 * Optional: `pair` (true|false) — whether to auto-pair buy/sell into round-trips
 * 
 * Returns: { trades: [...], rawCount: number, pairedCount: number }
 */
router.post('/import', optionalAuth, upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No CSV file uploaded' });
    }

    const format = (req.body.format || 'generic').toLowerCase();
    const shouldPair = req.body.pair !== 'false';

    // Parse CSV
    const csvText = req.file.buffer.toString('utf-8');
    let records;
    try {
      records = parse(csvText, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        relax_column_count: true,
        bom: true,
      });
    } catch (err) {
      return res.status(400).json({ error: `CSV parsing error: ${err.message}` });
    }

    if (records.length === 0) {
      return res.status(400).json({ error: 'CSV file is empty or has no valid rows' });
    }

    // Parse by format
    let rawTrades;
    switch (format) {
      case 'robinhood':
        rawTrades = parseRobinhood(records);
        break;
      case 'robinhood_activity':
      case 'robinhoodactivity':
        rawTrades = parseRobinhoodActivity(records);
        break;
      case 'ibkr':
      case 'interactive_brokers':
        rawTrades = parseInteractiveBrokers(records);
        break;
      case 'generic':
      default:
        rawTrades = parseGeneric(records);
        break;
    }

    if (rawTrades.length === 0) {
      return res.status(400).json({
        error: 'No valid trades found in CSV. Check format selection and column headers.',
        detectedColumns: records.length > 0 ? Object.keys(records[0]) : [],
      });
    }

    // Optionally pair buy/sell into round-trips
    const result = shouldPair ? pairTrades(rawTrades) : rawTrades;

    res.json({
      trades: result,
      rawCount: rawTrades.length,
      pairedCount: result.length,
      format,
      paired: shouldPair,
    });
  } catch (err) {
    console.error('[Journal Import] Error:', err);
    res.status(500).json({ error: 'Failed to process CSV import' });
  }
});

/**
 * POST /api/journal/import/preview
 * Same as /import but returns only first 10 rows for preview
 */
router.post('/import/preview', optionalAuth, upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No CSV file uploaded' });
    }

    const csvText = req.file.buffer.toString('utf-8');
    let records;
    try {
      records = parse(csvText, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        relax_column_count: true,
        bom: true,
        to: 20, // Only parse first 20 rows for preview
      });
    } catch (err) {
      return res.status(400).json({ error: `CSV parsing error: ${err.message}` });
    }

    const columns = records.length > 0 ? Object.keys(records[0]) : [];
    const sampleRows = records.slice(0, 5);

    res.json({
      columns,
      sampleRows,
      totalRows: records.length,
    });
  } catch (err) {
    console.error('[Journal Preview] Error:', err);
    res.status(500).json({ error: 'Failed to preview CSV' });
  }
});

/**
 * GET /api/journal/export?format=json|csv
 * Returns journal trades in requested format.
 * Currently a stub — frontend handles exports client-side via localStorage.
 * This endpoint will be functional when trades are stored server-side.
 */
router.get('/export', optionalAuth, (req, res) => {
  const format = (req.query.format || 'json').toLowerCase();
  // Stub — frontend handles this client-side for now
  res.json({
    message: 'Journal export is handled client-side. Use the Export button in the UI.',
    format,
    note: 'This endpoint will serve exports when server-side trade storage is implemented.',
  });
});

module.exports = router;
