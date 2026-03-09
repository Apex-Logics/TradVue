/**
 * Portfolio Routes — Supabase-backed
 *
 * All routes require JWT authentication.
 *
 * Holdings
 *   GET    /api/portfolio/holdings
 *   POST   /api/portfolio/holdings          — upsert (by symbol)
 *   DELETE /api/portfolio/holdings/:symbol
 *
 * Transactions (add shares / partial sell log)
 *   GET    /api/portfolio/transactions/:symbol
 *   POST   /api/portfolio/transactions
 *
 * Dividend overrides
 *   GET    /api/portfolio/dividends
 *   POST   /api/portfolio/dividends         — upsert one override
 *   DELETE /api/portfolio/dividends/:symbol/:year/:month
 *
 * Sold positions
 *   GET    /api/portfolio/sold
 *   POST   /api/portfolio/sold
 *   DELETE /api/portfolio/sold/:id
 *
 * Watchlist
 *   GET    /api/portfolio/watchlist
 *   POST   /api/portfolio/watchlist         — upsert (by symbol)
 *   DELETE /api/portfolio/watchlist/:symbol
 *
 * Bulk sync (for import-from-localStorage on login)
 *   POST   /api/portfolio/sync
 */

const express = require('express');
const router = express.Router();
const db = require('../services/db');
const { authenticateToken } = require('./auth');

// All portfolio routes require auth
router.use(authenticateToken);

// ─── Holdings ────────────────────────────────────────────────────────────────

