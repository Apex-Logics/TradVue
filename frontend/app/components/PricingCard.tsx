'use client'

/**
 * PricingCard.tsx — Stripe-connected pricing cards for TradVue Pro
 *
 * Two cards: Monthly ($24/mo) and Annual ($16.80/mo, $201.60/yr)
 * Calls POST /api/stripe/create-checkout-session then redirects to Stripe Checkout.
 */

import { useState, useEffect } from 'react'
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

interface PricingCardProps {
  userId: string
  email: string
  /** Bearer token for authenticated requests */
  token?: string | null
  /** Optional callback after successful redirect initiation */
  onCheckoutStart?: (plan: 'monthly' | 'annual') => void
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return n % 1 === 0 ? `${n}` : n.toFixed(2)
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function PricingCard({ userId, email, token, onCheckoutStart }: PricingCardProps) {
  const [prices, setPrices] = useState<{ monthly: PriceOption; annual: PriceOption } | null>(null)
  const [loadingPlan, setLoadingPlan] = useState<'monthly' | 'annual' | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Fetch live price IDs from backend on mount
  useEffect(() => {
    fetch(`${API_BASE}/api/stripe/prices`)
      .then(r => r.json())
      .then(data => {
        if (data.monthly && data.annual) setPrices(data)
      })
      .catch(() => {
        // Fallback: prices still shown, subscribe button will re-try
        setError('Could not load pricing. Please refresh.')
      })
  }, [])

  async function handleSubscribe(plan: 'monthly' | 'annual') {
    if (!prices) return
    if (loadingPlan) return

    setError(null)
    setLoadingPlan(plan)
    onCheckoutStart?.(plan)

    try {
      const priceId = plan === 'monthly' ? prices.monthly.priceId : prices.annual.priceId
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token) headers['Authorization'] = `Bearer ${token}`
      const res = await fetch(`${API_BASE}/api/stripe/create-checkout-session`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ priceId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Checkout failed')
      if (data.url) {
        window.location.href = data.url
      } else {
        throw new Error('No checkout URL returned')
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Something went wrong'
      setError(msg)
      setLoadingPlan(null)
    }
  }

  return (
    <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', justifyContent: 'center' }}>

      {/* ── Monthly Card ──────────────────────────────────────────────────── */}
      <div style={cardStyle(false)}>
        <div style={labelStyle}>Monthly</div>
        <div style={priceStyle}>
          $24
          <span style={unitStyle}>/mo</span>
        </div>
        <div style={sublineStyle}>Cancel anytime</div>

        <ul style={featureListStyle}>
          {FEATURES.map((f, i) => <FeatureRow key={i} text={f} />)}
        </ul>

        <button
          disabled={!!loadingPlan || !prices}
          onClick={() => handleSubscribe('monthly')}
          style={btnStyle(false, loadingPlan === 'monthly')}
          onMouseEnter={e => { if (!loadingPlan) (e.currentTarget as HTMLButtonElement).style.opacity = '0.88' }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '1' }}
        >
          {loadingPlan === 'monthly' ? 'Redirecting…' : 'Subscribe Monthly'}
        </button>
      </div>

      {/* ── Annual Card ───────────────────────────────────────────────────── */}
      <div style={cardStyle(true)}>
        {/* Badges */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
          <span style={badgeStyle('#6366f1', '#312e81')}>⭐ Most Popular</span>
          <span style={badgeStyle('#059669', '#064e3b')}>Save 30%</span>
        </div>

        <div style={labelStyle}>Annual</div>
        <div style={priceStyle}>
          $16.80
          <span style={unitStyle}>/mo</span>
        </div>
        <div style={sublineStyle}>
          Billed $201.60/yr · Save ${fmt((24 - 16.80) * 12)}/yr
        </div>

        <ul style={featureListStyle}>
          {FEATURES.map((f, i) => <FeatureRow key={i} text={f} />)}
        </ul>

        <button
          disabled={!!loadingPlan || !prices}
          onClick={() => handleSubscribe('annual')}
          style={btnStyle(true, loadingPlan === 'annual')}
          onMouseEnter={e => { if (!loadingPlan) (e.currentTarget as HTMLButtonElement).style.opacity = '0.88' }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '1' }}
        >
          {loadingPlan === 'annual' ? 'Redirecting…' : 'Subscribe Annual'}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div style={{
          width: '100%',
          textAlign: 'center',
          color: '#f87171',
          fontSize: 13,
          marginTop: 8,
        }}>
          {error}
        </div>
      )}

