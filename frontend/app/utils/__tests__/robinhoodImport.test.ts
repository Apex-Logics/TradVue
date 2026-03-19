/**
 * robinhoodImport.test.ts
 * Tests for:
 *  1. Robinhood Activity Report format (real Robinhood export with Trans Code)
 *  2. Deduplication logic (tradeFingerprint, deduplicateTrades)
 *  3. Batch insert processing (batchInsertTrades)
 *
 * TASK-136: Robinhood CSV Import — Trade Journal Import Feature
 */

import {
  parseBrokerCSV,
  parseRobinhoodActivity,
  detectBroker,
  tradeFingerprint,
  deduplicateTrades,
  batchInsertTrades,
  type ParsedTrade,
} from '../brokerParsers'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const ROBINHOOD_ACTIVITY_CSV = `Activity Date,Process Date,Settle Date,Instrument,Description,Trans Code,Quantity,Price,Amount
01/15/2024,01/15/2024,01/17/2024,AAPL,BUY 10 AAPL @ $150.25,Buy,10,$150.25,$1502.50
01/20/2024,01/20/2024,01/22/2024,AAPL,SELL 10 AAPL @ $160.00,Sell,10,$160.00,$1600.00
01/22/2024,01/22/2024,01/24/2024,MSFT,BUY 5 MSFT @ $380.00,Buy,5,$380.00,$1900.00
01/25/2024,01/25/2024,01/27/2024,MSFT,SELL 5 MSFT @ $395.00,Sell,5,$395.00,$1975.00
01/28/2024,01/28/2024,01/30/2024,TSLA,BUY 3 TSLA @ $200.00,Buy,3,$200.00,$600.00`

const ROBINHOOD_ACTIVITY_OPTIONS_CSV = `Activity Date,Process Date,Settle Date,Instrument,Description,Trans Code,Quantity,Price,Amount
01/15/2024,01/15/2024,01/17/2024,AAPL,BUY TO OPEN 5 AAPL 190 CALL 2/16,BTO,5,$2.50,$1250.00
01/20/2024,01/20/2024,01/22/2024,AAPL,SELL TO CLOSE 5 AAPL 190 CALL 2/16,STC,5,$3.00,$1500.00
01/22/2024,01/22/2024,01/24/2024,SPY,SELL TO OPEN 10 SPY 420 PUT 3/15,STO,10,$1.50,$1500.00
01/25/2024,01/25/2024,01/27/2024,SPY,BUY TO CLOSE 10 SPY 420 PUT 3/15,BTC,10,$0.75,$750.00`

const ROBINHOOD_ACTIVITY_MIXED_CSV = `Activity Date,Process Date,Settle Date,Instrument,Description,Trans Code,Quantity,Price,Amount
01/15/2024,01/15/2024,01/17/2024,AAPL,BUY 10 AAPL @ $150.25,Buy,10,$150.25,$1502.50
01/16/2024,01/16/2024,01/16/2024,,AAPL DIVIDEND,CDIV,,,25.00
01/17/2024,01/17/2024,01/17/2024,,CASH TRANSFER FROM EXTERNAL ACCOUNT,ACATS,,,5000.00
01/18/2024,01/18/2024,01/18/2024,,JOURNAL,JNLS,,,0.00
01/20/2024,01/20/2024,01/22/2024,AAPL,SELL 10 AAPL @ $160.00,Sell,10,$160.00,$1600.00
01/21/2024,01/21/2024,01/21/2024,,GOLD MEMBERSHIP FEE,DFEE,,,-5.00`

// ── detectBroker ──────────────────────────────────────────────────────────────

describe('detectBroker - Robinhood Activity Report format', () => {
  it('detects RobinhoodActivity by "Activity Date" header', () => {
    const headers = ['Activity Date', 'Process Date', 'Settle Date', 'Instrument', 'Description', 'Trans Code', 'Quantity', 'Price', 'Amount']
    expect(detectBroker(headers)).toBe('RobinhoodActivity')
  })

  it('detects RobinhoodActivity by Trans Code + Instrument combo', () => {
    const headers = ['Date', 'Instrument', 'Description', 'Trans Code', 'Quantity', 'Price', 'Amount']
    expect(detectBroker(headers)).toBe('RobinhoodActivity')
  })

  it('does NOT misdetect regular Robinhood as Activity format', () => {
    const headers = ['Date', 'Symbol', 'Side', 'Quantity', 'Price', 'Amount']
    const firstRow = { Date: '01/15/2024', Symbol: 'AAPL', Side: 'BUY', Quantity: '10', Price: '150.00', Amount: '1500.00' }
    expect(detectBroker(headers, firstRow)).toBe('Robinhood')
  })
})

