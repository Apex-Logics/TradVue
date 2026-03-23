/**
 * Price Alert Notifier
 *
 * Handles all notifications when a price alert is triggered:
 *   1. Push notification (web-push) — only if user opted in via push_price_alerts pref
 *   2. Email (Resend) — only if email_enabled === true (opt-in, default OFF)
 *      - Max 10 emails/user/hour; multiple triggers batch into one summary email
 *      - Every email includes disclaimer + one-click unsubscribe link (CAN-SPAM)
 *   3. SSE broadcast — updates all connected dashboard tabs in real-time
 *
 * Privacy: Payloads contain ONLY ticker/direction/target/current price.
 * Never include balance, P&L, position size, or shares.
 *
 * Defaults:
 *   email_enabled     = false  (opt-in only)
 *   push_price_alerts = false  (opt-in only)
 */

'use strict';

const webPush = require('web-push');
const crypto  = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const { broadcastAlert } = require('./alertService');

// ─── VAPID init (idempotent) ──────────────────────────────────────────────────

let vapidReady = false;
function ensureVapid() {
  if (vapidReady) return;
  const pub  = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subj = process.env.VAPID_SUBJECT || 'mailto:support@tradvue.com';
  if (pub && priv) {
    webPush.setVapidDetails(subj, pub, priv);
    vapidReady = true;
  }
}

// ─── Resend init (lazy) ───────────────────────────────────────────────────────

let resendClient = null;
function getResend() {
  if (resendClient) return resendClient;
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  const { Resend } = require('resend');
  resendClient = new Resend(key);
  return resendClient;
}

// ─── Opt-in defaults (exported for tests) ────────────────────────────────────

const PREFS_DEFAULTS = {
  email_enabled:     false,  // MUST be explicitly opted in
  push_price_alerts: false,  // MUST be explicitly opted in
  push_ritual:       false,  // daily ritual reminder (existing)
};
exports.PREFS_DEFAULTS = PREFS_DEFAULTS;

// ─── Unsubscribe token (HMAC-based, stateless) ────────────────────────────────

const UNSUB_SECRET = process.env.UNSUB_TOKEN_SECRET || process.env.INTERNAL_SERVICE_SECRET || null;

/**
 * Generate a URL-safe unsubscribe token for a userId.
 * Format: base64url(userId_hex . hmac)
 */
function generateUnsubToken(userId) {
  if (!UNSUB_SECRET) return null;
  const payload = Buffer.from(userId).toString('hex');
  const sig = crypto.createHmac('sha256', UNSUB_SECRET).update(payload).digest('hex');
  return Buffer.from(`${payload}.${sig}`).toString('base64url');
}
exports.generateUnsubToken = generateUnsubToken;

/**
 * Validate an unsubscribe token.
 * Returns userId string on success, null on failure.
 * @param {string} token
 * @returns {string|null}
 */
function validateUnsubToken(token) {
  if (!UNSUB_SECRET || !token) return null;
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf8');
    const dotIdx = decoded.lastIndexOf('.');
    if (dotIdx === -1) return null;
    const payload = decoded.slice(0, dotIdx);
    const sig     = decoded.slice(dotIdx + 1);
    const expected = crypto.createHmac('sha256', UNSUB_SECRET).update(payload).digest('hex');
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
    return Buffer.from(payload, 'hex').toString('utf8');
  } catch {
    return null;
  }
}
exports.validateUnsubToken = validateUnsubToken;

// ─── Email rate limiter (in-process, resets with server restart) ──────────────
// Production: swap with Redis. Good enough for Render single-instance.

const EMAIL_RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const EMAIL_RATE_MAX       = 10;              // max emails per user per hour

/** @type {Map<string, { count: number; windowStart: number }>} */
const emailRateBuckets = new Map();

/**
 * Returns true if the user has hit the hourly email cap (should be blocked).
 * Side-effect: increments the counter when returning false.
 * @param {string} userId
 * @returns {boolean}
 */
function shouldRateLimit(userId) {
  const now = Date.now();
  let bucket = emailRateBuckets.get(userId);

  if (!bucket || now - bucket.windowStart >= EMAIL_RATE_WINDOW_MS) {
    bucket = { count: 0, windowStart: now };
  }

  if (bucket.count >= EMAIL_RATE_MAX) {
    emailRateBuckets.set(userId, bucket);
    return true; // blocked
  }

  bucket.count++;
  emailRateBuckets.set(userId, bucket);
  return false; // allowed
}
exports.shouldRateLimit = shouldRateLimit;

// ─── Formatting helpers ───────────────────────────────────────────────────────

