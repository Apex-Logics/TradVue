'use client'

import { useEffect } from 'react'

interface ErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function Error({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error('[TradVue] Runtime error:', error)
  }, [error])

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0f1117',
        color: '#e2e8f0',
        fontFamily: 'sans-serif',
        textAlign: 'center',
        padding: '2rem',
      }}
    >
      <div style={{ lineHeight: 1, display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
      </div>
      <h1 style={{ fontSize: '2rem', fontWeight: 700, margin: '1rem 0 0.5rem' }}>
        Something went wrong
      </h1>
      <p style={{ color: '#94a3b8', maxWidth: '420px', lineHeight: 1.6 }}>
        An unexpected error occurred. We&apos;ve logged it — please try again or refresh the page.
      </p>
      {error?.message && (
        <p
          style={{
            marginTop: '1rem',
            padding: '0.5rem 1rem',
            background: '#1e1e2e',
            borderRadius: '6px',
            fontSize: '0.85rem',
            color: '#f87171',
            maxWidth: '480px',
            wordBreak: 'break-word',
          }}
        >
          {error.message}
        </p>
      )}
      <button
        onClick={reset}
        style={{
          marginTop: '2rem',
          padding: '0.75rem 1.75rem',
          background: '#6366f1',
          color: '#fff',
          border: 'none',
          borderRadius: '8px',
          fontWeight: 600,
          fontSize: '1rem',
          cursor: 'pointer',
        }}
      >
        Try again
      </button>
    </div>
  )
}
