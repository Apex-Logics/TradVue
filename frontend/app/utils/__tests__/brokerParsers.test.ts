/**
 * brokerParsers.test.ts
 * Tests for unified multi-broker CSV parser
 *
 * Covers: auto-detection, date normalization, buy/sell detection,
 *         price/quantity parsing, non-trade row filtering
 */

import {
  detectBroker,
  parseBrokerCSV,
  normalizeDate,
  parseNumber,
  parseRobinhood,
  parseFidelity,
  parseSchwab,
  parseWebull,
  parseTastytrade,
  parseEtrade,
  parseIBKR,
  parseTradeStation,
} from '../brokerParsers'

// ── Date Normalization ────────────────────────────────────────────────────────

describe('normalizeDate', () => {
  it('passes through ISO 8601 dates unchanged', () => {
    expect(normalizeDate('2024-01-15')).toBe('2024-01-15')
  })

  it('converts MM/DD/YYYY to ISO', () => {
    expect(normalizeDate('01/15/2024')).toBe('2024-01-15')
    expect(normalizeDate('1/5/2024')).toBe('2024-01-05')
  })

  it('converts YYYYMMDD compact format to ISO', () => {
    expect(normalizeDate('20240115')).toBe('2024-01-15')
  })

  it('strips time component from MM/DD/YYYY HH:MM:SS (Tastytrade format)', () => {
    expect(normalizeDate('01/15/2024 14:30:00')).toBe('2024-01-15')
  })

  it('returns empty string for empty input', () => {
    expect(normalizeDate('')).toBe('')
  })

  it('converts MM-DD-YYYY with dashes', () => {
    expect(normalizeDate('01-15-2024')).toBe('2024-01-15')
  })
})

// ── Number Parsing ────────────────────────────────────────────────────────────

describe('parseNumber', () => {
  it('strips dollar signs and commas', () => {
    expect(parseNumber('$1,234.56')).toBe(1234.56)
  })

  it('handles negative values', () => {
    expect(parseNumber('-150.25')).toBe(-150.25)
  })

  it('handles parentheses as negative (accounting format)', () => {
    expect(parseNumber('(15,034.99)')).toBe(-15034.99)
  })

  it('returns 0 for empty string', () => {
    expect(parseNumber('')).toBe(0)
    expect(parseNumber('   ')).toBe(0)
  })

  it('parses plain numbers', () => {
    expect(parseNumber('100')).toBe(100)
    expect(parseNumber('150.25')).toBe(150.25)
  })
})

// ── Broker Detection ──────────────────────────────────────────────────────────

