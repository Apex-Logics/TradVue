'use client'

import { useState, useEffect } from 'react'
import { fmt } from '../utils/formatting'
import { apiFetchSafe } from '../lib/apiFetch'
import { TextSkeleton } from './Skeleton'
import { livePrice } from '../utils/portfolioDisplay'
import type { Quote } from '../types'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

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

interface Props {
  quotes: Record<string, Quote>
  onOpenStock: (symbol: string) => void
}

/**
 * Sidebar portfolio summary panel showing live P&L across all holdings.
 * Hides/reveals values with an eye-toggle. Links to the full portfolio page.
 */
export default function PortfolioPanel({ quotes, onOpenStock }: Props) {
  const [holdings, setHoldings] = useState<Holding[]>(() => {
    try { const s = localStorage.getItem('cg_portfolio_holdings'); return s ? JSON.parse(s) : [] } catch { return [] }
  })
  const [liveQuotes, setLiveQuotes] = useState<Record<string, Quote>>({})
  const [loadingPrices, setLoadingPrices] = useState(false)
  const [hideValues, setHideValues] = useState<boolean>(() => {
    try { return localStorage.getItem('cg_hide_values') === 'true' } catch { return false }
  })

  const toggleHideValues = () => {
    setHideValues(prev => {
      const next = !prev
      try { localStorage.setItem('cg_hide_values', String(next)) } catch {}
      return next
    })
  }

  const maskValue = (val: string) => hideValues ? '••••••' : val

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
    const t = setInterval(fetchPrices, 30_000)
    return () => clearInterval(t)
  }, [holdings])

  const getPrice = (ticker: string): number | null =>
    livePrice(liveQuotes[ticker] ? { current: liveQuotes[ticker].current } : undefined)
    ?? livePrice(quotes[ticker] ? { current: quotes[ticker].current } : undefined)

  const getDayChange = (ticker: string): number | null =>
    liveQuotes[ticker]?.changePct ?? quotes[ticker]?.changePct ?? null

  const pricesReady = holdings.length === 0 || holdings.every(h => getPrice(h.ticker) != null)
  const totalCost  = holdings.reduce((s, h) => s + h.shares * h.avgCost, 0)
  const totalValue = holdings.reduce((s, h) => {
    const price = getPrice(h.ticker)
    return price == null ? s : s + h.shares * price
  }, 0)
  const totalPnl    = pricesReady ? totalValue - totalCost : 0
  const totalPnlPct = pricesReady && totalCost > 0 ? (totalPnl / totalCost) * 100 : 0
  const totalDayGain = holdings.reduce((s, h) => {
    const cur = getPrice(h.ticker)
    const dayChange = getDayChange(h.ticker)
    if (cur && dayChange !== null) return s + (cur * dayChange / 100) * h.shares
    return s
  }, 0)

  return (
    <div className="sidebar-section" style={{ padding: 0 }} role="region" aria-label="Portfolio summary">
      {holdings.length > 0 && (
        <>
          <div style={{ padding: '8px 14px', borderBottom: '1px solid var(--border)', fontSize: 10 }}>
            {/* Eye toggle header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ color: 'var(--text-3)', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Portfolio</span>
              <button
                onClick={toggleHideValues}
                title={hideValues ? 'Show values' : 'Hide values'}
                aria-label={hideValues ? 'Show portfolio values' : 'Hide portfolio values'}
                aria-pressed={hideValues}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: '0 2px', lineHeight: 1, fontSize: 12 }}
              >
                {hideValues ? (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                    <line x1="1" y1="1" x2="23" y2="23"/>
                  </svg>
                ) : (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                )}
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 6 }}>
              <div>
                <span style={{ color: 'var(--text-2)' }}>VALUE</span>
                <div style={{ color: 'var(--text-0)', fontFamily: 'var(--mono)', fontWeight: 600 }}>
                  {!pricesReady ? <TextSkeleton width={72} height={14} /> : maskValue(`$${fmt(totalValue)}`)}
                </div>
              </div>
              <div>
                <span style={{ color: 'var(--text-2)' }}>P&amp;L</span>
                <div style={{ color: !pricesReady ? 'var(--text-2)' : (totalPnl >= 0 ? 'var(--green)' : 'var(--red)'), fontFamily: 'var(--mono)', fontWeight: 600 }}>
                  {!pricesReady ? <TextSkeleton width={88} height={14} /> : maskValue(`$${fmt(Math.abs(totalPnl))}`)}
                  {pricesReady ? ` (${totalPnlPct >= 0 ? '+' : ''}${totalPnlPct.toFixed(2)}%)` : null}
                </div>
              </div>
            </div>
            {totalDayGain !== 0 && (
              <div style={{ color: totalDayGain >= 0 ? 'var(--green)' : 'var(--red)', fontSize: 9.5 }}>
                Day: {totalDayGain >= 0 ? '+' : ''}{maskValue(`$${fmt(Math.abs(totalDayGain))}`)}
              </div>
            )}
          </div>

          {/* Holdings list */}
          {holdings.map((h) => {
            const cur = getPrice(h.ticker)
            const pnlPct = cur !== null ? ((cur - h.avgCost) / h.avgCost) * 100 : null
            return (
              <div
                key={h.id}
                className="mover-row"
                style={{ gridTemplateColumns: 'auto 1fr auto auto', gap: 8, cursor: 'pointer' }}
                onClick={() => onOpenStock(h.ticker)}
                role="button"
                tabIndex={0}
                aria-label={`View ${h.ticker} details`}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onOpenStock(h.ticker) }}
              >
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

          <div style={{ padding: '8px 14px', borderTop: '1px solid var(--border)' }}>
            <a
              href="/portfolio"
              style={{ display: 'inline-block', fontSize: 11, color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}
            >
              View Full Portfolio →
            </a>
          </div>
        </>
      )}

      {holdings.length === 0 && (
        <div style={{ padding: '16px 14px', textAlign: 'center', fontSize: 11, color: 'var(--text-3)' }}>
          <div style={{ marginBottom: 8 }}>No positions yet</div>
          <a href="/portfolio" style={{ display: 'inline-block', fontSize: 10, color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>
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
