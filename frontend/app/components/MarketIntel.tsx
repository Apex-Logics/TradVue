'use client'

/**
 * MarketIntel — tabbed "Market Intelligence" section for the News page.
 *
 * Tabs:
 *   - Insider Trades (SEC EDGAR + Finnhub)
 *   - Earnings Calendar (Finnhub)
 *   - Economic Data (FRED)
 *   - IPO Calendar (Finnhub)
 */

import { useState, useEffect, useCallback } from 'react'
import { apiFetchSafe } from '../lib/apiFetch'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

// ─── Types ─────────────────────────────────────────────────────────────────────

interface InsiderTrade {
  title: string
  summary: string
  url: string
  source: string
  category: string
  ticker: string | null
  filingType: string
  date: string
  transactionType?: string
  shares?: number
  name?: string
}

interface EarningsItem {
  symbol: string
  date: string
  hour: string
  epsEstimate: number | null
  epsActual: number | null
  revenueEstimate: number | null
  revenueActual: number | null
  year: number | null
  quarter: number | null
}

interface EarningsCalendar {
  earningsCalendar: EarningsItem[]
  from: string
  to: string
}

interface IPOItem {
  symbol: string
  name: string
  date: string
  price: string | null
  status: string
  numberOfShares: number | null
  totalSharesValue: number | null
  exchange: string
}

interface IPOCalendar {
  ipoCalendar: IPOItem[]
  from: string
  to: string
}

interface EconomicIndicator {
  seriesId: string
  name: string
  frequency: string
  unit: string
  value: number | null
  date: string | null
  previousValue: number | null
  change: number | null
  changePercent: number | null
  trend: { date: string; value: number }[]
  available: boolean
}

