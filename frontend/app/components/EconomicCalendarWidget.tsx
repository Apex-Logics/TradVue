'use client'

import { useState, useMemo } from 'react'
import { fmtEventTime, fmtEventDate } from '../utils/formatting'
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
  // Date-only string: use as-is (assumed ET date from API)
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw
  try {
    return new Date(raw).toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
  } catch { return '' }
}

/** Get event timestamp for sorting / past-vs-upcoming split */
function getEventMs(e: CalendarEvent): number {
  const raw = e.datetime || e.date || ''
  if (!raw) return 0
  // For date-only strings, treat as noon ET so they don't accidentally fall into "past"
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [y, m, d] = raw.split('-').map(Number)
    // noon ET = 16:00 UTC (EDT) or 17:00 UTC (EST) — use 16:30 as safe noon-ish
    const approxNoon = new Date(`${raw}T16:30:00Z`)
    return approxNoon.getTime()
  }
  const ms = new Date(raw).getTime()
  return isNaN(ms) ? 0 : ms
}

/**
 * Economic / earnings / speech calendar widget.
 * - Filtered to TODAY (ET timezone)
 * - Shows last 3 completed events + all upcoming events
 * - Filters out earnings not in watchlist
 * - Scrollable events list
 */
export default function EconomicCalendarWidget({ events, loading, watchlistSymbols }: Props) {
  const [impactFilter, setImpactFilter]     = useState('All')
  const [currencyFilter, setCurrencyFilter] = useState('All')

  const watchlist = useMemo(
    () => (watchlistSymbols && watchlistSymbols.length > 0 ? watchlistSymbols : DEFAULT_WATCHLIST_SYMBOLS),
    [watchlistSymbols]
  )

  const todayET = useMemo(getTodayET, [])

  /**
   * Filter pipeline:
   * 1. Today only (ET)
   * 2. Earnings → only if symbol in watchlist
   * 3. Others → impact + currency filters
   */
  const filtered = useMemo(() => {
    return events.filter(e => {
      // Issue 1: Only today's events (ET timezone)
      if (getEventDateET(e) !== todayET) return false

      // Issue 3: Filter out earnings not in watchlist
      if (e.type === 'earnings') {
        const sym = (e.symbol || e.title?.split(' ')[0] || '').toUpperCase()
        return watchlist.includes(sym)
      }

      // Impact + currency filter for non-earnings
      const impStr = normalizeImpact(e.impact)
      const matchImpact   = impactFilter === 'All' || impStr === impactFilter
      const ccy           = (e.currency || e.country || '').toUpperCase()
      const matchCurrency = currencyFilter === 'All' || ccy === currencyFilter
      return matchImpact && matchCurrency
    })
  }, [events, todayET, watchlist, impactFilter, currencyFilter])

  /**
   * Issue 2: Sort by time, split into past (3 most recent) + upcoming (all)
   * Past = has actual value OR time < now
   */
  const { pastEvents, upcomingEvents } = useMemo(() => {
    const nowMs = Date.now()
    const sorted = [...filtered].sort((a, b) => getEventMs(a) - getEventMs(b))

    const isPast = (e: CalendarEvent) =>
      (e.actual != null && e.actual !== '') || getEventMs(e) < nowMs

    return {
      pastEvents: sorted.filter(isPast).slice(-3),   // last 3 completed
      upcomingEvents: sorted.filter(e => !isPast(e)), // all upcoming
    }
  }, [filtered])

  const displayEvents = useMemo(() => [...pastEvents, ...upcomingEvents], [pastEvents, upcomingEvents])

  const getEventTime = (e: CalendarEvent) => fmtEventTime(e.datetime || e.date || '')

  const speechCount   = filtered.filter(e => e.type === 'speech').length
  const earningsCount = filtered.filter(e => e.type === 'earnings').length

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
          {upcomingEvents.length > 0
            ? `${pastEvents.length} past · ${upcomingEvents.length} upcoming`
            : `${displayEvents.length} events`}
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

      {/* Events — Issue 4: scrollable with max-height */}
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
        ) : displayEvents.length === 0 ? (
          <div style={{ padding: 20, color: 'var(--text-3)', fontSize: 11, textAlign: 'center' }}>
            No events match current filters.
          </div>
        ) : (
          <>
            {/* Past events (greyed out) */}
            {pastEvents.length > 0 && (
              <div>
                <div style={{
                  fontSize: 9, fontWeight: 700, letterSpacing: '0.07em',
                  color: 'var(--text-3)', padding: '4px 12px 2px',
                  background: 'var(--bg-1)', borderBottom: '1px solid var(--border)',
                  textTransform: 'uppercase',
                }}>
                  ↑ Recent
                </div>
                {pastEvents.map(ev => {
                  const icon = typeIcon(ev)
                  const ccy  = (ev.currency || ev.country || '').toUpperCase()
                  return (
                    <div
                      key={ev.id}
                      className="ecal-event"
                      style={{
                        opacity: 0.6,
                        ...(ev.type === 'speech'   ? { borderLeft: '2px solid #f59e0b' } :
                            ev.type === 'earnings' ? { borderLeft: '2px solid #8b5cf6' } : {}),
                      }}
                    >
                      <span className="ecal-time">{getEventTime(ev)}</span>
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
                })}
              </div>
            )}

            {/* Upcoming events */}
            {upcomingEvents.length > 0 && (
              <div>
                {pastEvents.length > 0 && (
                  <div style={{
                    fontSize: 9, fontWeight: 700, letterSpacing: '0.07em',
                    color: 'var(--text-3)', padding: '4px 12px 2px',
                    background: 'var(--bg-1)', borderBottom: '1px solid var(--border)',
                    textTransform: 'uppercase',
                  }}>
                    ↓ Upcoming
                  </div>
                )}
                {upcomingEvents.map(ev => {
                  const icon = typeIcon(ev)
                  const ccy  = (ev.currency || ev.country || '').toUpperCase()
                  return (
                    <div
                      key={ev.id}
                      className="ecal-event"
                      style={
                        ev.type === 'speech'   ? { borderLeft: '2px solid #f59e0b' } :
                        ev.type === 'earnings' ? { borderLeft: '2px solid #8b5cf6' } : {}
                      }
                    >
                      <span className="ecal-time">{getEventTime(ev)}</span>
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
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
