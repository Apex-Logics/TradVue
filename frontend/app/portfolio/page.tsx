'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import Link from 'next/link'

// ─── Types ───────────────────────────────────────────────────────────────────

const SECTORS = [
  'Communication Services', 'Consumer Discretionary', 'Consumer Staples',
  'Energy', 'ETF', 'Financials', 'Health Care', 'Industrials',
  'Materials', 'Real Estate', 'Utilities', 'Information Technology', 'Other',
]

interface Holding {
  id: string           // local uid (not DB id)
  ticker: string
  company: string
  shares: number
  avgCost: number
  buyDate: string
  sector: string
  annualDividend: number     // per share annual (from API)
  divOverrideAnnual?: number // user override per share annual
  totalDividendsReceived: number
  notes?: string
  // transaction log
  transactions?: Transaction[]
}

interface Transaction {
  id: string
  type: 'buy' | 'sell'
  shares: number
  price: number
  date: string
  notes?: string
}

interface StockInfo {
  symbol: string
  companyName: string
  sector?: string | null
  industry?: string | null
  logo?: string | null
  exchange?: string | null
  currency?: string | null
  currentPrice?: number | null
  previousClose?: number | null
  dayChange?: number | null
  dayChangePct?: number | null
  '52WeekHigh'?: number | null
  '52WeekLow'?: number | null
  peRatio?: number | null
  dividendPerShareAnnual?: number | null
  dividendYield?: number | null
  dividendFrequency?: string | null
  dividendGrowthRate5Y?: number | null
  dividendHistory: { date: string; amount: number }[]
  fetchedAt?: string
}

interface DividendCell {
  [key: string]: number
}

interface SoldPosition {
  id: string
  ticker: string
  company: string
  sector: string
  dateSold: string
  shares: number
  avgCost: number
  salePrice: number
  buyDate: string
  totalDividendsWhileHeld: number
  notes?: string
}

interface WatchlistItem {
  id: string
  ticker: string
  company: string
  targetPrice: number
  sector: string
}

interface MonthlySnapshot {
  date: string
  value: number
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

function fmt(n: number, d = 2) {
  return n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
}
function fmtDollar(n: number) {
  const abs = Math.abs(n)
  const sign = n < 0 ? '-' : ''
  return `${sign}$${fmt(abs)}`
}
function fmtPct(n: number) {
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`
}
function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const YEARS = [2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026, 2027, 2028]

const SECTOR_COLORS: Record<string, string> = {
  'Communication Services': '#4a9eff',
  'Consumer Discretionary': '#f0a500',
  'Consumer Staples': '#00c06a',
  'Energy': '#ff6b35',
  'ETF': '#9b59b6',
  'Financials': '#3498db',
  'Health Care': '#e74c3c',
  'Industrials': '#95a5a6',
  'Materials': '#d4a017',
  'Real Estate': '#2ecc71',
  'Utilities': '#1abc9c',
  'Information Technology': '#5b6cf9',
  'Other': '#888888',
}

// ─── localStorage helpers ─────────────────────────────────────────────────────

function loadLS<T>(key: string, def: T): T {
  if (typeof window === 'undefined') return def
  try {
    const s = localStorage.getItem(key)
    return s ? JSON.parse(s) : def
  } catch { return def }
}

function saveLS<T>(key: string, val: T) {
  if (typeof window === 'undefined') return
  try { localStorage.setItem(key, JSON.stringify(val)) } catch {}
}

// ─── Auth helpers ──────────────────────────────────────────────────────────

function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('token') || localStorage.getItem('auth_token') || null
}

function authHeaders(): Record<string, string> {
  const t = getAuthToken()
  const h: Record<string, string> = { 'Content-Type': 'application/json' }
  if (t) h['Authorization'] = `Bearer ${t}`
  return h
}

// ─── API helpers (portfolio persistence) ──────────────────────────────────

async function apiGet<T>(path: string): Promise<T | null> {
  try {
    const r = await fetch(`${API_BASE}${path}`, { headers: authHeaders() })
    if (!r.ok) return null
    return await r.json()
  } catch { return null }
}

async function apiPost<T>(path: string, body: unknown): Promise<T | null> {
  try {
    const r = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(body),
    })
    if (!r.ok) return null
    return await r.json()
  } catch { return null }
}

async function apiDelete(path: string): Promise<boolean> {
  try {
    const r = await fetch(`${API_BASE}${path}`, { method: 'DELETE', headers: authHeaders() })
    return r.ok
  } catch { return false }
}

// ─── Mini SVG Charts ──────────────────────────────────────────────────────────

function BarChart({ data }: { data: { label: string; value: number }[] }) {
  if (!data.length) return <div style={{ color: 'var(--text-3)', fontSize: 11, textAlign: 'center', padding: 20 }}>No data</div>
  const max = Math.max(...data.map(d => d.value), 1)
  const W = 500, H = 180, pad = 40, barGap = 6
  const barW = (W - pad * 2 - barGap * (data.length - 1)) / data.length
  return (
    <svg viewBox={`0 0 ${W} ${H + 30}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      {[0, 0.25, 0.5, 0.75, 1].map((t, i) => {
        const y = pad + (1 - t) * H
        return (
          <g key={i}>
            <line x1={pad} y1={y} x2={W - pad} y2={y} stroke="var(--border)" strokeWidth="0.5" />
            <text x={pad - 4} y={y + 4} textAnchor="end" fontSize="8" fill="var(--text-3)">${fmt(max * t, 0)}</text>
          </g>
        )
      })}
      {data.map((d, i) => {
        const bh = (d.value / max) * H
        const x = pad + i * (barW + barGap)
        const y = pad + H - bh
        return (
          <g key={i}>
            <rect x={x} y={y} width={barW} height={bh} rx="3" fill="var(--accent)" opacity="0.85" />
            <text x={x + barW / 2} y={H + pad + 14} textAnchor="middle" fontSize="9" fill="var(--text-2)">{d.label}</text>
            {bh > 14 && <text x={x + barW / 2} y={y + 12} textAnchor="middle" fontSize="8" fill="#fff">${fmt(d.value, 0)}</text>}
          </g>
        )
      })}
    </svg>
  )
}

function DonutChart({ data }: { data: { label: string; value: number; color: string }[] }) {
  if (!data.length) return <div style={{ color: 'var(--text-3)', fontSize: 11, textAlign: 'center', padding: 20 }}>No data</div>
  const total = data.reduce((s, d) => s + d.value, 0)
  if (total === 0) return <div style={{ color: 'var(--text-3)', fontSize: 11, textAlign: 'center', padding: 20 }}>No data</div>
  const CX = 90, CY = 90, R = 70, IR = 42
  let angle = -Math.PI / 2
  const slices = data.map(d => {
    const frac = d.value / total
    const startAngle = angle
    angle += frac * 2 * Math.PI
    return { ...d, frac, startAngle, endAngle: angle }
  })
  function arc(cx: number, cy: number, r: number, ir: number, start: number, end: number) {
    const x1 = cx + r * Math.cos(start); const y1 = cy + r * Math.sin(start)
    const x2 = cx + r * Math.cos(end); const y2 = cy + r * Math.sin(end)
    const ix1 = cx + ir * Math.cos(end); const iy1 = cy + ir * Math.sin(end)
    const ix2 = cx + ir * Math.cos(start); const iy2 = cy + ir * Math.sin(start)
    const large = end - start > Math.PI ? 1 : 0
    return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} L ${ix1} ${iy1} A ${ir} ${ir} 0 ${large} 0 ${ix2} ${iy2} Z`
  }
  return (
    <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
      <svg viewBox="0 0 180 180" style={{ width: 160, height: 160, flexShrink: 0 }}>
        {slices.map((s, i) => <path key={i} d={arc(CX, CY, R, IR, s.startAngle, s.endAngle)} fill={s.color} stroke="var(--bg-1)" strokeWidth="1.5" />)}
        <text x={CX} y={CY - 4} textAnchor="middle" fontSize="9" fill="var(--text-2)">PORTFOLIO</text>
        <text x={CX} y={CY + 10} textAnchor="middle" fontSize="9" fill="var(--text-2)">ALLOCATION</text>
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, flex: 1 }}>
        {slices.map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: s.color, flexShrink: 0 }} />
            <span style={{ color: 'var(--text-1)', flex: 1 }}>{s.label}</span>
            <span style={{ color: 'var(--text-0)', fontFamily: 'var(--mono)', fontWeight: 600 }}>{(s.frac * 100).toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function LineChart({ data }: { data: MonthlySnapshot[] }) {
  if (data.length < 2) return <div style={{ color: 'var(--text-3)', fontSize: 11, textAlign: 'center', padding: 20 }}>Not enough data — snapshots accumulate monthly</div>
  const W = 500, H = 140, padL = 55, padR = 20, padT = 16, padB = 28
  const vals = data.map(d => d.value)
  const minV = Math.min(...vals); const maxV = Math.max(...vals, minV + 1); const rangeV = maxV - minV
  const pts = data.map((d, i) => ({
    x: padL + (i / (data.length - 1)) * (W - padL - padR),
    y: padT + (1 - (d.value - minV) / rangeV) * H,
    ...d,
  }))
  const polyline = pts.map(p => `${p.x},${p.y}`).join(' ')
  const areaPath = `M ${pts[0].x} ${padT + H} ` + pts.map(p => `L ${p.x} ${p.y}`).join(' ') + ` L ${pts[pts.length - 1].x} ${padT + H} Z`
  return (
    <svg viewBox={`0 0 ${W} ${H + padT + padB}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      <defs>
        <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.3" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0, 0.5, 1].map((t, i) => {
        const y = padT + (1 - t) * H
        return (
          <g key={i}>
            <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="var(--border)" strokeWidth="0.5" />
            <text x={padL - 4} y={y + 4} textAnchor="end" fontSize="8" fill="var(--text-3)">${fmt(minV + rangeV * t, 0)}</text>
          </g>
        )
      })}
      <path d={areaPath} fill="url(#lineGrad)" />
      <polyline points={polyline} fill="none" stroke="var(--accent)" strokeWidth="1.5" />
      {pts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="3" fill="var(--accent)" stroke="var(--bg-1)" strokeWidth="1.5" />)}
      {pts.filter((_, i) => i % 3 === 0).map((p, i) => <text key={i} x={p.x} y={padT + H + 20} textAnchor="middle" fontSize="8" fill="var(--text-3)">{p.date}</text>)}
    </svg>
  )
}

function KpiCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px' }}>
      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-3)', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 17, fontWeight: 700, fontFamily: 'var(--mono)', color: color || 'var(--text-0)' }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: 'var(--text-2)', marginTop: 3 }}>{sub}</div>}
    </div>
  )
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', h)
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', h); document.body.style.overflow = '' }
  }, [onClose])
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 1000 }} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
        background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 10,
        padding: 24, minWidth: 340, maxWidth: 560, width: '90%', zIndex: 1001,
        maxHeight: '92vh', overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 18 }}>
          <span style={{ fontWeight: 700, fontSize: 14 }}>{title}</span>
          <button onClick={onClose} style={{ fontSize: 16, color: 'var(--text-2)' }}>✕</button>
        </div>
        {children}
      </div>
    </>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', background: 'var(--bg-3)', border: '1px solid var(--border)',
  borderRadius: 5, padding: '7px 10px', color: 'var(--text-0)',
  fontSize: 12, fontFamily: 'inherit', outline: 'none',
}
const labelStyle: React.CSSProperties = {
  fontSize: 10, fontWeight: 600, color: 'var(--text-2)', marginBottom: 4, display: 'block',
}

// ─── Portfolio Page ───────────────────────────────────────────────────────────

export default function PortfolioPage() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'holdings' | 'dividends' | 'sold' | 'watchlist'>('dashboard')
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [showImportBanner, setShowImportBanner] = useState(false)

  // Core data
  const [holdings, setHoldings] = useState<Holding[]>([])
  const [dividendOverrides, setDividendOverrides] = useState<DividendCell>({})
  const [soldPositions, setSoldPositions] = useState<SoldPosition[]>([])
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([])
  const [snapshots, setSnapshots] = useState<MonthlySnapshot[]>([])

  // Live data from API
  const [stockInfos, setStockInfos] = useState<Record<string, StockInfo>>({})
  const [loadingPrices, setLoadingPrices] = useState(false)
  const [dataLoaded, setDataLoaded] = useState(false)

  // Sell from holdings
  const [sellFromHolding, setSellFromHolding] = useState<{ holding: Holding & { currentPrice: number; totalDividendsReceived: number } } | null>(null)

  // ─── Check auth and load data ─────────────────────────────────────────────

  useEffect(() => {
    const token = getAuthToken()
    const loggedIn = !!token
    setIsLoggedIn(loggedIn)

    if (loggedIn) {
      // Load from API
      loadFromAPI()
    } else {
      // Load from localStorage
      setHoldings(loadLS('cg_portfolio_holdings', []))
      setDividendOverrides(loadLS('cg_portfolio_dividends', {}))
      setSoldPositions(loadLS('cg_portfolio_sold', []))
      setWatchlist(loadLS('cg_portfolio_watchlist', []))
      setSnapshots(loadLS('cg_portfolio_snapshots', []))
      setDataLoaded(true)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Check if localStorage has data to import (show banner after login loads with empty API)
  useEffect(() => {
    if (isLoggedIn && dataLoaded) {
      const lsHoldings = loadLS<Holding[]>('cg_portfolio_holdings', [])
      if (lsHoldings.length > 0 && holdings.length === 0) {
        setShowImportBanner(true)
      }
    }
  }, [isLoggedIn, dataLoaded, holdings.length])

  const loadFromAPI = useCallback(async () => {
    const [holdingsRes, soldRes, watchlistRes, dividendsRes] = await Promise.all([
      apiGet<{ holdings: Record<string, unknown>[] }>('/api/portfolio/holdings'),
      apiGet<{ sold: Record<string, unknown>[] }>('/api/portfolio/sold'),
      apiGet<{ watchlist: Record<string, unknown>[] }>('/api/portfolio/watchlist'),
      apiGet<{ overrides: DividendCell }>('/api/portfolio/dividends'),
    ])

    if (holdingsRes?.holdings) {
      setHoldings(holdingsRes.holdings.map((h) => ({
        id: String(h.id || uid()),
        ticker: String(h.symbol || ''),
        company: String(h.company_name || h.symbol || ''),
        shares: Number(h.shares),
        avgCost: Number(h.avg_cost),
        buyDate: h.buy_date ? String(h.buy_date).slice(0, 10) : '',
        sector: String(h.sector || 'Other'),
        annualDividend: Number(h.annual_dividend || 0),
        divOverrideAnnual: h.div_override_annual ? Number(h.div_override_annual) : undefined,
        totalDividendsReceived: 0,
        notes: h.notes ? String(h.notes) : undefined,
      })))
    }
    if (soldRes?.sold) {
      setSoldPositions(soldRes.sold.map((s) => ({
        id: String(s.id || uid()),
        ticker: String(s.symbol || ''),
        company: String(s.company_name || s.symbol || ''),
        sector: String(s.sector || 'Other'),
        dateSold: s.sell_date ? String(s.sell_date).slice(0, 10) : '',
        shares: Number(s.shares),
        avgCost: Number(s.avg_cost),
        salePrice: Number(s.sale_price),
        buyDate: s.buy_date ? String(s.buy_date).slice(0, 10) : '',
        totalDividendsWhileHeld: Number(s.dividends_received || 0),
        notes: s.notes ? String(s.notes) : undefined,
      })))
    }
    if (watchlistRes?.watchlist) {
      setWatchlist(watchlistRes.watchlist.map((w) => ({
        id: String(w.id || uid()),
        ticker: String(w.symbol || ''),
        company: String(w.company_name || w.symbol || ''),
        targetPrice: Number(w.target_price || 0),
        sector: String(w.sector || 'Other'),
      })))
    }
    if (dividendsRes?.overrides) {
      setDividendOverrides(dividendsRes.overrides)
    }

    setDataLoaded(true)
  }, [])

  const handleImportFromLS = async () => {
    const lsHoldings = loadLS<Holding[]>('cg_portfolio_holdings', [])
    const lsSold = loadLS<SoldPosition[]>('cg_portfolio_sold', [])
    const lsWatchlist = loadLS<WatchlistItem[]>('cg_portfolio_watchlist', [])
    const lsDivOverrides = loadLS<DividendCell>('cg_portfolio_dividends', {})
    await apiPost('/api/portfolio/sync', {
      holdings: lsHoldings,
      sold: lsSold,
      watchlist: lsWatchlist,
      dividendOverrides: lsDivOverrides,
    })
    setShowImportBanner(false)
    loadFromAPI()
  }

  // ─── Persist helpers ──────────────────────────────────────────────────────

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const persistHolding = useCallback(async (h: Holding) => {
    if (!isLoggedIn) { saveLS('cg_portfolio_holdings', holdings); return }
    await apiPost('/api/portfolio/holdings', {
      symbol: h.ticker,
      company_name: h.company,
      sector: h.sector,
      shares: h.shares,
      avg_cost: h.avgCost,
      buy_date: h.buyDate || null,
      annual_dividend: h.annualDividend || 0,
      div_override_annual: h.divOverrideAnnual ?? null,
      notes: h.notes ?? null,
    })
  }, [isLoggedIn, holdings])

  const deleteHoldingAPI = useCallback(async (ticker: string) => {
    if (isLoggedIn) await apiDelete(`/api/portfolio/holdings/${ticker}`)
  }, [isLoggedIn])

  const persistDivOverride = useCallback(async (key: string, amount: number | null) => {
    const parts = key.split('-')
    const year = Number(parts[0])
    const month = Number(parts[1])
    const symbol = parts.slice(2).join('-')
    if (amount === null) {
      if (isLoggedIn) await apiDelete(`/api/portfolio/dividends/${symbol}/${year}/${month}`)
    } else {
      if (isLoggedIn) await apiPost('/api/portfolio/dividends', { symbol, year, month, amount })
    }
  }, [isLoggedIn])

  const persistSold = useCallback(async (s: SoldPosition) => {
    if (!isLoggedIn) return null
    const res = await apiPost<{ sold: { id: number } }>('/api/portfolio/sold', {
      symbol: s.ticker,
      company_name: s.company,
      sector: s.sector,
      shares: s.shares,
      avg_cost: s.avgCost,
      sale_price: s.salePrice,
      buy_date: s.buyDate || null,
      sell_date: s.dateSold,
      dividends_received: s.totalDividendsWhileHeld,
      notes: s.notes ?? null,
    })
    return res
  }, [isLoggedIn])

  const deleteSoldAPI = useCallback(async (id: string) => {
    if (isLoggedIn) await apiDelete(`/api/portfolio/sold/${id}`)
  }, [isLoggedIn])

  const persistWatchlistItem = useCallback(async (w: WatchlistItem) => {
    if (!isLoggedIn) return
    await apiPost('/api/portfolio/watchlist', {
      symbol: w.ticker,
      company_name: w.company,
      sector: w.sector,
      target_price: w.targetPrice || null,
    })
  }, [isLoggedIn])

  const deleteWatchlistAPI = useCallback(async (ticker: string) => {
    if (isLoggedIn) await apiDelete(`/api/portfolio/watchlist/${ticker}`)
  }, [isLoggedIn])

  // Save to localStorage when NOT logged in
  useEffect(() => { if (!isLoggedIn && dataLoaded) saveLS('cg_portfolio_holdings', holdings) }, [holdings, isLoggedIn, dataLoaded])
  useEffect(() => { if (!isLoggedIn && dataLoaded) saveLS('cg_portfolio_dividends', dividendOverrides) }, [dividendOverrides, isLoggedIn, dataLoaded])
  useEffect(() => { if (!isLoggedIn && dataLoaded) saveLS('cg_portfolio_sold', soldPositions) }, [soldPositions, isLoggedIn, dataLoaded])
  useEffect(() => { if (!isLoggedIn && dataLoaded) saveLS('cg_portfolio_watchlist', watchlist) }, [watchlist, isLoggedIn, dataLoaded])
  useEffect(() => { saveLS('cg_portfolio_snapshots', snapshots) }, [snapshots])

  // ─── Fetch stock prices ───────────────────────────────────────────────────

  const allTickers = useMemo(() => [
    ...new Set([...holdings.map(h => h.ticker), ...watchlist.map(w => w.ticker)]),
  ], [holdings, watchlist])

  const fetchStockInfos = useCallback(async () => {
    if (allTickers.length === 0) return
    setLoadingPrices(true)
    try {
      const results: Record<string, StockInfo> = {}
      for (let i = 0; i < allTickers.length; i++) {
        const sym = allTickers[i]
        try {
          const r = await fetch(`${API_BASE}/api/stock-info/${sym}`)
          if (r.ok) results[sym] = await r.json()
        } catch {}
        if (i < allTickers.length - 1) await new Promise(res => setTimeout(res, 120))
      }
      setStockInfos(prev => ({ ...prev, ...results }))
    } catch (err) {
      console.warn('[Portfolio] fetchStockInfos error:', err)
    } finally {
      setLoadingPrices(false)
    }
  }, [allTickers])

  useEffect(() => { fetchStockInfos() }, [fetchStockInfos])
  useEffect(() => { const t = setInterval(fetchStockInfos, 60_000); return () => clearInterval(t) }, [fetchStockInfos])

  // ─── Dividend calculations ────────────────────────────────────────────────

  const autoCalculatedDividends = useMemo<DividendCell>(() => {
    const result: DividendCell = {}
    holdings.forEach(h => {
      const info = stockInfos[h.ticker]
      if (!info?.dividendHistory?.length) return
      const buyDate = h.buyDate ? new Date(h.buyDate) : null
      info.dividendHistory.forEach(div => {
        const divDate = new Date(div.date)
        if (buyDate && divDate <= buyDate) return
        const yr = divDate.getFullYear()
        const mi = divDate.getMonth()
        if (!YEARS.includes(yr)) return
        const key = `${yr}-${mi}-${h.ticker}`
        result[key] = parseFloat(((result[key] || 0) + div.amount * h.shares).toFixed(4))
      })
    })
    return result
  }, [holdings, stockInfos])

  const effectiveDividendData = useMemo<DividendCell>(() => {
    const result = { ...autoCalculatedDividends }
    Object.entries(dividendOverrides).forEach(([key, val]) => { result[key] = val })
    return result
  }, [autoCalculatedDividends, dividendOverrides])

  const getAutoTotalDividends = useCallback((h: Holding): number => {
    const info = stockInfos[h.ticker]
    if (!info?.dividendHistory?.length) return h.totalDividendsReceived || 0
    const buyDate = h.buyDate ? new Date(h.buyDate) : null
    return info.dividendHistory
      .filter(div => !buyDate || new Date(div.date) > buyDate)
      .reduce((sum, div) => sum + div.amount * h.shares, 0)
  }, [stockInfos])

  // Effective annual dividend per share (user override wins over API)
  const getEffectiveAnnualDiv = useCallback((h: Holding): number => {
    if (h.divOverrideAnnual != null) return h.divOverrideAnnual
    const info = stockInfos[h.ticker]
    return info?.dividendPerShareAnnual ?? h.annualDividend ?? 0
  }, [stockInfos])

  // ─── Enriched holdings ────────────────────────────────────────────────────

  const holdingsEnriched = useMemo(() => holdings.map(h => {
    const info = stockInfos[h.ticker]
    const currentPrice = info?.currentPrice ?? h.avgCost
    const annualDividend = getEffectiveAnnualDiv(h)
    const totalDividendsReceived = getAutoTotalDividends(h)
    const costBasis = h.shares * h.avgCost
    const marketValue = h.shares * currentPrice
    const marketReturn = marketValue - costBasis
    const marketReturnPct = costBasis > 0 ? (marketReturn / costBasis) * 100 : 0
    const totalReturn = marketReturn + totalDividendsReceived
    const totalReturnPct = costBasis > 0 ? (totalReturn / costBasis) * 100 : 0
    const dayGain = (info?.dayChange ?? 0) * h.shares
    const annualDivIncome = annualDividend * h.shares
    const divYield = currentPrice > 0 ? (annualDividend / currentPrice) * 100 : 0
    const yieldOnCost = h.avgCost > 0 ? (annualDividend / h.avgCost) * 100 : 0
    const sector = info?.sector || h.sector || 'Other'
    const company = info?.companyName || h.company || h.ticker
    return { ...h, company, sector, annualDividend, totalDividendsReceived, currentPrice, costBasis, marketValue, marketReturn, marketReturnPct, totalReturn, totalReturnPct, dayGain, annualDivIncome, divYield, yieldOnCost }
  }), [holdings, stockInfos, getAutoTotalDividends, getEffectiveAnnualDiv])

  // Portfolio stats
  const totalCostBasis = holdingsEnriched.reduce((s, h) => s + h.costBasis, 0)
  const totalMarketValue = holdingsEnriched.reduce((s, h) => s + h.marketValue, 0)
  const totalMarketReturn = totalMarketValue - totalCostBasis
  const totalMarketReturnPct = totalCostBasis > 0 ? (totalMarketReturn / totalCostBasis) * 100 : 0
  const totalDividendsReceived = holdingsEnriched.reduce((s, h) => s + h.totalDividendsReceived, 0)
  const totalReturn = totalMarketReturn + totalDividendsReceived
  const totalReturnPct = totalCostBasis > 0 ? (totalReturn / totalCostBasis) * 100 : 0
  const totalDayGain = holdingsEnriched.reduce((s, h) => s + h.dayGain, 0)
  const totalDayGainPct = totalMarketValue > 0 ? (totalDayGain / (totalMarketValue - totalDayGain)) * 100 : 0
  const projAnnualIncome = holdingsEnriched.reduce((s, h) => s + h.annualDivIncome, 0)
  const divYieldPortfolio = totalMarketValue > 0 ? (projAnnualIncome / totalMarketValue) * 100 : 0
  const yieldOnCostPortfolio = totalCostBasis > 0 ? (projAnnualIncome / totalCostBasis) * 100 : 0

  const sectorData = useMemo(() => {
    const m: Record<string, number> = {}
    holdingsEnriched.forEach(h => { m[h.sector || 'Other'] = (m[h.sector || 'Other'] || 0) + h.marketValue })
    return Object.entries(m).map(([label, value]) => ({ label, value, color: SECTOR_COLORS[label] || '#888888' }))
  }, [holdingsEnriched])

  const annualDivByYear: Record<number, number> = {}
  YEARS.forEach(yr => {
    annualDivByYear[yr] = 0
    holdings.forEach(h => {
      MONTHS.forEach((_, mi) => { annualDivByYear[yr] += effectiveDividendData[`${yr}-${mi}-${h.ticker}`] || 0 })
    })
  })
  const barChartData = YEARS.filter(yr => yr >= 2022).map(yr => ({ label: String(yr), value: annualDivByYear[yr] }))

  useEffect(() => {
    if (holdings.length === 0) return
    const totalMV = holdingsEnriched.reduce((s, h) => s + h.marketValue, 0)
    if (totalMV === 0) return
    const now = new Date()
    const key = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    setSnapshots(prev => {
      const existing = prev.findIndex(s => s.date === key)
      if (existing >= 0) { const next = [...prev]; next[existing] = { date: key, value: totalMV }; return next }
      return [...prev, { date: key, value: totalMV }].sort((a, b) => a.date.localeCompare(b.date))
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stockInfos])

  // Tab list
  const tabs: { id: typeof activeTab; label: string }[] = [
    { id: 'dashboard', label: '📊 Dashboard' },
    { id: 'holdings', label: '📁 Holdings' },
    { id: 'dividends', label: '💰 Dividends' },
    { id: 'sold', label: '✅ Sold' },
    { id: 'watchlist', label: '👁 Watchlist' },
  ]

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-0)', color: 'var(--text-0)', fontFamily: 'var(--font)' }}>
      {/* Header */}
      <header style={{
        background: 'var(--bg-1)', borderBottom: '1px solid var(--border)', padding: '0 20px',
        display: 'flex', alignItems: 'center', gap: 16, height: 52, position: 'sticky', top: 0, zIndex: 100,
      }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-2)', fontSize: 12, textDecoration: 'none' }}>
          ← Back
        </Link>
        <div style={{ width: 1, height: 20, background: 'var(--border)' }} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-horizontal.png" alt="ChartGenius" style={{ height: 28, width: 'auto', objectFit: 'contain' }} />
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', letterSpacing: '0.05em' }}>PORTFOLIO</span>
        {isLoggedIn && <span style={{ fontSize: 10, color: 'var(--green)', background: 'rgba(0,192,106,0.12)', padding: '2px 8px', borderRadius: 10 }}>☁ Cloud Sync</span>}
        {!isLoggedIn && <span style={{ fontSize: 10, color: 'var(--text-3)', background: 'var(--bg-3)', padding: '2px 8px', borderRadius: 10 }}>Guest mode · <Link href="/login" style={{ color: 'var(--accent)' }}>Sign in to save</Link></span>}
        <div style={{ flex: 1 }} />
        {loadingPrices && <span style={{ fontSize: 10, color: 'var(--text-3)' }}>↻ Updating prices…</span>}
        <button onClick={fetchStockInfos} style={{ fontSize: 11, color: 'var(--accent)', cursor: 'pointer', padding: '4px 10px', border: '1px solid var(--border)', borderRadius: 4, background: 'transparent' }}>
          ↻ Refresh
        </button>
        {totalMarketValue > 0 && (
          <div style={{ display: 'flex', gap: 16, fontSize: 11 }}>
            <span style={{ color: 'var(--text-2)' }}>Value: <strong style={{ color: 'var(--text-0)', fontFamily: 'var(--mono)' }}>{fmtDollar(totalMarketValue)}</strong></span>
            <span style={{ color: totalReturn >= 0 ? 'var(--green)' : 'var(--red)' }}>Total: {fmtDollar(totalReturn)} ({fmtPct(totalReturnPct)})</span>
          </div>
        )}
      </header>

      {/* Import from localStorage banner */}
      {showImportBanner && (
        <div style={{ background: 'rgba(90,100,220,0.15)', borderBottom: '1px solid var(--accent)', padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 12, fontSize: 12 }}>
          <span>📦 You have portfolio data saved locally. Import it to your account?</span>
          <button onClick={handleImportFromLS} style={{ background: 'var(--accent)', color: '#fff', padding: '4px 12px', borderRadius: 4, fontSize: 11, cursor: 'pointer' }}>Import now</button>
          <button onClick={() => setShowImportBanner(false)} style={{ color: 'var(--text-3)', fontSize: 11, cursor: 'pointer' }}>Dismiss</button>
        </div>
      )}

      {/* Tab bar */}
      <div style={{ background: 'var(--bg-1)', borderBottom: '1px solid var(--border)', display: 'flex', gap: 0, padding: '0 20px', overflowX: 'auto' }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
            padding: '10px 18px', fontSize: 12, fontWeight: activeTab === t.id ? 700 : 400,
            color: activeTab === t.id ? 'var(--accent)' : 'var(--text-2)',
            borderBottom: activeTab === t.id ? '2px solid var(--accent)' : '2px solid transparent',
            cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.15s',
          }}>{t.label}</button>
        ))}
      </div>

      {/* Content */}
      <div style={{ padding: '20px', maxWidth: 1400, margin: '0 auto' }}>
        {activeTab === 'dashboard' && (
          <DashboardTab
            totalCostBasis={totalCostBasis} totalMarketValue={totalMarketValue}
            totalMarketReturn={totalMarketReturn} totalMarketReturnPct={totalMarketReturnPct}
            totalReturn={totalReturn} totalReturnPct={totalReturnPct}
            totalDayGain={totalDayGain} totalDayGainPct={totalDayGainPct}
            divYieldPortfolio={divYieldPortfolio} yieldOnCostPortfolio={yieldOnCostPortfolio}
            projAnnualIncome={projAnnualIncome} sectorData={sectorData}
            barChartData={barChartData} snapshots={snapshots} holdings={holdings}
          />
        )}
        {activeTab === 'holdings' && (
          <HoldingsTab
            holdings={holdings} setHoldings={setHoldings}
            holdingsEnriched={holdingsEnriched}
            totalMarketValue={totalMarketValue} stockInfos={stockInfos}
            isLoggedIn={isLoggedIn}
            persistHolding={persistHolding} deleteHoldingAPI={deleteHoldingAPI}
            onSellPosition={(h) => { setSellFromHolding({ holding: h }); setActiveTab('sold') }}
          />
        )}
        {activeTab === 'dividends' && (
          <DividendsTab
            holdings={holdings} effectiveDividendData={effectiveDividendData}
            autoCalculatedDividends={autoCalculatedDividends}
            dividendOverrides={dividendOverrides} setDividendOverrides={setDividendOverrides}
            stockInfos={stockInfos}
            persistDivOverride={persistDivOverride}
            updateHoldingDivOverride={(ticker, val) => {
              setHoldings(prev => prev.map(h => h.ticker === ticker ? { ...h, divOverrideAnnual: val } : h))
            }}
          />
        )}
        {activeTab === 'sold' && (
          <SoldTab
            soldPositions={soldPositions} setSoldPositions={setSoldPositions}
            autoFillFrom={sellFromHolding}
            onAutoFillConsumed={() => setSellFromHolding(null)}
            persistSold={persistSold} deleteSoldAPI={deleteSoldAPI}
          />
        )}
        {activeTab === 'watchlist' && (
          <WatchlistTab
            watchlist={watchlist} setWatchlist={setWatchlist} stockInfos={stockInfos}
            persistWatchlistItem={persistWatchlistItem} deleteWatchlistAPI={deleteWatchlistAPI}
          />
        )}
      </div>
    </div>
  )
}

