'use client'

import { useState } from 'react'
import Link from 'next/link'
import Breadcrumbs from '../components/Breadcrumbs'

// ─────────────────────────────────────────────────────────────────────────────
// Data — parsed from CHANGELOG.md
// ─────────────────────────────────────────────────────────────────────────────

interface ChangelogEntry {
  version: string
  date: string
  status: 'beta' | 'stable' | 'unreleased'
  isLatest?: boolean
  sections: {
    majorFeatures?: { title: string; items: string[] }[]
    added?: string[]
    changed?: string[]
    fixed?: string[]
    security?: string[]
    removed?: string[]
    planned?: string[]
  }
}

const CHANGELOG: ChangelogEntry[] = [
  {
    version: 'Unreleased',
    date: 'Coming Soon',
    status: 'unreleased',
    sections: {
      planned: [
        'Advanced Technical Indicators: Bollinger Bands, MACD, Stochastic Oscillator',
        'Social Sentiment Analysis: Real-time tracking from Reddit, Twitter, Discord',
        'Influencer Tracking: Monitor signals from trading influencers',
        'API Access: RESTful API for enterprise integrations',
        'Custom Alert Rules: Pattern-based and condition-based alerts',
        'Data Export: CSV and JSON export for analysis',
        'Advanced Analytics Dashboard: Custom metrics and performance tracking',
        'Subscription Tiers: Free, Professional ($19/mo), Enterprise ($99/mo)',
        'Calendar Sync: Google Calendar and Outlook integration',
        'Mobile App: Native iOS and Android applications',
        'Voice Alerts: SMS and voice notifications',
        'Backtesting Engine: Historical testing of trading strategies',
        'Community Features: Discussion forums, shared watchlists, strategy sharing',
      ],
    },
  },
  {
    version: '0.1.0-beta',
    date: 'March 6, 2026',
    status: 'beta',
    isLatest: true,
    sections: {
      majorFeatures: [
        {
          title: 'Real-Time Market Intelligence',
          items: [
            'Live price feeds for stocks, forex, cryptocurrencies, and commodities',
            'Intraday charts with multiple timeframes (1m, 5m, 15m, 1h, 4h, daily, weekly, monthly)',
            'Stock search with autocomplete and detailed ticker information',
            'Top movers display (gainers/losers) across asset classes',
            '20+ years of historical data available for backtesting and analysis',
            'Real data integration with Alpha Vantage, FinnHub, and Polygon.io APIs',
          ],
        },
        {
          title: 'AI-Powered News Aggregation & Analysis',
          items: [
            'Multi-source news collection (NewsAPI, RSS feeds, custom scrapers)',
            'Automatic sentiment analysis with -1 to 1 sentiment scoring',
            'Impact scoring (0-10 scale) for news relevance to trading',
            'AI-generated summaries for quick insights',
            'Symbol-specific news feeds with smart filtering',
            'News feed integration in main dashboard with real-time updates',
          ],
        },
        {
          title: 'Smart Watchlist & Alert System',
          items: [
            'Unlimited watchlists for organizing tracked assets',
            'Price-based alerts with configurable thresholds',
            'Volume spike detection for unusual trading activity',
            'Real-Time Market Alerts System with multi-channel notifications',
            'Alert history and notification preferences management',
            'Persistent watchlist sync across sessions',
          ],
        },
        {
          title: 'User Experience & Interface',
          items: [
            'Professional dark-mode UI with FinancialJuice-inspired design',
            'Responsive mobile layout optimized for all screen sizes',
            'Interactive onboarding flow with welcome modal, feature checklist, tooltips',
            'Empty states with helpful guidance for new users',
            'Celebration animations for milestone achievements',
            'Settings panel for customization and preferences',
            'Shimmer loaders for smooth data loading states',
            'Detail modals for in-depth ticker information',
          ],
        },
        {
          title: 'Authentication & User Management',
          items: [
            'JWT-based authentication with secure refresh tokens',
            'Session management with persistent login',
            'User profiles with customizable settings',
            'Privacy-first OAuth integration for social signup',
          ],
        },
        {
          title: 'Legal & Compliance',
          items: [
            'Terms of Service page with full legal text',
            'Privacy Policy with GDPR compliance details',
            'Cookie Policy with consent management',
            'Trading Disclaimer for liability protection',
          ],
        },
        {
          title: 'Landing Page & Growth',
          items: [
            'Public landing page with product overview and CTA',
            'Waitlist system with email confirmation',
            'Analytics integration (GA4) with privacy-first consent gate',
            'Marketing-optimized copy and value propositions',
          ],
        },
        {
          title: 'Technical Infrastructure',
          items: [
            'Offline detection with graceful degradation',
            'WebSocket integration for real-time price updates',
            'Redis caching for performance optimization',
            'Background job queue (Bull) for async operations',
            'Comprehensive logging with structured console methods',
            'TypeScript for type safety throughout codebase',
            'TDD approach with route-level tests for watchlist and news aggregation',
          ],
        },
      ],
      added: [
        'Authentication system with JWT and refresh tokens',
        'Real-time price ticker bar with live market data',
        'News feed sidebar with sentiment indicators',
        'Market quotes sidebar showing key metrics',
        'Watchlist persistence to localStorage and database',
        'Alert notification system (in-app and email ready)',
        'Social sentiment tracking framework',
        'Economic calendar integration scaffolding',
        'Dark mode toggle with system preference detection',
        'Mobile navigation drawer',
        'Search functionality with debouncing',
        'User settings/preferences panel',
        'Data validation and error handling across API endpoints',
        'Request logging middleware',
        'Response standardization across endpoints',
        'Rate limiting preparation (scaffolding)',
      ],
      changed: [
        'UI Redesign: Complete visual overhaul from basic layout to professional trading terminal',
        'Navigation: Improved top bar with ticker, notifications, and user menu',
        'Watchlist UX: Moved to dedicated sidebar with drag-and-drop support',
        'News Integration: Migrated from static mock data to real NewsAPI integration',
        'Authentication Flow: Updated auth UI with improved form validation and feedback',
        'Settings Panel: Reorganized preferences for clarity and discoverability',
        'Color Scheme: Moved to fintech-professional dark palette with accent colors',
        'Typography: Improved readability with better font hierarchy and spacing',
        'Form Components: Upgraded to Shadcn/ui for consistency',
      ],
      fixed: [
        'Mobile responsive layout issues on iOS and Android devices',
        'Auth UI spacing and alignment problems',
        'Settings panel scrolling behavior',
        'Watchlist sync inconsistencies between sessions',
        'Shimmer loader animation performance',
        'Chart rendering lag on large datasets',
        'News feed pagination bugs',
        'Missing market data fallbacks',
        'Form validation timing issues',
        'WebSocket connection stability',
      ],
      security: [
        'Privacy-First Analytics: GA4 consent gate prevents tracking until user opt-in',
        'Secure token storage: JWT tokens in httpOnly cookies (when backend ready)',
        'CORS configuration: Restricted API access to approved domains',
        'Input sanitization: All user inputs validated and escaped',
        'Environment variables: Sensitive data moved to .env',
        'Trading Disclaimer: Added liability protection copy',
        'Data encryption ready: Scaffolding for HTTPS and data at rest encryption',
      ],
      removed: [
        'Mock API responses (replaced with real data integration)',
        'Hardcoded test data from components',
        'Legacy authentication form components',
        'Console.log statements (replaced with console.info)',
        'Static news items (now using dynamic API)',
      ],
    },
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// Category config
// ─────────────────────────────────────────────────────────────────────────────

const CATEGORIES = {
  majorFeatures: { label: '🎉 Major Features', color: '#4a9eff', bg: 'rgba(74,158,255,0.12)', border: 'rgba(74,158,255,0.3)' },
  added:         { label: '✅ Added',          color: '#22c55e', bg: 'rgba(34,197,94,0.12)',  border: 'rgba(34,197,94,0.3)' },
  changed:       { label: '🔄 Changed',        color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.3)' },
  fixed:         { label: '🔧 Fixed',          color: '#a78bfa', bg: 'rgba(167,139,250,0.12)',border: 'rgba(167,139,250,0.3)' },
  security:      { label: '🔒 Security',       color: '#f87171', bg: 'rgba(248,113,113,0.12)',border: 'rgba(248,113,113,0.3)' },
  removed:       { label: '🗑️ Removed',       color: '#6b7280', bg: 'rgba(107,114,128,0.12)',border: 'rgba(107,114,128,0.3)' },
  planned:       { label: '🚀 Coming Soon',    color: '#34d399', bg: 'rgba(52,211,153,0.12)', border: 'rgba(52,211,153,0.3)' },
} as const

type CategoryKey = keyof typeof CATEGORIES

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: ChangelogEntry['status'] }) {
  const cfg = {
    beta:       { label: 'Beta',       color: '#f59e0b', bg: 'rgba(245,158,11,0.15)',  border: 'rgba(245,158,11,0.4)' },
    stable:     { label: 'Stable',     color: '#22c55e', bg: 'rgba(34,197,94,0.15)',   border: 'rgba(34,197,94,0.4)' },
    unreleased: { label: 'Coming Soon',color: '#34d399', bg: 'rgba(52,211,153,0.15)',  border: 'rgba(52,211,153,0.4)' },
  }[status]

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: '2px 10px',
      borderRadius: '20px',
      fontSize: '11px',
      fontWeight: 700,
      letterSpacing: '0.04em',
      textTransform: 'uppercase',
      color: cfg.color,
      background: cfg.bg,
      border: `1px solid ${cfg.border}`,
    }}>
      {cfg.label}
    </span>
  )
}

