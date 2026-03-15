'use client'

/**
 * /pricing — TradVue Pro pricing page
 *
 * Shows both plans (monthly / annual) with toggle.
 * Authenticated users are taken to Stripe Checkout.
 * Unauthenticated users are prompted to sign up first.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../context/AuthContext'
import { API_BASE } from '../lib/api'

// ── Types ──────────────────────────────────────────────────────────────────────

interface PriceOption {
  priceId: string
  amount: number
  amountPerMonth?: number
  currency: string
  interval: string
  label: string
  savingsPercent?: number
}

// ── Features list ──────────────────────────────────────────────────────────────

const FEATURES = [
  { icon: '📊', text: 'Unlimited trade journal history' },
  { icon: '☁️', text: 'Cloud auto-sync across all devices' },
  { icon: '📥', text: 'Full CSV import/export — no date restrictions' },
  { icon: '🧠', text: 'Advanced analytics & reports' },
  { icon: '📈', text: 'Unlimited portfolio positions' },
  { icon: '🔔', text: 'Price alerts (unlimited)' },
  { icon: '⚡', text: 'Priority support & early feature access' },
  { icon: '🔒', text: 'Secure Stripe billing — cancel anytime' },
]

// ── Component ──────────────────────────────────────────────────────────────────

export default function PricingPage() {
  const { user, token } = useAuth()
  const router = useRouter()
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'annual'>('annual')
  const [loadingCheckout, setLoadingCheckout] = useState(false)
  const [checkoutError, setCheckoutError] = useState<string | null>(null)

  async function handleSubscribe(plan: 'monthly' | 'annual') {
    if (!user || !token) {
      // Not logged in — push to auth, then back to pricing
      router.push('/?next=/pricing')
      return
    }

    setCheckoutError(null)
    setLoadingCheckout(true)

    try {
      // Fetch price IDs from backend
      const pricesRes = await fetch(`${API_BASE}/api/stripe/prices`)
      const prices: { monthly: PriceOption; annual: PriceOption } = await pricesRes.json()
      if (!pricesRes.ok || !prices.monthly || !prices.annual) {
        throw new Error('Failed to load pricing')
      }

      const priceId = plan === 'monthly' ? prices.monthly.priceId : prices.annual.priceId

      const res = await fetch(`${API_BASE}/api/stripe/create-checkout-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ priceId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Checkout failed')
      if (data.url) window.location.href = data.url
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Something went wrong'
      setCheckoutError(msg)
    } finally {
      setLoadingCheckout(false)
    }
  }

  const isAnnual = billingPeriod === 'annual'
  const selectedPlan = billingPeriod

  return (
    <div style={pageStyle}>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ textAlign: 'center', marginBottom: 48 }}>
        <div style={proBadgeStyle}>
          ⚡ TradVue Pro
        </div>
        <h1 style={h1Style}>
          Serious traders deserve<br />serious tools.
        </h1>
        <p style={subtitleStyle}>
          One plan. Everything included. Cancel anytime.
        </p>

        {/* ── Billing toggle ───────────────────────────────────────────────── */}
        <div style={toggleWrapStyle}>
          <button
            onClick={() => setBillingPeriod('monthly')}
            style={toggleBtnStyle(!isAnnual)}
          >
            Monthly
          </button>
          <button
            onClick={() => setBillingPeriod('annual')}
            style={toggleBtnStyle(isAnnual)}
          >
            Annual
            <span style={{
              marginLeft: 6,
              fontSize: 10,
              fontWeight: 700,
              padding: '2px 6px',
              borderRadius: 10,
              background: isAnnual ? '#22c55e22' : 'rgba(34,197,94,0.15)',
              color: '#22c55e',
              border: '1px solid rgba(34,197,94,0.3)',
            }}>
              SAVE 30%
            </span>
          </button>
        </div>
      </div>

      {/* ── Pricing card ───────────────────────────────────────────────────── */}
      <div style={{ maxWidth: 420, margin: '0 auto', width: '100%' }}>
        <div style={cardStyle}>
          {/* Price display */}
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            {isAnnual ? (
              <>
                <div style={priceDisplayStyle}>
                  $16.80
                  <span style={pricePeriodStyle}>/mo</span>
                </div>
                <div style={{ fontSize: 14, color: 'var(--text-2, #9ca3af)', marginTop: 4 }}>
                  Billed $201.60/year · <span style={{ color: '#22c55e' }}>Save $86.40/yr</span>
                </div>
              </>
            ) : (
              <>
                <div style={priceDisplayStyle}>
                  $24
                  <span style={pricePeriodStyle}>/mo</span>
                </div>
                <div style={{ fontSize: 14, color: 'var(--text-2, #9ca3af)', marginTop: 4 }}>
                  Billed monthly · Cancel anytime
                </div>
              </>
            )}
          </div>

          {/* Features */}
          <ul style={{ margin: '0 0 28px', padding: 0 }}>
            {FEATURES.map((f, i) => (
              <li key={i} style={featureRowStyle}>
                <span style={featureIconStyle}>{f.icon}</span>
                <span style={{ fontSize: 14, color: 'var(--text-1, #d1d5db)' }}>{f.text}</span>
              </li>
            ))}
          </ul>

          {/* CTA */}
          {checkoutError && (
            <div style={{ color: '#f87171', fontSize: 13, textAlign: 'center', marginBottom: 12 }}>
              {checkoutError}
            </div>
          )}

          <button
            disabled={loadingCheckout}
            onClick={() => handleSubscribe(selectedPlan)}
            style={ctaBtnStyle(loadingCheckout)}
            onMouseEnter={e => { if (!loadingCheckout) e.currentTarget.style.opacity = '0.88' }}
            onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}
          >
            {loadingCheckout
              ? 'Redirecting to checkout…'
              : user
                ? `Subscribe ${isAnnual ? 'Annual' : 'Monthly'} →`
                : 'Sign up to subscribe →'}
          </button>

          {/* Trust */}
          <p style={{ fontSize: 12, color: 'var(--text-3, #6b7280)', textAlign: 'center', marginTop: 16 }}>
            🔒 Secure checkout via Stripe · No contracts · Cancel anytime
          </p>
        </div>

        {/* Free trial note */}
        <div style={{
          marginTop: 20,
          textAlign: 'center',
          padding: '16px 20px',
          background: 'rgba(99,102,241,0.08)',
          border: '1px solid rgba(99,102,241,0.2)',
          borderRadius: 12,
        }}>
          <span style={{ fontSize: 18 }}>🎉</span>
          <div style={{ fontSize: 14, color: 'var(--text-1, #d1d5db)', marginTop: 6 }}>
            <strong>New accounts get a 3-week free trial.</strong>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-2, #9ca3af)', marginTop: 4 }}>
            Full Pro access for 21 days — no credit card required.
          </div>
        </div>

        {/* Compare tiers */}
        <div style={{ marginTop: 40 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, textAlign: 'center', color: 'var(--text-0, #f9fafb)', marginBottom: 20 }}>
            Free vs Pro
          </h2>
          <CompareTable />
        </div>
      </div>
    </div>
  )
}

