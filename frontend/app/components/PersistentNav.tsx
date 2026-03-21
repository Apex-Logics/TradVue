'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { Suspense, useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { getSyncStatus, subscribeSyncStatus, initFullSync, type SyncStatus } from '../utils/cloudSync'
import dynamic from 'next/dynamic'
const AuthModal = dynamic(() => import('./AuthModal'), { ssr: false })

// ─── Chevron icon ─────────────────────────────────────────────────────────────
function ChevronDown({ size = 10 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}

// ─── User avatar icon ─────────────────────────────────────────────────────────
function UserIcon({ initial }: { initial?: string }) {
  if (initial) {
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 26, height: 26, borderRadius: '50%',
        background: 'var(--accent)', color: '#fff',
        fontSize: 11, fontWeight: 700, flexShrink: 0,
        lineHeight: 1,
      }}>
        {initial}
      </span>
    )
  }
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
  )
}

// ─── Dropdown component ───────────────────────────────────────────────────────
interface DropdownItem {
  label: string
  href: string
  icon?: React.ReactNode
  divider?: boolean
}

interface NavDropdownProps {
  label: React.ReactNode
  items: DropdownItem[]
  isActive?: boolean
  align?: 'left' | 'right'
}

function NavDropdown({ label, items, isActive, align = 'left' }: NavDropdownProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pathname = usePathname()

  const openMenu = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current)
    setOpen(true)
  }
  const closeMenu = () => {
    closeTimer.current = setTimeout(() => setOpen(false), 120)
  }
  const toggleMenu = () => setOpen(o => !o)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [open])

  const isItemActive = (href: string) => {
    if (href === '/') return pathname === '/'
    if (href.startsWith('/?')) return pathname === '/'
    return pathname.startsWith(href)
  }
  const anyActive = items.some(i => isItemActive(i.href))

  return (
    <div
      ref={ref}
      className={`apn-dropdown${open ? ' apn-dropdown-open' : ''}`}
      onMouseEnter={openMenu}
      onMouseLeave={closeMenu}
    >
      <button
        className={`nav-item apn-dropdown-trigger${isActive || anyActive ? ' active' : ''}`}
        onClick={toggleMenu}
        aria-haspopup="true"
        aria-expanded={open}
      >
        {label}
        <span style={{ marginLeft: 3, display: 'inline-flex', alignItems: 'center', opacity: 0.6 }}>
          <ChevronDown size={9} />
        </span>
      </button>
      {open && (
        <div className={`apn-dropdown-menu${align === 'right' ? ' apn-dropdown-menu-right' : ''}`}
          onMouseEnter={openMenu}
          onMouseLeave={closeMenu}
        >
          {items.map((item, i) => (
            item.divider
              ? <div key={`div-${i}`} className="apn-dropdown-divider" />
              : (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`apn-dropdown-item${isItemActive(item.href) ? ' active' : ''}`}
                  onClick={() => setOpen(false)}
                >
                  {item.icon && <span className="apn-dropdown-item-icon">{item.icon}</span>}
                  {item.label}
                </Link>
              )
          ))}
        </div>
      )}
    </div>
  )
}

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

// ─── Icons for dropdown items ─────────────────────────────────────────────────
function IconJournal() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
}
function IconPlaybooks() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
}
function IconPropFirm() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
}
function IconAnalysis() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
}
function IconCalendar() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
}
function IconMarketIntel() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
}
function IconAICoach() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.46 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z"/><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.46 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z"/></svg>
}
function IconRules() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
}
function IconRitual() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L9.5 8.5 3 9.27l5 4.87L6.82 21 12 17.77 17.18 21 16 14.14l5-4.87-6.5-.77z"/></svg>
}
function IconHelp() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
}
function IconSettings() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
}
function IconUpgrade() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
}
function IconIntegrations() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/></svg>
}
function IconAccount() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
}
function IconSignOut() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
}

