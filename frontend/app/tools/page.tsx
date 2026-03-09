'use client'

import { useState } from 'react'
import Tooltip from '../components/Tooltip'

// ─── Reusable UI Primitives ──────────────────────────────────────────────────

function InputField({ label, tooltip, value, onChange, placeholder, type = 'number', min, step }: {
  label: string; tooltip?: string; value: string | number; onChange: (v: string) => void;
  placeholder?: string; type?: string; min?: string; step?: string
}) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: 'var(--text-2)', marginBottom: 4, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
        {label}
        {tooltip && <Tooltip text={tooltip} position="right" />}
      </label>
      <input
        type={type}
        value={value}
        min={min}
        step={step || 'any'}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%', boxSizing: 'border-box',
          background: 'var(--bg-1)', border: '1px solid var(--border)',
          borderRadius: 6, padding: '8px 10px',
          color: 'var(--text-0)', fontSize: 13, fontFamily: 'var(--mono)',
          outline: 'none',
        }}
      />
    </div>
  )
}

function SelectField({ label, tooltip, value, onChange, options }: {
  label: string; tooltip?: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[]
}) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: 'var(--text-2)', marginBottom: 4, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
        {label}
        {tooltip && <Tooltip text={tooltip} position="right" />}
      </label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          width: '100%', boxSizing: 'border-box',
          background: 'var(--bg-1)', border: '1px solid var(--border)',
          borderRadius: 6, padding: '8px 10px',
          color: 'var(--text-0)', fontSize: 13,
          outline: 'none', cursor: 'pointer',
        }}
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}

function ResultRow({ label, value, color, tooltip }: { label: string; value: string; color?: string; tooltip?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ fontSize: 12, color: 'var(--text-2)', display: 'flex', alignItems: 'center', gap: 4 }}>
        {label}
        {tooltip && <Tooltip text={tooltip} position="right" />}
      </span>
      <span style={{ fontSize: 14, fontWeight: 700, fontFamily: 'var(--mono)', color: color || 'var(--text-0)' }}>{value}</span>
    </div>
  )
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 10, padding: 20, ...style }}>
      {children}
    </div>
  )
}

function SectionTitle({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <span style={{ fontSize: 22 }}>{icon}</span>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--text-0)' }}>{title}</h2>
      </div>
      <p style={{ margin: 0, fontSize: 12, color: 'var(--text-3)', lineHeight: 1.5 }}>{desc}</p>
    </div>
  )
}

const fmt = (n: number, decimals = 2) => isNaN(n) || !isFinite(n) ? '—' : n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
const fmtDollar = (n: number) => isNaN(n) || !isFinite(n) ? '—' : '$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// ─── 1. Position Size Calculator ─────────────────────────────────────────────

