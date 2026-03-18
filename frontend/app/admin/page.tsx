'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../context/AuthContext'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://tradvue-api.onrender.com'
const ADMIN_EMAILS = ['apexlogicsfl@gmail.com', 'axle-test@tradvue.com']

type TabId = 'overview' | 'users' | 'feedback' | 'activity' | 'analytics' | 'revenue' | 'email' | 'security' | 'health'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Stats {
  users: { total: number; free: number; pro: number; synced: number }
  feedback: { total: number; new: number }
}
interface AdminUser {
  id: string; email: string; created_at: string
  last_sign_in: string | null; email_verified: boolean; tier: 'free' | 'pro'
}
interface FeedbackItem {
  id: string; type: 'bug' | 'feature' | 'general'; message: string
  email?: string; page_url?: string; created_at: string
  status: 'new' | 'reviewed' | 'resolved' | 'wontfix'
}
interface Health {
  api: { status: string; uptimeFormatted: string; env: string; nodeVersion: string }
  database: { status: string; latencyMs: number | null }
  deploy: { lastDeploy: string; version: string; renderService: string }
}
interface ActivityEntry {
  id: string; user_id?: string; email?: string; action: string
  details?: Record<string, unknown>; ip_address?: string; created_at: string
}
interface AnalyticsData {
  active_users: { daily: number; weekly: number }
  page_views: number
  top_actions: { action: string; count: number }[]
  signups_chart: { date: string; count: number }[]
  peak_hours: { hour: number; count: number }[]
}
interface SentEmail {
  id: string; to_segment: string; subject: string; body: string
  sent_count: number; status: string; sent_by: string; created_at: string
}
interface UserDataSummary {
  key: string; updated_at: string; size_bytes: number
}
interface AbuseData {
  top_ips: { ip: string; count: number; last_action: string; last_seen: string }[]
  failed_logins: { email?: string; ip_address?: string; created_at: string }[]
  high_traffic_threshold: number
}
interface SecurityOverview {
  failedLogins24h: number; failedLogins7d: number; uniqueAttackerIPs24h: number
  successfulLogins24h: number; totalAPIRequests24h: number
  rlsTablesCount: number; rlsTablesProtected: number
  lastSecurityAudit: string | null; lastPenTest: string | null; penTestScore: string
  sslExpiry: string | null; sslDaysLeft: number | null
  activeUsers24h: number; rateLimitHits24h: number
  cloudflareEnabled: boolean; wafEnabled: boolean; auditStatus: string
}
interface FailedLogin {
  ip_address: string | null; email: string | null; created_at: string; user_agent: string | null
}
interface ActiveSession {
  user_id: string | null; email: string | null; ip_address: string | null
  last_seen: string; user_agent: string | null
}
interface IPThreat {
  ip_address: string; attempts: number; targeted_emails: string[]; last_attempt: string
}
interface SecurityFeedEntry {
  id: string; action: string; email: string | null; ip_address: string | null
  created_at: string; details: Record<string, unknown> | null
}

interface SecurityReport {
  filename: string; type: string; date: string | null
  score: string | null; findings: { critical: number; high: number; medium: number; low: number; info: number } | null
  status: string | null; lastModified: string
}
interface ScoreHistoryEntry {
  date: string; score: number; type: string
  findings?: { critical: number; high: number; medium: number; low: number; info: number }
  status?: string; checks?: number
}
interface AlertHistoryEntry {
  date: string; type: string; result: string; details: string
}
interface Announcement {
  id: string; message: string; type: 'info' | 'warning' | 'success'
  active: boolean; expires_at?: string; created_at: string
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

// ── Inline SVG Icons ──────────────────────────────────────────────────────────

const IconUsers = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
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
    <path d="M10 11v6M14 11v6M9 6V4h6v2"/>
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
    <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
  </svg>
)
const IconDownload = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
)
const IconEye = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>
)

// ── Main Component ────────────────────────────────────────────────────────────