// ─── Inner nav (uses hooks) ───────────────────────────────────────────────────
function NavInner() {
  const pathname = usePathname()
  const { user, logout } = useAuth()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [showAuthModal, setShowAuthModal] = useState(false)

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/'
    if (href.startsWith('/?')) return pathname === '/'
    return pathname.startsWith(href)
  }

  const handleNavClick = useCallback(() => {
    setDrawerOpen(false)
  }, [])

  useEffect(() => {
    if (!drawerOpen) return
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrawerOpen(false)
    }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [drawerOpen])

  useEffect(() => {
    if (drawerOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [drawerOpen])

  // Handle #signin link clicks → open auth modal
  useEffect(() => {
    const h = (e: MouseEvent) => {
      const link = (e.target as HTMLElement).closest('a[href="#signin"]')
      if (link) {
        e.preventDefault()
        setShowAuthModal(true)
      }
    }
    document.addEventListener('click', h)
    return () => document.removeEventListener('click', h)
  }, [])

  // Truncate email for display
  const truncateEmail = (email: string) => {
    if (email.length <= 20) return email
    const [local, domain] = email.split('@')
    if (!domain) return email.slice(0, 18) + '…'
    const truncLocal = local.length > 10 ? local.slice(0, 8) + '…' : local
    return `${truncLocal}@${domain}`
  }

  // Trading dropdown items
  const tradingItems: DropdownItem[] = [
    { label: 'Journal', href: '/journal', icon: <IconJournal /> },
    { label: 'Playbooks', href: '/playbooks', icon: <IconPlaybooks /> },
    { label: 'Prop Firm', href: '/propfirm', icon: <IconPropFirm /> },
    { label: '', href: '', divider: true },
    { label: 'Rules', href: '/rules', icon: <IconRules /> },
    { label: 'Ritual', href: '/ritual', icon: <IconRitual /> },
  ]

  // Analysis dropdown items
  const analysisItems: DropdownItem[] = [
    { label: 'Analysis', href: '/market-intel', icon: <IconAnalysis /> },
    { label: 'Market Intel', href: '/market-intel', icon: <IconMarketIntel /> },
    { label: 'Calendar', href: '/calendar', icon: <IconCalendar /> },
    { label: 'AI Coach', href: '/coach', icon: <IconAICoach /> },
  ]

  // User/account dropdown items
  const accountItems: DropdownItem[] = [
    ...(user ? [
      { label: user.email, href: '/account', icon: <IconAccount /> },
      { label: '', href: '', divider: true },
    ] : []),
    { label: 'Integrations', href: '/integrations', icon: <IconIntegrations /> },
    { label: 'Account', href: '/account', icon: <IconSettings /> },
    { label: 'Help', href: '/help', icon: <IconHelp /> },
    { label: '', href: '', divider: true },
    { label: 'Upgrade to Pro', href: '/pricing', icon: <IconUpgrade /> },
  ]

  // All items for the mobile drawer (flat list, grouped)
  const allDrawerItems = [
    { label: 'Dashboard', href: '/' },
    { label: 'News', href: '/news' },
    { label: 'Portfolio', href: '/portfolio' },
    { label: 'Tools', href: '/tools' },
    // Trading group
    { label: '── Trading ──', href: '', divider: true },
    { label: 'Journal', href: '/journal', icon: <IconJournal /> },
    { label: 'Playbooks', href: '/playbooks', icon: <IconPlaybooks /> },
    { label: 'Prop Firm', href: '/propfirm', icon: <IconPropFirm /> },
    { label: 'Rules', href: '/rules', icon: <IconRules /> },
    { label: 'Ritual', href: '/ritual', icon: <IconRitual /> },
    // Analysis group
    { label: '── Analysis ──', href: '', divider: true },
    { label: 'Analysis', href: '/market-intel', icon: <IconAnalysis /> },
    { label: 'Market Intel', href: '/market-intel', icon: <IconMarketIntel /> },
    { label: 'Calendar', href: '/calendar', icon: <IconCalendar /> },
    { label: 'AI Coach', href: '/coach', icon: <IconAICoach /> },
    // Account group
    { label: '── Account ──', href: '', divider: true },
    { label: 'Integrations', href: '/integrations', icon: <IconIntegrations /> },
    { label: 'Account', href: '/account', icon: <IconSettings /> },
    { label: 'Help', href: '/help', icon: <IconHelp /> },
    { label: 'Upgrade to Pro', href: '/pricing', icon: <IconUpgrade /> },
  ]

  return (
    <nav className="app-persistent-nav">
      <div className="apn-inner">
        {/* Logo */}
        <Link href="/" className="apn-logo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo-header.svg"
            alt="TradVue"
            className="apn-logo-img"
          />
        </Link>

        {/* Desktop nav items */}
        <div className="apn-items">
          <Link href="/" className={`nav-item${isActive('/') ? ' active' : ''}`}>Dashboard</Link>
          <Link href="/news" className={`nav-item${isActive('/news') ? ' active' : ''}`}>News</Link>
          <Link href="/portfolio" className={`nav-item${isActive('/portfolio') ? ' active' : ''}`}>Portfolio</Link>
          <Link href="/tools" className={`nav-item${isActive('/tools') ? ' active' : ''}`}>Tools</Link>

          <NavDropdown
            label="Trading"
            items={tradingItems}
          />
          <NavDropdown
            label="Analysis"
            items={analysisItems}
          />
        </div>

        {/* Right side */}
        <div className="apn-right">
          <SyncIndicator />

          {/* User dropdown */}
          <NavDropdown
            label={
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <UserIcon initial={user?.email?.[0]?.toUpperCase()} />
                {user && (
                  <span className="apn-user-email">{truncateEmail(user.email)}</span>
                )}
              </span>
            }
            items={
              user
                ? [
                    ...accountItems,
                    { label: '', href: '', divider: true },
                    { label: 'Sign Out', href: '#signout', icon: <IconSignOut /> },
                  ]
                : [
                    { label: 'Sign In', href: '#signin', icon: <IconAccount /> },
                    { label: 'Upgrade to Pro', href: '/pricing', icon: <IconUpgrade /> },
                  ]
            }
            align="right"
          />
        </div>

        {/* Hamburger button — visible on mobile */}
        <button
          className="apn-hamburger"
          onClick={() => setDrawerOpen(o => !o)}
          aria-label="Open navigation menu"
          aria-expanded={drawerOpen}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="12" x2="21" y2="12"/>
            <line x1="3" y1="6" x2="21" y2="6"/>
            <line x1="3" y1="18" x2="21" y2="18"/>
          </svg>
        </button>
      </div>

      {/* Backdrop */}
      <div
        className={`apn-drawer-backdrop${drawerOpen ? ' open' : ''}`}
        onClick={() => setDrawerOpen(false)}
        aria-hidden="true"
      />

      {/* Slide-out drawer */}
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
          {allDrawerItems.map((item, i) => {
            if (item.divider) {
              return (
                <div key={`sep-${i}`} className="apn-drawer-section-label">
                  {item.label.replace(/── /g, '').replace(/ ──/g, '')}
                </div>
              )
            }
            return (
              <Link
                key={item.href + item.label}
                href={item.href}
                className={`nav-item${isActive(item.href) ? ' active' : ''}`}
                onClick={handleNavClick}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
              >
                {item.icon && <span style={{ opacity: 0.7 }}>{item.icon}</span>}
                {item.label}
              </Link>
            )
          })}
        </div>

        {/* Drawer footer */}
        <div style={{
          borderTop: '1px solid var(--border)',
          padding: '12px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <SyncIndicator />
          </div>

          {user && (
            <>
              <div style={{ fontSize: 11, color: 'var(--text-3)', padding: '0 2px', wordBreak: 'break-all' }}>
                {user.email}
              </div>
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
                <IconSignOut />
                Sign Out
              </button>
            </>
          )}
        </div>
      </div>
      {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} />}
    </nav>
  )
}

// ─── Handle sign-out link click ───────────────────────────────────────────────
// We wrap NavInner in a component that intercepts the #signout href
function NavWithSignout() {
  const { logout } = useAuth()
  const handleClick = useCallback((e: MouseEvent) => {
    const target = e.target as HTMLElement
    const link = target.closest('a[href="#signout"]')
    if (link) {
      e.preventDefault()
      logout()
    }
  }, [logout])

  useEffect(() => {
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [handleClick])

  return <NavInner />
}

// ─── Export ───────────────────────────────────────────────────────────────────
export default function PersistentNav() {
  return (
    <Suspense fallback={null}>
      <NavWithSignout />
    </Suspense>
  )
}