// ── Compare table ──────────────────────────────────────────────────────────────

function CompareTable() {
  const rows = [
    { feature: 'Trade journal', free: '30-day window', pro: 'Unlimited history' },
    { feature: 'CSV import', free: 'Last 30 days only', pro: 'Any date range' },
    { feature: 'CSV export', free: 'Last 30 days only', pro: 'Full export' },
    { feature: 'Cloud sync', free: '—', pro: '✓ All devices' },
    { feature: 'Advanced reports', free: '—', pro: '✓ Full access' },
    { feature: 'Portfolio positions', free: 'Limited', pro: 'Unlimited' },
    { feature: 'Price alerts', free: '3 alerts', pro: 'Unlimited' },
    { feature: 'Support', free: 'Community', pro: 'Priority' },
  ]

  return (
    <div style={{
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 12,
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', background: 'rgba(255,255,255,0.03)', padding: '10px 16px' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-2, #9ca3af)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Feature</div>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-2, #9ca3af)', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'center' }}>Free</div>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#a78bfa', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'center' }}>Pro ⚡</div>
      </div>
      {rows.map((row, i) => (
        <div key={i} style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          padding: '10px 16px',
          borderTop: '1px solid rgba(255,255,255,0.05)',
          background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)',
        }}>
          <div style={{ fontSize: 13, color: 'var(--text-1, #d1d5db)' }}>{row.feature}</div>
          <div style={{ fontSize: 13, color: 'var(--text-2, #9ca3af)', textAlign: 'center' }}>{row.free}</div>
          <div style={{ fontSize: 13, color: '#a78bfa', textAlign: 'center', fontWeight: 600 }}>{row.pro}</div>
        </div>
      ))}
    </div>
  )
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const pageStyle: React.CSSProperties = {
  minHeight: '100vh',
  padding: '64px 20px 80px',
  background: 'var(--bg-0, #111827)',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
}

