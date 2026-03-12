'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import dynamic from 'next/dynamic'
import { useAuth } from './context/AuthContext'
import { useSettings } from './context/SettingsContext'
import { useOnboarding } from './context/OnboardingContext'
import { useToast } from './context/ToastContext'
import { trackWatchlistAdd, trackWatchlistRemove, trackStockSearch } from './utils/analytics'
import { formatEventTime, formatEventDate } from './lib/timezone'

// Lazy-load modals so they don't bloat initial bundle
const AuthModal    = dynamic(() => import('./components/AuthModal'),    { ssr: false })
const SettingsPanel = dynamic(() => import('./components/SettingsPanel'), { ssr: false })

// Alert system (SSE-powered real-time market alerts)
import { AlertBanner, AlertFeed, AlertBadge, useAlerts } from './components/AlertSystem'

// Keyboard shortcuts
import KeyboardShortcuts from './components/KeyboardShortcuts'

// Onboarding components
import { WatchlistEmpty, AlertsEmpty } from './components/EmptyState'
import OnboardingTooltip from './components/OnboardingTooltip'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
import { apiFetchSafe } from './lib/apiFetch'
import DataError from './components/DataError'
import { IconTrendingUp, IconTrendingDown, IconMinus, IconMic, IconChart, IconBuilding } from './components/Icons'

// ─── Types ───────────────────────────────────────────────────────────────────

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
  country?: string
  impact: number | string // supports both legacy numeric (1/2/3) and new string ('Low'/'Medium'/'High')
  type?: 'economic' | 'earnings' | 'speech' | 'holiday'
  symbol?: string // for earnings events
  datetime?: string
  date?: string
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

interface CryptoCoin {
  id: string
  symbol: string
  name: string
  price: number
  change24h: number
  change7d: number
  marketCap: number
  volume24h: number
  marketCapRank: number
  image: string | null
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

interface CompanyProfile {
  symbol: string
  name: string
  description: string | null
  exchange: string
  industry: string
  sector: string
  country: string
  currency: string
  marketCap: number | null
  website: string | null
  logo: string | null
  ipo: string | null
  peRatio: number | null
  pbRatio: number | null
  eps: number | null
  dividendYield: number | null
  week52High: number | null
  week52Low: number | null
  beta: number | null
}

// ─── Portfolio Types ──────────────────────────────────────────────────────────

interface PortfolioPosition {
  symbol: string
  name: string
  shares: number
  buyPrice: number
  buyDate: string
}

// ─── Constants ───────────────────────────────────────────────────────────────

// Sidebar symbols for fetching quotes used in Analysis view gainers/losers
const SIDEBAR_SYMBOLS = ['SPY', 'QQQ', 'DIA', 'GLD', 'SLV', 'AAPL', 'MSFT', 'NVDA']

// Default watchlist symbols (pre-populated for new users)
const DEFAULT_WATCHLIST = [
  'SPY', 'QQQ', 'DIA', 'IWM',
  'AAPL', 'GOOGL', 'TSLA', 'MSFT', 'META', 'NVDA', 'AMZN',
  'GLD', 'SLV',
  'BTC', 'ETH',
  'EURUSD', 'GBPUSD',
  'VIX',
]

// ─── Watchlist quote cache ────────────────────────────────────────────────────

const WL_CACHE_KEY = 'tv_wl_quotes_v1'
const WL_CACHE_TTL = 60_000 // 60 seconds

interface WlCacheEntry {
  data: Record<string, Quote>
  ts: number
}

function loadWlCache(): Record<string, Quote> | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(WL_CACHE_KEY)
    if (!raw) return null
    const entry: WlCacheEntry = JSON.parse(raw)
    if (Date.now() - entry.ts > WL_CACHE_TTL) return null
    return entry.data
  } catch {
    return null
  }
}

function saveWlCache(data: Record<string, Quote>): void {
  try {
    const entry: WlCacheEntry = { data, ts: Date.now() }
    localStorage.setItem(WL_CACHE_KEY, JSON.stringify(entry))
  } catch {}
}

/** Returns which symbols in the watchlist should go to the stock batch endpoint. */
function stockSymbolsFromWatchlist(wl: string[]): string[] {
  return wl.filter(s => !CRYPTO_SYMBOL_MAP[s.toUpperCase()])
}

const NEWS_ARTICLE_COUNTS = [5, 10, 25, 50]

const TICKER_SYMBOLS = ['SPY', 'QQQ', 'DIA', 'BTC-USD', 'ETH-USD', 'EURUSD', 'GBPUSD', 'GC=F', 'CL=F', 'VIX']
const TICKER_DISPLAY: Record<string, string> = {
  'SPY':     'S&P 500',
  'QQQ':     'NASDAQ',
  'DIA':     'DOW',
  'BTC-USD': 'BTC/USD',
  'ETH-USD': 'ETH/USD',
  'EURUSD':  'EUR/USD',
  'GBPUSD':  'GBP/USD',
  'GC=F':    'GOLD',
  'CL=F':    'CRUDE',
  'VIX':     'VIX',
}

const TICKER_FALLBACK = [
  { symbol: 'S&P 500', price: 5234.18, change: 0.42 },
  { symbol: 'NASDAQ',  price: 16432.90, change: 0.68 },
  { symbol: 'DOW',     price: 38996.39, change: 0.18 },
  { symbol: 'BTC/USD', price: 67420.50, change: -1.23 },
  { symbol: 'ETH/USD', price: 3512.80,  change: 2.14 },
  { symbol: 'EUR/USD', price: 1.0852,   change: -0.08 },
  { symbol: 'GBP/USD', price: 1.2634,   change: 0.12 },
  { symbol: 'GOLD',    price: 2312.40,  change: 0.31 },
  { symbol: 'CRUDE',   price: 83.72,    change: -0.55 },
  { symbol: 'VIX',     price: 14.32,    change: -3.21 },
]

const NEWS_CATEGORIES = ['All', 'Equities', 'Forex', 'Crypto', 'Commodities', 'Macro']
const NEWS_CAT_MAP: Record<string, string> = {
  All: 'all',
  Equities: 'stocks',
  Forex: 'forex',
  Crypto: 'crypto',
  Commodities: 'commodities',
  Macro: 'economy',
}

const CALENDAR_IMPACT_FILTERS = ['All', 'High', 'Medium', 'Low']
const CALENDAR_CURRENCIES = ['All', 'USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'NZD']

// Major-cap earnings filter — dashboard widget shows ONLY these symbols
const MAJOR_CAP_SYMBOLS = new Set([
  'AAPL','MSFT','NVDA','GOOGL','GOOG','AMZN','META','TSLA','NFLX',
  'AMD','INTC','QCOM','AVGO','TXN','ORCL','CRM','ADBE','SNOW','PLTR',
  'V','MA','JPM','BAC','GS','MS','WFC','C','SCHW',
  'JNJ','UNH','PFE','MRK','ABBV','LLY','BMY',
  'WMT','COST','TGT','HD','SBUX','NKE','MCD',
  'XOM','CVX','COP','OXY',
  'BRK.A','BRK.B',
  'DIS','CMCSA','NFLX','SPOT',
  'T','VZ',
  'BA','RTX','LMT','GE',
  'COIN','HOOD','ROBINHOOD',
  'SPY','QQQ','IWM', // ETFs sometimes in earnings
])

const MAX_TICKER_CUSTOM = 15

// ─── Top symbols for autocomplete ────────────────────────────────────────────

const TOP_SYMBOLS = [
  { symbol: 'AAPL',  name: 'Apple Inc.' },
  { symbol: 'MSFT',  name: 'Microsoft Corporation' },
  { symbol: 'NVDA',  name: 'NVIDIA Corporation' },
  { symbol: 'GOOGL', name: 'Alphabet Inc. (Class A)' },
  { symbol: 'GOOG',  name: 'Alphabet Inc. (Class C)' },
  { symbol: 'AMZN',  name: 'Amazon.com Inc.' },
  { symbol: 'META',  name: 'Meta Platforms Inc.' },
  { symbol: 'TSLA',  name: 'Tesla Inc.' },
  { symbol: 'AVGO',  name: 'Broadcom Inc.' },
  { symbol: 'LLY',   name: 'Eli Lilly and Company' },
  { symbol: 'JPM',   name: 'JPMorgan Chase & Co.' },
  { symbol: 'V',     name: 'Visa Inc.' },
  { symbol: 'UNH',   name: 'UnitedHealth Group' },
  { symbol: 'XOM',   name: 'ExxonMobil Corporation' },
  { symbol: 'MA',    name: 'Mastercard Inc.' },
  { symbol: 'JNJ',   name: 'Johnson & Johnson' },
  { symbol: 'PG',    name: 'Procter & Gamble' },
  { symbol: 'HD',    name: 'Home Depot Inc.' },
  { symbol: 'MRK',   name: 'Merck & Co.' },
  { symbol: 'COST',  name: 'Costco Wholesale Corporation' },
  { symbol: 'ABBV',  name: 'AbbVie Inc.' },
  { symbol: 'CVX',   name: 'Chevron Corporation' },
  { symbol: 'CRM',   name: 'Salesforce Inc.' },
  { symbol: 'KO',    name: 'Coca-Cola Company' },
  { symbol: 'BAC',   name: 'Bank of America Corp.' },
  { symbol: 'PEP',   name: 'PepsiCo Inc.' },
  { symbol: 'AMD',   name: 'Advanced Micro Devices' },
  { symbol: 'NFLX',  name: 'Netflix Inc.' },
  { symbol: 'TMO',   name: 'Thermo Fisher Scientific' },
  { symbol: 'DIS',   name: 'Walt Disney Company' },
  { symbol: 'ADBE',  name: 'Adobe Inc.' },
  { symbol: 'MCD',   name: "McDonald's Corporation" },
  { symbol: 'WMT',   name: 'Walmart Inc.' },
  { symbol: 'CSCO',  name: 'Cisco Systems Inc.' },
  { symbol: 'ORCL',  name: 'Oracle Corporation' },
  { symbol: 'QCOM',  name: 'Qualcomm Inc.' },
  { symbol: 'PFE',   name: 'Pfizer Inc.' },
  { symbol: 'ACN',   name: 'Accenture plc' },
  { symbol: 'IBM',   name: 'International Business Machines' },
  { symbol: 'INTC',  name: 'Intel Corporation' },
  { symbol: 'INTU',  name: 'Intuit Inc.' },
  { symbol: 'NOW',   name: 'ServiceNow Inc.' },
  { symbol: 'TXN',   name: 'Texas Instruments' },
  { symbol: 'AMAT',  name: 'Applied Materials Inc.' },
  { symbol: 'HON',   name: 'Honeywell International' },
  { symbol: 'BKNG',  name: 'Booking Holdings Inc.' },
  { symbol: 'ISRG',  name: 'Intuitive Surgical Inc.' },
  { symbol: 'UPS',   name: 'United Parcel Service' },
  { symbol: 'GS',    name: 'Goldman Sachs Group' },
  { symbol: 'SBUX',  name: 'Starbucks Corporation' },
  { symbol: 'CAT',   name: 'Caterpillar Inc.' },
  { symbol: 'T',     name: 'AT&T Inc.' },
  { symbol: 'AMGN',  name: 'Amgen Inc.' },
  { symbol: 'LRCX',  name: 'Lam Research Corporation' },
  { symbol: 'C',     name: 'Citigroup Inc.' },
  { symbol: 'MS',    name: 'Morgan Stanley' },
  { symbol: 'DE',    name: 'Deere & Company' },
  { symbol: 'MDT',   name: 'Medtronic plc' },
  { symbol: 'RTX',   name: 'RTX Corporation' },
  { symbol: 'PYPL',  name: 'PayPal Holdings Inc.' },
  { symbol: 'MRNA',  name: 'Moderna Inc.' },
  { symbol: 'COIN',  name: 'Coinbase Global Inc.' },
  { symbol: 'HOOD',  name: 'Robinhood Markets Inc.' },
  { symbol: 'SOFI',  name: 'SoFi Technologies Inc.' },
  { symbol: 'PLTR',  name: 'Palantir Technologies' },
  { symbol: 'SNOW',  name: 'Snowflake Inc.' },
  { symbol: 'DDOG',  name: 'Datadog Inc.' },
  { symbol: 'CRWD',  name: 'CrowdStrike Holdings' },
  { symbol: 'PANW',  name: 'Palo Alto Networks' },
  { symbol: 'NET',   name: 'Cloudflare Inc.' },
  { symbol: 'UBER',  name: 'Uber Technologies' },
  { symbol: 'ABNB',  name: 'Airbnb Inc.' },
  { symbol: 'RIVN',  name: 'Rivian Automotive Inc.' },
  { symbol: 'NIO',   name: 'NIO Inc.' },
  { symbol: 'BABA',  name: 'Alibaba Group Holding' },
  { symbol: 'PLTR',  name: 'Palantir Technologies' },
  { symbol: 'PATH',  name: 'UiPath Inc.' },
  { symbol: 'SPY',   name: 'SPDR S&P 500 ETF Trust' },
  { symbol: 'QQQ',   name: 'Invesco QQQ Trust' },
  { symbol: 'DIA',   name: 'SPDR Dow Jones ETF' },
  { symbol: 'IWM',   name: 'iShares Russell 2000 ETF' },
  { symbol: 'GLD',   name: 'SPDR Gold Shares ETF' },
  { symbol: 'SLV',   name: 'iShares Silver Trust ETF' },
  { symbol: 'TLT',   name: 'iShares 20+ Yr Treasury ETF' },
  { symbol: 'XLF',   name: 'Financial Select SPDR ETF' },
  { symbol: 'XLE',   name: 'Energy Select SPDR ETF' },
  { symbol: 'XLK',   name: 'Technology Select SPDR ETF' },
  { symbol: 'ARKK',  name: 'ARK Innovation ETF' },
  { symbol: 'VOO',   name: 'Vanguard S&P 500 ETF' },
  { symbol: 'BRK.B', name: 'Berkshire Hathaway Class B' },
]

// ─── Crypto symbol map (for watchlist display) ───────────────────────────────

const CRYPTO_SYMBOL_MAP: Record<string, string> = {
  // user-facing → CoinGecko/API symbol
  'BTC': 'BTC',
  'ETH': 'ETH',
  'SOL': 'SOL',
  'ADA': 'ADA',
  'DOGE': 'DOGE',
  'XRP': 'XRP',
  'BNB': 'BNB',
  'AVAX': 'AVAX',
  'DOT': 'DOT',
  'MATIC': 'MATIC',
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(price: number | null | undefined, dec = 2) {
  if (price == null || isNaN(price)) return '—'
  return price.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec })
}

