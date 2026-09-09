import { isPricedQuote, mergeQuoteRecords, normalizeQuote, pricedQuoteMap } from '../../app/utils/quotes'
import type { Quote } from '../../app/types'

const stub = {
  symbol: 'SPY',
  current: null,
  change: null,
  changePct: null,
  source: 'unavailable',
}

const alpacaSpy = {
  symbol: 'SPY',
  current: 523.41,
  change: 1.2,
  changePct: 0.23,
  high: 525,
  low: 520,
  open: 521,
  prevClose: 522.21,
  timestamp: '2026-09-09T20:00:00.000Z',
  source: 'alpaca' as const,
}

describe('normalizeQuote / mergeQuoteRecords', () => {
  test('Alpaca batch shape { current, changePct } is priced', () => {
    expect(isPricedQuote(alpacaSpy)).toBe(true)
    expect(normalizeQuote(alpacaSpy)).toMatchObject({
      symbol: 'SPY',
      current: 523.41,
      changePct: 0.23,
      source: 'alpaca',
    })
  })

  test('Finnhub raw { c, dp } is mapped so the watchlist can render a price', () => {
    const q = normalizeQuote({ c: 448.12, d: -1.1, dp: -0.24, symbol: 'qqq' }, 'QQQ')
    expect(q).toMatchObject({ symbol: 'QQQ', current: 448.12, change: -1.1, changePct: -0.24 })
  })

  test('unavailable stubs are not priced (matches prod "—" / green "—" screenshot)', () => {
    expect(isPricedQuote(stub)).toBe(false)
    expect(normalizeQuote(stub)).toBeNull()
    expect(pricedQuoteMap({ SPY: stub, QQQ: stub, DIA: stub, IWM: stub })).toEqual({})
  })

  test('merge keeps an existing priced quote when the batch returns a stub', () => {
    const prev: Record<string, Quote> = { SPY: alpacaSpy as Quote }
    const merged = mergeQuoteRecords(prev, { SPY: stub, QQQ: { current: 448.12, changePct: 0.1 } })
    expect(merged.SPY.current).toBe(523.41)
    expect(merged.QQQ.current).toBe(448.12)
  })

  test('merge writes a live Alpaca quote over a previously hydrated stub', () => {
    const merged = mergeQuoteRecords({}, { SPY: stub })
    expect(merged.SPY).toBeUndefined()
    const next = mergeQuoteRecords(merged, { SPY: alpacaSpy })
    expect(next.SPY.current).toBe(523.41)
    expect(next.SPY.changePct).toBe(0.23)
  })
})
