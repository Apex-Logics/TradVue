'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────

interface Quote {
  symbol: string
  current: number
  change: number
  changePct: number
  high: number
  low: number
  open: number
  prevClose: number
  timestamp: string
  source: 'finnhub' | 'mock'
}

interface CalendarEvent {
  id: string
  title: string
  currency: string
  impact: number
  date: string
  actual: string | null
  forecast: string | null
  previous: string | null
  source: string
}

interface MarketStatus {
  exchange: string
  isOpen: boolean
  session?: string
  source: string
}

interface NewsArticle {
  id: string
  title: string
  summary: string
  url: string | null
  source: string
  category: string
  publishedAt: string
  sentimentScore: number
  sentimentLabel: 'bullish' | 'bearish' | 'neutral'
  impactScore: number
  impactLabel: 'High' | 'Medium' | 'Low'
  tags: string[]
  symbols: string[]
  imageUrl: string | null
}

// ──────────────────────────────────────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────────────────────────────────────

const FALLBACK_SYMBOLS = ['AAPL', 'GOOGL', 'TSLA', 'MSFT']
const NEWS_CATEGORIES = ['all', 'markets', 'crypto', 'forex', 'economy', 'stocks', 'business']

// ──────────────────────────────────────────────────────────────────────────────
// Formatting helpers
// ──────────────────────────────────────────────────────────────────────────────

function formatPrice(price: number): string {
  return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatChangePct(pct: number): string {
  const sign = pct >= 0 ? '+' : ''
  return `${sign}${pct.toFixed(2)}%`
}

function formatEventTime(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short',
    })
  } catch {
    return dateStr
  }
}

function formatRelativeTime(dateStr: string): string {
  try {
    const diff = Date.now() - new Date(dateStr).getTime()
    const minutes = Math.floor(diff / 60_000)
    if (minutes < 1) return 'just now'
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    return `${Math.floor(hours / 24)}d ago`
  } catch {
    return ''
  }
}

function getImpactConfig(impact: number): { label: string; className: string; dot: string } {
  if (impact >= 3) return {
    label: 'High',
    className: 'bg-red-500/10 text-red-400 border border-red-500/20',
    dot: 'bg-red-400',
  }
  if (impact >= 2) return {
    label: 'Med',
    className: 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20',
    dot: 'bg-yellow-400',
  }
  return {
    label: 'Low',
    className: 'bg-surface-600 text-gray-400 border border-border',
    dot: 'bg-gray-500',
  }
}

function getSentimentConfig(label: string): { icon: string; className: string; text: string } {
  switch (label) {
    case 'bullish':
      return { icon: '▲', className: 'bg-gain/15 text-gain border border-gain/20', text: 'Bullish' }
    case 'bearish':
      return { icon: '▼', className: 'bg-loss/15 text-loss border border-loss/20', text: 'Bearish' }
    default:
      return { icon: '●', className: 'bg-surface-600 text-gray-400 border border-border', text: 'Neutral' }
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Sub-components
// ──────────────────────────────────────────────────────────────────────────────

function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`animate-pulse bg-surface-700 rounded ${className}`} />
  )
}

function AlertBanner({ message, type = 'warning' }: { message: string; type?: 'warning' | 'error' | 'offline' }) {
  const styles = {
    warning: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-300',
    error: 'bg-red-500/10 border-red-500/30 text-red-300',
    offline: 'bg-orange-500/10 border-orange-500/30 text-orange-300',
  }
  const icons = { warning: '⚠', error: '✕', offline: '⊗' }

  return (
    <div className={`border-b px-4 py-2.5 text-xs text-center font-medium tracking-wide ${styles[type]}`}>
      <span className="mr-1.5">{icons[type]}</span>
      {message}
    </div>
  )
}

