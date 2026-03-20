/**
 * Price Alerts Routes
 *
 * GET    /api/alerts/price                — List user's price alerts
 * POST   /api/alerts/price                — Create a price alert
 * DELETE /api/alerts/price/:id            — Delete a price alert
 * POST   /api/alerts/price/check          — Internal: check all alerts (admin/service only)
 * GET    /api/alerts/price/prefs          — Get notification prefs for current user
 * PUT    /api/alerts/price/prefs          — Update notification prefs for current user
 * GET    /api/alerts/price/unsubscribe    — One-click email unsubscribe (no auth, token-based)
 */

'use strict';

const express = require('express');
const router  = express.Router();
const db      = require('../services/db');
const { requireAuth } = require('../middleware/auth');
const {
  sendPriceAlertNotifications,
  validateUnsubToken,
  PREFS_DEFAULTS,
} = require('../services/priceAlertNotifier');
const { createClient } = require('@supabase/supabase-js');

function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
  );
}

// ── Admin/service-role guard ──────────────────────────────────────────────────
function requireAdmin(req, res, next) {
  const internalSecret = process.env.INTERNAL_SERVICE_SECRET;
  if (internalSecret && req.headers['x-internal-secret'] === internalSecret) {
    return next();
  }
  if (req.user && req.user.appRole === 'admin') return next();
  return res.status(403).json({ error: 'Admin access required' });
}

// ─── GET /api/alerts/price/unsubscribe  (PUBLIC — no auth, token-based) ───────
// Must be registered BEFORE router.use(requireAuth) so it doesn't require login.

router.get('/unsubscribe', async (req, res) => {
  const { token } = req.query;
  const userId = validateUnsubToken(token);

  if (!userId) {
    return res.status(400).send(`<!DOCTYPE html>
<html><body style="font-family:system-ui;text-align:center;padding:60px;background:#111827;color:#f9fafb;">
<h2>Invalid or expired link</h2>
<p style="color:#9ca3af;">This unsubscribe link is invalid. Please manage notifications from your <a href="/account" style="color:#6366f1;">account settings</a>.</p>
</body></html>`);
  }

  try {
    const supabase = getSupabase();

    // Try price_alert_prefs first
    const { error: upsertErr } = await supabase
      .from('price_alert_prefs')
      .upsert({
        user_id:       userId,
        email_enabled: false,
        updated_at:    new Date().toISOString(),
      }, { onConflict: 'user_id' });

    // Also update alert_subscriptions for consistency
    await supabase
      .from('alert_subscriptions')
      .update({ email_enabled: false, updated_at: new Date().toISOString() })
      .eq('user_id', userId);

    if (upsertErr) throw new Error(upsertErr.message);

    console.log(`[PriceAlerts] User ${userId} unsubscribed from email alerts`);

    return res.send(`<!DOCTYPE html>
<html><body style="font-family:system-ui;text-align:center;padding:60px;background:#111827;color:#f9fafb;">
<h2 style="color:#4ade80;">✓ Unsubscribed</h2>
<p style="color:#9ca3af;">You've been unsubscribed from price alert emails. You can re-enable them in your <a href="/account" style="color:#6366f1;">account settings</a>.</p>
</body></html>`);
  } catch (e) {
    console.error('[PriceAlerts] unsubscribe error:', e.message);
    return res.status(500).send('An error occurred. Please try again or contact support@tradvue.com.');
  }
});

// All other routes require auth
router.use(requireAuth);

// ─── GET /api/alerts/price ────────────────────────────────────────────────────