describe('detectBroker', () => {
  it('detects Tastytrade by unique column combo', () => {
    const headers = ['Date/Time', 'Transaction Code', 'Transaction Subcode', 'Symbol', 'Buy/Sell', 'Open/Close', 'Quantity', 'Expiration Date', 'Strike', 'Call/Put', 'Price', 'Fees', 'Amount', 'Description', 'Account Reference']
    expect(detectBroker(headers)).toBe('Tastytrade')
  })

  it('detects Fidelity by "Run Date" header', () => {
    const headers = ['Run Date', 'Account', 'Action', 'Symbol', 'Description', 'Type', 'Quantity', 'Price', 'Commission', 'Fees', 'Amount']
    expect(detectBroker(headers)).toBe('Fidelity')
  })

  it('detects Schwab by "Fees & Comm" header', () => {
    const headers = ['Date', 'Action', 'Symbol', 'Description', 'Quantity', 'Price', 'Fees & Comm', 'Amount']
    expect(detectBroker(headers)).toBe('Schwab')
  })

  it('detects E*TRADE by "Transaction #" header', () => {
    const headers = ['Date', 'Transaction #', 'Action', 'Quantity', 'Symbol', 'Description', 'Price', 'Commission & Fees', 'Amount']
    expect(detectBroker(headers)).toBe('E*TRADE')
  })

  it('detects TradeStation by "TradeInd" header', () => {
    const headers = ['Account Number', 'Type', 'TradeInd', 'Transaction', 'Quantity', 'Cusip', 'ADP', 'Symbol', 'CallPut', 'Underlying Symbol', 'Expiration Date', 'Strike Price', 'TD', 'SD', 'Activity', 'Date', 'Price', 'Amount', 'Currency Code', 'Commission', 'Description', 'Time', 'Order ID']
    expect(detectBroker(headers)).toBe('TradeStation')
  })

  it('detects IBKR by "T. Price" header', () => {
    const headers = ['Symbol', 'Date/Time', 'Quantity', 'T. Price', 'Proceeds', 'Comm/Fee']
    expect(detectBroker(headers)).toBe('IBKR')
  })

  it('detects IBKR by "Comm/Fee" header', () => {
    const headers = ['Date', 'Symbol', 'Quantity', 'Price', 'Action', 'Comm/Fee', 'Side']
    expect(detectBroker(headers)).toBe('IBKR')
  })

  it('detects Webull by ISO date format in first row', () => {
    const headers = ['Date', 'Symbol', 'Side', 'Quantity', 'Price', 'Amount']
    const firstRow = { Date: '2024-01-15', Symbol: 'AAPL', Side: 'BUY', Quantity: '10', Price: '150.00', Amount: '1500.00' }
    expect(detectBroker(headers, firstRow)).toBe('Webull')
  })

  it('detects Robinhood by MM/DD/YYYY date format in first row', () => {
    const headers = ['Date', 'Symbol', 'Side', 'Quantity', 'Price', 'Amount']
    const firstRow = { Date: '01/15/2024', Symbol: 'AAPL', Side: 'BUY', Quantity: '10', Price: '150.00', Amount: '1500.00' }
    expect(detectBroker(headers, firstRow)).toBe('Robinhood')
  })

  it('returns Unknown for unrecognized headers', () => {
    const headers = ['foo', 'bar', 'baz']
    expect(detectBroker(headers)).toBe('Unknown')
  })
})

// ── Sample CSV Fixtures ───────────────────────────────────────────────────────

const ROBINHOOD_CSV = `Date,Symbol,Side,Quantity,Price,Amount
01/15/2024,AAPL,BUY,10,150.25,1502.50
01/20/2024,AAPL,SELL,10,160.00,1600.00
01/22/2024,MSFT,BUY,5,380.00,1900.00
01/25/2024,MSFT,SELL,5,395.00,1975.00
01/28/2024,TSLA,BUY,3,200.00,600.00`

const FIDELITY_CSV = `Run Date,Account,Action,Symbol,Description,Type,Quantity,Price,Commission,Fees,Amount
11/10/2023,Account123,BUY,AAPL,APPLE INC,EQUITY,100,150.25,0.00,0.00,-15025.00
11/15/2023,Account123,SELL,AAPL,APPLE INC,EQUITY,100,160.00,0.00,0.00,16000.00
11/20/2023,Account123,BUY,MSFT,MICROSOFT CORP,EQUITY,50,380.00,0.00,0.00,-19000.00
11/20/2023,Account123,DIVIDEND,AAPL,APPLE INC DIVIDEND,EQUITY,0,0.00,0.00,0.00,25.00
11/25/2023,Account123,SELL,MSFT,MICROSOFT CORP,EQUITY,50,400.00,0.00,0.00,20000.00`

const SCHWAB_METADATA_CSV = `Transactions for account XXXX-9999 as of 06/17/2024 14:50:44 ET From 01/01/2024 to 06/17/2024
Date,Action,Symbol,Description,Quantity,Price,Fees & Comm,Amount
06/15/2024,BUY,AAPL,APPLE INC,100,150.25,0.00,-15025.00
06/16/2024,SELL,AAPL,APPLE INC,100,160.00,0.00,16000.00
06/17/2024,BUY,NVDA,NVIDIA CORP,20,900.00,0.00,-18000.00
06/17/2024,Dividend,AAPL,APPLE INC DIVIDEND,0,0.00,0.00,25.00
06/18/2024,SELL,NVDA,NVIDIA CORP,20,950.00,0.00,19000.00`

