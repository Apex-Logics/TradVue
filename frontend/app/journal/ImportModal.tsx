'use client'

import { useState, useRef, useMemo } from 'react'
import { IconUpload, IconClose, IconFile } from '../components/Icons'
import { parseBrokerCSV, type ParsedTrade } from '../utils/brokerParsers'

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

type BrokerOverride = 'auto' | 'Robinhood' | 'Fidelity' | 'Schwab' | 'Webull' | 'Tastytrade' | 'E*TRADE' | 'IBKR' | 'TradeStation'

const BROKER_OPTIONS: { value: BrokerOverride; label: string }[] = [
  { value: 'auto',         label: 'Auto-Detect' },
  { value: 'Robinhood',    label: 'Robinhood' },
  { value: 'Fidelity',     label: 'Fidelity' },
  { value: 'Schwab',       label: 'Charles Schwab' },
  { value: 'Webull',       label: 'Webull' },
  { value: 'Tastytrade',   label: 'Tastytrade' },
  { value: 'E*TRADE',      label: 'E*TRADE' },
  { value: 'IBKR',         label: 'Interactive Brokers' },
  { value: 'TradeStation', label: 'TradeStation' },
]

// ─── Trade Pairing Logic ──────────────────────────────────────────────────────
// Converts raw buy/sell events from broker parsers into paired journal entries

function pairTrades(rawTrades: ParsedTrade[]): ImportedTrade[] {
  const bySymbol: Record<string, ParsedTrade[]> = {}
  rawTrades.forEach(t => {
    if (!bySymbol[t.symbol]) bySymbol[t.symbol] = []
    bySymbol[t.symbol].push(t)
  })

  const paired: ImportedTrade[] = []

  for (const [symbol, trades] of Object.entries(bySymbol)) {
    const buys  = trades.filter(t => t.side === 'buy').sort((a, b) => a.date.localeCompare(b.date))
    const sells = trades.filter(t => t.side === 'sell').sort((a, b) => a.date.localeCompare(b.date))

    const minPairs = Math.min(buys.length, sells.length)
    for (let i = 0; i < minPairs; i++) {
      const buy = buys[i], sell = sells[i]
      const qty = Math.min(buy.quantity, sell.quantity) || buy.quantity || sell.quantity
      const totalFees = (buy.fees || 0) + (sell.fees || 0)
      const pnl = (sell.price - buy.price) * qty - totalFees
      const pct = buy.price ? ((sell.price - buy.price) / buy.price) * 100 : 0

      paired.push({
        date: buy.date, time: '',
        symbol,
        assetClass: buy.type === 'option' ? 'Option' : buy.type === 'crypto' ? 'Crypto' : 'Stock',
        direction: 'Long',
        entryPrice: buy.price, exitPrice: sell.price, positionSize: qty,
        stopLoss: 0, takeProfit: 0, commissions: totalFees,
        pnl: Math.round(pnl * 100) / 100,
        rMultiple: 0,
        pctGainLoss: Math.round(pct * 100) / 100,
        holdMinutes: 0,
        setupTag: '', mistakeTag: 'None', rating: 3,
        notes: buy.notes || `Imported from ${buy.broker}`,
      })
    }

    // Unmatched trades (open positions or missing counterpart)
    ;[...buys.slice(minPairs), ...sells.slice(minPairs)].forEach(t => {
      paired.push({
        date: t.date, time: '', symbol,
        assetClass: t.type === 'option' ? 'Option' : t.type === 'crypto' ? 'Crypto' : 'Stock',
        direction: t.side === 'buy' ? 'Long' : 'Short',
        entryPrice: t.price, exitPrice: 0, positionSize: t.quantity,
        stopLoss: 0, takeProfit: 0, commissions: t.fees || 0,
        pnl: 0, rMultiple: 0, pctGainLoss: 0, holdMinutes: 0,
        setupTag: '', mistakeTag: 'None', rating: 3,
        notes: t.notes || `Imported from ${t.broker} (unmatched ${t.side})`,
        _unmatched: true,
      })
    })
  }

  return paired
}

// ─── Modal Component ──────────────────────────────────────────────────────────

