'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import dynamic from 'next/dynamic'
import {
  IconArrowLeft, IconAlert, IconDownload, IconBriefcase,
  IconChart, IconFolder, IconDollar, IconEye, IconEyeOff, IconReceiptTax,
  IconPackage, IconLightbulb, IconSave, IconFile, IconCheck,
} from '../components/Icons'
import Link from 'next/link'
import PersistentNav from '../components/PersistentNav'
import Tooltip from '../components/Tooltip'

const AuthModal = dynamic(() => import('../components/AuthModal'), { ssr: false })

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
  dripEnabled?: boolean      // DRIP tracking toggle
  currency?: string          // stock's native currency (e.g. "USD", "GBP")
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
  beta?: number | null
  peRatio?: number | null
  dividendPerShareAnnual?: number | null
  dividendYield?: number | null
  dividendFrequency?: string | null
  dividendGrowthRate5Y?: number | null
  dividendHistory: { date: string; amount: number }[]
  fetchedAt?: string
}

interface AllocationTarget {
  sector: string
  targetPct: number
}

interface ExchangeRates {
  base: string
  rates: Record<string, number>
  fetchedAt: number
}

interface PortfolioSettings {
  dripEnabled: Record<string, boolean>  // ticker -> dripEnabled
  allocationTargets: AllocationTarget[]
  homeCurrency: string
}

const SUPPORTED_CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'CHF']

const DEFAULT_SETTINGS: PortfolioSettings = {
  dripEnabled: {},
  allocationTargets: [],
  homeCurrency: 'USD',
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

interface PriceAlert {
  id: string
  symbol: string
  target_price: number
  direction: 'above' | 'below'
  triggered: boolean
  triggered_at?: string
  created_at: string
}

interface BenchmarkPoint {
  date: string
  portfolioNorm: number
  benchmarkNorm: number
}

interface TaxLot {
  id: string
  symbol: string
  buyDate: string
  sellDate: string
  shares: number
  buyPrice: number
  sellPrice: number
  gainLoss: number
  isLongTerm: boolean
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
import { apiFetchSafe } from '../lib/apiFetch'

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

// Privacy-aware dollar formatter (component)
function PrivacyDollar({ value, privacyMode, className, style }: {
  value: number | string
  privacyMode: boolean
  className?: string
  style?: React.CSSProperties
}) {
  const display = privacyMode
    ? '•••••'
    : typeof value === 'number' ? fmtDollar(value) : value
  return <span className={`privacy-val${privacyMode ? ' privacy-hidden' : ''}${className ? ' ' + className : ''}`} style={style}>{display}</span>
}

function PrivacyNum({ value, privacyMode, prefix = '', suffix = '', style }: {
  value: string | number
  privacyMode: boolean
  prefix?: string
  suffix?: string
  style?: React.CSSProperties
}) {
  const display = privacyMode ? '•••' : `${prefix}${value}${suffix}`
  return <span className={`privacy-val${privacyMode ? ' privacy-hidden' : ''}`} style={style}>{display}</span>
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

function KpiCard({ label, value, sub, color, tooltip, icon }: { label: string; value: string; sub?: string; color?: string; tooltip?: string; icon?: string }) {
  return (
    <div className="ds-card" style={{ padding: '14px 16px' }}>
      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-3)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
        {icon && (
          <div className="tv-card-icon" style={{ width: 28, height: 28, fontSize: 13 }}>{icon}</div>
        )}
        <span>{label}</span>
        {tooltip && <Tooltip text={tooltip} position="bottom" />}
      </div>
      <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'var(--mono)', color: color || 'var(--text-0)' }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: 'var(--text-2)', marginTop: 4 }}>{sub}</div>}
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
        background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 'var(--card-radius)',
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

// ─── Export Helpers ───────────────────────────────────────────────────────────

function exportCSV(filename: string, rows: string[][], headers: string[]) {
  const disclaimer = 'Generated by TradVue Portfolio. For informational purposes only. Not financial advice.'
  const dateStr = new Date().toLocaleDateString('en-US')
  const lines = [
    [`# ${disclaimer} Generated: ${dateStr}`],
    headers,
    ...rows,
  ].map(row => row.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

function exportPDF(title: string, tableHtml: string) {
  const disclaimer = 'For informational purposes only. Not financial advice. Always consult a qualified professional.'
  const dateStr = new Date().toLocaleString('en-US')
  const win = window.open('', '_blank')
  if (!win) return
  win.document.write(`
    <!DOCTYPE html><html><head>
    <title>${title}</title>
    <style>
      body { font-family: Arial, sans-serif; font-size: 11px; color: #111; margin: 20px; }
      h2 { font-size: 16px; margin-bottom: 4px; }
      .meta { font-size: 10px; color: #666; margin-bottom: 16px; }
      table { border-collapse: collapse; width: 100%; }
      th { background: #f0f0f0; border: 1px solid #ccc; padding: 5px 8px; text-align: left; font-size: 10px; }
      td { border: 1px solid #ddd; padding: 4px 8px; font-size: 10px; }
      .disclaimer { margin-top: 24px; font-size: 9px; color: #888; border-top: 1px solid #ccc; padding-top: 8px; }
    </style>
    </head><body>
    <h2>${title}</h2>
    <div class="meta">Generated: ${dateStr}</div>
    ${tableHtml}
    <div class="disclaimer">${disclaimer}</div>
    </body></html>
  `)
  win.document.close()
  setTimeout(() => { win.print() }, 400)
}

// ─── Portfolio Export Button ──────────────────────────────────────────────────

function PortfolioExportButton() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const exportJSON = () => {
    const keys = ['tv_portfolio_holdings', 'tv_portfolio_settings', 'tv_portfolio_dividends', 'cg_watchlist']
    const data: Record<string, unknown> = { version: 1, exportedAt: new Date().toISOString(), type: 'portfolio' }
    keys.forEach(key => { try { data[key] = JSON.parse(localStorage.getItem(key) || 'null') } catch { data[key] = null } })
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `tradvue-portfolio-${new Date().toISOString().slice(0, 10)}.json`; a.click()
    URL.revokeObjectURL(url)
    setOpen(false)
  }

  const exportCSVFn = () => {
    let holdings: { ticker: string; company: string; shares: number; avgCost: number; buyDate: string; sector: string; notes?: string }[] = []
    try { holdings = JSON.parse(localStorage.getItem('tv_portfolio_holdings') || '[]') } catch {}
    const headers = ['Ticker', 'Company', 'Shares', 'Avg Cost', 'Buy Date', 'Sector', 'Notes']
    const rows = holdings.map(h => [h.ticker, `"${(h.company || '').replace(/"/g, '""')}"`, h.shares, h.avgCost, h.buyDate, h.sector, `"${(h.notes || '').replace(/"/g, '""')}"`])
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `tradvue-portfolio-${new Date().toISOString().slice(0, 10)}.csv`; a.click()
    URL.revokeObjectURL(url)
    setOpen(false)
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={() => setOpen(o => !o)} style={{
        display: 'flex', alignItems: 'center', gap: 5,
        background: 'var(--bg-3)', border: '1px solid var(--border)',
        borderRadius: 'var(--btn-radius)', padding: '5px 10px',
        color: 'var(--text-1)', fontSize: 11, cursor: 'pointer',
      }}>
        <IconDownload size={13} /> Export
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', right: 0, zIndex: 50, marginTop: 4,
          background: 'var(--bg-2)', border: '1px solid var(--border)',
          borderRadius: 10, padding: 6, minWidth: 170,
          boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
        }}>
          <button onClick={exportJSON} style={{ display: 'block', width: '100%', textAlign: 'left', background: 'transparent', border: 'none', borderRadius: 6, padding: '8px 10px', cursor: 'pointer', color: 'var(--text-0)', fontSize: 12 }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(99,102,241,0.1)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
            <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}><IconFile size={13} />Export JSON</div>
            <div style={{ fontSize: 10, color: 'var(--text-2)' }}>Full data backup</div>
          </button>
          <button onClick={exportCSVFn} style={{ display: 'block', width: '100%', textAlign: 'left', background: 'transparent', border: 'none', borderRadius: 6, padding: '8px 10px', cursor: 'pointer', color: 'var(--text-0)', fontSize: 12 }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(99,102,241,0.1)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
            <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}><IconChart size={13} />Export CSV</div>
            <div style={{ fontSize: 10, color: 'var(--text-2)' }}>Spreadsheet format</div>
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Portfolio Page ───────────────────────────────────────────────────────────

export default function PortfolioPage() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'holdings' | 'dividends' | 'sold' | 'watchlist' | 'tax'>('dashboard')
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const [showImportBanner, setShowImportBanner] = useState(false)

  // Privacy mode — hides all dollar amounts, shows only percentages
  const [privacyMode, setPrivacyMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      try { return localStorage.getItem('pf_privacy') === '1' } catch {}
    }
    return false
  })
  const togglePrivacy = () => {
    setPrivacyMode(m => {
      const next = !m
      try { localStorage.setItem('pf_privacy', next ? '1' : '0') } catch {}
      return next
    })
  }

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

  // Price alerts
  const [priceAlerts, setPriceAlerts] = useState<PriceAlert[]>([])
  const [alertNotifications, setAlertNotifications] = useState<PriceAlert[]>([])

  // Portfolio settings (DRIP, allocation targets, home currency)
  const [portfolioSettings, setPortfolioSettings] = useState<PortfolioSettings>(DEFAULT_SETTINGS)
  // Exchange rates cache
  const [exchangeRates, setExchangeRates] = useState<ExchangeRates | null>(null)

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
      setPortfolioSettings(loadLS('cg_portfolio_settings', DEFAULT_SETTINGS))
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
    const [holdingsRes, soldRes, watchlistRes, dividendsRes, settingsRes] = await Promise.all([
      apiGet<{ holdings: Record<string, unknown>[] }>('/api/portfolio/holdings'),
      apiGet<{ sold: Record<string, unknown>[] }>('/api/portfolio/sold'),
      apiGet<{ watchlist: Record<string, unknown>[] }>('/api/portfolio/watchlist'),
      apiGet<{ overrides: DividendCell }>('/api/portfolio/dividends'),
      apiGet<{ settings: PortfolioSettings }>('/api/portfolio/settings'),
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
    if (settingsRes?.settings) {
      setPortfolioSettings({ ...DEFAULT_SETTINGS, ...settingsRes.settings })
    } else {
      // Fall back to localStorage settings
      setPortfolioSettings(loadLS('cg_portfolio_settings', DEFAULT_SETTINGS))
    }

    setDataLoaded(true)

    // Load price alerts for logged-in users
    const alertsRes = await apiGet<{ alerts: PriceAlert[] }>('/api/alerts/price')
    if (alertsRes?.alerts) {
      setPriceAlerts(alertsRes.alerts)
      // Surface newly triggered alerts
      const triggered = alertsRes.alerts.filter(a => a.triggered)
      if (triggered.length > 0) {
        setAlertNotifications(triggered)
      }
    }
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

  const savePortfolioSettings = useCallback(async (newSettings: PortfolioSettings) => {
    setPortfolioSettings(newSettings)
    saveLS('cg_portfolio_settings', newSettings)
    if (isLoggedIn) {
      await apiPost('/api/portfolio/settings', { settings: newSettings })
    }
  }, [isLoggedIn])

  const toggleDRIP = useCallback(async (ticker: string, enabled: boolean) => {
    const newSettings = {
      ...portfolioSettings,
      dripEnabled: { ...portfolioSettings.dripEnabled, [ticker]: enabled },
    }
    await savePortfolioSettings(newSettings)
  }, [portfolioSettings, savePortfolioSettings])

  // Price alert helpers
  const addPriceAlert = useCallback(async (symbol: string, target_price: number, direction: 'above' | 'below') => {
    if (!isLoggedIn) {
      // Guest: use localStorage
      const newAlert: PriceAlert = {
        id: uid(), symbol, target_price, direction, triggered: false, created_at: new Date().toISOString()
      }
      setPriceAlerts(prev => [newAlert, ...prev])
      saveLS('cg_price_alerts', [...loadLS<PriceAlert[]>('cg_price_alerts', []), newAlert])
      return newAlert
    }
    const res = await apiPost<{ alert: PriceAlert }>('/api/alerts/price', { symbol, target_price, direction })
    if (res?.alert) {
      setPriceAlerts(prev => [res.alert, ...prev])
      return res.alert
    }
    return null
  }, [isLoggedIn])

  const deletePriceAlert = useCallback(async (id: string) => {
    if (!isLoggedIn) {
      setPriceAlerts(prev => prev.filter(a => a.id !== id))
      saveLS('cg_price_alerts', loadLS<PriceAlert[]>('cg_price_alerts', []).filter((a: PriceAlert) => a.id !== id))
      return
    }
    await apiDelete(`/api/alerts/price/${id}`)
    setPriceAlerts(prev => prev.filter(a => a.id !== id))
  }, [isLoggedIn])

  // Save to localStorage when NOT logged in
  useEffect(() => { if (!isLoggedIn && dataLoaded) saveLS('cg_portfolio_holdings', holdings) }, [holdings, isLoggedIn, dataLoaded])
  useEffect(() => { if (!isLoggedIn && dataLoaded) saveLS('cg_portfolio_dividends', dividendOverrides) }, [dividendOverrides, isLoggedIn, dataLoaded])
  useEffect(() => { if (!isLoggedIn && dataLoaded) saveLS('cg_portfolio_sold', soldPositions) }, [soldPositions, isLoggedIn, dataLoaded])
  useEffect(() => { if (!isLoggedIn && dataLoaded) saveLS('cg_portfolio_watchlist', watchlist) }, [watchlist, isLoggedIn, dataLoaded])
  useEffect(() => { saveLS('cg_portfolio_snapshots', snapshots) }, [snapshots])

  // Fetch exchange rates when home currency changes or on mount
  useEffect(() => {
    const cached = loadLS<ExchangeRates | null>('cg_exchange_rates', null)
    const now = Date.now()
    const ONE_HOUR = 60 * 60 * 1000
    if (cached && now - cached.fetchedAt < ONE_HOUR) {
      setExchangeRates(cached)
      return
    }
    fetch('https://open.er-api.com/v6/latest/USD')
      .then(r => r.json())
      .then(data => {
        if (data?.rates) {
          const rates: ExchangeRates = { base: 'USD', rates: data.rates, fetchedAt: now }
          setExchangeRates(rates)
          saveLS('cg_exchange_rates', rates)
        }
      })
      .catch(() => { /* silent fail */ })
  }, [])

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
        const data = await apiFetchSafe<StockInfo>(`${API_BASE}/api/stock-info/${sym}`)
        if (data) results[sym] = data
        if (i < allTickers.length - 1) await new Promise(res => setTimeout(res, 120))
      }
      setStockInfos(prev => ({ ...prev, ...results }))
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
  const tabs: { id: typeof activeTab; label: string; Icon: React.FC<{ size?: number; style?: React.CSSProperties }> }[] = [
    { id: 'dashboard', label: 'Dashboard', Icon: IconChart },
    { id: 'holdings',  label: 'Holdings',  Icon: IconFolder },
    { id: 'dividends', label: 'Dividends', Icon: IconDollar },
    { id: 'sold',      label: 'Sold',      Icon: IconCheck },
    { id: 'watchlist', label: 'Watchlist', Icon: IconEye },
    { id: 'tax',       label: 'Tax',       Icon: IconReceiptTax },
  ]

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-0)', color: 'var(--text-0)', fontFamily: 'var(--font)' }}>
      {/* Persistent Navigation */}
      <PersistentNav />
      {/* Header */}
      <header className="page-header">
        <Link href="/" className="back-link">
          <IconArrowLeft size={16} />
          TradVue
        </Link>
        <span style={{ color: 'var(--border)' }}>|</span>
        <div className="page-header-title">
          <span style={{ color: 'var(--accent)' }}><IconBriefcase size={18} /></span>
          Portfolio
        </div>
        {isLoggedIn && <span style={{ fontSize: 10, color: 'var(--green)', background: 'var(--green-dim)', padding: '2px 8px', borderRadius: 10 }}>☁ Cloud Sync</span>}
        {!isLoggedIn && <span style={{ fontSize: 10, color: 'var(--text-3)', background: 'var(--bg-3)', padding: '2px 8px', borderRadius: 10 }}>Guest mode · <button onClick={() => setAuthModalOpen(true)} style={{ color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 10 }}>Sign in to save</button></span>}
        <div style={{ flex: 1 }} />
        {loadingPrices && <span style={{ fontSize: 10, color: 'var(--text-3)' }}>↻ Updating prices…</span>}
        {/* Privacy toggle */}
        <button
          onClick={togglePrivacy}
          title={privacyMode ? 'Show values (privacy mode off)' : 'Hide values (privacy mode on)'}
          style={{
            fontSize: 16, cursor: 'pointer', padding: '4px 8px',
            border: '1px solid var(--border)', borderRadius: 6,
            background: privacyMode ? 'var(--accent-dim)' : 'var(--bg-3)',
            color: privacyMode ? 'var(--accent)' : 'var(--text-2)',
            lineHeight: 1, transition: 'all 0.15s',
          }}
          aria-label="Toggle privacy mode"
        >
          {privacyMode ? <IconEyeOff size={15} /> : <IconEye size={15} />}
        </button>
        <button onClick={fetchStockInfos} style={{ fontSize: 11, cursor: 'pointer', padding: '5px 10px', border: '1px solid var(--border)', borderRadius: 'var(--btn-radius)', background: 'var(--bg-3)', color: 'var(--text-1)' }}>
          ↻ Refresh
        </button>
        <PortfolioExportButton />
        {totalMarketValue > 0 && (
          <div style={{ display: 'flex', gap: 16, fontSize: 11 }}>
            <span style={{ color: 'var(--text-2)' }}>Value: <strong style={{ color: 'var(--text-0)', fontFamily: 'var(--mono)' }}>
              {privacyMode ? '•••••' : fmtDollar(totalMarketValue)}
            </strong></span>
            <span style={{ color: totalReturn >= 0 ? 'var(--green)' : 'var(--red)' }}>
              Total: {privacyMode ? '•••••' : fmtDollar(totalReturn)} ({fmtPct(totalReturnPct)})
            </span>
          </div>
        )}
      </header>

      {/* Welcome banner for new users */}
      {holdings.length === 0 && watchlist.length === 0 && (
        <div style={{ background: 'rgba(74,158,255,0.06)', borderBottom: '1px solid rgba(74,158,255,0.15)', padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 12, fontSize: 12, color: 'var(--text-2)' }}>
          <span style={{ color: 'var(--accent)', display: 'flex' }}><IconLightbulb size={16} /></span>
          <span><strong style={{ color: 'var(--text-1)' }}>New here?</strong> Start in the <strong style={{ color: 'var(--text-1)' }}>Holdings</strong> tab to add positions, or <strong style={{ color: 'var(--text-1)' }}>Watchlist</strong> tab to track stocks you&apos;re considering. Dashboard will populate automatically.</span>
        </div>
      )}

      {/* Portfolio Disclaimer Banner */}
      <div style={{ background: 'var(--yellow-dim)', borderBottom: '1px solid rgba(240,165,0,0.25)', padding: '10px 20px', fontSize: 11, color: 'var(--text-2)' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: "var(--yellow)", display: "flex" }}><IconAlert size={14} /></span>
          <span><strong>Portfolio calculations are estimates.</strong> Verify cost basis, dividends, and returns with your broker statements. Not financial or tax advice. <a href="/legal/disclaimer" style={{ color: 'var(--accent)', textDecoration: 'none' }}>Read full disclaimer</a>.</span>
        </span>
      </div>

      {/* Import from localStorage banner */}
      {showImportBanner && (
        <div style={{ background: 'rgba(90,100,220,0.15)', borderBottom: '1px solid var(--accent)', padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 12, fontSize: 12 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><IconPackage size={14} />You have portfolio data saved locally. Import it to your account?</span>
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
          }}><t.Icon size={12} style={{ verticalAlign: 'middle', marginRight: 5, opacity: 0.85 }} />{t.label}</button>
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
            holdingsEnriched={holdingsEnriched}
            stockInfos={stockInfos}
            portfolioSettings={portfolioSettings}
            savePortfolioSettings={savePortfolioSettings}
            exchangeRates={exchangeRates}
            privacyMode={privacyMode}
            setActiveTab={setActiveTab}
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
            priceAlerts={priceAlerts} addPriceAlert={addPriceAlert} deletePriceAlert={deletePriceAlert}
            portfolioSettings={portfolioSettings} toggleDRIP={toggleDRIP}
            privacyMode={privacyMode}
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
            priceAlerts={priceAlerts} addPriceAlert={addPriceAlert} deletePriceAlert={deletePriceAlert}
          />
        )}
        {activeTab === 'tax' && (
          <TaxTab
            holdings={holdings} soldPositions={soldPositions} stockInfos={stockInfos}
          />
        )}
      </div>

      {/* Price alert triggered notifications */}
      {alertNotifications.length > 0 && (
        <div style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 2000, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {alertNotifications.map(a => (
            <div key={a.id} style={{ background: 'var(--bg-2)', border: '2px solid var(--yellow)', borderRadius: 8, padding: '12px 16px', minWidth: 260, boxShadow: '0 4px 20px rgba(0,0,0,0.4)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontWeight: 700, fontSize: 12, color: 'var(--yellow)' }}>Price Alert Triggered</span>
                <button onClick={() => setAlertNotifications(prev => prev.filter(n => n.id !== a.id))} style={{ fontSize: 13, color: 'var(--text-3)', cursor: 'pointer' }}>✕</button>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-0)' }}>{a.symbol} is now <strong>{a.direction}</strong> ${a.target_price}</div>
            </div>
          ))}
        </div>
      )}

      {/* Footer */}
      <footer style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-1)', padding: '20px 24px', marginTop: 40 }}>
        <div style={{ maxWidth: 1400, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <p style={{ fontSize: 12, color: 'var(--text-3)', margin: 0 }}>
            © 2026 TradVue · <a href="/legal/disclaimer" style={{ color: 'var(--text-3)', textDecoration: 'none' }}>Disclaimer</a> · <a href="/legal/privacy" style={{ color: 'var(--text-3)', textDecoration: 'none' }}>Privacy</a> · <a href="/help" style={{ color: 'var(--text-3)', textDecoration: 'none' }}>Help</a>
          </p>
          <p style={{ fontSize: 12, color: 'var(--text-3)', margin: 0 }}>
            Portfolio calculations are estimates. Not financial advice. Verify with your broker.
          </p>
        </div>
      </footer>

      {/* Auth Modal */}
      {authModalOpen && <AuthModal onClose={() => setAuthModalOpen(false)} />}
    </div>
  )
}

