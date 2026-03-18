'use client'

/**
 * /pricing — TradVue pricing page
 *
 * Three-tier model:
 *   1. No Account (anonymous) — dashboard, news, calendar, calculators, watchlist
 *   2. Free Account — 3-week full trial, then 30-day limited free tier
 *   3. Pro — everything unlimited ($24/mo or $16.80/mo annual)
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

// ── Comparison data (4-column: feature | no-account | free | pro) ─────────────

type CellValue = { text: string; positive?: boolean; dim?: boolean }

interface CompareRow {
  feature: string
  noAccount: CellValue
  free: CellValue
  pro: CellValue
}

const COMPARE_ROWS: CompareRow[] = [
  {
    feature: 'Advertisements',
    noAccount: { text: 'Ad-supported', dim: true },
    free: { text: 'Ad-supported', dim: true },
    pro: { text: '✓ Ad-free', positive: true },
  },
  {
    feature: 'Dashboard & market data',
    noAccount: { text: '✓', positive: true },
    free: { text: '✓', positive: true },
    pro: { text: '✓', positive: true },
  },
  {
    feature: '30+ trading calculators',
    noAccount: { text: '✓', positive: true },
    free: { text: '✓', positive: true },
    pro: { text: '✓', positive: true },
  },
  {
    feature: 'News feed',
    noAccount: { text: '✓', positive: true },
    free: { text: '✓', positive: true },
    pro: { text: '✓', positive: true },
  },
  {
    feature: 'Economic calendar',
    noAccount: { text: '✓', positive: true },
    free: { text: '✓', positive: true },
    pro: { text: '✓', positive: true },
  },
  {
    feature: 'Watchlist',
    noAccount: { text: '✓', positive: true },
    free: { text: '✓', positive: true },
    pro: { text: '✓', positive: true },
  },
  {
    feature: 'Trading journal',
    noAccount: { text: '—', dim: true },
    free: { text: '3-week trial → 30-day view' },
    pro: { text: '✓ Unlimited', positive: true },
  },
  {
    feature: 'Portfolio tracker',
    noAccount: { text: '—', dim: true },
    free: { text: '3-week trial → 30-day view' },
    pro: { text: '✓ Unlimited', positive: true },
  },
  {
    feature: 'AI Trade Coach',
    noAccount: { text: '—', dim: true },
    free: { text: '3-week trial → 30-day view' },
    pro: { text: '✓ Full access', positive: true },
  },
  {
    feature: 'Playbooks & rituals',
    noAccount: { text: '—', dim: true },
    free: { text: '3-week trial → 30-day view' },
    pro: { text: '✓ Unlimited', positive: true },
  },
  {
    feature: 'Prop firm tracker',
    noAccount: { text: '—', dim: true },
    free: { text: '3-week trial → 30-day view' },
    pro: { text: '✓ Unlimited', positive: true },
  },
  {
    feature: 'Trade rules',
    noAccount: { text: '—', dim: true },
    free: { text: '3-week trial → 30-day view' },
    pro: { text: '✓ Unlimited', positive: true },
  },
  {
    feature: 'CSV import/export',
    noAccount: { text: '—', dim: true },
    free: { text: 'Last 30 days' },
    pro: { text: '✓ Any date range', positive: true },
  },
  {
    feature: 'Cloud sync',
    noAccount: { text: '—', dim: true },
    free: { text: '—', dim: true },
    pro: { text: '✓ All devices', positive: true },
  },
  {
    feature: 'Broker auto-sync',
    noAccount: { text: '—', dim: true },
    free: { text: '—', dim: true },
    pro: { text: '✓ Coming soon', positive: true },
  },
  {
    feature: 'Advanced reports',
    noAccount: { text: '—', dim: true },
    free: { text: '—', dim: true },
    pro: { text: '✓ Full access', positive: true },
  },
  {
    feature: 'Price alerts',
    noAccount: { text: '—', dim: true },
    free: { text: '3 alerts' },
    pro: { text: '✓ Unlimited', positive: true },
  },
  {
    feature: 'Support',
    noAccount: { text: '—', dim: true },
    free: { text: 'Community' },
    pro: { text: 'Priority', positive: true },
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
      router.push('/?signup=true')
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
      <div style={{ textAlign: 'center', marginBottom: 48, maxWidth: 700 }}>
        <div style={proBadgeStyle}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }}>
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
        </svg>TradVue Pricing
      </div>
        <h1 style={h1Style}>
          Simple, transparent pricing.
        </h1>
        <p style={subtitleStyle}>
          Start exploring for free — no account needed. Create a free account for a 3-week full trial of every feature.
          Upgrade to Pro for unlimited everything.
        </p>
      </div>

      {/* ── 3 Tier Cards ───────────────────────────────────────────────────── */}
      <div style={cardsWrapStyle}>

        {/* Card 1: No Account */}
        <div style={tierCardStyle(false)}>
          <div style={{ marginBottom: 20 }}>
            <div style={tierLabelStyle('#9ca3af')}>No Account</div>
            <div style={tierPriceStyle}>Free</div>
            <div style={{ fontSize: 13, color: '#9ca3af', marginTop: 6 }}>No sign-up needed</div>
          </div>
          <p style={tierDescStyle}>
            Explore TradVue instantly — no account, no email, no credit card. Dashboard, news, calendar, calculators, and watchlist are open to everyone.
          </p>
          <ul style={tierFeatureListStyle}>
            <li style={featureIncluded}>✓ Dashboard &amp; market data</li>
            <li style={featureIncluded}>✓ 30+ trading calculators</li>
            <li style={featureIncluded}>✓ News feed</li>
            <li style={featureIncluded}>✓ Economic calendar</li>
            <li style={featureIncluded}>✓ Watchlist</li>
            <li style={featureExcluded}>✗ Trading journal</li>
            <li style={featureExcluded}>✗ Portfolio tracker</li>
            <li style={featureExcluded}>✗ AI Coach &amp; playbooks</li>
          </ul>
          <div style={{ marginTop: 'auto', paddingTop: 20 }}>
            <button
              onClick={() => router.push('/')}
              style={secondaryBtnStyle}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)' }}
            >
              Start Exploring →
            </button>
          </div>
        </div>

        {/* Card 2: Free Account */}
        <div style={tierCardStyle(false)}>
          <div style={{ marginBottom: 20 }}>
            <div style={tierLabelStyle('#34d399')}>Free Account</div>
            <div style={tierPriceStyle}>Free</div>
            <div style={{ fontSize: 13, color: '#9ca3af', marginTop: 6 }}>3-week full trial, no credit card</div>
          </div>
          <p style={tierDescStyle}>
            Create a free account to unlock all features for 3 weeks. After the trial, enjoy a limited free tier — your data is never deleted.
          </p>
          <ul style={tierFeatureListStyle}>
            <li style={featureIncluded}>✓ Everything in No Account</li>
            <li style={featureIncluded}>✓ 3-week full Pro trial</li>
            <li style={featureIncluded}>✓ Trading journal (30-day view after trial)</li>
            <li style={featureIncluded}>✓ Portfolio tracker (30-day view after trial)</li>
            <li style={featureIncluded}>✓ AI Coach, playbooks, rituals</li>
            <li style={featureIncluded}>✓ Prop firm tracker, trade rules</li>
            <li style={featureIncluded}>✓ Limited CSV import/export</li>
            <li style={featureIncluded}>✓ 3 price alerts</li>
            <li style={featureExcluded}>✗ Cloud sync</li>
            <li style={featureExcluded}>✗ Advanced reports</li>
          </ul>
          <div style={{ marginTop: 'auto', paddingTop: 20 }}>
            <button
              onClick={() => router.push('/?signup=true')}
              style={secondaryBtnStyle}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)' }}
            >
              Create Free Account →
            </button>
          </div>
        </div>

        {/* Card 3: Pro */}
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
            Everything unlimited. Full trade history, cloud sync, advanced reports, and priority support.
          </p>

          <ul style={tierFeatureListStyle}>
            <li style={{ ...featureIncluded, color: '#c4b5fd' }}>✓ Everything in Free</li>
            <li style={{ ...featureIncluded, color: '#c4b5fd' }}>✓ Unlimited trade history</li>
            <li style={{ ...featureIncluded, color: '#c4b5fd' }}>✓ Cloud sync across devices</li>
            <li style={{ ...featureIncluded, color: '#c4b5fd' }}>✓ Full CSV import/export (any date range)</li>
            <li style={{ ...featureIncluded, color: '#c4b5fd' }}>✓ Broker auto-sync (coming soon)</li>
            <li style={{ ...featureIncluded, color: '#c4b5fd' }}>✓ Advanced reports &amp; AI pattern detection</li>
            <li style={{ ...featureIncluded, color: '#c4b5fd' }}>✓ Unlimited price alerts</li>
            <li style={{ ...featureIncluded, color: '#c4b5fd' }}>✓ Priority support</li>
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
                  ? `Upgrade to Pro →`
                  : 'Upgrade to Pro →'}
            </button>
            <p style={{ fontSize: 11, color: '#6b7280', textAlign: 'center', marginTop: 10 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }}>
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>Secure via Stripe · Cancel anytime
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
                <th style={{ ...thStyle, textAlign: 'left', width: '34%' }}>Feature</th>
                <th style={{ ...thStyle, ...thCenterStyle }}>
                  <span style={{ color: '#9ca3af' }}>No Account</span>
                </th>
                <th style={{ ...thStyle, ...thCenterStyle }}>
                  <span style={{ color: '#d1d5db' }}>Free</span>
                </th>
                <th style={{ ...thStyle, ...thCenterStyle, background: 'rgba(99,102,241,0.15)' }}>
                  <span style={{ color: '#a78bfa', fontWeight: 800 }}>Pro <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline', verticalAlign: 'middle' }}>
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                </svg></span>
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
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline', verticalAlign: 'middle', marginRight: 8 }}><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          <span>
            Your data is retained for as long as your account is active. We use commercially reasonable efforts to
            protect your data but cannot guarantee indefinite storage. Free tier data older than 30 days is locked
            from view but not deleted — upgrade to Pro to access your full history anytime.
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
  maxWidth: 1000,
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

const featureIncluded: React.CSSProperties = {
  fontSize: 13,
  color: '#d1d5db',
  paddingLeft: 0,
  position: 'relative',
}

const featureExcluded: React.CSSProperties = {
  fontSize: 13,
  color: '#6b7280',
  paddingLeft: 0,
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
  minWidth: 500,
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
