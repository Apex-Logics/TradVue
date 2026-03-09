'use client'

import React from 'react'

// ─── Base shimmer ─────────────────────────────────────────────────────────────

interface BaseProps {
  className?: string
  style?: React.CSSProperties
}

const shimmer: React.CSSProperties = {
  background: 'linear-gradient(90deg, var(--bg-3,#1a1a1f) 25%, var(--bg-4,#212128) 50%, var(--bg-3,#1a1a1f) 75%)',
  backgroundSize: '200% 100%',
  animation: 'tradvue-shimmer 1.5s ease-in-out infinite',
  borderRadius: '4px',
  flexShrink: 0,
}

// Inject keyframes once
if (typeof document !== 'undefined') {
  const id = '__cg-shimmer-style'
  if (!document.getElementById(id)) {
    const style = document.createElement('style')
    style.id = id
    style.textContent = `
      @keyframes tradvue-shimmer {
        0%   { background-position:  200% 0; }
        100% { background-position: -200% 0; }
      }
    `
    document.head.appendChild(style)
  }
}

// ─── Text Skeleton ────────────────────────────────────────────────────────────

export interface TextSkeletonProps extends BaseProps {
  /** Width as CSS value. Default "100%" */
  width?: string | number
  /** Height as CSS value. Default "13px" (matches base font-size) */
  height?: string | number
  /** Render multiple lines */
  lines?: number
  /** Gap between lines */
  gap?: string | number
}

/**
 * TextSkeleton — one or more placeholder text lines.
 *
 * @example
 * <TextSkeleton />
 * <TextSkeleton lines={3} width="80%" />
 * <TextSkeleton width={120} height={11} />
 */
export function TextSkeleton({
  width = '100%',
  height = '13px',
  lines = 1,
  gap = '8px',
  className = '',
  style,
}: TextSkeletonProps) {
  if (lines <= 1) {
    return (
      <div
        className={className}
        style={{ ...shimmer, width, height, ...style }}
        aria-hidden="true"
      />
    )
  }

  return (
    <div
      className={className}
      style={{ display: 'flex', flexDirection: 'column', gap, ...style }}
      aria-hidden="true"
    >
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          style={{
            ...shimmer,
            // Last line is shorter for a natural paragraph look
            width: i === lines - 1 ? '65%' : width,
            height,
          }}
        />
      ))}
    </div>
  )
}

// ─── Card Skeleton ────────────────────────────────────────────────────────────

export interface CardSkeletonProps extends BaseProps {
  /** Show a header area (title + subtitle) */
  header?: boolean
  /** Number of body lines */
  lines?: number
  /** Card height */
  height?: string | number
}

/**
 * CardSkeleton — placeholder for a data card.
 *
 * @example
 * <CardSkeleton />
 * <CardSkeleton header lines={4} />
 */
export function CardSkeleton({
  header = true,
  lines = 3,
  height,
  className = '',
  style,
}: CardSkeletonProps) {
  return (
    <div
      className={className}
      style={{
        background: 'var(--bg-2, #141418)',
        border: '1px solid var(--border, #252530)',
        borderRadius: '8px',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        height,
        ...style,
      }}
      aria-hidden="true"
    >
      {header && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {/* Title */}
          <div style={{ ...shimmer, width: '50%', height: '15px' }} />
          {/* Subtitle */}
          <div style={{ ...shimmer, width: '30%', height: '11px' }} />
        </div>
      )}

      {/* Divider */}
      {header && <div style={{ height: '1px', background: 'var(--border-b,#1c1c24)' }} />}

      {/* Body lines */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            style={{
              ...shimmer,
              width: i === lines - 1 ? '60%' : '100%',
              height: '13px',
            }}
          />
        ))}
      </div>
    </div>
  )
}

// ─── TableRow Skeleton ────────────────────────────────────────────────────────

export interface TableRowSkeletonProps extends BaseProps {
  /** Number of columns */
  columns?: number
  /** Number of rows */
  rows?: number
  /** Show a header row */
  showHeader?: boolean
}

/**
 * TableRowSkeleton — placeholder rows for a data table.
 *
 * @example
 * <TableRowSkeleton />
 * <TableRowSkeleton columns={6} rows={8} showHeader />
 */
export function TableRowSkeleton({
  columns = 5,
  rows = 5,
  showHeader = false,
  className = '',
  style,
}: TableRowSkeletonProps) {
  const cellWidths = ['40%', '25%', '20%', '18%', '15%', '12%', '10%']

  const renderRow = (isHeader = false) => (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
        gap: '12px',
        padding: '10px 12px',
        borderBottom: '1px solid var(--border-b, #1c1c24)',
        opacity: isHeader ? 0.5 : 1,
      }}
    >
      {Array.from({ length: columns }).map((_, i) => (
        <div
          key={i}
          style={{
            ...shimmer,
            width: cellWidths[i % cellWidths.length],
            height: isHeader ? '10px' : '13px',
          }}
        />
      ))}
    </div>
  )

  return (
    <div
      className={className}
      style={{
        background: 'var(--bg-2, #141418)',
        border: '1px solid var(--border, #252530)',
        borderRadius: '8px',
        overflow: 'hidden',
        ...style,
      }}
      aria-hidden="true"
    >
      {showHeader && renderRow(true)}
      {Array.from({ length: rows }).map((_, i) => (
        <React.Fragment key={i}>{renderRow()}</React.Fragment>
      ))}
    </div>
  )
}

// ─── Avatar Skeleton ──────────────────────────────────────────────────────────

export type AvatarSkeletonShape = 'circle' | 'square'

export interface AvatarSkeletonProps extends BaseProps {
  size?: number | string
  shape?: AvatarSkeletonShape
  /** Show a name + subtitle beside the avatar */
  withLabel?: boolean
}

/**
 * AvatarSkeleton — placeholder for a user avatar (and optional label).
 *
 * @example
 * <AvatarSkeleton />
 * <AvatarSkeleton size={48} shape="square" />
 * <AvatarSkeleton size={36} withLabel />
 */
export function AvatarSkeleton({
  size = 36,
  shape = 'circle',
  withLabel = false,
  className = '',
  style,
}: AvatarSkeletonProps) {
  const radius = shape === 'circle' ? '50%' : '6px'

  return (
    <div
      className={className}
      style={{ display: 'flex', alignItems: 'center', gap: '10px', ...style }}
      aria-hidden="true"
    >
      <div
        style={{
          ...shimmer,
          width: size,
          height: size,
          borderRadius: radius,
          flexShrink: 0,
        }}
      />
      {withLabel && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
          <div style={{ ...shimmer, width: '50%', height: '13px' }} />
          <div style={{ ...shimmer, width: '35%', height: '11px' }} />
        </div>
      )}
    </div>
  )
}

// ─── Re-export everything as a namespace for convenience ──────────────────────

const Skeleton = {
  Text:     TextSkeleton,
  Card:     CardSkeleton,
  TableRow: TableRowSkeleton,
  Avatar:   AvatarSkeleton,
}

export default Skeleton
