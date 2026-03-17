'use client'

/**
 * /pricing — TradVue pricing page
 *
 * Shows 3 tiers: No Account / Free / Pro with a full comparison table.
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

// ── Comparison data ────────────────────────────────────────────────────────────

type CellValue = { text: string; positive?: boolean; dim?: boolean }

interface CompareRow {
  feature: string
  noAccount: CellValue
  free: CellValue
  pro: CellValue
}

const COMPARE_ROWS: CompareRow[] = [
  {
    feature: 'Dashboard & market data',
    noAccount: { text: '✓ Full access', positive: true },
    free:      { text: '✓ Full access', positive: true },
    pro:       { text: '✓ Full access', positive: true },
  },
  {
    feature: '30+ trading calculators',
    noAccount: { text: '✓ All calculators', positive: true },
    free:      { text: '✓ All calculators', positive: true },
    pro:       { text: '✓ All calculators', positive: true },
  },
  {
    feature: 'News & economic calendar',
    noAccount: { text: '✓ Full access', positive: true },
    free:      { text: '✓ Full access', positive: true },
    pro:       { text: '✓ Full access', positive: true },
  },
  {
    feature: 'Trading journal',
    noAccount: { text: '✓ 3-week trial', positive: true },
    free:      { text: '30-day view window' },
    pro:       { text: '✓ Unlimited history', positive: true },
  },
  {
    feature: 'Portfolio tracker',
    noAccount: { text: '✓ 3-week trial', positive: true },
    free:      { text: '30-day view window' },
    pro:       { text: '✓ Unlimited', positive: true },
  },
  {
    feature: 'Prop firm tracker',
    noAccount: { text: '✓ 3-week trial', positive: true },
    free:      { text: '30-day view window' },
    pro:       { text: '✓ Unlimited', positive: true },
  },
  {
    feature: 'AI Trade Coach',
    noAccount: { text: '✓ 3-week trial', positive: true },
    free:      { text: '30-day view window' },
    pro:       { text: '✓ Full access', positive: true },
  },
  {
    feature: 'Playbooks & rituals',
    noAccount: { text: '✓ 3-week trial', positive: true },
    free:      { text: '30-day view window' },
    pro:       { text: '✓ Unlimited', positive: true },
  },
  {
    feature: 'CSV import/export',
    noAccount: { text: '✓ 3-week trial', positive: true },
    free:      { text: 'Last 30 days only' },
    pro:       { text: '✓ Any date range', positive: true },
  },
  {
    feature: 'Cloud sync',
    noAccount: { text: '—', dim: true },
    free:      { text: '—', dim: true },
    pro:       { text: '✓ All devices', positive: true },
  },
  {
    feature: 'Broker auto-sync',
    noAccount: { text: '—', dim: true },
    free:      { text: '—', dim: true },
    pro:       { text: '✓ Coming soon', positive: true },
  },
  {
    feature: 'Advanced reports',
    noAccount: { text: '—', dim: true },
    free:      { text: '—', dim: true },
    pro:       { text: '✓ Full access', positive: true },
  },
  {
    feature: 'Price alerts',
    noAccount: { text: '—', dim: true },
    free:      { text: '3 alerts' },
    pro:       { text: '✓ Unlimited', positive: true },
  },
  {
    feature: 'Support',
    noAccount: { text: 'Community' },
    free:      { text: 'Community' },
    pro:       { text: 'Priority', positive: true },
  },
  {
    feature: 'Account required',
    noAccount: { text: 'No' },
    free:      { text: 'Yes' },
    pro:       { text: 'Yes' },
  },
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
      router.push('/?next=/pricing')
      return
    }

    setCheckoutError(null)
    setLoadingCheckout(true)

    try {
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

  return (
    <div style={pageStyle}>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ textAlign: 'center', marginBottom: 48, maxWidth: 640 }}>
        <div style={proBadgeStyle}>⚡ TradVue Pricing</div>
        <h1 style={h1Style}>
          Start free. Upgrade when<br />you&apos;re ready.
        </h1>
        <p style={subtitleStyle}>
          Everything works out of the box — no account needed for 3 weeks.
          Sign in free to continue, or go Pro for unlimited everything.
        </p>
      </div>

      {/* ── 3 Tier Cards ───────────────────────────────────────────────────── */}
      <div style={cardsWrapStyle}>

        {/* No Account Card */}
        <div style={tierCardStyle(false)}>
          <div style={{ marginBottom: 20 }}>
            <div style={tierLabelStyle('#9ca3af')}>No Account</div>
            <div style={tierPriceStyle}>Free</div>
            <div style={{ fontSize: 13, color: '#9ca3af', marginTop: 6 }}>3-week full access</div>
          </div>
          <p style={tierDescStyle}>
            Full access to every feature for 3 weeks. No sign-in needed.
            Explore tools, journal, portfolio — everything works.
          </p>
          <ul style={tierFeatureListStyle}>
            <li style={tierFeatureItemStyle}>All calculators & market data</li>
            <li style={tierFeatureItemStyle}>Trading journal & portfolio</li>
            <li style={tierFeatureItemStyle}>AI Trade Coach & analytics</li>
            <li style={tierFeatureItemStyle}>No credit card · No sign-up</li>
          </ul>
          <div style={{
            marginTop: 'auto',
            paddingTop: 20,
            fontSize: 13,
            color: '#6b7280',
            textAlign: 'center',
          }}>
            Just open the app and start
          </div>
        </div>

        {/* Free Card */}
        <div style={tierCardStyle(false)}>
          <div style={{ marginBottom: 20 }}>
            <div style={tierLabelStyle('#9ca3af')}>Free</div>
            <div style={tierPriceStyle}>Free</div>
            <div style={{ fontSize: 13, color: '#9ca3af', marginTop: 6 }}>After 3-week trial</div>
          </div>
          <p style={tierDescStyle}>
            After 3 weeks, sign in to continue. 30-day viewing window —
            older entries locked, not deleted. Limited CSV access.
          </p>
          <ul style={tierFeatureListStyle}>
            <li style={tierFeatureItemStyle}>All calculators & market data</li>
            <li style={tierFeatureItemStyle}>30-day journal & portfolio view</li>
            <li style={tierFeatureItemStyle}>3 price alerts</li>
            <li style={tierFeatureItemStyle}>CSV import/export (last 30 days)</li>
          </ul>
          <div style={{ marginTop: 'auto', paddingTop: 20 }}>
            <button
              onClick={() => router.push('/?next=/pricing')}
              style={secondaryBtnStyle}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)' }}
            >
              Sign up free →
            </button>
          </div>
        </div>

        {/* Pro Card */}
        <div style={tierCardStyle(true)}>
          {/* Recommended badge */}
          <div style={recommendedBadgeStyle}>⭐ Most Popular</div>

          <div style={{ marginBottom: 20, marginTop: 8 }}>
            <div style={tierLabelStyle('#a78bfa')}>Pro</div>

            {/* Billing toggle */}
            <div style={{ ...toggleWrapStyle, justifyContent: 'center', marginBottom: 12 }}>
              <button
                onClick={() => setBillingPeriod('monthly')}
                style={toggleBtnStyle(!isAnnual)}
              >Monthly</button>
              <button
                onClick={() => setBillingPeriod('annual')}
                style={toggleBtnStyle(isAnnual)}
              >
                Annual
                <span style={{
                  marginLeft: 5,
                  fontSize: 10,
                  fontWeight: 700,
                  padding: '2px 5px',
                  borderRadius: 8,
                  background: 'rgba(34,197,94,0.15)',
                  color: '#22c55e',
                  border: '1px solid rgba(34,197,94,0.3)',
                }}>−30%</span>
              </button>
            </div>

            {isAnnual ? (
              <>
                <div style={tierPriceStyle}>
                  $16.80<span style={{ fontSize: 18, fontWeight: 400, color: '#9ca3af' }}>/mo</span>
                </div>
                <div style={{ fontSize: 13, color: '#9ca3af', marginTop: 4 }}>
                  Billed $201.60/year · <span style={{ color: '#22c55e' }}>Save $86.40</span>
                </div>
              </>
            ) : (
              <>
                <div style={tierPriceStyle}>
                  $24<span style={{ fontSize: 18, fontWeight: 400, color: '#9ca3af' }}>/mo</span>
                </div>
                <div style={{ fontSize: 13, color: '#9ca3af', marginTop: 4 }}>
                  Billed monthly · Cancel anytime
                </div>
              </>
            )}
          </div>

          <p style={tierDescStyle}>
            Everything unlimited. Full history, cloud sync, auto-sync,
            advanced reports, and priority support.
          </p>

          <ul style={tierFeatureListStyle}>
            <li style={{ ...tierFeatureItemStyle, color: '#c4b5fd' }}>Unlimited journal history</li>
            <li style={{ ...tierFeatureItemStyle, color: '#c4b5fd' }}>Cloud sync — all devices</li>
            <li style={{ ...tierFeatureItemStyle, color: '#c4b5fd' }}>Full CSV any date range</li>
            <li style={{ ...tierFeatureItemStyle, color: '#c4b5fd' }}>Advanced reports & AI Coach</li>
            <li style={{ ...tierFeatureItemStyle, color: '#c4b5fd' }}>Priority support</li>
          </ul>

          <div style={{ marginTop: 'auto', paddingTop: 20 }}>
            {checkoutError && (
              <div style={{ color: '#f87171', fontSize: 12, textAlign: 'center', marginBottom: 10 }}>
                {checkoutError}
              </div>
            )}
            <button
              disabled={loadingCheckout}
              onClick={() => handleSubscribe(billingPeriod)}
              style={ctaBtnStyle(loadingCheckout)}
              onMouseEnter={e => { if (!loadingCheckout) e.currentTarget.style.opacity = '0.88' }}
              onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}
            >
              {loadingCheckout
                ? 'Redirecting…'
                : user
                  ? `Subscribe ${isAnnual ? 'Annual' : 'Monthly'} →`
                  : 'Start Pro →'}
            </button>
            <p style={{ fontSize: 11, color: '#6b7280', textAlign: 'center', marginTop: 10 }}>
              🔒 Secure via Stripe · Cancel anytime
            </p>
          </div>
        </div>
      </div>

      {/* ── Full Comparison Table ───────────────────────────────────────────── */}
      <div style={tableWrapStyle}>
        <h2 style={{ fontSize: 22, fontWeight: 800, textAlign: 'center', color: '#f9fafb', marginBottom: 8 }}>
          Full Feature Comparison
        </h2>
        <p style={{ textAlign: 'center', fontSize: 14, color: '#9ca3af', marginBottom: 28 }}>
          See exactly what&apos;s included at each tier.
        </p>

        {/* Scrollable table container */}
        <div style={tableScrollStyle}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={{ ...thStyle, textAlign: 'left', width: '30%' }}>Feature</th>
                <th style={{ ...thStyle, ...thCenterStyle }}>
                  <span style={{ color: '#9ca3af' }}>No Account</span>
                </th>
                <th style={{ ...thStyle, ...thCenterStyle }}>
                  <span style={{ color: '#d1d5db' }}>Free</span>
                </th>
                <th style={{ ...thStyle, ...thCenterStyle, background: 'rgba(99,102,241,0.15)' }}>
                  <span style={{ color: '#a78bfa', fontWeight: 800 }}>Pro ⚡</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {COMPARE_ROWS.map((row, i) => (
                <tr key={i} style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.018)' }}>
                  <td style={tdFeatureStyle}>{row.feature}</td>
                  <td style={tdCellStyle(row.noAccount)}>{row.noAccount.text}</td>
                  <td style={tdCellStyle(row.free)}>{row.free.text}</td>
                  <td style={{ ...tdCellStyle(row.pro), background: 'rgba(99,102,241,0.07)' }}>
                    {row.pro.text}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Data policy note */}
        <div style={dataPolicyStyle}>
          <span style={{ fontSize: 16, marginRight: 8 }}>🔐</span>
          <span>
            Your data is retained for as long as your account is active. We use commercially
            reasonable efforts to protect your data but cannot guarantee indefinite storage.
            Free tier data older than 30 days is locked from view but not deleted —
            upgrade to Pro to access your full history.
          </span>
        </div>
      </div>
    </div>
  )
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function tdCellStyle(cell: CellValue): React.CSSProperties {
  return {
    padding: '11px 14px',
    fontSize: 13,
    textAlign: 'center',
    borderTop: '1px solid rgba(255,255,255,0.05)',
    color: cell.dim
      ? '#4b5563'
      : cell.positive
        ? '#86efac'
        : '#9ca3af',
    fontWeight: cell.positive ? 500 : 400,
  }
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
  color: '#f9fafb',
  letterSpacing: '-0.03em',
  lineHeight: 1.15,
  margin: '0 0 12px',
}

