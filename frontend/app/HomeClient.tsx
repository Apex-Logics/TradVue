'use client'

import { useState, useEffect, useCallback, useRef, Suspense } from 'react'
import dynamic from 'next/dynamic'
import { useSearchParams } from 'next/navigation'
import { useAuth } from './context/AuthContext'
import { useSettings } from './context/SettingsContext'
import { useOnboarding } from './context/OnboardingContext'
import { useToast } from './context/ToastContext'
import { trackWatchlistAdd, trackWatchlistRemove } from './utils/analytics'
import { initWatchlistSync, debouncedSyncWatchlist } from './utils/cloudSync'

// Lazy-load modals so they don't bloat initial bundle
const AuthModal      = dynamic(() => import('./components/AuthModal'),      { ssr: false })
const SettingsPanel  = dynamic(() => import('./components/SettingsPanel'),  { ssr: false })
const KeyboardShortcuts = dynamic(() => import('./components/KeyboardShortcuts'), { ssr: false })

// Alert system (SSE-powered real-time market alerts)
import { AlertBanner, AlertFeed, AlertBadge, useAlerts } from './components/AlertSystem'

// Onboarding
import { AlertsEmpty } from './components/EmptyState'
import OnboardingTooltip from './components/OnboardingTooltip'

// Extracted components
import TickerBar from './components/TickerBar'
import TickerSettingsDropdown from './components/TickerSettingsDropdown'
import StockDetailModal from './components/StockDetailModal'
import WatchlistPanel from './components/WatchlistPanel'
import NewsFeed from './components/NewsFeed'
import AnalysisPanel from './components/AnalysisPanel'
import MarketIntel from './components/MarketIntel'
import EconomicCalendarWidget from './components/EconomicCalendarWidget'
import PortfolioPanel from './components/PortfolioPanel'
import MarketAlertBar, { SmartAlertsBar, UpcomingEventsWidget } from './components/MarketAlertBar'
import FeaturesShowcase from './components/FeaturesShowcase'
import ErrorBoundary from './components/ErrorBoundary'

// Shared types, constants, utilities
import type { Quote, CalendarEvent, MarketStatus, CryptoCoin, NewsArticle, CompanyProfile } from './types'
import {
  DEFAULT_WATCHLIST, SIDEBAR_SYMBOLS, TICKER_SYMBOLS,
  MAX_TICKER_CUSTOM, NEWS_CAT_MAP, CRYPTO_SYMBOL_MAP,
  WL_CACHE_KEY, WL_CACHE_TTL, symbolName, stockSymbolsFromWatchlist,
} from './constants'
import { IconTrendingUp, IconCalendar, IconBell } from './components/Icons'
import { apiFetchSafe } from './lib/apiFetch'
import DataError from './components/DataError'
import PersistentNav from './components/PersistentNav'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

// ─── Watchlist quote cache ─────────────────────────────────────────────────────

interface WlCacheEntry { data: Record<string, Quote>; ts: number }

function loadWlCache(): Record<string, Quote> | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(WL_CACHE_KEY)
    if (!raw) return null
    const entry: WlCacheEntry = JSON.parse(raw)
    if (Date.now() - entry.ts > WL_CACHE_TTL) return null
    return entry.data
  } catch { return null }
}

function saveWlCache(data: Record<string, Quote>): void {
  try {
    const entry: WlCacheEntry = { data, ts: Date.now() }
    localStorage.setItem(WL_CACHE_KEY, JSON.stringify(entry))
  } catch {}
}

// ─── PriceAlertsWidget — fetches live prices from API + localStorage sync ────────

interface PriceAlertEntry {
  id: string
  symbol: string
  target_price: number
  direction: 'above' | 'below'
  triggered: boolean
  triggered_at?: string
  created_at: string
}

