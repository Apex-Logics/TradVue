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

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '../context/AuthContext'
import { useSettings } from '../context/SettingsContext'
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

// ── Main component ─────────────────────────────────────────────────────────────

function AccountPageInner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { user, token, loading: authLoading } = useAuth()
  const { settings, setAiCoachEnabled, setNotificationsEnabled, requestNotifications, openSettings } = useSettings()

  const sessionId = searchParams.get('session_id')
  const canceled = searchParams.get('canceled')

  const [sub, setSub] = useState<SubscriptionStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [portalLoading, setPortalLoading] = useState(false)
  const [portalError, setPortalError] = useState<string | null>(null)

  // Export state
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const [exportSuccess, setExportSuccess] = useState(false)

  // Delete account state
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

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
          <div style={{ fontSize: 40, marginBottom: 16 }}>🔒</div>
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
            <span style={{ fontSize: 20 }}>🎉</span>
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
                <span style={{ ...proBadge }}>⚡ Pro</span>
              ) : trialActive ? (
                <span style={{ color: '#4ade80', fontWeight: 600 }}>
                  Free · Trial ({daysLeft}d left)
                </span>
              ) : (
                <span style={{ ...freeBadgeStyle }}>Free</span>
              )
            }
          />
        </SectionCard>

        {/* ── Subscription ─────────────────────────────────────────────────── */}
        <SectionCard title="Subscription">
          {loading ? (
            <div style={{ color: 'var(--text-2)', fontSize: 14 }}>Loading subscription…</div>
          ) : sub?.tier === 'pro' ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <span style={proBadge}>⚡ PRO</span>
                <span style={{ fontSize: 14, color: 'var(--text-0)', fontWeight: 600 }}>
                  {sub.plan || 'TradVue Pro'}
                </span>
                {sub.cancelAtPeriodEnd && (
                  <span style={cancelBadge}>Cancels {fmtDate(sub.cancelAt || sub.renewalDate)}</span>
                )}
              </div>

              <DetailRow label="Status" value={
                sub.status === 'active' ? '✅ Active' :
                sub.status === 'trialing' ? '🕐 Trial' :
                sub.status === 'past_due' ? '⚠️ Payment past due' :
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
              🗑 Delete My Account
            </button>
          </div>
        </SectionCard>

        {/* ── Notifications ─────────────────────────────────────────────────── */}
        <SectionCard title="Notifications">
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-0)', marginBottom: 4 }}>
                Push Notifications
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-2)' }}>
                {settings.notificationPermission === 'denied'
                  ? 'Blocked by browser — update in browser settings'
                  : settings.notificationsEnabled
                  ? 'Enabled — you\'ll receive alerts for price movements'
                  : 'Click to enable push alerts'
                }
              </div>
            </div>
            <button
              onClick={async () => {
                if (settings.notificationPermission === 'denied') return
                if (!settings.notificationsEnabled || settings.notificationPermission === 'default') {
                  await requestNotifications()
                } else {
                  setNotificationsEnabled(false)
                }
              }}
              disabled={settings.notificationPermission === 'denied'}
              aria-pressed={settings.notificationsEnabled}
              aria-label="Toggle push notifications"
              style={{
                flexShrink: 0,
                width: 44,
                height: 24,
                borderRadius: 12,
                border: 'none',
                background: settings.notificationsEnabled ? '#6366f1' : 'rgba(255,255,255,0.12)',
                cursor: settings.notificationPermission === 'denied' ? 'not-allowed' : 'pointer',
                position: 'relative',
                opacity: settings.notificationPermission === 'denied' ? 0.5 : 1,
                transition: 'background 0.2s',
              }}
            >
              <span style={{
                position: 'absolute',
                top: 3,
                left: settings.notificationsEnabled ? 23 : 3,
                width: 18,
                height: 18,
                borderRadius: '50%',
                background: '#fff',
                transition: 'left 0.2s',
              }} />
            </button>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 12 }}>
            You can also manage notifications in{' '}
            <button
              onClick={openSettings}
              style={{ background: 'none', border: 'none', color: 'var(--accent, #6366f1)', cursor: 'pointer', fontSize: 12, padding: 0 }}
            >
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
            <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
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