      {/* Trust line */}
      <div style={{ width: '100%', textAlign: 'center', fontSize: 12, color: 'var(--text-3, #6b7280)', marginTop: 4 }}>
        🔒 Secure payment via Stripe · Cancel anytime · No contracts
      </div>
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function FeatureRow({ text }: { text: string }) {
  return (
    <li style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', listStyle: 'none', fontSize: 13, color: 'var(--text-1, #d1d5db)' }}>
      <span style={{ color: '#22c55e', fontWeight: 700, flexShrink: 0 }}>✓</span>
      {text}
    </li>
  )
}

// ── Static data ────────────────────────────────────────────────────────────────

const FEATURES = [
  'Unlimited trade history',
  'Cloud auto-sync across devices',
  'Full CSV import/export',
  'Advanced reports & analytics',
  'Unlimited portfolio positions',
  'Priority support',
]

// ── Styles ─────────────────────────────────────────────────────────────────────

function cardStyle(featured: boolean): React.CSSProperties {
  return {
    flex: '1 1 260px',
    maxWidth: 320,
    background: featured
      ? 'linear-gradient(160deg, rgba(99,102,241,0.12), rgba(139,92,246,0.08))'
      : 'var(--bg-1, #1a1a2e)',
    border: featured
      ? '1.5px solid rgba(99,102,241,0.5)'
      : '1px solid rgba(255,255,255,0.08)',
    borderRadius: 20,
    padding: '28px 24px',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    boxShadow: featured ? '0 0 32px rgba(99,102,241,0.15)' : 'none',
    position: 'relative',
  }
}

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: 'var(--text-2, #9ca3af)',
  marginTop: 8,
}

const priceStyle: React.CSSProperties = {
  fontSize: 40,
  fontWeight: 800,
  color: 'var(--text-0, #f9fafb)',
  letterSpacing: '-0.03em',
  lineHeight: 1.1,
  marginTop: 4,
}

const unitStyle: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 400,
  color: 'var(--text-2, #9ca3af)',
}

const sublineStyle: React.CSSProperties = {
  fontSize: 12,
  color: 'var(--text-2, #9ca3af)',
  marginTop: 2,
  marginBottom: 16,
}

const featureListStyle: React.CSSProperties = {
  margin: '0 0 20px',
  padding: 0,
  borderTop: '1px solid rgba(255,255,255,0.06)',
}

function btnStyle(primary: boolean, loading: boolean): React.CSSProperties {
  return {
    marginTop: 'auto',
    padding: '13px 20px',
    borderRadius: 12,
    border: 'none',
    fontSize: 15,
    fontWeight: 700,
    cursor: loading ? 'wait' : 'pointer',
    opacity: loading ? 0.7 : 1,
    transition: 'opacity 0.15s',
    background: primary
      ? 'linear-gradient(135deg, #6366f1, #8b5cf6)'
      : 'rgba(255,255,255,0.08)',
    color: primary ? '#fff' : 'var(--text-0, #f9fafb)',
  }
}

function badgeStyle(bg: string, border: string): React.CSSProperties {
  return {
    fontSize: 10,
    fontWeight: 700,
    padding: '3px 8px',
    borderRadius: 20,
    background: `${bg}33`,
    border: `1px solid ${bg}66`,
    color: bg,
    letterSpacing: '0.04em',
  }
}
