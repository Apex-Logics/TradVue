import {
  holdingsHaveLivePrices,
  livePrice,
  shouldShowFinancialsSkeleton,
} from '../../app/utils/portfolioDisplay'

describe('portfolioDisplay', () => {
  it('does not treat avgCost-style zeros or missing quotes as a live price', () => {
    expect(livePrice(undefined)).toBeNull()
    expect(livePrice({ currentPrice: null })).toBeNull()
    expect(livePrice({ currentPrice: 0 })).toBeNull()
    expect(livePrice({ currentPrice: 254.23 })).toBe(254.23)
    expect(livePrice({ current: 399.41 })).toBe(399.41)
  })

  it('requires a live quote for every holding before totals are ready', () => {
    const holdings = [{ ticker: 'AAPL' }, { ticker: 'MSFT' }]
    expect(holdingsHaveLivePrices(holdings, {})).toBe(false)
    expect(holdingsHaveLivePrices(holdings, { AAPL: { currentPrice: 250 } })).toBe(false)
    expect(holdingsHaveLivePrices(holdings, {
      AAPL: { currentPrice: 250 },
      MSFT: { currentPrice: 400 },
    })).toBe(true)
    expect(holdingsHaveLivePrices([], {})).toBe(true)
  })

  it('skeletons until holdings+prices are ready — never a $0 placeholder flash', () => {
    expect(shouldShowFinancialsSkeleton({ dataLoaded: false, holdingsCount: 2, pricesSettled: false })).toBe(true)
    expect(shouldShowFinancialsSkeleton({ dataLoaded: true, holdingsCount: 2, pricesSettled: false })).toBe(true)
    expect(shouldShowFinancialsSkeleton({ dataLoaded: true, holdingsCount: 2, pricesSettled: true })).toBe(false)
    expect(shouldShowFinancialsSkeleton({ dataLoaded: true, holdingsCount: 0, pricesSettled: false })).toBe(false)
  })
})