// ─── Tab 1: Dashboard ─────────────────────────────────────────────────────────

function DashboardTab({
  totalCostBasis, totalMarketValue, totalMarketReturn, totalMarketReturnPct,
  totalReturn, totalReturnPct, totalDayGain, totalDayGainPct,
  divYieldPortfolio, yieldOnCostPortfolio, projAnnualIncome,
  sectorData, barChartData, snapshots, holdings,
}: {
  totalCostBasis: number; totalMarketValue: number; totalMarketReturn: number; totalMarketReturnPct: number;
  totalReturn: number; totalReturnPct: number; totalDayGain: number; totalDayGainPct: number;
  divYieldPortfolio: number; yieldOnCostPortfolio: number; projAnnualIncome: number;
  sectorData: { label: string; value: number; color: string }[];
  barChartData: { label: string; value: number }[];
  snapshots: MonthlySnapshot[]; holdings: Holding[];
}) {
  if (holdings.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--text-3)' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>📊</div>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: 'var(--text-1)' }}>No Holdings Yet</div>
        <div style={{ fontSize: 13 }}>Add positions in the Holdings tab to see your dashboard.</div>
      </div>
    )
  }
  const kpis = [
    { label: 'COST BASIS', value: fmtDollar(totalCostBasis) },
    { label: 'MARKET VALUE', value: fmtDollar(totalMarketValue) },
    { label: 'MARKET RETURN', value: fmtDollar(totalMarketReturn), sub: fmtPct(totalMarketReturnPct), color: totalMarketReturn >= 0 ? 'var(--green)' : 'var(--red)' },
    { label: 'TOTAL RETURN', value: fmtDollar(totalReturn), sub: fmtPct(totalReturnPct), color: totalReturn >= 0 ? 'var(--green)' : 'var(--red)' },
    { label: 'DAY GAIN', value: fmtDollar(totalDayGain), sub: fmtPct(totalDayGainPct), color: totalDayGain >= 0 ? 'var(--green)' : 'var(--red)' },
    { label: 'DIVIDEND YIELD', value: `${divYieldPortfolio.toFixed(2)}%`, color: 'var(--yellow)' },
    { label: 'YIELD ON COST', value: `${yieldOnCostPortfolio.toFixed(2)}%`, color: 'var(--yellow)' },
    { label: 'PROJ. ANNUAL INCOME', value: fmtDollar(projAnnualIncome), sub: `${fmtDollar(projAnnualIncome / 12)}/mo · ${fmtDollar(projAnnualIncome / 52)}/wk · ${fmtDollar(projAnnualIncome / 365)}/day`, color: 'var(--green)' },
  ]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
        {kpis.map((k, i) => <KpiCard key={i} label={k.label} value={k.value} sub={k.sub} color={k.color} />)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8, padding: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-2)', marginBottom: 12 }}>ANNUAL DIVIDEND INCOME</div>
          <BarChart data={barChartData} />
        </div>
        <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8, padding: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-2)', marginBottom: 12 }}>SECTOR DIVERSIFICATION</div>
          <DonutChart data={sectorData} />
        </div>
      </div>
      <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8, padding: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-2)', marginBottom: 12 }}>PORTFOLIO GROWTH (MONTHLY SNAPSHOTS)</div>
        <LineChart data={snapshots} />
      </div>
    </div>
  )
}

