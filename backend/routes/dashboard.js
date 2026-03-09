/**
 * Dashboard Routes — Supabase-backed
 *
 * Persists the CEO dashboard data that previously lived in localStorage.
 * All routes require JWT authentication.
 *
 * Tasks
 *   GET    /api/dashboard/tasks          — List user's tasks
 *   POST   /api/dashboard/tasks          — Create a task
 *   PUT    /api/dashboard/tasks/:id      — Update a task
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

module.exports = router;