const proBadgeStyle: React.CSSProperties = {
  display: 'inline-block',
  background: 'linear-gradient(135deg, rgba(99,102,241,0.25), rgba(168,85,247,0.25))',
  border: '1px solid rgba(99,102,241,0.4)',
  borderRadius: 20,
  padding: '5px 14px',
  fontSize: 13,
  fontWeight: 700,
  color: '#a78bfa',
  letterSpacing: '0.04em',
  marginBottom: 20,
}

const h1Style: React.CSSProperties = {
  fontSize: 40,
  fontWeight: 900,
  color: 'var(--text-0, #f9fafb)',
  letterSpacing: '-0.03em',
  lineHeight: 1.15,
  margin: '0 0 12px',
}

const subtitleStyle: React.CSSProperties = {
  fontSize: 16,
  color: 'var(--text-2, #9ca3af)',
  margin: '0 0 32px',
}

const toggleWrapStyle: React.CSSProperties = {
  display: 'inline-flex',
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 12,
  padding: 4,
  gap: 4,
}

function toggleBtnStyle(active: boolean): React.CSSProperties {
  return {
    padding: '8px 18px',
    borderRadius: 9,
    border: 'none',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    background: active ? 'rgba(99,102,241,0.25)' : 'transparent',
    color: active ? '#a78bfa' : 'var(--text-2, #9ca3af)',
    transition: 'all 0.15s',
  }
}

const cardStyle: React.CSSProperties = {
  background: 'linear-gradient(160deg, rgba(99,102,241,0.1), rgba(139,92,246,0.06))',
  border: '1.5px solid rgba(99,102,241,0.4)',
  borderRadius: 24,
  padding: '36px 32px',
  boxShadow: '0 0 40px rgba(99,102,241,0.12)',
}

const priceDisplayStyle: React.CSSProperties = {
  fontSize: 56,
  fontWeight: 900,
  color: 'var(--text-0, #f9fafb)',
  letterSpacing: '-0.04em',
  lineHeight: 1,
}

const pricePeriodStyle: React.CSSProperties = {
  fontSize: 20,
  fontWeight: 400,
  color: 'var(--text-2, #9ca3af)',
}

const featureRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '9px 0',
  listStyle: 'none',
  borderBottom: '1px solid rgba(255,255,255,0.05)',
}

const featureIconStyle: React.CSSProperties = {
  width: 28,
  height: 28,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  fontSize: 16,
}

function ctaBtnStyle(loading: boolean): React.CSSProperties {
  return {
    width: '100%',
    padding: '15px 20px',
    background: loading ? 'rgba(99,102,241,0.5)' : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    border: 'none',
    borderRadius: 14,
    color: '#fff',
    fontSize: 16,
    fontWeight: 700,
    cursor: loading ? 'wait' : 'pointer',
    letterSpacing: '-0.01em',
    transition: 'opacity 0.15s',
  }
}
