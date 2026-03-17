'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { Suspense, useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { getSyncStatus, subscribeSyncStatus, initFullSync, type SyncStatus } from '../utils/cloudSync'

// ─── Inline nav icons (16×16, currentColor) ───────────────────────────────────

function NavIconRitual() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 2L9.5 8.5 3 9.27l5 4.87L6.82 21 12 17.77 17.18 21 16 14.14l5-4.87-6.5-.77z"/>
    </svg>
  )
}

function NavIconCoach() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.46 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z"/>
      <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.46 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z"/>
    </svg>
  )
}

function NavIconRules() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
  )
}

// ─── Nav items ───────────────────────────────────────────────────────────────

const NAV_ITEMS: Array<{ label: string; href: string; icon?: React.ReactNode }> = [
  { label: 'Dashboard', href: '/' },
  { label: 'News',      href: '/news' },
  { label: 'Analysis',  href: '/?view=analysis' },
  { label: 'Calendar',  href: '/calendar' },
  { label: 'Tools',     href: '/tools' },
  { label: 'Portfolio', href: '/portfolio' },
  { label: 'Journal',   href: '/journal' },
  { label: 'Prop Firm', href: '/propfirm' },
  { label: 'Playbooks', href: '/playbooks' },
  { label: 'Ritual',    href: '/ritual',  icon: <NavIconRitual /> },
  { label: 'AI Coach',  href: '/coach',   icon: <NavIconCoach /> },
  { label: 'Rules',     href: '/rules',   icon: <NavIconRules /> },
  { label: 'Help',      href: '/help' },
]

// ─── Cloud Sync Indicator ─────────────────────────────────────────────────────

function SyncIndicator() {
  const { token } = useAuth()
  const [status, setStatus] = useState<SyncStatus>(() => getSyncStatus())
  const [syncing, setSyncing] = useState(false)
  const [flash, setFlash] = useState<string | null>(null)

  useEffect(() => {
    return subscribeSyncStatus(setStatus)
  }, [])

  const handleSync = async () => {
    if (!token) {
      setFlash('Sign in to enable sync')
      setTimeout(() => setFlash(null), 2500)
      return
    }
    setSyncing(true)
    setFlash('Syncing…')
    try {
      await initFullSync(token)
      setFlash('Synced ✓')
    } catch {
      setFlash('Sync error')
    } finally {
      setSyncing(false)
      setTimeout(() => setFlash(null), 2500)
    }
  }

  const color =
    status === 'syncing' ? 'var(--accent)' :
    status === 'synced'  ? '#4ade80'       :
    status === 'error'   ? '#f87171'       :
    'var(--text-3)'

  return (
    <button
      onClick={handleSync}
      disabled={syncing}
      title={flash ?? (token ? 'Click to sync' : 'Sign in to enable sync')}
      style={{
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        color,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        fontSize: 10,
        padding: '2px 6px',
        borderRadius: 4,
        opacity: syncing ? 0.7 : 1,
        transition: 'color 0.2s',
      }}
    >
      {/* Cloud icon */}
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/>
      </svg>
      <span style={{ whiteSpace: 'nowrap' }}>
        {flash ?? (
          token
            ? (status === 'syncing' ? 'Syncing…' : status === 'synced' ? 'Synced' : status === 'error' ? 'Error' : 'Sync')
            : 'Local'
        )}
      </span>
    </button>
  )
}

// ─── Inner nav (uses hooks) ───────────────────────────────────────────────────

function NavInner() {
  const pathname = usePathname()
  const { user, logout } = useAuth()
  const [drawerOpen, setDrawerOpen] = useState(false)

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/'
    if (href.startsWith('/?')) return pathname === '/'
    return pathname.startsWith(href)
  }

  // Close drawer on navigation
  const handleNavClick = useCallback(() => {
    setDrawerOpen(false)
  }, [])

  // Close drawer on Escape key
  useEffect(() => {
    if (!drawerOpen) return
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrawerOpen(false)
    }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [drawerOpen])

  // Lock body scroll when drawer is open
  useEffect(() => {
    if (drawerOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [drawerOpen])

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
          <span className="logo-badge">NEW</span>
        </Link>

        {/* Desktop + non-landscape tab bar */}
        <div className="apn-items">
          {NAV_ITEMS.map(item => (
            <Link
              key={item.label}
              href={item.href}
              className={`nav-item${isActive(item.href) ? ' active' : ''}`}
              style={item.icon ? { display: 'inline-flex', alignItems: 'center', gap: '5px' } : undefined}
            >
              {item.icon}
              {item.label}
            </Link>
          ))}
        </div>

        <div className="apn-right">
          {/* Sync indicator — visible on desktop */}
          <SyncIndicator />
          <Link href="/" className="apn-home-link">
            ← Back to Dashboard
          </Link>
        </div>

        {/* Hamburger button — only visible in landscape mobile via CSS */}
        <button
          className="apn-hamburger"
          onClick={() => setDrawerOpen(o => !o)}
          aria-label="Open navigation menu"
          aria-expanded={drawerOpen}
        >
          ☰
        </button>
      </div>

      {/* Backdrop — closes drawer on click */}
      <div
        className={`apn-drawer-backdrop${drawerOpen ? ' open' : ''}`}
        onClick={() => setDrawerOpen(false)}
        aria-hidden="true"
      />

      {/* Slide-out drawer with ALL nav items */}
      <div
        className={`apn-drawer${drawerOpen ? ' open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
      >
        <div className="apn-drawer-header">
          <span className="apn-drawer-title">Navigation</span>
          <button
            className="apn-drawer-close"
            onClick={() => setDrawerOpen(false)}
            aria-label="Close navigation menu"
          >
            ✕
          </button>
        </div>

        <div className="apn-drawer-items">
          {NAV_ITEMS.map(item => (
            <Link
              key={item.label}
              href={item.href}
              className={`nav-item${isActive(item.href) ? ' active' : ''}`}
              onClick={handleNavClick}
              style={item.icon ? { display: 'inline-flex', alignItems: 'center', gap: '5px' } : undefined}
            >
              {item.icon}
              {item.label}
            </Link>
          ))}
        </div>

        {/* Drawer footer — sync + sign out */}
        <div
          style={{
            borderTop: '1px solid var(--border)',
            padding: '12px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          {/* Sync indicator in drawer */}
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <SyncIndicator />
          </div>

          {/* Sign out — only when logged in */}
          {user && (
            <button
              onClick={() => { logout(); setDrawerOpen(false) }}
              style={{
                background: 'none',
                border: '1px solid var(--border)',
                borderRadius: 6,
                color: 'var(--text-2)',
                cursor: 'pointer',
                fontSize: 13,
                padding: '8px 12px',
                textAlign: 'left',
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              {/* Logout icon */}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
              Sign Out
            </button>
          )}
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