function PriceAlertsWidget({ onCreateAlert }: { onCreateAlert: () => void }) {
  const { token } = useAuth()
  const [alerts, setAlerts] = useState<PriceAlertEntry[]>([])
  const [liveQuotes, setLiveQuotes] = useState<Record<string, number>>({})
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Load alerts — prefer API when logged in, fall back to localStorage
  const loadAlerts = useCallback(async () => {
    if (token) {
      try {
        const res = await fetch(`${API_BASE}/api/alerts/price`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.ok) {
          const data = await res.json()
          const rows: PriceAlertEntry[] = data.alerts ?? []
          setAlerts(rows)
          // Keep localStorage in sync for offline fallback
          try { localStorage.setItem('cg_price_alerts', JSON.stringify(rows)) } catch {}
          return
        }
      } catch {}
    }
    // Fallback: localStorage
    try {
      const raw = localStorage.getItem('cg_price_alerts')
      setAlerts(raw ? JSON.parse(raw) : [])
    } catch { setAlerts([]) }
  }, [token])

  // Fetch live quotes for all active alert symbols
  const fetchQuotes = useCallback(async (currentAlerts: PriceAlertEntry[]) => {
    const symbols = [...new Set(currentAlerts.filter(a => !a.triggered).map(a => a.symbol))]
    if (!symbols.length) return
    try {
      const res = await fetch(
        `${API_BASE}/api/market-data/batch?symbols=${symbols.join(',')}`,
        token ? { headers: { Authorization: `Bearer ${token}` } } : undefined
      )
      if (res.ok) {
        const data = await res.json()
        const quotes: Record<string, number> = {}
        const batch = data?.data ?? {}
        for (const sym of symbols) {
          const q = batch[sym]
          if (q?.price) quotes[sym] = q.price
          else if (q?.current) quotes[sym] = q.current
        }
        setLiveQuotes(quotes)
      }
    } catch {}
  }, [token])

  // Initial load + SSE-triggered reload
  useEffect(() => {
    loadAlerts()
  }, [loadAlerts])

  // After alerts load, fetch quotes
  useEffect(() => {
    if (alerts.length) fetchQuotes(alerts)
  }, [alerts, fetchQuotes])

  // Poll quotes every 45s while widget is mounted
  useEffect(() => {
    pollRef.current = setInterval(() => {
      fetchQuotes(alerts)
    }, 45_000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [alerts, fetchQuotes])

  // Listen for SSE price_alert_triggered events to refresh
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (detail?.type === 'price_alert_triggered') loadAlerts()
    }
    window.addEventListener('tradvue:alert', handler)
    return () => window.removeEventListener('tradvue:alert', handler)
  }, [loadAlerts])

  const deleteAlert = async (id: string) => {
    // Optimistic update
    setAlerts(prev => prev.filter(a => a.id !== id))
    try { localStorage.setItem('cg_price_alerts', JSON.stringify(alerts.filter(a => a.id !== id))) } catch {}
    if (token) {
      try {
        await fetch(`${API_BASE}/api/alerts/price/${id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        })
      } catch {}
    }
  }

  const active    = alerts.filter(a => !a.triggered).sort((a, b) => {
    const curA = liveQuotes[a.symbol]
    const curB = liveQuotes[b.symbol]
    if (!curA && !curB) return 0
    if (!curA) return 1
    if (!curB) return -1
    const pctA = Math.abs((a.target_price - curA) / curA)
    const pctB = Math.abs((b.target_price - curB) / curB)
    return pctA - pctB
  })
  const triggered = alerts.filter(a => a.triggered)
  const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  const pctAway = (alert: PriceAlertEntry): string | null => {
    const cur = liveQuotes[alert.symbol]
    if (!cur) return null
    const pct = ((alert.target_price - cur) / cur) * 100
    return (pct >= 0 ? '+' : '') + pct.toFixed(2) + '%'
  }

  // Direction indicator: arrow shows if price is moving toward or away from target
  const movingToward = (alert: PriceAlertEntry): boolean | null => {
    const cur = liveQuotes[alert.symbol]
    if (!cur) return null
    if (alert.direction === 'above') return cur < alert.target_price  // below target = still needs to go up
    return cur > alert.target_price  // above target = still needs to drop
  }

  return (
    <div style={{ overflowY: 'auto', maxHeight: '100%', padding: '10px 12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-2)' }}>
          PRICE ALERTS {active.length > 0 && <span style={{ background: 'var(--accent)', color: '#fff', borderRadius: 10, padding: '1px 6px', fontSize: 'var(--fs-xs)', marginLeft: 4 }}>{active.length}</span>}
        </span>
        <button
          onClick={onCreateAlert}
          style={{ fontSize: 'var(--fs-sm)', color: 'var(--accent)', cursor: 'pointer', padding: '3px 8px', border: '1px solid var(--accent)', borderRadius: 4, background: 'transparent', display: 'flex', alignItems: 'center', gap: 4 }}
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          New Alert
        </button>
      </div>

      {alerts.length === 0 && (
        <div style={{ textAlign: 'center', padding: '30px 16px', color: 'var(--text-3)' }}>
          <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'center' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
          </div>
          <div style={{ fontSize: 'var(--fs-md)', color: 'var(--text-2)', marginBottom: 4 }}>No price alerts set</div>
          <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-3)' }}>Create alerts in Portfolio → Alerts tab</div>
          <button onClick={onCreateAlert} style={{ marginTop: 10, fontSize: 'var(--fs-sm)', color: 'var(--accent)', cursor: 'pointer', padding: '5px 12px', border: '1px solid var(--accent)', borderRadius: 5, background: 'transparent' }}>
            Go to Portfolio Alerts
          </button>
        </div>
      )}

      {active.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-3)', marginBottom: 6 }}>ACTIVE ({active.length})</div>
          {active.map(a => {
            const cur  = liveQuotes[a.symbol]
            const pct  = pctAway(a)
            const toward = movingToward(a)
            return (
              <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 10px', marginBottom: 5 }}>
                <div style={{ color: a.direction === 'above' ? 'var(--green)' : 'var(--red)', flexShrink: 0 }}>
                  {a.direction === 'above'
                    ? <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>
                    : <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>
                  }
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 'var(--fs-md)', color: 'var(--text-0)' }}>{a.symbol}</div>
                  <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-3)' }}>
                    {a.direction === 'above' ? 'Above' : 'Below'} <span style={{ color: 'var(--text-1)', fontFamily: 'monospace' }}>${fmt(a.target_price)}</span>
                  </div>
                </div>
                {/* Live price + distance */}
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  {cur ? (
                    <>
                      <div style={{ fontSize: 'var(--fs-sm)', fontFamily: 'monospace', color: 'var(--text-1)' }}>${fmt(cur)}</div>
                      {pct && (
                        <div style={{ fontSize: 'var(--fs-xs)', color: toward ? 'var(--green)' : 'var(--red)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 2 }}>
                          {toward
                            ? <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                            : <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="4"/></svg>
                          }
                          {pct}
                        </div>
                      )}
                    </>
                  ) : (
                    <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-3)' }}>—</div>
                  )}
                </div>
                <button
                  onClick={() => deleteAlert(a.id)}
                  style={{ color: 'var(--text-3)', cursor: 'pointer', padding: '2px', border: 'none', background: 'none', borderRadius: 3, display: 'flex', alignItems: 'center', flexShrink: 0 }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--red)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-3)' }}
                  title="Delete alert"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                </button>
              </div>
            )
          })}
        </div>
      )}

      {triggered.length > 0 && (
        <div>
          <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-3)', marginBottom: 6 }}>TRIGGERED ({triggered.length})</div>
          {triggered.map(a => (
            <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-2)', border: '1px solid rgba(0,192,106,0.35)', borderRadius: 6, padding: '8px 10px', marginBottom: 5 }}>
              <div style={{ color: 'var(--green)', flexShrink: 0 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 'var(--fs-md)', color: 'var(--text-1)' }}>{a.symbol}</div>
                <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-3)' }}>
                  Triggered · ${fmt(a.target_price)}
                  {a.triggered_at && <> · {new Date(a.triggered_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</>}
                </div>
              </div>
              <button
                onClick={() => deleteAlert(a.id)}
                style={{ color: 'var(--text-3)', cursor: 'pointer', padding: '2px', border: 'none', background: 'none', borderRadius: 3, display: 'flex', alignItems: 'center', flexShrink: 0 }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--red)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-3)' }}
                title="Delete alert"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
              </button>
            </div>
          ))}
        </div>
      )}
      {/* Notification settings link */}
      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8, marginTop: 8, textAlign: 'center' }}>
        <a
          href="/account#notifications"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            fontSize: 'var(--fs-sm)', color: 'var(--text-3)', textDecoration: 'none',
            transition: 'color 0.15s',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.color = 'var(--accent)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.color = 'var(--text-3)' }}
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
          Notification Settings
        </a>
      </div>
    </div>
  )
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function HomeClient() {
  const searchParams = useSearchParams()
  const { user, token, loadWatchlistFromBackend, syncAddToWatchlist, syncRemoveFromWatchlist } = useAuth()
  const { settings, openSettings, settingsOpen, closeSettings } = useSettings()
  const { markChecklistItem } = useOnboarding()
  const { showToast } = useToast()

  // Real-time alert system
  const {
    alerts: marketAlerts,
    unreadCount: alertUnreadCount,
    isConnected: alertConnected,
    prefs: alertPrefs,
    updatePrefs: updateAlertPrefs,
    flashActive: alertFlash,
    markAllRead: markAlertsRead,
    dismissAlert,
    clearAllAlerts,
    refresh: refreshAlerts,
  } = useAlerts()

  const [clock, setClock]     = useState('')
  const [isOffline, setIsOffline] = useState(false)

  // News
  const [newsCategory, setNewsCategory]       = useState('All')
  const [authModalOpen, setAuthModalOpen]     = useState(false)

  // Ticker
  const [tickerQuotes, setTickerQuotes]               = useState<Record<string, Quote>>({})
  const [tickerLoading, setTickerLoading]             = useState(true)
  const [customTickerSymbols, setCustomTickerSymbols] = useState<string[]>([])
  const [tickerHiddenSymbols, setTickerHiddenSymbols] = useState<Set<string>>(new Set())
  const [tickerSettingsOpen, setTickerSettingsOpen]   = useState(false)
  const [tickerSize, setTickerSize] = useState<'compact' | 'normal' | 'large'>(() => {
    try { return (localStorage.getItem('cg_ticker_size') as 'compact' | 'normal' | 'large') || 'compact' } catch { return 'compact' }
  })

  // Column widths (resizable)
  const [colWidths, setColWidths] = useState<[number, number, number]>([20, 56, 24])
  const layoutRef = useRef<HTMLDivElement>(null)

  // Portfolio collapsed
  const [portfolioCollapsed, setPortfolioCollapsed] = useState(false)

  // Sidebar quotes
  const [quotes, setQuotes]             = useState<Record<string, Quote>>(() => loadWlCache() || {})
  const [loadingQuotes, setLoadingQuotes] = useState(() => !loadWlCache())
  const [marketStatus, setMarketStatus] = useState<MarketStatus | null>(null)
  const watchlistFetchedRef   = useRef<Set<string>>(new Set())
  const watchlistFetchStartRef = useRef<number>(0)

  // Watchlist
  const [watchlist, setWatchlist]             = useState<string[]>(DEFAULT_WATCHLIST)
  const [watchlistSyncing, setWatchlistSyncing] = useState(false)
  const didSyncWatchlist = useRef(false)

  // Calendar
  const [calendarEvents, setCalendarEvents]   = useState<CalendarEvent[]>([])
  const [loadingCalendar, setLoadingCalendar] = useState(true)

  // News
  const [newsArticles, setNewsArticles]         = useState<NewsArticle[]>([])
  const [loadingNews, setLoadingNews]           = useState(true)
  const [newsError, setNewsError]               = useState<string | null>(null)
  const [newsSymbolFilter, setNewsSymbolFilter] = useState('')
  const [newsArticleCount, setNewsArticleCount] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      try { return Number(localStorage.getItem('cg_news_count')) || 25 } catch {}
    }
    return 10
  })

  // Crypto prices
  const [cryptoCoins, setCryptoCoins] = useState<CryptoCoin[]>([])

  // Stock detail modal
  const [selectedStock, setSelectedStock]           = useState<{ symbol: string; name: string } | null>(null)
  const [showStockModal, setShowStockModal]         = useState(false)
  const [stockQuote, setStockQuote]                 = useState<Quote | null>(null)
  const [stockProfile, setStockProfile]             = useState<CompanyProfile | null>(null)
  const [loadingStockQuote, setLoadingStockQuote]   = useState(false)
  const [loadingStockProfile, setLoadingStockProfile] = useState(false)

  // Alerts/Calendar tab
  const [showAlerts, setShowAlerts] = useState(false)

  // Active nav tab — initialise from ?view= query param if present
  const [activeNav, setActiveNav] = useState(() => {
    // useState initialiser runs client-side; searchParams is available via closure
    return 'Markets'
  })

  // Mobile nav
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [mobileNavOpen, setMobileNavOpen]         = useState(false)

  // ── Read ?view= query param on initial load ──────────────────────────────────
  useEffect(() => {
    const view = searchParams?.get('view')
    const wantsSignup = searchParams?.get('signup')
    if (wantsSignup === 'true' && !user) {
      setAuthModalOpen(true)
    }
    if (view === 'analysis') {
      setActiveNav('Analysis')
    }
    if (view === 'market-intel') {
      setActiveNav('Market Intel')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Clock ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString('en-US', {
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
    }))
    tick()
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [])

  // ── Offline ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const off = () => setIsOffline(true)
    const on  = () => setIsOffline(false)
    window.addEventListener('offline', off)
    window.addEventListener('online', on)
    setIsOffline(!navigator.onLine)
    return () => { window.removeEventListener('offline', off); window.removeEventListener('online', on) }
  }, [])

  // ── Persist: watchlist ───────────────────────────────────────────────────────
  useEffect(() => {
    try {
      const s = localStorage.getItem('cg_wl')
      if (s) {
        const parsed = JSON.parse(s)
        setWatchlist(Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_WATCHLIST)
      }
    } catch {}
  }, [])

  useEffect(() => {
    try { localStorage.setItem('cg_wl', JSON.stringify(watchlist)) } catch {}
    debouncedSyncWatchlist(watchlist)
  }, [watchlist])

  // ── Cloud sync: watchlist ────────────────────────────────────────────────────
  useEffect(() => {
    if (!token) return
    initWatchlistSync(token).then(() => {
      try {
        const s = localStorage.getItem('cg_wl')
        if (s) {
          const parsed = JSON.parse(s)
          if (Array.isArray(parsed) && parsed.length > 0) setWatchlist(parsed)
        }
      } catch {}
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  // ── Persist: custom ticker ───────────────────────────────────────────────────
  useEffect(() => {
    try { const s = localStorage.getItem('cg_ticker'); if (s) setCustomTickerSymbols(JSON.parse(s)) } catch {}
  }, [])
  useEffect(() => {
    try { localStorage.setItem('cg_ticker', JSON.stringify(customTickerSymbols)) } catch {}
  }, [customTickerSymbols])

  // ── Persist: ticker prefs (hidden symbols) ───────────────────────────────────
  useEffect(() => {
    try {
      const s = localStorage.getItem('cg_ticker_prefs')
      if (s) setTickerHiddenSymbols(new Set(JSON.parse(s)))
    } catch {}
  }, [])
  useEffect(() => {
    try { localStorage.setItem('cg_ticker_prefs', JSON.stringify([...tickerHiddenSymbols])) } catch {}
  }, [tickerHiddenSymbols])

  // ── Persist: ticker size ─────────────────────────────────────────────────────
  useEffect(() => {
    try { localStorage.setItem('cg_ticker_size', tickerSize) } catch {}
  }, [tickerSize])

  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === 'cg_ticker_size' && e.newValue) {
        setTickerSize(e.newValue as 'compact' | 'normal' | 'large')
      }
    }
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, [])

  // ── Persist: news count ──────────────────────────────────────────────────────
  useEffect(() => {
    try { localStorage.setItem('cg_news_count', String(newsArticleCount)) } catch {}
  }, [newsArticleCount])

  // ── Persist: column widths ───────────────────────────────────────────────────
  useEffect(() => {
    try {
      const s = localStorage.getItem('cg_col_widths')
      if (s) setColWidths(JSON.parse(s))
    } catch {}
  }, [])
  useEffect(() => {
    try { localStorage.setItem('cg_col_widths', JSON.stringify(colWidths)) } catch {}
  }, [colWidths])

  // ── Backend watchlist sync on login ──────────────────────────────────────────
  useEffect(() => {
    if (!token || didSyncWatchlist.current) return
    didSyncWatchlist.current = true
    const doSync = async () => {
      setWatchlistSyncing(true)
      const backendSymbols = await loadWatchlistFromBackend()
      if (backendSymbols.length > 0) {
        setWatchlist(prev => [...new Set([...backendSymbols, ...prev])])
      }
      setWatchlistSyncing(false)
    }
    doSync()
  }, [token, loadWatchlistFromBackend])

  useEffect(() => {
    if (!token) didSyncWatchlist.current = false
  }, [token])

  // ── Fetch ticker quotes ──────────────────────────────────────────────────────
  const fetchTickerQuotes = useCallback(async (extra: string[] = []) => {
    if (isOffline) return
    try {
      const cryptoSymbols = new Set(['BTC-USD', 'ETH-USD', 'GC=F', 'CL=F'])
      const all = [...new Set([...TICKER_SYMBOLS, ...extra])]
      const stockSymbols = all.filter(s => !cryptoSymbols.has(s))

      const j = await apiFetchSafe<{ success: boolean; data: Record<string, Quote> }>(`${API_BASE}/api/market-data/batch?symbols=${stockSymbols.join(',')}`)
      if (j?.success && j.data) {
        const merged = { ...j.data }
        try {
          const cj = await apiFetchSafe<{ success: boolean; data: Array<{ symbol: string; price: number; change24h: number }> }>(`${API_BASE}/api/crypto/prices?limit=20`)
          if (cj?.success && cj.data) {
            const btc = cj.data.find((c: { symbol: string }) => c.symbol === 'BTC')
            const eth = cj.data.find((c: { symbol: string }) => c.symbol === 'ETH')
            if (btc) merged['BTC-USD'] = { symbol: 'BTC-USD', current: btc.price, change: btc.price * btc.change24h / 100, changePct: btc.change24h, high: btc.price * 1.02, low: btc.price * 0.98, open: btc.price, prevClose: btc.price, timestamp: new Date().toISOString(), source: 'finnhub' as const }
            if (eth) merged['ETH-USD'] = { symbol: 'ETH-USD', current: eth.price, change: eth.price * eth.change24h / 100, changePct: eth.change24h, high: eth.price * 1.02, low: eth.price * 0.98, open: eth.price, prevClose: eth.price, timestamp: new Date().toISOString(), source: 'finnhub' as const }
          }
        } catch (cryptoErr) {
          console.warn('[TickerBar] crypto prices fetch failed (ignored):', cryptoErr instanceof Error ? cryptoErr.message : cryptoErr)
        }
        setTickerQuotes(merged)
        setTickerLoading(false)
      }
    } catch (err) {
      console.warn('[TickerBar] fetch failed:', err)
      setTickerLoading(false)
    }
  }, [isOffline])

  // ── Fetch watchlist quotes (batch, with cache) ───────────────────────────────
  const fetchQuotes = useCallback(async (symbols?: string[]) => {
    if (isOffline) return
    const toFetch = symbols
      ? [...new Set([...SIDEBAR_SYMBOLS, ...symbols])]
      : SIDEBAR_SYMBOLS
    watchlistFetchStartRef.current = Date.now()
    watchlistFetchedRef.current = new Set()
    try {
      const chunks: string[][] = []
      for (let i = 0; i < toFetch.length; i += 50) chunks.push(toFetch.slice(i, i + 50))
      const allData: Record<string, Quote> = {}
      await Promise.all(
        chunks.map(async chunk => {
          const j = await apiFetchSafe<{ success: boolean; data: Record<string, Quote> }>(
            `${API_BASE}/api/market-data/batch?symbols=${chunk.join(',')}`
          )
          if (j?.success && j.data) {
            Object.assign(allData, j.data)
            Object.keys(j.data).forEach(s => watchlistFetchedRef.current.add(s))
          }
        })
      )
      if (Object.keys(allData).length > 0) {
        setQuotes(prev => {
          const merged = { ...prev, ...allData }
          saveWlCache(merged)
          return merged
        })
      }
    } finally {
      setLoadingQuotes(false)
      toFetch.forEach(s => watchlistFetchedRef.current.add(s))
    }
  }, [isOffline])

  // ── Fetch market status ──────────────────────────────────────────────────────
  const fetchStatus = useCallback(async () => {
    if (isOffline) return
    const j = await apiFetchSafe<{ success: boolean; data: MarketStatus }>(`${API_BASE}/api/market-data/status?exchange=US`)
    if (j?.success) setMarketStatus(j.data)
  }, [isOffline])

  // ── Fetch crypto prices ──────────────────────────────────────────────────────
  const fetchCryptoPrices = useCallback(async () => {
    if (isOffline) return
    const j = await apiFetchSafe<{ success: boolean; data: CryptoCoin[] }>(`${API_BASE}/api/crypto/prices?limit=10`)
    if (j?.success && j.data) setCryptoCoins(j.data)
  }, [isOffline])

  // ── Fetch economic calendar ──────────────────────────────────────────────────
  // Fetch today + 3 days ahead so the widget can group and show multiple days.
  // The EconomicCalendarWidget handles all filtering (earnings, impact, currency).
  const fetchCalendar = useCallback(async () => {
    if (isOffline) return
    setLoadingCalendar(true)
    try {
      const todayET = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
      // Compute today+3 days (handles month boundaries via JS Date)
      const [ey, em, ed] = todayET.split('-').map(Number)
      const plus3 = new Date(ey, em - 1, ed + 3)
      const plus3ET = `${plus3.getFullYear()}-${String(plus3.getMonth() + 1).padStart(2, '0')}-${String(plus3.getDate()).padStart(2, '0')}`
      const j = await apiFetchSafe<{ success: boolean; data?: CalendarEvent[]; events?: CalendarEvent[] }>(
        `${API_BASE}/api/calendar/events?from=${todayET}&to=${plus3ET}&limit=500`
      )
      setCalendarEvents(j?.success ? (j.data ?? j.events ?? []) : [])
    } finally {
      setLoadingCalendar(false)
    }
  }, [isOffline])

  // ── Fetch news ───────────────────────────────────────────────────────────────
  const fetchNews = useCallback(async (cat: string, sym?: string, count?: number) => {
    if (isOffline) { setLoadingNews(false); return }
    setLoadingNews(true)
    setNewsError(null)
    const limit = count ?? newsArticleCount
    try {
      let url: string
      if (sym?.trim()) {
        url = `${API_BASE}/api/feed/news/symbol/${encodeURIComponent(sym.trim().toUpperCase())}?limit=${limit}`
      } else {
        const apiCat = NEWS_CAT_MAP[cat] || 'all'
        const p = new URLSearchParams({ limit: String(limit) })
        if (apiCat !== 'all') p.set('category', apiCat)
        url = `${API_BASE}/api/feed/news?${p.toString()}`
      }
      const j = await apiFetchSafe<{ success: boolean; data: NewsArticle[]; error?: string }>(url)
      if (j?.success) {
        // Deduplicate by id + guard against malformed articles
        const raw = j.data || []
        const seen = new Set<string>()
        const deduped = raw.filter(a => {
          if (!a || typeof a !== 'object') return false
          // Ensure symbols is always an array
          if (!Array.isArray(a.symbols)) (a as NewsArticle).symbols = []
          const key = a.id || a.url || a.title || Math.random().toString(36)
          if (seen.has(key)) return false
          seen.add(key)
          return true
        })
        setNewsArticles(deduped)
      } else {
        setNewsError('unavailable')
        setNewsArticles([])
      }
    } catch {
      setNewsError('unavailable')
      setNewsArticles([])
    } finally {
      setLoadingNews(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOffline, newsArticleCount])

  // ── Initial load ─────────────────────────────────────────────────────────────
  useEffect(() => {
    fetchTickerQuotes(customTickerSymbols)
    fetchQuotes(stockSymbolsFromWatchlist(DEFAULT_WATCHLIST))
    fetchStatus()
    fetchCalendar()
    fetchNews('All')
    fetchCryptoPrices()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Auto-refresh every 30s ───────────────────────────────────────────────────
  useEffect(() => {
    const t = setInterval(() => fetchTickerQuotes(customTickerSymbols), 30_000)
    return () => clearInterval(t)
  }, [fetchTickerQuotes, customTickerSymbols])

  useEffect(() => {
    const t = setInterval(() => fetchQuotes(stockSymbolsFromWatchlist(watchlist)), 30_000)
    return () => clearInterval(t)
  }, [fetchQuotes, watchlist])

  // ── Re-fetch on new watchlist symbols ────────────────────────────────────────
  const prevWatchlistRef = useRef<string[]>(DEFAULT_WATCHLIST)
  useEffect(() => {
    const prev = prevWatchlistRef.current
    const added = watchlist.filter(s => !prev.includes(s) && !CRYPTO_SYMBOL_MAP[s.toUpperCase()])
    prevWatchlistRef.current = watchlist
    if (added.length > 0) fetchQuotes(stockSymbolsFromWatchlist(watchlist))
  }, [watchlist, fetchQuotes])

  // ── News category change ─────────────────────────────────────────────────────
  const handleNewsCategory = useCallback((cat: string) => {
    setNewsCategory(cat)
    setNewsSymbolFilter('')
    fetchNews(cat)
  }, [fetchNews])

  // ── News symbol filter debounce ──────────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => {
      if (newsSymbolFilter.trim()) fetchNews(newsCategory, newsSymbolFilter)
      else fetchNews(newsCategory)
    }, 400)
    return () => clearTimeout(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newsSymbolFilter])

  // ── Open stock detail modal ──────────────────────────────────────────────────
  const openStockDetail = useCallback(async (symbol: string, name?: string) => {
    const resolvedName = name || symbolName(symbol)
    setSelectedStock({ symbol, name: resolvedName })
    setShowStockModal(true)
    setStockQuote(null)
    setStockProfile(null)
    setLoadingStockQuote(true)
    setLoadingStockProfile(true)

    try {
      const cached = tickerQuotes[symbol] || quotes[symbol]
      if (cached) {
        setStockQuote(cached)
        setLoadingStockQuote(false)
      } else {
        let fetched = false
        const bj = await apiFetchSafe<{ success: boolean; data: Record<string, Quote> }>(`${API_BASE}/api/market-data/batch?symbols=${encodeURIComponent(symbol)}`)
        if (bj?.success && bj.data?.[symbol]) { setStockQuote(bj.data[symbol]); fetched = true }
        if (!fetched) {
          const qj = await apiFetchSafe<{ success: boolean; data: Quote }>(`${API_BASE}/api/market-data/quote?symbol=${encodeURIComponent(symbol)}`)
          if (qj?.success && qj.data) setStockQuote(qj.data)
        }
        setLoadingStockQuote(false)
      }
    } catch (err) {
      console.warn('[StockDetail] quote fetch failed:', err instanceof Error ? err.message : err)
      setLoadingStockQuote(false)
    }

    try {
      const pj = await apiFetchSafe<{ success: boolean; data: CompanyProfile }>(`${API_BASE}/api/market-data/profile/${encodeURIComponent(symbol)}`)
      if (pj?.success && pj.data) setStockProfile(pj.data)
    } finally {
      setLoadingStockProfile(false)
    }
  }, [tickerQuotes, quotes])

  const closeStockDetail = () => {
    setShowStockModal(false)
    setSelectedStock(null)
    setStockQuote(null)
    setStockProfile(null)
  }

  // ── Select a ticker without opening the chart modal (used on non-dashboard tabs) ──
  const selectTickerOnly = useCallback((symbol: string) => {
    const resolvedName = symbolName(symbol)
    setSelectedStock({ symbol, name: resolvedName })
  }, [])

  // ── Keyboard shortcuts ───────────────────────────────────────────────────────
  const handleKbFocusSearch = useCallback(() => {
    const el = document.querySelector<HTMLInputElement>('.symbol-search')
    el?.focus(); el?.select()
  }, [])

  const handleKbEscape = useCallback(() => {
    if (showStockModal) { closeStockDetail(); return }
    if (authModalOpen)  { setAuthModalOpen(false); return }
    if (settingsOpen)   { closeSettings(); return }
  }, [showStockModal, authModalOpen, settingsOpen, closeSettings])

  const handleKbGoToHome = useCallback(() => {
    setNewsCategory('All')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  const handleKbGoToAlerts = useCallback(() => { setShowAlerts(true) }, [])

  // ── Ticker management ────────────────────────────────────────────────────────
  const addToTicker = (symbol: string) => {
    setCustomTickerSymbols(prev => {
      if (prev.includes(symbol) || prev.length >= MAX_TICKER_CUSTOM) return prev
      markChecklistItem('customizeTicker')
      return [...prev, symbol]
    })
  }

  const removeFromTicker = (symbol: string) => {
    setCustomTickerSymbols(prev => prev.filter(s => s !== symbol))
  }

  // ── Watchlist toggle ─────────────────────────────────────────────────────────
  const toggleWatch = useCallback((sym: string) => {
    const isAdding = !watchlist.includes(sym)
    setWatchlist(w => isAdding ? [...w, sym] : w.filter(s => s !== sym))
    if (isAdding) showToast(`${sym} added to watchlist`, 'success')
    else showToast(`${sym} removed from watchlist`, 'info')
    if (isAdding) { trackWatchlistAdd(sym); markChecklistItem('addSymbol') }
    else trackWatchlistRemove(sym)
    if (token) {
      if (isAdding) syncAddToWatchlist(sym)
      else syncRemoveFromWatchlist(sym)
    }
  }, [watchlist, token, syncAddToWatchlist, syncRemoveFromWatchlist, markChecklistItem, showToast])

  // ── Ticker symbol visibility toggle ─────────────────────────────────────────
  const toggleTickerSymbol = useCallback((sym: string) => {
    setTickerHiddenSymbols(prev => {
      const next = new Set(prev)
      if (next.has(sym)) next.delete(sym)
      else next.add(sym)
      return next
    })
  }, [])

  // ── Column resize drag handler ───────────────────────────────────────────────
  const handleColDragStart = useCallback((dividerIndex: number, e: React.MouseEvent) => {
    e.preventDefault()
    const startX = e.clientX
    const startWidths = [...colWidths] as [number, number, number]
    const totalWidth = layoutRef.current?.offsetWidth || 1200

    const onMove = (me: MouseEvent) => {
      const dx = me.clientX - startX
      const pctDelta = (dx / totalWidth) * 100
      const newWidths = [...startWidths] as [number, number, number]
      if (dividerIndex === 0) {
        newWidths[0] = Math.max(18, Math.min(45, startWidths[0] + pctDelta))
        newWidths[1] = Math.max(22, Math.min(55, startWidths[1] - pctDelta))
        newWidths[2] = Math.max(15, 100 - newWidths[0] - newWidths[1])
      } else {
        newWidths[1] = Math.max(22, Math.min(55, startWidths[1] + pctDelta))
        newWidths[2] = Math.max(15, Math.min(45, startWidths[2] - pctDelta))
        newWidths[0] = Math.max(18, 100 - newWidths[1] - newWidths[2])
      }
      const sum = newWidths[0] + newWidths[1] + newWidths[2]
      if (sum > 0) {
        newWidths[0] = (newWidths[0] / sum) * 100
        newWidths[1] = (newWidths[1] / sum) * 100
        newWidths[2] = (newWidths[2] / sum) * 100
      }
      setColWidths(newWidths)
    }

    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [colWidths])

  // ── Derived ──────────────────────────────────────────────────────────────────
  const quoteList   = Object.values(quotes)
  const gainers     = [...quoteList].sort((a, b) => b.changePct - a.changePct).slice(0, 4)
  const losers      = [...quoteList].sort((a, b) => a.changePct - b.changePct).slice(0, 4)
  const hasRealTickerData = Object.values(tickerQuotes).some(q => q.source === 'finnhub')

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <>
      <KeyboardShortcuts
        onFocusSearch={handleKbFocusSearch}
        onEscape={handleKbEscape}
        onGoToHome={handleKbGoToHome}
        onGoToAlerts={handleKbGoToAlerts}
        onOpenSettings={openSettings}
      />

      <AlertBanner alerts={marketAlerts} flashActive={alertFlash} onDismiss={dismissAlert} />

      {/* ── Ticker Bar ───────────────────────────────────────────────────────── */}
      <div className="ticker-bar-wrap">
        <TickerBar
          tickerQuotes={tickerQuotes}
          customSymbols={customTickerSymbols}
          isLoading={tickerLoading}
          hiddenSymbols={tickerHiddenSymbols}
          onOpenSettings={() => setTickerSettingsOpen(s => !s)}
          size={tickerSize}
        />
        {tickerSettingsOpen && (
          <div style={{ position: 'absolute', right: 8, top: '100%', zIndex: 200 }}>
            <TickerSettingsDropdown
              hiddenSymbols={tickerHiddenSymbols}
              onToggle={toggleTickerSymbol}
              onClose={() => setTickerSettingsOpen(false)}
              tickerSize={tickerSize}
              onSizeChange={setTickerSize}
            />
          </div>
        )}
      </div>

      {/* ── Header ───────────────────────────────────────────────────────────── */}
      <header className="site-header">
        <PersistentNav />

        <div className="header-right">
          {marketStatus ? (
            <span className={`market-status ${marketStatus.isOpen ? 'market-open' : 'market-closed'}`}>
              <span className={`status-dot ${marketStatus.isOpen ? 'dot-open' : 'dot-closed'}`} />
              {marketStatus.isOpen ? 'OPEN' : 'CLOSED'}
            </span>
          ) : (
            <span className="market-status market-closed">
              <span className="status-dot dot-closed" />
              US EQUITIES
            </span>
          )}
          <span className="live-time">{clock}</span>

          <OnboardingTooltip id="settings-gear" content="Customize your ticker bar and notification preferences here" position="bottom" delayMs={5000}>
            <button className="settings-gear-btn" onClick={openSettings} aria-label="Settings" title="Settings"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg></button>
          </OnboardingTooltip>


        </div>
      </header>

      {/* ── Mobile Nav Drawer ─────────────────────────────────────────────────── */}
      {mobileNavOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9998 }}
          onClick={() => setMobileNavOpen(false)} />
      )}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: 'min(280px, 80vw)',
        background: 'var(--bg-1)', borderLeft: '1px solid var(--border)', zIndex: 9999,
        display: mobileNavOpen ? 'flex' : 'none', flexDirection: 'column',
        padding: '16px 0', boxShadow: '-4px 0 24px rgba(0,0,0,0.5)', overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px 12px', borderBottom: '1px solid var(--border)', marginBottom: 8 }}>
          <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-2)', textTransform: 'uppercase' }}>Navigation</span>
          <button onClick={() => setMobileNavOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-2)', fontSize: 'var(--fs-xl)', cursor: 'pointer', padding: '4px 8px' }} aria-label="Close navigation">✕</button>
        </div>
        {[
          { label: 'Dashboard',          href: '/' },
          { label: 'News',               href: '/news' },
          { label: 'Calendar',           href: '/calendar' },
          { label: 'Portfolio',          href: '/portfolio' },
          { label: 'Journal',            href: '/journal' },
          { label: 'Tools',              href: '/tools' },
          { label: 'Playbooks',          href: '/playbooks' },
          { label: 'Post-Trade Ritual',  href: '/ritual' },
          { label: 'AI Coach',           href: '/coach' },
          { label: 'Prop Firm Tracker',  href: '/propfirm' },
          { label: 'Trade Rules',        href: '/rules' },
          { label: 'Help',               href: '/help' },
        ].map(item => (
          <a key={item.label} href={item.href} onClick={() => setMobileNavOpen(false)}
            style={{ padding: '12px 20px', fontSize: 'var(--fs-lg)', fontWeight: 500, color: 'var(--text-1)', textDecoration: 'none', borderBottom: '1px solid var(--border)' }}
          >{item.label}</a>
        ))}
      </div>

      {/* ── Offline Banner ────────────────────────────────────────────────────── */}
      {isOffline && (
        <div className="offline-banner">⊗ OFFLINE — displaying cached data. Reconnect for live prices.</div>
      )}

      {/* ── Smart Alerts Bar + Daily P&L Ticker ──────────────────────────────── */}
      <SmartAlertsBar watchlist={watchlist} />

      {/* ── Real-Time Market Alert Bar ────────────────────────────────────────── */}
      <ErrorBoundary label="Market Alerts">
        <MarketAlertBar />
      </ErrorBoundary>

      {/* ── 3-Column Main Layout ──────────────────────────────────────────────── */}
      <div style={{ position: 'relative' }}>
        <div
          className="layout-3col"
          ref={layoutRef}
          style={{ gridTemplateColumns: `${colWidths[0].toFixed(1)}% ${colWidths[1].toFixed(1)}% ${colWidths[2].toFixed(1)}%` }}
        >
          {/* ── Col 1 (LEFT): Watchlist ──────────────────────────────────────── */}
          <WatchlistPanel
            watchlist={watchlist}
            setWatchlist={setWatchlist}
            watchlistSyncing={watchlistSyncing}
            token={token}
            quotes={quotes}
            tickerQuotes={tickerQuotes}
            cryptoCoins={cryptoCoins}
            loadingQuotes={loadingQuotes}
            watchlistFetchStartRef={watchlistFetchStartRef}
            watchlistFetchedRef={watchlistFetchedRef}
            mobileSidebarOpen={mobileSidebarOpen}
            setMobileSidebarOpen={setMobileSidebarOpen}
            setAuthModalOpen={setAuthModalOpen}
            toggleWatch={toggleWatch}
            openStockDetail={openStockDetail}
            onSelectTicker={selectTickerOnly}
            activeNav={activeNav}
            customTickerSymbols={customTickerSymbols}
            removeFromTicker={removeFromTicker}
          />

          {/* ── Col 2 (CENTER): News / Analysis / Market Intel ──────────────── */}
          {activeNav === 'Analysis' ? (
            <ErrorBoundary label="Analysis Panel">
              <AnalysisPanel
                wlQuotes={quotes}
                tickerQuotes={tickerQuotes}
                calendarEvents={calendarEvents}
                selectedTicker={selectedStock?.symbol ?? watchlist[0] ?? 'SPY'}
              />
            </ErrorBoundary>
          ) : activeNav === 'Market Intel' ? (
            <ErrorBoundary label="Market Intel">
              <div style={{ padding: '12px 12px 24px', overflowY: 'auto', height: '100%' }}>
                <MarketIntel />
              </div>
            </ErrorBoundary>
          ) : (
            <ErrorBoundary label="News Feed">
              <NewsFeed
                newsArticles={newsArticles}
                loadingNews={loadingNews}
                newsError={newsError}
                newsCategory={newsCategory}
                newsArticleCount={newsArticleCount}
                newsSymbolFilter={newsSymbolFilter}
                showAlerts={false}
                activeNav={activeNav}
                hasRealTickerData={hasRealTickerData}
                gainers={gainers}
                losers={losers}
                onNewsCategory={handleNewsCategory}
                onArticleCount={setNewsArticleCount}
                onFetchNews={fetchNews}
                onSymbolFilter={setNewsSymbolFilter}
                onOpenStock={sym => openStockDetail(sym)}
              />
            </ErrorBoundary>
          )}

          {/* ── Col 3 (RIGHT): Portfolio / Calendar / Alerts ─────────────────── */}
          <div className="col-calendar">
            {/* Portfolio Panel */}
            <div style={{ borderBottom: '1px solid var(--border)' }}>
              <div
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 12px', background: 'var(--bg-1)', cursor: 'pointer', userSelect: 'none' }}
                onClick={() => setPortfolioCollapsed(c => !c)}
                role="button"
                tabIndex={0}
                aria-expanded={!portfolioCollapsed}
                aria-label={portfolioCollapsed ? 'Show portfolio' : 'Hide portfolio'}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setPortfolioCollapsed(c => !c) }}
              >
                <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-2)' }}>
                  <IconTrendingUp size={11} style={{ verticalAlign: 'middle', marginRight: 3 }} /> PORTFOLIO
                </span>
                <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-2)' }}>{portfolioCollapsed ? '▼ Show' : '▲ Hide'}</span>
              </div>
              {!portfolioCollapsed && (
                <ErrorBoundary label="Portfolio">
                  <PortfolioPanel quotes={{ ...quotes, ...tickerQuotes }} onOpenStock={openStockDetail} />
                </ErrorBoundary>
              )}
            </div>

            {/* Upcoming Events countdown widget */}
            <ErrorBoundary label="Upcoming Events">
              <UpcomingEventsWidget />
            </ErrorBoundary>

            {/* Calendar / Alerts tab switcher */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: 'var(--bg-1)' }}>
              <button
                className={`news-filter-tab${!showAlerts ? ' active' : ''}`}
                style={{ flex: 1, borderRadius: 0 }}
                onClick={() => setShowAlerts(false)}
                aria-label="Show calendar"
                aria-pressed={!showAlerts}
              >
                <IconCalendar size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Calendar
              </button>
              <button
                className={`news-filter-tab${showAlerts ? ' active' : ''}`}
                style={{ flex: 1, borderRadius: 0 }}
                onClick={() => setShowAlerts(a => !a)}
                aria-label="Show alerts"
                aria-pressed={showAlerts}
              >
                <IconBell size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Alerts
                {alertUnreadCount > 0 && <AlertBadge count={alertUnreadCount} />}
              </button>
            </div>

            {/* Alerts view — reads from same localStorage as Portfolio Alerts tab */}
            {showAlerts && (
              <PriceAlertsWidget onCreateAlert={() => window.location.href = '/portfolio?tab=alerts'} />
            )}

            {/* Calendar */}
            {!showAlerts && (
              <ErrorBoundary label="Economic Calendar">
                <EconomicCalendarWidget events={calendarEvents} loading={loadingCalendar} watchlistSymbols={watchlist} />
              </ErrorBoundary>
            )}
          </div>
        </div>

        {/* Column resize drag handles */}
        <div
          style={{ position: 'absolute', left: `calc(${colWidths[0].toFixed(1)}% - 3px)`, top: 0, bottom: 0, width: 6, cursor: 'col-resize', zIndex: 50 }}
          onMouseDown={e => handleColDragStart(0, e)}
          title="Drag to resize"
          aria-hidden="true"
        />
        <div
          style={{ position: 'absolute', left: `calc(${(colWidths[0] + colWidths[1]).toFixed(1)}% - 3px)`, top: 0, bottom: 0, width: 6, cursor: 'col-resize', zIndex: 50 }}
          onMouseDown={e => handleColDragStart(1, e)}
          title="Drag to resize"
          aria-hidden="true"
        />
      </div>

      {/* ── Feature Showcase ──────────────────────────────────────────────────── */}
      <FeaturesShowcase />

      {/* ── Footer ───────────────────────────────────────────────────────────── */}
      <footer className="site-footer">
        <span>
          <strong style={{ color: '#a0a0b0' }}>TradVue</strong> — © 2026 TradVue. All rights reserved.
        </span>
        <span>
          <a href="/help#data-sources" style={{ color: 'var(--text-3)', textDecoration: 'none', fontSize: 'var(--fs-sm)' }}>Data Sources</a>
          <span style={{ margin: '0 6px', color: 'var(--text-3)' }}>·</span>
          <span style={{ color: 'var(--text-3)', fontSize: 'var(--fs-sm)' }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline', verticalAlign: 'middle', marginRight: 3 }}>
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>Market data is provided for informational purposes only and may be delayed. TradVue does not guarantee the accuracy, completeness, or timeliness of any data. Do not rely solely on this information for trading decisions.
          </span>
        </span>
        <span>
          {isOffline
            ? <span style={{ color: '#ff4560' }}>● OFFLINE</span>
            : <span style={{ color: '#00c06a' }}>● CONNECTED</span>
          }
        </span>
      </footer>

      {/* ── Stock Detail Modal ────────────────────────────────────────────────── */}
      {showStockModal && selectedStock && (
        <StockDetailModal
          symbol={selectedStock.symbol}
          name={selectedStock.name}
          quote={stockQuote}
          profile={stockProfile}
          loadingQuote={loadingStockQuote}
          loadingProfile={loadingStockProfile}
          onClose={closeStockDetail}
          onAddTicker={() => addToTicker(selectedStock.symbol)}
          onAddWatchlist={() => toggleWatch(selectedStock.symbol)}
          inTicker={customTickerSymbols.includes(selectedStock.symbol)}
          inWatchlist={watchlist.includes(selectedStock.symbol)}
          tickerFull={customTickerSymbols.length >= MAX_TICKER_CUSTOM}
        />
      )}

      {authModalOpen && <AuthModal onClose={() => setAuthModalOpen(false)} />}
      {settingsOpen && <SettingsPanel onClose={() => { closeSettings(); showToast('Settings saved', 'success') }} />}
    </>
  )
}
