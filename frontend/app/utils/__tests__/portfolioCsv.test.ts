/**
 * Q8 — Portfolio CSV in-file duplicate tickers.
 *
 * Same ticker on multiple rows must not pass through as separate holdings
 * (replace-mode would double-count). Lots combine with weighted-average cost.
 */

import {
  parsePortfolioCSV,
  aggregateHoldingsByTicker,
  combineLotsWeightedAverage,
  findInFileDuplicateGroups,
  type ImportedHolding,
} from '../portfolioCsv'

function lot(overrides: Partial<ImportedHolding> & Pick<ImportedHolding, 'ticker' | 'shares' | 'costBasis'>): ImportedHolding {
  return {
    dateAcquired: '',
    sector: 'Other',
    notes: '',
    ...overrides,
  }
}

describe('combineLotsWeightedAverage', () => {
  it('uses weighted-average cost: (shares_i * cost_i) / sum(shares)', () => {
    const combined = combineLotsWeightedAverage([
      lot({ ticker: 'AAPL', shares: 10, costBasis: 150, sourceRow: 2 }),
      lot({ ticker: 'AAPL', shares: 5, costBasis: 180, sourceRow: 5 }),
    ])
    expect(combined.ticker).toBe('AAPL')
    expect(combined.shares).toBe(15)
    expect(combined.costBasis).toBeCloseTo((10 * 150 + 5 * 180) / 15, 10)
  })

  it('keeps earliest dateAcquired and joins notes', () => {
    const combined = combineLotsWeightedAverage([
      lot({ ticker: 'MSFT', shares: 2, costBasis: 300, dateAcquired: '2024-06-01', notes: 'lot A', sector: 'Technology' }),
      lot({ ticker: 'MSFT', shares: 2, costBasis: 320, dateAcquired: '2024-01-15', notes: 'lot B' }),
    ])
    expect(combined.dateAcquired).toBe('2024-01-15')
    expect(combined.notes).toBe('lot A | lot B')
    expect(combined.sector).toBe('Technology')
  })
})

describe('findInFileDuplicateGroups / aggregateHoldingsByTicker', () => {
  it('does not flag unique tickers', () => {
    const holdings = [
      lot({ ticker: 'AAPL', shares: 10, costBasis: 150, sourceRow: 2 }),
      lot({ ticker: 'MSFT', shares: 5, costBasis: 300, sourceRow: 3 }),
    ]
    expect(findInFileDuplicateGroups(holdings)).toHaveLength(0)
    expect(aggregateHoldingsByTicker(holdings)).toHaveLength(2)
  })

  it('surfaces which rows conflicted for a repeated ticker', () => {
    const holdings = [
      lot({ ticker: 'AAPL', shares: 10, costBasis: 150, sourceRow: 2 }),
      lot({ ticker: 'MSFT', shares: 5, costBasis: 300, sourceRow: 3 }),
      lot({ ticker: 'AAPL', shares: 5, costBasis: 180, sourceRow: 4 }),
    ]
    const groups = findInFileDuplicateGroups(holdings)
    expect(groups).toHaveLength(1)
    expect(groups[0].ticker).toBe('AAPL')
    expect(groups[0].rows).toEqual([2, 4])
    expect(groups[0].lots).toHaveLength(2)
    expect(groups[0].combined.shares).toBe(15)
  })

  it('collapses in-file dupes so replace cannot double-count', () => {
    const holdings = [
      lot({ ticker: 'AAPL', shares: 10, costBasis: 150, sourceRow: 2 }),
      lot({ ticker: 'AAPL', shares: 10, costBasis: 150, sourceRow: 3 }),
      lot({ ticker: 'NVDA', shares: 1, costBasis: 900, sourceRow: 4 }),
    ]
    const aggregated = aggregateHoldingsByTicker(holdings)
    expect(aggregated).toHaveLength(2)
    const aapl = aggregated.find(h => h.ticker === 'AAPL')
    expect(aapl?.shares).toBe(20)
    expect(aapl?.costBasis).toBe(150)
    expect(aggregated.filter(h => h.ticker === 'AAPL')).toHaveLength(1)
  })
})

describe('parsePortfolioCSV — in-file duplicate tickers', () => {
  const CSV = `Symbol,Shares,CostBasis,DateAcquired,Sector,Notes
AAPL,10,150.00,2024-01-15,Information Technology,first lot
MSFT,5,300.00,2024-02-20,Information Technology,ok
AAPL,5,180.00,2024-03-01,Information Technology,second lot
`

  it('returns both rows (never silent-drop) and a duplicate group with row numbers', () => {
    const result = parsePortfolioCSV(CSV)
    expect(result.errors).toHaveLength(0)
    expect(result.holdings).toHaveLength(3)
    expect(result.duplicates).toHaveLength(1)
    expect(result.duplicates[0].ticker).toBe('AAPL')
    expect(result.duplicates[0].rows).toEqual([2, 4])
    expect(result.holdings.map(h => h.sourceRow)).toEqual([2, 3, 4])
  })

  it('aggregated import is one AAPL holding at weighted-average cost', () => {
    const result = parsePortfolioCSV(CSV)
    const aggregated = aggregateHoldingsByTicker(result.holdings)
    expect(aggregated).toHaveLength(2)
    const aapl = aggregated.find(h => h.ticker === 'AAPL')!
    expect(aapl.shares).toBe(15)
    expect(aapl.costBasis).toBeCloseTo((10 * 150 + 5 * 180) / 15, 10)
    const msft = aggregated.find(h => h.ticker === 'MSFT')!
    expect(msft.shares).toBe(5)
    expect(msft.costBasis).toBe(300)
  })

  it('unique-ticker CSV has empty duplicates and passes through', () => {
    const unique = `Symbol,Shares,CostBasis
AAPL,10,150
MSFT,5,300
`
    const result = parsePortfolioCSV(unique)
    expect(result.duplicates).toHaveLength(0)
    expect(aggregateHoldingsByTicker(result.holdings)).toHaveLength(2)
  })
})
