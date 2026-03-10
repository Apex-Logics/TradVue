'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { IconTrendingUp, IconChart, IconMic, IconFlag, IconCalendar, IconArrowLeft } from '../components/Icons'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
import { apiFetchSafe } from '../lib/apiFetch'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type EventType = 'economic' | 'earnings' | 'speech' | 'holiday'
type ImpactLevel = 'High' | 'Medium' | 'Low' | 'Holiday'
type ViewMode = 'month' | 'week' | 'agenda'

interface CalendarEvent {
  id: string
  title: string
  date: string
  type: EventType
  impact: ImpactLevel
  country: string
  forecast: string | null
  previous: string | null
  actual: string | null
  source: string
  // Earnings-specific
  symbol?: string
  epsEstimate?: number | null
  epsActual?: number | null
  revenueEstimate?: number | null
  revenueActual?: number | null
  hour?: string
  // Speech/link
  url?: string | null
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants & Helpers
// ─────────────────────────────────────────────────────────────────────────────

const IMPACT_COLORS: Record<string, string> = {
  High: 'var(--red)',
  Medium: 'var(--yellow)',
  Low: 'var(--green)',
  Holiday: 'var(--purple)',
}

const TYPE_COLORS: Record<EventType, string> = {
  economic: 'var(--blue)',
  earnings: 'var(--purple)',
  speech: 'var(--yellow)',
  holiday: 'var(--purple)',
}

const TYPE_ICON_COMPONENTS: Record<EventType, React.FC<{size?: number}>> = {
  economic: ({ size = 12 }) => <IconTrendingUp size={size} />,
  earnings: ({ size = 12 }) => <IconChart size={size} />,
  speech:   ({ size = 12 }) => <IconMic size={size} />,
  holiday:  ({ size = 12 }) => <IconFlag size={size} />,
}

const COUNTRY_FLAGS: Record<string, string> = {
  USD: '🇺🇸', EUR: '🇪🇺', GBP: '🇬🇧', JPY: '🇯🇵',
  CAD: '🇨🇦', AUD: '🇦🇺', CHF: '🇨🇭', NZD: '🇳🇿',
  CNY: '🇨🇳', CHN: '🇨🇳',
}

function fmtTime(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
  } catch { return '' }
}

function fmtDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  } catch { return dateStr }
}

