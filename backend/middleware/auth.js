/**
 * Auth Middleware — Supabase JWT validation
 *
 * Two middlewares exported:
 *   requireAuth   — rejects requests without a valid token (401/403)
 *   optionalAuth  — attaches user if token present, continues either way
 *
 * Both attach req.user = { id, email, role } on success.
 *
 * Token is read from:  Authorization: Bearer <access_token>
 *
 * Validation uses Supabase's getUser() which calls the Supabase Auth server
 * to validate the JWT — this is the most reliable approach and handles
 * token revocation automatically.
 *
 * Required env vars:
 *   SUPABASE_URL      = https://ryckpsjmsrxbiylddqnb.supabase.co
 *   SUPABASE_ANON_KEY = <from Supabase dashboard>
 */

const { getUser } = require('../services/authService');

// ── Token Extractor ───────────────────────────────────────────────────────────
function extractBearerToken(req) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7).trim();
  return token || null;
}

// ── Core Validator ────────────────────────────────────────────────────────────
async function validateToken(token) {
  if (!token) return null;

  const { data, error } = await getUser(token);
  if (error || !data?.user) return null;

  const user = data.user;
  return {
    id: user.id,
    email: user.email,
    role: user.role || 'authenticated',
    // Include app_metadata.role if set (for custom roles)
    appRole: user.app_metadata?.role || null,
    // User metadata (name, etc.)
    name: user.user_metadata?.name || null,
    emailVerified: user.email_confirmed_at !== null,
  };
}

// ── requireAuth ───────────────────────────────────────────────────────────────
/**
 * Middleware: requires a valid Supabase JWT.
 * Attaches req.user = { id, email, role, ... }
 * Returns 401 if no token, 403 if invalid/expired.
 */
async function requireAuth(req, res, next) {
  const token = extractBearerToken(req);

  if (!token) {
    return res.status(401).json({
      error: 'Authentication required',
      message: 'Provide a valid Bearer token in the Authorization header',
    });
  }

  try {
    const user = await validateToken(token);
    if (!user) {
      return res.status(403).json({
        error: 'Invalid or expired token',
        message: 'Please sign in again to get a new access token',
      });
    }

    req.user = user;
    next();
  } catch (err) {
    console.error('[Auth Middleware] Token validation error:', err.message);
    return res.status(500).json({ error: 'Auth validation failed' });
  }
}

// ── optionalAuth ──────────────────────────────────────────────────────────────
/**
 * Middleware: attaches user if token is present and valid.
 * Never rejects — anonymous access is allowed.
 * req.user will be null if no valid token.
 */
async function optionalAuth(req, res, next) {
  const token = extractBearerToken(req);

  if (!token) {
    req.user = null;
    return next();
  }

  try {
    const user = await validateToken(token);
    req.user = user; // null if invalid — that's fine for optional auth
  } catch {
    req.user = null;
  }

  next();
}

module.exports = { requireAuth, optionalAuth };