// ─── Tab 1: Dashboard ─────────────────────────────────────────────────────────

function DashboardTab({
  totalCostBasis, totalMarketValue, totalMarketReturn, totalMarketReturnPct,
  totalReturn, totalReturnPct, totalDayGain, totalDayGainPct,
  divYieldPortfolio, yieldOnCostPortfolio, projAnnualIncome,
  sectorData, barChartData, snapshots, holdings, holdingsEnriched,
  stockInfos, portfolioSettings, savePortfolioSettings, exchangeRates, privacyMode = false,
  setActiveTab,
}: {
  totalCostBasis: number; totalMarketValue: number; totalMarketReturn: number; totalMarketReturnPct: number;
  totalReturn: number; totalReturnPct: number; totalDayGain: number; totalDayGainPct: number;
  divYieldPortfolio: number; yieldOnCostPortfolio: number; projAnnualIncome: number;
  sectorData: { label: string; value: number; color: string }[];
  barChartData: { label: string; value: number }[];
  snapshots: MonthlySnapshot[]; holdings: Holding[];
  holdingsEnriched: (Holding & { currentPrice: number; marketValue: number; marketReturnPct: number; annualDivIncome: number; divYield: number })[];
  stockInfos: Record<string, StockInfo>;
  portfolioSettings: PortfolioSettings;
  savePortfolioSettings: (s: PortfolioSettings) => Promise<void>;
  exchangeRates: ExchangeRates | null;
  privacyMode?: boolean;
  setActiveTab: (tab: 'dashboard' | 'holdings' | 'dividends' | 'sold' | 'watchlist' | 'tax') => void;
})
{
  const [dashAuthOpen, setDashAuthOpen] = useState(false)
  const pv = (n: number) => privacyMode ? '•••••' : fmtDollar(n)
  if (holdings.length === 0) {
    return (
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '48px 20px' }}>
        {/* Welcome hero */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div className="tv-card-icon" style={{ width: 56, height: 56, margin: '0 auto 16px' }}><IconChart size={24} /></div>
          <h2 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-0)', marginBottom: 10, letterSpacing: '-0.03em' }}>
            Track your holdings, watchlist &amp; performance
          </h2>
          <p style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.7 }}>
            TradVue Portfolio tracks your stock positions, dividends, realized gains/losses, and benchmarks your returns against the S&amp;P 500. Add your first position to get started.
          </p>
        </div>

        {/* Feature cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12, marginBottom: 32 }}>
          {[
            { Icon: IconFolder,      title: 'Holdings',  tabId: 'holdings'  as const, desc: 'Track shares, avg cost, P&L, and allocation % for every position.' },
            { Icon: IconDollar,      title: 'Dividends', tabId: 'dividends' as const, desc: 'Automatic dividend tracking from history. Override any value.' },
            { Icon: IconCheck,       title: 'Sold',      tabId: 'sold'      as const, desc: 'Record and review your closed positions and realized gains/losses.' },
            { Icon: IconEye,         title: 'Watchlist', tabId: 'watchlist' as const, desc: 'Monitor stocks you\'re watching with price alerts and target prices.' },
            { Icon: IconReceiptTax,  title: 'Tax',       tabId: 'tax'       as const, desc: 'Estimate realized gains, short vs long-term, and tax impact.' },
          ].map(f => (
            <div
              key={f.title}
              onClick={() => setActiveTab(f.tabId)}
              style={{
                background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 10,
                padding: '14px 16px', cursor: 'pointer', transition: 'border-color 0.15s, background 0.15s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--accent)'; (e.currentTarget as HTMLDivElement).style.background = 'var(--bg-3)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLDivElement).style.background = 'var(--bg-2)' }}
            >
              <div className="tv-card-icon" style={{ width: 36, height: 36, marginBottom: 6 }}><f.Icon size={16} /></div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-0)', marginBottom: 4 }}>{f.title}</div>
              <div style={{ fontSize: 11, color: 'var(--text-2)', lineHeight: 1.5 }}>{f.desc}</div>
              <div style={{ fontSize: 10, color: 'var(--accent)', marginTop: 8 }}>Go to {f.title} →</div>
            </div>
          ))}
        </div>

        {/* How to add a position */}
        <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 12, padding: '20px 24px', marginBottom: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)', marginBottom: 12 }}>How to add your first holding</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 12, color: 'var(--text-2)', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span style={{ color: 'var(--accent)', fontWeight: 700, minWidth: 18 }}>1.</span>
              Click the <strong style={{ color: 'var(--text-1)' }}>Holdings</strong> tab above, then click <strong style={{ color: 'var(--accent)' }}>+ Add Position</strong>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-2)', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span style={{ color: 'var(--accent)', fontWeight: 700, minWidth: 18 }}>2.</span>
              Enter ticker symbol, number of shares, buy date, and average cost per share
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-2)', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span style={{ color: 'var(--accent)', fontWeight: 700, minWidth: 18 }}>3.</span>
              Company info, current price, and dividends are fetched automatically
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-2)', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span style={{ color: 'var(--accent)', fontWeight: 700, minWidth: 18 }}>4.</span>
              Your dashboard will show cost basis, market value, total return, and sector allocation
            </div>
          </div>
        </div>

        <div style={{ fontSize: 11, color: 'var(--text-3)', textAlign: 'center' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><IconSave size={11} />No account required — data saves locally in your browser. <button onClick={() => setDashAuthOpen(true)} style={{ color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 11 }}>Sign in</button> to enable cloud sync.</span>
          {dashAuthOpen && <AuthModal onClose={() => setDashAuthOpen(false)} />}
        </div>
      </div>
    )
  }

  // Currency conversion helper
  const homeCurrency = portfolioSettings.homeCurrency || 'USD'
  const convertToHome = (usdAmount: number, stockCurrency?: string | null): number => {
    if (!exchangeRates || homeCurrency === 'USD') return usdAmount
    const rate = exchangeRates.rates[homeCurrency] || 1
    // If stock is already in another currency, first convert to USD then to home
    if (stockCurrency && stockCurrency !== 'USD' && exchangeRates.rates[stockCurrency]) {
      const usdValue = usdAmount / exchangeRates.rates[stockCurrency]
      return usdValue * rate
    }
    return usdAmount * rate
  }
  const currencySymbol = { USD: '$', EUR: '€', GBP: '£', CAD: 'CA$', AUD: 'A$', JPY: '¥', CHF: 'CHF ' }[homeCurrency] || '$'
  const fmtHome = (n: number) => `${currencySymbol}${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  const mvHome = convertToHome(totalMarketValue)
  const costHome = convertToHome(totalCostBasis)
  const returnHome = mvHome - costHome
  const incomeHome = convertToHome(projAnnualIncome)

  const kpis = [
    { label: 'COST BASIS', value: privacyMode ? '•••••' : fmtHome(costHome), tooltip: 'The total amount you originally paid for all your holdings (purchase price × shares). This is your "money in" baseline.' },
    { label: 'MARKET VALUE', value: privacyMode ? '•••••' : fmtHome(mvHome), tooltip: 'Current market value of all your holdings (current price × shares). This is what your portfolio is worth right now.' },
    { label: 'MARKET RETURN', value: privacyMode ? '•••••' : fmtHome(convertToHome(totalMarketReturn)), sub: fmtPct(totalMarketReturnPct), color: totalMarketReturn >= 0 ? 'var(--green)' : 'var(--red)', tooltip: 'Profit or loss from price appreciation only — does not include dividends. Market Value minus Cost Basis.' },
    { label: 'TOTAL RETURN', value: privacyMode ? '•••••' : fmtHome(convertToHome(totalReturn)), sub: fmtPct(totalReturnPct), color: totalReturn >= 0 ? 'var(--green)' : 'var(--red)', tooltip: 'Your complete gain/loss including both price appreciation AND dividends received. This is the true performance of your portfolio.' },
    { label: 'DAY GAIN', value: privacyMode ? '•••••' : fmtHome(convertToHome(totalDayGain)), sub: fmtPct(totalDayGainPct), color: totalDayGain >= 0 ? 'var(--green)' : 'var(--red)', tooltip: "How much your portfolio's value has changed today compared to yesterday's close." },
    { label: 'DIVIDEND YIELD', value: `${divYieldPortfolio.toFixed(2)}%`, color: 'var(--yellow)', tooltip: 'Annual dividend income divided by current market value. Shows what % return you earn from dividends at current prices. Higher = more income per dollar invested.' },
    { label: 'YIELD ON COST', value: `${yieldOnCostPortfolio.toFixed(2)}%`, color: 'var(--yellow)', tooltip: 'Annual dividend income divided by your original cost basis. Shows your dividend return on what you actually paid. Great for long-term holders who bought at lower prices.' },
    { label: 'PROJ. ANNUAL INCOME', value: privacyMode ? '•••••' : fmtHome(incomeHome), sub: privacyMode ? '• /mo · • /wk' : `${fmtHome(incomeHome / 12)}/mo · ${fmtHome(incomeHome / 52)}/wk · ${fmtHome(incomeHome / 365)}/day`, color: 'var(--green)', tooltip: 'Estimated total dividend income you will receive over the next 12 months, based on current dividend rates and your share count.' },
  ]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Currency & Home Currency indicator */}
      {homeCurrency !== 'USD' && exchangeRates && (
        <div style={{ fontSize: 11, color: 'var(--text-3)', background: 'var(--bg-2)', padding: '6px 12px', borderRadius: 6, border: '1px solid var(--border)' }}>
          Values shown in <strong>{homeCurrency}</strong> · Rate: 1 USD = {(exchangeRates.rates[homeCurrency] || 1).toFixed(4)} {homeCurrency}
        </div>
      )}

      {/* Ex-Dividend Alert Banners */}
      <ExDivAlerts holdingsEnriched={holdingsEnriched} stockInfos={stockInfos} />

      <div className="kpi-grid">
        {kpis.map((k, i) => <KpiCard key={i} label={k.label} value={k.value} sub={k.sub} color={k.color} tooltip={k.tooltip} />)}
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

      {/* Portfolio Risk Score */}
      <PortfolioRiskScore holdingsEnriched={holdingsEnriched} stockInfos={stockInfos} totalMarketValue={totalMarketValue} />

      {/* DRIP Summary */}
      <DRIPSummary holdingsEnriched={holdingsEnriched} stockInfos={stockInfos} portfolioSettings={portfolioSettings} />

      {/* Asset Allocation Targets */}
      <AllocationTargetsSection
        holdingsEnriched={holdingsEnriched} totalMarketValue={totalMarketValue}
        portfolioSettings={portfolioSettings} savePortfolioSettings={savePortfolioSettings}
      />

      {/* Risk Metrics */}
      <RiskMetricsSection holdingsEnriched={holdingsEnriched} stockInfos={stockInfos} totalMarketValue={totalMarketValue} />

      {/* AI Portfolio Analysis */}
      <AIAnalysisSection holdingsEnriched={holdingsEnriched} totalMarketValue={totalMarketValue} projAnnualIncome={projAnnualIncome} />

      {/* What-If Scenarios */}
      <WhatIfSection holdingsEnriched={holdingsEnriched} totalMarketValue={totalMarketValue} projAnnualIncome={projAnnualIncome} stockInfos={stockInfos} />

      {/* Currency Settings */}
      <CurrencySettings portfolioSettings={portfolioSettings} savePortfolioSettings={savePortfolioSettings} exchangeRates={exchangeRates} />

      {/* Performance Benchmarking Section */}
      <BenchmarkSection holdingsEnriched={holdingsEnriched} totalCostBasis={totalCostBasis} />
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
  priceAlerts, addPriceAlert, deletePriceAlert, portfolioSettings, toggleDRIP, privacyMode = false,
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
  priceAlerts: PriceAlert[]
  addPriceAlert: (symbol: string, target_price: number, direction: 'above' | 'below') => Promise<PriceAlert | null>
  deletePriceAlert: (id: string) => Promise<void>
  portfolioSettings: PortfolioSettings
  toggleDRIP: (ticker: string, enabled: boolean) => Promise<void>
  privacyMode?: boolean
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

  // Price alert modal state
  const [showAlertModal, setShowAlertModal] = useState(false)
  const [alertTarget, setAlertTarget] = useState<{ symbol: string; currentPrice: number } | null>(null)
  const [alertForm, setAlertForm] = useState({ targetPrice: '', direction: 'above' as 'above' | 'below' })
  const [alertError, setAlertError] = useState('')

  const openAlertModal = (symbol: string, currentPrice: number) => {
    setAlertTarget({ symbol, currentPrice })
    setAlertForm({ targetPrice: '', direction: currentPrice > 0 ? 'above' : 'above' })
    setAlertError('')
    setShowAlertModal(true)
  }

  const handleSaveAlert = async () => {
    const price = parseFloat(alertForm.targetPrice)
    if (isNaN(price) || price <= 0) { setAlertError('Enter a valid price'); return }
    if (!alertTarget) return
    await addPriceAlert(alertTarget.symbol, price, alertForm.direction)
    setShowAlertModal(false)
  }

  const handleExportCSV = () => {
    const headers = ['Ticker', 'Company', 'Buy Date', 'Shares', 'Avg Cost', 'Current Price', 'Market Value', 'Cost Basis', 'Market Return', 'Market Return %', 'Annual Div/Sh', 'Annual Div Income', 'Sector']
    const rows = holdingsEnriched.map(h => [
      h.ticker, h.company, h.buyDate, String(h.shares), fmt(h.avgCost), fmt(h.currentPrice),
      fmt(h.marketValue), fmt(h.costBasis), fmt(h.marketReturn), `${h.marketReturnPct.toFixed(2)}%`,
      fmt(h.annualDividend, 4), fmt(h.annualDivIncome), h.sector,
    ])
    exportCSV(`holdings-${new Date().toISOString().slice(0, 10)}.csv`, rows, headers)
  }

  const handleExportPDF = () => {
    const rows = holdingsEnriched.map(h =>
      `<tr><td>${h.ticker}</td><td>${h.company}</td><td>${h.buyDate}</td><td>${h.shares}</td><td>$${fmt(h.avgCost)}</td><td>$${fmt(h.currentPrice)}</td><td>$${fmt(h.marketValue)}</td><td>${fmtPct(h.marketReturnPct)}</td><td>${h.sector}</td></tr>`
    ).join('')
    const tbl = `<table><thead><tr><th>Ticker</th><th>Company</th><th>Buy Date</th><th>Shares</th><th>Avg Cost</th><th>Price</th><th>Mkt Value</th><th>Return %</th><th>Sector</th></tr></thead><tbody>${rows}</tbody></table>`
    exportPDF('Portfolio Holdings', tbl)
  }

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
      const data = await apiFetchSafe<StockInfo>(`${API_BASE}/api/stock-info/${upper}`)
      if (data) {
        setPeekInfo(data)
        if (data.currentPrice) setForm(f => ({ ...f, avgCost: f.avgCost || data.currentPrice!.toFixed(2) }))
      }
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)' }}>{holdings.length} position{holdings.length !== 1 ? 's' : ''}</span>
        <div style={{ display: 'flex', gap: 8 }}>
          {holdingsEnriched.length > 0 && <>
            <button onClick={handleExportCSV} style={{ fontSize: 11, color: 'var(--text-2)', cursor: 'pointer', padding: '5px 10px', border: '1px solid var(--border)', borderRadius: 4, background: 'transparent' }}>↓ CSV</button>
            <button onClick={handleExportPDF} style={{ fontSize: 11, color: 'var(--text-2)', cursor: 'pointer', padding: '5px 10px', border: '1px solid var(--border)', borderRadius: 4, background: 'transparent' }}>↓ PDF</button>
          </>}
          <button onClick={openAdd} style={{ background: 'var(--accent)', color: '#fff', padding: '7px 16px', borderRadius: 5, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            + Add Position
          </button>
        </div>
      </div>

      {holdings.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', border: '1px dashed var(--border)', borderRadius: 12 }}>
          <div className="tv-card-icon" style={{ width: 48, height: 48, margin: '0 auto 14px' }}><IconFolder size={22} /></div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-1)', marginBottom: 8 }}>No positions yet</div>
          <div style={{ fontSize: 13, color: 'var(--text-2)', maxWidth: 420, margin: '0 auto 16px', lineHeight: 1.65 }}>
            Add your first stock position. You&apos;ll need: <strong style={{ color: 'var(--text-1)' }}>ticker</strong>, <strong style={{ color: 'var(--text-1)' }}>shares</strong>, <strong style={{ color: 'var(--text-1)' }}>buy date</strong>, and <strong style={{ color: 'var(--text-1)' }}>average cost</strong>. Company info and current prices are fetched automatically.
          </div>
          <button onClick={openAdd} style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: 'var(--accent)', color: '#fff',
            padding: '10px 24px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}>
            + Add Your First Position
          </button>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr style={{ background: 'var(--bg-2)', borderBottom: '1px solid var(--border)' }}>
                <th style={{ ...colHdr, textAlign: 'left' }}>TICKER</th>
                <th style={colHdr}>BUY DATE</th>
                <th style={colHdr}>SHARES</th>
                <th style={colHdr}><span style={{display:'flex',alignItems:'center',justifyContent:'center',gap:2}}>AVG COST<Tooltip text="Average price per share you paid, including all purchases averaged together." position="bottom"/></span></th>
                <th style={colHdr}>PRICE</th>
                <th style={colHdr}><span style={{display:'flex',alignItems:'center',justifyContent:'center',gap:2}}>DAY CHG<Tooltip text="How much this stock's price has changed today vs yesterday's closing price." position="bottom"/></span></th>
                <th style={colHdr}><span style={{display:'flex',alignItems:'center',justifyContent:'center',gap:2}}>MKT RETURN<Tooltip text="Profit or loss from price change only (not counting dividends). Current Value minus what you paid." position="bottom"/></span></th>
                <th style={colHdr}><span style={{display:'flex',alignItems:'center',justifyContent:'center',gap:2}}>TOTAL RETURN<Tooltip text="Complete profit/loss including both price appreciation AND dividends received. Your true total gain." position="bottom"/></span></th>
                <th style={{ ...colHdr, textAlign: 'left' }}>SECTOR</th>
                <th style={colHdr}><span style={{display:'flex',alignItems:'center',justifyContent:'center',gap:2}}>ALLOC %<Tooltip text="What percentage of your total portfolio value this holding represents. Helps identify concentration risk." position="bottom"/></span></th>
                <th style={colHdr}>ANN DIV/SH</th>
                <th style={colHdr}>FREQ</th>
                <th style={colHdr}><span style={{display:'flex',alignItems:'center',justifyContent:'center',gap:2}}>DIV YIELD<Tooltip text="Annual dividend per share divided by current stock price. Shows income return at today's prices." position="bottom"/></span></th>
                <th style={colHdr}><span style={{display:'flex',alignItems:'center',justifyContent:'center',gap:2}}>YOC<Tooltip text="Yield on Cost — annual dividend divided by YOUR purchase price (not current price). Long-term holders often have high YOC." position="bottom"/></span></th>
                <th style={colHdr}><span style={{display:'flex',alignItems:'center',justifyContent:'center',gap:2}}>COST BASIS<Tooltip text="Total amount you paid for this position (avg cost × shares). Your investment in this stock." position="bottom"/></span></th>
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
                      {info?.dayChange != null ? (<>{privacyMode ? '•••' : fmtDollar(h.dayGain)}<br /><span style={{ fontSize: 9.5 }}>{fmtPct(info.dayChangePct ?? 0)}</span></>) : '—'}
                    </td>
                    <td style={{ ...cell, color: h.marketReturn >= 0 ? 'var(--green)' : 'var(--red)' }}>
                      {privacyMode ? '•••' : fmtDollar(h.marketReturn)}<br /><span style={{ fontSize: 9.5 }}>{fmtPct(h.marketReturnPct)}</span>
                    </td>
                    <td style={{ ...cell, color: h.totalReturn >= 0 ? 'var(--green)' : 'var(--red)' }}>
                      {privacyMode ? '•••' : fmtDollar(h.totalReturn)}<br /><span style={{ fontSize: 9.5 }}>{fmtPct(h.totalReturnPct)}</span>
                    </td>
                    <td style={{ ...cellLeft, fontSize: 10 }}>{h.sector}</td>
                    <td style={cell}>{alloc.toFixed(1)}%</td>
                    <td style={{ ...cell, color: hasOverride ? 'var(--yellow)' : 'var(--text-0)' }}>
                      {privacyMode ? '•••' : `$${fmt(h.annualDividend, 4)}`}
                      {hasOverride && !privacyMode && <span style={{ fontSize: 8, marginLeft: 3, color: 'var(--yellow)' }}>✎</span>}
                    </td>
                    <td style={{ ...cell, fontSize: 9.5, color: 'var(--text-3)' }}>
                      {info?.dividendFrequency ? info.dividendFrequency.slice(0, 3).toUpperCase() : '—'}
                    </td>
                    <td style={{ ...cell, color: 'var(--yellow)' }}>{h.divYield.toFixed(2)}%</td>
                    <td style={{ ...cell, color: 'var(--yellow)' }}>{h.yieldOnCost.toFixed(2)}%</td>
                    <td style={cell}>{privacyMode ? '•••••' : fmtDollar(h.costBasis)}</td>
                    <td style={cell}>{privacyMode ? '•••••' : fmtDollar(h.marketValue)}</td>
                    <td style={{ ...cell, color: 'var(--green)' }}>{privacyMode ? '•••' : fmtDollar(h.annualDivIncome)}</td>
                    <td style={cell}>{privacyMode ? '•••' : fmtDollar(h.totalDividendsReceived)}</td>
                    <td style={{ ...cell, textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'nowrap' }}>
                        <button onClick={() => openEdit(h)} style={{ fontSize: 9.5, color: 'var(--accent)', cursor: 'pointer', padding: '2px 5px', border: '1px solid var(--border)', borderRadius: 3 }}>Edit</button>
                        <button onClick={() => openAddShares(h)} style={{ fontSize: 9.5, color: 'var(--green)', cursor: 'pointer', padding: '2px 5px', border: '1px solid var(--border)', borderRadius: 3 }}>+Shares</button>
                        <button onClick={() => onSellPosition(h)} style={{ fontSize: 9.5, color: 'var(--yellow)', cursor: 'pointer', padding: '2px 5px', border: '1px solid var(--border)', borderRadius: 3 }}>Sell</button>
                        <button onClick={() => openAlertModal(h.ticker, h.currentPrice)} style={{ fontSize: 9.5, color: '#f59e0b', cursor: 'pointer', padding: '2px 5px', border: '1px solid var(--border)', borderRadius: 3 }}>Alert</button>
                        <button
                          onClick={() => toggleDRIP(h.ticker, !portfolioSettings.dripEnabled[h.ticker])}
                          title={portfolioSettings.dripEnabled[h.ticker] ? 'DRIP enabled — click to disable' : 'Enable DRIP'}
                          style={{ fontSize: 9.5, color: portfolioSettings.dripEnabled[h.ticker] ? 'var(--green)' : 'var(--text-3)', cursor: 'pointer', padding: '2px 5px', border: `1px solid ${portfolioSettings.dripEnabled[h.ticker] ? 'var(--green)' : 'var(--border)'}`, borderRadius: 3 }}
                        >DRIP</button>
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

      {/* Price Alert Modal */}
      {showAlertModal && alertTarget && (
        <Modal title={`Price Alert — ${alertTarget.symbol}`} onClose={() => setShowAlertModal(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 11, color: 'var(--text-2)' }}>
              Current price: <strong style={{ color: 'var(--text-0)', fontFamily: 'var(--mono)' }}>${fmt(alertTarget.currentPrice)}</strong>
            </div>
            <div>
              <label style={labelStyle}>Alert Direction</label>
              <select style={inputStyle} value={alertForm.direction} onChange={e => setAlertForm(f => ({ ...f, direction: e.target.value as 'above' | 'below' }))}>
                <option value="above">Price goes above</option>
                <option value="below">Price goes below</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Target Price *</label>
              <input style={inputStyle} type="number" step="0.01" value={alertForm.targetPrice}
                onChange={e => setAlertForm(f => ({ ...f, targetPrice: e.target.value }))}
                placeholder="0.00" />
            </div>
            {/* Active alerts for this symbol */}
            {priceAlerts.filter(a => a.symbol === alertTarget.symbol).length > 0 && (
              <div>
                <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-2)', marginBottom: 6 }}>ACTIVE ALERTS FOR {alertTarget.symbol}</div>
                {priceAlerts.filter(a => a.symbol === alertTarget.symbol).map(a => (
                  <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 8px', background: 'var(--bg-3)', borderRadius: 4, marginBottom: 4, fontSize: 11 }}>
                    <span style={{ color: a.triggered ? 'var(--green)' : 'var(--text-0)' }}>
                      {a.direction === 'above' ? '↑' : '↓'} ${fmt(a.target_price)} {a.triggered ? '✓ Triggered' : ''}
                    </span>
                    <button onClick={() => deletePriceAlert(a.id)} style={{ fontSize: 10, color: 'var(--red)', cursor: 'pointer', padding: '1px 5px', border: '1px solid var(--border)', borderRadius: 3 }}>Del</button>
                  </div>
                ))}
              </div>
            )}
            {alertError && <div style={{ fontSize: 11, color: 'var(--red)' }}>{alertError}</div>}
            <button onClick={handleSaveAlert} style={{ background: '#f59e0b', color: '#fff', padding: '9px 0', borderRadius: 5, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              Set Alert
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
        <div style={{ marginBottom: 12, fontSize: 28 }}>$</div>
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

  const handleExportDivCSV = () => {
    const headers = ['Year', 'Month', ...tickers, 'Total']
    const rows: string[][] = []
    visibleYears.forEach(yr => {
      MONTHS.forEach((month, mi) => {
        const rowTotal = tickers.reduce((s, tk) => s + (effectiveDividendData[`${yr}-${mi}-${tk}`] || 0), 0)
        rows.push([String(yr), month, ...tickers.map(tk => fmt(effectiveDividendData[`${yr}-${mi}-${tk}`] || 0)), fmt(rowTotal)])
      })
    })
    exportCSV(`dividends-${new Date().toISOString().slice(0, 10)}.csv`, rows, headers)
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)' }}>Dividend Tracker</span>
        {tickers.length > 0 && <button onClick={handleExportDivCSV} style={{ fontSize: 11, color: 'var(--text-2)', cursor: 'pointer', padding: '5px 10px', border: '1px solid var(--border)', borderRadius: 4, background: 'transparent' }}>↓ Export CSV</button>}
      </div>
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

      {/* Income Projection Calendar */}
      <IncomeCalendar holdings={holdings} stockInfos={stockInfos} />
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

  const handleExportSoldCSV = () => {
    const headers = ['Ticker', 'Company', 'Sector', 'Buy Date', 'Sell Date', 'Shares', 'Avg Cost', 'Sale Price', 'Cost Basis', 'Market Return', 'Dividends While Held', 'Total Return', 'Notes']
    const rows = soldPositions.map(s => {
      const mktReturn = s.shares * (s.salePrice - s.avgCost)
      const totalReturn = mktReturn + s.totalDividendsWhileHeld
      return [s.ticker, s.company, s.sector, s.buyDate, s.dateSold, String(s.shares), fmt(s.avgCost), fmt(s.salePrice), fmt(s.shares * s.avgCost), fmt(mktReturn), fmt(s.totalDividendsWhileHeld), fmt(totalReturn), s.notes || '']
    })
    exportCSV(`sold-positions-${new Date().toISOString().slice(0, 10)}.csv`, rows, headers)
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)' }}>{soldPositions.length} closed position{soldPositions.length !== 1 ? 's' : ''}</span>
        <div style={{ display: 'flex', gap: 8 }}>
          {soldPositions.length > 0 && <button onClick={handleExportSoldCSV} style={{ fontSize: 11, color: 'var(--text-2)', cursor: 'pointer', padding: '5px 10px', border: '1px solid var(--border)', borderRadius: 4, background: 'transparent' }}>↓ CSV</button>}
          <button onClick={openAdd} style={{ background: 'var(--accent)', color: '#fff', padding: '7px 16px', borderRadius: 5, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            + Add Sold Position
          </button>
        </div>
      </div>

      {soldPositions.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-3)', border: '1px dashed var(--border)', borderRadius: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(34,197,94,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
          </div>
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
  priceAlerts, addPriceAlert, deletePriceAlert,
}: {
  watchlist: WatchlistItem[]
  setWatchlist: React.Dispatch<React.SetStateAction<WatchlistItem[]>>
  stockInfos: Record<string, StockInfo>
  persistWatchlistItem: (w: WatchlistItem) => Promise<void>
  deleteWatchlistAPI: (ticker: string) => Promise<void>
  priceAlerts: PriceAlert[]
  addPriceAlert: (symbol: string, target_price: number, direction: 'above' | 'below') => Promise<PriceAlert | null>
  deletePriceAlert: (id: string) => Promise<void>
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
      const data = await apiFetchSafe<StockInfo>(`${API_BASE}/api/stock-info/${upper}`)
      if (data) setForm(f => ({ ...f, company: f.company || data.companyName || upper, sector: data.sector || f.sector || 'Other' }))
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
        <div style={{ textAlign: 'center', padding: '60px 20px', border: '1px dashed var(--border)', borderRadius: 12 }}>
          <div style={{ marginBottom: 14, fontSize: 32 }}>?</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-1)', marginBottom: 8 }}>Your watchlist is empty</div>
          <div style={{ fontSize: 13, color: 'var(--text-2)', maxWidth: 400, margin: '0 auto 20px', lineHeight: 1.65 }}>
            Track stocks you&apos;re watching but haven&apos;t bought yet. Monitor price, day change, P/E ratio, and dividend yield in one place.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 360, margin: '0 auto 24px', textAlign: 'left' }}>
            <div style={{ fontSize: 12, color: 'var(--text-2)', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px' }}>
              <strong style={{ color: 'var(--text-1)' }}>① Enter a ticker</strong> — type any US stock symbol (e.g. AAPL, TSLA, NVDA)
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-2)', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px' }}>
              <strong style={{ color: 'var(--text-1)' }}>② Set a target price</strong> — your ideal buy price (optional but helpful)
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-2)', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px' }}>
              <strong style={{ color: 'var(--text-1)' }}>③ Set a price alert</strong> — get notified when the stock hits your target (click Alert)
            </div>
          </div>
          <button onClick={openAdd} style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: 'var(--accent)', color: '#fff',
            padding: '10px 24px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}>
            + Add Your First Stock
          </button>
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
                        {price && <button onClick={() => {
                          const dir = w.targetPrice && price > w.targetPrice ? 'below' : 'above'
                          addPriceAlert(w.ticker, w.targetPrice || price, dir)
                        }} style={{ fontSize: 10, color: '#f59e0b', cursor: 'pointer', padding: '2px 6px', border: '1px solid var(--border)', borderRadius: 3 }}>Alert</button>}
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

// ─── Benchmark Section (Performance Benchmarking) ────────────────────────────

type EnrichedHoldingForBenchmark = Holding & { currentPrice: number; marketValue: number; marketReturnPct: number }

function BenchmarkSection({ holdingsEnriched, totalCostBasis }: {
  holdingsEnriched: EnrichedHoldingForBenchmark[]
  totalCostBasis: number
}) {
  const [benchmark, setBenchmark] = useState('SPY')
  const [range, setRange] = useState('1Y')
  const [benchmarkData, setBenchmarkData] = useState<{ date: string; close: number }[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const rangeMap: Record<string, string> = { '1M': '1mo', '3M': '3mo', '6M': '6mo', 'YTD': 'ytd', '1Y': '1y', 'All': '5y' }

  useEffect(() => {
    const fetchBenchmark = async () => {
      setLoading(true)
      setError(null)
      const yahooRange = rangeMap[range] || '1y'
      const data = await apiFetchSafe<{ prices: unknown[] }>(`${API_BASE}/api/stock-info/benchmark/${benchmark}?range=${yahooRange}`)
      if (data?.prices) setBenchmarkData(data.prices as typeof benchmarkData)
      else setError('Benchmark data temporarily unavailable.')
      setLoading(false)
    }
    fetchBenchmark()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [benchmark, range])

  // Compute portfolio weighted avg return
  const totalMV = holdingsEnriched.reduce((s, h) => s + h.marketValue, 0)
  const portfolioReturnPct = totalCostBasis > 0 ? ((totalMV - totalCostBasis) / totalCostBasis) * 100 : 0

  // Compute benchmark return
  const benchmarkReturnPct = benchmarkData.length >= 2
    ? ((benchmarkData[benchmarkData.length - 1].close - benchmarkData[0].close) / benchmarkData[0].close) * 100
    : null

  const diff = benchmarkReturnPct !== null ? portfolioReturnPct - benchmarkReturnPct : null

  // Build normalized chart data
  const chartPoints = benchmarkData.map(d => ({ date: d.date, norm: ((d.close - benchmarkData[0].close) / benchmarkData[0].close) * 100 }))

  return (
    <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8, padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-2)' }}>PERFORMANCE VS BENCHMARK</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {['SPY', 'QQQ', 'DIA', 'IWM'].map(b => (
            <button key={b} onClick={() => setBenchmark(b)} style={{
              fontSize: 10, padding: '3px 8px', borderRadius: 4, cursor: 'pointer',
              background: benchmark === b ? 'var(--accent)' : 'var(--bg-3)',
              color: benchmark === b ? '#fff' : 'var(--text-2)',
              border: `1px solid ${benchmark === b ? 'var(--accent)' : 'var(--border)'}`,
            }}>{b}</button>
          ))}
          <div style={{ width: 1, background: 'var(--border)', margin: '0 4px' }} />
          {['1M', '3M', '6M', 'YTD', '1Y', 'All'].map(r => (
            <button key={r} onClick={() => setRange(r)} style={{
              fontSize: 10, padding: '3px 8px', borderRadius: 4, cursor: 'pointer',
              background: range === r ? 'var(--accent)' : 'var(--bg-3)',
              color: range === r ? '#fff' : 'var(--text-2)',
              border: `1px solid ${range === r ? 'var(--accent)' : 'var(--border)'}`,
            }}>{r}</button>
          ))}
        </div>
      </div>

      {/* Summary banner */}
      {benchmarkReturnPct !== null && (
        <div style={{ display: 'flex', gap: 20, marginBottom: 12, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 12 }}>
            <span style={{ color: 'var(--text-2)' }}>Your portfolio: </span>
            <strong style={{ color: portfolioReturnPct >= 0 ? 'var(--green)' : 'var(--red)' }}>{fmtPct(portfolioReturnPct)}</strong>
          </div>
          <div style={{ fontSize: 12 }}>
            <span style={{ color: 'var(--text-2)' }}>{benchmark}: </span>
            <strong style={{ color: benchmarkReturnPct >= 0 ? 'var(--green)' : 'var(--red)' }}>{fmtPct(benchmarkReturnPct)}</strong>
          </div>
          {diff !== null && (
            <div style={{ fontSize: 12, fontWeight: 700, color: diff >= 0 ? 'var(--green)' : 'var(--red)' }}>
              {diff >= 0 ? `Beating ${benchmark} by ${fmtPct(Math.abs(diff))}` : `Trailing ${benchmark} by ${fmtPct(Math.abs(diff))}`}
            </div>
          )}
        </div>
      )}

      {loading && <div style={{ fontSize: 11, color: 'var(--text-3)', padding: '20px 0', textAlign: 'center' }}>Loading benchmark data…</div>}
      {error && <div style={{ fontSize: 11, color: 'var(--red)', padding: '10px 0' }}>{error}</div>}
      {!loading && !error && chartPoints.length >= 2 && (
        <BenchmarkLineChart benchmarkPoints={chartPoints} benchmarkLabel={benchmark} portfolioReturnPct={portfolioReturnPct} />
      )}
      {!loading && !error && chartPoints.length < 2 && (
        <div style={{ fontSize: 11, color: 'var(--text-3)', padding: '20px 0', textAlign: 'center' }}>No benchmark data available for this range</div>
      )}
    </div>
  )
}

function BenchmarkLineChart({ benchmarkPoints, benchmarkLabel, portfolioReturnPct }: {
  benchmarkPoints: { date: string; norm: number }[]
  benchmarkLabel: string
  portfolioReturnPct: number
}) {
  const W = 600, H = 160, padL = 50, padR = 20, padT = 16, padB = 30

  if (benchmarkPoints.length < 2) return null

  const bmValues = benchmarkPoints.map(p => p.norm)
  const allValues = [...bmValues, 0, portfolioReturnPct]
  const minV = Math.min(...allValues)
  const maxV = Math.max(...allValues, minV + 1)
  const rangeV = maxV - minV

  const toY = (v: number) => padT + (1 - (v - minV) / rangeV) * H

  // Benchmark line
  const bmPts = benchmarkPoints.map((p, i) => ({
    x: padL + (i / (benchmarkPoints.length - 1)) * (W - padL - padR),
    y: toY(p.norm),
  }))
  const bmPolyline = bmPts.map(p => `${p.x},${p.y}`).join(' ')

  // Portfolio flat line (single return value projected over same period)
  const portStartY = toY(0)
  const portEndY = toY(portfolioReturnPct)
  const portLine = `M ${padL} ${portStartY} L ${W - padR} ${portEndY}`

  const zeroY = toY(0)

  return (
    <svg viewBox={`0 0 ${W} ${H + padT + padB}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      {/* Zero line */}
      <line x1={padL} y1={zeroY} x2={W - padR} y2={zeroY} stroke="var(--border)" strokeWidth="1" strokeDasharray="4,3" />

      {/* Grid lines */}
      {[-20, -10, 0, 10, 20, 30].map(v => {
        const y = toY(v)
        if (y < padT || y > padT + H) return null
        return (
          <g key={v}>
            <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="var(--border)" strokeWidth="0.5" />
            <text x={padL - 4} y={y + 4} textAnchor="end" fontSize="8" fill="var(--text-3)">{v > 0 ? '+' : ''}{v}%</text>
          </g>
        )
      })}

      {/* Benchmark line */}
      <polyline points={bmPolyline} fill="none" stroke="#4a9eff" strokeWidth="1.5" />

      {/* Portfolio line */}
      <path d={portLine} fill="none" stroke="var(--accent)" strokeWidth="2" strokeDasharray="6,3" />

      {/* Labels */}
      {benchmarkPoints.filter((_, i) => i % Math.ceil(benchmarkPoints.length / 6) === 0).map((p, i) => {
        const x = padL + (benchmarkPoints.indexOf(p) / (benchmarkPoints.length - 1)) * (W - padL - padR)
        return <text key={i} x={x} y={padT + H + 20} textAnchor="middle" fontSize="8" fill="var(--text-3)">{p.date.slice(0, 7)}</text>
      })}

      {/* Legend */}
      <rect x={W - padR - 130} y={padT} width="8" height="8" fill="#4a9eff" rx="1" />
      <text x={W - padR - 118} y={padT + 7} fontSize="9" fill="var(--text-2)">{benchmarkLabel}</text>
      <line x1={W - padR - 130} y1={padT + 18} x2={W - padR - 122} y2={padT + 18} stroke="var(--accent)" strokeWidth="2" strokeDasharray="4,2" />
      <text x={W - padR - 118} y={padT + 22} fontSize="9" fill="var(--text-2)">Portfolio</text>
    </svg>
  )
}