const subtitleStyle: React.CSSProperties = {
  fontSize: 16,
  color: '#9ca3af',
  margin: '0 0 32px',
  lineHeight: 1.6,
}

const cardsWrapStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
  gap: 20,
  width: '100%',
  maxWidth: 980,
  marginBottom: 56,
  alignItems: 'start',
}

function tierCardStyle(highlighted: boolean): React.CSSProperties {
  return {
    background: highlighted
      ? 'linear-gradient(160deg, rgba(99,102,241,0.14), rgba(139,92,246,0.08))'
      : 'rgba(255,255,255,0.03)',
    border: highlighted
      ? '1.5px solid rgba(99,102,241,0.5)'
      : '1px solid rgba(255,255,255,0.08)',
    borderRadius: 20,
    padding: '28px 24px',
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
    boxShadow: highlighted ? '0 0 40px rgba(99,102,241,0.15)' : 'none',
  }
}

const recommendedBadgeStyle: React.CSSProperties = {
  position: 'absolute',
  top: -14,
  left: '50%',
  transform: 'translateX(-50%)',
  background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
  color: '#fff',
  fontSize: 11,
  fontWeight: 800,
  padding: '4px 14px',
  borderRadius: 20,
  letterSpacing: '0.04em',
  whiteSpace: 'nowrap',
}

