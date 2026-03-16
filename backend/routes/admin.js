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


// ── SECURITY DASHBOARD ENDPOINTS ─────────────────────────────────────────────
// All inherit requireAuth + requireAdmin from router.use() at the top.

const path = require('path');
const fs = require('fs');

function getSecurityStatus() {
  try {
    const statusPath = path.join(__dirname, '../docs/security/security-status.json');
    const raw = fs.readFileSync(statusPath, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    console.warn('[Admin] security-status.json not found or invalid:', e.message);
    return {
      lastPenTest: null,
      penTestScore: 'N/A',
      lastSecurityAudit: null,
      auditStatus: 'UNKNOWN',
      sslExpiry: null,
      rlsTables: 0,
      rlsProtected: 0,
    };
  }
}

// ── GET /api/admin/security/overview ─────────────────────────────────────────
router.get('/security/overview', async (req, res) => {
  try {
    const supabase = getAdminClient();
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const since7d  = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // Failed logins 24h
    const { count: failedLogins24h } = await supabase
      .from('activity_log')
      .select('*', { count: 'exact', head: true })
      .eq('action', 'login_failed')
      .gte('created_at', since24h);

    // Failed logins 7d
    const { count: failedLogins7d } = await supabase
      .from('activity_log')
      .select('*', { count: 'exact', head: true })
      .eq('action', 'login_failed')
      .gte('created_at', since7d);

    // Unique attacker IPs (24h, 3+ failed attempts)
    const { data: failedIPData } = await supabase
      .from('activity_log')
      .select('ip_address')
      .eq('action', 'login_failed')
      .gte('created_at', since24h)
      .not('ip_address', 'is', null);

    const ipCounts = {};
    (failedIPData || []).forEach(r => {
      ipCounts[r.ip_address] = (ipCounts[r.ip_address] || 0) + 1;
    });
    const uniqueAttackerIPs24h = Object.values(ipCounts).filter(c => c >= 3).length;

    // Successful logins 24h
    const { count: successfulLogins24h } = await supabase
      .from('activity_log')
      .select('*', { count: 'exact', head: true })
      .eq('action', 'login')
      .gte('created_at', since24h);

    // Total API requests 24h
    const { count: totalAPIRequests24h } = await supabase
      .from('activity_log')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', since24h);

    // Active users 24h (distinct user_ids who logged in)
    const { data: activeUserData } = await supabase
      .from('activity_log')
      .select('user_id')
      .eq('action', 'login')
      .gte('created_at', since24h)
      .not('user_id', 'is', null);

    const activeUsers24h = new Set((activeUserData || []).map(r => r.user_id)).size;

    // Rate limit hits 24h (from activity_log action = 'rate_limit_hit' if logged)
    const { count: rateLimitHits24h } = await supabase
      .from('activity_log')
      .select('*', { count: 'exact', head: true })
      .eq('action', 'rate_limit_hit')
      .gte('created_at', since24h);

    // Security status from JSON file
    const secStatus = getSecurityStatus();

    // SSL expiry days
    let sslDaysLeft = null;
    if (secStatus.sslExpiry) {
      sslDaysLeft = Math.ceil((new Date(secStatus.sslExpiry) - new Date()) / (1000 * 60 * 60 * 24));
    }

    res.json({
      failedLogins24h:       failedLogins24h || 0,
      failedLogins7d:        failedLogins7d || 0,
      uniqueAttackerIPs24h:  uniqueAttackerIPs24h,
      successfulLogins24h:   successfulLogins24h || 0,
      totalAPIRequests24h:   totalAPIRequests24h || 0,
      rlsTablesCount:        secStatus.rlsTables || 0,
      rlsTablesProtected:    secStatus.rlsProtected || 0,
      lastSecurityAudit:     secStatus.lastSecurityAudit,
      lastPenTest:           secStatus.lastPenTest,
      penTestScore:          secStatus.penTestScore,
      penTestFindings:       secStatus.penTestFindings || null,
      sslExpiry:             secStatus.sslExpiry,
      sslDaysLeft:           sslDaysLeft,
      activeUsers24h:        activeUsers24h,
      rateLimitHits24h:      rateLimitHits24h || 0,
      cloudflareEnabled:     secStatus.cloudflareEnabled || false,
      wafEnabled:            secStatus.wafEnabled || false,
      auditStatus:           secStatus.auditStatus || 'UNKNOWN',
    });
  } catch (err) {
    console.error('[Admin] /security/overview error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/admin/security/failed-logins ────────────────────────────────────
router.get('/security/failed-logins', async (req, res) => {
  try {
    const supabase = getAdminClient();
    const { data, error } = await supabase
      .from('activity_log')
      .select('ip_address, email, created_at, details')
      .eq('action', 'login_failed')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw error;

    const result = (data || []).map(r => ({
      ip_address: r.ip_address || null,
      email:      r.email || null,
      created_at: r.created_at,
      user_agent: r.details?.user_agent || null,
    }));

    res.json({ failed_logins: result, total: result.length });
  } catch (err) {
    console.error('[Admin] /security/failed-logins error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/admin/security/active-sessions ──────────────────────────────────
router.get('/security/active-sessions', async (req, res) => {
  try {
    const supabase = getAdminClient();
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from('activity_log')
      .select('user_id, email, ip_address, created_at, details')
      .eq('action', 'login')
      .gte('created_at', since24h)
      .order('created_at', { ascending: false })
      .limit(500);

    if (error) throw error;

    // DISTINCT ON user_id: keep the most recent login per user
    const seen = new Set();
    const sessions = [];
    for (const row of (data || [])) {
      const uid = row.user_id || row.email;
      if (!seen.has(uid)) {
        seen.add(uid);
        sessions.push({
          user_id:    row.user_id || null,
          email:      row.email || null,
          ip_address: row.ip_address || null,
          last_seen:  row.created_at,
          user_agent: row.details?.user_agent || null,
        });
      }
    }

    res.json({ active_sessions: sessions, total: sessions.length });
  } catch (err) {
    console.error('[Admin] /security/active-sessions error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/admin/security/ip-threats ───────────────────────────────────────
router.get('/security/ip-threats', async (req, res) => {
  try {
    const supabase = getAdminClient();
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from('activity_log')
      .select('ip_address, email, created_at')
      .eq('action', 'login_failed')
      .gte('created_at', since24h)
      .not('ip_address', 'is', null)
      .order('created_at', { ascending: false })
      .limit(5000);

    if (error) throw error;

    // Group by IP
    const ipMap = {};
    (data || []).forEach(r => {
      const ip = r.ip_address;
      if (!ipMap[ip]) {
        ipMap[ip] = { ip_address: ip, attempts: 0, targeted_emails: new Set(), last_attempt: r.created_at };
      }
      ipMap[ip].attempts++;
      if (r.email) ipMap[ip].targeted_emails.add(r.email);
      if (r.created_at > ipMap[ip].last_attempt) ipMap[ip].last_attempt = r.created_at;
    });

    const threats = Object.values(ipMap)
      .filter(t => t.attempts >= 3)
      .map(t => ({ ...t, targeted_emails: Array.from(t.targeted_emails) }))
      .sort((a, b) => b.attempts - a.attempts);

    res.json({ ip_threats: threats, total: threats.length });
  } catch (err) {
    console.error('[Admin] /security/ip-threats error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/admin/security/activity-feed ────────────────────────────────────
router.get('/security/activity-feed', async (req, res) => {
  try {
    const supabase = getAdminClient();
    const SECURITY_ACTIONS = ['login', 'login_failed', 'signup', 'password_reset', 'account_deleted'];

    const { data, error } = await supabase
      .from('activity_log')
      .select('id, action, email, ip_address, created_at, details')
      .in('action', SECURITY_ACTIONS)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    res.json({ activity_feed: data || [], total: data?.length || 0 });
  } catch (err) {
    console.error('[Admin] /security/activity-feed error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/admin/security/reports ──────────────────────────────────────────
router.get('/security/reports', async (req, res) => {
  try {
    const secDir = path.join(__dirname, '../docs/security');
    const files = fs.readdirSync(secDir).filter(f => f.endsWith('.md'));
    const reports = [];

    for (const filename of files) {
      let type = 'other';
      let date = null;
      let score = null;
      let findings = null;
      let status = null;

      // Parse filename patterns
      const penTestMatch = filename.match(/^PEN_TEST_REPORT_(\d{4}-\d{2}-\d{2})\.md$/i);
      const auditMatch = filename.match(/^(?:WEEKLY_AUDIT|MONTHLY_AUDIT|SECURITY_AUDIT)_(\d{4}-\d{2}-\d{2})\.md$/i);
      const deepReviewMatch = filename.match(/^DEEP_REVIEW_(\d{4}-\d{2}-\d{2})\.md$/i);

      if (penTestMatch) {
        type = 'pen_test';
        date = penTestMatch[1];
        // Try to extract score from file content
        try {
          const content = fs.readFileSync(path.join(secDir, filename), 'utf8');
          const scoreMatch = content.match(/\*\*?(?:Overall\s+)?(?:Security\s+)?Score[:\s]+(\d+(?:\.\d+)?)\s*\/\s*10/i)
            || content.match(/Score:\s*(\d+(?:\.\d+)?)\s*\/\s*10/i)
            || content.match(/(\d+(?:\.\d+)?)\s*\/\s*10/);
          if (scoreMatch) score = parseFloat(scoreMatch[1]) + '/10';

          // Extract findings
          const critMatch = content.match(/CRITICAL[^\d]*(\d+)/i);
          const highMatch = content.match(/HIGH[^\d]*(\d+)/i);
          const medMatch = content.match(/MEDIUM[^\d]*(\d+)/i);
          const lowMatch = content.match(/LOW[^\d]*(\d+)/i);
          const infoMatch = content.match(/INFORMATIONAL[^\d]*(\d+)/i) || content.match(/INFO[^\d]*(\d+)/i);
          findings = {
            critical: critMatch ? parseInt(critMatch[1]) : 0,
            high: highMatch ? parseInt(highMatch[1]) : 0,
            medium: medMatch ? parseInt(medMatch[1]) : 0,
            low: lowMatch ? parseInt(lowMatch[1]) : 0,
            info: infoMatch ? parseInt(infoMatch[1]) : 0,
          };
        } catch (e) { /* ignore */ }
      } else if (auditMatch) {
        type = 'weekly_audit';
        date = auditMatch[1];
        status = 'PASS';
      } else if (deepReviewMatch) {
        type = 'deep_review';
        date = deepReviewMatch[1];
        status = 'PASS';
      } else {
        // Try to get date from any pattern
        const anyDate = filename.match(/(\d{4}-\d{2}-\d{2})/);
        if (anyDate) date = anyDate[1];
      }

      const fileStat = fs.statSync(path.join(secDir, filename));
      reports.push({
        filename,
        type,
        date: date || fileStat.mtime.toISOString().slice(0, 10),
        score,
        findings,
        status,
        lastModified: fileStat.mtime.toISOString(),
      });
    }

    // Sort newest first
    reports.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    res.json({ reports });
  } catch (err) {
    console.error('[Admin] /security/reports error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/admin/security/reports/:filename ─────────────────────────────────
router.get('/security/reports/:filename', async (req, res) => {
  try {
    const { filename } = req.params;

    // Security: reject path traversal attempts
    if (!filename || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return res.status(400).json({ error: 'Invalid filename' });
    }
    if (!filename.endsWith('.md')) {
      return res.status(400).json({ error: 'Only .md files are accessible' });
    }

    const secDir = path.join(__dirname, '../docs/security');
    const filePath = path.join(secDir, filename);

    // Double check resolved path stays within secDir
    if (!filePath.startsWith(secDir + path.sep) && filePath !== secDir) {
      return res.status(400).json({ error: 'Invalid filename' });
    }

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Report not found' });
    }

    const content = fs.readFileSync(filePath, 'utf8');
    const stat = fs.statSync(filePath);

    res.json({ filename, content, lastModified: stat.mtime.toISOString() });
  } catch (err) {
    console.error('[Admin] /security/reports/:filename error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/admin/security/score-history ────────────────────────────────────
router.get('/security/score-history', async (req, res) => {
  try {
    const histPath = path.join(__dirname, '../docs/security/score-history.json');
    if (!fs.existsSync(histPath)) return res.json({ history: [] });
    const data = JSON.parse(fs.readFileSync(histPath, 'utf8'));
    res.json({ history: data });
  } catch (err) {
    console.error('[Admin] /security/score-history error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/admin/security/alert-history ────────────────────────────────────
router.get('/security/alert-history', async (req, res) => {
  try {
    const alertPath = path.join(__dirname, '../docs/security/alert-history.json');
    if (!fs.existsSync(alertPath)) return res.json({ alerts: [] });
    const data = JSON.parse(fs.readFileSync(alertPath, 'utf8'));
    // Sort newest first, limit to 200
    const sorted = [...data].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 200);
    res.json({ alerts: sorted });
  } catch (err) {
    console.error('[Admin] /security/alert-history error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/admin/security/alert-history ───────────────────────────────────
router.post('/security/alert-history', async (req, res) => {
  try {
    const { type, result, details } = req.body;
    if (!type || !result) return res.status(400).json({ error: 'type and result are required' });

    const alertPath = path.join(__dirname, '../docs/security/alert-history.json');
    let data = [];
    if (fs.existsSync(alertPath)) {
      try { data = JSON.parse(fs.readFileSync(alertPath, 'utf8')); } catch (e) { data = []; }
    }

    const newEntry = { date: new Date().toISOString(), type, result, details: details || '' };
    data.unshift(newEntry);
    // Keep last 1000 entries
    if (data.length > 1000) data = data.slice(0, 1000);

    fs.writeFileSync(alertPath, JSON.stringify(data, null, 2), 'utf8');
    res.json({ ok: true, entry: newEntry });
  } catch (err) {
    console.error('[Admin] POST /security/alert-history error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/admin/security/export/:type ─────────────────────────────────────
router.get('/security/export/:type', async (req, res) => {
  try {
    const { type } = req.params;
    const secDir = path.join(__dirname, '../docs/security');

    // Helper: sanitize a single CSV field (prevent formula injection)
    function csvField(val) {
      const s = String(val == null ? '' : val).replace(/"/g, '""');
      // Strip leading = + - @ | % to prevent formula injection
      const dangerous = s.replace(/^[\s]*[=+\-@|%]/, "'$&");
      return `"${dangerous}"`;
    }

    if (type === 'pen-test-latest' || type === 'audit-latest') {
      // Find latest matching report
      const files = fs.readdirSync(secDir).filter(f => f.endsWith('.md'));
      let pattern;
      if (type === 'pen-test-latest') pattern = /^PEN_TEST_REPORT_/i;
      else pattern = /^(?:WEEKLY_AUDIT|MONTHLY_AUDIT|SECURITY_AUDIT|DEEP_REVIEW)_/i;

      const matching = files.filter(f => pattern.test(f)).sort().reverse();
      if (matching.length === 0) return res.status(404).json({ error: 'No report found' });

      const filename = matching[0];
      const content = fs.readFileSync(path.join(secDir, filename), 'utf8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      return res.send(content);
    }

    if (type === 'failed-logins-csv') {
      const supabase = getAdminClient();
      const { data, error } = await supabase
        .from('activity_log')
        .select('ip_address, email, created_at, details')
        .eq('action', 'login_failed')
        .order('created_at', { ascending: false })
        .limit(5000);
      if (error) throw error;

      const rows = (data || []).map(r => [
        csvField(r.created_at),
        csvField(r.ip_address),
        csvField(r.email),
        csvField(r.details?.user_agent),
      ].join(','));

      const csv = ['Timestamp,IP Address,Email,User Agent', ...rows].join('\n');
      res.setHeader('Content-Disposition', 'attachment; filename="failed-logins.csv"');
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      return res.send(csv);
    }

    if (type === 'activity-csv') {
      const supabase = getAdminClient();
      const SECURITY_ACTIONS = ['login', 'login_failed', 'signup', 'password_reset', 'account_deleted', 'rate_limit_hit'];
      const { data, error } = await supabase
        .from('activity_log')
        .select('id, action, email, ip_address, created_at')
        .in('action', SECURITY_ACTIONS)
        .order('created_at', { ascending: false })
        .limit(5000);
      if (error) throw error;

      const rows = (data || []).map(r => [
        csvField(r.created_at),
        csvField(r.action),
        csvField(r.email),
        csvField(r.ip_address),
        csvField(r.id),
      ].join(','));

      const csv = ['Timestamp,Action,Email,IP Address,Event ID', ...rows].join('\n');
      res.setHeader('Content-Disposition', 'attachment; filename="security-activity.csv"');
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      return res.send(csv);
    }

    res.status(400).json({ error: `Unknown export type: ${type}` });
  } catch (err) {
    console.error('[Admin] /security/export error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
