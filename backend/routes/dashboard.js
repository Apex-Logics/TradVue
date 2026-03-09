/**
 * Dashboard Routes — Supabase-backed
 *
 * Persists the CEO dashboard data that previously lived in localStorage.
 * All routes require JWT authentication.
 *
 * Tasks
 *   GET    /api/dashboard/tasks          — List user's tasks
 *   POST   /api/dashboard/tasks          — Create a task (auto-logs activity)
 *   PUT    /api/dashboard/tasks/:id      — Update a task (auto-logs on completion)
 *   DELETE /api/dashboard/tasks/:id      — Delete a task
 *   POST   /api/dashboard/tasks/sync     — Bulk upsert (localStorage migration)
 *
 * Activity
 *   GET    /api/dashboard/activity       — List activity (newest first, max 100)
 *   POST   /api/dashboard/activity       — Create activity entry
 *
 * Companies
 *   GET    /api/dashboard/companies      — List companies with projects
 *   POST   /api/dashboard/companies      — Create a company
 *   PUT    /api/dashboard/companies/:id  — Update a company
 *   DELETE /api/dashboard/companies/:id  — Delete a company (cascades projects)
 *   POST   /api/dashboard/companies/:id/projects — Add project to company
 *   DELETE /api/dashboard/companies/:companyId/projects/:projectId — Remove project
 *
 * Settings
 *   GET    /api/dashboard/settings       — Get dashboard settings
 *   POST   /api/dashboard/settings       — Upsert dashboard settings
 *
 * Agents
 *   GET    /api/dashboard/agents         — List agents (auto-seeds defaults)
 *   PUT    /api/dashboard/agents/:name   — Update agent status/task/tokens
 *
 * Notifications
 *   GET    /api/dashboard/notifications  — List notifications (?unread=true)
 *   POST   /api/dashboard/notifications  — Create a notification
 *   PUT    /api/dashboard/notifications/:id/read — Mark single as read
 *   PUT    /api/dashboard/notifications/read-all — Mark all as read
 *   DELETE /api/dashboard/notifications/:id — Delete a notification
 *
 * Stats
 *   GET    /api/dashboard/stats          — Real counts (tasks, completed today, agents, notifs)
 */

const express = require('express');
const router = express.Router();
const db = require('../services/db');
const { authenticateToken } = require('./auth');

// All dashboard routes require auth
router.use(authenticateToken);