function PositionSizeCalc() {
  const [balance, setBalance] = useState('25000')
  const [riskPct, setRiskPct] = useState('2')
  const [entry, setEntry] = useState('150')
  const [stop, setStop] = useState('145')

  const balanceN = parseFloat(balance) || 0
  const riskPctN = parseFloat(riskPct) || 0
  const entryN = parseFloat(entry) || 0
  const stopN = parseFloat(stop) || 0

  const dollarRisk = balanceN * (riskPctN / 100)
  const riskPerShare = Math.abs(entryN - stopN)
  const shares = riskPerShare > 0 ? Math.floor(dollarRisk / riskPerShare) : 0
  const positionSize = shares * entryN

  return (
    <Card>
      <SectionTitle
        icon="📐"
        title="Position Size Calculator"
        desc="Determine how many shares to buy based on how much you're willing to risk on a trade. Never risk more than 1–2% of your account on any single trade."
      />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div>
          <InputField label="Account Balance" tooltip="Total value of your trading account. This is the base for calculating how much to risk." value={balance} onChange={setBalance} placeholder="e.g. 25000" />
          <InputField label="Risk % Per Trade" tooltip="What % of your account you're willing to lose if this trade goes wrong. Most professional traders risk 1–2% max per trade." value={riskPct} onChange={setRiskPct} placeholder="e.g. 2" min="0" step="0.1" />
          <InputField label="Entry Price" tooltip="The price at which you plan to buy the stock." value={entry} onChange={setEntry} placeholder="e.g. 150.00" />
          <InputField label="Stop Loss Price" tooltip="The price at which you'll exit the trade if it moves against you. This limits your maximum loss on this trade." value={stop} onChange={setStop} placeholder="e.g. 145.00" />
        </div>
        <div>
          <div style={{ background: 'var(--bg-3)', borderRadius: 8, padding: 16, height: '100%', boxSizing: 'border-box' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', marginBottom: 12, letterSpacing: '0.06em' }}>RESULTS</div>
            <ResultRow label="Dollar Risk" value={fmtDollar(dollarRisk)} color="var(--red)" tooltip="Maximum dollar amount you'll lose if stop loss is hit." />
            <ResultRow label="Risk Per Share" value={fmtDollar(riskPerShare)} tooltip="Difference between your entry and stop loss price — what you lose per share." />
            <ResultRow label="Shares to Buy" value={shares > 0 ? shares.toLocaleString() : '—'} color="var(--green)" tooltip="Number of shares you should buy to keep risk at your target percentage." />
            <ResultRow label="Position Size" value={positionSize > 0 ? fmtDollar(positionSize) : '—'} tooltip="Total dollar value of your position (shares × entry price)." />
            <ResultRow label="% of Account" value={balanceN > 0 && positionSize > 0 ? fmt(positionSize / balanceN * 100) + '%' : '—'} tooltip="What percentage of your total account is tied up in this position." />
          </div>
        </div>
      </div>
      <div style={{ marginTop: 12, fontSize: 11, color: 'var(--text-3)', background: 'rgba(99,102,241,0.08)', borderRadius: 6, padding: '8px 12px' }}>
        💡 Example: Account $25,000 | Risk 2% | Entry $150 | Stop $145 → Buy <strong>100 shares</strong> ($500 at risk)
      </div>
    </Card>
  )
}

// ─── 2. Risk/Reward Calculator ────────────────────────────────────────────────

function RiskRewardCalc() {
  const [entry, setEntry] = useState('100')
  const [stop, setStop] = useState('95')
  const [target, setTarget] = useState('115')

  const entryN = parseFloat(entry) || 0
  const stopN = parseFloat(stop) || 0
  const targetN = parseFloat(target) || 0

  const risk = Math.abs(entryN - stopN)
  const reward = Math.abs(targetN - entryN)
  const ratio = risk > 0 ? reward / risk : 0
  const winRateNeeded = ratio > 0 ? 1 / (1 + ratio) * 100 : 0

  const riskWidth = ratio > 0 ? Math.min(50, (1 / (1 + ratio)) * 100) : 50
  const rewardWidth = 100 - riskWidth

  return (
    <Card>
      <SectionTitle
        icon="⚖️"
        title="Risk/Reward Calculator"
        desc="Calculate the ratio between potential profit and potential loss. A good trade has at least a 1:2 risk/reward — meaning you risk $1 to make $2."
      />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div>
          <InputField label="Entry Price" tooltip="Price you buy the asset." value={entry} onChange={setEntry} placeholder="e.g. 100.00" />
          <InputField label="Stop Loss Price" tooltip="Price at which you exit to limit losses. Set this BEFORE entering a trade." value={stop} onChange={setStop} placeholder="e.g. 95.00" />
          <InputField label="Take Profit Price" tooltip="Price at which you exit to lock in gains. Your reward target." value={target} onChange={setTarget} placeholder="e.g. 115.00" />
        </div>
        <div>
          <div style={{ background: 'var(--bg-3)', borderRadius: 8, padding: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', marginBottom: 12, letterSpacing: '0.06em' }}>RESULTS</div>
            <ResultRow label="$ Risk (per share)" value={risk > 0 ? fmtDollar(risk) : '—'} color="var(--red)" tooltip="How much you lose per share if stop loss is hit." />
            <ResultRow label="$ Reward (per share)" value={reward > 0 ? fmtDollar(reward) : '—'} color="var(--green)" tooltip="How much you gain per share if take profit is hit." />
            <div style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 12, color: 'var(--text-2)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  Risk/Reward Ratio
                  <Tooltip text="A 1:3 risk/reward means you risk $1 to potentially make $3. Most traders aim for at least 1:2." position="right" />
                </span>
                <span style={{ fontSize: 16, fontWeight: 700, fontFamily: 'var(--mono)', color: ratio >= 2 ? 'var(--green)' : ratio >= 1 ? 'var(--yellow)' : 'var(--red)' }}>
                  1 : {fmt(ratio)}
                </span>
              </div>
              {/* Visual bar */}
              <div style={{ height: 8, borderRadius: 4, overflow: 'hidden', display: 'flex' }}>
                <div style={{ width: `${riskWidth}%`, background: 'var(--red)', opacity: 0.8 }} />
                <div style={{ width: `${rewardWidth}%`, background: 'var(--green)', opacity: 0.8 }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--text-3)', marginTop: 3 }}>
                <span>RISK</span><span>REWARD</span>
              </div>
            </div>
            <ResultRow label="Min Win Rate to Profit" value={winRateNeeded > 0 ? fmt(winRateNeeded) + '%' : '—'} tooltip="You need to win this % of trades just to break even with this setup. Lower is better." color="var(--yellow)" />
          </div>
          <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-3)' }}>
            {ratio >= 2 ? '✅ Great setup — reward outweighs risk' : ratio >= 1 ? '⚠️ Acceptable — consider a better target' : '❌ Poor setup — risk exceeds reward'}
          </div>
        </div>
      </div>
    </Card>
  )
}

// ─── 3. Options P&L Calculator ───────────────────────────────────────────────

function OptionsPLCalc() {
  const [optionType, setOptionType] = useState('call')
  const [strike, setStrike] = useState('150')
  const [premium, setPremium] = useState('3.50')
  const [currentPrice, setCurrentPrice] = useState('155')
  const [contracts, setContracts] = useState('1')

  const strikeN = parseFloat(strike) || 0
  const premiumN = parseFloat(premium) || 0
  const currentN = parseFloat(currentPrice) || 0
  const contractsN = parseInt(contracts) || 0
  const multiplier = contractsN * 100

  const breakEven = optionType === 'call' ? strikeN + premiumN : strikeN - premiumN
  const maxLoss = premiumN * multiplier
  const intrinsicValue = optionType === 'call'
    ? Math.max(0, currentN - strikeN)
    : Math.max(0, strikeN - currentN)
  const pnlPerShare = intrinsicValue - premiumN
  const totalPnl = pnlPerShare * multiplier

  // Chart data points
  const low = Math.min(strikeN, currentN) * 0.85
  const high = Math.max(strikeN, currentN) * 1.15
  const points = Array.from({ length: 20 }, (_, i) => {
    const price = low + (high - low) * (i / 19)
    const iv = optionType === 'call' ? Math.max(0, price - strikeN) : Math.max(0, strikeN - price)
    const pnl = (iv - premiumN) * multiplier
    return { price, pnl }
  })
  const maxPnl = Math.max(...points.map(p => p.pnl))
  const minPnl = Math.min(...points.map(p => p.pnl))
  const range = maxPnl - minPnl || 1
  const chartH = 80

  return (
    <Card>
      <SectionTitle
        icon="📊"
        title="Options Profit/Loss Calculator"
        desc="Calculate your potential profit or loss on an options trade. Options give you the right (but not the obligation) to buy or sell a stock at a specific price."
      />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div>
          <SelectField label="Option Type" tooltip="A CALL option profits when stock price goes UP. A PUT option profits when stock price goes DOWN." value={optionType} onChange={setOptionType} options={[{ value: 'call', label: 'Call (Bullish — bet price rises)' }, { value: 'put', label: 'Put (Bearish — bet price falls)' }]} />
          <InputField label="Strike Price" tooltip="The price at which you have the right to buy (call) or sell (put) the stock. The key price level the option is based on." value={strike} onChange={setStrike} placeholder="e.g. 150.00" />
          <InputField label="Premium Paid (per share)" tooltip="The cost of the option per share. Since each contract is 100 shares, multiply by 100 for total cost. This is your maximum loss on a long option." value={premium} onChange={setPremium} placeholder="e.g. 3.50" step="0.01" />
          <InputField label="Current Stock Price" tooltip="What the stock is trading at right now (or your target price at expiration)." value={currentPrice} onChange={setCurrentPrice} placeholder="e.g. 155.00" />
          <InputField label="Number of Contracts" tooltip="Each contract controls 100 shares. 1 contract = 100 shares, 5 contracts = 500 shares." value={contracts} onChange={setContracts} placeholder="e.g. 1" min="1" step="1" />
        </div>
        <div>
          <div style={{ background: 'var(--bg-3)', borderRadius: 8, padding: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', marginBottom: 12, letterSpacing: '0.06em' }}>RESULTS</div>
            <ResultRow label="Break-Even Price" value={fmtDollar(breakEven)} tooltip="The stock price at expiration where you neither profit nor lose. For calls: strike + premium. For puts: strike - premium." />
            <ResultRow label="Max Loss" value={`-${fmtDollar(maxLoss)}`} color="var(--red)" tooltip="The most you can lose — your total premium paid. Options can expire worthless!" />
            <ResultRow label="Intrinsic Value" value={fmtDollar(intrinsicValue * multiplier)} tooltip="The real, tangible value of the option right now — how much 'in the money' it is." />
            <ResultRow label="P&L at Current Price" value={(totalPnl >= 0 ? '+' : '') + fmtDollar(totalPnl)} color={totalPnl >= 0 ? 'var(--green)' : 'var(--red)'} tooltip="Your current profit or loss based on intrinsic value at expiration." />
          </div>
          {/* P&L Chart */}
          <div style={{ background: 'var(--bg-3)', borderRadius: 8, padding: 12, marginTop: 8 }}>
            <div style={{ fontSize: 10, color: 'var(--text-3)', marginBottom: 6 }}>P&L AT EXPIRATION</div>
            <svg width="100%" height={chartH} viewBox={`0 0 200 ${chartH}`} preserveAspectRatio="none">
              <line x1="0" y1={chartH * (maxPnl / range)} x2="200" y2={chartH * (maxPnl / range)} stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
              <polyline
                points={points.map((p, i) => `${i * (200 / 19)},${chartH - ((p.pnl - minPnl) / range) * chartH}`).join(' ')}
                fill="none"
                stroke="#6366f1"
                strokeWidth="2"
              />
              {/* Zero line */}
              <line x1="0" y1={chartH - ((-minPnl) / range) * chartH} x2="200" y2={chartH - ((-minPnl) / range) * chartH} stroke="rgba(255,255,255,0.3)" strokeWidth="1" strokeDasharray="4,2" />
            </svg>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--text-3)', marginTop: 2 }}>
              <span>${low.toFixed(0)}</span><span>Stock Price</span><span>${high.toFixed(0)}</span>
            </div>
          </div>
        </div>
      </div>
    </Card>
  )
}

// ─── 4. Options Greeks Calculator (Black-Scholes) ─────────────────────────────

function blackScholes(S: number, K: number, T: number, r: number, v: number, type: 'call' | 'put') {
  if (T <= 0 || v <= 0 || S <= 0 || K <= 0) return { price: 0, delta: 0, gamma: 0, theta: 0, vega: 0 }
  const sqrtT = Math.sqrt(T)
  const d1 = (Math.log(S / K) + (r + (v * v) / 2) * T) / (v * sqrtT)
  const d2 = d1 - v * sqrtT
  const nd1 = normalCDF(type === 'call' ? d1 : -d1)
  const nd2 = normalCDF(type === 'call' ? d2 : -d2)
  const phi = normalPDF(d1)

  const price = type === 'call'
    ? S * nd1 - K * Math.exp(-r * T) * nd2
    : K * Math.exp(-r * T) * normalCDF(-d2) - S * normalCDF(-d1)

  const delta = type === 'call' ? nd1 : nd1 - 1
  const gamma = phi / (S * v * sqrtT)
  const theta = type === 'call'
    ? (-(S * phi * v) / (2 * sqrtT) - r * K * Math.exp(-r * T) * nd2) / 365
    : (-(S * phi * v) / (2 * sqrtT) + r * K * Math.exp(-r * T) * normalCDF(-d2)) / 365
  const vega = S * phi * sqrtT / 100

  return { price, delta, gamma, theta, vega }
}

function normalCDF(x: number): number {
  const a1=0.254829592, a2=-0.284496736, a3=1.421413741, a4=-1.453152027, a5=1.061405429, p=0.3275911
  const sign = x < 0 ? -1 : 1
  const absX = Math.abs(x)
  const t = 1 / (1 + p * absX)
  const y = 1 - (((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t) * Math.exp(-absX * absX)
  return 0.5 * (1 + sign * y)
}

function normalPDF(x: number): number {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI)
}

function OptionsGreeksCalc() {
  const [stockPrice, setStockPrice] = useState('150')
  const [strike, setStrike] = useState('155')
  const [dte, setDte] = useState('30')
  const [vol, setVol] = useState('25')
  const [rfRate, setRfRate] = useState('5')
  const [optionType, setOptionType] = useState<'call' | 'put'>('call')

  const S = parseFloat(stockPrice) || 0
  const K = parseFloat(strike) || 0
  const T = (parseFloat(dte) || 0) / 365
  const r = (parseFloat(rfRate) || 0) / 100
  const v = (parseFloat(vol) || 0) / 100

  const greeks = blackScholes(S, K, T, r, v, optionType)

  return (
    <Card>
      <SectionTitle
        icon="🔢"
        title="Options Greeks Calculator"
        desc="Calculate the sensitivity metrics (Greeks) of an options contract using the Black-Scholes model. Greeks help you understand how an option's price will change."
      />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div>
          <SelectField label="Option Type" tooltip="Call options profit when stock goes up. Put options profit when stock goes down." value={optionType} onChange={v => setOptionType(v as 'call' | 'put')} options={[{ value: 'call', label: 'Call Option' }, { value: 'put', label: 'Put Option' }]} />
          <InputField label="Stock Price (S)" tooltip="Current market price of the underlying stock." value={stockPrice} onChange={setStockPrice} placeholder="e.g. 150.00" />
          <InputField label="Strike Price (K)" tooltip="The price at which the option can be exercised." value={strike} onChange={setStrike} placeholder="e.g. 155.00" />
          <InputField label="Days to Expiration" tooltip="How many calendar days until the option expires. Longer = more time value." value={dte} onChange={setDte} placeholder="e.g. 30" min="1" step="1" />
          <InputField label="Implied Volatility %" tooltip="The market's expectation of future price movement. Higher IV = more expensive options. Check your broker or sites like Market Chameleon for IV data." value={vol} onChange={setVol} placeholder="e.g. 25" step="0.1" />
          <InputField label="Risk-Free Rate %" tooltip="Typically the current US Treasury rate (~4-5%). Rarely changes the result significantly." value={rfRate} onChange={setRfRate} placeholder="e.g. 5" step="0.1" />
        </div>
        <div>
          <div style={{ background: 'var(--bg-3)', borderRadius: 8, padding: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', marginBottom: 12, letterSpacing: '0.06em' }}>BLACK-SCHOLES OUTPUT</div>
            <ResultRow label="Option Price" value={greeks.price > 0 ? fmtDollar(greeks.price) : '—'} color="var(--green)" tooltip="Theoretical fair value of this option based on Black-Scholes model." />
            <ResultRow label="Delta (Δ)" value={fmt(greeks.delta, 4)} color="var(--accent)" tooltip="How much the option price moves per $1 move in the stock. Call delta is 0 to 1; Put delta is -1 to 0. At-the-money options have ~0.5 delta." />
            <ResultRow label="Gamma (Γ)" value={fmt(greeks.gamma, 4)} tooltip="How fast Delta changes per $1 move in the stock. High gamma = delta changes quickly. Gamma is highest near expiration for at-the-money options." />
            <ResultRow label="Theta (Θ)" value={`${fmt(greeks.theta, 4)}/day`} color="var(--red)" tooltip="Time decay — how much value the option loses each day. Options lose value as expiration approaches. Negative for buyers, positive for sellers." />
            <ResultRow label="Vega (V)" value={`${fmt(greeks.vega, 4)} per 1% IV`} tooltip="How much the option price changes per 1% change in implied volatility. High vega means the option is very sensitive to volatility changes." />
          </div>
          <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-3)', background: 'rgba(99,102,241,0.08)', borderRadius: 6, padding: '8px 12px' }}>
            💡 Black-Scholes assumes constant volatility and European-style exercise. Real prices may differ.
          </div>
        </div>
      </div>
    </Card>
  )
}

// ─── 5. Pip Calculator (Forex) ────────────────────────────────────────────────

const FOREX_PAIRS: Record<string, { quote: string; pipSize: number; pipValue: number }> = {
  'EUR/USD': { quote: 'USD', pipSize: 0.0001, pipValue: 10 },
  'GBP/USD': { quote: 'USD', pipSize: 0.0001, pipValue: 10 },
  'AUD/USD': { quote: 'USD', pipSize: 0.0001, pipValue: 10 },
  'NZD/USD': { quote: 'USD', pipSize: 0.0001, pipValue: 10 },
  'USD/CAD': { quote: 'CAD', pipSize: 0.0001, pipValue: 10 },
  'USD/CHF': { quote: 'CHF', pipSize: 0.0001, pipValue: 10 },
  'USD/JPY': { quote: 'JPY', pipSize: 0.01, pipValue: 1000 },
  'EUR/JPY': { quote: 'JPY', pipSize: 0.01, pipValue: 1000 },
  'GBP/JPY': { quote: 'JPY', pipSize: 0.01, pipValue: 1000 },
  'EUR/GBP': { quote: 'GBP', pipSize: 0.0001, pipValue: 10 },
}

function PipCalc() {
  const [pair, setPair] = useState('EUR/USD')
  const [lotSize, setLotSize] = useState('1')
  const [pips, setPips] = useState('10')

  const pairInfo = FOREX_PAIRS[pair]
  const lotN = parseFloat(lotSize) || 0
  const pipsN = parseFloat(pips) || 0

  // Standard lot = 100,000 units; pip value per standard lot (USD pairs) = $10
  const pipValuePerLot = pairInfo.pipValue
  const totalPipValue = pipValuePerLot * lotN * pipsN

  const lotTypes = [
    { name: 'Standard (1.0)', value: 1 },
    { name: 'Mini (0.1)', value: 0.1 },
    { name: 'Micro (0.01)', value: 0.01 },
  ]

  return (
    <Card>
      <SectionTitle
        icon="💱"
        title="Pip Calculator (Forex)"
        desc="Calculate the value of a pip for any forex pair and lot size. A pip is the smallest standard price move in currency trading — usually 0.0001 for most pairs."
      />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div>
          <SelectField label="Currency Pair" tooltip="The two currencies you're trading. EUR/USD means you're buying Euros and selling US Dollars (or vice versa)." value={pair} onChange={setPair} options={Object.keys(FOREX_PAIRS).map(k => ({ value: k, label: k }))} />
          <InputField label="Lot Size" tooltip="Standard lot = 100,000 units ($10/pip). Mini lot = 10,000 units ($1/pip). Micro lot = 1,000 units ($0.10/pip). Beginners often start with micro lots." value={lotSize} onChange={setLotSize} placeholder="e.g. 1" step="0.01" min="0.01" />
          <InputField label="Number of Pips" tooltip="How many pips you want to calculate the value for. E.g., if your stop loss is 20 pips away, enter 20." value={pips} onChange={setPips} placeholder="e.g. 10" min="0" />
        </div>
        <div>
          <div style={{ background: 'var(--bg-3)', borderRadius: 8, padding: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', marginBottom: 12, letterSpacing: '0.06em' }}>RESULTS</div>
            <ResultRow label="Pip Size" value={pairInfo.pipSize.toString()} tooltip="The decimal value of 1 pip for this pair. Most pairs: 0.0001. JPY pairs: 0.01." />
            <ResultRow label="Pip Value (1 std lot)" value={`${pairInfo.quote === 'USD' ? '$' : ''}${pipValuePerLot} ${pairInfo.quote}/pip`} tooltip="Dollar value of each pip for 1 standard lot (100,000 units)." />
            <ResultRow label="Your Pip Value" value={`$${fmt(pipValuePerLot * lotN)}/pip`} color="var(--accent)" tooltip="Pip value for your specific lot size." />
            <ResultRow label={`Total (${pipsN} pips)`} value={`$${fmt(totalPipValue)}`} color="var(--green)" tooltip="Total dollar value for your specified number of pips." />
          </div>
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 10, color: 'var(--text-3)', marginBottom: 6, fontWeight: 600 }}>LOT SIZE REFERENCE</div>
            {lotTypes.map(lt => (
              <div key={lt.name} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ color: 'var(--text-2)' }}>{lt.name}</span>
                <span style={{ fontFamily: 'var(--mono)', color: 'var(--text-1)' }}>${fmt(pipValuePerLot * lt.value)}/pip</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div style={{ marginTop: 12, fontSize: 11, color: 'var(--text-3)', background: 'rgba(99,102,241,0.08)', borderRadius: 6, padding: '8px 12px' }}>
        💡 A pip is 0.0001 for EUR/USD. If EUR/USD moves from 1.1000 to 1.1010, that&apos;s 10 pips. With 1 standard lot, that&apos;s $100 profit or loss.
      </div>
    </Card>
  )
}

// ─── 6. Lot Size Calculator (Forex) ──────────────────────────────────────────

function LotSizeCalc() {
  const [balance, setBalance] = useState('10000')
  const [riskPct, setRiskPct] = useState('1')
  const [stopPips, setStopPips] = useState('20')
  const [pair, setPair] = useState('EUR/USD')

  const balanceN = parseFloat(balance) || 0
  const riskPctN = parseFloat(riskPct) || 0
  const stopPipsN = parseFloat(stopPips) || 0

  const pairInfo = FOREX_PAIRS[pair]
  const dollarRisk = balanceN * (riskPctN / 100)
  const pipValuePerStdLot = pairInfo.pipValue
  const totalPipCost = pipValuePerStdLot * stopPipsN
  const stdLots = totalPipCost > 0 ? dollarRisk / totalPipCost : 0
  const miniLots = stdLots * 10
  const microLots = stdLots * 100

  return (
    <Card>
      <SectionTitle
        icon="📦"
        title="Lot Size Calculator (Forex)"
        desc="Calculate the correct lot size for your trade based on your account size and risk tolerance. Always know your lot size BEFORE entering a trade."
      />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div>
          <SelectField label="Currency Pair" tooltip="The forex pair you're trading." value={pair} onChange={setPair} options={Object.keys(FOREX_PAIRS).map(k => ({ value: k, label: k }))} />
          <InputField label="Account Balance" tooltip="Total value of your forex trading account in USD." value={balance} onChange={setBalance} placeholder="e.g. 10000" />
          <InputField label="Risk % Per Trade" tooltip="What percentage of your account you're willing to lose if stop loss hits. Most forex traders risk 0.5%–2% per trade." value={riskPct} onChange={setRiskPct} placeholder="e.g. 1" step="0.1" min="0" />
          <InputField label="Stop Loss (pips)" tooltip="How many pips away your stop loss is from your entry price. Tighter stops allow larger lot sizes for the same $ risk." value={stopPips} onChange={setStopPips} placeholder="e.g. 20" min="1" step="1" />
        </div>
        <div>
          <div style={{ background: 'var(--bg-3)', borderRadius: 8, padding: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', marginBottom: 12, letterSpacing: '0.06em' }}>RESULTS</div>
            <ResultRow label="Dollar Risk" value={fmtDollar(dollarRisk)} color="var(--red)" tooltip="Maximum dollar amount you'll lose if stop loss is hit." />
            <ResultRow label="Standard Lots" value={fmt(stdLots, 2)} color="var(--green)" tooltip="Standard lot = 100,000 units. Most brokers require large account for standard lots." />
            <ResultRow label="Mini Lots" value={fmt(miniLots, 2)} color="var(--accent)" tooltip="Mini lot = 10,000 units. 1/10th of a standard lot. Good for medium accounts." />
            <ResultRow label="Micro Lots" value={fmt(microLots, 1)} tooltip="Micro lot = 1,000 units. 1/100th of a standard lot. Best for beginners and small accounts." />
          </div>
          <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-3)', background: 'rgba(99,102,241,0.08)', borderRadius: 6, padding: '8px 12px' }}>
            💡 Standard = 100,000 units | Mini = 10,000 | Micro = 1,000. Start with micro lots while learning.
          </div>
        </div>
      </div>
    </Card>
  )
}

// ─── 7. Compound Interest Calculator ─────────────────────────────────────────

function CompoundCalc() {
  const [initial, setInitial] = useState('10000')
  const [monthly, setMonthly] = useState('500')
  const [annualReturn, setAnnualReturn] = useState('8')
  const [years, setYears] = useState('20')

  const initialN = parseFloat(initial) || 0
  const monthlyN = parseFloat(monthly) || 0
  const rateN = (parseFloat(annualReturn) || 0) / 100
  const yearsN = parseInt(years) || 0
  const monthlyRate = rateN / 12
  const months = yearsN * 12

  // FV = PV*(1+r)^n + PMT * ((1+r)^n - 1) / r
  const fvInitial = initialN * Math.pow(1 + monthlyRate, months)
  const fvContributions = monthlyN > 0 && monthlyRate > 0
    ? monthlyN * (Math.pow(1 + monthlyRate, months) - 1) / monthlyRate
    : monthlyN * months
  const finalValue = fvInitial + fvContributions
  const totalContributions = initialN + monthlyN * months
  const totalInterest = finalValue - totalContributions

  // Generate yearly data for mini chart
  const chartData = Array.from({ length: Math.min(yearsN, 40) + 1 }, (_, yr) => {
    const m = yr * 12
    const fvI = initialN * Math.pow(1 + monthlyRate, m)
    const fvC = monthlyN > 0 && monthlyRate > 0
      ? monthlyN * (Math.pow(1 + monthlyRate, m) - 1) / monthlyRate
      : monthlyN * m
    return { year: yr, value: fvI + fvC }
  })
  const maxVal = chartData[chartData.length - 1]?.value || 1

  return (
    <Card>
      <SectionTitle
        icon="📈"
        title="Compound Interest Calculator"
        desc="See how your money grows over time with compound interest — 'the eighth wonder of the world'. The earlier you start, the more powerful it becomes."
      />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div>
          <InputField label="Initial Investment" tooltip="The lump sum you're starting with. Even starting small is better than waiting." value={initial} onChange={setInitial} placeholder="e.g. 10000" />
          <InputField label="Monthly Contribution" tooltip="How much you add every month. Consistent contributions dramatically accelerate growth over time." value={monthly} onChange={setMonthly} placeholder="e.g. 500" />
          <InputField label="Annual Return %" tooltip="Expected yearly return rate. S&P 500 historical average is ~10% (7% inflation-adjusted). Be conservative with your estimates." value={annualReturn} onChange={setAnnualReturn} placeholder="e.g. 8" step="0.1" />
          <InputField label="Time Period (Years)" tooltip="How many years you'll let the money compound. The longer, the better — time is your biggest advantage." value={years} onChange={setYears} placeholder="e.g. 20" min="1" step="1" />
        </div>
        <div>
          <div style={{ background: 'var(--bg-3)', borderRadius: 8, padding: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', marginBottom: 12, letterSpacing: '0.06em' }}>RESULTS</div>
            <ResultRow label="Final Value" value={`$${fmt(finalValue, 0)}`} color="var(--green)" tooltip="What your money will be worth at the end of the period." />
            <ResultRow label="Total Contributions" value={`$${fmt(totalContributions, 0)}`} tooltip="How much money you actually put in (initial + all monthly contributions)." />
            <ResultRow label="Interest Earned" value={`$${fmt(totalInterest, 0)}`} color="var(--accent)" tooltip="Money earned purely from compound growth — this is the magic of compounding!" />
            <ResultRow label="Return Multiple" value={`${fmt(finalValue / (totalContributions || 1), 1)}×`} color="var(--yellow)" tooltip="How many times bigger your money got compared to what you put in." />
          </div>
          {/* Growth chart */}
          <div style={{ background: 'var(--bg-3)', borderRadius: 8, padding: 12, marginTop: 8 }}>
            <div style={{ fontSize: 10, color: 'var(--text-3)', marginBottom: 6 }}>GROWTH OVER TIME</div>
            <svg width="100%" height="80" viewBox="0 0 200 80" preserveAspectRatio="none">
              <defs>
                <linearGradient id="compGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6366f1" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
                </linearGradient>
              </defs>
              <polygon
                points={[
                  '0,80',
                  ...chartData.map((d, i) => `${i * (200 / (chartData.length - 1 || 1))},${80 - (d.value / maxVal) * 76}`),
                  '200,80'
                ].join(' ')}
                fill="url(#compGrad)"
              />
              <polyline
                points={chartData.map((d, i) => `${i * (200 / (chartData.length - 1 || 1))},${80 - (d.value / maxVal) * 76}`).join(' ')}
                fill="none" stroke="#6366f1" strokeWidth="2"
              />
            </svg>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--text-3)', marginTop: 2 }}>
              <span>Year 0</span><span>Year {yearsN}</span>
            </div>
          </div>
        </div>
      </div>
    </Card>
  )
}

// ─── 8. Fibonacci Retracement Calculator ─────────────────────────────────────

const FIB_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1]
const FIB_COLORS: Record<string, string> = {
  '0%': 'var(--text-3)',
  '23.6%': '#10b981',
  '38.2%': '#3b82f6',
  '50%': '#f59e0b',
  '61.8%': '#ef4444',
  '78.6%': '#8b5cf6',
  '100%': 'var(--text-3)',
}

function FibonacciCalc() {
  const [high, setHigh] = useState('200')
  const [low, setLow] = useState('150')
  const [direction, setDirection] = useState('up')

  const highN = parseFloat(high) || 0
  const lowN = parseFloat(low) || 0
  const range = Math.abs(highN - lowN)

  const levels = FIB_LEVELS.map(pct => {
    const price = direction === 'up'
      ? highN - range * pct
      : lowN + range * pct
    const label = (pct * 100).toFixed(1).replace('.0', '') + '%'
    return { pct, label, price }
  })

  return (
    <Card>
      <SectionTitle
        icon="🌀"
        title="Fibonacci Retracement Calculator"
        desc="Calculate key Fibonacci levels — mathematical ratios that often act as support and resistance areas where price may pause or reverse. Used by technical traders worldwide."
      />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div>
          <InputField label="Swing High Price" tooltip="The highest price in the recent move or swing. This is the top of the range you're measuring." value={high} onChange={setHigh} placeholder="e.g. 200.00" />
          <InputField label="Swing Low Price" tooltip="The lowest price in the recent move or swing. This is the bottom of the range you're measuring." value={low} onChange={setLow} placeholder="e.g. 150.00" />
          <SelectField label="Trend Direction" tooltip="Uptrend: price moved UP and may pull back to these levels. Downtrend: price moved DOWN and may bounce to these levels." value={direction} onChange={setDirection} options={[{ value: 'up', label: '⬆️ Uptrend (retracing down from high)' }, { value: 'down', label: '⬇️ Downtrend (bouncing up from low)' }]} />
          <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-3)', background: 'rgba(99,102,241,0.08)', borderRadius: 6, padding: '8px 12px' }}>
            💡 The 61.8% level (Golden Ratio) is considered the most significant. Price often respects the 38.2% and 61.8% levels strongly.
          </div>
        </div>
        <div>
          <div style={{ background: 'var(--bg-3)', borderRadius: 8, padding: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', marginBottom: 12, letterSpacing: '0.06em' }}>FIBONACCI LEVELS</div>
            {levels.map(({ label, price, pct }) => {
              const barWidth = direction === 'up' ? (1 - pct) * 100 : pct * 100
              return (
                <div key={label} style={{ marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                    <span style={{ fontSize: 11, color: FIB_COLORS[label] || 'var(--text-2)', fontWeight: label === '61.8%' ? 700 : 400, display: 'flex', alignItems: 'center', gap: 4 }}>
                      {label === '61.8%' ? '⭐ ' : ''}{label}
                      {label === '61.8%' && <Tooltip text="The Golden Ratio — the most important Fibonacci level. Derived from nature's mathematical constant φ (phi). Traders watch this level very closely." position="right" />}
                      {label === '38.2%' && <Tooltip text="Often the first strong support/resistance. A common retracement level in healthy trends." position="right" />}
                      {label === '50%' && <Tooltip text="Not technically a Fibonacci number, but widely watched as a psychological mid-point. Strong markets often bounce here." position="right" />}
                    </span>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 700, color: FIB_COLORS[label] || 'var(--text-1)' }}>
                      ${isNaN(price) ? '—' : fmt(price)}
                    </span>
                  </div>
                  <div style={{ height: 4, background: 'var(--bg-2)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ width: `${barWidth}%`, height: '100%', background: FIB_COLORS[label] || '#6366f1', opacity: 0.7, borderRadius: 2 }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </Card>
  )
}

// ─── Tools Hub Page ───────────────────────────────────────────────────────────

const TOOL_CATEGORIES = ['All', 'Stocks', 'Options', 'Forex', 'Universal']

const TOOL_CATALOG = [
  { id: 'position', category: 'Stocks', icon: '📐', title: 'Position Size Calculator', desc: 'Calculate how many shares to buy based on your risk tolerance.' },
  { id: 'riskreward', category: 'Stocks', icon: '⚖️', title: 'Risk/Reward Calculator', desc: 'Evaluate trade setups by comparing potential profit vs loss.' },
  { id: 'optionspl', category: 'Options', icon: '📊', title: 'Options P&L Calculator', desc: 'Calculate profit/loss and break-even for options trades.' },
  { id: 'greeks', category: 'Options', icon: '🔢', title: 'Options Greeks Calculator', desc: 'Get Delta, Gamma, Theta, Vega using Black-Scholes model.' },
  { id: 'pip', category: 'Forex', icon: '💱', title: 'Pip Calculator', desc: 'Find the dollar value of each pip for any forex pair.' },
  { id: 'lotsize', category: 'Forex', icon: '📦', title: 'Lot Size Calculator', desc: 'Determine the right position size for forex trades.' },
  { id: 'compound', category: 'Universal', icon: '📈', title: 'Compound Interest Calculator', desc: 'See how your investments grow over time with compounding.' },
  { id: 'fibonacci', category: 'Universal', icon: '🌀', title: 'Fibonacci Retracement', desc: 'Calculate key support/resistance levels using Fibonacci ratios.' },
  { id: 'journal', category: 'Universal', icon: '📒', title: 'Trading Journal', desc: 'Log trades, track performance, analyze patterns. A complete journal with dashboard, calendar & analytics.', href: '/journal' },
]

export default function ToolsPage() {
  const [activeCategory, setActiveCategory] = useState('All')
  const [activeTool, setActiveTool] = useState<string | null>(null)

  const filteredTools = TOOL_CATALOG.filter(t => activeCategory === 'All' || t.category === activeCategory)

  const renderTool = () => {
    switch (activeTool) {
      case 'position':   return <PositionSizeCalc />
      case 'riskreward': return <RiskRewardCalc />
      case 'optionspl':  return <OptionsPLCalc />
      case 'greeks':     return <OptionsGreeksCalc />
      case 'pip':        return <PipCalc />
      case 'lotsize':    return <LotSizeCalc />
      case 'compound':   return <CompoundCalc />
      case 'fibonacci':  return <FibonacciCalc />
      default: return null
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-1)', color: 'var(--text-0)', padding: '0 0 60px' }}>
      {/* Header */}
      <div style={{ background: 'var(--bg-2)', borderBottom: '1px solid var(--border)', padding: '16px 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
        <a href="/" style={{ color: 'var(--text-2)', textDecoration: 'none', fontSize: 13 }}>← Back</a>
        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-0)' }}>🛠️ Trading Tools</div>
        <div style={{ fontSize: 12, color: 'var(--text-3)', marginLeft: 4 }}>Professional calculators for traders of all levels</div>
      </div>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 24px' }}>

        {activeTool ? (
          // Tool view
          <div>
            <button
              onClick={() => setActiveTool(null)}
              style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-2)', borderRadius: 6, padding: '6px 14px', cursor: 'pointer', fontSize: 12, marginBottom: 20 }}
            >
              ← Back to Tools
            </button>
            {renderTool()}
          </div>
        ) : (
          // Hub view
          <div>
            {/* Intro */}
            <div style={{ marginBottom: 24, padding: '16px 20px', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 10 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-1)', marginBottom: 4 }}>Professional Trading Calculators</div>
              <div style={{ fontSize: 12, color: 'var(--text-3)', lineHeight: 1.6 }}>
                All tools update in real-time as you type. Every field has a <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>ℹ️ tooltip <Tooltip text="Hover over the ? icon next to any label to learn what that field means. We explain everything in plain English!" position="right" /></span> to explain what it means. No financial jargon without explanation.
              </div>
            </div>

            {/* Category tabs */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
              {TOOL_CATEGORIES.map(cat => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  style={{
                    padding: '6px 16px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    border: '1px solid ' + (activeCategory === cat ? '#6366f1' : 'var(--border)'),
                    background: activeCategory === cat ? 'rgba(99,102,241,0.2)' : 'transparent',
                    color: activeCategory === cat ? '#818cf8' : 'var(--text-2)',
                    transition: 'all 0.15s',
                  }}
                >{cat}</button>
              ))}
            </div>

            {/* Tools grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
              {filteredTools.map(tool => (
                <div
                  key={tool.id}
                  style={{
                    background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 10, padding: 20,
                    display: 'flex', flexDirection: 'column', gap: 12,
                    transition: 'border-color 0.15s, transform 0.15s',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = '#6366f1'; (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLDivElement).style.transform = 'none' }}
                  onClick={() => { if ((tool as any).href) window.location.href = (tool as any).href; else setActiveTool(tool.id) }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 26 }}>{tool.icon}</span>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-0)' }}>{tool.title}</div>
                      <div style={{ fontSize: 10, color: 'var(--accent)', background: 'rgba(99,102,241,0.15)', padding: '1px 6px', borderRadius: 4, display: 'inline-block', marginTop: 2 }}>{tool.category}</div>
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-3)', lineHeight: 1.5 }}>{tool.desc}</div>
                  <button
                    style={{
                      alignSelf: 'flex-start', padding: '6px 16px', background: 'rgba(99,102,241,0.2)',
                      border: '1px solid rgba(99,102,241,0.4)', borderRadius: 6, color: '#818cf8',
                      fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    Open →
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
