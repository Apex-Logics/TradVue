'use client'

/**
 * /account — TradVue subscription management page
 *
 * Shows:
 *   - Current plan & status (from /api/stripe/subscription-status)
 *   - "Manage Subscription" → Stripe Customer Portal
 *   - Success message when returning from Stripe Checkout
 *   - Upgrade CTA for free users
 *
 * Query params handled:
 *   ?session_id=...   — returned from successful checkout (show success banner)
 *   ?canceled=true    — user cancelled checkout (show cancellation note)
 */

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useAuth } from '../context/AuthContext'
import { API_BASE } from '../lib/api'
import PricingCard from '../components/PricingCard'

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

// ── Main component (wrapped in Suspense for useSearchParams) ───────────────────

function AccountPageInner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { user, token, loading: authLoading } = useAuth()

  const sessionId = searchParams.get('session_id')
  const canceled = searchParams.get('canceled')

  const [sub, setSub] = useState<SubscriptionStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [portalLoading, setPortalLoading] = useState(false)
  const [portalError, setPortalError] = useState<string | null>(null)

  // Fetch subscription status when we have an auth token
  useEffect(() => {
    if (authLoading) return
    if (!token) {
      setLoading(false)
      return
    }

    fetch(`${API_BASE}/api/stripe/subscription-status`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then((data: SubscriptionStatus) => setSub(data))
      .catch(err => console.error('[Account] Failed to load subscription:', err))
      .finally(() => setLoading(false))
  }, [token, authLoading])

  // Clean up URL params after showing the banners
  useEffect(() => {
    if (sessionId || canceled) {
      const timeout = setTimeout(() => {
        router.replace('/account')
      }, 8000)
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
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          returnUrl: `${window.location.origin}/account`,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to open portal')
      if (data.url) window.location.href = data.url
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Something went wrong'
      setPortalError(msg)
    } finally {
      setPortalLoading(false)
    }
  }

  // ── Auth loading ───────────────────────────────────────────────────────────
  if (authLoading) {
    return (
      <div style={pageStyle}>
        <div style={{ color: 'var(--text-2, #9ca3af)', padding: '40px 0', textAlign: 'center' }}>
          Loading…
        </div>
      </div>
    )
  }

  // ── Not logged in ──────────────────────────────────────────────────────────
  if (!user || !token) {
    return (
      <div style={pageStyle}>
        <div style={cardWrap}>
          <h1 style={headingStyle}>Account</h1>
          <p style={{ color: 'var(--text-2, #9ca3af)', marginBottom: 24 }}>
            Please sign in to manage your subscription.
          </p>
          <button
            onClick={() => router.push('/')}
            style={primaryBtnStyle}
          >
            Go to sign in →
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={pageStyle}>
      <div style={cardWrap}>

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

        {/* ── Cancelled banner ────────────────────────────────────────────── */}
        {canceled && (
          <div style={bannerStyle('#374151', '#d1d5db', '#9ca3af')}>
            <span style={{ fontSize: 20 }}>ℹ️</span>
            <div>
              <strong>Checkout cancelled</strong><br />
              <span style={{ fontSize: 13 }}>No charge was made. You can subscribe anytime below.</span>
            </div>
          </div>
        )}

        <h1 style={headingStyle}>Account</h1>
        <p style={{ color: 'var(--text-2, #9ca3af)', marginBottom: 28, fontSize: 14 }}>
          {user.email}
        </p>

        {loading ? (
          <div style={{ color: 'var(--text-2, #9ca3af)', padding: '40px 0', textAlign: 'center' }}>
            Loading subscription…
          </div>
        ) : sub?.tier === 'pro' ? (
          /* ── Pro subscription card ───────────────────────────────────── */
          <div style={subCardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <span style={proBadge}>⚡ PRO</span>
              <span style={{ fontSize: 14, color: 'var(--text-0, #f9fafb)', fontWeight: 600 }}>
                {sub.plan || 'TradVue Pro'}
              </span>
              {sub.cancelAtPeriodEnd && (
                <span style={cancelBadge}>Cancels {fmtDate(sub.cancelAt || sub.renewalDate)}</span>
              )}
            </div>

            <div style={detailGrid}>
              <DetailRow label="Status" value={
                sub.status === 'active' ? '✅ Active' :
                sub.status === 'trialing' ? '🕐 Trial' :
                sub.status === 'past_due' ? '⚠️ Payment past due' :
                sub.status
              } />
              <DetailRow label="Amount" value={fmtAmount(sub.amount, sub.currency, sub.interval)} />
              {sub.cancelAtPeriodEnd ? (
                <DetailRow label="Access until" value={fmtDate(sub.cancelAt || sub.renewalDate)} />
              ) : (
                <DetailRow label="Next billing" value={fmtDate(sub.renewalDate)} />
              )}
            </div>

            {portalError && (
              <div style={{ color: '#f87171', fontSize: 13, marginBottom: 12 }}>
                {portalError}
              </div>
            )}

            <button
              onClick={handleManageSubscription}
              disabled={portalLoading}
              style={{ ...primaryBtnStyle, marginTop: 8 }}
            >
              {portalLoading ? 'Opening portal…' : 'Manage Subscription →'}
            </button>

            <p style={{ fontSize: 12, color: 'var(--text-3, #6b7280)', marginTop: 12 }}>
              Change plan, cancel, or update payment info via the Stripe portal.
            </p>
          </div>
        ) : (
          /* ── Free / no subscription ──────────────────────────────────── */
          <div>
            <div style={{ ...subCardStyle, marginBottom: 32, background: 'rgba(255,255,255,0.03)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <span style={freeBadge}>FREE</span>
                <span style={{ fontSize: 14, color: 'var(--text-1, #d1d5db)' }}>
                  TradVue Free
                </span>
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-2, #9ca3af)', margin: 0 }}>
                Upgrade to Pro to unlock unlimited trade history, cloud sync, and advanced analytics.
              </p>
            </div>

            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20, color: 'var(--text-0, #f9fafb)' }}>
              Upgrade to TradVue Pro
            </h2>
            <PricingCard userId={user.id} email={user.email} token={token} />
          </div>
        )}
      </div>
    </div>
  )
}

// ── Wrapper with Suspense (required for useSearchParams) ──────────────────────

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

// ── Sub-components ─────────────────────────────────────────────────────────────

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
      <span style={{ fontSize: 13, color: 'var(--text-2, #9ca3af)' }}>{label}</span>
      <span style={{ fontSize: 13, color: 'var(--text-0, #f9fafb)', fontWeight: 500 }}>{value}</span>
    </div>
  )
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const pageStyle: React.CSSProperties = {
  minHeight: '100vh',
  padding: '60px 20px',
  display: 'flex',
  justifyContent: 'center',
  background: 'var(--bg-0, #111827)',
}

const cardWrap: React.CSSProperties = {
  width: '100%',
  maxWidth: 580,
}

const headingStyle: React.CSSProperties = {
  fontSize: 32,
  fontWeight: 800,
  color: 'var(--text-0, #f9fafb)',
  letterSpacing: '-0.02em',
  margin: '0 0 4px',
}

const subCardStyle: React.CSSProperties = {
  background: 'var(--bg-1, #1a1a2e)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 16,
  padding: '24px 20px',
  marginBottom: 24,
}

const detailGrid: React.CSSProperties = {
  marginBottom: 16,
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

const freeBadge: React.CSSProperties = {
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
