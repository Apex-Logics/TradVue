'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { IconArrowLeft } from '../../components/Icons'
import Tooltip from '../../components/Tooltip'
import Link from 'next/link'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
import { apiFetchSafe } from '../../lib/apiFetch'

// ─── Types ───────────────────────────────────────────────────────────────────

interface StockInfo {
  symbol: string
  companyName: string
  sector?: string | null
  logo?: string | null
  exchange?: string | null
  currency?: string
  currentPrice?: number | null
  previousClose?: number | null
  dayChange?: number | null
  dayChangePct?: number | null
  '52WeekHigh'?: number | null
  '52WeekLow'?: number | null
  beta?: number | null
  peRatio?: number | null
  dividendYield?: number | null
  dividendPerShareAnnual?: number | null
  dividendFrequency?: string | null
}

interface AnalystRatings {
  symbol: string
  consensus: {
    label: string | null
    mean: number | null
    key: string | null
    color: string
  }
  priceTargets: {
    high: number | null
    low: number | null
    mean: number | null
    median: number | null
    currentPrice: number | null
    upsidePct: number | null
  }
  analystCount: number | null
  distribution: {
    strongBuy: number
    buy: number
    hold: number
    sell: number
    strongSell: number
    total: number
    period: string
  } | null
  trends: Array<{
    period: string
    strongBuy: number
    buy: number
    hold: number
    sell: number
    strongSell: number
  }>
}

interface StockScore {
  symbol: string
  totalScore: number | null
  grade?: string
  error?: string
  breakdown?: {
    value: { score: number; weight: number; pe?: number; sectorAvg?: number; ratio?: number; note?: string }
    growth: { score: number; weight: number; revenueGrowthPct?: number; earningsGrowthPct?: number; note?: string }
    momentum: { score: number; weight: number; pctAbove50dMA?: number; pctAbove200dMA?: number; goldenCross?: boolean; deathCross?: boolean; note?: string }
    profitability: { score: number; weight: number; profitMarginPct?: number; roePct?: number; grossMarginPct?: number; note?: string }
  }
  meta?: {
    sector: string | null
    currentPrice: number | null
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmt = (n: number | null | undefined, d = 2) =>
  n == null || isNaN(n) ? '—' : n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })

const fmtDollar = (n: number | null | undefined) =>
  n == null || isNaN(n) ? '—' : '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function getScoreColor(score: number | null) {
  if (score == null) return 'var(--text-3)'
  if (score >= 80) return '#16a34a'
  if (score >= 65) return '#22c55e'
  if (score >= 50) return '#eab308'
  if (score >= 35) return '#f97316'
  return '#ef4444'
}

function getGradeEmoji(grade?: string) {
  if (!grade) return ''
  const map: Record<string, string> = { A: '🟢', B: '🔵', C: '🟡', D: '🟠', F: '🔴' }
  return map[grade] || ''
}

// ─── Score Badge Component ───────────────────────────────────────────────────

