'use client'

/**
 * AlertSystem — Real-Time Market Alert Components
 *
 * Exports:
 *   <AlertBanner />     — Fixed HIGH-urgency banner at top of screen
 *   <AlertFeed />       — Full alert list section
 *   <AlertBadge />      — Numeric badge for nav tab
 *   useAlerts()         — Hook that manages SSE + state
 */

import { useState, useEffect, useCallback, useRef } from 'react'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

// ─── Types ────────────────────────────────────────────────────────────────────

export type AlertUrgency = 'HIGH' | 'MEDIUM' | 'LOW'
export type AlertCategory = 'POLITICAL' | 'FED' | 'ECONOMIC' | 'EARNINGS' | 'BREAKING'

export interface MarketAlert {
  id: number
  title: string
  summary: string | null
  url: string | null
  source: string
  category: AlertCategory
  urgency: AlertUrgency
  urgency_score: number
  keywords_hit: string[]
  symbols: string[]
  sentiment: string
  sentiment_score: number
  is_read: boolean
  published_at: string
  created_at: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const URGENCY_COLOR: Record<AlertUrgency, string> = {
  HIGH:   '#ff4560',
  MEDIUM: '#f0a500',
  LOW:    '#00c06a',
}

const CATEGORY_ICON: Record<AlertCategory, string> = {
  POLITICAL: 'POL',
  FED:       'FED',
  ECONOMIC:  'ECO',
  EARNINGS:  'ERN',
  BREAKING:  'BRK',
}

const CATEGORY_LABEL: Record<AlertCategory, string> = {
  POLITICAL: 'Political',
  FED:       'Fed',
  ECONOMIC:  'Economic',
  EARNINGS:  'Earnings',
  BREAKING:  'Breaking',
}

// ─── Notification Sound ───────────────────────────────────────────────────────

function playAlertSound(urgency: AlertUrgency) {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.connect(gain)
    gain.connect(ctx.destination)

    const freq = urgency === 'HIGH' ? 880 : urgency === 'MEDIUM' ? 660 : 440
    osc.frequency.setValueAtTime(freq, ctx.currentTime)
    osc.type = urgency === 'HIGH' ? 'square' : 'sine'

    gain.gain.setValueAtTime(0.15, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4)

    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.4)

    // For HIGH, add a second beep
    if (urgency === 'HIGH') {
      const osc2 = ctx.createOscillator()
      const gain2 = ctx.createGain()
      osc2.connect(gain2)
      gain2.connect(ctx.destination)
      osc2.frequency.setValueAtTime(1100, ctx.currentTime + 0.5)
      osc2.type = 'square'
      gain2.gain.setValueAtTime(0.15, ctx.currentTime + 0.5)
      gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.9)
      osc2.start(ctx.currentTime + 0.5)
      osc2.stop(ctx.currentTime + 0.9)
    }
  } catch {
    // AudioContext not available (e.g., server-side) — silently skip
  }
}

// ─── Time Formatter ───────────────────────────────────────────────────────────

function fmtTime(dateStr: string) {
  try {
    const diff = Date.now() - new Date(dateStr).getTime()
    const m = Math.floor(diff / 60_000)
    if (m < 1) return 'just now'
    if (m < 60) return `${m}m ago`
    const h = Math.floor(m / 60)
    if (h < 24) return `${h}h ago`
    return `${Math.floor(h / 24)}d ago`
  } catch { return '' }
}

// ─── useAlerts Hook ───────────────────────────────────────────────────────────

export interface AlertPreferences {
  soundEnabled: boolean
  categories: AlertCategory[]
  urgencies: AlertUrgency[]
}

const DEFAULT_PREFS: AlertPreferences = {
  soundEnabled: true,
  categories: ['POLITICAL', 'FED', 'ECONOMIC', 'EARNINGS', 'BREAKING'],
  urgencies: ['HIGH', 'MEDIUM', 'LOW'],
}

