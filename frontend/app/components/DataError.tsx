'use client'

/**
 * DataError — User-friendly error state component
 *
 * Shows a clean "Data temporarily unavailable" message with:
 * - Auto-retry countdown (default: every 8s, up to 3 times)
 * - Manual "Try Again" button
 * - Final fallback message after retries exhausted
 * NEVER shows raw error details, status codes, or stack traces.
 */

import { useState, useEffect, useCallback } from 'react'

interface DataErrorProps {
  /** Called to retry the fetch. If omitted, no retry button is shown. */
  onRetry?: () => void | Promise<void>
  /** Seconds between auto-retries. Set to 0 to disable auto-retry. Default: 8 */
  autoRetryAfter?: number
  /** Max auto-retry attempts before showing permanent error. Default: 3 */
  maxAutoRetries?: number
  /** Compact inline mode (fits inside sidebar rows, etc.). Default: false */
  compact?: boolean
  /** Override the final error message */
  message?: string
}

// Inline spinner (uses tv-spin keyframe added in globals.css)
function Spinner({ size = 14 }: { size?: number }) {
  return (
    <span
      aria-hidden="true"
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        borderRadius: '50%',
        border: `2px solid rgba(255,255,255,0.1)`,
        borderTopColor: 'var(--accent)',
        animation: 'tv-spin 0.75s linear infinite',
        flexShrink: 0,
        verticalAlign: 'middle',
      }}
    />
  )
}

export default function DataError({
  onRetry,
  autoRetryAfter = 8,
  maxAutoRetries = 3,
  compact = false,
  message,
}: DataErrorProps) {
  const [retryCount, setRetryCount] = useState(0)
  const [countdown, setCountdown] = useState(autoRetryAfter)
  const [busy, setBusy] = useState(false)

  const exhausted = retryCount >= maxAutoRetries
  const finalMsg = message ?? 'Market data is currently unavailable. Please try again in a moment.'
  const canRetry = !!onRetry

  const doRetry = useCallback(async () => {
    if (busy || !onRetry) return
    setBusy(true)
    setRetryCount(r => r + 1)
    try {
      await onRetry()
    } catch {
      // Silently ignore — parent handles state
    }
    setBusy(false)
    setCountdown(autoRetryAfter)
  }, [busy, onRetry, autoRetryAfter])

  // Auto-retry countdown
  useEffect(() => {
    if (!canRetry || autoRetryAfter === 0 || exhausted || busy) return

    setCountdown(autoRetryAfter)

    const interval = setInterval(() => {
      setCountdown(c => Math.max(0, c - 1))
    }, 1000)

    const timer = setTimeout(() => {
      doRetry()
    }, autoRetryAfter * 1000)

    return () => {
      clearTimeout(timer)
      clearInterval(interval)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retryCount, exhausted])

  const retryBtn = canRetry && (
    <button
      onClick={doRetry}
      disabled={busy}
      style={{
        padding: compact ? '2px 8px' : '5px 14px',
        background: 'var(--bg-3)',
        border: '1px solid var(--border)',
        borderRadius: 5,
        color: busy ? 'var(--text-3)' : 'var(--text-1)',
        fontSize: compact ? 10 : 12,
        cursor: busy ? 'default' : 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
      }}
    >
      {busy ? <><Spinner size={10} /> Refreshing…</> : '↻ Try Again'}
    </button>
  )

  // ── Compact mode (inline sidebar, small panels) ──────────────────────────
  if (compact) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '5px 10px',
        fontSize: 11,
        color: 'var(--text-3)',
      }}>
        {busy ? (
          <><Spinner size={11} /><span>Refreshing…</span></>
        ) : exhausted ? (
          <><span>Market data temporarily unavailable.</span>{retryBtn}</>
        ) : canRetry ? (
          <><Spinner size={11} /><span>Data temporarily unavailable — refreshing in {countdown}s…</span></>
        ) : (
          <span>{finalMsg}</span>
        )}
      </div>
    )
  }

  // ── Full mode (center column, empty state areas) ─────────────────────────
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '32px 20px',
      gap: 10,
      textAlign: 'center',
    }}>
      {busy ? (
        <>
          <Spinner size={20} />
          <p style={{ fontSize: 12, color: 'var(--text-3)', margin: 0 }}>Refreshing…</p>
        </>
      ) : exhausted ? (
        <>
          <p style={{ fontSize: 13, color: 'var(--text-2)', margin: 0, lineHeight: 1.5 }}>
            {finalMsg}
          </p>
          {retryBtn}
        </>
      ) : canRetry ? (
        <>
          <Spinner size={20} />
          <p style={{ fontSize: 12, color: 'var(--text-3)', margin: 0 }}>
            Data temporarily unavailable — refreshing in {countdown}s…
          </p>
        </>
      ) : (
        <p style={{ fontSize: 13, color: 'var(--text-2)', margin: 0, lineHeight: 1.5 }}>
          {finalMsg}
        </p>
      )}
    </div>
  )
}
