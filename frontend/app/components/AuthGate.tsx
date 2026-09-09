'use client'

/**
 * AuthGate.tsx — Demo-friendly wrapper for gated pages
 *
 * Shows the FULL page with real navigation working. Content is fully
 * interactive (tabs, nav, scroll). Only write actions are blocked.
 * Sticky bottom banner nudges signup for signed-out visitors. Dismissible.
 * Hidden once the user has a session (same useAuth source as the rest of the app).
 */

import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import AuthModal from './AuthModal'

interface AuthGateProps {
  featureName: string
  featureDesc?: string
  children: React.ReactNode
}

export default function AuthGate({ featureName, featureDesc, children }: AuthGateProps) {
  const { user, token } = useAuth()
  const signedIn = Boolean(user || token)
  const [modalOpen, setModalOpen] = useState(false)
  const [bannerDismissed, setBannerDismissed] = useState(false)

  return (
    <div style={{ position: 'relative', minHeight: '100vh' }}>
      {/* Full page content — fully interactive, navigation works */}
      {children}

      {/* Sticky bottom CTA banner — guests only */}
      {!signedIn && !bannerDismissed && (
        <div
          style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 100,
            background: 'linear-gradient(135deg, rgba(99,102,241,0.95), rgba(139,92,246,0.95))',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            borderTop: '1px solid rgba(255,255,255,0.15)',
            padding: '14px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 16,
            flexWrap: 'wrap' as const,
            boxShadow: '0 -4px 24px rgba(0,0,0,0.3)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#fff', flexShrink: 0 }}>
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
            </svg>
            <span style={{ color: '#fff', fontSize: 14, fontWeight: 600 }}>
              You&apos;re viewing sample data. Sign up free to start tracking your own trades.
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => setModalOpen(true)}
              style={{
                background: '#fff',
                border: 'none',
                borderRadius: 8,
                padding: '8px 20px',
                color: '#6366f1',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                whiteSpace: 'nowrap' as const,
              }}
            >
              Sign Up Free
            </button>
            <button
              onClick={() => setModalOpen(true)}
              style={{
                background: 'rgba(255,255,255,0.15)',
                border: '1px solid rgba(255,255,255,0.3)',
                borderRadius: 8,
                padding: '8px 16px',
                color: '#fff',
                fontSize: 13,
                cursor: 'pointer',
                whiteSpace: 'nowrap' as const,
              }}
            >
              Sign In
            </button>
            <button
              onClick={() => setBannerDismissed(true)}
              style={{
                background: 'none',
                border: 'none',
                color: 'rgba(255,255,255,0.6)',
                fontSize: 16,
                cursor: 'pointer',
                padding: '4px 8px',
              }}
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {modalOpen && (
        <AuthModal onClose={() => setModalOpen(false)} />
      )}
    </div>
  )
}
