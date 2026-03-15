'use client'

import { useMemo, useState, useEffect } from 'react'
import type { Quote, CalendarEvent } from '../types'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

// ─── Types ─────────────────────────────────────────────────────────────────────

interface AnalysisPanelProps {
  wlQuotes: Record<string, Quote>
  tickerQuotes: Record<string, Quote>
  calendarEvents: CalendarEvent[]
  /** Optional ticker to show sentiment for. Defaults to 'SPY'. */
  selectedTicker?: string
}

interface SentimentData {
  symbol: string
  score: number       // -1 to 1 approx; from Marketaux entity sentiment_score averages
  label: 'Bullish' | 'Bearish' | 'Neutral'
  articles: number
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number, decimals = 2): string {
  if (!isFinite(n)) return '—'
  return n.toFixed(decimals)
}

function fmtPct(n: number): string {
  const sign = n >= 0 ? '+' : ''
  return `${sign}${n.toFixed(2)}%`
}

/** Returns current ET time details */
function getETTime() {
  const now = new Date()
  const etStr = now.toLocaleString('en-US', { timeZone: 'America/New_York' })
  const etDate = new Date(etStr)
  const hours = etDate.getHours()
  const minutes = etDate.getMinutes()
  const totalMinutes = hours * 60 + minutes
  return { hours, minutes, totalMinutes, etDate }
}

interface SessionInfo {
  name: string
  active: boolean
  color: string
  nextLabel: string
  nextMinutes: number
}

function getSessionStatus(): SessionInfo[] {
  const { totalMinutes, etDate } = getETTime()
  const day = etDate.getDay() // 0=Sun, 6=Sat

  const isWeekday = day >= 1 && day <= 5
  const preMarketStart = 4 * 60       // 4:00 AM
  const regularOpen    = 9 * 60 + 30  // 9:30 AM
  const regularClose   = 16 * 60      // 4:00 PM
  const afterHoursEnd  = 20 * 60      // 8:00 PM

  const sessions: SessionInfo[] = []

  if (!isWeekday) {
    sessions.push({ name: 'Pre-Market', active: false, color: '#f59e0b', nextLabel: 'Opens Monday 4:00 AM ET', nextMinutes: -1 })
    sessions.push({ name: 'Regular',    active: false, color: '#10b981', nextLabel: 'Opens Monday 9:30 AM ET', nextMinutes: -1 })
    sessions.push({ name: 'After-Hours',active: false, color: '#6366f1', nextLabel: 'Opens Monday 4:00 PM ET', nextMinutes: -1 })
    return sessions
  }

  const preActive   = totalMinutes >= preMarketStart && totalMinutes < regularOpen
  const regActive   = totalMinutes >= regularOpen && totalMinutes < regularClose
  const afterActive = totalMinutes >= regularClose && totalMinutes < afterHoursEnd

  // Pre-Market
  if (preActive) {
    const minsLeft = regularOpen - totalMinutes
    sessions.push({ name: 'Pre-Market', active: true,  color: '#f59e0b', nextLabel: `Regular opens in ${minsLeft}m`, nextMinutes: minsLeft })
  } else if (totalMinutes < preMarketStart) {
    sessions.push({ name: 'Pre-Market', active: false, color: '#f59e0b', nextLabel: `Opens in ${preMarketStart - totalMinutes}m`, nextMinutes: preMarketStart - totalMinutes })
  } else {
    sessions.push({ name: 'Pre-Market', active: false, color: '#f59e0b', nextLabel: 'Tomorrow 4:00 AM ET', nextMinutes: -1 })
  }

  // Regular
  if (regActive) {
    const minsLeft = regularClose - totalMinutes
    const h = Math.floor(minsLeft / 60)
    const m = minsLeft % 60
    const label = h > 0 ? `Closes in ${h}h ${m}m` : `Closes in ${m}m`
    sessions.push({ name: 'Regular',    active: true,  color: '#10b981', nextLabel: label, nextMinutes: minsLeft })
  } else if (totalMinutes < regularOpen) {
    sessions.push({ name: 'Regular',    active: false, color: '#10b981', nextLabel: `Opens in ${regularOpen - totalMinutes}m`, nextMinutes: regularOpen - totalMinutes })
  } else {
    sessions.push({ name: 'Regular',    active: false, color: '#10b981', nextLabel: 'Tomorrow 9:30 AM ET', nextMinutes: -1 })
  }

  // After-Hours
  if (afterActive) {
    const minsLeft = afterHoursEnd - totalMinutes
    sessions.push({ name: 'After-Hours',active: true,  color: '#6366f1', nextLabel: `Closes in ${minsLeft}m`, nextMinutes: minsLeft })
  } else if (totalMinutes < regularClose) {
    sessions.push({ name: 'After-Hours',active: false, color: '#6366f1', nextLabel: `Opens in ${regularClose - totalMinutes}m`, nextMinutes: regularClose - totalMinutes })
  } else {
    sessions.push({ name: 'After-Hours',active: false, color: '#6366f1', nextLabel: 'Tomorrow 4:00 PM ET', nextMinutes: -1 })
  }

  return sessions
}

