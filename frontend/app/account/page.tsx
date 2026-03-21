'use client'

/**
 * /account — TradVue full account management page
 *
 * Sections:
 *   - Profile (email, created date, current tier)
 *   - Subscription (plan, manage, upgrade)
 *   - AI & Privacy (AI Coach toggle, privacy policy link)
 *   - Data Management (export, delete account)
 *   - Notifications
 *
 * Query params handled:
 *   ?session_id=...   — returned from successful checkout (show success banner)
 *   ?canceled=true    — user cancelled checkout (show cancellation note)
 */

import { useEffect, useState, useCallback, Suspense } from 'react'
import dynamic from 'next/dynamic'
const NinjaTraderConnect = dynamic(() => import('../components/NinjaTraderConnect'), { ssr: false })
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '../context/AuthContext'
import { useSettings } from '../context/SettingsContext'
import { useToast } from '../context/ToastContext'
import { API_BASE } from '../lib/api'
import { getUserTier, isTrialActive, TRIAL_DAYS, MONTHLY_PRICE, ANNUAL_PRICE } from '../utils/tierAccess'
import PricingCard from '../components/PricingCard'
import PersistentNav from '../components/PersistentNav'

// ── Types ──────────────────────────────────────────────────────────────────────

interface SubscriptionStatus {
  tier: 'free' | 'pro'
  plan: string | null
  status: string
  renewalDate: string | null
  cancelAt: string | null
  cancelAtPeriodEnd: boolean
  amount: number | null
  currency: string
  interval: 'month' | 'year' | null
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

function fmtAmount(amount: number | null, currency: string, interval: string | null): string {
  if (!amount) return '—'
  const sym = currency === 'usd' ? '$' : currency.toUpperCase() + ' '
  const periodLabel = interval === 'year' ? '/year' : '/month'
  return `${sym}${amount.toFixed(2)}${periodLabel}`
}

function trialDaysRemaining(createdAt: string | undefined): number {
  if (!createdAt) return 0
  const created = new Date(createdAt)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24))
  return Math.max(0, TRIAL_DAYS - diffDays)
}

// ── Reset Password Row ────────────────────────────────────────────────────────

