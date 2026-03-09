'use client'

import Link from 'next/link'
import Script from 'next/script'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface BreadcrumbItem {
  label: string
  href?: string // omit for the current (non-clickable) page
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[]
  /** Max width to match the surrounding layout. Defaults to '1100px'. */
  maxWidth?: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Home icon
// ─────────────────────────────────────────────────────────────────────────────

function HomeIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Chevron separator
// ─────────────────────────────────────────────────────────────────────────────

function Chevron() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ color: 'var(--text-3, #555)', flexShrink: 0 }}
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Breadcrumbs
// ─────────────────────────────────────────────────────────────────────────────

export default function Breadcrumbs({ items, maxWidth = '1100px' }: BreadcrumbsProps) {
  if (!items || items.length === 0) return null

  // Build schema.org BreadcrumbList JSON-LD
  const schemaItems = items.map((item, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    name: item.label,
    ...(item.href ? { item: `https://tradvue.io${item.href}` } : {}),
  }))

  const schemaData = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: schemaItems,
  }

  return (
    <>
      {/* Schema.org structured data */}
      <Script id={`breadcrumb-schema-${items.map(i => i.label).join('-')}`} type="application/ld+json">
        {JSON.stringify(schemaData)}
      </Script>

      <nav
        aria-label="Breadcrumb"
        style={{
          borderBottom: '1px solid var(--border, #1e1e24)',
          background: 'var(--bg-0, #0a0a0b)',
        }}
      >
        <div
          style={{
            maxWidth,
            margin: '0 auto',
            padding: '0 24px',
          }}
        >
          <ol
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              listStyle: 'none',
              padding: '8px 0',
              margin: 0,
              flexWrap: 'wrap',
            }}
          >
            {items.map((item, i) => {
              const isFirst = i === 0
              const isLast = i === items.length - 1

              return (
                <li
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  {/* Chevron before every item except the first */}
                  {!isFirst && <Chevron />}

                  {/* Item — link or plain text */}
                  {!isLast && item.href ? (
                    <Link
                      href={item.href}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '12px',
                        color: 'var(--text-3, #555)',
                        textDecoration: 'none',
                        lineHeight: 1,
                        transition: 'color 0.15s',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-1, #c8c8d0)')}
                      onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-3, #555)')}
                    >
                      {isFirst && <HomeIcon />}
                      <span>{item.label}</span>
                    </Link>
                  ) : isLast ? (
                    // Current page — not clickable
                    <span
                      aria-current="page"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '12px',
                        color: 'var(--text-2, #888)',
                        lineHeight: 1,
                        fontWeight: 500,
                      }}
                    >
                      {isFirst && <HomeIcon />}
                      <span>{item.label}</span>
                    </span>
                  ) : (
                    // Intermediate item without href — plain text
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '12px',
                        color: 'var(--text-3, #555)',
                        lineHeight: 1,
                      }}
                    >
                      {isFirst && <HomeIcon />}
                      <span>{item.label}</span>
                    </span>
                  )}
                </li>
              )
            })}
          </ol>
        </div>
      </nav>
    </>
  )
}