function MarketCard({
  quote,
  isWatchlisted,
  onToggleWatchlist,
}: {
  quote: Quote
  isWatchlisted: boolean
  onToggleWatchlist: (symbol: string) => void
}) {
  const isUp = quote.changePct >= 0

  return (
    <div className="
      group relative bg-surface-800 rounded-xl border border-border p-5
      hover:border-primary-500/40 hover:shadow-card-hover hover:bg-surface-700
      transition-all duration-200 cursor-pointer overflow-hidden
    ">
      {/* Subtle top accent line */}
      <div className={`absolute top-0 left-0 right-0 h-px ${isUp ? 'bg-gain/40' : 'bg-loss/40'}`} />

      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-gray-100 tracking-wide">{quote.symbol}</span>
            <span className="text-[10px] text-gray-500 uppercase bg-surface-600 px-1.5 py-0.5 rounded font-medium">
              Stock
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`
            badge font-semibold tabular
            ${isUp
              ? 'bg-gain/15 text-gain border border-gain/20'
              : 'bg-loss/15 text-loss border border-loss/20'
            }
          `}>
            {isUp ? '▲' : '▼'} {formatChangePct(quote.changePct)}
          </span>
          <button
            onClick={(e) => { e.stopPropagation(); onToggleWatchlist(quote.symbol) }}
            title={isWatchlisted ? 'Remove from watchlist' : 'Add to watchlist'}
            className={`text-sm transition-all leading-none ${
              isWatchlisted
                ? 'text-yellow-400'
                : 'text-surface-500 hover:text-yellow-400 opacity-0 group-hover:opacity-100'
            }`}
            aria-label={isWatchlisted ? `Remove ${quote.symbol}` : `Watch ${quote.symbol}`}
          >
            ★
          </button>
        </div>
      </div>

      <div className="tabular">
        <div className="text-2xl font-bold text-gray-100 leading-none mb-1">
          ${formatPrice(quote.current)}
        </div>
        <div className={`text-sm font-medium ${isUp ? 'text-gain' : 'text-loss'}`}>
          {quote.change >= 0 ? '+' : ''}{quote.change.toFixed(2)}
        </div>
      </div>

      <div className="flex justify-between mt-3 pt-3 border-t border-border text-[11px] text-gray-500">
        <span>H <span className="text-gray-400 font-medium">${formatPrice(quote.high)}</span></span>
        <span>L <span className="text-gray-400 font-medium">${formatPrice(quote.low)}</span></span>
        <span>O <span className="text-gray-400 font-medium">${formatPrice(quote.open)}</span></span>
      </div>
    </div>
  )
}

function WatchlistRow({
  symbol,
  quote,
  onRemove,
}: {
  symbol: string
  quote: Quote | undefined
  onRemove: (symbol: string) => void
}) {
  if (!quote) {
    return (
      <div className="flex items-center justify-between py-2.5 border-b border-border last:border-b-0">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-gray-300">{symbol}</span>
          <Skeleton className="h-3 w-16" />
        </div>
        <button
          onClick={() => onRemove(symbol)}
          className="text-surface-500 hover:text-red-400 text-xs transition-colors"
          aria-label={`Remove ${symbol}`}
        >
          ✕
        </button>
      </div>
    )
  }
  const isUp = quote.changePct >= 0
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-border last:border-b-0 group">
      <div className="flex items-center gap-3">
        <span className="text-sm font-semibold text-gray-200">{symbol}</span>
        <span className={`badge text-[11px] ${
          isUp
            ? 'bg-gain/15 text-gain border border-gain/20'
            : 'bg-loss/15 text-loss border border-loss/20'
        }`}>
          {formatChangePct(quote.changePct)}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <span className="tabular text-sm font-bold text-gray-100">${formatPrice(quote.current)}</span>
        <button
          onClick={() => onRemove(symbol)}
          className="text-surface-500 hover:text-red-400 text-xs transition-colors opacity-0 group-hover:opacity-100"
          aria-label={`Remove ${symbol}`}
        >
          ✕
        </button>
      </div>
    </div>
  )
}