function vixLabel(vix: number): { label: string; color: string } {
  if (vix < 15)  return { label: 'Low',      color: '#10b981' }
  if (vix < 25)  return { label: 'Normal',   color: '#f59e0b' }
  if (vix < 35)  return { label: 'Elevated', color: '#f97316' }
  return            { label: 'High',      color: '#ef4444' }
}

function isHighImpact(e: CalendarEvent): boolean {
  return e.impact === 'High' || e.impact === 3
}

function eventTimeET(e: CalendarEvent): Date | null {
  const raw = e.datetime || e.date
  if (!raw) return null
  try { return new Date(raw) } catch { return null }
}

// ─── Section header ────────────────────────────────────────────────────────────

function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 7,
      padding: '10px 16px 8px',
      borderBottom: '1px solid var(--border)',
      background: 'var(--bg-1)',
    }}>
      <span style={{ color: 'var(--accent)', display: 'flex' }}>{icon}</span>
      <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-2)', textTransform: 'uppercase' }}>{title}</span>
    </div>
  )
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: 'var(--bg-1)',
      border: '1px solid var(--border)',
      borderRadius: 8,
      overflow: 'hidden',
      marginBottom: 10,
      ...style,
    }}>
      {children}
    </div>
  )
}

// ─── SVG Icons ─────────────────────────────────────────────────────────────────

const PulseIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
  </svg>
)

const ClockIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
  </svg>
)

const ZapIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
  </svg>
)

const BarChartIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
  </svg>
)

const MoverIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>
  </svg>
)

const BreadthIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
  </svg>
)

const SentimentIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <path d="M8 14s1.5 2 4 2 4-2 4-2"/>
    <line x1="9" y1="9" x2="9.01" y2="9"/>
    <line x1="15" y1="9" x2="15.01" y2="9"/>
  </svg>
)

// ─── Market Pulse ──────────────────────────────────────────────────────────────