function fmtPrice(n) {
  return Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function dirLabel(direction) {
  return direction === 'above' ? 'Above' : 'Below';
}

// ─── Push payload builder ─────────────────────────────────────────────────────

/**
 * Build a push notification payload for a triggered price alert.
 * Privacy: only symbol, direction, target, current price.
 * @param {{ symbol: string, direction: string, target_price: number }} alert
 * @param {number} currentPrice
 * @returns {Object}
 */
function buildPushPayload(alert, currentPrice) {
  const { symbol, direction, target_price } = alert;
  const dir = dirLabel(direction);
  return {
    title: `🔔 Price Alert: ${symbol}`,
    body:  `${symbol} hit $${fmtPrice(currentPrice)} (target: ${dir} $${fmtPrice(target_price)})`,
    icon:  '/icons/icon-192x192.png',
    badge: '/icons/icon-192x192.png',
    url:   '/portfolio?tab=alerts',
    tag:   `price-alert-${symbol}`,
    data:  { symbol, direction, targetPrice: target_price, currentPrice },
  };
}
exports.buildPushPayload = buildPushPayload;

// ─── Email HTML builder ───────────────────────────────────────────────────────

const DISCLAIMER = `
  <p style="font-size:11px;color:#6b7280;margin-top:28px;padding-top:14px;border-top:1px solid #374151;line-height:1.6;">
    <strong>Disclaimer:</strong> Price alerts are informational only and not financial advice.
    Prices shown may be delayed and may not reflect real-time market conditions.
    TradVue is not responsible for missed or delayed alerts.
    This message does not constitute investment advice, a recommendation to buy or sell,
    or a guarantee of any outcome. Trade at your own risk.
  </p>
`;

function unsubLine(unsubUrl) {
  return `
  <p style="font-size:11px;color:#9ca3af;margin-top:12px;text-align:center;">
    You're receiving this because you opted in to price alert emails on TradVue.
    <a href="${unsubUrl}" style="color:#6366f1;">Unsubscribe</a>
  </p>
  `;
}

/**
 * Build single-alert trigger email HTML.
 * @param {{ symbol, direction, target_price }} alert
 * @param {number} currentPrice
 * @param {string} unsubUrl
 * @returns {string}
 */
function buildEmailHtml(alert, currentPrice, unsubUrl) {
  const { symbol, direction, target_price } = alert;
  const dir = dirLabel(direction);
  const dirColor = direction === 'above' ? '#4ade80' : '#f87171';

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Price Alert: ${symbol}</title></head>
<body style="background:#111827;font-family:system-ui,sans-serif;margin:0;padding:24px;">
  <div style="max-width:480px;margin:0 auto;background:#1f2937;border-radius:12px;padding:28px;border:1px solid #374151;">
    <div style="font-size:22px;margin-bottom:4px;">🔔 Price Alert Triggered</div>
    <h1 style="font-size:28px;font-weight:800;color:#f9fafb;margin:0 0 20px;">${symbol}</h1>

    <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
      <tr>
        <td style="font-size:12px;color:#9ca3af;padding:8px 0 4px;">Direction</td>
        <td style="font-size:12px;color:#9ca3af;padding:8px 0 4px;text-align:right;">Target Price</td>
        <td style="font-size:12px;color:#9ca3af;padding:8px 0 4px;text-align:right;">Current Price</td>
      </tr>
      <tr>
        <td style="font-size:18px;font-weight:700;color:${dirColor};">${dir}</td>
        <td style="font-size:18px;font-weight:700;color:#f9fafb;text-align:right;font-family:monospace;">$${fmtPrice(target_price)}</td>
        <td style="font-size:18px;font-weight:700;color:#f9fafb;text-align:right;font-family:monospace;">$${fmtPrice(currentPrice)}</td>
      </tr>
    </table>

    <a href="https://www.tradvue.com/portfolio?tab=alerts"
       style="display:inline-block;background:#6366f1;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600;font-size:13px;">
      View Alerts →
    </a>

    ${DISCLAIMER}
    ${unsubLine(unsubUrl)}
  </div>
</body>
</html>`;
}
exports.buildEmailHtml = buildEmailHtml;

/**
 * Build a batch summary email for multiple triggered alerts (CAN-SPAM batching).
 * @param {Array<{ alert: Object, currentPrice: number }>} items
 * @param {string} unsubUrl
 * @returns {string}
 */
function buildBatchEmailHtml(items, unsubUrl) {
  const rows = items.map(({ alert, currentPrice }) => {
    const dir = dirLabel(alert.direction);
    const dirColor = alert.direction === 'above' ? '#4ade80' : '#f87171';
    return `
      <tr style="border-bottom:1px solid #374151;">
        <td style="padding:10px 8px;font-weight:700;color:#f9fafb;font-size:14px;">${alert.symbol}</td>
        <td style="padding:10px 8px;color:${dirColor};font-weight:600;">${dir}</td>
        <td style="padding:10px 8px;color:#f9fafb;text-align:right;font-family:monospace;">$${fmtPrice(alert.target_price)}</td>
        <td style="padding:10px 8px;color:#f9fafb;text-align:right;font-family:monospace;">$${fmtPrice(currentPrice)}</td>
      </tr>`;
  }).join('');

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Price Alerts Triggered</title></head>
<body style="background:#111827;font-family:system-ui,sans-serif;margin:0;padding:24px;">
  <div style="max-width:560px;margin:0 auto;background:#1f2937;border-radius:12px;padding:28px;border:1px solid #374151;">
    <div style="font-size:22px;margin-bottom:4px;">🔔 ${items.length} Price Alerts Triggered</div>
    <p style="color:#9ca3af;margin:0 0 20px;font-size:13px;">The following alerts have hit their targets:</p>

    <table style="width:100%;border-collapse:collapse;">
      <thead>
        <tr style="background:#374151;">
          <th style="padding:8px;text-align:left;font-size:11px;color:#9ca3af;text-transform:uppercase;">Ticker</th>
          <th style="padding:8px;text-align:left;font-size:11px;color:#9ca3af;text-transform:uppercase;">Direction</th>
          <th style="padding:8px;text-align:right;font-size:11px;color:#9ca3af;text-transform:uppercase;">Target</th>
          <th style="padding:8px;text-align:right;font-size:11px;color:#9ca3af;text-transform:uppercase;">Triggered At</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>

    <a href="https://www.tradvue.com/portfolio?tab=alerts"
       style="display:inline-block;margin-top:20px;background:#6366f1;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600;font-size:13px;">
      View All Alerts →
    </a>

    ${DISCLAIMER}
    ${unsubLine(unsubUrl)}
  </div>
</body>
</html>`;
}
exports.buildBatchEmailHtml = buildBatchEmailHtml;

// ─── Supabase helper ──────────────────────────────────────────────────────────

function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
  );
}

