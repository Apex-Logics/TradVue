'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

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

const CATEGORIES = ['All', 'Equities', 'Forex', 'Crypto', 'Commodities', 'Macro', 'Calendar']

const NEWS_CAT_MAP: Record<string, string> = {
  All: 'all',
  Equities: 'stocks',
  Forex: 'forex',
  Crypto: 'crypto',
  Commodities: 'commodities',
  Macro: 'economy',
}

const MAX_TICKER_CUSTOM = 15

// ─── Top 100 symbols for autocomplete ────────────────────────────────────────

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
  { symbol: 'RBLX',  name: 'Roblox Corporation' },
  { symbol: 'SNOW',  name: 'Snowflake Inc.' },
  { symbol: 'DDOG',  name: 'Datadog Inc.' },
  { symbol: 'CRWD',  name: 'CrowdStrike Holdings' },
  { symbol: 'PANW',  name: 'Palo Alto Networks' },
  { symbol: 'ZS',    name: 'Zscaler Inc.' },
  { symbol: 'NET',   name: 'Cloudflare Inc.' },
  { symbol: 'TWLO',  name: 'Twilio Inc.' },
  { symbol: 'UBER',  name: 'Uber Technologies' },
  { symbol: 'LYFT',  name: 'Lyft Inc.' },
  { symbol: 'ABNB',  name: 'Airbnb Inc.' },
  { symbol: 'DASH',  name: 'DoorDash Inc.' },
  { symbol: 'RIVN',  name: 'Rivian Automotive Inc.' },
  { symbol: 'LCID',  name: 'Lucid Group Inc.' },
  { symbol: 'NIO',   name: 'NIO Inc.' },
  { symbol: 'BABA',  name: 'Alibaba Group Holding' },
  { symbol: 'JD',    name: 'JD.com Inc.' },
  { symbol: 'PDD',   name: 'PDD Holdings Inc.' },
  { symbol: 'PATH',  name: 'UiPath Inc.' },
  { symbol: 'U',     name: 'Unity Software Inc.' },
  { symbol: 'SPY',   name: 'SPDR S&P 500 ETF Trust' },
  { symbol: 'QQQ',   name: 'Invesco QQQ Trust' },
  { symbol: 'DIA',   name: 'SPDR Dow Jones ETF' },
  { symbol: 'IWM',   name: 'iShares Russell 2000 ETF' },
  { symbol: 'GLD',   name: 'SPDR Gold Shares ETF' },
  { symbol: 'SLV',   name: 'iShares Silver Trust ETF' },
  { symbol: 'USO',   name: 'United States Oil Fund' },
  { symbol: 'TLT',   name: 'iShares 20+ Yr Treasury ETF' },
  { symbol: 'XLF',   name: 'Financial Select SPDR ETF' },
  { symbol: 'XLE',   name: 'Energy Select SPDR ETF' },
  { symbol: 'XLK',   name: 'Technology Select SPDR ETF' },
  { symbol: 'ARKK',  name: 'ARK Innovation ETF' },
  { symbol: 'VTI',   name: 'Vanguard Total Stock Market ETF' },
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

function symbolName(sym: string): string {
  return TOP_SYMBOLS.find(s => s.symbol === sym)?.name || sym
}

// ─── Stock Search Input ───────────────────────────────────────────────────────