function tierLabelStyle(color: string): React.CSSProperties {
  return {
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color,
    marginBottom: 8,
  }
}

const tierPriceStyle: React.CSSProperties = {
  fontSize: 40,
  fontWeight: 900,
  color: '#f9fafb',
  letterSpacing: '-0.03em',
  lineHeight: 1,
}

const tierDescStyle: React.CSSProperties = {
  fontSize: 13,
  color: '#9ca3af',
  lineHeight: 1.6,
  margin: '0 0 18px',
}

const tierFeatureListStyle: React.CSSProperties = {
  listStyle: 'none',
  padding: 0,
  margin: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
}

const tierFeatureItemStyle: React.CSSProperties = {
  fontSize: 13,
  color: '#d1d5db',
  paddingLeft: 18,
  position: 'relative',
}

const toggleWrapStyle: React.CSSProperties = {
  display: 'inline-flex',
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 10,
  padding: 3,
  gap: 3,
}

function toggleBtnStyle(active: boolean): React.CSSProperties {
  return {
    padding: '6px 12px',
    borderRadius: 8,
    border: 'none',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    background: active ? 'rgba(99,102,241,0.3)' : 'transparent',
    color: active ? '#a78bfa' : '#9ca3af',
    transition: 'all 0.15s',
  }
}