// ─── Core dispatcher ──────────────────────────────────────────────────────────

/**
 * Send all notifications for a batch of triggered alerts grouped by user.
 *
 * Input: array of triggered DB alert rows (already marked triggered=TRUE in DB),
 * each enriched with currentPrice.
 *
 * Per-user flow:
 *   1. Load notification preferences from DB (price_alert_prefs table or alert_subscriptions)
 *   2. Push: if push_price_alerts === true and VAPID configured
 *   3. Email: if email_enabled === true, not rate-limited → single or batch email
 *   4. SSE: always broadcast (used for live dashboard update)
 *
 * @param {Array<{ id, user_id, symbol, direction, target_price, currentPrice }>} triggeredAlerts
 */
async function sendPriceAlertNotifications(triggeredAlerts) {
  if (!triggeredAlerts.length) return;

  ensureVapid();

  // Group by user_id
  const byUser = new Map();
  for (const alert of triggeredAlerts) {
    if (!byUser.has(alert.user_id)) byUser.set(alert.user_id, []);
    byUser.get(alert.user_id).push(alert);
  }

  const supabase = getSupabase();

  for (const [userId, alerts] of byUser) {
    try {
      await dispatchForUser(userId, alerts, supabase);
    } catch (err) {
      console.error(`[PriceAlertNotifier] Error dispatching for user ${userId}:`, err.message);
      // Continue to next user — never let one failure block others
    }
  }

  // SSE broadcast for all alerts (used by dashboard; no opt-in needed — it's local)
  for (const alert of triggeredAlerts) {
    try {
      broadcastAlert({
        type: 'price_alert_triggered',
        alertId: alert.id,
        symbol: alert.symbol,
        direction: alert.direction,
        target_price: alert.target_price,
        current_price: alert.currentPrice,
        triggered_at: new Date().toISOString(),
      });
    } catch (err) {
      console.warn('[PriceAlertNotifier] SSE broadcast error:', err.message);
    }
  }
}
exports.sendPriceAlertNotifications = sendPriceAlertNotifications;

// ─── Per-user dispatch ────────────────────────────────────────────────────────

async function dispatchForUser(userId, alerts, supabase) {
  // 1. Load prefs (price_alert_prefs) — fallback to alert_subscriptions for email_enabled
  const prefs = await loadUserPrefs(userId, supabase);

  // 2. Push notifications
  if (prefs.push_price_alerts && vapidReady) {
    await sendPushForUser(userId, alerts, supabase);
  }

  // 3. Email
  if (prefs.email_enabled) {
    await sendEmailForUser(userId, alerts, prefs, supabase);
  }
}

// ─── Load prefs ───────────────────────────────────────────────────────────────

