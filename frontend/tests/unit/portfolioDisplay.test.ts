import {
  EM_DASH,
  arePricesSettled,
  computeDayGain,
  dayGainColor,
  formatDayGainPair,
  formatSignedDollar,
  formatSignedPercent,
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

  it('does not treat fetch finally alone as prices settled', () => {
    const holdings = [{ ticker: 'AAPL' }, { ticker: 'MSFT' }]
    expect(arePricesSettled({
      dataLoaded: true,
      holdings,
      quotes: {},
      attemptedTickers: {},
    })).toBe(false)
    expect(arePricesSettled({
      dataLoaded: true,
      holdings,
      quotes: { AAPL: { currentPrice: 250 } },
      attemptedTickers: { AAPL: true },
    })).toBe(false)
  })

  it('settles when every holding is live or explicitly missing', () => {
    const holdings = [{ ticker: 'AAPL' }, { ticker: 'MSFT' }]
    expect(arePricesSettled({
      dataLoaded: true,
      holdings,
      quotes: {
        AAPL: { currentPrice: 250 },
        MSFT: { currentPrice: 400 },
      },
      attemptedTickers: {},
    })).toBe(true)
    expect(arePricesSettled({
      dataLoaded: true,
      holdings,
      quotes: { AAPL: { currentPrice: 250 } },
      attemptedTickers: { AAPL: true, MSFT: true },
    })).toBe(true)
    expect(arePricesSettled({
      dataLoaded: true,
      holdings: [],
      quotes: {},
      attemptedTickers: {},
    })).toBe(true)
    expect(arePricesSettled({
      dataLoaded: false,
      holdings: [],
      quotes: {},
      attemptedTickers: {},
    })).toBe(false)
  })
})

describe('computeDayGain', () => {
  it('returns em-dash tone when no live quote + day change pair exists', () => {
    expect(computeDayGain([])).toEqual({ dollar: null, percent: null, tone: 'none' })
    expect(computeDayGain([
      { shares: 10, currentPrice: null, dayChange: 1.5 },
      { shares: 5, currentPrice: 100, dayChange: null },
    ])).toEqual({ dollar: null, percent: null, tone: 'none' })
  })

  it('keeps dollar and percent on the same sign for a down day', () => {
    const result = computeDayGain([
      { shares: 10, currentPrice: 95, dayChange: -5 },
    ])
    expect(result.dollar).toBe(-50)
    expect(result.percent).toBeCloseTo((-50 / 1000) * 100)
    expect(result.tone).toBe('down')
    expect(Math.sign(result.dollar!)).toBe(Math.sign(result.percent!))
    const pair = formatDayGainPair(result)
    expect(pair.dollar.startsWith('-')).toBe(true)
    expect(pair.percent.startsWith('-')).toBe(true)
    expect(pair.color).toBe('var(--red)')
    expect(pair.color).toBe(dayGainColor(result.tone))
  })

  it('keeps dollar and percent on the same sign for an up day', () => {
    const result = computeDayGain([
      { shares: 2, currentPrice: 110, dayChange: 10 },
    ])
    expect(result.dollar).toBe(20)
    expect(result.percent).toBeCloseTo((20 / 200) * 100)
    expect(result.tone).toBe('up')
    expect(Math.sign(result.dollar!)).toBe(Math.sign(result.percent!))
    const pair = formatDayGainPair(result)
    expect(pair.dollar.startsWith('+')).toBe(true)
    expect(pair.percent.startsWith('+')).toBe(true)
    expect(pair.color).toBe('var(--green)')
  })

  it('does not let a missing quote contribute $0 and flip the portfolio sign', () => {
    const result = computeDayGain([
      { shares: 10, currentPrice: 95, dayChange: -5 },
      { shares: 10, currentPrice: null, dayChange: 20 },
    ])
    expect(result.dollar).toBe(-50)
    expect(result.percent).toBeLessThan(0)
    expect(result.tone).toBe('down')
  })

  it('omits percent instead of flipping sign when prior close is not a positive base', () => {
    const result = computeDayGain([
      { shares: 1, currentPrice: 1, dayChange: 5 },
    ])
    expect(result.dollar).toBe(5)
    expect(result.percent).toBeNull()
    expect(result.tone).toBe('up')
    const pair = formatDayGainPair(result)
    expect(pair.dollar.startsWith('+')).toBe(true)
    expect(pair.percent).toBe(EM_DASH)
    expect(pair.color).toBe('var(--green)')
  })

  it('formats zero as unsigned dollar and percent with a shared flat color', () => {
    const result = computeDayGain([
      { shares: 4, currentPrice: 50, dayChange: 0 },
    ])
    expect(result).toEqual({ dollar: 0, percent: 0, tone: 'flat' })
    const pair = formatDayGainPair(result)
    expect(pair.dollar).toBe('$0.00')
    expect(pair.percent).toBe('0.00%')
    expect(pair.color).toBe('var(--text-0)')
  })

  it('formatDayGainPair uses em dash when there is no day-gain data', () => {
    expect(formatDayGainPair({ dollar: null, percent: null, tone: 'none' })).toEqual({
      dollar: EM_DASH,
      percent: EM_DASH,
      color: undefined,
    })
  })
})

describe('signed formatters', () => {
  it('agree on plus, minus, and zero', () => {
    expect(formatSignedDollar(12.3)).toBe('+$12.30')
    expect(formatSignedDollar(-12.3)).toBe('-$12.30')
    expect(formatSignedDollar(0)).toBe('$0.00')
    expect(formatSignedPercent(1.5)).toBe('+1.50%')
    expect(formatSignedPercent(-1.5)).toBe('-1.50%')
    expect(formatSignedPercent(0)).toBe('0.00%')
  })
})
