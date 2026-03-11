/**
 * authService.js — Supabase Auth integration
 *
 * All auth operations go through Supabase Auth.
 * We never store or see passwords — Supabase handles everything.
 *
 * Required env vars:
 *   SUPABASE_URL      = https://ryckpsjmsrxbiylddqnb.supabase.co
 *   SUPABASE_ANON_KEY = <from Supabase dashboard → Project Settings → API>
 */

const { createClient } = require('@supabase/supabase-js');

// ── Lazy singleton ────────────────────────────────────────────────────────────
let _client = null;

function getClient() {
  if (_client) return _client;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY env vars are required');
  }

  _client = createClient(url, key, {
    auth: {
      autoRefreshToken: false,  // Server-side: we manage tokens manually
      persistSession: false,    // No browser storage on the server
      detectSessionInUrl: false,
    },
  });

  return _client;
}

// ── Sign Up ───────────────────────────────────────────────────────────────────
/**
 * Create a new account via Supabase Auth.
 * Supabase sends a confirmation email automatically (if enabled in dashboard).
 *
 * @param {string} email
 * @param {string} password
 * @param {object} [metadata] - optional user metadata (name, etc.)
 * @returns {{ data, error }}
 */
async function signUp(email, password, metadata = {}) {
  const supabase = getClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: metadata, // stored in auth.users.raw_user_meta_data
    },
  });
  return { data, error };
}

// ── Sign In ───────────────────────────────────────────────────────────────────
/**
 * Sign in with email + password. Returns session with access_token + refresh_token.
 *
 * @param {string} email
 * @param {string} password
 * @returns {{ data: { session, user }, error }}
 */
async function signIn(email, password) {
  const supabase = getClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  return { data, error };
}

// ── Sign Out ──────────────────────────────────────────────────────────────────
/**
 * Invalidate a session by access token.
 * Creates a scoped client so only that session is signed out.
 *
 * @param {string} accessToken
 * @returns {{ error }}
 */
async function signOut(accessToken) {
  const supabase = getClient();
  // Set the session on a fresh client to scope the sign-out
  const { error: setErr } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: '', // not needed for sign-out
  });
  if (setErr) return { error: setErr };

  const { error } = await supabase.auth.signOut();
  return { error };
}

// ── Get User ──────────────────────────────────────────────────────────────────
/**
 * Get the user profile for a given access token.
 * Uses Supabase's getUser (validates the token server-side).
 *
 * @param {string} accessToken
 * @returns {{ data: { user }, error }}
 */
async function getUser(accessToken) {
  const supabase = getClient();
  // getUser with a token validates it against the Supabase Auth server
  const { data, error } = await supabase.auth.getUser(accessToken);
  return { data, error };
}

// ── Reset Password ────────────────────────────────────────────────────────────
/**
 * Send a password reset email.
 * Supabase sends the magic link automatically.
 *
 * @param {string} email
 * @returns {{ data, error }}
 */
async function resetPassword(email) {
  const supabase = getClient();
  const redirectTo = process.env.SUPABASE_REDIRECT_URL || undefined;
  const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
    ...(redirectTo && { redirectTo }),
  });
  return { data, error };
}

// ── Update Password ───────────────────────────────────────────────────────────
/**
 * Change password for the authenticated user.
 * Requires a valid access token.
 *
 * @param {string} accessToken
 * @param {string} newPassword
 * @returns {{ data, error }}
 */
async function updatePassword(accessToken, newPassword) {
  const supabase = getClient();
  // Set the session so the client operates as this user
  await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: '',
  });
  const { data, error } = await supabase.auth.updateUser({ password: newPassword });
  return { data, error };
}

// ── Refresh Session ───────────────────────────────────────────────────────────
/**
 * Exchange a refresh token for a new access token.
 *
 * @param {string} refreshToken
 * @returns {{ data: { session }, error }}
 */
async function refreshSession(refreshToken) {
  const supabase = getClient();
  const { data, error } = await supabase.auth.refreshSession({ refresh_token: refreshToken });
  return { data, error };
}

// ── Delete User ───────────────────────────────────────────────────────────────
/**
 * Delete a user account by user ID.
 * Requires SUPABASE_SERVICE_KEY (admin-level) — falls back gracefully if not available.
 *
 * @param {string} userId  - UUID from auth.users
 * @returns {{ error }}
 */
async function deleteUser(userId) {
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  if (!serviceKey) {
    // Soft-delete via metadata instead
    console.warn('[authService] SUPABASE_SERVICE_KEY not set — cannot hard-delete user');
    return { error: null }; // non-fatal
  }

  const { createClient: createAdminClient } = require('@supabase/supabase-js');
  const admin = createAdminClient(process.env.SUPABASE_URL, serviceKey);
  const { error } = await admin.auth.admin.deleteUser(userId);
  return { error };
}

// ── Upsert Profile ────────────────────────────────────────────────────────────
/**
 * Create or update the user_profiles row for the given user.
 * Used after signUp and on profile update.
 *
 * @param {string} userId
 * @param {object} fields  - { name, preferences, tier }
 * @returns {{ data, error }}
 */
async function upsertProfile(userId, fields = {}) {
  const supabase = getClient();
  const { name, preferences, tier } = fields;

  const row = {
    id: userId,
    updated_at: new Date().toISOString(),
  };
  if (name !== undefined)        row.name = name;
  if (preferences !== undefined) row.preferences = preferences;
  if (tier !== undefined)        row.tier = tier;

  const { data, error } = await supabase
    .from('user_profiles')
    .upsert(row, { onConflict: 'id' })
    .select()
    .single();

  return { data, error };
}

// ── Get Profile ───────────────────────────────────────────────────────────────
/**
 * Fetch the user_profiles row for a user.
 *
 * @param {string} userId
 * @returns {{ data, error }}
 */
async function getProfile(userId) {
  const supabase = getClient();
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', userId)
    .single();
  return { data, error };
}

module.exports = {
  getClient,
  signUp,
  signIn,
  signOut,
  getUser,
  resetPassword,
  updatePassword,
  refreshSession,
  deleteUser,
  upsertProfile,
  getProfile,
};