function fmtPct(pct: number | null | undefined) {
  if (pct == null || isNaN(pct)) return '—'
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`
}

function fmtMarketCap(val: number | null) {
  if (!val) return '—'
  if (val >= 1e12) return `$${(val / 1e12).toFixed(2)}T`
  if (val >= 1e9)  return `$${(val / 1e9).toFixed(2)}B`
  if (val >= 1e6)  return `$${(val / 1e6).toFixed(2)}M`
  return `$${val.toLocaleString()}`
}

function fmtTime(dateStr: string) {
  try {
    const diff = Date.now() - new Date(dateStr).getTime()
    const m = Math.floor(diff / 60_000)
    if (m < 1) return 'now'
    if (m < 60) return `${m}m`
    const h = Math.floor(m / 60)
    if (h < 24) return `${h}h`
    return `${Math.floor(h / 24)}d`
  } catch { return '' }
}

function fmtEventTime(dateStr: string) {
  return formatEventTime(dateStr) || dateStr
}

function fmtEventDate(dateStr: string) {
  return formatEventDate(dateStr) || dateStr
}

function symbolName(sym: string): string {
  return TOP_SYMBOLS.find(s => s.symbol === sym)?.name || sym
}

// ─── Stock Search Input (allows ANY ticker) ───────────────────────────────────

function StockSearch({ onSelect }: { onSelect: (symbol: string, name: string) => void }) {
  const [query, setQuery] = useState('')
  const [open, setOpen]   = useState(false)
  const [active, setActive] = useState(0)
  const wrapRef = useRef<HTMLDivElement>(null)

  const knownResults = query.trim().length >= 1
    ? TOP_SYMBOLS.filter(s =>
        s.symbol.startsWith(query.trim().toUpperCase()) ||
        s.name.toLowerCase().includes(query.trim().toLowerCase())
      ).slice(0, 7)
    : []

  // Allow adding ANY ticker not already in known list
  const upperQuery = query.trim().toUpperCase()
  const isCustom = upperQuery.length >= 1 && !knownResults.some(r => r.symbol === upperQuery)
  const results = isCustom
    ? [...knownResults, { symbol: upperQuery, name: `Add "${upperQuery}" →` }]
    : knownResults

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const pick = (sym: string, name: string) => {
    trackStockSearch(sym)
    const cleanName = name.startsWith('Add "') ? sym : name
    onSelect(sym, cleanName)
    setQuery('')
    setOpen(false)
    setActive(0)
  }

  return (
    <div ref={wrapRef} className="search-wrap">
      <input
        type="text"
        className="symbol-search"
        placeholder="Search or add ticker…"
        value={query}
        autoComplete="off"
        onChange={e => { setQuery(e.target.value); setOpen(true); setActive(0) }}
        onFocus={() => { if (query) setOpen(true) }}
        onKeyDown={e => {
          if (e.key === 'Enter' && query.trim()) {
            e.preventDefault()
            if (open && results.length > 0) {
              pick(results[active].symbol, results[active].name)
            } else {
              pick(upperQuery, upperQuery)
            }
            return
          }
          if (!open || results.length === 0) return
          if (e.key === 'ArrowDown') { e.preventDefault(); setActive(i => Math.min(i + 1, results.length - 1)) }
          if (e.key === 'ArrowUp')   { e.preventDefault(); setActive(i => Math.max(i - 1, 0)) }
          if (e.key === 'Escape')    { setOpen(false) }
        }}
      />
      {open && results.length > 0 && (
        <div className="search-dropdown">
          {results.map((r, i) => (
            <button
              key={r.symbol}
              className={`search-result${i === active ? ' search-result-active' : ''}`}
              onMouseDown={() => pick(r.symbol, r.name)}
              onMouseEnter={() => setActive(i)}
            >
              <span className="search-result-symbol">{r.symbol}</span>
              <span className="search-result-name">{r.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Company Profile Section ──────────────────────────────────────────────────

function CompanyProfileSection({ profile }: { profile: CompanyProfile }) {
  const [expanded, setExpanded] = useState(false)

  const stats = [
    { label: 'MKT CAP', val: fmtMarketCap(profile.marketCap) },
    { label: 'P/E RATIO', val: profile.peRatio ? profile.peRatio.toFixed(1) : '—' },
    { label: 'EPS', val: profile.eps ? `$${profile.eps.toFixed(2)}` : '—' },
    { label: 'DIV YIELD', val: profile.dividendYield ? `${profile.dividendYield.toFixed(2)}%` : '—' },
    { label: '52W HIGH', val: profile.week52High ? `$${fmt(profile.week52High)}` : '—' },
    { label: '52W LOW', val: profile.week52Low ? `$${fmt(profile.week52Low)}` : '—' },
    { label: 'BETA', val: profile.beta ? profile.beta.toFixed(2) : '—' },
    { label: 'P/B RATIO', val: profile.pbRatio ? profile.pbRatio.toFixed(1) : '—' },
    { label: 'EXCHANGE', val: profile.exchange || '—' },
  ]

  return (
    <div className="company-profile">
      <div className="company-profile-header">
        {profile.logo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={profile.logo} alt={profile.name} className="company-logo" />
        )}
        <div className="company-meta">
          <span className="company-name">{profile.name}</span>
          <span className="company-industry">
            {profile.industry}{profile.country ? ` · ${profile.country}` : ''}
          </span>
        </div>
      </div>

      {profile.description && (
        <p
          className={`company-description${expanded ? ' expanded' : ''}`}
          onClick={() => setExpanded(e => !e)}
          title={expanded ? 'Click to collapse' : 'Click to expand'}
        >
          {profile.description}
          {!expanded && <span style={{ color: 'var(--accent)', marginLeft: 4 }}>more</span>}
        </p>
      )}

      <div className="company-key-stats">
        {stats.map(s => (
          <div key={s.label} className="company-stat">
            <span className="company-stat-label">{s.label}</span>
            <span className="company-stat-val">{s.val}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Stock Detail Modal ───────────────────────────────────────────────────────

// ─── Chart size cycle ─────────────────────────────────────────────────────────

const CHART_SIZES = ['default', 'expanded', 'fullscreen'] as const
type ChartSize = (typeof CHART_SIZES)[number]

function StockDetailModal({
  symbol,
  name,
  quote,
  profile,
  loadingQuote,
  loadingProfile,
  onClose,
  onAddTicker,
  onAddWatchlist,
  inTicker,
  inWatchlist,
  tickerFull,
}: {
  symbol: string
  name: string
  quote: Quote | null
  profile: CompanyProfile | null
  loadingQuote: boolean
  loadingProfile: boolean
  onClose: () => void
  onAddTicker: () => void
  onAddWatchlist: () => void
  inTicker: boolean
  inWatchlist: boolean
  tickerFull: boolean
}) {
  // ── Chart size state (persisted to localStorage) ─────────────────────────
  const [chartSize, setChartSize] = useState<ChartSize>(() => {
    try {
      const saved = (localStorage.getItem('cg_chart_size') ?? '') as ChartSize
      return (CHART_SIZES as readonly string[]).includes(saved) ? saved : 'default'
    } catch { return 'default' }
  })

  const cycleChartSize = useCallback(() => {
    setChartSize(s => {
      const next = CHART_SIZES[(CHART_SIZES.indexOf(s) + 1) % CHART_SIZES.length]
      try { localStorage.setItem('cg_chart_size', next) } catch {}
      return next
    })
  }, [])

  // ── Keyboard: Escape closes, F cycles chart size ──────────────────────────
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return }
      if (e.key === 'f' || e.key === 'F') {
        const target = e.target as HTMLElement
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return
        cycleChartSize()
      }
    }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [onClose, cycleChartSize])

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  const isUp = quote ? quote.changePct >= 0 : true

  // Expand button icon/title
  const expandIcon  = chartSize === 'fullscreen' ? '⤡' : '⛶'
  const expandTitle = chartSize === 'default'
    ? 'Expand chart (F)'
    : chartSize === 'expanded'
      ? 'Fullscreen chart (F)'
      : 'Collapse chart (F)'

  return (
    <>
      <div className="modal-backdrop" onClick={onClose} />
      <div
        className={`stock-modal${chartSize !== 'default' ? ` chart-${chartSize}` : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={`${symbol} detail`}
      >
        <div className="stock-modal-header">
          <div className="stock-modal-title">
            <span className="stock-modal-symbol">{symbol}</span>
            <span className="stock-modal-company">{profile?.name || name || symbolName(symbol)}</span>
          </div>

          <div className="stock-modal-price-block">
            {loadingQuote && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div className="shimmer" style={{ width: 120, height: 22, borderRadius: 4 }} />
                <div className="shimmer" style={{ width: 80, height: 14, borderRadius: 4 }} />
              </div>
            )}
            {!loadingQuote && quote && (
              <>
                <span className="stock-modal-price">
                  ${quote.current < 10 ? fmt(quote.current, 4) : fmt(quote.current)}
                </span>
                <span className={isUp ? 'modal-up' : 'modal-down'}>
                  {quote.change >= 0 ? '+' : ''}{fmt(quote.change)} ({fmtPct(quote.changePct)})
                </span>
                <span className="stock-modal-source">
                  {quote.source === 'finnhub' ? '● LIVE' : '○ MOCK'}
                </span>
              </>
            )}
            {!loadingQuote && !quote && (
              <span className="stock-modal-loading">No price data</span>
            )}
          </div>

          <button className="modal-close-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {/* TradingView Chart */}
        <div className="stock-chart-wrap">
          <button
            className="chart-expand-btn"
            onClick={cycleChartSize}
            title={expandTitle}
            aria-label={expandTitle}
          >
            {expandIcon}
          </button>
          <iframe
            src={`https://s.tradingview.com/widgetembed/?symbol=${encodeURIComponent(symbol)}&interval=D&theme=dark&style=1&locale=en&toolbar_bg=%230f0f12&hide_top_toolbar=0&hide_side_toolbar=1&allow_symbol_change=0&save_image=0&calendar=0&hideideas=1`}
            width="100%"
            height="340"
            frameBorder="0"
            allowTransparency={true}
            scrolling="no"
            title={`${symbol} price chart`}
          />
        </div>

        {/* Quote Stats */}
        {quote && (
          <div className="stock-stats">
            <div className="stock-stat">
              <span className="stock-stat-label">OPEN</span>
              <span className="stock-stat-val">${fmt(quote.open)}</span>
            </div>
            <div className="stock-stat">
              <span className="stock-stat-label">HIGH</span>
              <span className="stock-stat-val" style={{ color: 'var(--green)' }}>${fmt(quote.high)}</span>
            </div>
            <div className="stock-stat">
              <span className="stock-stat-label">LOW</span>
              <span className="stock-stat-val" style={{ color: 'var(--red)' }}>${fmt(quote.low)}</span>
            </div>
            <div className="stock-stat">
              <span className="stock-stat-label">PREV CLOSE</span>
              <span className="stock-stat-val">${fmt(quote.prevClose)}</span>
            </div>
          </div>
        )}

        {/* Company Profile */}
        {loadingProfile && (
          <div className="company-profile">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div className="shimmer" style={{ width: 200, height: 14, borderRadius: 4 }} />
              <div className="shimmer" style={{ width: '100%', height: 40, borderRadius: 4 }} />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="shimmer" style={{ height: 44, borderRadius: 5 }} />
                ))}
              </div>
            </div>
          </div>
        )}
        {!loadingProfile && profile && <CompanyProfileSection profile={profile} />}

        {/* Actions */}
        <div className="stock-actions">
          <button
            className={`stock-action-btn${inTicker ? ' stock-action-active' : ''}`}
            onClick={onAddTicker}
            disabled={inTicker || (tickerFull && !inTicker)}
            title={tickerFull && !inTicker ? `Ticker full — max ${MAX_TICKER_CUSTOM} symbols` : undefined}
          >
            {inTicker ? '✓ In Ticker' : tickerFull ? 'Ticker Full (15)' : '＋ Add to Ticker'}
          </button>

          <button
            className={`stock-action-btn${inWatchlist ? ' stock-action-active' : ''}`}
            onClick={onAddWatchlist}
          >
            {inWatchlist ? '★ In Watchlist' : '☆ Add to Watchlist'}
          </button>
        </div>
      </div>
    </>
  )
}