router.get('/holdings', async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT * FROM portfolio_holdings WHERE user_id = $1 ORDER BY buy_date ASC, symbol ASC`,
      [req.user.userId]
    );
    res.json({ holdings: rows });
  } catch (e) {
    console.error('[Portfolio] GET holdings error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

router.post('/holdings', async (req, res) => {
  try {
    const { symbol, company_name, sector, shares, avg_cost, buy_date, annual_dividend, div_override_annual, notes } = req.body;

    if (!symbol || !shares || !avg_cost) {
      return res.status(400).json({ error: 'symbol, shares, avg_cost required' });
    }

    const { rows } = await db.query(
      `INSERT INTO portfolio_holdings
         (user_id, symbol, company_name, sector, shares, avg_cost, buy_date, annual_dividend, div_override_annual, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (user_id, symbol)
       DO UPDATE SET
         company_name = EXCLUDED.company_name,
         sector = EXCLUDED.sector,
         shares = EXCLUDED.shares,
         avg_cost = EXCLUDED.avg_cost,
         buy_date = EXCLUDED.buy_date,
         annual_dividend = EXCLUDED.annual_dividend,
         div_override_annual = COALESCE(EXCLUDED.div_override_annual, portfolio_holdings.div_override_annual),
         notes = EXCLUDED.notes,
         updated_at = NOW()
       RETURNING *`,
      [req.user.userId, symbol.toUpperCase(), company_name, sector, shares, avg_cost, buy_date || null, annual_dividend || 0, div_override_annual || null, notes || null]
    );

    res.json({ holding: rows[0] });
  } catch (e) {
    console.error('[Portfolio] POST holdings error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

router.delete('/holdings/:symbol', async (req, res) => {
  try {
    await db.query(
      `DELETE FROM portfolio_holdings WHERE user_id = $1 AND symbol = $2`,
      [req.user.userId, req.params.symbol.toUpperCase()]
    );
    res.json({ ok: true });
  } catch (e) {
    console.error('[Portfolio] DELETE holding error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ─── Transactions ─────────────────────────────────────────────────────────────

router.get('/transactions/:symbol', async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT pt.* FROM portfolio_transactions pt
       JOIN portfolio_holdings ph ON pt.holding_id = ph.id
       WHERE pt.user_id = $1 AND ph.symbol = $2
       ORDER BY pt.date ASC`,
      [req.user.userId, req.params.symbol.toUpperCase()]
    );
    res.json({ transactions: rows });
  } catch (e) {
    console.error('[Portfolio] GET transactions error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

router.post('/transactions', async (req, res) => {
  try {
    const { symbol, type, shares, price, date, notes } = req.body;
    if (!symbol || !type || !shares || !price || !date) {
      return res.status(400).json({ error: 'symbol, type, shares, price, date required' });
    }

    // Find the holding
    const { rows: holdings } = await db.query(
      `SELECT id FROM portfolio_holdings WHERE user_id = $1 AND symbol = $2`,
      [req.user.userId, symbol.toUpperCase()]
    );
    if (!holdings.length) return res.status(404).json({ error: 'Holding not found' });

    const { rows } = await db.query(
      `INSERT INTO portfolio_transactions (holding_id, user_id, type, shares, price, date, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [holdings[0].id, req.user.userId, type, shares, price, date, notes || null]
    );
    res.json({ transaction: rows[0] });
  } catch (e) {
    console.error('[Portfolio] POST transaction error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ─── Dividend Overrides ──────────────────────────────────────────────────────

router.get('/dividends', async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT * FROM portfolio_dividend_overrides WHERE user_id = $1`,
      [req.user.userId]
    );
    // Convert to DividendCell format: { "year-month-symbol": amount }
    const cell = {};
    rows.forEach(r => {
      cell[`${r.year}-${r.month}-${r.symbol}`] = parseFloat(r.amount);
    });
    res.json({ overrides: cell, raw: rows });
  } catch (e) {
    console.error('[Portfolio] GET dividends error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

router.post('/dividends', async (req, res) => {
  try {
    const { symbol, year, month, amount } = req.body;
    if (!symbol || year == null || month == null || amount == null) {
      return res.status(400).json({ error: 'symbol, year, month, amount required' });
    }
    const { rows } = await db.query(
      `INSERT INTO portfolio_dividend_overrides (user_id, symbol, year, month, amount)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (user_id, symbol, year, month)
       DO UPDATE SET amount = EXCLUDED.amount, updated_at = NOW()
       RETURNING *`,
      [req.user.userId, symbol.toUpperCase(), year, month, amount]
    );
    res.json({ override: rows[0] });
  } catch (e) {
    console.error('[Portfolio] POST dividend override error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

router.delete('/dividends/:symbol/:year/:month', async (req, res) => {
  try {
    await db.query(
      `DELETE FROM portfolio_dividend_overrides WHERE user_id=$1 AND symbol=$2 AND year=$3 AND month=$4`,
      [req.user.userId, req.params.symbol.toUpperCase(), req.params.year, req.params.month]
    );
    res.json({ ok: true });
  } catch (e) {
    console.error('[Portfolio] DELETE dividend override error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ─── Sold Positions ──────────────────────────────────────────────────────────

router.get('/sold', async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT * FROM portfolio_sold WHERE user_id = $1 ORDER BY sell_date DESC`,
      [req.user.userId]
    );
    res.json({ sold: rows });
  } catch (e) {
    console.error('[Portfolio] GET sold error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

router.post('/sold', async (req, res) => {
  try {
    const { symbol, company_name, sector, shares, avg_cost, sale_price, buy_date, sell_date, dividends_received, notes } = req.body;
    if (!symbol || !shares || !avg_cost || !sale_price || !sell_date) {
      return res.status(400).json({ error: 'symbol, shares, avg_cost, sale_price, sell_date required' });
    }
    const { rows } = await db.query(
      `INSERT INTO portfolio_sold
         (user_id, symbol, company_name, sector, shares, avg_cost, sale_price, buy_date, sell_date, dividends_received, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING *`,
      [req.user.userId, symbol.toUpperCase(), company_name, sector, shares, avg_cost, sale_price,
       buy_date || null, sell_date, dividends_received || 0, notes || null]
    );
    res.json({ sold: rows[0] });
  } catch (e) {
    console.error('[Portfolio] POST sold error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

router.delete('/sold/:id', async (req, res) => {
  try {
    await db.query(
      `DELETE FROM portfolio_sold WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.userId]
    );
    res.json({ ok: true });
  } catch (e) {
    console.error('[Portfolio] DELETE sold error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ─── Portfolio Watchlist ─────────────────────────────────────────────────────

router.get('/watchlist', async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT * FROM portfolio_watchlist WHERE user_id = $1 ORDER BY symbol`,
      [req.user.userId]
    );
    res.json({ watchlist: rows });
  } catch (e) {
    console.error('[Portfolio] GET watchlist error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

router.post('/watchlist', async (req, res) => {
  try {
    const { symbol, company_name, sector, target_price, notes } = req.body;
    if (!symbol) return res.status(400).json({ error: 'symbol required' });
    const { rows } = await db.query(
      `INSERT INTO portfolio_watchlist (user_id, symbol, company_name, sector, target_price, notes)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (user_id, symbol)
       DO UPDATE SET company_name=EXCLUDED.company_name, sector=EXCLUDED.sector,
                     target_price=EXCLUDED.target_price, notes=EXCLUDED.notes, updated_at=NOW()
       RETURNING *`,
      [req.user.userId, symbol.toUpperCase(), company_name, sector || 'Other', target_price || null, notes || null]
    );
    res.json({ item: rows[0] });
  } catch (e) {
    console.error('[Portfolio] POST watchlist error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

router.delete('/watchlist/:symbol', async (req, res) => {
  try {
    await db.query(
      `DELETE FROM portfolio_watchlist WHERE user_id=$1 AND symbol=$2`,
      [req.user.userId, req.params.symbol.toUpperCase()]
    );
    res.json({ ok: true });
  } catch (e) {
    console.error('[Portfolio] DELETE watchlist error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ─── Bulk sync (import from localStorage on login) ───────────────────────────

router.post('/sync', async (req, res) => {
  try {
    const { holdings = [], sold = [], watchlist = [], dividendOverrides = {} } = req.body;
    const userId = req.user.userId;
    const results = { holdings: 0, sold: 0, watchlist: 0, dividends: 0 };

    // Upsert holdings
    for (const h of holdings) {
      if (!h.ticker || !h.shares || !h.avgCost) continue;
      await db.query(
        `INSERT INTO portfolio_holdings
           (user_id, symbol, company_name, sector, shares, avg_cost, buy_date, annual_dividend, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT (user_id, symbol) DO NOTHING`,
        [userId, h.ticker.toUpperCase(), h.company, h.sector, h.shares, h.avgCost, h.buyDate || null, h.annualDividend || 0, h.notes || null]
      );
      results.holdings++;
    }

    // Upsert sold
    for (const s of sold) {
      if (!s.ticker || !s.shares || !s.avgCost || !s.salePrice) continue;
      await db.query(
        `INSERT INTO portfolio_sold
           (user_id, symbol, company_name, sector, shares, avg_cost, sale_price, sell_date, dividends_received)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT DO NOTHING`,
        [userId, s.ticker.toUpperCase(), s.company, s.sector, s.shares, s.avgCost, s.salePrice, s.dateSold || new Date().toISOString().slice(0,10), s.totalDividendsWhileHeld || 0]
      );
      results.sold++;
    }

    // Upsert watchlist
    for (const w of watchlist) {
      if (!w.ticker) continue;
      await db.query(
        `INSERT INTO portfolio_watchlist (user_id, symbol, company_name, sector, target_price)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (user_id, symbol) DO NOTHING`,
        [userId, w.ticker.toUpperCase(), w.company, w.sector || 'Other', w.targetPrice || null]
      );
      results.watchlist++;
    }

    // Upsert dividend overrides
    for (const [key, amount] of Object.entries(dividendOverrides)) {
      const parts = key.split('-');
      if (parts.length < 3) continue;
      const month = parts[1];
      const year = parts[0];
      const symbol = parts.slice(2).join('-').toUpperCase();
      await db.query(
        `INSERT INTO portfolio_dividend_overrides (user_id, symbol, year, month, amount)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (user_id, symbol, year, month) DO NOTHING`,
        [userId, symbol, year, month, amount]
      );
      results.dividends++;
    }

    res.json({ ok: true, imported: results });
  } catch (e) {
    console.error('[Portfolio] POST sync error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

module.exports = router;
