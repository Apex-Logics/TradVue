'use client'
import { useState, useEffect, useMemo } from 'react'
import { IconClock, IconInfo } from '../components/Icons'
import Tooltip from '../components/Tooltip'

interface MarketSession {
  city: string
  country: string
  tz: string
  openHour: number  // UTC hour
  closeHour: number // UTC hour
  color: string
  assets: string[]
  exchange: string
}

const SESSIONS: MarketSession[] = [
  { city: 'Sydney',    country: 'AU', tz: 'Australia/Sydney',   openHour: 22,   closeHour: 7,    color: '#f59e0b', assets: ['AUD pairs', 'NZD pairs'], exchange: 'ASX' },      // 5PM–2AM ET
  { city: 'Tokyo',     country: 'JP', tz: 'Asia/Tokyo',         openHour: 0,    closeHour: 9,    color: '#ef4444', assets: ['JPY pairs', 'Asian stocks'], exchange: 'TSE' },    // 7PM–4AM ET
  { city: 'Singapore', country: 'SG', tz: 'Asia/Singapore',     openHour: 1,    closeHour: 9,    color: '#f97316', assets: ['SGD', 'Asian futures'], exchange: 'SGX' },
  { city: 'Frankfurt', country: 'DE', tz: 'Europe/Berlin',      openHour: 7,    closeHour: 16,   color: '#8b5cf6', assets: ['EUR pairs', 'DAX', 'Bunds'], exchange: 'XETRA' },  // 2AM–11AM ET
  { city: 'London',    country: 'GB', tz: 'Europe/London',      openHour: 8,    closeHour: 17,   color: '#3b82f6', assets: ['GBP pairs', 'FTSE', 'Gilts'], exchange: 'LSE' },   // 3AM–12PM ET
  { city: 'New York',  country: 'US', tz: 'America/New_York',   openHour: 14.5, closeHour: 21,   color: '#22c55e', assets: ['S&P 500', 'USD pairs', 'US bonds'], exchange: 'NYSE/NASDAQ' }, // 9:30AM–4PM ET
  { city: 'Chicago',   country: 'US', tz: 'America/Chicago',    openHour: 22,   closeHour: 21,   color: '#06b6d4', assets: ['Futures (ES,NQ,CL,GC)', 'Options'], exchange: 'CME Group' }, // 5PM–4PM ET (Sun-Fri, 23h)
]

// ET open/close hours (EST = UTC-5) for the visual 0:00–24:00 ET timeline
// Sessions that cross midnight in ET have openET > closeET
const SESSION_ET: Record<string, { openET: number; closeET: number }> = {
  Sydney:    { openET: 17,   closeET: 2   }, // 5:00 PM – 2:00 AM ET (wraps)
  Tokyo:     { openET: 19,   closeET: 4   }, // 7:00 PM – 4:00 AM ET (wraps)
  Singapore: { openET: 20,   closeET: 4   }, // 8:00 PM – 4:00 AM ET (wraps)
  Frankfurt: { openET: 2,    closeET: 11  }, // 2:00 AM – 11:00 AM ET
  London:    { openET: 3,    closeET: 12  }, // 3:00 AM – 12:00 PM ET
  'New York':{ openET: 9.5,  closeET: 16  }, // 9:30 AM – 4:00 PM ET
  Chicago:   { openET: 17,   closeET: 16  }, // 5:00 PM – 4:00 PM ET next day (wraps, ~23h)
}

function isActiveET(openET: number, closeET: number, etHour: number): boolean {
  if (openET < closeET) return etHour >= openET && etHour < closeET
  return etHour >= openET || etHour < closeET // crosses midnight
}

const ASSET_RECOMMENDATIONS: Record<string, { best: string; sessions: string[] }> = {
  'EUR/USD': { best: 'London+NY overlap: 8:00 AM–12:00 PM ET (highest forex liquidity)', sessions: ['London', 'New York'] },
  'USD/JPY': { best: 'Tokyo–London overlap: 3:00–4:00 AM ET', sessions: ['Tokyo', 'London'] },
  'GBP/USD': { best: 'London session: 3:00 AM–12:00 PM ET', sessions: ['London', 'New York'] },
  'AUD/USD': { best: 'Sydney–Tokyo overlap: 7:00 PM–2:00 AM ET', sessions: ['Sydney', 'Tokyo'] },
  'S&P 500': { best: 'NY open: 9:30–11:30 AM ET (highest volume)', sessions: ['New York'] },
  'Gold':    { best: 'London+NY overlap: 9:30 AM–12:00 PM ET', sessions: ['London', 'New York'] },
  'BTC':     { best: '24/7 market — highest volume during NY session', sessions: ['New York'] },
  'Futures': { best: 'NY session hours: 9:30 AM–4:00 PM ET', sessions: ['Chicago', 'New York'] },
}

function isActive(session: MarketSession, utcHour: number): boolean {
  const { openHour, closeHour } = session
  if (openHour < closeHour) return utcHour >= openHour && utcHour < closeHour
  return utcHour >= openHour || utcHour < closeHour // crosses midnight
}

