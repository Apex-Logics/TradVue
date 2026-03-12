'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Tooltip from '../components/Tooltip'
import { ToolIcon, IconArrowLeft, IconTool, IconInfo, IconCheck, IconAlert, IconZap, IconBarChart } from '../components/Icons'
import PersistentNav from '../components/PersistentNav'
import FuturesCalculator from './FuturesCalculator'
import dynamic from 'next/dynamic'

const OptionsCalculator = dynamic(() => import('./OptionsCalculator'), { ssr: false })
const CompoundCalculator = dynamic(() => import('./CompoundCalculator'), { ssr: false })
const RiskOfRuinCalculator = dynamic(() => import('./RiskOfRuinCalculator'), { ssr: false })
const ForexCalculator = dynamic(() => import('./ForexCalculator'), { ssr: false })
const PositionSizer = dynamic(() => import('./PositionSizer'), { ssr: false })
const DividendPlanner = dynamic(() => import('./DividendPlanner'), { ssr: false })
const EconHeatmap = dynamic(() => import('./EconHeatmap'), { ssr: false })
const CorrelationMatrixEnhanced = dynamic(() => import('./CorrelationMatrix'), { ssr: false })
const ExpectancyCalculator = dynamic(() => import('./ExpectancyCalculator'), { ssr: false })
const SessionClock = dynamic(() => import('./SessionClock'), { ssr: false })

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
import { apiFetchSafe } from '../lib/apiFetch'

// ─── Reusable UI Primitives ──────────────────────────────────────────────────

function InputField({ label, tooltip, value, onChange, placeholder, type = 'number', min, step }: {
  label: string; tooltip?: string; value: string | number; onChange: (v: string) => void;
  placeholder?: string; type?: string; min?: string; step?: string
}) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label className="ds-label">
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
        className="ds-input"
        style={{ fontFamily: 'var(--mono)' }}
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
      <label className="ds-label">
        {label}
        {tooltip && <Tooltip text={tooltip} position="right" />}
      </label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="ds-select"
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
    <div className="ds-card" style={style}>
      {children}
    </div>
  )
}

function SectionTitle({ toolId, title, desc }: { toolId: string; title: string; desc: string }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <span style={{ color: 'var(--accent)', flexShrink: 0 }}>
          <ToolIcon id={toolId} size={22} />
        </span>
        <h2 className="section-title" style={{ fontSize: 18, margin: 0 }}>{title}</h2>
      </div>
      <p style={{ margin: 0, fontSize: 13, color: 'var(--text-2)', lineHeight: 1.5 }}>{desc}</p>
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
        toolId="position"
        title="Position Size Calculator"
        desc="Determine how many shares to buy based on how much you're willing to risk on a trade. Never risk more than 1–2% of your account on any single trade."
      />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
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
      <div style={{ marginTop: 12, fontSize: 11, color: 'var(--text-3)', background: 'var(--accent-dim)', borderRadius: 6, padding: '8px 12px' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><IconInfo size={12} />Example: Account $25,000 | Risk 2% | Entry $150 | Stop $145 → Buy <strong>100 shares</strong> ($500 at risk)</span>
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
        toolId="riskreward"
        title="Risk/Reward Calculator"
        desc="Calculate the ratio between potential profit and potential loss. A good trade has at least a 1:2 risk/reward — meaning you risk $1 to make $2."
      />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
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
            {ratio >= 2
              ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><IconCheck size={12} style={{ color: 'var(--green)' }} />Great setup — reward outweighs risk</span>
              : ratio >= 1
              ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><IconAlert size={12} style={{ color: 'var(--yellow)' }} />Acceptable — consider a better target</span>
              : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><IconAlert size={12} style={{ color: 'var(--red)' }} />Poor setup — risk exceeds reward</span>
            }
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
        toolId="optionspl"
        title="Options Profit/Loss Calculator"
        desc="Calculate your potential profit or loss on an options trade. Options give you the right (but not the obligation) to buy or sell a stock at a specific price."
      />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
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
                stroke="var(--accent)"
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
        toolId="greeks"
        title="Options Greeks Calculator"
        desc="Calculate the sensitivity metrics (Greeks) of an options contract using the Black-Scholes model. Greeks help you understand how an option's price will change."
      />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
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
          <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-3)', background: 'var(--accent-dim)', borderRadius: 6, padding: '8px 12px' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><IconInfo size={12} />Black-Scholes assumes constant volatility and European-style exercise. Real prices may differ.</span>
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
        toolId="pip"
        title="Pip Calculator (Forex)"
        desc="Calculate the value of a pip for any forex pair and lot size. A pip is the smallest standard price move in currency trading — usually 0.0001 for most pairs."
      />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
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
      <div style={{ marginTop: 12, fontSize: 11, color: 'var(--text-3)', background: 'var(--accent-dim)', borderRadius: 6, padding: '8px 12px' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><IconInfo size={12} />A pip is 0.0001 for EUR/USD. If EUR/USD moves from 1.1000 to 1.1010, that&apos;s 10 pips. With 1 standard lot, that&apos;s $100 profit or loss.</span>
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
        toolId="lotsize"
        title="Lot Size Calculator (Forex)"
        desc="Calculate the correct lot size for your trade based on your account size and risk tolerance. Always know your lot size BEFORE entering a trade."
      />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
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
          <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-3)', background: 'var(--accent-dim)', borderRadius: 6, padding: '8px 12px' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><IconInfo size={12} />Standard = 100,000 units | Mini = 10,000 | Micro = 1,000. Start with micro lots while learning.</span>
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
        toolId="compound"
        title="Compound Interest Calculator"
        desc="See how your money grows over time with compound interest — 'the eighth wonder of the world'. The earlier you start, the more powerful it becomes."
      />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
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
                  <stop offset="0%" stopColor="#4a9eff" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#4a9eff" stopOpacity="0" />
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
                fill="none" stroke="var(--accent)" strokeWidth="2"
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
        toolId="fibonacci"
        title="Fibonacci Retracement Calculator"
        desc="Calculate key Fibonacci levels — mathematical ratios that often act as support and resistance areas where price may pause or reverse. Used by technical traders worldwide."
      />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
        <div>
          <InputField label="Swing High Price" tooltip="The highest price in the recent move or swing. This is the top of the range you're measuring." value={high} onChange={setHigh} placeholder="e.g. 200.00" />
          <InputField label="Swing Low Price" tooltip="The lowest price in the recent move or swing. This is the bottom of the range you're measuring." value={low} onChange={setLow} placeholder="e.g. 150.00" />
          <SelectField label="Trend Direction" tooltip="Uptrend: price moved UP and may pull back to these levels. Downtrend: price moved DOWN and may bounce to these levels." value={direction} onChange={setDirection} options={[{ value: 'up', label: '⬆️ Uptrend (retracing down from high)' }, { value: 'down', label: '⬇️ Downtrend (bouncing up from low)' }]} />
          <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-3)', background: 'var(--accent-dim)', borderRadius: 6, padding: '8px 12px' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><IconInfo size={12} />The 61.8% level (Golden Ratio) is considered the most significant. Price often respects the 38.2% and 61.8% levels strongly.</span>
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

// ─── 9. Stock Screener ────────────────────────────────────────────────────────

const SECTORS = ['All Sectors', 'Technology', 'Financial', 'Healthcare', 'Energy', 'Consumer', 'Industrials', 'Utilities', 'Real Estate', 'Materials']

function StockScreener() {
  const [minPE, setMinPE] = useState('')
  const [maxPE, setMaxPE] = useState('')
  const [minYield, setMinYield] = useState('')
  const [sector, setSector] = useState('All Sectors')
  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [sortKey, setSortKey] = useState<'marketCap' | 'pe' | 'divYield' | 'price'>('marketCap')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [searched, setSearched] = useState(false)

  const runScreener = useCallback(async () => {
    setLoading(true); setError(''); setSearched(true)
    try {
      const params = new URLSearchParams()
      if (minPE) params.set('minPE', minPE)
      if (maxPE) params.set('maxPE', maxPE)
      if (minYield) params.set('minYield', minYield)
      if (sector !== 'All Sectors') params.set('sector', sector)
      if (minPrice) params.set('minPrice', minPrice)
      if (maxPrice) params.set('maxPrice', maxPrice)
      params.set('limit', '40')
      const json = await apiFetchSafe<{ success: boolean; data: unknown[] }>(`${API_BASE}/api/tools/screener?${params}`)
      if (!json?.success) { setError('unavailable'); return }
      setResults(json.data || [])
    } catch { setError('unavailable') }
    setLoading(false)
  }, [minPE, maxPE, minYield, sector, minPrice, maxPrice])

  const sorted = [...results].sort((a, b) => {
    const av = a[sortKey] ?? 0, bv = b[sortKey] ?? 0
    return sortDir === 'desc' ? bv - av : av - bv
  })

  const toggleSort = (key: typeof sortKey) => {
    if (sortKey === key) setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    else { setSortKey(key); setSortDir('desc') }
  }
  const SortArrow = ({ k }: { k: typeof sortKey }) => (
    <span style={{ marginLeft: 2, opacity: sortKey === k ? 1 : 0.3 }}>{sortKey === k ? (sortDir === 'desc' ? '↓' : '↑') : '↕'}</span>
  )

  return (
    <Card>
      <SectionTitle toolId="screener" title="Stock Screener" desc="Filter thousands of stocks to find ones matching your exact criteria. Set ranges for valuation, dividends, and price to discover investment opportunities." />
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 12 }}>
        <span style={{ fontSize: 12, color: 'var(--text-3)' }}>What is a screener?</span>
        <Tooltip text="A stock screener filters thousands of stocks to find ones matching your criteria. Like using search filters when shopping online — but for investments." position="right" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12, marginBottom: 16 }}>
        <InputField label="Min P/E Ratio" tooltip="Price-to-Earnings ratio. Lower = potentially cheaper stock. The market average is ~20-25. Enter minimum threshold (e.g., 5 to exclude near-zero PE stocks)." value={minPE} onChange={setMinPE} placeholder="e.g. 5" />
        <InputField label="Max P/E Ratio" tooltip="Maximum P/E ratio to include. Enter 25 to find value stocks with PE below market average." value={maxPE} onChange={setMaxPE} placeholder="e.g. 30" />
        <InputField label="Min Div Yield %" tooltip="Dividend yield is annual dividends ÷ stock price × 100. E.g., 2 means the stock pays 2% of its price in dividends per year." value={minYield} onChange={setMinYield} placeholder="e.g. 1.5" />
        <InputField label="Min Price ($)" tooltip="Filter out stocks below this price. Some investors prefer stocks above $10 to avoid penny stocks." value={minPrice} onChange={setMinPrice} placeholder="e.g. 10" />
        <InputField label="Max Price ($)" tooltip="Filter out expensive stocks above this price. Useful if you have a limited budget per share." value={maxPrice} onChange={setMaxPrice} placeholder="e.g. 500" />
        <SelectField label="Sector" tooltip="Industry sector helps group similar companies. Technology companies behave differently from Energy or Healthcare stocks." value={sector} onChange={setSector} options={SECTORS.map(s => ({ value: s, label: s }))} />
      </div>
      <button onClick={runScreener} disabled={loading} style={{ padding: '10px 24px', background: 'var(--accent-dim)', border: '1px solid rgba(74,158,255,0.4)', borderRadius: 8, color: 'var(--accent)', fontSize: 13, fontWeight: 700, cursor: 'pointer', marginBottom: 16 }}>
        {loading ? 'Scanning...' : 'Run Screener'}
      </button>
      {error && <div style={{ color: 'var(--text-3)', fontSize: 12, marginBottom: 8 }}>Market data is temporarily unavailable. Please try again.</div>}
      {searched && !loading && (
        <div style={{ overflowX: 'auto' }}>
          <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 8 }}>{sorted.length} stocks found</div>
          {sorted.length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-3)', fontSize: 12 }}>No stocks matched your criteria. Try wider ranges.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: 'var(--bg-3)' }}>
                  {[['Symbol','symbol'],['Name','name'],['Price','price'],['P/E','pe'],['Div Yield','divYield'],['Mkt Cap (B)','marketCap'],['Sector','sector']].map(([label, key]) => (
                    <th key={key} onClick={() => ['price','pe','divYield','marketCap'].includes(key) && toggleSort(key as any)} style={{ padding: '8px 10px', textAlign: 'left', color: 'var(--text-2)', fontWeight: 600, cursor: ['price','pe','divYield','marketCap'].includes(key) ? 'pointer' : 'default', whiteSpace: 'nowrap', userSelect: 'none' }}>
                      {label}{['price','pe','divYield','marketCap'].includes(key) && <SortArrow k={key as any} />}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map(s => (
                  <tr key={s.symbol} onClick={() => window.open(`/stock/${s.symbol}`, '_blank')} style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                    onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = 'var(--bg-3)'}
                    onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = 'transparent'}>
                    <td style={{ padding: '7px 10px', fontWeight: 700, color: 'var(--accent)', fontFamily: 'var(--mono)' }}>{s.symbol}</td>
                    <td style={{ padding: '7px 10px', color: 'var(--text-1)' }}>{s.name}</td>
                    <td style={{ padding: '7px 10px', fontFamily: 'var(--mono)' }}>${s.price?.toFixed(2) ?? '—'}</td>
                    <td style={{ padding: '7px 10px', fontFamily: 'var(--mono)' }}>{s.pe != null ? s.pe.toFixed(1) : '—'}</td>
                    <td style={{ padding: '7px 10px', fontFamily: 'var(--mono)', color: s.divYield > 0 ? 'var(--green)' : 'var(--text-2)' }}>{s.divYield > 0 ? s.divYield.toFixed(2) + '%' : '—'}</td>
                    <td style={{ padding: '7px 10px', fontFamily: 'var(--mono)' }}>${s.marketCap?.toFixed(1) ?? '—'}B</td>
                    <td style={{ padding: '7px 10px', color: 'var(--text-3)', fontSize: 11 }}>{s.sector}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
      {!searched && (
        <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-3)', fontSize: 12, background: 'var(--bg-3)', borderRadius: 8 }}>
          Set your filters above and click <strong>Run Screener</strong> to find matching stocks
        </div>
      )}
    </Card>
  )
}

