/**
 * Portfolio holdings CSV parse + in-file duplicate ticker handling (Q8).
 *
 * Cost-basis rule when the same ticker appears more than once in one file:
 *   Weighted-average per-share cost.
 *   shares'     = sum(shares_i)
 *   costBasis'  = sum(shares_i * costBasis_i) / shares'
 *   dateAcquired = earliest non-empty date (ISO/string compare)
 *   sector/notes = first non-empty sector; unique notes joined with " | "
 *
 * Rows are never silently dropped. Duplicate groups are returned so the UI can
 * show which CSV rows conflicted. Import always uses the aggregated holding so
 * replace-mode cannot double-count the same ticker.
 */

import { sanitizeCSVField } from './brokerParsers'

export interface ImportedHolding {
  ticker: string
  shares: number
  costBasis: number
  dateAcquired: string
  sector: string
  notes: string
  /** 1-based CSV row number (header is row 1). */
  sourceRow?: number
}

export interface InFileDuplicateGroup {
  ticker: string
  rows: number[]
  lots: ImportedHolding[]
  combined: ImportedHolding
}

export interface ParsePortfolioResult {
  holdings: ImportedHolding[]
  errors: string[]
  format: string
  duplicates: InFileDuplicateGroup[]
}

/** Parse a simple CSV line respecting quoted fields */
export function parseImportCSVLine(line: string): string[] {
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

/** Normalise a column header for flexible matching */
export function normHeader(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9]/g, '')
}

/**
 * Combine lots of the same ticker using weighted-average cost basis.
 * Caller must pass at least one lot; shares are assumed positive.
 */
export function combineLotsWeightedAverage(lots: ImportedHolding[]): ImportedHolding {
  const ticker = lots[0].ticker
  const totalShares = lots.reduce((s, l) => s + l.shares, 0)
  const totalCost = lots.reduce((s, l) => s + l.shares * l.costBasis, 0)
  const costBasis = totalShares > 0 ? totalCost / totalShares : 0

  const dates = lots.map(l => l.dateAcquired).filter(d => d && d.trim())
  const dateAcquired = dates.length > 0
    ? dates.reduce((a, b) => (a < b ? a : b))
    : ''

  const sector = lots.map(l => l.sector).find(s => s && s.trim() && s !== 'Other')
    || lots[0].sector
    || 'Other'

  const notes = [...new Set(lots.map(l => l.notes).filter(n => n && n.trim()))].join(' | ')

  return {
    ticker,
    shares: totalShares,
    costBasis,
    dateAcquired,
    sector,
    notes,
    sourceRow: lots[0].sourceRow,
  }
}

export function findInFileDuplicateGroups(holdings: ImportedHolding[]): InFileDuplicateGroup[] {
  const byTicker = new Map<string, ImportedHolding[]>()
  for (const h of holdings) {
    const list = byTicker.get(h.ticker) || []
    list.push(h)
    byTicker.set(h.ticker, list)
  }
  const groups: InFileDuplicateGroup[] = []
  for (const [ticker, lots] of byTicker) {
    if (lots.length < 2) continue
    groups.push({
      ticker,
      rows: lots.map(l => l.sourceRow ?? 0),
      lots,
      combined: combineLotsWeightedAverage(lots),
    })
  }
  return groups
}

/**
 * Collapse in-file duplicate tickers to one holding each (weighted-average cost).
 * Unique tickers pass through unchanged. Order follows first occurrence.
 */
export function aggregateHoldingsByTicker(holdings: ImportedHolding[]): ImportedHolding[] {
  const seen = new Map<string, ImportedHolding[]>()
  const order: string[] = []
  for (const h of holdings) {
    if (!seen.has(h.ticker)) {
      order.push(h.ticker)
      seen.set(h.ticker, [])
    }
    seen.get(h.ticker)!.push(h)
  }
  return order.map(ticker => {
    const lots = seen.get(ticker)!
    return lots.length === 1 ? lots[0] : combineLotsWeightedAverage(lots)
  })
}

