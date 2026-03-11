'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { IconTrendingUp, IconChart, IconMic, IconFlag, IconCalendar, IconArrowLeft, IconClock, IconBuilding } from '../components/Icons'
import PersistentNav from '../components/PersistentNav'
import { formatEventTime, formatEventDate, getUserTimezone, getTimezoneAbbr } from '../lib/timezone'

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
  return formatEventTime(dateStr) || ''
}

function fmtDate(dateStr: string): string {
  return formatEventDate(dateStr) || dateStr
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
          <div key={`e-${idx}`} style={{ minHeight: 90, background: 'var(--bg-1)', borderRadius: 4, opacity: 0.25 }} />
        )

        const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
        const dayEvents = eventsByDay.get(key) || []
        const isToday = key === today
        const isSelected = key === selectedDay

        // Count by impact level for the badge row
        const highCount = dayEvents.filter(e => e.impact === 'High').length
        const medCount = dayEvents.filter(e => e.impact === 'Medium').length
        const lowCount = dayEvents.filter(e => e.impact === 'Low' || e.impact === 'Holiday').length
        const speechCount = dayEvents.filter(e => e.type === 'speech').length
        const earningsCount = dayEvents.filter(e => e.type === 'earnings').length

        // Border color: red if high-impact day, orange if medium, else default
        const borderColor = isToday
          ? 'var(--accent)'
          : isSelected
            ? 'rgba(74,158,255,0.5)'
            : highCount > 0
              ? 'rgba(255,69,96,0.3)'
              : medCount > 0
                ? 'rgba(240,165,0,0.2)'
                : '1px solid transparent'

        return (
          <div
            key={key}
            onClick={() => onSelectDay(key)}
            style={{
              minHeight: 90,
              padding: '5px 6px 5px',
              background: isToday
                ? 'rgba(74,158,255,0.1)'
                : isSelected
                  ? 'rgba(74,158,255,0.06)'
                  : highCount > 0
                    ? 'rgba(255,69,96,0.04)'
                    : 'var(--bg-2)',
              border: `1px solid ${borderColor}`,
              borderRadius: 4,
              cursor: dayEvents.length > 0 ? 'pointer' : 'default',
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
              transition: 'background 0.1s, border-color 0.1s',
            }}
            onMouseEnter={e => { if (dayEvents.length > 0) (e.currentTarget as HTMLDivElement).style.background = 'rgba(74,158,255,0.08)' }}
            onMouseLeave={e => {
              const el = e.currentTarget as HTMLDivElement
              el.style.background = isToday
                ? 'rgba(74,158,255,0.1)'
                : isSelected
                  ? 'rgba(74,158,255,0.06)'
                  : highCount > 0
                    ? 'rgba(255,69,96,0.04)'
                    : 'var(--bg-2)'
            }}
          >
            {/* Day number + total count badge */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: isToday ? 'var(--accent)' : 'var(--text-1)' }}>
                {day}
              </span>
              {dayEvents.length > 0 && (
                <span style={{
                  fontSize: 8, fontWeight: 700,
                  background: highCount > 0 ? 'rgba(255,69,96,0.2)' : medCount > 0 ? 'rgba(240,165,0,0.15)' : 'var(--bg-3)',
                  color: highCount > 0 ? '#ff4560' : medCount > 0 ? '#f0a500' : 'var(--text-3)',
                  padding: '1px 4px', borderRadius: 3,
                }}>
                  {dayEvents.length}
                </span>
              )}
            </div>

            {/* Impact pill row */}
            {dayEvents.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2, marginTop: 2 }}>
                {highCount > 0 && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 2, fontSize: 8, fontWeight: 700,
                    background: 'rgba(255,69,96,0.18)', color: '#ff4560',
                    padding: '1px 4px', borderRadius: 3 }}>
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#ff4560', flexShrink: 0 }} />
                    {highCount}
                  </span>
                )}
                {medCount > 0 && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 2, fontSize: 8, fontWeight: 700,
                    background: 'rgba(240,165,0,0.15)', color: '#f0a500',
                    padding: '1px 4px', borderRadius: 3 }}>
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#f0a500', flexShrink: 0 }} />
                    {medCount}
                  </span>
                )}
                {(earningsCount > 0 || speechCount > 0) && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 2, fontSize: 8, fontWeight: 700,
                    background: 'rgba(139,92,246,0.15)', color: '#8b5cf6',
                    padding: '1px 4px', borderRadius: 3 }}>
                    {earningsCount > 0 && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}><IconChart size={8} />{earningsCount}</span>}
                    {speechCount > 0 && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 1, marginLeft: 2 }}><IconMic size={8} />{speechCount}</span>}
                  </span>
                )}
                {lowCount > 0 && highCount === 0 && medCount === 0 && (
                  <span style={{ fontSize: 8, color: 'var(--text-3)', padding: '1px 3px' }}>
                    {lowCount} low
                  </span>
                )}
              </div>
            )}

            {/* Top event preview (high-impact only) */}
            {highCount > 0 && (
              <div style={{
                fontSize: 8, color: '#ff4560', lineHeight: 1.2,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                marginTop: 1,
              }}>
                {dayEvents.find(e => e.impact === 'High')?.title}
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

function EventRow({ event, showDate, watchlistSymbols }: { event: CalendarEvent; showDate?: boolean; watchlistSymbols?: string[] }) {
  const [expanded, setExpanded] = useState(false)
  const bm = beatsMiss(event.actual, event.forecast)
  const isInWatchlist = watchlistSymbols && event.symbol && watchlistSymbols.includes(event.symbol.toUpperCase())

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
              {isInWatchlist && (
                <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 2, background: 'rgba(74,158,255,0.2)', color: 'var(--accent)', border: '1px solid rgba(74,158,255,0.4)' }}>
                  ★ Watchlist
                </span>
              )}
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
  const [watchlistFilter, setWatchlistFilter] = useState(false)
  const [watchlistSymbols, setWatchlistSymbols] = useState<string[]>([])

  useEffect(() => {
    try {
      const wl = JSON.parse(localStorage.getItem('cg_wl') || '[]') as string[]
      setWatchlistSymbols(wl.map(s => s.toUpperCase()))
    } catch {}
  }, [])
  const [selectedDay, setSelectedDay] = useState<string | null>(
    new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
  )
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
    // Use limit=500 to ensure we get enough events; try pagination endpoint as well
    const url = `${API_BASE}/api/calendar/events?from=${from}&to=${to}&type=all&limit=500&page=1`
    const j = await apiFetchSafe<{ success: boolean; events?: unknown[]; data?: unknown[] }>(url)
    if (j?.success) {
      const evts = (j.events ?? j.data ?? []) as typeof events
      if (evts.length > 0) {
        setEvents(evts)
        setLastRefresh(new Date())
      } else {
        // Fallback: try the upcoming endpoint
        const j2 = await apiFetchSafe<{ success: boolean; data?: unknown[] }>(
          `${API_BASE}/api/calendar/upcoming?days=30&minImpact=1&limit=300`
        )
        if (j2?.success && j2.data && j2.data.length > 0) {
          setEvents(j2.data as typeof events)
          setLastRefresh(new Date())
        } else {
          setEvents([])
        }
      }
    } else if (!j) {
      setError('unavailable')
      setEvents([])
    } else {
      // j exists but success=false — try upcoming fallback
      const j2 = await apiFetchSafe<{ success: boolean; data?: unknown[] }>(
        `${API_BASE}/api/calendar/upcoming?days=30&minImpact=1&limit=300`
      )
      if (j2?.success && j2.data) {
        setEvents(j2.data as typeof events)
        setLastRefresh(new Date())
      } else {
        setEvents([])
      }
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
      if (watchlistFilter && e.type === 'earnings' && e.symbol && !watchlistSymbols.includes(e.symbol.toUpperCase())) return false
      return true
    })
  }, [events, typeFilter, impactFilter, countryFilter, search, watchlistFilter, watchlistSymbols])

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

  // Today's key (stable reference used as fallback)
  const todayKey = useMemo(() => toDateKey(new Date()), [])

  // Selected day events — always falls back to today
  const selectedDayEvents = useMemo(() => {
    const key = selectedDay ?? todayKey
    return (eventsByDay.get(key) || []).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  }, [selectedDay, todayKey, eventsByDay])

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-0)', color: 'var(--text-0)', fontFamily: 'var(--font)' }}>

      {/* ── Persistent Navigation ── */}
      <PersistentNav />

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
          {/* Timezone badge */}
          <span style={{
            display: 'flex', alignItems: 'center', gap: 4,
            fontSize: 10, color: 'var(--text-3)',
            background: 'var(--bg-3)', border: '1px solid var(--border)',
            padding: '2px 8px', borderRadius: 4,
          }}>
            <IconClock size={11} />
            {getTimezoneAbbr(getUserTimezone())}
          </span>
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
        <span>Event data from third-party sources. May be delayed or incomplete. Always verify critical events with official sources. Times shown in {getTimezoneAbbr(getUserTimezone())}.</span>
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
          {watchlistSymbols.length > 0 && (
            <button onClick={() => { setWatchlistFilter(f => !f); if (!watchlistFilter) setTypeFilter('earnings') }} style={{
              fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 4,
              border: watchlistFilter ? '1px solid var(--accent)' : '1px solid var(--border)',
              background: watchlistFilter ? 'var(--accent-dim)' : 'var(--bg-2)',
              color: watchlistFilter ? 'var(--accent)' : 'var(--text-2)',
              cursor: 'pointer',
            }}>
              ★ My Watchlist Earnings
            </button>
          )}
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
              {imp === 'All' ? 'All' : imp === 'High' ? 'High' : imp === 'Medium' ? 'Med' : 'Low'}
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
        <div className="cal-main-grid">
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

            {/* Below-calendar detailed day panel — always visible in month/week view */}
            {view !== 'agenda' && (
              <div style={{ marginTop: 16 }}>
                {/* Panel header */}
                <div style={{
                  padding: '8px 12px',
                  background: 'var(--bg-2)',
                  border: '1px solid var(--border)',
                  borderRadius: '6px 6px 0 0',
                  fontSize: 11, fontWeight: 700, color: 'var(--text-1)',
                  letterSpacing: '0.06em',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <span>
                    {selectedDay
                      ? new Date(selectedDay + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
                      : 'TODAY'
                    }
                    {' '}
                    <span style={{ fontWeight: 400, color: 'var(--text-3)', fontSize: 10 }}>
                      ({selectedDayEvents.length} event{selectedDayEvents.length !== 1 ? 's' : ''})
                      {selectedDay === todayKey && <span style={{ marginLeft: 6, color: 'var(--accent)' }}>· Today</span>}
                    </span>
                  </span>
                  <span style={{ fontSize: 9, color: 'var(--text-3)', fontWeight: 400 }}>Click a day on the calendar to update</span>
                </div>

                {/* Forex Factory-style detailed table */}
                <div style={{
                  background: 'var(--bg-2)', border: '1px solid var(--border)', borderTop: 'none',
                  borderRadius: '0 0 6px 6px', overflow: 'hidden',
                  transition: 'opacity 0.2s',
                }}>
                  {selectedDayEvents.length === 0 ? (
                    <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-3)', fontSize: 12 }}>
                      No events scheduled for this day
                    </div>
                  ) : (
                    <>
                      {/* Column headers */}
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: '60px 24px 1fr 90px 80px 80px 80px',
                        gap: 8, padding: '5px 12px',
                        background: 'var(--bg-3)', borderBottom: '1px solid var(--border)',
                        fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-3)',
                      }}>
                        <div>TIME</div>
                        <div />
                        <div>EVENT</div>
                        <div>IMPACT</div>
                        <div style={{ textAlign: 'right' }}>FORECAST</div>
                        <div style={{ textAlign: 'right' }}>PREVIOUS</div>
                        <div style={{ textAlign: 'right' }}>ACTUAL</div>
                      </div>

                      {/* Grouped by type */}
                      {(['economic', 'speech', 'earnings', 'holiday'] as EventType[]).map(type => {
                        const typeEvents = selectedDayEvents.filter(e => e.type === type)
                        if (typeEvents.length === 0) return null
                        const typeLabel = type === 'economic' ? 'Economic' : type === 'speech' ? 'Speeches' : type === 'earnings' ? 'Earnings' : 'Holidays'
                        const TypeIcon = type === 'economic' ? IconTrendingUp : type === 'speech' ? IconMic : type === 'earnings' ? IconChart : IconBuilding
                        return (
                          <div key={type}>
                            {/* Section header */}
                            <div style={{
                              padding: '5px 12px',
                              background: 'var(--bg-3)',
                              borderBottom: '1px solid var(--border)',
                              borderTop: '1px solid var(--border)',
                              fontSize: 10, fontWeight: 700, color: 'var(--text-2)',
                              letterSpacing: '0.06em',
                            }}>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                <TypeIcon size={10} />{typeLabel}
                              </span>
                              <span style={{ marginLeft: 6, fontWeight: 400, color: 'var(--text-3)', fontSize: 9 }}>
                                {typeEvents.length}
                              </span>
                            </div>

                            {typeEvents.map(event => {
                              const bm = beatsMiss(event.actual, event.forecast)
                              const impactColor = IMPACT_COLORS[event.impact] || 'var(--text-3)'
                              const isSpeech = event.type === 'speech'
                              const isWatchlistEarning = event.type === 'earnings' && event.symbol && watchlistSymbols.includes(event.symbol.toUpperCase())
                              return (
                                <div key={event.id} style={{
                                  display: 'grid',
                                  gridTemplateColumns: '60px 24px 1fr 90px 80px 80px 80px',
                                  gap: 8, padding: '8px 12px',
                                  borderBottom: '1px solid var(--border)',
                                  alignItems: 'center',
                                  borderLeft: isWatchlistEarning ? '3px solid var(--accent)' : isSpeech ? '3px solid #f59e0b' : `3px solid ${impactColor}`,
                                  background: isWatchlistEarning ? 'rgba(74,158,255,0.05)' : event.impact === 'High'
                                    ? 'rgba(255,69,96,0.03)'
                                    : isSpeech ? 'rgba(245,158,11,0.03)' : 'transparent',
                                }}>
                                  {/* Time */}
                                  <div style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>
                                    {fmtTime(event.date)}
                                  </div>
                                  {/* Flag */}
                                  <div style={{ fontSize: 14 }}>
                                    {COUNTRY_FLAGS[event.country] || '🌐'}
                                  </div>
                                  {/* Title + meta */}
                                  <div>
                                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-0)', display: 'flex', alignItems: 'center', gap: 5 }}>
                                      {isSpeech && <span style={{ display: 'inline-flex', alignItems: 'center' }}><IconMic size={11} /></span>}
                                      <span>{event.title}</span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2, flexWrap: 'wrap' }}>
                                      <span style={{ fontSize: 9, color: 'var(--text-3)', fontWeight: 600 }}>{event.country}</span>
                                      {event.type === 'earnings' && event.revenueEstimate != null && (
                                        <span style={{ fontSize: 9, color: 'var(--text-3)' }}>
                                          Rev: {fmtRevenue(event.revenueEstimate)} est
                                          {event.revenueActual != null && ` / ${fmtRevenue(event.revenueActual)} act`}
                                        </span>
                                      )}
                                      {event.url && (
                                        <a href={event.url} target="_blank" rel="noopener" style={{ fontSize: 9, color: 'var(--accent)', textDecoration: 'none' }}>
                                          View →
                                        </a>
                                      )}
                                    </div>
                                  </div>
                                  {/* Impact */}
                                  <div>
                                    <span style={{
                                      fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 3,
                                      background: `${impactColor}22`, color: impactColor,
                                    }}>
                                      {event.impact}
                                    </span>
                                  </div>
                                  {/* Forecast */}
                                  <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--blue)', textAlign: 'right' }}>
                                    {event.type === 'earnings'
                                      ? (event.epsEstimate != null ? `$${event.epsEstimate}` : '—')
                                      : (event.forecast || '—')}
                                  </div>
                                  {/* Previous */}
                                  <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-3)', textAlign: 'right' }}>
                                    {event.type === 'earnings' ? '—' : (event.previous || '—')}
                                  </div>
                                  {/* Actual */}
                                  <div style={{
                                    fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 700, textAlign: 'right',
                                    color: event.actual
                                      ? bm === 'beat' ? '#00c06a' : bm === 'miss' ? '#ff4560' : 'var(--text-0)'
                                      : 'var(--text-3)',
                                  }}>
                                    {event.type === 'earnings' && event.epsActual != null
                                      ? `$${event.epsActual}`
                                      : event.actual || '—'}
                                    {bm && <span style={{ fontSize: 8, marginLeft: 2 }}>{bm === 'beat' ? '▲' : '▼'}</span>}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        )
                      })}
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right: Day summary panel — always visible */}
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
                  {selectedDay
                    ? new Date(selectedDay + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
                    : 'Today'}
                  {selectedDay === todayKey && (
                    <span style={{ marginLeft: 6, fontSize: 9, color: 'var(--accent)', fontWeight: 600 }}>TODAY</span>
                  )}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-3)' }}>
                  {selectedDayEvents.length} event{selectedDayEvents.length !== 1 ? 's' : ''} · quick summary
                </div>
              </div>
              <button onClick={() => setSelectedDay(todayKey)} title="Jump to today" style={{
                background: 'none', border: '1px solid var(--border)', color: 'var(--text-3)',
                cursor: 'pointer', fontSize: 10, borderRadius: 4, padding: '2px 6px',
              }}>Today</button>
            </div>

            {/* Events — compact Forex Factory style */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {selectedDayEvents.length === 0 ? (
                <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-3)', fontSize: 12 }}>
                  No events scheduled for this day
                </div>
              ) : (
                <>
                  {/* Column headers */}
                  <div style={{
                    display: 'grid', gridTemplateColumns: '42px 18px 1fr 52px 52px 52px',
                    gap: 4, padding: '4px 10px',
                    background: 'var(--bg-3)', borderBottom: '1px solid var(--border)',
                    fontSize: 8, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-3)',
                  }}>
                    <div>TIME</div>
                    <div />
                    <div>EVENT</div>
                    <div style={{ textAlign: 'right' }}>FCST</div>
                    <div style={{ textAlign: 'right' }}>PREV</div>
                    <div style={{ textAlign: 'right' }}>ACT</div>
                  </div>

                  {selectedDayEvents.map(event => {
                    const bm = beatsMiss(event.actual, event.forecast)
                    const impactColor = IMPACT_COLORS[event.impact] || 'var(--text-3)'
                    const isSpeech = event.type === 'speech'
                    return (
                      <div key={event.id} style={{
                        display: 'grid', gridTemplateColumns: '42px 18px 1fr 52px 52px 52px',
                        gap: 4, padding: '7px 10px',
                        borderBottom: '1px solid var(--border)',
                        alignItems: 'start',
                        borderLeft: isSpeech ? '3px solid #f59e0b' : `3px solid ${impactColor}`,
                        background: event.impact === 'High'
                          ? 'rgba(255,69,96,0.03)'
                          : isSpeech ? 'rgba(245,158,11,0.03)' : 'transparent',
                      }}>
                        {/* Time */}
                        <div style={{ fontSize: 9, color: 'var(--text-3)', fontFamily: 'var(--mono)', paddingTop: 1 }}>
                          {fmtTime(event.date)}
                        </div>
                        {/* Flag */}
                        <div style={{ fontSize: 11, paddingTop: 1 }}>
                          {COUNTRY_FLAGS[event.country] || '🌐'}
                        </div>
                        {/* Title + meta */}
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-0)', lineHeight: 1.3, marginBottom: 2, display: 'flex', alignItems: 'center', gap: 3 }}>
                            {isSpeech && <span style={{ display: 'inline-flex', alignItems: 'center' }}><IconMic size={10} /></span>}
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{event.title}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                            <span style={{
                              fontSize: 8, fontWeight: 700, padding: '1px 4px', borderRadius: 2,
                              background: `${impactColor}22`, color: impactColor,
                            }}>{event.impact}</span>
                            {event.country && (
                              <span style={{ fontSize: 8, color: 'var(--text-3)', fontWeight: 600 }}>{event.country}</span>
                            )}
                          </div>
                          {event.type === 'earnings' && event.revenueEstimate != null && (
                            <div style={{ fontSize: 8, color: 'var(--text-3)', marginTop: 2 }}>
                              Rev: {fmtRevenue(event.revenueEstimate)} est
                              {event.revenueActual != null && ` / ${fmtRevenue(event.revenueActual)} act`}
                            </div>
                          )}
                        </div>
                        {/* Forecast */}
                        <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--blue)', textAlign: 'right', paddingTop: 1 }}>
                          {event.type === 'earnings'
                            ? (event.epsEstimate != null ? `$${event.epsEstimate}` : '—')
                            : (event.forecast || '—')}
                        </div>
                        {/* Previous */}
                        <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--text-3)', textAlign: 'right', paddingTop: 1 }}>
                          {event.type === 'earnings' ? '—' : (event.previous || '—')}
                        </div>
                        {/* Actual */}
                        <div style={{
                          fontFamily: 'var(--mono)', fontSize: 9, fontWeight: 700, textAlign: 'right', paddingTop: 1,
                          color: event.actual
                            ? bm === 'beat' ? '#00c06a' : bm === 'miss' ? '#ff4560' : 'var(--text-0)'
                            : 'var(--text-3)',
                        }}>
                          {event.actual || '—'}
                          {bm && <span style={{ fontSize: 7, marginLeft: 2 }}>{bm === 'beat' ? '▲' : '▼'}</span>}
                        </div>
                      </div>
                    )
                  })}
                </>
              )}
            </div>
          </div>
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
          { label: 'High Impact', color: '#ff4560' },
          { label: 'Medium Impact', color: '#f0a500' },
          { label: 'Low Impact', color: '#00c06a' },
          { label: 'Earnings', color: '#8b5cf6' },
          { label: 'Speech', color: '#f59e0b' },
          { label: 'Holiday', color: '#6366f1' },
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
