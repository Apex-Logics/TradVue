'use client'
import { useMemo, useState } from 'react'
import { IconTrendingUp, IconTrendingDown, IconCalendar, IconChevronDown } from '../components/Icons'

interface Trade {
  id: string; date: string; symbol: string; assetClass: string
  pnl: number; rMultiple: number; setupTag: string; direction: string
  holdMinutes?: number
}

function getWeekStart(d: Date): string {
  const day = d.getDay()
  const diff = d.getDate() - (day === 0 ? 6 : day - 1)
  const monday = new Date(d.setDate(diff))
  return monday.toLocaleDateString('en-CA')
}

export default function WeeklySummary({ trades }: { trades: Trade[] }) {
  const [collapsed, setCollapsed] = useState(false)
  const [selectedWeek, setSelectedWeek] = useState<string>('current')

  const weekTrades = useMemo(() => {
    const today = new Date()
    const thisWeekStart = getWeekStart(new Date(today))
    const lastWeekStart = getWeekStart(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 7))

    const target = selectedWeek === 'current' ? thisWeekStart : lastWeekStart
    const end = new Date(target)
    end.setDate(end.getDate() + 7)
    const endStr = end.toLocaleDateString('en-CA')

    return trades.filter(t => t.date >= target && t.date < endStr)
  }, [trades, selectedWeek])

  const stats = useMemo(() => {
    if (weekTrades.length === 0) return null

    const wins = weekTrades.filter(t => t.pnl > 0)
    const losses = weekTrades.filter(t => t.pnl < 0)
    const totalPnl = weekTrades.reduce((s, t) => s + t.pnl, 0)
    const winRate = wins.length / weekTrades.length
    const avgRR = weekTrades.filter(t => t.rMultiple !== 0).reduce((s, t) => s + t.rMultiple, 0) / (weekTrades.filter(t => t.rMultiple !== 0).length || 1)
    const bestTrade = weekTrades.reduce((b, t) => t.pnl > b.pnl ? t : b, weekTrades[0])
    const worstTrade = weekTrades.reduce((w, t) => t.pnl < w.pnl ? t : w, weekTrades[0])

    // Most traded symbol
    const symbolCount: Record<string, number> = {}
    weekTrades.forEach(t => { symbolCount[t.symbol] = (symbolCount[t.symbol] || 0) + 1 })
    const topSymbol = Object.entries(symbolCount).sort((a, b) => b[1] - a[1])[0]

    // Most profitable setup
    const setupPnl: Record<string, number> = {}
    weekTrades.forEach(t => { setupPnl[t.setupTag || 'Untagged'] = (setupPnl[t.setupTag || 'Untagged'] || 0) + t.pnl })
    const topSetup = Object.entries(setupPnl).filter(([, p]) => p > 0).sort((a, b) => b[1] - a[1])[0]

    // Best day of week
    const dowPnl: Record<string, number> = {}
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    weekTrades.forEach(t => {
      const dow = days[new Date(t.date + 'T12:00:00').getDay()]
      dowPnl[dow] = (dowPnl[dow] || 0) + t.pnl
    })
    const worstDow = Object.entries(dowPnl).sort((a, b) => a[1] - b[1])[0]

    return { wins, losses, totalPnl, winRate, avgRR, bestTrade, worstTrade, topSymbol, topSetup, worstDow, count: weekTrades.length }
  }, [weekTrades])

  if (trades.length === 0) return null

  const fmt = (n: number) => `${n >= 0 ? '+' : '-'}$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  // Get week label
  const today = new Date()
  const weekLabel = selectedWeek === 'current'
    ? `This Week (${getWeekStart(new Date(today))})`
    : `Last Week (${getWeekStart(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 7))})`

  return (
    <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 'var(--card-radius)', padding: 16, marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }} onClick={() => setCollapsed(c => !c)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <IconCalendar size={14} style={{ color: 'var(--accent)' }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-0)' }}>Weekly Recap — {weekLabel}</span>
          {stats && (
            <span style={{ fontSize: 12, fontWeight: 700, fontFamily: 'var(--mono)', color: stats.totalPnl >= 0 ? 'var(--green)' : 'var(--red)' }}>
              {fmt(stats.totalPnl)}
            </span>
          )}
          {!stats && <span style={{ fontSize: 11, color: 'var(--text-3)' }}>No trades this week</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ display: 'flex', gap: 6 }}>
            {(['current', 'last'] as const).map(w => (
              <button key={w} onClick={e => { e.stopPropagation(); setSelectedWeek(w) }}
                style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, border: `1px solid ${selectedWeek === w ? 'var(--accent)' : 'var(--border)'}`, background: selectedWeek === w ? 'var(--accent-dim)' : 'transparent', color: selectedWeek === w ? 'var(--accent)' : 'var(--text-3)', cursor: 'pointer' }}>
                {w === 'current' ? 'This week' : 'Last week'}
              </button>
            ))}
          </div>
          <IconChevronDown size={14} style={{ color: 'var(--text-3)', transform: collapsed ? 'rotate(-90deg)' : 'none', transition: 'transform 0.2s' }} />
        </div>
      </div>

      {!collapsed && stats && (
        <div style={{ marginTop: 14 }}>
          {/* Main stats row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 8, marginBottom: 14 }}>
            {[
              { label: 'Total Trades', value: String(stats.count), color: 'var(--text-0)' },
              { label: 'Win Rate', value: `${(stats.winRate * 100).toFixed(1)}%`, color: stats.winRate >= 0.5 ? 'var(--green)' : 'var(--red)' },
              { label: 'Total P&L', value: fmt(stats.totalPnl), color: stats.totalPnl >= 0 ? 'var(--green)' : 'var(--red)' },
              { label: 'Avg R:R', value: stats.avgRR !== 0 ? `${stats.avgRR >= 0 ? '+' : ''}${stats.avgRR.toFixed(2)}R` : '—', color: stats.avgRR >= 1 ? 'var(--green)' : 'var(--red)' },
              { label: 'W/L', value: `${stats.wins.length}W / ${stats.losses.length}L`, color: 'var(--text-1)' },
            ].map(s => (
              <div key={s.label} style={{ background: 'var(--bg-3)', borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
                <div style={{ fontSize: 9, color: 'var(--text-3)', marginBottom: 2, letterSpacing: '0.05em' }}>{s.label}</div>
                <div style={{ fontSize: 14, fontWeight: 800, fontFamily: 'var(--mono)', color: s.color }}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Highlights row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
            <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 8, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <IconTrendingUp size={13} style={{ color: 'var(--green)', flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 9, color: 'var(--text-3)' }}>BEST TRADE</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--green)' }}>{stats.bestTrade.symbol} {fmt(stats.bestTrade.pnl)}</div>
              </div>
            </div>
            <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <IconTrendingDown size={13} style={{ color: 'var(--red)', flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 9, color: 'var(--text-3)' }}>WORST TRADE</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--red)' }}>{stats.worstTrade.symbol} {fmt(stats.worstTrade.pnl)}</div>
              </div>
            </div>
          </div>

          {/* Patterns row */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: 11, color: 'var(--text-2)' }}>
            {stats.topSymbol && (
              <span style={{ padding: '3px 10px', background: 'var(--bg-3)', borderRadius: 20, border: '1px solid var(--border)' }}>
                Most traded: <strong style={{ color: 'var(--accent)' }}>{stats.topSymbol[0]}</strong> ({stats.topSymbol[1]}×)
              </span>
            )}
            {stats.topSetup && (
              <span style={{ padding: '3px 10px', background: 'var(--bg-3)', borderRadius: 20, border: '1px solid var(--border)' }}>
                Top setup: <strong style={{ color: 'var(--green)' }}>{stats.topSetup[0]}</strong>
              </span>
            )}
            {stats.worstDow && stats.worstDow[1] < 0 && (
              <span style={{ padding: '3px 10px', background: 'var(--bg-3)', borderRadius: 20, border: '1px solid var(--border)' }}>
                Worst day: <strong style={{ color: 'var(--red)' }}>{stats.worstDow[0]}</strong>
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