// ─── Ticker Settings Dropdown ─────────────────────────────────────────────────

function TickerSettingsDropdown({
  hiddenSymbols,
  onToggle,
  onClose,
  tickerSize,
  onSizeChange,
}: {
  hiddenSymbols: Set<string>
  onToggle: (sym: string) => void
  onClose: () => void
  tickerSize: 'compact' | 'normal' | 'large'
  onSizeChange: (size: 'compact' | 'normal' | 'large') => void
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [onClose])

  return (
    <div ref={ref} style={{
      position: 'absolute',
      right: 0,
      top: '100%',
      marginTop: 4,
      background: 'var(--bg-2)',
      border: '1px solid var(--border)',
      borderRadius: 6,
      padding: '8px 0',
      minWidth: 200,
      zIndex: 200,
      boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
    }}>
      {/* Size selector */}
      <div style={{ padding: '4px 12px 8px', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-3)', borderBottom: '1px solid var(--border)', marginBottom: 4 }}>
        TICKER SIZE
      </div>
      <div style={{ display: 'flex', gap: 4, padding: '4px 12px 8px', borderBottom: '1px solid var(--border)', marginBottom: 4 }}>
        {(['compact', 'normal', 'large'] as const).map(s => (
          <button
            key={s}
            onClick={() => onSizeChange(s)}
            style={{
              flex: 1,
              padding: '4px 6px',
              fontSize: 10,
              fontWeight: 600,
              borderRadius: 4,
              cursor: 'pointer',
              textTransform: 'capitalize',
              background: tickerSize === s ? 'var(--accent)' : 'var(--bg-3)',
              color: tickerSize === s ? '#fff' : 'var(--text-2)',
              border: 'none',
              letterSpacing: '0.03em',
            }}
          >
            {s}
          </button>
        ))}
      </div>

      <div style={{ padding: '4px 12px 8px', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-3)', marginBottom: 4 }}>
        TICKER SYMBOLS
      </div>
      {TICKER_SYMBOLS.map(sym => (
        <label key={sym} style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '4px 12px',
          cursor: 'pointer',
          fontSize: 11,
          color: hiddenSymbols.has(sym) ? 'var(--text-3)' : 'var(--text-1)',
        }}>
          <input
            type="checkbox"
            checked={!hiddenSymbols.has(sym)}
            onChange={() => onToggle(sym)}
            style={{ cursor: 'pointer' }}
          />
          <span style={{ fontWeight: 600, minWidth: 60 }}>{TICKER_DISPLAY[sym] || sym}</span>
          <span style={{ color: 'var(--text-3)', fontSize: 9.5 }}>{sym}</span>
        </label>
      ))}
    </div>
  )
}

// ─── Ticker Bar ───────────────────────────────────────────────────────────────

function TickerBar({
  tickerQuotes,
  customSymbols,
  isLoading,
  hiddenSymbols = new Set<string>(),
  onOpenSettings,
  size = 'compact',
}: {
  tickerQuotes: Record<string, Quote>
  customSymbols: string[]
  isLoading: boolean
  hiddenSymbols?: Set<string>
  onOpenSettings?: () => void
  size?: 'compact' | 'normal' | 'large'
}) {
  const defaultItems = Object.keys(tickerQuotes).length > 0
    ? TICKER_SYMBOLS
        .filter(sym => tickerQuotes[sym] && !hiddenSymbols.has(sym))
        .map(sym => {
          const q = tickerQuotes[sym]
          return { symbol: TICKER_DISPLAY[sym] || sym, price: q.current, change: q.changePct, isReal: q.source !== 'mock', raw: sym, isCustom: false }
        })
    : TICKER_FALLBACK
        .filter(t => {
          // Map display name back to original symbol for filtering
          const originalSym = Object.entries(TICKER_DISPLAY).find(([, v]) => v === t.symbol)?.[0] || t.symbol
          return !hiddenSymbols.has(originalSym)
        })
        .map(t => ({ ...t, isReal: false, raw: t.symbol, isCustom: false }))

  const customItems = customSymbols
    .filter(sym => tickerQuotes[sym])
    .map(sym => {
      const q = tickerQuotes[sym]
      return { symbol: sym, price: q.current, change: q.changePct, isReal: q.source !== 'mock', raw: sym, isCustom: true }
    })

  const items = [...defaultItems, ...customItems]
  const duped = [...items, ...items, ...items]

  return (
    <div className={`ticker-bar ticker-${size}`} style={{ position: 'relative' }}>
      {isLoading && Object.keys(tickerQuotes).length === 0 && (
        <div className="connecting-banner" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, zIndex: 3, padding: '0 16px' }}>
          <span className="connecting-dot" />
          Connecting to live data…
        </div>
      )}
      <div className="ticker-track">
        {duped.map((item, i) => (
          <span key={i} className={`ticker-item${item.isCustom ? ' ticker-item-custom' : ''}`}>
            <span className="ticker-symbol">{item.symbol}</span>
            <span className="ticker-price">
              {item.price == null ? '—' : item.price < 10 ? fmt(item.price, 4) : item.price < 1000 ? fmt(item.price, 2) : fmt(item.price, 0)}
            </span>
            <span className={(item.change ?? 0) >= 0 ? 'ticker-up' : 'ticker-down'}>
              {fmtPct(item.change)}
            </span>
          </span>
        ))}
      </div>
      {onOpenSettings && (
        <button
          onClick={onOpenSettings}
          title="Customize ticker symbols"
          style={{
            position: 'absolute',
            right: 8,
            top: '50%',
            transform: 'translateY(-50%)',
            zIndex: 10,
            fontSize: 13,
            color: 'var(--text-2)',
            cursor: 'pointer',
            padding: '2px 5px',
            borderRadius: 3,
            lineHeight: 1,
            background: 'rgba(0,0,0,0.3)',
          }}
        >
          ⚙
        </button>
      )}
    </div>
  )
}

// ─── Analysis View ────────────────────────────────────────────────────────────

function AnalysisView({
  gainers,
  losers,
  newsArticles,
  onOpenStock,
}: {
  gainers: Quote[]
  losers: Quote[]
  newsArticles: NewsArticle[]
  onOpenStock: (sym: string) => void
}) {
  const bullishCount = newsArticles.filter(a => a.sentimentLabel === 'bullish').length
  const bearishCount = newsArticles.filter(a => a.sentimentLabel === 'bearish').length
  const neutralCount  = newsArticles.filter(a => a.sentimentLabel === 'neutral').length
  const total = newsArticles.length
  const bullPct = total > 0 ? Math.round((bullishCount / total) * 100) : 0
  const bearPct = total > 0 ? Math.round((bearishCount / total) * 100) : 0
  const sentimentScore = bullishCount + bearishCount > 0
    ? (bullishCount / (bullishCount + bearishCount)) * 100
    : 50
  const sentimentLabel = sentimentScore > 60
    ? <><IconTrendingUp size={11} style={{ verticalAlign: 'middle', marginRight: 3 }} />Bullish</>
    : sentimentScore < 40
      ? <><IconTrendingDown size={11} style={{ verticalAlign: 'middle', marginRight: 3 }} />Bearish</>
      : <><IconMinus size={11} style={{ verticalAlign: 'middle', marginRight: 3 }} />Neutral</>
  const sentimentColor = sentimentScore > 60 ? 'var(--green)' : sentimentScore < 40 ? 'var(--red)' : 'var(--accent)'

  const highImpact = newsArticles.filter(a => a.impactLabel === 'High').slice(0, 8)

  return (
    <div style={{ padding: '0 0 24px' }}>
      {/* Sentiment header */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
        <div className="feed-title" style={{ marginBottom: 10 }}>
          <span className="live-dot" />
          MARKET ANALYSIS
        </div>

        {/* Sentiment bar */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, fontSize: 11 }}>
            <span style={{ color: 'var(--green)', fontWeight: 600 }}>▲ Bullish {bullPct}%</span>
            <span style={{ color: sentimentColor, fontWeight: 700, fontSize: 12 }}>{sentimentLabel}</span>
            <span style={{ color: 'var(--red)', fontWeight: 600 }}>Bearish {bearPct}% ▼</span>
          </div>
          <div style={{ height: 10, borderRadius: 5, background: 'var(--bg-3)', overflow: 'hidden', display: 'flex' }}>
            <div style={{ height: '100%', width: `${bullPct}%`, background: 'var(--green)', transition: 'width 0.5s' }} />
            <div style={{ height: '100%', width: `${neutralCount > 0 ? Math.round((neutralCount / total) * 100) : 0}%`, background: 'var(--accent)', opacity: 0.4 }} />
            <div style={{ height: '100%', flex: 1, background: 'var(--red)', opacity: 0.7 }} />
          </div>
          <div style={{ fontSize: 9.5, color: 'var(--text-3)', marginTop: 4, textAlign: 'center' }}>
            Based on {total} recent news articles
          </div>
        </div>

        {/* Summary stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
          {[
            { label: 'BULLISH', val: bullishCount, col: 'var(--green)' },
            { label: 'NEUTRAL', val: neutralCount, col: 'var(--accent)' },
            { label: 'BEARISH', val: bearishCount, col: 'var(--red)' },
          ].map(s => (
            <div key={s.label} style={{ background: 'var(--bg-2)', borderRadius: 5, padding: '6px 8px', textAlign: 'center' }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: s.col, fontFamily: 'var(--mono)' }}>{s.val}</div>
              <div style={{ fontSize: 9, color: 'var(--text-3)', letterSpacing: '0.05em' }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Top Movers */}
      {(gainers.length > 0 || losers.length > 0) && (
        <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <div className="sidebar-title sidebar-title-gain" style={{ marginBottom: 4 }}>▲ TOP GAINERS</div>
            {gainers.slice(0, 5).map(q => (
              <MoverRow key={q.symbol} quote={q} onClick={onOpenStock} />
            ))}
          </div>
          <div>
            <div className="sidebar-title sidebar-title-loss" style={{ marginBottom: 4 }}>▼ TOP LOSERS</div>
            {losers.slice(0, 5).map(q => (
              <MoverRow key={q.symbol} quote={q} onClick={onOpenStock} />
            ))}
          </div>
        </div>
      )}

      {/* High-impact news */}
      {highImpact.length > 0 && (
        <div>
          <div style={{ padding: '8px 16px 4px', borderBottom: '1px solid var(--border)' }}>
            <div className="sidebar-title" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: 'var(--red)', flexShrink: 0 }} />
              HIGH IMPACT NEWS
            </div>
          </div>
          {highImpact.map((a, i) => <NewsRow key={a.id} article={a} index={i} />)}
        </div>
      )}

      {gainers.length === 0 && newsArticles.length === 0 && (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-3)', fontSize: 12 }}>
          Loading market analysis…
        </div>
      )}
    </div>
  )
}