function MarketPulse({ wlQuotes, tickerQuotes }: { wlQuotes: Record<string, Quote>; tickerQuotes: Record<string, Quote> }) {
  const combined = { ...wlQuotes, ...tickerQuotes }

  const spy = combined['SPY']
  const qqq = combined['QQQ']
  const dia = combined['DIA']

  const pulse = useMemo(() => {
    if (!spy) return 'Fetching market data…'

    const spyChg   = spy.changePct ?? 0
    const qqqChg   = qqq?.changePct ?? 0

    // Market direction sentiment
    const openVsPrev = spy.open && spy.prevClose
      ? spy.open - spy.prevClose
      : null
    const openedBull = openVsPrev !== null ? openVsPrev >= 0 : spyChg >= 0
    const dirWord    = openedBull ? 'bullish' : 'bearish'

    // Intraday move
    const spyPoints  = spy.current - (spy.prevClose || spy.open || spy.current)
    const direction  = spyChg >= 0 ? 'up' : 'down'

    // Find the leading index
    const indices = [
      { name: 'S&P 500', sym: 'SPY', pct: spyChg },
      { name: 'NASDAQ',  sym: 'QQQ', pct: qqqChg },
      ...(dia ? [{ name: 'Dow',    sym: 'DIA', pct: dia.changePct ?? 0 }] : []),
    ]
    const leader = [...indices].sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct))[0]
    const leaderSuffix = leader.sym !== 'SPY'
      ? ` ${leader.name} leading at ${fmtPct(leader.pct)}.`
      : ''

    return `Markets opened ${dirWord}. S&P 500 ${direction} ${Math.abs(spyPoints).toFixed(2)} points (${fmtPct(spyChg)}) at ${fmt(spy.current)}.${leaderSuffix}`
  }, [spy, qqq, dia])

  const overallUp = spy ? (spy.changePct ?? 0) >= 0 : null

  return (
    <Card>
      <SectionHeader icon={<PulseIcon />} title="Market Pulse" />
      <div style={{ padding: '14px 16px' }}>
        <p style={{
          margin: 0,
          fontSize: 13,
          lineHeight: 1.6,
          color: overallUp === null ? 'var(--text-2)' : overallUp ? '#10b981' : '#ef4444',
          fontWeight: 500,
        }}>
          {pulse}
        </p>
        {spy && (
          <div style={{ marginTop: 10, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {[
              { sym: 'SPY', name: 'S&P 500', q: spy },
              { sym: 'QQQ', name: 'NASDAQ',  q: qqq },
              { sym: 'DIA', name: 'Dow',     q: dia },
            ].filter(i => i.q).map(({ sym, name, q }) => {
              const pct = q!.changePct ?? 0
              const up  = pct >= 0
              return (
                <div key={sym} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 600 }}>{name}</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)' }}>${fmt(q!.current)}</span>
                  <span style={{ fontSize: 11, color: up ? '#10b981' : '#ef4444', fontWeight: 600 }}>{fmtPct(pct)}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </Card>
  )
}

// ─── Session Status ────────────────────────────────────────────────────────────

function SessionStatus() {
  const sessions = useMemo(() => getSessionStatus(), [])
  const { etDate } = useMemo(() => getETTime(), [])

  const timeStr = etDate.toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: true, timeZone: 'America/New_York',
  })

  const activeSession = sessions.find(s => s.active)

  return (
    <Card>
      <SectionHeader icon={<ClockIcon />} title="Session Status" />
      <div style={{ padding: '12px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <span style={{ fontSize: 12, color: 'var(--text-2)' }}>
            <strong style={{ color: 'var(--text-1)' }}>{timeStr}</strong> ET
          </span>
          {activeSession ? (
            <span style={{
              fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99,
              background: activeSession.color + '22', color: activeSession.color, letterSpacing: '0.05em',
            }}>
              ● {activeSession.name.toUpperCase()}
            </span>
          ) : (
            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: 'var(--bg-2)', color: 'var(--text-3)' }}>
              ● CLOSED
            </span>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {sessions.map(s => (
            <div key={s.name} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '6px 10px', borderRadius: 6,
              background: s.active ? s.color + '15' : 'transparent',
              border: `1px solid ${s.active ? s.color + '40' : 'var(--border)'}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{
                  width: 7, height: 7, borderRadius: '50%',
                  background: s.active ? s.color : 'var(--border)',
                  display: 'inline-block',
                  boxShadow: s.active ? `0 0 6px ${s.color}` : 'none',
                }} />
                <span style={{ fontSize: 12, fontWeight: s.active ? 700 : 500, color: s.active ? s.color : 'var(--text-2)' }}>
                  {s.name}
                </span>
              </div>
              <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{s.nextLabel}</span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  )
}

// ─── Volatility & Events ───────────────────────────────────────────────────────

function VolatilityEvents({
  tickerQuotes,
  calendarEvents,
}: {
  tickerQuotes: Record<string, Quote>
  calendarEvents: CalendarEvent[]
}) {
  const vix    = tickerQuotes['VIX']
  const vixVal = vix?.current ?? null
  const vixInfo = vixVal !== null ? vixLabel(vixVal) : null

  const now = Date.now()
  const twoHoursMs = 2 * 60 * 60 * 1000

  const upcomingHighImpact = useMemo(() => {
    return calendarEvents
      .filter(isHighImpact)
      .filter(e => {
        const t = eventTimeET(e)
        if (!t) return false
        const diff = t.getTime() - now
        return diff > 0 && diff <= twoHoursMs
      })
      .sort((a, b) => {
        const ta = eventTimeET(a)?.getTime() ?? 0
        const tb = eventTimeET(b)?.getTime() ?? 0
        return ta - tb
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calendarEvents])

  const warnings: string[] = []
  if (vixVal !== null && vixVal > 25) warnings.push(`⚠️ Elevated volatility conditions (VIX: ${fmt(vixVal)})`)
  upcomingHighImpact.forEach(e => {
    const t = eventTimeET(e)
    if (!t) return
    const timeStr = t.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/New_York' })
    warnings.push(`⚠️ ${e.title} at ${timeStr} ET — expect elevated volatility`)
  })

  return (
    <Card>
      <SectionHeader icon={<ZapIcon />} title="Volatility & Events" />
      <div style={{ padding: '12px 16px' }}>
        {/* VIX */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <span style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600 }}>VIX</span>
          {vixVal !== null ? (
            <>
              <span style={{ fontSize: 18, fontWeight: 700, color: vixInfo!.color }}>{fmt(vixVal)}</span>
              <span style={{
                fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99,
                background: vixInfo!.color + '22', color: vixInfo!.color,
              }}>
                {vixInfo!.label}
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-3)' }}>Volatility Index</span>
            </>
          ) : (
            <span style={{ fontSize: 12, color: 'var(--text-3)' }}>No data</span>
          )}
        </div>

        {/* Warnings */}
        {warnings.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
            {warnings.map((w, i) => (
              <div key={i} style={{
                fontSize: 12, padding: '8px 12px', borderRadius: 6,
                background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                color: '#fca5a5', lineHeight: 1.4,
              }}>
                {w}
              </div>
            ))}
          </div>
        )}

        {/* Upcoming high-impact events */}
        {calendarEvents.filter(isHighImpact).slice(0, 3).length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 600, marginBottom: 4 }}>UPCOMING HIGH-IMPACT</span>
            {calendarEvents.filter(isHighImpact).slice(0, 3).map((e, i) => {
              const t = eventTimeET(e)
              const timeStr = t ? t.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/New_York' }) : '—'
              return (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '5px 10px', borderRadius: 5,
                  background: 'var(--bg-2)', border: '1px solid var(--border)',
                }}>
                  <span style={{ fontSize: 11, color: 'var(--text-1)', fontWeight: 500 }}>{e.title}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-3)', whiteSpace: 'nowrap', marginLeft: 8 }}>{timeStr}</span>
                </div>
              )
            })}
          </div>
        ) : (
          <span style={{ fontSize: 12, color: 'var(--text-3)' }}>No high-impact events today</span>
        )}
      </div>
    </Card>
  )
}

// ─── Index Performance Bars ────────────────────────────────────────────────────

function IndexBars({ wlQuotes, tickerQuotes }: { wlQuotes: Record<string, Quote>; tickerQuotes: Record<string, Quote> }) {
  const combined = { ...wlQuotes, ...tickerQuotes }

  const indices = [
    { label: 'SPY',  sym: 'SPY' },
    { label: 'QQQ',  sym: 'QQQ' },
    { label: 'DIA',  sym: 'DIA' },
    { label: 'IWM',  sym: 'IWM' },
    { label: 'BTC',  sym: 'BTC-USD' },
    { label: 'ETH',  sym: 'ETH-USD' },
    { label: 'VIX',  sym: 'VIX' },
  ].map(({ label, sym }) => {
    const q = combined[sym]
    return { label, pct: q?.changePct ?? null }
  })

  const maxAbs = Math.max(...indices.map(i => Math.abs(i.pct ?? 0)), 1)

  return (
    <Card>
      <SectionHeader icon={<BarChartIcon />} title="Index Performance" />
      <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 7 }}>
        {indices.map(({ label, pct }) => {
          const isNull = pct === null
          const up     = !isNull && pct! >= 0
          const barW   = isNull ? 0 : Math.max((Math.abs(pct!) / maxAbs) * 100, 2)
          const color  = up ? '#10b981' : '#ef4444'
          return (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, color: 'var(--text-2)', fontWeight: 700, width: 36, flexShrink: 0 }}>{label}</span>
              <div style={{
                flex: 1, height: 16, borderRadius: 3,
                background: 'var(--bg-2)', border: '1px solid var(--border)',
                overflow: 'hidden', display: 'flex',
                justifyContent: up ? 'flex-start' : 'flex-end',
              }}>
                <div style={{
                  width: `${barW}%`,
                  height: '100%',
                  background: isNull ? 'transparent' : color,
                  borderRadius: 3,
                  opacity: 0.75,
                  transition: 'width 0.4s ease',
                }} />
              </div>
              <span style={{
                fontSize: 11, fontWeight: 700,
                color: isNull ? 'var(--text-3)' : color,
                width: 56, textAlign: 'right', flexShrink: 0,
              }}>
                {isNull ? '—' : fmtPct(pct!)}
              </span>
            </div>
          )
        })}
      </div>
    </Card>
  )
}

// ─── Top Movers ────────────────────────────────────────────────────────────────

function TopMovers({ wlQuotes }: { wlQuotes: Record<string, Quote> }) {
  const quotes = Object.values(wlQuotes).filter(q => isFinite(q.changePct))
  const sorted = [...quotes].sort((a, b) => b.changePct - a.changePct)
  const gainers = sorted.slice(0, 3)
  const losers  = sorted.slice(-3).reverse()

  if (quotes.length === 0) {
    return (
      <Card>
        <SectionHeader icon={<MoverIcon />} title="Top Movers" />
        <div style={{ padding: '12px 16px', color: 'var(--text-3)', fontSize: 12 }}>No watchlist data yet</div>
      </Card>
    )
  }

  return (
    <Card>
      <SectionHeader icon={<MoverIcon />} title="Top Movers" />
      <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* Gainers */}
        <div>
          <div style={{ fontSize: 10, color: '#10b981', fontWeight: 700, marginBottom: 5, letterSpacing: '0.05em' }}>▲ TOP GAINERS</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {gainers.map(q => (
              <div key={q.symbol} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '5px 10px', borderRadius: 5,
                background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)',
              }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-1)' }}>{q.symbol}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#10b981' }}>{fmtPct(q.changePct)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Losers */}
        <div>
          <div style={{ fontSize: 10, color: '#ef4444', fontWeight: 700, marginBottom: 5, letterSpacing: '0.05em' }}>▼ TOP LOSERS</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {losers.map(q => (
              <div key={q.symbol} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '5px 10px', borderRadius: 5,
                background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
              }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-1)' }}>{q.symbol}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#ef4444' }}>{fmtPct(q.changePct)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  )
}

// ─── Market Breadth ────────────────────────────────────────────────────────────

function MarketBreadth({ wlQuotes }: { wlQuotes: Record<string, Quote> }) {
  const quotes = Object.values(wlQuotes)
  const total  = quotes.length
  const green  = quotes.filter(q => (q.changePct ?? 0) >= 0).length
  const red    = total - green

  const ratio  = total > 0 ? green / total : 0.5
  const sentiment =
    ratio > 0.65 ? { word: 'Broadly bullish', color: '#10b981' }
    : ratio < 0.35 ? { word: 'Broadly bearish', color: '#ef4444' }
    : { word: 'Mixed', color: '#f59e0b' }

  return (
    <Card>
      <SectionHeader icon={<BreadthIcon />} title="Market Breadth" />
      <div style={{ padding: '12px 16px' }}>
        {total === 0 ? (
          <span style={{ fontSize: 12, color: 'var(--text-3)' }}>No watchlist data yet</span>
        ) : (
          <>
            <p style={{ margin: '0 0 10px', fontSize: 13, color: 'var(--text-1)' }}>
              <strong style={{ color: sentiment.color }}>{green}</strong> of <strong>{total}</strong> watchlist stocks are green — <span style={{ color: sentiment.color }}>{sentiment.word}</span>
            </p>

            {/* Breadth bar */}
            <div style={{ height: 8, borderRadius: 4, overflow: 'hidden', background: 'var(--bg-2)', border: '1px solid var(--border)' }}>
              <div style={{
                width: `${ratio * 100}%`,
                height: '100%',
                background: `linear-gradient(90deg, #10b981, #34d399)`,
                borderRadius: 4,
                transition: 'width 0.4s ease',
              }} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5 }}>
              <span style={{ fontSize: 10, color: '#10b981', fontWeight: 600 }}>▲ {green} green</span>
              <span style={{ fontSize: 10, color: '#ef4444', fontWeight: 600 }}>{red} red ▼</span>
            </div>
          </>
        )}
      </div>
    </Card>
  )
}

// ─── Market Sentiment ──────────────────────────────────────────────────────────

function MarketSentiment({ ticker }: { ticker: string }) {
  const [sentiment, setSentiment] = useState<SentimentData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!ticker) return

    let cancelled = false
    setLoading(true)
    setError(null)
    setSentiment(null)

    fetch(`${API_BASE}/api/sentiment/${encodeURIComponent(ticker)}`)
      .then(r => r.json())
      .then((json: { success: boolean; data?: SentimentData; error?: string }) => {
        if (cancelled) return
        if (json.success && json.data) {
          setSentiment(json.data)
        } else {
          setError(json.error || 'No sentiment data available')
        }
      })
      .catch(() => {
        if (!cancelled) setError('Failed to load sentiment data')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [ticker])

  const labelColor =
    sentiment?.label === 'Bullish'  ? '#10b981' :
    sentiment?.label === 'Bearish'  ? '#ef4444' :
    '#f59e0b'

  // Gauge: score ranges roughly -1 to +1, map to 0–100%
  // Clamp to [-1, 1] then shift to [0, 100]
  const gaugePercent = sentiment
    ? Math.round((Math.min(1, Math.max(-1, sentiment.score)) + 1) / 2 * 100)
    : 50

  const positiveWidth = Math.max(0, gaugePercent)
  const negativeWidth = Math.max(0, 100 - gaugePercent)

  return (
    <Card>
      <SectionHeader icon={<SentimentIcon />} title={`Market Sentiment — ${ticker}`} />
      <div style={{ padding: '12px 16px' }}>
        {loading && (
          <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Loading sentiment…</span>
        )}

        {!loading && (error || (sentiment && sentiment.articles === 0)) && (
          <span style={{ fontSize: 12, color: 'var(--text-3)' }}>No sentiment data available</span>
        )}

        {!loading && sentiment && sentiment.articles > 0 && (
          <>
            {/* Label + score */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <span style={{
                fontSize: 18, fontWeight: 700, color: labelColor,
              }}>
                {sentiment.label}
              </span>
              <span style={{
                fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99,
                background: labelColor + '22', color: labelColor,
              }}>
                {sentiment.score >= 0 ? '+' : ''}{sentiment.score.toFixed(3)}
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-3)', marginLeft: 'auto' }}>
                {sentiment.articles} article{sentiment.articles !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Gauge bar: green (bullish) left, red (bearish) right */}
            <div style={{ marginBottom: 8 }}>
              <div style={{
                height: 10, borderRadius: 5, overflow: 'hidden',
                background: 'var(--bg-2)', border: '1px solid var(--border)',
                display: 'flex',
              }}>
                <div style={{
                  width: `${positiveWidth}%`,
                  background: 'linear-gradient(90deg, #10b981, #34d399)',
                  transition: 'width 0.4s ease',
                }} />
                <div style={{
                  width: `${negativeWidth}%`,
                  background: 'linear-gradient(90deg, #ef4444, #fca5a5)',
                  transition: 'width 0.4s ease',
                }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                <span style={{ fontSize: 10, color: '#10b981', fontWeight: 600 }}>Bullish</span>
                <span style={{ fontSize: 10, color: '#ef4444', fontWeight: 600 }}>Bearish</span>
              </div>
            </div>

            {/* Article count note */}
            <p style={{ margin: 0, fontSize: 11, color: 'var(--text-3)', lineHeight: 1.4 }}>
              Score averaged from {sentiment.articles} recent news article{sentiment.articles !== 1 ? 's' : ''} via Marketaux.
            </p>
          </>
        )}
      </div>
    </Card>
  )
}

// ─── AnalysisPanel ─────────────────────────────────────────────────────────────

export default function AnalysisPanel({ wlQuotes, tickerQuotes, calendarEvents, selectedTicker }: AnalysisPanelProps) {
  const sentimentTicker = selectedTicker || 'SPY'

  return (
    <div
      role="region"
      aria-label="Market Analysis"
      style={{
        padding: '12px 12px 24px',
        display: 'flex',
        flexDirection: 'column',
        gap: 0,
        overflowY: 'auto',
        height: '100%',
      }}
    >
      {/* Feed title */}
      <div style={{ padding: '10px 4px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span className="live-dot" aria-hidden="true" />
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-2)', textTransform: 'uppercase' }}>
          Market Analysis
        </span>
      </div>

      <MarketPulse     wlQuotes={wlQuotes}     tickerQuotes={tickerQuotes} />
      <MarketSentiment ticker={sentimentTicker} />
      <SessionStatus />
      <VolatilityEvents tickerQuotes={tickerQuotes} calendarEvents={calendarEvents} />
      <IndexBars       wlQuotes={wlQuotes}     tickerQuotes={tickerQuotes} />
      <TopMovers       wlQuotes={wlQuotes} />
      <MarketBreadth   wlQuotes={wlQuotes} />
    </div>
  )
}
