'use client'

import { useState, useMemo } from 'react'
import { fmtEventTime } from '../utils/formatting'
import { CALENDAR_IMPACT_FILTERS, CALENDAR_CURRENCIES } from '../constants'
import { IconMic, IconChart, IconBuilding } from './Icons'
import type { CalendarEvent } from '../types'

const DEFAULT_WATCHLIST_SYMBOLS = [
  'SPY', 'QQQ', 'DIA', 'IWM', 'AAPL', 'GOOGL', 'TSLA', 'MSFT', 'NVDA', 'AMZN', 'META',
]

interface Props {
  events: CalendarEvent[]
  loading: boolean
  watchlistSymbols?: string[]
}

/** Normalize impact to a consistent string value */
function normalizeImpact(impact: number | string): string {
  if (typeof impact === 'string') return impact
  if (impact >= 3) return 'High'
  if (impact >= 2) return 'Medium'
  return 'Low'
}

/** Return an icon for the event type */
function typeIcon(e: CalendarEvent): React.ReactNode {
  if (e.type === 'speech')   return <IconMic size={10} />
  if (e.type === 'earnings') return <IconChart size={10} />
  if (e.type === 'holiday')  return <IconBuilding size={10} />
  return null
}

function impactColorClass(impact: number | string): string {
  const s = normalizeImpact(impact)
  if (s === 'High')   return 'ecal-impact-high'
  if (s === 'Medium') return 'ecal-impact-medium'
  return 'ecal-impact-low'
}

/** Get today's date string (YYYY-MM-DD) in ET timezone */
function getTodayET(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
}

/** Get event's date in ET timezone (YYYY-MM-DD) */
function getEventDateET(e: CalendarEvent): string {
  const raw = e.datetime || e.date || ''
  if (!raw) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw
  try {
    return new Date(raw).toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
  } catch { return '' }
}

/** Get event timestamp for sorting / past-vs-upcoming split */
function getEventMs(e: CalendarEvent): number {
  const raw = e.datetime || e.date || ''
  if (!raw) return 0
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const approxNoon = new Date(`${raw}T16:30:00Z`)
    return approxNoon.getTime()
  }
  const ms = new Date(raw).getTime()
  return isNaN(ms) ? 0 : ms
}

