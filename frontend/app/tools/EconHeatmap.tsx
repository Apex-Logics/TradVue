'use client'
import { useState, useEffect, useMemo } from 'react'
import { IconInfo, IconCalendar } from '../components/Icons'
import { apiFetchSafe } from '../lib/apiFetch'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

const IMPACT_COLOR: Record<string, string> = {
  High: '#ef4444', Medium: '#f59e0b', Low: '#22c55e', Holiday: '#8b5cf6'
}
const IMPACT_BG: Record<string, string> = {
  High: 'rgba(239,68,68,0.18)', Medium: 'rgba(245,158,11,0.18)', Low: 'rgba(34,197,94,0.18)', Holiday: 'rgba(139,92,246,0.18)'
}

interface CalEvent {
  id: string; title: string; date: string; type: string
  impact: 'High' | 'Medium' | 'Low' | 'Holiday'; country: string
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']

export default function EconHeatmap() {
  const [events, setEvents] = useState<CalEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [weekOffset, setWeekOffset] = useState(0)
  const [hoveredEvent, setHoveredEvent] = useState<CalEvent | null>(null)
  const [showHowTo, setShowHowTo] = useState(false)

  // Get Mon–Fri for a given week offset
  const weekDates = useMemo(() => {
    const today = new Date()
    const day = today.getDay()
    const monday = new Date(today)
    monday.setDate(today.getDate() - (day === 0 ? 6 : day - 1) + weekOffset * 7)
    return Array.from({ length: 5 }, (_, i) => {
      const d = new Date(monday)
      d.setDate(monday.getDate() + i)
      return d.toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
    })
  }, [weekOffset])

  useEffect(() => {
    const fetch = async () => {
      setLoading(true); setError('')
      const from = weekDates[0]; const to = weekDates[4]
      const j = await apiFetchSafe<{ success: boolean; events?: CalEvent[]; data?: CalEvent[] }>(
        `${API_BASE}/api/calendar/events?from=${from}&to=${to}&type=economic&limit=500`
      )
      if (j?.success) {
        setEvents((j.events || j.data || []) as CalEvent[])
      } else {
        setError('Calendar data unavailable')
        setEvents([])
      }
      setLoading(false)
    }
    fetch()
  }, [weekDates])

  // Group events by date
  const byDate = useMemo(() => {
    const map: Record<string, CalEvent[]> = {}
    events.forEach(e => {
      const key = e.date?.slice(0, 10) || ''
      if (!map[key]) map[key] = []
      map[key].push(e)
    })
    return map
  }, [events])

  // Heat score per day: High=3, Medium=2, Low=1
  const heatScore = (date: string) => {
    const evs = byDate[date] || []
    return evs.reduce((s, e) => s + (e.impact === 'High' ? 3 : e.impact === 'Medium' ? 2 : 1), 0)
  }

  const maxScore = Math.max(...weekDates.map(d => heatScore(d)), 1)

  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })

  const weekLabel = (() => {
    const start = new Date(weekDates[0] + 'T12:00:00Z')
    const end = new Date(weekDates[4] + 'T12:00:00Z')
    const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
    return `${start.toLocaleDateString('en-US', opts)} – ${end.toLocaleDateString('en-US', opts)}`
  })()

  // Best/worst days
  const dayScores = weekDates.map(d => ({ date: d, score: heatScore(d) }))
  const safestDay = dayScores.filter(d => (byDate[d.date] || []).length > 0).sort((a, b) => a.score - b.score)[0]
  const riskiestDay = dayScores.sort((a, b) => b.score - a.score)[0]

  return (
    <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 'var(--card-radius)', padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(239,68,68,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444' }}>
            <IconCalendar size={18} />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-0)' }}>Economic Calendar Heatmap</div>
            <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{weekLabel} — plan which days to trade</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button onClick={() => setWeekOffset(w => w - 1)} style={{ padding: '4px 8px', background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', color: 'var(--text-2)', fontSize: 12 }}>←</button>
          <button onClick={() => setWeekOffset(0)} style={{ padding: '4px 10px', background: weekOffset === 0 ? 'var(--accent-dim)' : 'var(--bg-3)', border: `1px solid ${weekOffset === 0 ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 6, cursor: 'pointer', color: weekOffset === 0 ? 'var(--accent)' : 'var(--text-2)', fontSize: 11 }}>This week</button>
          <button onClick={() => setWeekOffset(w => w + 1)} style={{ padding: '4px 8px', background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', color: 'var(--text-2)', fontSize: 12 }}>→</button>
          <button onClick={() => setShowHowTo(h => !h)} style={{ fontSize: 11, padding: '4px 10px', background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', color: 'var(--text-2)' }}>
            {showHowTo ? 'Hide' : 'How to use'}
          </button>
        </div>
      </div>

      {showHowTo && (
        <div style={{ background: 'rgba(239,68,68,0.08)', borderRadius: 8, padding: '12px 16px', marginBottom: 16, fontSize: 12, color: 'var(--text-2)', lineHeight: 1.7 }}>
          This heatmap shows economic event intensity for the week. Red = high impact day (consider sitting out), green = quiet day (better for trading). Click any day column to see events. Use this to plan which days to be aggressive vs defensive.
        </div>
      )}

      {loading && (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-3)', fontSize: 12 }}>Loading economic data…</div>
      )}
      {error && (
        <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-3)', fontSize: 12 }}>{error}</div>
      )}

      {!loading && !error && (
        <>
          {/* Heatmap grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginBottom: 16 }}>
            {weekDates.map((date, i) => {
              const evs = byDate[date] || []
              const score = heatScore(date)
              const intensity = maxScore > 0 ? score / maxScore : 0
              const highCount = evs.filter(e => e.impact === 'High').length
              const medCount = evs.filter(e => e.impact === 'Medium').length
              const lowCount = evs.filter(e => e.impact === 'Low').length
              const isToday = date === today
              const riskColor = intensity > 0.66 ? '#ef4444' : intensity > 0.33 ? '#f59e0b' : '#22c55e'
              const bgAlpha = intensity * 0.25 + 0.05
              const d = new Date(date + 'T12:00:00Z')
              const dayLabel = d.toLocaleDateString('en-US', { weekday: 'short' })
              const dateNum = d.getDate()

              return (
                <div key={date} style={{
                  background: evs.length > 0 ? `rgba(${intensity > 0.66 ? '239,68,68' : intensity > 0.33 ? '245,158,11' : '34,197,94'},${bgAlpha})` : 'var(--bg-3)',
                  border: `2px solid ${isToday ? 'var(--accent)' : evs.length > 0 ? riskColor + '60' : 'var(--border)'}`,
                  borderRadius: 10, padding: 12, minHeight: 180,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: isToday ? 'var(--accent)' : 'var(--text-1)' }}>{dayLabel}</div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: isToday ? 'var(--accent)' : 'var(--text-0)', lineHeight: 1 }}>{dateNum}</div>
                    </div>
                    {evs.length > 0 && (
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 9, color: 'var(--text-3)', marginBottom: 2 }}>HEAT</div>
                        <div style={{ width: 30, height: 30, borderRadius: '50%', background: riskColor + '25', border: `2px solid ${riskColor}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <span style={{ fontSize: 11, fontWeight: 800, color: riskColor }}>{evs.length}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Impact badges */}
                  {evs.length > 0 && (
                    <div style={{ display: 'flex', gap: 3, marginBottom: 8, flexWrap: 'wrap' }}>
                      {highCount > 0 && <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: 'rgba(239,68,68,0.2)', color: '#ef4444', fontWeight: 700 }}>{highCount}H</span>}
                      {medCount > 0 && <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: 'rgba(245,158,11,0.2)', color: '#f59e0b', fontWeight: 700 }}>{medCount}M</span>}
                      {lowCount > 0 && <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: 'rgba(34,197,94,0.2)', color: '#22c55e', fontWeight: 700 }}>{lowCount}L</span>}
                    </div>
                  )}

                  {/* Top events */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {evs.slice(0, 4).map(e => (
                      <div key={e.id}
                        onMouseEnter={() => setHoveredEvent(e)}
                        onMouseLeave={() => setHoveredEvent(null)}
                        style={{ fontSize: 9, color: 'var(--text-1)', padding: '2px 4px', borderRadius: 3, background: IMPACT_BG[e.impact] || 'var(--bg-1)', borderLeft: `2px solid ${IMPACT_COLOR[e.impact] || 'var(--border)'}`, cursor: 'default', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {e.title}
                      </div>
                    ))}
                    {evs.length > 4 && (
                      <div style={{ fontSize: 9, color: 'var(--text-3)' }}>+{evs.length - 4} more</div>
                    )}
                  </div>

                  {evs.length === 0 && (
                    <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 8, fontStyle: 'italic' }}>Quiet day</div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Event tooltip */}
          {hoveredEvent && (
            <div style={{ background: 'var(--bg-1)', border: `1px solid ${IMPACT_COLOR[hoveredEvent.impact] || 'var(--border)'}`, borderRadius: 8, padding: '8px 12px', marginBottom: 12, fontSize: 11 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: IMPACT_COLOR[hoveredEvent.impact], flexShrink: 0, display: 'inline-block' }} />
                <strong style={{ color: 'var(--text-0)' }}>{hoveredEvent.title}</strong>
                <span style={{ color: 'var(--text-3)' }}>·</span>
                <span style={{ color: hoveredEvent.country === 'USD' ? '#22c55e' : 'var(--text-2)', fontSize: 10, fontWeight: 700 }}>{hoveredEvent.country}</span>
                <span style={{ color: IMPACT_COLOR[hoveredEvent.impact], fontSize: 10, fontWeight: 700 }}>{hoveredEvent.impact} Impact</span>
              </div>
            </div>
          )}

          {/* Trading recommendations */}
          {riskiestDay && safestDay && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
              <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '10px 14px' }}>
                <div style={{ fontSize: 10, color: '#ef4444', fontWeight: 700, marginBottom: 4 }}>HIGHEST RISK DAY</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-0)' }}>
                  {new Date(riskiestDay.date + 'T12:00:00Z').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>
                  {(byDate[riskiestDay.date] || []).filter(e => e.impact === 'High').length} high-impact events
                </div>
              </div>
              <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 8, padding: '10px 14px' }}>
                <div style={{ fontSize: 10, color: '#22c55e', fontWeight: 700, marginBottom: 4 }}>SAFEST TRADING DAY</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-0)' }}>
                  {new Date(safestDay.date + 'T12:00:00Z').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>
                  Lowest economic event load
                </div>
              </div>
            </div>
          )}

          {/* Legend */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 8 }}>
            {[['High', '#ef4444'], ['Medium', '#f59e0b'], ['Low', '#22c55e']].map(([l, c]) => (
              <span key={l} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--text-3)' }}>
                <span style={{ width: 10, height: 10, background: c, borderRadius: 2, display: 'inline-block' }} />{l} Impact
              </span>
            ))}
          </div>
        </>
      )}

      <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-3)', background: 'rgba(239,68,68,0.08)', borderRadius: 6, padding: '8px 12px' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><IconInfo size={12} />High-impact events (red) often cause sharp price moves. Consider reducing position sizes or staying flat before major releases like CPI, NFP, or Fed decisions.</span>
      </div>
    </div>
  )
}