// ─── 10. Earnings Calendar ────────────────────────────────────────────────────

function EarningsCalendar() {
  const [earnings, setEarnings] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [period, setPeriod] = useState('thisWeek')

  const fetchEarnings = useCallback(async () => {
    setLoading(true); setError('')
    const now = new Date()
    let from: Date, to: Date
    if (period === 'thisWeek') {
      // Mon-Sun of current week
      const day = now.getDay()
      const mon = new Date(now); mon.setDate(now.getDate() - (day === 0 ? 6 : day - 1))
      const sun = new Date(mon); sun.setDate(mon.getDate() + 6)
      from = mon; to = sun
    } else {
      // Next 14 days
      from = new Date(now.getTime() + 7 * 86400000)
      to = new Date(now.getTime() + 14 * 86400000)
    }
    const fmt = (d: Date) => d.toISOString().split('T')[0]
    const json = await apiFetchSafe<{ success: boolean; data: unknown[] }>(`${API_BASE}/api/tools/earnings?from=${fmt(from)}&to=${fmt(to)}`)
    if (!json?.success) setError('unavailable')
    else setEarnings(json.data || [])
    setLoading(false)
  }, [period])

  useEffect(() => { fetchEarnings() }, [fetchEarnings])

  const filtered = earnings.filter(e => !search || e.symbol?.toUpperCase().includes(search.toUpperCase()) || e.name?.toLowerCase().includes(search.toLowerCase()))

  const fmtRevenue = (n: number) => {
    if (!n || isNaN(n)) return '—'
    if (n >= 1e9) return '$' + (n / 1e9).toFixed(1) + 'B'
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M'
    return '$' + n.toLocaleString()
  }

  return (
    <Card>
      <SectionTitle toolId="earnings" title="Earnings Calendar" desc="See which companies are reporting earnings this week or next. Earnings announcements often cause big stock price moves." />
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 12 }}>
        <span style={{ fontSize: 12, color: 'var(--text-3)' }}>What is an earnings report?</span>
        <Tooltip text="Every quarter, public companies report their financial results. BMO = Before Market Open (report released before 9:30 AM ET). AMC = After Market Close (after 4 PM ET). Big surprises cause big price moves." position="right" />
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        {[['thisWeek', 'This Week'], ['nextWeek', 'Next Week']].map(([v, l]) => (
          <button key={v} onClick={() => setPeriod(v)} style={{ padding: '5px 14px', borderRadius: 16, fontSize: 12, cursor: 'pointer', border: '1px solid ' + (period === v ? 'var(--accent)' : 'var(--border)'), background: period === v ? 'var(--accent-dim)' : 'transparent', color: period === v ? 'var(--accent)' : 'var(--text-2)' }}>{l}</button>
        ))}
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search symbol..." style={{ flex: 1, minWidth: 120, background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 10px', color: 'var(--text-0)', fontSize: 12, outline: 'none' }} />
        <button onClick={fetchEarnings} style={{ padding: '5px 12px', background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-2)', fontSize: 12, cursor: 'pointer' }}>↻ Refresh</button>
      </div>
      {loading && <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-3)', fontSize: 12 }}>Loading earnings…</div>}
      {error && <div style={{ color: 'var(--text-3)', fontSize: 12, marginBottom: 8 }}>Earnings data temporarily unavailable.</div>}
      {!loading && (
        <div style={{ overflowX: 'auto' }}>
          <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 6 }}>{filtered.length} earnings reports</div>
          {filtered.length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-3)', fontSize: 12 }}>No earnings found for this period.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: 'var(--bg-3)' }}>
                  {['Date', 'Symbol', 'Company', 'EPS Est.', 'Rev Est.', 'Time'].map(h => (
                    <th key={h} style={{ padding: '8px 10px', textAlign: 'left', color: 'var(--text-2)', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((e, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '7px 10px', fontFamily: 'var(--mono)', color: 'var(--text-2)', fontSize: 11 }}>{e.date}</td>
                    <td style={{ padding: '7px 10px', fontWeight: 700, color: 'var(--accent)', fontFamily: 'var(--mono)' }}>{e.symbol}</td>
                    <td style={{ padding: '7px 10px', color: 'var(--text-1)', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.name || e.symbol}</td>
                    <td style={{ padding: '7px 10px', fontFamily: 'var(--mono)' }}>{e.epsEstimate != null ? '$' + e.epsEstimate?.toFixed(2) : '—'}</td>
                    <td style={{ padding: '7px 10px', fontFamily: 'var(--mono)' }}>{fmtRevenue(e.revenueEstimate)}</td>
                    <td style={{ padding: '7px 10px' }}>
                      <span style={{ padding: '2px 6px', borderRadius: 4, fontSize: 10, fontWeight: 700, background: e.time === 'BMO' ? 'rgba(59,130,246,0.2)' : e.time === 'AMC' ? 'rgba(249,115,22,0.2)' : 'var(--bg-3)', color: e.time === 'BMO' ? '#60a5fa' : e.time === 'AMC' ? '#fb923c' : 'var(--text-3)' }}>
                        {e.time}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
      <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text-3)', background: 'var(--accent-dim)', borderRadius: 6, padding: '8px 12px' }}>
        <span style={{ display: 'inline-flex', alignItems: 'flex-start', gap: 5 }}><IconInfo size={12} style={{ flexShrink: 0, marginTop: 1 }} /><span><strong>BMO</strong> = Before Market Open (pre-9:30 AM ET) | <strong>AMC</strong> = After Market Close (post-4 PM ET). Options traders often avoid holding positions through earnings due to volatility risk.</span></span>
      </div>
    </Card>
  )
}

// ─── 11. Market Heatmap ───────────────────────────────────────────────────────

const HEATMAP_GROUPS: { sector: string; symbols: string[] }[] = [
  { sector: 'Technology', symbols: ['AAPL', 'MSFT', 'NVDA', 'GOOGL', 'META', 'AMZN', 'TSLA', 'AMD'] },
  { sector: 'Financial', symbols: ['JPM', 'BAC', 'GS', 'V', 'MA', 'MS', 'WFC'] },
  { sector: 'Healthcare', symbols: ['UNH', 'JNJ', 'LLY', 'PFE', 'ABBV', 'MRK', 'TMO'] },
  { sector: 'Energy', symbols: ['XOM', 'CVX', 'COP', 'SLB', 'EOG'] },
  { sector: 'Consumer', symbols: ['WMT', 'HD', 'COST', 'MCD', 'NKE', 'SBUX', 'PG', 'KO'] },
  { sector: 'Industrials', symbols: ['CAT', 'BA', 'GE', 'HON', 'UPS', 'LMT'] },
]

const ALL_HEATMAP_SYMBOLS = HEATMAP_GROUPS.flatMap(g => g.symbols)

function MarketHeatmap() {
  const [quotes, setQuotes] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [lastUpdated, setLastUpdated] = useState<string>('')
  const [isMockData, setIsMockData] = useState(false)

  const fetchHeatmap = useCallback(async () => {
    setLoading(true); setError('')
    const json = await apiFetchSafe<{ success: boolean; data: Record<string, unknown> }>(`${API_BASE}/api/market-data/batch?symbols=${ALL_HEATMAP_SYMBOLS.join(',')}`)
    if (!json?.success) setError('unavailable')
    else {
      const d = json.data || {}
      setQuotes(d)
      setLastUpdated(new Date().toLocaleTimeString())
      // Detect if data might be cached/mock (check if any stock's pc == c, which happens with cached data)
      const vals = Object.values(d as Record<string, { pc?: number; c?: number }>)
      const allSame = vals.length > 0 && vals.every(v => v?.c === v?.pc)
      setIsMockData(allSame)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchHeatmap()
    const interval = setInterval(fetchHeatmap, 60000) // refresh every minute
    return () => clearInterval(interval)
  }, [fetchHeatmap])

  const getColor = (change: number) => {
    if (change > 3) return '#16a34a'
    if (change > 1.5) return '#22c55e'
    if (change > 0.5) return '#4ade80'
    if (change > 0) return '#86efac'
    if (change > -0.5) return '#fca5a5'
    if (change > -1.5) return '#f87171'
    if (change > -3) return '#ef4444'
    return '#dc2626'
  }

  const getTextColor = (change: number) => Math.abs(change) > 1 ? '#fff' : '#000'

  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <SectionTitle toolId="heatmap" title="Market Heatmap" desc="Visual overview of major stocks grouped by sector. Color shows daily performance." />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {lastUpdated && <span style={{ fontSize: 10, color: 'var(--text-3)' }}>Updated {lastUpdated}</span>}
          <button onClick={fetchHeatmap} style={{ padding: '4px 10px', background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 5, color: 'var(--text-2)', fontSize: 11, cursor: 'pointer' }}>↻</button>
          <Tooltip text="Heatmap shows market performance at a glance. Green = up, Red = down. Size = relative market cap. Darker = bigger move." position="left" />
        </div>
      </div>
      {loading && Object.keys(quotes).length === 0 && <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-3)', fontSize: 12 }}>Loading heatmap…</div>}
      {error && <div style={{ color: 'var(--text-3)', fontSize: 12, marginBottom: 8 }}>Market data temporarily unavailable.</div>}
      {isMockData && !loading && <div style={{ padding: '5px 10px', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 6, marginBottom: 8, fontSize: 11, color: '#f59e0b' }}>Sample data — live prices require market hours (9:30AM–4PM ET)</div>}
      {/* Legend */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 10, color: 'var(--text-3)' }}>Scale:</span>
        {[['< -3%', '#dc2626'], ['-1.5%', '#ef4444'], ['0%', '#94a3b8'], ['+1.5%', '#22c55e'], ['> +3%', '#16a34a']].map(([l, c]) => (
          <span key={l} style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, color: 'var(--text-3)' }}>
            <span style={{ width: 12, height: 12, background: c, borderRadius: 2, display: 'inline-block' }} />{l}
          </span>
        ))}
      </div>
      {HEATMAP_GROUPS.map(group => (
        <div key={group.sector} style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', marginBottom: 6, letterSpacing: '0.05em', textTransform: 'uppercase' }}>{group.sector}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: 4 }}>
            {group.symbols.map(sym => {
              const q = quotes[sym]
              const change = q?.dp ?? q?.percentChange ?? 0
              const price = q?.c ?? q?.price ?? 0
              const bg = q ? getColor(change) : 'var(--bg-3)'
              const textCol = q ? (Math.abs(change) > 1.5 ? '#fff' : '#000') : 'var(--text-3)'
              return (
                <div key={sym} onClick={() => window.open(`/stock/${sym}`, '_blank')} style={{ background: bg, borderRadius: 6, padding: '8px 6px', textAlign: 'center', cursor: 'pointer', transition: 'opacity 0.15s', minHeight: 60, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}
                  onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.opacity = '0.8'}
                  onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.opacity = '1'}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: textCol }}>{sym}</div>
                  <div style={{ fontSize: 10, color: textCol, opacity: 0.9, marginTop: 2 }}>{price > 0 ? `$${price.toFixed(0)}` : '...'}</div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: textCol }}>{q ? `${change >= 0 ? '+' : ''}${change.toFixed(2)}%` : '—'}</div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </Card>
  )
}

// ─── 12. Fear & Greed Index ───────────────────────────────────────────────────

function FearGreedIndex() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const json = await apiFetchSafe<{ success: boolean }>(`${API_BASE}/api/tools/fear-greed?limit=30`)
      if (!json?.success) setError('unavailable')
      else setData(json)
      setLoading(false)
    }
    load()
  }, [])

  const getGradient = (v: number) => {
    if (v <= 25) return '#ef4444'
    if (v <= 45) return '#f97316'
    if (v <= 55) return '#eab308'
    if (v <= 75) return '#84cc16'
    return '#22c55e'
  }

  const getLabel = (v: number) => {
    if (v <= 25) return 'Extreme Fear'
    if (v <= 45) return 'Fear'
    if (v <= 55) return 'Neutral'
    if (v <= 75) return 'Greed'
    return 'Extreme Greed'
  }

  const current = data?.current
  const history = data?.history?.slice(0, 30) || []
  const value = current?.value ?? 50
  const angle = (value / 100) * 180 - 90 // -90 to +90 degrees
  const color = getGradient(value)

  // Mini bar chart of last 30 days
  const maxVal = 100
  const chartW = 360, chartH = 60

  return (
    <Card>
      <SectionTitle toolId="feargreed" title="Crypto Fear & Greed Index" desc="Measures overall crypto market sentiment from 0 (Extreme Fear) to 100 (Extreme Greed)." />
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 16 }}>
        <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Why does this matter?</span>
        <Tooltip text="Measures market sentiment. Extreme Fear (0-25) can signal buying opportunities — others are panicking. Extreme Greed (75-100) may signal overvaluation — everyone is euphoric. Made famous by Warren Buffett: 'Be fearful when others are greedy and greedy when others are fearful.'" position="right" />
      </div>
      {loading && <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-3)', fontSize: 12 }}>Loading…</div>}
      {error && <div style={{ color: 'var(--text-3)', fontSize: 12 }}>Market sentiment data temporarily unavailable.</div>}
      {data && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20 }}>
          {/* Gauge */}
          <div style={{ textAlign: 'center' }}>
            <svg width="220" height="130" viewBox="0 0 220 130" style={{ overflow: 'visible' }}>
              {/* Background arc */}
              <path d="M 20 110 A 90 90 0 0 1 200 110" fill="none" stroke="var(--bg-3)" strokeWidth="18" strokeLinecap="round" />
              {/* Color zones — map value ranges to arc positions
                   Gauge: left=(20,110)=0%, top=(110,20)=50%, right=(200,110)=100%
                   Point formula: x = cx + r*sin(rad), y = cy - r*cos(rad)
                   where rad = (value/100 * 180 - 90) * PI/180  (-PI/2 at 0% → +PI/2 at 100%) */}
              {[
                { vStart: 0,  vEnd: 25,  color: '#ef4444' },
                { vStart: 25, vEnd: 45,  color: '#f97316' },
                { vStart: 45, vEnd: 55,  color: '#eab308' },
                { vStart: 55, vEnd: 75,  color: '#84cc16' },
                { vStart: 75, vEnd: 100, color: '#22c55e' },
              ].map((zone, i) => {
                const r = 90, cx = 110, cy = 110
                const toRad = (v: number) => (v / 100 * 180 - 90) * Math.PI / 180
                const startRad = toRad(zone.vStart)
                const endRad = toRad(zone.vEnd)
                const x1 = cx + r * Math.sin(startRad)
                const y1 = cy - r * Math.cos(startRad)
                const x2 = cx + r * Math.sin(endRad)
                const y2 = cy - r * Math.cos(endRad)
                const large = (zone.vEnd - zone.vStart) > 50 ? 1 : 0
                return (
                  <path key={i} d={`M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`}
                    fill="none" stroke={zone.color} strokeWidth="18" strokeLinecap="butt" opacity="0.8" />
                )
              })}
              {/* Needle — same sin/cos formula */}
              {(() => {
                const needleRad = (value / 100 * 180 - 90) * Math.PI / 180
                const nx = 110 + 72 * Math.sin(needleRad)
                const ny = 110 - 72 * Math.cos(needleRad)
                return <line x1="110" y1="110" x2={nx.toFixed(2)} y2={ny.toFixed(2)} stroke={color} strokeWidth="3" strokeLinecap="round" />
              })()}
              <circle cx="110" cy="110" r="8" fill={color} />
              {/* Value */}
              <text x="110" y="95" textAnchor="middle" fontSize="28" fontWeight="bold" fill={color}>{value}</text>
              <text x="110" y="128" textAnchor="middle" fontSize="13" fontWeight="600" fill={color}>{getLabel(value)}</text>
            </svg>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--text-3)', marginTop: 2, padding: '0 8px' }}>
              <span>Extreme Fear</span><span>Extreme Greed</span>
            </div>
          </div>
          {/* History chart */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', marginBottom: 8, letterSpacing: '0.05em' }}>LAST 30 DAYS</div>
            <svg width="100%" height={chartH} viewBox={`0 0 ${chartW} ${chartH}`} preserveAspectRatio="xMidYMid meet" style={{ overflow: 'visible' }}>
              {history.slice().reverse().map((d: any, i: number) => {
                const bw = chartW / history.length - 1
                const bh = (d.value / maxVal) * (chartH - 4)
                const x = i * (chartW / history.length)
                const y = chartH - bh
                return <rect key={i} x={x} y={y} width={bw} height={bh} fill={getGradient(d.value)} rx="1" opacity="0.85" />
              })}
            </svg>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--text-3)', marginTop: 2 }}>
              <span>30 days ago</span><span>Today</span>
            </div>
            {/* Zones reference */}
            <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 4 }}>
              {[['0-25', 'Extreme Fear', '#ef4444'], ['25-45', 'Fear', '#f97316'], ['45-55', 'Neutral', '#eab308'], ['55-75', 'Greed', '#84cc16'], ['75-100', 'Extreme Greed', '#22c55e']].map(([r, l, c]) => (
                <div key={r} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--text-2)' }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: c, flexShrink: 0 }} />
                  <span>{r}</span><span style={{ color: 'var(--text-3)' }}>{l}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </Card>
  )
}