function fmtRevenue(val: number | null | undefined): string {
  if (val == null) return '—'
  if (val >= 1e9) return `$${(val / 1e9).toFixed(2)}B`
  if (val >= 1e6) return `$${(val / 1e6).toFixed(1)}M`
  return `$${val.toLocaleString()}`
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfMonth(year: number, month: number) {
  const day = new Date(year, month, 1).getDay()
  return day === 0 ? 6 : day - 1 // Mon=0
}

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function getEventDateKey(event: CalendarEvent): string {
  try {
    return new Date(event.date).toISOString().slice(0, 10)
  } catch { return '' }
}

function beatsMiss(actual: string | null, forecast: string | null): 'beat' | 'miss' | null {
  if (!actual || !forecast) return null
  const a = parseFloat(actual.replace(/[^0-9.-]/g, ''))
  const f = parseFloat(forecast.replace(/[^0-9.-]/g, ''))
  if (isNaN(a) || isNaN(f)) return null
  return a >= f ? 'beat' : 'miss'
}

// ─────────────────────────────────────────────────────────────────────────────
// Impact Dot Component
// ─────────────────────────────────────────────────────────────────────────────

function ImpactDot({ impact, type }: { impact: ImpactLevel; type: EventType }) {
  const color = type === 'earnings' ? 'var(--purple)'
    : type === 'speech' ? 'var(--yellow)'
    : type === 'holiday' ? 'var(--purple)'
    : IMPACT_COLORS[impact] || '#888'
  return (
    <span style={{
      display: 'inline-block',
      width: 8, height: 8,
      borderRadius: '50%',
      background: color,
      flexShrink: 0,
    }} />
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Month View Grid
// ─────────────────────────────────────────────────────────────────────────────

function MonthGrid({
  year, month, eventsByDay, selectedDay, onSelectDay
}: {
  year: number
  month: number
  eventsByDay: Map<string, CalendarEvent[]>
  selectedDay: string | null
  onSelectDay: (key: string) => void
}) {
  const daysInMonth = getDaysInMonth(year, month)
  const firstDay = getFirstDayOfMonth(year, month)
  const today = toDateKey(new Date())

  const cells: (number | null)[] = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let i = 1; i <= daysInMonth; i++) cells.push(i)

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1, background: 'var(--border)', borderRadius: 6 }}>
      {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
        <div key={d} style={{
          padding: '7px 4px', textAlign: 'center', fontSize: 10, fontWeight: 700,
          letterSpacing: '0.08em', color: 'var(--text-2)', background: 'var(--bg-2)',
          borderRadius: 4,
        }}>{d}</div>
      ))}

      {cells.map((day, idx) => {
        if (!day) return (
          <div key={`e-${idx}`} style={{ minHeight: 80, background: 'var(--bg-1)', borderRadius: 4, opacity: 0.3 }} />
        )

        const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
        const dayEvents = eventsByDay.get(key) || []
        const isToday = key === today
        const isSelected = key === selectedDay

        // Show up to 3 dots grouped by type/impact
        const dots = dayEvents.slice(0, 5)

        return (
          <div
            key={key}
            onClick={() => onSelectDay(key)}
            style={{
              minHeight: 80,
              padding: '5px 5px 4px',
              background: isToday ? 'rgba(74,158,255,0.12)' : isSelected ? 'rgba(74,158,255,0.07)' : 'var(--bg-2)',
              border: isToday ? '1.5px solid var(--accent)' : isSelected ? '1px solid rgba(59,130,246,0.5)' : '1px solid transparent',
              borderRadius: 4,
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              gap: 3,
              transition: 'background 0.1s',
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 700, color: isToday ? 'var(--accent)' : 'var(--text-1)' }}>
              {day}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
              {dots.map(e => (
                <ImpactDot key={e.id} impact={e.impact} type={e.type} />
              ))}
            </div>
            {dayEvents.length > 0 && (
              <div style={{ fontSize: 8.5, color: 'var(--text-3)', marginTop: 'auto', fontWeight: 600 }}>
                {dayEvents.length} event{dayEvents.length !== 1 ? 's' : ''}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Week View Grid
// ─────────────────────────────────────────────────────────────────────────────

function WeekGrid({
  weekStart, eventsByDay, onSelectDay
}: {
  weekStart: Date
  eventsByDay: Map<string, CalendarEvent[]>
  onSelectDay: (key: string) => void
}) {
  const days: Date[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + i)
    days.push(d)
  }
  const today = toDateKey(new Date())

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8, marginBottom: 16 }}>
      {days.map(day => {
        const key = toDateKey(day)
        const dayEvents = eventsByDay.get(key) || []
        const isToday = key === today

        return (
          <div
            key={key}
            onClick={() => onSelectDay(key)}
            style={{
              background: isToday ? 'rgba(74,158,255,0.12)' : 'var(--bg-2)',
              border: isToday ? '1.5px solid var(--accent)' : '1px solid var(--border)',
              borderRadius: 6, padding: 8, cursor: 'pointer', minHeight: 120,
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 700, color: isToday ? 'var(--accent)' : 'var(--text-1)', marginBottom: 6 }}>
              {day.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {dayEvents.slice(0, 4).map(e => (
                <div key={e.id} style={{
                  fontSize: 9, padding: '2px 4px', borderRadius: 3,
                  background: e.type === 'earnings' ? 'rgba(74,158,255,0.15)'
                    : e.type === 'speech' ? 'rgba(245,158,11,0.2)'
                    : `${IMPACT_COLORS[e.impact]}22`,
                  borderLeft: `2px solid ${e.type === 'earnings' ? 'var(--purple)'
                    : e.type === 'speech' ? 'var(--yellow)'
                    : IMPACT_COLORS[e.impact]}`,
                  color: 'var(--text-0)',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  fontWeight: 500,
                }} title={e.title}>
                  {fmtTime(e.date)} {e.title}
                </div>
              ))}
              {dayEvents.length > 4 && (
                <div style={{ fontSize: 8.5, color: 'var(--text-3)' }}>+{dayEvents.length - 4} more</div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Event Row Component
// ─────────────────────────────────────────────────────────────────────────────

function EventRow({ event, showDate }: { event: CalendarEvent; showDate?: boolean }) {
  const [expanded, setExpanded] = useState(false)
  const bm = beatsMiss(event.actual, event.forecast)

  return (
    <div
      style={{
        borderBottom: '1px solid var(--border)',
        cursor: 'pointer',
      }}
      onClick={() => setExpanded(e => !e)}
    >
      {/* Main row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '56px 1fr 80px 70px 70px 70px',
        alignItems: 'center',
        gap: 8,
        padding: '8px 12px',
        fontSize: 12,
      }}>
        {/* Time */}
        <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-2)' }}>
          {showDate ? fmtDate(event.date) : fmtTime(event.date)}
        </div>

        {/* Title + type icon */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          <span style={{ color: TYPE_COLORS[event.type] }}>{React.createElement(TYPE_ICON_COMPONENTS[event.type], { size: 14 })}</span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 600, color: 'var(--text-0)', fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {event.title}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
              <span style={{ fontSize: 10 }}>{COUNTRY_FLAGS[event.country] || '🌐'}</span>
              <span style={{ fontSize: 9, color: 'var(--text-3)', fontWeight: 600 }}>{event.country}</span>
              <span style={{
                fontSize: 9, fontWeight: 700, padding: '1px 4px', borderRadius: 2,
                background: `${IMPACT_COLORS[event.impact]}22`,
                color: IMPACT_COLORS[event.impact],
              }}>
                {event.impact}
              </span>
            </div>
          </div>
        </div>

        {/* Forecast */}
        <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-2)', textAlign: 'right' }}>
          {event.type === 'earnings' && event.epsEstimate != null
            ? `$${event.epsEstimate}`
            : event.forecast || '—'}
        </div>

        {/* Previous */}
        <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-3)', textAlign: 'right' }}>
          {event.previous || '—'}
        </div>

        {/* Actual */}
        <div style={{
          fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 700, textAlign: 'right',
          color: event.actual
            ? bm === 'beat' ? 'var(--green)'
            : bm === 'miss' ? 'var(--red)'
            : 'var(--text-0)'
            : 'var(--text-3)',
        }}>
          {event.type === 'earnings' && event.epsActual != null
            ? `$${event.epsActual}`
            : event.actual || '—'}
          {bm && <span style={{ fontSize: 9, marginLeft: 3 }}>{bm === 'beat' ? '▲' : '▼'}</span>}
        </div>

        {/* Expand caret */}
        <div style={{ fontSize: 10, color: 'var(--text-3)', textAlign: 'center' }}>
          {expanded ? '▲' : '▼'}
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div style={{
          padding: '8px 12px 12px 56px',
          background: 'var(--bg-1)',
          borderTop: '1px solid var(--border)',
          fontSize: 11,
          color: 'var(--text-2)',
        }}>
          {event.type === 'earnings' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 8 }}>
              <div>
                <div style={{ fontSize: 9, color: 'var(--text-3)', marginBottom: 2 }}>EPS EST</div>
                <div style={{ fontFamily: 'var(--mono)', color: 'var(--blue)' }}>{event.epsEstimate != null ? `$${event.epsEstimate}` : '—'}</div>
              </div>
              <div>
                <div style={{ fontSize: 9, color: 'var(--text-3)', marginBottom: 2 }}>EPS ACTUAL</div>
                <div style={{ fontFamily: 'var(--mono)', color: bm === 'beat' ? 'var(--green)' : bm === 'miss' ? 'var(--red)' : 'var(--text-0)' }}>
                  {event.epsActual != null ? `$${event.epsActual}` : '—'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 9, color: 'var(--text-3)', marginBottom: 2 }}>REV EST</div>
                <div style={{ fontFamily: 'var(--mono)', color: 'var(--blue)' }}>{fmtRevenue(event.revenueEstimate)}</div>
              </div>
              <div>
                <div style={{ fontSize: 9, color: 'var(--text-3)', marginBottom: 2 }}>REV ACTUAL</div>
                <div style={{ fontFamily: 'var(--mono)' }}>{fmtRevenue(event.revenueActual)}</div>
              </div>
            </div>
          )}
          {(event.type === 'speech' || event.type === 'economic') && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 8 }}>
              {event.forecast && (
                <div>
                  <div style={{ fontSize: 9, color: 'var(--text-3)', marginBottom: 2 }}>FORECAST</div>
                  <div style={{ fontFamily: 'var(--mono)', color: 'var(--blue)' }}>{event.forecast}</div>
                </div>
              )}
              {event.previous && (
                <div>
                  <div style={{ fontSize: 9, color: 'var(--text-3)', marginBottom: 2 }}>PREVIOUS</div>
                  <div style={{ fontFamily: 'var(--mono)', color: 'var(--text-2)' }}>{event.previous}</div>
                </div>
              )}
              {event.actual && (
                <div>
                  <div style={{ fontSize: 9, color: 'var(--text-3)', marginBottom: 2 }}>ACTUAL</div>
                  <div style={{ fontFamily: 'var(--mono)', color: bm === 'beat' ? 'var(--green)' : bm === 'miss' ? 'var(--red)' : 'var(--text-0)' }}>{event.actual}</div>
                </div>
              )}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: 10, color: 'var(--text-3)' }}>
            <span>Source: {event.source}</span>
            {event.url && (
              <a href={event.url} target="_blank" rel="noopener" style={{ color: 'var(--accent)', textDecoration: 'none' }}>
                View →
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Agenda / List View
// ─────────────────────────────────────────────────────────────────────────────

function AgendaView({ events }: { events: CalendarEvent[] }) {
  // Group by date
  const groups = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>()
    for (const e of events) {
      const key = getEventDateKey(e)
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(e)
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b))
  }, [events])

  if (groups.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>
        No events match your filters
      </div>
    )
  }

  return (
    <div>
      {/* Column headers */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '56px 1fr 80px 70px 70px 70px',
        gap: 8,
        padding: '6px 12px',
        background: 'var(--bg-3)',
        borderBottom: '1px solid var(--border)',
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: '0.08em',
        color: 'var(--text-3)',
      }}>
        <div>TIME</div>
        <div>EVENT</div>
        <div style={{ textAlign: 'right' }}>FORECAST</div>
        <div style={{ textAlign: 'right' }}>PREV</div>
        <div style={{ textAlign: 'right' }}>ACTUAL</div>
        <div />
      </div>

      {groups.map(([dateKey, dayEvents]) => (
        <div key={dateKey}>
          <div style={{
            padding: '6px 12px',
            background: 'var(--bg-3)',
            borderBottom: '1px solid var(--border)',
            borderTop: '1px solid var(--border)',
            fontSize: 11,
            fontWeight: 700,
            color: 'var(--text-1)',
          }}>
            {new Date(dateKey + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            <span style={{ marginLeft: 8, fontSize: 10, color: 'var(--text-3)', fontWeight: 400 }}>
              {dayEvents.length} event{dayEvents.length !== 1 ? 's' : ''}
            </span>
          </div>
          {dayEvents.map(e => <EventRow key={e.id} event={e} />)}
        </div>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Calendar Page
// ─────────────────────────────────────────────────────────────────────────────

const TYPES: (EventType | 'all')[] = ['all', 'economic', 'earnings', 'speech', 'holiday']
const IMPACTS = ['All', 'High', 'Medium', 'Low']
const COUNTRIES = ['All', 'USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD']
const VIEWS: ViewMode[] = ['month', 'week', 'agenda']

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(() => new Date())
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<ViewMode>('month')
  const [typeFilter, setTypeFilter] = useState<EventType | 'all'>('all')
  const [impactFilter, setImpactFilter] = useState('All')
  const [countryFilter, setCountryFilter] = useState('All')
  const [search, setSearch] = useState('')
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)

  // Compute date range for current view
  const dateRange = useMemo(() => {
    const y = currentDate.getFullYear()
    const m = currentDate.getMonth()
    if (view === 'month') {
      const from = new Date(y, m, 1)
      const to = new Date(y, m + 1, 0)
      return {
        from: toDateKey(from),
        to: toDateKey(to),
      }
    } else if (view === 'week') {
      // Start of current week (Mon)
      const day = currentDate.getDay()
      const diff = day === 0 ? -6 : 1 - day
      const mon = new Date(currentDate)
      mon.setDate(currentDate.getDate() + diff)
      const sun = new Date(mon)
      sun.setDate(mon.getDate() + 6)
      return { from: toDateKey(mon), to: toDateKey(sun) }
    } else {
      // Agenda: next 60 days
      const from = new Date()
      const to = new Date(from.getTime() + 60 * 24 * 3600 * 1000)
      return { from: toDateKey(from), to: toDateKey(to) }
    }
  }, [currentDate, view])

  const fetchEvents = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { from, to } = dateRange
    const j = await apiFetchSafe<{ success: boolean; events: unknown[] }>(`${API_BASE}/api/calendar/events?from=${from}&to=${to}&type=all`)
    if (j?.success && j.events) {
      setEvents(j.events as typeof events)
      setLastRefresh(new Date())
    } else if (!j) {
      setError('unavailable')
      setEvents([])
    }
    setLoading(false)
  }, [dateRange])

  useEffect(() => {
    fetchEvents()
  }, [fetchEvents])

  // Auto-refresh every 5 minutes
  useEffect(() => {
    const t = setInterval(fetchEvents, 5 * 60 * 1000)
    return () => clearInterval(t)
  }, [fetchEvents])

  // Filter events
  const filteredEvents = useMemo(() => {
    return events.filter(e => {
      if (typeFilter !== 'all' && e.type !== typeFilter) return false
      if (impactFilter !== 'All' && e.impact !== impactFilter) return false
      if (countryFilter !== 'All' && e.country !== countryFilter) return false
      if (search && !e.title.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
  }, [events, typeFilter, impactFilter, countryFilter, search])

  // Group by day for calendar
  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>()
    for (const e of filteredEvents) {
      const key = getEventDateKey(e)
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(e)
    }
    return map
  }, [filteredEvents])

  // Stats
  const stats = useMemo(() => ({
    high: filteredEvents.filter(e => e.impact === 'High').length,
    medium: filteredEvents.filter(e => e.impact === 'Medium').length,
    low: filteredEvents.filter(e => e.impact === 'Low').length,
    earnings: filteredEvents.filter(e => e.type === 'earnings').length,
    speeches: filteredEvents.filter(e => e.type === 'speech').length,
  }), [filteredEvents])

  // Navigation
  const goTo = (dir: -1 | 1) => {
    const d = new Date(currentDate)
    if (view === 'month') d.setMonth(d.getMonth() + dir)
    else if (view === 'week') d.setDate(d.getDate() + dir * 7)
    else d.setDate(d.getDate() + dir * 30)
    setCurrentDate(d)
    setSelectedDay(null)
  }

  const goToday = () => {
    setCurrentDate(new Date())
    setSelectedDay(toDateKey(new Date()))
  }

  const getWeekStart = () => {
    const day = currentDate.getDay()
    const diff = day === 0 ? -6 : 1 - day
    const mon = new Date(currentDate)
    mon.setDate(currentDate.getDate() + diff)
    return mon
  }

  const periodLabel = () => {
    const y = currentDate.getFullYear()
    if (view === 'month') {
      return currentDate.toLocaleString('en-US', { month: 'long', year: 'numeric' })
    } else if (view === 'week') {
      const mon = getWeekStart()
      const sun = new Date(mon); sun.setDate(mon.getDate() + 6)
      return `${mon.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${sun.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
    }
    return 'Next 60 Days'
  }

  // Selected day events
  const selectedDayEvents = selectedDay
    ? (eventsByDay.get(selectedDay) || []).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    : []

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-0)', color: 'var(--text-0)', fontFamily: 'var(--font)' }}>

      {/* ── Top Header ── */}
      <header className="page-header">
        <Link href="/" className="back-link">
          <IconArrowLeft size={16} />
          TradVue
        </Link>
        <span style={{ color: 'var(--border)' }}>|</span>
        <div className="page-header-title">
          <span style={{ color: 'var(--accent)' }}><IconCalendar size={18} /></span>
          Economic Calendar
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          {lastRefresh && (
            <span style={{ fontSize: 10, color: 'var(--text-3)' }}>
              Updated {lastRefresh.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button onClick={fetchEvents} style={btnStyle('var(--bg-3)', 'var(--text-1)')}>
            ↻ Refresh
          </button>
          <button onClick={goToday} style={btnStyle('var(--accent)', '#000')}>
            Today
          </button>
        </div>
      </header>

      {/* ── Calendar Data Disclaimer ── */}
      <div style={{
        padding: '8px 16px', background: 'var(--accent-dim)', borderBottom: '1px solid rgba(74,158,255,0.2)',
        fontSize: '10px', color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 6,
      }}>
        <span style={{ color: 'var(--accent)', display: 'flex' }}><IconArrowLeft size={12} style={{ display: 'none' }} /></span>
        <span>Event data from third-party sources. May be delayed or incomplete. Always verify critical events with official sources.</span>
      </div>

      {/* ── Controls Bar ── */}
      <div style={{
        padding: '10px 16px', background: 'var(--bg-1)', borderBottom: '1px solid var(--border)',
        display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center',
      }}>
        {/* Navigation */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={() => goTo(-1)} style={navBtnStyle}>‹</button>
          <span style={{ fontSize: 13, fontWeight: 700, minWidth: 200, textAlign: 'center' }}>{periodLabel()}</span>
          <button onClick={() => goTo(1)} style={navBtnStyle}>›</button>
        </div>

        {/* View toggle */}
        <div style={{ display: 'flex', gap: 2, background: 'var(--bg-2)', padding: 2, borderRadius: 6 }}>
          {VIEWS.map(v => (
            <button key={v} onClick={() => setView(v)} style={{
              fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 4,
              background: view === v ? 'var(--accent)' : 'transparent',
              color: view === v ? '#000' : 'var(--text-2)',
              border: 'none', cursor: 'pointer',
              textTransform: 'capitalize',
            }}>{v}</button>
          ))}
        </div>

        {/* Separator */}
        <div style={{ width: 1, height: 24, background: 'var(--border)' }} />

        {/* Type filters */}
        <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
          {TYPES.map(t => (
            <button key={t} onClick={() => setTypeFilter(t)} style={{
              fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 4,
              border: typeFilter === t ? `1px solid ${t === 'all' ? 'var(--accent)' : TYPE_COLORS[t as EventType]}` : '1px solid var(--border)',
              background: typeFilter === t ? (t === 'all' ? 'var(--accent)' : `${TYPE_COLORS[t as EventType]}22`) : 'var(--bg-2)',
              color: typeFilter === t ? (t === 'all' ? '#000' : TYPE_COLORS[t as EventType]) : 'var(--text-2)',
              cursor: 'pointer',
            }}>
              {t === 'all' ? 'All' : t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {/* Impact filters */}
        <div style={{ display: 'flex', gap: 3 }}>
          {IMPACTS.map(imp => (
            <button key={imp} onClick={() => setImpactFilter(imp)} style={{
              fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 4,
              border: impactFilter === imp ? `1px solid ${imp === 'All' ? 'var(--accent)' : IMPACT_COLORS[imp]}` : '1px solid var(--border)',
              background: impactFilter === imp ? (imp === 'All' ? 'var(--accent)' : `${IMPACT_COLORS[imp]}22`) : 'var(--bg-2)',
              color: impactFilter === imp ? (imp === 'All' ? '#000' : IMPACT_COLORS[imp]) : 'var(--text-2)',
              cursor: 'pointer',
            }}>
              {imp === 'All' ? 'All' : imp === 'High' ? '🔴 High' : imp === 'Medium' ? '🟡 Med' : '🟢 Low'}
            </button>
          ))}
        </div>

        {/* Country filters */}
        <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
          {COUNTRIES.map(c => (
            <button key={c} onClick={() => setCountryFilter(c)} style={{
              fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 4,
              border: countryFilter === c ? '1px solid var(--accent)' : '1px solid var(--border)',
              background: countryFilter === c ? 'var(--accent)' : 'var(--bg-2)',
              color: countryFilter === c ? '#000' : 'var(--text-2)',
              cursor: 'pointer',
            }}>
              {c === 'All' ? 'All' : `${COUNTRY_FLAGS[c] || ''} ${c}`}
            </button>
          ))}
        </div>

        {/* Search */}
        <input
          placeholder="Search events…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            fontSize: 11, padding: '4px 10px', borderRadius: 4,
            background: 'var(--bg-2)', border: '1px solid var(--border)',
            color: 'var(--text-0)', outline: 'none', width: 160,
          }}
        />
      </div>

      {/* ── Stats bar ── */}
      <div style={{
        display: 'flex', gap: 16, padding: '6px 16px',
        background: 'var(--bg-1)', borderBottom: '1px solid var(--border)',
        fontSize: 11, color: 'var(--text-2)',
      }}>
        <span><span style={{ color: 'var(--red)', fontWeight: 700 }}>{stats.high}</span> High</span>
        <span><span style={{ color: 'var(--yellow)', fontWeight: 700 }}>{stats.medium}</span> Medium</span>
        <span><span style={{ color: 'var(--green)', fontWeight: 700 }}>{stats.low}</span> Low</span>
        <span style={{ color: 'var(--border)' }}>|</span>
        <span><span style={{ color: 'var(--purple)', fontWeight: 700 }}>{stats.earnings}</span> Earnings</span>
        <span><span style={{ color: 'var(--yellow)', fontWeight: 700 }}>{stats.speeches}</span> Speeches</span>
        <span style={{ color: 'var(--border)' }}>|</span>
        <span><span style={{ color: 'var(--text-0)', fontWeight: 700 }}>{filteredEvents.length}</span> total</span>
      </div>

      {/* ── Error ── */}
      {error && (
        <div style={{ margin: '12px 16px', padding: '10px 14px', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 'var(--card-radius)', color: 'var(--text-3)', fontSize: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span>Calendar data is temporarily unavailable.</span>
          <button onClick={fetchEvents} style={{ color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12 }}>↻ Retry</button>
        </div>
      )}

      {/* ── Main content ── */}
      {loading ? (
        <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-3)', fontSize: 14 }}>
          Loading calendar data…
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: selectedDay ? '1fr 320px' : '1fr',
          gap: 0,
          minHeight: 'calc(100vh - 160px)',
        }}>
          {/* Left / Main area */}
          <div style={{ padding: 16, overflow: 'hidden' }}>

            {view === 'month' && (
              <MonthGrid
                year={currentDate.getFullYear()}
                month={currentDate.getMonth()}
                eventsByDay={eventsByDay}
                selectedDay={selectedDay}
                onSelectDay={(key) => setSelectedDay(prev => prev === key ? null : key)}
              />
            )}

            {view === 'week' && (
              <WeekGrid
                weekStart={getWeekStart()}
                eventsByDay={eventsByDay}
                onSelectDay={(key) => setSelectedDay(prev => prev === key ? null : key)}
              />
            )}

            {/* Agenda / list view — always show below calendar, full list in agenda mode */}
            {view === 'agenda' && (
              <div style={{
                background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden',
              }}>
                <AgendaView events={filteredEvents} />
              </div>
            )}

            {/* Below-calendar event list for month/week */}
            {view !== 'agenda' && !selectedDay && (
              <div style={{ marginTop: 16 }}>
                <div style={{
                  padding: '8px 12px', background: 'var(--bg-2)', border: '1px solid var(--border)',
                  borderRadius: '6px 6px 0 0', fontSize: 11, fontWeight: 700, color: 'var(--text-1)',
                  letterSpacing: '0.06em',
                }}>
                  UPCOMING EVENTS ({filteredEvents.slice(0, 30).length})
                  <span style={{ marginLeft: 8, fontWeight: 400, color: 'var(--text-3)' }}>— click day to filter</span>
                </div>
                <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderTop: 'none', borderRadius: '0 0 6px 6px', overflow: 'hidden' }}>
                  <AgendaView events={filteredEvents.slice(0, 30)} />
                </div>
              </div>
            )}
          </div>

          {/* Right: Day detail panel */}
          {selectedDay && (
            <div style={{
              background: 'var(--bg-2)', borderLeft: '1px solid var(--border)',
              display: 'flex', flexDirection: 'column',
              position: 'sticky', top: 0, maxHeight: '100vh', overflow: 'hidden',
            }}>
              {/* Panel header */}
              <div style={{
                padding: '10px 14px', background: 'var(--bg-3)', borderBottom: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-0)' }}>
                    {new Date(selectedDay + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-3)' }}>
                    {selectedDayEvents.length} event{selectedDayEvents.length !== 1 ? 's' : ''}
                  </div>
                </div>
                <button onClick={() => setSelectedDay(null)} style={{
                  background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', fontSize: 16,
                }}>✕</button>
              </div>

              {/* Events */}
              <div style={{ flex: 1, overflowY: 'auto' }}>
                {selectedDayEvents.length === 0 ? (
                  <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-3)', fontSize: 12 }}>
                    No events for this day
                  </div>
                ) : (
                  selectedDayEvents.map(event => (
                    <div key={event.id} style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                        <span style={{ color: TYPE_COLORS[event.type] }}>{React.createElement(TYPE_ICON_COMPONENTS[event.type], { size: 14 })}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-0)', lineHeight: 1.3 }}>
                            {event.title}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                            <span style={{ fontSize: 10 }}>{COUNTRY_FLAGS[event.country] || '🌐'}</span>
                            <span style={{ fontSize: 9, fontWeight: 700,
                              color: IMPACT_COLORS[event.impact],
                              background: `${IMPACT_COLORS[event.impact]}22`,
                              padding: '1px 5px', borderRadius: 3,
                            }}>{event.impact}</span>
                            <span style={{ fontSize: 9, color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>
                              {fmtTime(event.date)}
                            </span>
                          </div>

                          {/* Values */}
                          {(event.forecast || event.previous || event.actual || event.epsEstimate != null) && (
                            <div style={{
                              marginTop: 8, padding: 8, background: 'var(--bg-1)', borderRadius: 4,
                              display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, fontSize: 10,
                            }}>
                              <div>
                                <div style={{ fontSize: 8, color: 'var(--text-3)', marginBottom: 2 }}>
                                  {event.type === 'earnings' ? 'EPS EST' : 'FORECAST'}
                                </div>
                                <div style={{ fontFamily: 'var(--mono)', color: 'var(--blue)', fontWeight: 600 }}>
                                  {event.type === 'earnings' ? (event.epsEstimate != null ? `$${event.epsEstimate}` : '—') : (event.forecast || '—')}
                                </div>
                              </div>
                              <div>
                                <div style={{ fontSize: 8, color: 'var(--text-3)', marginBottom: 2 }}>
                                  {event.type === 'earnings' ? 'EPS ACT' : 'PREVIOUS'}
                                </div>
                                <div style={{ fontFamily: 'var(--mono)', color: 'var(--text-2)', fontWeight: 600 }}>
                                  {event.type === 'earnings'
                                    ? (event.epsActual != null ? `$${event.epsActual}` : '—')
                                    : (event.previous || '—')}
                                </div>
                              </div>
                              <div>
                                <div style={{ fontSize: 8, color: 'var(--text-3)', marginBottom: 2 }}>ACTUAL</div>
                                <div style={{
                                  fontFamily: 'var(--mono)', fontWeight: 600,
                                  color: event.actual
                                    ? beatsMiss(event.actual, event.forecast) === 'beat' ? '#00c06a'
                                    : beatsMiss(event.actual, event.forecast) === 'miss' ? '#ff4560'
                                    : 'var(--text-0)'
                                    : 'var(--text-3)',
                                }}>
                                  {event.actual || '—'}
                                </div>
                              </div>
                            </div>
                          )}

                          {event.type === 'earnings' && (
                            <div style={{ marginTop: 6, fontSize: 10, color: 'var(--text-3)' }}>
                              Rev est: {fmtRevenue(event.revenueEstimate)} · Act: {fmtRevenue(event.revenueActual)}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Legend ── */}
      <div style={{
        padding: '10px 16px', background: 'var(--bg-1)', borderTop: '1px solid var(--border)',
        display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 10, color: 'var(--text-3)',
        alignItems: 'center',
      }}>
        <span style={{ fontWeight: 700, color: 'var(--text-2)' }}>LEGEND:</span>
        {[
          { label: '🔴 High Impact', color: '#ff4560' },
          { label: '🟡 Medium Impact', color: '#f0a500' },
          { label: '🟢 Low Impact', color: '#00c06a' },
          { label: '📊 Earnings', color: '#8b5cf6' },
          { label: '🎤 Speech', color: '#f59e0b' },
          { label: '🏛 Holiday', color: '#6366f1' },
        ].map(item => (
          <span key={item.label} style={{ color: item.color, fontWeight: 600 }}>{item.label}</span>
        ))}
      </div>
    </div>
  )
}

// ─── Style helpers ────────────────────────────────────────────────────────────

function btnStyle(bg: string, color: string): React.CSSProperties {
  return {
    fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 4,
    background: bg, color, border: '1px solid var(--border)', cursor: 'pointer',
  }
}

const navBtnStyle: React.CSSProperties = {
  fontSize: 18, cursor: 'pointer', color: 'var(--accent)',
  background: 'none', border: 'none', padding: '2px 8px',
  lineHeight: 1,
}
