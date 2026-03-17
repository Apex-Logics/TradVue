'use client'

/**
 * AuthGate.tsx — Inline auth prompt for gated pages
 *
 * When an unauthenticated user hits a gated page:
 * - Shows page content dimmed/blurred in background
 * - Overlays a clean auth prompt
 * - Does NOT redirect (keeps URL for bookmarking)
 */

import { useState } from 'react'
import AuthModal from './AuthModal'

interface AuthGateProps {
  /** The feature being gated, e.g. "Trade Playbooks" */
  featureName: string
  /** Short description of what the feature does */
  featureDesc?: string
  /** The blurred/dimmed page content shown behind */
  children: React.ReactNode
}

export default function AuthGate({ featureName, featureDesc, children }: AuthGateProps) {
  const [modalOpen, setModalOpen] = useState(false)

  return (
    <div style={{ position: 'relative', minHeight: '100vh' }}>
      {/* Blurred background content */}
      <div
        aria-hidden="true"
        style={{
          filter: 'blur(6px)',
          opacity: 0.35,
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      >
        {children}
      </div>

      {/* Auth overlay */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          background: 'rgba(0, 0, 0, 0.55)',
          backdropFilter: 'blur(2px)',
          WebkitBackdropFilter: 'blur(2px)',
        }}
      >
        <div
          style={{
            background: 'var(--bg-1, #1a1a2e)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 20,
            padding: '40px 36px',
            maxWidth: 440,
            width: '100%',
            textAlign: 'center',
            boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
          }}
        >
          {/* Icon */}
          <div style={{
            width: 56,
            height: 56,
            borderRadius: 16,
            background: 'linear-gradient(135deg, rgba(99,102,241,0.25), rgba(168,85,247,0.25))',
            border: '1px solid rgba(99,102,241,0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px',
            fontSize: 24,
          }}>
            🔒
          </div>

          {/* Headline */}
          <h2 style={{
            margin: '0 0 10px',
            fontSize: 22,
            fontWeight: 800,
            color: 'var(--text-0, #f9fafb)',
            letterSpacing: '-0.02em',
          }}>
            Sign in to access {featureName}
          </h2>

          <p style={{
            margin: '0 0 28px',
            fontSize: 14,
            color: 'var(--text-2, #9ca3af)',
            lineHeight: 1.6,
          }}>
            {featureDesc ?? 'Create a free account to unlock this feature. No credit card required.'}
          </p>

          {/* CTAs */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button
              onClick={() => setModalOpen(true)}
              style={{
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                border: 'none',
                borderRadius: 12,
                padding: '13px 24px',
                color: '#fff',
                fontSize: 15,
                fontWeight: 700,
                cursor: 'pointer',
                letterSpacing: '-0.01em',
              }}
            >
              Create Free Account →
            </button>
            <button
              onClick={() => setModalOpen(true)}
              style={{
                background: 'transparent',
                border: '1px solid rgba(255,255,255,0.18)',
                borderRadius: 12,
                padding: '12px 24px',
                color: 'var(--text-1, #d1d5db)',
                fontSize: 14,
                cursor: 'pointer',
              }}
            >
              Sign In
            </button>
          </div>

          <p style={{ marginTop: 20, fontSize: 11, color: 'var(--text-3, #6b7280)' }}>
            Free accounts include a 3-week full-featured trial · No credit card required
          </p>
        </div>
      </div>

      {/* Auth modal */}
      {modalOpen && (
        <AuthModal
          onClose={() => setModalOpen(false)}
        />
      )}
    </div>
  )
}