function StockSearch({ onSelect }: { onSelect: (symbol: string, name: string) => void }) {
  const [query, setQuery] = useState('')
  const [open, setOpen]   = useState(false)
  const [active, setActive] = useState(0)
  const wrapRef = useRef<HTMLDivElement>(null)

  const results = query.trim().length >= 1
    ? TOP_SYMBOLS.filter(s =>
        s.symbol.startsWith(query.trim().toUpperCase()) ||
        s.name.toLowerCase().includes(query.trim().toLowerCase())
      ).slice(0, 8)
    : []

  // Close on outside click
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const pick = (sym: string, name: string) => {
    onSelect(sym, name)
    setQuery('')
    setOpen(false)
    setActive(0)
  }

  return (
    <div ref={wrapRef} className="search-wrap">
      <input
        type="text"
        className="symbol-search"
        placeholder="Search stocks…"
        value={query}
        autoComplete="off"
        onChange={e => { setQuery(e.target.value); setOpen(true); setActive(0) }}
        onFocus={() => { if (query) setOpen(true) }}
        onKeyDown={e => {
          if (!open || results.length === 0) return
          if (e.key === 'ArrowDown') { e.preventDefault(); setActive(i => Math.min(i + 1, results.length - 1)) }
          if (e.key === 'ArrowUp')   { e.preventDefault(); setActive(i => Math.max(i - 1, 0)) }
          if (e.key === 'Enter')     { e.preventDefault(); pick(results[active].symbol, results[active].name) }
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

// ─── Stock Detail Modal ───────────────────────────────────────────────────────

function StockDetailModal({
  symbol,
  name,
  quote,
  loading,
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
  loading: boolean
  onClose: () => void
  onAddTicker: () => void
  onAddWatchlist: () => void
  inTicker: boolean
  inWatchlist: boolean
  tickerFull: boolean
}) {
  // Escape key to close
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [onClose])

  // Prevent body scroll while modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  const isUp = quote ? quote.changePct >= 0 : true

  return (
    <>
      <div className="modal-backdrop" onClick={onClose} />
      <div className="stock-modal" role="dialog" aria-modal="true" aria-label={`${symbol} detail`}>
        {/* ── Header ── */}
        <div className="stock-modal-header">
          <div className="stock-modal-title">
            <span className="stock-modal-symbol">{symbol}</span>
            <span className="stock-modal-company">{name || symbolName(symbol)}</span>
          </div>

          <div className="stock-modal-price-block">
            {loading && <span className="stock-modal-loading">Loading…</span>}
            {!loading && quote && (
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
            {!loading && !quote && (
              <span className="stock-modal-loading">No price data</span>
            )}
          </div>

          <button className="modal-close-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {/* ── TradingView Chart ── */}
        <div className="stock-chart-wrap">
          <iframe
            src={`https://s.tradingview.com/widgetembed/?symbol=${encodeURIComponent(symbol)}&interval=D&theme=dark&style=1&locale=en&toolbar_bg=%230f0f12&hide_top_toolbar=0&hide_side_toolbar=1&allow_symbol_change=0&save_image=0&calendar=0&hideideas=1`}
            width="100%"
            height="380"
            frameBorder="0"
            allowTransparency={true}
            scrolling="no"
            title={`${symbol} price chart`}
          />
        </div>

        {/* ── Key Stats ── */}
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

        {/* ── Actions ── */}
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

// ─── Ticker Bar ───────────────────────────────────────────────────────────────

function TickerBar({
  tickerQuotes,
  customSymbols,
  onRemoveCustom,
}: {
  tickerQuotes: Record<string, Quote>
  customSymbols: string[]
  onRemoveCustom: (sym: string) => void
}) {
  const defaultItems = Object.keys(tickerQuotes).length > 0
    ? TICKER_SYMBOLS
        .filter(sym => tickerQuotes[sym])
        .map(sym => {
          const q = tickerQuotes[sym]
          return { symbol: TICKER_DISPLAY[sym] || sym, price: q.current, change: q.changePct, isReal: q.source !== 'mock', raw: sym, isCustom: false }
        })
    : TICKER_FALLBACK.map(t => ({ ...t, isReal: false, raw: t.symbol, isCustom: false }))

  const customItems = customSymbols
    .filter(sym => tickerQuotes[sym])
    .map(sym => {
      const q = tickerQuotes[sym]
      return { symbol: sym, price: q.current, change: q.changePct, isReal: q.source !== 'mock', raw: sym, isCustom: true }
    })

  const items = [...defaultItems, ...customItems]
  const duped = [...items, ...items, ...items]

  return (
    <div className="ticker-bar">
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

// ─── Calendar Row ─────────────────────────────────────────────────────────────

function CalendarRow({ event }: { event: CalendarEvent }) {
  const dots = ['', '●', '●●', '●●●']
  const impactColor = ['', '#606070', '#f0a500', '#ff4560'][event.impact] || '#606070'
  return (
    <div className="cal-row">
      <span className="cal-time">{fmtEventTime(event.date)}</span>
      <span className="cal-impact" style={{ color: impactColor, letterSpacing: -2 }}>
        {dots[event.impact] || '●'}
      </span>
      <span className="cal-currency">{event.currency}</span>
      <span className="cal-title">
        {event.title}
        {(event.actual || event.forecast) && (
          <span style={{ color: '#606070', marginLeft: 8 }}>
            {event.actual && <span style={{ color: '#00c06a' }}>A:{event.actual} </span>}
            {event.forecast && <span>F:{event.forecast} </span>}
            {event.previous && <span>P:{event.previous}</span>}
          </span>
        )}
      </span>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Home() {
  const [clock, setClock] = useState('')
  const [isOffline, setIsOffline] = useState(false)
  const [activeCategory, setActiveCategory] = useState('All')

  // Ticker
  const [tickerQuotes, setTickerQuotes] = useState<Record<string, Quote>>({})
  const [customTickerSymbols, setCustomTickerSymbols] = useState<string[]>([])

  // Sidebar quotes
  const [quotes, setQuotes] = useState<Record<string, Quote>>({})
  const [loadingQuotes, setLoadingQuotes] = useState(true)
  const [marketStatus, setMarketStatus] = useState<MarketStatus | null>(null)

  // Watchlist
  const [watchlist, setWatchlist] = useState<string[]>([])

  // Calendar
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([])

  // News
  const [newsArticles, setNewsArticles] = useState<NewsArticle[]>([])
  const [loadingNews, setLoadingNews] = useState(true)
  const [newsError, setNewsError] = useState<string | null>(null)
  const [newsSymbolFilter, setNewsSymbolFilter] = useState('')

  // Stock detail modal
  const [selectedStock, setSelectedStock] = useState<{ symbol: string; name: string } | null>(null)
  const [stockQuote, setStockQuote] = useState<Quote | null>(null)
  const [loadingStockQuote, setLoadingStockQuote] = useState(false)

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

  // ── Persist: watchlist ─────────────────────────────────────────────────────
  useEffect(() => {
    try { const s = localStorage.getItem('cg_wl'); if (s) setWatchlist(JSON.parse(s)) } catch {}
  }, [])
  useEffect(() => {
    try { localStorage.setItem('cg_wl', JSON.stringify(watchlist)) } catch {}
  }, [watchlist])

  // ── Persist: custom ticker ─────────────────────────────────────────────────
  useEffect(() => {
    try { const s = localStorage.getItem('cg_ticker'); if (s) setCustomTickerSymbols(JSON.parse(s)) } catch {}
  }, [])
  useEffect(() => {
    try { localStorage.setItem('cg_ticker', JSON.stringify(customTickerSymbols)) } catch {}
  }, [customTickerSymbols])

  // ── Fetch ticker quotes (default + custom) ─────────────────────────────────
  const fetchTickerQuotes = useCallback(async (extra: string[] = []) => {
    if (isOffline) return
    try {
      const all = [...new Set([...TICKER_SYMBOLS, ...extra])]
      const res = await fetch(`${API_BASE}/api/market-data/batch?symbols=${all.join(',')}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const j = await res.json()
      if (j.success && j.data) setTickerQuotes(j.data)
    } catch (err) {
      console.warn('[TickerBar] fetch failed:', err)
    }
  }, [isOffline])

  // Re-fetch when custom symbols change
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

  // ── Fetch economic calendar ────────────────────────────────────────────────
  const fetchCalendar = useCallback(async () => {
    if (isOffline) return
    try {
      const res = await fetch(`${API_BASE}/api/calendar/today`)
      if (!res.ok) return
      const j = await res.json()
      if (j.success) setCalendarEvents(j.data.slice(0, 20))
    } catch {}
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
      setNewsError(err instanceof Error ? err.message : 'Unknown error')
      setNewsArticles([])
    } finally {
      setLoadingNews(false)
    }
  }, [isOffline])

  // ── Initial load ───────────────────────────────────────────────────────────
  useEffect(() => {
    fetchTickerQuotes(customTickerSymbols)
    fetchQuotes()
    fetchStatus()
    fetchCalendar()
    fetchNews('All')
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

  // ── Open stock detail modal ────────────────────────────────────────────────
  const openStockDetail = useCallback(async (symbol: string, name?: string) => {
    const resolvedName = name || symbolName(symbol)
    setSelectedStock({ symbol, name: resolvedName })
    setStockQuote(null)
    setLoadingStockQuote(true)
    try {
      // Check if we already have a cached quote
      const cached = tickerQuotes[symbol] || quotes[symbol]
      if (cached) {
        setStockQuote(cached)
        setLoadingStockQuote(false)
        return
      }
      const res = await fetch(`${API_BASE}/api/market-data/batch?symbols=${encodeURIComponent(symbol)}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const j = await res.json()
      if (j.success && j.data && j.data[symbol]) setStockQuote(j.data[symbol])
    } catch (err) {
      console.warn('[StockDetail] quote fetch failed:', err)
    } finally {
      setLoadingStockQuote(false)
    }
  }, [tickerQuotes, quotes])

  const closeStockDetail = () => {
    setSelectedStock(null)
    setStockQuote(null)
  }

  // ── Add to ticker ──────────────────────────────────────────────────────────
  const addToTicker = (symbol: string) => {
    setCustomTickerSymbols(prev => {
      if (prev.includes(symbol) || prev.length >= MAX_TICKER_CUSTOM) return prev
      return [...prev, symbol]
    })
  }

  const removeFromTicker = (symbol: string) => {
    setCustomTickerSymbols(prev => prev.filter(s => s !== symbol))
  }

  // ── Watchlist toggle ───────────────────────────────────────────────────────
  const toggleWatch = (sym: string) => {
    setWatchlist(w => w.includes(sym) ? w.filter(s => s !== sym) : [...w, sym])
  }

  // ── Category change ────────────────────────────────────────────────────────
  const handleCategory = (cat: string) => {
    setActiveCategory(cat)
    if (cat !== 'Calendar') fetchNews(cat)
  }

  // ── News symbol filter debounce ────────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => {
      if (newsSymbolFilter.trim()) fetchNews(activeCategory, newsSymbolFilter)
      else fetchNews(activeCategory)
    }, 400)
    return () => clearTimeout(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newsSymbolFilter])

  // ── Derived ────────────────────────────────────────────────────────────────
  const quoteList   = Object.values(quotes)
  const gainers     = [...quoteList].sort((a, b) => b.changePct - a.changePct).slice(0, 4)
  const losers      = [...quoteList].sort((a, b) => a.changePct - b.changePct).slice(0, 4)
  const showCalendar = activeCategory === 'Calendar'
  const hasRealTickerData = Object.values(tickerQuotes).some(q => q.source === 'finnhub')

  return (
    <>
      {/* ── Ticker Bar ─────────────────────────────────────────────────────── */}
      <TickerBar
        tickerQuotes={tickerQuotes}
        customSymbols={customTickerSymbols}
        onRemoveCustom={removeFromTicker}
      />

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="site-header">
        <div className="header-left">
          <span className="logo">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 12l3-3 3 3 4-4" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 20h18" />
            </svg>
            ChartGenius
          </span>
          <span className="logo-badge">BETA</span>
        </div>

        <nav className="header-nav">
          {['Markets', 'News', 'Analysis', 'Calendar', 'Portfolio'].map(item => (
            <button key={item} className="nav-item">{item}</button>
          ))}
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
          <button className="login-btn">Sign In</button>
          <button className="pro-btn">PRO</button>
        </div>
      </header>

      {/* ── Offline Banner ─────────────────────────────────────────────────── */}
      {isOffline && (
        <div className="offline-banner">⊗ OFFLINE — displaying cached data. Reconnect for live prices.</div>
      )}

      {/* ── Category Tabs ──────────────────────────────────────────────────── */}
      <div className="cat-tabs">
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => handleCategory(cat)}
            className={`cat-tab ${activeCategory === cat ? 'cat-tab-active' : ''}`}
          >
            {cat}
          </button>
        ))}
        <div className="cat-tabs-spacer" />

        {/* News symbol filter (hidden on mobile, replaced by search) */}
        <input
          type="text"
          className="symbol-search news-symbol-filter"
          placeholder="Filter news…"
          value={newsSymbolFilter}
          onChange={e => setNewsSymbolFilter(e.target.value)}
        />

        {/* Stock Search — opens detail modal */}
        <StockSearch onSelect={(sym, name) => openStockDetail(sym, name)} />
      </div>

      {/* ── Main Content ───────────────────────────────────────────────────── */}
      <div className="main-content">

        {/* Left: News/Calendar Feed (70%) */}
        <div className="news-feed">
          {/* Feed header */}
          <div className="feed-header">
            <span className="feed-title">
              <span className="live-dot" />
              {showCalendar ? 'ECONOMIC CALENDAR' : 'LIVE NEWS FEED'}
            </span>
            {!showCalendar && (
              <span style={{ fontSize: 10.5, color: '#404050', marginLeft: 12 }}>
                {hasRealTickerData ? '● LIVE DATA' : '○ SIMULATED'}
              </span>
            )}
            <span className="feed-count">
              {showCalendar ? `${calendarEvents.length} events` : `${newsArticles.length} articles`}
            </span>
            {!showCalendar && (
              <button onClick={() => fetchNews(activeCategory, newsSymbolFilter)} className="refresh-btn">↻</button>
            )}
          </div>

          {/* Column headers */}
          {!showCalendar && (
            <div className="feed-col-header" style={{
              display: 'grid',
              gridTemplateColumns: '36px 80px 1fr auto auto',
              gap: '0 8px',
              padding: '4px 14px',
              borderBottom: '1px solid #1c1c24',
              background: '#0f0f12',
            }}>
              {['AGO', 'SOURCE', 'HEADLINE', '', 'SYMS'].map((h, i) => (
                <span key={i} style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.06em', color: '#404050', textAlign: i === 0 ? 'right' : 'left' }}>
                  {h}
                </span>
              ))}
            </div>
          )}

          {/* Calendar */}
          {showCalendar && (
            <>
              <div className="cal-header">
                <span>TIME</span>
                <span>IMP</span>
                <span>CCY</span>
                <span>EVENT</span>
              </div>
              {calendarEvents.length > 0
                ? calendarEvents.map(ev => <CalendarRow key={ev.id} event={ev} />)
                : <div className="feed-empty">No events scheduled today.</div>
              }
            </>
          )}

          {/* News */}
          {!showCalendar && (
            <div className="news-list">
              {loadingNews
                ? Array.from({ length: 20 }).map((_, i) => <div key={i} className="news-row-skeleton" />)
                : newsError
                  ? (
                    <div className="feed-empty">
                      <p>⚠ Could not load feed — {newsError}</p>
                      <button onClick={() => fetchNews(activeCategory, newsSymbolFilter)} className="retry-btn">↻ Retry</button>
                    </div>
                  )
                  : newsArticles.length > 0
                    ? newsArticles.map((a, i) => <NewsRow key={a.id} article={a} index={i} />)
                    : <div className="feed-empty">No articles found{newsSymbolFilter ? ` for "${newsSymbolFilter.toUpperCase()}"` : ''}.</div>
              }
            </div>
          )}
        </div>

        {/* Right: Sidebar (30%) */}
        <div className="sidebar">

          {/* Market Quotes */}
          <div className="sidebar-section">
            <div className="sidebar-title">MARKET QUOTES</div>
            {loadingQuotes
              ? Array.from({ length: 4 }).map((_, i) => <div key={i} className="mover-row-skeleton" style={{ margin: '4px 14px', height: 27 }} />)
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

          {/* Watchlist */}
          <div className="sidebar-section">
            <div className="sidebar-title">★ WATCHLIST</div>
            {watchlist.length === 0 ? (
              <div className="watchlist-empty">Click ★ on any symbol to track it</div>
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
                    : <span className="mover-price" style={{ color: '#404050' }}>—</span>
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
              <div style={{ fontSize: 10, color: '#404050', padding: '2px 14px 6px', textAlign: 'right' }}>
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
      </div>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer className="site-footer">
        <span>
          <strong style={{ color: '#a0a0b0' }}>ChartGenius</strong> — ApexLogics © 2025
        </span>
        <span>Data: Finnhub · RSS Aggregation · Not financial advice</span>
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
          loading={loadingStockQuote}
          onClose={closeStockDetail}
          onAddTicker={() => addToTicker(selectedStock.symbol)}
          onAddWatchlist={() => toggleWatch(selectedStock.symbol)}
          inTicker={customTickerSymbols.includes(selectedStock.symbol)}
          inWatchlist={watchlist.includes(selectedStock.symbol)}
          tickerFull={customTickerSymbols.length >= MAX_TICKER_CUSTOM}
        />
      )}
    </>
  )
}