export function useAlerts() {
  const [alerts, setAlerts] = useState<MarketAlert[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isConnected, setIsConnected] = useState(false)
  const [prefs, setPrefs] = useState<AlertPreferences>(DEFAULT_PREFS)
  const [flashActive, setFlashActive] = useState(false)

  const esRef    = useRef<EventSource | null>(null)
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const retryCount = useRef(0)

  // Load prefs from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('cg_alert_prefs')
      if (saved) setPrefs(JSON.parse(saved))
    } catch {}
  }, [])

  // Save prefs to localStorage
  const updatePrefs = useCallback((update: Partial<AlertPreferences>) => {
    setPrefs(prev => {
      const next = { ...prev, ...update }
      try { localStorage.setItem('cg_alert_prefs', JSON.stringify(next)) } catch {}
      return next
    })
  }, [])

  // Fetch initial alert list
  const fetchAlerts = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/alerts?limit=50&hours=24`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const j = await res.json()
      if (j.success) {
        setAlerts(j.data || [])
        const unread = (j.data || []).filter((a: MarketAlert) => !a.is_read && a.urgency === 'HIGH').length
        setUnreadCount(unread)
      }
    } catch (err) {
      console.warn('[AlertSystem] Initial fetch failed:', err)
    }
  }, [])

  // Connect to SSE stream
  const connectSSE = useCallback(() => {
    if (esRef.current) esRef.current.close()

    const es = new EventSource(`${API_BASE}/api/alerts/live`)
    esRef.current = es

    es.addEventListener('connected', () => {
      setIsConnected(true)
      retryCount.current = 0
      console.info('[AlertSystem] SSE connected')
    })

    es.onmessage = (event) => {
      try {
        const alert: MarketAlert = JSON.parse(event.data)

        // Filter by user prefs
        if (!prefs.categories.includes(alert.category)) return
        if (!prefs.urgencies.includes(alert.urgency)) return

        setAlerts(prev => {
          // Dedup
          if (prev.some(a => a.id === alert.id)) return prev
          return [alert, ...prev].slice(0, 100) // Keep last 100
        })

        if (alert.urgency !== 'LOW') {
          setUnreadCount(c => c + 1)
        }

        // Sound for HIGH/MEDIUM
        if (prefs.soundEnabled && alert.urgency !== 'LOW') {
          playAlertSound(alert.urgency)
        }

        // Red flash for HIGH
        if (alert.urgency === 'HIGH') {
          setFlashActive(true)
          setTimeout(() => setFlashActive(false), 1500)
        }
      } catch (err) {
        console.warn('[AlertSystem] Failed to parse SSE message:', err)
      }
    }

    es.onerror = () => {
      setIsConnected(false)
      es.close()
      esRef.current = null

      // Exponential backoff: 5s, 10s, 20s, 40s, max 60s
      const delay = Math.min(5000 * Math.pow(2, retryCount.current), 60_000)
      retryCount.current++
      console.warn(`[AlertSystem] SSE disconnected. Retrying in ${delay / 1000}s…`)

      retryRef.current = setTimeout(connectSSE, delay)
    }
  }, [prefs.categories, prefs.urgencies, prefs.soundEnabled])

  useEffect(() => {
    fetchAlerts()
    connectSSE()

    return () => {
      esRef.current?.close()
      if (retryRef.current) clearTimeout(retryRef.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const markAllRead = useCallback(async () => {
    const unreadIds = alerts.filter(a => !a.is_read).map(a => a.id)
    if (unreadIds.length === 0) return

    try {
      await fetch(`${API_BASE}/api/alerts/read`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: unreadIds }),
      })
      setAlerts(prev => prev.map(a => ({ ...a, is_read: true })))
      setUnreadCount(0)
    } catch (err) {
      console.warn('[AlertSystem] markAllRead failed:', err)
    }
  }, [alerts])

  const dismissAlert = useCallback((id: number) => {
    setAlerts(prev => prev.filter(a => a.id !== id))
    setUnreadCount(c => Math.max(0, c - 1))
  }, [])

  const clearAllAlerts = useCallback(() => {
    setAlerts([])
    setUnreadCount(0)
  }, [])

  return {
    alerts,
    unreadCount,
    isConnected,
    prefs,
    updatePrefs,
    flashActive,
    markAllRead,
    dismissAlert,
    clearAllAlerts,
    refresh: fetchAlerts,
  }
}

// ─── AlertBadge ───────────────────────────────────────────────────────────────

export function AlertBadge({ count }: { count: number }) {
  if (count <= 0) return null
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: 16,
      height: 16,
      padding: '0 4px',
      borderRadius: 8,
      background: '#ff4560',
      color: '#fff',
      fontSize: 9,
      fontWeight: 700,
      letterSpacing: '0.02em',
      marginLeft: 4,
      verticalAlign: 'middle',
      lineHeight: 1,
    }}>
      {count > 99 ? '99+' : count}
    </span>
  )
}

// ─── AlertBanner ──────────────────────────────────────────────────────────────

export function AlertBanner({
  alerts,
  flashActive,
  onDismiss,
}: {
  alerts: MarketAlert[]
  flashActive: boolean
  onDismiss: (id: number) => void
}) {
  const [dismissedIds, setDismissedIds] = useState<Set<number>>(new Set())
  const [currentIndex, setCurrentIndex] = useState(0)

  const highAlerts = alerts
    .filter(a => a.urgency === 'HIGH' && !dismissedIds.has(a.id))
    .slice(0, 5)

  if (highAlerts.length === 0) return null

  const current = highAlerts[currentIndex % highAlerts.length]
  if (!current) return null

  const handleDismiss = (id: number) => {
    setDismissedIds(prev => new Set([...prev, id]))
    setCurrentIndex(0)
    onDismiss(id)
  }

  return (
    <div
      className={`alert-banner${flashActive ? ' alert-flash' : ''}`}
      role="alert"
      aria-live="assertive"
    >
      <div className="alert-banner-icon">
        {CATEGORY_ICON[current.category]}
      </div>

      <div className="alert-banner-content">
        <span className="alert-banner-label" style={{ color: URGENCY_COLOR.HIGH }}>
          ● HIGH ALERT — {CATEGORY_LABEL[current.category]}
        </span>
        <span className="alert-banner-title">
          {current.url ? (
            <a href={current.url} target="_blank" rel="noopener noreferrer">
              {current.title}
            </a>
          ) : current.title}
        </span>
        <span className="alert-banner-meta">
          {current.source} · {fmtTime(current.created_at)}
          {current.symbols.length > 0 && (
            <span className="alert-banner-symbols">
              {' '}· {current.symbols.slice(0, 3).join(' ')}
            </span>
          )}
        </span>
      </div>

      {highAlerts.length > 1 && (
        <div className="alert-banner-nav">
          <button
            className="alert-nav-btn"
            onClick={() => setCurrentIndex(i => (i - 1 + highAlerts.length) % highAlerts.length)}
            aria-label="Previous alert"
          >‹</button>
          <span className="alert-nav-count">{currentIndex % highAlerts.length + 1}/{highAlerts.length}</span>
          <button
            className="alert-nav-btn"
            onClick={() => setCurrentIndex(i => (i + 1) % highAlerts.length)}
            aria-label="Next alert"
          >›</button>
        </div>
      )}

      <button
        className="alert-banner-close"
        onClick={() => handleDismiss(current.id)}
        aria-label="Dismiss alert"
      >
        ✕
      </button>
    </div>
  )
}

// ─── AlertFeed ────────────────────────────────────────────────────────────────

export function AlertFeed({
  alerts,
  isConnected,
  prefs,
  onUpdatePrefs,
  onMarkAllRead,
  onDismiss,
  onClearAll,
  onRefresh,
}: {
  alerts: MarketAlert[]
  isConnected: boolean
  prefs: AlertPreferences
  onUpdatePrefs: (p: Partial<AlertPreferences>) => void
  onMarkAllRead: () => void
  onDismiss: (id: number) => void
  onClearAll?: () => void
  onRefresh: () => void
}) {
  const [activeCategory, setActiveCategory] = useState<AlertCategory | 'ALL'>('ALL')
  const [showPrefs, setShowPrefs] = useState(false)

  const ALL_CATEGORIES: (AlertCategory | 'ALL')[] = ['ALL', 'POLITICAL', 'FED', 'ECONOMIC', 'EARNINGS', 'BREAKING']

  const filtered = alerts.filter(a => {
    if (activeCategory !== 'ALL' && a.category !== activeCategory) return false
    return true
  })

  const unreadCount = alerts.filter(a => !a.is_read && a.urgency !== 'LOW').length

  return (
    <div className="alert-feed">
      {/* Header */}
      <div className="feed-header">
        <span className="feed-title">
          <span className={`live-dot${isConnected ? '' : ' live-dot-off'}`} />
          MARKET ALERTS
          {!isConnected && <span style={{ fontSize: 9, color: '#ff4560', marginLeft: 6 }}>RECONNECTING…</span>}
        </span>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {unreadCount > 0 && (
            <button className="refresh-btn" onClick={onMarkAllRead} title="Mark all as read">
              ✓ Read all ({unreadCount})
            </button>
          )}
          {onClearAll && alerts.length > 0 && (
            <button
              className="refresh-btn"
              onClick={onClearAll}
              title="Clear all alerts"
              style={{ color: '#ff4560' }}
            >
              Clear All
            </button>
          )}
          <button
            className="refresh-btn"
            onClick={() => setShowPrefs(p => !p)}
            title="Alert preferences"
          >
            ⚙
          </button>
          <button className="refresh-btn" onClick={onRefresh} title="Refresh">↻</button>
        </div>
      </div>

      {/* Preferences panel */}
      {showPrefs && (
        <div className="alert-prefs">
          <div className="alert-prefs-row">
            <span className="alert-prefs-label">Sound</span>
            <button
              className={`alert-prefs-toggle${prefs.soundEnabled ? ' active' : ''}`}
              onClick={() => onUpdatePrefs({ soundEnabled: !prefs.soundEnabled })}
            >
              {prefs.soundEnabled ? 'ON' : 'OFF'}
            </button>
          </div>
          <div className="alert-prefs-row">
            <span className="alert-prefs-label">Urgency</span>
            <div className="alert-prefs-chips">
              {(['HIGH', 'MEDIUM', 'LOW'] as AlertUrgency[]).map(u => (
                <button
                  key={u}
                  className={`alert-chip${prefs.urgencies.includes(u) ? ' active' : ''}`}
                  style={prefs.urgencies.includes(u) ? { borderColor: URGENCY_COLOR[u], color: URGENCY_COLOR[u] } : {}}
                  onClick={() => {
                    const next = prefs.urgencies.includes(u)
                      ? prefs.urgencies.filter(x => x !== u)
                      : [...prefs.urgencies, u]
                    onUpdatePrefs({ urgencies: next })
                  }}
                >
                  {u}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Category filter tabs */}
      <div className="alert-cat-tabs">
        {ALL_CATEGORIES.map(cat => (
          <button
            key={cat}
            className={`alert-cat-tab${activeCategory === cat ? ' active' : ''}`}
            onClick={() => setActiveCategory(cat)}
          >
            {cat === 'ALL' ? 'All' : `${CATEGORY_ICON[cat as AlertCategory]} ${CATEGORY_LABEL[cat as AlertCategory]}`}
          </button>
        ))}
      </div>

      {/* Alert list */}
      <div className="alert-list">
        {filtered.length === 0 ? (
          <div className="feed-empty">
            No alerts yet.{' '}
            {isConnected
              ? 'Monitoring for market-moving news…'
              : 'Connect to receive real-time alerts.'
            }
          </div>
        ) : (
          filtered.map(alert => (
            <AlertRow
              key={alert.id}
              alert={alert}
              onDismiss={onDismiss}
            />
          ))
        )}
      </div>
    </div>
  )
}

// ─── AlertRow ─────────────────────────────────────────────────────────────────

function AlertRow({
  alert,
  onDismiss,
}: {
  alert: MarketAlert
  onDismiss: (id: number) => void
}) {
  const urgencyColor = URGENCY_COLOR[alert.urgency]

  return (
    <div className={`alert-row alert-row-${alert.urgency.toLowerCase()}${alert.is_read ? ' alert-row-read' : ''}`}>
      <div className="alert-row-left">
        <span className="alert-row-icon">{CATEGORY_ICON[alert.category]}</span>
        <span
          className="alert-row-urgency"
          style={{ color: urgencyColor }}
        >
          {alert.urgency}
        </span>
      </div>

      <div className="alert-row-body">
        {alert.url ? (
          <a
            href={alert.url}
            target="_blank"
            rel="noopener noreferrer"
            className="alert-row-title"
          >
            {alert.title}
          </a>
        ) : (
          <span className="alert-row-title">{alert.title}</span>
        )}

        <div className="alert-row-meta">
          <span className="alert-row-source">{alert.source}</span>
          <span className="alert-row-time">{fmtTime(alert.created_at)}</span>
          {alert.keywords_hit.length > 0 && (
            <span className="alert-row-keywords">
              {alert.keywords_hit.slice(0, 3).join(', ')}
            </span>
          )}
          {alert.symbols.length > 0 && (
            <span className="alert-row-symbols">
              {alert.symbols.slice(0, 3).map(s => (
                <span key={s} className="alert-sym-tag">{s}</span>
              ))}
            </span>
          )}
        </div>
      </div>

      <button
        className="alert-row-dismiss"
        onClick={() => onDismiss(alert.id)}
        aria-label={`Dismiss alert: ${alert.title}`}
        title="Dismiss"
      >
        ✕
      </button>
    </div>
  )
}
