/**
 * Watchlist Routes — Supabase REST + Live Finnhub prices
 *
 * GET    /api/watchlist              - User's watchlist with live prices
 * POST   /api/watchlist              - Add instrument to watchlist
 * PUT    /api/watchlist/:id/alerts   - Update price alert thresholds
 * DELETE /api/watchlist/:id          - Remove from watchlist
 * GET    /api/watchlist/performance  - P&L summary
 *
 * NOTE: Migrated from db.query (direct Postgres/IPv6) to Supabase REST
 * (HTTPS/IPv4) to fix intermittent connectivity issues on Render.
 */

const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const finnhub = require('../services/finnhub');
const { requireAuth } = require('../middleware/auth');

function getSupabase() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function enrichItem(dbItem, quote) {
  const currentPrice = quote?.current || 0;
  return {
    id: dbItem.id,
    symbol: dbItem.symbol,
    name: dbItem.name,
    type: dbItem.type,
    exchange: dbItem.exchange,
    current_price: currentPrice,
    change: quote?.change ?? null,
    change_pct: quote?.changePct ?? null,
    quote_source: quote?.source || 'unknown',
    alert_threshold_up: dbItem.alert_threshold_up ? parseFloat(dbItem.alert_threshold_up) : null,
    alert_threshold_down: dbItem.alert_threshold_down ? parseFloat(dbItem.alert_threshold_down) : null,
    notes: dbItem.notes || null,
    added_at: dbItem.created_at,
    performance: dbItem.purchase_price
      ? {
          purchase_price: parseFloat(dbItem.purchase_price),
          current_value: currentPrice,
          change: parseFloat((currentPrice - dbItem.purchase_price).toFixed(4)),
          change_percent: parseFloat(
            (((currentPrice - dbItem.purchase_price) / dbItem.purchase_price) * 100).toFixed(2)
          ),
        }
      : null,
  };
}

// ──────────────────────────────────────────
// GET /api/watchlist
// ──────────────────────────────────────────
router.get('/', requireAuth, async (req, res) => {
  try {
    const supabase = getSupabase();
    const { data: rows, error } = await supabase
      .from('watchlists')
      .select('id,alert_threshold_up,alert_threshold_down,notes,created_at,instruments(symbol,name,type,exchange)')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    if (!rows || rows.length === 0) return res.json({ watchlist: [], total_items: 0 });

    // Flatten joined instrument data
    const flatRows = rows.map(r => ({
      ...r,
      symbol: r.instruments?.symbol,
      name: r.instruments?.name,
      type: r.instruments?.type,
      exchange: r.instruments?.exchange,
    }));

    const symbols = [...new Set(flatRows.map(r => r.symbol))];
    const quotes = await finnhub.getBatchQuotes(symbols);
    const enriched = flatRows.map(row => enrichItem(row, quotes[row.symbol?.toUpperCase()]));

    res.json({ watchlist: enriched, total_items: enriched.length });
  } catch (error) {
    console.error('[Watchlist] GET error:', error);
    res.status(500).json({ error: 'Failed to fetch watchlist' });
  }
});

// ──────────────────────────────────────────
// POST /api/watchlist
// ──────────────────────────────────────────
router.post('/', requireAuth, async (req, res) => {
  try {
    const { symbol, alert_threshold_up, alert_threshold_down, notes } = req.body;
    if (!symbol) return res.status(400).json({ error: 'Symbol is required' });

    const supabase = getSupabase();

    // Find instrument
    const { data: instruments, error: instrErr } = await supabase
      .from('instruments')
      .select('*')
      .eq('symbol', symbol.toUpperCase())
      .eq('active', true);

    if (instrErr) throw new Error(instrErr.message);
    if (!instruments || instruments.length === 0) {
      return res.status(404).json({ error: `Instrument '${symbol}' not found` });
    }
    const instrument = instruments[0];

    // Check duplicate
    const { data: existing, error: dupErr } = await supabase
      .from('watchlists')
      .select('id')
      .eq('user_id', req.user.id)
      .eq('instrument_id', instrument.id);

    if (dupErr) throw new Error(dupErr.message);
    if (existing && existing.length > 0) {
      return res.status(409).json({ error: 'Instrument already in watchlist' });
    }

    // Free tier limit
    if (req.user.subscription_tier === 'free') {
      const { count, error: cntErr } = await supabase
        .from('watchlists')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', req.user.id);
      if (cntErr) throw new Error(cntErr.message);
      if ((count || 0) >= 10) {
        return res.status(403).json({ error: 'Free tier limited to 10 watchlist items. Upgrade to add more.' });
      }
    }

    const { data: rows, error: insertErr } = await supabase
      .from('watchlists')
      .insert({
        user_id: req.user.id,
        instrument_id: instrument.id,
        alert_threshold_up: alert_threshold_up || null,
        alert_threshold_down: alert_threshold_down || null,
        notes: notes || null,
      })
      .select();

    if (insertErr) throw new Error(insertErr.message);
    const watchlistRow = rows[0];

    const quote = await finnhub.getQuote(instrument.symbol);
    res.status(201).json({
      message: 'Added to watchlist',
      item: enrichItem(
        {
          id: watchlistRow.id,
          symbol: instrument.symbol,
          name: instrument.name,
          type: instrument.type,
          exchange: instrument.exchange,
          alert_threshold_up: watchlistRow.alert_threshold_up,
          alert_threshold_down: watchlistRow.alert_threshold_down,
          notes: watchlistRow.notes,
          created_at: watchlistRow.created_at,
        },
        quote
      ),
    });
  } catch (error) {
    console.error('[Watchlist] POST error:', error);
    res.status(500).json({ error: 'Failed to add item to watchlist' });
  }
});

