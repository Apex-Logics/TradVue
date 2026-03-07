'use client'

import React from 'react'

// ─── Types ───────────────────────────────────────────────────────────────────

export type SpinnerSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'
export type SpinnerVariant = 'primary' | 'accent' | 'gain' | 'loss' | 'muted'

export interface SpinnerProps {
  size?: SpinnerSize
  variant?: SpinnerVariant
  /** Override colour with any CSS colour string */
  color?: string
  className?: string
  label?: string
}

// ─── Config ──────────────────────────────────────────────────────────────────

const SIZE: Record<SpinnerSize, { outer: number; stroke: number }> = {
  xs: { outer: 12, stroke: 1.5 },
  sm: { outer: 16, stroke: 2 },
  md: { outer: 24, stroke: 2.5 },
  lg: { outer: 36, stroke: 3 },
  xl: { outer: 48, stroke: 3.5 },
}

const VARIANT_COLOR: Record<SpinnerVariant, string> = {
  primary: '#6366f1',
  accent:  '#4a9eff',
  gain:    '#00c06a',
  loss:    '#ff4560',
  muted:   '#404050',
}

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * Spinner — animated SVG arc.
 *
 * @example
 * <Spinner />
 * <Spinner size="lg" variant="gain" />
 * <Spinner size="sm" color="#f0a500" label="Loading chart…" />
 */
export default function Spinner({
  size = 'md',
  variant = 'primary',
  color,
  className = '',
  label = 'Loading…',
}: SpinnerProps) {
  const { outer, stroke } = SIZE[size]
  const r = (outer - stroke) / 2
  const circ = 2 * Math.PI * r
  const arc = circ * 0.75          // 75% visible arc
  const trackColor = 'rgba(255,255,255,0.06)'
  const spinColor = color ?? VARIANT_COLOR[variant]

  return (
    <svg
      width={outer}
      height={outer}
      viewBox={`0 0 ${outer} ${outer}`}
      fill="none"
      role="status"
      aria-label={label}
      className={className}
      style={{ animation: 'chartgenius-spin 0.75s linear infinite', flexShrink: 0 }}
    >
      {/* Track */}
      <circle
        cx={outer / 2}
        cy={outer / 2}
        r={r}
        stroke={trackColor}
        strokeWidth={stroke}
      />
      {/* Arc */}
      <circle
        cx={outer / 2}
        cy={outer / 2}
        r={r}
        stroke={spinColor}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${arc} ${circ - arc}`}
        strokeDashoffset={circ * 0.25}
        transform={`rotate(-90 ${outer / 2} ${outer / 2})`}
      />
    </svg>
  )
}

// ─── Inline keyframes (injected once via a style tag) ─────────────────────────
// We use a global CSS approach so this works without a separate CSS file.
// globals.css is the canonical place; this is a fallback for standalone use.

if (typeof document !== 'undefined') {
  const id = '__cg-spinner-style'
  if (!document.getElementById(id)) {
    const style = document.createElement('style')
    style.id = id
    style.textContent = `
      @keyframes chartgenius-spin {
        from { transform: rotate(0deg); }
        to   { transform: rotate(360deg); }
      }
    `
    document.head.appendChild(style)
  }
}
