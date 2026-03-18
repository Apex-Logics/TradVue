'use client'

/**
 * PushNotificationPanel
 *
 * Shows notification opt-in/opt-out UI and time settings on the Ritual page.
 *
 * Features:
 *  - "🔔 Enable Daily Reminders" button (shown when not yet granted)
 *  - Shows current status: "Notifications: ON ✅" or "Notifications: OFF"
 *  - Notification time picker (default 4:05 PM ET)
 *  - Persists preference in localStorage key `cg_push_enabled`
 *
 * Permission is ONLY requested when user clicks the button — never on mount.
 */

import { useState, useEffect, useCallback } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

type NotifStatus = 'unsupported' | 'denied' | 'default' | 'granted'

interface PushState {
  status: NotifStatus
  subscribed: boolean
  loading: boolean
  error: string | null
  notificationTime: string // HH:MM (ET)
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const LS_KEY_ENABLED = 'cg_push_enabled'
const LS_KEY_TIME    = 'cg_push_time'
const DEFAULT_TIME   = '16:05'

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray.buffer as ArrayBuffer
}

async function getVapidPublicKey(): Promise<string | null> {
  // Try env var first
  const envKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  if (envKey) return envKey

  // Fallback: fetch from backend
  try {
    const res = await fetch('/api/push/vapid-public-key')
    if (!res.ok) return null
    const data = await res.json() as { publicKey?: string }
    return data.publicKey || null
  } catch {
    return null
  }
}

async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null
  try {
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
    await navigator.serviceWorker.ready
    return reg
  } catch (err) {
    console.error('[PushNotifications] SW registration failed:', err)
    return null
  }
}

async function subscribeUserToPush(
  registration: ServiceWorkerRegistration,
  vapidPublicKey: string
): Promise<PushSubscription | null> {
  try {
    const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey)
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey,
    })
    return subscription
  } catch (err) {
    console.error('[PushNotifications] Subscribe failed:', err)
    return null
  }
}

async function saveSubscriptionToBackend(
  subscription: PushSubscription,
  notificationTime: string,
  authToken?: string
): Promise<boolean> {
  try {
    const headers: HeadersInit = { 'Content-Type': 'application/json' }
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`

    const res = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify({ subscription: subscription.toJSON(), notificationTime }),
    })
    return res.ok
  } catch {
    return false
  }
}

async function removeSubscriptionFromBackend(
  endpoint: string,
  authToken?: string
): Promise<boolean> {
  try {
    const headers: HeadersInit = { 'Content-Type': 'application/json' }
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`

    const res = await fetch('/api/push/unsubscribe', {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify({ endpoint }),
    })
    return res.ok
  } catch {
    return false
  }
}

