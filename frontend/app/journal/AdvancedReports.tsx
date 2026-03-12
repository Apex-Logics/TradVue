'use client'

import { useMemo } from 'react'
import Tooltip from '../components/Tooltip'
import {
  IconChart, IconCalendar, IconClock, IconTag, IconTarget,
  IconDollar, IconFlame, IconTrophy, IconSkull,
} from '../components/Icons'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Trade {
  id: string
  date: string
  time: string
  symbol: string
  assetClass: string
  direction: string
  entryPrice: number
  exitPrice: number
  positionSize: number
  stopLoss: number
  takeProfit: number
  commissions: number
  pnl: number
  rMultiple: number
  pctGainLoss: number
  holdMinutes: number
  setupTag: string
  mistakeTag: string
  rating: number
  notes: string
  // New tag fields
  tags_setup_types?: string[]
  tags_mistakes?: string[]
  tags_strategies?: string[]
}

// ─── Constants ────────────────────────────────────────────────────────────────

const GREEN = 'var(--green)'
const RED = 'var(--red)'
const BLUE = 'var(--blue)'
const YELLOW = 'var(--yellow)'

const DOW_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const DOW_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function fmtDollar(n: number) { return (n >= 0 ? '+$' : '-$') + Math.abs(n).toFixed(2) }
function fmtPct(n: number) { return (n >= 0 ? '+' : '') + n.toFixed(1) + '%' }

// ─── Reusable UI ──────────────────────────────────────────────────────────────

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: 'var(--bg-2)', border: '1px solid var(--border)',
      borderRadius: 12, padding: 20, ...style,
    }}>{children}</div>
  )
}

function StatRow({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ fontSize: 12, color: 'var(--text-1)' }}>{label}</span>
      <div style={{ textAlign: 'right' }}>
        <span style={{ fontFamily: 'var(--mono)', fontWeight: 700, color: color || 'var(--text-0)', fontSize: 13 }}>{value}</span>
        {sub && <div style={{ fontSize: 10, color: 'var(--text-2)' }}>{sub}</div>}
      </div>
    </div>
  )
}

// ─── Horizontal bar chart (CSS-only) ──────────────────────────────────────────

