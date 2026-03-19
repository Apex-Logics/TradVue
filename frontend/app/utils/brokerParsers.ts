/**
 * brokerParsers.ts
 * Unified multi-broker CSV parser for TradVue
 *
 * Supports: Robinhood, Fidelity, Schwab, Webull, Tastytrade, E*TRADE, IBKR, TradeStation
 */

// ── Public Interface ──────────────────────────────────────────────────────────

export interface ParsedTrade {
  date: string        // ISO 8601: YYYY-MM-DD
  symbol: string      // Ticker symbol (e.g., AAPL)
  side: 'buy' | 'sell'
  quantity: number    // Always positive
  price: number       // Per-share price
  total: number       // Absolute total (quantity × price)
  fees: number        // Commission + fees combined
  broker: string      // Source broker name
  type: 'stock' | 'option' | 'crypto' | 'other'
  notes?: string      // Description/memo if available
  rawAction?: string  // Original action text from CSV
}

export interface ParseResult {
  broker: string
  trades: ParsedTrade[]
  errors: string[]
}

// ── CSV Security ──────────────────────────────────────────────────────────────

/**
 * Sanitize a single CSV field value to prevent:
 *  - HTML/XSS injection (strip tags)
 *  - Formula injection (Excel/Sheets: =, +, -, @, tab, carriage return)
 *  - Memory bombs (limit field length)
 */
export function sanitizeCSVField(value: string): string {
  if (!value) return value

  // Strip HTML tags
  let clean = value.replace(/<[^>]*>/g, '')

  // Block formula injection (Excel/Sheets attack vector)
  // Fields starting with =, +, @, tab, or carriage return can execute formulas.
  // For '-': only dangerous when NOT followed by a digit/decimal (e.g. -HYPERLINK()),
  //          plain negative numbers like "-10" or "-1234.56" are safe.
  const startsWithFormula =
    /^[=+@\t\r]/.test(clean) ||
    (clean.startsWith('-') && !/^-[\d.]/.test(clean))
  if (startsWithFormula) {
    clean = "'" + clean // Prefix with single quote to neutralize
  }

  // Trim whitespace
  clean = clean.trim()

  // Limit field length (prevent memory bombs)
  if (clean.length > 10000) {
    clean = clean.substring(0, 10000)
  }

  return clean
}

/**
 * Sanitize a cell value for CSV export to prevent formula injection.
 * Prefixes cells starting with formula characters with a single quote.
 */
export function sanitizeCSVExportCell(value: string): string {
  if (!value) return value
  if (/^[=+\-@\t\r]/.test(value)) {
    return "'" + value
  }
  return value
}

// ── CSV Utilities ─────────────────────────────────────────────────────────────

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') { current += '"'; i++ }
      else if (ch === '"') { inQuotes = false }
      else { current += ch }
    } else {
      if (ch === '"') { inQuotes = true }
      else if (ch === ',') { result.push(current); current = '' }
      else { current += ch }
    }
  }
  result.push(current)
  return result
}

function parseCSVText(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.split(/\r?\n/).filter(l => l.trim())
  if (lines.length < 2) return { headers: [], rows: [] }
  const headers = parseCSVLine(lines[0]).map(h => h.trim())
  const rows: Record<string, string>[] = []
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i])
    if (values.every(v => !v.trim())) continue
    const row: Record<string, string> = {}
    // Apply sanitization to every field value to prevent XSS and formula injection
    headers.forEach((h, idx) => { row[h] = sanitizeCSVField((values[idx] ?? '').trim()) })
    rows.push(row)
  }
  return { headers, rows }
}

// ── Field Helpers ─────────────────────────────────────────────────────────────

function getField(row: Record<string, string>, candidates: string[]): string {
  // Exact match first
  for (const c of candidates) {
    const key = Object.keys(row).find(k => k.toLowerCase().trim() === c.toLowerCase())
    if (key !== undefined && row[key]?.trim()) return row[key].trim()
  }
  // Partial match fallback
  for (const c of candidates) {
    const key = Object.keys(row).find(k => k.toLowerCase().includes(c.toLowerCase()))
    if (key !== undefined && row[key]?.trim()) return row[key].trim()
  }
  return ''
}