function NewsCard({ article }: { article: NewsArticle }) {
  const sentiment = getSentimentConfig(article.sentimentLabel)
  const impactCfg = getImpactConfig(
    article.impactLabel === 'High' ? 3 : article.impactLabel === 'Medium' ? 2 : 1
  )

  return (
    <div className="py-3.5 border-b border-border last:border-b-0 group">
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-gray-500 font-medium">{article.source}</span>
          <span className="text-gray-700">·</span>
          <span className="text-[11px] text-gray-600 tabular">{formatRelativeTime(article.publishedAt)}</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className={`badge ${sentiment.className}`}>
            <span className="text-[10px]">{sentiment.icon}</span>
            {sentiment.text}
          </span>
          <span className={`badge ${impactCfg.className}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${impactCfg.dot}`} />
            {impactCfg.label}
          </span>
        </div>
      </div>

      <a
        href={article.url || '#'}
        target="_blank"
        rel="noopener noreferrer"
        className="text-sm font-medium text-gray-200 group-hover:text-primary-400 leading-snug block transition-colors"
      >
        {article.title}
      </a>

      {article.summary && (
        <p className="text-[12px] text-gray-500 mt-1 line-clamp-2 leading-relaxed">{article.summary}</p>
      )}

      {article.symbols.length > 0 && (
        <div className="flex gap-1 mt-1.5 flex-wrap">
          {article.symbols.slice(0, 4).map((sym) => (
            <span key={sym} className="text-[11px] bg-primary-500/10 text-primary-400 border border-primary-500/20 px-1.5 py-0.5 rounded font-medium">
              {sym}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// Main Component
// ──────────────────────────────────────────────────────────────────────────────

export default function Home() {
  const [currentTime, setCurrentTime] = useState<string>('')
  const [isOffline, setIsOffline] = useState(false)

  const [quotes, setQuotes] = useState<Record<string, Quote>>({})
  const [loadingQuotes, setLoadingQuotes] = useState(true)
  const [quotesError, setQuotesError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<string>('')
  const [marketStatus, setMarketStatus] = useState<MarketStatus | null>(null)

  const [watchlist, setWatchlist] = useState<string[]>([])

  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([])
  const [loadingCalendar, setLoadingCalendar] = useState(true)

  const [newsArticles, setNewsArticles] = useState<NewsArticle[]>([])
  const [loadingNews, setLoadingNews] = useState(true)
  const [newsError, setNewsError] = useState<string | null>(null)
  const [newsCategory, setNewsCategory] = useState<string>('all')
  const [newsSymbolFilter, setNewsSymbolFilter] = useState<string>('')
  const [showUserMenu, setShowUserMenu] = useState(false)

  const symbolFilterTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Live clock
  useEffect(() => {
    const tick = () => setCurrentTime(new Date().toLocaleTimeString('en-US', {
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
    }))
    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [])

  // Offline detection
  useEffect(() => {
    const goOffline = () => setIsOffline(true)
    const goOnline = () => setIsOffline(false)
    window.addEventListener('offline', goOffline)
    window.addEventListener('online', goOnline)
    setIsOffline(!navigator.onLine)
    return () => {
      window.removeEventListener('offline', goOffline)
      window.removeEventListener('online', goOnline)
    }
  }, [])

  // Persist watchlist
  useEffect(() => {
    try {
      const saved = localStorage.getItem('cg_watchlist')
      if (saved) setWatchlist(JSON.parse(saved))
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    try { localStorage.setItem('cg_watchlist', JSON.stringify(watchlist)) }
    catch { /* ignore */ }
  }, [watchlist])

  // API calls
  const fetchQuotes = useCallback(async () => {
    if (isOffline) return
    try {
      const symbols = FALLBACK_SYMBOLS.join(',')
      const res = await fetch(`${API_BASE}/api/market-data/batch?symbols=${symbols}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      if (json.success) {
        setQuotes(json.data)
        setLastUpdated(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }))
        setQuotesError(null)
      } else {
        throw new Error(json.error || 'API error')
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      setQuotesError(`Unable to fetch live quotes — ${msg}`)
    } finally {
      setLoadingQuotes(false)
    }
  }, [isOffline])

  const fetchMarketStatus = useCallback(async () => {
    if (isOffline) return
    try {
      const res = await fetch(`${API_BASE}/api/market-data/status?exchange=US`)
      if (!res.ok) return
      const json = await res.json()
      if (json.success) setMarketStatus(json.data)
    } catch { /* non-critical */ }
  }, [isOffline])

  const fetchCalendar = useCallback(async () => {
    if (isOffline) return
    try {
      const res = await fetch(`${API_BASE}/api/calendar/today`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      if (json.success) setCalendarEvents(json.data.slice(0, 5))
    } catch (err) {
      console.error('[Frontend] Calendar fetch error:', err)
    } finally {
      setLoadingCalendar(false)
    }
  }, [isOffline])

  const fetchNews = useCallback(async (category: string, symbolFilter: string) => {
    if (isOffline) { setLoadingNews(false); return }
    setLoadingNews(true)
    setNewsError(null)
    try {
      const params = new URLSearchParams({ limit: '12' })
      if (category && category !== 'all') params.set('category', category)
      const endpoint = symbolFilter.trim()
        ? `${API_BASE}/api/feed/news/symbol/${encodeURIComponent(symbolFilter.trim().toUpperCase())}?limit=12`
        : `${API_BASE}/api/feed/news?${params.toString()}`
      const res = await fetch(endpoint)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      if (json.success) {
        setNewsArticles(json.data || [])
      } else {
        throw new Error(json.error || 'API error')
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      setNewsError(`Unable to load news — ${msg}`)
      setNewsArticles([])
    } finally {
      setLoadingNews(false)
    }
  }, [isOffline])

  useEffect(() => {
    fetchQuotes()
    fetchMarketStatus()
    fetchCalendar()
    fetchNews('all', '')
  }, [fetchQuotes, fetchMarketStatus, fetchCalendar, fetchNews])

  useEffect(() => {
    const interval = setInterval(fetchQuotes, 60_000)
    return () => clearInterval(interval)
  }, [fetchQuotes])

  useEffect(() => {
    fetchNews(newsCategory, newsSymbolFilter)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newsCategory])

  const handleSymbolFilterChange = (value: string) => {
    setNewsSymbolFilter(value)
    if (symbolFilterTimer.current) clearTimeout(symbolFilterTimer.current)
    symbolFilterTimer.current = setTimeout(() => fetchNews(newsCategory, value), 500)
  }

  const toggleWatchlist = useCallback((symbol: string) => {
    setWatchlist((prev) =>
      prev.includes(symbol) ? prev.filter((s) => s !== symbol) : [...prev, symbol]
    )
  }, [])

  const removeFromWatchlist = useCallback((symbol: string) => {
    setWatchlist((prev) => prev.filter((s) => s !== symbol))
  }, [])

  const quoteList = Object.values(quotes)
  const isLive = quoteList[0]?.source === 'finnhub'

  return (
    <div className="min-h-screen bg-surface-950">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header className="glass border-b border-border sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">

            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                {/* Logo icon */}
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary-500 to-violet-600 flex items-center justify-center shadow-glow">
                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7 12l3-3 3 3 4-4" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 20h18" />
                  </svg>
                </div>
                <span className="text-base font-bold gradient-text tracking-tight">ChartGenius</span>
              </div>
              <span className="text-[10px] bg-primary-500/10 text-primary-400 border border-primary-500/20 px-1.5 py-0.5 rounded font-semibold tracking-wider uppercase">
                Beta
              </span>
            </div>

            {/* Nav */}
            <nav className="hidden md:flex items-center gap-6">
              {['Dashboard', 'Markets', 'News', 'Calendar'].map((item) => (
                <button
                  key={item}
                  className={`text-sm font-medium transition-colors ${
                    item === 'Dashboard' ? 'text-gray-100' : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  {item}
                </button>
              ))}
            </nav>

            {/* Right: clock + status + user */}
            <div className="flex items-center gap-3">
              <span className="hidden sm:block tabular text-xs font-medium text-gray-500">{currentTime}</span>

              {marketStatus && (
                <div className={`hidden sm:flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${
                  marketStatus.isOpen
                    ? 'bg-gain/10 border-gain/20 text-gain'
                    : 'bg-surface-700 border-border text-gray-500'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${marketStatus.isOpen ? 'bg-gain animate-pulse' : 'bg-gray-600'}`} />
                  {marketStatus.isOpen ? 'Open' : 'Closed'}
                </div>
              )}

              {/* User button */}
              <div className="relative">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center gap-2 bg-surface-700 hover:bg-surface-600 border border-border rounded-lg px-3 py-1.5 text-sm font-medium text-gray-300 transition-colors"
                >
                  <div className="w-5 h-5 rounded-full bg-gradient-to-br from-primary-400 to-violet-500 flex items-center justify-center text-[10px] font-bold text-white">
                    G
                  </div>
                  <span className="hidden sm:block">Account</span>
                  <svg className="w-3 h-3 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {showUserMenu && (
                  <div className="absolute right-0 top-full mt-2 w-48 bg-surface-800 border border-border rounded-xl shadow-card-hover z-50 overflow-hidden">
                    <div className="px-3 py-2.5 border-b border-border">
                      <p className="text-xs font-semibold text-gray-200">Guest User</p>
                      <p className="text-[11px] text-gray-500">Free Plan</p>
                    </div>
                    {['Profile', 'Preferences', 'Upgrade to Pro'].map((item) => (
                      <button
                        key={item}
                        className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                          item === 'Upgrade to Pro'
                            ? 'text-primary-400 hover:bg-primary-500/10 font-medium'
                            : 'text-gray-400 hover:bg-surface-700 hover:text-gray-200'
                        }`}
                      >
                        {item}
                      </button>
                    ))}
                    <div className="border-t border-border">
                      <button className="w-full text-left px-3 py-2 text-sm text-gray-500 hover:bg-surface-700 hover:text-gray-300 transition-colors">
                        Sign In
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ── Banners ─────────────────────────────────────────────────────────── */}
      {isOffline && (
        <AlertBanner message="You're offline. Data may be stale. Reconnect to see live prices." type="offline" />
      )}
      {!isOffline && quotesError && <AlertBanner message={quotesError} type="warning" />}

      {/* ── Main ────────────────────────────────────────────────────────────── */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

        {/* ── Hero strip ─────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-100 leading-tight">
              Market Dashboard
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Real-time data · Sentiment analysis · Portfolio tracking
            </p>
          </div>
          <div className="flex items-center gap-3">
            {lastUpdated && (
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <span className={`w-1.5 h-1.5 rounded-full ${isLive ? 'bg-gain animate-pulse' : 'bg-yellow-500'}`} />
                {isLive ? 'Live' : 'Simulated'} · Updated {lastUpdated}
              </div>
            )}
            <button
              onClick={fetchQuotes}
              disabled={isOffline}
              className="text-xs text-primary-400 hover:text-primary-300 font-medium disabled:opacity-40 flex items-center gap-1 transition-colors"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
          </div>
        </div>

        {/* ── Row 1: Market Cards + Sidebar ───────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Market Overview */}
          <div className="lg:col-span-2 bg-surface-800 rounded-xl border border-border shadow-card">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                </svg>
                <h2 className="text-sm font-semibold text-gray-200">Market Overview</h2>
              </div>
              <span className="text-[11px] text-gray-600">{quoteList.length} instruments</span>
            </div>

            <div className="p-5">
              {loadingQuotes ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {FALLBACK_SYMBOLS.map((sym) => (
                    <div key={sym} className="bg-surface-700 rounded-xl p-5 border border-border">
                      <Skeleton className="h-3 w-16 mb-3" />
                      <Skeleton className="h-7 w-28 mb-2" />
                      <Skeleton className="h-3 w-12 mb-3" />
                      <div className="flex gap-4 pt-3 border-t border-border">
                        <Skeleton className="h-3 w-12" />
                        <Skeleton className="h-3 w-12" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : quoteList.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {quoteList.map((quote) => (
                    <MarketCard
                      key={quote.symbol}
                      quote={quote}
                      isWatchlisted={watchlist.includes(quote.symbol)}
                      onToggleWatchlist={toggleWatchlist}
                    />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-gray-600">
                  <svg className="w-12 h-12 mb-3 text-surface-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M7 12l3-3 3 3 4-4" />
                  </svg>
                  <p className="text-sm">
                    {isOffline ? 'Offline — connect to load prices' : 'No data — check if backend is running'}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">

            {/* Today's Highlights */}
            <div className="bg-surface-800 rounded-xl border border-border shadow-card">
              <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
                <svg className="w-4 h-4 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <h2 className="text-sm font-semibold text-gray-200">Today's Stats</h2>
              </div>
              <div className="px-5 py-4 space-y-3">
                {[
                  {
                    label: 'Market Status',
                    value: marketStatus ? (
                      <span className={marketStatus.isOpen ? 'text-gain' : 'text-gray-500'}>
                        {marketStatus.isOpen ? '● Open' : '○ Closed'}
                      </span>
                    ) : <Skeleton className="h-4 w-16 inline-block" />
                  },
                  {
                    label: 'Calendar Events',
                    value: loadingCalendar
                      ? <Skeleton className="h-4 w-12 inline-block" />
                      : <span className="text-gray-200 font-semibold">{calendarEvents.length} today</span>
                  },
                  {
                    label: 'Quotes Tracked',
                    value: <span className="text-gray-200 font-semibold">{quoteList.length}</span>
                  },
                  {
                    label: 'Watchlist',
                    value: <span className="text-gray-200 font-semibold">{watchlist.length} / 10</span>
                  },
                ].map(({ label, value }) => (
                  <div key={label} className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">{label}</span>
                    <span className="text-sm">{value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Upgrade CTA */}
            <div className="bg-gradient-to-br from-primary-600/20 to-violet-600/20 rounded-xl border border-primary-500/20 p-5">
              <div className="flex items-center gap-2 mb-3">
                <svg className="w-4 h-4 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <h2 className="text-sm font-semibold text-gray-200">Go Pro</h2>
              </div>
              <p className="text-xs text-gray-400 mb-4 leading-relaxed">
                Unlimited watchlist, advanced alerts, AI-powered analysis, and more.
              </p>
              <div className="text-center mb-4">
                <div className="text-xl font-bold text-gray-100">
                  $9<span className="text-sm font-normal text-gray-400">/mo</span>
                </div>
              </div>
              <button className="w-full bg-primary-600 hover:bg-primary-500 text-white text-sm font-semibold py-2 px-4 rounded-lg transition-colors shadow-glow">
                Upgrade to Pro
              </button>
            </div>
          </div>
        </div>

        {/* ── Row 2: Calendar + Watchlist ─────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Economic Calendar */}
          <div className="bg-surface-800 rounded-xl border border-border shadow-card">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <h2 className="text-sm font-semibold text-gray-200">Economic Calendar</h2>
              </div>
              <span className="text-[11px] text-gray-600">Today</span>
            </div>

            <div className="px-5 py-4">
              {loadingCalendar ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex gap-3">
                      <Skeleton className="h-3 w-16 mt-1" />
                      <div className="flex-1">
                        <Skeleton className="h-4 w-3/4 mb-1.5" />
                        <Skeleton className="h-3 w-1/2" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : calendarEvents.length > 0 ? (
                <div className="space-y-3">
                  {calendarEvents.map((event) => {
                    const impact = getImpactConfig(event.impact)
                    return (
                      <div key={event.id} className="flex gap-3 group">
                        <div className="text-[11px] text-gray-600 tabular w-20 shrink-0 pt-0.5">
                          {formatEventTime(event.date)}
                        </div>
                        <div className="flex-1 border-l border-border pl-3">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className="badge bg-surface-700 text-gray-500 border border-border text-[10px]">
                              {event.currency}
                            </span>
                            <span className={`badge ${impact.className} text-[10px]`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${impact.dot}`} />
                              {impact.label}
                            </span>
                          </div>
                          <p className="text-sm font-medium text-gray-300 leading-snug">{event.title}</p>
                          {(event.forecast || event.previous) && (
                            <p className="text-[11px] text-gray-600 mt-0.5 space-x-2">
                              {event.actual && (
                                <span>Actual: <strong className="text-gray-400">{event.actual}</strong></span>
                              )}
                              {event.forecast && <span>· Fcst: <span className="text-gray-500">{event.forecast}</span></span>}
                              {event.previous && <span>· Prev: <span className="text-gray-500">{event.previous}</span></span>}
                            </p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-10 text-gray-600">
                  <svg className="w-8 h-8 mb-2 text-surface-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p className="text-sm">No events scheduled today</p>
                </div>
              )}
            </div>

            <div className="px-5 py-3 border-t border-border">
              <button onClick={fetchCalendar} className="text-xs text-primary-400 hover:text-primary-300 font-medium transition-colors">
                View full calendar →
              </button>
            </div>
          </div>

          {/* Watchlist */}
          <div className="bg-surface-800 rounded-xl border border-border shadow-card">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
                <h2 className="text-sm font-semibold text-gray-200">Watchlist</h2>
              </div>
              <span className="text-[11px] text-gray-600">{watchlist.length} / 10</span>
            </div>

            <div className="px-5 py-4">
              {watchlist.length === 0 ? (
                <div className="text-center py-6">
                  <svg className="w-10 h-10 mx-auto mb-3 text-surface-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                  </svg>
                  <p className="text-sm text-gray-500 mb-4">
                    Hover a market card and click ★ to add to watchlist
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {FALLBACK_SYMBOLS.map((sym) => (
                      <button
                        key={sym}
                        onClick={() => toggleWatchlist(sym)}
                        className="border border-border border-dashed text-gray-500 hover:border-primary-500/40 hover:text-primary-400 text-xs py-2 rounded-lg transition-colors"
                      >
                        + {sym}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div>
                  {watchlist.map((symbol) => (
                    <WatchlistRow
                      key={symbol}
                      symbol={symbol}
                      quote={quotes[symbol]}
                      onRemove={removeFromWatchlist}
                    />
                  ))}
                  <button
                    onClick={fetchQuotes}
                    disabled={isOffline}
                    className="mt-3 text-xs text-primary-400 hover:text-primary-300 font-medium disabled:opacity-40 transition-colors"
                  >
                    ↻ Refresh prices
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Row 3: News Feed ─────────────────────────────────────────────── */}
        <div className="bg-surface-800 rounded-xl border border-border shadow-card">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 border-b border-border">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
              </svg>
              <h2 className="text-sm font-semibold text-gray-200">Market News</h2>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Symbol search */}
              <div className="relative">
                <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  value={newsSymbolFilter}
                  onChange={(e) => handleSymbolFilterChange(e.target.value)}
                  placeholder="Symbol (e.g. BTC)"
                  className="text-xs bg-surface-700 border border-border rounded-lg pl-7 pr-3 py-1.5 w-36 text-gray-300 placeholder-gray-600 focus:outline-none focus:border-primary-500/50 focus:bg-surface-600 transition-colors"
                />
              </div>

              {/* Category pills */}
              <div className="flex flex-wrap gap-1">
                {NEWS_CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => { setNewsSymbolFilter(''); setNewsCategory(cat) }}
                    className={`text-[11px] font-medium px-2.5 py-1 rounded-full border transition-colors capitalize ${
                      newsCategory === cat && !newsSymbolFilter
                        ? 'bg-primary-600 text-white border-primary-600'
                        : 'bg-surface-700 text-gray-500 border-border hover:border-primary-500/40 hover:text-gray-300'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <button
                onClick={() => fetchNews(newsCategory, newsSymbolFilter)}
                disabled={isOffline}
                className="text-gray-600 hover:text-gray-400 disabled:opacity-40 transition-colors"
                title="Refresh"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>
          </div>

          <div className="px-5 py-4">
            {loadingNews ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="py-3.5 border-b border-border">
                    <div className="flex justify-between mb-1.5">
                      <Skeleton className="h-3 w-24" />
                      <div className="flex gap-1.5">
                        <Skeleton className="h-4 w-14" />
                        <Skeleton className="h-4 w-10" />
                      </div>
                    </div>
                    <Skeleton className="h-4 w-full mb-1" />
                    <Skeleton className="h-3 w-4/5" />
                  </div>
                ))}
              </div>
            ) : newsError ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-600">
                <svg className="w-10 h-10 mb-3 text-surface-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <p className="text-sm mb-3">{newsError}</p>
                <button
                  onClick={() => fetchNews(newsCategory, newsSymbolFilter)}
                  className="text-primary-400 hover:text-primary-300 text-sm font-medium transition-colors"
                >
                  Retry
                </button>
              </div>
            ) : newsArticles.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
                {newsArticles.map((article) => (
                  <NewsCard key={article.id} article={article} />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-gray-600">
                <svg className="w-10 h-10 mb-3 text-surface-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-sm">
                  {isOffline
                    ? 'Offline — news unavailable without internet'
                    : `No articles found${newsSymbolFilter ? ` for "${newsSymbolFilter.toUpperCase()}"` : ''}`}
                </p>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer className="mt-8 border-t border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-md bg-gradient-to-br from-primary-500 to-violet-600 flex items-center justify-center">
              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 12l3-3 3 3 4-4" />
              </svg>
            </div>
            <span className="text-xs font-semibold text-gray-500">ChartGenius</span>
            <span className="text-gray-700">·</span>
            <span className="text-xs text-gray-600">ApexLogics</span>
          </div>
          <p className="text-[11px] text-gray-700">
            Market data: Finnhub · News: RSS aggregation · Not financial advice
          </p>
        </div>
      </footer>
    </div>
  )
}
