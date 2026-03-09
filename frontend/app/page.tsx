'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import dynamic from 'next/dynamic'
import { useAuth } from './context/AuthContext'
import { useSettings } from './context/SettingsContext'
import { useOnboarding } from './context/OnboardingContext'
import { useToast } from './context/ToastContext'
import { trackWatchlistAdd, trackWatchlistRemove, trackStockSearch } from './utils/analytics'

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
  impact: number
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

const SIDEBAR_SYMBOLS = ['AAPL', 'GOOGL', 'TSLA', 'MSFT', 'META', 'NVDA', 'AMZN', 'SPY']

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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(price: number, dec = 2) {
  return price.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec })
}

function fmtPct(pct: number) {
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
  try {
    return new Date(dateStr).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
  } catch { return dateStr }
}

function fmtEventDate(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  } catch { return dateStr }
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
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [onClose])

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  const isUp = quote ? quote.changePct >= 0 : true

  return (
    <>
      <div className="modal-backdrop" onClick={onClose} />
      <div className="stock-modal" role="dialog" aria-modal="true" aria-label={`${symbol} detail`}>
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
}: {
  hiddenSymbols: Set<string>
  onToggle: (sym: string) => void
  onClose: () => void
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
      <div style={{ padding: '4px 12px 8px', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-3)', borderBottom: '1px solid var(--border)', marginBottom: 4 }}>
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
}: {
  tickerQuotes: Record<string, Quote>
  customSymbols: string[]
  isLoading: boolean
  hiddenSymbols?: Set<string>
  onOpenSettings?: () => void
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
    <div className="ticker-bar" style={{ position: 'relative' }}>
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
              {item.price < 10 ? fmt(item.price, 4) : item.price < 1000 ? fmt(item.price, 2) : fmt(item.price, 0)}
            </span>
            <span className={item.change >= 0 ? 'ticker-up' : 'ticker-down'}>
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
  const sentimentLabel = sentimentScore > 60 ? '📈 Bullish' : sentimentScore < 40 ? '📉 Bearish' : '➡ Neutral'
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
            <div className="sidebar-title">🔴 HIGH IMPACT NEWS</div>
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
  const isUp = quote.changePct >= 0
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

  const filtered = events.filter(e => {
    const matchImpact = impactFilter === 'All'
      || (impactFilter === 'High' && e.impact === 3)
      || (impactFilter === 'Medium' && e.impact === 2)
      || (impactFilter === 'Low' && e.impact === 1)
    const matchCurrency = currencyFilter === 'All' || e.currency === currencyFilter
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

  const impactColor = (impact: number) => {
    if (impact === 3) return 'ecal-impact-high'
    if (impact === 2) return 'ecal-impact-medium'
    return 'ecal-impact-low'
  }

  const getEventTime = (e: CalendarEvent) => fmtEventTime(e.datetime || e.date || '')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
      {/* Header */}
      <div className="ecal-header">
        <span className="ecal-title">
          <span style={{ color: 'var(--yellow)' }}>◈</span>
          ECONOMIC CALENDAR
        </span>

        {/* Impact filter */}
        <div style={{ display: 'flex', gap: 3, marginLeft: 4 }}>
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
              {dayEvents.map(ev => (
                <div key={ev.id} className="ecal-event">
                  <span className="ecal-time">{getEventTime(ev)}</span>
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    <span className={`ecal-impact-dot ${impactColor(ev.impact)}`} />
                  </div>
                  <span className="ecal-currency">{ev.currency}</span>
                  <div className="ecal-body">
                    <span className="ecal-event-name">{ev.title}</span>
                    {(ev.actual || ev.forecast || ev.previous) && (
                      <div className="ecal-values">
                        {ev.actual && <span className="ecal-actual">A: {ev.actual}</span>}
                        {ev.forecast && <span className="ecal-forecast">F: {ev.forecast}</span>}
                        {ev.previous && <span className="ecal-previous">P: {ev.previous}</span>}
                      </div>
                    )}
                  </div>
                </div>
              ))}
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
        const res = await fetch(`${API_BASE}/api/market-data/batch?symbols=${tickers}`)
        if (res.ok) {
          const j = await res.json()
          if (j.success && j.data) setLiveQuotes(j.data)
        }
      } catch (err) {
        console.warn('[PortfolioPanel] fetch failed:', err)
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

  // Column widths (resizable)
  const [colWidths, setColWidths] = useState<[number, number, number]>([32, 36, 32])
  const layoutRef = useRef<HTMLDivElement>(null)

  // Portfolio collapsed
  const [portfolioCollapsed, setPortfolioCollapsed] = useState(false)

  // Sidebar quotes
  const [quotes, setQuotes] = useState<Record<string, Quote>>({})
  const [loadingQuotes, setLoadingQuotes] = useState(true)
  const [marketStatus, setMarketStatus] = useState<MarketStatus | null>(null)

  // Watchlist
  const [watchlist, setWatchlist] = useState<string[]>([])
  const [watchlistSyncing, setWatchlistSyncing] = useState(false)

  // Calendar
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([])
  const [loadingCalendar, setLoadingCalendar] = useState(true)

  // News
  const [newsArticles, setNewsArticles] = useState<NewsArticle[]>([])
  const [loadingNews, setLoadingNews] = useState(true)
  const [newsError, setNewsError] = useState<string | null>(null)
  const [newsSymbolFilter, setNewsSymbolFilter] = useState('')

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
    try { const s = localStorage.getItem('cg_wl'); if (s) setWatchlist(JSON.parse(s)) } catch {}
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

      const res = await fetch(`${API_BASE}/api/market-data/batch?symbols=${stockSymbols.join(',')}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const j = await res.json()
      if (j.success && j.data) {
        const merged = { ...j.data }

        // Fetch real crypto prices from the crypto endpoint
        try {
          const cryptoRes = await fetch(`${API_BASE}/api/crypto/prices?limit=20`)
          if (cryptoRes.ok) {
            const cj = await cryptoRes.json()
            if (cj.success && cj.data) {
              const btc = cj.data.find((c: { symbol: string }) => c.symbol === 'BTC')
              const eth = cj.data.find((c: { symbol: string }) => c.symbol === 'ETH')
              if (btc) merged['BTC-USD'] = { symbol: 'BTC-USD', current: btc.price, change: btc.price * btc.change24h / 100, changePct: btc.change24h, high: btc.price * 1.02, low: btc.price * 0.98, open: btc.price, prevClose: btc.price, timestamp: new Date().toISOString(), source: 'finnhub' as const }
              if (eth) merged['ETH-USD'] = { symbol: 'ETH-USD', current: eth.price, change: eth.price * eth.change24h / 100, changePct: eth.change24h, high: eth.price * 1.02, low: eth.price * 0.98, open: eth.price, prevClose: eth.price, timestamp: new Date().toISOString(), source: 'finnhub' as const }
            }
          }
        } catch (cryptoErr) {
          console.warn('[TickerBar] crypto prices fetch failed:', cryptoErr)
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

  // ── Fetch sidebar quotes ───────────────────────────────────────────────────
  const fetchQuotes = useCallback(async () => {
    if (isOffline) return
    try {
      const res = await fetch(`${API_BASE}/api/market-data/batch?symbols=${SIDEBAR_SYMBOLS.join(',')}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const j = await res.json()
      if (j.success && j.data) setQuotes(j.data)
    } catch (err) {
      console.warn('[MarketQuotes] fetch failed:', err)
    } finally {
      setLoadingQuotes(false)
    }
  }, [isOffline])

  // ── Fetch market status ────────────────────────────────────────────────────
  const fetchStatus = useCallback(async () => {
    if (isOffline) return
    try {
      const res = await fetch(`${API_BASE}/api/market-data/status?exchange=US`)
      if (!res.ok) return
      const j = await res.json()
      if (j.success) setMarketStatus(j.data)
    } catch {}
  }, [isOffline])

  // ── Fetch crypto prices ────────────────────────────────────────────────────
  const fetchCryptoPrices = useCallback(async () => {
    if (isOffline) return
    try {
      const res = await fetch(`${API_BASE}/api/crypto/prices?limit=10`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const j = await res.json()
      if (j.success && j.data) setCryptoCoins(j.data)
    } catch (err) {
      console.warn('[Crypto] fetch failed:', err)
    }
  }, [isOffline])

  // ── Fetch economic calendar (upcoming week) ────────────────────────────────
  const fetchCalendar = useCallback(async () => {
    if (isOffline) return
    setLoadingCalendar(true)
    try {
      // Try upcoming week first for better coverage
      const res = await fetch(`${API_BASE}/api/calendar/upcoming?days=5&minImpact=1`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const j = await res.json()
      if (j.success && j.data) {
        setCalendarEvents(j.data)
      } else {
        // Fallback to today
        const res2 = await fetch(`${API_BASE}/api/calendar/today`)
        const j2 = await res2.json()
        if (j2.success) setCalendarEvents(j2.data || [])
      }
    } catch (err) {
      console.warn('[Calendar] fetch failed:', err)
    } finally {
      setLoadingCalendar(false)
    }
  }, [isOffline])

  // ── Fetch news ─────────────────────────────────────────────────────────────
  const fetchNews = useCallback(async (cat: string, sym?: string) => {
    if (isOffline) { setLoadingNews(false); return }
    setLoadingNews(true)
    setNewsError(null)
    try {
      let url: string
      if (sym?.trim()) {
        url = `${API_BASE}/api/feed/news/symbol/${encodeURIComponent(sym.trim().toUpperCase())}?limit=40`
      } else {
        const apiCat = NEWS_CAT_MAP[cat] || 'all'
        const p = new URLSearchParams({ limit: '40' })
        if (apiCat !== 'all') p.set('category', apiCat)
        url = `${API_BASE}/api/feed/news?${p.toString()}`
      }
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const j = await res.json()
      if (j.success) setNewsArticles(j.data || [])
      else throw new Error(j.error || 'API error')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      setNewsError(msg)
      setNewsArticles([])
      showToast(`Failed to load feed: ${msg}`, 'error')
    } finally {
      setLoadingNews(false)
    }
  // showToast is stable, no need in deps
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOffline])

  // ── Initial load ───────────────────────────────────────────────────────────
  useEffect(() => {
    fetchTickerQuotes(customTickerSymbols)
    fetchQuotes()
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
    const t = setInterval(fetchQuotes, 30_000)
    return () => clearInterval(t)
  }, [fetchQuotes])

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
        try {
          const res = await fetch(`${API_BASE}/api/market-data/batch?symbols=${encodeURIComponent(symbol)}`)
          if (res.ok) {
            const j = await res.json()
            if (j.success && j.data && j.data[symbol]) {
              setStockQuote(j.data[symbol])
              fetched = true
            }
          }
        } catch {}

        // Fallback to individual quote endpoint (works for ANY symbol)
        if (!fetched) {
          try {
            const res2 = await fetch(`${API_BASE}/api/market-data/quote?symbol=${encodeURIComponent(symbol)}`)
            if (res2.ok) {
              const j2 = await res2.json()
              if (j2.success && j2.data) setStockQuote(j2.data)
            }
          } catch {}
        }

        setLoadingStockQuote(false)
      }
    } catch (err) {
      console.warn('[StockDetail] quote fetch failed:', err)
      setLoadingStockQuote(false)
    }

    // Fetch company profile in parallel
    try {
      const res = await fetch(`${API_BASE}/api/market-data/profile/${encodeURIComponent(symbol)}`)
      if (res.ok) {
        const j = await res.json()
        if (j.success && j.data) setStockProfile(j.data)
      }
    } catch (err) {
      console.warn('[StockDetail] profile fetch failed:', err)
    } finally {
      setLoadingStockProfile(false)
    }
  }, [tickerQuotes, quotes])

  const closeStockDetail = () => {
    setSelectedStock(null)
    setStockQuote(null)
    setStockProfile(null)
  }

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
      <div style={{ position: 'relative' }}>
        <TickerBar
          tickerQuotes={tickerQuotes}
          customSymbols={customTickerSymbols}
          isLoading={tickerLoading}
          hiddenSymbols={tickerHiddenSymbols}
          onOpenSettings={() => setTickerSettingsOpen(s => !s)}
        />
        {tickerSettingsOpen && (
          <div style={{ position: 'absolute', right: 8, top: '100%', zIndex: 200 }}>
            <TickerSettingsDropdown
              hiddenSymbols={tickerHiddenSymbols}
              onToggle={toggleTickerSymbol}
              onClose={() => setTickerSettingsOpen(false)}
            />
          </div>
        )}
      </div>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="site-header">
        <div className="header-left">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo-horizontal.png"
            alt="ChartGenius"
            className="header-logo-img"
            style={{ height: '36px', width: 'auto', objectFit: 'contain' }}
          />
          <span className="logo-badge">BETA</span>
        </div>

        {/* Navigation — wired to actions */}
        <nav className="header-nav">
          <button className={`nav-item${activeNav === 'Markets' ? ' active' : ''}`} onClick={() => {
            setActiveNav('Markets')
            setShowAlerts(false)
            window.scrollTo({ top: 0, behavior: 'smooth' })
            document.querySelector('.col-watchlist')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }}>Markets</button>
          <button className={`nav-item${activeNav === 'News' ? ' active' : ''}`} onClick={() => {
            setActiveNav('News')
            setShowAlerts(false)
            handleNewsCategory('All')
            document.querySelector('.col-news')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }}>News</button>
          <button className={`nav-item${activeNav === 'Analysis' ? ' active' : ''}`} onClick={() => {
            setActiveNav('Analysis')
            setShowAlerts(false)
            document.querySelector('.col-news')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }}>Analysis</button>
          <button className={`nav-item${activeNav === 'Calendar' ? ' active' : ''}`} onClick={() => {
            window.open('/calendar', '_blank')
          }}>Calendar</button>
          <a href="/portfolio" className={`nav-item${activeNav === 'Portfolio' ? ' active' : ''}`} style={{ textDecoration: 'none' }}>Portfolio</a>
          <a href="/tools" className={`nav-item${activeNav === 'Tools' ? ' active' : ''}`} style={{ textDecoration: 'none' }}>Tools</a>
          <a href="/journal" className={`nav-item${activeNav === 'Journal' ? ' active' : ''}`} style={{ textDecoration: 'none' }}>Journal</a>
          <a href="/dashboard" className="nav-item" style={{ textDecoration: 'none', opacity: 0.7 }}>🔒 Ops</a>
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

      {/* ── Offline Banner ─────────────────────────────────────────────────── */}
      {isOffline && (
        <div className="offline-banner">⊗ OFFLINE — displaying cached data. Reconnect for live prices.</div>
      )}

      {/* ── 3-Column Main Layout ───────────────────────────────────────────── */}
      <div style={{ position: 'relative' }}>
      <div
        className="layout-3col"
        ref={layoutRef}
        style={{ gridTemplateColumns: `${colWidths[0].toFixed(1)}% ${colWidths[1].toFixed(1)}% ${colWidths[2].toFixed(1)}%` }}
      >

        {/* ── Column 1 (LEFT): Market Data / Watchlist ─────────────────────── */}
        <div className="col-watchlist">

          {/* Search + Add */}
          <div className="sidebar-section" style={{ padding: '8px 10px' }}>
            <OnboardingTooltip
              id="stock-search"
              content="Search any stock ticker to track it in your watchlist"
              position="bottom"
              delayMs={3000}
            >
              <StockSearch onSelect={(sym, name) => openStockDetail(sym, name)} />
            </OnboardingTooltip>
          </div>

          {/* Market Quotes */}
          <div className="sidebar-section">
            <div className="sidebar-title">MARKET QUOTES</div>
            {loadingQuotes
              ? <SidebarSkeletons count={4} />
              : quoteList.length > 0
                ? quoteList.map(q => (
                  <MoverRow
                    key={q.symbol}
                    quote={q}
                    onWatch={toggleWatch}
                    watched={watchlist.includes(q.symbol)}
                    onClick={sym => openStockDetail(sym)}
                  />
                ))
                : <div className="feed-empty" style={{ fontSize: 11 }}>Backend not responding</div>
            }
          </div>

          {/* Top Gainers */}
          {gainers.length > 0 && (
            <div className="sidebar-section">
              <div className="sidebar-title sidebar-title-gain">▲ TOP GAINERS</div>
              {gainers.map(q => (
                <MoverRow key={q.symbol} quote={q} onClick={sym => openStockDetail(sym)} />
              ))}
            </div>
          )}

          {/* Top Losers */}
          {losers.length > 0 && (
            <div className="sidebar-section">
              <div className="sidebar-title sidebar-title-loss">▼ TOP LOSERS</div>
              {losers.map(q => (
                <MoverRow key={q.symbol} quote={q} onClick={sym => openStockDetail(sym)} />
              ))}
            </div>
          )}

          {/* Crypto Prices */}
          {cryptoCoins.length > 0 && (
            <div className="sidebar-section">
              <div className="sidebar-title" style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => setCryptoExpanded(e => !e)}>
                ₿ CRYPTO PRICES
                <span style={{ marginLeft: 6, fontSize: 9, color: 'var(--text-3)' }}>
                  {cryptoExpanded ? '▲' : '▼'}
                </span>
                <span style={{ marginLeft: 'auto', fontSize: 9, color: 'var(--text-3)', fontWeight: 400 }}>
                  CoinGecko
                </span>
              </div>
              {(cryptoExpanded ? cryptoCoins : cryptoCoins.slice(0, 5)).map(coin => (
                <CryptoCoinRow key={coin.id} coin={coin} />
              ))}
              {!cryptoExpanded && cryptoCoins.length > 5 && (
                <button
                  onClick={() => setCryptoExpanded(true)}
                  style={{ fontSize: 10, color: 'var(--accent)', padding: '4px 14px', cursor: 'pointer', textAlign: 'left', width: '100%' }}
                >
                  + {cryptoCoins.length - 5} more coins
                </button>
              )}
            </div>
          )}

          {/* Watchlist */}
          <div className="sidebar-section">
            <div className="sidebar-title">
              ★ WATCHLIST
              {token && (
                <span className={`watchlist-sync-badge${watchlistSyncing ? ' syncing' : ''}`} style={{ marginLeft: 6 }}>
                  {watchlistSyncing ? '⟳ SYNCING' : '● SYNCED'}
                </span>
              )}
              {!token && watchlist.length > 0 && (
                <button
                  onClick={() => setAuthModalOpen(true)}
                  style={{ marginLeft: 6, fontSize: 9.5, color: 'var(--accent)', textDecoration: 'underline', cursor: 'pointer' }}
                >
                  Sign in to sync
                </button>
              )}
            </div>
            {watchlist.length === 0 ? (
              <WatchlistEmpty
                onAddSymbol={() => {
                  const el = document.querySelector<HTMLInputElement>('.symbol-search')
                  el?.focus()
                }}
                onExample={() => {
                  toggleWatch('AAPL')
                  openStockDetail('AAPL', 'Apple Inc.')
                }}
              />
            ) : (
              watchlist.map(sym => (
                <div
                  key={sym}
                  className="mover-row mover-row-clickable"
                  onClick={() => openStockDetail(sym)}
                >
                  <span className="mover-symbol">{sym}</span>
                  {quotes[sym]
                    ? <>
                        <span className="mover-price">${fmt(quotes[sym].current)}</span>
                        <span className={quotes[sym].changePct >= 0 ? 'mover-up' : 'mover-down'}>
                          {fmtPct(quotes[sym].changePct)}
                        </span>
                      </>
                    : <span className="mover-price" style={{ color: 'var(--text-3)' }}>—</span>
                  }
                  <button
                    onClick={e => { e.stopPropagation(); toggleWatch(sym) }}
                    className="remove-btn"
                    style={{ display: 'block' }}
                  >
                    ✕
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Custom Ticker symbols */}
          {customTickerSymbols.length > 0 && (
            <div className="sidebar-section">
              <div className="sidebar-title">📊 MY TICKER</div>
              <div style={{ padding: '4px 8px', display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {customTickerSymbols.map(sym => (
                  <span key={sym} className="ticker-tag">
                    <span
                      style={{ cursor: 'pointer' }}
                      onClick={() => openStockDetail(sym)}
                    >
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
                {customTickerSymbols.length}/{MAX_TICKER_CUSTOM}
              </div>
            </div>
          )}

          {/* Quick add watchlist */}
          {quoteList.some(q => !watchlist.includes(q.symbol)) && (
            <div className="sidebar-section">
              <div className="sidebar-title">QUICK ADD</div>
              <div style={{ padding: '6px 8px', display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {quoteList.filter(q => !watchlist.includes(q.symbol)).map(q => (
                  <button key={q.symbol} className="watchlist-add-btn" onClick={() => toggleWatch(q.symbol)}>
                    + {q.symbol}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Column 2 (CENTER): News Feed / Analysis ──────────────────────── */}
        <div className="col-news">

          {/* Nav tabs — only show for non-analysis */}
          {activeNav !== 'Analysis' && (
            <div className="news-filter-tabs">
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
          )}

          {/* Analysis view */}
          {activeNav === 'Analysis' && (
            <AnalysisView
              gainers={gainers}
              losers={losers}
              newsArticles={newsArticles}
              onOpenStock={sym => openStockDetail(sym)}
            />
          )}

          {/* Feed header */}
          {!showAlerts && activeNav !== 'Analysis' && (
            <div className="feed-header">
              <span className="feed-title">
                <span className="live-dot" />
                LIVE NEWS FEED
              </span>
              <span style={{ fontSize: 10.5, color: 'var(--text-3)', marginLeft: 12 }}>
                {hasRealTickerData ? '● LIVE DATA' : '○ SIMULATED'}
              </span>
              <span className="feed-count">{newsArticles.length} articles</span>
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
              background: '#0f0f12',
            }}>
              {['AGO', 'SOURCE', 'HEADLINE', '', 'SYMS'].map((h, i) => (
                <span key={i} style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-3)', textAlign: i === 0 ? 'right' : 'left' }}>
                  {h}
                </span>
              ))}
            </div>
          )}

          {/* Symbol filter input */}
          {!showAlerts && activeNav !== 'Analysis' && (
            <div style={{ padding: '4px 8px', background: 'var(--bg-1)', borderBottom: '1px solid var(--border)' }}>
              <input
                type="text"
                className="symbol-search news-symbol-filter"
                placeholder="Filter by symbol (e.g. AAPL)…"
                value={newsSymbolFilter}
                onChange={e => setNewsSymbolFilter(e.target.value)}
                style={{ width: '100%' }}
              />
            </div>
          )}

          {/* News list */}
          {!showAlerts && activeNav !== 'Analysis' && (
            <div className="news-list">
              {loadingNews
                ? <NewsSkeletons count={20} />
                : newsError
                  ? (
                    <div className="feed-empty">
                      <p>⚠ Could not load feed — {newsError}</p>
                      <button onClick={() => fetchNews(newsCategory, newsSymbolFilter)} className="retry-btn">↻ Retry</button>
                    </div>
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
          <strong style={{ color: '#a0a0b0' }}>ChartGenius</strong> — ApexLogics © 2025
        </span>
        <span>Data: Finnhub · CoinGecko · NewsAPI · RSS · Not financial advice</span>
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
