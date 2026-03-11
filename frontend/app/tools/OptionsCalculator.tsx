'use client'
import { useState, useMemo, useEffect } from 'react'
import Tooltip from '../components/Tooltip'
import { IconCheck, IconAlert, IconInfo } from '../components/Icons'

interface IconProps { size?: number; style?: React.CSSProperties }

const sw = '1.8'; const sl = 'round'
function IconOptions({ size = 20, style }: IconProps) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap={sl} strokeLinejoin={sl} style={style}><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>
}

const STORAGE_KEY = 'cg_options_calc'

function InputField({ label, tooltip, value, onChange, placeholder, step = 'any', type = 'number' }: {
  label: string; tooltip: string; value: string; onChange: (v: string) => void; placeholder?: string; step?: string; type?: string
}) {
  return (
    <div style={{ marginBottom: 10 }}>
      <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-2)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
        {label} <Tooltip text={tooltip} position="right" />
      </label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} step={step}
        style={{ width: '100%', background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 6, padding: '7px 10px', color: 'var(--text-0)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
    </div>
  )
}

function ResultRow({ label, value, color, tooltip }: { label: string; value: string; color?: string; tooltip?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ fontSize: 12, color: 'var(--text-2)', display: 'flex', alignItems: 'center', gap: 4 }}>
        {label}{tooltip && <Tooltip text={tooltip} position="right" />}
      </span>
      <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'var(--mono)', color: color || 'var(--text-0)' }}>{value}</span>
    </div>
  )
}

// Black-Scholes greeks for optional display
function normCDF(x: number) {
  const a1=0.254829592,a2=-0.284496736,a3=1.421413741,a4=-1.453152027,a5=1.061405429,p=0.3275911
  const sign = x < 0 ? -1 : 1; x = Math.abs(x) / Math.sqrt(2)
  const t = 1.0 / (1.0 + p * x)
  const y = 1.0 - (((((a5*t+a4)*t)+a3)*t+a2)*t+a1)*t*Math.exp(-x*x)
  return 0.5 * (1.0 + sign * y)
}
function normPDF(x: number) { return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI) }
function bs(S: number, K: number, T: number, r: number, v: number, type: 'call' | 'put') {
  if (T <= 0 || v <= 0 || S <= 0 || K <= 0) return { price: 0, delta: 0, gamma: 0, theta: 0, vega: 0 }
  const sqrtT = Math.sqrt(T)
  const d1 = (Math.log(S / K) + (r + 0.5 * v * v) * T) / (v * sqrtT)
  const d2 = d1 - v * sqrtT
  const price = type === 'call'
    ? S * normCDF(d1) - K * Math.exp(-r * T) * normCDF(d2)
    : K * Math.exp(-r * T) * normCDF(-d2) - S * normCDF(-d1)
  const delta = type === 'call' ? normCDF(d1) : normCDF(d1) - 1
  const gamma = normPDF(d1) / (S * v * sqrtT)
  const theta = (type === 'call'
    ? -(S * normPDF(d1) * v) / (2 * sqrtT) - r * K * Math.exp(-r * T) * normCDF(d2)
    : -(S * normPDF(d1) * v) / (2 * sqrtT) + r * K * Math.exp(-r * T) * normCDF(-d2)) / 365
  const vega = S * normPDF(d1) * sqrtT / 100
  return { price, delta, gamma, theta, vega }
}

