'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

// ─── Links ────────────────────────────────────────────────────────────────────

interface FooterLink {
  label: string
  href: string
  external?: boolean
}

const FOOTER_LINKS: FooterLink[] = [
  { label: 'Help & Support', href: '/help' },
  { label: 'Status',         href: '/status' },
  { label: 'Changelog',      href: '/changelog' },
  { label: 'Pricing',        href: '/pricing' },
  { label: 'Terms',          href: '/legal/terms' },
  { label: 'Privacy',        href: '/legal/privacy' },
  { label: 'Cookies',        href: '/legal/cookies' },
  { label: 'Disclaimer',     href: '/legal/disclaimer' },
  { label: 'Contact',        href: 'mailto:support@tradvue.com', external: true },
]

// App nav links for internal linking
const APP_LINKS: FooterLink[] = [
  { label: 'Journal',        href: '/journal' },
  { label: 'Portfolio',      href: '/portfolio' },
  { label: 'Tools',          href: '/tools' },
  { label: 'News',           href: '/news' },
  { label: 'Calendar',       href: '/calendar' },
  { label: 'Prop Firm',      href: '/propfirm' },
  { label: 'AI Coach',       href: '/coach' },
  { label: 'Ritual',         href: '/ritual' },
]

// SEO guide links
const SEO_LINKS: FooterLink[] = [
  { label: 'Best Trading Journal',    href: '/best-trading-journal' },
  { label: 'Prop Firm Tracker',       href: '/prop-firm-tracker' },
  { label: 'Futures Journal',         href: '/futures-trading-journal' },
  { label: 'Options Journal',         href: '/options-trading-journal' },
  { label: 'Trading Calculators',     href: '/trading-calculators' },
  { label: 'Post-Trade Ritual',       href: '/post-trade-ritual' },
]

// ─── Separator ────────────────────────────────────────────────────────────────

function Dot() {
  return (
    <span aria-hidden="true" style={{ color: 'var(--border)', userSelect: 'none' }}>
      ·
    </span>
  )
}

// ─── AppFooter ────────────────────────────────────────────────────────────────

export default function AppFooter() {
  const pathname = usePathname()

  // Don't render on the landing page — it has its own full marketing footer
  if (pathname?.startsWith('/landing')) return null

  return (
    <footer
      style={{
        background:    'var(--bg-1)',
        borderTop:     '1px solid var(--border)',
        padding:       '14px 16px 14px',
        fontSize:      '10px',
        color:         'var(--text-3)',
        lineHeight:    '1.6',
      }}
    >
      {/* Row 0 — app links */}
      <div
        style={{
          display:        'flex',
          flexWrap:       'wrap',
          alignItems:     'center',
          justifyContent: 'center',
          gap:            '6px',
          marginBottom:   '6px',
        }}
      >
        <span style={{ color: 'var(--text-3)', fontWeight: 600, fontSize: 9, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Tools:</span>
        {APP_LINKS.map((link, i) => (
          <span
            key={link.href}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            {i > 0 && <Dot />}
            <Link
              href={link.href}
              style={{ color: 'var(--text-3)', textDecoration: 'none' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-1)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-3)')}
            >
              {link.label}
            </Link>
          </span>
        ))}
      </div>

      {/* Row 0b — SEO guide links */}
      <div
        style={{
          display:        'flex',
          flexWrap:       'wrap',
          alignItems:     'center',
          justifyContent: 'center',
          gap:            '6px',
          marginBottom:   '6px',
        }}
      >
        <span style={{ color: 'var(--text-3)', fontWeight: 600, fontSize: 9, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Guides:</span>
        {SEO_LINKS.map((link, i) => (
          <span
            key={link.href}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            {i > 0 && <Dot />}
            <Link
              href={link.href}
              style={{ color: 'var(--text-3)', textDecoration: 'none' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-1)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-3)')}
            >
              {link.label}
            </Link>
          </span>
        ))}
      </div>

      {/* Row 1 — nav links */}
      <div
        style={{
          display:        'flex',
          flexWrap:       'wrap',
          alignItems:     'center',
          justifyContent: 'center',
          gap:            '6px',
          marginBottom:   '4px',
        }}
      >
        {FOOTER_LINKS.map((link, i) => (
          <span
            key={link.href}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            {i > 0 && <Dot />}
            {link.external ? (
              <a
                href={link.href}
                rel="noopener noreferrer"
                style={{ color: 'var(--text-3)', textDecoration: 'none' }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-1)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-3)')}
              >
                {link.label}
              </a>
            ) : (
              <Link
                href={link.href}
                style={{ color: 'var(--text-3)', textDecoration: 'none' }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-1)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-3)')}
              >
                {link.label}
              </Link>
            )}
          </span>
        ))}
      </div>

      {/* Row 2 — copyright + disclaimer */}
      <div
        style={{
          display:        'flex',
          flexWrap:       'wrap',
          alignItems:     'center',
          justifyContent: 'center',
          gap:            '8px',
          textAlign:      'center',
        }}
      >
        <span>© 2026 TradVue. All rights reserved.</span>
        <Dot />
        <span>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline', verticalAlign: 'middle', marginRight: 3 }}>
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>Not financial advice. For informational purposes only.{' '}
          <Link
            href="/legal/disclaimer"
            style={{ color: 'var(--accent)', textDecoration: 'none' }}
          >
            Read disclaimer
          </Link>
        </span>
      </div>
    </footer>
  )
}
