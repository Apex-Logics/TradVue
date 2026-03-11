/**
 * User Data Sync Routes — cloud save/load for authenticated users
 *
 * GET  /api/user/data              - Get all user data (journal, portfolio, settings, watchlist)
 * PUT  /api/user/data              - Save all user data (full sync)
 * GET  /api/user/data/:type        - Get specific data type
 * PUT  /api/user/data/:type        - Save specific data type
 *
 * Supported data types: journal | portfolio | settings | watchlist
 *
 * All routes require auth. Users ONLY see/write their own data.
 * Uses Supabase RLS (Row Level Security) as a second layer of protection.
 *
 * Data model: user_data table — one row per user per data_type.
 * See migrations/010_user_data.sql for schema.
 */

const express = require('express');
const router = express.Router();

const { requireAuth } = require('../middleware/auth');
const { getClient } = require('../services/authService');

// ── Constants ─────────────────────────────────────────────────────────────────
const VALID_TYPES = ['journal', 'portfolio', 'settings', 'watchlist'];

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Get a Supabase client scoped to the authenticated user.
 * By passing the user's access token, RLS policies apply automatically.
 * This ensures users can ONLY access their own rows.
 */
function getUserScopedClient(accessToken) {
  const supabase = getClient();
  // Set the auth session so Supabase RLS sees auth.uid() = user's ID
  supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: '',
  });
  return supabase;
}

/**
 * Extract access token from Authorization header.
 */
function getToken(req) {
  return req.headers['authorization']?.slice(7).trim() || null;
}

/**
 * Fetch one data type for the current user.
 */
async function fetchDataType(supabase, userId, dataType) {
  const { data, error } = await supabase
    .from('user_data')
    .select('data, updated_at')
    .eq('user_id', userId)
    .eq('data_type', dataType)
    .single();

  if (error && error.code !== 'PGRST116') {
    // PGRST116 = "row not found" — not an error, just empty
    throw error;
  }

  return data || { data: {}, updated_at: null };
}

/**
 * Upsert one data type for the current user.
 */
async function saveDataType(supabase, userId, dataType, payload) {
  const { data, error } = await supabase
    .from('user_data')
    .upsert(
      {
        user_id: userId,
        data_type: dataType,
        data: payload,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,data_type' }
    )
    .select('data, updated_at')
    .single();

  return { data, error };
}

// ── GET /api/user/data — fetch ALL data types ─────────────────────────────────
router.get('/data', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const token = getToken(req);
    const supabase = getUserScopedClient(token);

    const { data: rows, error } = await supabase
      .from('user_data')
      .select('data_type, data, updated_at')
      .eq('user_id', userId);

    if (error) {
      console.error('[UserData] Fetch all error:', error.message);
      return res.status(500).json({ error: 'Failed to fetch user data' });
    }

    // Build a flat object keyed by data_type
    const result = {
      journal: null,
      portfolio: null,
      settings: null,
      watchlist: null,
    };

    const meta = {};

    (rows || []).forEach(row => {
      result[row.data_type] = row.data;
      meta[row.data_type] = { updated_at: row.updated_at };
    });

    res.json({ data: result, meta });
  } catch (err) {
    console.error('[UserData] Fetch all error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── PUT /api/user/data — full sync (all types at once) ────────────────────────
router.put('/data', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const token = getToken(req);
    const supabase = getUserScopedClient(token);

    const body = req.body;

    // Validate: only accept known keys
    const toSave = {};
    for (const type of VALID_TYPES) {
      if (body[type] !== undefined) {
        if (typeof body[type] !== 'object') {
          return res.status(400).json({ error: `${type} must be an object` });
        }
        toSave[type] = body[type];
      }
    }

    if (Object.keys(toSave).length === 0) {
      return res.status(400).json({
        error: 'No valid data types provided',
        validTypes: VALID_TYPES,
      });
    }

    // Upsert all provided types in parallel
    const upserts = Object.entries(toSave).map(([type, payload]) =>
      saveDataType(supabase, userId, type, payload)
    );

    const results = await Promise.allSettled(upserts);
    const errors = results
      .filter(r => r.status === 'rejected' || r.value?.error)
      .map(r => r.reason?.message || r.value?.error?.message);

    if (errors.length > 0) {
      console.error('[UserData] Partial save errors:', errors);
      return res.status(500).json({ error: 'Some data failed to save', details: errors });
    }

    res.json({
      message: 'Data saved successfully',
      saved: Object.keys(toSave),
      updated_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[UserData] Full sync error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /api/user/data/:type — fetch a specific data type ─────────────────────
router.get('/data/:type', requireAuth, async (req, res) => {
  try {
    const { type } = req.params;

    if (!VALID_TYPES.includes(type)) {
      return res.status(400).json({
        error: `Invalid data type: ${type}`,
        validTypes: VALID_TYPES,
      });
    }

    const userId = req.user.id;
    const token = getToken(req);
    const supabase = getUserScopedClient(token);

    const row = await fetchDataType(supabase, userId, type);

    res.json({
      type,
      data: row.data || {},
      updated_at: row.updated_at,
    });
  } catch (err) {
    console.error(`[UserData] Fetch ${req.params.type} error:`, err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── PUT /api/user/data/:type — save a specific data type ──────────────────────
router.put('/data/:type', requireAuth, async (req, res) => {
  try {
    const { type } = req.params;

    if (!VALID_TYPES.includes(type)) {
      return res.status(400).json({
        error: `Invalid data type: ${type}`,
        validTypes: VALID_TYPES,
      });
    }

    if (typeof req.body !== 'object' || Array.isArray(req.body)) {
      return res.status(400).json({ error: 'Request body must be a JSON object' });
    }

    const userId = req.user.id;
    const token = getToken(req);
    const supabase = getUserScopedClient(token);

    const { data: saved, error } = await saveDataType(supabase, userId, type, req.body);

    if (error) {
      console.error(`[UserData] Save ${type} error:`, error.message);
      return res.status(500).json({ error: `Failed to save ${type}` });
    }

    res.json({
      message: `${type} saved successfully`,
      type,
      updated_at: saved?.updated_at || new Date().toISOString(),
    });
  } catch (err) {
    console.error(`[UserData] Save ${req.params.type} error:`, err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
