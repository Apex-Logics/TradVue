/**
 * TradVue GA4 Analytics Utility
 * Lightweight, privacy-first analytics tracking.
 *
 * All tracking is gated behind user consent (localStorage flag: cg_analytics_consent).
 * No data is sent without consent.
 */

// ─── Consent ────────────────────────────────────────────────────────────────

const CONSENT_KEY = 'cg_analytics_consent'

/**
 * Returns true if the user has given analytics consent.
 * Defaults to false (opt-in model).
 */
export function hasAnalyticsConsent(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return localStorage.getItem(CONSENT_KEY) === 'true'
  } catch {
    return false
  }
}

/** Grant analytics consent */
export function grantAnalyticsConsent(): void {
  try {
    localStorage.setItem(CONSENT_KEY, 'true')
  } catch {}
}

/** Revoke analytics consent */
export function revokeAnalyticsConsent(): void {
  try {
    localStorage.setItem(CONSENT_KEY, 'false')
  } catch {}
}

// ─── Core gtag wrapper ───────────────────────────────────────────────────────

type GtagCommand = 'config' | 'event' | 'js' | 'set'

function gtag(command: GtagCommand, target: string | Date, params?: Record<string, unknown>): void {
  if (typeof window === 'undefined') return
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any
  if (typeof w.gtag !== 'function') return
  if (params !== undefined) {
    w.gtag(command, target, params)
  } else {
    w.gtag(command, target)
  }
}

// ─── Core tracking functions ─────────────────────────────────────────────────

/**
 * Track a custom GA4 event.
 * No-op if user hasn't consented or GA4 isn't loaded.
 */
export function trackEvent(eventName: string, parameters: Record<string, unknown> = {}): void {
  if (!hasAnalyticsConsent()) return
  gtag('event', eventName, parameters)
}

/**
 * Track a page view. Call this on route changes.
 * GA4 auto-tracks the initial load; this is for SPA navigation.
 */
export function trackPageView(pagePath?: string): void {
  if (!hasAnalyticsConsent()) return
  const gaId = process.env.NEXT_PUBLIC_GA_ID
  if (!gaId) return
  gtag('config', gaId, {
    page_path: pagePath ?? (typeof window !== 'undefined' ? window.location.pathname : undefined),
  })
}

// ─── Product-specific tracking events ────────────────────────────────────────

/** Track signup form submission */
export function trackSignup(plan: string = 'free'): void {
  trackEvent('sign_up', {
    method: 'email',
    plan_selected: plan,
    timestamp: new Date().toISOString(),
  })
}

/** Track login */
export function trackLogin(): void {
  trackEvent('login', {
    method: 'email',
  })
}

/** Track logout */
export function trackLogout(): void {
  trackEvent('logout', {})
}

/** Track a symbol added to watchlist */
export function trackWatchlistAdd(symbol: string): void {
  trackEvent('watchlist_add', {
    symbol,
    asset_type: 'stock',
  })
}

/** Track a symbol removed from watchlist */
export function trackWatchlistRemove(symbol: string): void {
  trackEvent('watchlist_remove', {
    symbol,
  })
}

/** Track an alert being created */
export function trackAlertCreated(params: {
  alertType?: string
  symbol?: string
  condition?: string
}): void {
  trackEvent('alert_create', {
    alert_type: params.alertType ?? 'price',
    symbol: params.symbol ?? 'unknown',
    alert_condition: params.condition ?? 'unknown',
  })
}

/** Track a stock search performed */
export function trackStockSearch(query: string): void {
  trackEvent('stock_search', {
    search_term: query,
  })
}

/** Track a settings change */
export function trackSettingsChanged(settingName: string, newValue: string): void {
  trackEvent('settings_changed', {
    setting_name: settingName,
    new_value: newValue,
  })
}