// ═══════════════════════════════════════════════════════════════════════════════
// TASKS
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/tasks', async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT id, title, description, status, project, company, agent, priority,
              due_date AS "dueDate", created_at AS "createdAt",
              completed_at AS "completedAt", notes
       FROM dashboard_tasks
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [req.user.userId]
    );
    res.json({ tasks: rows });
  } catch (e) {
    console.error('[Dashboard] GET tasks error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

router.post('/tasks', async (req, res) => {
  try {
    const { id, title, description, status, project, company, agent, priority, dueDate, createdAt, completedAt, notes } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'title is required' });
    }

    const taskId = id || (Math.random().toString(36).slice(2) + Date.now().toString(36));

    const { rows } = await db.query(
      `INSERT INTO dashboard_tasks
         (id, user_id, title, description, status, project, company, agent, priority, due_date, created_at, completed_at, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING id, title, description, status, project, company, agent, priority,
                 due_date AS "dueDate", created_at AS "createdAt",
                 completed_at AS "completedAt", notes`,
      [
        taskId, req.user.userId, title, description || '', status || 'todo',
        project || '', company || '', agent || '', priority || 'medium',
        dueDate || '', createdAt || new Date().toISOString(), completedAt || '', notes || ''
      ]
    );

    // Auto-log activity for task creation
    const activityId = Math.random().toString(36).slice(2) + Date.now().toString(36);
    const activityType = (status || 'todo') === 'done' ? 'task_complete' : 'task_start';
    const activityMsg = (status || 'todo') === 'done'
      ? `${agent || 'Someone'} completed: ${title}`
      : `Task created: ${title}`;
    db.query(
      `INSERT INTO dashboard_activity (id, user_id, type, message, agent, project, timestamp)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [activityId, req.user.userId, activityType, activityMsg, agent || '', project || '', new Date().toISOString()]
    ).catch(() => {}); // fire-and-forget

    res.json({ task: rows[0] });
  } catch (e) {
    console.error('[Dashboard] POST task error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

router.put('/tasks/:id', async (req, res) => {
  try {
    const { title, description, status, project, company, agent, priority, dueDate, completedAt, notes } = req.body;

    const { rows, rowCount } = await db.query(
      `UPDATE dashboard_tasks SET
         title = COALESCE($3, title),
         description = COALESCE($4, description),
         status = COALESCE($5, status),
         project = COALESCE($6, project),
         company = COALESCE($7, company),
         agent = COALESCE($8, agent),
         priority = COALESCE($9, priority),
         due_date = COALESCE($10, due_date),
         completed_at = COALESCE($11, completed_at),
         notes = COALESCE($12, notes),
         updated_at = NOW()
       WHERE id = $1 AND user_id = $2
       RETURNING id, title, description, status, project, company, agent, priority,
                 due_date AS "dueDate", created_at AS "createdAt",
                 completed_at AS "completedAt", notes`,
      [
        req.params.id, req.user.userId, title, description, status,
        project, company, agent, priority, dueDate, completedAt, notes
      ]
    );

    if (rowCount === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Auto-log activity when task is completed
    if (status === 'done') {
      const activityId = Math.random().toString(36).slice(2) + Date.now().toString(36);
      const taskRow = rows[0];
      db.query(
        `INSERT INTO dashboard_activity (id, user_id, type, message, agent, project, timestamp)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [activityId, req.user.userId, 'task_complete',
         `${taskRow.agent || 'Someone'} completed: ${taskRow.title}`,
         taskRow.agent || '', taskRow.project || '', new Date().toISOString()]
      ).catch(() => {});
    }

    res.json({ task: rows[0] });
  } catch (e) {
    console.error('[Dashboard] PUT task error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

router.delete('/tasks/:id', async (req, res) => {
  try {
    const { rowCount } = await db.query(
      `DELETE FROM dashboard_tasks WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.userId]
    );
    if (rowCount === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }
    res.json({ ok: true });
  } catch (e) {
    console.error('[Dashboard] DELETE task error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

// Bulk sync — import from localStorage on first login
router.post('/tasks/sync', async (req, res) => {
  try {
    const { tasks = [] } = req.body;
    let imported = 0;

    for (const t of tasks) {
      if (!t.id || !t.title) continue;
      await db.query(
        `INSERT INTO dashboard_tasks
           (id, user_id, title, description, status, project, company, agent, priority, due_date, created_at, completed_at, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
         ON CONFLICT (id) DO NOTHING`,
        [
          t.id, req.user.userId, t.title, t.description || '', t.status || 'todo',
          t.project || '', t.company || '', t.agent || '', t.priority || 'medium',
          t.dueDate || '', t.createdAt || new Date().toISOString(), t.completedAt || '', t.notes || ''
        ]
      );
      imported++;
    }

    res.json({ ok: true, imported });
  } catch (e) {
    console.error('[Dashboard] POST tasks/sync error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// ACTIVITY
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/activity', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const { rows } = await db.query(
      `SELECT id, type, message, agent, project, timestamp
       FROM dashboard_activity
       WHERE user_id = $1
       ORDER BY timestamp DESC
       LIMIT $2`,
      [req.user.userId, limit]
    );
    res.json({ activity: rows });
  } catch (e) {
    console.error('[Dashboard] GET activity error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

router.post('/activity', async (req, res) => {
  try {
    const { id, type, message, agent, project, timestamp } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'message is required' });
    }

    const activityId = id || (Math.random().toString(36).slice(2) + Date.now().toString(36));

    const { rows } = await db.query(
      `INSERT INTO dashboard_activity (id, user_id, type, message, agent, project, timestamp)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING id, type, message, agent, project, timestamp`,
      [activityId, req.user.userId, type || 'update', message, agent || '', project || '', timestamp || new Date().toISOString()]
    );
    res.json({ activity: rows[0] });
  } catch (e) {
    console.error('[Dashboard] POST activity error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// COMPANIES
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/companies', async (req, res) => {
  try {
    const { rows: companies } = await db.query(
      `SELECT id, name FROM dashboard_companies WHERE user_id = $1 ORDER BY created_at ASC`,
      [req.user.userId]
    );

    // Fetch projects for each company
    const result = [];
    for (const c of companies) {
      const { rows: projects } = await db.query(
        `SELECT id, name, category FROM dashboard_projects WHERE company_id = $1 ORDER BY name`,
        [c.id]
      );
      result.push({ ...c, projects });
    }

    res.json({ companies: result });
  } catch (e) {
    console.error('[Dashboard] GET companies error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

router.post('/companies', async (req, res) => {
  try {
    const { id, name, projects } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'name is required' });
    }

    const companyId = id || (Math.random().toString(36).slice(2) + Date.now().toString(36));

    await db.query(
      `INSERT INTO dashboard_companies (id, user_id, name) VALUES ($1,$2,$3)
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name`,
      [companyId, req.user.userId, name]
    );

    // Upsert projects if provided
    if (projects && Array.isArray(projects)) {
      for (const p of projects) {
        const projId = p.id || (Math.random().toString(36).slice(2) + Date.now().toString(36));
        await db.query(
          `INSERT INTO dashboard_projects (id, company_id, user_id, name, category)
           VALUES ($1,$2,$3,$4,$5)
           ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category = EXCLUDED.category`,
          [projId, companyId, req.user.userId, p.name, p.category || '']
        );
      }
    }

    // Return the company with its projects
    const { rows: projRows } = await db.query(
      `SELECT id, name, category FROM dashboard_projects WHERE company_id = $1`,
      [companyId]
    );

    res.json({ company: { id: companyId, name, projects: projRows } });
  } catch (e) {
    console.error('[Dashboard] POST company error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

router.put('/companies/:id', async (req, res) => {
  try {
    const { name } = req.body;
    const { rowCount } = await db.query(
      `UPDATE dashboard_companies SET name = $3 WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.userId, name]
    );
    if (rowCount === 0) {
      return res.status(404).json({ error: 'Company not found' });
    }
    res.json({ ok: true });
  } catch (e) {
    console.error('[Dashboard] PUT company error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

router.delete('/companies/:id', async (req, res) => {
  try {
    const { rowCount } = await db.query(
      `DELETE FROM dashboard_companies WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.userId]
    );
    if (rowCount === 0) {
      return res.status(404).json({ error: 'Company not found' });
    }
    res.json({ ok: true });
  } catch (e) {
    console.error('[Dashboard] DELETE company error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

// Project management within a company
router.post('/companies/:id/projects', async (req, res) => {
  try {
    const { id: projId, name, category } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });

    // Verify company belongs to user
    const { rowCount } = await db.query(
      `SELECT 1 FROM dashboard_companies WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.userId]
    );
    if (rowCount === 0) return res.status(404).json({ error: 'Company not found' });

    const projectId = projId || (Math.random().toString(36).slice(2) + Date.now().toString(36));
    const { rows } = await db.query(
      `INSERT INTO dashboard_projects (id, company_id, user_id, name, category)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category = EXCLUDED.category
       RETURNING id, name, category`,
      [projectId, req.params.id, req.user.userId, name, category || '']
    );
    res.json({ project: rows[0] });
  } catch (e) {
    console.error('[Dashboard] POST project error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

router.delete('/companies/:companyId/projects/:projectId', async (req, res) => {
  try {
    const { rowCount } = await db.query(
      `DELETE FROM dashboard_projects WHERE id = $1 AND user_id = $2`,
      [req.params.projectId, req.user.userId]
    );
    if (rowCount === 0) return res.status(404).json({ error: 'Project not found' });
    res.json({ ok: true });
  } catch (e) {
    console.error('[Dashboard] DELETE project error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// SETTINGS
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/settings', async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT settings FROM dashboard_settings WHERE user_id = $1`,
      [req.user.userId]
    );
    res.json({ settings: rows[0]?.settings || {} });
  } catch (e) {
    // Table may not exist yet — return empty
    res.json({ settings: {} });
  }
});

router.post('/settings', async (req, res) => {
  try {
    const { settings } = req.body;
    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ error: 'settings object required' });
    }
    await db.query(
      `INSERT INTO dashboard_settings (user_id, settings)
       VALUES ($1, $2)
       ON CONFLICT (user_id)
       DO UPDATE SET settings = $2, updated_at = NOW()`,
      [req.user.userId, JSON.stringify(settings)]
    );
    res.json({ ok: true });
  } catch (e) {
    console.warn('[Dashboard] settings persist error:', e.message);
    res.json({ ok: true, warn: 'settings not persisted' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// FULL SYNC (import all localStorage data at once)
// ═══════════════════════════════════════════════════════════════════════════════

router.post('/sync', async (req, res) => {
  try {
    const { tasks = [], activity = [], companies = [], settings } = req.body;
    const userId = req.user.userId;
    const results = { tasks: 0, activity: 0, companies: 0, projects: 0, settings: false };

    // Sync tasks
    for (const t of tasks) {
      if (!t.id || !t.title) continue;
      await db.query(
        `INSERT INTO dashboard_tasks
           (id, user_id, title, description, status, project, company, agent, priority, due_date, created_at, completed_at, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
         ON CONFLICT (id) DO NOTHING`,
        [
          t.id, userId, t.title, t.description || '', t.status || 'todo',
          t.project || '', t.company || '', t.agent || '', t.priority || 'medium',
          t.dueDate || '', t.createdAt || new Date().toISOString(), t.completedAt || '', t.notes || ''
        ]
      );
      results.tasks++;
    }

    // Sync activity
    for (const a of activity) {
      if (!a.id || !a.message) continue;
      await db.query(
        `INSERT INTO dashboard_activity (id, user_id, type, message, agent, project, timestamp)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (id) DO NOTHING`,
        [a.id, userId, a.type || 'update', a.message, a.agent || '', a.project || '', a.timestamp || new Date().toISOString()]
      );
      results.activity++;
    }

    // Sync companies + projects
    for (const c of companies) {
      if (!c.id || !c.name) continue;
      await db.query(
        `INSERT INTO dashboard_companies (id, user_id, name) VALUES ($1,$2,$3)
         ON CONFLICT (id) DO NOTHING`,
        [c.id, userId, c.name]
      );
      results.companies++;

      for (const p of (c.projects || [])) {
        if (!p.id || !p.name) continue;
        await db.query(
          `INSERT INTO dashboard_projects (id, company_id, user_id, name, category)
           VALUES ($1,$2,$3,$4,$5)
           ON CONFLICT (id) DO NOTHING`,
          [p.id, c.id, userId, p.name, p.category || '']
        );
        results.projects++;
      }
    }

    // Sync settings
    if (settings && typeof settings === 'object') {
      await db.query(
        `INSERT INTO dashboard_settings (user_id, settings)
         VALUES ($1, $2)
         ON CONFLICT (user_id) DO UPDATE SET settings = $2, updated_at = NOW()`,
        [userId, JSON.stringify(settings)]
      );
      results.settings = true;
    }

    res.json({ ok: true, imported: results });
  } catch (e) {
    console.error('[Dashboard] POST sync error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// AGENTS
// ═══════════════════════════════════════════════════════════════════════════════

// Default agent definitions — seeded on first GET if no rows exist
const DEFAULT_AGENTS = [
  { id: 'agent-axle', name: 'Axle', role: 'CEO / Orchestrator', status: 'online' },
  { id: 'agent-bolt', name: 'Bolt', role: 'Developer', status: 'online' },
  { id: 'agent-zip', name: 'Zip', role: 'Quick Tasks', status: 'offline' },
];

router.get('/agents', async (req, res) => {
  try {
    const { rows, rowCount } = await db.query(
      `SELECT id, name, role, status, last_active AS "lastActive",
              current_task AS "currentTask",
              tasks_completed_today AS "tasksCompletedToday",
              tokens_used_today AS "tokensUsedToday"
       FROM dashboard_agents
       WHERE user_id = $1
       ORDER BY name`,
      [req.user.userId]
    );

    // Seed defaults on first access
    if (rowCount === 0) {
      const seeded = [];
      for (const a of DEFAULT_AGENTS) {
        const { rows: inserted } = await db.query(
          `INSERT INTO dashboard_agents (id, user_id, name, role, status)
           VALUES ($1,$2,$3,$4,$5)
           ON CONFLICT (id) DO NOTHING
           RETURNING id, name, role, status, last_active AS "lastActive",
                     current_task AS "currentTask",
                     tasks_completed_today AS "tasksCompletedToday",
                     tokens_used_today AS "tokensUsedToday"`,
          [a.id, req.user.userId, a.name, a.role, a.status]
        );
        if (inserted[0]) seeded.push(inserted[0]);
      }
      return res.json({ agents: seeded });
    }

    res.json({ agents: rows });
  } catch (e) {
    console.error('[Dashboard] GET agents error:', e.message);
    // Return static fallback if table doesn't exist yet
    res.json({ agents: DEFAULT_AGENTS.map(a => ({
      ...a, lastActive: new Date().toISOString(), currentTask: '',
      tasksCompletedToday: 0, tokensUsedToday: 0,
    })) });
  }
});

router.put('/agents/:name', async (req, res) => {
  try {
    const { status, currentTask, tasksCompletedToday, tokensUsedToday } = req.body;
    const agentName = req.params.name;

    const { rows, rowCount } = await db.query(
      `UPDATE dashboard_agents SET
         status = COALESCE($3, status),
         current_task = COALESCE($4, current_task),
         tasks_completed_today = COALESCE($5, tasks_completed_today),
         tokens_used_today = COALESCE($6, tokens_used_today),
         last_active = NOW(),
         updated_at = NOW()
       WHERE user_id = $1 AND name = $2
       RETURNING id, name, role, status, last_active AS "lastActive",
                 current_task AS "currentTask",
                 tasks_completed_today AS "tasksCompletedToday",
                 tokens_used_today AS "tokensUsedToday"`,
      [req.user.userId, agentName, status, currentTask, tasksCompletedToday, tokensUsedToday]
    );

    if (rowCount === 0) {
      return res.status(404).json({ error: 'Agent not found' });
    }
    res.json({ agent: rows[0] });
  } catch (e) {
    console.error('[Dashboard] PUT agent error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/notifications', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const unreadOnly = req.query.unread === 'true';
    const whereClause = unreadOnly ? 'AND read = FALSE' : '';

    const { rows } = await db.query(
      `SELECT id, type, title, message, read, created_at AS "createdAt"
       FROM dashboard_notifications
       WHERE user_id = $1 ${whereClause}
       ORDER BY created_at DESC
       LIMIT $2`,
      [req.user.userId, limit]
    );

    // Also return unread count
    const { rows: countRows } = await db.query(
      `SELECT COUNT(*) AS count FROM dashboard_notifications
       WHERE user_id = $1 AND read = FALSE`,
      [req.user.userId]
    );

    res.json({ notifications: rows, unreadCount: parseInt(countRows[0]?.count || '0') });
  } catch (e) {
    console.error('[Dashboard] GET notifications error:', e.message);
    res.json({ notifications: [], unreadCount: 0 });
  }
});

router.post('/notifications', async (req, res) => {
  try {
    const { id, type, title, message } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'title is required' });
    }

    const notifId = id || (Math.random().toString(36).slice(2) + Date.now().toString(36));

    const { rows } = await db.query(
      `INSERT INTO dashboard_notifications (id, user_id, type, title, message)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING id, type, title, message, read, created_at AS "createdAt"`,
      [notifId, req.user.userId, type || 'info', title, message || '']
    );
    res.json({ notification: rows[0] });
  } catch (e) {
    console.error('[Dashboard] POST notification error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

router.put('/notifications/:id/read', async (req, res) => {
  try {
    const { rowCount } = await db.query(
      `UPDATE dashboard_notifications SET read = TRUE
       WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.userId]
    );
    if (rowCount === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    res.json({ ok: true });
  } catch (e) {
    console.error('[Dashboard] PUT notification read error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

router.put('/notifications/read-all', async (req, res) => {
  try {
    await db.query(
      `UPDATE dashboard_notifications SET read = TRUE WHERE user_id = $1`,
      [req.user.userId]
    );
    res.json({ ok: true });
  } catch (e) {
    console.error('[Dashboard] PUT notifications read-all error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

router.delete('/notifications/:id', async (req, res) => {
  try {
    const { rowCount } = await db.query(
      `DELETE FROM dashboard_notifications WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.userId]
    );
    if (rowCount === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    res.json({ ok: true });
  } catch (e) {
    console.error('[Dashboard] DELETE notification error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// DASHBOARD STATS (real counts from DB)
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/stats', async (req, res) => {
  try {
    const userId = req.user.userId;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [totalRes, completedTodayRes, agentsRes, notifRes] = await Promise.all([
      db.query(
        `SELECT COUNT(*) AS count FROM dashboard_tasks WHERE user_id = $1`,
        [userId]
      ),
      db.query(
        `SELECT COUNT(*) AS count FROM dashboard_tasks
         WHERE user_id = $1 AND status = 'done'
         AND completed_at != '' AND completed_at >= $2`,
        [userId, todayStart.toISOString()]
      ),
      db.query(
        `SELECT COUNT(*) AS count FROM dashboard_agents
         WHERE user_id = $1 AND status IN ('online', 'busy')`,
        [userId]
      ),
      db.query(
        `SELECT COUNT(*) AS count FROM dashboard_notifications
         WHERE user_id = $1 AND read = FALSE`,
        [userId]
      ),
    ]);

    res.json({
      stats: {
        totalTasks: parseInt(totalRes.rows[0]?.count || '0'),
        completedToday: parseInt(completedTodayRes.rows[0]?.count || '0'),
        activeAgents: parseInt(agentsRes.rows[0]?.count || '0'),
        unreadNotifications: parseInt(notifRes.rows[0]?.count || '0'),
      },
    });
  } catch (e) {
    console.error('[Dashboard] GET stats error:', e.message);
    // Graceful fallback
    res.json({
      stats: { totalTasks: 0, completedToday: 0, activeAgents: 0, unreadNotifications: 0 },
    });
  }
});

module.exports = router;
