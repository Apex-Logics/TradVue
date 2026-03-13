'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../context/AuthContext'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://tradvue-api.onrender.com'
const ADMIN_EMAILS = ['firemanems06@gmail.com', 'axle-test@tradvue.com']

// ── Types ─────────────────────────────────────────────────────────────────────

interface Stats {
  users: { total: number; free: number; pro: number; synced: number }
  feedback: { total: number; new: number }
}

interface AdminUser {
  id: string
  email: string
  created_at: string
  last_sign_in: string | null
  email_verified: boolean
  tier: 'free' | 'pro'
}

interface FeedbackItem {
  id: string
  type: 'bug' | 'feature' | 'general'
  message: string
  email?: string
  page_url?: string
  created_at: string
  status: 'new' | 'reviewed' | 'resolved' | 'wontfix'
}

interface Health {
  api: { status: string; uptimeFormatted: string; env: string; nodeVersion: string }
  database: { status: string; latencyMs: number | null }
  deploy: { lastDeploy: string; version: string; renderService: string }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function fmtDateTime(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// ── Inline SVG icons ──────────────────────────────────────────────────────────

const IconUsers = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
)

const IconMessage = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
  </svg>
)

const IconShield = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
  </svg>
)

const IconTrash = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/>
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
    <path d="M10 11v6M14 11v6"/>
    <path d="M9 6V4h6v2"/>
  </svg>
)

const IconCheck = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
)

const IconX = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
)

const IconRefresh = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10"/>
    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
  </svg>
)

const IconSearch = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
)

const IconExternalLink = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
    <polyline points="15 3 21 3 21 9"/>
    <line x1="10" y1="14" x2="21" y2="3"/>
  </svg>
)

// ── Main Component ────────────────────────────────────────────────────────────