// ─── News Row ─────────────────────────────────────────────────────────────────

function NewsRow({ article, index }: { article: NewsArticle; index: number }) {
  const isHigh = article.impactLabel === 'High'
  return (
    <a
      href={article.url || '#'}
      target="_blank"
      rel="noopener noreferrer"
      className={`news-row ${index % 2 !== 0 ? 'news-row-even' : ''}`}
    >
      <span className="news-time">{fmtTime(article.publishedAt)}</span>
      <span className="news-source">{article.source}</span>
      <span className="news-title">
        {isHigh && <span className="news-flag-high">●</span>}
        {article.title}
      </span>
      <span className="news-sentiment">
        {article.sentimentLabel === 'bullish' && <span className="sentiment-bull">▲</span>}
        {article.sentimentLabel === 'bearish' && <span className="sentiment-bear">▼</span>}
      </span>
      <span className="news-symbols">
        {article.symbols.slice(0, 2).join(' ')}
      </span>
    </a>
  )
}

// ─── Mover Row ────────────────────────────────────────────────────────────────

function MoverRow({
  quote,
  onWatch,
  watched,
  onClick,
}: {
  quote: Quote
  onWatch?: (sym: string) => void
  watched?: boolean
  onClick?: (sym: string) => void
}) {
  const isUp = (quote.changePct ?? 0) >= 0
  return (
    <div
      className={`mover-row${onClick ? ' mover-row-clickable' : ''}`}
      title={`H: $${fmt(quote.high)}  L: $${fmt(quote.low)}  O: $${fmt(quote.open)}`}
      onClick={() => onClick?.(quote.symbol)}
    >
      <span className="mover-symbol">
        {onWatch && (
          <button
            onClick={e => { e.stopPropagation(); onWatch(quote.symbol) }}
            style={{ marginRight: 5, fontSize: 10, color: watched ? '#f0a500' : '#404050', transition: 'color 0.15s' }}
          >
            ★
          </button>
        )}
        {quote.symbol}
      </span>
      <span className="mover-price">${fmt(quote.current)}</span>
      <span className={isUp ? 'mover-up' : 'mover-down'}>{fmtPct(quote.changePct)}</span>
    </div>
  )
}

// ─── Crypto Coin Row ──────────────────────────────────────────────────────────

function CryptoCoinRow({ coin }: { coin: CryptoCoin }) {
  const isUp = coin.change24h >= 0
  const fmtPrice = (p: number) => {
    if (p >= 1000) return p.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
    if (p >= 1)    return p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    return p.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 })
  }
  return (
    <div className="mover-row" style={{ cursor: 'default' }}>
      <span className="mover-symbol" style={{ fontSize: 11 }}>
        {coin.symbol}
        <span style={{ color: 'var(--text-3)', fontSize: 9, marginLeft: 3 }}>#{coin.marketCapRank}</span>
      </span>
      <span className="mover-price" style={{ fontSize: 11 }}>${fmtPrice(coin.price)}</span>
      <span className={isUp ? 'mover-up' : 'mover-down'} style={{ fontSize: 11 }}>
        {isUp ? '+' : ''}{coin.change24h.toFixed(2)}%
      </span>
    </div>
  )
}

// ─── Enhanced Economic Calendar ───────────────────────────────────────────────

interface EcalProps {
  events: CalendarEvent[]
  loading: boolean
}

