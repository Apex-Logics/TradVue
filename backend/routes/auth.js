/**
 * Auth Routes — PostgreSQL-backed
 *
 * POST /api/auth/register   - Create account
 * POST /api/auth/login      - Get JWT
 * GET  /api/auth/profile    - Current user (requires token)
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const router = express.Router();
const db = require('../services/db');
const { strictLimiter } = require('../services/rateLimit');

// ──────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function signToken(user) {
  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
      subscription_tier: user.subscription_tier,
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || '24h' }
  );
}

function sanitizeUser(user) {
  return {
    id: user.id,
    email: user.email,
    subscription_tier: user.subscription_tier,
    verified: user.verified,
    created_at: user.created_at,
  };
}

// ──────────────────────────────────────────
// POST /api/auth/register
// ──────────────────────────────────────────
router.post('/register', strictLimiter, async (req, res) => {
  try {
    const { email: rawEmail, password, subscription_tier = 'free' } = req.body;

    if (!rawEmail || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const email = rawEmail.trim().toLowerCase();

    if (!EMAIL_REGEX.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    // Check if user exists
    const { rows: existing } = await db.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );
    if (existing.length > 0) {
      return res.status(409).json({ error: 'User already exists' });
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, 12);

    // Insert user
    const { rows } = await db.query(
      `INSERT INTO users (email, password_hash, subscription_tier, verified, created_at, updated_at)
       VALUES ($1, $2, $3, false, NOW(), NOW())
       RETURNING *`,
      [email, password_hash, subscription_tier]
    );

    const user = rows[0];
    const token = signToken(user);

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: sanitizeUser(user),
    });
  } catch (error) {
    console.error('[Auth] Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ──────────────────────────────────────────
// POST /api/auth/login
// ──────────────────────────────────────────
router.post('/login', strictLimiter, async (req, res) => {
  try {
    const { email: rawEmail, password } = req.body;

    if (!rawEmail || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const email = rawEmail.trim().toLowerCase();

    if (!EMAIL_REGEX.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    const { rows } = await db.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    if (rows.length === 0) {
      console.warn(`[Auth] Failed login attempt for ${email} from ${req.ip}`);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = rows[0];
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      console.warn(`[Auth] Failed login attempt for ${email} from ${req.ip}`);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Update last_sign_in equivalent
    await db.query('UPDATE users SET updated_at = NOW() WHERE id = $1', [user.id]);

    const token = signToken(user);

    res.json({
      message: 'Login successful',
      token,
      user: sanitizeUser(user),
    });
  } catch (error) {
    console.error('[Auth] Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ──────────────────────────────────────────
// GET /api/auth/profile  (authenticated)
// ──────────────────────────────────────────
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT * FROM users WHERE id = $1',
      [req.user.userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user: sanitizeUser(rows[0]) });
  } catch (error) {
    console.error('[Auth] Profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ──────────────────────────────────────────
// Middleware — exported so other routes can use it
// ──────────────────────────────────────────
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
}

module.exports = router;
module.exports.authenticateToken = authenticateToken;
