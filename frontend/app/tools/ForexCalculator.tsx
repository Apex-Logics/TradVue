'use client'
import { useState, useMemo, useEffect } from 'react'
import Tooltip from '../components/Tooltip'
import { IconInfo, IconGlobe } from '../components/Icons'

const STORAGE_KEY = 'cg_forex_calc'

// Pair config: { pipSize, quote currency }
const PAIRS: Record<string, { pipSize: number; quote: string; swap: { long: number; short: number } }> = {
  'EUR/USD': { pipSize: 0.0001, quote: 'USD', swap: { long: -0.52, short: 0.14 } },
  'GBP/USD': { pipSize: 0.0001, quote: 'USD', swap: { long: -0.62, short: 0.13 } },
  'USD/JPY': { pipSize: 0.01,   quote: 'JPY', swap: { long: 0.04,  short: -0.64 } },
  'USD/CHF': { pipSize: 0.0001, quote: 'CHF', swap: { long: 0.08,  short: -0.55 } },
  'AUD/USD': { pipSize: 0.0001, quote: 'USD', swap: { long: -0.18, short: -0.26 } },
  'USD/CAD': { pipSize: 0.0001, quote: 'CAD', swap: { long: -0.14, short: -0.21 } },
  'NZD/USD': { pipSize: 0.0001, quote: 'USD', swap: { long: -0.26, short: -0.09 } },
  'EUR/GBP': { pipSize: 0.0001, quote: 'GBP', swap: { long: -0.32, short: 0.03 } },
  'EUR/JPY': { pipSize: 0.01,   quote: 'JPY', swap: { long: -0.12, short: -0.62 } },
  'GBP/JPY': { pipSize: 0.01,   quote: 'JPY', swap: { long: -0.21, short: -0.71 } },
  'EUR/CHF': { pipSize: 0.0001, quote: 'CHF', swap: { long: -0.27, short: -0.38 } },
  'AUD/JPY': { pipSize: 0.01,   quote: 'JPY', swap: { long: 0.02,  short: -0.72 } },
  'USD/MXN': { pipSize: 0.0001, quote: 'MXN', swap: { long: 9.20,  short: -12.40 } },
  'USD/SGD': { pipSize: 0.0001, quote: 'SGD', swap: { long: -0.08, short: -0.42 } },
  'USD/NOK': { pipSize: 0.0001, quote: 'NOK', swap: { long: 0.25,  short: -0.82 } },
  'USD/SEK': { pipSize: 0.0001, quote: 'SEK', swap: { long: -0.14, short: -0.61 } },
  'EUR/AUD': { pipSize: 0.0001, quote: 'AUD', swap: { long: -0.44, short: -0.10 } },
  'EUR/CAD': { pipSize: 0.0001, quote: 'CAD', swap: { long: -0.44, short: -0.10 } },
  'GBP/CHF': { pipSize: 0.0001, quote: 'CHF', swap: { long: -0.29, short: -0.42 } },
  'XAU/USD': { pipSize: 0.01,   quote: 'USD', swap: { long: -2.80, short: 0.60 } },
  'XAG/USD': { pipSize: 0.001,  quote: 'USD', swap: { long: -1.10, short: 0.18 } },
}

const LOT_PRESETS = [
  { label: '0.01', value: '0.01' },
  { label: '0.1', value: '0.1' },
  { label: '0.5', value: '0.5' },
  { label: '1.0', value: '1.0' },
]
const LEVERAGE_OPTIONS = [10, 25, 50, 100, 200, 500]

function InputField({ label, tooltip, value, onChange, placeholder, step = 'any' }: {
  label: string; tooltip: string; value: string; onChange: (v: string) => void; placeholder?: string; step?: string
}) {
  return (
    <div style={{ marginBottom: 10 }}>
      <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-2)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
        {label} <Tooltip text={tooltip} position="right" />
      </label>
      <input type="number" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} step={step}
        style={{ width: '100%', background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 6, padding: '7px 10px', color: 'var(--text-0)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
    </div>
  )
}

