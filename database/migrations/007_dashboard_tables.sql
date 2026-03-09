-- Migration 007: Dashboard persistence tables
-- Tasks, activity log, companies/projects, and dashboard settings
-- These tables back the CEO dashboard that previously used localStorage

-- ─── Tasks ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS dashboard_tasks (
  id            TEXT PRIMARY KEY,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  description   TEXT NOT NULL DEFAULT '',
  status        TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'inprogress', 'done')),
  project       TEXT NOT NULL DEFAULT '',
  company       TEXT NOT NULL DEFAULT '',
  agent         TEXT NOT NULL DEFAULT '',
  priority      TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
  due_date      TEXT NOT NULL DEFAULT '',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at  TEXT NOT NULL DEFAULT '',
  notes         TEXT NOT NULL DEFAULT '',
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dashboard_tasks_user
  ON dashboard_tasks (user_id);
CREATE INDEX IF NOT EXISTS idx_dashboard_tasks_status
  ON dashboard_tasks (user_id, status);

-- ─── Activity Log ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS dashboard_activity (
  id            TEXT PRIMARY KEY,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type          TEXT NOT NULL DEFAULT 'update',
  message       TEXT NOT NULL,
  agent         TEXT NOT NULL DEFAULT '',
  project       TEXT NOT NULL DEFAULT '',
  timestamp     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dashboard_activity_user
  ON dashboard_activity (user_id);
CREATE INDEX IF NOT EXISTS idx_dashboard_activity_ts
  ON dashboard_activity (user_id, timestamp DESC);

-- ─── Companies & Projects ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS dashboard_companies (
  id            TEXT PRIMARY KEY,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dashboard_companies_user
  ON dashboard_companies (user_id);

CREATE TABLE IF NOT EXISTS dashboard_projects (
  id            TEXT PRIMARY KEY,
  company_id    TEXT NOT NULL REFERENCES dashboard_companies(id) ON DELETE CASCADE,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  category      TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_dashboard_projects_company
  ON dashboard_projects (company_id);

-- ─── Dashboard Settings ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS dashboard_settings (
  user_id       INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  settings      JSONB NOT NULL DEFAULT '{}',
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE dashboard_tasks IS 'CEO dashboard tasks — kanban board items';
COMMENT ON TABLE dashboard_activity IS 'CEO dashboard activity log';
COMMENT ON TABLE dashboard_companies IS 'CEO dashboard company entities';
COMMENT ON TABLE dashboard_projects IS 'CEO dashboard projects, grouped by company';
COMMENT ON TABLE dashboard_settings IS 'Per-user dashboard preferences (theme, view, agent costs)';
