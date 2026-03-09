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
      <div style={{ fontSize: '5rem', lineHeight: 1 }}>⚠️</div>
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