// ── parseRobinhoodActivity — stock trades ─────────────────────────────────────

describe('parseRobinhoodActivity - basic stock trades', () => {
  const errors: string[] = []
  const rows = [
    { 'Activity Date': '01/15/2024', 'Process Date': '01/15/2024', 'Settle Date': '01/17/2024', Instrument: 'AAPL', Description: 'BUY 10 AAPL', 'Trans Code': 'Buy', Quantity: '10', Price: '$150.25', Amount: '$1502.50' },
    { 'Activity Date': '01/20/2024', 'Process Date': '01/20/2024', 'Settle Date': '01/22/2024', Instrument: 'AAPL', Description: 'SELL 10 AAPL', 'Trans Code': 'Sell', Quantity: '10', Price: '$160.00', Amount: '$1600.00' },
    { 'Activity Date': '01/22/2024', 'Process Date': '01/22/2024', 'Settle Date': '01/24/2024', Instrument: 'MSFT', Description: 'BUY 5 MSFT', 'Trans Code': 'Buy', Quantity: '5', Price: '$380.00', Amount: '$1900.00' },
  ]
  const trades = parseRobinhoodActivity(rows, errors)

  it('parses buy trade correctly', () => {
    const buy = trades.find(t => t.symbol === 'AAPL' && t.side === 'buy')
    expect(buy).toBeDefined()
    expect(buy?.quantity).toBe(10)
    expect(buy?.price).toBe(150.25)
    expect(buy?.date).toBe('2024-01-15')
  })

  it('parses sell trade correctly', () => {
    const sell = trades.find(t => t.symbol === 'AAPL' && t.side === 'sell')
    expect(sell).toBeDefined()
    expect(sell?.price).toBe(160.00)
    expect(sell?.date).toBe('2024-01-20')
  })

  it('normalizes MM/DD/YYYY date to YYYY-MM-DD', () => {
    expect(trades[0]?.date).toBe('2024-01-15')
  })

  it('sets broker to Robinhood', () => {
    expect(trades.every(t => t.broker === 'Robinhood')).toBe(true)
  })

  it('strips dollar signs from price', () => {
    expect(trades[0]?.price).toBe(150.25)
  })

  it('fees are 0 for all trades (commission-free)', () => {
    expect(trades.every(t => t.fees === 0)).toBe(true)
  })

  it('has no parse errors', () => {
    expect(errors).toHaveLength(0)
  })
})

// ── parseRobinhoodActivity — options ──────────────────────────────────────────

