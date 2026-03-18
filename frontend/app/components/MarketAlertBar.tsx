'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface PriceMoveAlert {
  id: string
  symbol: string
  change_pct: number
  timeframe: string
  direction: 'up' | 'down'
  timestamp: string
  possible_catalyst: string
}

export interface UpcomingEvent {
  id: string
  title: string
  date: string
  impact: string | number
  country: string
  type?: string
}

// ─── useMarketAlerts hook ──────────────────────────────────────────────────────

export function useMarketAlerts() {
  const [priceAlerts, setPriceAlerts]     = useState<PriceMoveAlert[]>([])
  const [upcomingEvents, setUpcomingEvents] = useState<UpcomingEvent[]>([])
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchAlerts = useCallback(async () => {
    try {
      const [alertsRes, calRes] = await Promise.allSettled([
        fetch(`${API_BASE}/api/alerts/market`),
        fetch(`${API_BASE}/api/alerts/calendar?hours=2`),
      ])

      if (alertsRes.status === 'fulfilled' && alertsRes.value.ok) {
        const j = await alertsRes.value.json()
        if (j.success) setPriceAlerts(j.data || [])
      }
      if (calRes.status === 'fulfilled' && calRes.value.ok) {
        const j = await calRes.value.json()
        if (j.success) setUpcomingEvents(j.data || [])
      }
    } catch { /* silently ignore */ }
  }, [])

  useEffect(() => {
    fetchAlerts()
    intervalRef.current = setInterval(fetchAlerts, 30_000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [fetchAlerts])

  return { priceAlerts, upcomingEvents, refresh: fetchAlerts }
}

// ─── PriceMoveAlertPill ────────────────────────────────────────────────────────

export function PriceMoveAlertPill({ alert }: { alert: PriceMoveAlert }) {
  const isUp   = alert.direction === 'up'
  const color  = isUp ? 'var(--green)' : 'var(--red)'
  const bg     = isUp ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)'
  const border = isUp ? 'rgba(34,197,94,0.3)'  : 'rgba(239,68,68,0.3)'
  const sign   = isUp ? '+' : ''
  const emoji  = isUp ? '🟢' : '🔴'

  return (
    <div
      title={alert.possible_catalyst ? `Possible catalyst: ${alert.possible_catalyst}` : undefined}
      role="status"
      aria-label={`${alert.symbol} ${sign}${alert.change_pct.toFixed(1)}% in ${alert.timeframe}`}
      style={{
        display: 'flex', alignItems: 'center', gap: 5,
        padding: '3px 10px', background: bg,
        border: `1px solid ${border}`, borderRadius: 20,
        fontSize: 11, whiteSpace: 'nowrap', cursor: 'default',
        flexShrink: 0,
      }}
    >
      <span style={{ fontSize: 12 }} aria-hidden="true">{emoji}</span>
      <span style={{ fontWeight: 700, color }}>{alert.symbol}</span>
      <span style={{ color }}>{sign}{alert.change_pct.toFixed(1)}%</span>
      <span style={{ color: 'var(--text-3)', fontSize: 10 }}>in {alert.timeframe}</span>
      {alert.possible_catalyst && (
        <span style={{ color: '#60a5fa', fontSize: 10 }}>• {alert.possible_catalyst.slice(0, 30)}</span>
      )}
    </div>
  )
}

// ─── CalendarEventPill ─────────────────────────────────────────────────────────

export function CalendarEventPill({ event }: { event: UpcomingEvent }) {
  const minutesUntil = Math.round((new Date(event.date).getTime() - Date.now()) / 60000)
  const label = minutesUntil < 60
    ? `${minutesUntil}m`
    : `${Math.floor(minutesUntil / 60)}h ${minutesUntil % 60}m`
  const isImminent = minutesUntil <= 5

  return (
    <div
      role="status"
      aria-label={`${event.title} in ${label}`}
      style={{
        display: 'flex', alignItems: 'center', gap: 5,
        padding: '3px 10px',
        background: isImminent ? 'rgba(245,158,11,0.2)' : 'rgba(96,165,250,0.12)',
        border: `1px solid ${isImminent ? 'rgba(245,158,11,0.4)' : 'rgba(96,165,250,0.25)'}`,
        borderRadius: 20, fontSize: 11, whiteSpace: 'nowrap',
        flexShrink: 0,
        animation: isImminent ? 'pulse 1.2s ease-in-out infinite' : 'none',
      }}
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
      <a href="/calendar" style={{ color: isImminent ? '#f59e0b' : '#60a5fa', fontWeight: 600, textDecoration: 'none', fontSize: 11 }}>
        {event.title.slice(0, 28)}
      </a>
      <span style={{ color: 'var(--text-3)', fontSize: 10 }}>in {label}</span>
    </div>
  )
}

// ─── MarketAlertBar ────────────────────────────────────────────────────────────

/**
 * Horizontal scrolling bar showing real-time price moves and upcoming
 * high-impact events. Rendered just below SmartAlertsBar.
 */
export default function MarketAlertBar() {
  const { priceAlerts, upcomingEvents } = useMarketAlerts()
  const hasContent = priceAlerts.length > 0 || upcomingEvents.length > 0

  return (
    <div
      className="market-alert-bar"
      role="region"
      aria-label="Market alerts"
      style={{
        borderBottom: '1px solid var(--border)',
        background: '#0a0a0e',
        minHeight: 34,
        display: 'flex', alignItems: 'center',
      }}
    >
      <div style={{
        fontSize: 9, fontWeight: 800, letterSpacing: '0.08em',
        color: 'var(--text-3)', padding: '0 10px',
        whiteSpace: 'nowrap', borderRight: '1px solid var(--border)',
        alignSelf: 'stretch', display: 'flex', alignItems: 'center',
        minWidth: 60,
      }}>
        ALERTS
      </div>

      <div
        className="market-alert-scroll"
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          overflowX: 'auto', padding: '4px 10px',
          scrollbarWidth: 'none',
          flex: 1,
        }}
      >
        {!hasContent && (
          <span style={{ fontSize: 11, color: 'var(--text-3)', padding: '0 4px' }}>
            No active alerts — markets quiet
          </span>
        )}

        {priceAlerts.map(a => (
          <PriceMoveAlertPill key={a.id} alert={a} />
        ))}

        {upcomingEvents.slice(0, 3).map(e => (
          <CalendarEventPill key={e.id} event={e} />
        ))}
      </div>

      {hasContent && (
        <div style={{
          fontSize: 9, color: 'var(--text-3)', padding: '0 8px',
          whiteSpace: 'nowrap', borderLeft: '1px solid var(--border)',
          alignSelf: 'stretch', display: 'flex', alignItems: 'center',
        }}>
          ⚠ Not financial advice
        </div>
      )}
    </div>
  )
}

