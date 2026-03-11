'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import Tooltip from '../components/Tooltip'
import { IconCalculator, IconChevronDown } from '../components/Icons'

// ─── Types ─────────────────────────────────────────────────────────────────────

interface FuturesContract {
  symbol: string
  name: string
  exchange: string
  tickSize: number
  tickValue: number
  pointValue: number
  contractSize: string
  tradingHours: string
  initialMargin: number
  maintenanceMargin: number
  deliveryMonths: string
  category: string
}

interface Target {
  price: string
  contracts: string
}

// ─── Contract Database (39 contracts) ─────────────────────────────────────────

const CONTRACTS: FuturesContract[] = [
  // Indices
  { symbol: 'ES',  name: 'E-mini S&P 500',         exchange: 'CME',   tickSize: 0.25,       tickValue: 12.50,   pointValue: 50,       contractSize: '$50 × index',       tradingHours: 'Sun–Fri 6pm–5pm ET',          initialMargin: 12650, maintenanceMargin: 11500, deliveryMonths: 'Mar, Jun, Sep, Dec',                    category: 'indices' },
  { symbol: 'NQ',  name: 'E-mini Nasdaq-100',       exchange: 'CME',   tickSize: 0.25,       tickValue: 5.00,    pointValue: 20,       contractSize: '$20 × index',       tradingHours: 'Sun–Fri 6pm–5pm ET',          initialMargin: 17600, maintenanceMargin: 16000, deliveryMonths: 'Mar, Jun, Sep, Dec',                    category: 'indices' },
  { symbol: 'YM',  name: 'E-mini Dow Jones',        exchange: 'CBOT',  tickSize: 1,          tickValue: 5.00,    pointValue: 5,        contractSize: '$5 × index',        tradingHours: 'Sun–Fri 6pm–5pm ET',          initialMargin: 11550, maintenanceMargin: 10500, deliveryMonths: 'Mar, Jun, Sep, Dec',                    category: 'indices' },
  { symbol: 'RTY', name: 'E-mini Russell 2000',     exchange: 'CME',   tickSize: 0.10,       tickValue: 5.00,    pointValue: 50,       contractSize: '$50 × index',       tradingHours: 'Sun–Fri 6pm–5pm ET',          initialMargin: 7000,  maintenanceMargin: 6360,  deliveryMonths: 'Mar, Jun, Sep, Dec',                    category: 'indices' },
  { symbol: 'MES', name: 'Micro E-mini S&P 500',    exchange: 'CME',   tickSize: 0.25,       tickValue: 1.25,    pointValue: 5,        contractSize: '$5 × index',        tradingHours: 'Sun–Fri 6pm–5pm ET',          initialMargin: 1265,  maintenanceMargin: 1150,  deliveryMonths: 'Mar, Jun, Sep, Dec',                    category: 'indices' },
  { symbol: 'MNQ', name: 'Micro E-mini Nasdaq-100', exchange: 'CME',   tickSize: 0.25,       tickValue: 0.50,    pointValue: 2,        contractSize: '$2 × index',        tradingHours: 'Sun–Fri 6pm–5pm ET',          initialMargin: 1760,  maintenanceMargin: 1600,  deliveryMonths: 'Mar, Jun, Sep, Dec',                    category: 'indices' },
  { symbol: 'MYM', name: 'Micro E-mini Dow Jones',  exchange: 'CBOT',  tickSize: 1,          tickValue: 0.50,    pointValue: 0.5,      contractSize: '$0.50 × index',     tradingHours: 'Sun–Fri 6pm–5pm ET',          initialMargin: 1155,  maintenanceMargin: 1050,  deliveryMonths: 'Mar, Jun, Sep, Dec',                    category: 'indices' },
  // Energy
  { symbol: 'CL',  name: 'Crude Oil (WTI)',         exchange: 'NYMEX', tickSize: 0.01,       tickValue: 10.00,   pointValue: 1000,     contractSize: '1,000 barrels',     tradingHours: 'Sun–Fri 6pm–5pm ET',          initialMargin: 6600,  maintenanceMargin: 6000,  deliveryMonths: 'All months',                            category: 'energy' },
  { symbol: 'NG',  name: 'Natural Gas',             exchange: 'NYMEX', tickSize: 0.001,      tickValue: 10.00,   pointValue: 10000,    contractSize: '10,000 MMBtu',      tradingHours: 'Sun–Fri 6pm–5pm ET',          initialMargin: 4800,  maintenanceMargin: 4360,  deliveryMonths: 'All months',                            category: 'energy' },
  { symbol: 'MCL', name: 'Micro Crude Oil',         exchange: 'NYMEX', tickSize: 0.01,       tickValue: 1.00,    pointValue: 100,      contractSize: '100 barrels',       tradingHours: 'Sun–Fri 6pm–5pm ET',          initialMargin: 660,   maintenanceMargin: 600,   deliveryMonths: 'All months',                            category: 'energy' },
  { symbol: 'RB',  name: 'RBOB Gasoline',           exchange: 'NYMEX', tickSize: 0.0001,     tickValue: 4.20,    pointValue: 42000,    contractSize: '42,000 gallons',    tradingHours: 'Sun–Fri 6pm–5pm ET',          initialMargin: 7700,  maintenanceMargin: 7000,  deliveryMonths: 'All months',                            category: 'energy' },
  { symbol: 'HO',  name: 'Heating Oil',             exchange: 'NYMEX', tickSize: 0.0001,     tickValue: 4.20,    pointValue: 42000,    contractSize: '42,000 gallons',    tradingHours: 'Sun–Fri 6pm–5pm ET',          initialMargin: 7700,  maintenanceMargin: 7000,  deliveryMonths: 'All months',                            category: 'energy' },
  // Metals
  { symbol: 'GC',  name: 'Gold',                   exchange: 'COMEX', tickSize: 0.10,       tickValue: 10.00,   pointValue: 100,      contractSize: '100 troy oz',       tradingHours: 'Sun–Fri 6pm–5pm ET',          initialMargin: 11000, maintenanceMargin: 10000, deliveryMonths: 'Feb, Apr, Jun, Aug, Oct, Dec',          category: 'metals' },
  { symbol: 'SI',  name: 'Silver',                 exchange: 'COMEX', tickSize: 0.005,      tickValue: 25.00,   pointValue: 5000,     contractSize: '5,000 troy oz',     tradingHours: 'Sun–Fri 6pm–5pm ET',          initialMargin: 8800,  maintenanceMargin: 8000,  deliveryMonths: 'Mar, May, Jul, Sep, Dec',               category: 'metals' },
  { symbol: 'HG',  name: 'Copper',                 exchange: 'COMEX', tickSize: 0.0005,     tickValue: 12.50,   pointValue: 25000,    contractSize: '25,000 lbs',        tradingHours: 'Sun–Fri 6pm–5pm ET',          initialMargin: 7700,  maintenanceMargin: 7000,  deliveryMonths: 'Mar, May, Jul, Sep, Dec',               category: 'metals' },
  { symbol: 'PL',  name: 'Platinum',               exchange: 'NYMEX', tickSize: 0.10,       tickValue: 5.00,    pointValue: 50,       contractSize: '50 troy oz',        tradingHours: 'Sun–Fri 6pm–5pm ET',          initialMargin: 4400,  maintenanceMargin: 4000,  deliveryMonths: 'Jan, Apr, Jul, Oct',                   category: 'metals' },
  { symbol: 'MGC', name: 'Micro Gold',             exchange: 'COMEX', tickSize: 0.10,       tickValue: 1.00,    pointValue: 10,       contractSize: '10 troy oz',        tradingHours: 'Sun–Fri 6pm–5pm ET',          initialMargin: 1100,  maintenanceMargin: 1000,  deliveryMonths: 'Feb, Apr, Jun, Aug, Oct, Dec',          category: 'metals' },
  { symbol: 'SIL', name: 'Micro Silver',           exchange: 'COMEX', tickSize: 0.005,      tickValue: 2.50,    pointValue: 500,      contractSize: '500 troy oz',       tradingHours: 'Sun–Fri 6pm–5pm ET',          initialMargin: 880,   maintenanceMargin: 800,   deliveryMonths: 'Mar, May, Jul, Sep, Dec',               category: 'metals' },
  // Agriculture
  { symbol: 'ZC',  name: 'Corn',                   exchange: 'CBOT',  tickSize: 0.25,       tickValue: 12.50,   pointValue: 50,       contractSize: '5,000 bushels',     tradingHours: 'Sun–Fri 7pm–7:45am + 8:30am–1:20pm ET', initialMargin: 1500, maintenanceMargin: 1360, deliveryMonths: 'Mar, May, Jul, Sep, Dec',              category: 'agriculture' },
  { symbol: 'ZS',  name: 'Soybeans',               exchange: 'CBOT',  tickSize: 0.25,       tickValue: 12.50,   pointValue: 50,       contractSize: '5,000 bushels',     tradingHours: 'Sun–Fri 7pm–7:45am + 8:30am–1:20pm ET', initialMargin: 2200, maintenanceMargin: 2000, deliveryMonths: 'Jan, Mar, May, Jul, Aug, Sep, Nov',    category: 'agriculture' },
  { symbol: 'ZW',  name: 'Wheat',                  exchange: 'CBOT',  tickSize: 0.25,       tickValue: 12.50,   pointValue: 50,       contractSize: '5,000 bushels',     tradingHours: 'Sun–Fri 7pm–7:45am + 8:30am–1:20pm ET', initialMargin: 1800, maintenanceMargin: 1640, deliveryMonths: 'Mar, May, Jul, Sep, Dec',              category: 'agriculture' },
  { symbol: 'ZL',  name: 'Soybean Oil',            exchange: 'CBOT',  tickSize: 0.01,       tickValue: 6.00,    pointValue: 600,      contractSize: '60,000 lbs',        tradingHours: 'Sun–Fri 7pm–7:45am + 8:30am–1:20pm ET', initialMargin: 770,  maintenanceMargin: 700,  deliveryMonths: 'Jan, Mar, May, Jul, Aug, Sep, Oct, Dec', category: 'agriculture' },
  { symbol: 'CT',  name: 'Cotton #2',              exchange: 'ICE',   tickSize: 0.01,       tickValue: 5.00,    pointValue: 500,      contractSize: '50,000 lbs',        tradingHours: '3:00am–2:20pm ET',            initialMargin: 2200,  maintenanceMargin: 2000,  deliveryMonths: 'Mar, May, Jul, Oct, Dec',               category: 'agriculture' },
  { symbol: 'KC',  name: 'Coffee "C"',             exchange: 'ICE',   tickSize: 0.05,       tickValue: 18.75,   pointValue: 375,      contractSize: '37,500 lbs',        tradingHours: '3:30am–1:00pm ET',            initialMargin: 3000,  maintenanceMargin: 2720,  deliveryMonths: 'Mar, May, Jul, Sep, Dec',               category: 'agriculture' },
  { symbol: 'SB',  name: 'Sugar #11',              exchange: 'ICE',   tickSize: 0.01,       tickValue: 11.20,   pointValue: 1120,     contractSize: '112,000 lbs',       tradingHours: '2:30am–1:00pm ET',            initialMargin: 1540,  maintenanceMargin: 1400,  deliveryMonths: 'Mar, May, Jul, Oct',                   category: 'agriculture' },
  { symbol: 'LE',  name: 'Live Cattle',            exchange: 'CME',   tickSize: 0.025,      tickValue: 10.00,   pointValue: 400,      contractSize: '40,000 lbs',        tradingHours: '8:30am–1:05pm ET',            initialMargin: 2200,  maintenanceMargin: 2000,  deliveryMonths: 'Feb, Apr, Jun, Aug, Oct, Dec',          category: 'agriculture' },
  { symbol: 'HE',  name: 'Lean Hogs',              exchange: 'CME',   tickSize: 0.025,      tickValue: 10.00,   pointValue: 400,      contractSize: '40,000 lbs',        tradingHours: '8:30am–1:05pm ET',            initialMargin: 2500,  maintenanceMargin: 2270,  deliveryMonths: 'Feb, Apr, May, Jun, Jul, Aug, Oct, Dec', category: 'agriculture' },
  // Currencies
  { symbol: '6E',  name: 'Euro FX',                exchange: 'CME',   tickSize: 0.00005,    tickValue: 6.25,    pointValue: 125000,   contractSize: '€125,000',          tradingHours: 'Sun–Fri 5pm–4pm ET',          initialMargin: 2600,  maintenanceMargin: 2360,  deliveryMonths: 'Mar, Jun, Sep, Dec',                    category: 'currencies' },
  { symbol: '6B',  name: 'British Pound',          exchange: 'CME',   tickSize: 0.0001,     tickValue: 6.25,    pointValue: 62500,    contractSize: '£62,500',           tradingHours: 'Sun–Fri 5pm–4pm ET',          initialMargin: 3300,  maintenanceMargin: 3000,  deliveryMonths: 'Mar, Jun, Sep, Dec',                    category: 'currencies' },
  { symbol: '6J',  name: 'Japanese Yen',           exchange: 'CME',   tickSize: 0.0000005,  tickValue: 6.25,    pointValue: 12500000, contractSize: '¥12,500,000',       tradingHours: 'Sun–Fri 5pm–4pm ET',          initialMargin: 3300,  maintenanceMargin: 3000,  deliveryMonths: 'Mar, Jun, Sep, Dec',                    category: 'currencies' },
  { symbol: '6A',  name: 'Australian Dollar',      exchange: 'CME',   tickSize: 0.0001,     tickValue: 10.00,   pointValue: 100000,   contractSize: 'A$100,000',         tradingHours: 'Sun–Fri 5pm–4pm ET',          initialMargin: 2200,  maintenanceMargin: 2000,  deliveryMonths: 'Mar, Jun, Sep, Dec',                    category: 'currencies' },
  { symbol: '6C',  name: 'Canadian Dollar',        exchange: 'CME',   tickSize: 0.00005,    tickValue: 5.00,    pointValue: 100000,   contractSize: 'C$100,000',         tradingHours: 'Sun–Fri 5pm–4pm ET',          initialMargin: 1600,  maintenanceMargin: 1450,  deliveryMonths: 'Mar, Jun, Sep, Dec',                    category: 'currencies' },
  // Rates
  { symbol: 'ZB',  name: '30-Year T-Bond',         exchange: 'CBOT',  tickSize: 0.03125,    tickValue: 31.25,   pointValue: 1000,     contractSize: '$100,000 face',     tradingHours: 'Sun–Fri 6pm–5pm ET',          initialMargin: 3850,  maintenanceMargin: 3500,  deliveryMonths: 'Mar, Jun, Sep, Dec',                    category: 'rates' },
  { symbol: 'ZN',  name: '10-Year T-Note',         exchange: 'CBOT',  tickSize: 0.015625,   tickValue: 15.625,  pointValue: 1000,     contractSize: '$100,000 face',     tradingHours: 'Sun–Fri 6pm–5pm ET',          initialMargin: 1430,  maintenanceMargin: 1300,  deliveryMonths: 'Mar, Jun, Sep, Dec',                    category: 'rates' },
  { symbol: 'ZF',  name: '5-Year T-Note',          exchange: 'CBOT',  tickSize: 0.0078125,  tickValue: 7.8125,  pointValue: 1000,     contractSize: '$100,000 face',     tradingHours: 'Sun–Fri 6pm–5pm ET',          initialMargin: 880,   maintenanceMargin: 800,   deliveryMonths: 'Mar, Jun, Sep, Dec',                    category: 'rates' },
  { symbol: 'ZT',  name: '2-Year T-Note',          exchange: 'CBOT',  tickSize: 0.0078125,  tickValue: 15.625,  pointValue: 2000,     contractSize: '$200,000 face',     tradingHours: 'Sun–Fri 6pm–5pm ET',          initialMargin: 880,   maintenanceMargin: 800,   deliveryMonths: 'Mar, Jun, Sep, Dec',                    category: 'rates' },
  // Crypto
  { symbol: 'BTC', name: 'Bitcoin (CME)',          exchange: 'CME',   tickSize: 5,          tickValue: 25.00,   pointValue: 5,        contractSize: '5 BTC',             tradingHours: 'Sun–Fri 6pm–5pm ET',          initialMargin: 73000, maintenanceMargin: 66400, deliveryMonths: 'Mar, Jun, Sep, Dec + nearest 2 mo',     category: 'crypto' },
  { symbol: 'MBT', name: 'Micro Bitcoin',          exchange: 'CME',   tickSize: 5,          tickValue: 2.50,    pointValue: 0.5,      contractSize: '0.1 BTC',           tradingHours: 'Sun–Fri 6pm–5pm ET',          initialMargin: 7300,  maintenanceMargin: 6640,  deliveryMonths: 'Mar, Jun, Sep, Dec + nearest 2 mo',     category: 'crypto' },
  { symbol: 'ETH', name: 'Ether (CME)',            exchange: 'CME',   tickSize: 0.05,       tickValue: 2.50,    pointValue: 50,       contractSize: '50 ETH',            tradingHours: 'Sun–Fri 6pm–5pm ET',          initialMargin: 13200, maintenanceMargin: 12000, deliveryMonths: 'Mar, Jun, Sep, Dec + nearest 2 mo',     category: 'crypto' },
]

