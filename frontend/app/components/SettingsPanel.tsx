'use client'

import { useEffect, useRef } from 'react'
import { useSettings, type Theme, type DefaultMarket } from '../context/SettingsContext'
import { useAuth } from '../context/AuthContext'
import { trackSettingsChanged } from '../utils/analytics'

interface SettingsPanelProps {
  onClose: () => void
}

export default function SettingsPanel({ onClose }: SettingsPanelProps) {
  const { settings, setTheme, setDefaultMarket, requestNotifications, setNotificationsEnabled } = useSettings()
  const { user, logout } = useAuth()
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
            <span className="settings-icon">⚙</span>
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
                  {user.subscription_tier === 'pro' ? '⭐ Pro' : 'Free Plan'}
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
                {settings.theme === 'dark' ? '🌙 Dark' : '☀️ Light'}
              </span>
            </div>
            <div className="settings-theme-toggle">
              {(['dark', 'light'] as Theme[]).map(t => (
                <button
                  key={t}
                  className={`settings-theme-btn${settings.theme === t ? ' settings-theme-btn-active' : ''}`}
                  onClick={() => { setTheme(t); trackSettingsChanged('theme', t) }}
                >
                  {t === 'dark' ? '🌙 Dark' : '☀️ Light'}
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
                  {m === 'US' ? '🇺🇸 US' : m === 'Crypto' ? '₿ Crypto' : '💱 Forex'}
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
              <span>🔔 You'll receive alerts for price movements and major market events.</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="settings-footer">
          <span>TradVue v0.1 · ApexLogics</span>
          <a
            href="https://tradvue.io/privacy"
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