function HorizBar({ data, formatVal, formatSub }: {
  data: { label: string; value: number; sub?: string; count?: number }[]
  formatVal?: (n: number) => string
  formatSub?: (d: { label: string; value: number; sub?: string; count?: number }) => string
}) {
  const max = Math.max(...data.map(d => Math.abs(d.value)), 0.01)
  return (
    <div>
      {data.map(d => (
        <div key={d.label} style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
            <span style={{ color: 'var(--text-1)' }}>
              {d.label}
              {d.count != null && <span style={{ color: 'var(--text-2)', fontSize: 10, marginLeft: 4 }}>({d.count}t)</span>}
            </span>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontFamily: 'var(--mono)', color: d.value >= 0 ? GREEN : RED, fontWeight: 600 }}>
                {formatVal ? formatVal(d.value) : fmtDollar(d.value)}
              </span>
              {formatSub && <div style={{ fontSize: 9, color: 'var(--text-2)' }}>{formatSub(d)}</div>}
            </div>
          </div>
          <div style={{ background: 'var(--bg-1)', borderRadius: 4, height: 8, overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${(Math.abs(d.value) / max) * 100}%`,
              background: d.value >= 0 ? GREEN : RED,
              borderRadius: 4, transition: 'width 0.3s',
            }} />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── SVG Equity Curve ─────────────────────────────────────────────────────────

function EquityCurve({ trades }: { trades: Trade[] }) {
  const sorted = useMemo(() => [...trades].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)), [trades])
  const points = useMemo(() => {
    let cum = 0
    return sorted.map(t => { cum += t.pnl; return cum })
  }, [sorted])

  if (points.length < 2) return (
    <div style={{ textAlign: 'center', padding: 30, color: 'var(--text-2)', fontSize: 13 }}>
      Need 2+ trades for equity curve
    </div>
  )

  const W = 600, H = 180
  const min = Math.min(0, ...points), max = Math.max(0, ...points)
  const range = max - min || 1
  const xs = points.map((_, i) => (i / (points.length - 1)) * W)
  const ys = points.map(p => H - 20 - ((p - min) / range) * (H - 40))
  const zeroY = H - 20 - ((0 - min) / range) * (H - 40)

  const path = xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x},${ys[i]}`).join(' ')
  const area = `${path} L${W},${H - 10} L0,${H - 10} Z`
  const lastPnl = points[points.length - 1]
  const color = lastPnl >= 0 ? GREEN : RED

  // Milestone markers every 25% of trades
  const milestones = [0.25, 0.5, 0.75].map(pct => Math.floor((points.length - 1) * pct)).filter(i => i > 0)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', maxHeight: 200 }}>
      <defs>
        <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.25} />
          <stop offset="100%" stopColor={color} stopOpacity={0.02} />
        </linearGradient>
      </defs>
      {/* Grid lines */}
      <line x1={0} y1={zeroY} x2={W} y2={zeroY} stroke="rgba(255,255,255,0.08)" strokeWidth={1} strokeDasharray="4 4" />
      {/* Area + Line */}
      <path d={area} fill="url(#eqGrad)" />
      <path d={path} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" />
      {/* Milestones */}
      {milestones.map(i => (
        <g key={i}>
          <circle cx={xs[i]} cy={ys[i]} r={3} fill={points[i] >= 0 ? GREEN : RED} opacity={0.7} />
          <text x={xs[i]} y={ys[i] - 8} textAnchor="middle" fill="var(--text-2)" fontSize={8} fontFamily="var(--mono)">
            {fmtDollar(points[i])}
          </text>
        </g>
      ))}
      {/* End point */}
      <circle cx={xs[xs.length - 1]} cy={ys[ys.length - 1]} r={5} fill={color} />
      <text x={W - 4} y={ys[ys.length - 1] - 10} textAnchor="end" fill={color} fontSize={11} fontWeight="bold" fontFamily="var(--mono)">
        {fmtDollar(lastPnl)}
      </text>
      {/* Start label */}
      <text x={4} y={14} fill="var(--text-2)" fontSize={9}>
        {sorted[0]?.date}
      </text>
      <text x={W - 4} y={14} textAnchor="end" fill="var(--text-2)" fontSize={9}>
        {sorted[sorted.length - 1]?.date}
      </text>
    </svg>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AdvancedReports({ trades }: { trades: Trade[] }) {
  // ── Win rate by day of week ──
  const byDow = useMemo(() => {
    const map: Record<number, { wins: number; total: number; pnl: number }> = {}
    trades.forEach(t => {
      const dow = new Date(t.date + 'T12:00:00').getDay()
      if (!map[dow]) map[dow] = { wins: 0, total: 0, pnl: 0 }
      map[dow].total++
      map[dow].pnl += t.pnl
      if (t.pnl > 0) map[dow].wins++
    })
    return [1, 2, 3, 4, 5, 0, 6].filter(d => map[d]).map(dow => ({
      label: DOW_FULL[dow],
      value: map[dow] ? (map[dow].wins / map[dow].total) * 100 : 0,
      pnl: map[dow]?.pnl || 0,
      count: map[dow]?.total || 0,
    }))
  }, [trades])

  // ── Win rate by time of day ──
  const byTimeOfDay = useMemo(() => {
    const periods: Record<string, { wins: number; total: number; pnl: number }> = {
      'Pre-Market (4-9:30)': { wins: 0, total: 0, pnl: 0 },
      'Morning (9:30-11)': { wins: 0, total: 0, pnl: 0 },
      'Midday (11-13)': { wins: 0, total: 0, pnl: 0 },
      'Afternoon (13-16)': { wins: 0, total: 0, pnl: 0 },
      'After-Hours (16+)': { wins: 0, total: 0, pnl: 0 },
    }
    trades.forEach(t => {
      if (!t.time) return
      const hour = parseInt(t.time.slice(0, 2))
      const min = parseInt(t.time.slice(3, 5)) || 0
      const decimal = hour + min / 60
      let key: string
      if (decimal < 9.5) key = 'Pre-Market (4-9:30)'
      else if (decimal < 11) key = 'Morning (9:30-11)'
      else if (decimal < 13) key = 'Midday (11-13)'
      else if (decimal < 16) key = 'Afternoon (13-16)'
      else key = 'After-Hours (16+)'
      periods[key].total++
      periods[key].pnl += t.pnl
      if (t.pnl > 0) periods[key].wins++
    })
    return Object.entries(periods)
      .filter(([_, d]) => d.total > 0)
      .map(([label, d]) => ({
        label,
        value: (d.wins / d.total) * 100,
        pnl: d.pnl,
        count: d.total,
      }))
  }, [trades])

  // ── Win rate by ticker ──
  const byTicker = useMemo(() => {
    const map: Record<string, { wins: number; total: number; pnl: number }> = {}
    trades.forEach(t => {
      if (!map[t.symbol]) map[t.symbol] = { wins: 0, total: 0, pnl: 0 }
      map[t.symbol].total++
      map[t.symbol].pnl += t.pnl
      if (t.pnl > 0) map[t.symbol].wins++
    })
    return Object.entries(map)
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 12)
      .map(([label, d]) => ({
        label,
        value: (d.wins / d.total) * 100,
        pnl: d.pnl,
        count: d.total,
        winRate: d.wins / d.total,
      }))
  }, [trades])

  // ── Win rate by setup type (from tags) ──
  const bySetup = useMemo(() => {
    const map: Record<string, { wins: number; total: number; pnl: number }> = {}
    trades.forEach(t => {
      // Support both old single tag and new multi-tag
      const setups = t.tags_setup_types?.length ? t.tags_setup_types : (t.setupTag ? [t.setupTag] : [])
      setups.forEach(setup => {
        if (!map[setup]) map[setup] = { wins: 0, total: 0, pnl: 0 }
        map[setup].total++
        map[setup].pnl += t.pnl
        if (t.pnl > 0) map[setup].wins++
      })
    })
    return Object.entries(map)
      .sort((a, b) => b[1].total - a[1].total)
      .map(([label, d]) => ({
        label,
        value: (d.wins / d.total) * 100,
        pnl: d.pnl,
        count: d.total,
      }))
  }, [trades])

  // ── Avg P/L by day of week ──
  const avgPnlByDow = useMemo(() => {
    const map: Record<number, { sum: number; count: number }> = {}
    trades.forEach(t => {
      const dow = new Date(t.date + 'T12:00:00').getDay()
      if (!map[dow]) map[dow] = { sum: 0, count: 0 }
      map[dow].sum += t.pnl
      map[dow].count++
    })
    return [1, 2, 3, 4, 5, 0, 6].filter(d => map[d]).map(dow => ({
      label: DOW_NAMES[dow],
      value: map[dow] ? map[dow].sum / map[dow].count : 0,
      count: map[dow]?.count || 0,
    }))
  }, [trades])

  // ── Best/Worst trades ──
  const bestTrades = useMemo(() => [...trades].sort((a, b) => b.pnl - a.pnl).slice(0, 5), [trades])
  const worstTrades = useMemo(() => [...trades].sort((a, b) => a.pnl - b.pnl).slice(0, 5), [trades])

  // ── Streak tracking ──
  const streaks = useMemo(() => {
    const sorted = [...trades].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
    let curWin = 0, curLoss = 0, longestWin = 0, longestLoss = 0
    const streakHistory: { start: number; length: number; type: 'win' | 'loss'; pnl: number }[] = []
    let streakStart = 0, streakPnl = 0

    sorted.forEach((t, i) => {
      if (t.pnl > 0) {
        if (curLoss > 0 && curLoss >= 2) {
          streakHistory.push({ start: streakStart, length: curLoss, type: 'loss', pnl: streakPnl })
        }
        if (curWin === 0) { streakStart = i; streakPnl = 0 }
        curWin++; curLoss = 0; streakPnl += t.pnl
        longestWin = Math.max(longestWin, curWin)
      } else {
        if (curWin > 0 && curWin >= 2) {
          streakHistory.push({ start: streakStart, length: curWin, type: 'win', pnl: streakPnl })
        }
        if (curLoss === 0) { streakStart = i; streakPnl = 0 }
        curLoss++; curWin = 0; streakPnl += t.pnl
        longestLoss = Math.max(longestLoss, curLoss)
      }
    })
    // Push final streak
    if (curWin >= 2) streakHistory.push({ start: streakStart, length: curWin, type: 'win', pnl: streakPnl })
    if (curLoss >= 2) streakHistory.push({ start: streakStart, length: curLoss, type: 'loss', pnl: streakPnl })

    const last = sorted[sorted.length - 1]
    const current = last?.pnl > 0 ? curWin : -curLoss

    return { longestWin, longestLoss, current, history: streakHistory.slice(-10).reverse() }
  }, [trades])

  if (trades.length < 2) return (
    <div style={{ textAlign: 'center', padding: '60px 20px' }}>
      <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'center', color: 'var(--text-3)' }}><IconChart size={48} /></div>
      <h3 style={{ color: 'var(--text-0)', marginBottom: 8 }}>Need More Data</h3>
      <p style={{ color: 'var(--text-2)', fontSize: 14 }}>Log at least 2 trades to see advanced reports.</p>
    </div>
  )

  return (
    <div>
      {/* Running Equity Curve */}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-0)', display: 'flex', alignItems: 'center', gap: 6 }}><IconChart size={15} />Running Equity Curve</span>
          <Tooltip text="Your cumulative P&L over time. An upward-sloping line means consistent profitability." position="right" />
        </div>
        <EquityCurve trades={trades} />
      </Card>

      {/* Row 1: Win rate by DOW + Time of day */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-0)', display: 'flex', alignItems: 'center', gap: 5 }}><IconCalendar size={13} />Win Rate by Day of Week</span>
            <Tooltip text="Find your best trading days. Consider taking lighter positions on your worst days." position="right" />
          </div>
          {byDow.map(d => (
            <div key={d.label} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                <span style={{ color: 'var(--text-1)' }}>{d.label} <span style={{ color: 'var(--text-2)', fontSize: 10 }}>({d.count}t)</span></span>
                <div style={{ display: 'flex', gap: 12 }}>
                  <span style={{ fontFamily: 'var(--mono)', color: d.value >= 50 ? GREEN : RED, fontWeight: 600 }}>{d.value.toFixed(0)}% WR</span>
                  <span style={{ fontFamily: 'var(--mono)', color: d.pnl >= 0 ? GREEN : RED, fontSize: 11 }}>{fmtDollar(d.pnl)}</span>
                </div>
              </div>
              <div style={{ background: 'var(--bg-1)', borderRadius: 4, height: 8, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${d.value}%`, background: d.value >= 50 ? GREEN : RED, borderRadius: 4, transition: 'width 0.3s' }} />
              </div>
            </div>
          ))}
        </Card>

        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-0)', display: 'flex', alignItems: 'center', gap: 5 }}><IconClock size={13} />Win Rate by Time of Day</span>
            <Tooltip text="Morning (9:30-11) is often the most volatile. Midday tends to be choppy. Find your edge." position="right" />
          </div>
          {byTimeOfDay.length > 0 ? byTimeOfDay.map(d => (
            <div key={d.label} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                <span style={{ color: 'var(--text-1)' }}>{d.label} <span style={{ color: 'var(--text-2)', fontSize: 10 }}>({d.count}t)</span></span>
                <div style={{ display: 'flex', gap: 12 }}>
                  <span style={{ fontFamily: 'var(--mono)', color: d.value >= 50 ? GREEN : RED, fontWeight: 600 }}>{d.value.toFixed(0)}% WR</span>
                  <span style={{ fontFamily: 'var(--mono)', color: d.pnl >= 0 ? GREEN : RED, fontSize: 11 }}>{fmtDollar(d.pnl)}</span>
                </div>
              </div>
              <div style={{ background: 'var(--bg-1)', borderRadius: 4, height: 8, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${d.value}%`, background: d.value >= 50 ? GREEN : RED, borderRadius: 4, transition: 'width 0.3s' }} />
              </div>
            </div>
          )) : (
            <div style={{ color: 'var(--text-2)', fontSize: 12, padding: 20, textAlign: 'center' }}>Log trades with timestamps to see this.</div>
          )}
        </Card>
      </div>

      {/* Row 2: Win rate by Ticker + Setup */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-0)', display: 'flex', alignItems: 'center', gap: 5 }}><IconTag size={13} />Win Rate by Ticker</span>
            <Tooltip text="Which symbols are you best at trading? Specialize in your winners." position="right" />
          </div>
          {byTicker.length === 0 ? (
            <div style={{ color: 'var(--text-2)', fontSize: 12 }}>No ticker data.</div>
          ) : (
            <div style={{ overflowY: 'auto', maxHeight: 300 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr>
                    {['Ticker', 'Trades', 'Win%', 'Net P&L'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '4px 8px', fontSize: 10, color: 'var(--text-2)', textTransform: 'uppercase', borderBottom: '1px solid var(--border)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {byTicker.map(d => (
                    <tr key={d.label} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '6px 8px', fontWeight: 700, fontFamily: 'var(--mono)', color: BLUE }}>{d.label}</td>
                      <td style={{ padding: '6px 8px', color: 'var(--text-2)' }}>{d.count}</td>
                      <td style={{ padding: '6px 8px', fontFamily: 'var(--mono)', color: d.value >= 50 ? GREEN : RED }}>{d.value.toFixed(0)}%</td>
                      <td style={{ padding: '6px 8px', fontFamily: 'var(--mono)', fontWeight: 700, color: d.pnl >= 0 ? GREEN : RED }}>{fmtDollar(d.pnl)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-0)', display: 'flex', alignItems: 'center', gap: 5 }}><IconTarget size={13} />Win Rate by Setup Type</span>
            <Tooltip text="Which setups have the best win rate? Focus on what works." position="right" />
          </div>
          {bySetup.length === 0 ? (
            <div style={{ color: 'var(--text-2)', fontSize: 12, padding: 20, textAlign: 'center' }}>Tag your trades with setup types to see this.</div>
          ) : bySetup.map(d => (
            <div key={d.label} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                <span style={{ color: 'var(--text-1)' }}>{d.label} <span style={{ color: 'var(--text-2)', fontSize: 10 }}>({d.count}t)</span></span>
                <div style={{ display: 'flex', gap: 12 }}>
                  <span style={{ fontFamily: 'var(--mono)', color: d.value >= 50 ? GREEN : RED, fontWeight: 600 }}>{d.value.toFixed(0)}% WR</span>
                  <span style={{ fontFamily: 'var(--mono)', color: d.pnl >= 0 ? GREEN : RED, fontSize: 11 }}>{fmtDollar(d.pnl)}</span>
                </div>
              </div>
              <div style={{ background: 'var(--bg-1)', borderRadius: 4, height: 8, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${d.value}%`, background: d.value >= 50 ? GREEN : RED, borderRadius: 4, transition: 'width 0.3s' }} />
              </div>
            </div>
          ))}
        </Card>
      </div>

      {/* Row 3: Avg P/L by DOW + Streak Tracking */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-0)', display: 'flex', alignItems: 'center', gap: 5 }}><IconDollar size={13} />Avg P&L by Day of Week</span>
            <Tooltip text="Average dollar P&L per trade for each day. Identifies which days you're making vs losing money." position="right" />
          </div>
          <HorizBar
            data={avgPnlByDow}
            formatSub={d => `${d.count} trades`}
          />
        </Card>

        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-0)', display: 'flex', alignItems: 'center', gap: 5 }}><IconFlame size={13} />Streak Tracking</span>
            <Tooltip text="Win/loss streaks. Long losing streaks may indicate emotional trading. Long winning streaks often precede overconfidence." position="right" />
          </div>

          {/* Summary */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
            <div style={{ flex: 1, background: 'var(--bg-1)', borderRadius: 10, padding: '12px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: 9, color: 'var(--text-2)', textTransform: 'uppercase', fontWeight: 600, marginBottom: 4 }}>Best Win Streak</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: GREEN }}>{streaks.longestWin}</div>
            </div>
            <div style={{ flex: 1, background: 'var(--bg-1)', borderRadius: 10, padding: '12px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: 9, color: 'var(--text-2)', textTransform: 'uppercase', fontWeight: 600, marginBottom: 4 }}>Worst Loss Streak</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: RED }}>{streaks.longestLoss}</div>
            </div>
            <div style={{ flex: 1, background: 'var(--bg-1)', borderRadius: 10, padding: '12px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: 9, color: 'var(--text-2)', textTransform: 'uppercase', fontWeight: 600, marginBottom: 4 }}>Current</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: streaks.current > 0 ? GREEN : RED }}>
                {streaks.current > 0 ? `${streaks.current}W` : `${Math.abs(streaks.current)}L`}
              </div>
            </div>
          </div>

          {/* Streak history */}
          {streaks.history.length > 0 && (
            <>
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-2)', textTransform: 'uppercase', marginBottom: 8 }}>Recent Streaks</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {streaks.history.map((s, i) => (
                  <div key={i} style={{
                    background: s.type === 'win' ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
                    border: `1px solid ${s.type === 'win' ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}`,
                    borderRadius: 8, padding: '6px 10px', textAlign: 'center',
                  }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: s.type === 'win' ? GREEN : RED }}>
                      {s.length}{s.type === 'win' ? 'W' : 'L'}
                    </div>
                    <div style={{ fontSize: 9, fontFamily: 'var(--mono)', color: s.pnl >= 0 ? GREEN : RED }}>
                      {fmtDollar(s.pnl)}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>
      </div>

      {/* Row 4: Best + Worst Trades */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Card>
          <div style={{ fontSize: 13, fontWeight: 700, color: GREEN, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 5 }}><IconTrophy size={13} />Best Trades</div>
          {bestTrades.map((t, i) => (
            <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
              <div>
                <span style={{ color: 'var(--text-2)', fontSize: 11, marginRight: 6 }}>#{i + 1}</span>
                <span style={{ fontWeight: 700, color: BLUE, fontFamily: 'var(--mono)' }}>{t.symbol}</span>
                <span style={{ color: 'var(--text-2)', fontSize: 11, marginLeft: 6 }}>{t.date}</span>
                {t.setupTag && <span style={{ color: 'var(--text-2)', fontSize: 10, marginLeft: 6 }}>({t.setupTag})</span>}
              </div>
              <span style={{ fontFamily: 'var(--mono)', fontWeight: 700, color: GREEN }}>{fmtDollar(t.pnl)}</span>
            </div>
          ))}
        </Card>

        <Card>
          <div style={{ fontSize: 13, fontWeight: 700, color: RED, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 5 }}><IconSkull size={13} />Worst Trades</div>
          {worstTrades.map((t, i) => (
            <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
              <div>
                <span style={{ color: 'var(--text-2)', fontSize: 11, marginRight: 6 }}>#{i + 1}</span>
                <span style={{ fontWeight: 700, color: BLUE, fontFamily: 'var(--mono)' }}>{t.symbol}</span>
                <span style={{ color: 'var(--text-2)', fontSize: 11, marginLeft: 6 }}>{t.date}</span>
                {t.mistakeTag && t.mistakeTag !== 'None' && <span style={{ color: YELLOW, fontSize: 10, marginLeft: 6 }}>({t.mistakeTag})</span>}
              </div>
              <span style={{ fontFamily: 'var(--mono)', fontWeight: 700, color: RED }}>{fmtDollar(t.pnl)}</span>
            </div>
          ))}
        </Card>
      </div>
    </div>
  )
}