const WEBULL_CSV = `Date,Symbol,Side,Quantity,Price,Amount
2024-01-15,AAPL,BUY,10,150.00,1500.00
2024-01-20,AAPL,SELL,10,160.00,1600.00
2024-01-22,TSLA,BUY,5,200.00,1000.00
2024-01-25,TSLA,SELL,5,220.00,1100.00
2024-01-28,NVDA,BUY,2,900.00,1800.00`

const TASTYTRADE_CSV = `Date/Time,Transaction Code,Transaction Subcode,Symbol,Buy/Sell,Open/Close,Quantity,Expiration Date,Strike,Call/Put,Price,Fees,Amount,Description,Account Reference
01/15/2024 14:30:00,TRA,BUY,AAPL,BUY,OPEN,100,,,,$150.25,$0.00,-15025.00,BUY 100 AAPL,Acct123
01/20/2024 10:15:00,TRA,SELL,AAPL,SELL,CLOSE,100,,,,$160.00,$0.00,16000.00,SELL 100 AAPL,Acct123
01/22/2024 09:30:00,TRA,BUY,SPY,BUY,OPEN,5,02/16/2024,420,CALL,$2.50,$3.00,-1253.00,BUY 5 SPY 420C,Acct123
01/22/2024 15:00:00,DIV,DIVIDEND,AAPL,,,,,,,$0.00,$0.00,25.00,APPLE INC DIVIDEND,Acct123
01/25/2024 14:00:00,TRA,SELL,SPY,SELL,CLOSE,5,02/16/2024,420,CALL,$3.00,$3.00,1497.00,SELL 5 SPY 420C,Acct123`

const ETRADE_CSV = `Date,Transaction #,Action,Quantity,Symbol,Description,Price,Commission & Fees,Amount
06/15/2024,TXN001,BUY,100,AAPL,APPLE INC,150.25,0.00,-15025.00
06/16/2024,TXN002,SELL,100,AAPL,APPLE INC,160.00,0.00,16000.00
06/17/2024,TXN003,BUY,50,MSFT,MICROSOFT CORP,380.00,0.00,-19000.00
06/17/2024,TXN004,DIVIDEND,0,AAPL,APPLE INC DIVIDEND,0.00,0.00,25.00
06/18/2024,TXN005,SELL,50,MSFT,MICROSOFT CORP,400.00,0.00,20000.00`

const IBKR_CSV = `Symbol,Date/Time,Quantity,T. Price,Proceeds,Comm/Fee
AAPL,2024-01-15 14:30:00,10,150.25,1502.50,-1.00
AAPL,2024-01-20 10:15:00,-10,160.00,-1600.00,-1.00
MSFT,2024-01-22 09:30:00,5,380.00,1900.00,-0.75
TSLA,2024-01-25 14:00:00,-8,200.00,-1600.00,-1.00
NVDA,2024-01-28 15:30:00,3,900.00,2700.00,-0.50`

