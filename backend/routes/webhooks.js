/**
 * TradingView Webhook Routes
 *
 * Two route groups:
 *   POST /api/webhook/tv/:userToken   — Public receiver (no auth, IP-allowlisted)
 *   GET/POST/DELETE /api/webhooks/*   — Management routes (requireAuth)
 *   GET /api/webhook-trades           — Returns user's webhook trades (requireAuth)
 *
 * Security model:
 *   - IP allowlist enforced FIRST — only TradingView IPs + localhost accepted
 *   - Client IP from Express `req.ip` with `trust proxy` = 1 (Render). Never
 *     the leftmost X-Forwarded-For hop (attacker-controlled).
 *   - Max payload size: 10KB (enforced via express.text/express.raw body parser limit)
 *   - Token validated against webhook_tokens table (dual-read: plaintext then SHA-256)
 *   - Per-token rate limit: 30 req/minute (in-memory, resets on restart)
 *   - All string inputs sanitized before DB write
 *   - Token is validated BEFORE ack; trade matching still runs async after 200.
 *     TV keeps a 200 even on auth fail (3s timeout / retry storm). Auth-fail
 *     events are persisted so the Events log is not empty. Trades are never
 *     applied on a bad token.
 */

'use strict';

const express = require('express');
const crypto  = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const { requireAuth } = require('../middleware/auth');
const xss = require('xss');
const {
  getSourceIP,
  hashWebhookToken,
  tokenLogId,
} = require('../lib/webhookSecurity');

// ── Routers ───────────────────────────────────────────────────────────────────

const receiverRouter    = express.Router();   // mounted at /api/webhook
const managementRouter  = express.Router();   // mounted at /api/webhooks (with requireAuth)
const tradesRouter      = express.Router();   // mounted at /api/webhook-trades (with requireAuth)

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

// ── Token lookup (dual-read: legacy plaintext, then SHA-256 hex) ─────────────
// Existing rows store the 32-char hex secret in `webhook_tokens.token` because
// GET /api/webhooks/tokens is the copy-URL source. Hash-at-rest of NEW rows is
// deferred until a show-once UI exists (hashing the column would make GET
// return a digest that users would paste into TV/NT, breaking ingest).
// Dual-read still accepts a SHA-256 digest if an operator hashes a row.
async function findWebhookToken(supabase, userToken) {
  const select = 'id, user_id, is_active, trade_count, token';
  const { data: plainRow, error: plainErr } = await supabase
    .from('webhook_tokens')
    .select(select)
    .eq('token', userToken)
    .maybeSingle();
  if (plainErr) return { tokenRow: null, error: plainErr };
  if (plainRow) return { tokenRow: plainRow, error: null };

  const hashed = hashWebhookToken(userToken);
  if (hashed === userToken) return { tokenRow: null, error: null };

  const { data: hashRow, error: hashErr } = await supabase
    .from('webhook_tokens')
    .select(select)
    .eq('token', hashed)
    .maybeSingle();
  return { tokenRow: hashRow || null, error: hashErr || null };
}

function rawPayloadFromBody(body, maxLen = 2000) {
  if (typeof body === 'string') return { raw: body.slice(0, maxLen) };
  if (body && typeof body === 'object') return body;
  return { raw: String(body || '') };
}

