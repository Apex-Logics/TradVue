/**
 * Real-data signals for onboarding checklist progress.
 *
 * The checklist used to live only in `cg_onboarding` localStorage and was
 * marked solely by in-session clicks (e.g. toggling a watchlist star). Users
 * who already have portfolio holdings or a customized watchlist stayed stuck
 * at "Add your first symbol" (0/5) with the overlay covering the dashboard.
 *
 * Prefer these signals over stale checklist flags. Completed items are never
 * unmarked.
 */

import { DEFAULT_WATCHLIST } from '../constants'
import { AUTH_TOKEN_KEY, AUTH_USER_KEY } from './storageKeys'

export const ONBOARDING_STORAGE_KEY = 'cg_onboarding'
export const HOLDINGS_STORAGE_KEY = 'cg_portfolio_holdings'
export const WATCHLIST_STORAGE_KEY = 'cg_wl'
export const PRICE_ALERTS_STORAGE_KEY = 'cg_price_alerts'
export const TICKER_STORAGE_KEY = 'cg_ticker'
export const SETTINGS_STORAGE_KEY = 'cg_settings'

export type OnboardingChecklistFlags = {
  addSymbol: boolean
  setAlert: boolean
  customizeTicker: boolean
  enableNotifications: boolean
  completeProfile: boolean
}

export type OnboardingSignals = {
  hasHoldings: boolean
  hasUserWatchlist: boolean
  hasPriceAlert: boolean
  hasCustomTicker: boolean
  hasNotificationsEnabled: boolean
  isSignedIn: boolean
}

function readJson(raw: string | null): unknown {
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function readArray(raw: string | null): unknown[] {
  const parsed = readJson(raw)
  return Array.isArray(parsed) ? parsed : []
}

function holdingTicker(item: unknown): string | null {
  if (!item || typeof item !== 'object') return null
  const rec = item as Record<string, unknown>
  const ticker = rec.ticker ?? rec.symbol
  return typeof ticker === 'string' && ticker.trim() ? ticker.trim().toUpperCase() : null
}

function watchlistSymbol(item: unknown): string | null {
  if (typeof item === 'string' && item.trim()) return item.trim().toUpperCase()
  if (!item || typeof item !== 'object') return null
  const rec = item as Record<string, unknown>
  const symbol = rec.symbol ?? rec.ticker
  return typeof symbol === 'string' && symbol.trim() ? symbol.trim().toUpperCase() : null
}

/** True when local holdings exist (API/cloud hydrate writes this key). */
export function hasPortfolioHoldings(raw: string | null): boolean {
  return readArray(raw).some(item => holdingTicker(item) != null)
}

/**
 * Default pre-populated watchlist does not count as "added a symbol".
 * A user-owned list is anything that differs from DEFAULT_WATCHLIST
 * (extra symbols, removed symbols, or a non-empty custom set).
 */
export function hasUserWatchlistSymbols(raw: string | null, defaults: string[] = DEFAULT_WATCHLIST): boolean {
  const symbols = readArray(raw).map(watchlistSymbol).filter((s): s is string => s != null)
  if (symbols.length === 0) return false
  const defaultSet = new Set(defaults.map(s => s.toUpperCase()))
  const sortedUser = [...new Set(symbols)].sort()
  const sortedDefault = [...new Set(defaults.map(s => s.toUpperCase()))].sort()
  if (sortedUser.some(s => !defaultSet.has(s))) return true
  return JSON.stringify(sortedUser) !== JSON.stringify(sortedDefault)
}

export function hasPriceAlerts(raw: string | null): boolean {
  return readArray(raw).length > 0
}

export function hasCustomTickerSymbols(raw: string | null): boolean {
  return readArray(raw).length > 0
}

export function hasNotificationsEnabled(settingsRaw: string | null, permission?: string | null): boolean {
  if (permission === 'granted') return true
  const parsed = readJson(settingsRaw)
  if (!parsed || typeof parsed !== 'object') return false
  const rec = parsed as Record<string, unknown>
  return rec.notificationsEnabled === true || rec.notificationPermission === 'granted'
}

export function isSignedIn(tokenRaw: string | null, userRaw: string | null): boolean {
  if (tokenRaw && tokenRaw.trim()) return true
  if (!userRaw) return false
  const parsed = readJson(userRaw)
  return !!(parsed && typeof parsed === 'object')
}

export function collectOnboardingSignals(storage: Storage | { getItem: (k: string) => string | null }): OnboardingSignals {
  const permission = typeof Notification !== 'undefined' ? Notification.permission : null
  return {
    hasHoldings: hasPortfolioHoldings(storage.getItem(HOLDINGS_STORAGE_KEY)),
    hasUserWatchlist: hasUserWatchlistSymbols(storage.getItem(WATCHLIST_STORAGE_KEY)),
    hasPriceAlert: hasPriceAlerts(storage.getItem(PRICE_ALERTS_STORAGE_KEY)),
    hasCustomTicker: hasCustomTickerSymbols(storage.getItem(TICKER_STORAGE_KEY)),
    hasNotificationsEnabled: hasNotificationsEnabled(storage.getItem(SETTINGS_STORAGE_KEY), permission),
    isSignedIn: isSignedIn(storage.getItem(AUTH_TOKEN_KEY), storage.getItem(AUTH_USER_KEY)),
  }
}

export function applyOnboardingSignals(
  checklist: OnboardingChecklistFlags,
  signals: OnboardingSignals,
): OnboardingChecklistFlags {
  return {
    addSymbol: checklist.addSymbol || signals.hasHoldings || signals.hasUserWatchlist,
    setAlert: checklist.setAlert || signals.hasPriceAlert,
    customizeTicker: checklist.customizeTicker || signals.hasCustomTicker,
    enableNotifications: checklist.enableNotifications || signals.hasNotificationsEnabled,
    completeProfile: checklist.completeProfile || signals.isSignedIn,
  }
}

export type OverlayDecision = {
  welcomeShown: boolean
  checklistDismissed: boolean
  checklistCollapsed: boolean
  celebrationShown: boolean
}

/**
 * Returning users with real portfolio/watchlist data should not be blocked
 * by the first-run overlay. Holdings (or a user watchlist plus sign-in) is
 * enough to dismiss the overlay so it cannot cover dashboard widgets.
 */
export function overlayDecisionFromSignals(
  current: OverlayDecision,
  signals: OnboardingSignals,
  checklist: OnboardingChecklistFlags,
): OverlayDecision {
  const firstSymbolDone = checklist.addSymbol
  const completedCount = Object.values(checklist).filter(Boolean).length
  const returningUser = signals.hasHoldings || (firstSymbolDone && signals.isSignedIn)

  return {
    welcomeShown: current.welcomeShown || returningUser || firstSymbolDone,
    // Hide the widget entirely when it would cover real dashboard content.
    checklistDismissed: current.checklistDismissed || returningUser || completedCount >= 5,
    checklistCollapsed: current.checklistCollapsed,
    celebrationShown: current.celebrationShown || returningUser,
  }
}
