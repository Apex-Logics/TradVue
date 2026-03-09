'use client'

import { useState, useRef, useMemo } from 'react'
import { IconUpload, IconClose, IconFile } from '../components/Icons'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ImportedTrade {
  date: string
  time: string
  symbol: string
  assetClass: string
  direction: string
  entryPrice: number
  exitPrice: number
  positionSize: number
  stopLoss: number
  takeProfit: number
  commissions: number
  pnl: number
  rMultiple: number
  pctGainLoss: number
  holdMinutes: number
  setupTag: string
  mistakeTag: string
  rating: number
  notes: string
  _unmatched?: boolean
}

interface ImportModalProps {
  onClose: () => void
  onImport: (trades: Record<string, unknown>[]) => void
}

type CSVFormat = 'generic' | 'robinhood' | 'ibkr'

const FORMAT_INFO: Record<CSVFormat, { label: string; desc: string; columns: string }> = {
  generic: {
    label: 'Generic CSV',
    desc: 'Standard format with basic columns',
    columns: 'date, ticker/symbol, side (buy/sell), quantity, price, total, fees',
  },
  robinhood: {
    label: 'Robinhood',
    desc: 'Robinhood account activity export',
    columns: 'Activity Date, Instrument, Description, Trans Code, Quantity, Price, Amount',
  },
  ibkr: {
    label: 'Interactive Brokers',
    desc: 'IB Activity Statement trades section',
    columns: 'Symbol, Date/Time, Quantity, T. Price, Proceeds, Comm/Fee',
  },
}

// ─── Client-side CSV Parser ──────────────────────────────────────────────────

function parseCSVText(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim())
  if (lines.length < 2) return []
  
  // Parse header
  const headers = parseCSVLine(lines[0])
  const rows: Record<string, string>[] = []
  
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i])
    if (values.length === 0) continue
    const row: Record<string, string> = {}
    headers.forEach((h, idx) => { row[h.trim()] = (values[idx] || '').trim() })
    rows.push(row)
  }
  return rows
}

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') { current += '"'; i++; }
      else if (ch === '"') { inQuotes = false; }
      else { current += ch; }
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (ch === ',') { result.push(current); current = ''; }
      else { current += ch; }
    }
  }
  result.push(current)
  return result
}

function normalizeDate(raw: string): string {
  if (!raw) return ''
  const cleaned = raw.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) return cleaned
  const mdy = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (mdy) return `${mdy[3]}-${mdy[1].padStart(2, '0')}-${mdy[2].padStart(2, '0')}`
  const mdy2 = cleaned.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/)
  if (mdy2) return `${mdy2[3]}-${mdy2[1].padStart(2, '0')}-${mdy2[2].padStart(2, '0')}`
  try { const d = new Date(cleaned); if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10) } catch {}
  return cleaned
}

function getField(row: Record<string, string>, candidates: string[]): string {
  for (const c of candidates) {
    const found = Object.keys(row).find(k => k.toLowerCase().includes(c.toLowerCase()))
    if (found && row[found]?.trim()) return row[found].trim()
  }
  return ''
}

function parseNumber(val: string): number {
  return parseFloat(val.replace(/[$,()]/g, (m) => m === '(' ? '-' : m === ')' ? '' : '')) || 0
}

function parseGenericCSV(rows: Record<string, string>[]) {
  const raw: { date: string; symbol: string; side: string; qty: number; price: number; fees: number }[] = []
  for (const row of rows) {
    const date = getField(row, ['date', 'trade_date', 'trade date'])
    const symbol = getField(row, ['ticker', 'symbol', 'stock', 'instrument'])
    const side = getField(row, ['side', 'direction', 'action', 'type', 'buy/sell'])
    const qty = parseNumber(getField(row, ['quantity', 'qty', 'shares', 'size']))
    const price = parseNumber(getField(row, ['price', 'fill_price', 'avg_price']))
    const fees = parseNumber(getField(row, ['fees', 'commission', 'commissions', 'fee']))
    if (!date || !symbol || !side) continue
    raw.push({ date: normalizeDate(date), symbol: symbol.toUpperCase(), side: side.toLowerCase().includes('buy') || side.toLowerCase().includes('long') ? 'buy' : 'sell', qty, price, fees })
  }
  return pairTrades(raw)
}