export default function AdminPage() {
  const { user, token, loading: authLoading } = useAuth()
  const router = useRouter()

  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'feedback' | 'health'>('overview')
  const [stats, setStats] = useState<Stats | null>(null)
  const [users, setUsers] = useState<AdminUser[]>([])
  const [feedback, setFeedback] = useState<FeedbackItem[]>([])
  const [health, setHealth] = useState<Health | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // User filters
  const [userSearch, setUserSearch] = useState('')
  const [userTier, setUserTier] = useState<'all' | 'free' | 'pro'>('all')

  // Feedback filters
  const [feedbackTab, setFeedbackTab] = useState<'all' | 'new' | 'bug' | 'feature' | 'general'>('all')

  // Delete modal
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null)
  const [deleting, setDeleting] = useState(false)

  // ── Auth guard ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (authLoading) return
    if (!user || !ADMIN_EMAILS.includes(user.email)) {
      router.replace('/')
    }
  }, [user, authLoading, router])

  const apiFetch = useCallback(async (path: string, opts?: RequestInit) => {
    const res = await fetch(`${API_BASE}${path}`, {
      ...opts,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(opts?.headers || {}),
      },
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }))
      throw new Error(err.error || res.statusText)
    }
    return res.json()
  }, [token])

  // ── Data loaders ────────────────────────────────────────────────────────────
  const loadStats = useCallback(async () => {
    try {
      const data = await apiFetch('/api/admin/stats')
      setStats(data)
    } catch (e: any) { setError(e.message) }
  }, [apiFetch])

  const loadUsers = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (userSearch) params.set('search', userSearch)
      if (userTier !== 'all') params.set('tier', userTier)
      const data = await apiFetch(`/api/admin/users?${params}`)
      setUsers(data.users || [])
    } catch (e: any) { setError(e.message) }
  }, [apiFetch, userSearch, userTier])

  const loadFeedback = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (feedbackTab === 'new') params.set('status', 'new')
      else if (['bug', 'feature', 'general'].includes(feedbackTab)) params.set('type', feedbackTab)
      const data = await apiFetch(`/api/admin/feedback?${params}`)
      setFeedback(data.feedback || [])
    } catch (e: any) { setError(e.message) }
  }, [apiFetch, feedbackTab])

  const loadHealth = useCallback(async () => {
    try {
      const data = await apiFetch('/api/admin/health')
      setHealth(data)
    } catch (e: any) { setError(e.message) }
  }, [apiFetch])

  // Initial load
  useEffect(() => {
    if (!token || authLoading || !user || !ADMIN_EMAILS.includes(user.email)) return
    setLoading(true)
    Promise.all([loadStats(), loadUsers(), loadFeedback(), loadHealth()])
      .finally(() => setLoading(false))
  }, [token, authLoading, user]) // eslint-disable-line

  // Reload on filter changes
  useEffect(() => { if (token) loadUsers() }, [userSearch, userTier, loadUsers, token])
  useEffect(() => { if (token) loadFeedback() }, [feedbackTab, loadFeedback, token])

  // ── Actions ─────────────────────────────────────────────────────────────────
  const deleteUser = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await apiFetch(`/api/admin/users/${deleteTarget.id}`, { method: 'DELETE' })
      setUsers(u => u.filter(x => x.id !== deleteTarget.id))
      setDeleteTarget(null)
      loadStats()
    } catch (e: any) { setError(e.message) }
    finally { setDeleting(false) }
  }

  const updateFeedbackStatus = async (id: string, status: string) => {
    try {
      await apiFetch(`/api/admin/feedback/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      })
      setFeedback(f => f.map(x => x.id === id ? { ...x, status: status as FeedbackItem['status'] } : x))
      loadStats()
    } catch (e: any) { setError(e.message) }
  }

  // ── Guard: loading / not admin ──────────────────────────────────────────────
  if (authLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg-0)' }}>
        <div style={{ color: 'var(--text-1)' }}>Loading…</div>
      </div>
    )
  }
  if (!user || !ADMIN_EMAILS.includes(user.email)) return null

  const newFeedbackCount = feedback.filter(f => f.status === 'new').length

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-0)', color: 'var(--text-0)', fontFamily: 'Inter, sans-serif' }}>

      {/* Header */}
      <header style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-1)', padding: '0 24px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 60 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <IconShield />
            <span style={{ fontWeight: 700, fontSize: 18, letterSpacing: '-0.3px' }}>
              TradVue <span style={{ color: 'var(--accent)' }}>Admin</span>
            </span>
            <span style={{ fontSize: 11, color: 'var(--text-2)', background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 4, padding: '2px 7px', marginLeft: 4 }}>
              INTERNAL
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 13, color: 'var(--text-2)' }}>{user.email}</span>
            <button
              onClick={() => {
                setLoading(true)
                Promise.all([loadStats(), loadUsers(), loadFeedback(), loadHealth()]).finally(() => setLoading(false))
              }}
              style={{ background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 12px', color: 'var(--text-1)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}
            >
              <IconRefresh /> Refresh
            </button>
          </div>
        </div>
      </header>

      {/* Error banner */}
      {error && (
        <div style={{ background: 'rgba(255,69,96,0.12)', border: '1px solid rgba(255,69,96,0.3)', color: '#ff4560', padding: '10px 24px', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>⚠ {error}</span>
          <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', color: '#ff4560', cursor: 'pointer', fontSize: 16 }}>×</button>
        </div>
      )}

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 24px' }}>

        {/* Nav Tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 28, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
          {(['overview', 'users', 'feedback', 'health'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                padding: '8px 18px', fontSize: 14, fontWeight: activeTab === tab ? 600 : 400,
                color: activeTab === tab ? 'var(--text-0)' : 'var(--text-2)',
                borderBottom: activeTab === tab ? '2px solid var(--accent)' : '2px solid transparent',
                marginBottom: -1, transition: 'color 0.15s',
                textTransform: 'capitalize',
                position: 'relative',
              }}
            >
              {tab}
              {tab === 'feedback' && stats && stats.feedback.new > 0 && (
                <span style={{ marginLeft: 6, background: '#ff4560', color: '#fff', borderRadius: 10, fontSize: 11, padding: '1px 6px', fontWeight: 700 }}>
                  {stats.feedback.new}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── OVERVIEW ─────────────────────────────────────────────────────── */}
        {activeTab === 'overview' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 32 }}>
              <StatCard label="Total Users" value={stats?.users.total ?? '—'} icon={<IconUsers />} color="var(--blue)" />
              <StatCard label="Free Users" value={stats?.users.free ?? '—'} icon={<IconUsers />} color="var(--blue)" />
              <StatCard label="Pro Users" value={stats?.users.pro ?? '—'} icon={<IconUsers />} color="var(--accent)" />
              <StatCard label="New Feedback" value={stats?.feedback.new ?? '—'} icon={<IconMessage />} color="#f97316" badge />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
              <StatCard label="Total Feedback" value={stats?.feedback.total ?? '—'} icon={<IconMessage />} color="#f97316" />
              <StatCard label="Users Synced" value={stats?.users.synced ?? '—'} icon={<IconUsers />} color="var(--green)" />
            </div>
          </div>
        )}

        {/* ── USERS ────────────────────────────────────────────────────────── */}
        {activeTab === 'users' && (
          <div>
            {/* Filters */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
              <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
                <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-2)' }}>
                  <IconSearch />
                </span>
                <input
                  type="text"
                  placeholder="Search by email…"
                  value={userSearch}
                  onChange={e => setUserSearch(e.target.value)}
                  style={{ width: '100%', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px 8px 34px', color: 'var(--text-0)', fontSize: 14, outline: 'none' }}
                />
              </div>
              <select
                value={userTier}
                onChange={e => setUserTier(e.target.value as any)}
                style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 14px', color: 'var(--text-0)', fontSize: 14, cursor: 'pointer' }}
              >
                <option value="all">All Tiers</option>
                <option value="free">Free</option>
                <option value="pro">Pro</option>
              </select>
              <span style={{ display: 'flex', alignItems: 'center', color: 'var(--text-2)', fontSize: 13 }}>
                {users.length} user{users.length !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Table */}
            <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-2)' }}>
                      {['Email', 'Tier', 'Joined', 'Last Login', 'Verified', 'Actions'].map(h => (
                        <th key={h} style={{ padding: '10px 16px', textAlign: 'left', color: 'var(--text-2)', fontWeight: 500, whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {loading && (
                      <tr><td colSpan={6} style={{ padding: 32, textAlign: 'center', color: 'var(--text-2)' }}>Loading…</td></tr>
                    )}
                    {!loading && users.length === 0 && (
                      <tr><td colSpan={6} style={{ padding: 32, textAlign: 'center', color: 'var(--text-2)' }}>No users found</td></tr>
                    )}
                    {users.map((u, i) => (
                      <tr key={u.id} style={{ borderBottom: i < users.length - 1 ? '1px solid var(--border-b)' : 'none', transition: 'background 0.1s' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-2)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        <td style={{ padding: '10px 16px', color: 'var(--text-0)', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.email}</td>
                        <td style={{ padding: '10px 16px' }}>
                          <TierBadge tier={u.tier} />
                        </td>
                        <td style={{ padding: '10px 16px', color: 'var(--text-1)', whiteSpace: 'nowrap' }}>{fmtDate(u.created_at)}</td>
                        <td style={{ padding: '10px 16px', color: 'var(--text-1)', whiteSpace: 'nowrap' }}>{fmtDate(u.last_sign_in)}</td>
                        <td style={{ padding: '10px 16px' }}>
                          {u.email_verified
                            ? <span style={{ color: 'var(--green)' }}><IconCheck /></span>
                            : <span style={{ color: 'var(--text-3)' }}><IconX /></span>}
                        </td>
                        <td style={{ padding: '10px 16px' }}>
                          <button
                            onClick={() => setDeleteTarget(u)}
                            style={{ background: 'none', border: '1px solid rgba(255,69,96,0.3)', borderRadius: 6, padding: '4px 10px', color: 'var(--red)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}
                          >
                            <IconTrash /> Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── FEEDBACK ─────────────────────────────────────────────────────── */}
        {activeTab === 'feedback' && (
          <div>
            {/* Tabs */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
              {(['all', 'new', 'bug', 'feature', 'general'] as const).map(t => {
                const count = t === 'new' ? newFeedbackCount : feedback.filter(f => t === 'all' ? true : f.type === t).length
                return (
                  <button
                    key={t}
                    onClick={() => setFeedbackTab(t)}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      padding: '7px 16px', fontSize: 13, fontWeight: feedbackTab === t ? 600 : 400,
                      color: feedbackTab === t ? 'var(--text-0)' : 'var(--text-2)',
                      borderBottom: feedbackTab === t ? '2px solid var(--accent)' : '2px solid transparent',
                      marginBottom: -1, textTransform: 'capitalize',
                    }}
                  >
                    {t}
                    {t === 'new' && newFeedbackCount > 0 && (
                      <span style={{ marginLeft: 5, background: '#ff4560', color: '#fff', borderRadius: 10, fontSize: 10, padding: '1px 5px', fontWeight: 700 }}>
                        {newFeedbackCount}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {loading && <div style={{ color: 'var(--text-2)', textAlign: 'center', padding: 32 }}>Loading…</div>}
              {!loading && feedback.length === 0 && (
                <div style={{ color: 'var(--text-2)', textAlign: 'center', padding: 48 }}>No feedback items</div>
              )}
              {feedback.map(f => (
                <div key={f.id} style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 10, padding: '16px 20px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <TypeBadge type={f.type} />
                      <StatusBadge status={f.status} />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{fmtDateTime(f.created_at)}</span>
                      <select
                        value={f.status}
                        onChange={e => updateFeedbackStatus(f.id, e.target.value)}
                        style={{ background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px', color: 'var(--text-1)', fontSize: 12, cursor: 'pointer' }}
                      >
                        <option value="new">New</option>
                        <option value="reviewed">Reviewed</option>
                        <option value="resolved">Resolved</option>
                        <option value="wontfix">Won't Fix</option>
                      </select>
                    </div>
                  </div>
                  <p style={{ margin: '12px 0 8px', color: 'var(--text-0)', lineHeight: 1.5 }}>{f.message}</p>
                  <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--text-2)', flexWrap: 'wrap' }}>
                    {f.email && <span>✉ {f.email}</span>}
                    {f.page_url && <span>🔗 {f.page_url}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── HEALTH ───────────────────────────────────────────────────────── */}
        {activeTab === 'health' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Status cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
              {/* API */}
              <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 10, padding: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: health?.api.status === 'ok' ? 'var(--green)' : 'var(--red)', flexShrink: 0, boxShadow: health?.api.status === 'ok' ? '0 0 8px var(--green)' : '0 0 8px var(--red)' }} />
                  <span style={{ fontWeight: 600 }}>API Server</span>
                </div>
                {health ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 7, fontSize: 13 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-2)' }}>Uptime</span>
                      <span style={{ color: 'var(--green)' }}>{health.api.uptimeFormatted}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-2)' }}>Node</span>
                      <span>{health.api.nodeVersion}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-2)' }}>Env</span>
                      <span>{health.api.env}</span>
                    </div>
                  </div>
                ) : <div style={{ color: 'var(--text-2)', fontSize: 13 }}>Loading…</div>}
              </div>

              {/* Database */}
              <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 10, padding: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: health?.database.status === 'ok' ? 'var(--green)' : 'var(--red)', flexShrink: 0, boxShadow: health?.database.status === 'ok' ? '0 0 8px var(--green)' : '0 0 8px var(--red)' }} />
                  <span style={{ fontWeight: 600 }}>Database (Supabase)</span>
                </div>
                {health ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 7, fontSize: 13 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-2)' }}>Status</span>
                      <span style={{ color: health.database.status === 'ok' ? 'var(--green)' : 'var(--red)' }}>
                        {health.database.status === 'ok' ? 'Connected' : 'Error'}
                      </span>
                    </div>
                    {health.database.latencyMs !== null && (
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-2)' }}>Latency</span>
                        <span>{health.database.latencyMs}ms</span>
                      </div>
                    )}
                  </div>
                ) : <div style={{ color: 'var(--text-2)', fontSize: 13 }}>Loading…</div>}
              </div>

              {/* Deploy */}
              <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 10, padding: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--blue)', flexShrink: 0 }} />
                  <span style={{ fontWeight: 600 }}>Last Deploy</span>
                </div>
                {health ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 7, fontSize: 13 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-2)' }}>Time</span>
                      <span>{fmtDateTime(health.deploy.lastDeploy)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-2)' }}>Version</span>
                      <span>{health.deploy.version}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-2)' }}>Service</span>
                      <span>{health.deploy.renderService}</span>
                    </div>
                  </div>
                ) : <div style={{ color: 'var(--text-2)', fontSize: 13 }}>Loading…</div>}
              </div>
            </div>

            {/* Quick Links */}
            <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 10, padding: 20 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, color: 'var(--text-1)' }}>Quick Links</h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                {[
                  { label: 'Render Dashboard', url: 'https://dashboard.render.com' },
                  { label: 'Supabase Dashboard', url: 'https://supabase.com/dashboard' },
                  { label: 'Vercel Dashboard', url: 'https://vercel.com/dashboard' },
                  { label: 'GitHub Repo', url: 'https://github.com/ApexLogics' },
                ].map(link => (
                  <a
                    key={link.label}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 14px', color: 'var(--text-1)', textDecoration: 'none', fontSize: 13, transition: 'border-color 0.15s' }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
                  >
                    {link.label} <IconExternalLink />
                  </a>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 24 }}>
          <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 12, padding: 28, maxWidth: 400, width: '100%' }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 10, color: 'var(--red)' }}>Delete User?</h3>
            <p style={{ color: 'var(--text-1)', fontSize: 14, lineHeight: 1.6, marginBottom: 6 }}>
              This will permanently delete the account:
            </p>
            <p style={{ color: 'var(--text-0)', fontWeight: 600, fontSize: 14, background: 'var(--bg-3)', padding: '8px 12px', borderRadius: 6, marginBottom: 20, wordBreak: 'break-all' }}>
              {deleteTarget.email}
            </p>
            <p style={{ color: 'var(--text-2)', fontSize: 13, marginBottom: 24 }}>This action cannot be undone.</p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                style={{ background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 20px', color: 'var(--text-1)', cursor: 'pointer', fontSize: 14 }}
              >
                Cancel
              </button>
              <button
                onClick={deleteUser}
                disabled={deleting}
                style={{ background: 'rgba(255,69,96,0.15)', border: '1px solid rgba(255,69,96,0.4)', borderRadius: 8, padding: '8px 20px', color: 'var(--red)', cursor: deleting ? 'not-allowed' : 'pointer', fontSize: 14, fontWeight: 600 }}
              >
                {deleting ? 'Deleting…' : 'Delete User'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({ label, value, icon, color, badge }: { label: string; value: number | string; icon: React.ReactNode; color: string; badge?: boolean }) {
  return (
    <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 12, padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
      <div style={{ width: 44, height: 44, borderRadius: 10, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', color, flexShrink: 0 }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 28, fontWeight: 700, lineHeight: 1.1, color: badge && Number(value) > 0 ? '#f97316' : 'var(--text-0)' }}>
          {value}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 3 }}>{label}</div>
      </div>
    </div>
  )
}

function TierBadge({ tier }: { tier: 'free' | 'pro' }) {
  const isPro = tier === 'pro'
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 5,
      background: isPro ? 'rgba(74,158,255,0.15)' : 'var(--bg-3)',
      color: isPro ? 'var(--blue)' : 'var(--text-2)',
      border: `1px solid ${isPro ? 'rgba(74,158,255,0.3)' : 'var(--border)'}`,
      textTransform: 'uppercase',
    }}>
      {tier}
    </span>
  )
}

function TypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    bug: '#ff4560',
    feature: 'var(--blue)',
    general: 'var(--text-1)',
  }
  return (
    <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 5, background: 'var(--bg-3)', color: colors[type] || 'var(--text-2)', border: '1px solid var(--border)', textTransform: 'uppercase' }}>
      {type}
    </span>
  )
}

function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { color: string; bg: string }> = {
    new: { color: '#f97316', bg: 'rgba(249,115,22,0.12)' },
    reviewed: { color: 'var(--blue)', bg: 'var(--blue-dim)' },
    resolved: { color: 'var(--green)', bg: 'var(--green-dim)' },
    wontfix: { color: 'var(--text-2)', bg: 'var(--bg-3)' },
  }
  const c = cfg[status] || cfg.new
  return (
    <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 5, background: c.bg, color: c.color, border: `1px solid ${c.color}30`, textTransform: 'capitalize' }}>
      {status}
    </span>
  )
}