function CategoryTag({ category }: { category: CategoryKey }) {
  const cfg = CATEGORIES[category]
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: '3px 10px',
      borderRadius: '6px',
      fontSize: '12px',
      fontWeight: 600,
      color: cfg.color,
      background: cfg.bg,
      border: `1px solid ${cfg.border}`,
      whiteSpace: 'nowrap',
    }}>
      {cfg.label}
    </span>
  )
}

function CategorySection({
  category,
  items,
  majorFeatures,
}: {
  category: CategoryKey
  items?: string[]
  majorFeatures?: { title: string; items: string[] }[]
}) {
  const [open, setOpen] = useState(category === 'majorFeatures' || category === 'planned')
  const cfg = CATEGORIES[category]

  const totalCount = category === 'majorFeatures'
    ? (majorFeatures?.reduce((acc, f) => acc + f.items.length, 0) ?? 0)
    : (items?.length ?? 0)

  return (
    <div style={{
      border: `1px solid ${cfg.border}`,
      borderRadius: '10px',
      overflow: 'hidden',
      background: 'var(--bg-1)',
    }}>
      {/* Header — clickable */}
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 18px',
          background: open ? cfg.bg : 'transparent',
          border: 'none',
          borderBottom: open ? `1px solid ${cfg.border}` : 'none',
          cursor: 'pointer',
          transition: 'background 0.15s',
          gap: '12px',
        }}
        onMouseEnter={e => {
          if (!open) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.03)'
        }}
        onMouseLeave={e => {
          if (!open) (e.currentTarget as HTMLButtonElement).style.background = 'transparent'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <CategoryTag category={category} />
          <span style={{ fontSize: '12px', color: 'var(--text-3)' }}>
            {totalCount} {totalCount === 1 ? 'item' : 'items'}
          </span>
        </div>
        <svg
          width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke={cfg.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          style={{ transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'rotate(0deg)', flexShrink: 0 }}
        >
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {/* Content */}
      {open && (
        <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {category === 'majorFeatures' && majorFeatures ? (
            majorFeatures.map((feature) => (
              <div key={feature.title}>
                <div style={{
                  fontSize: '13px',
                  fontWeight: 600,
                  color: cfg.color,
                  marginBottom: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: cfg.color, flexShrink: 0, display: 'inline-block' }} />
                  {feature.title}
                </div>
                <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '6px', paddingLeft: '12px' }}>
                  {feature.items.map((item, i) => (
                    <li key={i} style={{
                      fontSize: '13px',
                      color: 'var(--text-2)',
                      lineHeight: 1.5,
                      display: 'flex',
                      gap: '8px',
                      alignItems: 'flex-start',
                    }}>
                      <span style={{ color: cfg.color, marginTop: '5px', flexShrink: 0, fontSize: '10px' }}>▸</span>
                      <span dangerouslySetInnerHTML={{ __html: item.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
                    </li>
                  ))}
                </ul>
              </div>
            ))
          ) : (
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {items?.map((item, i) => (
                <li key={i} style={{
                  fontSize: '13px',
                  color: 'var(--text-2)',
                  lineHeight: 1.5,
                  display: 'flex',
                  gap: '8px',
                  alignItems: 'flex-start',
                }}>
                  <span style={{ color: cfg.color, marginTop: '5px', flexShrink: 0, fontSize: '10px' }}>▸</span>
                  <span dangerouslySetInnerHTML={{ __html: item.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

function VersionCard({ entry, defaultOpen }: { entry: ChangelogEntry; defaultOpen?: boolean }) {
  const [expanded, setExpanded] = useState(defaultOpen ?? false)

  const availableCategories = (Object.keys(entry.sections) as CategoryKey[]).filter(k => {
    if (k === 'majorFeatures') return (entry.sections.majorFeatures?.length ?? 0) > 0
    return (entry.sections[k as Exclude<CategoryKey, 'majorFeatures'>]?.length ?? 0) > 0
  })

  return (
    <div
      id={`v${entry.version.replace(/\./g, '-')}`}
      style={{
        position: 'relative',
        display: 'flex',
        gap: '24px',
        paddingBottom: '40px',
      }}
    >
      {/* Timeline line + dot */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
        <div style={{
          width: '14px',
          height: '14px',
          borderRadius: '50%',
          background: entry.isLatest ? '#4a9eff' : entry.status === 'unreleased' ? '#34d399' : 'var(--bg-3)',
          border: `2px solid ${entry.isLatest ? '#4a9eff' : entry.status === 'unreleased' ? '#34d399' : 'var(--border)'}`,
          boxShadow: entry.isLatest ? '0 0 10px rgba(74,158,255,0.5)' : 'none',
          flexShrink: 0,
          marginTop: '6px',
          zIndex: 1,
        }} />
        <div style={{
          flex: 1,
          width: '1px',
          background: 'var(--border)',
          marginTop: '6px',
        }} />
      </div>

      {/* Card */}
      <div style={{
        flex: 1,
        background: 'var(--bg-1)',
        border: `1px solid ${entry.isLatest ? 'rgba(74,158,255,0.4)' : 'var(--border)'}`,
        borderRadius: '12px',
        overflow: 'hidden',
        boxShadow: entry.isLatest ? '0 0 0 1px rgba(74,158,255,0.1), 0 4px 20px rgba(74,158,255,0.08)' : 'none',
        transition: 'border-color 0.2s',
      }}>
        {/* Card header */}
        <div
          style={{
            padding: '20px 24px',
            cursor: 'pointer',
            userSelect: 'none',
          }}
          onClick={() => setExpanded(!expanded)}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {/* Version + badges */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <span style={{
                  fontSize: '20px',
                  fontWeight: 700,
                  color: entry.isLatest ? '#4a9eff' : 'var(--text-0)',
                  letterSpacing: '-0.03em',
                  fontVariantNumeric: 'tabular-nums',
                }}>
                  {entry.status === 'unreleased' ? 'Unreleased' : `v${entry.version}`}
                </span>
                <StatusBadge status={entry.status} />
                {entry.isLatest && (
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '2px 10px',
                    borderRadius: '20px',
                    fontSize: '11px',
                    fontWeight: 700,
                    color: '#4a9eff',
                    background: 'rgba(74,158,255,0.15)',
                    border: '1px solid rgba(74,158,255,0.4)',
                  }}>
                    <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#4a9eff', display: 'inline-block', animation: 'pulse 2s infinite' }} />
                    Latest
                  </span>
                )}
              </div>
              {/* Date */}
              <span style={{ fontSize: '13px', color: 'var(--text-3)' }}>
                📅 {entry.date}
              </span>
              {/* Category tags summary */}
              {!expanded && availableCategories.length > 0 && (
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '4px' }}>
                  {availableCategories.map(cat => (
                    <CategoryTag key={cat} category={cat} />
                  ))}
                </div>
              )}
            </div>

            {/* Expand/collapse + permalink */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <a
                href={`#v${entry.version.replace(/\./g, '-')}`}
                onClick={e => e.stopPropagation()}
                title="Link to this version"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '32px',
                  height: '32px',
                  borderRadius: '6px',
                  border: '1px solid var(--border)',
                  color: 'var(--text-3)',
                  textDecoration: 'none',
                  background: 'var(--bg-2)',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => {
                  ;(e.currentTarget as HTMLAnchorElement).style.color = 'var(--text-0)'
                  ;(e.currentTarget as HTMLAnchorElement).style.borderColor = 'var(--text-3)'
                }}
                onMouseLeave={e => {
                  ;(e.currentTarget as HTMLAnchorElement).style.color = 'var(--text-3)'
                  ;(e.currentTarget as HTMLAnchorElement).style.borderColor = 'var(--border)'
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                </svg>
              </a>
              <button
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 14px',
                  borderRadius: '6px',
                  border: '1px solid var(--border)',
                  background: 'var(--bg-2)',
                  color: 'var(--text-2)',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  whiteSpace: 'nowrap',
                }}
                onMouseEnter={e => {
                  ;(e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-3)'
                  ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--text-0)'
                }}
                onMouseLeave={e => {
                  ;(e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-2)'
                  ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--text-2)'
                }}
              >
                {expanded ? 'Collapse' : 'View details'}
                <svg
                  width="14" height="14" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                  style={{ transition: 'transform 0.2s', transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
                >
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Expanded sections */}
        {expanded && (
          <div style={{
            borderTop: '1px solid var(--border)',
            padding: '20px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}>
            {(Object.keys(entry.sections) as CategoryKey[]).map(cat => {
              const items = cat === 'majorFeatures' ? undefined : entry.sections[cat as Exclude<CategoryKey, 'majorFeatures'>]
              const majorFeatures = cat === 'majorFeatures' ? entry.sections.majorFeatures : undefined
              if (cat === 'majorFeatures' && !majorFeatures?.length) return null
              if (cat !== 'majorFeatures' && !items?.length) return null
              return (
                <CategorySection
                  key={cat}
                  category={cat}
                  items={items}
                  majorFeatures={majorFeatures}
                />
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function SubscribeForm() {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) return
    setLoading(true)
    // Simulate API call — wire to waitlist backend when ready
    await new Promise(r => setTimeout(r, 900))
    setLoading(false)
    setSubmitted(true)
  }

  return (
    <div style={{
      background: 'var(--bg-1)',
      border: '1px solid rgba(74,158,255,0.25)',
      borderRadius: '14px',
      padding: '28px 32px',
      boxShadow: '0 0 40px rgba(74,158,255,0.06)',
    }}>
      {submitted ? (
        <div style={{ textAlign: 'center', padding: '8px 0' }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>🎉</div>
          <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-0)', marginBottom: '6px' }}>
            You&apos;re on the list!
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text-2)' }}>
            We&apos;ll notify you when new releases drop.
          </div>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <span style={{ fontSize: '20px' }}>🔔</span>
            <div>
              <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-0)' }}>
                Subscribe to release updates
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-3)', marginTop: '2px' }}>
                No spam. Just release notes when they ship.
              </div>
            </div>
          </div>
          <form
            onSubmit={handleSubmit}
            style={{ display: 'flex', gap: '10px', marginTop: '16px', flexWrap: 'wrap' }}
          >
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              style={{
                flex: 1,
                minWidth: '200px',
                padding: '10px 14px',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                background: 'var(--bg-2)',
                color: 'var(--text-0)',
                fontSize: '14px',
                outline: 'none',
              }}
            />
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: '10px 20px',
                borderRadius: '8px',
                border: 'none',
                background: loading ? 'rgba(74,158,255,0.5)' : '#4a9eff',
                color: '#fff',
                fontWeight: 700,
                fontSize: '14px',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'background 0.15s',
                whiteSpace: 'nowrap',
              }}
            >
              {loading ? 'Subscribing…' : 'Notify me'}
            </button>
          </form>
        </>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default function ChangelogPage() {
  return (
    <div style={{
      fontFamily: 'var(--font)',
      background: 'var(--bg-0)',
      color: 'var(--text-0)',
      minHeight: '100vh',
    }}>

      {/* ── Nav ── */}
      <nav style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        borderBottom: '1px solid var(--border)',
        background: 'rgba(10,10,12,0.9)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}>
        <div style={{
          maxWidth: '860px',
          margin: '0 auto',
          padding: '0 24px',
          height: '56px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo-header.svg"
              alt="TradVue"
              style={{ height: '36px', width: 'auto', objectFit: 'contain' }}
            />
          </Link>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <Link href="/landing" style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              fontSize: '13px', color: 'var(--text-2)', textDecoration: 'none',
              padding: '6px 14px', border: '1px solid var(--border)', borderRadius: '6px',
              transition: 'all 0.15s',
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
              </svg>
              Back to Home
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Breadcrumbs ── */}
      <Breadcrumbs
        maxWidth="860px"
        items={[{ label: 'Home', href: '/' }, { label: 'Changelog' }]}
      />

      {/* ── Hero ── */}
      <div style={{
        maxWidth: '860px',
        margin: '0 auto',
        padding: '56px 24px 40px',
      }}>
        <div style={{ marginBottom: '12px' }}>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 12px',
            borderRadius: '20px',
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: '#4a9eff',
            background: 'rgba(74,158,255,0.1)',
            border: '1px solid rgba(74,158,255,0.2)',
          }}>
            <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#4a9eff', display: 'inline-block' }} />
            Current: v0.1.0-beta
          </span>
        </div>

        <h1 style={{
          fontSize: 'clamp(28px, 5vw, 40px)',
          fontWeight: 800,
          letterSpacing: '-0.04em',
          color: 'var(--text-0)',
          marginBottom: '12px',
          lineHeight: 1.15,
        }}>
          Changelog
        </h1>
        <p style={{
          fontSize: '16px',
          color: 'var(--text-2)',
          lineHeight: 1.6,
          maxWidth: '520px',
          marginBottom: '32px',
        }}>
          Every release, every fix, every improvement — documented here. TradVue is in active beta development.
        </p>

        {/* Subscribe CTA */}
        <SubscribeForm />
      </div>

      {/* ── Timeline ── */}
      <div style={{
        maxWidth: '860px',
        margin: '0 auto',
        padding: '0 24px 80px',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          marginBottom: '32px',
          paddingBottom: '16px',
          borderBottom: '1px solid var(--border)',
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
          </svg>
          <span style={{ fontSize: '12px', color: 'var(--text-3)', letterSpacing: '0.05em', textTransform: 'uppercase', fontWeight: 600 }}>
            Release History — newest first
          </span>
        </div>

        {CHANGELOG.map((entry, i) => (
          <VersionCard
            key={entry.version}
            entry={entry}
            defaultOpen={i === 0 || entry.isLatest}
          />
        ))}
      </div>

      {/* ── Footer ── */}
      <div style={{
        borderTop: '1px solid var(--border)',
        background: 'var(--bg-1)',
        padding: '24px',
      }}>
        <div style={{
          maxWidth: '860px',
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
        }}>
          <p style={{ fontSize: '12px', color: 'var(--text-3)' }}>
            © 2026 TradVue. All rights reserved.
          </p>
          <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
            {[
              { label: 'Dashboard', href: '/' },
              { label: 'Landing', href: '/landing' },
              { label: 'Help', href: '/help' },
              { label: 'Terms', href: '/legal/terms' },
              { label: 'Privacy', href: '/legal/privacy' },
            ].map(l => (
              <Link key={l.href} href={l.href} style={{
                fontSize: '12px',
                color: 'var(--text-3)',
                textDecoration: 'none',
                transition: 'color 0.15s',
              }}>
                {l.label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* ── Keyframes ── */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.6; transform: scale(0.8); }
        }
      `}</style>
    </div>
  )
}
