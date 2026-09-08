import {
  applyOnboardingSignals,
  collectOnboardingSignals,
  hasCustomTickerSymbols,
  hasPortfolioHoldings,
  hasPriceAlerts,
  hasUserWatchlistSymbols,
  hasNotificationsEnabled,
  isSignedIn,
  overlayDecisionFromSignals,
  type OnboardingChecklistFlags,
} from '../../app/utils/onboardingSignals'
import { DEFAULT_WATCHLIST } from '../../app/constants'

const EMPTY_CHECKLIST: OnboardingChecklistFlags = {
  addSymbol: false,
  setAlert: false,
  customizeTicker: false,
  enableNotifications: false,
  completeProfile: false,
}

describe('onboardingSignals', () => {
  it('treats AAPL/MSFT holdings as first-symbol complete', () => {
    const raw = JSON.stringify([
      { ticker: 'AAPL', shares: 10, avgCost: 180 },
      { ticker: 'MSFT', shares: 5, avgCost: 400 },
    ])
    expect(hasPortfolioHoldings(raw)).toBe(true)
    expect(hasPortfolioHoldings('[]')).toBe(false)
    expect(hasPortfolioHoldings(null)).toBe(false)
  })

  it('does not treat the default watchlist as user-added', () => {
    expect(hasUserWatchlistSymbols(JSON.stringify(DEFAULT_WATCHLIST))).toBe(false)
    expect(hasUserWatchlistSymbols(JSON.stringify(['AAPL', 'MSFT']))).toBe(true)
    expect(hasUserWatchlistSymbols(JSON.stringify([...DEFAULT_WATCHLIST, 'AMD']))).toBe(true)
  })

  it('marks checklist from holdings even when localStorage flags are stale', () => {
    const next = applyOnboardingSignals(EMPTY_CHECKLIST, {
      hasHoldings: true,
      hasUserWatchlist: false,
      hasPriceAlert: false,
      hasCustomTicker: false,
      hasNotificationsEnabled: false,
      isSignedIn: true,
    })
    expect(next.addSymbol).toBe(true)
    expect(next.completeProfile).toBe(true)
    expect(next.setAlert).toBe(false)
  })

  it('never unmarks an already completed item', () => {
    const next = applyOnboardingSignals(
      { ...EMPTY_CHECKLIST, setAlert: true },
      {
        hasHoldings: false,
        hasUserWatchlist: false,
        hasPriceAlert: false,
        hasCustomTicker: false,
        hasNotificationsEnabled: false,
        isSignedIn: false,
      },
    )
    expect(next.setAlert).toBe(true)
  })

  it('dismisses overlay for returning users with holdings so it cannot cover the dashboard', () => {
    const checklist = applyOnboardingSignals(EMPTY_CHECKLIST, {
      hasHoldings: true,
      hasUserWatchlist: false,
      hasPriceAlert: false,
      hasCustomTicker: false,
      hasNotificationsEnabled: false,
      isSignedIn: true,
    })
    const overlay = overlayDecisionFromSignals(
      { welcomeShown: false, checklistDismissed: false, checklistCollapsed: false, celebrationShown: false },
      { hasHoldings: true, hasUserWatchlist: false, hasPriceAlert: false, hasCustomTicker: false, hasNotificationsEnabled: false, isSignedIn: true },
      checklist,
    )
    expect(overlay.welcomeShown).toBe(true)
    expect(overlay.checklistDismissed).toBe(true)
    expect(overlay.celebrationShown).toBe(true)
  })

  it('collects signals from storage keys', () => {
    const store: Record<string, string> = {
      cg_portfolio_holdings: JSON.stringify([{ ticker: 'AAPL', shares: 1 }]),
      cg_token: 'jwt',
      cg_price_alerts: JSON.stringify([{ id: '1', symbol: 'AAPL' }]),
      cg_ticker: JSON.stringify(['NVDA']),
      cg_settings: JSON.stringify({ notificationsEnabled: true }),
    }
    const signals = collectOnboardingSignals({ getItem: (k) => store[k] ?? null })
    expect(signals.hasHoldings).toBe(true)
    expect(signals.isSignedIn).toBe(true)
    expect(signals.hasPriceAlert).toBe(true)
    expect(signals.hasCustomTicker).toBe(true)
    expect(signals.hasNotificationsEnabled).toBe(true)
  })

  it('reads alert/ticker/auth helpers', () => {
    expect(hasPriceAlerts('[{"id":1}]')).toBe(true)
    expect(hasCustomTickerSymbols('["SPY"]')).toBe(true)
    expect(hasNotificationsEnabled('{"notificationsEnabled":true}', 'denied')).toBe(true)
    expect(isSignedIn(null, JSON.stringify({ email: 'a@b.com' }))).toBe(true)
    expect(isSignedIn(null, null)).toBe(false)
  })
})
