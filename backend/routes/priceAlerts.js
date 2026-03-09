/**
 * Price Alerts Routes
 *
 * GET    /api/alerts/price         — List user's price alerts
 * POST   /api/alerts/price         — Create a price alert
 * DELETE /api/alerts/price/:id     — Delete a price alert
 * POST   /api/alerts/price/check   — Internal: check all alerts against current prices
 */

const express = require('express');
const router = express.Router();
const db = require('../services/db');
const { authenticateToken } = require('./auth');

// All price alert routes require auth
router.use(authenticateToken);

// ─── GET /api/alerts/price ────────────────────────────────────────────────────

router.get('/', async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT * FROM price_alerts WHERE user_id = $1 ORDER BY created_at DESC`,
      [req.user.userId]
    );
    res.json({ alerts: rows });
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

    const { rows } = await db.query(
      `INSERT INTO price_alerts (user_id, symbol, target_price, direction)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [req.user.userId, symbol.toUpperCase(), price, direction]
    );

    res.json({ alert: rows[0] });
  } catch (e) {
    console.error('[PriceAlerts] POST error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ─── DELETE /api/alerts/price/:id ────────────────────────────────────────────

router.delete('/:id', async (req, res) => {
  try {
    const { rowCount } = await db.query(
      `DELETE FROM price_alerts WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.userId]
    );
    if (rowCount === 0) {
      return res.status(404).json({ error: 'Alert not found' });
    }
    res.json({ ok: true });
  } catch (e) {
    console.error('[PriceAlerts] DELETE error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ─── POST /api/alerts/price/check ────────────────────────────────────────────
// Called internally by the polling loop to check prices and mark triggered alerts

router.post('/check', async (req, res) => {
  try {
    const triggered = await checkAndTriggerAlerts();
    res.json({ triggered });
  } catch (e) {
    console.error('[PriceAlerts] check error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ─── Internal: check prices ───────────────────────────────────────────────────

async function checkAndTriggerAlerts() {
  try {
    // Get all non-triggered alerts
    const { rows: alerts } = await db.query(
      `SELECT * FROM price_alerts WHERE triggered = FALSE`
    );

    if (!alerts.length) return 0;

    // Group by symbol to minimize API calls
    const symbols = [...new Set(alerts.map(a => a.symbol))];
    const prices = {};

    for (const symbol of symbols) {
      try {
        const resp = await fetch(
          `https://query2.finance.yahoo.com/v8/finance/chart/${symbol}?range=1d&interval=1d`,
          { headers: { 'User-Agent': 'Mozilla/5.0 TradVue/1.0' }, signal: AbortSignal.timeout(5000) }
        );
        if (resp.ok) {
          const data = await resp.json();
          const meta = data?.chart?.result?.[0]?.meta;
          if (meta?.regularMarketPrice) {
            prices[symbol] = meta.regularMarketPrice;
          }
        }
      } catch { /* skip symbol */ }
    }

    let triggered = 0;
    for (const alert of alerts) {
      const price = prices[alert.symbol];
      if (price == null) continue;

      const shouldTrigger =
        (alert.direction === 'above' && price >= alert.target_price) ||
        (alert.direction === 'below' && price <= alert.target_price);

      if (shouldTrigger) {
        await db.query(
          `UPDATE price_alerts SET triggered = TRUE, triggered_at = NOW() WHERE id = $1`,
          [alert.id]
        );
        triggered++;
      }
    }

    if (triggered > 0) {
      console.log(`[PriceAlerts] Triggered ${triggered} price alert(s)`);
    }
    return triggered;
  } catch (e) {
    console.error('[PriceAlerts] checkAndTriggerAlerts error:', e.message);
    return 0;
  }
}

module.exports = router;
module.exports.checkAndTriggerAlerts = checkAndTriggerAlerts;
