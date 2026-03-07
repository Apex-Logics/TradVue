/**
 * Waitlist Routes
 *
 * POST /api/waitlist  - Sign up for early access
 * GET  /api/waitlist  - Admin: list signups (protected by admin key)
 */

const express = require('express');
const router = express.Router();
const db = require('../services/db');

// ── Ensure table exists (idempotent) ──────────────────────────────────────
async function ensureTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS waitlist (
      id              SERIAL PRIMARY KEY,
      email           TEXT NOT NULL UNIQUE,
      first_name      TEXT,
      trade_type      TEXT,
      experience      TEXT,
      wants_telegram  BOOLEAN DEFAULT FALSE,
      wants_discord   BOOLEAN DEFAULT FALSE,
      ip_address      TEXT,
      created_at      TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}

ensureTable().catch(err =>
  console.error('[waitlist] table init error:', err.message)
);

// ── POST /api/waitlist ────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  const {
    email,
    first_name,
    trade_type,
    experience,
    wants_telegram = false,
    wants_discord  = false,
  } = req.body;

  // Basic validation
  if (!email || typeof email !== 'string') {
    return res.status(400).json({ error: 'Email is required.' });
  }

  const emailTrimmed = email.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(emailTrimmed)) {
    return res.status(400).json({ error: 'Please provide a valid email address.' });
  }

  try {
    const result = await db.query(
      `INSERT INTO waitlist (email, first_name, trade_type, experience, wants_telegram, wants_discord, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (email) DO NOTHING
       RETURNING id, created_at`,
      [
        emailTrimmed,
        first_name?.trim() || null,
        trade_type || null,
        experience || null,
        !!wants_telegram,
        !!wants_discord,
        req.ip || null,
      ]
    );

    if (result.rows.length === 0) {
      // Email already exists — treat as success (don't leak info)
      return res.json({ success: true, already_registered: true });
    }

    return res.json({
      success: true,
      already_registered: false,
      id: result.rows[0].id,
    });
  } catch (err) {
    console.error('[waitlist] insert error:', err.message);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

// ── GET /api/waitlist (admin only) ────────────────────────────────────────
router.get('/', async (req, res) => {
  const adminKey = req.headers['x-admin-key'];
  if (!adminKey || adminKey !== process.env.ADMIN_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const result = await db.query(
      `SELECT id, email, first_name, trade_type, experience,
              wants_telegram, wants_discord, created_at
       FROM waitlist
       ORDER BY created_at DESC
       LIMIT 500`
    );
    return res.json({ count: result.rows.length, signups: result.rows });
  } catch (err) {
    console.error('[waitlist] fetch error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch waitlist.' });
  }
});

module.exports = router;