// ─── 13. Gas Fee Tracker ──────────────────────────────────────────────────────

function GasFeeTracker() {
  const [gasData, setGasData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [ethAmount, setEthAmount] = useState('0.1')

  const fetchGas = useCallback(async () => {
    setLoading(true)
    const json = await apiFetchSafe<{ success: boolean }>(`${API_BASE}/api/tools/gas`)
    if (!json?.success) setError('unavailable')
    else setGasData(json)
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchGas()
    const t = setInterval(fetchGas, 30000) // refresh every 30s
    return () => clearInterval(t)
  }, [fetchGas])

  const txTypes = [
    { name: 'ETH Transfer', gas: 21000, icon: 'ETH' },
    { name: 'ERC-20 Transfer', gas: 65000, icon: 'ERC' },
    { name: 'Uniswap Swap', gas: 150000, icon: 'SWAP' },
    { name: 'NFT Mint', gas: 250000, icon: 'NFT' },
    { name: 'Contract Deploy', gas: 500000, icon: 'DEPL' },
  ]

  const calcTxCost = (gwei: number, gasUnits: number) => {
    const ethPrice = gasData?.ethPrice || 3000
    return parseFloat(((gwei * gasUnits * ethPrice) / 1e9).toFixed(2))
  }

  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <SectionTitle toolId="gas" title="Ethereum Gas Fee Tracker" desc="Real-time Ethereum network transaction costs in Gwei and USD." />
        <button onClick={fetchGas} style={{ padding: '4px 10px', background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 5, color: 'var(--text-2)', fontSize: 11, cursor: 'pointer', flexShrink: 0 }}>↻</button>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 16 }}>
        <span style={{ fontSize: 12, color: 'var(--text-3)' }}>What are gas fees?</span>
        <Tooltip text="Gas fees are the cost to execute transactions on Ethereum. Think of it like a tip to miners/validators who process your transaction. Higher fees = faster confirmation. Measured in 'Gwei' (billionths of ETH)." position="right" />
      </div>
      {loading && !gasData && <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-3)', fontSize: 12 }}>Fetching gas prices…</div>}
      {error && <div style={{ color: 'var(--text-3)', fontSize: 12, marginBottom: 8 }}>Gas fee data temporarily unavailable.</div>}
      {gasData && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 20 }}>
            {[
              { label: 'Slow', key: 'slow', desc: '~5-10 min', color: '#60a5fa' },
              { label: 'Standard', key: 'standard', desc: '~1-3 min', color: '#a78bfa' },
              { label: 'Fast', key: 'fast', desc: '~15-30 sec', color: 'var(--yellow)' },
            ].map(({ label, key, desc, color }) => {
              const d = gasData.prices[key]
              return (
                <div key={key} style={{ background: 'var(--bg-3)', borderRadius: 8, padding: 14, textAlign: 'center', border: `1px solid ${color}30` }}>
                  <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 4 }}>{label}</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color, fontFamily: 'var(--mono)' }}>{d.gwei}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-3)', marginBottom: 4 }}>Gwei</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-1)' }}>${d.usd}</div>
                  <div style={{ fontSize: 9, color: 'var(--text-3)', marginTop: 2 }}>{desc}</div>
                </div>
              )
            })}
          </div>
          {/* Transaction cost estimator */}
          <div style={{ background: 'var(--bg-3)', borderRadius: 8, padding: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', marginBottom: 10, letterSpacing: '0.05em' }}>TRANSACTION COST ESTIMATOR (at Standard gas)</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr>
                  {['Transaction Type', 'Gas Units', 'Cost (USD)'].map(h => (
                    <th key={h} style={{ padding: '5px 8px', textAlign: 'left', color: 'var(--text-3)', fontSize: 10, fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {txTypes.map(tx => (
                  <tr key={tx.name} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ padding: '6px 8px', color: 'var(--text-1)' }}>{tx.icon} {tx.name}</td>
                    <td style={{ padding: '6px 8px', fontFamily: 'var(--mono)', color: 'var(--text-3)' }}>{tx.gas.toLocaleString()}</td>
                    <td style={{ padding: '6px 8px', fontFamily: 'var(--mono)', fontWeight: 600, color: 'var(--accent)' }}>
                      ${calcTxCost(gasData.prices.standard.gwei, tx.gas)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text-3)', background: 'var(--accent-dim)', borderRadius: 6, padding: '8px 12px' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><IconInfo size={12} />1 Gwei = 0.000000001 ETH. ETH price used: ~${gasData.ethPrice.toLocaleString()}. Gas prices update every 30 seconds.</span>
          </div>
        </>
      )}
    </Card>
  )
}

// ─── 14. Staking Rewards Calculator ──────────────────────────────────────────

const STAKING_COINS: Record<string, { apy: number; price: number; name: string }> = {
  ETH: { apy: 3.8, price: 3400, name: 'Ethereum' },
  SOL: { apy: 6.5, price: 140, name: 'Solana' },
  ADA: { apy: 3.2, price: 0.55, name: 'Cardano' },
  DOT: { apy: 14.5, price: 8.5, name: 'Polkadot' },
  MATIC: { apy: 5.2, price: 0.9, name: 'Polygon' },
  ATOM: { apy: 18.0, price: 10.5, name: 'Cosmos' },
  AVAX: { apy: 8.5, price: 38, name: 'Avalanche' },
  BNB: { apy: 4.5, price: 450, name: 'BNB Chain' },
}

function StakingRewards() {
  const [coin, setCoin] = useState('ETH')
  const [amount, setAmount] = useState('10')
  const [apy, setApy] = useState('3.8')
  const [useCompound, setUseCompound] = useState(true)

  const coinInfo = STAKING_COINS[coin] || { apy: 5, price: 100, name: coin }
  const amountN = parseFloat(amount) || 0
  const apyN = parseFloat(apy) || 0
  const price = coinInfo.price
  const principal = amountN * price

  const calc = (days: number) => {
    if (useCompound) {
      const rate = apyN / 100
      const coins = amountN * (Math.pow(1 + rate, days / 365) - 1)
      return { coins, usd: coins * price }
    } else {
      const rate = apyN / 100
      const coins = amountN * rate * (days / 365)
      return { coins, usd: coins * price }
    }
  }

  const periods = [
    { label: 'Daily', days: 1 },
    { label: 'Weekly', days: 7 },
    { label: 'Monthly', days: 30 },
    { label: 'Yearly', days: 365 },
    { label: '5 Years', days: 1825 },
  ]

  return (
    <Card>
      <SectionTitle toolId="staking" title="Staking Rewards Calculator" desc="Calculate how much you can earn by staking your crypto. Staking is like earning interest — but for helping secure a blockchain network." />
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 12 }}>
        <span style={{ fontSize: 12, color: 'var(--text-3)' }}>What is staking?</span>
        <Tooltip text="Staking locks your crypto to help secure the network. In return, you earn rewards (similar to interest). APY = Annual Percentage Yield. Compound = reinvesting rewards to earn even more over time." position="right" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
        <div>
          <SelectField label="Coin" tooltip="Select the cryptocurrency you want to stake. APY rates are approximate current averages — actual rates vary by validator and protocol." value={coin} onChange={v => { setCoin(v); setApy(String(STAKING_COINS[v]?.apy || 5)) }} options={Object.entries(STAKING_COINS).map(([k, v]) => ({ value: k, label: `${k} — ${v.name} (~${v.apy}% APY)` }))} />
          <InputField label="Amount to Stake (coins)" tooltip="How many coins you plan to stake. The more you stake, the more rewards you earn." value={amount} onChange={setAmount} placeholder="e.g. 10" step="0.1" min="0" />
          <InputField label="APY %" tooltip="Annual Percentage Yield — your yearly reward rate. This is pre-filled with current approximate rates but you can adjust." value={apy} onChange={setApy} placeholder="e.g. 5.0" step="0.1" min="0" />
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer', color: 'var(--text-1)' }}>
              <input type="checkbox" checked={useCompound} onChange={e => setUseCompound(e.target.checked)} style={{ width: 14, height: 14, cursor: 'pointer' }} />
              Compound rewards
              <Tooltip text="Compound = reinvest your rewards automatically. Your rewards earn rewards too! Simple = just calculate basic interest without reinvesting." position="right" />
            </label>
          </div>
          <div style={{ background: 'var(--accent-dim)', borderRadius: 6, padding: '8px 12px', fontSize: 11, color: 'var(--text-3)' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><IconBarChart size={12} />{amountN} {coin} ≈ <strong style={{ color: 'var(--text-1)' }}>${(principal).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</strong> at ~${price.toLocaleString()}/{coin}</span>
          </div>
        </div>
        <div>
          <div style={{ background: 'var(--bg-3)', borderRadius: 8, padding: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', marginBottom: 10, letterSpacing: '0.05em' }}>
              REWARDS ({useCompound ? 'COMPOUND' : 'SIMPLE'})
              <Tooltip text={useCompound ? "Compound interest: your rewards are reinvested and earn more rewards. This accelerates growth." : "Simple interest: rewards calculated on your original stake only, without reinvesting."} position="right" />
            </div>
            {periods.map(p => {
              const r = calc(p.days)
              return (
                <div key={p.label} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{p.label}</span>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--green)', fontFamily: 'var(--mono)' }}>+{r.coins.toFixed(4)} {coin}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>≈ ${r.usd.toFixed(2)}</div>
                  </div>
                </div>
              )
            })}
            <div style={{ marginTop: 10, padding: '8px 10px', background: 'rgba(34,197,94,0.1)', borderRadius: 6, border: '1px solid rgba(34,197,94,0.2)' }}>
              <div style={{ fontSize: 10, color: 'var(--text-3)' }}>5-year total value (principal + rewards)</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--green)', fontFamily: 'var(--mono)' }}>
                ${(principal + calc(1825).usd).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Card>
  )
}

// ─── 15. Forex Session Timer ──────────────────────────────────────────────────

const FOREX_SESSIONS = [
  { name: 'Sydney',   open: 22, close: 7,  color: '#3b82f6', flag: 'AU', desc: 'Sydney opens Sunday 10PM ET. Quietest session.' },
  { name: 'Tokyo',    open: 0,  close: 9,  color: '#f59e0b', flag: 'JP', desc: 'Tokyo / Asia session. JPY pairs most active.' },
  { name: 'London',   open: 3,  close: 12, color: '#10b981', flag: 'GB', desc: 'Highest liquidity. EUR, GBP pairs most active.' },
  { name: 'New York', open: 8,  close: 17, color: '#ef4444', flag: 'US', desc: 'Overlaps with London 8-12 ET — most volatile.' },
]

function ForexSessionTimer() {
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  // Get current hour in UTC (forex sessions use UTC/ET)
  const utcHour = now.getUTCHours() + now.getUTCMinutes() / 60

  const isActive = (open: number, close: number) => {
    if (open < close) return utcHour >= open && utcHour < close
    else return utcHour >= open || utcHour < close // crosses midnight
  }

  const nextEvent = (open: number, close: number) => {
    let hoursUntilOpen = ((open - utcHour) + 24) % 24
    let hoursUntilClose = ((close - utcHour) + 24) % 24
    const active = isActive(open, close)
    const hours = active ? hoursUntilClose : hoursUntilOpen
    const h = Math.floor(hours), m = Math.floor((hours - h) * 60)
    return { active, label: active ? `Closes in ${h}h ${m}m` : `Opens in ${h}h ${m}m` }
  }

  const londonActive = isActive(3, 12)
  const nyActive = isActive(8, 17)
  const overlap = londonActive && nyActive

  return (
    <Card>
      <SectionTitle toolId="sessions" title="Forex Session Timer" desc="Forex trades 24 hours a day, 5 days a week. The market is most active when major sessions overlap." />
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 16 }}>
        <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Why do sessions matter?</span>
        <Tooltip text="Forex trades 24/5. The most volatile and liquid periods are when major sessions overlap. The London/NY overlap (8 AM - 12 PM ET) is the highest volume period — best for tight spreads and big moves." position="right" />
      </div>
      {/* Current time */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ background: 'var(--bg-3)', borderRadius: 8, padding: '8px 14px', flex: 1, minWidth: 140 }}>
          <div style={{ fontSize: 10, color: 'var(--text-3)', marginBottom: 2 }}>YOUR LOCAL TIME</div>
          <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--text-0)' }}>
            {now.toLocaleTimeString()}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-3)' }}>{Intl.DateTimeFormat().resolvedOptions().timeZone}</div>
        </div>
        <div style={{ background: 'var(--bg-3)', borderRadius: 8, padding: '8px 14px', flex: 1, minWidth: 140 }}>
          <div style={{ fontSize: 10, color: 'var(--text-3)', marginBottom: 2 }}>UTC TIME</div>
          <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--text-0)' }}>
            {now.toUTCString().split(' ')[4]}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-3)' }}>Coordinated Universal Time</div>
        </div>
        {overlap && (
          <div style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: 8, padding: '8px 14px', flex: 1, minWidth: 140 }}>
            <div style={{ fontSize: 10, color: '#f87171', marginBottom: 2, fontWeight: 600 }}>PEAK HOURS</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#f87171' }}>London/NY Overlap</div>
            <div style={{ fontSize: 10, color: '#fca5a5' }}>Highest volume now!</div>
          </div>
        )}
      </div>
      {/* Session cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10, marginBottom: 16 }}>
        {FOREX_SESSIONS.map(session => {
          const { active, label } = nextEvent(session.open, session.close)
          const openET = `${session.open}:00 UTC`
          const closeET = `${session.close}:00 UTC`
          return (
            <div key={session.name} style={{ background: active ? `${session.color}18` : 'var(--bg-3)', border: `1px solid ${active ? session.color : 'var(--border)'}`, borderRadius: 8, padding: 12, transition: 'all 0.3s' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 5px', borderRadius: 3, background: 'var(--bg-2)', color: 'var(--text-2)', border: '1px solid var(--border)', letterSpacing: '0.04em' }}>{session.flag}</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: active ? session.color : 'var(--text-1)' }}>{session.name}</span>
                </div>
                <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 10, fontWeight: 700, background: active ? `${session.color}30` : 'var(--bg-2)', color: active ? session.color : 'var(--text-3)' }}>
                  {active ? '● LIVE' : '○ CLOSED'}
                </span>
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-3)', marginBottom: 4 }}>{openET} – {closeET}</div>
              <div style={{ fontSize: 11, color: active ? session.color : 'var(--text-3)', fontWeight: active ? 600 : 400 }}>{label}</div>
              <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 4, lineHeight: 1.4 }}>{session.desc}</div>
            </div>
          )
        })}
      </div>
      {/* Timeline */}
      <div style={{ background: 'var(--bg-3)', borderRadius: 8, padding: 12 }}>
        <div style={{ fontSize: 10, color: 'var(--text-3)', marginBottom: 6, fontWeight: 600 }}>24-HOUR TIMELINE (UTC)</div>
        <div style={{ position: 'relative', height: 40 }}>
          {FOREX_SESSIONS.map(session => {
            const start = (session.open / 24) * 100
            const end = session.close > session.open
              ? (session.close / 24) * 100
              : 100
            const width = end - start
            const active_ = isActive(session.open, session.close)
            return (
              <div key={session.name} title={session.name} style={{ position: 'absolute', left: `${start}%`, width: `${width}%`, height: 24, top: 0, background: session.color, opacity: active_ ? 0.9 : 0.35, borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                <span style={{ fontSize: 9, color: '#fff', fontWeight: 600, whiteSpace: 'nowrap' }}>{session.name}</span>
              </div>
            )
          })}
          {/* Now indicator */}
          <div style={{ position: 'absolute', left: `${(utcHour / 24) * 100}%`, top: 0, height: 40, width: 2, background: 'white', borderRadius: 1, zIndex: 10 }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 9, color: 'var(--text-3)' }}>
          {[0, 4, 8, 12, 16, 20, 24].map(h => <span key={h}>{h}:00</span>)}
        </div>
      </div>
    </Card>
  )
}