interface EconomicData {
  available: boolean
  message?: string
  indicators: EconomicIndicator[]
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

function fmtDate(dateStr: string | null) {
  if (!dateStr) return '—'
  try {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  } catch { return dateStr }
}

function fmtNum(n: number | null, decimals = 2) {
  if (n == null) return '—'
  return n.toLocaleString('en-US', { maximumFractionDigits: decimals, minimumFractionDigits: decimals })
}

function fmtLargeMoney(n: number | null) {
  if (n == null) return '—'
  if (Math.abs(n) >= 1e9) return `$${(n / 1e9).toFixed(1)}B`
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(1)}M`
  return `$${n.toLocaleString()}`
}

/** Tiny sparkline — renders 12-point trend as an inline SVG path */
function Sparkline({ data, color = 'var(--purple)' }: { data: { value: number }[]; color?: string }) {
  if (!data || data.length < 2) return <span style={{ fontSize: 10, color: 'var(--text-3)' }}>—</span>

  const vals = data.map(d => d.value)
  const min = Math.min(...vals)
  const max = Math.max(...vals)
  const range = max - min || 1
  const W = 60
  const H = 20
  const pts = vals.map((v, i) => {
    const x = (i / (vals.length - 1)) * W
    const y = H - ((v - min) / range) * H
    return `${x},${y}`
  }).join(' ')

  const isUp = vals[vals.length - 1] >= vals[0]
  const lineColor = isUp ? 'var(--green, #22c55e)' : 'var(--red, #ef4444)'

  return (
    <svg width={W} height={H} style={{ verticalAlign: 'middle', overflow: 'visible' }}>
      <polyline points={pts} fill="none" stroke={lineColor} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function LoadingRows({ rows = 5 }: { rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i}>
          {Array.from({ length: 5 }).map((_, j) => (
            <td key={j} style={{ padding: '8px 12px' }}>
              <div className="shimmer" style={{ height: 12, width: j === 0 ? 60 : 80, borderRadius: 3 }} />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}

function ErrorMsg({ msg, onRetry }: { msg: string; onRetry?: () => void }) {
  return (
    <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>
      <div style={{ fontSize: 20, marginBottom: 8, display: 'flex', justifyContent: 'center' }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
      </div>
      <div style={{ marginBottom: 12 }}>{msg}</div>
      {onRetry && (
        <button className="btn btn-secondary btn-sm" onClick={onRetry}>↻ Retry</button>
      )}
    </div>
  )
}

// ─── Tab: Insider Trades ────────────────────────────────────────────────────────

function InsiderTradesTab({ symbol }: { symbol?: string }) {
  const [data, setData] = useState<InsiderTrade[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    setLoading(true); setError(false)
    const url = symbol
      ? `${API_BASE}/api/insider-trades?symbol=${encodeURIComponent(symbol)}`
      : `${API_BASE}/api/insider-trades`
    const res = await apiFetchSafe<{ success: boolean; data: InsiderTrade[] }>(url)
    if (res?.success) setData(res.data || [])
    else setError(true)
    setLoading(false)
  }, [symbol])

  useEffect(() => { load() }, [load])

  if (error) return <ErrorMsg msg="Failed to load insider trades" onRetry={load} />

  const filtered = search.trim()
    ? data.filter(item => {
        const q = search.toLowerCase()
        return (item.ticker || '').toLowerCase().includes(q) ||
               (item.name || '').toLowerCase().includes(q) ||
               (item.title || '').toLowerCase().includes(q) ||
               (item.transactionType || '').toLowerCase().includes(q) ||
               (item.source || '').toLowerCase().includes(q)
      })
    : data

  return (
    <div>
      {/* Search bar */}
      <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-3)', flexShrink: 0 }}>
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Filter by ticker, insider, type…"
          style={{
            background: 'none', border: 'none', outline: 'none',
            fontSize: 12, color: 'var(--text-0)', width: '100%',
          }}
        />
        {search && (
          <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', fontSize: 13, padding: 0 }}>✕</button>
        )}
      </div>
      <div style={{ overflowX: 'auto' }}>
      <table className="intel-table">
        <thead>
          <tr>
            <th>Ticker</th>
            <th>Insider</th>
            <th>Type</th>
            <th>Shares</th>
            <th>Date</th>
            <th>Details</th>
          </tr>
        </thead>
        <tbody>
          {loading ? <LoadingRows rows={8} /> : filtered.length === 0 ? (
            <tr><td colSpan={6} style={{ textAlign: 'center', padding: 32, color: 'var(--text-3)' }}>{search ? `No results for "${search}"` : 'No insider trades found'}</td></tr>
          ) : filtered.slice(0, 50).map((item, i) => {
            const isBuy = (item.transactionType || '').toLowerCase().includes('buy') ||
                          (item.title || '').toLowerCase().includes('purchase')
            const isSell = (item.transactionType || '').toLowerCase().includes('sell') ||
                           (item.title || '').toLowerCase().includes('sale')
            const typeColor = isBuy ? 'var(--green, #22c55e)' : isSell ? 'var(--red, #ef4444)' : 'var(--text-2)'

            return (
              <tr key={i}>
                <td>
                  <span className="intel-ticker-tag">{item.ticker || '—'}</span>
                </td>
                <td style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.name || item.title?.split(':')[0] || '—'}
                </td>
                <td>
                  <span style={{ color: typeColor, fontWeight: 600, fontSize: 11 }}>
                    {item.transactionType || item.filingType || '—'}
                  </span>
                </td>
                <td style={{ whiteSpace: 'nowrap', fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--text-1)' }}>
                  {item.shares ? item.shares.toLocaleString() : '—'}
                </td>
                <td style={{ whiteSpace: 'nowrap', color: 'var(--text-2)', fontSize: 11 }}>
                  {fmtDate(item.date)}
                </td>
                <td>
                  {item.url ? (
                    <a href={item.url} target="_blank" rel="noopener noreferrer"
                      style={{ color: 'var(--purple)', fontSize: 11 }}>
                      View →
                    </a>
                  ) : (
                    <span style={{ color: 'var(--text-3)', fontSize: 11 }}>—</span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      </div>
    </div>
  )
}

// ─── Tab: Earnings Calendar ─────────────────────────────────────────────────────

function EarningsCalendarTab() {
  const [data, setData] = useState<EarningsCalendar | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    setLoading(true); setError(false)
    const res = await apiFetchSafe<{ success: boolean; data: EarningsCalendar }>(
      `${API_BASE}/api/earnings-calendar`
    )
    if (res?.success) setData(res.data || null)
    else setError(true)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  if (error) return <ErrorMsg msg="Failed to load earnings calendar" onRetry={load} />

  const allItems = data?.earningsCalendar || []
  const items = search.trim()
    ? allItems.filter(item => item.symbol.toLowerCase().includes(search.toLowerCase()))
    : allItems

  return (
    <div>
      {/* Search bar */}
      <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-3)', flexShrink: 0 }}>
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Filter by symbol…"
          style={{
            background: 'none', border: 'none', outline: 'none',
            fontSize: 12, color: 'var(--text-0)', width: '100%',
          }}
        />
        {search && (
          <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', fontSize: 13, padding: 0 }}>✕</button>
        )}
      </div>
      <div style={{ overflowX: 'auto' }}>
      <table className="intel-table">
        <thead>
          <tr>
            <th>Symbol</th>
            <th>Date</th>
            <th>Time</th>
            <th>EPS Est.</th>
            <th>EPS Actual</th>
            <th>Q</th>
          </tr>
        </thead>
        <tbody>
          {loading ? <LoadingRows rows={8} /> : items.length === 0 ? (
            <tr><td colSpan={6} style={{ textAlign: 'center', padding: 32, color: 'var(--text-3)' }}>
              No upcoming earnings — check back later
            </td></tr>
          ) : items.map((item, i) => {
            const hasMiss = item.epsActual != null && item.epsEstimate != null && item.epsActual < item.epsEstimate
            const hasBeat = item.epsActual != null && item.epsEstimate != null && item.epsActual > item.epsEstimate
            return (
              <tr key={i}>
                <td><span className="intel-ticker-tag">{item.symbol}</span></td>
                <td style={{ whiteSpace: 'nowrap', fontSize: 12 }}>{fmtDate(item.date)}</td>
                <td style={{ fontSize: 11, color: 'var(--text-2)' }}>
                  {item.hour === 'bmo' ? 'BMO' : item.hour === 'amc' ? 'AMC' : item.hour || '—'}
                </td>
                <td style={{ fontSize: 12, color: 'var(--text-1)' }}>{fmtNum(item.epsEstimate)}</td>
                <td style={{ fontSize: 12, fontWeight: item.epsActual != null ? 600 : 400,
                  color: hasBeat ? 'var(--green, #22c55e)' : hasMiss ? 'var(--red, #ef4444)' : 'var(--text-1)' }}>
                  {fmtNum(item.epsActual)}
                  {hasBeat && ' ▲'}
                  {hasMiss && ' ▼'}
                </td>
                <td style={{ fontSize: 11, color: 'var(--text-3)' }}>
                  {item.year && item.quarter ? `${item.year} Q${item.quarter}` : '—'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      </div>
    </div>
  )
}

// ─── Tab: Economic Data ─────────────────────────────────────────────────────────

function EconomicDataTab() {
  const [data, setData] = useState<EconomicData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const load = useCallback(async () => {
    setLoading(true); setError(false)
    const res = await apiFetchSafe<{ success: boolean; data: EconomicData }>(
      `${API_BASE}/api/economic-indicators`
    )
    if (res?.success) setData(res.data || null)
    else setError(true)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  if (error) return <ErrorMsg msg="Failed to load economic indicators" onRetry={load} />

  if (!loading && data && !data.available) {
    return (
      <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>
        <div style={{ fontSize: 20, marginBottom: 8, display: 'flex', justifyContent: 'center' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="18" y="3" width="4" height="18" rx="1"/><rect x="10" y="8" width="4" height="13" rx="1"/><rect x="2" y="13" width="4" height="8" rx="1"/>
          </svg>
        </div>
        <div>{data.message || 'Economic data not configured yet.'}</div>
        <div style={{ marginTop: 8, fontSize: 11 }}>Set FRED_API_KEY in your environment to enable.</div>
      </div>
    )
  }

  const indicators = data?.indicators || []

  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="intel-table">
        <thead>
          <tr>
            <th>Indicator</th>
            <th>Value</th>
            <th>Change</th>
            <th>Trend (12 pts)</th>
            <th>Frequency</th>
            <th>Updated</th>
          </tr>
        </thead>
        <tbody>
          {loading ? <LoadingRows rows={8} /> : indicators.length === 0 ? (
            <tr><td colSpan={6} style={{ textAlign: 'center', padding: 32, color: 'var(--text-3)' }}>No data available</td></tr>
          ) : indicators.map((ind, i) => {
            const isUp = ind.change != null && ind.change > 0
            const isDown = ind.change != null && ind.change < 0
            const changeColor = isUp ? 'var(--green, #22c55e)' : isDown ? 'var(--red, #ef4444)' : 'var(--text-3)'

            return (
              <tr key={i}>
                <td>
                  <div style={{ fontWeight: 600, fontSize: 12 }}>{ind.name}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-3)' }}>{ind.seriesId}</div>
                </td>
                <td style={{ fontWeight: 700, fontSize: 13 }}>
                  {ind.value != null ? `${fmtNum(ind.value)} ${ind.unit}` : '—'}
                </td>
                <td style={{ color: changeColor, fontSize: 12, whiteSpace: 'nowrap' }}>
                  {ind.change != null ? `${isUp ? '+' : ''}${fmtNum(ind.change)}` : '—'}
                  {ind.changePercent != null && (
                    <span style={{ fontSize: 10, marginLeft: 4, opacity: 0.8 }}>
                      ({isUp ? '+' : ''}{fmtNum(ind.changePercent)}%)
                    </span>
                  )}
                </td>
                <td>
                  {ind.trend.length > 0 ? <Sparkline data={ind.trend} /> : <span style={{ color: 'var(--text-3)', fontSize: 10 }}>—</span>}
                </td>
                <td style={{ fontSize: 11, color: 'var(--text-3)' }}>{ind.frequency}</td>
                <td style={{ fontSize: 11, color: 'var(--text-3)', whiteSpace: 'nowrap' }}>{fmtDate(ind.date)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ─── Tab: IPO Calendar ──────────────────────────────────────────────────────────

function IPOCalendarTab() {
  const [data, setData] = useState<IPOCalendar | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const load = useCallback(async () => {
    setLoading(true); setError(false)
    const res = await apiFetchSafe<{ success: boolean; data: IPOCalendar }>(
      `${API_BASE}/api/ipo-calendar`
    )
    if (res?.success) setData(res.data || null)
    else setError(true)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  if (error) return <ErrorMsg msg="Failed to load IPO calendar" onRetry={load} />

  const items = data?.ipoCalendar || []

  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="intel-table">
        <thead>
          <tr>
            <th>Symbol</th>
            <th>Company</th>
            <th>Date</th>
            <th>Price</th>
            <th>Shares</th>
            <th>Status</th>
            <th>Exchange</th>
          </tr>
        </thead>
        <tbody>
          {loading ? <LoadingRows rows={6} /> : items.length === 0 ? (
            <tr><td colSpan={7} style={{ textAlign: 'center', padding: 32, color: 'var(--text-3)' }}>
              No upcoming IPOs found — check back later
            </td></tr>
          ) : items.map((ipo, i) => (
            <tr key={i}>
              <td><span className="intel-ticker-tag">{ipo.symbol || '—'}</span></td>
              <td style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12 }}>
                {ipo.name || '—'}
              </td>
              <td style={{ fontSize: 11, whiteSpace: 'nowrap' }}>{fmtDate(ipo.date)}</td>
              <td style={{ fontSize: 12 }}>{ipo.price ? `$${ipo.price}` : '—'}</td>
              <td style={{ fontSize: 11, color: 'var(--text-2)' }}>
                {ipo.numberOfShares ? `${(ipo.numberOfShares / 1e6).toFixed(1)}M` : '—'}
              </td>
              <td>
                <span style={{
                  fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 3,
                  background: ipo.status === 'priced' ? 'rgba(34,197,94,0.15)' : 'rgba(139,92,246,0.15)',
                  color: ipo.status === 'priced' ? 'var(--green, #22c55e)' : 'var(--purple)',
                }}>
                  {(ipo.status || '').toUpperCase() || '—'}
                </span>
              </td>
              <td style={{ fontSize: 11, color: 'var(--text-3)' }}>{ipo.exchange || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Main Component ─────────────────────────────────────────────────────────────

const TABS = [
  { id: 'insider', label: 'Insider Trades' },
  { id: 'earnings', label: 'Earnings' },
  { id: 'economic', label: 'Economic Data' },
  { id: 'ipo', label: 'IPO Calendar' },
]

export default function MarketIntel({ symbol }: { symbol?: string }) {
  const [activeTab, setActiveTab] = useState<string>('insider')

  return (
    <section style={{
      background: 'var(--bg-1)',
      border: '1px solid var(--border)',
      borderRadius: 8,
      overflow: 'hidden',
      marginTop: 24,
    }}>
      {/* Section header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '12px 16px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg-0)',
      }}>
        <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-0)' }}>
          Market Intel
        </span>
        <span style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 1 }}>
          SEC EDGAR · FRED · Finnhub
        </span>
      </div>

      {/* Tab bar */}
      <div style={{
        display: 'flex', gap: 0,
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg-1)',
        overflowX: 'auto',
      }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '9px 16px',
              fontSize: 12,
              fontWeight: activeTab === tab.id ? 600 : 400,
              color: activeTab === tab.id ? 'var(--purple)' : 'var(--text-2)',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === tab.id ? '2px solid var(--purple)' : '2px solid transparent',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'color 0.15s, border-color 0.15s',
              marginBottom: -1,
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ minHeight: 200 }}>
        {activeTab === 'insider'  && <InsiderTradesTab symbol={symbol} />}
        {activeTab === 'earnings' && <EarningsCalendarTab />}
        {activeTab === 'economic' && <EconomicDataTab />}
        {activeTab === 'ipo'      && <IPOCalendarTab />}
      </div>

      {/* Footer disclaimer */}
      <div style={{
        padding: '8px 16px',
        borderTop: '1px solid var(--border)',
        fontSize: 10,
        color: 'var(--text-3)',
        background: 'var(--bg-0)',
      }}>
        Data from SEC EDGAR, FRED (Federal Reserve), and Finnhub. For informational purposes only.
        Insider trade data may be delayed up to 15 minutes.
      </div>
    </section>
  )
}