function getAuthToken(): string | undefined {
  try {
    // Try Supabase session from localStorage
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith('sb-') && key.endsWith('-auth-token')) {
        const raw = localStorage.getItem(key)
        if (raw) {
          const parsed = JSON.parse(raw) as { access_token?: string }
          return parsed.access_token
        }
      }
    }
  } catch {
    // ignore
  }
  return undefined
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PushNotificationPanel() {
  const [state, setState] = useState<PushState>({
    status: 'default',
    subscribed: false,
    loading: false,
    error: null,
    notificationTime: DEFAULT_TIME,
  })
  const [showTimeEditor, setShowTimeEditor] = useState(false)
  const [timeInput, setTimeInput] = useState(DEFAULT_TIME)

  // ── Init: check current permission and localStorage ──────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return

    if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      setState(s => ({ ...s, status: 'unsupported' }))
      return
    }

    const perm = Notification.permission as NotifStatus
    const enabled = localStorage.getItem(LS_KEY_ENABLED) === 'true'
    const savedTime = localStorage.getItem(LS_KEY_TIME) || DEFAULT_TIME

    setState(s => ({
      ...s,
      status: perm,
      subscribed: perm === 'granted' && enabled,
      notificationTime: savedTime,
    }))
    setTimeInput(savedTime)
  }, [])

  // ── Enable notifications ─────────────────────────────────────────────────
  const handleEnable = useCallback(async () => {
    setState(s => ({ ...s, loading: true, error: null }))

    try {
      // 1. Request permission
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setState(s => ({
          ...s,
          status: permission as NotifStatus,
          subscribed: false,
          loading: false,
          error: permission === 'denied'
            ? 'Notifications blocked. Please enable them in your browser settings.'
            : null,
        }))
        return
      }

      // 2. Register service worker
      const reg = await registerServiceWorker()
      if (!reg) {
        setState(s => ({ ...s, loading: false, error: 'Service worker registration failed.' }))
        return
      }

      // 3. Get VAPID key
      const vapidKey = await getVapidPublicKey()
      if (!vapidKey) {
        // Still mark as granted — local notifications work without backend
        localStorage.setItem(LS_KEY_ENABLED, 'true')
        setState(s => ({ ...s, status: 'granted', subscribed: true, loading: false }))
        return
      }

      // 4. Subscribe to push
      const subscription = await subscribeUserToPush(reg, vapidKey)
      if (!subscription) {
        setState(s => ({ ...s, loading: false, error: 'Failed to create push subscription.' }))
        return
      }

      // 5. Save to backend
      const token = getAuthToken()
      await saveSubscriptionToBackend(subscription, state.notificationTime, token)

      localStorage.setItem(LS_KEY_ENABLED, 'true')
      setState(s => ({ ...s, status: 'granted', subscribed: true, loading: false, error: null }))
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setState(s => ({ ...s, loading: false, error: message }))
    }
  }, [state.notificationTime])

  // ── Disable notifications ─────────────────────────────────────────────────
  const handleDisable = useCallback(async () => {
    setState(s => ({ ...s, loading: true, error: null }))

    try {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations()
        for (const reg of regs) {
          const sub = await reg.pushManager.getSubscription()
          if (sub) {
            const token = getAuthToken()
            await removeSubscriptionFromBackend(sub.endpoint, token)
            await sub.unsubscribe()
          }
        }
      }

      localStorage.setItem(LS_KEY_ENABLED, 'false')
      setState(s => ({ ...s, subscribed: false, loading: false, error: null }))
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setState(s => ({ ...s, loading: false, error: message }))
    }
  }, [])

  // ── Save time preference ─────────────────────────────────────────────────
  const handleSaveTime = useCallback(async () => {
    const time = timeInput.trim() || DEFAULT_TIME
    localStorage.setItem(LS_KEY_TIME, time)
    setState(s => ({ ...s, notificationTime: time }))
    setShowTimeEditor(false)

    // If subscribed, update backend
    if (state.subscribed && 'serviceWorker' in navigator) {
      try {
        const regs = await navigator.serviceWorker.getRegistrations()
        for (const reg of regs) {
          const sub = await reg.pushManager.getSubscription()
          if (sub) {
            const token = getAuthToken()
            await saveSubscriptionToBackend(sub, time, token)
          }
        }
      } catch {
        // non-fatal
      }
    }
  }, [timeInput, state.subscribed])

  // ── Render ─────────────────────────────────────────────────────────────────
  if (state.status === 'unsupported') return null

  const isOn = state.status === 'granted' && state.subscribed
  const isDenied = state.status === 'denied'

  return (
    <div
      style={{
        marginTop: 32,
        padding: '16px 20px',
        background: 'var(--card-bg, #1a1a1a)',
        border: `1px solid ${isOn ? '#22c55e44' : 'var(--border, #2a2a2a)'}`,
        borderRadius: 12,
        transition: 'border-color 0.3s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-1, #e0e0e0)', marginBottom: 2 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline', verticalAlign: 'middle', marginRight: 5 }}>
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>Daily Reminders
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-3, #666)' }}>
            {isOn
              ? `Notifications: ON ✅  · ${formatDisplayTime(state.notificationTime)} ET`
              : isDenied
              ? 'Notifications blocked in browser'
              : 'Get reminded at market close to log your trades'}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
          {isOn && (
            <button
              onClick={() => setShowTimeEditor(v => !v)}
              style={btnSmall}
              title="Change notification time"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }}>
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12 6 12 12 16 14"/>
              </svg>{formatDisplayTime(state.notificationTime)}
            </button>
          )}

          {isOn ? (
            <button
              onClick={handleDisable}
              disabled={state.loading}
              style={{ ...btnSmall, borderColor: '#ef444466', color: '#ef4444' }}
            >
              {state.loading ? '…' : 'Turn Off'}
            </button>
          ) : isDenied ? (
            <span style={{ fontSize: 12, color: '#f9731688' }}>Blocked</span>
          ) : (
            <button
              onClick={handleEnable}
              disabled={state.loading}
              style={btnEnable}
            >
              {state.loading ? 'Enabling…' : (
                <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline', verticalAlign: 'middle', marginRight: 5 }}>
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                  <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                </svg>Enable Daily Reminders</>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Time editor */}
      {showTimeEditor && (
        <div
          style={{
            marginTop: 12,
            paddingTop: 12,
            borderTop: '1px solid var(--border, #2a2a2a)',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <label style={{ fontSize: 13, color: 'var(--text-2, #aaa)' }}>
            Notify at (ET):
          </label>
          <input
            type="time"
            value={timeInput}
            onChange={e => setTimeInput(e.target.value)}
            style={{
              background: 'var(--bg, #0a0a0a)',
              border: '1px solid var(--border, #2a2a2a)',
              borderRadius: 6,
              color: 'var(--text-1, #e0e0e0)',
              padding: '6px 10px',
              fontSize: 13,
            }}
          />
          <button onClick={handleSaveTime} style={btnSmall}>
            Save
          </button>
          <button
            onClick={() => setShowTimeEditor(false)}
            style={{ ...btnSmall, color: 'var(--text-3, #666)', borderColor: 'transparent' }}
          >
            Cancel
          </button>
        </div>
      )}

      {/* Error */}
      {state.error && (
        <div
          style={{
            marginTop: 10,
            fontSize: 12,
            color: '#f97316',
            padding: '8px 12px',
            background: '#f9731611',
            borderRadius: 6,
          }}
        >
          {state.error}
        </div>
      )}

      {/* Denied help */}
      {isDenied && (
        <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-3, #666)' }}>
          To re-enable: click the lock icon in your browser address bar → Notifications → Allow
        </div>
      )}
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDisplayTime(time: string): string {
  const [h, m] = time.split(':').map(Number)
  if (isNaN(h) || isNaN(m)) return time
  const period = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 || 12
  return `${hour}:${String(m).padStart(2, '0')} ${period}`
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const btnSmall: React.CSSProperties = {
  padding: '6px 12px',
  borderRadius: 6,
  border: '1px solid var(--border, #2a2a2a)',
  background: 'transparent',
  color: 'var(--text-2, #aaa)',
  cursor: 'pointer',
  fontSize: 12,
  fontWeight: 500,
  whiteSpace: 'nowrap',
}

const btnEnable: React.CSSProperties = {
  padding: '8px 16px',
  borderRadius: 8,
  border: 'none',
  background: '#4a9eff',
  color: '#fff',
  cursor: 'pointer',
  fontSize: 13,
  fontWeight: 600,
  whiteSpace: 'nowrap',
}