function Row({ label, value, color, tip }: { label: string; value: string; color?: string; tip?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ fontSize: 11, color: 'var(--text-2)', display: 'flex', alignItems: 'center', gap: 3 }}>
        {label}{tip && <Tooltip text={tip} position="right" />}
      </span>
      <span style={{ fontSize: 12, fontWeight: 700, fontFamily: 'var(--mono)', color: color || 'var(--text-0)' }}>{value}</span>
    </div>
  )
}

// Approximate exchange rates to USD for non-USD quote pairs
const APPROX_RATES: Record<string, number> = {
  USD: 1, EUR: 1.08, GBP: 1.26, JPY: 0.0066, CHF: 1.12,
  AUD: 0.65, CAD: 0.74, NZD: 0.60, MXN: 0.057, SGD: 0.74,
  NOK: 0.094, SEK: 0.095,
}

export default function ForexCalculator() {
  const [pair, setPair] = useState('EUR/USD')
  const [lotSize, setLotSize] = useState('0.1')
  const [accountSize, setAccountSize] = useState('10000')
  const [entryPrice, setEntryPrice] = useState('1.0850')
  const [stopPips, setStopPips] = useState('20')
  const [tpPips, setTpPips] = useState('40')
  const [leverage, setLeverage] = useState('50')
  const [showSwaps, setShowSwaps] = useState(false)
  const [showHowTo, setShowHowTo] = useState(false)

  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
      if (s.pair) setPair(s.pair)
      if (s.lotSize) setLotSize(s.lotSize)
      if (s.accountSize) setAccountSize(s.accountSize)
      if (s.leverage) setLeverage(s.leverage)
    } catch {}
  }, [])
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ pair, lotSize, accountSize, leverage })) } catch {}
  }, [pair, lotSize, accountSize, leverage])

  const config = PAIRS[pair] || PAIRS['EUR/USD']
  const lotN = parseFloat(lotSize) || 0
  const acctN = parseFloat(accountSize) || 0
  const entryN = parseFloat(entryPrice) || 0
  const stopN = parseFloat(stopPips) || 0
  const tpN = parseFloat(tpPips) || 0
  const leverageN = parseInt(leverage) || 50

  const unitsPerLot = 100000
  const units = lotN * unitsPerLot

  // Pip value in quote currency
  const pipValueQuote = units * config.pipSize

  // Convert to USD
  const quoteToUSD = config.quote === 'USD' ? 1 : (APPROX_RATES[config.quote] || 1)
  const pipValueUSD = pipValueQuote * quoteToUSD

  const positionValue = units * entryN * quoteToUSD
  const marginRequired = leverageN > 0 ? positionValue / leverageN : 0

  const riskUSD = stopN * pipValueUSD
  const rewardUSD = tpN * pipValueUSD
  const rrRatio = riskUSD > 0 ? rewardUSD / riskUSD : 0

  const riskPct = acctN > 0 ? (riskUSD / acctN) * 100 : 0

  const swapLong = config.swap.long * lotN
  const swapShort = config.swap.short * lotN

  const fmt2 = (n: number) => Math.abs(n) >= 1000
    ? `$${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
    : `$${n.toFixed(2)}`

  return (
    <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 'var(--card-radius)', padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(99,102,241,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#818cf8' }}>
            <IconGlobe size={18} />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-0)' }}>Forex Position Calculator</div>
            <div style={{ fontSize: 12, color: 'var(--text-3)' }}>Pip value, margin, risk/reward for 21 pairs</div>
          </div>
        </div>
        <button onClick={() => setShowHowTo(h => !h)} style={{ fontSize: 11, padding: '4px 10px', background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', color: 'var(--text-2)' }}>
          {showHowTo ? 'Hide' : 'How to use'}
        </button>
      </div>

      {showHowTo && (
        <div style={{ background: 'rgba(99,102,241,0.1)', borderRadius: 8, padding: '12px 16px', marginBottom: 16, fontSize: 12, color: 'var(--text-2)', lineHeight: 1.7 }}>
          Select a currency pair, enter your lot size and account balance. Set your stop loss and take profit in pips to see exact dollar risk/reward. JPY pairs use a pip size of 0.01; all others use 0.0001.
        </div>
      )}

      {/* Pair selector */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-2)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
          Currency Pair <Tooltip text="Select the forex pair you want to trade. JPY pairs have a different pip size (0.01 vs 0.0001 for others)." position="right" />
        </label>
        <select value={pair} onChange={e => setPair(e.target.value)}
          style={{ width: '100%', background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 6, padding: '7px 10px', color: 'var(--text-0)', fontSize: 13, outline: 'none' }}>
          {Object.keys(PAIRS).map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <div style={{ marginTop: 4, fontSize: 10, color: 'var(--text-3)' }}>
          Pip size: {config.pipSize} · Quote: {config.quote} · 1 lot = 100,000 units
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20 }}>
        <div>
          {/* Lot size with presets */}
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-2)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              Lot Size <Tooltip text="Standard = 1.0 (100,000 units). Mini = 0.1 (10,000). Micro = 0.01 (1,000)." position="right" />
            </label>
            <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
              {LOT_PRESETS.map(p => (
                <button key={p.value} onClick={() => setLotSize(p.value)}
                  style={{ flex: 1, padding: '5px 2px', borderRadius: 6, border: `1px solid ${lotSize === p.value ? '#818cf8' : 'var(--border)'}`, background: lotSize === p.value ? 'rgba(99,102,241,0.2)' : 'transparent', color: lotSize === p.value ? '#818cf8' : 'var(--text-2)', fontSize: 11, cursor: 'pointer', fontWeight: lotSize === p.value ? 700 : 400 }}>
                  {p.label}
                </button>
              ))}
            </div>
            <input type="number" value={lotSize} onChange={e => setLotSize(e.target.value)} placeholder="Custom lot size" step="0.01"
              style={{ width: '100%', background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 6, padding: '7px 10px', color: 'var(--text-0)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <InputField label="Account Size ($)" tooltip="Your trading account balance in USD." value={accountSize} onChange={setAccountSize} placeholder="10000" />
          <InputField label="Entry Price" tooltip="Your planned entry price for this pair." value={entryPrice} onChange={setEntryPrice} placeholder="1.0850" step="0.0001" />
          <InputField label="Stop Loss (pips)" tooltip="Distance to stop in pips. For EUR/USD, 20 pips = 0.0020." value={stopPips} onChange={setStopPips} placeholder="20" step="1" />
          <InputField label="Take Profit (pips)" tooltip="Distance to take profit in pips." value={tpPips} onChange={setTpPips} placeholder="40" step="1" />

          {/* Leverage */}
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-2)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              Leverage <Tooltip text="Higher leverage = lower margin requirement but more risk per pip relative to account." position="right" />
            </label>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              {LEVERAGE_OPTIONS.map(l => (
                <button key={l} onClick={() => setLeverage(String(l))}
                  style={{ padding: '4px 10px', borderRadius: 6, border: `1px solid ${leverage === String(l) ? '#818cf8' : 'var(--border)'}`, background: leverage === String(l) ? 'rgba(99,102,241,0.2)' : 'transparent', color: leverage === String(l) ? '#818cf8' : 'var(--text-2)', fontSize: 11, cursor: 'pointer', fontWeight: leverage === String(l) ? 700 : 400 }}>
                  {l}:1
                </button>
              ))}
            </div>
          </div>
        </div>

        <div>
          <div style={{ background: 'var(--bg-3)', borderRadius: 8, padding: 16, marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-3)', marginBottom: 10 }}>POSITION DETAILS</div>
            <Row label="Units" value={units.toLocaleString()} tip="Total currency units in this position." />
            <Row label="Pip Value (USD)" value={fmt2(pipValueUSD)} color="var(--accent)" tip="Dollar value of 1 pip movement. This is how much you gain/lose per pip." />
            <Row label="Position Value" value={fmt2(positionValue)} tip="Total notional value of the trade." />
            <Row label="Margin Required" value={fmt2(marginRequired)} color="var(--yellow)" tip={`Required margin at ${leverage}:1 leverage.`} />
          </div>

          <div style={{ background: 'var(--bg-3)', borderRadius: 8, padding: 16, marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-3)', marginBottom: 10 }}>RISK & REWARD</div>
            <Row label="Risk (stop pips)" value={fmt2(riskUSD)} color="var(--red)" tip={`Total loss if stop hit: ${stopPips} pips × ${fmt2(pipValueUSD)}/pip`} />
            <Row label="Reward (TP pips)" value={fmt2(rewardUSD)} color="var(--green)" tip={`Total profit if TP hit: ${tpPips} pips × ${fmt2(pipValueUSD)}/pip`} />
            <Row label="R:R Ratio" value={rrRatio > 0 ? `1 : ${rrRatio.toFixed(2)}` : '—'} color={rrRatio >= 2 ? 'var(--green)' : rrRatio >= 1 ? 'var(--yellow)' : 'var(--red)'} tip="Reward to risk ratio. Aim for 2:1 or better." />
            <Row label="Risk % of Account" value={riskPct > 0 ? `${riskPct.toFixed(2)}%` : '—'} color={riskPct <= 2 ? 'var(--green)' : riskPct <= 5 ? 'var(--yellow)' : 'var(--red)'} tip="What % of your account you're risking. Keep under 2%." />
          </div>

          {/* Margin at different leverages */}
          <div style={{ background: 'var(--bg-3)', borderRadius: 8, padding: 12 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-3)', marginBottom: 8 }}>MARGIN AT DIFFERENT LEVERAGES</div>
            {[50, 100, 200].map(lev => (
              <div key={lev} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ color: 'var(--text-3)' }}>{lev}:1</span>
                <span style={{ fontFamily: 'var(--mono)', color: 'var(--text-1)' }}>{fmt2(positionValue / lev)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Swap rates toggle */}
      <div style={{ marginTop: 12 }}>
        <button onClick={() => setShowSwaps(s => !s)} style={{ fontSize: 11, padding: '5px 12px', background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', color: 'var(--text-2)' }}>
          {showSwaps ? 'Hide' : 'Show'} Swap Rates (Overnight Fees)
        </button>
        {showSwaps && (
          <div style={{ marginTop: 8, background: 'var(--bg-3)', borderRadius: 8, padding: 12, fontSize: 12 }}>
            <div style={{ fontSize: 10, color: 'var(--text-3)', marginBottom: 8 }}>Estimated daily swap for {lotN} lots on {pair}</div>
            <div style={{ display: 'flex', gap: 16 }}>
              <div>
                <span style={{ color: 'var(--text-3)', fontSize: 11 }}>Long (buy): </span>
                <span style={{ fontFamily: 'var(--mono)', color: swapLong >= 0 ? 'var(--green)' : 'var(--red)', fontWeight: 700 }}>
                  {swapLong >= 0 ? '+' : ''}{swapLong.toFixed(2)} USD/day
                </span>
              </div>
              <div>
                <span style={{ color: 'var(--text-3)', fontSize: 11 }}>Short (sell): </span>
                <span style={{ fontFamily: 'var(--mono)', color: swapShort >= 0 ? 'var(--green)' : 'var(--red)', fontWeight: 700 }}>
                  {swapShort >= 0 ? '+' : ''}{swapShort.toFixed(2)} USD/day
                </span>
              </div>
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 6 }}>Approximate rates — check your broker for exact values.</div>
          </div>
        )}
      </div>

      <div style={{ marginTop: 12, fontSize: 11, color: 'var(--text-3)', background: 'rgba(99,102,241,0.1)', borderRadius: 6, padding: '8px 12px' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><IconInfo size={12} />Exchange rates and swap rates are approximations. Your broker may differ. 1 lot = 100,000 units. Always verify with your broker before trading.</span>
      </div>
    </div>
  )
}