// ──────────────────────────────────────────
// PUT /api/watchlist/:id/alerts
// ──────────────────────────────────────────
router.put('/:id/alerts', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { alert_threshold_up, alert_threshold_down } = req.body;

    const { data, error } = await getSupabase()
      .from('watchlists')
      .update({
        ...(alert_threshold_up !== undefined ? { alert_threshold_up } : {}),
        ...(alert_threshold_down !== undefined ? { alert_threshold_down } : {}),
      })
      .eq('id', parseInt(id))
      .eq('user_id', req.user.id)
      .select();

    if (error) throw new Error(error.message);
    if (!data || data.length === 0) return res.status(404).json({ error: 'Watchlist item not found' });
    res.json({ message: 'Alert thresholds updated', item: data[0] });
  } catch (error) {
    console.error('[Watchlist] PUT alerts error:', error);
    res.status(500).json({ error: 'Failed to update alert thresholds' });
  }
});

// ──────────────────────────────────────────
// DELETE /api/watchlist/:id
// ──────────────────────────────────────────
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await getSupabase()
      .from('watchlists')
      .delete()
      .eq('id', parseInt(id))
      .eq('user_id', req.user.id)
      .select();

    if (error) throw new Error(error.message);
    if (!data || data.length === 0) return res.status(404).json({ error: 'Watchlist item not found' });
    res.json({ message: 'Removed from watchlist', removed_id: data[0].id });
  } catch (error) {
    console.error('[Watchlist] DELETE error:', error);
    res.status(500).json({ error: 'Failed to remove item from watchlist' });
  }
});

// ──────────────────────────────────────────
// GET /api/watchlist/performance
// ──────────────────────────────────────────
router.get('/performance', requireAuth, async (req, res) => {
  try {
    const { data: rows, error } = await getSupabase()
      .from('watchlists')
      .select('id,alert_threshold_up,alert_threshold_down,notes,created_at,instruments(symbol,name,type,exchange)')
      .eq('user_id', req.user.id);

    if (error) throw new Error(error.message);
    if (!rows || rows.length === 0) return res.json({ summary: { total_items: 0 }, items: [] });

    const flatRows = rows.map(r => ({
      ...r,
      symbol: r.instruments?.symbol,
      name: r.instruments?.name,
      type: r.instruments?.type,
      exchange: r.instruments?.exchange,
    }));

    const symbols = [...new Set(flatRows.map(r => r.symbol))];
    const quotes = await finnhub.getBatchQuotes(symbols);

    let totalInvestment = 0;
    let totalCurrentValue = 0;
    const items = [];

    flatRows.forEach(row => {
      const quote = quotes[row.symbol?.toUpperCase()];
      const currentPrice = quote?.current || 0;
      const purchasePrice = row.purchase_price ? parseFloat(row.purchase_price) : null;
      if (purchasePrice) { totalInvestment += purchasePrice; totalCurrentValue += currentPrice; }
      items.push({
        symbol: row.symbol,
        name: row.name,
        type: row.type,
        current_price: currentPrice,
        purchase_price: purchasePrice,
        change: purchasePrice ? parseFloat((currentPrice - purchasePrice).toFixed(4)) : null,
        change_percent: purchasePrice
          ? parseFloat((((currentPrice - purchasePrice) / purchasePrice) * 100).toFixed(2))
          : null,
        quote_source: quote?.source || 'unknown',
      });
    });

    const totalChange = totalCurrentValue - totalInvestment;
    res.json({
      summary: {
        total_items: rows.length,
        tracked_items: items.filter(i => i.purchase_price !== null).length,
        total_investment: parseFloat(totalInvestment.toFixed(2)),
        total_current_value: parseFloat(totalCurrentValue.toFixed(2)),
        total_change: parseFloat(totalChange.toFixed(2)),
        total_change_percent: totalInvestment > 0
          ? parseFloat(((totalChange / totalInvestment) * 100).toFixed(2))
          : 0,
      },
      items,
    });
  } catch (error) {
    console.error('[Watchlist] GET performance error:', error);
    res.status(500).json({ error: 'Failed to calculate performance' });
  }
});

module.exports = router;
