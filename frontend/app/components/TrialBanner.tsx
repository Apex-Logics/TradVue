'use client'

/**
 * TrialBanner.tsx — Trial countdown banner for TradVue
 *
 * Slim banner at top of authenticated pages:
 *   - During trial: "🎉 Free trial: X days remaining" + upgrade link
 *   - After trial ended: "Trial ended — upgrade to unlock all features"
 *   - Dismissible for the session (sessionStorage)
 *   - Does NOT show for paid users or unauthenticated visitors
 */

import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import {
  getUserTier,
  isTrialActive,
  getTrialDaysRemaining,
} from '../utils/tierAccess'
import UpgradePrompt from './UpgradePrompt'

const SESSION_DISMISS_KEY = 'tv_trial_banner_dismissed'

export default function TrialBanner() {
  const { user, token, loading } = useAuth()
  const [dismissed, setDismissed] = useState(false)
  const [showUpgrade, setShowUpgrade] = useState(false)

  // Check session-level dismissal
  useEffect(() => {
    try {
      const d = sessionStorage.getItem(SESSION_DISMISS_KEY)
      if (d === '1') setDismissed(true)
    } catch {}
  }, [])

  const dismiss = () => {
    setDismissed(true)
    try { sessionStorage.setItem(SESSION_DISMISS_KEY, '1') } catch {}
  }

  // Don't render during loading or if dismissed
  if (loading || dismissed) return null

  const tier = getUserTier(user)

  // Only show for free-tier authenticated users
  if (tier !== 'free') return null

  const trialActive = isTrialActive(user)
  const daysLeft = getTrialDaysRemaining(user)

  // After trial: show a different persistent message (no dismiss until upgraded)
  const isPostTrial = !trialActive

  // Colors
  const bg = trialActive
    ? 'linear-gradient(90deg, rgba(99,102,241,0.15) 0%, rgba(168,85,247,0.12) 100%)'
    : 'linear-gradient(90deg, rgba(249,115,22,0.15) 0%, rgba(239,68,68,0.12) 100%)'
  const borderColor = trialActive ? 'rgba(99,102,241,0.3)' : 'rgba(249,115,22,0.3)'
  const accentColor = trialActive ? '#a78bfa' : '#f97316'

  return (
    <>
      <div
        style={{
          background: bg,
          borderBottom: `1px solid ${borderColor}`,
          padding: '9px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          position: 'relative',
          zIndex: 90,
          fontSize: 13,
        }}
        role="banner"
        aria-label="Trial status"
      >
        {/* Message */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, justifyContent: 'center' }}>
          {trialActive ? (
            <>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z"/>
              </svg>
              <span style={{ color: 'var(--text-0)', fontWeight: 500 }}>
                Free trial:{' '}
                <strong style={{ color: accentColor }}>
                  {daysLeft === 1 ? '1 day' : `${daysLeft} days`} remaining
                </strong>
              </span>
              <span style={{ color: 'var(--text-3)', fontSize: 12, display: 'none' }}>—</span>
              <button
                onClick={() => setShowUpgrade(true)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: accentColor,
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  padding: 0,
                  textDecoration: 'underline',
                  textDecorationColor: 'rgba(167,139,250,0.4)',
                  textUnderlineOffset: 2,
                }}
              >
                Upgrade to Pro
              </button>
            </>
          ) : (
            <>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              <span style={{ color: 'var(--text-0)', fontWeight: 500 }}>
                Trial ended —{' '}
                <button
                  onClick={() => setShowUpgrade(true)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: accentColor,
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer',
                    padding: 0,
                    textDecoration: 'underline',
                    textDecorationColor: 'rgba(249,115,22,0.4)',
                    textUnderlineOffset: 2,
                  }}
                >
                  upgrade to unlock all features
                </button>
              </span>
            </>
          )}
        </div>

        {/* Dismiss button (only during active trial) */}
        {!isPostTrial && (
          <button
            onClick={dismiss}
            aria-label="Dismiss trial banner"
            style={{
              position: 'absolute',
              right: 16,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-3)',
              padding: '2px 4px',
              borderRadius: 4,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>

      {/* Upgrade modal */}
      <UpgradePrompt
        open={showUpgrade}
        onClose={() => setShowUpgrade(false)}
        featureName="Full Access"
        featureDesc={
          trialActive
            ? `You have ${daysLeft} day${daysLeft === 1 ? '' : 's'} left in your free trial. Upgrade now to keep unlimited access.`
            : 'Your free trial has ended. Upgrade to continue viewing your full history and all pro features.'
        }
        variant={trialActive ? 'trial' : 'upgrade'}
        userId={user?.id}
        email={user?.email}
        token={token}
      />
    </>
  )
}