/** Get ET date string for todayET + n days */
function getETDatePlus(todayET: string, n: number): string {
  const [y, m, d] = todayET.split('-').map(Number)
  const date = new Date(y, m - 1, d + n)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

/** Check if a YYYY-MM-DD date is a weekend (Sat or Sun) */
function isWeekendDate(dateStr: string): boolean {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dow = new Date(y, m - 1, d).getDay()
  return dow === 0 || dow === 6
}

/** Format a date section header label */
function getDateHeaderLabel(dateStr: string, todayET: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const formatted = new Date(y, m - 1, d).toLocaleDateString('en-US', {
    weekday: 'long', month: 'short', day: 'numeric',
  })
  if (dateStr === todayET) return `Today — ${formatted}`
  if (dateStr === getETDatePlus(todayET, 1)) return `Tomorrow — ${formatted}`
  return formatted
}

/** Render a single event row (past events are dimmed) */
function renderEventRow(ev: CalendarEvent, past: boolean): React.ReactNode {
  const icon = typeIcon(ev)
  const ccy  = (ev.currency || ev.country || '').toUpperCase()
  return (
    <div
      key={ev.id}
      className="ecal-event"
      style={{
        opacity: past ? 0.6 : 1,
        ...(ev.type === 'speech'   ? { borderLeft: '2px solid #f59e0b' } :
            ev.type === 'earnings' ? { borderLeft: '2px solid #8b5cf6' } : {}),
      }}
    >
      <span className="ecal-time">{fmtEventTime(ev.datetime || ev.date || '')}</span>
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        {icon ? (
          <span style={{ fontSize: 10 }}>{icon}</span>
        ) : (
          <span className={`ecal-impact-dot ${impactColorClass(ev.impact)}`} />
        )}
      </div>
      <span className="ecal-currency">{ccy}</span>
      <div className="ecal-body">
        <span
          className="ecal-event-name"
          style={
            ev.type === 'speech'   ? { color: '#f59e0b' } :
            ev.type === 'earnings' ? { color: '#8b5cf6' } : {}
          }
        >
          {ev.title}
        </span>
        {(ev.actual || ev.forecast || ev.previous) && (
          <div className="ecal-values">
            {ev.actual   && <span className="ecal-actual">A: {ev.actual}</span>}
            {ev.forecast && <span className="ecal-forecast">F: {ev.forecast}</span>}
            {ev.previous && <span className="ecal-previous">P: {ev.previous}</span>}
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Economic / earnings / speech calendar widget.
 * - Shows today + up to 3 days ahead (ET timezone)
 * - Groups events by date with date headers
 * - For today: shows last 3 completed events (↑ Recent) + all upcoming (↓ Upcoming)
 * - For future days: chronological list; weekends show "Market Closed" note
 * - Filters out earnings not in watchlist; applies impact + currency filters
 */
export default function EconomicCalendarWidget({ events, loading, watchlistSymbols }: Props) {
  const [impactFilter, setImpactFilter]     = useState('All')
  const [currencyFilter, setCurrencyFilter] = useState('All')

  const watchlist = useMemo(
    () => (watchlistSymbols && watchlistSymbols.length > 0 ? watchlistSymbols : DEFAULT_WATCHLIST_SYMBOLS),
    [watchlistSymbols]
  )

  const todayET = useMemo(getTodayET, [])

  // Days to display: today through today+3
  const daysToShow = useMemo(
    () => [0, 1, 2, 3].map(n => getETDatePlus(todayET, n)),
    [todayET]
  )

  /**
   * Filter pipeline (applied across all days in range):
   * 1. Date range: [today, today+3]
   * 2. Earnings → only if symbol in watchlist
   * 3. Others → impact + currency filters
   */
  const filtered = useMemo(() => {
    const endET = getETDatePlus(todayET, 3)
    return events.filter(e => {
      const eventDate = getEventDateET(e)
      if (!eventDate || eventDate < todayET || eventDate > endET) return false

      if (e.type === 'earnings') {
        const sym = (e.symbol || e.title?.split(' ')[0] || '').toUpperCase()
        return watchlist.includes(sym)
      }

      const impStr       = normalizeImpact(e.impact)
      const matchImpact  = impactFilter === 'All' || impStr === impactFilter
      const ccy          = (e.currency || e.country || '').toUpperCase()
      const matchCurrency = currencyFilter === 'All' || ccy === currencyFilter
      return matchImpact && matchCurrency
    })
  }, [events, todayET, watchlist, impactFilter, currencyFilter])

  /** Group filtered events by ET date, sorted by time within each day */
  const groupedByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>()
    for (const e of filtered) {
      const dateStr = getEventDateET(e)
      if (!dateStr) continue
      if (!map.has(dateStr)) map.set(dateStr, [])
      map.get(dateStr)!.push(e)
    }
    for (const [, dayEvts] of map) {
      dayEvts.sort((a, b) => getEventMs(a) - getEventMs(b))
    }
    return map
  }, [filtered])

  /** Today's past (last 3) + upcoming split */
  const { todayPast, todayUpcoming } = useMemo(() => {
    const nowMs    = Date.now()
    const todayEvts = groupedByDate.get(todayET) || []
    const isPast   = (e: CalendarEvent) =>
      (e.actual != null && e.actual !== '') || getEventMs(e) < nowMs
    return {
      todayPast:     todayEvts.filter(isPast).slice(-3),
      todayUpcoming: todayEvts.filter(e => !isPast(e)),
    }
  }, [groupedByDate, todayET])

  const speechCount   = filtered.filter(e => e.type === 'speech').length
  const earningsCount = filtered.filter(e => e.type === 'earnings').length

  // Sub-header style (shared between ↑ Recent and ↓ Upcoming)
  const subHeaderStyle: React.CSSProperties = {
    fontSize: 9, fontWeight: 700, letterSpacing: '0.07em',
    color: 'var(--text-3)', padding: '4px 12px 2px',
    background: 'var(--bg-1)', borderBottom: '1px solid var(--border)',
    textTransform: 'uppercase',
  }

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}
      role="region"
      aria-label="Economic calendar"
    >
      {/* Header */}
      <div className="ecal-header">
        <span className="ecal-title">
          <span style={{ color: 'var(--yellow)' }}>◈</span>
          CALENDAR
        </span>

        {speechCount > 0 && (
          <span style={{ fontSize: 9, background: 'rgba(245,158,11,0.18)', color: '#f59e0b', padding: '2px 5px', borderRadius: 3, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
            <IconMic size={9} />{speechCount}
          </span>
        )}
        {earningsCount > 0 && (
          <span style={{ fontSize: 9, background: 'rgba(139,92,246,0.18)', color: '#8b5cf6', padding: '2px 5px', borderRadius: 3, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
            <IconChart size={9} />{earningsCount}
          </span>
        )}

        {/* Impact filter */}
        <div style={{ display: 'flex', gap: 3, marginLeft: 2 }}>
          {CALENDAR_IMPACT_FILTERS.map(f => (
            <button
              key={f}
              className={`ecal-filter-btn${impactFilter === f ? ' active' : ''}`}
              onClick={() => setImpactFilter(f)}
              aria-label={`Filter by ${f} impact`}
              aria-pressed={impactFilter === f}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Currency filter */}
        <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
          {CALENDAR_CURRENCIES.slice(0, 6).map(c => (
            <button
              key={c}
              className={`ecal-filter-btn${currencyFilter === c ? ' active' : ''}`}
              onClick={() => setCurrencyFilter(c)}
              aria-label={`Filter by ${c} currency`}
              aria-pressed={currencyFilter === c}
            >
              {c}
            </button>
          ))}
        </div>

        <span style={{ fontSize: 9.5, color: 'var(--text-3)', marginLeft: 'auto' }}>
          {todayUpcoming.length > 0
            ? `${todayPast.length} past · ${todayUpcoming.length} upcoming today`
            : `${filtered.length} events`}
        </span>
      </div>

      {/* Column headers */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '42px 20px 32px 1fr',
        gap: '0 6px',
        padding: '4px 12px',
        borderBottom: '1px solid var(--border-b)',
        background: 'var(--bg-2)',
      }}>
        {['TIME', 'IMP', 'CCY', 'EVENT & VALUES'].map((h, i) => (
          <span key={i} style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-3)', textAlign: i === 0 ? 'right' : 'left' }}>
            {h}
          </span>
        ))}
      </div>

      {/* Events — scrollable, grouped by date */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        maxHeight: 420,
        scrollbarWidth: 'thin',
        scrollbarColor: 'var(--border) transparent',
      }}>
        {loading ? (
          <div style={{ padding: 20, color: 'var(--text-3)', fontSize: 11, textAlign: 'center' }}>
            Loading calendar…
          </div>
        ) : (
          <>
            {daysToShow.map((dateStr, dayIdx) => {
              const dayEvts  = groupedByDate.get(dateStr) || []
              const weekend  = isWeekendDate(dateStr)
              const isToday  = dateStr === todayET
              const label    = getDateHeaderLabel(dateStr, todayET)

              // Skip non-weekend days with no events
              if (!weekend && dayEvts.length === 0) return null

              return (
                <div key={dateStr}>
                  {/* Date section header */}
                  <div style={{
                    fontSize: 9.5, fontWeight: 700, letterSpacing: '0.06em',
                    color: isToday ? 'var(--accent)' : 'var(--text-2)',
                    padding: '6px 12px 4px',
                    background: 'var(--bg-1)',
                    borderBottom: '1px solid var(--border)',
                    borderTop: dayIdx > 0 ? '2px solid var(--border-b)' : undefined,
                    display: 'flex', alignItems: 'center', gap: 5,
                  }}>
                    <span>📅</span>
                    <span>{label}</span>
                    {dayEvts.length > 0 && (
                      <span style={{ fontSize: 8.5, fontWeight: 400, color: 'var(--text-3)', marginLeft: 'auto' }}>
                        {dayEvts.length} event{dayEvts.length !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>

                  {/* Weekend: Market Closed note */}
                  {weekend && (
                    <div style={{ padding: '7px 12px', color: 'var(--text-3)', fontSize: 10, fontStyle: 'italic' }}>
                      (Market Closed — Weekend)
                    </div>
                  )}

                  {/* Today: ↑ Recent / ↓ Upcoming split */}
                  {isToday && !weekend && (
                    <>
                      {todayPast.length > 0 && (
                        <div>
                          <div style={subHeaderStyle}>↑ Recent</div>
                          {todayPast.map(ev => renderEventRow(ev, true))}
                        </div>
                      )}

                      {todayUpcoming.length > 0 && (
                        <div>
                          {todayPast.length > 0 && (
                            <div style={subHeaderStyle}>↓ Upcoming</div>
                          )}
                          {todayUpcoming.map(ev => renderEventRow(ev, false))}
                        </div>
                      )}

                      {dayEvts.length === 0 && (
                        <div style={{ padding: '8px 12px', color: 'var(--text-3)', fontSize: 10, fontStyle: 'italic' }}>
                          (No events today after filtering)
                        </div>
                      )}
                    </>
                  )}

                  {/* Future days: chronological */}
                  {!isToday && !weekend && dayEvts.length > 0 && (
                    <div>
                      {dayEvts.map(ev => renderEventRow(ev, false))}
                    </div>
                  )}
                </div>
              )
            })}

            {/* Fallback when nothing to show at all */}
            {daysToShow.every(d => (groupedByDate.get(d) || []).length === 0 && !isWeekendDate(d)) && (
              <div style={{ padding: 20, color: 'var(--text-3)', fontSize: 11, textAlign: 'center' }}>
                No events match current filters.
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