export default function ImportModal({ onClose, onImport }: ImportModalProps) {
  const [brokerOverride, setBrokerOverride] = useState<BrokerOverride>('auto')
  const [file, setFile] = useState<File | null>(null)
  const [step, setStep] = useState<'upload' | 'preview' | 'done'>('upload')
  const [error, setError] = useState('')

  // Parse results
  const [detectedBroker, setDetectedBroker] = useState('')
  const [rawTrades, setRawTrades] = useState<ParsedTrade[]>([])
  const [parseErrors, setParseErrors] = useState<string[]>([])

  // Paired trades for final import
  const [pairedTrades, setPairedTrades] = useState<ImportedTrade[]>([])
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set())

  const fileRef = useRef<HTMLInputElement>(null)

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    setError('')
  }

  const handleParse = () => {
    if (!file) { setError('Please select a CSV file'); return }
    setError('')

    const reader = new FileReader()
    reader.onload = () => {
      try {
        const text = reader.result as string
        const result = parseBrokerCSV(text)

        // Apply broker override if user selected one
        const broker = brokerOverride !== 'auto' ? brokerOverride : result.broker

        setDetectedBroker(broker)
        setRawTrades(result.trades)
        setParseErrors(result.errors)

        if (result.trades.length === 0) {
          setError(
            result.errors.length > 0
              ? result.errors[0]
              : 'No valid trades found. Check the CSV format or try selecting your broker manually.'
          )
          return
        }

        // Pair the raw events into journal entries
        const paired = pairTrades(result.trades)
        setPairedTrades(paired)
        setSelectedRows(new Set(paired.map((_, i) => i)))
        setStep('preview')
      } catch (err) {
        setError(`Parse error: ${err instanceof Error ? err.message : 'Unknown error'}`)
      }
    }
    reader.readAsText(file)
  }

  const handleImport = () => {
    const selected = pairedTrades.filter((_, i) => selectedRows.has(i))
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
    if (selectedRows.size === pairedTrades.length) setSelectedRows(new Set())
    else setSelectedRows(new Set(pairedTrades.map((_, i) => i)))
  }

  const fmtDollar = (n: number) => (n >= 0 ? '+$' : '-$') + Math.abs(n).toFixed(2)

  const summaryPnl = useMemo(
    () => pairedTrades.filter((_, i) => selectedRows.has(i)).reduce((s, t) => s + t.pnl, 0),
    [pairedTrades, selectedRows]
  )

  // First 5 raw trades for preview strip
  const previewRaw = rawTrades.slice(0, 5)

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
        zIndex: 1000, backdropFilter: 'blur(4px)',
      }} />

      {/* Modal */}
      <div className="import-modal-container">

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: 'var(--text-0)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <IconUpload size={22} /> Import Trades from CSV
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-2)' }}>
              Upload your broker export — auto-detects Robinhood, Fidelity, Schwab, Webull, Tastytrade, E*TRADE, IBKR, TradeStation
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-2)', padding: 4 }}>
            <IconClose size={20} />
          </button>
        </div>

        {/* ── Step 1: Upload ── */}
        {step === 'upload' && (
          <>
            {/* Broker selector */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8, display: 'block' }}>
                Broker Format
              </label>
              <select
                value={brokerOverride}
                onChange={e => setBrokerOverride(e.target.value as BrokerOverride)}
                style={{
                  width: '100%', boxSizing: 'border-box',
                  background: 'var(--bg-1)', border: '1px solid var(--border)',
                  borderRadius: 8, padding: '10px 14px',
                  color: 'var(--text-0)', fontSize: 13,
                  outline: 'none', cursor: 'pointer',
                }}
              >
                {BROKER_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-2)' }}>
                Leave on Auto-Detect to let TradVue identify the broker from your CSV headers.
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
                padding: '10px 24px',
                color: file ? '#0a0a0c' : 'var(--text-2)',
                fontSize: 13, fontWeight: 700, cursor: file ? 'pointer' : 'not-allowed',
              }}>Parse & Preview →</button>
            </div>
          </>
        )}

        {/* ── Step 2: Preview ── */}
        {step === 'preview' && (
          <>
            {/* Detection badge */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16,
              padding: '12px 16px', background: 'rgba(99,102,241,0.08)',
              borderRadius: 10, border: '1px solid rgba(99,102,241,0.2)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="18" y="3" width="4" height="18" rx="1"/><rect x="10" y="8" width="4" height="13" rx="1"/><rect x="2" y="13" width="4" height="8" rx="1"/>
                </svg>
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-0)' }}>
                  Found {rawTrades.length} trade{rawTrades.length !== 1 ? 's' : ''} from{' '}
                  <span style={{ color: 'var(--accent)' }}>{detectedBroker}</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 2 }}>
                  {pairedTrades.length} journal entries after pairing buy/sell legs
                  {pairedTrades.some(t => t._unmatched) && ' (some unmatched)'}
                </div>
              </div>
            </div>

            {/* Parse errors */}
            {parseErrors.length > 0 && (
              <div style={{
                background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)',
                borderRadius: 8, padding: '10px 14px', marginBottom: 16,
              }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--yellow)', marginBottom: 4 }}>
                  ⚠ {parseErrors.length} row{parseErrors.length !== 1 ? 's' : ''} had issues
                </div>
                {parseErrors.slice(0, 3).map((e, i) => (
                  <div key={i} style={{ fontSize: 11, color: 'var(--text-2)', fontFamily: 'var(--mono)' }}>{e}</div>
                ))}
                {parseErrors.length > 3 && (
                  <div style={{ fontSize: 11, color: 'var(--text-2)' }}>…and {parseErrors.length - 3} more</div>
                )}
              </div>
            )}

            {/* Raw trade preview (first 5) */}
            {previewRaw.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                  Preview — first {previewRaw.length} of {rawTrades.length} raw trade events
                </div>
                <div style={{ borderRadius: 8, border: '1px solid var(--border)', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: 'var(--bg-1)' }}>
                        {['Date', 'Symbol', 'Side', 'Qty', 'Price', 'Total', 'Fees', 'Type'].map(h => (
                          <th key={h} style={{
                            padding: '7px 10px', textAlign: 'left', fontSize: 10, fontWeight: 600,
                            color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.06em',
                            borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap',
                          }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewRaw.map((t, i) => (
                        <tr key={i} style={{ borderBottom: i < previewRaw.length - 1 ? '1px solid var(--border)' : undefined }}>
                          <td style={{ padding: '6px 10px', fontFamily: 'var(--mono)', fontSize: 11 }}>{t.date}</td>
                          <td style={{ padding: '6px 10px', fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--blue)' }}>{t.symbol}</td>
                          <td style={{ padding: '6px 10px', fontWeight: 600, color: t.side === 'buy' ? 'var(--green)' : 'var(--red)', textTransform: 'uppercase' }}>{t.side}</td>
                          <td style={{ padding: '6px 10px', fontFamily: 'var(--mono)' }}>{t.quantity}</td>
                          <td style={{ padding: '6px 10px', fontFamily: 'var(--mono)' }}>${t.price.toFixed(2)}</td>
                          <td style={{ padding: '6px 10px', fontFamily: 'var(--mono)' }}>${t.total.toFixed(2)}</td>
                          <td style={{ padding: '6px 10px', fontFamily: 'var(--mono)' }}>${t.fees.toFixed(2)}</td>
                          <td style={{ padding: '6px 10px', fontSize: 10, color: 'var(--text-2)', textTransform: 'capitalize' }}>{t.type}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {rawTrades.length > 5 && (
                  <div style={{ fontSize: 11, color: 'var(--text-2)', padding: '6px 0', textAlign: 'center' }}>
                    +{rawTrades.length - 5} more trade events not shown
                  </div>
                )}
              </div>
            )}

            {/* Paired trade selection table */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', gap: 16, marginBottom: 8, padding: '10px 14px', background: 'var(--bg-1)', borderRadius: 10, alignItems: 'center' }}>
                <div style={{ fontSize: 12, color: 'var(--text-2)' }}>
                  <strong style={{ color: 'var(--text-0)' }}>{selectedRows.size}</strong> of {pairedTrades.length} journal entries selected
                </div>
                <div style={{ fontSize: 12, fontFamily: 'var(--mono)', color: summaryPnl >= 0 ? 'var(--green)' : 'var(--red)' }}>
                  Net P&L: {fmtDollar(summaryPnl)}
                </div>
                {pairedTrades.some(t => t._unmatched) && (
                  <div style={{ fontSize: 11, color: 'var(--yellow)', marginLeft: 'auto' }}>
                    ⚠ Some trades unmatched
                  </div>
                )}
              </div>

              <div style={{ overflowX: 'auto', maxHeight: '35vh', overflowY: 'auto', borderRadius: 8, border: '1px solid var(--border)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-1)', position: 'sticky', top: 0 }}>
                      <th style={{ padding: '8px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
                        <input type="checkbox" checked={selectedRows.size === pairedTrades.length} onChange={toggleAll} />
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
                    {pairedTrades.map((t, i) => (
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
                          {t._unmatched ? '? Open' : fmtDollar(t.pnl)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => { setStep('upload'); setRawTrades([]); setPairedTrades([]) }} style={{
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

        {/* ── Step 3: Done ── */}
        {step === 'done' && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(34,197,94,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
            </div>
            <h3 style={{ color: 'var(--text-0)', marginBottom: 8 }}>Import Complete!</h3>
            <p style={{ color: 'var(--text-2)', fontSize: 14, marginBottom: 4 }}>
              {selectedRows.size} trades imported from <strong>{detectedBroker}</strong>.
            </p>
            <p style={{ color: 'var(--text-2)', fontSize: 13, marginBottom: 20 }}>
              They&apos;ve been added to your journal.
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