const TRADESTATION_CSV = `Account Number,Type,TradeInd,Transaction,Quantity,Cusip,ADP,Symbol,CallPut,Underlying Symbol,Expiration Date,Strike Price,TD,SD,Activity,Date,Price,Amount,Currency Code,Commission,Description,Time,Order ID
TS-123456,EQUITY,T,BUY,100,037833100,12345,AAPL,,,,,20240115,20240117,TRA,20240115,150.25,-15025.00,USD,0.00,BUY 100 AAPL,14:30:00,ORD001
TS-123456,EQUITY,T,SELL,100,037833100,12345,AAPL,,,,,20240120,20240122,TRA,20240120,160.00,16000.00,USD,0.00,SELL 100 AAPL,10:15:00,ORD002
TS-123456,OPTION,T,BUY,5,,67890,SPY,CALL,SPY,20240216,420,20240122,20240124,TRA,20240122,2.50,-1250.00,USD,1.00,BUY 5 SPY CALL,09:30:00,ORD003
TS-123456,EQUITY,T,BUY,20,67066G104,99999,NVDA,,,,,20240128,20240130,TRA,20240128,900.00,-18000.00,USD,0.00,BUY 20 NVDA,15:00:00,ORD004
TS-123456,EQUITY,T,SELL,20,67066G104,99999,NVDA,,,,,20240201,20240203,TRA,20240201,950.00,19000.00,USD,0.00,SELL 20 NVDA,11:00:00,ORD005`

// ── parseBrokerCSV Integration Tests ─────────────────────────────────────────

describe('parseBrokerCSV — Robinhood', () => {
  const result = parseBrokerCSV(ROBINHOOD_CSV)

  it('detects Robinhood', () => {
    expect(result.broker).toBe('Robinhood')
  })

  it('parses buy trades', () => {
    const buy = result.trades.find(t => t.symbol === 'AAPL' && t.side === 'buy')
    expect(buy).toBeDefined()
    expect(buy?.quantity).toBe(10)
    expect(buy?.price).toBe(150.25)
  })

  it('parses sell trades', () => {
    const sell = result.trades.find(t => t.symbol === 'AAPL' && t.side === 'sell')
    expect(sell).toBeDefined()
    expect(sell?.price).toBe(160.00)
  })

  it('normalizes date to YYYY-MM-DD', () => {
    const trade = result.trades.find(t => t.symbol === 'AAPL')
    expect(trade?.date).toBe('2024-01-15')
  })

  it('sets broker to Robinhood', () => {
    expect(result.trades.every(t => t.broker === 'Robinhood')).toBe(true)
  })

  it('has no errors', () => {
    expect(result.errors).toHaveLength(0)
  })
})

describe('parseBrokerCSV — Fidelity', () => {
  const result = parseBrokerCSV(FIDELITY_CSV)

  it('detects Fidelity', () => {
    expect(result.broker).toBe('Fidelity')
  })

  it('parses buy/sell trades', () => {
    expect(result.trades.some(t => t.side === 'buy')).toBe(true)
    expect(result.trades.some(t => t.side === 'sell')).toBe(true)
  })

  it('skips DIVIDEND rows', () => {
    const dividends = result.trades.filter(t => t.rawAction?.toUpperCase().includes('DIVIDEND'))
    expect(dividends).toHaveLength(0)
  })

  it('normalizes date from Run Date column', () => {
    const trade = result.trades.find(t => t.symbol === 'AAPL' && t.side === 'buy')
    expect(trade?.date).toBe('2023-11-10')
  })

  it('detects stock type', () => {
    expect(result.trades.every(t => t.type === 'stock')).toBe(true)
  })
})

describe('parseBrokerCSV — Schwab (with metadata header)', () => {
  const result = parseBrokerCSV(SCHWAB_METADATA_CSV)

  it('detects Schwab even with metadata first line', () => {
    expect(result.broker).toBe('Schwab')
  })

  it('parses trades correctly after skipping metadata', () => {
    expect(result.trades.length).toBeGreaterThan(0)
  })

  it('parses AAPL buy', () => {
    const buy = result.trades.find(t => t.symbol === 'AAPL' && t.side === 'buy')
    expect(buy).toBeDefined()
    expect(buy?.quantity).toBe(100)
    expect(buy?.price).toBe(150.25)
    expect(buy?.date).toBe('2024-06-15')
  })

  it('skips Dividend rows', () => {
    const divs = result.trades.filter(t => t.rawAction?.toLowerCase().includes('dividend'))
    expect(divs).toHaveLength(0)
  })
})