export function normalizeDate(raw: string): string {
  if (!raw) return ''
  const s = raw.trim()
  // Already ISO 8601: YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  // Compact: YYYYMMDD (TradeStation, IBKR)
  if (/^\d{8}$/.test(s)) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`
  // MM/DD/YYYY HH:MM:SS (Tastytrade)
  const mdyTs = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+\d{1,2}:\d{2}/)
  if (mdyTs) return `${mdyTs[3]}-${mdyTs[1].padStart(2, '0')}-${mdyTs[2].padStart(2, '0')}`
  // MM/DD/YYYY (most US brokers)
  const mdy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (mdy) return `${mdy[3]}-${mdy[1].padStart(2, '0')}-${mdy[2].padStart(2, '0')}`
  // MM-DD-YYYY
  const mdy2 = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/)
  if (mdy2) return `${mdy2[3]}-${mdy2[1].padStart(2, '0')}-${mdy2[2].padStart(2, '0')}`
  // YYYY/MM/DD
  const ymd = s.match(/^(\d{4})\/(\d{2})\/(\d{2})$/)
  if (ymd) return `${ymd[1]}-${ymd[2]}-${ymd[3]}`
  return s
}

export function parseNumber(val: string): number {
  if (!val || !val.trim()) return 0
  // Handle parentheses as negative: (1,234.56) → -1234.56
  const cleaned = val.replace(/[$,\s]/g, '').replace(/^\(([^)]+)\)$/, '-$1')
  return parseFloat(cleaned) || 0
}

function isNonTradeAction(action: string): boolean {
  if (!action) return false
  const a = action.toUpperCase().trim()
  const skipPatterns = [
    'DIVIDEND', ' DIV', 'INTEREST', 'REINVEST', 'TRANSFER', 'DEPOSIT',
    'WITHDRAWAL', 'WIRE', 'ACH', 'JOURNALING', 'JOURNAL', 'FEE', 'TAX',
    'SWEEP', 'REBATE', 'BALANCE ADJUSTMENT', 'MARGIN', 'DISTRIBUTION',
    'INCOME', 'EXPIRATION', 'MONEYMARKET', 'MONEY MARKET', 'CASH',
    'CREDIT', 'DEBIT', 'TRADE CORRECTION',
  ]
  return skipPatterns.some(p => a.includes(p.trim()))
}

function detectTradeType(symbol: string, assetClass?: string): ParsedTrade['type'] {
  if (assetClass) {
    const ac = assetClass.toUpperCase()
    if (ac.includes('OPTION') || ac.includes('OPT')) return 'option'
    if (ac.includes('CRYPTO') || ac.includes('DIGITAL') || ac.includes('COIN')) return 'crypto'
    if (ac.includes('EQUITY') || ac.includes('STOCK') || ac.includes('FUND') || ac.includes('ETF')) return 'stock'
  }
  // OSI option symbol: {Symbol}{YYMMDD}{C/P}{Strike8digits}  e.g. AAPL240119C00175000
  if (/^[A-Z]{1,6}\d{6}[CP]\d{8}$/.test(symbol)) return 'option'
  // Long symbols with digits often indicate options
  if (symbol.length > 8 && /\d/.test(symbol)) return 'option'
  // Known crypto tickers
  const cryptos = ['BTC', 'ETH', 'DOGE', 'USDC', 'USDT', 'LTC', 'XRP', 'ADA', 'SOL', 'AVAX', 'DOT', 'LINK', 'MATIC', 'BNB']
  if (cryptos.some(c => symbol === c || symbol.startsWith(c + '/'))) return 'crypto'
  return 'stock'
}

// ── Broker Detection ──────────────────────────────────────────────────────────

/**
 * Detect which broker a CSV came from based on its headers.
 * Pass firstRow for Robinhood vs Webull disambiguation (same headers, different date format).
 */
export function detectBroker(headers: string[], firstRow?: Record<string, string>): string {
  const h = headers.map(hdr => hdr.toLowerCase().trim())
  const has = (s: string) => h.some(x => x === s)
  const hasIncludes = (s: string) => h.some(x => x.includes(s))

  // Tastytrade: unique combo of columns
  if (has('date/time') && has('transaction code') && has('buy/sell') && has('open/close')) return 'Tastytrade'

  // Fidelity: "run date" is a dead giveaway
  if (has('run date')) return 'Fidelity'

  // Schwab: combined fees column name
  if (has('fees & comm')) return 'Schwab'

  // E*TRADE: "transaction #" or "commission & fees"
  if (has('transaction #') || has('commission & fees')) return 'E*TRADE'

  // TradeStation: has very specific internal columns
  if (has('tradeind') || has('cusip') || has('adp') || (has('td') && has('sd') && hasIncludes('callput'))) return 'TradeStation'

  // IBKR: flex query CSV columns
  if (has('t. price') || has('comm/fee') || has('datadiscriminator') || has('asset category')) return 'IBKR'

  // Robinhood Activity Report format (the real Robinhood export)
  // Columns: Activity Date, Process Date, Settle Date, Instrument, Description, Trans Code, Quantity, Price, Amount
  if (hasIncludes('activity date') || (hasIncludes('trans code') && hasIncludes('instrument'))) return 'RobinhoodActivity'

  // Webull vs Robinhood: identical headers — differentiate by date format in first row
  if (has('side') && has('amount') && has('symbol') && has('quantity') && has('price')) {
    if (firstRow) {
      const dateVal = getField(firstRow, ['date'])
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateVal)) return 'Webull'     // ISO date = Webull
      if (/^\d{1,2}\/\d{1,2}\/\d{4}/.test(dateVal)) return 'Robinhood'  // MM/DD/YYYY = Robinhood
    }
    return 'Webull' // default fallback for ambiguous case
  }

  return 'Unknown'
}

// ── Individual Parsers ────────────────────────────────────────────────────────

export function parseRobinhood(rows: Record<string, string>[], errors: string[]): ParsedTrade[] {
  const trades: ParsedTrade[] = []
  rows.forEach((row, i) => {
    try {
      const date = normalizeDate(getField(row, ['date']))
      const symbol = getField(row, ['symbol', 'instrument']).toUpperCase()
      const sideRaw = getField(row, ['side'])
      const quantity = Math.abs(parseNumber(getField(row, ['quantity', 'qty'])))
      const price = parseNumber(getField(row, ['price']))
      const amount = Math.abs(parseNumber(getField(row, ['amount'])))

      if (!date || !symbol) return
      const sideUp = sideRaw.toUpperCase()
      if (!['BUY', 'SELL'].includes(sideUp)) return  // skip non-trade rows

      trades.push({
        date,
        symbol,
        side: sideUp === 'BUY' ? 'buy' : 'sell',
        quantity,
        price,
        total: amount || quantity * price,
        fees: 0,  // Robinhood includes fees in Amount
        broker: 'Robinhood',
        type: detectTradeType(symbol),
        rawAction: sideRaw,
      })
    } catch (e) {
      errors.push(`Row ${i + 2}: ${e instanceof Error ? e.message : 'Parse error'}`)
    }
  })
  return trades
}

export function parseFidelity(rows: Record<string, string>[], errors: string[]): ParsedTrade[] {
  const trades: ParsedTrade[] = []
  rows.forEach((row, i) => {
    try {
      const date = normalizeDate(getField(row, ['run date']))
      const symbol = getField(row, ['symbol']).toUpperCase()
      const action = getField(row, ['action'])
      const assetType = getField(row, ['type'])
      const quantity = parseNumber(getField(row, ['quantity']))
      const price = parseNumber(getField(row, ['price']))
      const commission = Math.abs(parseNumber(getField(row, ['commission'])))
      const feesAmt = Math.abs(parseNumber(getField(row, ['fees'])))
      const amount = Math.abs(parseNumber(getField(row, ['amount'])))

      if (!date || !symbol || !action) return
      if (isNonTradeAction(action)) return

      const actionUpper = action.toUpperCase()
      if (!actionUpper.match(/BUY|SELL|BOUGHT|SOLD|STO|STC|BTO|BTC/)) return

      const side: 'buy' | 'sell' = actionUpper.match(/SELL|STO|STC|SOLD/) ? 'sell' : 'buy'

      trades.push({
        date,
        symbol,
        side,
        quantity: Math.abs(quantity),
        price,
        total: amount || Math.abs(quantity) * price,
        fees: commission + feesAmt,
        broker: 'Fidelity',
        type: detectTradeType(symbol, assetType),
        notes: getField(row, ['description']),
        rawAction: action,
      })
    } catch (e) {
      errors.push(`Row ${i + 2}: ${e instanceof Error ? e.message : 'Parse error'}`)
    }
  })
  return trades
}

export function parseSchwab(rows: Record<string, string>[], errors: string[]): ParsedTrade[] {
  const trades: ParsedTrade[] = []
  rows.forEach((row, i) => {
    try {
      const date = normalizeDate(getField(row, ['date']))
      const symbol = getField(row, ['symbol']).toUpperCase()
      const action = getField(row, ['action'])
      const quantity = parseNumber(getField(row, ['quantity']))
      const price = parseNumber(getField(row, ['price']))
      const feesAmt = Math.abs(parseNumber(getField(row, ['fees & comm'])))
      const amount = Math.abs(parseNumber(getField(row, ['amount'])))

      if (!date || !symbol || !action) return
      if (isNonTradeAction(action)) return

      const actionUpper = action.toUpperCase()
      if (!actionUpper.match(/BUY|SELL|BOUGHT|SOLD|STO|STC|BTO|BTC/)) return

      const side: 'buy' | 'sell' = actionUpper.match(/SELL|SOLD|STO|STC/) ? 'sell' : 'buy'

      trades.push({
        date,
        symbol,
        side,
        quantity: Math.abs(quantity),
        price,
        total: amount || Math.abs(quantity) * price,
        fees: feesAmt,
        broker: 'Schwab',
        type: detectTradeType(symbol),
        notes: getField(row, ['description']),
        rawAction: action,
      })
    } catch (e) {
      errors.push(`Row ${i + 2}: ${e instanceof Error ? e.message : 'Parse error'}`)
    }
  })
  return trades
}

export function parseWebull(rows: Record<string, string>[], errors: string[]): ParsedTrade[] {
  const trades: ParsedTrade[] = []
  rows.forEach((row, i) => {
    try {
      const date = normalizeDate(getField(row, ['date']))
      const symbol = getField(row, ['symbol']).toUpperCase()
      const sideRaw = getField(row, ['side'])
      const quantity = Math.abs(parseNumber(getField(row, ['quantity'])))
      const price = parseNumber(getField(row, ['price']))
      const amount = Math.abs(parseNumber(getField(row, ['amount'])))

      if (!date || !symbol) return
      const sideUp = sideRaw.toUpperCase()
      if (!['BUY', 'SELL'].includes(sideUp)) return

      trades.push({
        date,
        symbol,
        side: sideUp === 'BUY' ? 'buy' : 'sell',
        quantity,
        price,
        total: amount || quantity * price,
        fees: 0,  // Webull includes fees in Amount
        broker: 'Webull',
        type: detectTradeType(symbol),
        rawAction: sideRaw,
      })
    } catch (e) {
      errors.push(`Row ${i + 2}: ${e instanceof Error ? e.message : 'Parse error'}`)
    }
  })
  return trades
}

export function parseTastytrade(rows: Record<string, string>[], errors: string[]): ParsedTrade[] {
  const trades: ParsedTrade[] = []
  rows.forEach((row, i) => {
    try {
      const dateRaw = getField(row, ['date/time'])
      const date = normalizeDate(dateRaw)
      const symbol = getField(row, ['symbol']).toUpperCase()
      const buySell = getField(row, ['buy/sell']).toUpperCase()
      const openClose = getField(row, ['open/close'])
      const quantity = Math.abs(parseNumber(getField(row, ['quantity'])))
      const price = parseNumber(getField(row, ['price']))
      const feesAmt = Math.abs(parseNumber(getField(row, ['fees'])))
      const amount = Math.abs(parseNumber(getField(row, ['amount'])))
      const callPut = getField(row, ['call/put'])
      const strike = getField(row, ['strike'])
      const expiry = getField(row, ['expiration date'])
      const description = getField(row, ['description'])

      if (!date || !symbol) return
      if (!['BUY', 'SELL'].includes(buySell)) return  // skip non-trade rows (dividends, etc.)

      const isOption = !!(callPut || strike || expiry)

      trades.push({
        date,
        symbol,
        side: buySell === 'BUY' ? 'buy' : 'sell',
        quantity,
        price,
        total: amount || quantity * price,
        fees: feesAmt,
        broker: 'Tastytrade',
        type: isOption ? 'option' : detectTradeType(symbol),
        notes: description || undefined,
        rawAction: openClose ? `${buySell} ${openClose}` : buySell,
      })
    } catch (e) {
      errors.push(`Row ${i + 2}: ${e instanceof Error ? e.message : 'Parse error'}`)
    }
  })
  return trades
}

export function parseEtrade(rows: Record<string, string>[], errors: string[]): ParsedTrade[] {
  const trades: ParsedTrade[] = []
  rows.forEach((row, i) => {
    try {
      const date = normalizeDate(getField(row, ['date']))
      const symbol = getField(row, ['symbol']).toUpperCase()
      const action = getField(row, ['action'])
      const quantity = parseNumber(getField(row, ['quantity']))
      const price = parseNumber(getField(row, ['price']))
      const feesAmt = Math.abs(parseNumber(getField(row, ['commission & fees'])))
      const amount = Math.abs(parseNumber(getField(row, ['amount'])))

      if (!date || !symbol || !action) return
      if (isNonTradeAction(action)) return

      const actionUpper = action.toUpperCase()
      if (!actionUpper.match(/BUY|SELL|BOUGHT|SOLD/)) return

      const side: 'buy' | 'sell' = actionUpper.match(/SELL|SOLD/) ? 'sell' : 'buy'

      trades.push({
        date,
        symbol,
        side,
        quantity: Math.abs(quantity),
        price,
        total: amount || Math.abs(quantity) * price,
        fees: feesAmt,
        broker: 'E*TRADE',
        type: detectTradeType(symbol),
        notes: getField(row, ['description']),
        rawAction: action,
      })
    } catch (e) {
      errors.push(`Row ${i + 2}: ${e instanceof Error ? e.message : 'Parse error'}`)
    }
  })
  return trades
}

export function parseIBKR(rows: Record<string, string>[], errors: string[]): ParsedTrade[] {
  const trades: ParsedTrade[] = []
  rows.forEach((row, i) => {
    try {
      // Skip header/total/subtotal rows in IBKR activity statement format
      const discriminator = getField(row, ['datadiscriminator'])
      if (discriminator && ['header', 'total', 'subtotal'].includes(discriminator.toLowerCase())) return

      const symbol = getField(row, ['symbol']).toUpperCase().split(' ')[0]
      if (!symbol || symbol.toLowerCase() === 'symbol') return  // skip internal header rows

      const dateRaw = getField(row, ['date/time', 'date'])
      const datePart = dateRaw.split(/[,;\s]/)[0]   // handles "2024-01-15, 14:30:00" or "2024-01-15;143000"
      const date = normalizeDate(datePart)

      const quantityRaw = parseNumber(getField(row, ['quantity', 'qty']))
      const price = parseNumber(getField(row, ['t. price', 'trade price', 'price']))
      const commission = Math.abs(parseNumber(getField(row, ['comm/fee', 'commission', 'comm'])))
      const assetClass = getField(row, ['asset category', 'asset class'])
      const actionRaw = getField(row, ['action', 'buy/sell'])

      if (!date) return
      if (quantityRaw === 0 && !actionRaw) return

      let side: 'buy' | 'sell'
      if (actionRaw) {
        side = actionRaw.toUpperCase().includes('BUY') ? 'buy' : 'sell'
      } else {
        side = quantityRaw >= 0 ? 'buy' : 'sell'
      }
      const qty = Math.abs(quantityRaw)

      trades.push({
        date,
        symbol,
        side,
        quantity: qty,
        price,
        total: qty * price,
        fees: commission,
        broker: 'IBKR',
        type: detectTradeType(symbol, assetClass),
        rawAction: actionRaw || (side === 'buy' ? 'BUY' : 'SELL'),
      })
    } catch (e) {
      errors.push(`Row ${i + 2}: ${e instanceof Error ? e.message : 'Parse error'}`)
    }
  })
  return trades
}

export function parseTradeStation(rows: Record<string, string>[], errors: string[]): ParsedTrade[] {
  const trades: ParsedTrade[] = []
  rows.forEach((row, i) => {
    try {
      // TradeStation has multiple date columns — prefer "Date" then "TD"
      const dateRaw = getField(row, ['date', 'td'])
      const date = normalizeDate(dateRaw)
      const symbol = getField(row, ['symbol', 'underlying symbol']).toUpperCase()
      const transaction = getField(row, ['transaction'])
      const quantity = parseNumber(getField(row, ['quantity', 'qty']))
      const price = parseNumber(getField(row, ['price']))
      const commission = Math.abs(parseNumber(getField(row, ['commission'])))
      const assetType = getField(row, ['type'])
      const callPut = getField(row, ['callput', 'call/put'])

      if (!date || !symbol || !transaction) return
      if (isNonTradeAction(transaction)) return

      const txnUpper = transaction.toUpperCase()
      if (!txnUpper.match(/BUY|SELL|ASSIGNMENT|EXERCISE/)) return

      const side: 'buy' | 'sell' = txnUpper.includes('SELL') ? 'sell' : 'buy'
      const isOption = !!(callPut || assetType?.toUpperCase() === 'OPTION')

      trades.push({
        date,
        symbol,
        side,
        quantity: Math.abs(quantity),
        price,
        total: Math.abs(quantity) * price,
        fees: commission,
        broker: 'TradeStation',
        type: isOption ? 'option' : detectTradeType(symbol, assetType),
        notes: getField(row, ['description']),
        rawAction: transaction,
      })
    } catch (e) {
      errors.push(`Row ${i + 2}: ${e instanceof Error ? e.message : 'Parse error'}`)
    }
  })
  return trades
}


/**
 * Robinhood Activity Report format (real Robinhood account export).
 * Columns: Activity Date, Process Date, Settle Date, Instrument, Description,
 *          Trans Code, Quantity, Price, Amount
 *
 * Trans Code meanings:
 *   Buy  → buy order
 *   Sell → sell order
 *   STO  → Sell To Open (option)
 *   STC  → Sell To Close (option)
 *   BTO  → Buy To Open (option)
 *   BTC  → Buy To Close (option)
 *
 * Non-trade rows to skip: CDIV, ACATS, JNLS, MLD, MISC, SPL, DFEE, etc.
 */
export function parseRobinhoodActivity(rows: Record<string, string>[], errors: string[]): ParsedTrade[] {
  // Trans codes that are buys
  const BUY_CODES = new Set(['BUY', 'BTO', 'BTC'])
  // Trans codes that are sells
  const SELL_CODES = new Set(['SELL', 'STO', 'STC'])

  const trades: ParsedTrade[] = []
  rows.forEach((row, i) => {
    try {
      const activityDate = getField(row, ['activity date', 'activity_date'])
      const instrument = getField(row, ['instrument', 'symbol']).toUpperCase()
      const description = getField(row, ['description', 'desc'])
      const transCode = getField(row, ['trans code', 'trans_code', 'transcode', 'code']).toUpperCase().trim()
      const quantityRaw = getField(row, ['quantity', 'qty'])
      const priceRaw = getField(row, ['price'])
      const amountRaw = getField(row, ['amount'])

      // Must have a date and instrument
      if (!activityDate || !instrument) return

      // Determine buy/sell from Trans Code
      let side: 'buy' | 'sell'
      if (BUY_CODES.has(transCode)) {
        side = 'buy'
      } else if (SELL_CODES.has(transCode)) {
        side = 'sell'
      } else {
        // Check description as fallback for ambiguous/abbreviated codes
        const descUp = description.toUpperCase()
        if (descUp.includes('BOUGHT') || descUp.includes('BUY')) {
          side = 'buy'
        } else if (descUp.includes('SOLD') || descUp.includes('SELL')) {
          side = 'sell'
        } else {
          // Skip non-trade rows (dividends, transfers, fees, etc.)
          return
        }
      }

      const quantity = Math.abs(parseNumber(quantityRaw))
      const price = parseNumber(priceRaw.replace('$', ''))
      const amount = Math.abs(parseNumber(amountRaw.replace('$', '')))

      if (quantity === 0 && price === 0) return  // skip empty/non-numeric rows

      // Detect options: Robinhood option symbols are described in the Description field
      // or the Instrument may contain option-like suffixes
      // Detect options: option trans codes are BTO/BTC/STO/STC (3-letter)
      // or if description mentions CALL/PUT
      const isOptionCode = ['BTO', 'BTC', 'STO', 'STC'].includes(transCode)
      const descHasOption = /CALL|PUT/i.test(description)
      const isOption = isOptionCode || descHasOption
      const type = detectTradeType(instrument, isOption ? 'option' : undefined)

      trades.push({
        date: normalizeDate(activityDate),
        symbol: instrument,
        side,
        quantity,
        price: price || (quantity > 0 ? amount / quantity : 0),
        total: amount || quantity * price,
        fees: 0,  // Robinhood is commission-free; amount is already net
        broker: 'Robinhood',
        type,
        notes: description || undefined,
        rawAction: transCode,
      })
    } catch (e) {
      errors.push(`Row ${i + 2}: ${e instanceof Error ? e.message : 'Parse error'}`)
    }
  })
  return trades
}

function parseGenericBroker(rows: Record<string, string>[], errors: string[]): ParsedTrade[] {
  const trades: ParsedTrade[] = []
  rows.forEach((row, i) => {
    try {
      const date = normalizeDate(getField(row, ['date', 'trade date', 'activity date']))
      const symbol = getField(row, ['symbol', 'ticker', 'instrument', 'stock']).toUpperCase()
      const sideRaw = getField(row, ['side', 'action', 'direction', 'buy/sell', 'type'])
      const quantity = Math.abs(parseNumber(getField(row, ['quantity', 'qty', 'shares', 'size'])))
      const price = parseNumber(getField(row, ['price', 'fill price', 'avg price']))
      const feesAmt = Math.abs(parseNumber(getField(row, ['fees', 'commission', 'commissions', 'fee', 'comm'])))
      const amount = Math.abs(parseNumber(getField(row, ['amount', 'total', 'net'])))

      if (!date || !symbol) return
      if (isNonTradeAction(sideRaw)) return

      const sideUp = sideRaw.toUpperCase()
      if (!sideUp.match(/BUY|SELL|LONG|SHORT|BOUGHT|SOLD/)) return
      const side: 'buy' | 'sell' = sideUp.match(/SELL|SHORT|SOLD/) ? 'sell' : 'buy'

      trades.push({
        date, symbol, side, quantity, price,
        total: amount || quantity * price,
        fees: feesAmt,
        broker: 'Unknown',
        type: detectTradeType(symbol),
        rawAction: sideRaw,
      })
    } catch (e) {
      errors.push(`Row ${i + 2}: ${e instanceof Error ? e.message : 'Parse error'}`)
    }
  })
  return trades
}

// ── Main Entry Point ──────────────────────────────────────────────────────────

/**
 * Parse a broker CSV export into a unified trade format.
 * Auto-detects the broker from CSV headers.
 */
export function parseBrokerCSV(csvText: string): ParseResult {
  const errors: string[] = []

  if (!csvText.trim()) {
    return { broker: 'Unknown', trades: [], errors: ['Empty CSV file'] }
  }

  const allLines = csvText.split(/\r?\n/)

  // Find the actual header row — some brokers (e.g. Schwab) prefix CSV with a metadata line.
  // Scan first 5 lines and pick the one that contains recognizable header fields.
  const recognizedHeaders = ['date', 'symbol', 'action', 'quantity', 'price', 'side', 'transaction', 'run date', 'buy/sell', 'activity date', 'trans code', 'instrument']
  let startLine = 0
  for (let i = 0; i < Math.min(5, allLines.length); i++) {
    const line = allLines[i].trim()
    if (!line) continue
    const fields = parseCSVLine(line).map(f => f.toLowerCase().trim())
    const looksLikeHeader = fields.some(f => recognizedHeaders.includes(f))
    if (looksLikeHeader) {
      startLine = i
      break
    }
  }

  const textToParse = allLines.slice(startLine).join('\n')
  const { headers, rows } = parseCSVText(textToParse)

  if (headers.length === 0 || rows.length === 0) {
    return { broker: 'Unknown', trades: [], errors: ['Could not parse CSV — no data found'] }
  }

  const broker = detectBroker(headers, rows[0])
  let trades: ParsedTrade[] = []

  switch (broker) {
    case 'Robinhood':         trades = parseRobinhood(rows, errors);         break
    case 'RobinhoodActivity': trades = parseRobinhoodActivity(rows, errors); break
    case 'Fidelity':     trades = parseFidelity(rows, errors);     break
    case 'Schwab':       trades = parseSchwab(rows, errors);       break
    case 'Webull':       trades = parseWebull(rows, errors);       break
    case 'Tastytrade':   trades = parseTastytrade(rows, errors);   break
    case 'E*TRADE':      trades = parseEtrade(rows, errors);       break
    case 'IBKR':         trades = parseIBKR(rows, errors);         break
    case 'TradeStation': trades = parseTradeStation(rows, errors); break
    default:
      errors.push('Unknown broker format — attempting generic parse.')
      trades = parseGenericBroker(rows, errors)
  }

  if (trades.length === 0 && errors.length === 0) {
    errors.push('No valid trades found. Verify the CSV contains buy/sell transactions.')
  }

  return { broker, trades, errors }
}

// ── Deduplication ─────────────────────────────────────────────────────────────

/**
 * Generate a deterministic fingerprint for a parsed trade.
 * Two trades with the same fingerprint are considered duplicates.
 * Fingerprint is based on: date + symbol + side + quantity + price (rounded to 2dp).
 * This is intentionally loose — same stock/day/quantity/price is a dupe.
 */
export function tradeFingerprint(trade: ParsedTrade): string {
  const price = trade.price.toFixed(2)
  const qty = trade.quantity.toFixed(6)
  return `${trade.date}|${trade.symbol}|${trade.side}|${qty}|${price}`
}

/**
 * Deduplicate a list of parsed trades against an existing set of fingerprints.
 * Returns only the trades that are NOT already in existingFingerprints.
 *
 * Usage:
 *   const existing = new Set(currentTrades.map(t => tradeFingerprint(t)))
 *   const newTrades = deduplicateTrades(parsedTrades, existing)
 */
export function deduplicateTrades(
  incoming: ParsedTrade[],
  existingFingerprints: Set<string>,
): { unique: ParsedTrade[]; duplicateCount: number } {
  const seen = new Set(existingFingerprints)
  const unique: ParsedTrade[] = []
  let duplicateCount = 0

  for (const trade of incoming) {
    const fp = tradeFingerprint(trade)
    if (seen.has(fp)) {
      duplicateCount++
    } else {
      seen.add(fp)
      unique.push(trade)
    }
  }

  return { unique, duplicateCount }
}

// ── Batch Processing ──────────────────────────────────────────────────────────

/**
 * Process a large list of trade inserts in batches to avoid blocking the UI
 * thread and to respect any rate limits on downstream APIs.
 *
 * @param trades         - Full list of trades to insert
 * @param batchSize      - Number of trades per batch (default: 50)
 * @param onBatch        - Called with each batch; can be async (e.g. API call)
 * @param delayBetween   - Milliseconds to wait between batches (default: 0)
 */
export async function batchInsertTrades<T>(
  trades: T[],
  onBatch: (batch: T[], batchIndex: number, total: number) => Promise<void> | void,
  batchSize = 50,
  delayBetween = 0,
): Promise<void> {
  const totalBatches = Math.ceil(trades.length / batchSize)
  for (let i = 0; i < totalBatches; i++) {
    const batch = trades.slice(i * batchSize, (i + 1) * batchSize)
    await onBatch(batch, i, totalBatches)
    if (delayBetween > 0 && i < totalBatches - 1) {
      await new Promise(resolve => setTimeout(resolve, delayBetween))
    }
  }
}