function parseRobinhoodCSV(rows: Record<string, string>[]) {
  const raw: { date: string; symbol: string; side: string; qty: number; price: number; fees: number }[] = []
  for (const row of rows) {
    const date = getField(row, ['activity date', 'activity'])
    const instrument = getField(row, ['instrument', 'symbol'])
    const transCode = getField(row, ['trans code', 'trans', 'transaction'])
    const desc = getField(row, ['description', 'desc'])
    const qty = Math.abs(parseNumber(getField(row, ['quantity', 'qty'])))
    const price = parseNumber(getField(row, ['price']))
    
    const code = (transCode + ' ' + desc).toUpperCase()
    const isTrade = code.includes('BUY') || code.includes('SELL') || code.includes('STO') || code.includes('STC') || code.includes('BOUGHT') || code.includes('SOLD')
    if (!isTrade || !date || !instrument) continue
    
    const side = code.includes('SELL') || code.includes('STC') || code.includes('SOLD') ? 'sell' : 'buy'
    raw.push({ date: normalizeDate(date), symbol: instrument.toUpperCase(), side, qty, price, fees: 0 })
  }
  return pairTrades(raw)
}

function parseIBKRCSV(rows: Record<string, string>[]) {
  const raw: { date: string; symbol: string; side: string; qty: number; price: number; fees: number }[] = []
  for (const row of rows) {
    const header = getField(row, ['header', 'datadiscriminator'])
    if (header && ['header', 'total', 'subtotal'].includes(header.toLowerCase())) continue
    
    const symbol = getField(row, ['symbol'])
    const dateTime = getField(row, ['date/time', 'datetime', 'tradedate', 'date'])
    const qty = parseNumber(getField(row, ['quantity', 'qty']))
    const price = parseNumber(getField(row, ['t. price', 'trade price', 'price']))
    const comm = Math.abs(parseNumber(getField(row, ['comm/fee', 'commission', 'comm'])))
    
    if (!symbol || !dateTime) continue
    const datePart = dateTime.split(/[, ]/)[0]
    
    raw.push({
      date: normalizeDate(datePart),
      symbol: symbol.toUpperCase().split(' ')[0],
      side: qty >= 0 ? 'buy' : 'sell',
      qty: Math.abs(qty),
      price,
      fees: comm,
    })
  }
  return pairTrades(raw)
}

function pairTrades(rawTrades: { date: string; symbol: string; side: string; qty: number; price: number; fees: number }[]): ImportedTrade[] {
  const bySymbol: Record<string, typeof rawTrades> = {}
  rawTrades.forEach(t => { if (!bySymbol[t.symbol]) bySymbol[t.symbol] = []; bySymbol[t.symbol].push(t) })
  
  const paired: ImportedTrade[] = []
  for (const [symbol, trades] of Object.entries(bySymbol)) {
    const buys = trades.filter(t => t.side === 'buy').sort((a, b) => a.date.localeCompare(b.date))
    const sells = trades.filter(t => t.side === 'sell').sort((a, b) => a.date.localeCompare(b.date))
    
    const minPairs = Math.min(buys.length, sells.length)
    for (let i = 0; i < minPairs; i++) {
      const buy = buys[i], sell = sells[i]
      const qty = Math.min(buy.qty, sell.qty) || buy.qty || sell.qty
      const pnl = (sell.price - buy.price) * qty - (buy.fees + sell.fees)
      const pct = buy.price ? ((sell.price - buy.price) / buy.price) * 100 : 0
      
      paired.push({
        date: buy.date, time: '', symbol, assetClass: 'Stock', direction: 'Long',
        entryPrice: buy.price, exitPrice: sell.price, positionSize: qty,
        stopLoss: 0, takeProfit: 0, commissions: buy.fees + sell.fees,
        pnl: Math.round(pnl * 100) / 100, rMultiple: 0,
        pctGainLoss: Math.round(pct * 100) / 100, holdMinutes: 0,
        setupTag: '', mistakeTag: 'None', rating: 3,
        notes: 'Imported from CSV',
      })
    }
    
    // Unmatched
    ;[...buys.slice(minPairs), ...sells.slice(minPairs)].forEach(t => {
      paired.push({
        date: t.date, time: '', symbol, assetClass: 'Stock',
        direction: t.side === 'buy' ? 'Long' : 'Short',
        entryPrice: t.price, exitPrice: 0, positionSize: t.qty,
        stopLoss: 0, takeProfit: 0, commissions: t.fees,
        pnl: 0, rMultiple: 0, pctGainLoss: 0, holdMinutes: 0,
        setupTag: '', mistakeTag: 'None', rating: 3,
        notes: `Imported from CSV (unmatched ${t.side})`,
        _unmatched: true,
      })
    })
  }
  return paired
}