export default function AdminPage() {
  const { user, token, loading: authLoading } = useAuth()
  const router = useRouter()

  const [activeTab, setActiveTab] = useState<TabId>('overview')
  const [stats, setStats] = useState<Stats | null>(null)
  const [users, setUsers] = useState<AdminUser[]>([])
  const [feedback, setFeedback] = useState<FeedbackItem[]>([])
  const [health, setHealth] = useState<Health | null>(null)
  const [activity, setActivity] = useState<ActivityEntry[]>([])
  const [activityTotal, setActivityTotal] = useState(0)
  const [activityPage, setActivityPage] = useState(0)
  const [activityFilter, setActivityFilter] = useState('')
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const [sentEmails, setSentEmails] = useState<SentEmail[]>([])
  const [abuse, setAbuse] = useState<AbuseData | null>(null)
  // Security dashboard state
  const [secOverview, setSecOverview] = useState<SecurityOverview | null>(null)
  const [secFailedLogins, setSecFailedLogins] = useState<FailedLogin[]>([])
  const [secActiveSessions, setSecActiveSessions] = useState<ActiveSession[]>([])
  const [secIPThreats, setSecIPThreats] = useState<IPThreat[]>([])
  const [secActivityFeed, setSecActivityFeed] = useState<SecurityFeedEntry[]>([])
  const [secLoading, setSecLoading] = useState(false)
  const [failedLoginSort, setFailedLoginSort] = useState<'asc' | 'desc'>('desc')
  const [secReports, setSecReports] = useState<SecurityReport[]>([])
  const [secScoreHistory, setSecScoreHistory] = useState<ScoreHistoryEntry[]>([])
  const [secAlertHistory, setSecAlertHistory] = useState<AlertHistoryEntry[]>([])
  const [secAlertFilter, setSecAlertFilter] = useState('')
  const [secAlertResultFilter, setSecAlertResultFilter] = useState<'all' | 'clean' | 'pass' | 'warning' | 'alert' | 'fail'>('all')
  const [selectedReport, setSelectedReport] = useState<{ filename: string; content: string } | null>(null)
  const [reportModalLoading, setReportModalLoading] = useState(false)
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // User filters
  const [userSearch, setUserSearch] = useState('')
  const [userTier, setUserTier] = useState<'all' | 'free' | 'pro'>('all')

  // Feedback filters
  const [feedbackTab, setFeedbackTab] = useState<'all' | 'new' | 'bug' | 'feature' | 'general'>('all')

  // Modals
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [viewDataUser, setViewDataUser] = useState<AdminUser | null>(null)
  const [userData, setUserData] = useState<UserDataSummary[]>([])
  const [loadingUserData, setLoadingUserData] = useState(false)

  // Email compose
  const [emailAudience, setEmailAudience] = useState<'all' | 'free' | 'pro'>('all')
  const [emailSubject, setEmailSubject] = useState('')
  const [emailBody, setEmailBody] = useState('')
  const [emailSending, setEmailSending] = useState(false)
  const [emailConfirm, setEmailConfirm] = useState(false)

  // Announcement
  const [annMessage, setAnnMessage] = useState('')
  const [annType, setAnnType] = useState<'info' | 'warning' | 'success'>('info')
  const [annExpiry, setAnnExpiry] = useState('')
  const [annPublishing, setAnnPublishing] = useState(false)

  // Auto-refresh interval ref
  const activityRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Auth guard ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (authLoading) return
    if (!user || !ADMIN_EMAILS.includes(user.email)) router.replace('/')
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
    try { const d = await apiFetch('/api/admin/stats'); setStats(d) } catch (e: unknown) { setError((e as Error).message) }
  }, [apiFetch])

  const loadUsers = useCallback(async () => {
    try {
      const p = new URLSearchParams()
      if (userSearch) p.set('search', userSearch)
      if (userTier !== 'all') p.set('tier', userTier)
      const d = await apiFetch(`/api/admin/users?${p}`)
      setUsers(d.users || [])
    } catch (e: unknown) { setError((e as Error).message) }
  }, [apiFetch, userSearch, userTier])

  const loadFeedback = useCallback(async () => {
    try {
      const p = new URLSearchParams()
      if (feedbackTab === 'new') p.set('status', 'new')
      else if (['bug', 'feature', 'general'].includes(feedbackTab)) p.set('type', feedbackTab)
      const d = await apiFetch(`/api/admin/feedback?${p}`)
      setFeedback(d.feedback || [])
    } catch (e: unknown) { setError((e as Error).message) }
  }, [apiFetch, feedbackTab])

  const loadHealth = useCallback(async () => {
    try { const d = await apiFetch('/api/admin/health'); setHealth(d) } catch (e: unknown) { setError((e as Error).message) }
  }, [apiFetch])

  const loadActivity = useCallback(async (page = 0, action = '') => {
    try {
      const p = new URLSearchParams({ limit: '50', offset: String(page * 50) })
      if (action) p.set('action', action)
      const d = await apiFetch(`/api/admin/activity?${p}`)
      setActivity(d.activity || [])
      setActivityTotal(d.total || 0)
    } catch (e: unknown) { setError((e as Error).message) }
  }, [apiFetch])

  const loadAnalytics = useCallback(async () => {
    try { const d = await apiFetch('/api/admin/analytics'); setAnalytics(d) } catch (e: unknown) { setError((e as Error).message) }
  }, [apiFetch])

  const loadEmails = useCallback(async () => {
    try { const d = await apiFetch('/api/admin/email/history'); setSentEmails(d.emails || []) } catch (e: unknown) { setError((e as Error).message) }
  }, [apiFetch])

  const loadAbuse = useCallback(async () => {
    try { const d = await apiFetch('/api/admin/abuse'); setAbuse(d) } catch (e: unknown) { setError((e as Error).message) }
  }, [apiFetch])

  const loadSecurity = useCallback(async () => {
    if (!token) return
    setSecLoading(true)
    try {
      const [overview, failedLogins, activeSessions, ipThreats, activityFeed, reports, scoreHistory, alertHistory] = await Promise.all([
        apiFetch('/api/admin/security/overview'),
        apiFetch('/api/admin/security/failed-logins'),
        apiFetch('/api/admin/security/active-sessions'),
        apiFetch('/api/admin/security/ip-threats'),
        apiFetch('/api/admin/security/activity-feed'),
        apiFetch('/api/admin/security/reports'),
        apiFetch('/api/admin/security/score-history'),
        apiFetch('/api/admin/security/alert-history'),
      ])
      setSecOverview(overview)
      setSecFailedLogins(failedLogins.failed_logins || [])
      setSecActiveSessions(activeSessions.active_sessions || [])
      setSecIPThreats(ipThreats.ip_threats || [])
      setSecActivityFeed(activityFeed.activity_feed || [])
      setSecReports(reports.reports || [])
      setSecScoreHistory(scoreHistory.history || [])
      setSecAlertHistory(alertHistory.alerts || [])
    } catch (e: unknown) { setError((e as Error).message) }
    finally { setSecLoading(false) }
  }, [apiFetch, token])

  const openReport = useCallback(async (filename: string) => {
    setReportModalLoading(true)
    setSelectedReport(null)
    try {
      const d = await apiFetch(`/api/admin/security/reports/${encodeURIComponent(filename)}`)
      setSelectedReport({ filename: d.filename, content: d.content })
    } catch (e: unknown) { setError((e as Error).message) }
    finally { setReportModalLoading(false) }
  }, [apiFetch])

  const exportFile = useCallback((type: string) => {
    const url = `${API_BASE}/api/admin/security/export/${type}`
    const a = document.createElement('a')
    a.href = url
    a.style.display = 'none'
    // Pass auth token via query param for download (or use fetch + blob)
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.blob())
      .then(blob => {
        const objectUrl = URL.createObjectURL(blob)
        a.href = objectUrl
        const ext = type.includes('csv') ? '.csv' : '.md'
        a.download = `${type}${ext}`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(objectUrl)
      })
      .catch(e => setError((e as Error).message))
  }, [token])

  const loadAnnouncements = useCallback(async () => {
    try { const d = await apiFetch('/api/admin/announcements'); setAnnouncements(d.announcements || []) } catch (e: unknown) { setError((e as Error).message) }
  }, [apiFetch])

  // Initial load
  useEffect(() => {
    if (!token || authLoading || !user || !ADMIN_EMAILS.includes(user.email)) return
    setLoading(true)
    Promise.all([loadStats(), loadUsers(), loadFeedback(), loadHealth(), loadActivity(), loadAnalytics(), loadEmails(), loadAbuse(), loadAnnouncements(), loadSecurity()])
      .finally(() => setLoading(false))
  }, [token, authLoading, user]) // eslint-disable-line

  // Reload on filter changes
  useEffect(() => { if (token) loadUsers() }, [userSearch, userTier, loadUsers, token])
  useEffect(() => { if (token) loadFeedback() }, [feedbackTab, loadFeedback, token])

  // Security tab auto-refresh every 30s
  useEffect(() => {
    if (!token) return
    if (activeTab === 'security') loadSecurity()
  }, [activeTab]) // eslint-disable-line

  // Activity auto-refresh every 30s
  useEffect(() => {
    if (!token) return
    if (activityRefreshRef.current) clearInterval(activityRefreshRef.current)
    activityRefreshRef.current = setInterval(() => {
      if (activeTab === 'activity') loadActivity(activityPage, activityFilter)
    }, 30000)
    return () => { if (activityRefreshRef.current) clearInterval(activityRefreshRef.current) }
  }, [token, activeTab, activityPage, activityFilter, loadActivity])

  // ── Actions ─────────────────────────────────────────────────────────────────
  const deleteUser = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await apiFetch(`/api/admin/users/${deleteTarget.id}`, { method: 'DELETE' })
      setUsers(u => u.filter(x => x.id !== deleteTarget.id))
      setDeleteTarget(null)
      loadStats()
    } catch (e: unknown) { setError((e as Error).message) }
    finally { setDeleting(false) }
  }

  const deleteFeedback = async (id: string) => {
    if (!confirm('Delete this feedback?')) return
    try {
      await apiFetch(`/api/admin/feedback/${id}`, { method: 'DELETE' })
      setFeedback(f => f.filter(x => x.id !== id))
    } catch (err) { console.error('Delete feedback failed:', err) }
  }

  const updateFeedbackStatus = async (id: string, status: string) => {
    try {
      await apiFetch(`/api/admin/feedback/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) })
      setFeedback(f => f.map(x => x.id === id ? { ...x, status: status as FeedbackItem['status'] } : x))
      loadStats()
    } catch (e: unknown) { setError((e as Error).message) }
  }

  const openUserData = async (u: AdminUser) => {
    setViewDataUser(u)
    setLoadingUserData(true)
    try {
      const d = await apiFetch(`/api/admin/users/${u.id}/data`)
      setUserData(d.data || [])
    } catch (e: unknown) { setError((e as Error).message) }
    finally { setLoadingUserData(false) }
  }

  const sendEmail = async () => {
    setEmailSending(true)
    try {
      await apiFetch('/api/admin/email/send', {
        method: 'POST',
        body: JSON.stringify({ to: emailAudience, subject: emailSubject, body: emailBody }),
      })
      setEmailConfirm(false)
      setEmailSubject('')
      setEmailBody('')
      loadEmails()
    } catch (e: unknown) { setError((e as Error).message) }
    finally { setEmailSending(false) }
  }

  const publishAnnouncement = async () => {
    setAnnPublishing(true)
    try {
      await apiFetch('/api/admin/announcements', {
        method: 'POST',
        body: JSON.stringify({ message: annMessage, type: annType, active: true, expiresAt: annExpiry || undefined }),
      })
      setAnnMessage('')
      setAnnExpiry('')
      loadAnnouncements()
    } catch (e: unknown) { setError((e as Error).message) }
    finally { setAnnPublishing(false) }
  }

  const clearAnnouncement = async () => {
    try {
      await apiFetch('/api/admin/announcements', { method: 'DELETE' })
      loadAnnouncements()
    } catch (e: unknown) { setError((e as Error).message) }
  }

  const exportCSV = (path: string) => {
    window.open(`${API_BASE}${path}?token=${token}`, '_blank')
    // Fallback: fetch with auth header
    fetch(`${API_BASE}${path}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.blob())
      .then(blob => {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = path.includes('users') ? 'tradvue-users.csv' : 'tradvue-feedback.csv'
        a.click()
        URL.revokeObjectURL(url)
      })
      .catch(() => {})
  }

  // ── Guard ────────────────────────────────────────────────────────────────────
  if (authLoading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg-0)' }}>
      <div style={{ color: 'var(--text-1)' }}>Loading…</div>
    </div>
  )
  if (!user || !ADMIN_EMAILS.includes(user.email)) return null

  const newFeedbackCount = feedback.filter(f => f.status === 'new').length
  const activeAnnouncement = announcements.find(a => a.active)

  const TABS: { id: TabId; label: string; badge?: number }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'users', label: 'Users' },
    { id: 'feedback', label: 'Feedback', badge: newFeedbackCount || undefined },
    { id: 'activity', label: 'Activity' },
    { id: 'analytics', label: 'Analytics' },
    { id: 'revenue', label: 'Revenue' },
    { id: 'email', label: 'Email' },
    { id: 'security', label: 'Security' },
    { id: 'health', label: 'Health' },
  ]

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-0)', color: 'var(--text-0)', fontFamily: 'Inter, sans-serif' }}>

      {/* Header */}
      <header style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-1)', padding: '0 24px' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 60 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <IconShield />
            <span style={{ fontWeight: 700, fontSize: 18, letterSpacing: '-0.3px' }}>TradVue <span style={{ color: 'var(--accent)' }}>Admin</span></span>
            <span style={{ fontSize: 11, color: 'var(--text-2)', background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 4, padding: '2px 7px', marginLeft: 4 }}>INTERNAL</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 13, color: 'var(--text-2)' }}>{user.email}</span>
            <button
              onClick={() => { setLoading(true); Promise.all([loadStats(), loadUsers(), loadFeedback(), loadHealth(), loadActivity(activityPage, activityFilter), loadAnalytics(), loadEmails(), loadAbuse(), loadAnnouncements()]).finally(() => setLoading(false)) }}
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
          <span>Error: {error}</span>
          <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', color: '#ff4560', cursor: 'pointer', fontSize: 16 }}>×</button>
        </div>
      )}

      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '24px' }}>

        {/* Nav Tabs */}
        <div style={{ display: 'flex', gap: 2, marginBottom: 28, borderBottom: '1px solid var(--border)', overflowX: 'auto' }}>
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '8px 16px', fontSize: 13, fontWeight: activeTab === tab.id ? 600 : 400,
              color: activeTab === tab.id ? 'var(--text-0)' : 'var(--text-2)',
              borderBottom: activeTab === tab.id ? '2px solid var(--accent)' : '2px solid transparent',
              marginBottom: -1, whiteSpace: 'nowrap', position: 'relative',
            }}>
              {tab.label}
              {tab.badge && tab.badge > 0 && (
                <span style={{ marginLeft: 5, background: '#ff4560', color: '#fff', borderRadius: 10, fontSize: 10, padding: '1px 5px', fontWeight: 700 }}>{tab.badge}</span>
              )}
            </button>
          ))}
        </div>

        {/* ── OVERVIEW ──────────────────────────────────────────────────────── */}
        {activeTab === 'overview' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
              <StatCard label="Total Users" value={stats?.users.total ?? '—'} icon={<IconUsers />} color="var(--blue)" />
              <StatCard label="Free Users" value={stats?.users.free ?? '—'} icon={<IconUsers />} color="var(--blue)" />
              <StatCard label="Pro Users" value={stats?.users.pro ?? '—'} icon={<IconUsers />} color="var(--accent)" />
              <StatCard label="New Feedback" value={stats?.feedback.new ?? '—'} icon={<IconMessage />} color="#f97316" badge />
              <StatCard label="Total Feedback" value={stats?.feedback.total ?? '—'} icon={<IconMessage />} color="#f97316" />
              <StatCard label="Users Synced" value={stats?.users.synced ?? '—'} icon={<IconUsers />} color="var(--green)" />
            </div>

            {/* Announcements section */}
            <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 12, padding: 24, marginBottom: 24 }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Announcement Banner</h3>
              {activeAnnouncement && (
                <div style={{ marginBottom: 16, padding: '12px 16px', borderRadius: 8, background: 'rgba(74,158,255,0.08)', border: '1px solid rgba(74,158,255,0.2)', fontSize: 13 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                    <div>
                      <span style={{ fontWeight: 600, color: 'var(--accent)', marginRight: 8 }}>[{activeAnnouncement.type.toUpperCase()}]</span>
                      {activeAnnouncement.message}
                    </div>
                    <button onClick={clearAnnouncement} style={{ background: 'rgba(255,69,96,0.1)', border: '1px solid rgba(255,69,96,0.3)', borderRadius: 6, padding: '4px 12px', color: '#ff4560', cursor: 'pointer', fontSize: 12, flexShrink: 0 }}>
                      Clear
                    </button>
                  </div>
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <input
                  value={annMessage} onChange={e => setAnnMessage(e.target.value)}
                  placeholder="Announcement message…"
                  style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 14px', color: 'var(--text-0)', fontSize: 14, outline: 'none', width: '100%' }}
                />
                <select value={annType} onChange={e => setAnnType(e.target.value as 'info' | 'warning' | 'success')}
                  style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', color: 'var(--text-0)', fontSize: 14, cursor: 'pointer' }}>
                  <option value="info">Info</option>
                  <option value="warning">Warning</option>
                  <option value="success">Success</option>
                </select>
                <input type="date" value={annExpiry} onChange={e => setAnnExpiry(e.target.value)}
                  title="Optional expiry date"
                  style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', color: 'var(--text-0)', fontSize: 14 }} />
                <button
                  onClick={publishAnnouncement} disabled={!annMessage || annPublishing}
                  style={{ background: 'var(--accent)', border: 'none', borderRadius: 8, padding: '9px 18px', color: '#fff', cursor: annMessage ? 'pointer' : 'not-allowed', fontSize: 14, fontWeight: 600, opacity: !annMessage ? 0.5 : 1, whiteSpace: 'nowrap' }}>
                  {annPublishing ? 'Publishing…' : 'Publish'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── USERS ─────────────────────────────────────────────────────────── */}
        {activeTab === 'users' && (
          <div>
            <div style={{ display: 'flex', gap: 12, marginBottom: 18, flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
                <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-2)' }}><IconSearch /></span>
                <input type="text" placeholder="Search by email…" value={userSearch} onChange={e => setUserSearch(e.target.value)}
                  style={{ width: '100%', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px 8px 34px', color: 'var(--text-0)', fontSize: 14, outline: 'none' }} />
              </div>
              <select value={userTier} onChange={e => setUserTier(e.target.value as 'all' | 'free' | 'pro')}
                style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 14px', color: 'var(--text-0)', fontSize: 14, cursor: 'pointer' }}>
                <option value="all">All Tiers</option>
                <option value="free">Free</option>
                <option value="pro">Pro</option>
              </select>
              <span style={{ color: 'var(--text-2)', fontSize: 13 }}>{users.length} users</span>
              <button onClick={() => exportCSV('/api/admin/export/users')}
                style={{ background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 14px', color: 'var(--text-1)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                <IconDownload /> Export CSV
              </button>
            </div>
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
                    {loading && <tr><td colSpan={6} style={{ padding: 32, textAlign: 'center', color: 'var(--text-2)' }}>Loading…</td></tr>}
                    {!loading && users.length === 0 && <tr><td colSpan={6} style={{ padding: 32, textAlign: 'center', color: 'var(--text-2)' }}>No users found</td></tr>}
                    {users.map((u, i) => (
                      <tr key={u.id} style={{ borderBottom: i < users.length - 1 ? '1px solid var(--border-b)' : 'none' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-2)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                        <td style={{ padding: '10px 16px', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.email}</td>
                        <td style={{ padding: '10px 16px' }}><TierBadge tier={u.tier} /></td>
                        <td style={{ padding: '10px 16px', color: 'var(--text-1)', whiteSpace: 'nowrap' }}>{fmtDate(u.created_at)}</td>
                        <td style={{ padding: '10px 16px', color: 'var(--text-1)', whiteSpace: 'nowrap' }}>{fmtDate(u.last_sign_in)}</td>
                        <td style={{ padding: '10px 16px' }}>
                          {u.email_verified ? <span style={{ color: 'var(--green)' }}><IconCheck /></span> : <span style={{ color: 'var(--text-3)' }}><IconX /></span>}
                        </td>
                        <td style={{ padding: '10px 16px' }}>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button onClick={() => openUserData(u)}
                              style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 10px', color: 'var(--text-1)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
                              <IconEye /> View Data
                            </button>
                            <button onClick={() => setDeleteTarget(u)}
                              style={{ background: 'none', border: '1px solid rgba(255,69,96,0.3)', borderRadius: 6, padding: '4px 10px', color: 'var(--red)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
                              <IconTrash /> Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── FEEDBACK ──────────────────────────────────────────────────────── */}
        {activeTab === 'feedback' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
              <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
                {(['all', 'new', 'bug', 'feature', 'general'] as const).map(t => (
                  <button key={t} onClick={() => setFeedbackTab(t)} style={{
                    background: 'none', border: 'none', cursor: 'pointer', padding: '7px 14px', fontSize: 13,
                    fontWeight: feedbackTab === t ? 600 : 400, color: feedbackTab === t ? 'var(--text-0)' : 'var(--text-2)',
                    borderBottom: feedbackTab === t ? '2px solid var(--accent)' : '2px solid transparent',
                    marginBottom: -1, textTransform: 'capitalize',
                  }}>
                    {t}{t === 'new' && newFeedbackCount > 0 && <span style={{ marginLeft: 5, background: '#ff4560', color: '#fff', borderRadius: 10, fontSize: 10, padding: '1px 5px', fontWeight: 700 }}>{newFeedbackCount}</span>}
                  </button>
                ))}
              </div>
              <button onClick={() => exportCSV('/api/admin/export/feedback')}
                style={{ background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 14px', color: 'var(--text-1)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                <IconDownload /> Export CSV
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {loading && <div style={{ color: 'var(--text-2)', textAlign: 'center', padding: 32 }}>Loading…</div>}
              {!loading && feedback.length === 0 && <div style={{ color: 'var(--text-2)', textAlign: 'center', padding: 48 }}>No feedback items</div>}
              {feedback.map(f => (
                <div key={f.id} style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 10, padding: '16px 20px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <TypeBadge type={f.type} /><StatusBadge status={f.status} />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{fmtDateTime(f.created_at)}</span>
                      <select value={f.status} onChange={e => updateFeedbackStatus(f.id, e.target.value)}
                        style={{ background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px', color: 'var(--text-1)', fontSize: 12, cursor: 'pointer' }}>
                        <option value="new">New</option>
                        <option value="reviewed">Reviewed</option>
                        <option value="resolved">Resolved</option>
                        <option value="wontfix">Won't Fix</option>
                      </select>
                      <button onClick={() => deleteFeedback(f.id)} title="Delete feedback"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-2)', fontSize: 14, padding: '2px 6px', borderRadius: 4, opacity: 0.6, transition: 'opacity 0.15s' }}
                        onMouseEnter={e => (e.currentTarget.style.opacity = '1', e.currentTarget.style.color = 'var(--red)')}
                        onMouseLeave={e => (e.currentTarget.style.opacity = '0.6', e.currentTarget.style.color = 'var(--text-2)')}>
                        ×
                      </button>
                    </div>
                  </div>
                  <p style={{ margin: '12px 0 8px', color: 'var(--text-0)', lineHeight: 1.5 }}>{f.message}</p>
                  <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--text-2)', flexWrap: 'wrap' }}>
                    {f.email && <span>{f.email}</span>}
                    {f.page_url && <span>{f.page_url}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── ACTIVITY ──────────────────────────────────────────────────────── */}
        {activeTab === 'activity' && (
          <div>
            <div style={{ display: 'flex', gap: 12, marginBottom: 18, flexWrap: 'wrap', alignItems: 'center' }}>
              <select value={activityFilter} onChange={e => { setActivityFilter(e.target.value); setActivityPage(0); loadActivity(0, e.target.value) }}
                style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 14px', color: 'var(--text-0)', fontSize: 14, cursor: 'pointer' }}>
                <option value="">All Actions</option>
                {['login', 'login_failed', 'signup', 'sync_push', 'sync_pull', 'export', 'feedback_submit', 'password_reset', 'page_view'].map(a => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
              <span style={{ fontSize: 13, color: 'var(--text-2)' }}>{activityTotal} events • auto-refreshes every 30s</span>
            </div>
            <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-2)' }}>
                      {['Timestamp', 'User / Email', 'Action', 'Details', 'IP'].map(h => (
                        <th key={h} style={{ padding: '10px 16px', textAlign: 'left', color: 'var(--text-2)', fontWeight: 500, whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {activity.length === 0 && <tr><td colSpan={5} style={{ padding: 32, textAlign: 'center', color: 'var(--text-2)' }}>No activity yet</td></tr>}
                    {activity.map((a, i) => (
                      <tr key={a.id} style={{ borderBottom: i < activity.length - 1 ? '1px solid var(--border-b)' : 'none' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-2)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                        <td style={{ padding: '9px 16px', color: 'var(--text-2)', whiteSpace: 'nowrap', fontSize: 12 }}>{fmtDateTime(a.created_at)}</td>
                        <td style={{ padding: '9px 16px', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.email || a.user_id?.slice(0, 8) || '—'}</td>
                        <td style={{ padding: '9px 16px' }}>
                          <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 5, background: a.action === 'login_failed' ? 'rgba(255,69,96,0.12)' : 'var(--bg-3)', color: a.action === 'login_failed' ? '#ff4560' : 'var(--text-1)', border: '1px solid var(--border)' }}>
                            {a.action}
                          </span>
                        </td>
                        <td style={{ padding: '9px 16px', color: 'var(--text-2)', fontSize: 12, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {a.details && Object.keys(a.details).length > 0 ? JSON.stringify(a.details).slice(0, 60) : '—'}
                        </td>
                        <td style={{ padding: '9px 16px', color: 'var(--text-2)', fontSize: 12, whiteSpace: 'nowrap' }}>{a.ip_address || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            {/* Pagination */}
            {activityTotal > 50 && (
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 16, alignItems: 'center' }}>
                <button disabled={activityPage === 0} onClick={() => { const p = activityPage - 1; setActivityPage(p); loadActivity(p, activityFilter) }}
                  style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 14px', color: activityPage === 0 ? 'var(--text-3)' : 'var(--text-0)', cursor: activityPage === 0 ? 'not-allowed' : 'pointer', fontSize: 13 }}>
                  ← Prev
                </button>
                <span style={{ fontSize: 13, color: 'var(--text-2)' }}>Page {activityPage + 1} of {Math.ceil(activityTotal / 50)}</span>
                <button disabled={(activityPage + 1) * 50 >= activityTotal} onClick={() => { const p = activityPage + 1; setActivityPage(p); loadActivity(p, activityFilter) }}
                  style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 14px', color: (activityPage + 1) * 50 >= activityTotal ? 'var(--text-3)' : 'var(--text-0)', cursor: (activityPage + 1) * 50 >= activityTotal ? 'not-allowed' : 'pointer', fontSize: 13 }}>
                  Next →
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── ANALYTICS ─────────────────────────────────────────────────────── */}
        {activeTab === 'analytics' && (
          <div>
            <p style={{ color: 'var(--text-2)', fontSize: 13, marginBottom: 20 }}>
              Analytics data will populate as users interact with the platform.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
              <StatCard label="Daily Active Users" value={analytics?.active_users.daily ?? '—'} icon={<IconUsers />} color="var(--blue)" />
              <StatCard label="Weekly Active Users" value={analytics?.active_users.weekly ?? '—'} icon={<IconUsers />} color="var(--accent)" />
              <StatCard label="Total Page Views" value={analytics?.page_views ?? '—'} icon={<IconEye />} color="var(--green)" />
            </div>

            {/* Signups chart */}
            <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 12, padding: 24, marginBottom: 20 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, color: 'var(--text-1)' }}>Signups — Last 30 Days</h3>
              {analytics?.signups_chart && (
                <SignupsChart data={analytics.signups_chart.slice(-14)} />
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              {/* Most used actions */}
              <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 12, padding: 20 }}>
                <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 14, color: 'var(--text-1)' }}>Top Actions</h3>
                {analytics?.top_actions?.length === 0 && <p style={{ color: 'var(--text-2)', fontSize: 13 }}>No data yet</p>}
                {(analytics?.top_actions || []).map(a => (
                  <div key={a.action} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border-b)', fontSize: 13 }}>
                    <span style={{ color: 'var(--text-0)' }}>{a.action}</span>
                    <span style={{ color: 'var(--text-2)', fontWeight: 600 }}>{a.count}</span>
                  </div>
                ))}
              </div>

              {/* Peak hours */}
              <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 12, padding: 20 }}>
                <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 14, color: 'var(--text-1)' }}>Peak Hours (UTC)</h3>
                {analytics?.peak_hours && <PeakHoursBar data={analytics.peak_hours} />}
              </div>
            </div>
          </div>
        )}

        {/* ── REVENUE ───────────────────────────────────────────────────────── */}
        {activeTab === 'revenue' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 28 }}>
              <StatCard label="MRR" value="$0" icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>} color="var(--green)" />
              <StatCard label="Active Subscribers" value="0" icon={<IconUsers />} color="var(--blue)" />
              <StatCard label="Churn Rate" value="0%" icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/></svg>} color="#f97316" />
              <StatCard label="Free→Pro Conversion" value="0%" icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>} color="var(--accent)" />
            </div>
            <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 12, padding: 32, textAlign: 'center' }}>
              <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'center' }}>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
                  <line x1="1" y1="10" x2="23" y2="10"/>
                </svg>
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Revenue tracking will activate when Stripe is connected</h3>
              <p style={{ color: 'var(--text-2)', fontSize: 14, marginBottom: 24, maxWidth: 400, margin: '0 auto 24px' }}>
                Connect Stripe to start tracking subscriptions, MRR, churn, and conversion metrics automatically.
              </p>
              <button disabled style={{ background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 24px', color: 'var(--text-2)', cursor: 'not-allowed', fontSize: 14, fontWeight: 600 }}>
                Connect Stripe (coming soon)
              </button>
            </div>
          </div>
        )}

        {/* ── EMAIL ─────────────────────────────────────────────────────────── */}
        {activeTab === 'email' && (
          <div>
            <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 12, padding: 24, marginBottom: 24 }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 18 }}>Compose Email</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 180 }}>
                    <label style={{ fontSize: 12, color: 'var(--text-2)', display: 'block', marginBottom: 6 }}>Audience</label>
                    <select value={emailAudience} onChange={e => setEmailAudience(e.target.value as 'all' | 'free' | 'pro')}
                      style={{ width: '100%', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 14px', color: 'var(--text-0)', fontSize: 14, cursor: 'pointer' }}>
                      <option value="all">All Users</option>
                      <option value="free">Free Users</option>
                      <option value="pro">Pro Users</option>
                    </select>
                  </div>
                  <div style={{ flex: 3, minWidth: 240 }}>
                    <label style={{ fontSize: 12, color: 'var(--text-2)', display: 'block', marginBottom: 6 }}>Subject</label>
                    <input value={emailSubject} onChange={e => setEmailSubject(e.target.value)} placeholder="Email subject…"
                      style={{ width: '100%', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 14px', color: 'var(--text-0)', fontSize: 14, outline: 'none' }} />
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: 12, color: 'var(--text-2)', display: 'block', marginBottom: 6 }}>Body</label>
                  <textarea value={emailBody} onChange={e => setEmailBody(e.target.value)} placeholder="Email body…" rows={6}
                    style={{ width: '100%', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 14px', color: 'var(--text-0)', fontSize: 14, outline: 'none', resize: 'vertical', fontFamily: 'inherit' }} />
                </div>
                <div>
                  {emailConfirm ? (
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 14, color: '#f97316', fontWeight: 600 }}>
                        Send to {emailAudience === 'all' ? 'all' : emailAudience} users?
                      </span>
                      <button onClick={sendEmail} disabled={emailSending}
                        style={{ background: '#f97316', border: 'none', borderRadius: 8, padding: '8px 20px', color: '#fff', cursor: emailSending ? 'not-allowed' : 'pointer', fontSize: 14, fontWeight: 600 }}>
                        {emailSending ? 'Sending…' : 'Confirm Send'}
                      </button>
                      <button onClick={() => setEmailConfirm(false)}
                        style={{ background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 16px', color: 'var(--text-1)', cursor: 'pointer', fontSize: 14 }}>
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => setEmailConfirm(true)} disabled={!emailSubject || !emailBody}
                      style={{ background: 'var(--accent)', border: 'none', borderRadius: 8, padding: '9px 24px', color: '#fff', cursor: emailSubject && emailBody ? 'pointer' : 'not-allowed', fontSize: 14, fontWeight: 600, opacity: !emailSubject || !emailBody ? 0.5 : 1 }}>
                      Send Email
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* History */}
            <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', fontWeight: 600, fontSize: 14 }}>Email History</div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-2)', borderBottom: '1px solid var(--border)' }}>
                      {['Date', 'Subject', 'Audience', 'Sent Count', 'Status'].map(h => (
                        <th key={h} style={{ padding: '10px 16px', textAlign: 'left', color: 'var(--text-2)', fontWeight: 500, whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sentEmails.length === 0 && <tr><td colSpan={5} style={{ padding: 32, textAlign: 'center', color: 'var(--text-2)' }}>No emails sent yet</td></tr>}
                    {sentEmails.map((e, i) => (
                      <tr key={e.id} style={{ borderBottom: i < sentEmails.length - 1 ? '1px solid var(--border-b)' : 'none' }}>
                        <td style={{ padding: '10px 16px', whiteSpace: 'nowrap', color: 'var(--text-2)' }}>{fmtDate(e.created_at)}</td>
                        <td style={{ padding: '10px 16px', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.subject}</td>
                        <td style={{ padding: '10px 16px', color: 'var(--text-1)', textTransform: 'capitalize' }}>{e.to_segment}</td>
                        <td style={{ padding: '10px 16px', color: 'var(--text-1)' }}>{e.sent_count}</td>
                        <td style={{ padding: '10px 16px' }}>
                          <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 5, fontWeight: 600, background: e.status === 'sent' ? 'rgba(34,197,94,0.12)' : e.status === 'failed' ? 'rgba(255,69,96,0.12)' : 'var(--bg-3)', color: e.status === 'sent' ? 'var(--green)' : e.status === 'failed' ? '#ff4560' : 'var(--text-2)', border: '1px solid var(--border)' }}>
                            {e.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── SECURITY ──────────────────────────────────────────────────────── */}
        {activeTab === 'security' && (
          <div>
            {/* Refresh + loading */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline', verticalAlign: 'middle', marginRight: 5 }}>
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>Security Dashboard
              </h2>
              <button onClick={() => loadSecurity()} disabled={secLoading}
                style={{ background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 14px', color: 'var(--text-1)', cursor: secLoading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, opacity: secLoading ? 0.6 : 1 }}>
                <IconRefresh /> {secLoading ? 'Refreshing…' : 'Refresh'}
              </button>
            </div>

            {/* ── 1. Overview Cards ─────────────────────────────────────────── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 24 }}>
              {/* Failed Logins 24h */}
              <div style={{ background: 'var(--bg-1)', border: `1px solid ${(secOverview?.failedLogins24h ?? 0) > 10 ? 'rgba(255,69,96,0.5)' : 'var(--border)'}`, borderRadius: 12, padding: '16px 20px' }}>
                <div style={{ fontSize: 11, color: 'var(--text-2)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Failed Logins (24h)</div>
                <div style={{ fontSize: 32, fontWeight: 700, color: (secOverview?.failedLogins24h ?? 0) > 10 ? '#ff4560' : 'var(--text-0)' }}>{secOverview?.failedLogins24h ?? '—'}</div>
                <div style={{ fontSize: 11, color: 'var(--text-2)', marginTop: 4 }}>7d: {secOverview?.failedLogins7d ?? '—'}</div>
              </div>
              {/* Unique Attacker IPs */}
              <div style={{ background: 'var(--bg-1)', border: `1px solid ${(secOverview?.uniqueAttackerIPs24h ?? 0) > 0 ? 'rgba(255,69,96,0.5)' : 'var(--border)'}`, borderRadius: 12, padding: '16px 20px' }}>
                <div style={{ fontSize: 11, color: 'var(--text-2)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Attacker IPs (24h)</div>
                <div style={{ fontSize: 32, fontWeight: 700, color: (secOverview?.uniqueAttackerIPs24h ?? 0) > 0 ? '#ff4560' : 'var(--text-0)' }}>{secOverview?.uniqueAttackerIPs24h ?? '—'}</div>
                <div style={{ fontSize: 11, color: 'var(--text-2)', marginTop: 4 }}>3+ failed attempts</div>
              </div>
              {/* Successful Logins */}
              <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 20px' }}>
                <div style={{ fontSize: 11, color: 'var(--text-2)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Successful Logins (24h)</div>
                <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--green)' }}>{secOverview?.successfulLogins24h ?? '—'}</div>
                <div style={{ fontSize: 11, color: 'var(--text-2)', marginTop: 4 }}>Active users: {secOverview?.activeUsers24h ?? '—'}</div>
              </div>
              {/* RLS Status */}
              <div style={{ background: 'var(--bg-1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 12, padding: '16px 20px' }}>
                <div style={{ fontSize: 11, color: 'var(--text-2)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>RLS Status</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--green)' }}>
                  {secOverview ? `${secOverview.rlsTablesProtected}/${secOverview.rlsTablesCount}` : '—'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--green)', marginTop: 4 }}>✓ Protected</div>
              </div>
              {/* SSL Expiry */}
              <div style={{ background: 'var(--bg-1)', border: `1px solid ${secOverview?.sslDaysLeft != null && secOverview.sslDaysLeft < 30 ? 'rgba(249,115,22,0.5)' : 'var(--border)'}`, borderRadius: 12, padding: '16px 20px' }}>
                <div style={{ fontSize: 11, color: 'var(--text-2)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>SSL Expiry</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: secOverview?.sslDaysLeft != null && secOverview.sslDaysLeft < 30 ? '#f97316' : 'var(--text-0)' }}>
                  {secOverview?.sslExpiry ? fmtDate(secOverview.sslExpiry) : '—'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-2)', marginTop: 4 }}>
                  {secOverview?.sslDaysLeft != null ? `${secOverview.sslDaysLeft}d left` : ''}
                </div>
              </div>
              {/* Pen Test Score */}
              <div style={{ background: 'var(--bg-1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 12, padding: '16px 20px' }}>
                <div style={{ fontSize: 11, color: 'var(--text-2)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Pen Test Score</div>
                <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--green)' }}>{secOverview?.penTestScore ?? '—'}</div>
                <div style={{ fontSize: 11, color: 'var(--text-2)', marginTop: 4 }}>{secOverview?.lastPenTest ? fmtDate(secOverview.lastPenTest) : ''}</div>
              </div>
            </div>

            {/* Security posture badges */}
            {secOverview && (
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 24 }}>
                <span style={{ fontSize: 12, padding: '4px 12px', borderRadius: 20, background: secOverview.cloudflareEnabled ? 'rgba(34,197,94,0.12)' : 'rgba(255,69,96,0.1)', color: secOverview.cloudflareEnabled ? 'var(--green)' : '#ff4560', border: `1px solid ${secOverview.cloudflareEnabled ? 'rgba(34,197,94,0.3)' : 'rgba(255,69,96,0.3)'}` }}>
                  {secOverview.cloudflareEnabled ? '✓ Cloudflare' : '✗ Cloudflare'}
                </span>
                <span style={{ fontSize: 12, padding: '4px 12px', borderRadius: 20, background: secOverview.wafEnabled ? 'rgba(34,197,94,0.12)' : 'rgba(255,69,96,0.1)', color: secOverview.wafEnabled ? 'var(--green)' : '#ff4560', border: `1px solid ${secOverview.wafEnabled ? 'rgba(34,197,94,0.3)' : 'rgba(255,69,96,0.3)'}` }}>
                  {secOverview.wafEnabled ? '✓ WAF' : '✗ WAF'}
                </span>
                <span style={{ fontSize: 12, padding: '4px 12px', borderRadius: 20, background: secOverview.auditStatus === 'PASS' ? 'rgba(34,197,94,0.12)' : 'rgba(249,115,22,0.1)', color: secOverview.auditStatus === 'PASS' ? 'var(--green)' : '#f97316', border: `1px solid ${secOverview.auditStatus === 'PASS' ? 'rgba(34,197,94,0.3)' : 'rgba(249,115,22,0.3)'}` }}>
                  Audit: {secOverview.auditStatus}
                </span>
                <span style={{ fontSize: 12, padding: '4px 12px', borderRadius: 20, background: 'rgba(74,158,255,0.1)', color: 'var(--blue)', border: '1px solid rgba(74,158,255,0.3)' }}>
                  Rate limit hits (24h): {secOverview.rateLimitHits24h}
                </span>
              </div>
            )}

            {/* ── 2. Threat Monitor ─────────────────────────────────────────── */}
            <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', marginBottom: 20 }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontWeight: 600, fontSize: 14 }}>Threat Monitor</span>
                <span style={{ fontSize: 12, color: 'var(--text-2)' }}>IPs with 3+ failed attempts (24h)</span>
                {secIPThreats.length > 0 && <span style={{ marginLeft: 'auto', background: 'rgba(255,69,96,0.12)', color: '#ff4560', border: '1px solid rgba(255,69,96,0.3)', borderRadius: 10, fontSize: 11, padding: '2px 8px', fontWeight: 700 }}>{secIPThreats.length} threat{secIPThreats.length !== 1 ? 's' : ''}</span>}
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-2)', borderBottom: '1px solid var(--border)' }}>
                      {['IP Address', 'Attempts', 'Targeted Emails', 'Last Attempt'].map(h => (
                        <th key={h} style={{ padding: '9px 16px', textAlign: 'left', color: 'var(--text-2)', fontWeight: 500, whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {secIPThreats.length === 0 && <tr><td colSpan={4} style={{ padding: 28, textAlign: 'center', color: 'var(--text-2)' }}>✓ No active threats detected</td></tr>}
                    {secIPThreats.map((t, i) => (
                      <tr key={t.ip_address} style={{ borderBottom: i < secIPThreats.length - 1 ? '1px solid var(--border-b)' : 'none', background: t.attempts >= 5 ? 'rgba(255,69,96,0.05)' : 'transparent' }}>
                        <td style={{ padding: '10px 16px', fontFamily: 'monospace', fontSize: 12, color: t.attempts >= 5 ? '#ff4560' : 'var(--text-0)', fontWeight: t.attempts >= 5 ? 700 : 400 }}>{t.ip_address}</td>
                        <td style={{ padding: '10px 16px' }}>
                          <span style={{ fontWeight: 700, color: t.attempts >= 5 ? '#ff4560' : t.attempts >= 3 ? '#f97316' : 'var(--text-0)', fontSize: 14 }}>{t.attempts}</span>
                        </td>
                        <td style={{ padding: '10px 16px', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-1)', fontSize: 12 }}>
                          {t.targeted_emails.length > 0 ? t.targeted_emails.join(', ') : '—'}
                        </td>
                        <td style={{ padding: '10px 16px', color: 'var(--text-2)', whiteSpace: 'nowrap', fontSize: 12 }}>{fmtDateTime(t.last_attempt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ── 3. Recent Failed Logins ───────────────────────────────────── */}
            <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', marginBottom: 20 }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontWeight: 600, fontSize: 14 }}>Recent Failed Logins</span>
                <span style={{ fontSize: 12, color: 'var(--text-2)' }}>Last 100 attempts</span>
                <button onClick={() => setFailedLoginSort(s => s === 'desc' ? 'asc' : 'desc')}
                  style={{ marginLeft: 'auto', background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 10px', color: 'var(--text-2)', cursor: 'pointer', fontSize: 12 }}>
                  {failedLoginSort === 'desc' ? '↓ Newest first' : '↑ Oldest first'}
                </button>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-2)', borderBottom: '1px solid var(--border)' }}>
                      {['Timestamp', 'IP Address', 'Email', 'User Agent'].map(h => (
                        <th key={h} style={{ padding: '9px 16px', textAlign: 'left', color: 'var(--text-2)', fontWeight: 500, whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {secFailedLogins.length === 0 && <tr><td colSpan={4} style={{ padding: 28, textAlign: 'center', color: 'var(--text-2)' }}>No failed logins recorded</td></tr>}
                    {[...secFailedLogins]
                      .sort((a, b) => failedLoginSort === 'desc'
                        ? new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                        : new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
                      )
                      .map((f, i) => {
                        const age = Date.now() - new Date(f.created_at).getTime()
                        const rowColor = age < 3600000 ? 'rgba(255,69,96,0.08)' : age < 21600000 ? 'rgba(249,115,22,0.06)' : 'transparent'
                        const textColor = age < 3600000 ? '#ff4560' : age < 21600000 ? '#f97316' : 'var(--text-2)'
                        return (
                          <tr key={i} style={{ borderBottom: i < secFailedLogins.length - 1 ? '1px solid var(--border-b)' : 'none', background: rowColor }}>
                            <td style={{ padding: '9px 16px', color: textColor, fontSize: 12, whiteSpace: 'nowrap' }}>{fmtDateTime(f.created_at)}</td>
                            <td style={{ padding: '9px 16px', fontFamily: 'monospace', fontSize: 12, color: 'var(--text-1)' }}>{f.ip_address || '—'}</td>
                            <td style={{ padding: '9px 16px', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.email || '—'}</td>
                            <td style={{ padding: '9px 16px', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-2)', fontSize: 12 }}>{f.user_agent || '—'}</td>
                          </tr>
                        )
                      })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ── 4. Active Sessions ────────────────────────────────────────── */}
            <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', marginBottom: 20 }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontWeight: 600, fontSize: 14 }}>Active Sessions (last 24h)</span>
                <span style={{ background: 'rgba(34,197,94,0.12)', color: 'var(--green)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 10, fontSize: 11, padding: '2px 8px', fontWeight: 700 }}>{secActiveSessions.length} online</span>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-2)', borderBottom: '1px solid var(--border)' }}>
                      {['Email', 'User ID', 'IP', 'Last Seen', 'User Agent'].map(h => (
                        <th key={h} style={{ padding: '9px 16px', textAlign: 'left', color: 'var(--text-2)', fontWeight: 500, whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {secActiveSessions.length === 0 && <tr><td colSpan={5} style={{ padding: 28, textAlign: 'center', color: 'var(--text-2)' }}>No active sessions</td></tr>}
                    {secActiveSessions.map((s, i) => (
                      <tr key={i} style={{ borderBottom: i < secActiveSessions.length - 1 ? '1px solid var(--border-b)' : 'none' }}>
                        <td style={{ padding: '9px 16px', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.email || '—'}</td>
                        <td style={{ padding: '9px 16px', fontFamily: 'monospace', fontSize: 11, color: 'var(--text-2)' }}>{s.user_id?.slice(0, 8) || '—'}</td>
                        <td style={{ padding: '9px 16px', fontFamily: 'monospace', fontSize: 12, color: 'var(--text-1)' }}>{s.ip_address || '—'}</td>
                        <td style={{ padding: '9px 16px', color: 'var(--text-2)', whiteSpace: 'nowrap', fontSize: 12 }}>{fmtDateTime(s.last_seen)}</td>
                        <td style={{ padding: '9px 16px', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-2)', fontSize: 12 }}>{s.user_agent || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ── 5. Live Activity Feed ─────────────────────────────────────── */}
            <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontWeight: 600, fontSize: 14 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }}>
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
              </svg>Live Security Feed</span>
                <span style={{ fontSize: 12, color: 'var(--text-2)' }}>auto-refreshes every 30s</span>
              </div>
              <div style={{ padding: '4px 0' }}>
                {secActivityFeed.length === 0 && <div style={{ padding: 28, textAlign: 'center', color: 'var(--text-2)', fontSize: 13 }}>No recent security events</div>}
                {secActivityFeed.map((ev, i) => {
                  const isError = ev.action === 'login_failed'
                  const isSuccess = ev.action === 'login'
                  const isBlue = ev.action === 'signup' || ev.action === 'password_reset'
                  const color = isError ? '#ff4560' : isSuccess ? 'var(--green)' : isBlue ? 'var(--blue)' : 'var(--text-2)'
                  const bg = isError ? 'rgba(255,69,96,0.06)' : isSuccess ? 'rgba(34,197,94,0.04)' : isBlue ? 'rgba(74,158,255,0.06)' : 'transparent'
                  const icon = isError ? '●' : isSuccess ? '●' : isBlue ? '●' : '○'
                  return (
                    <div key={ev.id || i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 20px', borderBottom: i < secActivityFeed.length - 1 ? '1px solid var(--border-b)' : 'none', background: bg, fontSize: 13 }}>
                      <span style={{ fontSize: 14, flexShrink: 0 }}>{icon}</span>
                      <span style={{ color, fontWeight: 600, minWidth: 120, fontSize: 12 }}>{ev.action}</span>
                      <span style={{ color: 'var(--text-1)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.email || '—'}</span>
                      <span style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--text-2)', flexShrink: 0 }}>{ev.ip_address || ''}</span>
                      <span style={{ fontSize: 12, color: 'var(--text-2)', whiteSpace: 'nowrap', flexShrink: 0 }}>{fmtDateTime(ev.created_at)}</span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* ── 6. Quick Actions Panel ────────────────────────────────────── */}
            <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 20px', marginTop: 20, marginBottom: 20 }}>
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 14 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }}>
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
              </svg>Quick Actions</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                <button onClick={() => { const r = secReports.find(x => x.type === 'pen_test'); if (r) openReport(r.filename) }}
                  disabled={!secReports.some(x => x.type === 'pen_test')}
                  style={{ background: 'rgba(74,158,255,0.1)', border: '1px solid rgba(74,158,255,0.3)', borderRadius: 8, padding: '8px 14px', color: 'var(--blue)', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }}>
                    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
                    <rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
                  </svg>View Latest Pen Test
                </button>
                <button onClick={() => { const r = secReports.find(x => x.type === 'weekly_audit' || x.type === 'deep_review'); if (r) openReport(r.filename) }}
                  disabled={!secReports.some(x => x.type === 'weekly_audit' || x.type === 'deep_review')}
                  style={{ background: 'rgba(74,158,255,0.1)', border: '1px solid rgba(74,158,255,0.3)', borderRadius: 8, padding: '8px 14px', color: 'var(--blue)', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }}>
                    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
                    <rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
                  </svg>View Latest Audit
                </button>
                <button onClick={() => exportFile('failed-logins-csv')}
                  style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 8, padding: '8px 14px', color: 'var(--green)', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
Export Failed Logins (CSV)
                </button>
                <button onClick={() => exportFile('activity-csv')}
                  style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 8, padding: '8px 14px', color: 'var(--green)', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
Export Activity Log (CSV)
                </button>
                <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 14px', fontSize: 13, color: 'var(--text-2)', display: 'flex', alignItems: 'center', gap: 6 }}>
Security monitor runs every 30 min
                </div>
              </div>
            </div>

            {/* ── 7. System Status ──────────────────────────────────────────── */}
            {secOverview && (
              <div style={{ background: 'var(--bg-1)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 12, padding: '16px 20px', marginBottom: 20 }}>
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 14 }}>Security Infrastructure Status</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10 }}>
                  {[
                    { label: 'Cloudflare', ok: secOverview.cloudflareEnabled, note: 'Active (proxied)' },
                    { label: 'WAF', ok: secOverview.wafEnabled, note: 'Enabled' },
                    { label: 'Bot Fight Mode', ok: true, note: 'On' },
                    { label: 'AI Labyrinth', ok: true, note: 'On' },
                    { label: 'RLS', ok: true, note: `${secOverview.rlsTablesProtected}/${secOverview.rlsTablesCount} tables protected` },
                    { label: 'Rate Limiting', ok: true, note: 'auth: 5/15min · general: 1000/15min' },
                    { label: 'Backups', ok: true, note: 'Daily 3AM ET → Google Drive' },
                    { label: 'Monitoring', ok: true, note: 'Every 30 min → #security' },
                    { label: 'Weekly Audit', ok: true, note: 'Mondays 6AM ET' },
                    { label: 'Monthly Pen Test', ok: true, note: '15th of month 2AM ET' },
                    { label: 'Deep Review', ok: true, note: '1st of month 10AM ET' },
                    { label: 'SSL Certificate', ok: (secOverview.sslDaysLeft ?? 99) > 30, note: secOverview.sslExpiry ? `Valid until ${fmtDate(secOverview.sslExpiry)} (${secOverview.sslDaysLeft}d left)` : 'Unknown' },
                  ].map(item => (
                    <div key={item.label} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 12px', background: 'var(--bg-2)', borderRadius: 8, border: `1px solid ${item.ok ? 'rgba(34,197,94,0.15)' : 'rgba(255,69,96,0.2)'}` }}>
                      <span style={{ fontSize: 14, flexShrink: 0 }}>
                      {item.ok ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                      ) : (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      )}
                    </span>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-0)' }}>{item.label}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 2 }}>{item.note}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── 8. Security Reports ───────────────────────────────────────── */}
            <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', marginBottom: 20 }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontWeight: 600, fontSize: 14 }}>Security Reports</span>
                {secReports.length > 0 && (() => {
                  const latest = secReports[0]
                  return (
                    <span style={{ fontSize: 11, padding: '2px 10px', borderRadius: 12, background: 'rgba(34,197,94,0.12)', color: 'var(--green)', border: '1px solid rgba(34,197,94,0.3)', fontWeight: 700 }}>
                      Latest: {latest.score ?? latest.status ?? '—'}
                    </span>
                  )
                })()}
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-2)', borderBottom: '1px solid var(--border)' }}>
                      {['Date', 'Type', 'Score / Status', 'Findings', 'Actions'].map(h => (
                        <th key={h} style={{ padding: '9px 16px', textAlign: 'left', color: 'var(--text-2)', fontWeight: 500, whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {secReports.length === 0 && <tr><td colSpan={5} style={{ padding: 28, textAlign: 'center', color: 'var(--text-2)' }}>No reports found</td></tr>}
                    {secReports.map((r, i) => (
                      <tr key={r.filename} style={{ borderBottom: i < secReports.length - 1 ? '1px solid var(--border-b)' : 'none', cursor: 'pointer' }}
                        onClick={() => openReport(r.filename)}>
                        <td style={{ padding: '10px 16px', whiteSpace: 'nowrap' }}>{r.date ? fmtDate(r.date) : '—'}</td>
                        <td style={{ padding: '10px 16px' }}>
                          <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 5, background: r.type === 'pen_test' ? 'rgba(255,69,96,0.1)' : r.type === 'weekly_audit' ? 'rgba(74,158,255,0.1)' : 'var(--bg-3)', color: r.type === 'pen_test' ? '#ff4560' : r.type === 'weekly_audit' ? 'var(--blue)' : 'var(--text-2)', border: '1px solid transparent', fontWeight: 600, textTransform: 'uppercase' as const }}>
                            {r.type === 'pen_test' ? 'Pen Test' : r.type === 'weekly_audit' ? 'Weekly Audit' : r.type === 'deep_review' ? 'Deep Review' : r.type}
                          </span>
                        </td>
                        <td style={{ padding: '10px 16px', fontWeight: 600, color: r.score ? 'var(--green)' : r.status === 'PASS' ? 'var(--green)' : 'var(--text-2)' }}>
                          {r.score ?? r.status ?? '—'}
                        </td>
                        <td style={{ padding: '10px 16px', fontSize: 12, color: 'var(--text-2)' }}>
                          {r.findings ? (
                            <span>
                              {r.findings.critical > 0 && <span style={{ color: '#ff4560', fontWeight: 700 }}>C:{r.findings.critical} </span>}
                              {r.findings.high > 0 && <span style={{ color: '#f97316' }}>H:{r.findings.high} </span>}
                              {r.findings.medium > 0 && <span style={{ color: '#eab308' }}>M:{r.findings.medium} </span>}
                              <span>L:{r.findings.low} I:{r.findings.info}</span>
                            </span>
                          ) : '—'}
                        </td>
                        <td style={{ padding: '10px 16px' }} onClick={e => e.stopPropagation()}>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button onClick={() => openReport(r.filename)}
                              style={{ background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 5, padding: '4px 8px', fontSize: 11, cursor: 'pointer', color: 'var(--text-1)' }}>
                              View
                            </button>
                            <button onClick={() => exportFile(`pen-test-latest`)}
                              style={{ background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 5, padding: '4px 8px', fontSize: 11, cursor: 'pointer', color: 'var(--text-2)' }}>
↓
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ── 9. Security Score History Chart ───────────────────────────── */}
            {secScoreHistory.length > 0 && (
              <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 20px', marginBottom: 20 }}>
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 16 }}>Security Score History</div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 100, overflowX: 'auto', paddingBottom: 4 }}>
                  {secScoreHistory.map((entry, i) => {
                    const scoreVal = typeof entry.score === 'number' ? entry.score : (entry.status === 'PASS' ? 10 : 5)
                    const pct = (scoreVal / 10) * 80
                    const color = scoreVal >= 8 ? 'var(--green)' : scoreVal >= 6 ? '#eab308' : '#ff4560'
                    return (
                      <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minWidth: 48, flex: '0 0 auto' }}
                        title={`${entry.date} — ${entry.type}: ${entry.status ?? entry.score + '/10'}`}>
                        <div style={{ fontSize: 10, color: 'var(--text-2)', marginBottom: 2 }}>{scoreVal}/10</div>
                        <div style={{ width: 32, height: `${pct}px`, background: color, borderRadius: '4px 4px 0 0', minHeight: 4, transition: 'height 0.3s' }} />
                        <div style={{ fontSize: 9, color: 'var(--text-3)', textAlign: 'center', maxWidth: 48, wordBreak: 'break-word' as const }}>{entry.date?.slice(5)}</div>
                        <div style={{ fontSize: 9, color: 'var(--text-3)', textAlign: 'center' }}>{entry.type === 'pen_test' ? 'PT' : entry.type === 'weekly_audit' ? 'Audit' : entry.type.slice(0, 5)}</div>
                      </div>
                    )
                  })}
                </div>
                <div style={{ display: 'flex', gap: 16, marginTop: 12, fontSize: 11, color: 'var(--text-2)' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 12, height: 12, borderRadius: 2, background: 'var(--green)', display: 'inline-block' }} /> 8–10 (Good)</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 12, height: 12, borderRadius: 2, background: '#eab308', display: 'inline-block' }} /> 6–8 (OK)</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 12, height: 12, borderRadius: 2, background: '#ff4560', display: 'inline-block' }} /> &lt;6 (Action needed)</span>
                </div>
              </div>
            )}

            {/* ── 10. Alert History Log ─────────────────────────────────────── */}
            <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', marginBottom: 20 }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 600, fontSize: 14 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }}>
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
              </svg>Alert History</span>
                <input value={secAlertFilter} onChange={e => setSecAlertFilter(e.target.value)} placeholder="Search…"
                  style={{ background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 10px', color: 'var(--text-1)', fontSize: 12, width: 160, outline: 'none' }} />
                <select value={secAlertResultFilter} onChange={e => setSecAlertResultFilter(e.target.value as typeof secAlertResultFilter)}
                  style={{ background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px', color: 'var(--text-1)', fontSize: 12, cursor: 'pointer', outline: 'none' }}>
                  <option value="all">All results</option>
                  <option value="clean">Clean</option>
                  <option value="pass">Pass</option>
                  <option value="warning">Warning</option>
                  <option value="alert">Alert</option>
                  <option value="fail">Fail</option>
                </select>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-2)', borderBottom: '1px solid var(--border)' }}>
                      {['Timestamp', 'Type', 'Result', 'Details'].map(h => (
                        <th key={h} style={{ padding: '9px 16px', textAlign: 'left', color: 'var(--text-2)', fontWeight: 500, whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const q = secAlertFilter.toLowerCase()
                      const filtered = secAlertHistory.filter(a =>
                        (secAlertResultFilter === 'all' || a.result.toLowerCase() === secAlertResultFilter) &&
                        (!q || a.type.toLowerCase().includes(q) || a.details.toLowerCase().includes(q))
                      )
                      if (filtered.length === 0) return <tr><td colSpan={4} style={{ padding: 28, textAlign: 'center', color: 'var(--text-2)' }}>No alerts match filters</td></tr>
                      return filtered.map((a, i) => {
                        const isClean = a.result === 'clean' || a.result === 'pass'
                        const isWarn = a.result === 'warning'
                        const isAlert = a.result === 'alert' || a.result === 'fail'
                        const color = isAlert ? '#ff4560' : isWarn ? '#f97316' : 'var(--green)'
                        const bg = isAlert ? 'rgba(255,69,96,0.05)' : isWarn ? 'rgba(249,115,22,0.04)' : 'transparent'
                        return (
                          <tr key={i} style={{ borderBottom: i < filtered.length - 1 ? '1px solid var(--border-b)' : 'none', background: bg }}>
                            <td style={{ padding: '9px 16px', color: 'var(--text-2)', whiteSpace: 'nowrap', fontSize: 12 }}>{fmtDateTime(a.date)}</td>
                            <td style={{ padding: '9px 16px', fontSize: 12 }}>
                              <span style={{ padding: '2px 8px', borderRadius: 5, background: 'var(--bg-3)', border: '1px solid var(--border)', fontSize: 11, textTransform: 'uppercase' as const }}>{a.type}</span>
                            </td>
                            <td style={{ padding: '9px 16px' }}>
                              <span style={{ color, fontWeight: 600, fontSize: 12 }}>
                                {a.result}
                              </span>
                            </td>
                            <td style={{ padding: '9px 16px', color: 'var(--text-1)', fontSize: 12, maxWidth: 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.details}</td>
                          </tr>
                        )
                      })
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── HEALTH ────────────────────────────────────────────────────────── */}
        {activeTab === 'health' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
              <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 10, padding: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: health?.api.status === 'ok' ? 'var(--green)' : 'var(--red)', flexShrink: 0 }} />
                  <span style={{ fontWeight: 600 }}>API Server</span>
                </div>
                {health ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 7, fontSize: 13 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-2)' }}>Uptime</span><span style={{ color: 'var(--green)' }}>{health.api.uptimeFormatted}</span></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-2)' }}>Node</span><span>{health.api.nodeVersion}</span></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-2)' }}>Env</span><span>{health.api.env}</span></div>
                  </div>
                ) : <div style={{ color: 'var(--text-2)', fontSize: 13 }}>Loading…</div>}
              </div>
              <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 10, padding: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: health?.database.status === 'ok' ? 'var(--green)' : 'var(--red)', flexShrink: 0 }} />
                  <span style={{ fontWeight: 600 }}>Database (Supabase)</span>
                </div>
                {health ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 7, fontSize: 13 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-2)' }}>Status</span><span style={{ color: health.database.status === 'ok' ? 'var(--green)' : 'var(--red)' }}>{health.database.status === 'ok' ? 'Connected' : 'Error'}</span></div>
                    {health.database.latencyMs !== null && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-2)' }}>Latency</span><span>{health.database.latencyMs}ms</span></div>}
                  </div>
                ) : <div style={{ color: 'var(--text-2)', fontSize: 13 }}>Loading…</div>}
              </div>
              <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 10, padding: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--blue)', flexShrink: 0 }} />
                  <span style={{ fontWeight: 600 }}>Last Deploy</span>
                </div>
                {health ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 7, fontSize: 13 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-2)' }}>Time</span><span>{fmtDateTime(health.deploy.lastDeploy)}</span></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-2)' }}>Version</span><span>{health.deploy.version}</span></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-2)' }}>Service</span><span>{health.deploy.renderService}</span></div>
                  </div>
                ) : <div style={{ color: 'var(--text-2)', fontSize: 13 }}>Loading…</div>}
              </div>
            </div>
            <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 10, padding: 20 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, color: 'var(--text-1)' }}>Quick Links</h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                {[
                  { label: 'Render Dashboard', url: 'https://dashboard.render.com' },
                  { label: 'Supabase Dashboard', url: 'https://supabase.com/dashboard' },
                  { label: 'Vercel Dashboard', url: 'https://vercel.com/dashboard' },
                  { label: 'GitHub Repo', url: 'https://github.com/ApexLogics' },
                ].map(link => (
                  <a key={link.label} href={link.url} target="_blank" rel="noopener noreferrer"
                    style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 14px', color: 'var(--text-1)', textDecoration: 'none', fontSize: 13 }}>
                    {link.label} <IconExternalLink />
                  </a>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Report Modal ─────────────────────────────────────────────────────── */}
      {(selectedReport || reportModalLoading) && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1001, padding: 24 }}
          onClick={() => setSelectedReport(null)}>
          <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 12, padding: 0, maxWidth: 860, width: '100%', maxHeight: '88vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{selectedReport?.filename ?? 'Loading…'}</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {selectedReport && (
                  <button onClick={() => exportFile('pen-test-latest')}
                    style={{ background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 10px', cursor: 'pointer', fontSize: 12, color: 'var(--text-1)', display: 'flex', alignItems: 'center', gap: 5 }}>
Download
                  </button>
                )}
                <button onClick={() => setSelectedReport(null)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-2)', fontSize: 22, padding: '0 4px', lineHeight: 1 }}>×</button>
              </div>
            </div>
            <div style={{ overflow: 'auto', flex: 1, padding: '20px 24px' }}>
              {reportModalLoading && <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-2)' }}>Loading report…</div>}
              {selectedReport && (
                <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 13, lineHeight: 1.7, color: 'var(--text-1)', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', margin: 0 }}>
                  {selectedReport.content}
                </pre>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Modal ─────────────────────────────────────────────────────── */}
      {deleteTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 24 }}>
          <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 12, padding: 28, maxWidth: 400, width: '100%' }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 10, color: 'var(--red)' }}>Delete User?</h3>
            <p style={{ color: 'var(--text-1)', fontSize: 14, marginBottom: 6 }}>This will permanently delete:</p>
            <p style={{ color: 'var(--text-0)', fontWeight: 600, fontSize: 14, background: 'var(--bg-3)', padding: '8px 12px', borderRadius: 6, marginBottom: 20, wordBreak: 'break-all' }}>{deleteTarget.email}</p>
            <p style={{ color: 'var(--text-2)', fontSize: 13, marginBottom: 24 }}>This action cannot be undone.</p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setDeleteTarget(null)} disabled={deleting}
                style={{ background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 20px', color: 'var(--text-1)', cursor: 'pointer', fontSize: 14 }}>Cancel</button>
              <button onClick={deleteUser} disabled={deleting}
                style={{ background: 'rgba(255,69,96,0.15)', border: '1px solid rgba(255,69,96,0.4)', borderRadius: 8, padding: '8px 20px', color: 'var(--red)', cursor: deleting ? 'not-allowed' : 'pointer', fontSize: 14, fontWeight: 600 }}>
                {deleting ? 'Deleting…' : 'Delete User'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── View Data Modal ──────────────────────────────────────────────────── */}
      {viewDataUser && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 24 }}>
          <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 12, padding: 28, maxWidth: 540, width: '100%', maxHeight: '80vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Synced Data</h3>
                <p style={{ fontSize: 13, color: 'var(--text-2)' }}>{viewDataUser.email}</p>
              </div>
              <button onClick={() => setViewDataUser(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-2)', fontSize: 20, padding: 4 }}>×</button>
            </div>
            <div style={{ overflow: 'auto', flex: 1 }}>
              {loadingUserData && <div style={{ color: 'var(--text-2)', textAlign: 'center', padding: 32 }}>Loading…</div>}
              {!loadingUserData && userData.length === 0 && <div style={{ color: 'var(--text-2)', textAlign: 'center', padding: 32 }}>No synced data for this user</div>}
              {!loadingUserData && userData.length > 0 && (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-3)', borderBottom: '1px solid var(--border)' }}>
                      {['Data Key', 'Size', 'Last Updated'].map(h => (
                        <th key={h} style={{ padding: '8px 14px', textAlign: 'left', color: 'var(--text-2)', fontWeight: 500 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {userData.map((d, i) => (
                      <tr key={d.key} style={{ borderBottom: i < userData.length - 1 ? '1px solid var(--border-b)' : 'none' }}>
                        <td style={{ padding: '9px 14px', fontFamily: 'monospace', fontSize: 12 }}>{d.key}</td>
                        <td style={{ padding: '9px 14px', color: 'var(--text-2)' }}>{(d.size_bytes / 1024).toFixed(1)} KB</td>
                        <td style={{ padding: '9px 14px', color: 'var(--text-2)', whiteSpace: 'nowrap' }}>{fmtDate(d.updated_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div style={{ marginTop: 16, fontSize: 12, color: 'var(--text-2)', textAlign: 'center' }}>Read-only view</div>
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
        <div style={{ fontSize: 28, fontWeight: 700, lineHeight: 1.1, color: badge && Number(value) > 0 ? '#f97316' : 'var(--text-0)' }}>{value}</div>
        <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 3 }}>{label}</div>
      </div>
    </div>
  )
}

function TierBadge({ tier }: { tier: 'free' | 'pro' }) {
  const isPro = tier === 'pro'
  return (
    <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 5, background: isPro ? 'rgba(74,158,255,0.15)' : 'var(--bg-3)', color: isPro ? 'var(--blue)' : 'var(--text-2)', border: `1px solid ${isPro ? 'rgba(74,158,255,0.3)' : 'var(--border)'}`, textTransform: 'uppercase' }}>
      {tier}
    </span>
  )
}

function TypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = { bug: '#ff4560', feature: 'var(--blue)', general: 'var(--text-1)' }
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

function SignupsChart({ data }: { data: { date: string; count: number }[] }) {
  const max = Math.max(...data.map(d => d.count), 1)
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 80 }}>
      {data.map(d => (
        <div key={d.date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }} title={`${d.date}: ${d.count}`}>
          <div style={{ width: '100%', background: d.count > 0 ? 'var(--accent)' : 'var(--bg-3)', borderRadius: '3px 3px 0 0', height: `${Math.max((d.count / max) * 64, d.count > 0 ? 4 : 0)}px`, minHeight: d.count > 0 ? 4 : 0, transition: 'height 0.3s' }} />
          <span style={{ fontSize: 9, color: 'var(--text-3)', transform: 'rotate(-45deg)', whiteSpace: 'nowrap' }}>{d.date.slice(5)}</span>
        </div>
      ))}
    </div>
  )
}

function PeakHoursBar({ data }: { data: { hour: number; count: number }[] }) {
  const max = Math.max(...data.map(d => d.count), 1)
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 60 }}>
      {data.map(d => (
        <div key={d.hour} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }} title={`${d.hour}:00 UTC — ${d.count} events`}>
          <div style={{ width: '100%', background: d.count > 0 ? 'var(--blue)' : 'var(--bg-3)', borderRadius: '2px 2px 0 0', height: `${Math.max((d.count / max) * 48, d.count > 0 ? 2 : 0)}px` }} />
          {d.hour % 6 === 0 && <span style={{ fontSize: 9, color: 'var(--text-3)' }}>{d.hour}h</span>}
        </div>
      ))}
    </div>
  )
}
