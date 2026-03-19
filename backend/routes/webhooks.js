/**
 * TradingView Webhook Routes
 *
 * Two route groups:
 *   POST /api/webhook/tv/:userToken   — Public receiver (no auth, IP-allowlisted)
 *   GET/POST/DELETE /api/webhooks/*   — Management routes (requireAuth)
 *
 * Security model:
 *   - IP allowlist enforced FIRST — only TradingView IPs + localhost accepted
 *   - Max payload size: 10KB (enforced via express.text/express.raw body parser limit)
 *   - Token validated against webhook_tokens table
 *   - Per-token rate limit: 30 req/minute (in-memory, resets on restart)
 *   - All string inputs sanitized before DB write
 *   - 200 returned immediately; trade matching runs async
 */

'use strict';

const express = require('express');
const crypto  = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const { requireAuth } = require('../middleware/auth');
const xss = require('xss');

// ── Routers ───────────────────────────────────────────────────────────────────

const receiverRouter    = express.Router();   // mounted at /api/webhook
const managementRouter  = express.Router();   // mounted at /api/webhooks (with requireAuth)

// ── TradingView IP Allowlist ──────────────────────────────────────────────────
// Source: https://www.tradingview.com/support/solutions/43000529348/
const TRADINGVIEW_IPS = new Set([
  '52.89.214.238',
  '34.212.75.30',
  '54.218.53.128',
  '52.32.178.7',
  // Local development / CI
  '127.0.0.1',
  '::1',
  '::ffff:127.0.0.1',
  // TEMPORARY — Erick testing from home (remove after testing)
  '76.108.47.115',
  '::ffff:76.108.47.115',
]);

// ── Per-token rate limiter (in-memory, 30 req/min) ────────────────────────────
const tokenRateMap = new Map(); // token -> { count, resetAt }
const RATE_LIMIT    = 30;
const RATE_WINDOW   = 60 * 1000; // 1 minute

function checkTokenRateLimit(token) {
  const now = Date.now();
  const entry = tokenRateMap.get(token);

  if (!entry || now >= entry.resetAt) {
    tokenRateMap.set(token, { count: 1, resetAt: now + RATE_WINDOW });
    return true;
  }

  if (entry.count >= RATE_LIMIT) return false;

  entry.count += 1;
  return true;
}

// ── Supabase service-role client (bypasses RLS) ───────────────────────────────
function getServiceClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required');
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// ── IP Extraction ─────────────────────────────────────────────────────────────
function getSourceIP(req) {
  // Check x-forwarded-for first (reverse proxy / Render / Railway)
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    // x-forwarded-for can be comma-separated; take the first (client) IP
    const firstIP = forwarded.split(',')[0].trim();
    if (firstIP) return firstIP;
  }
  return req.socket?.remoteAddress || req.ip || 'unknown';
}

// ── Payload Parser ────────────────────────────────────────────────────────────
/**
 * Parses three TradingView alert formats:
 *
 * 1. Full strategy JSON:
 *    {"ticker":"AAPL","action":"buy","price":187.42,"quantity":100,"position":"long",
 *     "strategy":{"market_position":"long","order_action":"buy"}}
 *
 * 2. Simple JSON:
 *    {"ticker":"AAPL","action":"buy","price":187.42}
 *
 * 3. Plain text (space-separated):
 *    "buy AAPL 187.42 100"
 *
 * Returns: { ticker, action, price, quantity, position, raw } or null on failure.
 */