export default function OptionsCalculator() {
  const [type, setType] = useState<'call' | 'put'>('call')
  const [stockPrice, setStockPrice] = useState('150')
  const [strike, setStrike] = useState('155')
  const [premium, setPremium] = useState('3.50')
  const [contracts, setContracts] = useState('1')
  const [expiry, setExpiry] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 30)
    return d.toISOString().slice(0, 10)
  })
  const [iv, setIv] = useState('30')
  const [showGreeks, setShowGreeks] = useState(false)
  const [showHowTo, setShowHowTo] = useState(false)

  const S = parseFloat(stockPrice) || 0
  const K = parseFloat(strike) || 0
  const prem = parseFloat(premium) || 0
  const qty = parseInt(contracts) || 1
  const ivN = parseFloat(iv) / 100

  const daysToExpiry = useMemo(() => {
    const today = new Date()
    const exp = new Date(expiry)
    return Math.max(0, Math.round((exp.getTime() - today.getTime()) / 86400000))
  }, [expiry])

  const T = daysToExpiry / 365

  // Core calculations
  const costBasis = prem * qty * 100
  const breakEven = type === 'call' ? K + prem : K - prem
  const maxLoss = costBasis
  const maxProfit = type === 'call' ? Infinity : K - prem > 0 ? (K - prem) * qty * 100 : 0

  // P&L at various prices
  const pnlTable = useMemo(() => {
    if (!S || !K || !prem) return []
    const pcts = [-0.20, -0.10, -0.05, 0, 0.05, 0.10, 0.20]
    return pcts.map(pct => {
      const price = S * (1 + pct)
      const intrinsic = type === 'call' ? Math.max(0, price - K) : Math.max(0, K - price)
      const pnl = (intrinsic - prem) * qty * 100
      return { pct, price, intrinsic, pnl }
    })
  }, [S, K, prem, qty, type])

  // Chart data: price range from S*0.7 to S*1.3
  const chartPoints = useMemo(() => {
    if (!S || !K || !prem) return []
    const n = 60
    return Array.from({ length: n + 1 }, (_, i) => {
      const price = S * 0.7 + (S * 0.6 * i / n)
      const intrinsic = type === 'call' ? Math.max(0, price - K) : Math.max(0, K - price)
      const pnl = (intrinsic - prem) * qty * 100
      return { price, pnl }
    })
  }, [S, K, prem, qty, type])

  const greeks = useMemo(() => bs(S, K, T, 0.05, ivN, type), [S, K, T, ivN, type])

  const chartMin = Math.min(...chartPoints.map(p => p.pnl), -costBasis * 1.1)
  const chartMax = Math.max(...chartPoints.map(p => p.pnl), costBasis * 2)
  const chartRange = chartMax - chartMin

  const toY = (v: number) => 150 - ((v - chartMin) / (chartRange || 1)) * 140
  const toX = (price: number) => ((price - S * 0.7) / (S * 0.6)) * 560

  const zeroY = toY(0)
  const svgPoints = chartPoints.map(p => `${toX(p.price).toFixed(1)},${toY(p.pnl).toFixed(1)}`).join(' ')
  const breakEvenX = toX(breakEven)

  // Save/restore
  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
      if (s.type) setType(s.type)
      if (s.stockPrice) setStockPrice(s.stockPrice)
      if (s.strike) setStrike(s.strike)
      if (s.premium) setPremium(s.premium)
      if (s.contracts) setContracts(s.contracts)
      if (s.iv) setIv(s.iv)
    } catch {}
  }, [])

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ type, stockPrice, strike, premium, contracts, iv })) } catch {}
  }, [type, stockPrice, strike, premium, contracts, iv])

  const fmtD = (n: number) => `${n >= 0 ? '+' : ''}$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  return (
    <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 'var(--card-radius)', padding: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--accent-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)' }}>
            <IconOptions size={18} />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-0)' }}>Options Profit Calculator</div>
            <div style={{ fontSize: 12, color: 'var(--text-3)' }}>P&L chart, break-even, range scenarios, Greeks</div>
          </div>
        </div>
        <button onClick={() => setShowHowTo(h => !h)} style={{ fontSize: 11, padding: '4px 10px', background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', color: 'var(--text-2)' }}>
          {showHowTo ? 'Hide' : 'How to use'}
        </button>
      </div>

      {showHowTo && (
        <div style={{ background: 'var(--accent-dim)', borderRadius: 8, padding: '12px 16px', marginBottom: 16, fontSize: 12, color: 'var(--text-2)', lineHeight: 1.7 }}>
          <strong style={{ color: 'var(--text-0)' }}>How to use:</strong> Enter the option details from your broker. The chart shows profit/loss across a range of stock prices at expiration. The break-even is where the position starts making money. Use the P&L table to see outcomes at specific price levels.
        </div>
      )}

      {/* Call/Put toggle */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {(['call', 'put'] as const).map(t => (
          <button key={t} onClick={() => setType(t)} style={{ flex: 1, padding: '8px 0', borderRadius: 8, border: `1px solid ${type === t ? (t === 'call' ? 'var(--green)' : 'var(--red)') : 'var(--border)'}`, background: type === t ? (t === 'call' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)') : 'transparent', color: type === t ? (t === 'call' ? 'var(--green)' : 'var(--red)') : 'var(--text-2)', fontSize: 13, fontWeight: 700, cursor: 'pointer', textTransform: 'capitalize' }}>
            {t === 'call' ? '↑ Call' : '↓ Put'}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Inputs */}
        <div>
          <InputField label="Current Stock Price" tooltip="The current market price of the underlying stock." value={stockPrice} onChange={setStockPrice} placeholder="e.g. 150.00" />
          <InputField label="Strike Price" tooltip="The price at which you have the right to buy (call) or sell (put) the stock." value={strike} onChange={setStrike} placeholder="e.g. 155.00" />
          <InputField label="Premium Paid (per share)" tooltip="The price you paid for the option. 1 contract = 100 shares, so $3.50 premium = $350 total." value={premium} onChange={setPremium} placeholder="e.g. 3.50" />
          <InputField label="Number of Contracts" tooltip="1 contract controls 100 shares. More contracts = bigger position and bigger P&L." value={contracts} onChange={setContracts} placeholder="e.g. 1" step="1" />
          <InputField label="Expiry Date" tooltip="The date the option expires. After this date, the option is worthless unless exercised." value={expiry} onChange={setExpiry} type="date" />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <button onClick={() => setShowGreeks(g => !g)} style={{ fontSize: 11, padding: '4px 10px', background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', color: 'var(--text-2)' }}>
              {showGreeks ? 'Hide Greeks' : 'Show Greeks (advanced)'}
            </button>
          </div>
          {showGreeks && (
            <InputField label="Implied Volatility %" tooltip="The market's expectation of future volatility. Higher IV = more expensive options. Found on your broker's options chain." value={iv} onChange={setIv} placeholder="e.g. 30" />
          )}
        </div>

        {/* Results */}
        <div>
          <div style={{ background: 'var(--bg-3)', borderRadius: 8, padding: 16, marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-3)', marginBottom: 10 }}>SUMMARY</div>
            <ResultRow label="Total Cost" value={`$${costBasis.toFixed(2)}`} tooltip="Total premium paid (premium × contracts × 100)." />
            <ResultRow label="Break-Even at Expiry" value={`$${breakEven.toFixed(2)}`} color="var(--yellow)" tooltip={`Stock must be ${type === 'call' ? 'above' : 'below'} this price at expiration to profit.`} />
            <ResultRow label="Max Loss" value={`-$${maxLoss.toFixed(2)}`} color="var(--red)" tooltip="Maximum you can lose is the premium paid." />
            <ResultRow label={type === 'call' ? 'Max Profit' : 'Max Profit (put)'} value={type === 'call' ? 'Unlimited' : `$${maxProfit.toFixed(2)}`} color="var(--green)" tooltip={type === 'call' ? 'Calls have unlimited upside — the stock can go to infinity.' : 'Max profit if stock goes to $0.'} />
            <ResultRow label="Days to Expiry" value={`${daysToExpiry}d`} tooltip="Calendar days remaining until expiration." />
          </div>

          {showGreeks && ivN > 0 && (
            <div style={{ background: 'var(--bg-3)', borderRadius: 8, padding: 16, marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-3)', marginBottom: 10 }}>GREEKS</div>
              <ResultRow label="Theoretical Price" value={`$${greeks.price.toFixed(2)}`} color="var(--accent)" tooltip="Black-Scholes theoretical fair value. Compare to actual premium." />
              <ResultRow label="Delta (Δ)" value={greeks.delta.toFixed(4)} tooltip="Option price change per $1 move in stock. 0.5 = 50¢ gain per $1 stock gain." />
              <ResultRow label="Gamma (Γ)" value={greeks.gamma.toFixed(4)} tooltip="Rate of delta change. High gamma near expiry = delta changes fast." />
              <ResultRow label="Theta (Θ)" value={`${greeks.theta.toFixed(4)}/day`} color="var(--red)" tooltip="Daily time decay. You lose this much value each day the stock doesn't move." />
              <ResultRow label="Vega (V)" value={`${greeks.vega.toFixed(4)} per 1% IV`} tooltip="Value change per 1% change in implied volatility." />
            </div>
          )}
        </div>
      </div>

      {/* SVG P&L Chart */}
      {chartPoints.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', marginBottom: 8, letterSpacing: '0.06em' }}>P&L AT EXPIRATION</div>
          <div style={{ background: 'var(--bg-3)', borderRadius: 8, padding: 12, overflowX: 'auto' }}>
            <svg viewBox="0 0 580 160" width="100%" height="160" style={{ display: 'block' }}>
              {/* Zero line */}
              <line x1="10" y1={zeroY} x2="570" y2={zeroY} stroke="var(--border)" strokeWidth="1" strokeDasharray="4,3" />
              {/* Profit/loss fill */}
              <defs>
                <linearGradient id="optGainFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#22c55e" stopOpacity="0.25"/><stop offset="100%" stopColor="#22c55e" stopOpacity="0"/></linearGradient>
                <linearGradient id="optLossFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ef4444" stopOpacity="0"/><stop offset="100%" stopColor="#ef4444" stopOpacity="0.25"/></linearGradient>
              </defs>
              {/* P&L line */}
              <polyline points={svgPoints} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinejoin="round" />
              {/* Break-even marker */}
              {breakEvenX > 10 && breakEvenX < 570 && (
                <>
                  <line x1={breakEvenX} y1="10" x2={breakEvenX} y2="150" stroke="var(--yellow)" strokeWidth="1.5" strokeDasharray="4,3" />
                  <text x={breakEvenX + 4} y="22" fontSize="9" fill="var(--yellow)">BE ${breakEven.toFixed(0)}</text>
                </>
              )}
              {/* Strike marker */}
              {(() => {
                const sx = toX(K)
                return sx > 10 && sx < 570 ? (
                  <>
                    <line x1={sx} y1="10" x2={sx} y2="150" stroke="var(--text-3)" strokeWidth="1" strokeDasharray="2,3" />
                    <text x={sx + 4} y="35" fontSize="9" fill="var(--text-3)">K ${K}</text>
                  </>
                ) : null
              })()}
              {/* Labels */}
              <text x="10" y="155" fontSize="9" fill="var(--text-3)">${(S * 0.7).toFixed(0)}</text>
              <text x="550" y="155" fontSize="9" fill="var(--text-3)" textAnchor="end">${(S * 1.3).toFixed(0)}</text>
              <text x="10" y="18" fontSize="9" fill="var(--green)">+${(chartMax / 100).toFixed(0)}/sh</text>
              <text x="10" y={zeroY - 4} fontSize="9" fill="var(--text-3)">$0</text>
            </svg>
          </div>
        </div>
      )}

      {/* P&L Table */}
      {pnlTable.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', marginBottom: 8, letterSpacing: '0.06em' }}>P&L SCENARIOS AT EXPIRY</div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: 'var(--bg-3)' }}>
                  {['Move', 'Stock Price', 'Intrinsic Value', 'Total P&L', 'Return'].map(h => (
                    <th key={h} style={{ padding: '7px 10px', textAlign: 'left', color: 'var(--text-2)', fontWeight: 600, fontSize: 11 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pnlTable.map(({ pct, price, intrinsic, pnl }) => (
                  <tr key={pct} style={{ borderBottom: '1px solid var(--border)', background: Math.abs(pct) === 0 ? 'var(--bg-3)' : undefined }}>
                    <td style={{ padding: '7px 10px', fontFamily: 'var(--mono)', color: pct < 0 ? 'var(--red)' : pct > 0 ? 'var(--green)' : 'var(--text-2)', fontWeight: 700 }}>
                      {pct === 0 ? 'Now' : `${pct > 0 ? '+' : ''}${(pct * 100).toFixed(0)}%`}
                    </td>
                    <td style={{ padding: '7px 10px', fontFamily: 'var(--mono)' }}>${price.toFixed(2)}</td>
                    <td style={{ padding: '7px 10px', fontFamily: 'var(--mono)' }}>${intrinsic.toFixed(2)}</td>
                    <td style={{ padding: '7px 10px', fontFamily: 'var(--mono)', color: pnl >= 0 ? 'var(--green)' : 'var(--red)', fontWeight: 700 }}>
                      {fmtD(pnl)}
                    </td>
                    <td style={{ padding: '7px 10px', fontFamily: 'var(--mono)', color: pnl >= 0 ? 'var(--green)' : 'var(--red)' }}>
                      {costBasis > 0 ? `${pnl >= 0 ? '+' : ''}${(pnl / costBasis * 100).toFixed(1)}%` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div style={{ marginTop: 12, fontSize: 11, color: 'var(--text-3)', background: 'var(--accent-dim)', borderRadius: 6, padding: '8px 12px' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><IconInfo size={12} />P&L calculated at expiration. Early exit may differ due to time value and implied volatility. 1 contract = 100 shares.</span>
      </div>
    </div>
  )
}
