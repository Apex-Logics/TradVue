/**
 * Alerts Router
 *
 * GET  /api/alerts          - List recent market alerts
 * GET  /api/alerts/count    - Unread HIGH-urgency count (for badge)
 * GET  /api/alerts/live     - SSE stream for real-time alert push
 * POST /api/alerts/subscribe - Upsert user alert preferences (auth required)
 * GET  /api/alerts/subscription - Get user's current preferences (auth required)
 * PATCH /api/alerts/read    - Mark alert IDs as read
 */

const express = require('express');
const router = express.Router();
const alertService = require('../services/alertService');
const marketAlertsRouter = require('./marketAlerts');

// ── Mount market-specific alert sub-routes ──────────────────────────────────
// GET /api/alerts/market   — price-move alerts
// GET /api/alerts/calendar — upcoming high-impact events
router.use('/', marketAlertsRouter);

// ─────────────────────────────────────────────────────────────────────────────
// Validation helpers
// ─────────────────────────────────────────────────────────────────────────────

const VALID_CATEGORIES = ['POLITICAL', 'FED', 'ECONOMIC', 'EARNINGS', 'BREAKING'];
const VALID_URGENCIES  = ['HIGH', 'MEDIUM', 'LOW'];

function validateCategories(cats) {
  if (!Array.isArray(cats)) return false;
  return cats.every(c => VALID_CATEGORIES.includes(c));
}

function validateUrgencies(urgs) {
  if (!Array.isArray(urgs)) return false;
  return urgs.every(u => VALID_URGENCIES.includes(u));
}

// Simple auth guard — checks req.user (set by AuthContext middleware in server.js)
function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }
  next();
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/alerts
// ─────────────────────────────────────────────────────────────────────────────

router.get('/', async (req, res) => {
  try {
    const limit    = Math.min(parseInt(req.query.limit || '50', 10), 200);
    const category = req.query.category?.toUpperCase() || null;
    const urgency  = req.query.urgency?.toUpperCase()  || null;
    const hours    = parseInt(req.query.hours || '24', 10);

    if (category && !VALID_CATEGORIES.includes(category)) {
      return res.status(400).json({ success: false, error: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}` });
    }

    if (urgency && !VALID_URGENCIES.includes(urgency)) {
      return res.status(400).json({ success: false, error: `Invalid urgency. Must be one of: ${VALID_URGENCIES.join(', ')}` });
    }

    const alerts = await alertService.getRecentAlerts({
      limit,
      category,
      urgency,
      offsetMinutes: hours * 60,
    });

    res.json({
      success: true,
      count: alerts.length,
      data: alerts,
      meta: { limit, category, urgency, hours },
    });
  } catch (err) {
    console.error('[Alerts] GET / error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to fetch alerts' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/alerts/count
// ─────────────────────────────────────────────────────────────────────────────

router.get('/count', async (req, res) => {
  try {
    const count = await alertService.getUnreadCount();
    res.json({ success: true, count });
  } catch (err) {
    console.error('[Alerts] GET /count error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to get alert count' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/alerts/live  — Server-Sent Events
// ─────────────────────────────────────────────────────────────────────────────

router.get('/live', (req, res) => {
  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
  res.flushHeaders();

  // Register client
  const clientId = alertService.registerSSEClient(res);

  // Send initial heartbeat so client knows it's connected
  res.write(`event: connected\ndata: ${JSON.stringify({
    message: 'TradVue Alert Stream connected',
    clientId,
    timestamp: new Date().toISOString(),
    connectedClients: alertService.getSSEClientCount(),
  })}\n\n`);

  // Heartbeat every 30s to prevent proxy timeouts
  const heartbeat = setInterval(() => {
    try {
      res.write(`: heartbeat ${new Date().toISOString()}\n\n`);
    } catch {
      clearInterval(heartbeat);
    }
  }, 30_000);

  req.on('close', () => {
    clearInterval(heartbeat);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/alerts/subscribe
// ─────────────────────────────────────────────────────────────────────────────

router.post('/subscribe', requireAuth, async (req, res) => {
  try {
    const {
      categories,
      urgencies,
      sound_enabled,
      email_enabled,
      push_enabled,
    } = req.body;

    // Validate categories if provided
    if (categories !== undefined && !validateCategories(categories)) {
      return res.status(400).json({
        success: false,
        error: `Invalid categories. Must be an array of: ${VALID_CATEGORIES.join(', ')}`,
      });
    }

    // Validate urgencies if provided
    if (urgencies !== undefined && !validateUrgencies(urgencies)) {
      return res.status(400).json({
        success: false,
        error: `Invalid urgencies. Must be an array of: ${VALID_URGENCIES.join(', ')}`,
      });
    }

    const subscription = await alertService.upsertSubscription(req.user.id, {
      categories,
      urgencies,
      sound_enabled,
      email_enabled,
      push_enabled,
    });

    res.json({ success: true, data: subscription });
  } catch (err) {
    console.error('[Alerts] POST /subscribe error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to save subscription' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/alerts/subscription
// ─────────────────────────────────────────────────────────────────────────────

router.get('/subscription', requireAuth, async (req, res) => {
  try {
    const subscription = await alertService.getSubscription(req.user.id);
    res.json({ success: true, data: subscription });
  } catch (err) {
    console.error('[Alerts] GET /subscription error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to get subscription' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/alerts/read
// ─────────────────────────────────────────────────────────────────────────────

router.patch('/read', requireAuth, async (req, res) => {
  try {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, error: 'ids must be a non-empty array' });
    }

    await alertService.markAsRead(ids);
    res.json({ success: true, marked: ids.length });
  } catch (err) {
    console.error('[Alerts] PATCH /read error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to mark alerts as read' });
  }
});

module.exports = router;