describe('parseBrokerCSV — Webull', () => {
  const result = parseBrokerCSV(WEBULL_CSV)

  it('detects Webull from ISO date format', () => {
    expect(result.broker).toBe('Webull')
  })

  it('parses ISO dates correctly', () => {
    const trade = result.trades.find(t => t.symbol === 'AAPL')
    expect(trade?.date).toBe('2024-01-15')
  })

  it('parses buy and sell', () => {
    expect(result.trades.some(t => t.side === 'buy')).toBe(true)
    expect(result.trades.some(t => t.side === 'sell')).toBe(true)
  })

  it('fees are 0 (included in Amount)', () => {
    expect(result.trades.every(t => t.fees === 0)).toBe(true)
  })
})

describe('parseBrokerCSV — Tastytrade', () => {
  const result = parseBrokerCSV(TASTYTRADE_CSV)

  it('detects Tastytrade', () => {
    expect(result.broker).toBe('Tastytrade')
  })

  it('strips time from Date/Time column', () => {
    const trade = result.trades.find(t => t.symbol === 'AAPL')
    expect(trade?.date).toBe('2024-01-15')
  })

  it('detects options', () => {
    const option = result.trades.find(t => t.symbol === 'SPY')
    expect(option?.type).toBe('option')
  })

  it('detects stocks', () => {
    const stock = result.trades.find(t => t.symbol === 'AAPL')
    expect(stock?.type).toBe('stock')
  })

  it('skips non-trade rows (DIV/DIVIDEND)', () => {
    // The DIV row has Buy/Sell empty, so it should be filtered
    const divRows = result.trades.filter(t => t.rawAction === '' || t.rawAction === undefined)
    expect(divRows).toHaveLength(0)
    // Total trade count should be 4 (2 AAPL + 2 SPY options)
    expect(result.trades).toHaveLength(4)
  })

  it('includes fees', () => {
    const option = result.trades.find(t => t.symbol === 'SPY' && t.side === 'buy')
    expect(option?.fees).toBe(3.00)
  })
})

describe('parseBrokerCSV — E*TRADE', () => {
  const result = parseBrokerCSV(ETRADE_CSV)

  it('detects E*TRADE', () => {
    expect(result.broker).toBe('E*TRADE')
  })

  it('parses date correctly', () => {
    const trade = result.trades.find(t => t.symbol === 'AAPL' && t.side === 'buy')
    expect(trade?.date).toBe('2024-06-15')
  })

  it('skips DIVIDEND rows', () => {
    const divs = result.trades.filter(t => t.rawAction?.toUpperCase() === 'DIVIDEND')
    expect(divs).toHaveLength(0)
  })

  it('parses quantities correctly', () => {
    const aapl = result.trades.find(t => t.symbol === 'AAPL' && t.side === 'buy')
    expect(aapl?.quantity).toBe(100)
  })
})

describe('parseBrokerCSV — IBKR', () => {
  const result = parseBrokerCSV(IBKR_CSV)

  it('detects IBKR', () => {
    expect(result.broker).toBe('IBKR')
  })

  it('infers side from quantity sign (negative = sell)', () => {
    const sell = result.trades.find(t => t.symbol === 'AAPL' && t.side === 'sell')
    expect(sell).toBeDefined()
    expect(sell?.quantity).toBe(10)  // always positive
  })

  it('infers side from quantity sign (positive = buy)', () => {
    const buy = result.trades.find(t => t.symbol === 'AAPL' && t.side === 'buy')
    expect(buy).toBeDefined()
  })

  it('strips date/time separator from Date/Time field', () => {
    const trade = result.trades.find(t => t.symbol === 'AAPL' && t.side === 'buy')
    expect(trade?.date).toBe('2024-01-15')
  })

  it('includes commission in fees', () => {
    const trade = result.trades.find(t => t.symbol === 'AAPL' && t.side === 'buy')
    expect(trade?.fees).toBe(1.00)
  })
})