function getLocalTime(tz: string): string {
  try {
    return new Date().toLocaleTimeString('en-US', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: true })
  } catch { return '—' }
}

function hoursUntil(target: number, current: number): number {
  if (target > current) return target - current
  return 24 - current + target
}

export default function SessionClock() {
  const [now, setNow] = useState(() => new Date())
  const [selectedAsset, setSelectedAsset] = useState('EUR/USD')
  const [showHowTo, setShowHowTo] = useState(false)

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 10000)
    return () => clearInterval(t)
  }, [])

  const utcHour = now.getUTCHours() + now.getUTCMinutes() / 60

  const activeSessions = SESSIONS.filter(s => isActive(s, utcHour))

  // Overlap analysis: sessions active at each UTC hour (used for session cards)
  const overlapMap = useMemo(() => {
    return Array.from({ length: 24 }, (_, h) => ({
      hour: h,
      count: SESSIONS.filter(s => isActive(s, h)).length,
      sessions: SESSIONS.filter(s => isActive(s, h)).map(s => s.city),
    }))
  }, [])

  // ET-based overlap map for the visual timeline
  const overlapMapET = useMemo(() => {
    return Array.from({ length: 24 }, (_, h) => ({
      hour: h,
      count: SESSIONS.filter(s => {
        const et = SESSION_ET[s.city]
        return et ? isActiveET(et.openET, et.closeET, h) : false
      }).length,
    }))
  }, [])

  const rec = ASSET_RECOMMENDATIONS[selectedAsset]

  const utcString = now.toLocaleTimeString('en-US', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit', hour12: false }) + ' UTC'

  // Current ET hour fraction for the 24h ET timeline indicator
  const etTimeStr = now.toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', hour12: false })
  const [etHStr, etMStr] = etTimeStr.split(':')
  const etHourFraction = parseInt(etHStr, 10) + parseInt(etMStr, 10) / 60
  const currentPctET = (etHourFraction / 24) * 100

  return (
    <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 'var(--card-radius)', padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(6,182,212,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#06b6d4' }}>
            <IconClock size={18} />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-0)' }}>Market Session World Clock</div>
            <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{utcString} · {activeSessions.length} session{activeSessions.length !== 1 ? 's' : ''} active</div>
          </div>
        </div>
        <button onClick={() => setShowHowTo(h => !h)} style={{ fontSize: 11, padding: '4px 10px', background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', color: 'var(--text-2)' }}>
          {showHowTo ? 'Hide' : 'How to use'}
        </button>
      </div>

      {showHowTo && (
        <div style={{ background: 'rgba(6,182,212,0.1)', borderRadius: 8, padding: '12px 16px', marginBottom: 16, fontSize: 12, color: 'var(--text-2)', lineHeight: 1.7 }}>
          Market sessions show when each major exchange is open. Overlapping sessions have the highest liquidity and volatility — the London/New York overlap (8 AM–12 PM ET) is typically the best time to trade forex and equities. The 24h chart shows session hours (UTC) with overlap periods highlighted.
        </div>
      )}

      {/* Session cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10, marginBottom: 20 }}>
        {SESSIONS.map(s => {
          const active = isActive(s, utcHour)
          const localTime = getLocalTime(s.tz)
          const next = active ? s.closeHour : s.openHour
          const hoursLeft = Math.floor(hoursUntil(next, utcHour))
          const minsLeft = Math.floor((hoursUntil(next, utcHour) - hoursLeft) * 60)
          return (
            <div key={s.city} style={{ background: active ? s.color + '18' : 'var(--bg-3)', border: `1px solid ${active ? s.color + '60' : 'var(--border)'}`, borderRadius: 10, padding: '10px 14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: active ? s.color : 'var(--text-1)' }}>{s.city}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-3)' }}>{s.exchange}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: active ? s.color : 'var(--text-3)', boxShadow: active ? `0 0 6px ${s.color}` : 'none' }} />
                  <span style={{ fontSize: 10, color: active ? s.color : 'var(--text-3)', fontWeight: active ? 700 : 400 }}>{active ? 'OPEN' : 'CLOSED'}</span>
                </div>
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--text-0)', marginBottom: 4 }}>{localTime}</div>
              <div style={{ fontSize: 10, color: 'var(--text-3)', marginBottom: 6 }}>
                {active ? `Closes in ${hoursLeft}h ${minsLeft}m` : `Opens in ${hoursLeft}h ${minsLeft}m`}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                {s.assets.map(a => (
                  <span key={a} style={{ fontSize: 9, padding: '1px 5px', background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 3, color: 'var(--text-3)' }}>{a}</span>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* 24h ET timeline */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', marginBottom: 8, letterSpacing: '0.06em' }}>24-HOUR SESSION TIMELINE (ET)</div>
        <div style={{ position: 'relative', height: 160, background: 'var(--bg-3)', borderRadius: 8, overflow: 'hidden' }}>
          {/* Session bars — positioned using ET hours */}
          {SESSIONS.map((s, si) => {
            const et = SESSION_ET[s.city]
            if (!et) return null
            const { openET, closeET } = et
            // Sessions crossing midnight get two segments; others get one
            const segments = openET < closeET
              ? [{ l: (openET / 24) * 100, w: ((closeET - openET) / 24) * 100 }]
              : [
                  { l: (openET / 24) * 100,  w: ((24 - openET) / 24) * 100 },
                  { l: 0,                     w: (closeET / 24) * 100 },
                ]
            const y = 12 + si * 20
            return segments.map((seg, i) => (
              <div key={`${s.city}-${i}`} style={{
                position: 'absolute', top: y, height: 14,
                left: `${seg.l}%`, width: `${seg.w}%`,
                background: s.color + 'BB', borderRadius: 3,
              }}>
                {seg.w > 8 && (
                  <span style={{ fontSize: 9, color: '#fff', padding: '0 4px', lineHeight: '14px', whiteSpace: 'nowrap', overflow: 'hidden', display: 'block' }}>
                    {s.city}
                  </span>
                )}
              </div>
            ))
          })}
          {/* Overlap heatmap bar — uses ET hours */}
          <div style={{ position: 'absolute', bottom: 6, left: 0, right: 0, height: 10 }}>
            {overlapMapET.map(h => (
              <div key={h.hour} style={{
                position: 'absolute', top: 0, height: '100%',
                left: `${(h.hour / 24) * 100}%`, width: `${(1 / 24) * 100}%`,
                background: h.count === 0 ? 'transparent'
                  : h.count === 1 ? 'rgba(74,158,255,0.2)'
                  : h.count === 2 ? 'rgba(74,158,255,0.55)'
                  : 'rgba(74,158,255,0.9)',
              }} />
            ))}
          </div>
          {/* Current ET time indicator */}
          <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${currentPctET}%`, width: 2, background: 'var(--yellow)', opacity: 0.9 }}>
            <div style={{ position: 'absolute', top: -2, left: -3, width: 8, height: 8, background: 'var(--yellow)', borderRadius: '50%' }} />
          </div>
          {/* ET hour markers */}
          {[0, 3, 6, 9, 12, 15, 18, 21].map(h => (
            <div key={h} style={{ position: 'absolute', bottom: 18, left: `${(h / 24) * 100}%`, fontSize: 8, color: 'var(--text-3)', transform: 'translateX(-50%)' }}>
              {h === 0 ? '12 AM' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`}
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 12, marginTop: 8, fontSize: 10, color: 'var(--text-3)', flexWrap: 'wrap' }}>
          {SESSIONS.map(s => (
            <span key={s.city} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 12, height: 8, background: s.color + 'BB', borderRadius: 2, display: 'inline-block' }} />
              {s.city}
            </span>
          ))}
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 12, height: 8, background: 'rgba(74,158,255,0.7)', borderRadius: 2, display: 'inline-block' }} />
            Overlap zones
          </span>
        </div>
      </div>

      {/* Asset recommendations */}
      <div style={{ background: 'var(--bg-3)', borderRadius: 8, padding: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', marginBottom: 10, letterSpacing: '0.06em' }}>
          BEST TIME TO TRADE
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
          {Object.keys(ASSET_RECOMMENDATIONS).map(a => (
            <button key={a} onClick={() => setSelectedAsset(a)}
              style={{ padding: '4px 10px', borderRadius: 20, border: `1px solid ${selectedAsset === a ? 'var(--accent)' : 'var(--border)'}`, background: selectedAsset === a ? 'var(--accent-dim)' : 'transparent', color: selectedAsset === a ? 'var(--accent)' : 'var(--text-2)', fontSize: 11, cursor: 'pointer', fontWeight: selectedAsset === a ? 700 : 400 }}>
              {a}
            </button>
          ))}
        </div>
        {rec && (
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-0)', fontWeight: 600, marginBottom: 4 }}>
              Best time for <span style={{ color: 'var(--accent)' }}>{selectedAsset}</span>:
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 8 }}>{rec.best}</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {rec.sessions.map(s => {
                const session = SESSIONS.find(x => x.city === s)
                const active = session ? isActive(session, utcHour) : false
                return (
                  <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 6, background: active ? 'rgba(34,197,94,0.15)' : 'var(--bg-1)', border: `1px solid ${active ? 'rgba(34,197,94,0.4)' : 'var(--border)'}` }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: active ? 'var(--green)' : 'var(--text-3)' }} />
                    <span style={{ fontSize: 11, color: active ? 'var(--green)' : 'var(--text-2)', fontWeight: active ? 700 : 400 }}>{s} {active ? '(OPEN)' : '(CLOSED)'}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      <div style={{ marginTop: 12, fontSize: 11, color: 'var(--text-3)', background: 'rgba(6,182,212,0.1)', borderRadius: 6, padding: '8px 12px' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><IconInfo size={12} />All times in UTC. Actual hours may vary due to DST and holidays. Crypto trades 24/7.</span>
      </div>
    </div>
  )
}