async function loadUserPrefs(userId, supabase) {
  const defaults = { ...PREFS_DEFAULTS };

  try {
    // Primary: price_alert_prefs table
    const { data: prefRow } = await supabase
      .from('price_alert_prefs')
      .select('email_enabled, push_price_alerts')
      .eq('user_id', userId)
      .maybeSingle();

    if (prefRow) {
      return {
        email_enabled:     prefRow.email_enabled     ?? false,
        push_price_alerts: prefRow.push_price_alerts ?? false,
      };
    }

    // Fallback: alert_subscriptions (legacy email_enabled + push_enabled)
    const { data: subRow } = await supabase
      .from('alert_subscriptions')
      .select('email_enabled, push_enabled')
      .eq('user_id', userId)
      .maybeSingle();

    if (subRow) {
      return {
        email_enabled:     subRow.email_enabled  ?? false,
        push_price_alerts: subRow.push_enabled   ?? false,
      };
    }
  } catch (err) {
    console.warn('[PriceAlertNotifier] loadUserPrefs error:', err.message);
  }

  return defaults;
}

// ─── Push dispatch ────────────────────────────────────────────────────────────

async function sendPushForUser(userId, alerts, supabase) {
  try {
    const { data: subs, error } = await supabase
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .eq('user_id', userId)
      .eq('active', true);

    if (error || !subs?.length) return;

    const expiredEndpoints = [];

    for (const alert of alerts) {
      const payload = JSON.stringify(buildPushPayload(alert, alert.currentPrice));

      const results = await Promise.allSettled(
        subs.map(sub =>
          webPush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload
          )
        )
      );

      subs.forEach((sub, i) => {
        const r = results[i];
        if (r.status === 'rejected') {
          const code = r.reason?.statusCode;
          console.warn(`[PriceAlertNotifier] Push failed for user ${userId}: ${r.reason?.message}`);
          if (code === 404 || code === 410) expiredEndpoints.push(sub.endpoint);
        } else {
          console.log(`[PriceAlertNotifier] Push sent for ${alert.symbol} → user ${userId}`);
        }
      });
    }

    // Deactivate expired subscriptions
    if (expiredEndpoints.length) {
      await supabase
        .from('push_subscriptions')
        .update({ active: false, updated_at: new Date().toISOString() })
        .in('endpoint', expiredEndpoints);
    }
  } catch (err) {
    console.error('[PriceAlertNotifier] sendPushForUser error:', err.message);
  }
}

// ─── Email dispatch ───────────────────────────────────────────────────────────

async function sendEmailForUser(userId, alerts, prefs, supabase) {
  const resend = getResend();
  if (!resend) {
    console.warn('[PriceAlertNotifier] Resend not configured — skipping email');
    return;
  }

  // Rate limit check
  if (shouldRateLimit(userId)) {
    console.warn(`[PriceAlertNotifier] Email rate limit hit for user ${userId} — skipping`);
    return;
  }

  // Get user email
  let userEmail = null;
  try {
    const { data: authUser } = await supabase.auth.admin.getUserById(userId);
    userEmail = authUser?.user?.email || null;
  } catch (err) {
    console.warn('[PriceAlertNotifier] Could not fetch user email:', err.message);
  }

  if (!userEmail) {
    console.warn(`[PriceAlertNotifier] No email for user ${userId} — skipping email`);
    return;
  }

  const appUrl = process.env.RENDER_EXTERNAL_URL || 'https://www.tradvue.com';
  const unsubToken = generateUnsubToken(userId);
  if (!unsubToken) {
    console.error('[PriceAlertNotifier] Missing unsubscribe token secret — skipping email send');
    return;
  }
  const unsubUrl = `${appUrl}/api/alerts/price/unsubscribe?token=${unsubToken}`;

  try {
    let subject, html;

    if (alerts.length === 1) {
      const a = alerts[0];
      subject = `🔔 Price Alert: ${a.symbol} hit your target`;
      html = buildEmailHtml(a, a.currentPrice, unsubUrl);
    } else {
      const symbols = alerts.map(a => a.symbol).join(', ');
      subject = `🔔 ${alerts.length} Price Alerts Triggered: ${symbols}`;
      const items = alerts.map(a => ({ alert: a, currentPrice: a.currentPrice }));
      html = buildBatchEmailHtml(items, unsubUrl);
    }

    await resend.emails.send({
      from: 'TradVue Alerts <alerts@tradvue.com>',
      to:   userEmail,
      subject,
      html,
    });

    console.log(`[PriceAlertNotifier] Email sent to ${userEmail} for ${alerts.length} alert(s)`);
  } catch (err) {
    console.error(`[PriceAlertNotifier] Email send failed for user ${userId}:`, err.message);
  }
}