// ─── Income Projection Calendar ───────────────────────────────────────────────

function IncomeCalendar({ holdings, stockInfos }: {
  holdings: Holding[]
  stockInfos: Record<string, StockInfo>
}) {
  if (holdings.length === 0) return null

  const now = new Date()
  const currentMonth = now.getMonth()
  const currentYear = now.getFullYear()

  // Build monthly income projections for next 12 months
  const monthlyIncome: { label: string; amount: number; payments: { ticker: string; amount: number }[] }[] = []

  for (let i = 0; i < 12; i++) {
    const d = new Date(currentYear, currentMonth + i, 1)
    const month = d.getMonth()
    const year = d.getFullYear()
    const label = `${MONTHS[month]} ${year}`
    const payments: { ticker: string; amount: number }[] = []

    for (const h of holdings) {
      const info = stockInfos[h.ticker]
      const annualDiv = h.divOverrideAnnual ?? info?.dividendPerShareAnnual ?? h.annualDividend ?? 0
      if (annualDiv <= 0) continue

      const freq = info?.dividendFrequency?.toLowerCase() || 'quarterly'

      let payMonths: number[] = []
      if (freq.includes('month')) {
        payMonths = [month]
      } else if (freq.includes('quarter')) {
        // Pay in Mar, Jun, Sep, Dec (typical), or match history
        if (info?.dividendHistory?.length) {
          const payMonthSet = new Set(info.dividendHistory.slice(-4).map(d => new Date(d.date).getMonth()))
          payMonths = Array.from(payMonthSet)
        } else {
          payMonths = [2, 5, 8, 11]
        }
        payMonths = payMonths.filter(m => m === month)
      } else if (freq.includes('semi') || freq.includes('bi-ann')) {
        payMonths = [5, 11].filter(m => m === month)
      } else if (freq.includes('ann')) {
        const histMonth = info?.dividendHistory?.length ? new Date(info.dividendHistory[0].date).getMonth() : 11
        payMonths = histMonth === month ? [month] : []
      } else {
        // Default quarterly
        payMonths = [2, 5, 8, 11].filter(m => m === month)
      }

      if (payMonths.length > 0) {
        const divPerPayment = freq.includes('month') ? annualDiv / 12
          : freq.includes('quarter') ? annualDiv / 4
          : freq.includes('semi') ? annualDiv / 2
          : annualDiv
        const totalPayment = divPerPayment * h.shares
        if (totalPayment > 0) {
          payments.push({ ticker: h.ticker, amount: totalPayment })
        }
      }
      void year // suppress unused warning
    }

    monthlyIncome.push({ label, amount: payments.reduce((s, p) => s + p.amount, 0), payments })
  }

  const thisMonthIncome = monthlyIncome[0]?.amount || 0
  const next3Income = monthlyIncome.slice(0, 3).reduce((s, m) => s + m.amount, 0)
  const maxIncome = Math.max(...monthlyIncome.map(m => m.amount), 1)

  return (
    <div style={{ marginTop: 24, background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8, padding: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-2)', marginBottom: 12 }}>INCOME PROJECTION CALENDAR</div>

      {/* Summary */}
      <div style={{ display: 'flex', gap: 20, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 14px' }}>
          <div style={{ fontSize: 9, color: 'var(--text-3)', fontWeight: 600, letterSpacing: '0.06em', marginBottom: 2 }}>THIS MONTH</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--green)', fontFamily: 'var(--mono)' }}>{fmtDollar(thisMonthIncome)}</div>
        </div>
        <div style={{ background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 14px' }}>
          <div style={{ fontSize: 9, color: 'var(--text-3)', fontWeight: 600, letterSpacing: '0.06em', marginBottom: 2 }}>NEXT 3 MONTHS</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--green)', fontFamily: 'var(--mono)' }}>{fmtDollar(next3Income)}</div>
        </div>
      </div>

      {/* Bar chart */}
      <svg viewBox="0 0 700 140" style={{ width: '100%', height: 'auto', display: 'block', marginBottom: 8 }}>
        {monthlyIncome.map((m, i) => {
          const barW = 50
          const barGap = 8
          const padL = 20
          const H = 90
          const padT = 10
          const bh = maxIncome > 0 ? (m.amount / maxIncome) * H : 0
          const x = padL + i * (barW + barGap)
          const y = padT + H - bh
          const isCurrentMonth = i === 0
          return (
            <g key={i}>
              <rect x={x} y={y} width={barW} height={bh} rx="3"
                fill={isCurrentMonth ? 'var(--accent)' : 'var(--green)'} opacity={isCurrentMonth ? 1 : 0.7} />
              {bh > 14 && <text x={x + barW / 2} y={y + 12} textAnchor="middle" fontSize="7.5" fill="#fff">{fmtDollar(m.amount)}</text>}
              <text x={x + barW / 2} y={padT + H + 14} textAnchor="middle" fontSize="8" fill="var(--text-3)">{m.label.slice(0, 3)}</text>
            </g>
          )
        })}
      </svg>

      {/* Upcoming payments detail */}
      {monthlyIncome.slice(0, 3).map((m, i) => m.payments.length > 0 && (
        <div key={i} style={{ marginBottom: 6 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-2)', marginBottom: 3 }}>{m.label} — {fmtDollar(m.amount)}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {m.payments.map(p => (
              <span key={p.ticker} style={{ fontSize: 10, background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 4, padding: '2px 6px', color: 'var(--green)' }}>
                {p.ticker}: {fmtDollar(p.amount)}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Tax Estimation Tab ────────────────────────────────────────────────────────

function TaxTab({ holdings, soldPositions, stockInfos }: {
  holdings: Holding[]
  soldPositions: SoldPosition[]
  stockInfos: Record<string, StockInfo>
}) {
  const [bracket, setBracket] = useState('22')
  const [costBasisMethod, setCostBasisMethod] = useState<'FIFO' | 'LIFO' | 'SpecificLot'>('FIFO')

  // Realized gains/losses from sold positions
  const realizedLots: TaxLot[] = soldPositions.map(s => {
    const buyDate = new Date(s.buyDate || s.dateSold)
    const sellDate = new Date(s.dateSold)
    const holdDays = Math.floor((sellDate.getTime() - buyDate.getTime()) / (1000 * 60 * 60 * 24))
    const isLongTerm = holdDays > 365
    const gainLoss = s.shares * (s.salePrice - s.avgCost)
    return {
      id: s.id,
      symbol: s.ticker,
      buyDate: s.buyDate || 'N/A',
      sellDate: s.dateSold,
      shares: s.shares,
      buyPrice: s.avgCost,
      sellPrice: s.salePrice,
      gainLoss,
      isLongTerm,
    }
  })

  // Apply cost basis method ordering
  const sortedLots = [...realizedLots].sort((a, b) => {
    if (costBasisMethod === 'FIFO') return new Date(a.buyDate).getTime() - new Date(b.buyDate).getTime()
    if (costBasisMethod === 'LIFO') return new Date(b.buyDate).getTime() - new Date(a.buyDate).getTime()
    return a.gainLoss - b.gainLoss // SpecificLot: sort by gain/loss (lowest first = tax-loss harvesting)
  })

  const shortTermGains = sortedLots.filter(l => !l.isLongTerm && l.gainLoss > 0).reduce((s, l) => s + l.gainLoss, 0)
  const shortTermLosses = sortedLots.filter(l => !l.isLongTerm && l.gainLoss < 0).reduce((s, l) => s + l.gainLoss, 0)
  const longTermGains = sortedLots.filter(l => l.isLongTerm && l.gainLoss > 0).reduce((s, l) => s + l.gainLoss, 0)
  const longTermLosses = sortedLots.filter(l => l.isLongTerm && l.gainLoss < 0).reduce((s, l) => s + l.gainLoss, 0)

  const netShortTerm = shortTermGains + shortTermLosses
  const netLongTerm = longTermGains + longTermLosses

  const shortTermRate = parseFloat(bracket) / 100
  const longTermRate = 0.15 // Standard long-term rate

  const shortTermTax = Math.max(0, netShortTerm * shortTermRate)
  const longTermTax = Math.max(0, netLongTerm * longTermRate)
  const totalEstimatedTax = shortTermTax + longTermTax

  // Unrealized gains/losses from current holdings
  const unrealizedLots = holdings.map(h => {
    const currentPrice = stockInfos[h.ticker]?.currentPrice || h.avgCost
    const gainLoss = h.shares * (currentPrice - h.avgCost)
    const buyDate = new Date(h.buyDate || Date.now())
    const holdDays = Math.floor((Date.now() - buyDate.getTime()) / (1000 * 60 * 60 * 24))
    const isLongTerm = holdDays > 365
    return { symbol: h.ticker, buyDate: h.buyDate, shares: h.shares, avgCost: h.avgCost, currentPrice, gainLoss, isLongTerm }
  })

  const unrealizedGain = unrealizedLots.reduce((s, l) => s + l.gainLoss, 0)

  const handleExportTaxCSV = () => {
    const headers = ['Symbol', 'Buy Date', 'Sell Date', 'Shares', 'Buy Price', 'Sell Price', 'Gain/Loss', 'Term', 'Est Tax (15%/bracket)']
    const rows = sortedLots.map(l => {
      const rate = l.isLongTerm ? 0.15 : shortTermRate
      const tax = l.gainLoss > 0 ? l.gainLoss * rate : 0
      return [l.symbol, l.buyDate, l.sellDate, String(l.shares), fmt(l.buyPrice), fmt(l.sellPrice), fmt(l.gainLoss), l.isLongTerm ? 'Long-Term' : 'Short-Term', fmt(tax)]
    })
    exportCSV(`tax-report-${new Date().toISOString().slice(0, 10)}.csv`, rows, headers)
  }

  return (
    <div>
      {/* DISCLAIMER */}
      <div style={{ background: 'rgba(255,165,0,0.12)', border: '2px solid rgba(255,165,0,0.4)', borderRadius: 8, padding: '12px 16px', marginBottom: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#f59e0b', marginBottom: 4 }}>(!) Tax Estimation Tool — For informational purposes only</div>
        <div style={{ fontSize: 11, color: 'var(--text-1)', lineHeight: 1.5 }}>
          Not tax advice. Calculations are approximate and may not reflect your actual tax situation.
          Always consult a qualified tax professional before making financial decisions.{' '}
          <a href="/legal/disclaimer" style={{ color: 'var(--accent)', textDecoration: 'none' }}>Read full disclaimer</a>
        </div>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div>
          <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 4 }}>
            Cost Basis Method
            <Tooltip text="How your broker determines which shares were sold. FIFO sells oldest shares first (common default). LIFO sells newest first. Specific Lot lets you choose which shares to sell for tax optimization." position="right" />
          </label>
          <select style={{ ...inputStyle, width: 'auto' }} value={costBasisMethod}
            onChange={e => setCostBasisMethod(e.target.value as 'FIFO' | 'LIFO' | 'SpecificLot')}>
            <option value="FIFO">FIFO (First In, First Out)</option>
            <option value="LIFO">LIFO (Last In, First Out)</option>
            <option value="SpecificLot">Specific Lot (Tax-Loss Harvesting)</option>
          </select>
        </div>
        <div>
          <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 4 }}>
            Your Short-Term Tax Bracket
            <Tooltip text="Short-term gains (held under 1 year) are taxed as ordinary income at your regular tax rate. Long-term gains (held over 1 year) get a lower rate: 0%, 15%, or 20%." position="right" />
          </label>
          <select style={{ ...inputStyle, width: 'auto' }} value={bracket} onChange={e => setBracket(e.target.value)}>
            <option value="10">10%</option>
            <option value="12">12%</option>
            <option value="22">22%</option>
            <option value="24">24%</option>
            <option value="32">32%</option>
            <option value="35">35%</option>
            <option value="37">37%</option>
          </select>
        </div>
        {sortedLots.length > 0 && (
          <button onClick={handleExportTaxCSV} style={{ fontSize: 11, color: 'var(--text-2)', cursor: 'pointer', padding: '5px 10px', border: '1px solid var(--border)', borderRadius: 4, background: 'transparent' }}>↓ Export CSV</button>
        )}
      </div>

      {/* Summary cards */}
      <div className="kpi-grid" style={{ marginBottom: 24 }}>
        <KpiCard label="NET SHORT-TERM" value={fmtDollar(netShortTerm)} color={netShortTerm >= 0 ? 'var(--red)' : 'var(--green)'} sub={`Rate: ${bracket}%`} tooltip="Net gains/losses from positions held LESS than 1 year. Short-term gains are taxed at your ordinary income rate (same as your salary)." />
        <KpiCard label="NET LONG-TERM" value={fmtDollar(netLongTerm)} color={netLongTerm >= 0 ? 'var(--yellow)' : 'var(--green)'} sub="Rate: 15%" tooltip="Net gains/losses from positions held MORE than 1 year. Long-term gains get preferential tax rates: 0%, 15%, or 20% depending on your income. Holding over 1 year saves taxes!" />
        <KpiCard label="EST. TAX OWED" value={fmtDollar(totalEstimatedTax)} color="var(--red)" tooltip="Rough estimate of taxes owed on your realized gains. This is approximate — consult a tax professional for your actual liability." />
        <KpiCard label="UNREALIZED GAIN" value={fmtDollar(unrealizedGain)} color={unrealizedGain >= 0 ? 'var(--green)' : 'var(--red)'} sub="If sold today" tooltip="Profit or loss on positions you still hold. You don't owe taxes on this until you actually sell. Sometimes called 'paper gains/losses'." />
      </div>

      {/* Realized lots table */}
      {sortedLots.length > 0 ? (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-2)', marginBottom: 8, letterSpacing: '0.06em' }}>REALIZED GAINS / LOSSES ({sortedLots.length} lots)</div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead>
                <tr style={{ background: 'var(--bg-2)', borderBottom: '1px solid var(--border)' }}>
                  {['SYMBOL', 'BUY DATE', 'SELL DATE', 'SHARES', 'BUY PRICE', 'SELL PRICE', 'GAIN/LOSS', 'TERM', 'EST. TAX'].map(h => (
                    <th key={h} style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-3)', padding: '8px 10px', textAlign: 'right' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedLots.map(lot => {
                  const rate = lot.isLongTerm ? 0.15 : shortTermRate
                  const tax = lot.gainLoss > 0 ? lot.gainLoss * rate : 0
                  return (
                    <tr key={lot.id} style={{ background: 'var(--bg-1)', borderBottom: '1px solid var(--border-b)' }}>
                      <td style={{ padding: '8px 10px', fontSize: 11, textAlign: 'right', fontWeight: 700 }}>{lot.symbol}</td>
                      <td style={{ padding: '8px 10px', fontSize: 11, textAlign: 'right', color: 'var(--text-2)' }}>{lot.buyDate}</td>
                      <td style={{ padding: '8px 10px', fontSize: 11, textAlign: 'right', color: 'var(--text-2)' }}>{lot.sellDate}</td>
                      <td style={{ padding: '8px 10px', fontSize: 11, textAlign: 'right', fontFamily: 'var(--mono)' }}>{lot.shares}</td>
                      <td style={{ padding: '8px 10px', fontSize: 11, textAlign: 'right', fontFamily: 'var(--mono)' }}>${fmt(lot.buyPrice)}</td>
                      <td style={{ padding: '8px 10px', fontSize: 11, textAlign: 'right', fontFamily: 'var(--mono)' }}>${fmt(lot.sellPrice)}</td>
                      <td style={{ padding: '8px 10px', fontSize: 11, textAlign: 'right', fontFamily: 'var(--mono)', color: lot.gainLoss >= 0 ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>
                        {fmtDollar(lot.gainLoss)}
                      </td>
                      <td style={{ padding: '8px 10px', fontSize: 11, textAlign: 'right' }}>
                        <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 10, background: lot.isLongTerm ? 'rgba(0,192,106,0.12)' : 'rgba(255,107,53,0.12)', color: lot.isLongTerm ? 'var(--green)' : 'var(--yellow)' }}>
                          {lot.isLongTerm ? 'LT' : 'ST'}
                        </span>
                      </td>
                      <td style={{ padding: '8px 10px', fontSize: 11, textAlign: 'right', fontFamily: 'var(--mono)', color: 'var(--red)' }}>
                        {tax > 0 ? fmtDollar(tax) : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-3)', border: '1px dashed var(--border)', borderRadius: 8, marginBottom: 24 }}>
          <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 6 }}>No sold positions yet</div>
          <div style={{ fontSize: 11 }}>Add closed positions in the Sold tab to see tax estimates.</div>
        </div>
      )}

      {/* Unrealized gains table */}
      {unrealizedLots.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-2)', marginBottom: 8, letterSpacing: '0.06em' }}>UNREALIZED GAINS / LOSSES</div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead>
                <tr style={{ background: 'var(--bg-2)', borderBottom: '1px solid var(--border)' }}>
                  {['SYMBOL', 'BUY DATE', 'SHARES', 'AVG COST', 'CURRENT PRICE', 'UNREALIZED G/L', 'TERM IF SOLD TODAY', 'EST. TAX IF SOLD'].map(h => (
                    <th key={h} style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-3)', padding: '8px 10px', textAlign: 'right' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {unrealizedLots.map(lot => {
                  const rate = lot.isLongTerm ? 0.15 : shortTermRate
                  const tax = lot.gainLoss > 0 ? lot.gainLoss * rate : 0
                  return (
                    <tr key={lot.symbol} style={{ background: 'var(--bg-1)', borderBottom: '1px solid var(--border-b)' }}>
                      <td style={{ padding: '8px 10px', fontSize: 11, textAlign: 'right', fontWeight: 700 }}>{lot.symbol}</td>
                      <td style={{ padding: '8px 10px', fontSize: 11, textAlign: 'right', color: 'var(--text-2)' }}>{lot.buyDate}</td>
                      <td style={{ padding: '8px 10px', fontSize: 11, textAlign: 'right', fontFamily: 'var(--mono)' }}>{lot.shares}</td>
                      <td style={{ padding: '8px 10px', fontSize: 11, textAlign: 'right', fontFamily: 'var(--mono)' }}>${fmt(lot.avgCost)}</td>
                      <td style={{ padding: '8px 10px', fontSize: 11, textAlign: 'right', fontFamily: 'var(--mono)' }}>${fmt(lot.currentPrice)}</td>
                      <td style={{ padding: '8px 10px', fontSize: 11, textAlign: 'right', fontFamily: 'var(--mono)', color: lot.gainLoss >= 0 ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>
                        {fmtDollar(lot.gainLoss)}
                      </td>
                      <td style={{ padding: '8px 10px', fontSize: 11, textAlign: 'right' }}>
                        <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 10, background: lot.isLongTerm ? 'rgba(0,192,106,0.12)' : 'rgba(255,107,53,0.12)', color: lot.isLongTerm ? 'var(--green)' : 'var(--yellow)' }}>
                          {lot.isLongTerm ? 'Long-Term' : 'Short-Term'}
                        </span>
                      </td>
                      <td style={{ padding: '8px 10px', fontSize: 11, textAlign: 'right', fontFamily: 'var(--mono)', color: 'var(--red)' }}>
                        {tax > 0 ? fmtDollar(tax) : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Feature: Ex-Dividend Date Alerts ─────────────────────────────────────────

type HoldingEnrichedWithDiv = Holding & {
  currentPrice: number; marketValue: number; marketReturnPct: number; annualDivIncome: number; divYield: number
}

function computeNextExDiv(dividendHistory: { date: string; amount: number }[]): { date: Date; daysAway: number } | null {
  if (!dividendHistory || dividendHistory.length < 2) return null
  const sorted = [...dividendHistory].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  const lastDate = new Date(sorted[0].date)

  // Compute average interval in days
  let totalDays = 0, count = 0
  for (let i = 0; i < Math.min(sorted.length - 1, 8); i++) {
    const diff = new Date(sorted[i].date).getTime() - new Date(sorted[i + 1].date).getTime()
    totalDays += diff / (1000 * 60 * 60 * 24)
    count++
  }
  if (count === 0) return null
  const avgInterval = totalDays / count

  // Project next ex-div date
  const now = new Date()
  let next = new Date(lastDate.getTime() + avgInterval * 24 * 60 * 60 * 1000)
  // If projected is in the past, keep adding intervals until future
  while (next <= now) {
    next = new Date(next.getTime() + avgInterval * 24 * 60 * 60 * 1000)
  }
  const daysAway = Math.ceil((next.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  return { date: next, daysAway }
}

function ExDivAlerts({ holdingsEnriched, stockInfos }: {
  holdingsEnriched: HoldingEnrichedWithDiv[]
  stockInfos: Record<string, StockInfo>
}) {
  const alerts = holdingsEnriched
    .map(h => {
      const info = stockInfos[h.ticker]
      if (!info?.dividendHistory?.length) return null
      const next = computeNextExDiv(info.dividendHistory)
      if (!next) return null
      return { ticker: h.ticker, ...next }
    })
    .filter((a): a is { ticker: string; date: Date; daysAway: number } => a !== null && a.daysAway <= 14)
    .sort((a, b) => a.daysAway - b.daysAway)

  if (alerts.length === 0) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {alerts.map(a => {
        const urgent = a.daysAway <= 3
        const soon = a.daysAway <= 7
        const color = urgent ? '#ef4444' : soon ? '#f59e0b' : 'var(--text-2)'
        const bg = urgent ? 'rgba(239,68,68,0.1)' : soon ? 'rgba(245,158,11,0.1)' : 'var(--bg-2)'
        const border = urgent ? '#ef4444' : soon ? '#f59e0b' : 'var(--border)'
        const label = a.daysAway === 0 ? 'today' : a.daysAway === 1 ? 'tomorrow' : `in ${a.daysAway} days`
        return (
          <div key={a.ticker} style={{ background: bg, border: `1px solid ${border}`, borderRadius: 6, padding: '8px 14px', fontSize: 12, color, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span>[cal]</span>
            <span><strong>{a.ticker}</strong> goes ex-dividend <strong>{label}</strong> ({a.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })})</span>
          </div>
        )
      })}
    </div>
  )
}

// ─── Feature: DRIP Summary ────────────────────────────────────────────────────

// ─── Portfolio Risk Score ─────────────────────────────────────────────────────

function PortfolioRiskScore({ holdingsEnriched, stockInfos, totalMarketValue }: {
  holdingsEnriched: HoldingEnrichedWithDiv[]
  stockInfos: Record<string, StockInfo>
  totalMarketValue: number
}) {
  if (holdingsEnriched.length === 0 || totalMarketValue <= 0) return null

  // Calculate components
  // 1. Concentration risk (0-30 pts): top holding weight
  const weights = holdingsEnriched.map(h => h.marketValue / totalMarketValue)
  const maxWeight = Math.max(...weights)
  const concentrationScore = Math.round(Math.min(30, maxWeight * 100 * 0.5))

  // 2. Sector risk (0-20 pts): HHI index
  const sectorPcts: Record<string, number> = {}
  holdingsEnriched.forEach(h => {
    const s = h.sector || 'Other'
    sectorPcts[s] = (sectorPcts[s] || 0) + h.marketValue / totalMarketValue * 100
  })
  const hhi = Object.values(sectorPcts).reduce((s, p) => s + Math.pow(p / 100, 2), 0)
  const sectorScore = Math.round(hhi * 20)

  // 3. Beta risk (0-25 pts): portfolio beta
  let betaSum = 0, betaWeight = 0
  holdingsEnriched.forEach(h => {
    const beta = stockInfos[h.ticker]?.beta
    if (beta != null && h.marketValue > 0) {
      betaSum += beta * (h.marketValue / totalMarketValue)
      betaWeight += h.marketValue / totalMarketValue
    }
  })
  const portfolioBeta = betaWeight > 0 ? betaSum / betaWeight : 1
  const betaScore = Math.round(Math.min(25, Math.max(0, (portfolioBeta - 0.5) * 25)))

  // 4. Diversification (0-25 pts): number of holdings
  const numHoldings = holdingsEnriched.length
  const divScore = numHoldings <= 2 ? 20 : numHoldings <= 4 ? 12 : numHoldings <= 7 ? 6 : 2

  const totalScore = Math.min(100, concentrationScore + sectorScore + betaScore + divScore)

  const level = totalScore <= 25 ? 'Low' : totalScore <= 50 ? 'Moderate' : totalScore <= 75 ? 'High' : 'Extreme'
  const levelColor = { Low: 'var(--green)', Moderate: 'var(--yellow)', High: '#f97316', Extreme: 'var(--red)' }[level]

  // Generate recommendations
  const recs: string[] = []
  if (maxWeight > 0.30) recs.push(`${holdingsEnriched.find(h => h.marketValue / totalMarketValue >= maxWeight - 0.001)?.ticker || 'Top holding'} is ${(maxWeight * 100).toFixed(0)}% of portfolio — consider trimming`)
  const dominantSector = Object.entries(sectorPcts).sort((a, b) => b[1] - a[1])[0]
  if (dominantSector && dominantSector[1] > 50) recs.push(`${dominantSector[1].toFixed(0)}% in ${dominantSector[0]} — diversify across sectors`)
  if (portfolioBeta > 1.4) recs.push(`Beta ${portfolioBeta.toFixed(2)} is elevated — portfolio moves more than the market`)
  if (numHoldings < 5) recs.push(`Only ${numHoldings} holding${numHoldings > 1 ? 's' : ''} — consider adding uncorrelated assets`)
  if (recs.length === 0) recs.push('Portfolio risk profile looks balanced. Continue monitoring.')

  // SVG Gauge
  const gaugeAngle = (totalScore / 100) * 180
  const cx = 80, cy = 80, r = 60
  const toRad = (a: number) => (a - 180) * Math.PI / 180
  const gaugeX = cx + r * Math.cos(toRad(gaugeAngle))
  const gaugeY = cy + r * Math.sin(toRad(gaugeAngle))

  return (
    <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8, padding: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-2)', marginBottom: 12 }}>PORTFOLIO RISK SCORE</div>
      <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: 20, alignItems: 'center' }}>
        {/* Gauge */}
        <div style={{ textAlign: 'center' }}>
          <svg viewBox="0 0 160 100" width="160" height="100">
            {/* Background arc */}
            <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} fill="none" stroke="var(--bg-1)" strokeWidth="14" />
            {/* Colored arc segments */}
            {[
              { from: 0, to: 25, color: 'var(--green)' },
              { from: 25, to: 50, color: 'var(--yellow)' },
              { from: 50, to: 75, color: '#f97316' },
              { from: 75, to: 100, color: 'var(--red)' },
            ].map((seg, i) => {
              const startAngle = (seg.from / 100) * 180
              const endAngle = (seg.to / 100) * 180
              const x1 = cx + r * Math.cos(toRad(startAngle))
              const y1 = cy + r * Math.sin(toRad(startAngle))
              const x2 = cx + r * Math.cos(toRad(endAngle))
              const y2 = cy + r * Math.sin(toRad(endAngle))
              return (
                <path key={i}
                  d={`M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}`}
                  fill="none" stroke={seg.color} strokeWidth="14" opacity="0.7" />
              )
            })}
            {/* Needle */}
            <line x1={cx} y1={cy} x2={gaugeX} y2={gaugeY} stroke="var(--text-0)" strokeWidth="2.5" strokeLinecap="round" />
            <circle cx={cx} cy={cy} r="5" fill="var(--text-0)" />
            {/* Score */}
            <text x={cx} y={cy + 22} textAnchor="middle" fontSize="20" fontWeight="800" fill={levelColor} fontFamily="var(--mono)">{totalScore}</text>
            <text x={cx} y={cy + 34} textAnchor="middle" fontSize="9" fill="var(--text-3)">out of 100</text>
          </svg>
          <div style={{ fontSize: 14, fontWeight: 800, color: levelColor, marginTop: -4 }}>{level} Risk</div>
        </div>

        {/* Breakdown + recs */}
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
            {[
              { label: 'Concentration', score: concentrationScore, max: 30 },
              { label: 'Sector exposure', score: sectorScore, max: 20 },
              { label: 'Beta', score: betaScore, max: 25 },
              { label: 'Diversification', score: divScore, max: 25 },
            ].map(c => (
              <div key={c.label} style={{ fontSize: 11 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span style={{ color: 'var(--text-2)' }}>{c.label}</span>
                  <span style={{ color: 'var(--text-1)', fontFamily: 'var(--mono)' }}>{c.score}/{c.max}</span>
                </div>
                <div style={{ height: 4, background: 'var(--bg-1)', borderRadius: 2 }}>
                  <div style={{ height: '100%', width: `${(c.score / c.max) * 100}%`, background: c.score > c.max * 0.66 ? 'var(--red)' : c.score > c.max * 0.33 ? 'var(--yellow)' : 'var(--green)', borderRadius: 2 }} />
                </div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-3)', marginBottom: 4, fontWeight: 700, letterSpacing: '0.05em' }}>RECOMMENDATIONS</div>
          {recs.map((r, i) => (
            <div key={i} style={{ fontSize: 11, color: 'var(--text-2)', padding: '3px 0', borderBottom: '1px solid var(--border)' }}>
              {totalScore > 50 ? '⚠ ' : '• '}{r}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function DRIPSummary({ holdingsEnriched, stockInfos, portfolioSettings }: {
  holdingsEnriched: HoldingEnrichedWithDiv[]
  stockInfos: Record<string, StockInfo>
  portfolioSettings: PortfolioSettings
}) {
  const dripHoldings = holdingsEnriched.filter(h => portfolioSettings.dripEnabled[h.ticker])
  if (dripHoldings.length === 0) return null

  const items = dripHoldings.map(h => {
    const info = stockInfos[h.ticker]
    const history = info?.dividendHistory || []
    const buyDate = h.buyDate ? new Date(h.buyDate) : null
    let dripShares = 0
    let dripValue = 0
    history.forEach(div => {
      const divDate = new Date(div.date)
      if (buyDate && divDate <= buyDate) return
      const priceAtDiv = h.currentPrice || h.avgCost // approximate with current price
      if (priceAtDiv > 0) {
        const reinvestedShares = (div.amount * h.shares) / priceAtDiv
        dripShares += reinvestedShares
      }
    })
    dripValue = dripShares * (h.currentPrice || h.avgCost)
    return { ticker: h.ticker, dripShares, dripValue, currentPrice: h.currentPrice }
  }).filter(x => x.dripShares > 0)

  if (items.length === 0) return null

  const totalDripValue = items.reduce((s, x) => s + x.dripValue, 0)
  return (
    <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8, padding: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-2)', marginBottom: 12 }}>
        DRIP REINVESTMENT SUMMARY
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10, marginBottom: 12 }}>
        {items.map(x => (
          <div key={x.ticker} style={{ background: 'var(--bg-3)', borderRadius: 6, padding: '10px 12px', fontSize: 12 }}>
            <div style={{ fontWeight: 700, color: 'var(--text-0)', marginBottom: 4 }}>{x.ticker}</div>
            <div style={{ color: 'var(--green)' }}>+{x.dripShares.toFixed(4)} shares reinvested</div>
            <div style={{ color: 'var(--text-2)', fontSize: 11 }}>Worth {fmtDollar(x.dripValue)} today</div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-2)' }}>
        DRIP added an estimated <strong style={{ color: 'var(--green)' }}>{fmtDollar(totalDripValue)}</strong> in compounded value across {items.length} holding{items.length > 1 ? 's' : ''}.
      </div>
      <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 6 }}>
        * Approximate — uses current price as proxy for price at each dividend payment.
      </div>
    </div>
  )
}

// ─── Feature: Asset Allocation Targets ───────────────────────────────────────

function AllocationTargetsSection({ holdingsEnriched, totalMarketValue, portfolioSettings, savePortfolioSettings }: {
  holdingsEnriched: HoldingEnrichedWithDiv[]
  totalMarketValue: number
  portfolioSettings: PortfolioSettings
  savePortfolioSettings: (s: PortfolioSettings) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [draftTargets, setDraftTargets] = useState<AllocationTarget[]>([])
  const [newSector, setNewSector] = useState(SECTORS[0])
  const [newPct, setNewPct] = useState('')

  const targets = portfolioSettings.allocationTargets || []

  // Current sector breakdown
  const sectorValues: Record<string, number> = {}
  holdingsEnriched.forEach(h => {
    const s = h.sector || 'Other'
    sectorValues[s] = (sectorValues[s] || 0) + h.marketValue
  })

  const startEdit = () => {
    setDraftTargets([...targets])
    setEditing(true)
  }
  const cancelEdit = () => setEditing(false)
  const saveTargets = async () => {
    await savePortfolioSettings({ ...portfolioSettings, allocationTargets: draftTargets })
    setEditing(false)
  }
  const addTarget = () => {
    const pct = parseFloat(newPct)
    if (isNaN(pct) || pct <= 0 || pct > 100) return
    setDraftTargets(prev => {
      const existing = prev.find(t => t.sector === newSector)
      if (existing) return prev.map(t => t.sector === newSector ? { ...t, targetPct: pct } : t)
      return [...prev, { sector: newSector, targetPct: pct }]
    })
    setNewPct('')
  }
  const removeTarget = (sector: string) => setDraftTargets(prev => prev.filter(t => t.sector !== sector))

  if (targets.length === 0 && !editing) {
    return (
      <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8, padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-2)' }}>ALLOCATION TARGETS</div>
          <button onClick={startEdit} style={{ fontSize: 11, cursor: 'pointer', padding: '5px 10px', border: '1px solid var(--border)', borderRadius: 'var(--btn-radius)', background: 'var(--bg-3)', color: 'var(--text-1)' }}>Set Targets</button>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-3)' }}>Set target allocation percentages by sector to track rebalancing needs.</div>
      </div>
    )
  }

  const totalTargetPct = draftTargets.reduce((s, t) => s + t.targetPct, 0)

  return (
    <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8, padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-2)' }}>ALLOCATION TARGETS</div>
        {!editing ? (
          <button onClick={startEdit} style={{ fontSize: 11, cursor: 'pointer', padding: '5px 10px', border: '1px solid var(--border)', borderRadius: 'var(--btn-radius)', background: 'var(--bg-3)', color: 'var(--text-1)' }}>Edit Targets</button>
        ) : (
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={saveTargets} style={{ fontSize: 11, color: '#fff', cursor: 'pointer', padding: '4px 10px', border: 'none', borderRadius: 4, background: 'var(--accent)' }}>Save</button>
            <button onClick={cancelEdit} style={{ fontSize: 11, color: 'var(--text-2)', cursor: 'pointer', padding: '4px 10px', border: '1px solid var(--border)', borderRadius: 4, background: 'transparent' }}>Cancel</button>
          </div>
        )}
      </div>

      {editing && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <select value={newSector} onChange={e => setNewSector(e.target.value)} style={{ fontSize: 11, padding: '4px 8px', background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-0)', flex: 1 }}>
              {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <input type="number" value={newPct} onChange={e => setNewPct(e.target.value)} placeholder="%" min="0" max="100" style={{ fontSize: 11, padding: '4px 8px', background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-0)', width: 60 }} />
            <button onClick={addTarget} style={{ fontSize: 11, color: '#fff', cursor: 'pointer', padding: '4px 10px', border: 'none', borderRadius: 4, background: 'var(--accent)' }}>Add</button>
          </div>
          {totalTargetPct > 0 && <div style={{ fontSize: 10, color: totalTargetPct > 100 ? 'var(--red)' : 'var(--text-3)' }}>Total: {totalTargetPct.toFixed(1)}% {totalTargetPct > 100 ? '⚠ exceeds 100%' : ''}</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
            {draftTargets.map(t => (
              <div key={t.sector} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, background: 'var(--bg-3)', padding: '4px 8px', borderRadius: 4 }}>
                <span>{t.sector}</span>
                <span style={{ color: 'var(--accent)' }}>{t.targetPct}%</span>
                <button onClick={() => removeTarget(t.sector)} style={{ fontSize: 10, color: 'var(--red)', cursor: 'pointer', padding: '2px 4px' }}>✕</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Comparison table */}
      {targets.length > 0 && !editing && (
        <div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {targets.map(t => {
              const currentVal = sectorValues[t.sector] || 0
              const currentPct = totalMarketValue > 0 ? (currentVal / totalMarketValue) * 100 : 0
              const diff = currentPct - t.targetPct
              const overweight = diff > 2
              const underweight = diff < -2
              return (
                <div key={t.sector}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 3 }}>
                    <span style={{ color: 'var(--text-1)', fontWeight: 600 }}>{t.sector}</span>
                    <span style={{ color: overweight ? 'var(--red)' : underweight ? 'var(--yellow)' : 'var(--green)' }}>
                      {currentPct.toFixed(1)}% vs {t.targetPct}% target
                      {overweight && ` (+${diff.toFixed(1)}%)`}
                      {underweight && ` (${diff.toFixed(1)}%)`}
                    </span>
                  </div>
                  {/* Bar comparison */}
                  <div style={{ position: 'relative', height: 6, background: 'var(--bg-3)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${Math.min(currentPct, 100)}%`, background: SECTOR_COLORS[t.sector] || '#888', borderRadius: 3, opacity: 0.8 }} />
                    <div style={{ position: 'absolute', left: `${Math.min(t.targetPct, 100)}%`, top: 0, width: 2, height: '100%', background: 'var(--text-2)' }} />
                  </div>
                  {overweight && (
                    <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 2 }}>Based on your targets, your portfolio is overweight in {t.sector} by {diff.toFixed(1)}%</div>
                  )}
                  {underweight && (
                    <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 2 }}>Based on your targets, your portfolio is underweight in {t.sector} by {Math.abs(diff).toFixed(1)}%</div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Feature: Risk Metrics ────────────────────────────────────────────────────

function RiskMetricsSection({ holdingsEnriched, stockInfos, totalMarketValue }: {
  holdingsEnriched: HoldingEnrichedWithDiv[]
  stockInfos: Record<string, StockInfo>
  totalMarketValue: number
}) {
  // Portfolio Beta (weighted average)
  let betaSum = 0, betaWeight = 0
  holdingsEnriched.forEach(h => {
    const beta = stockInfos[h.ticker]?.beta
    if (beta != null && h.marketValue > 0 && totalMarketValue > 0) {
      betaSum += beta * (h.marketValue / totalMarketValue)
      betaWeight += h.marketValue / totalMarketValue
    }
  })
  const portfolioBeta = betaWeight > 0 ? betaSum / betaWeight : null

  // Volatility & Max Drawdown from daily return changes (use dayChangePct as proxy for 1-day returns)
  const dayReturns = holdingsEnriched
    .filter(h => stockInfos[h.ticker]?.dayChangePct != null)
    .map(h => {
      const wt = totalMarketValue > 0 ? h.marketValue / totalMarketValue : 0
      return (stockInfos[h.ticker]?.dayChangePct || 0) * wt
    })
  const portfolioDayReturn = dayReturns.reduce((s, r) => s + r, 0)

  // Annualized volatility estimate (from individual holding day changes, weighted)
  let volatility: number | null = null
  const returns: number[] = holdingsEnriched.map(h => {
    const wt = totalMarketValue > 0 ? h.marketValue / totalMarketValue : 0
    return ((stockInfos[h.ticker]?.dayChangePct || 0) / 100) * wt
  })
  if (returns.length > 1) {
    const mean = returns.reduce((s, r) => s + r, 0) / returns.length
    const variance = returns.reduce((s, r) => s + Math.pow(r - mean, 2), 0) / returns.length
    volatility = Math.sqrt(variance) * Math.sqrt(252) * 100 // annualized %
  }

  // Max Drawdown — use 52W high vs current as proxy
  let maxDrawdown: number | null = null
  const drawdowns: number[] = []
  holdingsEnriched.forEach(h => {
    const info = stockInfos[h.ticker]
    const high52 = info?.['52WeekHigh']
    const curr = info?.currentPrice
    if (high52 && curr && high52 > 0) {
      const dd = (curr - high52) / high52 * 100
      if (dd < 0) drawdowns.push(dd * (h.marketValue / totalMarketValue))
    }
  })
  if (drawdowns.length > 0) maxDrawdown = drawdowns.reduce((s, d) => s + d, 0)

  // Sharpe Ratio — (annualized return - risk-free) / volatility
  // Use total market return pct as annualized return approximation
  const totalReturnPct = holdingsEnriched.reduce((s, h) => {
    const wt = totalMarketValue > 0 ? h.marketValue / totalMarketValue : 0
    return s + ((h as HoldingEnrichedWithDiv & { marketReturnPct?: number }).marketReturnPct || 0) * wt
  }, 0)
  const riskFreeRate = 5.0 // %
  const sharpe = volatility && volatility > 0 ? (totalReturnPct - riskFreeRate) / volatility : null

  const cards = [
    {
      label: 'PORTFOLIO BETA',
      tooltip: 'Beta measures how much your portfolio moves relative to the overall market (S&P 500). Beta = 1.0 means it moves with the market. Beta > 1.0 means more volatile (higher risk/reward). Beta < 1.0 means more stable.',
      value: portfolioBeta != null ? portfolioBeta.toFixed(2) : 'N/A',
      desc: portfolioBeta != null
        ? portfolioBeta > 1.2 ? `Your portfolio moves ~${((portfolioBeta - 1) * 100).toFixed(0)}% more than the market`
        : portfolioBeta < 0.8 ? `Your portfolio moves ~${((1 - portfolioBeta) * 100).toFixed(0)}% less than the market`
        : 'Your portfolio moves roughly in line with the market'
        : 'Beta data not yet available for your holdings',
      color: portfolioBeta != null ? (portfolioBeta > 1.5 ? 'var(--red)' : portfolioBeta > 1 ? 'var(--yellow)' : 'var(--green)') : 'var(--text-3)',
    },
    {
      label: 'VOLATILITY (ANN.)',
      tooltip: 'Annualized volatility measures how much your portfolio\'s value fluctuates. Higher volatility = bigger price swings = more risk. Under 15% is low, 15-30% is moderate, over 30% is high.',
      value: volatility != null ? `${volatility.toFixed(1)}%` : 'N/A',
      desc: volatility != null
        ? volatility > 30 ? 'High volatility — prices can swing significantly'
        : volatility > 15 ? 'Moderate volatility — typical for equity portfolios'
        : 'Low volatility — relatively stable portfolio'
        : 'Insufficient data',
      color: volatility != null ? (volatility > 30 ? 'var(--red)' : volatility > 15 ? 'var(--yellow)' : 'var(--green)') : 'var(--text-3)',
    },
    {
      label: 'MAX DRAWDOWN (52W)',
      tooltip: 'Maximum Drawdown shows the largest peak-to-trough decline in your portfolio over the past 52 weeks. E.g., -15% means your portfolio fell 15% from its high point. Smaller is better.',
      value: maxDrawdown != null ? `${maxDrawdown.toFixed(1)}%` : 'N/A',
      desc: maxDrawdown != null
        ? `Weighted avg decline from 52-week highs across your holdings`
        : 'No 52-week high data available',
      color: maxDrawdown != null ? (maxDrawdown < -20 ? 'var(--red)' : maxDrawdown < -10 ? 'var(--yellow)' : 'var(--green)') : 'var(--text-3)',
    },
    {
      label: 'SHARPE RATIO',
      tooltip: 'Sharpe Ratio measures risk-adjusted return — how much return you earn per unit of risk taken. Above 1.0 is good, above 2.0 is great. Negative means you\'d have been better off in a risk-free savings account.',
      value: sharpe != null ? sharpe.toFixed(2) : 'N/A',
      desc: sharpe != null
        ? sharpe > 2 ? 'Excellent risk-adjusted return'
        : sharpe > 1 ? 'Good risk-adjusted return'
        : sharpe > 0 ? 'Positive but modest risk-adjusted return'
        : 'Negative — return below risk-free rate after adjusting for volatility'
        : 'Insufficient data for Sharpe calculation',
      color: sharpe != null ? (sharpe > 1 ? 'var(--green)' : sharpe > 0 ? 'var(--yellow)' : 'var(--red)') : 'var(--text-3)',
    },
  ]

  return (
    <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8, padding: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-2)', marginBottom: 12 }}>RISK METRICS</div>
      <div className="kpi-grid">
        {cards.map((c, i) => (
          <div key={i} style={{ background: 'var(--bg-3)', borderRadius: 6, padding: '12px 14px' }}>
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-3)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 2 }}>
              {c.label}
              {c.tooltip && <Tooltip text={c.tooltip} position="bottom" />}
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: c.color, fontFamily: 'var(--mono)', marginBottom: 4 }}>{c.value}</div>
            <div style={{ fontSize: 10, color: 'var(--text-3)', lineHeight: 1.4 }}>{c.desc}</div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 10, fontStyle: 'italic' }}>
        ⚠ Risk metrics are estimates based on limited historical data. Sharpe uses 5% risk-free rate. Not financial advice.
      </div>
    </div>
  )
}

// ─── Feature: AI Portfolio Analysis ──────────────────────────────────────────

function AIAnalysisSection({ holdingsEnriched, totalMarketValue, projAnnualIncome }: {
  holdingsEnriched: HoldingEnrichedWithDiv[]
  totalMarketValue: number
  projAnnualIncome: number
}) {
  const [expanded, setExpanded] = useState(false)

  // Rule-based analysis
  const insights: { level: 'info' | 'warn' | 'alert'; text: string }[] = []

  // Sector concentration
  const sectorPcts: Record<string, number> = {}
  holdingsEnriched.forEach(h => {
    const s = h.sector || 'Other'
    sectorPcts[s] = (sectorPcts[s] || 0) + h.marketValue / totalMarketValue * 100
  })
  Object.entries(sectorPcts).forEach(([sector, pct]) => {
    if (pct > 60) insights.push({ level: 'alert', text: `Your portfolio is ${pct.toFixed(0)}% ${sector} — heavily concentrated in a single sector.` })
    else if (pct > 40) insights.push({ level: 'warn', text: `${sector} makes up ${pct.toFixed(0)}% of your portfolio — consider whether this matches your goals.` })
  })

  // Individual concentration risk
  holdingsEnriched.forEach(h => {
    const pct = totalMarketValue > 0 ? h.marketValue / totalMarketValue * 100 : 0
    if (pct > 30) insights.push({ level: 'alert', text: `${h.ticker} is ${pct.toFixed(0)}% of your portfolio — high single-stock concentration risk.` })
    else if (pct > 20) insights.push({ level: 'warn', text: `${h.ticker} represents ${pct.toFixed(0)}% of your portfolio — a meaningful concentration.` })
  })

  // Dividend yield sustainability
  const highYieldHoldings = holdingsEnriched.filter(h => h.divYield > 10)
  if (highYieldHoldings.length > 0) {
    const avgYield = highYieldHoldings.reduce((s, h) => s + h.divYield, 0) / highYieldHoldings.length
    insights.push({ level: 'warn', text: `${highYieldHoldings.map(h => h.ticker).join(', ')} ${highYieldHoldings.length > 1 ? 'have' : 'has'} dividend yield${highYieldHoldings.length > 1 ? 's' : ''} above 10% (avg ${avgYield.toFixed(0)}%) — verify dividend sustainability.` })
  }

  // Sector gaps
  const allMajorSectors = ['Information Technology', 'Health Care', 'Financials', 'Consumer Staples', 'Energy']
  const missingSectors = allMajorSectors.filter(s => !sectorPcts[s] || sectorPcts[s] < 1)
  if (missingSectors.length >= 3) insights.push({ level: 'info', text: `You have no exposure to: ${missingSectors.join(', ')}.` })

  // Income vs growth balance
  const divYieldOverall = totalMarketValue > 0 ? projAnnualIncome / totalMarketValue * 100 : 0
  if (divYieldOverall > 5) insights.push({ level: 'info', text: `Your portfolio has a ${divYieldOverall.toFixed(1)}% dividend yield — income-oriented portfolio.` })
  else if (divYieldOverall < 0.5 && holdingsEnriched.length > 2) insights.push({ level: 'info', text: `Your portfolio generates minimal dividend income (${divYieldOverall.toFixed(1)}% yield) — growth-oriented.` })

  // Diversification score
  const numSectors = Object.keys(sectorPcts).length
  if (numSectors <= 2 && holdingsEnriched.length > 3) insights.push({ level: 'warn', text: `Your portfolio spans only ${numSectors} sector${numSectors > 1 ? 's' : ''}. Consider broader diversification.` })
  else if (numSectors >= 5) insights.push({ level: 'info', text: `Good diversification across ${numSectors} sectors.` })

  // Number of holdings
  if (holdingsEnriched.length < 5) insights.push({ level: 'info', text: `You hold ${holdingsEnriched.length} position${holdingsEnriched.length > 1 ? 's' : ''} — a concentrated portfolio can amplify both gains and losses.` })

  if (insights.length === 0) insights.push({ level: 'info', text: 'Your portfolio looks well-structured based on current data.' })

  const iconMap = { info: '(i)', warn: '(!)', alert: '(!)' }
  const colorMap = { info: 'var(--text-2)', warn: '#f59e0b', alert: 'var(--red)' }

  return (
    <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8, padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-2)' }}>AI PORTFOLIO ANALYSIS</div>
        <button onClick={() => setExpanded(!expanded)} style={{ fontSize: 11, cursor: 'pointer', padding: '5px 10px', border: '1px solid var(--border)', borderRadius: 'var(--btn-radius)', background: 'var(--bg-3)', color: 'var(--text-1)' }}>
          {expanded ? 'Collapse ↑' : 'View Analysis ↓'}
        </button>
      </div>
      {expanded && (
        <div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
            {insights.map((ins, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 12, color: colorMap[ins.level], background: 'var(--bg-3)', padding: '8px 12px', borderRadius: 6 }}>
                <span style={{ flexShrink: 0 }}>{iconMap[ins.level]}</span>
                <span>{ins.text}</span>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-3)', fontStyle: 'italic', borderTop: '1px solid var(--border)', paddingTop: 8 }}>
            This analysis is informational only and is generated from your portfolio data using rule-based logic. Not personalized investment advice. Always consult a qualified financial advisor before making investment decisions.
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Feature: What-If Scenarios ───────────────────────────────────────────────

function WhatIfSection({ holdingsEnriched, totalMarketValue, projAnnualIncome, stockInfos }: {
  holdingsEnriched: HoldingEnrichedWithDiv[]
  totalMarketValue: number
  projAnnualIncome: number
  stockInfos: Record<string, StockInfo>
}) {
  const [symbol, setSymbol] = useState('')
  const [shares, setShares] = useState('')
  const [price, setPrice] = useState('')
  const [projection, setProjection] = useState<{
    newTotalValue: number
    newAnnualIncome: number
    newDivYield: number
    addedValue: number
    newSectorPcts: Record<string, number>
    ticker: string
    shares: number
    cost: number
    annualDiv: number
  } | null>(null)
  const [error, setError] = useState('')
  const [expanded, setExpanded] = useState(false)

  const handleProject = () => {
    const sym = symbol.trim().toUpperCase()
    const sh = parseFloat(shares)
    let pr = parseFloat(price)
    if (!sym || isNaN(sh) || sh <= 0) { setError('Enter symbol and shares'); return }

    // Use current price from stockInfos if available and no price specified
    if (isNaN(pr) || pr <= 0) {
      pr = stockInfos[sym]?.currentPrice || 0
    }
    if (pr <= 0) { setError('Enter a valid price (or refresh prices to auto-fill)'); return }

    const annualDiv = (stockInfos[sym]?.dividendPerShareAnnual || 0) * sh
    const addedValue = sh * pr
    const newTotalValue = totalMarketValue + addedValue
    const newAnnualIncome = projAnnualIncome + annualDiv
    const newDivYield = newTotalValue > 0 ? newAnnualIncome / newTotalValue * 100 : 0

    // New sector breakdown
    const sectorPcts: Record<string, number> = {}
    holdingsEnriched.forEach(h => {
      const s = h.sector || 'Other'
      sectorPcts[s] = (sectorPcts[s] || 0) + h.marketValue / newTotalValue * 100
    })
    const newSector = stockInfos[sym]?.sector || 'Other'
    sectorPcts[newSector] = (sectorPcts[newSector] || 0) + addedValue / newTotalValue * 100

    setProjection({ newTotalValue, newAnnualIncome, newDivYield, addedValue, newSectorPcts: sectorPcts, ticker: sym, shares: sh, cost: pr, annualDiv })
    setError('')
  }

  const currentDivYield = totalMarketValue > 0 ? projAnnualIncome / totalMarketValue * 100 : 0

  return (
    <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8, padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-2)' }}>WHAT-IF SCENARIOS</div>
        <button onClick={() => setExpanded(!expanded)} style={{ fontSize: 11, cursor: 'pointer', padding: '5px 10px', border: '1px solid var(--border)', borderRadius: 'var(--btn-radius)', background: 'var(--bg-3)', color: 'var(--text-1)' }}>
          {expanded ? 'Collapse ↑' : 'Try Scenario ↓'}
        </button>
      </div>
      {expanded && (
        <div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
            <input value={symbol} onChange={e => setSymbol(e.target.value)} placeholder="Symbol (e.g. SCHD)" style={{ fontSize: 11, padding: '6px 10px', background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-0)', width: 100 }} />
            <input type="number" value={shares} onChange={e => setShares(e.target.value)} placeholder="Shares" style={{ fontSize: 11, padding: '6px 10px', background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-0)', width: 80 }} />
            <input type="number" value={price} onChange={e => setPrice(e.target.value)} placeholder="Price (auto if loaded)" style={{ fontSize: 11, padding: '6px 10px', background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-0)', width: 140 }} />
            <button onClick={handleProject} style={{ fontSize: 11, color: '#fff', cursor: 'pointer', padding: '6px 14px', border: 'none', borderRadius: 4, background: 'var(--accent)' }}>What if I add this?</button>
          </div>
          {error && <div style={{ fontSize: 11, color: 'var(--red)', marginBottom: 8 }}>{error}</div>}

          {projection && (
            <div style={{ background: 'var(--bg-3)', borderRadius: 6, padding: '12px 14px' }}>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10, color: 'var(--text-0)' }}>
                If you buy {projection.shares} shares of {projection.ticker} @ {fmtDollar(projection.cost)}:
              </div>
              <div className="kpi-grid" style={{ gap: 10 }}>
                <div style={{ background: 'var(--bg-2)', borderRadius: 4, padding: '8px 10px' }}>
                  <div style={{ fontSize: 9, color: 'var(--text-3)', letterSpacing: '0.06em' }}>NEW PORTFOLIO VALUE</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-0)', fontFamily: 'var(--mono)' }}>{fmtDollar(projection.newTotalValue)}</div>
                  <div style={{ fontSize: 10, color: 'var(--green)' }}>+{fmtDollar(projection.addedValue)} added</div>
                </div>
                <div style={{ background: 'var(--bg-2)', borderRadius: 4, padding: '8px 10px' }}>
                  <div style={{ fontSize: 9, color: 'var(--text-3)', letterSpacing: '0.06em' }}>ANNUAL INCOME</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--green)', fontFamily: 'var(--mono)' }}>{fmtDollar(projection.newAnnualIncome)}/yr</div>
                  <div style={{ fontSize: 10, color: 'var(--text-2)' }}>Monthly: {fmtDollar(projection.newAnnualIncome / 12)} vs {fmtDollar(projAnnualIncome / 12)} now</div>
                </div>
                <div style={{ background: 'var(--bg-2)', borderRadius: 4, padding: '8px 10px' }}>
                  <div style={{ fontSize: 9, color: 'var(--text-3)', letterSpacing: '0.06em' }}>DIV YIELD</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--yellow)', fontFamily: 'var(--mono)' }}>{projection.newDivYield.toFixed(2)}%</div>
                  <div style={{ fontSize: 10, color: 'var(--text-2)' }}>vs {currentDivYield.toFixed(2)}% now</div>
                </div>
                {projection.annualDiv > 0 && (
                  <div style={{ background: 'var(--bg-2)', borderRadius: 4, padding: '8px 10px' }}>
                    <div style={{ fontSize: 9, color: 'var(--text-3)', letterSpacing: '0.06em' }}>ADDED INCOME</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--green)', fontFamily: 'var(--mono)' }}>+{fmtDollar(projection.annualDiv)}/yr</div>
                    <div style={{ fontSize: 10, color: 'var(--text-2)' }}>+{fmtDollar(projection.annualDiv / 12)}/mo</div>
                  </div>
                )}
              </div>
              {/* New sector breakdown */}
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 10, color: 'var(--text-3)', marginBottom: 6, letterSpacing: '0.06em' }}>NEW SECTOR BREAKDOWN</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {Object.entries(projection.newSectorPcts).sort(([, a], [, b]) => b - a).map(([sector, pct]) => (
                    <div key={sector} style={{ fontSize: 10, padding: '3px 8px', background: 'var(--bg-2)', borderRadius: 10, color: 'var(--text-1)' }}>
                      {sector}: {pct.toFixed(1)}%
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 10, fontStyle: 'italic' }}>
                * Projected values only. Annual income estimate uses current dividend data. Not investment advice.
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Feature: Currency Settings ───────────────────────────────────────────────

function CurrencySettings({ portfolioSettings, savePortfolioSettings, exchangeRates }: {
  portfolioSettings: PortfolioSettings
  savePortfolioSettings: (s: PortfolioSettings) => Promise<void>
  exchangeRates: ExchangeRates | null
}) {
  const [saving, setSaving] = useState(false)

  const handleChange = async (currency: string) => {
    setSaving(true)
    await savePortfolioSettings({ ...portfolioSettings, homeCurrency: currency })
    setSaving(false)
  }

  return (
    <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8, padding: 16, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-2)' }}>DISPLAY CURRENCY</div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {SUPPORTED_CURRENCIES.map(c => (
          <button key={c} onClick={() => handleChange(c)} style={{
            fontSize: 11, padding: '4px 10px', borderRadius: 4, cursor: 'pointer',
            background: portfolioSettings.homeCurrency === c ? 'var(--accent)' : 'var(--bg-3)',
            color: portfolioSettings.homeCurrency === c ? '#fff' : 'var(--text-2)',
            border: '1px solid var(--border)', fontWeight: portfolioSettings.homeCurrency === c ? 700 : 400,
          }}>{c}</button>
        ))}
      </div>
      {saving && <span style={{ fontSize: 10, color: 'var(--text-3)' }}>Saving…</span>}
      {exchangeRates && portfolioSettings.homeCurrency !== 'USD' && (
        <span style={{ fontSize: 10, color: 'var(--text-3)' }}>
          1 USD = {(exchangeRates.rates[portfolioSettings.homeCurrency] || 1).toFixed(4)} {portfolioSettings.homeCurrency}
          {' '}· Rates via open.er-api.com
        </span>
      )}
      {!exchangeRates && portfolioSettings.homeCurrency !== 'USD' && (
        <span style={{ fontSize: 10, color: 'var(--yellow)' }}>Loading exchange rates…</span>
      )}
    </div>
  )
}