/** Persist an auth-fail event. Never throws — logging must not block the ack. */
async function recordAuthFailEvent(supabase, { tokenId, userId, sourceIP, rawPayload, reason }) {
  try {
    await supabase.from('webhook_events').insert({
      token_id:      tokenId || null,
      user_id:       userId || null,
      source_ip:     sourceIP,
      raw_payload:   rawPayload || {},
      status:        'auth_fail',
      error_message: reason,
    });
  } catch (err) {
    console.error('[Webhook] Failed to record auth_fail event:', err.message);
  }
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
    const quantity = parseFloat(parsed.quantity || parsed.qty || parsed.contracts || parsed.size || 0) || null;
    const position = sanitize((
      parsed.position ||
      parsed.strategy?.market_position ||
      parsed.market_position ||
      ''
    )).toLowerCase();

    // Pine Script alert_message format: {"message":"entry_long"/"exit_short"/etc}
    // When action is absent but message contains a cue, derive action from message.
    //
    // Exit/close semantics MUST take precedence over the direction words
    // (long/short): "exit_long" is closing a long → SELL, and "exit_short" is
    // closing a short → SELL. Checking `long` before `exit` previously made
    // "exit_long" parse as a BUY, opening a phantom position instead of closing
    // the real one (P0 2026-09 #4).
    let derivedAction = action;
    if (!derivedAction && parsed.message) {
      const msg = String(parsed.message).toLowerCase();
      if (msg.includes('exit') || msg.includes('close')) derivedAction = 'sell';
      else if (msg.includes('entry') || msg.includes('open')) derivedAction = 'buy';
      else if (msg.includes('sell') || msg.includes('short')) derivedAction = 'sell';
      else if (msg.includes('buy') || msg.includes('long')) derivedAction = 'buy';
    }
    if (!ticker || !derivedAction) return null;
    // NinjaTrader sends 'entry'/'exit' as action; normalize to buy/sell for compatibility
    const normalizedAction = derivedAction === 'entry' ? 'buy' : derivedAction === 'exit' ? 'sell' : derivedAction;
    if (!['buy', 'sell', 'entry', 'exit'].includes(derivedAction)) return null;

    // Extended fields from NinjaTrader addon
    const entryPrice  = parseFloat(parsed.entry_price) || null;
    const exitPrice   = parseFloat(parsed.exit_price) || null;
    // Use payload pnl as-is when non-zero (NinjaTrader already applies futures multiplier)
    const pnlRaw      = parsed.pnl;
    const pnl         = (pnlRaw !== undefined && pnlRaw !== null && pnlRaw !== 0)
                        ? parseFloat(pnlRaw)
                        : null;
    const direction   = sanitize(parsed.direction || '');
    const assetClass  = sanitize(parsed.asset_class || '');
    const orderId     = sanitize(parsed.order_id || '');
    const accountId   = sanitize(parsed.account_id || parsed.account || '');
    const source      = sanitize(parsed.source || 'tradingview');
    const strategy    = sanitize(parsed.strategy || '');
    const tradeTime   = parsed.time || null;

    return { 
      ticker: ticker.toUpperCase(), 
      action: normalizedAction, 
      price, quantity, position,
      entryPrice, exitPrice, pnl, direction, assetClass, orderId, accountId, source, strategy, tradeTime,
      raw: parsed 
    };
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

// ── Idempotency (P0 2026-09 #3) ───────────────────────────────────────────────
// Webhook deliveries are retried by TradingView/NinjaTrader on timeout and can
// be replayed by proxies. When a payload carries a genuine external order id we
// de-duplicate on it so a retry never creates a second event or a duplicate
// trade. TradingView strategy alerts, however, often set order_id to a
// non-unique placeholder (the position direction "Long"/"Short", or the
// action) rather than a per-fill id — those must NOT be treated as idempotency
// keys, or distinct trades would be silently dropped.
const NON_IDEMPOTENT_ORDER_IDS = new Set([
  '', 'long', 'short', 'buy', 'sell', 'entry', 'exit', 'flat', 'close',
  'open', 'na', 'n/a', 'null', 'undefined', 'none', '0',
]);

/** Return the external order id to de-duplicate on, or null when not eligible. */
function idempotencyKeyFor(parsed) {
  const oid = (parsed && parsed.orderId != null ? String(parsed.orderId) : '').trim();
  if (!oid) return null;
  if (NON_IDEMPOTENT_ORDER_IDS.has(oid.toLowerCase())) return null;
  return oid;
}

/** Detect a Postgres unique-constraint violation from a Supabase error. */
function isUniqueViolation(err) {
  if (!err) return false;
  return err.code === '23505' || /duplicate key|unique constraint/i.test(err.message || '');
}

/** Look up an already-ingested event for this (user_id, order_id). */
async function findDuplicateEvent(supabase, userId, orderId) {
  if (!orderId) return null;
  const { data } = await supabase
    .from('webhook_events')
    .select('id, trade_id')
    .eq('user_id', userId)
    .eq('order_id', orderId)
    .limit(1)
    .maybeSingle();
  return data || null;
}

/**
 * Ingest one parsed webhook payload: enforce idempotency, persist the event
 * (with the external order id backing the (user_id, order_id) unique index),
 * then run trade matching. Shared by the TradingView and NinjaTrader receivers.
 *
 * Returns:
 *   { duplicate: true, eventId? }     — already processed; nothing was created
 *   { matched, eventId, matchedIds }  — processed
 *   { error }                         — the event could not be persisted
 */
async function ingestAndMatch(supabase, { tokenId, userId, sourceIP, rawPayload, parsed }) {
  const orderId = idempotencyKeyFor(parsed);

  // 1. Fast-path idempotency: skip if this external order id was already seen.
  if (orderId) {
    const dup = await findDuplicateEvent(supabase, userId, orderId);
    if (dup) {
      console.log(`[Webhook] Idempotent skip — order_id=${orderId} already processed (event ${dup.id})`);
      return { duplicate: true, matched: false, eventId: dup.id };
    }
  }

  // 2. Persist the event. order_id is NULL for placeholders/empty so the partial
  //    unique index only constrains genuine external ids.
  const { data: eventRow, error: insertErr } = await supabase
    .from('webhook_events')
    .insert({
      token_id:        tokenId,
      user_id:         userId,
      source_ip:       sourceIP,
      raw_payload:     rawPayload,
      parsed_ticker:   parsed.ticker,
      parsed_action:   parsed.action,
      parsed_price:    parsed.price,
      parsed_quantity: parsed.quantity,
      order_id:        orderId,
      status:          'received',
    })
    .select('id')
    .single();

  if (insertErr) {
    // A concurrent retry may have inserted first; the unique index then rejects
    // this attempt. Treat that as an idempotent duplicate, not an error.
    if (isUniqueViolation(insertErr)) {
      console.log(`[Webhook] Idempotent skip — unique violation on order_id=${orderId}`);
      return { duplicate: true, matched: false };
    }
    console.error('[Webhook] Event insert error:', insertErr.message);
    return { error: insertErr.message };
  }
  if (!eventRow) return { error: 'Event insert returned no row' };

  const eventId = eventRow.id;

  // 3. Match + journal the trade.
  const { matched, error: matchErr, matchedIds } = await matchAndJournalTrade(
    supabase, userId, parsed, eventId
  );

  if (!matched && matchErr) {
    await supabase
      .from('webhook_events')
      .update({ status: 'error', error_message: matchErr })
      .eq('id', eventId);
  }

  return { matched, eventId, matchedIds, error: matchErr };
}

// ── Per-user+instrument lock (prevents race conditions with simultaneous exits) ─
// Maps "userId:symbol" → Promise chain. All processing for a given user+symbol
// is serialized through this queue, preventing two exits from grabbing the same
// open trade simultaneously.
const processingLocks = new Map();

function withLock(key, fn) {
  const prev = processingLocks.get(key) || Promise.resolve();
  const next = prev.then(fn).catch((err) => {
    console.error(`[Webhook] Lock error for ${key}:`, err.message);
  });
  processingLocks.set(key, next);
  // Clean up completed lock chains to avoid unbounded memory growth
  next.finally(() => {
    if (processingLocks.get(key) === next) {
      processingLocks.delete(key);
    }
  });
  return next;
}

// ── Trade Matching ────────────────────────────────────────────────────────────
/**
 * Inserts/updates a trade in the webhook_trades table.
 *
 * Rules:
 *   buy/entry:
 *     - Insert new open trade. Direction from payload (NinjaTrader) or 'Long' (TradingView).
 *
 *   sell/exit:
 *     - NinjaTrader: direction in payload → FIFO-match oldest open trade of SAME direction.
 *     - TradingView: direction unknown → try Long first, then Short.
 *     - If matched → UPDATE exit_price + pnl, mark closed.
 *     - If no match → insert standalone closed record (entry opened before integration).
 *
 *   P&L:
 *     - USE payload pnl when non-zero (NinjaTrader already applied futures multiplier).
 *     - Only recalculate from raw price diff if pnl is absent/zero.
 *
 * All calls serialized per userId+symbol via withLock() to prevent race conditions.
 *
 * Returns { matched: true, tradeId } on success, { matched: false, error } on failure.
 */
async function matchAndJournalTrade(supabase, userId, parsed, eventId) {
  const lockKey = `${userId}:${parsed.ticker}`;
  return withLock(lockKey, () => _matchAndJournalTrade(supabase, userId, parsed, eventId));
}

async function _matchAndJournalTrade(supabase, userId, parsed, eventId) {
  try {
    const {
      ticker, action, price, quantity,
      entryPrice, exitPrice, pnl, direction,
      assetClass, orderId, accountId, source, strategy, tradeTime,
    } = parsed;
    const now = tradeTime || new Date().toISOString();
    const isNinjaTrader = source === 'ninjatrader';

    // ── ENTRY (buy / entry) ────────────────────────────────────────────────
    if (action === 'buy') {
      // NinjaTrader sends explicit direction; TradingView defaults to Long
      const rawDir = direction
        ? (direction.charAt(0).toUpperCase() + direction.slice(1).toLowerCase())
        : 'Long';
      const tradeDirection = ['Long', 'Short'].includes(rawDir) ? rawDir : 'Long';
      const tradeAsset = assetClass || 'Stock';

      const { data: inserted, error: insertErr } = await supabase
        .from('webhook_trades')
        .insert({
          user_id:     userId,
          event_id:    eventId,
          symbol:      ticker,
          direction:   tradeDirection,
          asset_class: tradeAsset,
          entry_price: entryPrice || price,
          exit_price:  null,
          quantity:    quantity || 1,
          strategy:    strategy || null,
          notes:       isNinjaTrader ? 'Auto-journaled via NinjaTrader' : 'Auto-journaled via TradingView',
          status:      'open',
          source:      source || 'webhook',
          traded_at:   now,
          account_id:  accountId || null,
        })
        .select('id')
        .single();

      if (insertErr) {
        console.error('[Webhook] Insert trade error:', insertErr.message);
        return { matched: false, error: insertErr.message };
      }

      await supabase
        .from('webhook_events')
        .update({ status: 'matched', trade_id: inserted.id })
        .eq('id', eventId);

      return { matched: true, tradeId: inserted.id };

    // ── EXIT (sell / exit) ─────────────────────────────────────────────────
    } else if (action === 'sell') {
      // Determine which direction of open trade to close.
      // NinjaTrader always sends direction — use it for exact matching.
      // TradingView 'sell' is ambiguous — try Long first, then Short.
      let openTrades = [];

      if (direction) {
        const rawDir = direction.charAt(0).toUpperCase() + direction.slice(1).toLowerCase();
        const safeDir = ['Long', 'Short'].includes(rawDir) ? rawDir : null;
        if (safeDir) {
          const { data } = await supabase
            .from('webhook_trades')
            .select('id, entry_price, quantity, direction')
            .eq('user_id', userId)
            .eq('symbol', ticker)
            .eq('direction', safeDir)
            .eq('status', 'open')
            .order('traded_at', { ascending: true });  // FIFO: close oldest first
          openTrades = data || [];
        }
      } else {
        // TradingView fallback: try Long first, then Short
        for (const dir of ['Long', 'Short']) {
          const { data } = await supabase
            .from('webhook_trades')
            .select('id, entry_price, quantity, direction')
            .eq('user_id', userId)
            .eq('symbol', ticker)
            .eq('direction', dir)
            .eq('status', 'open')
            .order('traded_at', { ascending: true });
          if (data && data.length > 0) { openTrades = data; break; }
        }
      }

      if (openTrades.length > 0) {
        // ── Multi-contract FIFO exit matching ─────────────────────────────
        // Consume exit qty across open trades in FIFO order.
        // Each matched trade gets its own per-contract P&L calculated from
        // actual entry/exit prices (not the addon's aggregate pnl).
        //
        // Point value lookup: fetch from instruments table if available.
        // MNQ = $2/point; fall back to pnl/qty from payload if no instrument row.
        let pointValue = null;
        try {
          const { data: instrRow } = await supabase
            .from('instruments')
            .select('point_value')
            .eq('symbol', ticker)
            .maybeSingle();
          if (instrRow && instrRow.point_value) {
            pointValue = parseFloat(instrRow.point_value);
          }
        } catch (_) { /* ignore — instruments table may not exist yet */ }

        const exitPx        = parseFloat(exitPrice || price);
        let   remainingQty  = parseFloat(quantity) || 1;
        const matchedIds    = [];
        let   firstTradeId  = null;

        for (const openTrade of openTrades) {
          if (remainingQty <= 0) break;

          const tradeQty      = parseFloat(openTrade.quantity) || 1;
          const entryPx       = parseFloat(openTrade.entry_price);
          const dirFactor     = openTrade.direction === 'Long' ? 1 : -1;
          const closeQty      = Math.min(remainingQty, tradeQty);

          // Per-contract P&L: use point value if known, else pnl/qty from payload
          let tradePnl = null;
          if (!isNaN(entryPx) && !isNaN(exitPx)) {
            if (pointValue !== null) {
              tradePnl = (exitPx - entryPx) * closeQty * dirFactor * pointValue;
            } else if (pnl !== null && (quantity || 1) > 0) {
              // Distribute payload pnl proportionally by closeQty/totalExitQty
              tradePnl = (pnl / (parseFloat(quantity) || 1)) * closeQty;
            } else {
              tradePnl = (exitPx - entryPx) * closeQty * dirFactor;
            }
          } else if (pnl !== null && (quantity || 1) > 0) {
            tradePnl = (pnl / (parseFloat(quantity) || 1)) * closeQty;
          }

          if (closeQty < tradeQty) {
            // ── Partial close: split the open trade ────────────────────
            // Reduce the open trade's qty by closeQty (it stays open)
            const { error: partialUpdateErr } = await supabase
              .from('webhook_trades')
              .update({ quantity: tradeQty - closeQty })
              .eq('id', openTrade.id);

            if (partialUpdateErr) {
              console.error('[Webhook] Partial trade update error:', partialUpdateErr.message);
              continue;
            }

            // Insert a new closed record for the matched portion
            const { data: partialClosed, error: partialInsertErr } = await supabase
              .from('webhook_trades')
              .insert({
                user_id:     userId,
                event_id:    eventId,
                symbol:      ticker,
                direction:   openTrade.direction,
                asset_class: assetClass || 'Stock',
                entry_price: openTrade.entry_price,
                exit_price:  exitPx,
                quantity:    closeQty,
                pnl:         tradePnl !== null ? Math.round(tradePnl * 100) / 100 : null,
                strategy:    strategy || null,
                notes:       isNinjaTrader ? 'Auto-journaled via NinjaTrader (partial close)' : 'Auto-journaled via TradingView (partial close)',
                status:      'closed',
                source:      source || 'webhook',
                traded_at:   now,
                account_id:  accountId || null,
              })
              .select('id')
              .single();

            if (!partialInsertErr && partialClosed) {
              matchedIds.push(partialClosed.id);
              if (!firstTradeId) firstTradeId = partialClosed.id;
            }
          } else {
            // ── Full close ─────────────────────────────────────────────
            const { error: updateErr } = await supabase
              .from('webhook_trades')
              .update({
                exit_price: exitPx,
                pnl:        tradePnl !== null ? Math.round(tradePnl * 100) / 100 : null,
                status:     'closed',
              })
              .eq('id', openTrade.id);

            if (!updateErr) {
              matchedIds.push(openTrade.id);
              if (!firstTradeId) firstTradeId = openTrade.id;
            } else {
              console.error('[Webhook] Close trade error:', updateErr.message);
            }
          }

          remainingQty -= closeQty;
        }

        if (matchedIds.length > 0) {
          await supabase
            .from('webhook_events')
            .update({ status: 'matched', trade_id: firstTradeId })
            .eq('id', eventId);

          console.log(`[Webhook] Multi-exit matched ${matchedIds.length} trade(s): [${matchedIds.join(', ')}]`);
          return { matched: true, tradeId: firstTradeId, matchedIds };
        }
      }

      // No matching open trades — fallback to standalone closed insert:
      if (openTrades.length === 0) {
        // No matching open trade — create a standalone closed record.
        // This happens when the trade was opened before webhook integration,
        // or when events arrive out of order.
        const rawDir = direction
          ? (direction.charAt(0).toUpperCase() + direction.slice(1).toLowerCase())
          : 'Short';
        const tradeDirection = ['Long', 'Short'].includes(rawDir) ? rawDir : 'Short';
        const tradeAsset = assetClass || 'Stock';

        // Use payload pnl if available; raw calc not possible without known entry
        const computedPnl = (pnl !== null && pnl !== undefined && pnl !== 0) ? pnl : null;

        const { data: inserted, error: insertErr } = await supabase
          .from('webhook_trades')
          .insert({
            user_id:     userId,
            event_id:    eventId,
            symbol:      ticker,
            direction:   tradeDirection,
            asset_class: tradeAsset,
            entry_price: entryPrice || null,
            exit_price:  exitPrice || price,
            quantity:    quantity || 1,
            pnl:         computedPnl,
            strategy:    strategy || null,
            notes:       isNinjaTrader
              ? 'Auto-journaled via NinjaTrader (entry not tracked)'
              : 'Auto-journaled via TradingView',
            status:      'closed',
            source:      source || 'webhook',
            traded_at:   now,
            account_id:  accountId || null,
          })
          .select('id')
          .single();

        if (insertErr) {
          console.error('[Webhook] Insert standalone closed trade error:', insertErr.message);
          return { matched: false, error: insertErr.message };
        }

        await supabase
          .from('webhook_events')
          .update({ status: 'matched', trade_id: inserted.id })
          .eq('id', eventId);

        return { matched: true, tradeId: inserted.id };
      }
    }

    // Should never reach here given parser validation
    return { matched: false, error: 'Unknown action' };

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
    const logId = tokenLogId(userToken);

    // ── 2. Token rate limit ────────────────────────────────────────────────
    if (!checkTokenRateLimit(userToken)) {
      console.warn(`[Webhook] Rate limit exceeded for token: ${logId}...`);
      return res.status(429).json({ error: 'Rate limit exceeded' });
    }

    // ── 3. Validate token BEFORE ack. Trade matching stays async. ──────────
    // TradingView's webhook timeout is 3s. Token lookup is a single Supabase
    // round-trip (typically well under that), so validate-then-ack is safe.
    // We still return 200 on auth fail so TV does not retry-storm; the event
    // is persisted first so Events is not empty. Trades are not applied.
    let supabase;
    let tokenRow;
    try {
      supabase = getServiceClient();
      const lookedUp = await findWebhookToken(supabase, userToken);
      tokenRow = lookedUp.tokenRow;
      if (lookedUp.error || !tokenRow || !tokenRow.is_active) {
        const reason = !tokenRow || lookedUp.error
          ? 'auth_fail: invalid token'
          : 'auth_fail: inactive token';
        console.warn(`[Webhook] ${reason} (${logId}...)`);
        await recordAuthFailEvent(supabase, {
          tokenId:    tokenRow ? tokenRow.id : null,
          userId:     tokenRow ? tokenRow.user_id : null,
          sourceIP,
          rawPayload: rawPayloadFromBody(req.body, 1000),
          reason,
        });
        return res.status(200).json({ ok: true });
      }
    } catch (err) {
      console.error('[Webhook] Token validation error:', err.message);
      return res.status(500).json({ error: 'Internal server error' });
    }

    const { id: tokenId, user_id: userId, trade_count } = tokenRow;

    // ── 4. Ack 200 now; parse + match stay async (the slow part) ───────────
    res.status(200).json({ ok: true });

    setImmediate(async () => {
      try {
        const body   = req.body;
        let parsed   = null;
        let parseErr = null;

        try {
          const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
          parsed = parsePayload(bodyStr);
        } catch (e) {
          parseErr = e.message;
        }

        if (!parsed) {
          await supabase.from('webhook_events').insert({
            token_id:    tokenId,
            user_id:     userId,
            source_ip:   sourceIP,
            raw_payload: rawPayloadFromBody(body, 1000),
            status:      'error',
            error_message: parseErr || 'Failed to parse payload',
          });
          console.warn(`[Webhook] Parse failed for token ${logId}...`);
          return;
        }

        const rawPayload = rawPayloadFromBody(body);
        const { matched, duplicate } = await ingestAndMatch(supabase, {
          tokenId, userId, sourceIP, rawPayload, parsed,
        });

        await supabase
          .from('webhook_tokens')
          .update({
            last_used_at: new Date().toISOString(),
            trade_count:  matched ? (trade_count || 0) + 1 : (trade_count || 0),
          })
          .eq('id', tokenId);

        console.log(
          `[Webhook] Processed: token=${logId} ` +
          `ticker=${parsed.ticker} action=${parsed.action} ` +
          `matched=${matched} duplicate=${!!duplicate}`
        );
      } catch (err) {
        console.error('[Webhook] Async processing error:', err.message);
      }
    });
  }
);

// ═════════════════════════════════════════════════════════════════════════════
// NINJATRADER WEBHOOK RECEIVER: POST /api/webhook/nt/:userToken
// Same as TradingView route but NO IP allowlist — NinjaTrader runs on the
// user's local machine so we can't predict their IP. Token IS the auth.
// Rate limiting still applies (30 req/min per token).
// ═════════════════════════════════════════════════════════════════════════════

receiverRouter.post(
  '/nt/:userToken',
  express.text({ type: '*/*', limit: '10kb' }),
  async (req, res) => {
    // No IP allowlist for NinjaTrader — token validation is the auth
    // Unlike TradingView (3s timeout), NinjaTrader has no timeout constraint,
    // so we validate the token BEFORE responding. Invalid tokens get 401.
    const sourceIP = getSourceIP(req);
    const { userToken } = req.params;

    const logId = tokenLogId(userToken);

    // Rate limit per token
    if (!checkTokenRateLimit(userToken)) {
      console.warn(`[Webhook/NT] Rate limit exceeded for token: ${logId}...`);
      return res.status(429).json({ error: 'Rate limit exceeded' });
    }

    // ── Token validation BEFORE responding ─────────────────────────────────
    // (NinjaTrader has no 3-second timeout constraint, unlike TradingView)
    let supabase;
    let tokenRow;
    try {
      supabase = getServiceClient();
      const lookedUp = await findWebhookToken(supabase, userToken);
      tokenRow = lookedUp.tokenRow;

      if (lookedUp.error || !tokenRow) {
        console.warn(`[Webhook/NT] Invalid token: ${logId}...`);
        await recordAuthFailEvent(supabase, {
          tokenId: null,
          userId: null,
          sourceIP,
          rawPayload: rawPayloadFromBody(req.body),
          reason: 'auth_fail: invalid token',
        });
        return res.status(401).json({ error: 'Invalid token' });
      }

      if (!tokenRow.is_active) {
        console.warn(`[Webhook/NT] Inactive token: ${logId}...`);
        await recordAuthFailEvent(supabase, {
          tokenId: tokenRow.id,
          userId: tokenRow.user_id,
          sourceIP,
          rawPayload: rawPayloadFromBody(req.body),
          reason: 'auth_fail: inactive token',
        });
        return res.status(401).json({ error: 'Token is inactive' });
      }
    } catch (err) {
      console.error('[Webhook/NT] Token validation error:', err.message);
      return res.status(500).json({ error: 'Internal server error' });
    }

    const { id: tokenId, user_id: userId, trade_count } = tokenRow;

    // ── Parse payload ───────────────────────────────────────────────────────
    const body = req.body;
    let parsed = null;
    let parseErr = null;
    try {
      const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
      parsed = parsePayload(bodyStr);
    } catch (e) { parseErr = e.message; }

    if (!parsed) {
      // Store raw event with error status, still respond 400 so NT knows
      try {
        await supabase.from('webhook_events').insert({
          token_id:      tokenId,
          user_id:       userId,
          source_ip:     sourceIP,
          raw_payload:   { raw: typeof body === 'string' ? body.slice(0, 2000) : body },
          status:        'error',
          error_message: parseErr || 'Failed to parse payload',
        });
      } catch (_) {}
      console.warn(`[Webhook/NT] Parse failed for token ${logId}...`);
      return res.status(400).json({ error: 'Invalid payload format' });
    }

    // ── Token is valid — respond 200 now, process trade async ─────────────
    res.status(200).json({ ok: true });

    setImmediate(async () => {
      try {
        // Idempotent ingest (event insert + de-dup) + trade matching
        const rawPayload = { raw: typeof body === 'string' ? body.slice(0, 2000) : body };
        const { matched, duplicate } = await ingestAndMatch(supabase, {
          tokenId, userId, sourceIP, rawPayload, parsed,
        });

        // Update token stats (retries don't re-count)
        await supabase.from('webhook_tokens')
          .update({
            last_used_at: new Date().toISOString(),
            trade_count:  matched ? (trade_count || 0) + 1 : (trade_count || 0),
          })
          .eq('id', tokenId);

        console.log(`[Webhook/NT] Processed: token=${logId} ticker=${parsed.ticker} action=${parsed.action} matched=${matched} duplicate=${!!duplicate}`);
      } catch (err) {
        console.error('[Webhook/NT] Processing error:', err.message);
      }
    });
  }
);

// ═════════════════════════════════════════════════════════════════════════════
// WEBHOOK TRADES: GET /api/webhook-trades
// ═════════════════════════════════════════════════════════════════════════════

tradesRouter.get('/', requireAuth, async (req, res) => {
  try {
    const supabase = getServiceClient();

    const { data, error } = await supabase
      .from('webhook_trades')
      .select('id, symbol, direction, asset_class, entry_price, exit_price, quantity, pnl, account_id, strategy, notes, status, source, traded_at, created_at')
      .eq('user_id', req.user.id)
      .order('traded_at', { ascending: false })
      .limit(500);

    if (error) {
      console.error('[Webhook Trades] Fetch error:', error.message);
      return res.status(500).json({ error: 'Failed to fetch webhook trades' });
    }

    res.json({ trades: data || [], total: (data || []).length });
  } catch (err) {
    console.error('[Webhook Trades] Error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

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

    console.log(`[Webhook Test] Test event created for user=${userId} token=${tokenLogId(tokenRow.token)}...`);

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

module.exports = {
  receiverRouter, managementRouter, tradesRouter,
  _matchAndJournalTrade, matchAndJournalTrade, parsePayload,
  ingestAndMatch, idempotencyKeyFor, findDuplicateEvent, isUniqueViolation,
  getSourceIP, findWebhookToken, recordAuthFailEvent, hashWebhookToken,
};