router.get('/', async (req, res) => {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('price_alerts')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    res.json({ alerts: data || [] });
  } catch (e) {
    console.error('[PriceAlerts] GET error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ─── POST /api/alerts/price ───────────────────────────────────────────────────

router.post('/', async (req, res) => {
  try {
    const { symbol, target_price, direction } = req.body;

    if (!symbol || !target_price || !direction) {
      return res.status(400).json({ error: 'symbol, target_price, direction required' });
    }
    if (!['above', 'below'].includes(direction)) {
      return res.status(400).json({ error: 'direction must be "above" or "below"' });
    }
    const price = parseFloat(target_price);
    if (isNaN(price) || price <= 0) {
      return res.status(400).json({ error: 'target_price must be a positive number' });
    }

    console.log('[PriceAlerts] Creating alert:', { userId: req.user.id, symbol: symbol.toUpperCase(), price, direction });
    const supabase = getSupabase();
    const { data: inserted, error: insertErr } = await supabase
      .from('price_alerts')
      .insert({
        user_id: req.user.id,
        symbol: symbol.toUpperCase(),
        target_price: price,
        direction: direction,
      })
      .select('*')
      .single();

    if (insertErr) throw new Error(insertErr.message);
    console.log('[PriceAlerts] Created:', inserted?.id);

    res.json({ alert: inserted });
  } catch (e) {
    console.error('[PriceAlerts] POST error:', e.message, e.stack);
    res.status(500).json({ error: 'Internal error', detail: e.message });
  }
});

// ─── DELETE /api/alerts/price/:id ────────────────────────────────────────────

router.delete('/:id', async (req, res) => {
  try {
    const supabase = getSupabase();
    const { error, count } = await supabase
      .from('price_alerts')
      .delete({ count: 'exact' })
      .eq('id', req.params.id)
      .eq('user_id', req.user.id);
    if (error) throw new Error(error.message);
    if (count === 0) return res.status(404).json({ error: 'Alert not found' });
    res.json({ ok: true });
  } catch (e) {
    console.error('[PriceAlerts] DELETE error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ─── GET /api/alerts/price/prefs ─────────────────────────────────────────────

router.get('/prefs', async (req, res) => {
  try {
    const supabase = getSupabase();
    const { data } = await supabase
      .from('price_alert_prefs')
      .select('email_enabled, push_price_alerts')
      .eq('user_id', req.user.id)
      .maybeSingle();

    res.json({
      prefs: {
        email_enabled:     data?.email_enabled     ?? PREFS_DEFAULTS.email_enabled,
        push_price_alerts: data?.push_price_alerts ?? PREFS_DEFAULTS.push_price_alerts,
      }
    });
  } catch (e) {
    console.error('[PriceAlerts] GET /prefs error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ─── PUT /api/alerts/price/prefs ─────────────────────────────────────────────

router.put('/prefs', async (req, res) => {
  try {
    const { email_enabled, push_price_alerts } = req.body;

    // Explicit boolean validation
    const emailOpt = typeof email_enabled     === 'boolean' ? email_enabled     : PREFS_DEFAULTS.email_enabled;
    const pushOpt  = typeof push_price_alerts === 'boolean' ? push_price_alerts : PREFS_DEFAULTS.push_price_alerts;

    const supabase = getSupabase();
    const { error } = await supabase
      .from('price_alert_prefs')
      .upsert({
        user_id:           req.user.id,
        email_enabled:     emailOpt,
        push_price_alerts: pushOpt,
        updated_at:        new Date().toISOString(),
      }, { onConflict: 'user_id' });

    if (error) throw new Error(error.message);

    console.log(`[PriceAlerts] Prefs updated for ${req.user.id}: email=${emailOpt} push=${pushOpt}`);
    res.json({ ok: true, prefs: { email_enabled: emailOpt, push_price_alerts: pushOpt } });
  } catch (e) {
    console.error('[PriceAlerts] PUT /prefs error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ─── POST /api/alerts/price/check ────────────────────────────────────────────

router.post('/check', requireAdmin, async (req, res) => {
  try {
    const triggered = await checkAndTriggerAlerts();
    res.json({ triggered });
  } catch (e) {
    console.error('[PriceAlerts] check error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ─── checkAndTriggerAlerts ────────────────────────────────────────────────────

async function checkAndTriggerAlerts() {
  try {
    const supabase = getSupabase();
    const { data: alerts, error: fetchErr } = await supabase
      .from('price_alerts')
      .select('*')
      .eq('triggered', false)
      .eq('is_active', true);
    if (fetchErr) throw new Error(fetchErr.message);
    if (!alerts.length) return 0;

    // Batch fetch prices — group by symbol to minimise API calls
    const symbols = [...new Set(alerts.map(a => a.symbol))];
    const prices  = {};

    for (const symbol of symbols) {
      try {
        const resp = await fetch(
          `https://query2.finance.yahoo.com/v8/finance/chart/${symbol}?range=1d&interval=1d`,
          { headers: { 'User-Agent': 'Mozilla/5.0 TradVue/1.0' }, signal: AbortSignal.timeout(5000) }
        );
        if (resp.ok) {
          const data = await resp.json();
          const meta = data?.chart?.result?.[0]?.meta;
          if (meta?.regularMarketPrice) prices[symbol] = meta.regularMarketPrice;
        }
      } catch { /* skip symbol */ }
    }

    // Determine which alerts trigger
    const toTrigger = [];
    for (const alert of alerts) {
      const price = prices[alert.symbol];
      if (price == null) continue;

      const shouldTrigger =
        (alert.direction === 'above' && price >= alert.target_price) ||
        (alert.direction === 'below' && price <= alert.target_price);

      if (shouldTrigger) toTrigger.push({ ...alert, currentPrice: price });
    }

    if (!toTrigger.length) return 0;

    // Mark triggered in DB
    const ids = toTrigger.map(a => a.id);
    const { error: updateErr } = await supabase
      .from('price_alerts')
      .update({ triggered: true, is_active: false, triggered_at: new Date().toISOString() })
      .in('id', ids);
    if (updateErr) console.error('[PriceAlerts] Trigger update error:', updateErr.message);

    console.log(`[PriceAlerts] Triggered ${toTrigger.length} price alert(s): ${toTrigger.map(a => a.symbol).join(', ')}`);

    // Fire all notifications (push + email + SSE) — non-blocking, errors logged internally
    sendPriceAlertNotifications(toTrigger).catch(err => {
      console.error('[PriceAlerts] sendPriceAlertNotifications error:', err.message);
    });

    return toTrigger.length;
  } catch (e) {
    console.error('[PriceAlerts] checkAndTriggerAlerts error:', e.message);
    return 0;
  }
}

module.exports = router;
module.exports.checkAndTriggerAlerts = checkAndTriggerAlerts;
