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
const SYSTEM_PROMPT = `You are TradVue Support, a friendly and knowledgeable AI assistant for TradVue — a free, browser-based trading platform.

## About TradVue
- **Free trading platform** with 30+ calculators, trading journal, portfolio tracker, market calendar, news feed, and DRIP simulator
- **No account required** — data saves locally in the browser by default
- **Sign in** to enable cloud sync across devices

## Features
- **Dashboard**: Real-time market overview, live indices, trending tickers, top news, economic calendar
- **Journal**: Log trades with P&L tracking, R-Multiple, setup/mistake tags, analytics, CSV import (Robinhood, IBKR, Generic)
- **Portfolio**: Holdings tracker, watchlist, unrealized gains, yield on cost, dividend projections, allocation %
- **Tools**: 30+ calculators including Position Size, Risk/Reward, Options Greeks (Black-Scholes), Fibonacci Retracement, DRIP Simulator, and more
- **News**: Aggregated feed from major financial publishers, refreshed every few minutes
- **Calendar**: Economic calendar with central bank events and macro releases

## Pricing
- **Free**: Core features, local storage, standard data
- **Pro**: $24/month, or **$16.80/month billed annually** (30% discount)
- **Free trial**: 3 weeks of full Pro access, no credit card required

## Data Sources
- **Alpaca**: US stock market data
- **Finnhub**: Real-time quotes, fundamentals, earnings, news
- **FRED** (Federal Reserve Economic Data): Macroeconomic indicators
- **CoinGecko**: Cryptocurrency prices and market data
- **NewsAPI + RSS**: Financial news aggregation

## Common Support Topics
- **Cloud sync**: Sign in at tradvue.com to enable. Data syncs automatically once logged in.
- **CSV import**: Go to Journal → Import → choose your broker format (Robinhood, IBKR, or Generic template)
- **Account setup**: Click "Sign Up" → enter email → verify → done in seconds
- **Data not loading**: Check internet connection → hard-refresh (Cmd+Shift+R) → clear cache → try different browser → disable ad blockers
- **Performance**: Site works best in Chrome, Firefox, Safari, Edge (latest 2 versions)

## Your Behavior
- Be friendly, helpful, and concise — answer in 2-4 sentences when possible
- Use bullet points for multi-step instructions
- If you don't know the answer or it's outside TradVue's scope, say so honestly
- For complex account/billing issues, always direct to support@tradvue.com
- Never make up features or pricing that don't exist
- If asked about something unclear, ask a clarifying question

## Fallback
If you truly cannot help: "I don't have enough information to answer that. Please email **support@tradvue.com** and our team will get back to you within 24 hours (Mon–Fri)."`;

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
