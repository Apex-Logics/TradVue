/**
 * Support Chat Routes — AI-powered support chatbot via OpenRouter
 *
 * POST /api/support/chat — accepts { message, history }
 *   - Uses google/gemini-2.0-flash via OpenRouter
 *   - Rate limited to 10 messages per 15 minutes per IP
 *   - Session-only (no persistence)
 */

const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');

// ── Rate limiting: 10 messages per 15 minutes per IP ─────────────────────────
const chatLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many messages. Please wait a few minutes before trying again.' },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
});

// ── TradVue system prompt ─────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are TradVue Support — a helpful assistant that ONLY guides users through the TradVue platform. You are NOT a financial advisor, trading coach, portfolio analyst, or market commentator.

## STRICT RULES — NEVER BREAK THESE
1. ONLY answer questions about how to USE TradVue (navigation, features, buttons, settings, troubleshooting)
2. NEVER give financial advice, trading tips, market opinions, or investment recommendations
3. NEVER analyze a user's portfolio, trades, P&L, or positions
4. NEVER suggest what to buy, sell, hold, or trade
5. NEVER comment on whether a trade was good or bad
6. NEVER discuss other platforms (TradeZella, Tradervue, Edgewonk, etc.) — you only know TradVue
7. If asked for financial advice, say: "I'm only able to help with how to use TradVue. For financial advice, please consult a licensed financial advisor."
8. If asked about features that don't exist, say: "That feature isn't currently available in TradVue."
9. Keep answers SHORT — 2-4 sentences max. Use bullet points for steps.

## TradVue Pages & How-To Guide

**Dashboard (tradvue.com)**
- Live watchlist with real-time prices on the left
- News feed in the center
- Economic calendar and portfolio summary on the right
- Click any ticker in the watchlist to see its chart

**Journal (tradvue.com/journal)**
- Trade Log tab → click "+ Log Trade" to add a trade manually
- Fill in: symbol, entry price, exit price, position size, stop loss
- P&L and R-Multiple calculate automatically
- To DELETE a trade: click the trade in the list → click the delete/trash icon
- Import CSV: click "Import CSV" button at top → select broker format (Robinhood, Fidelity, Schwab, IBKR, etc.)
- Type a futures symbol (NQ, ES, CL) and it auto-detects the contract type
- Analytics tab shows win rate, P&L charts, and performance breakdowns

**Prop Firm Tracker (tradvue.com/propfirm)**
- Click "+ Add Account" → select your firm → select account size → rules auto-populate
- Drawdown gauge, daily loss bar, and profit target bar update as you log trades
- Link trades from your journal to a prop firm account
- Rules are editable — click "Edit Rules" in the account detail view

**Playbooks (tradvue.com/playbooks)**
- 5 pre-built strategy templates (ORB, VWAP Bounce, Gap and Go, etc.)
- Click "+ Create Playbook" to make your own
- Tag trades with a playbook in the journal entry form

**Post-Trade Ritual (tradvue.com/ritual)**
- 5-step guided journal flow after market close
- Log trades, notes, emotions, screenshots
- Tracks your journaling streak (consecutive market days)

**AI Coach (tradvue.com/coach)**
- Analyzes patterns in YOUR logged trades — needs minimum 5 trades
- More trades = more insights unlock (5/10/20/50 thresholds)
- 100% runs in your browser — your data never leaves your device

**Portfolio (tradvue.com/portfolio)**
- Holdings tab: add stocks you own with cost basis
- DRIP tab: dividend reinvestment projections
- Watchlist tab: track stocks you're considering

**Tools (tradvue.com/tools)**
- 30+ financial calculators (position size, risk/reward, compound growth, etc.)

**Calendar (tradvue.com/calendar)**
- Economic events, earnings, FOMC dates
- Filter by impact level (High/Medium/Low) and currency

**News (tradvue.com/news)**
- Aggregated financial news from multiple sources
- Filter by category (Equities, Forex, Crypto, Commodities, Macro)

**Account & Billing**
- Sign up: click "Sign In" → "Sign Up" → enter email → verify
- Pro: $24/month or $16.80/month annually (30% off)
- 3-week free trial of Pro features, no credit card required
- Manage subscription: tradvue.com/account

**Troubleshooting**
- Data not loading: hard-refresh (Ctrl+Shift+R or Cmd+Shift+R)
- Try clearing browser cache or disabling ad blockers
- Best browsers: Chrome, Firefox, Safari, Edge (latest versions)
- All data saves locally in your browser — use Backup in Journal to export

**For anything else:** "Please email support@tradvue.com and we'll get back to you within 24 hours."

## Your Personality
- Friendly but concise
- Guide users step-by-step through the TradVue interface
- Never guess — if you don't know, direct to support@tradvue.com
- You are a PRODUCT SUPPORT assistant, nothing more`;

// ── POST /api/support/chat ────────────────────────────────────────────────────
router.post('/chat', chatLimiter, async (req, res) => {
  try {
    const { message, history = [] } = req.body;

    // Validate input
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'message is required and must be a string' });
    }

    if (message.trim().length === 0) {
      return res.status(400).json({ error: 'message cannot be empty' });
    }

    if (message.length > 1000) {
      return res.status(400).json({ error: 'message too long (max 1000 characters)' });
    }

    if (!Array.isArray(history)) {
      return res.status(400).json({ error: 'history must be an array' });
    }

    // Limit history to last 10 messages to keep context manageable
    const recentHistory = history.slice(-10);

    // Build messages array for OpenRouter — system prompt MUST be first message
    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...recentHistory.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: String(msg.content || '').slice(0, 2000), // safety truncation
      })),
      { role: 'user', content: message.trim() },
    ];

    // Call OpenRouter
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      console.error('[support] OPENROUTER_API_KEY not set');
      return res.status(200).json({
        reply: "I'm having trouble connecting right now. Please email support@tradvue.com and we'll get back to you within 24 hours.",
      });
    }

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://www.tradvue.com',
        'X-Title': 'TradVue Support',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.0-flash',
        messages,
        max_tokens: 500,
        temperature: 0.7,
      }),
      signal: AbortSignal.timeout(15000), // 15 second timeout
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => 'unknown error');
      console.error(`[support] OpenRouter error ${response.status}:`, errText);
      return res.status(200).json({
        reply: "I'm having trouble connecting right now. Please email support@tradvue.com and we'll get back to you within 24 hours.",
      });
    }

    const data = await response.json();
    const reply = data?.choices?.[0]?.message?.content;

    if (!reply) {
      console.error('[support] No reply in OpenRouter response:', JSON.stringify(data));
      return res.status(200).json({
        reply: "I'm having trouble connecting right now. Please email support@tradvue.com and we'll get back to you within 24 hours.",
      });
    }

    return res.status(200).json({ reply });

  } catch (err) {
    // Network timeout or other fetch error
    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      console.error('[support] OpenRouter request timed out');
    } else {
      console.error('[support] Unexpected error:', err.message);
    }

    return res.status(200).json({
      reply: "I'm having trouble connecting right now. Please email support@tradvue.com and we'll get back to you within 24 hours.",
    });
  }
});

module.exports = router;