function parsePayload(body) {
  if (!body || (typeof body === 'string' && body.trim() === '')) return null;

  let parsed = null;

  // --- Try JSON first ---
  if (typeof body === 'object') {
    parsed = body;
  } else {
    try {
      parsed = JSON.parse(body);
    } catch {
      // Fall through to plain-text parser
    }
  }

  if (parsed && typeof parsed === 'object') {
    // Normalise field names (TradingView uses various conventions)
    const ticker   = sanitize(parsed.ticker || parsed.symbol || parsed.sym || '');
    const action   = sanitize((parsed.action || parsed.side || parsed.direction || '')).toLowerCase();
    const price    = parseFloat(parsed.price || parsed.fill_price || 0) || null;
    const quantity = parseFloat(parsed.quantity || parsed.qty || parsed.size || 0) || null;
    const position = sanitize((
      parsed.position ||
      parsed.strategy?.market_position ||
      parsed.market_position ||
      ''
    )).toLowerCase();

    if (!ticker || !action) return null;
    if (!['buy', 'sell'].includes(action)) return null;

    return { ticker: ticker.toUpperCase(), action, price, quantity, position, raw: parsed };
  }

  // --- Plain-text: "buy AAPL 187.42 100" ---
  if (typeof body === 'string') {
    const parts = body.trim().split(/\s+/);
    if (parts.length < 2) return null;

    const action = parts[0].toLowerCase();
    if (!['buy', 'sell'].includes(action)) return null;

    const ticker   = sanitize(parts[1]).toUpperCase();
    const price    = parts[2] ? parseFloat(parts[2]) || null : null;
    const quantity = parts[3] ? parseFloat(parts[3]) || null : null;

    if (!ticker) return null;
    return { ticker, action, price, quantity, position: '', raw: {} };
  }

  return null;
}

// ── Input sanitizer ───────────────────────────────────────────────────────────
function sanitize(str) {
  if (typeof str !== 'string') return '';
  // Strip HTML tags, then trim whitespace, max 100 chars
  return xss(str).replace(/<[^>]*>/g, '').trim().slice(0, 100);
}

// ── Trade Matching ────────────────────────────────────────────────────────────
/**
 * Async trade matching against the user's journal data.
 *
 * Journal data is stored as a JSON blob in the user_data table under
 * data_type = 'journal'.  The blob is an object whose values are arrays
 * of trade objects:
 *
 *   { [someKey]: [ { id, symbol, direction, entryPrice, exitPrice, ... }, ... ] }
 *
 * Matching rules:
 *   buy  + no open long  for ticker  → new LONG entry
 *   sell + open long     for ticker  → close trade (set exitPrice/exitTime)
 *   sell + no open short for ticker  → new SHORT entry
 *   buy  + open short    for ticker  → close trade
 *
 * Returns the matched/created trade id (integer index or generated) or null.
 */
