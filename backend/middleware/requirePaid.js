/**
 * requirePaid — Feature gating middleware for TradVue Pro
 *
 * Checks that the authenticated user has:
 *   - tier === 'pro', OR
 *   - An active free trial (trial_ends_at is in the future)
 *
 * Returns 403 with an upgrade message if the user is on a restricted free tier.
 *
 * Usage:
 *   router.get('/some-pro-route', requireAuth, requirePaid, handler)
 *
 * IMPORTANT: requireAuth must run BEFORE requirePaid (to populate req.user).
 *
 * Required env vars:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

const { createClient } = require('@supabase/supabase-js');

// ── Supabase service-role client (bypasses RLS) ───────────────────────────────
let _supabaseAdmin = null;
function getSupabaseAdmin() {
  if (_supabaseAdmin) return _supabaseAdmin;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set');
  _supabaseAdmin = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return _supabaseAdmin;
}

/**
 * requirePaid middleware
 *
 * Allows access if:
 *   1. User tier is 'pro' (active paid subscription), OR
 *   2. User is within their 3-week free trial (trial_ends_at > NOW())
 *
 * Denies with 403 if:
 *   - User is free-tier AND trial has expired (or never set)
 *
 * Passes through on DB errors (fail-open, log the error) to avoid blocking
 * paying customers if the database is momentarily unavailable.
 */
async function requirePaid(req, res, next) {
  // requireAuth must have already set req.user
  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required',
      message: 'Please sign in to access this feature.',
    });
  }

  const userId = req.user.id;

  try {
    const supabase = getSupabaseAdmin();
    const { data: profile, error } = await supabase
      .from('user_profiles')
      .select('tier, trial_ends_at')
      .eq('id', userId)
      .single();

    if (error) {
      // DB unavailable: fail-open to avoid blocking paying customers
      console.error(`[requirePaid] DB error for user ${userId}:`, error.message);
      return next();
    }

    // ── Paid tier ────────────────────────────────────────────────────────────
    if (profile?.tier === 'pro') {
      return next();
    }

    // ── Active trial ──────────────────────────────────────────────────────────
    if (profile?.trial_ends_at) {
      const trialEnd = new Date(profile.trial_ends_at);
      if (trialEnd > new Date()) {
        return next();
      }
    }

    // ── Free tier post-trial ──────────────────────────────────────────────────
    return res.status(403).json({
      error: 'Pro subscription required',
      message: 'This feature requires a TradVue Pro subscription.',
      upgradeUrl: 'https://www.tradvue.com/pricing',
      tier: profile?.tier || 'free',
      trialExpired: true,
    });
  } catch (err) {
    // Unexpected error: fail-open, log for monitoring
    console.error(`[requirePaid] Unexpected error for user ${userId}:`, err.message);
    return next();
  }
}

/**
 * requirePaidStrict — Same as requirePaid but fails CLOSED on DB errors.
 * Use for high-value endpoints where you'd rather return an error than
 * risk serving free users pro content.
 */
async function requirePaidStrict(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required',
      message: 'Please sign in to access this feature.',
    });
  }

  const userId = req.user.id;

  try {
    const supabase = getSupabaseAdmin();
    const { data: profile, error } = await supabase
      .from('user_profiles')
      .select('tier, trial_ends_at')
      .eq('id', userId)
      .single();

    if (error) {
      console.error(`[requirePaidStrict] DB error for user ${userId}:`, error.message);
      return res.status(503).json({
        error: 'Service temporarily unavailable',
        message: 'Unable to verify subscription status. Please try again shortly.',
      });
    }

    if (profile?.tier === 'pro') return next();

    if (profile?.trial_ends_at) {
      const trialEnd = new Date(profile.trial_ends_at);
      if (trialEnd > new Date()) return next();
    }

    return res.status(403).json({
      error: 'Pro subscription required',
      message: 'This feature requires a TradVue Pro subscription.',
      upgradeUrl: 'https://www.tradvue.com/pricing',
      tier: profile?.tier || 'free',
      trialExpired: true,
    });
  } catch (err) {
    console.error(`[requirePaidStrict] Unexpected error for user ${userId}:`, err.message);
    return res.status(503).json({
      error: 'Service temporarily unavailable',
      message: 'Unable to verify subscription status.',
    });
  }
}

module.exports = { requirePaid, requirePaidStrict };