function ResetPasswordRow({ email }: { email?: string }) {
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleReset = async () => {
    if (!email) return
    setLoading(true)
    setError(null)
    try {
      await fetch(`${API_BASE}/api/auth/forgot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      })
      setSent(true)
    } catch {
      setError('Network error — please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
      <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 8 }}>Security</div>
      {sent ? (
        <div style={{ fontSize: 13, color: '#4ade80' }}>
          ✓ Password reset email sent to {email}
        </div>
      ) : (
        <>
          <button
            onClick={handleReset}
            disabled={loading || !email}
            style={{
              background: 'none',
              border: '1px solid var(--border)',
              borderRadius: 6,
              color: 'var(--text-1)',
              cursor: loading || !email ? 'not-allowed' : 'pointer',
              fontSize: 13,
              padding: '7px 14px',
              opacity: loading || !email ? 0.5 : 1,
              transition: 'border-color 0.15s, color 0.15s',
            }}
            onMouseEnter={e => { if (!loading && email) (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--accent)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)' }}
          >
            {loading ? 'Sending…' : 'Send Password Reset Email'}
          </button>
          {error && <div style={{ fontSize: 12, color: '#f87171', marginTop: 6 }}>{error}</div>}
        </>
      )}
    </div>
  )
}

// ── Section Card ──────────────────────────────────────────────────────────────

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: 'var(--bg-1, #1a1a2e)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 16,
      padding: '24px 20px',
      marginBottom: 20,
    }}>
      <h2 style={{
        fontSize: 13,
        fontWeight: 700,
        color: 'var(--text-3, #6b7280)',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        margin: '0 0 20px',
      }}>
        {title}
      </h2>
      {children}
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
      <span style={{ fontSize: 13, color: 'var(--text-2, #9ca3af)' }}>{label}</span>
      <span style={{ fontSize: 13, color: 'var(--text-0, #f9fafb)', fontWeight: 500 }}>{value}</span>
    </div>
  )
}

function ToggleRow({ label, description, checked, disabled = false, onChange }: {
  label: string
  description: string
  checked: boolean
  disabled?: boolean
  onChange: () => void
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 14 }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: disabled ? 'var(--text-3)' : 'var(--text-0)', marginBottom: 3 }}>
          {label}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-3)', lineHeight: 1.5 }}>{description}</div>
      </div>
      <button
        onClick={disabled ? undefined : onChange}
        aria-pressed={checked}
        aria-label={label}
        disabled={disabled}
        style={{
          flexShrink: 0,
          width: 44,
          height: 24,
          borderRadius: 12,
          border: 'none',
          background: checked && !disabled ? '#6366f1' : 'rgba(255,255,255,0.10)',
          cursor: disabled ? 'not-allowed' : 'pointer',
          position: 'relative',
          opacity: disabled ? 0.45 : 1,
          transition: 'background 0.2s',
        }}
      >
        <span style={{
          position: 'absolute',
          top: 3,
          left: checked && !disabled ? 23 : 3,
          width: 18,
          height: 18,
          borderRadius: '50%',
          background: '#fff',
          transition: 'left 0.2s',
        }} />
      </button>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

function AccountPageInner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { user, token, loading: authLoading } = useAuth()
  const { settings, setAiCoachEnabled, setNotificationsEnabled, requestNotifications, openSettings } = useSettings()
  const { showToast } = useToast()

  const sessionId = searchParams.get('session_id')
  const canceled = searchParams.get('canceled')

  const [sub, setSub] = useState<SubscriptionStatus | null>(null)
  const [showNTConnect, setShowNTConnect] = useState(false)
  const [ntConnected, setNtConnected] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)
  const [portalLoading, setPortalLoading] = useState(false)
  const [portalError, setPortalError] = useState<string | null>(null)

  // Price alert notification prefs (loaded from API, defaults both OFF)
  const [alertPrefs, setAlertPrefs] = useState({ email_enabled: false, push_price_alerts: false })
  const [alertPrefsLoading, setAlertPrefsLoading] = useState(false)
  const [alertPrefsSaved, setAlertPrefsSaved] = useState(false)

  // Export state
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const [exportSuccess, setExportSuccess] = useState(false)

  // Delete account state
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  // Disconnect NinjaTrader state
  const [ntTokens, setNtTokens] = useState<{ id: number; is_active: boolean }[]>([])
  const [showDisconnectModal, setShowDisconnectModal] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)

  // Fetch subscription status
  useEffect(() => {
    if (authLoading) return
    if (!token) { setLoading(false); return }

    fetch(`${API_BASE}/api/stripe/subscription-status`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then((data: SubscriptionStatus) => setSub(data))
      .catch(err => console.error('[Account] Failed to load subscription:', err))
      .finally(() => setLoading(false))
  }, [token, authLoading])

  // Check NinjaTrader connection status
  useEffect(() => {
    if (!token) return
    fetch(API_BASE + '/api/webhooks/tokens', {
      headers: { Authorization: 'Bearer ' + token },
    })
      .then(r => r.json())
      .then(data => {
        const list: { id: number; is_active: boolean }[] = Array.isArray(data) ? data : (data.tokens ?? [])
        setNtTokens(list)
        setNtConnected(list.some((t: { is_active: boolean }) => t.is_active))
      })
      .catch(() => setNtConnected(false))
  }, [token])

  // Load price alert notification prefs
  useEffect(() => {
    if (!token) return
    setAlertPrefsLoading(true)
    fetch(`${API_BASE}/api/alerts/price/prefs`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(data => {
        if (data?.prefs) setAlertPrefs({
          email_enabled:     data.prefs.email_enabled     ?? false,
          push_price_alerts: data.prefs.push_price_alerts ?? false,
        })
      })
      .catch(() => {})
      .finally(() => setAlertPrefsLoading(false))
  }, [token])

  // Save price alert prefs
  const saveAlertPrefs = useCallback(async (next: { email_enabled: boolean; push_price_alerts: boolean }) => {
    if (!token) return
    setAlertPrefs(next)
    try {
      await fetch(`${API_BASE}/api/alerts/price/prefs`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(next),
      })
      setAlertPrefsSaved(true)
      setTimeout(() => setAlertPrefsSaved(false), 2500)
    } catch {}
  }, [token])

  // Clean up URL params after showing banners
  useEffect(() => {
    if (sessionId || canceled) {
      const timeout = setTimeout(() => router.replace('/account'), 8000)
      return () => clearTimeout(timeout)
    }
  }, [sessionId, canceled, router])

  async function handleManageSubscription() {
    if (!token) return
    setPortalError(null)
    setPortalLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/stripe/create-portal-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ returnUrl: `${window.location.origin}/account` }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to open portal')
      if (data.url) window.location.href = data.url
    } catch (err: unknown) {
      setPortalError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setPortalLoading(false)
    }
  }

  async function handleDisconnectNT() {
    if (!token) return
    setDisconnecting(true)
    try {
      const activeTokens = ntTokens.filter(t => t.is_active)
      await Promise.all(
        activeTokens.map(t =>
          fetch(`${API_BASE}/api/webhooks/tokens/${t.id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
          })
        )
      )
      setNtConnected(false)
      setNtTokens([])
      setShowDisconnectModal(false)
      showToast('NinjaTrader disconnected. Your trade history is preserved.', 'success', 5000)
    } catch {
      showToast('Failed to disconnect. Please try again.', 'error')
    } finally {
      setDisconnecting(false)
    }
  }

  async function handleExportData() {
    if (!token) return
    setExportError(null)
    setExportSuccess(false)
    setExporting(true)
    try {
      const res = await fetch(`${API_BASE}/api/user/export-data`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.status === 429) {
        throw new Error('Export rate limit reached. You can export once per hour.')
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Export failed')
      }
      // Download as file
      const blob = await res.blob()
      const contentDisposition = res.headers.get('Content-Disposition') || ''
      const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/)
      const filename = filenameMatch?.[1] || 'tradvue-export.json'
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
      setExportSuccess(true)
      setTimeout(() => setExportSuccess(false), 5000)
    } catch (err: unknown) {
      setExportError(err instanceof Error ? err.message : 'Export failed')
    } finally {
      setExporting(false)
    }
  }

  async function handleDeleteAccount() {
    if (!token || deleteConfirmText !== 'DELETE') return
    setDeleteError(null)
    setDeleteLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/user/delete-account`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Account deletion failed')
      // Success — sign out and redirect
      router.push('/?deleted=true')
    } catch (err: unknown) {
      setDeleteError(err instanceof Error ? err.message : 'Something went wrong')
      setDeleteLoading(false)
    }
  }

  // ── Loading state ──────────────────────────────────────────────────────────
  if (authLoading) {
    return (
      <div style={pageStyle}>
        <PersistentNav />
        <div style={{ color: 'var(--text-2, #9ca3af)', padding: '80px 0', textAlign: 'center' }}>Loading…</div>
      </div>
    )
  }

  // ── Not logged in ──────────────────────────────────────────────────────────
  if (!user || !token) {
    return (
      <div style={pageStyle}>
        <PersistentNav />
        <div style={{ maxWidth: 440, margin: '80px auto', padding: '0 20px', textAlign: 'center' }}>
          <div style={{ marginBottom: 16 }}><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg></div>
          <h1 style={headingStyle}>Sign in to manage your account</h1>
          <p style={{ color: 'var(--text-2, #9ca3af)', marginBottom: 24, fontSize: 14 }}>
            You need to be signed in to access account settings.
          </p>
          <button onClick={() => router.push('/')} style={primaryBtnStyle}>
            Go to sign in →
          </button>
        </div>
      </div>
    )
  }

  const tier = getUserTier(user)
  const trialActive = isTrialActive(user)
  const daysLeft = trialDaysRemaining(user.created_at)

  return (
    <div style={pageStyle}>
      <PersistentNav />

      <div style={{ maxWidth: 620, margin: '0 auto', padding: '32px 20px 80px' }}>

        {/* ── Success banner ──────────────────────────────────────────────── */}
        {sessionId && (
          <div style={bannerStyle('#065f46', '#6ee7b7', '#10b981')}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: "inline" }}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
            <div>
              <strong>Welcome to TradVue Pro!</strong><br />
              <span style={{ fontSize: 13 }}>Your subscription is active. All features are now unlocked.</span>
            </div>
          </div>
        )}

        {/* ── Cancelled banner ──────────────────────────────────────────── */}
        {canceled && (
          <div style={bannerStyle('#374151', '#d1d5db', '#9ca3af')}>
            <span style={{ fontSize: 20 }}>ℹ️</span>
            <div>
              <strong>Checkout cancelled</strong><br />
              <span style={{ fontSize: 13 }}>No charge was made. You can subscribe anytime below.</span>
            </div>
          </div>
        )}

        <h1 style={{ ...headingStyle, marginBottom: 28 }}>Account</h1>

        {/* ── Profile ─────────────────────────────────────────────────────── */}
        <SectionCard title="Profile">
          <DetailRow label="Email" value={user.email ?? '—'} />
          {user.created_at && (
            <DetailRow label="Member since" value={fmtDate(user.created_at)} />
          )}
          <DetailRow
            label="Current plan"
            value={
              tier === 'paid' ? (
                <span style={{ ...proBadge }}>Pro</span>
              ) : trialActive ? (
                <span style={{ color: '#4ade80', fontWeight: 600 }}>
                  Free · Trial ({daysLeft}d left)
                </span>
              ) : (
                <span style={{ ...freeBadgeStyle }}>Free</span>
              )
            }
          />
          <ResetPasswordRow email={user.email} />
        </SectionCard>

        {/* ── Subscription ─────────────────────────────────────────────────── */}
        <SectionCard title="Subscription">
          {loading ? (
            <div style={{ color: 'var(--text-2)', fontSize: 14 }}>Loading subscription…</div>
          ) : sub?.tier === 'pro' ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <span style={proBadge}>PRO</span>
                <span style={{ fontSize: 14, color: 'var(--text-0)', fontWeight: 600 }}>
                  {sub.plan || 'TradVue Pro'}
                </span>
                {sub.cancelAtPeriodEnd && (
                  <span style={cancelBadge}>Cancels {fmtDate(sub.cancelAt || sub.renewalDate)}</span>
                )}
              </div>

              <DetailRow label="Status" value={
                sub.status === 'active' ? 'Active' :
                sub.status === 'trialing' ? 'Trial' :
                sub.status === 'past_due' ? 'Payment past due' :
                sub.status
              } />
              <DetailRow label="Amount" value={fmtAmount(sub.amount, sub.currency, sub.interval)} />
              {sub.cancelAtPeriodEnd
                ? <DetailRow label="Access until" value={fmtDate(sub.cancelAt || sub.renewalDate)} />
                : <DetailRow label="Next billing" value={fmtDate(sub.renewalDate)} />
              }

              {portalError && (
                <div style={{ color: '#f87171', fontSize: 13, margin: '12px 0 0' }}>{portalError}</div>
              )}

              <button
                onClick={handleManageSubscription}
                disabled={portalLoading}
                style={{ ...primaryBtnStyle, marginTop: 16 }}
              >
                {portalLoading ? 'Opening portal…' : 'Manage Subscription →'}
              </button>
              <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 10 }}>
                Change plan, cancel, or update payment info via the Stripe portal.
              </p>
            </>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <span style={freeBadgeStyle}>FREE</span>
                <span style={{ fontSize: 14, color: 'var(--text-1)' }}>TradVue Free</span>
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-2)', margin: '0 0 20px' }}>
                {trialActive
                  ? `You're in your free trial (${daysLeft} days remaining). All Pro features are available.`
                  : `Upgrade to Pro for unlimited trade history, cloud sync, and advanced analytics.`
                }
              </p>
              <div style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 10,
                padding: '12px 16px',
                marginBottom: 20,
                fontSize: 13,
                color: 'var(--text-2)',
              }}>
                <strong style={{ color: 'var(--text-1)' }}>Pro pricing:</strong>{' '}
                ${MONTHLY_PRICE}/mo monthly · ${ANNUAL_PRICE}/mo billed annually
              </div>
              <PricingCard userId={user.id} email={user.email} token={token} />
            </>
          )}
        </SectionCard>

        {/* ── AI & Privacy ──────────────────────────────────────────────────── */}
        <SectionCard title="AI &amp; Privacy">
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-0)', marginBottom: 4 }}>
                AI Trade Coach
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6 }}>
                {settings.aiCoachEnabled
                  ? 'Enabled — trade patterns are analyzed to provide weekly insights.'
                  : 'Disabled — no trade data is sent for AI analysis.'
                }
              </div>
            </div>
            <button
              onClick={() => setAiCoachEnabled(!settings.aiCoachEnabled)}
              aria-pressed={settings.aiCoachEnabled}
              aria-label="Toggle AI Trade Coach"
              style={{
                flexShrink: 0,
                width: 44,
                height: 24,
                borderRadius: 12,
                border: 'none',
                background: settings.aiCoachEnabled ? '#6366f1' : 'rgba(255,255,255,0.12)',
                cursor: 'pointer',
                position: 'relative',
                transition: 'background 0.2s',
              }}
            >
              <span style={{
                position: 'absolute',
                top: 3,
                left: settings.aiCoachEnabled ? 23 : 3,
                width: 18,
                height: 18,
                borderRadius: '50%',
                background: '#fff',
                transition: 'left 0.2s',
              }} />
            </button>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 14, lineHeight: 1.7 }}>
            Your data is processed by OpenAI when AI Coach is enabled.{' '}
            <Link href="/legal/privacy" style={{ color: 'var(--accent, #6366f1)' }}>
              See our Privacy Policy
            </Link>
            {' '}for details.
          </p>
        </SectionCard>

        {/* ── Data Management ───────────────────────────────────────────────── */}
        <SectionCard title="Data Management">
          {/* Export */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-0)', marginBottom: 4 }}>
              Export My Data
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-2)', margin: '0 0 12px', lineHeight: 1.6 }}>
              Download a copy of all your trades, portfolio, playbooks, and ritual entries.
              Rate limit: 1 export per hour.
            </p>
            {exportError && (
              <div style={{ fontSize: 12, color: '#f87171', marginBottom: 8 }}>{exportError}</div>
            )}
            {exportSuccess && (
              <div style={{ fontSize: 12, color: '#4ade80', marginBottom: 8 }}>
                ✓ Export downloaded successfully.
              </div>
            )}
            <button
              onClick={handleExportData}
              disabled={exporting}
              data-testid="export-data-btn"
              style={{
                padding: '9px 18px',
                background: 'rgba(99,102,241,0.15)',
                border: '1px solid rgba(99,102,241,0.35)',
                borderRadius: 10,
                color: '#a78bfa',
                fontSize: 13,
                fontWeight: 600,
                cursor: exporting ? 'wait' : 'pointer',
              }}
            >
              {exporting ? 'Preparing export…' : '⬇ Export My Data'}
            </button>
          </div>

          <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#f87171', marginBottom: 4 }}>
              Delete My Account
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-2)', margin: '0 0 12px', lineHeight: 1.6 }}>
              Permanently delete your account and all associated data. This action is irreversible.
            </p>
            <button
              onClick={() => setShowDeleteModal(true)}
              data-testid="delete-account-btn"
              style={{
                padding: '9px 18px',
                background: 'rgba(248,113,113,0.1)',
                border: '1px solid rgba(248,113,113,0.3)',
                borderRadius: 10,
                color: '#f87171',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
Delete My Account
            </button>
          </div>
        </SectionCard>

        {/* ── NinjaTrader Integration ───────────────────────────────────────── */}
        <SectionCard title="NinjaTrader Integration">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-0, #f9fafb)', marginBottom: 4 }}>
                Auto-sync futures trades from NinjaTrader 8
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                <div style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: ntConnected === true ? 'var(--green, #10b981)' : 'var(--text-3, #6b7280)',
                  boxShadow: 'none',
                  flexShrink: 0,
                }} />
                <span style={{ fontSize: 13, color: ntConnected === true ? 'var(--green, #10b981)' : 'var(--text-2, #9ca3af)' }}>
                  {ntConnected === null ? 'Checking...' : ntConnected ? 'Connected' : 'Not set up'}
                </span>
              </div>
            </div>
            <button
              onClick={() => setShowNTConnect(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                background: 'transparent',
                border: '1px solid rgba(139,92,246,0.45)',
                borderRadius: 10,
                padding: '9px 18px',
                color: '#a78bfa',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 3l18 18M3 21l18-18" /><rect x="2" y="2" width="20" height="20" rx="4" />
              </svg>
              {ntConnected ? 'Manage Connection' : 'Setup NinjaTrader'}
            </button>
          </div>
          <p style={{ margin: '12px 0 0', fontSize: 12, color: 'var(--text-3, #6b7280)', lineHeight: 1.6 }}>
            Install the TradVue addon in NinjaTrader 8 and every real broker fill auto-journals — no manual entry needed.
          </p>
          {ntConnected && (
            <div style={{ marginTop: 12 }}>
              <button
                onClick={() => setShowDisconnectModal(true)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  background: 'transparent',
                  border: '1px solid rgba(248,113,113,0.4)',
                  borderRadius: 8,
                  padding: '7px 14px',
                  color: '#f87171',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/>
                </svg>
                Disconnect NinjaTrader
              </button>
            </div>
          )}
        </SectionCard>

        {/* ── Notifications ─────────────────────────────────────────────────── */}
        <SectionCard title="Notifications">

          {/* Browser push permission (master switch) */}
          <ToggleRow
            label="Enable Push Notifications (browser)"
            description={
              settings.notificationPermission === 'denied'
                ? 'Blocked in browser settings — update there to re-enable'
                : settings.notificationsEnabled
                ? 'Browser push is enabled'
                : 'Grant permission to receive push notifications'
            }
            checked={settings.notificationsEnabled}
            disabled={settings.notificationPermission === 'denied'}
            onChange={async () => {
              if (settings.notificationPermission === 'denied') return
              if (!settings.notificationsEnabled || settings.notificationPermission === 'default') {
                await requestNotifications()
              } else {
                setNotificationsEnabled(false)
              }
            }}
          />

          <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '16px 0' }} />
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 12 }}>
            Price Alert Notifications
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-3)', margin: '0 0 14px', lineHeight: 1.6 }}>
            Both options are <strong style={{ color: 'var(--text-2)' }}>off by default</strong>. You must explicitly opt in.
            Only ticker, direction, and price are included — never balances or P&amp;L.
          </p>

          {alertPrefsLoading ? (
            <div style={{ fontSize: 13, color: 'var(--text-3)', padding: '8px 0' }}>Loading preferences…</div>
          ) : (
            <>
              <ToggleRow
                label="Push notifications for price alerts"
                description={
                  !settings.notificationsEnabled
                    ? 'Enable browser push (above) first'
                    : alertPrefs.push_price_alerts
                    ? 'You\'ll receive a push when a price alert triggers'
                    : 'Off — won\'t send push for price alerts'
                }
                checked={alertPrefs.push_price_alerts}
                disabled={!settings.notificationsEnabled}
                onChange={() => saveAlertPrefs({ ...alertPrefs, push_price_alerts: !alertPrefs.push_price_alerts })}
              />

              <ToggleRow
                label="Email me when a price alert triggers"
                description={
                  !user?.email
                    ? 'No email address on your account'
                    : alertPrefs.email_enabled
                    ? `Alerts will be sent to ${user.email}`
                    : 'Off — won\'t send emails for price alerts'
                }
                checked={alertPrefs.email_enabled}
                disabled={!user?.email}
                onChange={() => saveAlertPrefs({ ...alertPrefs, email_enabled: !alertPrefs.email_enabled })}
              />
            </>
          )}

          {alertPrefsSaved && (
            <div style={{ fontSize: 12, color: '#4ade80', marginTop: 8 }}>✓ Preferences saved</div>
          )}

          <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '16px 0' }} />
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 12 }}>
            Daily Ritual Reminder
          </div>

          <ToggleRow
            label="Push notification for daily ritual reminder"
            description="Fires at 4:05 PM ET on market days — prompts you to log today's trades"
            checked={settings.notificationsEnabled}
            disabled={settings.notificationPermission === 'denied'}
            onChange={async () => {
              if (settings.notificationPermission === 'denied') return
              if (!settings.notificationsEnabled || settings.notificationPermission === 'default') {
                await requestNotifications()
              } else {
                setNotificationsEnabled(false)
              }
            }}
          />

          <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 14 }}>
            You can also manage notifications in{' '}
            <button onClick={openSettings} style={{ background: 'none', border: 'none', color: 'var(--accent, #6366f1)', cursor: 'pointer', fontSize: 12, padding: 0 }}>
              Settings
            </button>.
          </p>
        </SectionCard>


        {/* ── Disclaimer ── */}
        <div style={{
          marginTop: 32,
          padding: '12px 16px',
          background: 'rgba(255,255,255,0.03)',
          borderRadius: 8,
          border: '1px solid rgba(255,255,255,0.07)',
        }}>
          <p style={{ margin: 0, fontSize: 11, color: 'var(--text-3)', lineHeight: 1.6 }}>
            Account settings and data shown here reflect your TradVue profile only. TradVue is not a financial institution. Nothing on this platform constitutes financial advice, trading recommendations, or guarantees of any kind. This is not financial advice.
          </p>
        </div>

      </div>

      {/* ── Delete confirmation modal ────────────────────────────────────────── */}
      {showDeleteModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(0,0,0,0.75)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
          onClick={e => { if (e.target === e.currentTarget) setShowDeleteModal(false) }}
        >
          <div style={{
            background: 'var(--bg-1, #1a1a2e)',
            border: '1px solid rgba(248,113,113,0.3)',
            borderRadius: 16,
            padding: '32px 28px',
            maxWidth: 420,
            width: '100%',
          }}>
            <div style={{ marginBottom: 12 }}><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></div>
            <h3 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-0)', margin: '0 0 10px' }}>
              Delete your account?
            </h3>
            <p style={{ fontSize: 13, color: 'var(--text-2)', margin: '0 0 20px', lineHeight: 1.7 }}>
              This will permanently delete your account and all associated data within approximately 90 days
              per our{' '}
              <Link href="/legal/terms" style={{ color: '#f87171' }}>Terms of Service</Link>.
              This action cannot be undone.
            </p>
            <p style={{ fontSize: 13, color: 'var(--text-1)', margin: '0 0 8px', fontWeight: 600 }}>
              Type DELETE to confirm:
            </p>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={e => setDeleteConfirmText(e.target.value)}
              placeholder="DELETE"
              autoFocus
              style={{
                width: '100%',
                padding: '10px 14px',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(248,113,113,0.4)',
                borderRadius: 8,
                color: 'var(--text-0)',
                fontSize: 14,
                marginBottom: 16,
                boxSizing: 'border-box',
              }}
            />
            {deleteError && (
              <div style={{ fontSize: 12, color: '#f87171', marginBottom: 12 }}>{deleteError}</div>
            )}
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={handleDeleteAccount}
                disabled={deleteConfirmText !== 'DELETE' || deleteLoading}
                style={{
                  flex: 1,
                  padding: '11px 16px',
                  background: deleteConfirmText === 'DELETE' ? 'rgba(248,113,113,0.25)' : 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(248,113,113,0.4)',
                  borderRadius: 10,
                  color: deleteConfirmText === 'DELETE' ? '#f87171' : 'var(--text-3)',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: deleteConfirmText === 'DELETE' && !deleteLoading ? 'pointer' : 'not-allowed',
                }}
              >
                {deleteLoading ? 'Deleting…' : 'Delete Account'}
              </button>
              <button
                onClick={() => { setShowDeleteModal(false); setDeleteConfirmText(''); setDeleteError(null) }}
                style={{
                  flex: 1,
                  padding: '11px 16px',
                  background: 'transparent',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 10,
                  color: 'var(--text-1)',
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Disconnect NinjaTrader confirmation modal ───────────────────────── */}
      {showDisconnectModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(0,0,0,0.75)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
          onClick={e => { if (e.target === e.currentTarget) setShowDisconnectModal(false) }}
        >
          <div style={{
            background: 'var(--bg-1, #1a1a2e)',
            border: '1px solid rgba(248,113,113,0.25)',
            borderRadius: 16,
            padding: '32px 28px',
            maxWidth: 440,
            width: '100%',
          }}>
            <div style={{ marginBottom: 14 }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
            </div>
            <h3 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-0)', margin: '0 0 14px' }}>
              Disconnect NinjaTrader?
            </h3>
            <ul style={{ margin: '0 0 20px', padding: '0 0 0 18px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { icon: '🗑', text: 'Your webhook token will be permanently deleted' },
                { icon: '⏹', text: 'NinjaTrader will stop sending trade data to TradVue' },
                { icon: '✅', text: 'Your existing journal entries will NOT be deleted — all past trades are safe', safe: true },
                { icon: '🔄', text: 'You can reconnect anytime by generating a new token on the Integrations page' },
              ].map(item => (
                <li key={item.text} style={{ listStyle: 'none', marginLeft: -18, display: 'flex', gap: 9, fontSize: 13, color: item.safe ? '#4ade80' : 'var(--text-2)', lineHeight: 1.6 }}>
                  <span style={{ flexShrink: 0 }}>{item.icon}</span>
                  <span>{item.text}</span>
                </li>
              ))}
            </ul>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={handleDisconnectNT}
                disabled={disconnecting}
                style={{
                  flex: 1,
                  padding: '11px 16px',
                  background: 'rgba(248,113,113,0.15)',
                  border: '1px solid rgba(248,113,113,0.4)',
                  borderRadius: 10,
                  color: '#f87171',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: disconnecting ? 'wait' : 'pointer',
                  opacity: disconnecting ? 0.6 : 1,
                }}
              >
                {disconnecting ? 'Disconnecting…' : 'Disconnect'}
              </button>
              <button
                onClick={() => setShowDisconnectModal(false)}
                disabled={disconnecting}
                style={{
                  flex: 1,
                  padding: '11px 16px',
                  background: 'transparent',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 10,
                  color: 'var(--text-1)',
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showNTConnect && (
        <NinjaTraderConnect
          onClose={() => {
            setShowNTConnect(false)
            // Refresh status
            if (token) {
              fetch(API_BASE + '/api/webhooks/tokens', { headers: { Authorization: 'Bearer ' + token } })
                .then(r => r.json())
                .then(data => {
                  const list: { id: number; is_active: boolean }[] = Array.isArray(data) ? data : (data.tokens ?? [])
                  setNtTokens(list)
                  setNtConnected(list.some((t: { is_active: boolean }) => t.is_active))
                })
                .catch(() => {})
            }
          }}
        />
      )}
    </div>
  )
}

// ── Wrapper with Suspense ──────────────────────────────────────────────────────

export default function AccountPage() {
  return (
    <Suspense fallback={
      <div style={pageStyle}>
        <div style={{ color: 'var(--text-2, #9ca3af)', padding: 40 }}>Loading…</div>
      </div>
    }>
      <AccountPageInner />
    </Suspense>
  )
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const pageStyle: React.CSSProperties = {
  minHeight: '100vh',
  background: 'var(--bg-0, #111827)',
}

const headingStyle: React.CSSProperties = {
  fontSize: 28,
  fontWeight: 800,
  color: 'var(--text-0, #f9fafb)',
  letterSpacing: '-0.02em',
  margin: '0 0 4px',
}

const proBadge: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  padding: '3px 10px',
  borderRadius: 20,
  background: 'rgba(99,102,241,0.2)',
  border: '1px solid rgba(99,102,241,0.4)',
  color: '#a78bfa',
  letterSpacing: '0.05em',
}

const freeBadgeStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  padding: '3px 10px',
  borderRadius: 20,
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.12)',
  color: 'var(--text-2, #9ca3af)',
  letterSpacing: '0.05em',
}

const cancelBadge: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  padding: '2px 8px',
  borderRadius: 20,
  background: 'rgba(234,179,8,0.15)',
  border: '1px solid rgba(234,179,8,0.3)',
  color: '#fbbf24',
}

const primaryBtnStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  padding: '13px 20px',
  background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
  border: 'none',
  borderRadius: 12,
  color: '#fff',
  fontSize: 15,
  fontWeight: 700,
  cursor: 'pointer',
  transition: 'opacity 0.15s',
  letterSpacing: '-0.01em',
}

function bannerStyle(bg: string, text: string, border: string): React.CSSProperties {
  return {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 12,
    padding: '16px 20px',
    background: `${bg}33`,
    border: `1px solid ${border}44`,
    borderRadius: 12,
    marginBottom: 24,
    color: text,
    fontSize: 14,
    lineHeight: 1.5,
  }
}
