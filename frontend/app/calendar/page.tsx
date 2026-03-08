'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface CalendarEvent {
  id: string
  title: string
  currency: string
  impact: number
  impactLabel: string
  datetime: string
  actual: string | null
  forecast: string | null
  previous: string | null
  source: string
  url?: string | null
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const CALENDAR_IMPACT_FILTERS = ['All', 'High', 'Medium', 'Low']
const CALENDAR_CURRENCIES = ['All', 'USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'NZD']

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function fmt(num: number, dec = 2): string {
  return num.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec })
}

function fmtEventTime(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
  } catch {
    return dateStr
  }
}

function fmtEventDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  } catch {
    return dateStr
  }
}

function getDayOfWeek(date: Date): number {
  const day = date.getDay()
  return day === 0 ? 6 : day - 1 // Convert Sunday=0 to Monday=0
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfMonth(year: number, month: number): number {
  return getDayOfWeek(new Date(year, month, 1))
}

// ─────────────────────────────────────────────────────────────────────────────
// Month Calendar Grid Component
// ─────────────────────────────────────────────────────────────────────────────

interface MonthCalendarProps {
  year: number
  month: number
  events: CalendarEvent[]
  selectedDay: number | null
  onSelectDay: (day: number) => void
  filteredEvents: CalendarEvent[]
}

function MonthCalendar({
  year,
  month,
  events,
  selectedDay,
  onSelectDay,
  filteredEvents,
}: MonthCalendarProps) {
  const daysInMonth = getDaysInMonth(year, month)
  const firstDay = getFirstDayOfMonth(year, month)
  const today = new Date()
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month
  const todayDate = isCurrentMonth ? today.getDate() : null

  // Create calendar grid
  const days: (number | null)[] = []
  for (let i = 0; i < firstDay; i++) days.push(null)
  for (let i = 1; i <= daysInMonth; i++) days.push(i)

  // Get events for a specific day
  const getEventsForDay = (day: number): CalendarEvent[] => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return filteredEvents.filter(e => {
      const eventDate = new Date(e.datetime).toISOString().split('T')[0]
      return eventDate === dateStr
    })
  }

  const getImpactColor = (impact: number): string => {
    if (impact === 3) return '#ff4560' // High - red
    if (impact === 2) return '#f0a500' // Medium - yellow
    return '#00c06a' // Low - green
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1, background: 'var(--border)', padding: 1, borderRadius: 6, marginBottom: 24 }}>
      {/* Day headers */}
      {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
        <div
          key={day}
          style={{
            padding: '8px 4px',
            textAlign: 'center',
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.08em',
            color: 'var(--text-2)',
            background: 'var(--bg-2)',
            borderRadius: 4,
          }}
        >
          {day}
        </div>
      ))}

      {/* Day cells */}
      {days.map((day, idx) => {
        const dayEvents = day ? getEventsForDay(day) : []
        const isToday = day === todayDate
        const isSelected = day === selectedDay

        return (
          <div
            key={idx}
            onClick={() => day && onSelectDay(day)}
            style={{
              minHeight: 100,
              padding: 6,
              background: isToday
                ? 'var(--bg-3)'
                : isSelected
                ? 'var(--bg-4)'
                : 'var(--bg-2)',
              border: isToday ? '2px solid var(--accent)' : isSelected ? '1px solid var(--accent)' : '1px solid var(--border)',
              borderRadius: 4,
              cursor: day ? 'pointer' : 'default',
              transition: 'all 0.15s',
              display: 'flex',
              flexDirection: 'column',
              opacity: day ? 1 : 0.3,
              overflow: 'hidden',
            }}
            onMouseEnter={(e) => {
              if (day && !isSelected && !isToday) {
                (e.currentTarget as HTMLDivElement).style.background = 'var(--bg-3)'
              }
            }}
            onMouseLeave={(e) => {
              if (day && !isSelected && !isToday) {
                (e.currentTarget as HTMLDivElement).style.background = 'var(--bg-2)'
              }
            }}
          >
            {/* Day number */}
            {day && (
              <div style={{
                fontSize: 12,
                fontWeight: 700,
                color: isToday ? 'var(--accent)' : 'var(--text-0)',
                marginBottom: 4,
              }}>
                {day}
              </div>
            )}

            {/* Events in day */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, overflow: 'hidden' }}>
              {dayEvents.slice(0, 3).map(event => (
                <div
                  key={event.id}
                  style={{
                    fontSize: 9,
                    padding: '2px 4px',
                    borderRadius: 3,
                    background: getImpactColor(event.impact),
                    color: '#000',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    fontWeight: 600,
                  }}
                  title={event.title}
                >
                  {event.title}
                </div>
              ))}
              {dayEvents.length > 3 && (
                <div style={{ fontSize: 8.5, color: 'var(--text-3)', fontWeight: 500 }}>
                  +{dayEvents.length - 3} more
                </div>
              )}
            </div>

            {/* Event count badge */}
            {dayEvents.length > 0 && (
              <div style={{
                fontSize: 9,
                fontWeight: 700,
                color: 'var(--accent)',
                marginTop: 'auto',
                paddingTop: 4,
              }}>
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
// Main Calendar Page Component
// ─────────────────────────────────────────────────────────────────────────────

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(() => new Date())
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [impactFilter, setImpactFilter] = useState('All')
  const [currencyFilter, setCurrencyFilter] = useState('All')
  const [selectedDay, setSelectedDay] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  // Fetch events for the current month view (+ buffer for day transitions)
  const fetchCalendarEvents = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // Fetch a 60-day window centered on the current month
      const res = await fetch(`${API_BASE}/api/calendar/upcoming?days=60&minImpact=1`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const j = await res.json()
      if (j.success && j.data) {
        setEvents(j.data)
      } else {
        throw new Error(j.error || 'Failed to fetch calendar')
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      setError(`Failed to load calendar: ${msg}`)
      setEvents([])
    } finally {
      setLoading(false)
    }
  }, [])

  // Initial load
  useEffect(() => {
    fetchCalendarEvents()
  }, [fetchCalendarEvents])

  // Apply filters
  const filteredEvents = events.filter(e => {
    const matchImpact = impactFilter === 'All' || e.impactLabel === impactFilter
    const matchCurrency = currencyFilter === 'All' || e.currency === currencyFilter
    return matchImpact && matchCurrency
  })

  // Get events for the selected day
  const selectedDayEvents = selectedDay
    ? filteredEvents.filter(e => {
      const eventDate = new Date(e.datetime)
      return (
        eventDate.getFullYear() === year &&
        eventDate.getMonth() === month &&
        eventDate.getDate() === selectedDay
      )
    }).sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime())
    : []

  // Navigate months
  const goToPrevMonth = () => {
    setCurrentDate(new Date(year, month - 1))
    setSelectedDay(null)
  }

  const goToNextMonth = () => {
    setCurrentDate(new Date(year, month + 1))
    setSelectedDay(null)
  }

  const goToToday = () => {
    const today = new Date()
    setCurrentDate(today)
    setSelectedDay(today.getDate())
  }

  const monthName = currentDate.toLocaleString('en-US', { month: 'long' })

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg-0)',
      color: 'var(--text-0)',
      fontFamily: 'var(--font)',
    }}>
      {/* Header */}
      <header style={{
        height: 40,
        background: 'var(--bg-1)',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 16px',
        gap: 16,
      }}>
        <Link
          href="/"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            textDecoration: 'none',
            color: 'var(--text-0)',
            fontWeight: 700,
            fontSize: 14,
          }}
        >
          ← ChartGenius
        </Link>
        <span style={{ fontSize: 12, color: 'var(--text-2)' }}>Economic Calendar</span>
        <button
          onClick={goToToday}
          style={{
            marginLeft: 'auto',
            fontSize: 11,
            fontWeight: 600,
            padding: '4px 10px',
            borderRadius: 4,
            background: 'var(--accent)',
            color: '#fff',
            cursor: 'pointer',
            border: 'none',
          }}
        >
          Today
        </button>
      </header>

      {/* Main container */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 320px',
        gap: 16,
        padding: 16,
        maxWidth: 1600,
        margin: '0 auto',
      }}>
        {/* Left: Calendar + Month Navigation */}
        <div>
          {/* Month navigation */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 16,
            padding: '8px 12px',
            background: 'var(--bg-2)',
            borderRadius: 6,
            border: '1px solid var(--border)',
          }}>
            <button
              onClick={goToPrevMonth}
              style={{
                fontSize: 16,
                cursor: 'pointer',
                color: 'var(--accent)',
                background: 'none',
                border: 'none',
                padding: '4px 8px',
              }}
            >
              ←
            </button>
            <span style={{
              fontSize: 16,
              fontWeight: 700,
              color: 'var(--text-0)',
              minWidth: 200,
              textAlign: 'center',
            }}>
              {monthName} {year}
            </span>
            <button
              onClick={goToNextMonth}
              style={{
                fontSize: 16,
                cursor: 'pointer',
                color: 'var(--accent)',
                background: 'none',
                border: 'none',
                padding: '4px 8px',
              }}
            >
              →
            </button>
          </div>

          {/* Filters */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ marginBottom: 12 }}>
              <div style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.08em',
                color: 'var(--text-2)',
                marginBottom: 6,
              }}>
                IMPACT LEVEL
              </div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {CALENDAR_IMPACT_FILTERS.map(f => (
                  <button
                    key={f}
                    onClick={() => setImpactFilter(f)}
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      padding: '4px 8px',
                      borderRadius: 4,
                      border: impactFilter === f ? '1px solid var(--accent)' : '1px solid var(--border)',
                      background: impactFilter === f ? 'var(--accent)' : 'var(--bg-2)',
                      color: impactFilter === f ? '#000' : 'var(--text-1)',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.08em',
                color: 'var(--text-2)',
                marginBottom: 6,
              }}>
                CURRENCY
              </div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {CALENDAR_CURRENCIES.map(c => (
                  <button
                    key={c}
                    onClick={() => setCurrencyFilter(c)}
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      padding: '4px 8px',
                      borderRadius: 4,
                      border: currencyFilter === c ? '1px solid var(--accent)' : '1px solid var(--border)',
                      background: currencyFilter === c ? 'var(--accent)' : 'var(--bg-2)',
                      color: currencyFilter === c ? '#000' : 'var(--text-1)',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Error message */}
          {error && (
            <div style={{
              padding: 12,
              background: 'rgba(255, 69, 96, 0.1)',
              border: '1px solid var(--red)',
              borderRadius: 6,
              color: 'var(--red)',
              fontSize: 12,
              marginBottom: 16,
            }}>
              {error}
              <button
                onClick={fetchCalendarEvents}
                style={{
                  marginTop: 8,
                  fontSize: 11,
                  padding: '4px 8px',
                  background: 'var(--red)',
                  color: '#fff',
                  borderRadius: 4,
                  cursor: 'pointer',
                  border: 'none',
                  display: 'block',
                }}
              >
                Retry
              </button>
            </div>
          )}

          {/* Loading state */}
          {loading && (
            <div style={{
              padding: 40,
              textAlign: 'center',
              color: 'var(--text-3)',
              fontSize: 13,
            }}>
              Loading calendar data…
            </div>
          )}

          {/* Month calendar */}
          {!loading && (
            <MonthCalendar
              year={year}
              month={month}
              events={events}
              selectedDay={selectedDay}
              onSelectDay={setSelectedDay}
              filteredEvents={filteredEvents}
            />
          )}

          {/* Stats */}
          {!loading && filteredEvents.length > 0 && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 8,
              marginTop: 16,
            }}>
              {[
                { label: 'HIGH', count: filteredEvents.filter(e => e.impact === 3).length, color: 'var(--red)' },
                { label: 'MEDIUM', count: filteredEvents.filter(e => e.impact === 2).length, color: 'var(--yellow)' },
                { label: 'LOW', count: filteredEvents.filter(e => e.impact === 1).length, color: 'var(--green)' },
              ].map(s => (
                <div
                  key={s.label}
                  style={{
                    padding: '12px 8px',
                    background: 'var(--bg-2)',
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                    textAlign: 'center',
                  }}
                >
                  <div style={{ fontSize: 16, fontWeight: 700, color: s.color, fontFamily: 'var(--mono)' }}>
                    {s.count}
                  </div>
                  <div style={{ fontSize: 9, color: 'var(--text-3)', letterSpacing: '0.05em', marginTop: 2 }}>
                    {s.label}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: Event Details Panel */}
        <div style={{
          background: 'var(--bg-2)',
          border: '1px solid var(--border)',
          borderRadius: 6,
          display: 'flex',
          flexDirection: 'column',
          height: 'fit-content',
          maxHeight: 'calc(100vh - 100px)',
          overflow: 'hidden',
          position: 'sticky',
          top: 56,
        }}>
          {/* Panel header */}
          <div style={{
            padding: '12px 16px',
            borderBottom: '1px solid var(--border)',
            background: 'var(--bg-3)',
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-0)', letterSpacing: '0.06em' }}>
              {selectedDay ? `${monthName} ${selectedDay}, ${year}` : 'Select a day'}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 2 }}>
              {selectedDay ? `${selectedDayEvents.length} event${selectedDayEvents.length !== 1 ? 's' : ''}` : 'No day selected'}
            </div>
          </div>

          {/* Events list */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {selectedDay && selectedDayEvents.length === 0 ? (
              <div style={{
                padding: 16,
                color: 'var(--text-3)',
                fontSize: 12,
                textAlign: 'center',
              }}>
                No events for this day
              </div>
            ) : selectedDay && selectedDayEvents.length > 0 ? (
              selectedDayEvents.map(event => {
                const impactColor = event.impact === 3 ? 'var(--red)' : event.impact === 2 ? 'var(--yellow)' : 'var(--green)'
                const impactEmoji = event.impact === 3 ? '🔴' : event.impact === 2 ? '🟡' : '🟢'

                return (
                  <div
                    key={event.id}
                    style={{
                      padding: 12,
                      borderBottom: '1px solid var(--border)',
                    }}
                  >
                    {/* Time */}
                    <div style={{
                      fontSize: 10,
                      fontFamily: 'var(--mono)',
                      color: 'var(--text-2)',
                      marginBottom: 4,
                    }}>
                      {fmtEventTime(event.datetime)}
                    </div>

                    {/* Title + Impact */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 6,
                      marginBottom: 8,
                    }}>
                      <span style={{ fontSize: 13 }}>{impactEmoji}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: 'var(--text-0)',
                          lineHeight: 1.3,
                        }}>
                          {event.title}
                        </div>
                        <div style={{
                          fontSize: 10,
                          color: impactColor,
                          fontWeight: 600,
                          marginTop: 2,
                        }}>
                          {event.impactLabel} Impact
                        </div>
                      </div>
                    </div>

                    {/* Currency badge */}
                    <div style={{
                      fontSize: 9,
                      fontWeight: 700,
                      letterSpacing: '0.06em',
                      color: '#fff',
                      background: 'var(--accent)',
                      display: 'inline-block',
                      padding: '2px 6px',
                      borderRadius: 3,
                      marginBottom: 8,
                    }}>
                      {event.currency}
                    </div>

                    {/* Values */}
                    {(event.actual !== null || event.forecast || event.previous) && (
                      <div style={{
                        fontSize: 10,
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: 6,
                        marginTop: 8,
                        padding: '8px',
                        background: 'var(--bg-1)',
                        borderRadius: 4,
                      }}>
                        {event.actual !== null && (
                          <div>
                            <div style={{ color: 'var(--text-3)', fontSize: 9 }}>ACTUAL</div>
                            <div style={{ color: 'var(--green)', fontFamily: 'var(--mono)', fontWeight: 600, marginTop: 2 }}>
                              {event.actual}
                            </div>
                          </div>
                        )}
                        {event.forecast && (
                          <div>
                            <div style={{ color: 'var(--text-3)', fontSize: 9 }}>FORECAST</div>
                            <div style={{ color: 'var(--blue)', fontFamily: 'var(--mono)', fontWeight: 600, marginTop: 2 }}>
                              {event.forecast}
                            </div>
                          </div>
                        )}
                        {event.previous && (
                          <div>
                            <div style={{ color: 'var(--text-3)', fontSize: 9 }}>PREVIOUS</div>
                            <div style={{ color: 'var(--text-2)', fontFamily: 'var(--mono)', fontWeight: 600, marginTop: 2 }}>
                              {event.previous}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Source */}
                    <div style={{
                      fontSize: 9,
                      color: 'var(--text-3)',
                      marginTop: 8,
                      paddingTop: 8,
                      borderTop: '1px solid var(--border)',
                    }}>
                      Source: {event.source}
                    </div>
                  </div>
                )
              })
            ) : (
              <div style={{
                padding: 16,
                color: 'var(--text-3)',
                fontSize: 12,
                textAlign: 'center',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: 200,
              }}>
                Select a day to view events
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