// ─── Modal Component ─────────────────────────────────────────────────────────

export default function ImportModal({ onClose, onImport }: ImportModalProps) {
  const [format, setFormat] = useState<CSVFormat>('generic')
  const [file, setFile] = useState<File | null>(null)
  const [csvText, setCsvText] = useState('')
  const [step, setStep] = useState<'upload' | 'preview' | 'done'>('upload')
  const [error, setError] = useState('')
  const [parsedTrades, setParsedTrades] = useState<ImportedTrade[]>([])
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set())
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    setError('')
    const reader = new FileReader()
    reader.onload = () => {
      const text = reader.result as string
      setCsvText(text)
    }
    reader.readAsText(f)
  }

  const handleParse = () => {
    if (!csvText) { setError('Please select a CSV file'); return }
    setError('')
    
    try {
      const rows = parseCSVText(csvText)
      if (rows.length === 0) { setError('CSV file is empty or could not be parsed'); return }
      
      let trades: ImportedTrade[]
      switch (format) {
        case 'robinhood': trades = parseRobinhoodCSV(rows); break
        case 'ibkr': trades = parseIBKRCSV(rows); break
        default: trades = parseGenericCSV(rows); break
      }
      
      if (trades.length === 0) {
        setError(`No valid trades found. Detected columns: ${Object.keys(rows[0]).join(', ')}. Try a different format.`)
        return
      }
      
      setParsedTrades(trades)
      setSelectedRows(new Set(trades.map((_, i) => i)))
      setStep('preview')
    } catch (err) {
      setError(`Parse error: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

  const handleImport = () => {
    const selected = parsedTrades.filter((_, i) => selectedRows.has(i))
    onImport(selected as unknown as Record<string, unknown>[])
    setStep('done')
  }

  const toggleRow = (i: number) => {
    setSelectedRows(prev => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i); else next.add(i)
      return next
    })
  }

  const toggleAll = () => {
    if (selectedRows.size === parsedTrades.length) setSelectedRows(new Set())
    else setSelectedRows(new Set(parsedTrades.map((_, i) => i)))
  }

  const fmtDollar = (n: number) => (n >= 0 ? '+$' : '-$') + Math.abs(n).toFixed(2)

  const summaryPnl = useMemo(() => {
    return parsedTrades.filter((_, i) => selectedRows.has(i)).reduce((s, t) => s + t.pnl, 0)
  }, [parsedTrades, selectedRows])

  const inputSx: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box',
    background: 'var(--bg-1)', border: '1px solid var(--border)',
    borderRadius: 8, padding: '10px 14px',
    color: 'var(--text-0)', fontSize: 13, fontFamily: 'var(--mono)',
    outline: 'none',
  }

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
        zIndex: 1000, backdropFilter: 'blur(4px)',
      }} />

      {/* Modal */}
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        background: 'var(--bg-2)', border: '1px solid var(--border)',
        borderRadius: 16, padding: 28, zIndex: 1001,
        width: 'min(90vw, 800px)', maxHeight: '85vh', overflowY: 'auto',
        boxShadow: '0 24px 48px rgba(0,0,0,0.4)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: 'var(--text-0)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <IconUpload size={22} /> Import Trades from CSV
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-2)' }}>
              Upload your broker export to bulk-import trades
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-2)', padding: 4 }}>
            <IconClose size={20} />
          </button>
        </div>

        {/* Step 1: Upload */}
        {step === 'upload' && (
          <>
            {/* Format selector */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8, display: 'block' }}>
                Broker Format
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                {(Object.keys(FORMAT_INFO) as CSVFormat[]).map(f => (
                  <button key={f} onClick={() => setFormat(f)} style={{
                    flex: 1, padding: '12px 16px', borderRadius: 10,
                    border: `2px solid ${format === f ? 'var(--accent)' : 'var(--border)'}`,
                    background: format === f ? 'rgba(99,102,241,0.12)' : 'var(--bg-1)',
                    color: format === f ? 'var(--accent)' : 'var(--text-1)',
                    cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
                  }}>
                    <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2 }}>{FORMAT_INFO[f].label}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-2)' }}>{FORMAT_INFO[f].desc}</div>
                  </button>
                ))}
              </div>
              <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-2)', fontFamily: 'var(--mono)' }}>
                Expected: {FORMAT_INFO[format].columns}
              </div>
            </div>

            {/* File drop zone */}
            <div
              onClick={() => fileRef.current?.click()}
              style={{
                border: '2px dashed var(--border)', borderRadius: 12,
                padding: '40px 20px', textAlign: 'center', cursor: 'pointer',
                background: file ? 'rgba(16,185,129,0.06)' : 'var(--bg-1)',
                transition: 'all 0.15s', marginBottom: 16,
              }}
            >
              <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={handleFile} style={{ display: 'none' }} />
              {file ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <IconFile size={20} style={{ color: 'var(--green)' }} />
                  <span style={{ color: 'var(--text-0)', fontWeight: 600 }}>{file.name}</span>
                  <span style={{ color: 'var(--text-2)', fontSize: 12 }}>({(file.size / 1024).toFixed(1)} KB)</span>
                </div>
              ) : (
                <>
                  <IconUpload size={32} style={{ color: 'var(--text-2)', marginBottom: 8 }} />
                  <div style={{ color: 'var(--text-1)', fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
                    Click to select a CSV file
                  </div>
                  <div style={{ color: 'var(--text-2)', fontSize: 12 }}>
                    or drag and drop here (max 5MB)
                  </div>
                </>
              )}
            </div>

            {error && (
              <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: 'var(--red)' }}>
                {error}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={onClose} style={{
                background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 'var(--btn-radius)',
                padding: '10px 20px', color: 'var(--text-0)', fontSize: 13, cursor: 'pointer',
              }}>Cancel</button>
              <button onClick={handleParse} disabled={!file} style={{
                background: file ? 'var(--accent)' : 'var(--bg-1)',
                border: 'none', borderRadius: 'var(--btn-radius)',
                padding: '10px 24px', color: file ? '#0a0a0c' : 'var(--text-2)',
                fontSize: 13, fontWeight: 700, cursor: file ? 'pointer' : 'not-allowed',
              }}>Parse & Preview →</button>
            </div>
          </>
        )}

        {/* Step 2: Preview */}
        {step === 'preview' && (
          <>
            {/* Summary bar */}
            <div style={{
              display: 'flex', gap: 16, marginBottom: 16, padding: '12px 16px',
              background: 'var(--bg-1)', borderRadius: 10, alignItems: 'center',
            }}>
              <div style={{ fontSize: 12, color: 'var(--text-2)' }}>
                <strong style={{ color: 'var(--text-0)' }}>{selectedRows.size}</strong> of {parsedTrades.length} trades selected
              </div>
              <div style={{ fontSize: 12, fontFamily: 'var(--mono)', color: summaryPnl >= 0 ? 'var(--green)' : 'var(--red)' }}>
                Net P&L: {fmtDollar(summaryPnl)}
              </div>
              {parsedTrades.some(t => t._unmatched) && (
                <div style={{ fontSize: 11, color: 'var(--yellow)', marginLeft: 'auto' }}>
                  ⚠ Some trades are unmatched (missing buy/sell pair)
                </div>
              )}
            </div>

            {/* Trade table */}
            <div style={{ overflowX: 'auto', maxHeight: '50vh', overflowY: 'auto', marginBottom: 16, borderRadius: 8, border: '1px solid var(--border)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: 'var(--bg-1)', position: 'sticky', top: 0 }}>
                    <th style={{ padding: '8px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
                      <input type="checkbox" checked={selectedRows.size === parsedTrades.length} onChange={toggleAll} />
                    </th>
                    {['Date', 'Symbol', 'Dir', 'Entry', 'Exit', 'Size', 'Fees', 'P&L'].map(h => (
                      <th key={h} style={{
                        padding: '8px 10px', textAlign: 'left', fontSize: 10, fontWeight: 600,
                        color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.06em',
                        borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap',
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {parsedTrades.map((t, i) => (
                    <tr key={i} style={{
                      background: t._unmatched ? 'rgba(245,158,11,0.06)' : selectedRows.has(i) ? 'rgba(99,102,241,0.04)' : 'transparent',
                      borderBottom: '1px solid var(--border)',
                    }}>
                      <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                        <input type="checkbox" checked={selectedRows.has(i)} onChange={() => toggleRow(i)} />
                      </td>
                      <td style={{ padding: '6px 10px' }}>{t.date}</td>
                      <td style={{ padding: '6px 10px', fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--blue)' }}>{t.symbol}</td>
                      <td style={{ padding: '6px 10px', color: t.direction === 'Long' ? 'var(--green)' : 'var(--red)' }}>{t.direction}</td>
                      <td style={{ padding: '6px 10px', fontFamily: 'var(--mono)' }}>${t.entryPrice.toFixed(2)}</td>
                      <td style={{ padding: '6px 10px', fontFamily: 'var(--mono)' }}>{t.exitPrice ? `$${t.exitPrice.toFixed(2)}` : '—'}</td>
                      <td style={{ padding: '6px 10px', fontFamily: 'var(--mono)' }}>{t.positionSize}</td>
                      <td style={{ padding: '6px 10px', fontFamily: 'var(--mono)' }}>${t.commissions.toFixed(2)}</td>
                      <td style={{ padding: '6px 10px', fontFamily: 'var(--mono)', fontWeight: 700, color: t.pnl >= 0 ? 'var(--green)' : 'var(--red)' }}>
                        {t._unmatched ? '⚠ Open' : fmtDollar(t.pnl)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setStep('upload')} style={{
                background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 'var(--btn-radius)',
                padding: '10px 20px', color: 'var(--text-0)', fontSize: 13, cursor: 'pointer',
              }}>← Back</button>
              <button onClick={handleImport} disabled={selectedRows.size === 0} style={{
                background: selectedRows.size > 0 ? 'var(--green)' : 'var(--bg-1)',
                border: 'none', borderRadius: 'var(--btn-radius)',
                padding: '10px 24px', color: selectedRows.size > 0 ? '#0a0a0c' : 'var(--text-2)',
                fontSize: 13, fontWeight: 700, cursor: selectedRows.size > 0 ? 'pointer' : 'not-allowed',
              }}>✓ Import {selectedRows.size} Trades</button>
            </div>
          </>
        )}

        {/* Step 3: Done */}
        {step === 'done' && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
            <h3 style={{ color: 'var(--text-0)', marginBottom: 8 }}>Import Complete!</h3>
            <p style={{ color: 'var(--text-2)', fontSize: 14, marginBottom: 20 }}>
              {selectedRows.size} trades imported successfully.
            </p>
            <button onClick={onClose} style={{
              background: 'var(--accent)', border: 'none', borderRadius: 'var(--btn-radius)',
              padding: '10px 28px', color: '#0a0a0c', fontSize: 14, fontWeight: 700, cursor: 'pointer',
            }}>Done</button>
          </div>
        )}
      </div>
    </>
  )
}
