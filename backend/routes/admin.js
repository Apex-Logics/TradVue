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

// ADMIN_EMAILS env var: comma-separated list of admin email addresses.
// Format: ADMIN_EMAILS=admin@example.com,admin2@example.com
// If the env var is missing or empty, no admins are allowed (safe default).
const ADMIN_ALLOWLIST = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim()).filter(Boolean);

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

    let totalUsers = 0;
    try {
      const { data: usersData, error: usersErr } = await supabase.auth.admin.listUsers({ perPage: 1 });
      if (!usersErr && usersData?.total) totalUsers = usersData.total;
    } catch (e) {
      console.warn('[Admin] auth.admin.listUsers failed:', e.message);
    }

    const { count: freeCount } = await supabase.from('user_profiles').select('*', { count: 'exact', head: true }).eq('tier', 'free');
    const { count: proCount } = await supabase.from('user_profiles').select('*', { count: 'exact', head: true }).eq('tier', 'pro');
    const { count: totalFeedback } = await supabase.from('feedback').select('*', { count: 'exact', head: true });
    const { count: newFeedback } = await supabase.from('feedback').select('*', { count: 'exact', head: true }).eq('status', 'new');
    const { count: syncedUsers } = await supabase.from('user_data').select('*', { count: 'exact', head: true });

    res.json({
      users: { total: totalUsers, free: freeCount || 0, pro: proCount || 0, synced: syncedUsers || 0 },
      feedback: { total: totalFeedback || 0, new: newFeedback || 0 },
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

    const { data: usersData, error: usersErr } = await supabase.auth.admin.listUsers({ perPage: 500 });
    if (usersErr) throw usersErr;

    let users = usersData.users.map(u => ({
      id: u.id, email: u.email, created_at: u.created_at,
      last_sign_in: u.last_sign_in_at, email_verified: !!u.email_confirmed_at, tier: 'free',
    }));

    const { data: profiles } = await supabase.from('user_profiles').select('user_id, tier');
    if (profiles) {
      const tierMap = {};
      profiles.forEach(p => { tierMap[p.user_id] = p.tier; });
      users = users.map(u => ({ ...u, tier: tierMap[u.id] || 'free' }));
    }

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

    const { data: profile } = await supabase.from('user_profiles').select('*').eq('user_id', id).single();
    const { data: userData } = await supabase.from('user_data').select('key, updated_at').eq('user_id', id);

    res.json({
      user: {
        id: data.user.id, email: data.user.email, created_at: data.user.created_at,
        last_sign_in: data.user.last_sign_in_at, email_verified: !!data.user.email_confirmed_at,
        tier: profile?.tier || 'free', profile, syncedKeys: userData?.map(d => d.key) || [],
      },
    });
  } catch (err) {
    console.error('[Admin] /users/:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/admin/users/:id/data ────────────────────────────────────────────
router.get('/users/:id/data', async (req, res) => {
  try {
    const supabase = getAdminClient();
    const { id } = req.params;

    const { data, error } = await supabase
      .from('user_data')
      .select('key, updated_at, value')
      .eq('user_id', id)
      .order('updated_at', { ascending: false });

    if (error) throw error;

    // Return summary: key, size estimate, last updated (don't expose full value)
    const summary = (data || []).map(row => ({
      key: row.key,
      updated_at: row.updated_at,
      size_bytes: JSON.stringify(row.value || {}).length,
    }));

    res.json({ user_id: id, data: summary, total: summary.length });
  } catch (err) {
    console.error('[Admin] /users/:id/data error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/admin/users/:id ───────────────────────────────────────────────
router.delete('/users/:id', async (req, res) => {
  try {
    const supabase = getAdminClient();
    const { id } = req.params;
    if (id === req.user.id) return res.status(400).json({ error: 'Cannot delete your own account' });
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
    let query = supabase.from('feedback').select('*').order('created_at', { ascending: false });
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
    const { data, error } = await supabase.from('feedback').update({ status }).eq('id', id).select().single();
    if (error) throw error;
    res.json({ feedback: data });
  } catch (err) {
    console.error('[Admin] PATCH /feedback/:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/admin/feedback/:id ───────────────────────────────────────────
router.delete('/feedback/:id', async (req, res) => {
  try {
    const supabase = getAdminClient();
    const { id } = req.params;
    const { error } = await supabase.from('feedback').delete().eq('id', id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    console.error('[Admin] DELETE /feedback/:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/admin/activity ───────────────────────────────────────────────────
router.get('/activity', async (req, res) => {
  try {
    const supabase = getAdminClient();
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const offset = parseInt(req.query.offset) || 0;
    const { action, user_id } = req.query;

    let query = supabase
      .from('activity_log')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (action) query = query.eq('action', action);
    if (user_id) query = query.eq('user_id', user_id);

    const { data, error, count } = await query;
    if (error) throw error;

    res.json({ activity: data || [], total: count || 0, limit, offset });
  } catch (err) {
    console.error('[Admin] /activity error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/admin/analytics ──────────────────────────────────────────────────
router.get('/analytics', async (req, res) => {
  try {
    const supabase = getAdminClient();

    // Active users: synced in last 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { count: weeklyActive } = await supabase
      .from('user_data')
      .select('user_id', { count: 'exact', head: true })
      .gte('updated_at', sevenDaysAgo);

    const { count: dailyActive } = await supabase
      .from('user_data')
      .select('user_id', { count: 'exact', head: true })
      .gte('updated_at', oneDayAgo);

    // Page views from activity_log
    const { count: totalPageViews } = await supabase
      .from('activity_log')
      .select('*', { count: 'exact', head: true })
      .eq('action', 'page_view');

    // Most used actions (top 10)
    const { data: actionData } = await supabase
      .from('activity_log')
      .select('action')
      .order('created_at', { ascending: false })
      .limit(1000);

    const actionCounts = {};
    (actionData || []).forEach(r => {
      actionCounts[r.action] = (actionCounts[r.action] || 0) + 1;
    });
    const topActions = Object.entries(actionCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([action, count]) => ({ action, count }));

    // Signups over last 30 days — use activity_log signup actions
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: signupData } = await supabase
      .from('activity_log')
      .select('created_at')
      .eq('action', 'signup')
      .gte('created_at', thirtyDaysAgo)
      .order('created_at', { ascending: true });

    const signupsByDay = {};
    (signupData || []).forEach(r => {
      const day = r.created_at.slice(0, 10);
      signupsByDay[day] = (signupsByDay[day] || 0) + 1;
    });
    // Build last 30 days array
    const signupsChart = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const day = d.toISOString().slice(0, 10);
      signupsChart.push({ date: day, count: signupsByDay[day] || 0 });
    }

    // Peak hours from activity_log
    const { data: hourData } = await supabase
      .from('activity_log')
      .select('created_at')
      .limit(5000);

    const hourCounts = new Array(24).fill(0);
    (hourData || []).forEach(r => {
      const h = new Date(r.created_at).getUTCHours();
      hourCounts[h]++;
    });
    const peakHours = hourCounts.map((count, hour) => ({ hour, count }));

    res.json({
      active_users: { daily: dailyActive || 0, weekly: weeklyActive || 0 },
      page_views: totalPageViews || 0,
      top_actions: topActions,
      signups_chart: signupsChart,
      peak_hours: peakHours,
    });
  } catch (err) {
    console.error('[Admin] /analytics error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/admin/export/users ───────────────────────────────────────────────
router.get('/export/users', async (req, res) => {
  try {
    const supabase = getAdminClient();
    const { data: usersData, error } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    if (error) throw error;

    const { data: profiles } = await supabase.from('user_profiles').select('user_id, tier');
    const tierMap = {};
    (profiles || []).forEach(p => { tierMap[p.user_id] = p.tier; });

    const users = usersData.users.map(u => ({
      id: u.id, email: u.email, tier: tierMap[u.id] || 'free',
      created_at: u.created_at, last_sign_in: u.last_sign_in_at || '',
      email_verified: u.email_confirmed_at ? 'yes' : 'no',
    }));

    const headers = ['id', 'email', 'tier', 'created_at', 'last_sign_in', 'email_verified'];
    const rows = users.map(u => headers.map(h => `"${String(u[h] || '').replace(/"/g, '""')}"`).join(','));
    const csv = [headers.join(','), ...rows].join('\n');

    const today = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=tradvue-users-${today}.csv`);
    res.send(csv);
  } catch (err) {
    console.error('[Admin] /export/users error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/admin/export/feedback ───────────────────────────────────────────
router.get('/export/feedback', async (req, res) => {
  try {
    const supabase = getAdminClient();
    const { data, error } = await supabase.from('feedback').select('*').order('created_at', { ascending: false });
    if (error) throw error;

    const headers = ['id', 'type', 'status', 'message', 'email', 'page_url', 'created_at'];
    const rows = (data || []).map(f =>
      headers.map(h => `"${String(f[h] || '').replace(/"/g, '""')}"`).join(',')
    );
    const csv = [headers.join(','), ...rows].join('\n');

    const today = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=tradvue-feedback-${today}.csv`);
    res.send(csv);
  } catch (err) {
    console.error('[Admin] /export/feedback error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/admin/email/history ─────────────────────────────────────────────
router.get('/email/history', async (req, res) => {
  try {
    const supabase = getAdminClient();
    const { data, error } = await supabase.from('sent_emails').select('*').order('created_at', { ascending: false }).limit(100);
    if (error) throw error;
    res.json({ emails: data || [], total: data?.length || 0 });
  } catch (err) {
    console.error('[Admin] /email/history error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/admin/email/send ───────────────────────────────────────────────
router.post('/email/send', async (req, res) => {
  try {
    const supabase = getAdminClient();
    const { to, subject, body } = req.body;

    if (!to || !subject || !body) {
      return res.status(400).json({ error: 'to, subject, and body are required' });
    }

    // Resolve recipients
    let toAddresses = [];
    let toSegment = typeof to === 'string' ? to : 'custom';

    if (to === 'all' || to === 'free' || to === 'pro') {
      const { data: usersData } = await supabase.auth.admin.listUsers({ perPage: 1000 });
      let users = usersData?.users || [];
      if (to !== 'all') {
        const { data: profiles } = await supabase.from('user_profiles').select('user_id, tier');
        const tierMap = {};
        (profiles || []).forEach(p => { tierMap[p.user_id] = p.tier; });
        users = users.filter(u => (tierMap[u.id] || 'free') === to);
      }
      toAddresses = users.map(u => u.email).filter(Boolean);
    } else if (Array.isArray(to)) {
      toAddresses = to;
      toSegment = 'custom';
    } else {
      toAddresses = [to];
      toSegment = 'custom';
    }

    let status = 'queued';
    let sentCount = 0;

    // Try Resend if API key is configured — send individually so recipients can't see each other
    if (process.env.RESEND_API_KEY && toAddresses.length > 0) {
      try {
        for (let idx = 0; idx < toAddresses.length; idx++) {
          if (idx > 0) await new Promise(r => setTimeout(r, 600)); // Resend rate limit: 2/sec
          const addr = toAddresses[idx];
          try {
            const response = await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                from: 'TradVue <noreply@tradvue.com>',
                to: [addr],
                subject,
                html: body.replace(/\n/g, '<br>'),
                text: body,
              }),
            });
            if (response.ok) {
              sentCount++;
              console.log(`[Admin] Email sent to ${addr}: OK`);
            } else {
              const errBody = await response.text();
              console.error(`[Admin] Resend FAILED for ${addr}: ${response.status} — ${errBody}`);
            }
          } catch (e) {
            console.error(`[Admin] Resend exception for ${addr}:`, e.message);
          }
        }
        status = sentCount > 0 ? 'sent' : 'failed';
      } catch (e) {
        console.warn('[Admin] Resend batch error:', e.message);
        status = 'failed';
      }
    } else {
      sentCount = toAddresses.length;
      status = process.env.RESEND_API_KEY ? 'sent' : 'queued';
    }

    const { error: dbErr } = await supabase.from('sent_emails').insert({
      to_segment: toSegment,
      to_addresses: toAddresses,
      subject,
      body,
      sent_count: sentCount,
      status,
      sent_by: req.user.email,
    });
    if (dbErr) console.warn('[Admin] sent_emails insert error:', dbErr.message);

    res.json({ success: true, status, sent_count: sentCount, total_recipients: toAddresses.length });
  } catch (err) {
    console.error('[Admin] /email/send error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/admin/announcements ─────────────────────────────────────────────
router.get('/announcements', async (req, res) => {
  try {
    const supabase = getAdminClient();
    const { data, error } = await supabase
      .from('announcements')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);
    if (error) throw error;
    res.json({ announcements: data || [] });
  } catch (err) {
    console.error('[Admin] GET /announcements error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/admin/announcements ────────────────────────────────────────────
router.post('/announcements', async (req, res) => {
  try {
    const supabase = getAdminClient();
    const { message, type = 'info', active = true, expiresAt } = req.body;

    if (!message) return res.status(400).json({ error: 'message is required' });
    if (!['info', 'warning', 'success'].includes(type)) {
      return res.status(400).json({ error: 'type must be info, warning, or success' });
    }

    // Deactivate previous announcements
    await supabase.from('announcements').update({ active: false }).eq('active', true);

    const { data, error } = await supabase.from('announcements').insert({
      message, type, active,
      expires_at: expiresAt || null,
      created_by: req.user.email,
    }).select().single();

    if (error) throw error;
    res.json({ announcement: data });
  } catch (err) {
    console.error('[Admin] POST /announcements error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/admin/announcements ──────────────────────────────────────────
router.delete('/announcements', async (req, res) => {
  try {
    const supabase = getAdminClient();
    const { error } = await supabase.from('announcements').update({ active: false }).eq('active', true);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    console.error('[Admin] DELETE /announcements error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/admin/abuse ──────────────────────────────────────────────────────
router.get('/abuse', async (req, res) => {
  try {
    const supabase = getAdminClient();
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // Top IPs last 24h
    const { data: recentActivity } = await supabase
      .from('activity_log')
      .select('ip_address, action, created_at')
      .gte('created_at', since24h)
      .not('ip_address', 'is', null)
      .order('created_at', { ascending: false })
      .limit(5000);

    const ipMap = {};
    (recentActivity || []).forEach(r => {
      if (!r.ip_address) return;
      if (!ipMap[r.ip_address]) {
        ipMap[r.ip_address] = { ip: r.ip_address, count: 0, last_action: r.action, last_seen: r.created_at };
      }
      ipMap[r.ip_address].count++;
    });
    const topIPs = Object.values(ipMap)
      .sort((a, b) => b.count - a.count)
      .slice(0, 50);

    // Failed login attempts (all time, most recent first)
    const { data: failedLogins } = await supabase
      .from('activity_log')
      .select('email, ip_address, created_at, details')
      .eq('action', 'login_failed')
      .order('created_at', { ascending: false })
      .limit(100);

    res.json({
      top_ips: topIPs,
      failed_logins: failedLogins || [],
      high_traffic_threshold: 100,
    });
  } catch (err) {
    console.error('[Admin] /abuse error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/admin/health ─────────────────────────────────────────────────────
router.get('/health', async (req, res) => {
  const startTime = Date.now();
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
      status: 'ok', uptime: process.uptime(),
      uptimeFormatted: formatUptime(process.uptime()),
      responseMs: Date.now() - startTime,
      nodeVersion: process.version,
      env: process.env.NODE_ENV || 'development',
    },
    database: {
      status: dbStatus, latencyMs: dbLatencyMs,
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
