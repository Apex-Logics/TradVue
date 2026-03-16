/**
 * Feedback Routes — anonymous bug reports, feature requests, general feedback
 *
 * Uses Supabase REST API (HTTPS/IPv4) instead of direct PostgreSQL (IPv6-only).
 * No auth required for POST (anyone can submit feedback).
 *
 * POST /api/feedback  — submit feedback (anonymous allowed)
 * GET  /api/feedback  — list feedback (auth required, future admin panel)
 */

const express = require('express');
const xss = require('xss');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { createClient } = require('@supabase/supabase-js');
const { requireAuth } = require('../middleware/auth');
const { logActivity, getIP } = require('../services/activityLogger');

// Rate limit: 5 submissions per 15 minutes per IP
const feedbackLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Too many feedback submissions. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY required');
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// ── POST /api/feedback ─────────────────────────────────────────────────────────
router.post('/', feedbackLimiter, async (req, res) => {
  try {
    const { type, message, email, page_url } = req.body;

    // XSS sanitization — strip all HTML from user-supplied text fields
    const sanitizedMessage = message ? xss(message, { whiteList: {}, stripIgnoreTag: true }) : message;
    const sanitizedEmail = email ? xss(email, { whiteList: {}, stripIgnoreTag: true }) : email;
    const sanitizedPageUrl = page_url ? xss(page_url, { whiteList: {}, stripIgnoreTag: true }) : page_url;

    // Validate type
    const validTypes = ['bug', 'feature', 'general'];
    if (!type || !validTypes.includes(type)) {
      return res.status(400).json({ error: 'type must be one of: bug, feature, general' });
    }

    // Validate message length
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'message is required' });
    }
    const trimmed = sanitizedMessage.trim();
    if (trimmed.length < 10) {
      return res.status(400).json({ error: 'message must be at least 10 characters' });
    }
    if (trimmed.length > 2000) {
      return res.status(400).json({ error: 'message must be 2000 characters or fewer' });
    }

    // Optional email basic sanity check
    if (sanitizedEmail && typeof sanitizedEmail === 'string' && sanitizedEmail.length > 0) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sanitizedEmail)) {
        return res.status(400).json({ error: 'Invalid email format' });
      }
    }

    const supabase = getSupabase();
    const user_agent = req.headers['user-agent'] || null;

    const { error } = await supabase.from('feedback').insert({
      type,
      message: trimmed,
      email: sanitizedEmail || null,
      page_url: sanitizedPageUrl || null,
      user_agent,
    });

    if (error) {
      console.error('[feedback] Supabase insert error:', error.message);
      return res.status(500).json({ error: 'Failed to save feedback' });
    }

    logActivity(null, sanitizedEmail || null, 'feedback_submit', { type, page_url: page_url || null }, getIP(req), req.headers['user-agent']);
    return res.status(201).json({ success: true, message: 'Feedback received' });
  } catch (err) {
    console.error('[feedback] Unexpected error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /api/feedback ──────────────────────────────────────────────────────────
router.get('/', requireAuth, async (req, res) => {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('feedback')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('[feedback] Supabase select error:', error.message);
      return res.status(500).json({ error: 'Failed to fetch feedback' });
    }

    return res.json({ feedback: data || [] });
  } catch (err) {
    console.error('[feedback] Unexpected error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