// ─── UpcomingEventsWidget ──────────────────────────────────────────────────────

/**
 * Shows the next 3 high-impact events with live countdown timers.
 * Rendered at the top of the right (calendar) column.
 */
export function UpcomingEventsWidget() {
  const [events, setEvents] = useState<UpcomingEvent[]>([])
  const [, setTick] = useState(0)

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/alerts/calendar?hours=2`)
        if (!res.ok) return
        const j = await res.json()
        if (j.success) setEvents(j.data?.slice(0, 3) || [])
      } catch { /* ignore */ }
    }

    fetchEvents()
    const fetchInterval = setInterval(fetchEvents, 60_000)
    const tickInterval  = setInterval(() => setTick(t => t + 1), 1000)
    return () => { clearInterval(fetchInterval); clearInterval(tickInterval) }
  }, [])

  if (events.length === 0) return null

  return (
    <div
      style={{ padding: '8px 12px 6px', borderBottom: '1px solid var(--border)', background: 'var(--bg-1)' }}
      role="region"
      aria-label="Upcoming events"
    >
      <div style={{
        fontSize: 9, fontWeight: 700, letterSpacing: '0.07em',
        color: 'var(--text-3)', marginBottom: 6,
        display: 'flex', alignItems: 'center', gap: 4,
      }}>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
          <line x1="16" y1="2" x2="16" y2="6"/>
          <line x1="8" y1="2" x2="8" y2="6"/>
          <line x1="3" y1="10" x2="21" y2="10"/>
        </svg> UPCOMING EVENTS
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {events.map(e => {
          const minutesUntil = Math.round((new Date(e.date).getTime() - Date.now()) / 60000)
          const isImminent   = minutesUntil <= 5
          const label = minutesUntil < 1
            ? 'NOW'
            : minutesUntil < 60
            ? `in ${minutesUntil}m`
            : `in ${Math.floor(minutesUntil / 60)}h ${minutesUntil % 60}m`
          const impactStr = (e.impact || '').toString().toLowerCase()
          const isHigh    = ['high', '3'].includes(impactStr)
          const dotColor  = isHigh ? 'var(--red)' : '#f59e0b'

          return (
            <div
              key={e.id}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '3px 6px',
                background: isImminent ? 'rgba(245,158,11,0.08)' : 'transparent',
                borderRadius: 6,
                border: isImminent ? '1px solid rgba(245,158,11,0.2)' : '1px solid transparent',
                animation: isImminent ? 'pulse 1.2s ease-in-out infinite' : 'none',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0 }}>
                <span style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: dotColor, flexShrink: 0,
                  boxShadow: isImminent ? `0 0 6px ${dotColor}` : 'none',
                }} aria-hidden="true" />
                <a
                  href="/calendar"
                  style={{ fontSize: 11, color: 'var(--text-1)', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                >
                  {e.title}
                </a>
              </div>
              <span style={{
                fontSize: 10, color: isImminent ? '#f59e0b' : 'var(--text-3)',
                fontWeight: isImminent ? 700 : 400, flexShrink: 0, marginLeft: 8,
              }}>
                {label}
              </span>
            </div>
          )
        })}
      </div>
      <div style={{ fontSize: 9, color: 'var(--text-3)', marginTop: 4, textAlign: 'right' }}>
        Alerts are informational only. Not financial advice.
      </div>
    </div>
  )
}

// ─── SmartAlertsBar ────────────────────────────────────────────────────────────

interface SmartAlertsBarProps {
  watchlist: string[]
}

/**
 * Bar showing today's P&L summary and smart alerts based on the user's
 * watchlist (earnings in 2 days, win-rate drop, etc.)
 */
export function SmartAlertsBar({ watchlist }: SmartAlertsBarProps) {
  const [alerts, setAlerts] = useState<{ id: string; text: string; type: 'info' | 'warning' | 'success'; link?: string }[]>([])
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const [todayPnl, setTodayPnl] = useState<{ pnl: number; wins: number; losses: number } | null>(null)

  useEffect(() => {
    const newAlerts: typeof alerts = []

    // Today's P&L from journal
    try {
      const trades = JSON.parse(localStorage.getItem('cg_trades') || '[]')
      const today = new Date().toISOString().slice(0, 10)
      const todayTrades = trades.filter((t: { date: string; pnl: number }) => t.date === today)
      if (todayTrades.length > 0) {
        const pnl = todayTrades.reduce((s: number, t: { pnl: number }) => s + t.pnl, 0)
        const wins   = todayTrades.filter((t: { pnl: number }) => t.pnl > 0).length
        const losses = todayTrades.filter((t: { pnl: number }) => t.pnl < 0).length
        setTodayPnl({ pnl, wins, losses })
      }
    } catch {}

    // Watchlist earnings in next 2 days
    try {
      const cal = JSON.parse(localStorage.getItem('cg_cal_cache') || '[]')
      const today = new Date()
      const in2days = new Date(today)
      in2days.setDate(today.getDate() + 2)
      const upcoming = cal.filter((e: { date: string; symbol: string; type: string }) => {
        if (e.type?.toLowerCase() !== 'earnings') return false
        const d = new Date(e.date)
        return d >= today && d <= in2days && watchlist.includes(e.symbol?.toUpperCase())
      })
      upcoming.slice(0, 3).forEach((e: { symbol: string; date: string }) => {
        const days = Math.round((new Date(e.date).getTime() - today.getTime()) / 86400000)
        newAlerts.push({ id: `earn_${e.symbol}`, text: `${e.symbol} earnings in ${days === 0 ? 'today' : `${days}d`} — you hold this`, type: 'warning', link: '/calendar' })
      })
    } catch {}

    // Win rate drop alert
    try {
      const trades = JSON.parse(localStorage.getItem('cg_trades') || '[]')
      const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7)
      const weekTrades = trades.filter((t: { date: string; pnl: number }) => new Date(t.date) >= weekAgo)
      if (weekTrades.length >= 5) {
        const wr = weekTrades.filter((t: { pnl: number }) => t.pnl > 0).length / weekTrades.length
        if (wr < 0.40) newAlerts.push({ id: 'winrate_drop', text: `Win rate this week: ${(wr * 100).toFixed(0)}% — consider reviewing your setups`, type: 'warning', link: '/journal' })
      }
    } catch {}

    setAlerts(newAlerts)
  }, [watchlist])

  const visible = alerts.filter(a => !dismissed.has(a.id))
  if (visible.length === 0 && !todayPnl) return null

  return (
    <div
      role="region"
      aria-label="Smart alerts"
      style={{ maxWidth: '100%', padding: '6px 16px', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', borderBottom: '1px solid var(--border)', background: 'var(--bg-1)' }}
    >
      {todayPnl && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 10px', background: todayPnl.pnl >= 0 ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${todayPnl.pnl >= 0 ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`, borderRadius: 20, fontSize: 11 }}>
          <span style={{ fontWeight: 700, color: todayPnl.pnl >= 0 ? 'var(--green)' : 'var(--red)' }}>
            Today: {todayPnl.pnl >= 0 ? '+' : ''}{todayPnl.pnl.toFixed(2)} USD
          </span>
          <span style={{ color: 'var(--text-3)', fontSize: 10 }}>{todayPnl.wins}W/{todayPnl.losses}L</span>
        </div>
      )}
      {visible.map(a => (
        <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 10px', background: a.type === 'warning' ? 'rgba(245,158,11,0.1)' : a.type === 'success' ? 'rgba(34,197,94,0.1)' : 'var(--bg-3)', border: `1px solid ${a.type === 'warning' ? 'rgba(245,158,11,0.3)' : a.type === 'success' ? 'rgba(34,197,94,0.3)' : 'var(--border)'}`, borderRadius: 20, fontSize: 11 }}>
          <span style={{ color: a.type === 'warning' ? '#f59e0b' : a.type === 'success' ? 'var(--green)' : 'var(--text-2)' }}>
            {a.link ? <a href={a.link} style={{ color: 'inherit', textDecoration: 'none' }}>{a.text}</a> : a.text}
          </span>
          <button
            onClick={() => setDismissed(d => new Set([...d, a.id]))}
            aria-label={`Dismiss alert: ${a.text}`}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', fontSize: 10, padding: '0 2px' }}
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  )
}
