'use client'

import React from 'react'
import Spinner from './Spinner'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PageLoaderProps {
  /** Shown below the logo. Defaults to "Loading…" */
  message?: string
  /** Hide the logo; show only spinner + message */
  minimal?: boolean
}

// ─── Logo mark (inline SVG — ChartGenius chart icon) ─────────────────────────

function LogoMark() {
  return (
    <svg
      width="40"
      height="40"
      viewBox="0 0 40 40"
      fill="none"
      aria-hidden="true"
    >
      {/* Background pill */}
      <rect width="40" height="40" rx="10" fill="#6366f1" opacity="0.12" />
      {/* Chart bars */}
      <rect x="7"  y="24" width="5" height="10" rx="1.5" fill="#6366f1" opacity="0.5" />
      <rect x="14" y="17" width="5" height="17" rx="1.5" fill="#6366f1" opacity="0.7" />
      <rect x="21" y="11" width="5" height="23" rx="1.5" fill="#6366f1" />
      <rect x="28" y="15" width="5" height="19" rx="1.5" fill="#4a9eff" />
      {/* Trend line */}
      <polyline
        points="9.5,26 16.5,19 23.5,13 30.5,17"
        stroke="#00c06a"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  )
}

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * PageLoader — full-viewport overlay for route transitions or initial data loads.
 *
 * @example
 * // Full-page route guard:
 * if (!ready) return <PageLoader />
 *
 * // Minimal (no logo):
 * if (loading) return <PageLoader minimal message="Fetching positions…" />
 */
export default function PageLoader({ message = 'Loading…', minimal = false }: PageLoaderProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={message}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '20px',
        background: 'var(--bg-0, #0a0a0c)',
      }}
    >
      {!minimal && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            marginBottom: '8px',
          }}
        >
          <LogoMark />
          <span
            style={{
              fontFamily: 'var(--font, Inter, sans-serif)',
              fontWeight: 600,
              fontSize: '18px',
              letterSpacing: '-0.02em',
              color: 'var(--text-0, #e8e8ed)',
            }}
          >
            ChartGenius
          </span>
        </div>
      )}

      <Spinner size="lg" variant="primary" label={message} />

      <p
        style={{
          fontFamily: 'var(--font, Inter, sans-serif)',
          fontSize: '13px',
          color: 'var(--text-2, #606070)',
          margin: 0,
        }}
      >
        {message}
      </p>
    </div>
  )
}