// ─── 16. Currency Strength Meter ──────────────────────────────────────────────

const CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'AUD', 'CAD', 'NZD']

function CurrencyStrengthMeter() {
  const [rates, setRates] = useState<Record<string, number> | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [lastUpdated, setLastUpdated] = useState('')

  useEffect(() => {
    const fetchRates = async () => {
      setLoading(true)
      const json = await apiFetchSafe<{ success: boolean; rates: Record<string, number> }>(`${API_BASE}/api/tools/currency-rates`)
      if (!json?.success) setError('unavailable')
      else { setRates(json.rates); setLastUpdated(new Date().toLocaleTimeString()) }
      setLoading(false)
    }
    fetchRates()
  }, [])

  // Calculate strength scores: inverse of USD rate = strength of that currency
  const scores: { currency: string; score: number }[] = rates
    ? CURRENCIES.map(c => {
        const rate = rates[c] || 1
        // Score relative to USD: lower USD rate of foreign currency = stronger foreign currency
        const score = c === 'USD' ? 100 : parseFloat((100 / rate).toFixed(2))
        return { currency: c, score }
      }).sort((a, b) => b.score - a.score)
    : []

  const maxScore = scores[0]?.score || 100
  const getColor = (rank: number) => ['#22c55e', '#4ade80', '#86efac', '#a3a3a3', '#fca5a5', '#f87171', '#ef4444', '#dc2626'][rank] || '#a3a3a3'

  return (
    <Card>
      <SectionTitle toolId="strength" title="Currency Strength Meter" desc="See which major currencies are currently strong or weak relative to USD. Strong currencies are gaining value; weak ones are losing." />
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 16 }}>
        <span style={{ fontSize: 12, color: 'var(--text-3)' }}>How to use this?</span>
        <Tooltip text="Shows which currencies are gaining or losing value relative to others. Strategy: trade strong vs weak pairs. E.g., if GBP is strongest and JPY is weakest, consider buying GBP/JPY." position="right" />
      </div>
      {loading && <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-3)', fontSize: 12 }}>Loading rates…</div>}
      {error && <div style={{ color: 'var(--text-3)', fontSize: 12 }}>Currency data temporarily unavailable.</div>}
      {scores.length > 0 && (
        <>
          <div style={{ marginBottom: 16 }}>
            {scores.map((item, i) => (
              <div key={item.currency} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 10, color: 'var(--text-3)', width: 16, textAlign: 'right' }}>#{i + 1}</span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: getColor(i), fontFamily: 'var(--mono)', width: 36 }}>{item.currency}</span>
                    <span style={{ fontSize: 10, color: 'var(--text-3)' }}>
                      {i === 0 ? 'Strongest' : i === scores.length - 1 ? 'Weakest' : ''}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, fontFamily: 'var(--mono)', color: 'var(--text-2)' }}>
                      {rates && item.currency !== 'USD' ? `1 USD = ${(rates[item.currency] || 1).toFixed(4)} ${item.currency}` : 'Base Currency'}
                    </span>
                  </div>
                </div>
                <div style={{ height: 10, background: 'var(--bg-3)', borderRadius: 5, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${(item.score / maxScore) * 100}%`, background: getColor(i), borderRadius: 5, transition: 'width 0.5s' }} />
                </div>
              </div>
            ))}
          </div>
          {lastUpdated && <div style={{ fontSize: 10, color: 'var(--text-3)' }}>Rates updated: {lastUpdated} · Source: open.er-api.com</div>}
          <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-3)', background: 'var(--accent-dim)', borderRadius: 6, padding: '8px 12px' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><IconInfo size={12} />Strength is relative to USD exchange rates. A trader looking for trend trades would buy the #1 currency against the #8 currency.</span>
          </div>
        </>
      )}
    </Card>
  )
}

// ─── 17. Correlation Matrix ───────────────────────────────────────────────────

function CorrelationMatrix() {
  const [matrix, setMatrix] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const fetchCorr = async () => {
      setLoading(true)
      const json = await apiFetchSafe<{ success: boolean }>(`${API_BASE}/api/tools/correlation`)
      if (!json?.success) setError('unavailable')
      else setMatrix(json)
      setLoading(false)
    }
    fetchCorr()
  }, [])

  const getColor = (val: number | null) => {
    if (val === null || val === undefined) return 'var(--bg-3)'
    if (val === 1) return 'rgba(74,158,255,0.6)'
    if (val > 0.7) return 'rgba(34,197,94,0.7)'
    if (val > 0.3) return 'rgba(34,197,94,0.35)'
    if (val > -0.3) return 'rgba(148,163,184,0.2)'
    if (val > -0.7) return 'rgba(239,68,68,0.3)'
    return 'rgba(239,68,68,0.7)'
  }

  const getTextColor = (val: number | null) => {
    if (val === null || val === undefined) return 'var(--text-3)'
    if (Math.abs(val) > 0.5) return '#fff'
    return 'var(--text-1)'
  }

  return (
    <Card>
      <SectionTitle toolId="correlation" title="Correlation Matrix" desc="See how major assets move in relation to each other. Use this for portfolio diversification — uncorrelated assets reduce overall risk." />
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 16 }}>
        <span style={{ fontSize: 12, color: 'var(--text-3)' }}>How to read this?</span>
        <Tooltip text="Correlation shows how assets move together. +1.0 = always move together. -1.0 = always move opposite. 0 = no relationship. Green = positive correlation, Red = negative. Diversification works best with low/negative correlations." position="right" />
      </div>
      {loading && <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-3)', fontSize: 12 }}>Calculating correlations…</div>}
      {error && <div style={{ color: 'var(--text-3)', fontSize: 12 }}>Correlation data temporarily unavailable.</div>}
      {matrix && (
        <>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', fontSize: 11 }}>
              <thead>
                <tr>
                  <th style={{ padding: '6px 8px', background: 'var(--bg-3)', width: 80, fontSize: 10, color: 'var(--text-3)' }}>Asset</th>
                  {matrix.assets.map((a: string) => (
                    <th key={a} style={{ padding: '6px 8px', background: 'var(--bg-3)', fontSize: 10, fontWeight: 600, color: 'var(--text-2)', whiteSpace: 'nowrap', textAlign: 'center', minWidth: 70 }}>{a}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matrix.matrix.map((row: any) => (
                  <tr key={row.asset}>
                    <td style={{ padding: '6px 8px', background: 'var(--bg-3)', fontSize: 10, fontWeight: 600, color: 'var(--text-2)', whiteSpace: 'nowrap' }}>{row.asset}</td>
                    {row.correlations.map((cell: any) => (
                      <td key={cell.asset} style={{ padding: '6px 8px', background: getColor(cell.value), textAlign: 'center', border: '1px solid rgba(0,0,0,0.15)', borderRadius: 0 }}>
                        <span style={{ fontSize: 11, fontWeight: cell.value === 1 ? 700 : 500, color: getTextColor(cell.value), fontFamily: 'var(--mono)' }}>
                          {cell.value !== null && cell.value !== undefined ? cell.value.toFixed(2) : '—'}
                        </span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 10, color: 'var(--text-3)' }}>Scale:</span>
            {[['Strong +', 'rgba(34,197,94,0.7)', '#fff'], ['Mild +', 'rgba(34,197,94,0.35)', 'var(--text-1)'], ['Neutral', 'rgba(148,163,184,0.2)', 'var(--text-1)'], ['Mild -', 'rgba(239,68,68,0.3)', 'var(--text-1)'], ['Strong -', 'rgba(239,68,68,0.7)', '#fff']].map(([l, bg, tc]) => (
              <span key={l} style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10 }}>
                <span style={{ width: 20, height: 14, background: bg, borderRadius: 2, display: 'inline-block' }} />
                <span style={{ color: 'var(--text-3)' }}>{l}</span>
              </span>
            ))}
          </div>
          <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-3)', background: 'var(--accent-dim)', borderRadius: 6, padding: '8px 12px' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><IconInfo size={12} />Data: {matrix.dataSource === 'live' ? 'Live 90-day returns' : 'Historical average estimates'} · {matrix.period} period. Add uncorrelated assets to your portfolio to reduce risk.</span>
          </div>
        </>
      )}
    </Card>
  )
}

// ─── 18. Profit Target Calculator ────────────────────────────────────────────

function ProfitTargetCalc() {
  const [accountSize, setAccountSize] = useState('10000')
  const [targetPct, setTargetPct] = useState('5')
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly'>('monthly')
  const [tradingDays, setTradingDays] = useState('20')
  const [winRate, setWinRate] = useState('55')
  const [rr, setRr] = useState('2')
  const [months, setMonths] = useState('12')

  const acct = parseFloat(accountSize) || 0
  const tPct = parseFloat(targetPct) || 0
  const days = parseInt(tradingDays) || 20
  const wr = parseFloat(winRate) / 100
  const rrN = parseFloat(rr)
  const monthsN = parseInt(months) || 12

  const periodDays = period === 'daily' ? 1 : period === 'weekly' ? 5 : days
  const periodTarget = acct * (tPct / 100)
  const dailyTarget = periodTarget / (period === 'daily' ? 1 : period === 'weekly' ? 5 : days)

  // Required win rate to breakeven at given R:R
  const breakEvenWR = 1 / (1 + rrN)
  // Expected value per trade
  const ev = wr * rrN - (1 - wr) * 1 // ev per $1 risked

  // Growth projection
  const monthlyRate = period === 'daily' ? tPct * 22 / 100
    : period === 'weekly' ? tPct * 4 / 100
    : tPct / 100
  const projectionData = Array.from({ length: monthsN + 1 }, (_, i) => ({
    month: i,
    value: acct * Math.pow(1 + monthlyRate, i),
  }))
  const maxValue = projectionData[projectionData.length - 1]?.value || acct

  return (
    <Card>
      <SectionTitle toolId="profit" title="Profit Target Calculator" desc="Set realistic profit goals based on your account size, trading frequency, and edge. Most traders fail because they set unrealistic targets." />
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 12 }}>
        <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Why set profit targets?</span>
        <Tooltip text="Helps set realistic profit goals based on your account size and trading frequency. Without targets, traders often overtrade chasing gains. Professional traders aim for 1-3% monthly, compounded over years." position="right" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
        <div>
          <InputField label="Account Size ($)" tooltip="Total capital in your trading account. Your risk calculations are based on this number." value={accountSize} onChange={setAccountSize} placeholder="e.g. 10000" />
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-2)', marginBottom: 4, letterSpacing: '0.05em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 4 }}>
              Target Period
              <Tooltip text="How often you want to hit your percentage target. Daily targets are hardest to sustain. Monthly targets are most realistic for most traders." position="right" />
            </label>
            <div style={{ display: 'flex', gap: 6 }}>
              {(['daily', 'weekly', 'monthly'] as const).map(p => (
                <button key={p} onClick={() => setPeriod(p)} style={{ flex: 1, padding: '7px 4px', borderRadius: 6, border: '1px solid ' + (period === p ? '#6366f1' : 'var(--border)'), background: period === p ? 'rgba(99,102,241,0.2)' : 'transparent', color: period === p ? '#818cf8' : 'var(--text-2)', fontSize: 12, cursor: 'pointer', fontWeight: 600, textTransform: 'capitalize' }}>
                  {p}
                </button>
              ))}
            </div>
          </div>
          <InputField label={`Target % (${period})`} tooltip={`Your ${period} return goal as a percentage. Industry benchmark: 1-3% monthly is excellent. 0.5-1% daily is elite level.`} value={targetPct} onChange={setTargetPct} placeholder="e.g. 5" step="0.1" min="0" />
          <InputField label="Trading Days / Month" tooltip="How many days per month you actively trade. Standard = 20 trading days. Adjust down if you trade fewer days." value={tradingDays} onChange={setTradingDays} placeholder="e.g. 20" min="1" step="1" />
          <InputField label="Win Rate %" tooltip="Your estimated win rate — how many trades are profitable. Most professional traders are at 40-60%." value={winRate} onChange={setWinRate} placeholder="e.g. 55" step="1" min="1" />
          <InputField label="Risk:Reward Ratio" tooltip="Your average R:R per trade. 2 means you make $2 for every $1 risked. Higher R:R allows lower win rates." value={rr} onChange={setRr} placeholder="e.g. 2.0" step="0.1" min="0.1" />
          <InputField label="Projection (months)" tooltip="How many months to project forward for the growth chart." value={months} onChange={setMonths} placeholder="e.g. 12" min="1" step="1" />
        </div>
        <div>
          <div style={{ background: 'var(--bg-3)', borderRadius: 8, padding: 16, marginBottom: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', marginBottom: 12, letterSpacing: '0.05em' }}>YOUR TARGETS</div>
            <ResultRow label={`${period.charAt(0).toUpperCase() + period.slice(1)} $ Target`} value={`$${periodTarget.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} color="var(--green)" tooltip={`Dollar amount you need to make ${period}.`} />
            <ResultRow label="Daily $ Target" value={`$${dailyTarget.toFixed(2)}`} color="var(--accent)" tooltip="Breaking your target into a daily number helps you track progress." />
            <ResultRow label="Break-Even Win Rate" value={`${(breakEvenWR * 100).toFixed(1)}%`} tooltip={`At ${rrN}:1 R:R, you only need to win ${(breakEvenWR * 100).toFixed(1)}% of trades to break even.`} />
            <ResultRow
              label="Expected Value/Trade"
              value={`${ev >= 0 ? '+' : ''}${fmt(ev * 100, 1)}¢ per $1 risked`}
              color={ev >= 0 ? 'var(--green)' : 'var(--red)'}
              tooltip="Expected value tells you how much you expect to make per $1 risked, on average. Positive = profitable system. Negative = losing system." />
            <div style={{ marginTop: 8, padding: '8px 10px', background: ev >= 0 ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', borderRadius: 6, fontSize: 11, color: ev >= 0 ? 'var(--green)' : 'var(--red)' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                {ev >= 0 ? <IconCheck size={12} /> : <IconAlert size={12} />}
                {ev >= 0 ? 'Positive expectancy — this system has an edge!' : 'Negative expectancy — adjust win rate or R:R ratio'}
              </span>
            </div>
          </div>
          {/* Growth chart */}
          <div style={{ background: 'var(--bg-3)', borderRadius: 8, padding: 12 }}>
            <div style={{ fontSize: 10, color: 'var(--text-3)', marginBottom: 6 }}>ACCOUNT GROWTH PROJECTION ({monthsN} months)</div>
            <svg width="100%" height="100" viewBox="0 0 300 100" preserveAspectRatio="none">
              <defs>
                <linearGradient id="projGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#4a9eff" stopOpacity="0.5" />
                  <stop offset="100%" stopColor="#4a9eff" stopOpacity="0" />
                </linearGradient>
              </defs>
              <polygon
                points={['0,100', ...projectionData.map((d, i) => `${i * (300 / monthsN)},${100 - ((d.value - acct) / (maxValue - acct || 1)) * 95}`), `${300},100`].join(' ')}
                fill="url(#projGrad)" />
              <polyline
                points={projectionData.map((d, i) => `${i * (300 / monthsN)},${100 - ((d.value - acct) / (maxValue - acct || 1)) * 95}`).join(' ')}
                fill="none" stroke="var(--accent)" strokeWidth="2" />
            </svg>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--text-3)', marginTop: 2 }}>
              <span>Now: ${acct.toLocaleString()}</span>
              <span>{monthsN}mo: ${maxValue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
            </div>
          </div>
        </div>
      </div>
    </Card>
  )
}

// ─── Tools Hub Page ───────────────────────────────────────────────────────────

const TOOL_CATEGORIES = ['All', 'Trading Calculators', 'Risk & Analytics', 'Planning', 'Market Overview', 'Stocks', 'Options', 'Futures', 'Forex', 'Crypto']

// Section group for organized display
const TOOL_SECTION_GROUPS: Record<string, string> = {
  'positionsizer': 'Trading Calculators',
  'futures':       'Trading Calculators',
  'optionscalc':   'Trading Calculators',
  'forexcalc':     'Trading Calculators',
  'riskreward':    'Trading Calculators',
  'ruin':          'Risk & Analytics',
  'expectancy':    'Risk & Analytics',
  'correlationv2': 'Risk & Analytics',
  'compound2':     'Planning',
  'dividend':      'Planning',
  'sessionclock':  'Market Overview',
  'econheatmap':   'Market Overview',
  'feargreed':     'Market Overview',
  'heatmap':       'Market Overview',
  // Legacy tools keep original categories
}

const TOOL_CATALOG = [
  // ── NEW: Trading Calculators ──
  { id: 'positionsizer', category: 'Trading Calculators', title: 'Universal Position Sizer',         desc: 'Size positions for any asset class — stocks, futures, forex, crypto — based on exact dollar risk. Slider, scenarios, buying power bar.' },
  { id: 'futures',       category: 'Trading Calculators', title: 'Futures Risk/Reward Calculator',   desc: '39 contracts with accurate tick/margin data. Position sizing, multi-target R:R, risk matrix, session indicators.' },
  { id: 'optionscalc',   category: 'Trading Calculators', title: 'Options Profit Calculator',        desc: 'P&L chart across price range, break-even, range scenarios table, optional Greeks (Delta, Gamma, Theta, Vega).' },
  { id: 'forexcalc',     category: 'Trading Calculators', title: 'Forex Position Calculator',        desc: 'Pip value, margin requirements, risk/reward for 21 pairs. Lot size presets, leverage comparison, swap rates.' },
  { id: 'riskreward',    category: 'Trading Calculators', title: 'Risk/Reward Calculator',           desc: 'Visual ratio bar, break-even win rate. Immediate verdict on trade quality.' },
  // ── NEW: Risk & Analytics ──
  { id: 'ruin',          category: 'Risk & Analytics',    title: 'Risk of Ruin Calculator',          desc: 'Monte Carlo simulation with 500 equity curves. Kelly criterion, ruin probability, doubling odds, recommendations.' },
  { id: 'expectancy',    category: 'Risk & Analytics',    title: 'Trade Expectancy Calculator',      desc: 'Is your system profitable? Expected P&L per trade, monthly/annual projections, equity curve simulation.' },
  { id: 'correlationv2', category: 'Risk & Analytics',    title: 'Correlation Matrix',               desc: 'Enter 2–8 custom tickers or use presets. Color-coded grid shows which assets diversify your portfolio.' },
  // ── NEW: Planning ──
  { id: 'compound2',     category: 'Planning',            title: 'Compound Growth Calculator',       desc: 'Monthly contributions, area chart, year-by-year table, monthly/weekly compounding, "if you started N years ago" comparison.' },
  { id: 'dividend',      category: 'Planning',            title: 'Dividend Income Planner',          desc: 'Plan passive income from 16+ preset dividend stocks. DRIP simulation over 5/10/20yr. Reverse calculator for income goals.' },
  // ── NEW: Market Overview ──
  { id: 'sessionclock',  category: 'Market Overview',     title: 'Market Session World Clock',       desc: '7 global markets, 24h timeline, overlap heatmap, "best time to trade" recommendations per asset class.' },
  { id: 'econheatmap',   category: 'Market Overview',     title: 'Economic Calendar Heatmap',        desc: 'Weekly grid of economic events by impact. Red = dangerous day, green = quiet. Plan which days to trade vs sit out.' },
  { id: 'heatmap',       category: 'Market Overview',     title: 'Market Heatmap',                   desc: 'Visual overview of S&P 500 sectors. Green = up, red = down. Spot market trends instantly.' },
  { id: 'feargreed',     category: 'Market Overview',     title: 'Fear & Greed Index',               desc: "Measure crypto market sentiment from 0 (Extreme Fear) to 100 (Extreme Greed). 30-day history." },
  // ── Legacy Tools ──
  { id: 'position',    category: 'Stocks',   title: 'Position Size (Basic)',          desc: 'Simple position sizing by risk %. For advanced universal sizing, use Universal Position Sizer.' },
  { id: 'optionspl',   category: 'Options',  title: 'Options P&L (Simple)',           desc: 'Quick break-even and profit/loss for options. For full P&L chart, use Options Profit Calculator.' },
  { id: 'greeks',      category: 'Options',  title: 'Options Greeks Calculator',      desc: 'Get Delta, Gamma, Theta, Vega using Black-Scholes model.' },
  { id: 'pip',         category: 'Forex',    title: 'Pip Calculator',                 desc: 'Find the dollar value of each pip for any forex pair.' },
  { id: 'lotsize',     category: 'Forex',    title: 'Lot Size Calculator',            desc: 'Determine the right position size for forex trades.' },
  { id: 'compound',    category: 'Planning', title: 'Compound Interest (Basic)',      desc: 'Simple compound interest without contributions. For monthly contributions + chart, use Compound Growth Calculator.' },
  { id: 'fibonacci',   category: 'Stocks',   title: 'Fibonacci Retracement',          desc: 'Calculate key support/resistance levels using Fibonacci ratios.' },
  { id: 'journal',     category: 'Planning', title: 'Trading Journal',                desc: 'Log trades, track performance, analyze patterns. Complete journal with analytics.', href: '/journal' },
  { id: 'screener',    category: 'Stocks',   title: 'Stock Screener',                 desc: 'Filter stocks by P/E, dividend yield, sector, market cap, and price.' },
  { id: 'earnings',    category: 'Stocks',   title: 'Earnings Calendar',              desc: "See which companies report earnings this week or next. BMO/AMC timing, EPS & revenue estimates." },
  { id: 'gas',         category: 'Crypto',   title: 'Gas Fee Tracker',                desc: 'Live Ethereum gas prices in Gwei and USD. Slow/Standard/Fast tiers for common tx types.' },
  { id: 'staking',     category: 'Crypto',   title: 'Staking Rewards Calculator',     desc: 'Calculate daily, weekly, monthly, and yearly staking rewards for ETH, SOL, ADA, DOT, and more.' },
  { id: 'sessions',    category: 'Forex',    title: 'Forex Session Timer',            desc: 'Live countdown to Sydney, Tokyo, London, and New York open/close. Highlights peak overlap periods.' },
  { id: 'strength',    category: 'Forex',    title: 'Currency Strength Meter',        desc: 'Rank USD, EUR, GBP, JPY, CHF, AUD, CAD, NZD by relative strength.' },
  { id: 'correlation', category: 'Risk & Analytics', title: 'Correlation Matrix (Built-in)', desc: 'Fixed matrix of SPY, QQQ, BTC, ETH, Gold, Oil. For custom tickers, use Correlation Matrix.' },
  { id: 'profit',      category: 'Risk & Analytics', title: 'Profit Target Calculator', desc: 'Set daily/weekly/monthly dollar targets. Calculate required win rate and account growth.' },
]

// ─── Tool Card ─────────────────────────────────────────────────────────────────

function ToolCard({ tool, activeTool, setActiveTool }: {
  tool: typeof TOOL_CATALOG[number]
  activeTool: string | null
  setActiveTool: (id: string) => void
}) {
  const isActive = activeTool === tool.id
  return (
    <div
      className="ds-card"
      style={{
        display: 'flex', flexDirection: 'column', gap: 10,
        transition: 'border-color var(--transition), box-shadow var(--transition), transform var(--transition)',
        cursor: 'pointer',
        borderColor: isActive ? 'var(--accent)' : undefined,
        boxShadow: isActive ? '0 4px 16px rgba(74,158,255,0.15)' : undefined,
      }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLDivElement
        el.style.borderColor = 'var(--accent)'; el.style.transform = 'translateY(-2px)'
        el.style.boxShadow = '0 4px 16px rgba(74,158,255,0.12)'
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLDivElement
        el.style.borderColor = isActive ? 'var(--accent)' : 'var(--border)'; el.style.transform = 'none'
        el.style.boxShadow = isActive ? '0 4px 16px rgba(74,158,255,0.15)' : 'var(--card-shadow)'
      }}
      onClick={() => { if ((tool as { href?: string }).href) window.location.href = (tool as { href?: string }).href!; else setActiveTool(tool.id) }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--accent-dim)', border: '1px solid rgba(74,158,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)', flexShrink: 0 }}>
          <ToolIcon id={tool.id} size={18} />
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-0)', lineHeight: 1.3 }}>{tool.title}</div>
          <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 10, background: 'var(--accent-dim)', color: 'var(--accent)', fontWeight: 700, letterSpacing: '0.04em', marginTop: 2, display: 'inline-block' }}>{tool.category}</span>
        </div>
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-2)', lineHeight: 1.6, flex: 1 }}>{tool.desc}</div>
    </div>
  )
}

