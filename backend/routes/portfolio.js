/**
 * Portfolio Routes — Supabase REST
 *
 * All routes require JWT authentication.
 *
 * NOTE: Migrated from db.query (direct Postgres/IPv6) to Supabase REST
 * (HTTPS/IPv4) to fix intermittent connectivity issues on Render.
 *
 * user_id is the Supabase Auth UUID from requireAuth (migration 022).
 * Never parseInt / coerce it — INTEGER user_id 500s every current auth user.
 */

const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const { requireAuth } = require('../middleware/auth');
const dividendLog = require('../services/dividendLog');

function getSupabase() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}

/**
 * Supabase Auth UUID from requireAuth (auth.users.id).
 * portfolio_*.user_id is UUID (migration 022) — never parseInt this.
 */
function authUserId(req) {
  return String(req.user.id);
}

// All portfolio routes require auth
router.use(requireAuth);

// ─── Holdings ────────────────────────────────────────────────────────────────

router.get('/holdings', async (req, res) => {
  try {
    const { data, error } = await getSupabase()
      .from('portfolio_holdings')
      .select('*')
      .eq('user_id', authUserId(req))
      .order('buy_date', { ascending: true })
      .order('symbol', { ascending: true });
    if (error) throw error;
    res.json({ holdings: data || [] });
  } catch (e) {
    console.error('[Portfolio] GET holdings error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

router.post('/holdings', async (req, res) => {
  try {
    const { symbol, company_name, sector, shares, avg_cost, buy_date, annual_dividend, div_override_annual, notes, drip_enabled } = req.body;
    if (!symbol || !shares || !avg_cost) return res.status(400).json({ error: 'symbol, shares, avg_cost required' });

    const { data, error } = await getSupabase()
      .from('portfolio_holdings')
      .upsert(
        {
          user_id: authUserId(req),
          symbol: symbol.toUpperCase(),
          company_name,
          sector,
          shares,
          avg_cost,
          buy_date: buy_date || null,
          annual_dividend: annual_dividend || 0,
          div_override_annual: div_override_annual || null,
          notes: notes || null,
          drip_enabled: drip_enabled || false,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,symbol' }
      )
      .select()
      .single();

    if (error) throw error;

    if (req.query.backfill !== 'false') {
      dividendLog.backfill(authUserId(req), {
        symbol: symbol.toUpperCase(), shares, buy_date: buy_date || null, drip_enabled: drip_enabled || false,
      }).then(r => console.info(`[Portfolio] Dividend backfill for ${symbol}: ${r.inserted} inserted, ${r.skipped} skipped`))
        .catch(err => console.warn(`[Portfolio] Dividend backfill failed for ${symbol}:`, err.message));
    }

    res.json({ holding: data });
  } catch (e) {
    console.error('[Portfolio] POST holdings error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

router.delete('/holdings/:symbol', async (req, res) => {
  try {
    const { error } = await getSupabase()
      .from('portfolio_holdings')
      .delete()
      .eq('user_id', authUserId(req))
      .eq('symbol', req.params.symbol.toUpperCase());
    if (error) throw error;
    res.json({ ok: true });
  } catch (e) {
    console.error('[Portfolio] DELETE holding error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ─── Transactions ─────────────────────────────────────────────────────────────

router.get('/transactions/:symbol', async (req, res) => {
  try {
    const supabase = getSupabase();
    // Get holding id first
    const { data: holdings, error: hErr } = await supabase
      .from('portfolio_holdings')
      .select('id')
      .eq('user_id', authUserId(req))
      .eq('symbol', req.params.symbol.toUpperCase())
      .limit(1);
    if (hErr) throw hErr;
    if (!holdings || holdings.length === 0) return res.json({ transactions: [] });

    const { data, error } = await supabase
      .from('portfolio_transactions')
      .select('*')
      .eq('user_id', authUserId(req))
      .eq('holding_id', holdings[0].id)
      .order('date', { ascending: true });
    if (error) throw error;
    res.json({ transactions: data || [] });
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
    const supabase = getSupabase();
    const { data: holdings, error: hErr } = await supabase
      .from('portfolio_holdings')
      .select('id')
      .eq('user_id', authUserId(req))
      .eq('symbol', symbol.toUpperCase())
      .limit(1);
    if (hErr) throw hErr;
    if (!holdings || holdings.length === 0) return res.status(404).json({ error: 'Holding not found' });

    const { data, error } = await supabase
      .from('portfolio_transactions')
      .insert({ holding_id: holdings[0].id, user_id: authUserId(req), type, shares, price, date, notes: notes || null })
      .select()
      .single();
    if (error) throw error;
    res.json({ transaction: data });
  } catch (e) {
    console.error('[Portfolio] POST transaction error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ─── Dividend Overrides ──────────────────────────────────────────────────────

router.get('/dividends', async (req, res) => {
  try {
    const { data, error } = await getSupabase()
      .from('portfolio_dividend_overrides')
      .select('*')
      .eq('user_id', authUserId(req));
    if (error) throw error;
    const cell = {};
    (data || []).forEach(r => { cell[`${r.year}-${r.month}-${r.symbol}`] = parseFloat(r.amount); });
    res.json({ overrides: cell, raw: data || [] });
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
    const { data, error } = await getSupabase()
      .from('portfolio_dividend_overrides')
      .upsert(
        { user_id: authUserId(req), symbol: symbol.toUpperCase(), year, month, amount, updated_at: new Date().toISOString() },
        { onConflict: 'user_id,symbol,year,month' }
      )
      .select()
      .single();
    if (error) throw error;
    res.json({ override: data });
  } catch (e) {
    console.error('[Portfolio] POST dividend override error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

router.delete('/dividends/:symbol/:year/:month', async (req, res) => {
  try {
    const { error } = await getSupabase()
      .from('portfolio_dividend_overrides')
      .delete()
      .eq('user_id', authUserId(req))
      .eq('symbol', req.params.symbol.toUpperCase())
      .eq('year', req.params.year)
      .eq('month', req.params.month);
    if (error) throw error;
    res.json({ ok: true });
  } catch (e) {
    console.error('[Portfolio] DELETE dividend override error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ─── Sold Positions ──────────────────────────────────────────────────────────

router.get('/sold', async (req, res) => {
  try {
    const { data, error } = await getSupabase()
      .from('portfolio_sold')
      .select('*')
      .eq('user_id', authUserId(req))
      .order('sell_date', { ascending: false });
    if (error) throw error;
    res.json({ sold: data || [] });
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

    // Q6/Q7: sold dividends stay symbol + date-range until lot-linked
    // FIFO/LIFO attribution (later PR; needs Erick lot-model decision).
    let actualDividendsReceived = dividends_received || 0;
    try {
      const logTotal = await dividendLog.getTotalForSymbol(authUserId(req), symbol, { fromDate: buy_date || null, toDate: sell_date });
      if (logTotal > 0) actualDividendsReceived = logTotal;
    } catch (err) {
      console.warn('[Portfolio] Could not calculate dividends from log for sold position:', err.message);
    }

    const { data, error } = await getSupabase()
      .from('portfolio_sold')
      .insert({
        user_id: authUserId(req),
        symbol: symbol.toUpperCase(),
        company_name,
        sector,
        shares,
        avg_cost,
        sale_price,
        buy_date: buy_date || null,
        sell_date,
        dividends_received: actualDividendsReceived,
        notes: notes || null,
      })
      .select()
      .single();
    if (error) throw error;
    res.json({ sold: data });
  } catch (e) {
    console.error('[Portfolio] POST sold error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

router.delete('/sold/:id', async (req, res) => {
  try {
    const { error } = await getSupabase()
      .from('portfolio_sold')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', authUserId(req));
    if (error) throw error;
    res.json({ ok: true });
  } catch (e) {
    console.error('[Portfolio] DELETE sold error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ─── Portfolio Watchlist ─────────────────────────────────────────────────────

router.get('/watchlist', async (req, res) => {
  try {
    const { data, error } = await getSupabase()
      .from('portfolio_watchlist')
      .select('*')
      .eq('user_id', authUserId(req))
      .order('symbol', { ascending: true });
    if (error) throw error;
    res.json({ watchlist: data || [] });
  } catch (e) {
    console.error('[Portfolio] GET watchlist error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

router.post('/watchlist', async (req, res) => {
  try {
    const { symbol, company_name, sector, target_price, notes } = req.body;
    if (!symbol) return res.status(400).json({ error: 'symbol required' });
    const { data, error } = await getSupabase()
      .from('portfolio_watchlist')
      .upsert(
        { user_id: authUserId(req), symbol: symbol.toUpperCase(), company_name, sector: sector || 'Other', target_price: target_price || null, notes: notes || null, updated_at: new Date().toISOString() },
        { onConflict: 'user_id,symbol' }
      )
      .select()
      .single();
    if (error) throw error;
    res.json({ item: data });
  } catch (e) {
    console.error('[Portfolio] POST watchlist error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

router.delete('/watchlist/:symbol', async (req, res) => {
  try {
    const { error } = await getSupabase()
      .from('portfolio_watchlist')
      .delete()
      .eq('user_id', authUserId(req))
      .eq('symbol', req.params.symbol.toUpperCase());
    if (error) throw error;
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
    const userId = authUserId(req);
    const results = { holdings: 0, sold: 0, watchlist: 0, dividends: 0 };
    const supabase = getSupabase();

    for (const h of holdings) {
      if (!h.ticker || !h.shares || !h.avgCost) continue;
      await supabase.from('portfolio_holdings').upsert(
        { user_id: userId, symbol: h.ticker.toUpperCase(), company_name: h.company, sector: h.sector, shares: h.shares, avg_cost: h.avgCost, buy_date: h.buyDate || null, annual_dividend: h.annualDividend || 0, notes: h.notes || null },
        { onConflict: 'user_id,symbol', ignoreDuplicates: true }
      );
      results.holdings++;
    }

    for (const s of sold) {
      if (!s.ticker || !s.shares || !s.avgCost || !s.salePrice) continue;
      await supabase.from('portfolio_sold').upsert(
        { user_id: userId, symbol: s.ticker.toUpperCase(), company_name: s.company, sector: s.sector, shares: s.shares, avg_cost: s.avgCost, sale_price: s.salePrice, sell_date: s.dateSold || new Date().toISOString().slice(0,10), dividends_received: s.totalDividendsWhileHeld || 0 },
        { ignoreDuplicates: true }
      );
      results.sold++;
    }

    for (const w of watchlist) {
      if (!w.ticker) continue;
      await supabase.from('portfolio_watchlist').upsert(
        { user_id: userId, symbol: w.ticker.toUpperCase(), company_name: w.company, sector: w.sector || 'Other', target_price: w.targetPrice || null },
        { onConflict: 'user_id,symbol', ignoreDuplicates: true }
      );
      results.watchlist++;
    }

    for (const [key, amount] of Object.entries(dividendOverrides)) {
      const parts = key.split('-');
      if (parts.length < 3) continue;
      const month = parts[1];
      const year = parts[0];
      const symbol = parts.slice(2).join('-').toUpperCase();
      await supabase.from('portfolio_dividend_overrides').upsert(
        { user_id: userId, symbol, year, month, amount },
        { onConflict: 'user_id,symbol,year,month', ignoreDuplicates: true }
      );
      results.dividends++;
    }

    res.json({ ok: true, imported: results });
  } catch (e) {
    console.error('[Portfolio] POST sync error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ─── Portfolio Settings ──────────────────────────────────────────────────────

router.get('/settings', async (req, res) => {
  try {
    const { data, error } = await getSupabase()
      .from('portfolio_settings')
      .select('settings')
      .eq('user_id', authUserId(req))
      .maybeSingle();
    if (error) throw error;
    res.json({ settings: data?.settings || {} });
  } catch (e) {
    res.json({ settings: {} });
  }
});

router.post('/settings', async (req, res) => {
  try {
    const { settings } = req.body;
    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ error: 'settings object required' });
    }
    const { error } = await getSupabase()
      .from('portfolio_settings')
      .upsert({ user_id: authUserId(req), settings, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
    if (error) throw error;
    res.json({ ok: true });
  } catch (e) {
    console.warn('[Portfolio] settings persist error:', e.message);
    res.json({ ok: true, warn: 'settings not persisted' });
  }
});

// ─── Dividend Log (Immutable Ledger) ─────────────────────────────────────────

router.get('/dividend-log', async (req, res) => {
  try {
    const { symbol } = req.query;
    const entries = await dividendLog.getLog(authUserId(req), { symbol: symbol || null });
    res.json({ entries });
  } catch (e) {
    console.error('[Portfolio] GET dividend-log error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

router.post('/dividend-log', async (req, res) => {
  try {
    const { symbol, payment_date, ex_date, dividend_per_share, shares_held, total_received, source, is_confirmed, notes } = req.body;
    if (!symbol || !payment_date || dividend_per_share == null || shares_held == null) {
      return res.status(400).json({ error: 'symbol, payment_date, dividend_per_share, shares_held required' });
    }
    const result = await dividendLog.upsertEntry(authUserId(req), {
      symbol, payment_date, ex_date, dividend_per_share, shares_held,
      total_received: total_received ?? parseFloat((dividend_per_share * shares_held).toFixed(4)),
      source: source || 'manual', is_confirmed: is_confirmed ?? false, notes,
    });
    res.json(result);
  } catch (e) {
    console.error('[Portfolio] POST dividend-log error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

router.put('/dividend-log/:id', async (req, res) => {
  try {
    const entry = await dividendLog.updateEntry(authUserId(req), req.params.id, req.body);
    res.json({ entry });
  } catch (e) {
    console.error('[Portfolio] PUT dividend-log error:', e.message);
    res.status(e.message.includes('not found') ? 404 : 500).json({ error: e.message });
  }
});

router.delete('/dividend-log/:id', async (req, res) => {
  try {
    const result = await dividendLog.deleteEntry(authUserId(req), req.params.id);
    res.json({ ok: true, deleted: result });
  } catch (e) {
    console.error('[Portfolio] DELETE dividend-log error:', e.message);
    res.status(e.message.includes('confirmed') ? 403 : 500).json({ error: e.message });
  }
});

router.post('/dividend-log/backfill', async (req, res) => {
  try {
    const { symbol, shares, buy_date, drip_enabled, reinvest_prices } = req.body;
    if (!symbol || shares == null) return res.status(400).json({ error: 'symbol and shares required' });
    const result = await dividendLog.backfill(authUserId(req), {
      symbol, shares, buy_date, drip_enabled, reinvestPrices: reinvest_prices || null,
    });
    res.json(result);
  } catch (e) {
    console.error('[Portfolio] POST dividend-log/backfill error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

router.post('/dividend-log/backfill-all', async (req, res) => {
  try {
    const results = await dividendLog.backfillAllHoldings(authUserId(req));
    res.json({ results });
  } catch (e) {
    console.error('[Portfolio] POST dividend-log/backfill-all error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

router.post('/dividend-log/confirm/:id', async (req, res) => {
  try {
    const entry = await dividendLog.confirmEntry(authUserId(req), req.params.id);
    res.json({ entry });
  } catch (e) {
    console.error('[Portfolio] POST dividend-log/confirm error:', e.message);
    res.status(e.message.includes('not found') ? 404 : 500).json({ error: e.message });
  }
});

router.post('/dividend-log/drip/:id', async (req, res) => {
  try {
    const { price_at_payment } = req.body;
    if (!price_at_payment || price_at_payment <= 0) {
      return res.status(400).json({ error: 'price_at_payment required and must be positive' });
    }
    const result = await dividendLog.processDRIP(authUserId(req), req.params.id, price_at_payment);
    res.json(result);
  } catch (e) {
    console.error('[Portfolio] POST dividend-log/drip error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

router.get('/dividend-log/summary/:symbol', async (req, res) => {
  try {
    const { from_date, to_date } = req.query;
    const total = await dividendLog.getTotalForSymbol(authUserId(req), req.params.symbol, { fromDate: from_date || null, toDate: to_date || null });
    res.json({ symbol: req.params.symbol.toUpperCase(), total });
  } catch (e) {
    console.error('[Portfolio] GET dividend-log/summary error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

module.exports = router;
