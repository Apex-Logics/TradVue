/**
 * Auth Routes — Supabase Auth integration
 *
 * POST   /api/auth/signup    - Create account
 * POST   /api/auth/login     - Sign in, returns session tokens
 * POST   /api/auth/logout    - Invalidate session (requires auth)
 * POST   /api/auth/refresh   - Refresh expired access token
 * POST   /api/auth/forgot    - Send password reset email
 * POST   /api/auth/reset     - Update password (requires valid reset token)
 * GET    /api/auth/me        - Get current user profile (requires auth)
 * PUT    /api/auth/me        - Update profile name/preferences (requires auth)
 * DELETE /api/auth/me        - Delete account (requires auth)
 *
 * Auth is OPTIONAL for basic app use — this is only for cloud sync.
 *
 * Rate limiting:
 *   signup/login: 5 attempts per 15 minutes (brute-force protection)
 *   everything else: standard general limiter
 */

const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');

const authService = require('../services/authService');
const { requireAuth } = require('../middleware/auth');
const { logActivity, getIP } = require('../services/activityLogger');

// ── Service-role client for trial expiry enforcement ──────────────────────────
let _supabaseAdmin = null;
function getSupabaseAdmin() {
  if (_supabaseAdmin) return _supabaseAdmin;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  _supabaseAdmin = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return _supabaseAdmin;
}

/**
 * checkAndEnforceTrialExpiry — called on login.
 * If user is free-tier and trial_ends_at is in the past, ensure tier stays 'free'.
 * This is belt-and-suspenders: the trial is enforced at query time by requirePaid
 * middleware too, but logging on expiry is useful for analytics.
 */
async function checkAndEnforceTrialExpiry(userId) {
  try {
    const supabase = getSupabaseAdmin();
    if (!supabase) return; // service role key not configured

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('tier, trial_ends_at')
      .eq('id', userId)
      .single();

    if (!profile) return;
    if (profile.tier === 'pro') return; // paid user — nothing to do

    const trialEnded =
      profile.trial_ends_at && new Date(profile.trial_ends_at) < new Date();

    if (trialEnded) {
      console.log(`[Auth] Trial expired for user ${userId} — enforcing free tier`);
      // tier is already 'free'; just log for analytics. In future: could trigger
      // a "trial ended" email here if trial_ended_notified is not set.
    }
  } catch (err) {
    // Non-fatal — don't block login
    console.warn('[Auth] Trial expiry check failed (non-fatal):', err.message);
  }
}

// ── Auth-specific rate limiter ─────────────────────────────────────────────
// 5 attempts per 15 minutes per IP — tight enough to stop brute force
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many attempts',
    message: 'Please wait 15 minutes before trying again',
  },
  skipSuccessfulRequests: true, // only count failures against the limit
});

// ── Helpers ───────────────────────────────────────────────────────────────────
function sanitizeSession(session) {
  if (!session) return null;
  return {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_in: session.expires_in,
    token_type: session.token_type,
  };
}

function sanitizeUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    name: user.user_metadata?.name || null,
    email_verified: user.email_confirmed_at !== null,
    created_at: user.created_at,
    tier: user.app_metadata?.tier || 'free',
  };
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ── POST /api/auth/signup ─────────────────────────────────────────────────────
router.post('/signup', authLimiter, async (req, res) => {
  // Guard: Supabase not configured (env vars missing on this deployment)
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    return res.status(503).json({
      error: 'Authentication service is not configured. Please try again later.',
    });
  }

  try {
    const { email: rawEmail, password, name } = req.body;

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

    const metadata = {};
    if (name) metadata.name = name.trim();

    const { data, error } = await authService.signUp(email, password, metadata);

    if (error) {
      // Supabase returns "User already registered" for duplicates
      if (error.message?.toLowerCase().includes('already registered') ||
          error.message?.toLowerCase().includes('already exists')) {
        return res.status(409).json({ error: 'An account with this email already exists' });
      }
      console.error('[Auth] Signup error:', error.message);
      return res.status(400).json({ error: error.message });
    }

    // If email confirmation is required, session will be null
    const needsConfirmation = !data.session;

    // Create profile row for the new user (with 3-week trial)
    if (data.user) {
      const trialEndsAt = new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString();
      await authService.upsertProfile(data.user.id, {
        name,
        tier: 'free',
        trial_ends_at: trialEndsAt,
      }).catch(err => {
        console.warn('[Auth] Profile creation failed (non-fatal):', err.message);
      });
    }

    logActivity(data.user?.id, email, 'signup', { needs_confirmation: needsConfirmation }, getIP(req), req.headers['user-agent']);
    res.status(201).json({
      message: needsConfirmation
        ? 'Account created. Please check your email to confirm your account.'
        : 'Account created successfully',
      session: sanitizeSession(data.session),
      user: sanitizeUser(data.user),
      needs_confirmation: needsConfirmation,
    });
  } catch (err) {
    console.error('[Auth] Signup error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /api/auth/resend-verification ─────────────────────────────────────────
router.post('/resend-verification', authLimiter, async (req, res) => {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    return res.status(503).json({ error: 'Authentication service is not configured.' });
  }
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });

  try {
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false }
    });
    const { error } = await supabase.auth.resend({ type: 'signup', email: email.trim().toLowerCase() });
    if (error) {
      console.error('[Auth] Resend verification error:', error.message);
      return res.status(400).json({ error: error.message });
    }
    res.json({ message: 'Verification email resent. Check your inbox and spam folder.' });
  } catch (err) {
    console.error('[Auth] Resend verification error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /api/auth/login ──────────────────────────────────────────────────────
router.post('/login', authLimiter, async (req, res) => {
  // Guard: Supabase not configured (env vars missing on this deployment)
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    return res.status(503).json({
      error: 'Authentication service is not configured. Please try again later.',
    });
  }

  try {
    const { email: rawEmail, password } = req.body;

    if (!rawEmail || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const email = rawEmail.trim().toLowerCase();

    if (!EMAIL_REGEX.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    const { data, error } = await authService.signIn(email, password);

    if (error) {
      // Don't reveal whether email or password was wrong
      if (error.message?.toLowerCase().includes('invalid') ||
          error.message?.toLowerCase().includes('not found') ||
          error.message?.toLowerCase().includes('credentials')) {
        const maskedEmail = email.charAt(0) + '***@' + email.split('@')[1];
        console.warn(`[Auth] Failed login for ${maskedEmail} from ${req.ip}`);
        logActivity(null, email, 'login_failed', { reason: 'invalid_credentials' }, getIP(req), req.headers['user-agent']);
        return res.status(401).json({ error: 'Invalid email or password' });
      }
      if (error.message?.toLowerCase().includes('confirm')) {
        return res.status(403).json({ error: 'Please confirm your email before signing in' });
      }
      console.error('[Auth] Login error:', error.message);
      return res.status(400).json({ error: error.message });
    }

    logActivity(data.user?.id, email, 'login', {}, getIP(req), req.headers['user-agent']);

    // Non-blocking: check/log trial expiry on each login
    if (data.user?.id) {
      checkAndEnforceTrialExpiry(data.user.id).catch(() => {});
    }

    // Fetch profile to include tier + trial_ends_at in response
    let profile = null;
    if (data.user?.id) {
      const profileResult = await authService.getProfile(data.user.id).catch(() => null);
      profile = profileResult?.data || null;
    }

    res.json({
      message: 'Login successful',
      session: sanitizeSession(data.session),
      user: {
        ...sanitizeUser(data.user),
        tier: profile?.tier || 'free',
        trial_ends_at: profile?.trial_ends_at || null,
      },
    });
  } catch (err) {
    console.error('[Auth] Login error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /api/auth/logout ─────────────────────────────────────────────────────
router.post('/logout', requireAuth, async (req, res) => {
  try {
    const token = req.headers['authorization']?.slice(7).trim();
    const { error } = await authService.signOut(token);

    if (error) {
      console.warn('[Auth] Logout warning:', error.message);
      // Non-fatal — token may already be expired
    }

    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    console.error('[Auth] Logout error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /api/auth/refresh ────────────────────────────────────────────────────
router.post('/refresh', authLimiter, async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ error: 'refreshToken is required' });
    }

    const { data, error } = await authService.refreshSession(refreshToken);

    if (error || !data?.session) {
      return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }

    res.json({
      message: 'Token refreshed',
      session: sanitizeSession(data.session),
      user: sanitizeUser(data.user),
    });
  } catch (err) {
    console.error('[Auth] Refresh error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /api/auth/forgot ─────────────────────────────────────────────────────
router.post('/forgot', authLimiter, async (req, res) => {
  try {
    const { email: rawEmail } = req.body;

    if (!rawEmail) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const email = rawEmail.trim().toLowerCase();

    if (!EMAIL_REGEX.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    const { error } = await authService.resetPassword(email);

    if (error) {
      console.error('[Auth] Forgot password error:', error.message);
      // Don't expose whether email exists or not — always return success
    }

    // Always respond with success to prevent email enumeration
    res.json({
      message: 'If an account exists with that email, a password reset link has been sent',
    });
  } catch (err) {
    console.error('[Auth] Forgot password error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /api/auth/reset ──────────────────────────────────────────────────────
// Called after user clicks the reset link from email
// The token here is the access_token from the reset email deep link
router.post('/reset', authLimiter, async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ error: 'token and newPassword are required' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const { data, error } = await authService.updatePassword(token, newPassword);

    if (error) {
      console.error('[Auth] Password reset error:', error.message);
      return res.status(400).json({ error: error.message });
    }

    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    console.error('[Auth] Reset error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
router.get('/me', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;

    // Get auth user + profile in parallel
    const [userResult, profileResult] = await Promise.allSettled([
      authService.getUser(req.headers['authorization']?.slice(7).trim()),
      authService.getProfile(userId),
    ]);

    const user = userResult.status === 'fulfilled' ? userResult.value.data?.user : null;
    const profile = profileResult.status === 'fulfilled' ? profileResult.value.data : null;

    res.json({
      user: {
        ...sanitizeUser(user),
        name: profile?.name || req.user.name || null,
        tier: profile?.tier || 'free',
        preferences: profile?.preferences || {},
        trial_ends_at: profile?.trial_ends_at || null,
      },
    });
  } catch (err) {
    console.error('[Auth] Get profile error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── PUT /api/auth/me ──────────────────────────────────────────────────────────
router.put('/me', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, preferences } = req.body;

    // SECURITY: `tier` is intentionally NOT extracted from req.body.
    // Tier changes must go through the Stripe webhook or admin API only.
    // Any attempt to pass `tier` in the request body is silently ignored.
    if (req.body.tier !== undefined) {
      return res.status(403).json({
        error: 'Forbidden: tier cannot be updated through this endpoint',
        message: 'Tier changes require a valid payment. Visit /pricing to upgrade.',
      });
    }

    // Validate inputs
    if (name !== undefined && typeof name !== 'string') {
      return res.status(400).json({ error: 'name must be a string' });
    }
    if (preferences !== undefined && typeof preferences !== 'object') {
      return res.status(400).json({ error: 'preferences must be an object' });
    }

    const fields = {};
    if (name !== undefined)        fields.name = name.trim();
    if (preferences !== undefined) fields.preferences = preferences;

    const { data: profile, error } = await authService.upsertProfile(userId, fields);

    if (error) {
      console.error('[Auth] Update profile error:', error.message);
      return res.status(500).json({ error: 'Failed to update profile' });
    }

    res.json({
      message: 'Profile updated',
      profile: {
        id: profile?.id || userId,
        name: profile?.name || null,
        tier: profile?.tier || 'free',
        preferences: profile?.preferences || {},
        updated_at: profile?.updated_at,
      },
    });
  } catch (err) {
    console.error('[Auth] Update profile error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── DELETE /api/auth/me ───────────────────────────────────────────────────────
router.delete('/me', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { error } = await authService.deleteUser(userId);

    if (error) {
      console.error('[Auth] Delete account error:', error.message);
      return res.status(500).json({ error: 'Failed to delete account' });
    }

    res.json({ message: 'Account deleted successfully' });
  } catch (err) {
    console.error('[Auth] Delete account error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