describe('parseRobinhoodActivity - options (BTO/STC/STO/BTC)', () => {
  const errors: string[] = []
  const rows = [
    { 'Activity Date': '01/15/2024', 'Process Date': '01/15/2024', 'Settle Date': '01/17/2024', Instrument: 'AAPL', Description: 'BUY TO OPEN 5 AAPL 190 CALL 2/16', 'Trans Code': 'BTO', Quantity: '5', Price: '$2.50', Amount: '$1250.00' },
    { 'Activity Date': '01/20/2024', 'Process Date': '01/20/2024', 'Settle Date': '01/22/2024', Instrument: 'AAPL', Description: 'SELL TO CLOSE 5 AAPL 190 CALL 2/16', 'Trans Code': 'STC', Quantity: '5', Price: '$3.00', Amount: '$1500.00' },
    { 'Activity Date': '01/22/2024', 'Process Date': '01/22/2024', 'Settle Date': '01/24/2024', Instrument: 'SPY', Description: 'SELL TO OPEN 10 SPY 420 PUT 3/15', 'Trans Code': 'STO', Quantity: '10', Price: '$1.50', Amount: '$1500.00' },
    { 'Activity Date': '01/25/2024', 'Process Date': '01/25/2024', 'Settle Date': '01/27/2024', Instrument: 'SPY', Description: 'BUY TO CLOSE 10 SPY 420 PUT 3/15', 'Trans Code': 'BTC', Quantity: '10', Price: '$0.75', Amount: '$750.00' },
  ]
  const trades = parseRobinhoodActivity(rows, errors)

  it('BTO parses as buy side', () => {
    const bto = trades.find(t => t.rawAction === 'BTO')
    expect(bto?.side).toBe('buy')
  })

  it('STC parses as sell side', () => {
    const stc = trades.find(t => t.rawAction === 'STC')
    expect(stc?.side).toBe('sell')
  })

  it('STO parses as sell side', () => {
    const sto = trades.find(t => t.rawAction === 'STO')
    expect(sto?.side).toBe('sell')
  })

  it('BTC parses as buy side', () => {
    const btc = trades.find(t => t.rawAction === 'BTC')
    expect(btc?.side).toBe('buy')
  })

  it('detects option type from CALL/PUT in description', () => {
    expect(trades.every(t => t.type === 'option')).toBe(true)
  })

  it('parses all 4 option rows', () => {
    expect(trades).toHaveLength(4)
  })
})

// ── parseRobinhoodActivity — non-trade row filtering ─────────────────────────

describe('parseRobinhoodActivity - skips non-trade rows', () => {
  const errors: string[] = []
  const rows = [
    { 'Activity Date': '01/15/2024', 'Process Date': '01/15/2024', 'Settle Date': '01/17/2024', Instrument: 'AAPL', Description: 'BUY 10 AAPL', 'Trans Code': 'Buy', Quantity: '10', Price: '$150.25', Amount: '$1502.50' },
    { 'Activity Date': '01/16/2024', 'Process Date': '01/16/2024', 'Settle Date': '01/16/2024', Instrument: '', Description: 'AAPL DIVIDEND', 'Trans Code': 'CDIV', Quantity: '', Price: '', Amount: '$25.00' },
    { 'Activity Date': '01/17/2024', 'Process Date': '01/17/2024', 'Settle Date': '01/17/2024', Instrument: '', Description: 'CASH TRANSFER', 'Trans Code': 'ACATS', Quantity: '', Price: '', Amount: '$5000.00' },
    { 'Activity Date': '01/18/2024', 'Process Date': '01/18/2024', 'Settle Date': '01/18/2024', Instrument: '', Description: 'JOURNAL', 'Trans Code': 'JNLS', Quantity: '', Price: '', Amount: '$0.00' },
    { 'Activity Date': '01/18/2024', 'Process Date': '01/18/2024', 'Settle Date': '01/18/2024', Instrument: '', Description: 'GOLD FEE', 'Trans Code': 'DFEE', Quantity: '', Price: '', Amount: '-$5.00' },
    { 'Activity Date': '01/20/2024', 'Process Date': '01/20/2024', 'Settle Date': '01/22/2024', Instrument: 'AAPL', Description: 'SELL 10 AAPL', 'Trans Code': 'Sell', Quantity: '10', Price: '$160.00', Amount: '$1600.00' },
  ]
  const trades = parseRobinhoodActivity(rows, errors)

  it('only imports 2 valid trades (buy + sell AAPL)', () => {
    expect(trades).toHaveLength(2)
  })

  it('skips CDIV (dividend)', () => {
    expect(trades.every(t => t.symbol !== '')).toBe(true)
  })

  it('buy and sell are both AAPL', () => {
    expect(trades.every(t => t.symbol === 'AAPL')).toBe(true)
  })
})

// ── parseBrokerCSV integration — Robinhood Activity ───────────────────────────

describe('parseBrokerCSV - Robinhood Activity (integration)', () => {
  const result = parseBrokerCSV(ROBINHOOD_ACTIVITY_CSV)

  it('auto-detects RobinhoodActivity', () => {
    expect(result.broker).toBe('RobinhoodActivity')
  })

  it('parses all 5 trades', () => {
    expect(result.trades).toHaveLength(5)
  })

  it('AAPL buy is correct', () => {
    const buy = result.trades.find(t => t.symbol === 'AAPL' && t.side === 'buy')
    expect(buy?.quantity).toBe(10)
    expect(buy?.price).toBe(150.25)
    expect(buy?.date).toBe('2024-01-15')
  })

  it('broker label is Robinhood', () => {
    expect(result.trades.every(t => t.broker === 'Robinhood')).toBe(true)
  })

  it('no errors', () => {
    expect(result.errors).toHaveLength(0)
  })
})

