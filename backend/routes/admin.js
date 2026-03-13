/**
 * Admin Routes — TradVue internal admin dashboard API
 *
 * All routes require:
 *   1. Valid Supabase JWT (requireAuth middleware)
 *   2. Email in ADMIN_ALLOWLIST
 *
 * Uses Supabase REST API client (NOT direct PostgreSQL — IPv6-only on Render).
 */

const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const { requireAuth } = require('../middleware/auth');

const ADMIN_ALLOWLIST = ['firemanems06@gmail.com', 'axle-test@tradvue.com'];

// ── Admin Supabase client (service role) ──────────────────────────────────────
function getAdminClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required');
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.warn('[Admin] SUPABASE_SERVICE_ROLE_KEY not set — falling back to anon key. Some admin queries may fail due to RLS.');
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// ── Admin guard middleware ─────────────────────────────────────────────────────
function requireAdmin(req, res, next) {
  if (!req.user || !ADMIN_ALLOWLIST.includes(req.user.email)) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

// Apply auth + admin guard to all routes
router.use(requireAuth, requireAdmin);

// ── GET /api/admin/stats ──────────────────────────────────────────────────────
router.get('/stats', async (req, res) => {
  try {
    const supabase = getAdminClient();

    // Total users via admin auth API
    let totalUsers = 0;
    try {
      const { data: usersData, error: usersErr } = await supabase.auth.admin.listUsers({ perPage: 1 });
      if (!usersErr && usersData?.total) {
        totalUsers = usersData.total;
      }
    } catch (e) {
      console.warn('[Admin] auth.admin.listUsers failed:', e.message);
    }

    // Users by tier
    const { count: freeCount } = await supabase
      .from('user_profiles')
      .select('*', { count: 'exact', head: true })
      .eq('tier', 'free');

    const { count: proCount } = await supabase
      .from('user_profiles')
      .select('*', { count: 'exact', head: true })
      .eq('tier', 'pro');

    // Feedback stats
    const { count: totalFeedback } = await supabase
      .from('feedback')
      .select('*', { count: 'exact', head: true });

    const { count: newFeedback } = await supabase
      .from('feedback')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'new');

    // user_data stats (users who have synced at least one item)
    const { count: syncedUsers } = await supabase
      .from('user_data')
      .select('*', { count: 'exact', head: true });

    res.json({
      users: {
        total: totalUsers,
        free: freeCount || 0,
        pro: proCount || 0,
        synced: syncedUsers || 0,
      },
      feedback: {
        total: totalFeedback || 0,
        new: newFeedback || 0,
      },
    });
  } catch (err) {
    console.error('[Admin] /stats error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/admin/users ──────────────────────────────────────────────────────
router.get('/users', async (req, res) => {
  try {
    const supabase = getAdminClient();
    const { search, tier } = req.query;

    // List users via admin API
    const { data: usersData, error: usersErr } = await supabase.auth.admin.listUsers({
      perPage: 500,
    });
    if (usersErr) throw usersErr;

    let users = usersData.users.map(u => ({
      id: u.id,
      email: u.email,
      created_at: u.created_at,
      last_sign_in: u.last_sign_in_at,
      email_verified: !!u.email_confirmed_at,
      tier: 'free', // default, will be overridden below
    }));

    // Fetch tiers from user_profiles
    const { data: profiles } = await supabase
      .from('user_profiles')
      .select('user_id, tier');

    if (profiles) {
      const tierMap = {};
      profiles.forEach(p => { tierMap[p.user_id] = p.tier; });
      users = users.map(u => ({ ...u, tier: tierMap[u.id] || 'free' }));
    }

    // Apply filters
    if (search) {
      const q = search.toLowerCase();
      users = users.filter(u => u.email?.toLowerCase().includes(q));
    }
    if (tier === 'free' || tier === 'pro') {
      users = users.filter(u => u.tier === tier);
    }

    res.json({ users, total: users.length });
  } catch (err) {
    console.error('[Admin] /users error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/admin/users/:id ──────────────────────────────────────────────────
router.get('/users/:id', async (req, res) => {
  try {
    const supabase = getAdminClient();
    const { id } = req.params;

    const { data, error } = await supabase.auth.admin.getUserById(id);
    if (error) throw error;

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', id)
      .single();

    const { data: userData } = await supabase
      .from('user_data')
      .select('key, updated_at')
      .eq('user_id', id);

    res.json({
      user: {
        id: data.user.id,
        email: data.user.email,
        created_at: data.user.created_at,
        last_sign_in: data.user.last_sign_in_at,
        email_verified: !!data.user.email_confirmed_at,
        tier: profile?.tier || 'free',
        profile,
        syncedKeys: userData?.map(d => d.key) || [],
      },
    });
  } catch (err) {
    console.error('[Admin] /users/:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/admin/users/:id ───────────────────────────────────────────────
router.delete('/users/:id', async (req, res) => {
  try {
    const supabase = getAdminClient();
    const { id } = req.params;

    // Prevent self-deletion
    if (id === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    const { error } = await supabase.auth.admin.deleteUser(id);
    if (error) throw error;

    res.json({ success: true, message: `User ${id} deleted` });
  } catch (err) {
    console.error('[Admin] DELETE /users/:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/admin/feedback ───────────────────────────────────────────────────
router.get('/feedback', async (req, res) => {
  try {
    const supabase = getAdminClient();
    const { status, type } = req.query;

    let query = supabase
      .from('feedback')
      .select('*')
      .order('created_at', { ascending: false });

    if (status) query = query.eq('status', status);
    if (type) query = query.eq('type', type);

    const { data, error } = await query;
    if (error) throw error;

    res.json({ feedback: data || [], total: data?.length || 0 });
  } catch (err) {
    console.error('[Admin] /feedback error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── PATCH /api/admin/feedback/:id ────────────────────────────────────────────
router.patch('/feedback/:id', async (req, res) => {
  try {
    const supabase = getAdminClient();
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['new', 'reviewed', 'resolved', 'wontfix'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ error: 'status must be one of: new, reviewed, resolved, wontfix' });
    }

    const { data, error } = await supabase
      .from('feedback')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json({ feedback: data });
  } catch (err) {
    console.error('[Admin] PATCH /feedback/:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/admin/health ─────────────────────────────────────────────────────
router.get('/health', async (req, res) => {
  const startTime = Date.now();

  // Check Supabase connection
  let dbStatus = 'ok';
  let dbLatencyMs = null;
  try {
    const supabase = getAdminClient();
    const t0 = Date.now();
    const { error } = await supabase.from('feedback').select('id').limit(1);
    dbLatencyMs = Date.now() - t0;
    if (error) dbStatus = 'error';
  } catch (e) {
    dbStatus = 'error';
  }

  res.json({
    api: {
      status: 'ok',
      uptime: process.uptime(),
      uptimeFormatted: formatUptime(process.uptime()),
      responseMs: Date.now() - startTime,
      nodeVersion: process.version,
      env: process.env.NODE_ENV || 'development',
    },
    database: {
      status: dbStatus,
      latencyMs: dbLatencyMs,
      provider: 'supabase',
      url: process.env.SUPABASE_URL ? process.env.SUPABASE_URL.replace(/https?:\/\//, '').split('.')[0] + '.supabase.co' : 'unknown',
    },
    deploy: {
      lastDeploy: process.env.LAST_DEPLOY || new Date().toISOString(),
      version: process.env.APP_VERSION || '1.0.0',
      renderService: process.env.RENDER_SERVICE_NAME || 'tradvue-api',
    },
  });
});

function formatUptime(seconds) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

module.exports = router;