const CONTRACT_MAP = new Map(CONTRACTS.map(c => [c.symbol, c]))

const CONTRACT_GROUPS: { label: string; key: string; emoji: string }[] = [
  { label: 'Indices',     key: 'indices',     emoji: '📊' },
  { label: 'Energy',      key: 'energy',      emoji: '⛽' },
  { label: 'Metals',      key: 'metals',      emoji: '🥇' },
  { label: 'Agriculture', key: 'agriculture', emoji: '🌾' },
  { label: 'Currencies',  key: 'currencies',  emoji: '💱' },
  { label: 'Rates',       key: 'rates',       emoji: '📈' },
  { label: 'Crypto',      key: 'crypto',      emoji: '₿'  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt2 = (n: number) => isNaN(n) || !isFinite(n) ? '—' : n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtDollar = (n: number) => isNaN(n) || !isFinite(n) ? '—' : '$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtDollarSigned = (n: number) => isNaN(n) || !isFinite(n) ? '—' : (n >= 0 ? '+$' : '-$') + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtInt = (n: number) => isNaN(n) || !isFinite(n) ? '—' : Math.floor(n).toLocaleString()
const fmtPrice = (n: number, tickSize: number) => {
  if (isNaN(n) || !isFinite(n)) return '—'
  const decimals = tickSize < 0.01 ? 6 : tickSize < 0.1 ? 4 : tickSize < 1 ? 2 : 0
  return n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

function getETHour(): number {
  try {
    const now = new Date()
    const etStr = now.toLocaleString('en-US', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', hour12: false })
    const parts = etStr.split(':')
    const h = parseInt(parts[0]) || 0
    const m = parseInt(parts[1]) || 0
    return h + m / 60
  } catch {
    return new Date().getHours() + new Date().getMinutes() / 60
  }
}

function isSessionActive(openHour: number, closeHour: number, currentHour: number): boolean {
  if (openHour < closeHour) return currentHour >= openHour && currentHour < closeHour
  return currentHour >= openHour || currentHour < closeHour
}

function hoursUntil(targetHour: number, currentHour: number): number {
  let diff = targetHour - currentHour
  if (diff <= 0) diff += 24
  return diff
}

function fmtCountdown(hours: number): string {
  const h = Math.floor(hours)
  const m = Math.floor((hours - h) * 60)
  if (h === 0) return `${m}m`
  return `${h}h ${m}m`
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function InputNum({
  label, tooltip, value, onChange, placeholder, min, step, suffix,
}: {
  label: string; tooltip?: string; value: string; onChange: (v: string) => void;
  placeholder?: string; min?: string; step?: string; suffix?: string
}) {
  return (
    <div style={{ marginBottom: 10 }}>
      <label className="ds-label" style={{ display: 'flex', alignItems: 'center' }}>
        {label}
        {tooltip && <Tooltip text={tooltip} position="right" />}
      </label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <input
          type="number"
          value={value}
          min={min}
          step={step || 'any'}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="ds-input"
          style={{ fontFamily: 'var(--mono)', flex: 1 }}
        />
        {suffix && <span style={{ fontSize: 12, color: 'var(--text-3)', flexShrink: 0 }}>{suffix}</span>}
      </div>
    </div>
  )
}

function QuickBtns({ values, active, onClick, prefix = '', suffix = '' }: {
  values: (string | number)[]
  active?: string | number
  onClick: (v: string) => void
  prefix?: string
  suffix?: string
}) {
  return (
    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 10, marginTop: -4 }}>
      {values.map(v => (
        <button
          key={v}
          onClick={() => onClick(String(v))}
          style={{
            padding: '3px 8px', fontSize: 11, borderRadius: 5, cursor: 'pointer',
            border: '1px solid ' + (String(v) === String(active) ? 'var(--accent)' : 'var(--border)'),
            background: String(v) === String(active) ? 'var(--accent-dim)' : 'var(--bg-3)',
            color: String(v) === String(active) ? 'var(--accent)' : 'var(--text-3)',
            fontFamily: 'var(--mono)', fontWeight: 600, transition: 'all 0.15s',
          }}
        >
          {prefix}{v}{suffix}
        </button>
      ))}
    </div>
  )
}

function ResultCard({ label, value, sub, borderColor, badge }: {
  label: string; value: string; sub?: string; borderColor?: string; badge?: { text: string; color: string }
}) {
  return (
    <div style={{
      background: 'var(--bg-3)', borderRadius: 10, padding: '14px 16px',
      borderLeft: borderColor ? `3px solid ${borderColor}` : '3px solid transparent',
      flex: '1 1 0', minWidth: 0,
    }}>
      <div style={{ fontSize: 10, color: 'var(--text-3)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--text-0)', lineHeight: 1.2 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 3 }}>{sub}</div>}
      {badge && (
        <span style={{
          display: 'inline-block', marginTop: 6, padding: '2px 8px', borderRadius: 10,
          fontSize: 10, fontWeight: 700, background: badge.color + '22', color: badge.color,
          border: `1px solid ${badge.color}44`,
        }}>{badge.text}</span>
      )}
    </div>
  )
}

// ─── Visual R:R Bar ────────────────────────────────────────────────────────────

function RRBar({ entry, stop, targets, direction, contract }: {
  entry: number; stop: number; targets: { price: number; contracts: number }[];
  direction: 'long' | 'short'; contract: FuturesContract
}) {
  const validTargets = targets.filter(t => t.price > 0)
  if (!entry || !stop || Math.abs(entry - stop) < contract.tickSize * 0.1) return null

  const allPrices = [stop, entry, ...validTargets.map(t => t.price)]
  const minP = Math.min(...allPrices)
  const maxP = Math.max(...allPrices)
  const range = maxP - minP || 1
  const pad = range * 0.18
  const lo = minP - pad
  const hi = maxP + pad
  const totalRange = hi - lo

  const toX = (price: number) => Math.max(0, Math.min(100, ((price - lo) / totalRange) * 100))

  const stopX  = toX(stop)
  const entryX = toX(entry)
  const targetXs = validTargets.map(t => toX(t.price))

  const isLong = direction === 'long'
  const riskTicks = Math.abs(entry - stop) / contract.tickSize
  const riskDollar = riskTicks * contract.tickValue

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', marginBottom: 10, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
        Visual Risk / Reward
      </div>
      <div style={{ position: 'relative', height: 70, userSelect: 'none' }}>
        {/* Track */}
        <div style={{
          position: 'absolute', top: 22, left: 0, right: 0, height: 16,
          background: 'var(--bg-2)', borderRadius: 8,
        }} />

        {/* Risk zone: between stop and entry */}
        {isLong ? (
          <div style={{
            position: 'absolute', top: 22, left: `${Math.min(stopX, entryX)}%`,
            width: `${Math.abs(entryX - stopX)}%`, height: 16,
            background: 'rgba(239,68,68,0.6)', borderRadius: stopX < entryX ? '8px 0 0 8px' : '0 8px 8px 0',
          }} />
        ) : (
          <div style={{
            position: 'absolute', top: 22, left: `${Math.min(stopX, entryX)}%`,
            width: `${Math.abs(entryX - stopX)}%`, height: 16,
            background: 'rgba(239,68,68,0.6)', borderRadius: entryX < stopX ? '8px 0 0 8px' : '0 8px 8px 0',
          }} />
        )}

        {/* Reward zones: between entry and each target */}
        {validTargets.map((t, i) => {
          const txX = targetXs[i]
          const l = Math.min(entryX, txX)
          const w = Math.abs(txX - entryX)
          const opacity = 0.8 - i * 0.15
          return (
            <div key={i} style={{
              position: 'absolute', top: 22, left: `${l}%`, width: `${w}%`, height: 16,
              background: `rgba(34,197,94,${opacity})`,
              borderRadius: isLong ? (txX > entryX ? '0 8px 8px 0' : '8px 0 0 8px') : (txX < entryX ? '8px 0 0 8px' : '0 8px 8px 0'),
            }} />
          )
        })}

        {/* Price markers */}
        {[
          { x: stopX,  label: 'STOP',  price: stop,  color: '#ef4444', index: 0 },
          { x: entryX, label: 'ENTRY', price: entry, color: 'var(--text-0)', index: 1 },
          ...validTargets.map((t, i) => ({ x: targetXs[i], label: `T${i + 1}`, price: t.price, color: '#22c55e', index: i + 2 })),
        ].map(marker => (
          <div key={marker.label} style={{ position: 'absolute', left: `${marker.x}%`, top: 0, transform: 'translateX(-50%)' }}>
            {/* Vertical line */}
            <div style={{ position: 'absolute', left: '50%', top: 18, width: 2, height: 24, background: marker.color, transform: 'translateX(-50%)', borderRadius: 1 }} />
            {/* Label above */}
            <div style={{ position: 'absolute', bottom: 44, left: '50%', transform: 'translateX(-50%)', whiteSpace: 'nowrap', textAlign: 'center' }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: marker.color, letterSpacing: '0.04em' }}>{marker.label}</div>
              <div style={{ fontSize: 10, fontFamily: 'var(--mono)', color: marker.color }}>{fmtPrice(marker.price, contract.tickSize)}</div>
            </div>
          </div>
        ))}

        {/* R:R label below bar */}
        {validTargets.length > 0 && (
          <div style={{ position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)', whiteSpace: 'nowrap' }}>
            {validTargets.map((t, i) => {
              const rewardTicks = Math.abs(t.price - entry) / contract.tickSize
              const rewardDollar = rewardTicks * contract.tickValue
              const rr = riskDollar > 0 ? rewardDollar / riskDollar : 0
              return (
                <span key={i} style={{ fontSize: 11, color: '#22c55e', fontWeight: 700, fontFamily: 'var(--mono)', marginRight: 10 }}>
                  T{i + 1}: 1:{fmt2(rr)}
                </span>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Session Indicators ────────────────────────────────────────────────────────

function SessionIndicators() {
  const [etHour, setEtHour] = useState(getETHour)

  useEffect(() => {
    const t = setInterval(() => setEtHour(getETHour()), 10000)
    return () => clearInterval(t)
  }, [])

  const sessions = [
    { name: 'Asian',    flag: '🌏', open: 18, close: 3,  color: '#f59e0b', desc: 'CME Globex open' },
    { name: 'London',   flag: '🇬🇧', open: 3,  close: 12, color: '#3b82f6', desc: 'High liquidity' },
    { name: 'New York', flag: '🗽', open: 8.5,close: 16, color: '#22c55e', desc: 'US pit session' },
  ]

  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
      {sessions.map(s => {
        const active = isSessionActive(s.open, s.close, etHour)
        const nextChangeHour = active ? s.close : s.open
        const hoursLeft = hoursUntil(nextChangeHour, etHour)
        return (
          <div key={s.name} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px',
            borderRadius: 20, border: `1px solid ${active ? s.color : 'var(--border)'}`,
            background: active ? s.color + '15' : 'var(--bg-3)',
            flex: '1 1 auto', minWidth: 130,
          }}>
            <span style={{ fontSize: 14 }}>{s.flag}</span>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: active ? s.color : 'var(--text-3)', display: 'inline-block' }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: active ? s.color : 'var(--text-2)' }}>{s.name}</span>
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-3)' }}>
                {active ? `Closes in ${fmtCountdown(hoursLeft)}` : `Opens in ${fmtCountdown(hoursLeft)}`}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Risk Grid Table ───────────────────────────────────────────────────────────

function RiskGrid({ accountSize, dollarRiskPerContract }: { accountSize: number; dollarRiskPerContract: number }) {
  const riskPcts = [0.5, 1, 1.5, 2, 3, 5, 8]
  if (!accountSize || !dollarRiskPerContract) return null

  return (
    <div style={{ marginTop: 20 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', marginBottom: 8, letterSpacing: '0.06em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6 }}>
        Risk % Matrix
        <Tooltip text="Shows how many contracts you can trade at different risk percentages. Green = conservative (≤1%), Yellow = moderate (≤3%), Red = aggressive (>3%)." position="right" />
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: 'var(--bg-3)' }}>
              <th style={{ padding: '7px 10px', textAlign: 'left', fontSize: 10, color: 'var(--text-3)', fontWeight: 600, whiteSpace: 'nowrap' }}>Risk %</th>
              {riskPcts.map(pct => (
                <th key={pct} style={{
                  padding: '7px 10px', textAlign: 'center', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap',
                  color: pct <= 1 ? '#22c55e' : pct <= 3 ? '#f59e0b' : '#ef4444',
                }}>{pct}%</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderTop: '1px solid var(--border)' }}>
              <td style={{ padding: '7px 10px', color: 'var(--text-2)', fontSize: 11, whiteSpace: 'nowrap' }}>Max Risk $</td>
              {riskPcts.map(pct => {
                const maxRisk = accountSize * pct / 100
                return (
                  <td key={pct} style={{ padding: '7px 10px', textAlign: 'center', fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 600, color: 'var(--text-1)' }}>
                    ${maxRisk.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </td>
                )
              })}
            </tr>
            <tr style={{ borderTop: '1px solid var(--border)' }}>
              <td style={{ padding: '7px 10px', color: 'var(--text-2)', fontSize: 11, whiteSpace: 'nowrap' }}>Contracts</td>
              {riskPcts.map(pct => {
                const maxRisk = accountSize * pct / 100
                const contracts = dollarRiskPerContract > 0 ? Math.floor(maxRisk / dollarRiskPerContract) : 0
                const bgColor = pct <= 1 ? 'rgba(34,197,94,0.1)' : pct <= 3 ? 'rgba(245,158,11,0.08)' : 'rgba(239,68,68,0.08)'
                return (
                  <td key={pct} style={{ padding: '7px 10px', textAlign: 'center', fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 700, background: bgColor, color: pct <= 1 ? '#22c55e' : pct <= 3 ? '#f59e0b' : '#ef4444' }}>
                    {contracts > 0 ? contracts : '—'}
                  </td>
                )
              })}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Main Calculator ───────────────────────────────────────────────────────────

const LS_KEY = 'cg_futures_calc'

const DEFAULT_STATE = {
  symbol: 'ES',
  direction: 'long' as 'long' | 'short',
  entry: '5800',
  stop: '5790',
  contracts: '1',
  accountSize: '25000',
  maxRiskPct: '2',
  targets: [
    { price: '5820', contracts: '1' },
    { price: '',     contracts: '' },
    { price: '',     contracts: '' },
  ] as Target[],
  numTargets: 1,
  showInstructions: false,
}

export default function FuturesCalculator() {
  const [state, setState] = useState(DEFAULT_STATE)
  const [hydrated, setHydrated] = useState(false)

  // ── Load from localStorage (client-only) ──────────────────────────────────
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY)
      if (raw) {
        const saved = JSON.parse(raw)
        setState(prev => ({ ...prev, ...saved }))
      }
    } catch {}
    setHydrated(true)
  }, [])

  // ── Save to localStorage on change ─────────────────────────────────────────
  useEffect(() => {
    if (!hydrated) return
    try { localStorage.setItem(LS_KEY, JSON.stringify(state)) } catch {}
  }, [state, hydrated])

  const set = useCallback(<K extends keyof typeof DEFAULT_STATE>(key: K, value: typeof DEFAULT_STATE[K]) => {
    setState(prev => ({ ...prev, [key]: value }))
  }, [])

  const setTarget = useCallback((idx: number, field: keyof Target, value: string) => {
    setState(prev => {
      const next = [...prev.targets] as Target[]
      next[idx] = { ...next[idx], [field]: value }
      return { ...prev, targets: next }
    })
  }, [])

  // ── Derived values ─────────────────────────────────────────────────────────
  const contract = useMemo(() => CONTRACT_MAP.get(state.symbol) || CONTRACT_MAP.get('ES')!, [state.symbol])

  const calc = useMemo(() => {
    const entryN      = parseFloat(state.entry)      || 0
    const stopN       = parseFloat(state.stop)       || 0
    const contractsN  = Math.max(1, parseInt(state.contracts) || 1)
    const accountN    = parseFloat(state.accountSize) || 0
    const riskPctN    = parseFloat(state.maxRiskPct)  || 2

    const ticksAtRisk        = stopN > 0 && entryN > 0 ? Math.abs(entryN - stopN) / contract.tickSize : 0
    const dollarRiskPerContr = ticksAtRisk * contract.tickValue
    const totalRisk          = dollarRiskPerContr * contractsN
    const riskPctOfAccount   = accountN > 0 ? (totalRisk / accountN) * 100 : 0
    const pointsAtRisk       = ticksAtRisk * contract.tickSize

    const maxByRisk   = accountN > 0 && dollarRiskPerContr > 0 ? Math.floor(accountN * (riskPctN / 100) / dollarRiskPerContr) : 0
    const maxByMargin = accountN > 0 ? Math.floor(accountN / contract.initialMargin) : 0
    const suggested   = Math.min(maxByRisk, maxByMargin)

    const marginRequired    = contract.initialMargin * contractsN
    const marginPctOfAcct   = accountN > 0 ? (marginRequired / accountN) * 100 : 0
    const remainingBalance  = accountN - marginRequired - totalRisk
    const maxDrawdown       = totalRisk

    const riskLevel = riskPctOfAccount <= 1 ? 'Conservative' : riskPctOfAccount <= 3 ? 'Moderate' : 'Aggressive'
    const riskLevelColor = riskPctOfAccount <= 1 ? '#22c55e' : riskPctOfAccount <= 3 ? '#f59e0b' : '#ef4444'

    const targetCalcs = state.targets.map((t, i) => {
      if (!t.price || i >= state.numTargets) return null
      const tPrice   = parseFloat(t.price) || 0
      const tContracts = parseInt(t.contracts) || contractsN
      if (tPrice <= 0) return null
      const tTicks    = Math.abs(tPrice - entryN) / contract.tickSize
      const tDollarPC = tTicks * contract.tickValue
      const tTotal    = tDollarPC * tContracts
      const rr        = dollarRiskPerContr > 0 ? tDollarPC / dollarRiskPerContr : 0
      const points    = Math.abs(tPrice - entryN)
      return { tPrice, tContracts, tTicks, tDollarPC, tTotal, rr, points }
    })

    // Profit target cards (1:1, 1:2, 1:3 from entry)
    const calcTarget = (rrRatio: number) => {
      const pointsMove  = pointsAtRisk * rrRatio
      const targetPrice = state.direction === 'long' ? entryN + pointsMove : entryN - pointsMove
      const dollarTotal = dollarRiskPerContr * rrRatio * contractsN
      return { price: targetPrice, dollar: dollarTotal, points: pointsMove }
    }

    return {
      entryN, stopN, contractsN, accountN, riskPctN,
      ticksAtRisk, dollarRiskPerContr, totalRisk, riskPctOfAccount, pointsAtRisk,
      maxByRisk, maxByMargin, suggested,
      marginRequired, marginPctOfAcct, remainingBalance, maxDrawdown,
      riskLevel, riskLevelColor,
      targetCalcs,
      quickTargets: [
        { label: '1:1', ...calcTarget(1) },
        { label: '1:2', ...calcTarget(2) },
        { label: '1:3', ...calcTarget(3) },
      ],
    }
  }, [state, contract])

  // ── Stop loss quick-set from points ───────────────────────────────────────
  const setStopFromPoints = useCallback((pts: number) => {
    const entryN = parseFloat(state.entry) || 0
    if (!entryN) return
    const stopPrice = state.direction === 'long' ? entryN - pts : entryN + pts
    // Round to nearest tick
    const rounded = Math.round(stopPrice / contract.tickSize) * contract.tickSize
    set('stop', fmtPrice(rounded, contract.tickSize))
  }, [state.entry, state.direction, contract.tickSize, set])

  const activeStopPoints = useMemo(() => {
    const entryN = parseFloat(state.entry) || 0
    const stopN  = parseFloat(state.stop)  || 0
    if (!entryN || !stopN) return null
    const pts = Math.abs(entryN - stopN)
    const presets = [5, 10, 15, 20, 30, 50]
    return presets.find(p => Math.abs(p - pts) < contract.tickSize) ?? null
  }, [state.entry, state.stop, contract.tickSize])

  if (!hydrated) return null

  const { entry, stop, contracts, accountSize, maxRiskPct, direction, targets, numTargets, symbol, showInstructions } = state
  const c = calc

  return (
    <div className="ds-card" style={{ padding: 0, overflow: 'hidden' }}>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ padding: '20px 24px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <span style={{ color: 'var(--accent)', flexShrink: 0 }}><IconCalculator size={22} /></span>
          <h2 className="section-title" style={{ fontSize: 18, margin: 0 }}>Futures Risk/Reward Calculator</h2>
        </div>
        <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--text-2)', lineHeight: 1.5 }}>
          Professional futures calculator — position sizing, tick risk, margin requirements, and multi-target R:R. 39 contracts. Real-time.
        </p>

        {/* ── How to Use (collapsible) ─────────────────────────────────────── */}
        <div style={{ marginBottom: 16, border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
          <button
            onClick={() => set('showInstructions', !showInstructions)}
            style={{
              width: '100%', padding: '10px 14px', background: 'var(--bg-3)', border: 'none',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              color: 'var(--text-1)', fontSize: 13, fontWeight: 600,
            }}
          >
            <span>📖 How to Use this Calculator</span>
            <span style={{ transform: showInstructions ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', color: 'var(--text-3)' }}>
              <IconChevronDown size={16} />
            </span>
          </button>
          {showInstructions && (
            <div style={{ padding: '14px 16px', background: 'var(--bg-2)', borderTop: '1px solid var(--border)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
                {[
                  { step: '1', title: 'Select a Contract', desc: 'Choose the futures contract you want to trade from the dropdown. Contracts are grouped by asset class.' },
                  { step: '2', title: 'Set Direction', desc: 'Long (bullish) if you expect the price to rise. Short (bearish) if you expect it to fall.' },
                  { step: '3', title: 'Enter Your Entry Price', desc: 'The price at which you plan to open the trade. Use market or limit price.' },
                  { step: '4', title: 'Set Stop Loss', desc: 'The price where you\'ll exit if wrong. Use the quick-set buttons to set a stop X points away from entry.' },
                  { step: '5', title: 'Enter Account Size', desc: 'Your total account balance. Used to calculate position size and risk percentage.' },
                  { step: '6', title: 'Set Max Risk %', desc: 'The maximum % of account to risk. Professional traders typically use 1–2% per trade.' },
                  { step: '7', title: 'Adjust Contracts', desc: 'The calculator suggests contracts based on risk. Use the slider to override manually.' },
                  { step: '8', title: 'Add Profit Targets', desc: 'Optional: set up to 3 targets with partial position sizes to calculate blended R:R.' },
                ].map(item => (
                  <div key={item.step} style={{ display: 'flex', gap: 10 }}>
                    <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--accent-dim)', border: '1px solid rgba(74,158,255,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 10, fontWeight: 700, color: 'var(--accent)' }}>{item.step}</div>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-1)' }}>{item.title}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-3)', lineHeight: 1.4 }}>{item.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 12, padding: '8px 12px', background: 'var(--accent-dim)', borderRadius: 6, fontSize: 11, color: 'var(--text-2)' }}>
                💡 <strong>Key terms:</strong> A <em>tick</em> is the smallest price increment. A <em>point</em> is 1 full price unit. Each tick = 1 tick value in P&L. Margin is the deposit required to hold 1 contract overnight.
              </div>
            </div>
          )}
        </div>

        {/* ── Contract + Direction ─────────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', marginBottom: 12, flexWrap: 'wrap' }}>
          {/* Contract selector */}
          <div style={{ flex: '1 1 200px', minWidth: 180 }}>
            <label className="ds-label" style={{ display: 'flex', alignItems: 'center' }}>
              Contract
              <Tooltip text="Choose your futures contract. Tick size, tick value, point value, and margin are auto-filled from the contract spec." position="right" />
            </label>
            <select
              value={symbol}
              onChange={e => set('symbol', e.target.value)}
              className="ds-select"
            >
              {CONTRACT_GROUPS.map(group => (
                <optgroup key={group.key} label={`${group.emoji} ${group.label}`}>
                  {CONTRACTS.filter(c => c.category === group.key).map(c => (
                    <option key={c.symbol} value={c.symbol}>
                      {c.symbol} — {c.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          {/* Direction toggle */}
          <div style={{ flex: '0 0 auto' }}>
            <label className="ds-label" style={{ display: 'flex', alignItems: 'center' }}>
              Direction
              <Tooltip text="Long = you profit when price rises. Short = you profit when price falls." position="right" />
            </label>
            <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)' }}>
              <button
                onClick={() => set('direction', 'long')}
                style={{
                  padding: '9px 24px', fontSize: 13, fontWeight: 700, cursor: 'pointer', border: 'none',
                  background: direction === 'long' ? 'rgba(34,197,94,0.25)' : 'var(--bg-3)',
                  color: direction === 'long' ? '#22c55e' : 'var(--text-3)',
                  borderRight: '1px solid var(--border)', transition: 'all 0.15s',
                }}
              >
                ▲ LONG
              </button>
              <button
                onClick={() => set('direction', 'short')}
                style={{
                  padding: '9px 24px', fontSize: 13, fontWeight: 700, cursor: 'pointer', border: 'none',
                  background: direction === 'short' ? 'rgba(239,68,68,0.25)' : 'var(--bg-3)',
                  color: direction === 'short' ? '#ef4444' : 'var(--text-3)',
                  transition: 'all 0.15s',
                }}
              >
                ▼ SHORT
              </button>
            </div>
          </div>
        </div>

        {/* ── Session Indicators ──────────────────────────────────────────── */}
        <SessionIndicators />
      </div>

      {/* ── Main Grid ──────────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 0 }}>

        {/* LEFT: Inputs ──────────────────────────────────────────────────── */}
        <div style={{ padding: '0 24px 20px', borderRight: '1px solid var(--border)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', marginBottom: 14, marginTop: 16, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Trade Setup
          </div>

          {/* Entry */}
          <InputNum
            label="Entry Price"
            tooltip={`The price at which you enter the trade. For ${contract.symbol}, prices are in ${contract.contractSize.includes('$') ? 'USD index points' : 'USD per unit'}.`}
            value={entry}
            onChange={v => set('entry', v)}
            placeholder={direction === 'long' ? 'e.g. 5800.00' : 'e.g. 5800.00'}
            step={String(contract.tickSize)}
          />

          {/* Stop Loss */}
          <InputNum
            label="Stop Loss Price"
            tooltip={`The price where you exit if the trade goes against you. For a ${direction} position, your stop should be ${direction === 'long' ? 'below' : 'above'} your entry.`}
            value={stop}
            onChange={v => set('stop', v)}
            placeholder={direction === 'long' ? 'e.g. 5790.00' : 'e.g. 5810.00'}
            step={String(contract.tickSize)}
          />
          <div style={{ marginTop: -4, marginBottom: 4 }}>
            <div style={{ fontSize: 10, color: 'var(--text-3)', marginBottom: 4 }}>Quick-set stop distance (points from entry):</div>
            <QuickBtns
              values={[5, 10, 15, 20, 30, 50]}
              active={activeStopPoints ?? undefined}
              onClick={v => setStopFromPoints(Number(v))}
              suffix=" pts"
            />
          </div>

          {/* Contracts + Slider */}
          <div style={{ marginBottom: 10 }}>
            <label className="ds-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ display: 'flex', alignItems: 'center' }}>
                Contracts
                <Tooltip text="Number of contracts to trade. Each contract controls a fixed amount of the underlying asset. More contracts = more risk AND more reward." position="right" />
              </span>
              {c.suggested > 0 && (
                <button
                  onClick={() => set('contracts', String(c.suggested))}
                  style={{ fontSize: 10, color: 'var(--accent)', background: 'var(--accent-dim)', border: '1px solid rgba(74,158,255,0.3)', borderRadius: 4, padding: '2px 7px', cursor: 'pointer' }}
                >
                  Use suggested: {c.suggested}
                </button>
              )}
            </label>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <input
                type="number"
                value={contracts}
                min="1"
                max="100"
                step="1"
                onChange={e => set('contracts', e.target.value)}
                className="ds-input"
                style={{ fontFamily: 'var(--mono)', width: 80, flexShrink: 0 }}
              />
              <input
                type="range"
                min="1"
                max="25"
                step="1"
                value={Math.min(25, parseInt(contracts) || 1)}
                onChange={e => set('contracts', e.target.value)}
                style={{ flex: 1, accentColor: 'var(--accent)' }}
              />
              <span style={{ fontSize: 12, color: 'var(--text-3)', width: 28, textAlign: 'right', flexShrink: 0 }}>
                {Math.min(25, parseInt(contracts) || 1)}
              </span>
            </div>
            {c.suggested > 0 && (
              <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>
                Suggested by risk: <strong style={{ color: 'var(--text-1)' }}>{c.maxByRisk}</strong> · By margin: <strong style={{ color: 'var(--text-1)' }}>{c.maxByMargin}</strong>
              </div>
            )}
          </div>

          <div style={{ height: 1, background: 'var(--border)', margin: '12px 0' }} />
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', marginBottom: 10, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Position Sizing
          </div>

          {/* Account Size */}
          <InputNum
            label="Account Size ($)"
            tooltip="Your total trading account balance. Used to calculate maximum contracts based on risk % and margin requirements."
            value={accountSize}
            onChange={v => set('accountSize', v)}
            placeholder="e.g. 25000"
          />
          <QuickBtns
            values={['5000', '10000', '25000', '50000', '100000']}
            active={accountSize}
            onClick={v => set('accountSize', v)}
            prefix="$"
          />

          {/* Max Risk % */}
          <div style={{ marginBottom: 10 }}>
            <label className="ds-label" style={{ display: 'flex', alignItems: 'center' }}>
              Max Risk % Per Trade
              <Tooltip text="Maximum percentage of your account to risk on this trade. Professional traders typically risk 0.5–2%. Higher = more aggressive, higher chance of blowing up." position="right" />
            </label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="number"
                value={maxRiskPct}
                min="0.1"
                max="20"
                step="0.5"
                onChange={e => set('maxRiskPct', e.target.value)}
                className="ds-input"
                style={{ fontFamily: 'var(--mono)', width: 80 }}
              />
              <span style={{ fontSize: 13, color: 'var(--text-3)' }}>%</span>
            </div>
          </div>
          <QuickBtns
            values={['0.5', '1', '1.5', '2', '3']}
            active={maxRiskPct}
            onClick={v => set('maxRiskPct', v)}
            suffix="%"
          />

          <div style={{ height: 1, background: 'var(--border)', margin: '12px 0' }} />

          {/* Profit Targets */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <label className="ds-label" style={{ margin: 0, display: 'flex', alignItems: 'center' }}>
              Profit Targets (optional)
              <Tooltip text="Add up to 3 targets at different price levels. Assign a number of contracts to each. The calculator shows P&L and R:R for each target individually." position="right" />
            </label>
            <div style={{ display: 'flex', gap: 5 }}>
              {[1, 2, 3].map(n => (
                <button
                  key={n}
                  onClick={() => set('numTargets', n)}
                  style={{
                    width: 26, height: 26, borderRadius: 5, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                    border: '1px solid ' + (numTargets >= n ? 'var(--accent)' : 'var(--border)'),
                    background: numTargets >= n ? 'var(--accent-dim)' : 'var(--bg-3)',
                    color: numTargets >= n ? 'var(--accent)' : 'var(--text-3)',
                  }}
                >{n}</button>
              ))}
            </div>
          </div>

          {Array.from({ length: numTargets }, (_, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'flex-end' }}>
              <div style={{ flex: 2 }}>
                <label className="ds-label" style={{ fontSize: 10 }}>
                  T{i + 1} Price
                </label>
                <input
                  type="number"
                  value={targets[i]?.price || ''}
                  step={String(contract.tickSize)}
                  onChange={e => setTarget(i, 'price', e.target.value)}
                  placeholder={direction === 'long' ? `e.g. ${(parseFloat(entry) || 5800) + (i + 1) * 20}` : `e.g. ${(parseFloat(entry) || 5800) - (i + 1) * 20}`}
                  className="ds-input"
                  style={{ fontFamily: 'var(--mono)' }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label className="ds-label" style={{ fontSize: 10 }}>
                  Contracts
                </label>
                <input
                  type="number"
                  value={targets[i]?.contracts || ''}
                  min="1"
                  step="1"
                  onChange={e => setTarget(i, 'contracts', e.target.value)}
                  placeholder="all"
                  className="ds-input"
                  style={{ fontFamily: 'var(--mono)' }}
                />
              </div>
              {c.targetCalcs[i] && (
                <div style={{ fontSize: 11, color: '#22c55e', whiteSpace: 'nowrap', paddingBottom: 8, fontFamily: 'var(--mono)', fontWeight: 700 }}>
                  1:{c.targetCalcs[i]!.rr.toFixed(1)}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* RIGHT: Results ────────────────────────────────────────────────── */}
        <div style={{ padding: '16px 24px 20px' }}>

          {/* ── 4 Output Cards ─────────────────────────────────────────────── */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
            <ResultCard
              label="Contracts"
              value={String(c.contractsN)}
              sub={`${contract.symbol} — ${contract.name}`}
              borderColor="var(--accent)"
            />
            <ResultCard
              label="Risk Amount"
              value={fmtDollar(c.totalRisk)}
              sub={`${fmtDollar(c.dollarRiskPerContr)} per contract`}
              borderColor="#ef4444"
            />
            <ResultCard
              label="Margin Required"
              value={fmtDollar(c.marginRequired)}
              sub={c.accountN > 0 ? `${fmt2(c.marginPctOfAcct)}% of account` : `${contract.exchange}`}
              borderColor="var(--accent)"
            />
            <ResultCard
              label="Risk Level"
              value={c.accountN > 0 ? `${fmt2(c.riskPctOfAccount)}%` : '—'}
              borderColor="#22c55e"
              badge={c.accountN > 0 ? { text: c.riskLevel, color: c.riskLevelColor } : undefined}
            />
          </div>

          {/* ── Buying Power Bar ───────────────────────────────────────────── */}
          {c.accountN > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                <span style={{ fontSize: 11, color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  Buying Power Usage
                  <Tooltip text="How much of your account is tied up in margin for this position. Keep this under 50% to maintain flexibility." position="right" />
                </span>
                <span style={{ fontSize: 11, fontFamily: 'var(--mono)', color: c.marginPctOfAcct > 50 ? '#ef4444' : c.marginPctOfAcct > 25 ? '#f59e0b' : 'var(--text-2)' }}>
                  {fmt2(c.marginPctOfAcct)}% used
                </span>
              </div>
              <div style={{ height: 10, background: 'var(--bg-3)', borderRadius: 5, overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${Math.min(100, c.marginPctOfAcct)}%`,
                  borderRadius: 5,
                  background: c.marginPctOfAcct > 50 ? '#ef4444' : c.marginPctOfAcct > 25 ? '#f59e0b' : 'var(--accent)',
                  transition: 'width 0.3s, background 0.3s',
                }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--text-3)', marginTop: 2 }}>
                <span>${c.marginRequired.toLocaleString()} margin</span>
                <span>${c.accountN.toLocaleString()} account</span>
              </div>
            </div>
          )}

          {/* ── Visual R:R Bar ─────────────────────────────────────────────── */}
          <RRBar
            entry={c.entryN}
            stop={c.stopN}
            targets={targets.slice(0, numTargets).map((t, i) => ({
              price: parseFloat(t.price) || 0,
              contracts: parseInt(t.contracts) || c.contractsN,
            }))}
            direction={direction}
            contract={contract}
          />

          {/* ── Quick Profit Target Cards (1:1, 1:2, 1:3) ─────────────────── */}
          {c.entryN > 0 && c.stopN > 0 && c.dollarRiskPerContr > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', marginBottom: 8, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                Auto Profit Targets
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {c.quickTargets.map((qt, i) => {
                  const greens = ['rgba(34,197,94,0.12)', 'rgba(34,197,94,0.2)', 'rgba(34,197,94,0.32)']
                  const borders = ['rgba(34,197,94,0.3)', 'rgba(34,197,94,0.5)', 'rgba(34,197,94,0.75)']
                  return (
                    <div
                      key={qt.label}
                      style={{
                        flex: 1, borderRadius: 8, padding: '10px 12px',
                        background: greens[i], border: `1px solid ${borders[i]}`,
                        cursor: 'pointer',
                      }}
                      onClick={() => {
                        setTarget(0, 'price', fmtPrice(qt.price, contract.tickSize))
                        if (numTargets < i + 1) set('numTargets', i + 1)
                      }}
                      title="Click to set as T1"
                    >
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#22c55e' }}>{qt.label}</div>
                      <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--text-0)' }}>
                        {fmtPrice(qt.price, contract.tickSize)}
                      </div>
                      <div style={{ fontSize: 10, color: '#4ade80', marginTop: 1 }}>
                        +{fmtDollar(qt.dollar)}
                      </div>
                      <div style={{ fontSize: 9, color: 'var(--text-3)', marginTop: 1 }}>
                        {qt.points.toFixed(1)} pts
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── Risk/Reward Detail ────────────────────────────────────────── */}
          {c.ticksAtRisk > 0 && (
            <div style={{ background: 'var(--bg-3)', borderRadius: 8, padding: 14, marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', marginBottom: 10, letterSpacing: '0.06em' }}>RISK ANALYSIS</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
                {[
                  { label: 'Points at Risk',          value: fmt2(c.pointsAtRisk),                     tooltip: 'Price distance from entry to stop loss.' },
                  { label: 'Ticks at Risk',            value: fmtInt(c.ticksAtRisk),                    tooltip: `Number of ticks from entry to stop. 1 tick = $${c.dollarRiskPerContr > 0 ? fmt2(contract.tickValue) : '—'}` },
                  { label: 'Risk / Contract',          value: fmtDollar(c.dollarRiskPerContr),           tooltip: 'Dollar amount you lose per contract if stop is hit.' },
                  { label: `Total Risk (${c.contractsN}c)`, value: fmtDollar(c.totalRisk),             tooltip: 'Total dollar risk across all contracts.' },
                ].map(row => (
                  <div key={row.label} style={{ padding: '6px 0', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gridColumn: 'span 1' }}>
                    <span style={{ fontSize: 11, color: 'var(--text-2)', display: 'flex', alignItems: 'center', gap: 3 }}>
                      {row.label}<Tooltip text={row.tooltip} position="right" />
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--red)' }}>{row.value}</span>
                  </div>
                ))}
                {c.targetCalcs.map((tc, i) => tc && (
                  <>
                    <div key={`t${i}rr`} style={{ padding: '6px 0', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 11, color: 'var(--text-2)', display: 'flex', alignItems: 'center', gap: 3 }}>
                        T{i + 1} R:R Ratio<Tooltip text={`Target ${i + 1}: How many dollars reward per dollar risked.`} position="right" />
                      </span>
                      <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'var(--mono)', color: tc.rr >= 2 ? '#22c55e' : tc.rr >= 1 ? '#f59e0b' : '#ef4444' }}>1:{fmt2(tc.rr)}</span>
                    </div>
                    <div key={`t${i}profit`} style={{ padding: '6px 0', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 11, color: 'var(--text-2)' }}>T{i + 1} Total Profit</span>
                      <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'var(--mono)', color: '#22c55e' }}>{fmtDollarSigned(tc.tTotal)}</span>
                    </div>
                  </>
                ))}
              </div>
            </div>
          )}

          {/* ── Bottom Info Row ──────────────────────────────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 8 }}>
            {[
              { label: 'Cost Per Point',   value: `$${fmt2(contract.pointValue)}`,               tooltip: 'Dollar value of a 1-point move. Used to quickly estimate P&L mentally.' },
              { label: 'Tick Value',        value: `$${fmt2(contract.tickValue)}`,               tooltip: `Every ${contract.tickSize} move in price = $${fmt2(contract.tickValue)} P&L per contract.` },
              { label: 'Tick Size',         value: String(contract.tickSize),                    tooltip: 'Minimum price increment. You cannot have partial ticks.' },
              { label: 'Remaining Balance', value: c.accountN > 0 ? fmtDollar(c.remainingBalance) : '—', tooltip: 'Account balance minus margin and maximum risk on this trade.' },
              { label: 'Max Drawdown',      value: fmtDollar(c.maxDrawdown),                    tooltip: 'Maximum possible loss on this position if stop is hit.' },
              { label: 'Day Margin',        value: `$${Math.round(contract.initialMargin * 0.5).toLocaleString()}`, tooltip: 'Approximate intraday margin (typically 50% of overnight). Varies by broker.' },
            ].map(item => (
              <div key={item.label} style={{ background: 'var(--bg-3)', borderRadius: 7, padding: '8px 10px' }}>
                <div style={{ fontSize: 9, color: 'var(--text-3)', marginBottom: 3, display: 'flex', alignItems: 'center', gap: 3 }}>
                  {item.label}<Tooltip text={item.tooltip} position="top" />
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--text-0)' }}>{item.value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Risk % Grid + Contract Details ─────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 0, borderTop: '1px solid var(--border)' }}>

        {/* Risk Grid */}
        <div style={{ padding: '20px 24px', borderRight: '1px solid var(--border)' }}>
          <RiskGrid accountSize={c.accountN} dollarRiskPerContract={c.dollarRiskPerContr} />
          {(!c.accountN || !c.dollarRiskPerContr) && (
            <div style={{ color: 'var(--text-3)', fontSize: 12, padding: '12px 0' }}>
              Enter account size and a stop loss to see the risk matrix.
            </div>
          )}
        </div>

        {/* Contract Details */}
        <div style={{ padding: '20px 24px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', marginBottom: 12, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            {contract.symbol} Contract Specifications
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
            {[
              { label: 'Exchange',           value: contract.exchange,                         tooltip: 'The exchange where this contract trades.' },
              { label: 'Contract Size',       value: contract.contractSize,                    tooltip: 'The underlying asset quantity represented by 1 contract.' },
              { label: 'Tick Size',           value: String(contract.tickSize),                tooltip: 'Smallest allowed price increment.' },
              { label: 'Tick Value',          value: `$${fmt2(contract.tickValue)}`,            tooltip: 'Dollar P&L per 1 tick move per contract.' },
              { label: 'Point Value',         value: `$${contract.pointValue.toLocaleString()}`, tooltip: 'Dollar P&L per 1 full point move per contract.' },
              { label: 'Initial Margin',      value: `$${contract.initialMargin.toLocaleString()}`, tooltip: 'Cash required per contract to open and hold overnight. Set by the exchange, varies by broker.' },
              { label: 'Maintenance Margin',  value: `$${contract.maintenanceMargin.toLocaleString()}`, tooltip: 'If account equity falls below this, you get a margin call and must deposit more funds.' },
              { label: 'Day Trade Margin',    value: `~$${Math.round(contract.initialMargin * 0.5).toLocaleString()}`, tooltip: 'Approximate intraday margin — typically 50% of initial margin. Varies significantly by broker.' },
              { label: 'Delivery Months',     value: contract.deliveryMonths,                  tooltip: 'Which calendar months have active contracts. Most traders roll before the front month expires.' },
              { label: 'Trading Hours',       value: contract.tradingHours,                    tooltip: 'When the contract is actively trading. Most index futures trade almost 24h on CME Globex.' },
            ].map(row => (
              <div key={row.label} style={{ padding: '7px 0', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 3 }}>
                  {row.label}<Tooltip text={row.tooltip} position="right" />
                </span>
                <span style={{ fontSize: 12, fontWeight: 600, fontFamily: 'var(--mono)', color: 'var(--text-1)', textAlign: 'right', maxWidth: '55%' }}>{row.value}</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 12, fontSize: 11, color: 'var(--text-3)', background: 'var(--accent-dim)', borderRadius: 6, padding: '8px 12px' }}>
            💡 <strong>Margin calls:</strong> If your account drops below maintenance margin, your broker will close your position automatically. Always keep extra capital as a buffer.
          </div>
        </div>
      </div>

      {/* ── Footer disclaimer ─────────────────────────────────────────────── */}
      <div style={{ padding: '10px 24px', borderTop: '1px solid var(--border)', background: 'var(--bg-3)' }}>
        <p style={{ fontSize: 10, color: 'var(--text-3)', margin: 0 }}>
          ⚠️ Contract specs and margins are approximate and change frequently. Verify with your broker before trading. Not financial advice. Futures trading involves substantial risk of loss.
        </p>
      </div>
    </div>
  )
}