describe('parseBrokerCSV - Robinhood Activity options', () => {
  const result = parseBrokerCSV(ROBINHOOD_ACTIVITY_OPTIONS_CSV)

  it('detects RobinhoodActivity', () => {
    expect(result.broker).toBe('RobinhoodActivity')
  })

  it('parses 4 option trades', () => {
    expect(result.trades).toHaveLength(4)
  })

  it('all are type option', () => {
    expect(result.trades.every(t => t.type === 'option')).toBe(true)
  })
})

describe('parseBrokerCSV - Robinhood Activity mixed rows', () => {
  const result = parseBrokerCSV(ROBINHOOD_ACTIVITY_MIXED_CSV)

  it('only 2 valid trades (skips dividends, transfers, fees)', () => {
    expect(result.trades).toHaveLength(2)
  })
})

// ── tradeFingerprint ──────────────────────────────────────────────────────────

describe('tradeFingerprint', () => {
  const trade: ParsedTrade = {
    date: '2024-01-15',
    symbol: 'AAPL',
    side: 'buy',
    quantity: 10,
    price: 150.25,
    total: 1502.50,
    fees: 0,
    broker: 'Robinhood',
    type: 'stock',
  }

  it('is deterministic', () => {
    expect(tradeFingerprint(trade)).toBe(tradeFingerprint({ ...trade }))
  })

  it('same trade from different brokers has same fingerprint', () => {
    const ibkrTrade = { ...trade, broker: 'IBKR' }
    expect(tradeFingerprint(trade)).toBe(tradeFingerprint(ibkrTrade))
  })

  it('different date = different fingerprint', () => {
    expect(tradeFingerprint(trade)).not.toBe(tradeFingerprint({ ...trade, date: '2024-01-20' }))
  })

  it('different symbol = different fingerprint', () => {
    expect(tradeFingerprint(trade)).not.toBe(tradeFingerprint({ ...trade, symbol: 'MSFT' }))
  })

  it('different side = different fingerprint', () => {
    expect(tradeFingerprint(trade)).not.toBe(tradeFingerprint({ ...trade, side: 'sell' }))
  })

  it('different quantity = different fingerprint', () => {
    expect(tradeFingerprint(trade)).not.toBe(tradeFingerprint({ ...trade, quantity: 20 }))
  })

  it('different price = different fingerprint', () => {
    expect(tradeFingerprint(trade)).not.toBe(tradeFingerprint({ ...trade, price: 155 }))
  })
})

// ── deduplicateTrades ─────────────────────────────────────────────────────────

describe('deduplicateTrades', () => {
  const makeTrade = (overrides: Partial<ParsedTrade> = {}): ParsedTrade => ({
    date: '2024-01-15',
    symbol: 'AAPL',
    side: 'buy',
    quantity: 10,
    price: 150.25,
    total: 1502.50,
    fees: 0,
    broker: 'Robinhood',
    type: 'stock',
    ...overrides,
  })

  it('returns all trades when no existing fingerprints', () => {
    const { unique, duplicateCount } = deduplicateTrades([makeTrade(), makeTrade({ symbol: 'MSFT' })], new Set())
    expect(unique).toHaveLength(2)
    expect(duplicateCount).toBe(0)
  })

  it('filters out trades already in fingerprint set', () => {
    const trade = makeTrade()
    const fp = new Set([tradeFingerprint(trade)])
    const { unique, duplicateCount } = deduplicateTrades([trade], fp)
    expect(unique).toHaveLength(0)
    expect(duplicateCount).toBe(1)
  })

  it('keeps new while filtering known trades', () => {
    const existing = makeTrade()
    const newTrade = makeTrade({ symbol: 'TSLA' })
    const fp = new Set([tradeFingerprint(existing)])
    const { unique, duplicateCount } = deduplicateTrades([existing, newTrade], fp)
    expect(unique).toHaveLength(1)
    expect(unique[0].symbol).toBe('TSLA')
    expect(duplicateCount).toBe(1)
  })

  it('deduplicates within incoming list (same trade repeated)', () => {
    const trade = makeTrade()
    const { unique, duplicateCount } = deduplicateTrades([trade, { ...trade }], new Set())
    expect(unique).toHaveLength(1)
    expect(duplicateCount).toBe(1)
  })

  it('returns empty array when all are duplicates', () => {
    const trades = [makeTrade(), makeTrade({ symbol: 'MSFT', price: 380 })]
    const fp = new Set(trades.map(tradeFingerprint))
    const { unique, duplicateCount } = deduplicateTrades(trades, fp)
    expect(unique).toHaveLength(0)
    expect(duplicateCount).toBe(2)
  })

  it('handles empty incoming list', () => {
    const { unique, duplicateCount } = deduplicateTrades([], new Set())
    expect(unique).toHaveLength(0)
    expect(duplicateCount).toBe(0)
  })
})