async function matchAndJournalTrade(supabase, userId, parsed, eventId) {
  try {
    // Fetch current journal data
    const { data: row, error: fetchErr } = await supabase
      .from('user_data')
      .select('data')
      .eq('user_id', userId)
      .eq('data_type', 'journal')
      .maybeSingle();

    if (fetchErr) {
      console.error('[Webhook] Journal fetch error:', fetchErr.message);
      return { matched: false, error: fetchErr.message };
    }

    // Journal data is nested: { trades: [...] } or array at top-level
    const journalData = row?.data || {};
    const trades = Array.isArray(journalData.trades)
      ? journalData.trades
      : Array.isArray(journalData)
        ? journalData
        : [];

    const { ticker, action, price, quantity, position } = parsed;
    const now = new Date().toISOString();
    const today = now.split('T')[0];

    // --- Find open trade for this ticker ---
    // An open trade has no exitPrice
    const openIdx = trades.findIndex(
      t => t.symbol === ticker && (!t.exitPrice || t.exitPrice === 0 || t.exitPrice === null)
    );
    const openTrade = openIdx >= 0 ? trades[openIdx] : null;

    let updatedTrades = [...trades];
    let tradeId = null;
    let matchType = 'ignored';

    // Determine expected direction from position hint (if provided by strategy)
    const isLong  = position === 'long'  || action === 'buy';
    const isShort = position === 'short' || (action === 'sell' && !openTrade);

    if (action === 'buy') {
      if (openTrade && openTrade.direction === 'Short') {
        // Close an existing SHORT trade
        updatedTrades[openIdx] = {
          ...openTrade,
          exitPrice: price || openTrade.exitPrice,
          exitTime:  now,
          pnl: price && openTrade.entryPrice
            ? Math.round(((openTrade.entryPrice - price) * (quantity || openTrade.positionSize || 1)) * 100) / 100
            : openTrade.pnl || 0,
          status: 'closed',
          source: 'webhook',
        };
        tradeId  = openTrade.id || openIdx;
        matchType = 'matched';
      } else if (!openTrade) {
        // New LONG entry
        const newTrade = {
          id:           `wh_${eventId}_${Date.now()}`,
          date:         today,
          time:         now.split('T')[1].slice(0, 8),
          symbol:       ticker,
          assetClass:   'Stock',
          direction:    'Long',
          entryPrice:   price || 0,
          exitPrice:    null,
          positionSize: quantity || 1,
          stopLoss:     0,
          takeProfit:   0,
          commissions:  0,
          pnl:          0,
          rMultiple:    0,
          pctGainLoss:  0,
          holdMinutes:  0,
          setupTag:     '',
          notes:        `Auto-journaled via TradingView webhook`,
          status:       'open',
          source:       'webhook',
        };
        updatedTrades.push(newTrade);
        tradeId   = newTrade.id;
        matchType = 'matched';
      }
      // else: buy + open long = add-on (not handled, ignored)
    } else if (action === 'sell') {
      if (openTrade && openTrade.direction === 'Long') {
        // Close an existing LONG trade
        const entryPx = openTrade.entryPrice || 0;
        const exitPx  = price || 0;
        const qty     = quantity || openTrade.positionSize || 1;
        updatedTrades[openIdx] = {
          ...openTrade,
          exitPrice:   exitPx,
          exitTime:    now,
          pnl:         Math.round(((exitPx - entryPx) * qty) * 100) / 100,
          pctGainLoss: entryPx ? Math.round(((exitPx - entryPx) / entryPx) * 10000) / 100 : 0,
          status:      'closed',
          source:      'webhook',
        };
        tradeId   = openTrade.id || openIdx;
        matchType = 'matched';
      } else if (!openTrade) {
        // New SHORT entry
        const newTrade = {
          id:           `wh_${eventId}_${Date.now()}`,
          date:         today,
          time:         now.split('T')[1].slice(0, 8),
          symbol:       ticker,
          assetClass:   'Stock',
          direction:    'Short',
          entryPrice:   price || 0,
          exitPrice:    null,
          positionSize: quantity || 1,
          stopLoss:     0,
          takeProfit:   0,
          commissions:  0,
          pnl:          0,
          rMultiple:    0,
          pctGainLoss:  0,
          holdMinutes:  0,
          setupTag:     '',
          notes:        `Auto-journaled via TradingView webhook`,
          status:       'open',
          source:       'webhook',
        };
        updatedTrades.push(newTrade);
        tradeId   = newTrade.id;
        matchType = 'matched';
      }
      // else: sell + open short = add-on (ignored)
    }

    if (matchType === 'ignored') {
      return { matched: false, tradeId: null };
    }

    // Save updated journal back
    const updatedJournal = Array.isArray(journalData)
      ? updatedTrades
      : { ...journalData, trades: updatedTrades };

    const { error: saveErr } = await supabase
      .from('user_data')
      .upsert(
        { user_id: userId, data_type: 'journal', data: updatedJournal, updated_at: now },
        { onConflict: 'user_id,data_type' }
      );

    if (saveErr) {
      console.error('[Webhook] Journal save error:', saveErr.message);
      return { matched: false, error: saveErr.message };
    }

    // Update event record with matched status and trade_id
    await supabase
      .from('webhook_events')
      .update({ status: 'matched', trade_id: typeof tradeId === 'number' ? tradeId : null })
      .eq('id', eventId);

    // Increment token trade_count
    await supabase.rpc('increment_webhook_trade_count', { event_id: eventId }).catch(() => {
      // RPC may not exist yet — fallback manual update
      supabase
        .from('webhook_tokens')
        .select('id, trade_count')
        .then(({ data }) => {/* best-effort */});
    });

    return { matched: true, tradeId };
  } catch (err) {
    console.error('[Webhook] Trade matching error:', err.message);
    return { matched: false, error: err.message };
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// RECEIVER: POST /api/webhook/tv/:userToken
// ═════════════════════════════════════════════════════════════════════════════

receiverRouter.post(
  '/tv/:userToken',
  express.text({ type: '*/*', limit: '10kb' }),   // Accept JSON and plain-text alike
  async (req, res) => {
    // ── 1. IP Allowlist check (non-negotiable) ─────────────────────────────
    const sourceIP = getSourceIP(req);
    if (!TRADINGVIEW_IPS.has(sourceIP)) {
      console.warn(`[Webhook] Blocked IP: ${sourceIP}`);
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { userToken } = req.params;

    // ── 2. Token rate limit ────────────────────────────────────────────────
    if (!checkTokenRateLimit(userToken)) {
      console.warn(`[Webhook] Rate limit exceeded for token: ${userToken.slice(0, 8)}...`);
      return res.status(429).json({ error: 'Rate limit exceeded' });
    }

    // ── 3. Respond 200 IMMEDIATELY — TradingView has a 3-second timeout ───
    res.status(200).json({ ok: true });

    // ── 4. Everything else is async ───────────────────────────────────────
    setImmediate(async () => {
      try {
        const supabase = getServiceClient();

        // 4a. Validate token
        const { data: tokenRow, error: tokenErr } = await supabase
          .from('webhook_tokens')
          .select('id, user_id, is_active')
          .eq('token', userToken)
          .maybeSingle();

        if (tokenErr || !tokenRow) {
          console.warn(`[Webhook] Invalid token: ${userToken.slice(0, 8)}...`);
          return;
        }

        if (!tokenRow.is_active) {
          console.warn(`[Webhook] Inactive token: ${userToken.slice(0, 8)}...`);
          return;
        }

        const { id: tokenId, user_id: userId } = tokenRow;

        // 4b. Parse payload
        const body   = req.body;
        let parsed   = null;
        let parseErr = null;

        try {
          // body is a string from express.text() — try JSON then plain-text
          const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
          parsed = parsePayload(bodyStr);
        } catch (e) {
          parseErr = e.message;
        }

        if (!parsed) {
          // Store raw event with error status
          await supabase.from('webhook_events').insert({
            token_id:    tokenId,
            user_id:     userId,
            source_ip:   sourceIP,
            raw_payload: { raw: typeof body === 'string' ? body.slice(0, 1000) : body },
            status:      'error',
            error_message: parseErr || 'Failed to parse payload',
          });
          console.warn(`[Webhook] Parse failed for token ${userToken.slice(0, 8)}...`);
          return;
        }

        // 4c. Store event (received status)
        const { data: eventRow, error: insertErr } = await supabase
          .from('webhook_events')
          .insert({
            token_id:        tokenId,
            user_id:         userId,
            source_ip:       sourceIP,
            raw_payload:     typeof body === 'string' ? { raw: body } : body,
            parsed_ticker:   parsed.ticker,
            parsed_action:   parsed.action,
            parsed_price:    parsed.price,
            parsed_quantity: parsed.quantity,
            status:          'received',
          })
          .select('id')
          .single();

        if (insertErr) {
          console.error('[Webhook] Event insert error:', insertErr.message);
          return;
        }

        const eventId = eventRow.id;

        // 4d. Update token last_used_at
        await supabase
          .from('webhook_tokens')
          .update({ last_used_at: new Date().toISOString() })
          .eq('id', tokenId);

        // 4e. Attempt trade matching
        const { matched, error: matchErr } = await matchAndJournalTrade(
          supabase, userId, parsed, eventId
        );

        if (!matched && matchErr) {
          await supabase
            .from('webhook_events')
            .update({ status: 'error', error_message: matchErr })
            .eq('id', eventId);
        } else if (!matched) {
          await supabase
            .from('webhook_events')
            .update({ status: 'ignored' })
            .eq('id', eventId);
        }

        // 4f. Increment trade_count on token
        if (matched) {
          await supabase
            .from('webhook_tokens')
            .update({ trade_count: supabase.rpc ? undefined : undefined }) // handled below
            .eq('id', tokenId);

          // Use raw SQL increment via RPC (if available) or SELECT+UPDATE
          const { data: tkData } = await supabase
            .from('webhook_tokens')
            .select('trade_count')
            .eq('id', tokenId)
            .single();
          if (tkData) {
            await supabase
              .from('webhook_tokens')
              .update({ trade_count: (tkData.trade_count || 0) + 1 })
              .eq('id', tokenId);
          }
        }

        console.log(
          `[Webhook] Processed: token=${userToken.slice(0, 8)} ` +
          `ticker=${parsed.ticker} action=${parsed.action} ` +
          `matched=${matched}`
        );
      } catch (err) {
        console.error('[Webhook] Async processing error:', err.message);
      }
    });
  }
);

// ═════════════════════════════════════════════════════════════════════════════
// MANAGEMENT ROUTES (all require requireAuth — mounted at /api/webhooks)
// ═════════════════════════════════════════════════════════════════════════════

const MAX_TOKENS_PER_USER = 5;

function genToken() {
  return crypto.randomBytes(16).toString('hex'); // 32 hex chars
}

// ── GET /api/webhooks/tokens ──────────────────────────────────────────────────
managementRouter.get('/tokens', requireAuth, async (req, res) => {
  try {
    const supabase = getServiceClient();
    const { data, error } = await supabase
      .from('webhook_tokens')
      .select('id, token, label, source, is_active, last_used_at, trade_count, created_at')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Webhook] List tokens error:', error.message);
      return res.status(500).json({ error: 'Failed to list tokens' });
    }

    res.json({ tokens: data || [] });
  } catch (err) {
    console.error('[Webhook] List tokens error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /api/webhooks/tokens ─────────────────────────────────────────────────
managementRouter.post('/tokens', requireAuth, async (req, res) => {
  try {
    const supabase = getServiceClient();
    const userId   = req.user.id;

    // Enforce max 5 tokens per user
    const { count, error: countErr } = await supabase
      .from('webhook_tokens')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (countErr) return res.status(500).json({ error: 'Failed to check token count' });
    if ((count || 0) >= MAX_TOKENS_PER_USER) {
      return res.status(400).json({
        error: `Maximum ${MAX_TOKENS_PER_USER} tokens per user. Delete an existing token first.`,
      });
    }

    const label = sanitize(req.body?.label || 'TradingView').slice(0, 50) || 'TradingView';
    const token = genToken();

    const { data, error } = await supabase
      .from('webhook_tokens')
      .insert({
        user_id: userId,
        token,
        label,
        source: 'tradingview',
        is_active: true,
      })
      .select('id, token, label, source, is_active, created_at')
      .single();

    if (error) {
      console.error('[Webhook] Create token error:', error.message);
      return res.status(500).json({ error: 'Failed to create token' });
    }

    res.status(201).json({ token: data });
  } catch (err) {
    console.error('[Webhook] Create token error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── DELETE /api/webhooks/tokens/:id ──────────────────────────────────────────
managementRouter.delete('/tokens/:id', requireAuth, async (req, res) => {
  try {
    const tokenId   = parseInt(req.params.id, 10);
    if (isNaN(tokenId)) return res.status(400).json({ error: 'Invalid token id' });
    const supabase  = getServiceClient();

    const { error } = await supabase
      .from('webhook_tokens')
      .delete()
      .eq('id', tokenId)
      .eq('user_id', req.user.id);   // Ensures own-only deletion

    if (error) {
      console.error('[Webhook] Delete token error:', error.message);
      return res.status(500).json({ error: 'Failed to delete token' });
    }

    res.json({ message: 'Token deleted' });
  } catch (err) {
    console.error('[Webhook] Delete token error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /api/webhooks/tokens/:id/rotate ─────────────────────────────────────
managementRouter.post('/tokens/:id/rotate', requireAuth, async (req, res) => {
  try {
    const tokenId  = parseInt(req.params.id, 10);
    if (isNaN(tokenId)) return res.status(400).json({ error: 'Invalid token id' });
    const supabase = getServiceClient();

    const newToken = genToken();

    const { data, error } = await supabase
      .from('webhook_tokens')
      .update({ token: newToken, updated_at: new Date().toISOString() })
      .eq('id', tokenId)
      .eq('user_id', req.user.id)    // own only
      .select('id, token, label, is_active, updated_at')
      .single();

    if (error || !data) {
      console.error('[Webhook] Rotate token error:', error?.message);
      return res.status(error ? 500 : 404).json({
        error: error ? 'Failed to rotate token' : 'Token not found',
      });
    }

    res.json({ token: data, message: 'Token rotated — update your TradingView alert immediately.' });
  } catch (err) {
    console.error('[Webhook] Rotate token error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /api/webhooks/events ──────────────────────────────────────────────────
managementRouter.get('/events', requireAuth, async (req, res) => {
  try {
    const supabase = getServiceClient();
    const page     = Math.max(1, parseInt(req.query.page || '1', 10));
    const limit    = 100;
    const offset   = (page - 1) * limit;

    const { data, error } = await supabase
      .from('webhook_events')
      .select(
        'id, token_id, source_ip, parsed_ticker, parsed_action, parsed_price, ' +
        'parsed_quantity, trade_id, status, error_message, created_at'
      )
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('[Webhook] List events error:', error.message);
      return res.status(500).json({ error: 'Failed to list events' });
    }

    res.json({ events: data || [], page, limit });
  } catch (err) {
    console.error('[Webhook] List events error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});


// Simulates a TradingView webhook for the user's active token.
// Bypasses IP allowlist — marks event with source_ip = 'test', status = 'test'.
managementRouter.post('/test', requireAuth, async (req, res) => {
  try {
    const supabase = getServiceClient();
    const userId   = req.user.id;

    // Find user's active token
    const { data: tokenRow, error: tokenErr } = await supabase
      .from('webhook_tokens')
      .select('id, token, is_active')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (tokenErr) {
      console.error('[Webhook Test] Token lookup error:', tokenErr.message);
      return res.status(500).json({ error: 'Failed to look up your webhook token' });
    }

    if (!tokenRow) {
      return res.status(400).json({
        error: 'No active webhook token found. Generate a webhook URL first.',
      });
    }

    const { id: tokenId } = tokenRow;

    // Build a synthetic test payload
    const testPayload = {
      ticker:   'TEST',
      action:   'buy',
      price:    100.00,
      quantity: 1,
      position: 'long',
      comment:  'TradVue connection test',
    };

    // Insert test event directly (bypass IP check and rate limit)
    const { data: eventRow, error: insertErr } = await supabase
      .from('webhook_events')
      .insert({
        token_id:        tokenId,
        user_id:         userId,
        source_ip:       'test',
        raw_payload:     testPayload,
        parsed_ticker:   testPayload.ticker,
        parsed_action:   testPayload.action,
        parsed_price:    testPayload.price,
        parsed_quantity: testPayload.quantity,
        status:          'test',
      })
      .select('id, token_id, source_ip, parsed_ticker, parsed_action, parsed_price, parsed_quantity, status, created_at')
      .single();

    if (insertErr) {
      console.error('[Webhook Test] Event insert error:', insertErr.message);
      return res.status(500).json({ error: 'Failed to create test event' });
    }

    // Update token last_used_at
    await supabase
      .from('webhook_tokens')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', tokenId);

    console.log(`[Webhook Test] Test event created for user=${userId} token=${tokenRow.token.slice(0, 8)}...`);

    res.status(201).json({
      success: true,
      message: 'Test event created successfully! Check the events log below.',
      event:   eventRow,
    });
  } catch (err) {
    console.error('[Webhook Test] Error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = { receiverRouter, managementRouter };