// ─── Tab 2: Holdings ──────────────────────────────────────────────────────────

type HoldingEnriched = Holding & {
  currentPrice: number; costBasis: number; marketValue: number;
  marketReturn: number; marketReturnPct: number; totalReturn: number; totalReturnPct: number;
  dayGain: number; annualDivIncome: number; divYield: number; yieldOnCost: number;
}

function HoldingsTab({
  holdings, setHoldings, holdingsEnriched, totalMarketValue, stockInfos,
  isLoggedIn, persistHolding, deleteHoldingAPI, onSellPosition,
}: {
  holdings: Holding[]
  setHoldings: React.Dispatch<React.SetStateAction<Holding[]>>
  holdingsEnriched: HoldingEnriched[]
  totalMarketValue: number
  stockInfos: Record<string, StockInfo>
  isLoggedIn: boolean
  persistHolding: (h: Holding) => Promise<void>
  deleteHoldingAPI: (ticker: string) => Promise<void>
  onSellPosition: (h: HoldingEnriched) => void
}) {
  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [modalMode, setModalMode] = useState<'add' | 'edit' | 'add-shares'>('add')

  const blankForm = { ticker: '', shares: '', buyDate: new Date().toISOString().slice(0, 10), avgCost: '', notes: '' }
  const [form, setForm] = useState(blankForm)
  const [formError, setFormError] = useState('')
  const [lookingUp, setLookingUp] = useState(false)
  const [peekInfo, setPeekInfo] = useState<StockInfo | null>(null)
  const debRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Add shares context
  const [addSharesTarget, setAddSharesTarget] = useState<Holding | null>(null)

  const openAdd = () => { setForm(blankForm); setEditId(null); setFormError(''); setPeekInfo(null); setModalMode('add'); setShowModal(true) }

  const openEdit = (h: Holding) => {
    setForm({ ticker: h.ticker, shares: String(h.shares), buyDate: h.buyDate || '', avgCost: String(h.avgCost), notes: h.notes || '' })
    if (stockInfos[h.ticker]) setPeekInfo(stockInfos[h.ticker])
    setEditId(h.id)
    setFormError('')
    setModalMode('edit')
    setShowModal(true)
  }

  const openAddShares = (h: Holding) => {
    setAddSharesTarget(h)
    setForm({ ticker: h.ticker, shares: '', buyDate: new Date().toISOString().slice(0, 10), avgCost: String(h.avgCost), notes: '' })
    setEditId(h.id)
    setFormError('')
    setModalMode('add-shares')
    setShowModal(true)
  }

  const handleTickerChange = (val: string) => {
    const upper = val.toUpperCase()
    setForm(f => ({ ...f, ticker: upper }))
    setPeekInfo(null)
    if (debRef.current) clearTimeout(debRef.current)
    if (upper.length < 1) return
    debRef.current = setTimeout(async () => {
      setLookingUp(true)
      try {
        const r = await fetch(`${API_BASE}/api/stock-info/${upper}`)
        if (r.ok) {
          const data: StockInfo = await r.json()
          setPeekInfo(data)
          if (data.currentPrice) setForm(f => ({ ...f, avgCost: f.avgCost || data.currentPrice!.toFixed(2) }))
        }
      } catch {}
      setLookingUp(false)
    }, 600)
  }

  const handleSave = async () => {
    setFormError('')
    const ticker = form.ticker.trim().toUpperCase()
    if (!ticker) { setFormError('Ticker required'); return }

    if (modalMode === 'add-shares' && addSharesTarget) {
      // Add shares: recalculate weighted average cost
      const addShares = parseFloat(form.shares)
      const addPrice = parseFloat(form.avgCost)
      if (isNaN(addShares) || addShares <= 0) { setFormError('Invalid shares'); return }
      if (isNaN(addPrice) || addPrice <= 0) { setFormError('Invalid price'); return }

      const oldShares = addSharesTarget.shares
      const oldCost = addSharesTarget.avgCost
      const newTotalShares = oldShares + addShares
      const newAvgCost = (oldShares * oldCost + addShares * addPrice) / newTotalShares

      const updated: Holding = {
        ...addSharesTarget,
        shares: newTotalShares,
        avgCost: parseFloat(newAvgCost.toFixed(4)),
        // Keep original buyDate (first purchase)
        transactions: [
          ...(addSharesTarget.transactions || [{ id: uid(), type: 'buy', shares: oldShares, price: oldCost, date: addSharesTarget.buyDate }]),
          { id: uid(), type: 'buy', shares: addShares, price: addPrice, date: form.buyDate },
        ],
      }
      setHoldings(prev => prev.map(h => h.id === addSharesTarget.id ? updated : h))
      await persistHolding(updated)
      setShowModal(false)
      return
    }

    const shares = parseFloat(form.shares)
    if (isNaN(shares) || shares <= 0) { setFormError('Invalid shares'); return }
    const avgCost = parseFloat(form.avgCost)
    if (isNaN(avgCost) || avgCost <= 0) { setFormError('Invalid avg cost'); return }
    if (!form.buyDate) { setFormError('Buy date required'); return }

    // Check for duplicate ticker when adding new position
    if (!editId) {
      const existingTicker = holdings.find(h => h.ticker === ticker)
      if (existingTicker) {
        setFormError(`${ticker} already exists. Use "Add Shares" to add more.`)
        return
      }
    }

    const info = peekInfo || stockInfos[ticker]
    const entry: Holding = {
      id: editId || uid(),
      ticker,
      company: info?.companyName || (editId ? holdings.find(h => h.id === editId)?.company || ticker : ticker),
      shares,
      avgCost,
      buyDate: form.buyDate,
      sector: info?.sector || (editId ? holdings.find(h => h.id === editId)?.sector || 'Other' : 'Other'),
      annualDividend: info?.dividendPerShareAnnual || 0,
      totalDividendsReceived: 0,
      notes: form.notes || undefined,
      transactions: editId ? holdings.find(h => h.id === editId)?.transactions : [{ id: uid(), type: 'buy', shares, price: avgCost, date: form.buyDate }],
    }

    if (editId) {
      const existing = holdings.find(h => h.id === editId)
      if (existing && !info) {
        entry.company = existing.company
        entry.sector = existing.sector
        entry.annualDividend = existing.annualDividend
        entry.divOverrideAnnual = existing.divOverrideAnnual
      }
      setHoldings(prev => prev.map(h => h.id === editId ? entry : h))
    } else {
      setHoldings(prev => [...prev, entry])
    }
    await persistHolding(entry)
    setShowModal(false)
  }

  const handleDelete = async (h: Holding) => {
    if (!confirm(`Delete ${h.ticker}?`)) return
    setHoldings(prev => prev.filter(x => x.id !== h.id))
    await deleteHoldingAPI(h.ticker)
  }

  const colHdr: React.CSSProperties = { fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-3)', padding: '8px 8px', textAlign: 'right', whiteSpace: 'nowrap' }
  const cell: React.CSSProperties = { padding: '9px 8px', fontSize: 11, textAlign: 'right', borderBottom: '1px solid var(--border-b)', fontFamily: 'var(--mono)' }
  const cellLeft: React.CSSProperties = { ...cell, textAlign: 'left', fontFamily: 'var(--font)' }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)' }}>{holdings.length} position{holdings.length !== 1 ? 's' : ''}</span>
        <button onClick={openAdd} style={{ background: 'var(--accent)', color: '#fff', padding: '7px 16px', borderRadius: 5, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
          + Add Position
        </button>
      </div>

      {holdings.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-3)', border: '1px dashed var(--border)', borderRadius: 8 }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📁</div>
          <div style={{ fontSize: 14, color: 'var(--text-2)', marginBottom: 8 }}>No positions yet</div>
          <div style={{ fontSize: 12 }}>Click &ldquo;+ Add Position&rdquo; — just enter ticker, shares, buy date &amp; avg cost.</div>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr style={{ background: 'var(--bg-2)', borderBottom: '1px solid var(--border)' }}>
                <th style={{ ...colHdr, textAlign: 'left' }}>TICKER</th>
                <th style={colHdr}>BUY DATE</th>
                <th style={colHdr}>SHARES</th>
                <th style={colHdr}>AVG COST</th>
                <th style={colHdr}>PRICE</th>
                <th style={colHdr}>DAY CHG</th>
                <th style={colHdr}>MKT RETURN</th>
                <th style={colHdr}>TOTAL RETURN</th>
                <th style={{ ...colHdr, textAlign: 'left' }}>SECTOR</th>
                <th style={colHdr}>ALLOC %</th>
                <th style={colHdr}>ANN DIV/SH</th>
                <th style={colHdr}>FREQ</th>
                <th style={colHdr}>DIV YIELD</th>
                <th style={colHdr}>YOC</th>
                <th style={colHdr}>COST BASIS</th>
                <th style={colHdr}>MKT VALUE</th>
                <th style={colHdr}>ANN DIV INC</th>
                <th style={colHdr}>DIVS RCVD</th>
                <th style={colHdr}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {holdingsEnriched.map(h => {
                const alloc = totalMarketValue > 0 ? (h.marketValue / totalMarketValue) * 100 : 0
                const info = stockInfos[h.ticker]
                const hasOverride = h.divOverrideAnnual != null
                return (
                  <tr key={h.id} style={{ background: 'var(--bg-1)' }}>
                    <td style={cellLeft}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {info?.logo && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={info.logo} alt="" style={{ width: 16, height: 16, borderRadius: 3, objectFit: 'contain' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                        )}
                        <div>
                          <div style={{ fontWeight: 700, color: 'var(--text-0)' }}>{h.ticker}</div>
                          <div style={{ fontSize: 9.5, color: 'var(--text-3)', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.company}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ ...cell, fontSize: 10, color: 'var(--text-2)' }}>{h.buyDate || '—'}</td>
                    <td style={cell}>{h.shares}</td>
                    <td style={cell}>${fmt(h.avgCost)}</td>
                    <td style={cell}>${fmt(h.currentPrice)}</td>
                    <td style={{ ...cell, color: (info?.dayChange ?? 0) >= 0 ? 'var(--green)' : 'var(--red)' }}>
                      {info?.dayChange != null ? (<>{fmtDollar(h.dayGain)}<br /><span style={{ fontSize: 9.5 }}>{fmtPct(info.dayChangePct ?? 0)}</span></>) : '—'}
                    </td>
                    <td style={{ ...cell, color: h.marketReturn >= 0 ? 'var(--green)' : 'var(--red)' }}>
                      {fmtDollar(h.marketReturn)}<br /><span style={{ fontSize: 9.5 }}>{fmtPct(h.marketReturnPct)}</span>
                    </td>
                    <td style={{ ...cell, color: h.totalReturn >= 0 ? 'var(--green)' : 'var(--red)' }}>
                      {fmtDollar(h.totalReturn)}<br /><span style={{ fontSize: 9.5 }}>{fmtPct(h.totalReturnPct)}</span>
                    </td>
                    <td style={{ ...cellLeft, fontSize: 10 }}>{h.sector}</td>
                    <td style={cell}>{alloc.toFixed(1)}%</td>
                    <td style={{ ...cell, color: hasOverride ? 'var(--yellow)' : 'var(--text-0)' }}>
                      ${fmt(h.annualDividend, 4)}
                      {hasOverride && <span style={{ fontSize: 8, marginLeft: 3, color: 'var(--yellow)' }}>✎</span>}
                    </td>
                    <td style={{ ...cell, fontSize: 9.5, color: 'var(--text-3)' }}>
                      {info?.dividendFrequency ? info.dividendFrequency.slice(0, 3).toUpperCase() : '—'}
                    </td>
                    <td style={{ ...cell, color: 'var(--yellow)' }}>{h.divYield.toFixed(2)}%</td>
                    <td style={{ ...cell, color: 'var(--yellow)' }}>{h.yieldOnCost.toFixed(2)}%</td>
                    <td style={cell}>{fmtDollar(h.costBasis)}</td>
                    <td style={cell}>{fmtDollar(h.marketValue)}</td>
                    <td style={{ ...cell, color: 'var(--green)' }}>{fmtDollar(h.annualDivIncome)}</td>
                    <td style={cell}>{fmtDollar(h.totalDividendsReceived)}</td>
                    <td style={{ ...cell, textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'nowrap' }}>
                        <button onClick={() => openEdit(h)} style={{ fontSize: 9.5, color: 'var(--accent)', cursor: 'pointer', padding: '2px 5px', border: '1px solid var(--border)', borderRadius: 3 }}>Edit</button>
                        <button onClick={() => openAddShares(h)} style={{ fontSize: 9.5, color: 'var(--green)', cursor: 'pointer', padding: '2px 5px', border: '1px solid var(--border)', borderRadius: 3 }}>+Shares</button>
                        <button onClick={() => onSellPosition(h)} style={{ fontSize: 9.5, color: 'var(--yellow)', cursor: 'pointer', padding: '2px 5px', border: '1px solid var(--border)', borderRadius: 3 }}>Sell</button>
                        <button onClick={() => handleDelete(h)} style={{ fontSize: 9.5, color: 'var(--red)', cursor: 'pointer', padding: '2px 5px', border: '1px solid var(--border)', borderRadius: 3 }}>Del</button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <Modal
          title={modalMode === 'add-shares' ? `Add Shares — ${addSharesTarget?.ticker}` : modalMode === 'edit' ? 'Edit Position' : 'Add Position'}
          onClose={() => setShowModal(false)}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {modalMode === 'add-shares' && addSharesTarget && (
              <div style={{ background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 6, padding: '10px 12px', fontSize: 11 }}>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>Current position: {addSharesTarget.shares} shares @ ${fmt(addSharesTarget.avgCost)}</div>
                <div style={{ fontSize: 10, color: 'var(--text-3)' }}>New weighted avg cost will be auto-calculated</div>
              </div>
            )}

            {modalMode !== 'add-shares' && (
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Ticker Symbol *</label>
                <div style={{ position: 'relative' }}>
                  <input
                    style={{ ...inputStyle, paddingRight: lookingUp ? 30 : undefined }}
                    value={form.ticker}
                    onChange={e => handleTickerChange(e.target.value)}
                    placeholder="e.g. AAPL"
                    autoFocus
                    readOnly={modalMode === 'edit'}
                  />
                  {lookingUp && <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 10, color: 'var(--text-3)' }}>↻</span>}
                </div>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={labelStyle}>{modalMode === 'add-shares' ? 'Additional Shares *' : 'Shares *'}</label>
                <input style={inputStyle} type="number" value={form.shares} onChange={e => setForm(f => ({ ...f, shares: e.target.value }))} placeholder="0" autoFocus={modalMode === 'add-shares'} />
              </div>
              <div>
                <label style={labelStyle}>{modalMode === 'add-shares' ? 'Purchase Price / Share *' : 'Avg Cost / Share *'}</label>
                <input style={inputStyle} type="number" value={form.avgCost} onChange={e => setForm(f => ({ ...f, avgCost: e.target.value }))} placeholder="0.00" />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>{modalMode === 'add-shares' ? 'Purchase Date *' : 'Buy Date *'}</label>
                <input style={{ ...inputStyle, colorScheme: 'dark' }} type="date" value={form.buyDate} onChange={e => setForm(f => ({ ...f, buyDate: e.target.value }))} />
              </div>
              {modalMode !== 'add-shares' && (
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={labelStyle}>Notes</label>
                  <input style={inputStyle} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional notes" />
                </div>
              )}
            </div>

            {/* New avg cost preview for add-shares */}
            {modalMode === 'add-shares' && addSharesTarget && form.shares && form.avgCost && (
              (() => {
                const addSh = parseFloat(form.shares)
                const addPr = parseFloat(form.avgCost)
                if (!isNaN(addSh) && !isNaN(addPr)) {
                  const newTotal = addSharesTarget.shares + addSh
                  const newAvg = (addSharesTarget.shares * addSharesTarget.avgCost + addSh * addPr) / newTotal
                  return (
                    <div style={{ background: 'rgba(0,192,106,0.1)', border: '1px solid rgba(0,192,106,0.3)', borderRadius: 6, padding: '8px 12px', fontSize: 11 }}>
                      <div>New total: <strong>{newTotal.toFixed(6)} shares</strong></div>
                      <div>New avg cost: <strong style={{ color: 'var(--green)', fontFamily: 'var(--mono)' }}>${fmt(newAvg, 4)}</strong></div>
                    </div>
                  )
                }
                return null
              })()
            )}

            {/* Stock info preview */}
            {peekInfo && modalMode !== 'add-shares' && (
              <div style={{ background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 6, padding: '10px 12px', fontSize: 11 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  {peekInfo.logo && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={peekInfo.logo} alt="" style={{ width: 24, height: 24, borderRadius: 4, objectFit: 'contain' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                  )}
                  <div>
                    <div style={{ fontWeight: 700 }}>{peekInfo.companyName}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-3)' }}>{peekInfo.sector} · {peekInfo.exchange}</div>
                  </div>
                  <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                    {peekInfo.currentPrice && <div style={{ fontWeight: 700, fontFamily: 'var(--mono)' }}>${fmt(peekInfo.currentPrice)}</div>}
                    {peekInfo.dayChangePct != null && <div style={{ fontSize: 10, color: (peekInfo.dayChangePct ?? 0) >= 0 ? 'var(--green)' : 'var(--red)' }}>{fmtPct(peekInfo.dayChangePct ?? 0)}</div>}
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, fontSize: 10 }}>
                  {peekInfo.dividendPerShareAnnual != null && (
                    <div><span style={{ color: 'var(--text-3)' }}>Div/Sh: </span><span style={{ fontFamily: 'var(--mono)', color: 'var(--green)' }}>${fmt(peekInfo.dividendPerShareAnnual ?? 0, 4)}</span></div>
                  )}
                  {peekInfo.dividendYield != null && (
                    <div><span style={{ color: 'var(--text-3)' }}>Yield: </span><span style={{ fontFamily: 'var(--mono)', color: 'var(--yellow)' }}>{fmt(peekInfo.dividendYield ?? 0, 2)}%</span></div>
                  )}
                  {peekInfo.dividendFrequency && (
                    <div><span style={{ color: 'var(--text-3)' }}>Freq: </span><span style={{ fontFamily: 'var(--mono)' }}>{peekInfo.dividendFrequency}</span></div>
                  )}
                  {peekInfo.dividendHistory?.length > 0 && (
                    <div><span style={{ color: 'var(--text-3)' }}>History: </span><span style={{ fontFamily: 'var(--mono)' }}>{peekInfo.dividendHistory.length} payments</span></div>
                  )}
                </div>
                <div style={{ marginTop: 6, fontSize: 9.5, color: 'var(--text-3)', fontStyle: 'italic' }}>✓ Company, sector, dividends auto-populate</div>
              </div>
            )}

            {formError && <div style={{ fontSize: 11, color: 'var(--red)' }}>{formError}</div>}
            <button onClick={handleSave} style={{ background: 'var(--accent)', color: '#fff', padding: '9px 0', borderRadius: 5, fontSize: 13, fontWeight: 600, cursor: 'pointer', marginTop: 4 }}>
              {modalMode === 'add-shares' ? 'Add Shares' : modalMode === 'edit' ? 'Save Changes' : 'Add Position'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─── Tab 3: Dividends ─────────────────────────────────────────────────────────

function DividendsTab({
  holdings, effectiveDividendData, autoCalculatedDividends, dividendOverrides,
  setDividendOverrides, stockInfos, persistDivOverride, updateHoldingDivOverride,
}: {
  holdings: Holding[]
  effectiveDividendData: DividendCell
  autoCalculatedDividends: DividendCell
  dividendOverrides: DividendCell
  setDividendOverrides: React.Dispatch<React.SetStateAction<DividendCell>>
  stockInfos: Record<string, StockInfo>
  persistDivOverride: (key: string, amount: number | null) => Promise<void>
  updateHoldingDivOverride: (ticker: string, val: number | undefined) => void
}) {
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [editVal, setEditVal] = useState('')
  const [editingDivOverride, setEditingDivOverride] = useState<string | null>(null) // ticker
  const [divOverrideVal, setDivOverrideVal] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { if (editingKey && inputRef.current) inputRef.current.focus() }, [editingKey])

  const startEdit = (key: string) => { setEditingKey(key); setEditVal(String(effectiveDividendData[key] || '')) }

  const commitEdit = async (key: string) => {
    const val = parseFloat(editVal)
    const amount = isNaN(val) ? 0 : val
    setDividendOverrides(prev => ({ ...prev, [key]: amount }))
    await persistDivOverride(key, amount)
    setEditingKey(null)
  }

  const clearOverride = async (key: string) => {
    setDividendOverrides(prev => { const next = { ...prev }; delete next[key]; return next })
    await persistDivOverride(key, null)
  }

  if (holdings.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-3)' }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>💰</div>
        <div style={{ fontSize: 14, color: 'var(--text-2)' }}>Add holdings first to track dividends</div>
      </div>
    )
  }

  const tickers = holdings.map(h => h.ticker)
  const projectedByTicker: Record<string, number> = {}
  holdings.forEach(h => {
    const info = stockInfos[h.ticker]
    const divPerShare = h.divOverrideAnnual ?? info?.dividendPerShareAnnual ?? h.annualDividend
    projectedByTicker[h.ticker] = divPerShare * h.shares
  })
  const autoTotalByTicker: Record<string, number> = {}
  tickers.forEach(tk => {
    autoTotalByTicker[tk] = YEARS.reduce((s, yr) =>
      s + MONTHS.reduce((ms, _, mi) => ms + (autoCalculatedDividends[`${yr}-${mi}-${tk}`] || 0), 0), 0)
  })

  const thStyle: React.CSSProperties = { padding: '7px 10px', fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-3)', textAlign: 'right', whiteSpace: 'nowrap', background: 'var(--bg-2)', position: 'sticky', top: 0, zIndex: 1 }
  const tdStyle: React.CSSProperties = { padding: '5px 8px', fontSize: 11, textAlign: 'right', fontFamily: 'var(--mono)', borderBottom: '1px solid var(--border-b)', cursor: 'pointer' }

  const currentYear = new Date().getFullYear()
  const visibleYears = YEARS.filter(yr => {
    const hasData = tickers.some(tk => MONTHS.some((_, mi) => (effectiveDividendData[`${yr}-${mi}-${tk}`] || 0) > 0))
    return hasData || yr >= currentYear - 1
  })

  return (
    <div>
      {/* Per-ticker summary + override annual rate */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10, marginBottom: 16 }}>
        {tickers.map(ticker => {
          const h = holdings.find(h => h.ticker === ticker)!
          const info = stockInfos[ticker]
          const projected = projectedByTicker[ticker] || 0
          const autoTotal = autoTotalByTicker[ticker] || 0
          const hasOverride = h.divOverrideAnnual != null
          return (
            <div key={ticker} style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 6, padding: '10px 12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                {info?.logo && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={info.logo} alt="" style={{ width: 16, height: 16, borderRadius: 2, objectFit: 'contain' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                )}
                <span style={{ fontWeight: 700, fontSize: 13 }}>{ticker}</span>
                {info?.dividendFrequency && (
                  <span style={{ fontSize: 9, color: 'var(--text-3)', background: 'var(--bg-3)', padding: '1px 5px', borderRadius: 10 }}>{info.dividendFrequency}</span>
                )}
              </div>
              {h.buyDate && <div style={{ fontSize: 9.5, color: 'var(--text-3)', marginBottom: 4 }}>Since {h.buyDate}</div>}
              <div style={{ fontSize: 10, color: 'var(--text-2)' }}>Proj/yr: <span style={{ color: hasOverride ? 'var(--yellow)' : 'var(--green)', fontFamily: 'var(--mono)' }}>{fmtDollar(projected)}</span></div>
              <div style={{ fontSize: 10, color: 'var(--text-2)' }}>Auto-calc: <span style={{ color: 'var(--green)', fontFamily: 'var(--mono)' }}>{fmtDollar(autoTotal)}</span></div>
              {info?.dividendHistory?.length > 0 && <div style={{ fontSize: 9.5, color: 'var(--text-3)', marginTop: 2 }}>{info.dividendHistory.length} hist. payments</div>}

              {/* Annual rate override per holding */}
              <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border-b)' }}>
                {editingDivOverride === ticker ? (
                  <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    <input
                      autoFocus
                      type="number"
                      value={divOverrideVal}
                      onChange={e => setDivOverrideVal(e.target.value)}
                      placeholder="$/share/yr"
                      style={{ ...inputStyle, width: 90, padding: '3px 6px', fontSize: 10 }}
                    />
                    <button onClick={() => {
                      const val = parseFloat(divOverrideVal)
                      updateHoldingDivOverride(ticker, isNaN(val) ? undefined : val)
                      setEditingDivOverride(null)
                    }} style={{ fontSize: 10, color: 'var(--green)', cursor: 'pointer', padding: '2px 6px', border: '1px solid var(--border)', borderRadius: 3 }}>✓</button>
                    <button onClick={() => setEditingDivOverride(null)} style={{ fontSize: 10, color: 'var(--text-3)', cursor: 'pointer', padding: '2px 5px', border: '1px solid var(--border)', borderRadius: 3 }}>✕</button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <span style={{ fontSize: 9.5, color: hasOverride ? 'var(--yellow)' : 'var(--text-3)' }}>
                      {hasOverride ? `Override: $${fmt(h.divOverrideAnnual!, 4)}/sh/yr` : 'Override ann. div rate:'}
                    </span>
                    <button onClick={() => { setEditingDivOverride(ticker); setDivOverrideVal(hasOverride ? String(h.divOverrideAnnual) : '') }}
                      style={{ fontSize: 9, color: 'var(--accent)', cursor: 'pointer', padding: '1px 5px', border: '1px solid var(--border)', borderRadius: 3 }}>
                      {hasOverride ? 'Edit' : 'Set'}
                    </button>
                    {hasOverride && (
                      <button onClick={() => updateHoldingDivOverride(ticker, undefined)}
                        style={{ fontSize: 9, color: 'var(--red)', cursor: 'pointer', padding: '1px 5px', border: '1px solid var(--border)', borderRadius: 3 }}>Reset</button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, fontSize: 10, color: 'var(--text-3)', marginBottom: 12 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 8, height: 8, background: 'var(--green)', borderRadius: 2, display: 'inline-block' }} />
          Auto-calculated from dividend history
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 8, height: 8, background: 'var(--yellow)', borderRadius: 2, display: 'inline-block' }} />
          Manually overridden
        </span>
        <span style={{ color: 'var(--text-3)' }}>Click cell to edit · Double-click override to clear</span>
      </div>

      {/* Grid */}
      <div style={{ overflowX: 'auto' }}>
        {visibleYears.map(yr => {
          const yearTotal = tickers.reduce((s, tk) =>
            s + MONTHS.reduce((ms, _, mi) => ms + (effectiveDividendData[`${yr}-${mi}-${tk}`] || 0), 0), 0)
          return (
            <div key={yr} style={{ marginBottom: 24 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-1)', marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
                <span>{yr}</span>
                <span style={{ color: 'var(--green)', fontFamily: 'var(--mono)' }}>Year Total: {fmtDollar(yearTotal)}</span>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                <thead>
                  <tr>
                    <th style={{ ...thStyle, textAlign: 'left', position: 'sticky', left: 0, zIndex: 2, minWidth: 60 }}>MONTH</th>
                    {tickers.map(tk => <th key={tk} style={thStyle}>{tk}</th>)}
                    <th style={{ ...thStyle, color: 'var(--green)' }}>TOTAL</th>
                  </tr>
                </thead>
                <tbody>
                  {MONTHS.map((month, mi) => {
                    const rowTotal = tickers.reduce((s, tk) => s + (effectiveDividendData[`${yr}-${mi}-${tk}`] || 0), 0)
                    return (
                      <tr key={mi} style={{ background: mi % 2 === 0 ? 'var(--bg-1)' : 'var(--bg-2)' }}>
                        <td style={{ ...tdStyle, textAlign: 'left', fontFamily: 'var(--font)', fontWeight: 500, color: 'var(--text-1)', position: 'sticky', left: 0, background: mi % 2 === 0 ? 'var(--bg-1)' : 'var(--bg-2)' }}>
                          {month}
                        </td>
                        {tickers.map(tk => {
                          const key = `${yr}-${mi}-${tk}`
                          const val = effectiveDividendData[key] || 0
                          const isAuto = !!autoCalculatedDividends[key] && !dividendOverrides[key]
                          const isOverride = !!dividendOverrides[key]
                          return (
                            <td key={tk} style={tdStyle} onClick={() => startEdit(key)} onDoubleClick={() => isOverride && clearOverride(key)}>
                              {editingKey === key ? (
                                <input
                                  ref={inputRef}
                                  type="number"
                                  value={editVal}
                                  onChange={e => setEditVal(e.target.value)}
                                  onBlur={() => commitEdit(key)}
                                  onKeyDown={e => { if (e.key === 'Enter') commitEdit(key); if (e.key === 'Escape') setEditingKey(null) }}
                                  style={{ width: 70, background: 'var(--bg-3)', border: '1px solid var(--accent)', borderRadius: 3, color: 'var(--text-0)', padding: '2px 4px', fontSize: 11, fontFamily: 'var(--mono)', textAlign: 'right' }}
                                />
                              ) : (
                                <span style={{ color: isOverride ? 'var(--yellow)' : isAuto ? 'var(--green)' : 'var(--text-3)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 3 }}>
                                  {val > 0 ? `$${fmt(val)}` : '—'}
                                  {isOverride && <span style={{ fontSize: 8, opacity: 0.7 }}>✎</span>}
                                </span>
                              )}
                            </td>
                          )
                        })}
                        <td style={{ ...tdStyle, color: rowTotal > 0 ? 'var(--green)' : 'var(--text-3)', fontWeight: 600 }}>
                          {rowTotal > 0 ? fmtDollar(rowTotal) : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Tab 4: Sold Positions ────────────────────────────────────────────────────

function SoldTab({
  soldPositions, setSoldPositions, autoFillFrom, onAutoFillConsumed, persistSold, deleteSoldAPI,
}: {
  soldPositions: SoldPosition[]
  setSoldPositions: React.Dispatch<React.SetStateAction<SoldPosition[]>>
  autoFillFrom: { holding: Holding & { currentPrice: number; totalDividendsReceived: number } } | null
  onAutoFillConsumed: () => void
  persistSold: (s: SoldPosition) => Promise<unknown>
  deleteSoldAPI: (id: string) => Promise<void>
}) {
  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const blank = { ticker: '', company: '', sector: 'Other', buyDate: '', dateSold: new Date().toISOString().slice(0, 10), shares: '', avgCost: '', salePrice: '', totalDividendsWhileHeld: '', notes: '', isPartial: false }
  const [form, setForm] = useState(blank)
  const [formError, setFormError] = useState('')

  // Auto-open modal when navigated here via Sell button
  useEffect(() => {
    if (autoFillFrom) {
      const h = autoFillFrom.holding
      setForm({
        ticker: h.ticker,
        company: h.company,
        sector: h.sector || 'Other',
        buyDate: h.buyDate || '',
        dateSold: new Date().toISOString().slice(0, 10),
        shares: String(h.shares),
        avgCost: String(h.avgCost),
        salePrice: String(h.currentPrice || h.avgCost),
        totalDividendsWhileHeld: String(Math.round(h.totalDividendsReceived * 100) / 100),
        notes: '',
        isPartial: false,
      })
      setEditId(null)
      setFormError('')
      setShowModal(true)
      onAutoFillConsumed()
    }
  }, [autoFillFrom, onAutoFillConsumed])

  const openAdd = () => { setForm(blank); setEditId(null); setFormError(''); setShowModal(true) }
  const openEdit = (s: SoldPosition) => {
    setForm({
      ticker: s.ticker, company: s.company, sector: s.sector || 'Other',
      buyDate: s.buyDate || '', dateSold: s.dateSold,
      shares: String(s.shares), avgCost: String(s.avgCost), salePrice: String(s.salePrice),
      totalDividendsWhileHeld: String(s.totalDividendsWhileHeld), notes: s.notes || '', isPartial: false,
    })
    setEditId(s.id)
    setFormError('')
    setShowModal(true)
  }

  const handleSave = async () => {
    const ticker = form.ticker.trim().toUpperCase()
    if (!ticker) { setFormError('Ticker required'); return }
    const shares = parseFloat(form.shares)
    const avgCost = parseFloat(form.avgCost)
    const salePrice = parseFloat(form.salePrice)
    if (isNaN(shares) || shares <= 0) { setFormError('Invalid shares'); return }
    if (isNaN(avgCost) || avgCost <= 0) { setFormError('Invalid avg cost'); return }
    if (isNaN(salePrice) || salePrice <= 0) { setFormError('Invalid sale price'); return }

    const entry: SoldPosition = {
      id: editId || uid(),
      ticker, company: form.company || ticker, sector: form.sector || 'Other',
      dateSold: form.dateSold || new Date().toISOString().slice(0, 10),
      buyDate: form.buyDate || '',
      shares, avgCost, salePrice,
      totalDividendsWhileHeld: parseFloat(form.totalDividendsWhileHeld) || 0,
      notes: form.notes || undefined,
    }

    if (editId) {
      setSoldPositions(prev => prev.map(s => s.id === editId ? entry : s))
    } else {
      setSoldPositions(prev => [...prev, entry])
      await persistSold(entry)
    }
    setShowModal(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this sold position?')) return
    setSoldPositions(prev => prev.filter(s => s.id !== id))
    await deleteSoldAPI(id)
  }

  const thStyle: React.CSSProperties = { fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-3)', padding: '8px 10px', textAlign: 'right' }
  const tdStyle: React.CSSProperties = { padding: '9px 10px', fontSize: 11, textAlign: 'right', borderBottom: '1px solid var(--border-b)', fontFamily: 'var(--mono)' }

  // Compute realized P&L in form
  const formShares = parseFloat(form.shares) || 0
  const formAvgCost = parseFloat(form.avgCost) || 0
  const formSalePrice = parseFloat(form.salePrice) || 0
  const formDivs = parseFloat(form.totalDividendsWhileHeld) || 0
  const formMktReturn = formShares * (formSalePrice - formAvgCost)
  const formCostBasis = formShares * formAvgCost
  const formTotalReturn = formMktReturn + formDivs
  const formReturnPct = formCostBasis > 0 ? (formTotalReturn / formCostBasis) * 100 : 0

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)' }}>{soldPositions.length} closed position{soldPositions.length !== 1 ? 's' : ''}</span>
        <button onClick={openAdd} style={{ background: 'var(--accent)', color: '#fff', padding: '7px 16px', borderRadius: 5, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
          + Add Sold Position
        </button>
      </div>

      {soldPositions.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-3)', border: '1px dashed var(--border)', borderRadius: 8 }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>✅</div>
          <div style={{ fontSize: 14, color: 'var(--text-2)' }}>No closed positions yet</div>
          <div style={{ fontSize: 12, marginTop: 8 }}>Use the &quot;Sell&quot; button on a holding to auto-fill this form.</div>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg-2)', borderBottom: '1px solid var(--border)' }}>
                <th style={{ ...thStyle, textAlign: 'left' }}>TICKER</th>
                <th style={thStyle}>BUY DATE</th>
                <th style={thStyle}>DATE SOLD</th>
                <th style={thStyle}>SHARES</th>
                <th style={thStyle}>AVG COST</th>
                <th style={thStyle}>SALE PRICE</th>
                <th style={thStyle}>MKT RETURN</th>
                <th style={thStyle}>DIVS COLLECTED</th>
                <th style={thStyle}>TOTAL RETURN</th>
                <th style={thStyle}></th>
              </tr>
            </thead>
            <tbody>
              {soldPositions.map(s => {
                const costBasis = s.shares * s.avgCost
                const saleValue = s.shares * s.salePrice
                const mktReturn = saleValue - costBasis
                const mktReturnPct = costBasis > 0 ? (mktReturn / costBasis) * 100 : 0
                const totalReturn = mktReturn + s.totalDividendsWhileHeld
                const totalReturnPct = costBasis > 0 ? (totalReturn / costBasis) * 100 : 0
                return (
                  <tr key={s.id} style={{ background: 'var(--bg-1)' }}>
                    <td style={{ ...tdStyle, textAlign: 'left', fontFamily: 'var(--font)' }}>
                      <div style={{ fontWeight: 700 }}>{s.ticker}</div>
                      <div style={{ fontSize: 9.5, color: 'var(--text-3)' }}>{s.company}</div>
                    </td>
                    <td style={{ ...tdStyle, fontSize: 10, color: 'var(--text-2)' }}>{s.buyDate || '—'}</td>
                    <td style={tdStyle}>{s.dateSold}</td>
                    <td style={tdStyle}>{s.shares}</td>
                    <td style={tdStyle}>${fmt(s.avgCost)}</td>
                    <td style={tdStyle}>${fmt(s.salePrice)}</td>
                    <td style={{ ...tdStyle, color: mktReturn >= 0 ? 'var(--green)' : 'var(--red)' }}>
                      {fmtDollar(mktReturn)}<br /><span style={{ fontSize: 9.5 }}>{fmtPct(mktReturnPct)}</span>
                    </td>
                    <td style={{ ...tdStyle, color: 'var(--yellow)' }}>{fmtDollar(s.totalDividendsWhileHeld)}</td>
                    <td style={{ ...tdStyle, color: totalReturn >= 0 ? 'var(--green)' : 'var(--red)' }}>
                      {fmtDollar(totalReturn)}<br /><span style={{ fontSize: 9.5 }}>{fmtPct(totalReturnPct)}</span>
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button onClick={() => openEdit(s)} style={{ fontSize: 10, color: 'var(--accent)', cursor: 'pointer', padding: '2px 6px', border: '1px solid var(--border)', borderRadius: 3 }}>Edit</button>
                        <button onClick={() => handleDelete(s.id)} style={{ fontSize: 10, color: 'var(--red)', cursor: 'pointer', padding: '2px 6px', border: '1px solid var(--border)', borderRadius: 3 }}>Del</button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <Modal title={editId ? 'Edit Sold Position' : 'Record Sale'} onClose={() => setShowModal(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Auto-fill notice */}
            {!editId && form.ticker && (
              <div style={{ background: 'rgba(0,192,106,0.1)', border: '1px solid rgba(0,192,106,0.3)', borderRadius: 6, padding: '8px 12px', fontSize: 11 }}>
                ✓ Auto-filled from holdings. Confirm sale price and date.
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={labelStyle}>Ticker *</label>
                <input style={inputStyle} value={form.ticker} onChange={e => setForm(f => ({ ...f, ticker: e.target.value.toUpperCase() }))} placeholder="AAPL" readOnly={!!autoFillFrom || !!editId} />
              </div>
              <div>
                <label style={labelStyle}>Company</label>
                <input style={inputStyle} value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} />
              </div>
              <div>
                <label style={labelStyle}>Buy Date</label>
                <input style={{ ...inputStyle, colorScheme: 'dark' }} type="date" value={form.buyDate} onChange={e => setForm(f => ({ ...f, buyDate: e.target.value }))} />
              </div>
              <div>
                <label style={labelStyle}>Date Sold *</label>
                <input style={{ ...inputStyle, colorScheme: 'dark' }} type="date" value={form.dateSold} onChange={e => setForm(f => ({ ...f, dateSold: e.target.value }))} />
              </div>
              <div>
                <label style={labelStyle}>Shares *</label>
                <input style={inputStyle} type="number" value={form.shares} onChange={e => setForm(f => ({ ...f, shares: e.target.value }))} />
              </div>
              <div>
                <label style={labelStyle}>Avg Cost *</label>
                <input style={inputStyle} type="number" value={form.avgCost} onChange={e => setForm(f => ({ ...f, avgCost: e.target.value }))} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Sale Price / Share *</label>
                <input style={inputStyle} type="number" value={form.salePrice} onChange={e => setForm(f => ({ ...f, salePrice: e.target.value }))} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Total Dividends Received While Holding</label>
                <input style={inputStyle} type="number" value={form.totalDividendsWhileHeld} onChange={e => setForm(f => ({ ...f, totalDividendsWhileHeld: e.target.value }))} placeholder="0.00" />
              </div>
            </div>

            {/* Live P&L preview */}
            {formShares > 0 && formAvgCost > 0 && formSalePrice > 0 && (
              <div style={{ background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 6, padding: '10px 12px', fontSize: 11 }}>
                <div style={{ fontWeight: 700, marginBottom: 6, color: 'var(--text-2)' }}>Realized P&amp;L Preview</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  <div>Cost basis: <span style={{ fontFamily: 'var(--mono)' }}>{fmtDollar(formCostBasis)}</span></div>
                  <div>Sale value: <span style={{ fontFamily: 'var(--mono)' }}>{fmtDollar(formShares * formSalePrice)}</span></div>
                  <div>Market return: <span style={{ fontFamily: 'var(--mono)', color: formMktReturn >= 0 ? 'var(--green)' : 'var(--red)' }}>{fmtDollar(formMktReturn)}</span></div>
                  <div>Dividends: <span style={{ fontFamily: 'var(--mono)', color: 'var(--yellow)' }}>{fmtDollar(formDivs)}</span></div>
                  <div style={{ gridColumn: '1/-1', borderTop: '1px solid var(--border-b)', paddingTop: 6, fontWeight: 700 }}>
                    Total Return: <span style={{ fontFamily: 'var(--mono)', color: formTotalReturn >= 0 ? 'var(--green)' : 'var(--red)' }}>
                      {fmtDollar(formTotalReturn)} ({fmtPct(formReturnPct)})
                    </span>
                  </div>
                </div>
              </div>
            )}

            {formError && <div style={{ fontSize: 11, color: 'var(--red)' }}>{formError}</div>}
            <button onClick={handleSave} style={{ background: 'var(--accent)', color: '#fff', padding: '9px 0', borderRadius: 5, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              {editId ? 'Save Changes' : 'Record Sale'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─── Tab 5: Watchlist ─────────────────────────────────────────────────────────

function WatchlistTab({
  watchlist, setWatchlist, stockInfos, persistWatchlistItem, deleteWatchlistAPI,
}: {
  watchlist: WatchlistItem[]
  setWatchlist: React.Dispatch<React.SetStateAction<WatchlistItem[]>>
  stockInfos: Record<string, StockInfo>
  persistWatchlistItem: (w: WatchlistItem) => Promise<void>
  deleteWatchlistAPI: (ticker: string) => Promise<void>
}) {
  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const blank = { ticker: '', company: '', targetPrice: '', sector: 'Other' }
  const [form, setForm] = useState(blank)
  const [formError, setFormError] = useState('')
  const [lookingUp, setLookingUp] = useState(false)
  const debRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const openAdd = () => { setForm(blank); setEditId(null); setFormError(''); setShowModal(true) }
  const openEdit = (w: WatchlistItem) => {
    setForm({ ticker: w.ticker, company: w.company, targetPrice: String(w.targetPrice), sector: w.sector })
    setEditId(w.id)
    setFormError('')
    setShowModal(true)
  }

  const handleTickerChange = (val: string) => {
    const upper = val.toUpperCase()
    setForm(f => ({ ...f, ticker: upper }))
    if (debRef.current) clearTimeout(debRef.current)
    if (upper.length < 1) return
    debRef.current = setTimeout(async () => {
      setLookingUp(true)
      try {
        const r = await fetch(`${API_BASE}/api/stock-info/${upper}`)
        if (r.ok) {
          const data: StockInfo = await r.json()
          setForm(f => ({ ...f, company: f.company || data.companyName || upper, sector: data.sector || f.sector || 'Other' }))
        }
      } catch {}
      setLookingUp(false)
    }, 600)
  }

  const handleSave = async () => {
    const ticker = form.ticker.trim().toUpperCase()
    if (!ticker) { setFormError('Ticker required'); return }
    const entry: WatchlistItem = {
      id: editId || uid(), ticker, company: form.company || ticker,
      targetPrice: parseFloat(form.targetPrice) || 0, sector: form.sector,
    }
    if (editId) setWatchlist(prev => prev.map(w => w.id === editId ? entry : w))
    else setWatchlist(prev => [...prev, entry])
    await persistWatchlistItem(entry)
    setShowModal(false)
  }

  const handleDelete = async (w: WatchlistItem) => {
    if (!confirm('Remove from watchlist?')) return
    setWatchlist(prev => prev.filter(x => x.id !== w.id))
    await deleteWatchlistAPI(w.ticker)
  }

  const thStyle: React.CSSProperties = { fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-3)', padding: '8px 10px', textAlign: 'right' }
  const tdStyle: React.CSSProperties = { padding: '9px 10px', fontSize: 11, textAlign: 'right', borderBottom: '1px solid var(--border-b)', fontFamily: 'var(--mono)' }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)' }}>{watchlist.length} stocks watched</span>
        <button onClick={openAdd} style={{ background: 'var(--accent)', color: '#fff', padding: '7px 16px', borderRadius: 5, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
          + Add to Watchlist
        </button>
      </div>
      {watchlist.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-3)', border: '1px dashed var(--border)', borderRadius: 8 }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>👁</div>
          <div style={{ fontSize: 14, color: 'var(--text-2)' }}>No stocks on watchlist</div>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg-2)', borderBottom: '1px solid var(--border)' }}>
                <th style={{ ...thStyle, textAlign: 'left' }}>TICKER</th>
                <th style={thStyle}>PRICE</th>
                <th style={thStyle}>TARGET</th>
                <th style={thStyle}>DIST %</th>
                <th style={thStyle}>DAY CHG</th>
                <th style={thStyle}>52W RANGE</th>
                <th style={{ ...thStyle, textAlign: 'left' }}>SECTOR</th>
                <th style={thStyle}>P/E</th>
                <th style={thStyle}>DIV YIELD</th>
                <th style={thStyle}></th>
              </tr>
            </thead>
            <tbody>
              {watchlist.map(w => {
                const info = stockInfos[w.ticker]
                const price = info?.currentPrice
                const distPct = price && w.targetPrice ? ((w.targetPrice - price) / price) * 100 : null
                return (
                  <tr key={w.id} style={{ background: 'var(--bg-1)' }}>
                    <td style={{ ...tdStyle, textAlign: 'left', fontFamily: 'var(--font)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {info?.logo && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={info.logo} alt="" style={{ width: 16, height: 16, borderRadius: 2, objectFit: 'contain' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                        )}
                        <div>
                          <div style={{ fontWeight: 700 }}>{w.ticker}</div>
                          <div style={{ fontSize: 9.5, color: 'var(--text-3)' }}>{info?.companyName || w.company}</div>
                        </div>
                      </div>
                    </td>
                    <td style={tdStyle}>{price ? `$${fmt(price)}` : '—'}</td>
                    <td style={{ ...tdStyle, color: 'var(--yellow)' }}>{w.targetPrice ? `$${fmt(w.targetPrice)}` : '—'}</td>
                    <td style={{ ...tdStyle, color: distPct !== null ? (distPct > 0 ? 'var(--green)' : 'var(--red)') : 'var(--text-3)' }}>
                      {distPct !== null ? fmtPct(distPct) : '—'}
                    </td>
                    <td style={{ ...tdStyle, color: (info?.dayChangePct ?? 0) >= 0 ? 'var(--green)' : 'var(--red)' }}>
                      {info?.dayChangePct != null ? fmtPct(info.dayChangePct) : '—'}
                    </td>
                    <td style={{ ...tdStyle, fontSize: 10 }}>
                      {info?.['52WeekLow'] && info?.['52WeekHigh'] ? `$${fmt(info['52WeekLow']!)} — $${fmt(info['52WeekHigh']!)}` : '—'}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'left', fontFamily: 'var(--font)', fontSize: 10 }}>{info?.sector || w.sector}</td>
                    <td style={tdStyle}>{info?.peRatio ? fmt(info.peRatio, 1) : '—'}</td>
                    <td style={{ ...tdStyle, color: 'var(--yellow)' }}>{info?.dividendYield ? `${fmt(info.dividendYield, 2)}%` : '—'}</td>
                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button onClick={() => openEdit(w)} style={{ fontSize: 10, color: 'var(--accent)', cursor: 'pointer', padding: '2px 6px', border: '1px solid var(--border)', borderRadius: 3 }}>Edit</button>
                        <button onClick={() => handleDelete(w)} style={{ fontSize: 10, color: 'var(--red)', cursor: 'pointer', padding: '2px 6px', border: '1px solid var(--border)', borderRadius: 3 }}>Del</button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      {showModal && (
        <Modal title={editId ? 'Edit Watchlist Item' : 'Add to Watchlist'} onClose={() => setShowModal(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Ticker *</label>
                <div style={{ position: 'relative' }}>
                  <input
                    style={{ ...inputStyle, paddingRight: lookingUp ? 30 : undefined }}

                    value={form.ticker}
                    onChange={e => handleTickerChange(e.target.value)}
                    placeholder="e.g. AAPL"
                    readOnly={!!editId}
                  />
                  {lookingUp && <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 10, color: 'var(--text-3)' }}>↻</span>}
                </div>
              </div>
              <div>
                <label style={labelStyle}>Company</label>
                <input style={inputStyle} value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} />
              </div>
              <div>
                <label style={labelStyle}>Target Buy Price</label>
                <input style={inputStyle} type="number" value={form.targetPrice} onChange={e => setForm(f => ({ ...f, targetPrice: e.target.value }))} placeholder="0.00" />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Sector</label>
                <select style={inputStyle} value={form.sector} onChange={e => setForm(f => ({ ...f, sector: e.target.value }))}>
                  {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            {formError && <div style={{ fontSize: 11, color: 'var(--red)' }}>{formError}</div>}
            <button onClick={handleSave} style={{ background: 'var(--accent)', color: '#fff', padding: '9px 0', borderRadius: 5, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              {editId ? 'Save Changes' : 'Add to Watchlist'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
