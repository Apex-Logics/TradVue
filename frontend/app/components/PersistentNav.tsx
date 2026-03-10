'use client'

import { usePathname, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Suspense } from 'react'

// ─── Nav items ───────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { label: 'Dashboard', href: '/' },
  { label: 'News',      href: '/news' },
  { label: 'Analysis',  href: '/?view=analysis' },
  { label: 'Calendar',  href: '/calendar' },
  { label: 'Portfolio', href: '/portfolio' },
  { label: 'Tools',     href: '/tools' },
  { label: 'Journal',   href: '/journal' },
]

// ─── Inner nav (uses hooks) ───────────────────────────────────────────────────

function NavInner() {
  const pathname = usePathname()

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/'
    if (href.startsWith('/?')) return pathname === '/'
    return pathname.startsWith(href)
  }

  return (
    <nav className="app-persistent-nav">
      <div className="apn-inner">
        <Link href="/" className="apn-logo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo-header.svg"
            alt="TradVue"
            className="apn-logo-img"
          />
          <span className="logo-badge">BETA</span>
        </Link>

        <div className="apn-items">
          {NAV_ITEMS.map(item => (
            <Link
              key={item.label}
              href={item.href}
              className={`nav-item${isActive(item.href) ? ' active' : ''}`}
            >
              {item.label}
            </Link>
          ))}
        </div>

        <div className="apn-right">
          <Link href="/" className="apn-home-link">
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    </nav>
  )
}

// ─── Export (wrapped in Suspense for searchParams) ───────────────────────────

export default function PersistentNav() {
  return (
    <Suspense fallback={null}>
      <NavInner />
    </Suspense>
  )
}