// ── batchInsertTrades ─────────────────────────────────────────────────────────

describe('batchInsertTrades', () => {
  const makeItems = (n: number) => Array.from({ length: n }, (_, i) => i)

  it('single batch when count <= batchSize', async () => {
    const calls: number[][] = []
    await batchInsertTrades(makeItems(10), async (b) => { calls.push(b) }, 50)
    expect(calls).toHaveLength(1)
    expect(calls[0]).toHaveLength(10)
  })

  it('splits into correct number of batches', async () => {
    const calls: number[][] = []
    await batchInsertTrades(makeItems(105), async (b) => { calls.push(b) }, 50)
    expect(calls).toHaveLength(3)
    expect(calls[0]).toHaveLength(50)
    expect(calls[1]).toHaveLength(50)
    expect(calls[2]).toHaveLength(5)
  })

  it('preserves all items across batches', async () => {
    const seen: number[] = []
    await batchInsertTrades(makeItems(77), async (b) => { seen.push(...b) }, 20)
    expect(seen).toHaveLength(77)
  })

  it('does not call onBatch for empty list', async () => {
    let called = false
    await batchInsertTrades([], async () => { called = true })
    expect(called).toBe(false)
  })

  it('passes correct batchIndex and total to onBatch', async () => {
    const meta: Array<{ batchIndex: number; total: number }> = []
    await batchInsertTrades(makeItems(120), async (_, bi, tot) => { meta.push({ batchIndex: bi, total: tot }) }, 50)
    expect(meta).toHaveLength(3)
    expect(meta[0]).toEqual({ batchIndex: 0, total: 3 })
    expect(meta[2]).toEqual({ batchIndex: 2, total: 3 })
  })

  it('uses default batchSize of 50', async () => {
    const calls: number[][] = []
    await batchInsertTrades(makeItems(100), async (b) => { calls.push(b) })
    expect(calls).toHaveLength(2)
    expect(calls[0]).toHaveLength(50)
  })
})

// ── Integration: full pipeline ────────────────────────────────────────────────

describe('Full pipeline: parse -> dedup -> batch insert', () => {
  it('second import of same CSV yields 0 new trades', async () => {
    const r1 = parseBrokerCSV(ROBINHOOD_ACTIVITY_CSV)
    const { unique: first } = deduplicateTrades(r1.trades, new Set())
    const existing = new Set(first.map(tradeFingerprint))

    const r2 = parseBrokerCSV(ROBINHOOD_ACTIVITY_CSV)
    const { unique: second, duplicateCount } = deduplicateTrades(r2.trades, existing)
    expect(second).toHaveLength(0)
    expect(duplicateCount).toBe(r1.trades.length)
  })

  it('batch inserts all trades without loss', async () => {
    const { trades } = parseBrokerCSV(ROBINHOOD_ACTIVITY_CSV)
    const { unique } = deduplicateTrades(trades, new Set())

    const inserted: ParsedTrade[] = []
    await batchInsertTrades(unique, async (batch) => { inserted.push(...batch) }, 2)
    expect(inserted).toHaveLength(unique.length)
  })
})
