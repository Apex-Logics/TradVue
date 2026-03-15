'use client'

/**
 * UpgradePrompt.tsx — Paywall modal for TradVue
 *
 * Clean, non-annoying upgrade prompt in Apple/Ubiquiti design standard.
 * Shows what feature is gated, pricing, and CTAs.
 * Dismissible — remembers that feature was gated (per session).
 */

import { useEffect, useCallback, useState } from 'react'
import { MONTHLY_PRICE, ANNUAL_PRICE } from '../utils/tierAccess'
import { API_BASE } from '../lib/api'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface UpgradePromptProps {
  /** Whether the modal is visible */
  open: boolean
  /** Called when user dismisses */
  onClose: () => void
  /** Feature name being gated (e.g. "Cloud Auto-Sync") */
  featureName?: string
  /** Short description of what's blocked */
  featureDesc?: string
  /** Number of locked entries (for the conversion hook) */
  lockedCount?: number
  /** CTA variant — 'trial' shown when trial never started, 'upgrade' when trial ended */
  variant?: 'trial' | 'upgrade'
  /** Authenticated user ID — required for checkout */
  userId?: string
  /** Authenticated user email — required for checkout */
  email?: string
}

// ── Feature metadata ──────────────────────────────────────────────────────────

const FEATURE_BENEFITS = [
  { icon: '🔓', text: 'Unlimited trade history — every entry, forever visible' },
  { icon: '☁️', text: 'Cloud auto-sync across all your devices' },
  { icon: '📥', text: 'Full CSV import/export with no date restrictions' },
  { icon: '🧠', text: 'Advanced reports & AI pattern detection' },
  { icon: '📊', text: 'Unlimited portfolio positions & analytics' },
  { icon: '⚡', text: 'Priority support & early feature access' },
]

// ── Icons (inline to avoid import issues) ─────────────────────────────────────

function IconClose() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