function ScoreBadge({ score, grade, size = 'large' }: { score: number | null; grade?: string; size?: 'small' | 'large' }) {
  if (score == null) return null
  const color = getScoreColor(score)
  const isLarge = size === 'large'

  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: isLarge ? 8 : 4,
      background: `${color}18`, border: `1px solid ${color}40`,
      borderRadius: isLarge ? 12 : 8, padding: isLarge ? '8px 14px' : '3px 8px',
    }}>
      <div style={{
        width: isLarge ? 44 : 28, height: isLarge ? 44 : 28,
        borderRadius: '50%', border: `3px solid ${color}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: isLarge ? 18 : 12, fontWeight: 700, color,
        fontFamily: 'var(--mono)',
      }}>
        {score}
      </div>
      {grade && (
        <div style={{ textAlign: isLarge ? 'left' : 'center' }}>
          <div style={{ fontSize: isLarge ? 14 : 11, fontWeight: 700, color }}>
            Grade {grade} {getGradeEmoji(grade)}
          </div>
          {isLarge && (
            <div style={{ fontSize: 10, color: 'var(--text-3)' }}>TradVue Score</div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Analyst Ratings Card ────────────────────────────────────────────────────

function AnalystRatingsCard({ ratings, loading }: { ratings: AnalystRatings | null; loading: boolean }) {
  if (loading) {
    return (
      <div className="ds-card" style={{ minHeight: 200 }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>📊 Analyst Ratings</div>
        <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-3)', fontSize: 12 }}>⏳ Loading ratings...</div>
      </div>
    )
  }

  if (!ratings || (!ratings.consensus.label && !ratings.distribution)) {
    return (
      <div className="ds-card" style={{ minHeight: 120 }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>📊 Analyst Ratings</div>
        <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-3)', fontSize: 12 }}>
          No analyst coverage available for this stock.
        </div>
      </div>
    )
  }

  const { consensus, priceTargets, analystCount, distribution } = ratings
  const pt = priceTargets

  // Price target bar positioning
  let targetBarContent = null
  if (pt.low != null && pt.high != null && pt.currentPrice != null && pt.high > pt.low) {
    const range = pt.high - pt.low
    const currentPct = Math.max(0, Math.min(100, ((pt.currentPrice - pt.low) / range) * 100))
    const meanPct = pt.mean ? Math.max(0, Math.min(100, ((pt.mean - pt.low) / range) * 100)) : null

    targetBarContent = (
      <div style={{ marginTop: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', marginBottom: 8, letterSpacing: '0.05em' }}>
          PRICE TARGET RANGE
        </div>
        <div style={{ position: 'relative', height: 24, background: 'var(--bg-2)', borderRadius: 12, overflow: 'visible', margin: '0 0 6px 0' }}>
          {/* Range fill */}
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            background: 'linear-gradient(90deg, #ef4444 0%, #eab308 50%, #22c55e 100%)',
            borderRadius: 12, opacity: 0.25,
          }} />
          {/* Mean target marker */}
          {meanPct != null && (
            <div style={{
              position: 'absolute', top: -2, left: `${meanPct}%`, transform: 'translateX(-50%)',
              width: 4, height: 28, background: '#4a9eff', borderRadius: 2, zIndex: 2,
            }} title={`Mean Target: $${pt.mean?.toFixed(2)}`} />
          )}
          {/* Current price marker */}
          <div style={{
            position: 'absolute', top: -4, left: `${currentPct}%`, transform: 'translateX(-50%)',
            width: 12, height: 12, background: 'white', borderRadius: '50%',
            border: '2px solid var(--accent)', zIndex: 3, boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
          }} title={`Current: $${pt.currentPrice?.toFixed(2)}`} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-3)' }}>
          <span>Low: {fmtDollar(pt.low)}</span>
          {pt.mean && <span style={{ color: '#4a9eff' }}>Mean: {fmtDollar(pt.mean)}</span>}
          <span>High: {fmtDollar(pt.high)}</span>
        </div>
      </div>
    )
  }

  // Distribution bar
  let distBar = null
  if (distribution && distribution.total > 0) {
    const { strongBuy, buy, hold, sell, strongSell, total } = distribution
    const segments = [
      { label: 'Strong Buy', count: strongBuy, color: '#16a34a' },
      { label: 'Buy', count: buy, color: '#4ade80' },
      { label: 'Hold', count: hold, color: '#eab308' },
      { label: 'Sell', count: sell, color: '#f97316' },
      { label: 'Strong Sell', count: strongSell, color: '#ef4444' },
    ].filter(s => s.count > 0)

    distBar = (
      <div style={{ marginTop: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', marginBottom: 8, letterSpacing: '0.05em' }}>
          RATING DISTRIBUTION
        </div>
        {/* Stacked bar */}
        <div style={{ display: 'flex', height: 20, borderRadius: 10, overflow: 'hidden', marginBottom: 8 }}>
          {segments.map(s => (
            <div
              key={s.label}
              style={{ width: `${(s.count / total) * 100}%`, background: s.color, minWidth: s.count > 0 ? 3 : 0 }}
              title={`${s.label}: ${s.count}`}
            />
          ))}
        </div>
        {/* Legend */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {segments.map(s => (
            <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: s.color }} />
              <span style={{ color: 'var(--text-2)' }}>{s.label}</span>
              <span style={{ color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>({s.count})</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="ds-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700 }}>📊 Analyst Ratings</div>
        {analystCount && (
          <span style={{ fontSize: 10, color: 'var(--text-3)', background: 'var(--bg-3)', padding: '2px 8px', borderRadius: 10 }}>
            {analystCount} analyst{analystCount !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Consensus badge */}
      {consensus.label && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <div style={{
            padding: '6px 16px', borderRadius: 20,
            background: `${consensus.color}20`, border: `1px solid ${consensus.color}50`,
            color: consensus.color, fontWeight: 700, fontSize: 14,
          }}>
            {consensus.label}
          </div>
          {consensus.mean && (
            <span style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>
              Score: {consensus.mean.toFixed(2)} / 5
            </span>
          )}
        </div>
      )}

      {/* Upside/downside */}
      {pt.upsidePct != null && (
        <div style={{ fontSize: 13, marginBottom: 4 }}>
          <span style={{ color: 'var(--text-2)' }}>Upside to mean target: </span>
          <span style={{
            fontWeight: 700, fontFamily: 'var(--mono)',
            color: pt.upsidePct >= 0 ? 'var(--green)' : 'var(--red)',
          }}>
            {pt.upsidePct >= 0 ? '+' : ''}{pt.upsidePct}%
          </span>
        </div>
      )}

      {targetBarContent}
      {distBar}
    </div>
  )
}

// ─── Stock Score Card ────────────────────────────────────────────────────────

function StockScoreCard({ score, loading }: { score: StockScore | null; loading: boolean }) {
  if (loading) {
    return (
      <div className="ds-card" style={{ minHeight: 200 }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>🎯 TradVue Score</div>
        <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-3)', fontSize: 12 }}>⏳ Calculating score...</div>
      </div>
    )
  }

  if (!score || score.totalScore == null) {
    return (
      <div className="ds-card" style={{ minHeight: 120 }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>🎯 TradVue Score</div>
        <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-3)', fontSize: 12 }}>
          {score?.error || 'Unable to calculate score for this stock.'}
        </div>
      </div>
    )
  }

  const { totalScore, grade, breakdown } = score
  const dimensions = breakdown ? [
    { key: 'value', label: 'Value', icon: '💰', desc: 'P/E ratio vs sector average', ...breakdown.value },
    { key: 'growth', label: 'Growth', icon: '📈', desc: 'Revenue & earnings growth', ...breakdown.growth },
    { key: 'momentum', label: 'Momentum', icon: '🚀', desc: '50d/200d MA, trend direction', ...breakdown.momentum },
    { key: 'profitability', label: 'Profitability', icon: '💎', desc: 'Margins & return on equity', ...breakdown.profitability },
  ] : []

  return (
    <div className="ds-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700 }}>🎯 TradVue Score</div>
        <ScoreBadge score={totalScore} grade={grade} size="large" />
      </div>

      {/* Breakdown bars */}
      {dimensions.map(dim => {
        const color = getScoreColor(dim.score)
        return (
          <div key={dim.key} style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>{dim.icon}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-1)' }}>{dim.label}</span>
                <Tooltip text={dim.desc} position="right" />
              </div>
              <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'var(--mono)', color }}>
                {dim.score}/100
              </span>
            </div>
            {/* Bar */}
            <div style={{ height: 8, background: 'var(--bg-3)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{
                height: '100%', width: `${dim.score}%`,
                background: `linear-gradient(90deg, ${color}99, ${color})`,
                borderRadius: 4, transition: 'width 0.5s ease-out',
              }} />
            </div>
            {/* Detail tags */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
              {dim.key === 'value' && (dim as any).pe != null && (
                <>
                  <span className="tag tag-blue" style={{ fontSize: 9 }}>P/E: {(dim as any).pe}</span>
                  <span className="tag" style={{ fontSize: 9 }}>Sector Avg: {(dim as any).sectorAvg}</span>
                </>
              )}
              {dim.key === 'growth' && (
                <>
                  {(dim as any).revenueGrowthPct != null && (
                    <span className="tag tag-blue" style={{ fontSize: 9 }}>Rev: {(dim as any).revenueGrowthPct > 0 ? '+' : ''}{(dim as any).revenueGrowthPct}%</span>
                  )}
                  {(dim as any).earningsGrowthPct != null && (
                    <span className="tag tag-blue" style={{ fontSize: 9 }}>EPS: {(dim as any).earningsGrowthPct > 0 ? '+' : ''}{(dim as any).earningsGrowthPct}%</span>
                  )}
                </>
              )}
              {dim.key === 'momentum' && (
                <>
                  {(dim as any).goldenCross && <span className="tag tag-green" style={{ fontSize: 9 }}>✨ Golden Cross</span>}
                  {(dim as any).deathCross && <span className="tag tag-red" style={{ fontSize: 9 }}>💀 Death Cross</span>}
                  {(dim as any).pctAbove200dMA != null && (
                    <span className="tag" style={{ fontSize: 9 }}>vs 200d: {(dim as any).pctAbove200dMA > 0 ? '+' : ''}{(dim as any).pctAbove200dMA}%</span>
                  )}
                </>
              )}
              {dim.key === 'profitability' && (
                <>
                  {(dim as any).profitMarginPct != null && (
                    <span className="tag tag-blue" style={{ fontSize: 9 }}>Margin: {(dim as any).profitMarginPct}%</span>
                  )}
                  {(dim as any).roePct != null && (
                    <span className="tag tag-blue" style={{ fontSize: 9 }}>ROE: {(dim as any).roePct}%</span>
                  )}
                </>
              )}
            </div>
          </div>
        )
      })}

      <div style={{ marginTop: 8, fontSize: 10, color: 'var(--text-3)', background: 'var(--accent-dim)', borderRadius: 6, padding: '6px 10px' }}>
        💡 Score = 25% Value + 25% Growth + 25% Momentum + 25% Profitability. Updated daily.
      </div>
    </div>
  )
}

// ─── Stock Info Card ─────────────────────────────────────────────────────────

function StockInfoCard({ info, loading }: { info: StockInfo | null; loading: boolean }) {
  if (loading) {
    return (
      <div className="ds-card" style={{ minHeight: 120 }}>
        <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-3)', fontSize: 12 }}>⏳ Loading stock info...</div>
      </div>
    )
  }

  if (!info) return null

  const rows: { label: string; value: string; color?: string }[] = [
    { label: 'Current Price', value: fmtDollar(info.currentPrice), color: 'var(--text-0)' },
    {
      label: 'Day Change',
      value: info.dayChange != null && info.dayChangePct != null
        ? `${info.dayChange >= 0 ? '+' : ''}${fmtDollar(info.dayChange)} (${info.dayChangePct >= 0 ? '+' : ''}${info.dayChangePct.toFixed(2)}%)`
        : '—',
      color: info.dayChange != null ? (info.dayChange >= 0 ? 'var(--green)' : 'var(--red)') : undefined,
    },
    { label: '52W High', value: fmtDollar(info['52WeekHigh']) },
    { label: '52W Low', value: fmtDollar(info['52WeekLow']) },
    { label: 'P/E Ratio', value: info.peRatio != null ? fmt(info.peRatio, 1) : '—' },
    { label: 'Beta', value: info.beta != null ? fmt(info.beta, 2) : '—' },
    { label: 'Div Yield', value: info.dividendYield != null ? `${fmt(info.dividendYield, 2)}%` : '—', color: info.dividendYield ? 'var(--green)' : undefined },
    { label: 'Div Frequency', value: info.dividendFrequency || '—' },
  ]

  return (
    <div className="ds-card">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        {info.logo && (
          <img
            src={info.logo}
            alt={info.companyName}
            style={{ width: 36, height: 36, borderRadius: 8, background: 'white', padding: 2 }}
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
        )}
        <div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{info.companyName}</div>
          <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
            {info.exchange && <span>{info.exchange} · </span>}
            {info.sector && <span>{info.sector}</span>}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>
        {rows.map(r => (
          <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
            <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{r.label}</span>
            <span style={{ fontSize: 12, fontWeight: 600, fontFamily: 'var(--mono)', color: r.color || 'var(--text-1)' }}>{r.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function StockDetailPage() {
  const params = useParams()
  const ticker = (params?.ticker as string)?.toUpperCase() || ''

  const [info, setInfo] = useState<StockInfo | null>(null)
  const [ratings, setRatings] = useState<AnalystRatings | null>(null)
  const [score, setScore] = useState<StockScore | null>(null)

  const [infoLoading, setInfoLoading] = useState(true)
  const [ratingsLoading, setRatingsLoading] = useState(true)
  const [scoreLoading, setScoreLoading] = useState(true)

  useEffect(() => {
    if (!ticker) return

    // Fetch all three in parallel
    const fetchInfo = async () => {
      const data = await apiFetchSafe<StockInfo>(`${API_BASE}/api/stock-info/${ticker}`)
      if (data) setInfo(data)
      setInfoLoading(false)
    }

    const fetchRatings = async () => {
      const json = await apiFetchSafe<{ success: boolean; data: AnalystRatings }>(`${API_BASE}/api/stocks/${ticker}/ratings`)
      if (json?.success) setRatings(json.data)
      setRatingsLoading(false)
    }

    const fetchScore = async () => {
      const json = await apiFetchSafe<{ success: boolean; data: StockScore }>(`${API_BASE}/api/stocks/${ticker}/score`)
      if (json?.success) setScore(json.data)
      setScoreLoading(false)
    }

    fetchInfo()
    fetchRatings()
    fetchScore()
  }, [ticker])

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-1)', color: 'var(--text-0)', paddingBottom: 60 }}>
      {/* Header */}
      <div className="page-header">
        <Link href="/tools" className="back-link">
          <IconArrowLeft size={16} />
          Back
        </Link>
        <div className="page-header-title" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontFamily: 'var(--mono)', color: 'var(--accent)' }}>{ticker}</span>
          {info?.companyName && info.companyName !== ticker && (
            <span style={{ fontSize: 16, color: 'var(--text-2)', fontWeight: 400 }}>{info.companyName}</span>
          )}
          {/* Inline score badge */}
          {score?.totalScore != null && (
            <ScoreBadge score={score.totalScore} grade={score.grade} size="small" />
          )}
        </div>
        <div className="page-header-desc">
          Stock analysis · Analyst ratings · Composite score
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          {/* Left column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <StockInfoCard info={info} loading={infoLoading} />
            <AnalystRatingsCard ratings={ratings} loading={ratingsLoading} />
          </div>

          {/* Right column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <StockScoreCard score={score} loading={scoreLoading} />
          </div>
        </div>
      </div>
    </div>
  )
}