describe('parseBrokerCSV — TradeStation', () => {
  const result = parseBrokerCSV(TRADESTATION_CSV)

  it('detects TradeStation', () => {
    expect(result.broker).toBe('TradeStation')
  })

  it('converts YYYYMMDD date to ISO', () => {
    const trade = result.trades.find(t => t.symbol === 'AAPL' && t.side === 'buy')
    expect(trade?.date).toBe('2024-01-15')
  })

  it('detects option type from CallPut column', () => {
    const option = result.trades.find(t => t.symbol === 'SPY')
    expect(option?.type).toBe('option')
  })

  it('detects stock type', () => {
    const stock = result.trades.find(t => t.symbol === 'AAPL')
    expect(stock?.type).toBe('stock')
  })

  it('parses buy transaction', () => {
    const buy = result.trades.find(t => t.symbol === 'AAPL' && t.side === 'buy')
    expect(buy?.quantity).toBe(100)
    expect(buy?.price).toBe(150.25)
  })

  it('parses sell transaction', () => {
    const sell = result.trades.find(t => t.symbol === 'AAPL' && t.side === 'sell')
    expect(sell?.quantity).toBe(100)
    expect(sell?.price).toBe(160.00)
  })
})

// ── Edge Cases ────────────────────────────────────────────────────────────────

