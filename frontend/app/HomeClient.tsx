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
  // More dropdown
  const [moreDropdownOpen, setMoreDropdownOpen]   = useState(false)
  const moreDropdownRef = useRef<HTMLDivElement>(null)

  // ── Read ?view= query param on initial load ──────────────────────────────────
  useEffect(() => {
    const view = searchParams?.get('view')
    if (view === 'analysis') {
      setActiveNav('Analysis')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Close More dropdown on outside click ─────────────────────────────────────
  useEffect(() => {
    if (!moreDropdownOpen) return
    const handleClick = (e: MouseEvent) => {
      if (moreDropdownRef.current && !moreDropdownRef.current.contains(e.target as Node)) {
        setMoreDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [moreDropdownOpen])

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
        setNewsArticles(j.data || [])
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
        <div className="header-left">
          <button
            className="mobile-hamburger"
            onClick={() => setMobileNavOpen(o => !o)}
            aria-label="Open navigation menu"
          >
            <span /><span /><span />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-header.svg" alt="TradVue" className="header-logo-img" />
          <span className="logo-badge">NEW</span>
          <span className="header-motto">AI DRIVEN ALPHA</span>
        </div>

        <nav className="header-nav" aria-label="Main navigation">
          <button className={`nav-item${activeNav === 'Markets' ? ' active' : ''}`} onClick={() => {
            setActiveNav('Markets')
            setShowAlerts(false)
            window.scrollTo({ top: 0, behavior: 'smooth' })
          }} aria-label="Go to Dashboard">Dashboard</button>
          <a href="/news"      className={`nav-item${activeNav === 'News'      ? ' active' : ''}`} style={{ textDecoration: 'none' }}>News</a>
          <button className={`nav-item${activeNav === 'Analysis' ? ' active' : ''}`} onClick={() => {
            setActiveNav('Analysis')
            setShowAlerts(false)
          }} aria-label="Go to Analysis">Analysis</button>
          <a href="/calendar"  className={`nav-item${activeNav === 'Calendar'  ? ' active' : ''}`} style={{ textDecoration: 'none' }}>Calendar</a>
          <a href="/portfolio" className={`nav-item${activeNav === 'Portfolio' ? ' active' : ''}`} style={{ textDecoration: 'none' }}>Portfolio</a>
          <a href="/tools"     className={`nav-item${activeNav === 'Tools'     ? ' active' : ''}`} style={{ textDecoration: 'none' }}>Tools</a>
          <a href="/journal"   className={`nav-item${activeNav === 'Journal'   ? ' active' : ''}`} style={{ textDecoration: 'none' }}>Journal</a>
          {/* ── More dropdown ──────────────────────────────────────────────── */}
          <div ref={moreDropdownRef} style={{ position: 'relative', display: 'inline-block' }}>
            <button
              className="nav-item"
              onClick={() => setMoreDropdownOpen(o => !o)}
              aria-haspopup="true"
              aria-expanded={moreDropdownOpen}
              style={{ display: 'flex', alignItems: 'center', gap: 4 }}
            >
              More
              <svg width="10" height="6" viewBox="0 0 10 6" fill="none" style={{ transition: 'transform 0.2s', transform: moreDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            {moreDropdownOpen && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 6px)', right: 0,
                background: 'var(--bg-1)', border: '1px solid var(--border)',
                borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                minWidth: 180, zIndex: 9990, overflow: 'hidden',
              }}>
                {[
                  { label: 'Playbooks',         href: '/playbooks' },
                  { label: 'Post-Trade Ritual',  href: '/ritual' },
                  { label: 'AI Coach',           href: '/coach' },
                  { label: 'Prop Firm Tracker',  href: '/propfirm' },
                  { label: 'Trade Rules',        href: '/rules' },
                  { label: 'Help',               href: '/help' },
                ].map(item => (
                  <a
                    key={item.href}
                    href={item.href}
                    onClick={() => setMoreDropdownOpen(false)}
                    style={{
                      display: 'block', padding: '10px 16px',
                      fontSize: 13, fontWeight: 500,
                      color: 'var(--text-1)', textDecoration: 'none',
                      borderBottom: '1px solid var(--border)',
                      transition: 'background 0.15s, color 0.15s',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-0)'; (e.currentTarget as HTMLElement).style.color = 'var(--purple)' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ''; (e.currentTarget as HTMLElement).style.color = 'var(--text-1)' }}
                  >
                    {item.label}
                  </a>
                ))}
              </div>
            )}
          </div>
        </nav>

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
            <button className="settings-gear-btn" onClick={openSettings} aria-label="Settings" title="Settings">⚙</button>
          </OnboardingTooltip>

          {user ? (
            <span className="header-user-email" title={user.email} onClick={() => markChecklistItem('completeProfile')}>
              {user.email}
            </span>
          ) : (
            <OnboardingTooltip id="sign-in-btn" content="Sign in to sync your watchlist across devices" position="bottom" delayMs={6000}>
              <button className="login-btn" onClick={() => setAuthModalOpen(true)}>Sign In</button>
            </OnboardingTooltip>
          )}

          <button className="pro-btn">PRO</button>
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
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-2)', textTransform: 'uppercase' }}>Navigation</span>
          <button onClick={() => setMobileNavOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-2)', fontSize: 18, cursor: 'pointer', padding: '4px 8px' }} aria-label="Close navigation">✕</button>
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
            style={{ padding: '12px 20px', fontSize: 14, fontWeight: 500, color: 'var(--text-1)', textDecoration: 'none', borderBottom: '1px solid var(--border)' }}
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

          {/* ── Col 2 (CENTER): News / Analysis ─────────────────────────────── */}
          {activeNav === 'Analysis' ? (
            <ErrorBoundary label="Analysis Panel">
              <AnalysisPanel
                wlQuotes={quotes}
                tickerQuotes={tickerQuotes}
                calendarEvents={calendarEvents}
                selectedTicker={selectedStock?.symbol ?? watchlist[0] ?? 'SPY'}
              />
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
                showAlerts={showAlerts}
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
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-2)' }}>
                  <IconTrendingUp size={11} style={{ verticalAlign: 'middle', marginRight: 3 }} /> PORTFOLIO
                </span>
                <span style={{ fontSize: 11, color: 'var(--text-2)' }}>{portfolioCollapsed ? '▼ Show' : '▲ Hide'}</span>
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

            {/* Alerts view */}
            {showAlerts && (
              <>
                {marketAlerts.length === 0 && (
                  <AlertsEmpty onCreateAlert={() => setAuthModalOpen(true)} />
                )}
                <AlertFeed
                  alerts={marketAlerts}
                  isConnected={alertConnected}
                  prefs={alertPrefs}
                  onUpdatePrefs={(p) => { updateAlertPrefs(p); showToast('Alert preferences updated', 'success') }}
                  onMarkAllRead={markAlertsRead}
                  onDismiss={dismissAlert}
                  onClearAll={clearAllAlerts}
                  onRefresh={refreshAlerts}
                />
              </>
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
          <a href="/help#data-sources" style={{ color: 'var(--text-3)', textDecoration: 'none', fontSize: 11 }}>Data Sources</a>
          <span style={{ margin: '0 6px', color: 'var(--text-3)' }}>·</span>
          <span style={{ color: 'var(--text-3)', fontSize: 11 }}>⚠️ Market data is provided for informational purposes only and may be delayed. TradVue does not guarantee the accuracy, completeness, or timeliness of any data. Do not rely solely on this information for trading decisions.</span>
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