function ctaBtnStyle(loading: boolean): React.CSSProperties {
  return {
    width: '100%',
    padding: '13px 20px',
    background: loading ? 'rgba(99,102,241,0.5)' : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    border: 'none',
    borderRadius: 12,
    color: '#fff',
    fontSize: 15,
    fontWeight: 700,
    cursor: loading ? 'wait' : 'pointer',
    letterSpacing: '-0.01em',
    transition: 'opacity 0.15s',
  }
}

const secondaryBtnStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 20px',
  background: 'transparent',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 12,
  color: '#d1d5db',
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
  letterSpacing: '-0.01em',
  transition: 'border-color 0.15s',
}

const tableWrapStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: 900,
}

const tableScrollStyle: React.CSSProperties = {
  overflowX: 'auto',
  borderRadius: 14,
  border: '1px solid rgba(255,255,255,0.08)',
}

const tableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  minWidth: 520,
}

const thStyle: React.CSSProperties = {
  padding: '12px 14px',
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  background: 'rgba(255,255,255,0.03)',
  borderBottom: '1px solid rgba(255,255,255,0.08)',
}

const thCenterStyle: React.CSSProperties = {
  textAlign: 'center',
}

const tdFeatureStyle: React.CSSProperties = {
  padding: '11px 14px',
  fontSize: 13,
  color: '#d1d5db',
  borderTop: '1px solid rgba(255,255,255,0.05)',
}

const dataPolicyStyle: React.CSSProperties = {
  marginTop: 28,
  padding: '16px 20px',
  background: 'rgba(99,102,241,0.06)',
  border: '1px solid rgba(99,102,241,0.18)',
  borderRadius: 12,
  fontSize: 12,
  color: '#9ca3af',
  lineHeight: 1.7,
  display: 'flex',
  alignItems: 'flex-start',
  gap: 4,
}
