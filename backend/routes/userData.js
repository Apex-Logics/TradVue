/**
 * User Data Sync Routes — cloud save/load for authenticated users
 *
 * Uses Supabase REST API (HTTPS/IPv4) instead of direct PostgreSQL (IPv6-only).
 * Creates a fresh Supabase client per request to avoid session bleeding.
 *
 * GET  /api/user/data              - Get all user data
 * PUT  /api/user/data              - Save all user data
 * GET  /api/user/data/:type        - Get specific data type
 * PUT  /api/user/data/:type        - Save specific data type
 */

const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const { requireAuth } = require('../middleware/auth');

const VALID_TYPES = ['journal', 'portfolio', 'settings', 'watchlist'];

/**
 * Create a fresh Supabase client scoped to a specific user's access token.
 * MUST create a new client per request — never reuse or call setSession on a shared client.
 */
function createUserClient(accessToken) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY required');

  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

function getAccessToken(req) {
  return req.headers['authorization']?.slice(7).trim() || null;
}

// ── GET /api/user/data — fetch ALL data types ─────────────────────────────────
router.get('/data', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const token = getAccessToken(req);
    const supabase = createUserClient(token);

    console.log(`[UserData] GET /data — userId: ${userId}`);

    const { data: rows, error } = await supabase
      .from('user_data')
      .select('data_type, data, updated_at')
      .eq('user_id', userId);

    if (error) {
      console.error('[UserData] Fetch all error:', error.message);
      return res.status(500).json({ error: 'Failed to fetch user data' });
    }

    const result = { journal: null, portfolio: null, settings: null, watchlist: null };
    const meta = {};
    (rows || []).forEach(row => {
      result[row.data_type] = row.data;
      meta[row.data_type] = { updated_at: row.updated_at };
    });

    console.log(`[UserData] GET /data — found ${(rows || []).length} rows`);
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
    const token = getAccessToken(req);
    const supabase = createUserClient(token);
    const body = req.body;

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
      return res.status(400).json({ error: 'No valid data types provided', validTypes: VALID_TYPES });
    }

    const upserts = Object.entries(toSave).map(([type, payload]) =>
      supabase.from('user_data').upsert(
        { user_id: userId, data_type: type, data: payload, updated_at: new Date().toISOString() },
        { onConflict: 'user_id,data_type' }
      )
    );

    const results = await Promise.allSettled(upserts);
    const errors = results.filter(r => r.status === 'rejected' || r.value?.error).length;

    if (errors > 0) {
      console.error('[UserData] Partial save errors');
      return res.status(500).json({ error: 'Some data failed to save' });
    }

    res.json({ message: 'Data saved successfully', saved: Object.keys(toSave), updated_at: new Date().toISOString() });
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
      return res.status(400).json({ error: `Invalid data type: ${type}`, validTypes: VALID_TYPES });
    }

    const userId = req.user.id;
    const token = getAccessToken(req);
    const supabase = createUserClient(token);

    console.log(`[UserData] GET /data/${type} — userId: ${userId}`);

    const { data, error } = await supabase
      .from('user_data')
      .select('data, updated_at')
      .eq('user_id', userId)
      .eq('data_type', type)
      .maybeSingle();

    if (error) {
      console.error(`[UserData] Fetch ${type} error:`, error.message);
      return res.status(500).json({ error: 'Internal server error' });
    }

    res.json({ type, data: data?.data || null, updated_at: data?.updated_at || null });
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
      return res.status(400).json({ error: `Invalid data type: ${type}`, validTypes: VALID_TYPES });
    }
    if (typeof req.body !== 'object' || Array.isArray(req.body)) {
      return res.status(400).json({ error: 'Request body must be a JSON object' });
    }

    const userId = req.user.id;
    const token = getAccessToken(req);
    const supabase = createUserClient(token);

    console.log(`[UserData] PUT /data/${type} — userId: ${userId}, size: ${JSON.stringify(req.body).length}`);

    const { error } = await supabase.from('user_data').upsert(
      { user_id: userId, data_type: type, data: req.body, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,data_type' }
    );

    if (error) {
      console.error(`[UserData] Save ${type} error:`, error.message);
      return res.status(500).json({ error: `Failed to save ${type}` });
    }

    res.json({ message: `${type} saved successfully`, type, updated_at: new Date().toISOString() });
  } catch (err) {
    console.error(`[UserData] Save ${req.params.type} error:`, err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Debug endpoint — remove after testing
router.get('/debug', async (req, res) => {
  try {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_ANON_KEY;
    const supabase = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false }
    });
    const { count, error } = await supabase.from('user_data').select('*', { count: 'exact', head: true });
    res.json({ version: 'supabase-rest-v2', count, error: error?.message || null });
  } catch (err) {
    res.json({ version: 'supabase-rest-v2', error: err.message });
  }
});

module.exports = router;