/** Parse portfolio holdings CSV — supports Generic and Schwab/Fidelity position export formats */
export function parsePortfolioCSV(text: string): ParsePortfolioResult {
  const errors: string[] = []
  const holdings: ImportedHolding[] = []

  const lines = text.split(/\r?\n/).filter(l => l.trim())
  if (lines.length < 2) {
    return { holdings, errors: ['CSV has no data rows'], format: 'unknown', duplicates: [] }
  }

  const rawHeaders = parseImportCSVLine(lines[0]).map(h => sanitizeCSVField(h.trim()))
  const headers = rawHeaders.map(normHeader)

  // Detect format
  // Schwab positions: "Symbol","Description","Quantity","Price","Price Change %","Price Change $","Market Value","Day Change %","Day Change $","Cost Basis","Gain/Loss %","Gain/Loss $","Ratings","Reinvest Dividends?","Capital Gains?","% Of Account","Security Type"
  // Fidelity positions: "Symbol","Description","Quantity","Last Price","Last Price Change","Current Value","Today's Gain/Loss Dollar","Today's Gain/Loss Percent","Total Gain/Loss Dollar","Total Gain/Loss Percent","Percent Of Account","Cost Basis Total","Average Cost Basis","Type"
  const isSchwab = headers.includes('costbasis') && headers.includes('securitytype')
  const isFidelity = headers.includes('averagecostbasis') && headers.includes('costbasistotal')
  let format = 'generic'
  if (isSchwab) format = 'schwab'
  else if (isFidelity) format = 'fidelity'

  const colIdx = (candidates: string[]): number => {
    for (const c of candidates) {
      const idx = headers.indexOf(c)
      if (idx !== -1) return idx
    }
    return -1
  }

  let symbolIdx: number, sharesIdx: number, costIdx: number, dateIdx: number, sectorIdx: number, notesIdx: number

  if (format === 'schwab') {
    symbolIdx  = colIdx(['symbol'])
    sharesIdx  = colIdx(['quantity'])
    costIdx    = colIdx(['costbasis'])
    dateIdx    = -1
    sectorIdx  = colIdx(['securitytype'])
    notesIdx   = colIdx(['description'])
  } else if (format === 'fidelity') {
    symbolIdx  = colIdx(['symbol'])
    sharesIdx  = colIdx(['quantity'])
    costIdx    = colIdx(['averagecostbasis'])
    dateIdx    = -1
    sectorIdx  = colIdx(['type'])
    notesIdx   = colIdx(['description'])
  } else {
    symbolIdx  = colIdx(['symbol', 'ticker'])
    sharesIdx  = colIdx(['shares', 'quantity', 'qty'])
    costIdx    = colIdx(['costbasis', 'avgprice', 'averagecost', 'avgcost', 'cost'])
    dateIdx    = colIdx(['dateacquired', 'buydate', 'purchasedate', 'date'])
    sectorIdx  = colIdx(['sector', 'industry', 'category'])
    notesIdx   = colIdx(['notes', 'memo', 'description'])
  }

  if (symbolIdx === -1 || sharesIdx === -1 || costIdx === -1) {
    return {
      holdings,
      errors: ['Could not find required columns (Symbol, Shares, CostBasis). Check your CSV format.'],
      format,
      duplicates: [],
    }
  }

  for (let i = 1; i < lines.length; i++) {
    const raw = parseImportCSVLine(lines[i])
    if (raw.every(v => !v.trim())) continue
    const get = (idx: number) => sanitizeCSVField((raw[idx] ?? '').trim())

    const ticker = get(symbolIdx).toUpperCase()
    if (!ticker || ticker === 'TOTAL' || ticker === 'ACCOUNT TOTAL') continue

    const sharesStr = get(sharesIdx).replace(/[,$\s]/g, '').replace(/^\(([^)]+)\)$/, '-$1')
    const shares = parseFloat(sharesStr)
    if (isNaN(shares) || shares <= 0) {
      errors.push(`Row ${i + 1}: Invalid shares for ${ticker || 'unknown'} (${get(sharesIdx)})`)
      continue
    }

    const costStr = get(costIdx).replace(/[,$\s]/g, '').replace(/^\(([^)]+)\)$/, '-$1')
    let costBasis = parseFloat(costStr)
    if (isNaN(costBasis) || costBasis <= 0) {
      errors.push(`Row ${i + 1}: Invalid cost basis for ${ticker} (${get(costIdx)})`)
      continue
    }

    // Schwab exports total cost basis — convert to per-share
    if (format === 'schwab') {
      costBasis = costBasis / shares
    }

    const dateAcquired = dateIdx !== -1 ? get(dateIdx) : ''
    const sector = sectorIdx !== -1 ? get(sectorIdx) : 'Other'
    const notes = notesIdx !== -1 ? get(notesIdx) : ''

    holdings.push({ ticker, shares, costBasis, dateAcquired, sector, notes, sourceRow: i + 1 })
  }

  return { holdings, errors, format, duplicates: findInFileDuplicateGroups(holdings) }
}