export default function ToolsPage() {
  const [activeCategory, setActiveCategory] = useState('All')
  const [activeTool, setActiveTool] = useState<string | null>(null)
  const toolSectionRef = useRef<HTMLDivElement>(null)

  const selectTool = (id: string) => {
    setActiveTool(id)
    // After state update, scroll to the tool section
    setTimeout(() => {
      toolSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 100)
  }

  const filteredTools = TOOL_CATALOG.filter(t => activeCategory === 'All' || t.category === activeCategory)

  const renderTool = () => {
    switch (activeTool) {
      // New tools
      case 'positionsizer': return <PositionSizer />
      case 'optionscalc':   return <OptionsCalculator />
      case 'forexcalc':     return <ForexCalculator />
      case 'ruin':          return <RiskOfRuinCalculator />
      case 'expectancy':    return <ExpectancyCalculator />
      case 'correlationv2': return <CorrelationMatrixEnhanced />
      case 'compound2':     return <CompoundCalculator />
      case 'dividend':      return <DividendPlanner />
      case 'sessionclock':  return <SessionClock />
      case 'econheatmap':   return <EconHeatmap />
      // Legacy tools
      case 'position':    return <PositionSizeCalc />
      case 'riskreward':  return <RiskRewardCalc />
      case 'optionspl':   return <OptionsPLCalc />
      case 'greeks':      return <OptionsGreeksCalc />
      case 'pip':         return <PipCalc />
      case 'lotsize':     return <LotSizeCalc />
      case 'compound':    return <CompoundCalc />
      case 'fibonacci':   return <FibonacciCalc />
      case 'screener':    return <StockScreener />
      case 'earnings':    return <EarningsCalendar />
      case 'heatmap':     return <MarketHeatmap />
      case 'feargreed':   return <FearGreedIndex />
      case 'gas':         return <GasFeeTracker />
      case 'staking':     return <StakingRewards />
      case 'sessions':    return <ForexSessionTimer />
      case 'strength':    return <CurrencyStrengthMeter />
      case 'correlation': return <CorrelationMatrix />
      case 'profit':      return <ProfitTargetCalc />
      case 'futures':     return <FuturesCalculator />
      default: return null
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-1)', color: 'var(--text-0)', paddingBottom: 60 }}>
      {/* Persistent Navigation */}
      <PersistentNav />
      {/* Page header */}
      <div className="page-header">
        <a href="/" className="back-link">
          <IconArrowLeft size={16} />
          Back
        </a>
        <div className="page-header-title">
          <span style={{ color: 'var(--accent)' }}><IconTool size={18} /></span>
          Trading Tools
        </div>
        <div className="page-header-desc">Professional calculators for traders of all levels</div>
      </div>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px' }}>

        {activeTool ? (
          // Tool view
          <div ref={toolSectionRef}>
            <button
              onClick={() => setActiveTool(null)}
              className="btn btn-secondary btn-sm"
              style={{ marginBottom: 20, gap: 6 }}
            >
              <IconArrowLeft size={14} />
              Back to Tools
            </button>
            {renderTool()}
          </div>
        ) : (
          // Hub view
          <div>
            {/* Intro banner */}
            <div style={{ marginBottom: 24, padding: '20px 24px', background: 'var(--accent-dim)', border: '1px solid rgba(74,158,255,0.2)', borderRadius: 'var(--card-radius)' }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-0)', marginBottom: 6, letterSpacing: '-0.02em' }}>Professional trading tools to sharpen your edge</div>
              <div style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.65, marginBottom: 12 }}>
                Every tool updates in real-time as you type — no submit buttons. Hover the{' '}
                <Tooltip text="Hover the ? icon next to any label to learn exactly what that field means. No jargon without explanation." position="right" />
                {' '}icon next to any label for a plain-English explanation. All calculations run locally — your data never leaves your browser.
              </div>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                {[
                  { label: 'Real-time', desc: 'Results update as you type' },
                  { label: 'Private', desc: 'All calculations run locally' },
                  { label: 'Explained', desc: 'Every field has a tooltip' },
                  { label: 'Responsive', desc: 'Works on mobile & desktop' },
                ].map(f => (
                  <div key={f.label} style={{ fontSize: 11, color: 'var(--text-2)' }}>
                    <strong style={{ color: 'var(--text-1)' }}>{f.label}</strong> — {f.desc}
                  </div>
                ))}
              </div>
            </div>

            {/* Category tabs */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
              {TOOL_CATEGORIES.map(cat => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={'btn btn-sm' + (activeCategory === cat ? ' btn-accent' : ' btn-secondary')}
                  style={{ borderRadius: 20, fontSize: 11 }}
                >{cat}</button>
              ))}
            </div>

            {/* Tools grid — with section headers for All view */}
            {activeCategory === 'All' ? (
              <>
                {['Trading Calculators', 'Risk & Analytics', 'Planning', 'Market Overview', 'Stocks', 'Options', 'Futures', 'Forex', 'Crypto'].map(section => {
                  const sectionTools = TOOL_CATALOG.filter(t => t.category === section)
                  if (sectionTools.length === 0) return null
                  return (
                    <div key={section} style={{ marginBottom: 28 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
                        {section}
                        <span style={{ fontSize: 10, fontWeight: 400, color: 'var(--text-3)', background: 'var(--bg-3)', padding: '1px 6px', borderRadius: 10 }}>{sectionTools.length}</span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
                        {sectionTools.map(tool => <ToolCard key={tool.id} tool={tool} activeTool={activeTool} setActiveTool={selectTool} />)}
                      </div>
                    </div>
                  )
                })}
              </>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
                {filteredTools.map(tool => <ToolCard key={tool.id} tool={tool} activeTool={activeTool} setActiveTool={selectTool} />)}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-1)', padding: '20px 24px', marginTop: 40 }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <p style={{ fontSize: 12, color: 'var(--text-3)', margin: 0 }}>
            © 2026 TradVue · <a href="/legal/disclaimer" style={{ color: 'var(--text-3)', textDecoration: 'none' }}>Disclaimer</a> · <a href="/help" style={{ color: 'var(--text-3)', textDecoration: 'none' }}>Help</a>
          </p>
          <p style={{ fontSize: 12, color: 'var(--text-3)', margin: 0 }}>
            All calculations for educational purposes only. Not financial advice.
          </p>
        </div>
      </footer>
    </div>
  )
}