describe('Edge cases', () => {
  it('returns error for empty CSV', () => {
    const result = parseBrokerCSV('')
    expect(result.errors.length).toBeGreaterThan(0)
    expect(result.trades).toHaveLength(0)
  })

  it('returns error for CSV with only headers, no data', () => {
    const result = parseBrokerCSV('Date,Symbol,Side,Quantity,Price,Amount\n')
    // either no trades or an error about no data
    expect(result.trades.length === 0 || result.errors.length > 0).toBe(true)
  })

  it('does not crash on rows with missing fields', () => {
    const csv = `Date,Symbol,Side,Quantity,Price,Amount
2024-01-15,AAPL,BUY,,150.00,
2024-01-20,AAPL,SELL,10,160.00,1600.00`
    const result = parseBrokerCSV(csv)
    // Should parse at least the valid sell row
    expect(result.trades.some(t => t.side === 'sell')).toBe(true)
  })

  it('handles negative quantities for sells (makes quantity positive)', () => {
    const errors: string[] = []
    const rows = [
      { Date: '2024-01-15', Symbol: 'AAPL', Quantity: '-10', 'T. Price': '150.25', 'Comm/Fee': '1.00', 'Date/Time': '2024-01-15 14:30' },
    ]
    const trades = parseIBKR(rows, errors)
    expect(trades[0]?.quantity).toBe(10)
    expect(trades[0]?.side).toBe('sell')
  })

  it('parseFidelity individual parser — skips interest row', () => {
    const errors: string[] = []
    const rows = [
      { 'Run Date': '11/10/2023', Account: 'X', Action: 'INTEREST', Symbol: '', Description: 'Interest', Type: 'CASH', Quantity: '0', Price: '0', Commission: '0', Fees: '0', Amount: '5.00' },
      { 'Run Date': '11/10/2023', Account: 'X', Action: 'BUY', Symbol: 'AAPL', Description: 'Apple', Type: 'EQUITY', Quantity: '10', Price: '150.00', Commission: '0', Fees: '0', Amount: '-1500.00' },
    ]
    const trades = parseFidelity(rows, errors)
    expect(trades).toHaveLength(1)
    expect(trades[0].symbol).toBe('AAPL')
  })

  it('parseSchwab individual parser — handles buy and sell', () => {
    const errors: string[] = []
    const rows = [
      { Date: '06/15/2024', Action: 'BUY', Symbol: 'AAPL', Description: 'Apple Inc', Quantity: '100', Price: '$150.25', 'Fees & Comm': '$0.00', Amount: '-$15025.00' },
      { Date: '06/16/2024', Action: 'SELL', Symbol: 'AAPL', Description: 'Apple Inc', Quantity: '100', Price: '$160.00', 'Fees & Comm': '$0.00', Amount: '$16000.00' },
    ]
    const trades = parseSchwab(rows, errors)
    expect(trades).toHaveLength(2)
    expect(trades[0].side).toBe('buy')
    expect(trades[1].side).toBe('sell')
    expect(trades[0].price).toBe(150.25)
  })

  it('parseTradeStation strips dollar signs from price', () => {
    const errors: string[] = []
    const rows = [
      { 'Account Number': 'TS-123', Type: 'EQUITY', TradeInd: 'T', Transaction: 'BUY', Quantity: '10', Cusip: '037833100', ADP: '12345', Symbol: 'AAPL', CallPut: '', 'Underlying Symbol': '', 'Expiration Date': '', 'Strike Price': '', TD: '20240115', SD: '20240117', Activity: 'TRA', Date: '20240115', Price: '$150.25', Amount: '-$1502.50', 'Currency Code': 'USD', Commission: '$0.00', Description: 'BUY 10 AAPL', Time: '14:30:00', 'Order ID': 'ORD001' },
    ]
    const trades = parseTradeStation(rows, errors)
    expect(trades).toHaveLength(1)
    expect(trades[0].price).toBe(150.25)
    expect(trades[0].date).toBe('2024-01-15')
  })

  it('parseTastytrade — skips rows where Buy/Sell is not BUY or SELL', () => {
    const errors: string[] = []
    const rows = [
      { 'Date/Time': '01/15/2024 14:30:00', 'Transaction Code': 'TRA', 'Transaction Subcode': 'BUY', Symbol: 'AAPL', 'Buy/Sell': 'BUY', 'Open/Close': 'OPEN', Quantity: '100', 'Expiration Date': '', Strike: '', 'Call/Put': '', Price: '$150.25', Fees: '$0.00', Amount: '-15025.00', Description: 'BUY 100 AAPL', 'Account Reference': 'Acct123' },
      { 'Date/Time': '01/15/2024 14:35:00', 'Transaction Code': 'DIV', 'Transaction Subcode': 'DIVIDEND', Symbol: 'AAPL', 'Buy/Sell': '', 'Open/Close': '', Quantity: '0', 'Expiration Date': '', Strike: '', 'Call/Put': '', Price: '$0.00', Fees: '$0.00', Amount: '25.00', Description: 'DIVIDEND', 'Account Reference': 'Acct123' },
    ]
    const trades = parseTastytrade(rows, errors)
    expect(trades).toHaveLength(1)
    expect(trades[0].side).toBe('buy')
  })
})

// ── All 8 Brokers Auto-Detect Summary ────────────────────────────────────────

describe('Auto-detect all 8 brokers', () => {
  const cases: { name: string; csv: string; expected: string }[] = [
    { name: 'Robinhood', csv: ROBINHOOD_CSV, expected: 'Robinhood' },
    { name: 'Fidelity',  csv: FIDELITY_CSV,  expected: 'Fidelity' },
    { name: 'Schwab',    csv: SCHWAB_METADATA_CSV, expected: 'Schwab' },
    { name: 'Webull',    csv: WEBULL_CSV,    expected: 'Webull' },
    { name: 'Tastytrade',csv: TASTYTRADE_CSV, expected: 'Tastytrade' },
    { name: 'E*TRADE',   csv: ETRADE_CSV,    expected: 'E*TRADE' },
    { name: 'IBKR',      csv: IBKR_CSV,      expected: 'IBKR' },
    { name: 'TradeStation', csv: TRADESTATION_CSV, expected: 'TradeStation' },
  ]

  cases.forEach(({ name, csv, expected }) => {
    it(`detects ${name}`, () => {
      const result = parseBrokerCSV(csv)
      expect(result.broker).toBe(expected)
      expect(result.trades.length).toBeGreaterThan(0)
    })
  })
})