function EconomicCalendar({ events, loading }: EcalProps) {
  const [impactFilter, setImpactFilter] = useState('All')
  const [currencyFilter, setCurrencyFilter] = useState('All')

  // Normalize impact to string for consistent comparison
  function normalizeImpact(impact: number | string): string {
    if (typeof impact === 'string') return impact
    if (impact >= 3) return 'High'
    if (impact >= 2) return 'Medium'
    return 'Low'
  }

  // Type icon for event
  function typeIcon(e: CalendarEvent): React.ReactNode {
    if (e.type === 'speech') return <IconMic size={10} />
    if (e.type === 'earnings') return <IconChart size={10} />
    if (e.type === 'holiday') return <IconBuilding size={10} />
    return null
  }

  const filtered = events.filter(e => {
    const impStr = normalizeImpact(e.impact)
    const matchImpact = impactFilter === 'All' || impStr === impactFilter
    const ccy = (e.currency || e.country || '').toUpperCase()
    const matchCurrency = currencyFilter === 'All' || ccy === currencyFilter
    return matchImpact && matchCurrency
  })

  // Group by date
  const groups: Record<string, CalendarEvent[]> = {}
  filtered.forEach(e => {
    const dateStr = e.datetime || e.date || ''
    const dayKey = dateStr ? fmtEventDate(dateStr) : 'Unknown'
    if (!groups[dayKey]) groups[dayKey] = []
    groups[dayKey].push(e)
  })

  const impactColorClass = (impact: number | string) => {
    const s = normalizeImpact(impact)
    if (s === 'High') return 'ecal-impact-high'
    if (s === 'Medium') return 'ecal-impact-medium'
    return 'ecal-impact-low'
  }

  const getEventTime = (e: CalendarEvent) => fmtEventTime(e.datetime || e.date || '')

  // Counts for header badge
  const speechCount = filtered.filter(e => e.type === 'speech').length
  const earningsCount = filtered.filter(e => e.type === 'earnings').length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
      {/* Header */}
      <div className="ecal-header">
        <span className="ecal-title">
          <span style={{ color: 'var(--yellow)' }}>◈</span>
          CALENDAR
        </span>

        {/* Type badges */}
        {speechCount > 0 && (
          <span style={{ fontSize: 9, background: 'rgba(245,158,11,0.18)', color: '#f59e0b', padding: '2px 5px', borderRadius: 3, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
            <IconMic size={9} />{speechCount}
          </span>
        )}
        {earningsCount > 0 && (
          <span style={{ fontSize: 9, background: 'rgba(139,92,246,0.18)', color: '#8b5cf6', padding: '2px 5px', borderRadius: 3, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
            <IconChart size={9} />{earningsCount}
          </span>
        )}

        {/* Impact filter */}
        <div style={{ display: 'flex', gap: 3, marginLeft: 2 }}>
          {CALENDAR_IMPACT_FILTERS.map(f => (
            <button
              key={f}
              className={`ecal-filter-btn${impactFilter === f ? ' active' : ''}`}
              onClick={() => setImpactFilter(f)}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Currency filter */}
        <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
          {CALENDAR_CURRENCIES.slice(0, 6).map(c => (
            <button
              key={c}
              className={`ecal-filter-btn${currencyFilter === c ? ' active' : ''}`}
              onClick={() => setCurrencyFilter(c)}
            >
              {c}
            </button>
          ))}
        </div>

        <span style={{ fontSize: 9.5, color: 'var(--text-3)', marginLeft: 'auto' }}>
          {filtered.length} events
        </span>
      </div>

      {/* Column headers */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '42px 20px 32px 1fr',
        gap: '0 6px',
        padding: '4px 12px',
        borderBottom: '1px solid var(--border-b)',
        background: 'var(--bg-2)',
      }}>
        {['TIME', 'IMP', 'CCY', 'EVENT & VALUES'].map((h, i) => (
          <span key={i} style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-3)', textAlign: i === 0 ? 'right' : 'left' }}>
            {h}
          </span>
        ))}
      </div>

      {/* Events */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading ? (
          <div style={{ padding: 20, color: 'var(--text-3)', fontSize: 11, textAlign: 'center' }}>
            Loading calendar…
          </div>
        ) : Object.keys(groups).length === 0 ? (
          <div style={{ padding: 20, color: 'var(--text-3)', fontSize: 11, textAlign: 'center' }}>
            No events match current filters.
          </div>
        ) : (
          Object.entries(groups).map(([day, dayEvents]) => (
            <div key={day} className="ecal-day-group">
              <div className="ecal-day-label">{day}</div>
              {dayEvents.map(ev => {
                const icon = typeIcon(ev)
                const ccy = (ev.currency || ev.country || '').toUpperCase()
                return (
                  <div key={ev.id} className="ecal-event" style={
                    ev.type === 'speech' ? { borderLeft: '2px solid #f59e0b' } :
                    ev.type === 'earnings' ? { borderLeft: '2px solid #8b5cf6' } : {}
                  }>
                    <span className="ecal-time">{getEventTime(ev)}</span>
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                      {icon ? (
                        <span style={{ fontSize: 10 }}>{icon}</span>
                      ) : (
                        <span className={`ecal-impact-dot ${impactColorClass(ev.impact)}`} />
                      )}
                    </div>
                    <span className="ecal-currency">{ccy}</span>
                    <div className="ecal-body">
                      <span className="ecal-event-name" style={
                        ev.type === 'speech' ? { color: '#f59e0b' } :
                        ev.type === 'earnings' ? { color: '#8b5cf6' } : {}
                      }>{ev.title}</span>
                      {(ev.actual || ev.forecast || ev.previous) && (
                        <div className="ecal-values">
                          {ev.actual && <span className="ecal-actual">A: {ev.actual}</span>}
                          {ev.forecast && <span className="ecal-forecast">F: {ev.forecast}</span>}
                          {ev.previous && <span className="ecal-previous">P: {ev.previous}</span>}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

// ─── Shimmer Skeletons ────────────────────────────────────────────────────────

function NewsSkeletons({ count = 20 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="news-row-skeleton" style={{ animationDelay: `${i * 0.05}s` }} />
      ))}
    </>
  )
}

function SidebarSkeletons({ count = 4 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="mover-row-skeleton shimmer"
          style={{ margin: '4px 14px', height: 27, animationDelay: `${i * 0.07}s` }}
        />
      ))}
    </>
  )
}

// ─── Portfolio Panel ──────────────────────────────────────────────────────────

interface Holding {
  id: string
  ticker: string
  company: string
  shares: number
  avgCost: number
  buyDate: string
  sector: string
  annualDividend: number
  totalDividendsReceived: number
}

function PortfolioPanel({ quotes, onOpenStock }: { quotes: Record<string, Quote>; onOpenStock: (symbol: string) => void }) {
  const [holdings, setHoldings] = useState<Holding[]>(() => {
    try { const s = localStorage.getItem('cg_portfolio_holdings'); return s ? JSON.parse(s) : [] } catch { return [] }
  })
  const [liveQuotes, setLiveQuotes] = useState<Record<string, Quote>>({})
  const [loadingPrices, setLoadingPrices] = useState(false)

  // Fetch live prices for all holdings
  useEffect(() => {
    if (holdings.length === 0) return
    
    const fetchPrices = async () => {
      setLoadingPrices(true)
      try {
        const tickers = holdings.map(h => h.ticker).join(',')
        const j = await apiFetchSafe<{ success: boolean; data: Record<string, Quote> }>(`${API_BASE}/api/market-data/batch?symbols=${tickers}`)
        if (j?.success && j.data) setLiveQuotes(j.data)
      } finally {
        setLoadingPrices(false)
      }
    }

    fetchPrices()
    // Auto-refresh every 30s
    const t = setInterval(fetchPrices, 30_000)
    return () => clearInterval(t)
  }, [holdings])

  const getPrice = (ticker: string): number | null => {
    return liveQuotes[ticker]?.current ?? quotes[ticker]?.current ?? null
  }

  const getDayChange = (ticker: string): number | null => {
    return liveQuotes[ticker]?.changePct ?? quotes[ticker]?.changePct ?? null
  }

  // Calculate portfolio stats
  const totalCost = holdings.reduce((s, h) => s + h.shares * h.avgCost, 0)
  const totalValue = holdings.reduce((s, h) => {
    const cur = getPrice(h.ticker)
    return s + h.shares * (cur ?? h.avgCost)
  }, 0)
  const totalPnl = totalValue - totalCost
  const totalPnlPct = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0
  const totalDayGain = holdings.reduce((s, h) => {
    const cur = getPrice(h.ticker)
    const dayChange = getDayChange(h.ticker)
    if (cur && dayChange !== null) {
      return s + (cur * dayChange / 100) * h.shares
    }
    return s
  }, 0)

  return (
    <div className="sidebar-section" style={{ padding: 0 }}>
      {/* Summary */}
      {holdings.length > 0 && (
        <>
          <div style={{ padding: '8px 14px', borderBottom: '1px solid var(--border)', fontSize: 10 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 6 }}>
              <div>
                <span style={{ color: 'var(--text-2)' }}>VALUE</span>
                <div style={{ color: 'var(--text-0)', fontFamily: 'var(--mono)', fontWeight: 600 }}>
                  ${fmt(totalValue)}
                </div>
              </div>
              <div>
                <span style={{ color: 'var(--text-2)' }}>P&L</span>
                <div style={{ color: totalPnl >= 0 ? 'var(--green)' : 'var(--red)', fontFamily: 'var(--mono)', fontWeight: 600 }}>
                  ${fmt(Math.abs(totalPnl))} ({totalPnlPct >= 0 ? '+' : ''}{totalPnlPct.toFixed(2)}%)
                </div>
              </div>
            </div>
            {totalDayGain !== 0 && (
              <div style={{ color: totalDayGain >= 0 ? 'var(--green)' : 'var(--red)', fontSize: 9.5 }}>
                Day: {totalDayGain >= 0 ? '+' : ''}${fmt(Math.abs(totalDayGain))}
              </div>
            )}
          </div>

          {/* Holdings list */}
          {holdings.map((h) => {
            const cur = getPrice(h.ticker)
            const dayChg = getDayChange(h.ticker)
            const pnlPct = cur !== null ? ((cur - h.avgCost) / h.avgCost) * 100 : null
            return (
              <div key={h.id} className="mover-row" style={{ gridTemplateColumns: 'auto 1fr auto auto', gap: 8, cursor: 'pointer' }} onClick={() => onOpenStock(h.ticker)}>
                <span className="mover-symbol" style={{ fontSize: 11 }}>
                  {h.ticker}
                  <span style={{ fontSize: 9, color: 'var(--text-3)', marginLeft: 3 }}>{h.shares}sh</span>
                </span>
                <span className="mover-price" style={{ fontSize: 11 }}>
                  {cur !== null ? `$${fmt(cur)}` : '—'}
                </span>
                <span className={pnlPct !== null ? (pnlPct >= 0 ? 'mover-up' : 'mover-down') : ''} style={{ fontSize: 10 }}>
                  {pnlPct !== null ? `${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(2)}%` : '—'}
                </span>
              </div>
            )
          })}

          {/* View Full Portfolio link */}
          <div style={{ padding: '8px 14px', borderTop: '1px solid var(--border)' }}>
            <a
              href="/portfolio"
              style={{
                display: 'inline-block',
                fontSize: 11,
                color: 'var(--accent)',
                textDecoration: 'none',
                fontWeight: 600,
              }}
            >
              View Full Portfolio →
            </a>
          </div>
        </>
      )}

      {/* Empty state */}
      {holdings.length === 0 && (
        <div style={{ padding: '16px 14px', textAlign: 'center', fontSize: 11, color: 'var(--text-3)' }}>
          <div style={{ marginBottom: 8 }}>No positions yet</div>
          <a
            href="/portfolio"
            style={{
              display: 'inline-block',
              fontSize: 10,
              color: 'var(--accent)',
              textDecoration: 'none',
              fontWeight: 600,
            }}
          >
            Add your first stock →
          </a>
        </div>
      )}

      {loadingPrices && holdings.length > 0 && (
        <div style={{ padding: '4px 14px', fontSize: 9, color: 'var(--text-3)', textAlign: 'right' }}>
          ↻ updating…
        </div>
      )}
    </div>
  )
}

// ─── Smart Alerts Bar ────────────────────────────────────────────────────────

function SmartAlertsBar({ watchlist }: { watchlist: string[] }) {
  const [alerts, setAlerts] = useState<{ id: string; text: string; type: 'info' | 'warning' | 'success'; link?: string }[]>([])
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const [todayPnl, setTodayPnl] = useState<{ pnl: number; wins: number; losses: number } | null>(null)

  useEffect(() => {
    const newAlerts: typeof alerts = []

    // Today's P&L from journal
    try {
      const trades = JSON.parse(localStorage.getItem('cg_trades') || '[]')
      const today = new Date().toISOString().slice(0, 10)
      const todayTrades = trades.filter((t: { date: string; pnl: number }) => t.date === today)
      if (todayTrades.length > 0) {
        const pnl = todayTrades.reduce((s: number, t: { pnl: number }) => s + t.pnl, 0)
        const wins = todayTrades.filter((t: { pnl: number }) => t.pnl > 0).length
        const losses = todayTrades.filter((t: { pnl: number }) => t.pnl < 0).length
        setTodayPnl({ pnl, wins, losses })
      }
    } catch {}

    // Watchlist earnings in next 2 days (from localStorage cache)
    try {
      const cal = JSON.parse(localStorage.getItem('cg_cal_cache') || '[]')
      const today = new Date()
      const in2days = new Date(today)
      in2days.setDate(today.getDate() + 2)
      const upcoming = cal.filter((e: { date: string; symbol: string; type: string }) => {
        if (e.type?.toLowerCase() !== 'earnings') return false
        const d = new Date(e.date)
        return d >= today && d <= in2days && watchlist.includes(e.symbol?.toUpperCase())
      })
      upcoming.slice(0, 3).forEach((e: { symbol: string; date: string }) => {
        const days = Math.round((new Date(e.date).getTime() - today.getTime()) / 86400000)
        newAlerts.push({ id: `earn_${e.symbol}`, text: `${e.symbol} earnings in ${days === 0 ? 'today' : `${days}d`} — you hold this`, type: 'warning', link: '/calendar' })
      })
    } catch {}

    // Win rate drop alert
    try {
      const trades = JSON.parse(localStorage.getItem('cg_trades') || '[]')
      const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7)
      const weekTrades = trades.filter((t: { date: string; pnl: number }) => new Date(t.date) >= weekAgo)
      if (weekTrades.length >= 5) {
        const wr = weekTrades.filter((t: { pnl: number }) => t.pnl > 0).length / weekTrades.length
        if (wr < 0.40) newAlerts.push({ id: 'winrate_drop', text: `Win rate this week: ${(wr * 100).toFixed(0)}% — consider reviewing your setups`, type: 'warning', link: '/journal' })
      }
    } catch {}

    setAlerts(newAlerts)
  }, [watchlist])

  const visible = alerts.filter(a => !dismissed.has(a.id))
  if (visible.length === 0 && !todayPnl) return null

  return (
    <div style={{ maxWidth: '100%', padding: '6px 16px', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', borderBottom: '1px solid var(--border)', background: 'var(--bg-1)' }}>
      {todayPnl && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 10px', background: todayPnl.pnl >= 0 ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${todayPnl.pnl >= 0 ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`, borderRadius: 20, fontSize: 11 }}>
          <span style={{ fontWeight: 700, color: todayPnl.pnl >= 0 ? 'var(--green)' : 'var(--red)' }}>
            Today: {todayPnl.pnl >= 0 ? '+' : ''}{todayPnl.pnl.toFixed(2)} USD
          </span>
          <span style={{ color: 'var(--text-3)', fontSize: 10 }}>{todayPnl.wins}W/{todayPnl.losses}L</span>
        </div>
      )}
      {visible.map(a => (
        <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 10px', background: a.type === 'warning' ? 'rgba(245,158,11,0.1)' : a.type === 'success' ? 'rgba(34,197,94,0.1)' : 'var(--bg-3)', border: `1px solid ${a.type === 'warning' ? 'rgba(245,158,11,0.3)' : a.type === 'success' ? 'rgba(34,197,94,0.3)' : 'var(--border)'}`, borderRadius: 20, fontSize: 11 }}>
          <span style={{ color: a.type === 'warning' ? '#f59e0b' : a.type === 'success' ? 'var(--green)' : 'var(--text-2)' }}>
            {a.link ? <a href={a.link} style={{ color: 'inherit', textDecoration: 'none' }}>{a.text}</a> : a.text}
          </span>
          <button onClick={() => setDismissed(d => new Set([...d, a.id]))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', fontSize: 10, padding: '0 2px' }}>✕</button>
        </div>
      ))}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Home() {
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

  const [clock, setClock] = useState('')
  const [isOffline, setIsOffline] = useState(false)

  // News category filter (inside news column)
  const [newsCategory, setNewsCategory] = useState('All')

  // Auth modal
  const [authModalOpen, setAuthModalOpen] = useState(false)

  // Ticker
  const [tickerQuotes, setTickerQuotes] = useState<Record<string, Quote>>({})
  const [tickerLoading, setTickerLoading] = useState(true)
  const [customTickerSymbols, setCustomTickerSymbols] = useState<string[]>([])
  const [tickerHiddenSymbols, setTickerHiddenSymbols] = useState<Set<string>>(new Set())
  const [tickerSettingsOpen, setTickerSettingsOpen] = useState(false)
  const [tickerSize, setTickerSize] = useState<'compact' | 'normal' | 'large'>(() => {
    try { return (localStorage.getItem('cg_ticker_size') as 'compact' | 'normal' | 'large') || 'compact' } catch { return 'compact' }
  })

  // Column widths (resizable)
  const [colWidths, setColWidths] = useState<[number, number, number]>([20, 56, 24])
  const layoutRef = useRef<HTMLDivElement>(null)

  // Portfolio collapsed
  const [portfolioCollapsed, setPortfolioCollapsed] = useState(false)

  // Sidebar quotes (stock batch — used by analysis, ticker, watchlist)
  const [quotes, setQuotes] = useState<Record<string, Quote>>(() => loadWlCache() || {})
  const [loadingQuotes, setLoadingQuotes] = useState(() => !loadWlCache())
  const [marketStatus, setMarketStatus] = useState<MarketStatus | null>(null)
  // Track symbols that came back from the API (to distinguish "not returned" from "loading")
  const watchlistFetchedRef = useRef<Set<string>>(new Set())
  const watchlistFetchStartRef = useRef<number>(0)

  // Watchlist
  const [watchlist, setWatchlist] = useState<string[]>(DEFAULT_WATCHLIST)
  const [watchlistSyncing, setWatchlistSyncing] = useState(false)

  // Calendar
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([])
  const [loadingCalendar, setLoadingCalendar] = useState(true)

  // News
  const [newsArticles, setNewsArticles] = useState<NewsArticle[]>([])
  const [loadingNews, setLoadingNews] = useState(true)
  const [newsError, setNewsError] = useState<string | null>(null)
  const [newsSymbolFilter, setNewsSymbolFilter] = useState('')
  const [newsArticleCount, setNewsArticleCount] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      try { return Number(localStorage.getItem('cg_news_count')) || 25 } catch {}
    }
    return 10
  })

  // Crypto prices (CoinGecko)
  const [cryptoCoins, setCryptoCoins] = useState<CryptoCoin[]>([])
  const [cryptoExpanded, setCryptoExpanded] = useState(false)

  // Stock detail modal
  const [selectedStock, setSelectedStock] = useState<{ symbol: string; name: string } | null>(null)
  const [stockQuote, setStockQuote] = useState<Quote | null>(null)
  const [stockProfile, setStockProfile] = useState<CompanyProfile | null>(null)
  const [loadingStockQuote, setLoadingStockQuote] = useState(false)
  const [loadingStockProfile, setLoadingStockProfile] = useState(false)

  // Alerts tab visibility (for right column)
  const [showAlerts, setShowAlerts] = useState(false)

  // Active nav tab
  const [activeNav, setActiveNav] = useState('Markets')

  // Mobile sidebar open/close
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  // Track if we already did the initial backend watchlist sync for this session
  const didSyncWatchlist = useRef(false)

  // ── Clock ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString('en-US', {
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
    }))
    tick()
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [])

  // ── Offline ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const off = () => setIsOffline(true)
    const on  = () => setIsOffline(false)
    window.addEventListener('offline', off)
    window.addEventListener('online', on)
    setIsOffline(!navigator.onLine)
    return () => { window.removeEventListener('offline', off); window.removeEventListener('online', on) }
  }, [])

  // ── Persist: watchlist (localStorage) ─────────────────────────────────────
  useEffect(() => {
    try {
      const s = localStorage.getItem('cg_wl')
      if (s) {
        const parsed = JSON.parse(s)
        // Use defaults if stored list is empty (e.g. user cleared it)
        setWatchlist(Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_WATCHLIST)
      }
      // else: keep DEFAULT_WATCHLIST from useState initializer
    } catch {}
  }, [])

  useEffect(() => {
    try { localStorage.setItem('cg_wl', JSON.stringify(watchlist)) } catch {}
  }, [watchlist])

  // ── Backend watchlist sync on login ────────────────────────────────────────
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

  // ── Persist: custom ticker ─────────────────────────────────────────────────
  useEffect(() => {
    try { const s = localStorage.getItem('cg_ticker'); if (s) setCustomTickerSymbols(JSON.parse(s)) } catch {}
  }, [])
  useEffect(() => {
    try { localStorage.setItem('cg_ticker', JSON.stringify(customTickerSymbols)) } catch {}
  }, [customTickerSymbols])

  // ── Persist: ticker prefs (hidden symbols) ────────────────────────────────
  useEffect(() => {
    try {
      const s = localStorage.getItem('cg_ticker_prefs')
      if (s) setTickerHiddenSymbols(new Set(JSON.parse(s)))
    } catch {}
  }, [])
  useEffect(() => {
    try { localStorage.setItem('cg_ticker_prefs', JSON.stringify([...tickerHiddenSymbols])) } catch {}
  }, [tickerHiddenSymbols])

  // ── Persist: ticker size ───────────────────────────────────────────────────
  useEffect(() => {
    try { localStorage.setItem('cg_ticker_size', tickerSize) } catch {}
  }, [tickerSize])

  // ── Sync ticker size from other panels (SettingsPanel) ────────────────────
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === 'cg_ticker_size' && e.newValue) {
        setTickerSize(e.newValue as 'compact' | 'normal' | 'large')
      }
    }
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, [])

  // ── Persist: news count preference ───────────────────────────────────────
  useEffect(() => {
    try { localStorage.setItem('cg_news_count', String(newsArticleCount)) } catch {}
  }, [newsArticleCount])

  // ── Persist: column widths ────────────────────────────────────────────────
  useEffect(() => {
    try {
      const s = localStorage.getItem('cg_col_widths')
      if (s) setColWidths(JSON.parse(s))
    } catch {}
  }, [])
  useEffect(() => {
    try { localStorage.setItem('cg_col_widths', JSON.stringify(colWidths)) } catch {}
  }, [colWidths])

  // ── Fetch ticker quotes ────────────────────────────────────────────────────
  const fetchTickerQuotes = useCallback(async (extra: string[] = []) => {
    if (isOffline) return
    try {
      // Exclude crypto/metals from the batch call (Finnhub doesn't support them well)
      const cryptoSymbols = new Set(['BTC-USD', 'ETH-USD', 'GC=F', 'CL=F'])
      const all = [...new Set([...TICKER_SYMBOLS, ...extra])]
      const stockSymbols = all.filter(s => !cryptoSymbols.has(s))

      const j = await apiFetchSafe<{ success: boolean; data: Record<string, Quote> }>(`${API_BASE}/api/market-data/batch?symbols=${stockSymbols.join(',')}`)
      if (j?.success && j.data) {
        const merged = { ...j.data }

        // Fetch real crypto prices from the crypto endpoint
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

  useEffect(() => {
    fetchTickerQuotes(customTickerSymbols)
  }, [customTickerSymbols, fetchTickerQuotes])

  // ── Fetch watchlist quotes (batch, with cache) ─────────────────────────────
  const fetchQuotes = useCallback(async (symbols?: string[]) => {
    if (isOffline) return

    // Always include SIDEBAR_SYMBOLS for the analysis widgets + whatever is in the watchlist
    const toFetch = symbols
      ? [...new Set([...SIDEBAR_SYMBOLS, ...symbols])]
      : SIDEBAR_SYMBOLS

    // Record start time (for timeout-aware skeleton display)
    watchlistFetchStartRef.current = Date.now()

    // Mark all symbols as pending
    watchlistFetchedRef.current = new Set()

    try {
      // One batch call — split into chunks of 50 if needed
      const chunks: string[][] = []
      for (let i = 0; i < toFetch.length; i += 50) {
        chunks.push(toFetch.slice(i, i + 50))
      }

      const allData: Record<string, Quote> = {}
      await Promise.all(
        chunks.map(async chunk => {
          const j = await apiFetchSafe<{ success: boolean; data: Record<string, Quote> }>(
            `${API_BASE}/api/market-data/batch?symbols=${chunk.join(',')}`
          )
          if (j?.success && j.data) {
            Object.assign(allData, j.data)
            // Track which symbols came back
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
      // Mark all requested symbols as "fetched" (even if no data returned — they get "—")
      toFetch.forEach(s => watchlistFetchedRef.current.add(s))
    }
  }, [isOffline])

  // ── Fetch market status ────────────────────────────────────────────────────
  const fetchStatus = useCallback(async () => {
    if (isOffline) return
    const j = await apiFetchSafe<{ success: boolean; data: MarketStatus }>(`${API_BASE}/api/market-data/status?exchange=US`)
    if (j?.success) setMarketStatus(j.data)
  }, [isOffline])

  // ── Fetch crypto prices ────────────────────────────────────────────────────
  const fetchCryptoPrices = useCallback(async () => {
    if (isOffline) return
    const j = await apiFetchSafe<{ success: boolean; data: CryptoCoin[] }>(`${API_BASE}/api/crypto/prices?limit=10`)
    if (j?.success && j.data) setCryptoCoins(j.data)
  }, [isOffline])

  // ── Fetch economic calendar — dashboard widget (today + tomorrow) ─────────
  // Shows: all speeches + high-impact events + major-cap earnings only
  // Full calendar page (/calendar) shows everything without filtering.
  const fetchCalendar = useCallback(async () => {
    if (isOffline) return
    setLoadingCalendar(true)
    try {
      // Fetch all events for next 2 days (speeches can be Medium impact, so use minImpact=1)
      const j = await apiFetchSafe<{ success: boolean; data?: CalendarEvent[]; events?: CalendarEvent[] }>(
        `${API_BASE}/api/calendar/upcoming?days=2&minImpact=1`
      )
      const raw = j?.success ? (j.data ?? j.events ?? []) : []
      if (raw.length > 0) {
        // Client-side filter: speeches (all), high-impact economic, major-cap earnings only
        const filtered = raw.filter(e => {
          if (e.type === 'speech') return true
          if (e.type === 'earnings') {
            // Only show major-cap earnings
            const sym = (e.symbol || e.title?.split(' ')[0] || '').toUpperCase()
            return MAJOR_CAP_SYMBOLS.has(sym)
          }
          // Economic events: only High impact
          const imp = e.impact
          return imp === 'High' || imp === 3
        })
        setCalendarEvents(filtered)
      } else {
        // Fallback: today's events
        const j2 = await apiFetchSafe<{ success: boolean; data?: CalendarEvent[]; events?: CalendarEvent[] }>(
          `${API_BASE}/api/calendar/today`
        )
        const raw2 = j2?.success ? (j2.data ?? j2.events ?? []) : []
        setCalendarEvents(raw2)
      }
    } finally {
      setLoadingCalendar(false)
    }
  }, [isOffline])

  // ── Fetch news ─────────────────────────────────────────────────────────────
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
        // API responded but reported an error — show clean empty state
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

  // ── Initial load ───────────────────────────────────────────────────────────
  useEffect(() => {
    const stockSyms = stockSymbolsFromWatchlist(DEFAULT_WATCHLIST)
    fetchTickerQuotes(customTickerSymbols)
    fetchQuotes(stockSyms)
    fetchStatus()
    fetchCalendar()
    fetchNews('All')
    fetchCryptoPrices()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Auto-refresh every 30s ─────────────────────────────────────────────────
  useEffect(() => {
    const t = setInterval(() => fetchTickerQuotes(customTickerSymbols), 30_000)
    return () => clearInterval(t)
  }, [fetchTickerQuotes, customTickerSymbols])

  useEffect(() => {
    const t = setInterval(() => fetchQuotes(stockSymbolsFromWatchlist(watchlist)), 30_000)
    return () => clearInterval(t)
  }, [fetchQuotes, watchlist])

  // ── Re-fetch when watchlist gains new stock symbols ────────────────────────
  const prevWatchlistRef = useRef<string[]>(DEFAULT_WATCHLIST)
  useEffect(() => {
    const prev = prevWatchlistRef.current
    const added = watchlist.filter(s => !prev.includes(s) && !CRYPTO_SYMBOL_MAP[s.toUpperCase()])
    prevWatchlistRef.current = watchlist
    if (added.length > 0) {
      // Fetch just the new symbols (merged into existing quotes state)
      fetchQuotes(stockSymbolsFromWatchlist(watchlist))
    }
  }, [watchlist, fetchQuotes])

  // ── News category change ───────────────────────────────────────────────────
  const handleNewsCategory = useCallback((cat: string) => {
    setNewsCategory(cat)
    setNewsSymbolFilter('')
    fetchNews(cat)
  }, [fetchNews])

  // ── News symbol filter debounce ────────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => {
      if (newsSymbolFilter.trim()) fetchNews(newsCategory, newsSymbolFilter)
      else fetchNews(newsCategory)
    }, 400)
    return () => clearTimeout(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newsSymbolFilter])

  // ── Open stock detail modal ────────────────────────────────────────────────
  const openStockDetail = useCallback(async (symbol: string, name?: string) => {
    const resolvedName = name || symbolName(symbol)
    setSelectedStock({ symbol, name: resolvedName })
    setStockQuote(null)
    setStockProfile(null)
    setLoadingStockQuote(true)
    setLoadingStockProfile(true)

    // Fetch quote
    try {
      const cached = tickerQuotes[symbol] || quotes[symbol]
      if (cached) {
        setStockQuote(cached)
        setLoadingStockQuote(false)
      } else {
        let fetched = false
        // Try batch endpoint first
        const bj = await apiFetchSafe<{ success: boolean; data: Record<string, Quote> }>(`${API_BASE}/api/market-data/batch?symbols=${encodeURIComponent(symbol)}`)
        if (bj?.success && bj.data?.[symbol]) {
          setStockQuote(bj.data[symbol])
          fetched = true
        }

        // Fallback to individual quote endpoint (works for ANY symbol)
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

    // Fetch company profile in parallel
    try {
      const pj = await apiFetchSafe<{ success: boolean; data: CompanyProfile }>(`${API_BASE}/api/market-data/profile/${encodeURIComponent(symbol)}`)
      if (pj?.success && pj.data) setStockProfile(pj.data)
    } finally {
      setLoadingStockProfile(false)
    }
  }, [tickerQuotes, quotes])

  const closeStockDetail = () => {
    setSelectedStock(null)
    setStockQuote(null)
    setStockProfile(null)
  }

  // ── Get best price for watchlist symbol (stock + crypto) ─────────────────
  const getWatchlistQuote = useCallback((sym: string) => {
    // Direct stock quote
    if (quotes[sym]) return quotes[sym]
    if (tickerQuotes[sym]) return tickerQuotes[sym]
    // Crypto: try sym + '-USD'
    if (tickerQuotes[sym + '-USD']) return tickerQuotes[sym + '-USD']
    // Crypto from coins list
    const cryptoSym = CRYPTO_SYMBOL_MAP[sym.toUpperCase()]
    if (cryptoSym) {
      const coin = cryptoCoins.find(c => c.symbol.toUpperCase() === cryptoSym)
      if (coin) {
        return {
          symbol: sym,
          current: coin.price,
          change: coin.price * coin.change24h / 100,
          changePct: coin.change24h,
          high: coin.price * 1.02,
          low: coin.price * 0.98,
          open: coin.price,
          prevClose: coin.price,
          timestamp: new Date().toISOString(),
          source: 'finnhub' as const,
        }
      }
    }
    return null
  }, [quotes, tickerQuotes, cryptoCoins])

  // ── Keyboard shortcut handlers ─────────────────────────────────────────────
  const handleKbFocusSearch = useCallback(() => {
    const el = document.querySelector<HTMLInputElement>('.symbol-search')
    el?.focus()
    el?.select()
  }, [])

  const handleKbEscape = useCallback(() => {
    if (selectedStock) { closeStockDetail(); return }
    if (authModalOpen) { setAuthModalOpen(false); return }
    if (settingsOpen)  { closeSettings(); return }
  }, [selectedStock, authModalOpen, settingsOpen, closeSettings])

  const handleKbGoToHome = useCallback(() => {
    setNewsCategory('All')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  const handleKbGoToAlerts = useCallback(() => {
    setShowAlerts(true)
  }, [])

  // ── Add to ticker ──────────────────────────────────────────────────────────
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

  // ── Watchlist toggle ───────────────────────────────────────────────────────
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

  // ── Ticker symbol visibility toggle ───────────────────────────────────────
  const toggleTickerSymbol = useCallback((sym: string) => {
    setTickerHiddenSymbols(prev => {
      const next = new Set(prev)
      if (next.has(sym)) next.delete(sym)
      else next.add(sym)
      return next
    })
  }, [])

  // ── Column resize drag handler ─────────────────────────────────────────────
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

      // Normalize so they sum to 100
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

  // ── Derived ────────────────────────────────────────────────────────────────
  const quoteList   = Object.values(quotes)
  const gainers     = [...quoteList].sort((a, b) => b.changePct - a.changePct).slice(0, 4)
  const losers      = [...quoteList].sort((a, b) => a.changePct - b.changePct).slice(0, 4)
  const hasRealTickerData = Object.values(tickerQuotes).some(q => q.source === 'finnhub')

  return (
    <>
      {/* ── Keyboard Shortcuts ────────────────────────────────────────────── */}
      <KeyboardShortcuts
        onFocusSearch={handleKbFocusSearch}
        onEscape={handleKbEscape}
        onGoToHome={handleKbGoToHome}
        onGoToAlerts={handleKbGoToAlerts}
        onOpenSettings={openSettings}
      />

      {/* ── High-urgency Alert Banner ──────────────────────────────────────── */}
      <AlertBanner
        alerts={marketAlerts}
        flashActive={alertFlash}
        onDismiss={dismissAlert}
      />

      {/* ── Ticker Bar ─────────────────────────────────────────────────────── */}
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

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="site-header">
        <div className="header-left">
          {/* Mobile hamburger — opens watchlist sidebar */}
          <button
            className="mobile-hamburger"
            onClick={() => setMobileNavOpen(o => !o)}
            aria-label="Open navigation menu"
          >
            <span /><span /><span />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo-header.svg"
            alt="TradVue"
            className="header-logo-img"
          />
          <span className="logo-badge">BETA</span>
          <span className="header-motto">AI DRIVEN ALPHA</span>
        </div>

        {/* Navigation — persistent across the app */}
        <nav className="header-nav">
          <button className={`nav-item${activeNav === 'Markets' ? ' active' : ''}`} onClick={() => {
            setActiveNav('Markets')
            setShowAlerts(false)
            window.scrollTo({ top: 0, behavior: 'smooth' })
          }}>Dashboard</button>
          <a href="/news" className={`nav-item${activeNav === 'News' ? ' active' : ''}`} style={{ textDecoration: 'none' }}>News</a>
          <button className={`nav-item${activeNav === 'Analysis' ? ' active' : ''}`} onClick={() => {
            setActiveNav('Analysis')
            setShowAlerts(false)
          }}>Analysis</button>
          <a href="/calendar" className={`nav-item${activeNav === 'Calendar' ? ' active' : ''}`} style={{ textDecoration: 'none' }}>Calendar</a>
          <a href="/portfolio" className={`nav-item${activeNav === 'Portfolio' ? ' active' : ''}`} style={{ textDecoration: 'none' }}>Portfolio</a>
          <a href="/tools" className={`nav-item${activeNav === 'Tools' ? ' active' : ''}`} style={{ textDecoration: 'none' }}>Tools</a>
          <a href="/journal" className={`nav-item${activeNav === 'Journal' ? ' active' : ''}`} style={{ textDecoration: 'none' }}>Journal</a>
        </nav>

        <div className="header-right">
          {marketStatus && (
            <span className={`market-status ${marketStatus.isOpen ? 'market-open' : 'market-closed'}`}>
              <span className={`status-dot ${marketStatus.isOpen ? 'dot-open' : 'dot-closed'}`} />
              {marketStatus.isOpen ? 'OPEN' : 'CLOSED'}
            </span>
          )}
          {!marketStatus && (
            <span className="market-status market-closed">
              <span className="status-dot dot-closed" />
              US EQUITIES
            </span>
          )}
          <span className="live-time">{clock}</span>

          <OnboardingTooltip
            id="settings-gear"
            content="Customize your ticker bar and notification preferences here"
            position="bottom"
            delayMs={5000}
          >
            <button
              className="settings-gear-btn"
              onClick={openSettings}
              aria-label="Settings"
              title="Settings"
            >
              ⚙
            </button>
          </OnboardingTooltip>

          {user ? (
            <span
              className="header-user-email"
              title={user.email}
              onClick={() => markChecklistItem('completeProfile')}
            >
              {user.email}
            </span>
          ) : (
            <OnboardingTooltip
              id="sign-in-btn"
              content="Sign in to sync your watchlist across devices"
              position="bottom"
              delayMs={6000}
            >
              <button className="login-btn" onClick={() => setAuthModalOpen(true)}>
                Sign In
              </button>
            </OnboardingTooltip>
          )}

          <button className="pro-btn">PRO</button>
        </div>
      </header>

      {/* ── Mobile Nav Drawer ──────────────────────────────────────────────── */}
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
          <button onClick={() => setMobileNavOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-2)', fontSize: 18, cursor: 'pointer', padding: '4px 8px' }}>✕</button>
        </div>
        {[
          { label: 'Dashboard', href: '/' },
          { label: 'News', href: '/news' },
          { label: 'Calendar', href: '/calendar' },
          { label: 'Portfolio', href: '/portfolio' },
          { label: 'Journal', href: '/journal' },
          { label: 'Tools', href: '/tools' },
          { label: 'Help', href: '/help' },
        ].map(item => (
          <a key={item.label} href={item.href} onClick={() => setMobileNavOpen(false)}
            style={{ padding: '12px 20px', fontSize: 14, fontWeight: 500, color: 'var(--text-1)', textDecoration: 'none', borderBottom: '1px solid var(--border)' }}
          >{item.label}</a>
        ))}
      </div>

      {/* ── Offline Banner ─────────────────────────────────────────────────── */}
      {isOffline && (
        <div className="offline-banner">⊗ OFFLINE — displaying cached data. Reconnect for live prices.</div>
      )}

      {/* ── Smart Alerts Bar + Daily P&L Ticker ───────────────────────────── */}
      <SmartAlertsBar watchlist={watchlist} />

      {/* ── 3-Column Main Layout ───────────────────────────────────────────── */}
      <div style={{ position: 'relative' }}>
      <div
        className="layout-3col"
        ref={layoutRef}
        style={{ gridTemplateColumns: `${colWidths[0].toFixed(1)}% ${colWidths[1].toFixed(1)}% ${colWidths[2].toFixed(1)}%` }}
      >

        {/* ── Column 1 (LEFT): Watchlist ───────────────────────────────────── */}
        {/* Mobile sidebar overlay backdrop */}
        {mobileSidebarOpen && (
          <div
            className="mobile-sidebar-backdrop"
            onClick={() => setMobileSidebarOpen(false)}
          />
        )}

        <div className={`col-watchlist${mobileSidebarOpen ? ' mobile-sidebar-open' : ''}`}>

          {/* Watchlist header */}
          <div className="watchlist-header">
            <span className="watchlist-header-title">
              ★ WATCHLIST
            </span>
            <div className="watchlist-header-right">
              {token && (
                <span className={`watchlist-sync-badge${watchlistSyncing ? ' syncing' : ''}`}>
                  {watchlistSyncing ? '⟳' : '✓'}
                </span>
              )}
              {!token && watchlist.length > 0 && (
                <button
                  onClick={() => setAuthModalOpen(true)}
                  style={{ fontSize: 9, color: 'var(--accent)', cursor: 'pointer' }}
                >
                  sync ↑
                </button>
              )}
              {/* Mobile close button */}
              <button
                className="mobile-sidebar-close"
                onClick={() => setMobileSidebarOpen(false)}
                aria-label="Close watchlist"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Search + Add to Watchlist */}
          <div style={{ padding: '6px 8px', borderBottom: '1px solid var(--border)' }}>
            <OnboardingTooltip
              id="stock-search"
              content="Search any stock ticker to add to your watchlist"
              position="bottom"
              delayMs={3000}
            >
              <StockSearch onSelect={(sym, name) => {
                // Add to watchlist directly, then open detail
                if (!watchlist.includes(sym)) toggleWatch(sym)
                openStockDetail(sym, name)
              }} />
            </OnboardingTooltip>
          </div>

          {/* Watchlist items */}
          <div className="watchlist-list">
            {watchlist.length === 0 ? (
              <div style={{ padding: '20px 14px', textAlign: 'center', color: 'var(--text-3)', fontSize: 11 }}>
                <div style={{ marginBottom: 8 }}>Your watchlist is empty</div>
                <button
                  style={{ fontSize: 10, color: 'var(--accent)', cursor: 'pointer' }}
                  onClick={() => {
                    const el = document.querySelector<HTMLInputElement>('.symbol-search')
                    el?.focus()
                  }}
                >
                  Search to add a ticker →
                </button>
              </div>
            ) : (
              watchlist.map(sym => {
                const q = getWatchlistQuote(sym)
                const isCrypto = !!CRYPTO_SYMBOL_MAP[sym.toUpperCase()]
                // Determine if we should show skeleton vs dash
                // - skeleton: still loading (< 5s since fetch started) and no data yet
                // - dash: either timed out (>5s) or symbol not in the batch response
                const fetchAge = watchlistFetchStartRef.current
                  ? Date.now() - watchlistFetchStartRef.current
                  : 99999
                const isFetched = watchlistFetchedRef.current.has(sym)
                const showSkeleton = !q && loadingQuotes && fetchAge < 5000 && !isFetched
                const isForex = sym.length === 6 && /^[A-Z]{6}$/.test(sym) && !isCrypto
                return (
                  <div
                    key={sym}
                    className="watchlist-row"
                    onClick={() => openStockDetail(sym)}
                    style={{ position: 'relative' }}
                  >
                    <div className="watchlist-row-left">
                      <span className="watchlist-sym">{sym}</span>
                      {isCrypto && <span className="watchlist-tag-crypto">crypto</span>}
                      {isForex && <span className="watchlist-tag-crypto" style={{ background: 'rgba(99,102,241,0.15)', color: 'var(--purple)' }}>fx</span>}
                    </div>
                    {q ? (
                      <div className="watchlist-row-right">
                        <span className="watchlist-price">
                          {q.current == null ? '—'
                            : q.current >= 1000 ? fmt(q.current, 0)
                            : q.current >= 1 ? fmt(q.current, 2)
                            : fmt(q.current, 4)}
                        </span>
                        <span className={(q.changePct ?? 0) >= 0 ? 'watchlist-chg-up' : 'watchlist-chg-down'}>
                          {q.changePct == null ? '—' : `${q.changePct >= 0 ? '+' : ''}${q.changePct.toFixed(2)}%`}
                        </span>
                      </div>
                    ) : showSkeleton ? (
                      <div className="watchlist-row-right" style={{ gap: 4 }}>
                        <span className="shimmer" style={{ width: 44, height: 11, borderRadius: 3, display: 'inline-block' }} />
                        <span className="shimmer" style={{ width: 36, height: 10, borderRadius: 3, display: 'inline-block' }} />
                      </div>
                    ) : (
                      <div className="watchlist-row-right">
                        <span className="watchlist-price" style={{ color: 'var(--text-3)' }}>—</span>
                        <span style={{ fontSize: 9, color: 'var(--text-3)' }}>n/a</span>
                      </div>
                    )}
                    <button
                      onClick={e => {
                        e.stopPropagation()
                        const q = getWatchlistQuote(sym)
                        const price = q?.current
                        const params = new URLSearchParams({ symbol: sym, asset: 'Stock' })
                        if (price) params.set('price', price.toFixed(2))
                        window.location.href = `/journal?${params.toString()}`
                      }}
                      title={`Log trade for ${sym}`}
                      style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer', color: 'var(--text-3)', padding: '1px 5px', fontSize: 9, fontWeight: 700, marginRight: 2 }}
                    >
                      +LOG
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); toggleWatch(sym) }}
                      className="watchlist-remove-btn"
                      title={`Remove ${sym}`}
                    >
                      ✕
                    </button>
                  </div>
                )
              })
            )}
          </div>

          {/* Custom Ticker tags */}
          {customTickerSymbols.length > 0 && (
            <div className="sidebar-section" style={{ marginTop: 'auto' }}>
              <div className="sidebar-title">📊 MY TICKER BAR</div>
              <div style={{ padding: '4px 8px', display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {customTickerSymbols.map(sym => (
                  <span key={sym} className="ticker-tag">
                    <span style={{ cursor: 'pointer' }} onClick={() => openStockDetail(sym)}>
                      {sym}
                    </span>
                    <button
                      className="ticker-tag-remove"
                      onClick={() => removeFromTicker(sym)}
                      title={`Remove ${sym} from ticker`}
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-3)', padding: '2px 14px 6px', textAlign: 'right' }}>
                {customTickerSymbols.length}/{MAX_TICKER_CUSTOM} slots
              </div>
            </div>
          )}
        </div>

        {/* ── Column 2 (CENTER): News Feed / Analysis ──────────────────────── */}
        <div className="col-news">

          {/* Analysis view */}
          {activeNav === 'Analysis' && (
            <AnalysisView
              gainers={gainers}
              losers={losers}
              newsArticles={newsArticles}
              onOpenStock={sym => openStockDetail(sym)}
            />
          )}

          {/* News toolbar: category + count filters */}
          {!showAlerts && activeNav !== 'Analysis' && (
            <div className="news-toolbar">
              <div className="news-filter-tabs" style={{ borderBottom: 'none', flex: 1, minWidth: 0 }}>
                {NEWS_CATEGORIES.map(cat => (
                  <button
                    key={cat}
                    className={`news-filter-tab${newsCategory === cat ? ' active' : ''}`}
                    onClick={() => handleNewsCategory(cat)}
                  >
                    {cat}
                  </button>
                ))}
              </div>
              <div className="news-count-selector">
                <span className="news-count-label">Show:</span>
                {NEWS_ARTICLE_COUNTS.map(n => (
                  <button
                    key={n}
                    className={`news-count-btn${newsArticleCount === n ? ' active' : ''}`}
                    onClick={() => {
                      setNewsArticleCount(n)
                      fetchNews(newsCategory, newsSymbolFilter, n)
                    }}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Feed header */}
          {!showAlerts && activeNav !== 'Analysis' && (
            <div className="feed-header">
              <span className="feed-title">
                <span className="live-dot" />
                LIVE FEED
              </span>
              <span style={{ fontSize: 10, color: 'var(--text-3)', marginLeft: 8 }}>
                {hasRealTickerData ? '● LIVE' : '○ SIM'}
              </span>
              <span className="feed-count">{newsArticles.length}</span>
              <input
                type="text"
                className="symbol-search news-symbol-filter"
                placeholder="Symbol…"
                value={newsSymbolFilter}
                onChange={e => setNewsSymbolFilter(e.target.value)}
                style={{ width: 90, marginLeft: 4 }}
              />
              <a href="/news" style={{ fontSize: 10, color: 'var(--accent)', marginLeft: 4, whiteSpace: 'nowrap' }}>
                Full page →
              </a>
              <button onClick={() => fetchNews(newsCategory, newsSymbolFilter)} className="refresh-btn">↻</button>
            </div>
          )}

          {/* Column headers */}
          {!showAlerts && activeNav !== 'Analysis' && (
            <div className="feed-col-header" style={{
              display: 'grid',
              gridTemplateColumns: '36px 80px 1fr auto auto',
              gap: '0 8px',
              padding: '4px 14px',
              borderBottom: '1px solid var(--border-b)',
              background: 'var(--bg-0)',
            }}>
              {['AGO', 'SOURCE', 'HEADLINE', '', 'SYMS'].map((h, i) => (
                <span key={i} style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-3)', textAlign: i === 0 ? 'right' : 'left' }}>
                  {h}
                </span>
              ))}
            </div>
          )}

          {/* News list */}
          {!showAlerts && activeNav !== 'Analysis' && (
            <div className="news-list">
              {loadingNews
                ? <NewsSkeletons count={newsArticleCount} />
                : newsError
                  ? (
                    <DataError
                      onRetry={() => fetchNews(newsCategory, newsSymbolFilter)}
                      autoRetryAfter={10}
                      message="News feed is temporarily unavailable. Please try again in a moment."
                    />
                  )
                  : newsArticles.length > 0
                    ? newsArticles.map((a, i) => <NewsRow key={a.id} article={a} index={i} />)
                    : <div className="feed-empty">No articles found{newsSymbolFilter ? ` for "${newsSymbolFilter.toUpperCase()}"` : ''}.</div>
              }
            </div>
          )}
        </div>

        {/* ── Column 3 (RIGHT): Portfolio / Calendar / Alerts ──────────────── */}
        <div className="col-calendar">

          {/* Portfolio Panel — always visible at top, collapsible */}
          <div style={{ borderBottom: '1px solid var(--border)' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '6px 12px',
                background: 'var(--bg-1)',
                cursor: 'pointer',
                userSelect: 'none',
              }}
              onClick={() => setPortfolioCollapsed(c => !c)}
            >
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-2)' }}>📈 PORTFOLIO</span>
              <span style={{ fontSize: 11, color: 'var(--text-2)' }}>{portfolioCollapsed ? '▼ Show' : '▲ Hide'}</span>
            </div>
            {!portfolioCollapsed && (
              <PortfolioPanel quotes={{ ...quotes, ...tickerQuotes }} onOpenStock={openStockDetail} />
            )}
          </div>

          {/* Alerts toggle tab */}
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: 'var(--bg-1)' }}>
            <button
              className={`news-filter-tab${!showAlerts ? ' active' : ''}`}
              style={{ flex: 1, borderRadius: 0 }}
              onClick={() => setShowAlerts(false)}
            >
              📅 Calendar
            </button>
            <button
              className={`news-filter-tab${showAlerts ? ' active' : ''}`}
              style={{ flex: 1, borderRadius: 0 }}
              onClick={() => setShowAlerts(a => !a)}
            >
              🔔 Alerts{alertUnreadCount > 0 && (
                <AlertBadge count={alertUnreadCount} />
              )}
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
            <EconomicCalendar events={calendarEvents} loading={loadingCalendar} />
          )}
        </div>
      </div>

      {/* ── Column resize drag handles ─────────────────────────────────────── */}
      <div
        style={{
          position: 'absolute',
          left: `calc(${colWidths[0].toFixed(1)}% - 3px)`,
          top: 0,
          bottom: 0,
          width: 6,
          cursor: 'col-resize',
          zIndex: 50,
        }}
        onMouseDown={e => handleColDragStart(0, e)}
        title="Drag to resize"
      />
      <div
        style={{
          position: 'absolute',
          left: `calc(${(colWidths[0] + colWidths[1]).toFixed(1)}% - 3px)`,
          top: 0,
          bottom: 0,
          width: 6,
          cursor: 'col-resize',
          zIndex: 50,
        }}
        onMouseDown={e => handleColDragStart(1, e)}
        title="Drag to resize"
      />
      </div>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer className="site-footer">
        <span>
          <strong style={{ color: '#a0a0b0' }}>TradVue</strong> — © 2026 TradVue. All rights reserved.
        </span>
        <span>
          <a href="/help#data-sources" style={{ color: 'var(--text-3)', textDecoration: 'none', fontSize: 11 }}>Data Sources</a>
          <span style={{ margin: '0 6px', color: 'var(--text-3)' }}>·</span>
          <span style={{ color: 'var(--text-3)', fontSize: 11 }}>Not financial advice</span>
        </span>
        <span>
          {isOffline
            ? <span style={{ color: '#ff4560' }}>● OFFLINE</span>
            : <span style={{ color: '#00c06a' }}>● CONNECTED</span>
          }
        </span>
      </footer>

      {/* ── Stock Detail Modal ─────────────────────────────────────────────── */}
      {selectedStock && (
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

      {/* ── Auth Modal ─────────────────────────────────────────────────────── */}
      {authModalOpen && (
        <AuthModal onClose={() => setAuthModalOpen(false)} />
      )}

      {/* ── Settings Panel ─────────────────────────────────────────────────── */}
      {settingsOpen && (
        <SettingsPanel onClose={() => { closeSettings(); showToast('Settings saved', 'success') }} />
      )}
    </>
  )
}
