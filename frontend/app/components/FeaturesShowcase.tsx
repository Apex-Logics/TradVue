'use client'

const PLATFORM_FEATURES = [
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="4" y="2" width="16" height="20" rx="2"/>
        <line x1="8" y1="7" x2="16" y2="7"/>
        <line x1="8" y1="12" x2="8.01" y2="12" strokeWidth="3"/>
        <line x1="12" y1="12" x2="12.01" y2="12" strokeWidth="3"/>
        <line x1="16" y1="12" x2="16.01" y2="12" strokeWidth="3"/>
        <line x1="8" y1="16" x2="8.01" y2="16" strokeWidth="3"/>
        <line x1="12" y1="16" x2="12.01" y2="16" strokeWidth="3"/>
        <line x1="16" y1="16" x2="16.01" y2="16" strokeWidth="3"/>
      </svg>
    ),
    title: '30+ Trading Calculators',
    desc: 'Options Profit, Futures Risk/Reward, Position Sizing, Risk of Ruin, Compound Growth, Forex Pip, Trade Expectancy, Correlation Matrix, and more.',
    href: '/tools',
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
        <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
      </svg>
    ),
    title: 'Smart Market Alerts',
    desc: 'Real-time unusual move detection with automatic catalyst linking — know why a stock is moving before the crowd does.',
    href: '/news',
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
        <line x1="9" y1="7" x2="15" y2="7"/>
        <line x1="9" y1="11" x2="15" y2="11"/>
      </svg>
    ),
    title: 'Trading Journal',
    desc: 'CSV import, pattern detection, emotional tags, auto-detect asset class, streak tracking, and deep performance analytics.',
    href: '/journal',
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="2" y="7" width="20" height="14" rx="2"/>
        <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
        <line x1="12" y1="12" x2="12" y2="16"/>
        <line x1="10" y1="14" x2="14" y2="14"/>
      </svg>
    ),
    title: 'Portfolio Manager',
    desc: 'DRIP simulator, risk scoring, dividend calendar, and full holdings tracker with live P&L across all asset classes.',
    href: '/portfolio',
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/>
        <polyline points="16 7 22 7 22 13"/>
      </svg>
    ),
    title: 'Real-Time Data',
    desc: 'Live quotes, curated news feed, economic calendar with countdown timers, and earnings alerts for the stocks you own.',
    href: '/calendar',
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
        <polyline points="9 12 11 14 15 10"/>
      </svg>
    ),
    title: 'Free to Start',
    desc: 'No paywall for core features. No account required to start. Sign in only to sync your watchlist across devices.',
    href: '/',
  },
]

/**
 * "Everything You Need to Trade Smarter" feature cards grid.
 * Rendered below the main 3-column layout.
 */
export default function FeaturesShowcase() {
  return (
    <section
      aria-label="Platform features"
      style={{
        borderTop: '1px solid var(--border)',
        background: 'var(--bg-1)',
        padding: '36px 24px 32px',
      }}
    >
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-0)', margin: '0 0 6px', letterSpacing: '-0.01em' }}>
            Everything You Need to Trade Smarter
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text-3)', margin: 0 }}>
            30+ calculators · Smart alerts · Journal · Portfolio tracker · Real-time data — all free
          </p>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 14,
          }}
        >
          {PLATFORM_FEATURES.map(f => (
            <a key={f.title} href={f.href} style={{ textDecoration: 'none' }}>
              <div
                role="article"
                aria-label={f.title}
                style={{
                  background: 'var(--bg-2)',
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                  padding: '16px 18px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                  transition: 'border-color 0.15s, background 0.15s',
                  cursor: 'pointer',
                }}
                onMouseEnter={e => {
                  const el = e.currentTarget as HTMLDivElement
                  el.style.borderColor = 'var(--accent)'
                  el.style.background = 'var(--bg-3)'
                }}
                onMouseLeave={e => {
                  const el = e.currentTarget as HTMLDivElement
                  el.style.borderColor = 'var(--border)'
                  el.style.background = 'var(--bg-2)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: 'var(--accent)', flexShrink: 0, display: 'inline-flex' }}>
                    {f.icon}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-0)', letterSpacing: '-0.01em' }}>
                    {f.title}
                  </span>
                </div>
                <p style={{ fontSize: 11.5, color: 'var(--text-2)', margin: 0, lineHeight: 1.55 }}>
                  {f.desc}
                </p>
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  )
}