function IconCheck() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function UpgradePrompt({
  open,
  onClose,
  featureName = 'Pro Feature',
  featureDesc,
  lockedCount,
  variant = 'upgrade',
  userId,
  email,
}: UpgradePromptProps) {
  const [checkoutPlan, setCheckoutPlan] = useState<'monthly' | 'annual' | null>(null)
  const [checkoutError, setCheckoutError] = useState<string | null>(null)

  // ── Stripe checkout handler ─────────────────────────────────────────────
  async function handleUpgrade(plan: 'monthly' | 'annual') {
    if (!userId || !email) {
      setCheckoutError('Please sign in to upgrade.')
      return
    }
    if (checkoutPlan) return // already in flight

    setCheckoutError(null)
    setCheckoutPlan(plan)

    try {
      // First, fetch live price IDs
      const pricesRes = await fetch(`${API_BASE}/api/stripe/prices`)
      const prices = await pricesRes.json()
      if (!pricesRes.ok || !prices.monthly || !prices.annual) throw new Error('Failed to load pricing')

      const priceId = plan === 'monthly' ? prices.monthly.priceId : prices.annual.priceId

      const res = await fetch(`${API_BASE}/api/stripe/create-checkout-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId, userId, email }),
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
      setCheckoutError(msg)
      setCheckoutPlan(null)
    }
  }

  // Close on Escape
  const handleKey = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
  }, [onClose])

  useEffect(() => {
    if (!open) return
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, handleKey])

  // Prevent body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  // Reset checkout state when modal opens/closes
  useEffect(() => {
    if (!open) {
      setCheckoutPlan(null)
      setCheckoutError(null)
    }
  }, [open])

  if (!open) return null

  const isTrialVariant = variant === 'trial'
  const ctaPrimary = isTrialVariant ? 'Start Free Trial' : 'Upgrade to Pro'
  const savingsAnnual = Math.round((MONTHLY_PRICE - ANNUAL_PRICE) * 12)

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        background: 'rgba(0, 0, 0, 0.7)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        style={{
          background: 'var(--bg-1)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 20,
          padding: '36px 32px',
          maxWidth: 480,
          width: '100%',
          position: 'relative',
          boxShadow: '0 24px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05)',
        }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          aria-label="Close"
          style={{
            position: 'absolute',
            top: 16,
            right: 16,
            background: 'rgba(255,255,255,0.07)',
            border: 'none',
            borderRadius: 8,
            width: 32,
            height: 32,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: 'var(--text-2)',
          }}
        >
          <IconClose />
        </button>

        {/* Pro badge */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          background: 'linear-gradient(135deg, rgba(99,102,241,0.25), rgba(168,85,247,0.25))',
          border: '1px solid rgba(99,102,241,0.4)',
          borderRadius: 20,
          padding: '4px 12px',
          marginBottom: 20,
        }}>
          <span style={{ fontSize: 13 }}>⚡</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#a78bfa', letterSpacing: '0.04em' }}>PRO FEATURE</span>
        </div>

        {/* Headline */}
        <h2 style={{
          margin: '0 0 8px',
          fontSize: 24,
          fontWeight: 800,
          color: 'var(--text-0)',
          letterSpacing: '-0.02em',
          lineHeight: 1.2,
        }}>
          {isTrialVariant ? 'Start your free trial' : `Unlock ${featureName}`}
        </h2>

        {/* Subheadline */}
        <p style={{
          margin: '0 0 20px',
          fontSize: 14,
          color: 'var(--text-2)',
          lineHeight: 1.6,
        }}>
          {featureDesc
            ? featureDesc
            : isTrialVariant
              ? '3 weeks of full access, then just a few dollars a month.'
              : 'Upgrade to TradVue Pro for unlimited access to every feature.'}
        </p>

        {/* Locked count hook */}
        {lockedCount && lockedCount > 0 && (
          <div style={{
            background: 'rgba(99,102,241,0.12)',
            border: '1px solid rgba(99,102,241,0.25)',
            borderRadius: 10,
            padding: '12px 16px',
            marginBottom: 20,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}>
            <span style={{ fontSize: 20 }}>🔒</span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-0)' }}>
                Your {lockedCount.toLocaleString()} {lockedCount === 1 ? 'entry is' : 'entries are'} waiting
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 2 }}>
                All your data is safely saved — upgrade to view it all.
              </div>
            </div>
          </div>
        )}

        {/* Benefits list */}
        <div style={{ marginBottom: 24 }}>
          {FEATURE_BENEFITS.map((b, i) => (
            <div key={i} style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '8px 0',
              borderBottom: i < FEATURE_BENEFITS.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
            }}>
              <span style={{
                width: 22,
                height: 22,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(34,197,94,0.15)',
                borderRadius: 6,
                color: '#22c55e',
                flexShrink: 0,
              }}>
                <IconCheck />
              </span>
              <span style={{ fontSize: 13, color: 'var(--text-1)' }}>{b.text}</span>
            </div>
          ))}
        </div>

        {/* Pricing */}
        <div style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 12,
          padding: '16px 20px',
          marginBottom: 20,
          display: 'flex',
          gap: 16,
          alignItems: 'stretch',
        }}>
          {/* Monthly */}
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: 'var(--text-2)', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Monthly</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-0)' }}>
              ${MONTHLY_PRICE}
              <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--text-2)' }}>/mo</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-2)', marginTop: 2 }}>Cancel anytime</div>
          </div>

          <div style={{ width: 1, background: 'rgba(255,255,255,0.08)' }} />

          {/* Annual */}
          <div style={{ flex: 1, textAlign: 'center', position: 'relative' }}>
            <div style={{
              position: 'absolute',
              top: -8,
              left: '50%',
              transform: 'translateX(-50%)',
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              borderRadius: 20,
              padding: '2px 8px',
              fontSize: 10,
              fontWeight: 700,
              color: '#fff',
              whiteSpace: 'nowrap',
            }}>
              SAVE ${savingsAnnual}/yr
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-2)', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Annual</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: '#a78bfa' }}>
              ${ANNUAL_PRICE}
              <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--text-2)' }}>/mo</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-2)', marginTop: 2 }}>Billed ${(ANNUAL_PRICE * 12).toFixed(0)}/yr</div>
          </div>
        </div>

        {/* CTA buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Primary: Annual (most popular) */}
          <button
            disabled={!!checkoutPlan}
            onClick={() => handleUpgrade('annual')}
            style={{
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              border: 'none',
              borderRadius: 12,
              padding: '14px 24px',
              color: '#fff',
              fontSize: 15,
              fontWeight: 700,
              cursor: checkoutPlan ? 'wait' : 'pointer',
              letterSpacing: '-0.01em',
              transition: 'opacity 0.15s',
              opacity: checkoutPlan === 'annual' ? 0.7 : 1,
            }}
            onMouseEnter={e => { if (!checkoutPlan) e.currentTarget.style.opacity = '0.9' }}
            onMouseLeave={e => { e.currentTarget.style.opacity = checkoutPlan === 'annual' ? '0.7' : '1' }}
          >
            {checkoutPlan === 'annual' ? 'Redirecting to checkout…' : `${ctaPrimary} — Annual ($16.80/mo) →`}
          </button>

          {/* Secondary: Monthly */}
          <button
            disabled={!!checkoutPlan}
            onClick={() => handleUpgrade('monthly')}
            style={{
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.18)',
              borderRadius: 12,
              padding: '12px 24px',
              color: 'var(--text-1)',
              fontSize: 13,
              cursor: checkoutPlan ? 'wait' : 'pointer',
              transition: 'border-color 0.15s',
              opacity: checkoutPlan === 'monthly' ? 0.7 : 1,
            }}
            onMouseEnter={e => { if (!checkoutPlan) e.currentTarget.style.borderColor = 'rgba(255,255,255,0.35)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.18)' }}
          >
            {checkoutPlan === 'monthly' ? 'Redirecting…' : 'Monthly plan — $24/mo'}
          </button>

          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 12,
              padding: '10px 24px',
              color: 'var(--text-2)',
              fontSize: 12,
              cursor: 'pointer',
              transition: 'border-color 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.18)')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)')}
          >
            Maybe later
          </button>

          {/* Checkout error */}
          {checkoutError && (
            <div style={{ fontSize: 12, color: '#f87171', textAlign: 'center', marginTop: 4 }}>
              {checkoutError}
            </div>
          )}
        </div>

        {/* Trust line */}
        <p style={{
          margin: '16px 0 0',
          textAlign: 'center',
          fontSize: 11,
          color: 'var(--text-3)',
        }}>
          🔒 Secure payment · Cancel anytime · No contracts
        </p>
      </div>
    </div>
  )
}
