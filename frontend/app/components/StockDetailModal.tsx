'use client'

import { useState, useEffect, useCallback } from 'react'
import { fmt, fmtPct, fmtMarketCap } from '../utils/formatting'
import { MAX_TICKER_CUSTOM } from '../constants'
import type { Quote, CompanyProfile } from '../types'

// ─── Chart size cycle ──────────────────────────────────────────────────────────

const CHART_SIZES = ['default', 'expanded', 'fullscreen'] as const
type ChartSize = (typeof CHART_SIZES)[number]

// ─── Company Profile Section ───────────────────────────────────────────────────

function CompanyProfileSection({ profile }: { profile: CompanyProfile }) {
  const [expanded, setExpanded] = useState(false)

  const stats = [
    { label: 'MKT CAP',   val: fmtMarketCap(profile.marketCap) },
    { label: 'P/E RATIO', val: profile.peRatio ? profile.peRatio.toFixed(1) : '—' },
    { label: 'EPS',        val: profile.eps ? `$${profile.eps.toFixed(2)}` : '—' },
    { label: 'DIV YIELD', val: profile.dividendYield ? `${profile.dividendYield.toFixed(2)}%` : '—' },
    { label: '52W HIGH',  val: profile.week52High ? `$${fmt(profile.week52High)}` : '—' },
    { label: '52W LOW',   val: profile.week52Low ? `$${fmt(profile.week52Low)}` : '—' },
    { label: 'BETA',       val: profile.beta ? profile.beta.toFixed(2) : '—' },
    { label: 'P/B RATIO', val: profile.pbRatio ? profile.pbRatio.toFixed(1) : '—' },
    { label: 'EXCHANGE',  val: profile.exchange || '—' },
  ]

  return (
    <div className="company-profile" role="region" aria-label="Company profile">
      <div className="company-profile-header">
        {profile.logo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={profile.logo} alt={profile.name} className="company-logo" loading="lazy" />
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
          role="button"
          aria-expanded={expanded}
          tabIndex={0}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setExpanded(x => !x) }}
        >
          {profile.description}
          {!expanded && <span style={{ color: 'var(--accent)', marginLeft: 4 }}>more</span>}
        </p>
      )}

      <div className="company-key-stats" role="list" aria-label="Key statistics">
        {stats.map(s => (
          <div key={s.label} className="company-stat" role="listitem">
            <span className="company-stat-label">{s.label}</span>
            <span className="company-stat-val">{s.val}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Stock Detail Modal ────────────────────────────────────────────────────────

interface Props {
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
}

/**
 * Full-screen modal showing a stock's live price, TradingView chart,
 * quote stats, company profile, and actions (add to ticker / watchlist).
 */
export default function StockDetailModal({
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
}: Props) {
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

  // Keyboard: Escape closes, F cycles chart size
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

  const expandIcon  = chartSize === 'fullscreen' ? '↙' : '↗'
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
            <span className="stock-modal-company">{profile?.name || name}</span>
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

          <button className="modal-close-btn" onClick={onClose} aria-label="Close stock detail">✕</button>
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
          <div className="stock-stats" role="list" aria-label="Quote statistics">
            {[
              { label: 'OPEN',       val: `$${fmt(quote.open)}` },
              { label: 'HIGH',       val: `$${fmt(quote.high)}`,      color: 'var(--green)' },
              { label: 'LOW',        val: `$${fmt(quote.low)}`,       color: 'var(--red)' },
              { label: 'PREV CLOSE', val: `$${fmt(quote.prevClose)}` },
            ].map(stat => (
              <div key={stat.label} className="stock-stat" role="listitem">
                <span className="stock-stat-label">{stat.label}</span>
                <span className="stock-stat-val" style={stat.color ? { color: stat.color } : undefined}>{stat.val}</span>
              </div>
            ))}
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
            aria-label={inTicker ? `${symbol} is already in ticker` : tickerFull ? 'Ticker bar is full' : `Add ${symbol} to ticker bar`}
            title={tickerFull && !inTicker ? `Ticker full — max ${MAX_TICKER_CUSTOM} symbols` : undefined}
          >
            {inTicker ? '✓ In Ticker' : tickerFull ? 'Ticker Full (15)' : '＋ Add to Ticker'}
          </button>

          <button
            className={`stock-action-btn${inWatchlist ? ' stock-action-active' : ''}`}
            onClick={onAddWatchlist}
            aria-label={inWatchlist ? `${symbol} is in your watchlist` : `Add ${symbol} to watchlist`}
          >
            {inWatchlist ? '★ In Watchlist' : '+ Add to Watchlist'}
          </button>
        </div>
      </div>
    </>
  )
}
