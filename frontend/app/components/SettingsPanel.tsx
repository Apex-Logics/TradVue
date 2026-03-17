'use client'

import { useEffect, useRef, useState } from 'react'
import { useSettings, type Theme, type DefaultMarket } from '../context/SettingsContext'
import { useAuth } from '../context/AuthContext'
import { trackSettingsChanged } from '../utils/analytics'
import { TIMEZONES, getUserTimezone, getTimezoneAbbr } from '../lib/timezone'
import { IconSettings, IconSun, IconMoon, IconStar, IconBell } from './Icons'

interface SettingsPanelProps {
  onClose: () => void
}

export default function SettingsPanel({ onClose }: SettingsPanelProps) {
  const { settings, setTheme, setDefaultMarket, requestNotifications, setNotificationsEnabled, setTimezone, setAiCoachEnabled } = useSettings()
  const detectedTz = typeof window !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'UTC'
  const activeTz = settings.timezone || detectedTz
  const { user, logout } = useAuth()

  // Ticker size (managed via localStorage, not SettingsContext)
  const [tickerSize, setTickerSizeState] = useState<'compact' | 'normal' | 'large'>('compact')
  useEffect(() => {
    try { setTickerSizeState((localStorage.getItem('cg_ticker_size') as 'compact' | 'normal' | 'large') || 'compact') } catch {}
  }, [])
  function setTickerSizeLocal(size: 'compact' | 'normal' | 'large') {
    setTickerSizeState(size)
    try { localStorage.setItem('cg_ticker_size', size) } catch {}
    // Dispatch a storage event so the main page can react
    window.dispatchEvent(new StorageEvent('storage', { key: 'cg_ticker_size', newValue: size }))
  }

  // Font size (managed via localStorage + html class)
  const [fontSize, setFontSizeState] = useState<'small' | 'medium' | 'large'>('small')
  useEffect(() => {
    try { setFontSizeState((localStorage.getItem('cg_font_size') as 'small' | 'medium' | 'large') || 'small') } catch {}
  }, [])
  function setFontSizeLocal(size: 'small' | 'medium' | 'large') {
    setFontSizeState(size)
    try { localStorage.setItem('cg_font_size', size) } catch {}
    const html = document.documentElement
    html.classList.remove('font-small', 'font-medium', 'font-large')
    if (size !== 'small') html.classList.add(`font-${size}`)
    trackSettingsChanged('font_size', size)
  }

  const panelRef = useRef<HTMLDivElement>(null)

  // Escape key or click outside closes
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [onClose])

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    // Small delay so the triggering click doesn't immediately close it
    const t = setTimeout(() => document.addEventListener('mousedown', h), 100)
    return () => { clearTimeout(t); document.removeEventListener('mousedown', h) }
  }, [onClose])

  async function handleNotificationToggle() {
    if (settings.notificationPermission === 'denied') return
    if (!settings.notificationsEnabled || settings.notificationPermission === 'default') {
      await requestNotifications()
    } else {
      setNotificationsEnabled(false)
    }
  }

  const notifLabel = () => {
    if (settings.notificationPermission === 'denied') return 'Blocked by browser'
    if (settings.notificationsEnabled) return 'Enabled'
    return 'Click to enable'
  }

  const notifDisabled = settings.notificationPermission === 'denied'

  return (
    <>
      {/* Backdrop */}
      <div className="settings-backdrop" onClick={onClose} />

      {/* Panel */}
      <div ref={panelRef} className="settings-panel" role="dialog" aria-label="Settings">
        {/* Header */}
        <div className="settings-header">
          <span className="settings-title">
            <span className="settings-icon"><IconSettings size={15} /></span>
            Settings
          </span>
          <button className="modal-close-btn" onClick={onClose}>✕</button>
        </div>

        {/* Account section */}
        {user && (
          <div className="settings-section">
            <div className="settings-section-label">Account</div>
            <div className="settings-user-row">
              <div className="settings-user-avatar">
                {user.email[0].toUpperCase()}
              </div>
              <div className="settings-user-info">
                <span className="settings-user-email">{user.email}</span>
                <span className="settings-user-tier">
                  {user.tier === 'pro' ? <><IconStar size={11} style={{ verticalAlign: 'middle', marginRight: 3 }} />Pro</> : 'Free Plan'}
                </span>
              </div>
              <button className="settings-logout-btn" onClick={logout} title="Sign out">
                Sign out
              </button>
            </div>
          </div>
        )}

        {/* Appearance */}
        <div className="settings-section">
          <div className="settings-section-label">Appearance</div>

          <div className="settings-row">
            <div className="settings-row-info">
              <span className="settings-row-label">Theme</span>
              <span className="settings-row-desc">
                {settings.theme === 'dark' ? <><IconMoon size={11} style={{ verticalAlign: 'middle', marginRight: 3 }} />Dark</> : <><IconSun size={11} style={{ verticalAlign: 'middle', marginRight: 3 }} />Light</>}
              </span>
            </div>
            <div className="settings-theme-toggle">
              {(['dark', 'light'] as Theme[]).map(t => (
                <button
                  key={t}
                  className={`settings-theme-btn${settings.theme === t ? ' settings-theme-btn-active' : ''}`}
                  onClick={() => { setTheme(t); trackSettingsChanged('theme', t) }}
                >
                  {t === 'dark' ? <><IconMoon size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />Dark</> : <><IconSun size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />Light</>}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Ticker Size */}
        <div className="settings-section">
          <div className="settings-section-label">Ticker Bar Size</div>
          <div className="settings-row settings-row-col">
            <span className="settings-row-desc" style={{ marginBottom: 8 }}>
              Controls the font size of the scrolling ticker bar
            </span>
            <div className="settings-market-toggle">
              {(['compact', 'normal', 'large'] as const).map(s => (
                <button
                  key={s}
                  className={`settings-market-btn${tickerSize === s ? ' settings-market-btn-active' : ''}`}
                  onClick={() => setTickerSizeLocal(s)}
                  style={{ textTransform: 'capitalize' }}
                >
                  {s === 'compact' ? 'Compact' : s === 'normal' ? 'Normal' : 'Large'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Font Size */}
        <div className="settings-section">
          <div className="settings-section-label">Font Size</div>
          <div className="settings-row settings-row-col">
            <span className="settings-row-desc" style={{ marginBottom: 8 }}>
              Scales text across the entire app
            </span>
            <div className="settings-market-toggle">
              {(['small', 'medium', 'large'] as const).map(s => (
                <button
                  key={s}
                  className={`settings-market-btn${fontSize === s ? ' settings-market-btn-active' : ''}`}
                  onClick={() => setFontSizeLocal(s)}
                  style={{ textTransform: 'capitalize' }}
                >
                  {s === 'small' ? 'Small' : s === 'medium' ? 'Medium' : 'Large'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Default Market */}
        <div className="settings-section">
          <div className="settings-section-label">Default Market</div>

          <div className="settings-row settings-row-col">
            <span className="settings-row-desc" style={{ marginBottom: 8 }}>
              Sets the default tab when opening TradVue
            </span>
            <div className="settings-market-toggle">
              {(['US', 'Crypto', 'Forex'] as DefaultMarket[]).map(m => (
                <button
                  key={m}
                  className={`settings-market-btn${settings.defaultMarket === m ? ' settings-market-btn-active' : ''}`}
                  onClick={() => { setDefaultMarket(m); trackSettingsChanged('default_market', m) }}
                >
                  {m === 'US' ? 'US' : m === 'Crypto' ? '₿ Crypto' : 'Forex'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Notifications */}
        <div className="settings-section">
          <div className="settings-section-label">Notifications</div>

          <div className="settings-row">
            <div className="settings-row-info">
              <span className="settings-row-label">Push Notifications</span>
              <span className={`settings-row-desc${notifDisabled ? ' settings-row-desc-warn' : ''}`}>
                {notifLabel()}
              </span>
            </div>
            <button
              className={`settings-toggle${settings.notificationsEnabled ? ' settings-toggle-on' : ''}`}
              onClick={handleNotificationToggle}
              disabled={notifDisabled}
              aria-pressed={settings.notificationsEnabled}
              aria-label="Toggle push notifications"
            >
              <span className="settings-toggle-thumb" />
            </button>
          </div>

          {settings.notificationsEnabled && (
            <div className="settings-notif-note">
              <span><IconBell size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />You'll receive alerts for price movements and major market events.</span>
            </div>
          )}
        </div>

        {/* AI & Privacy */}
        <div className="settings-section">
          <div className="settings-section-label">AI &amp; Privacy</div>

          <div className="settings-row">
            <div className="settings-row-info">
              <span className="settings-row-label">AI Trade Coach</span>
              <span className="settings-row-desc">
                {settings.aiCoachEnabled
                  ? 'Trade patterns are analyzed for insights'
                  : 'No data sent to AI — coach is disabled'}
              </span>
            </div>
            <button
              className={`settings-toggle${settings.aiCoachEnabled ? ' settings-toggle-on' : ''}`}
              onClick={() => setAiCoachEnabled(!settings.aiCoachEnabled)}
              aria-pressed={settings.aiCoachEnabled}
              aria-label="Toggle AI Trade Coach"
            >
              <span className="settings-toggle-thumb" />
            </button>
          </div>

          <div className="settings-notif-note" style={{ marginTop: 6 }}>
            <span>
              When enabled, trade patterns are analyzed locally and via OpenAI.{' '}
              <a href="/legal/privacy" className="settings-footer-link">Privacy Policy</a>
            </span>
          </div>
        </div>

        {/* Timezone */}
        <div className="settings-section">
          <div className="settings-section-label">Timezone</div>

          <div className="settings-row settings-row-col">
            <span className="settings-row-desc" style={{ marginBottom: 8 }}>
              All event times and timestamps use this timezone.
              {!settings.timezone && (
                <span style={{ color: 'var(--green)', marginLeft: 4 }}>
                  Auto: {getTimezoneAbbr(detectedTz)}
                </span>
              )}
            </span>

            <select
              value={activeTz}
              onChange={e => {
                const val = e.target.value
                setTimezone(val === detectedTz && !settings.timezone ? null : val)
                trackSettingsChanged('timezone', val)
              }}
              className="ds-select"
              style={{ marginBottom: 8 }}
            >
              {TIMEZONES.map(tz => (
                <option key={tz.value} value={tz.value}>
                  {tz.label}
                  {tz.value === detectedTz ? ' (device)' : ''}
                </option>
              ))}
            </select>

            {settings.timezone && (
              <button
                onClick={() => { setTimezone(null); trackSettingsChanged('timezone', 'auto') }}
                className="btn btn-secondary btn-sm"
                style={{ alignSelf: 'flex-start' }}
              >
                ↩ Use device timezone
              </button>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="settings-footer">
          <span>TradVue v0.1 · © 2026 TradVue</span>
          <a
            href="https://tradvue.com/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="settings-footer-link"
          >
            Privacy
          </a>
        </div>
      </div>
    </>
  )
}
