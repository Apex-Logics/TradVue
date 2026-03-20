'use client'

import { useState, useEffect, useMemo, useRef, useCallback, Suspense } from 'react'
import Link from 'next/link'
import Tooltip from '../components/Tooltip'
import {
  getContractSpec,
  calculateTicksFromPrices,
  calculatePnlFromTicks,
  FUTURES_SYMBOLS_LIST,
  type FuturesContractSpec,
} from '../utils/futuresContracts'
import {
  IconChart, IconArrowLeft, IconUpload, IconDownload, IconBook,
  IconClipboard, IconTarget, IconDollar, IconTrendingUp, IconTrendingDown,
  IconZap, IconHash, IconCalculator, IconStar, IconHeartCrack, IconFlame,
  IconCalendar, IconMicroscope, IconBrain, IconNotebook,
  IconPencil, IconFolder, IconSave, IconTrophy, IconSkull,
  IconTag, IconSearch, IconAlert, IconCheck, IconArrowUpDown, IconInfo,
  IconShield, IconCamera, IconFileText, IconChevronUp,
  IconBuilding, IconLightningBolt,
} from '../components/Icons'
import PersistentNav from '../components/PersistentNav'
import { useAuth } from '../context/AuthContext'
import { debouncedSyncJournal, initJournalSync, forceSyncFromCloud } from '../utils/cloudSync'
import { getUserTier, isDataLocked, canAccessFeature, getLockedEntryCount, getCsvDateLimit } from '../utils/tierAccess'
import UpgradePrompt from '../components/UpgradePrompt'
import AuthGate from '../components/AuthGate'
import ImportModal from './ImportModal'
import AdvancedReports from './AdvancedReports'
import { TagPicker, TagFilterBar, TagChip, loadCustomTags, saveCustomTags, type TagDefinition } from './TagManager'
import { ExportButton, ImportBackupModal } from './ExportImport'
import WeeklySummary from './WeeklySummary'
import { loadPlaybooks, initPlaybooks, type Playbook, CATEGORY_COLORS, CATEGORY_LABELS } from '../utils/playbookData'
import { DEFAULT_PLAYBOOKS } from '../utils/playbookDefaults'
import dynamic from 'next/dynamic'
import { tradeFingerprint, batchInsertTrades, type ParsedTrade } from '../utils/brokerParsers'
const AuthModal = dynamic(() => import('../components/AuthModal'), { ssr: false })
const NinjaTraderConnect = dynamic(() => import('../components/NinjaTraderConnect'), { ssr: false })

// ─── Types ────────────────────────────────────────────────────────────────────

type AssetClass = 'Stock' | 'Option' | 'Futures' | 'Forex' | 'Crypto'
type Direction = 'Long' | 'Short'

interface OptionData {
  strike: string
  expiry: string
  premium: string
  contracts: string
}

interface ForexData {
  lotSize: string
  pips: string
}

// Options leg for multi-leg strategies
interface OptionLeg {
  optionType: 'call' | 'put'
  strikePrice: number
  expirationDate: string
  premium: number
  side: 'buy' | 'sell'
  quantity: number
}

// Greeks snapshot at entry or exit
interface OptionGreeks {
  delta?: number
  theta?: number
  gamma?: number
  vega?: number
}

interface Trade {
  id: string
  date: string
  time: string
  symbol: string
  assetClass: AssetClass
  direction: Direction
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
  rating: number   // 1-5
  notes: string
  screenshot: string  // base64
  optionData?: OptionData
  forexData?: ForexData
  // Multi-tag support (Phase 1 upgrade)
  tags_setup_types?: string[]
  tags_mistakes?: string[]
  tags_strategies?: string[]
  // Emotional tags
  emotionTag?: string
  // Playbook tag
  playbookId?: string
  // Prop Firm account link (optional, backward compatible)
  propFirmAccountId?: string

  // ── Futures fields (assetClass === 'Futures') ─────────────────────────────
  // assetClass 'Futures' already exists; these are additional detail fields.
  contractType?: string        // 'ES' | 'NQ' | 'MES' | 'MNQ' | ...
  tickValue?: number           // auto-populated from contract specs
  tickSize?: number            // e.g., 0.25 for ES
  futuresContracts?: number    // number of contracts traded (renamed to avoid clash with OptionData.contracts)
  pnlTicks?: number            // P&L in ticks (auto-calculated)

  // ── Options fields (assetClass === 'Option') ──────────────────────────────
  // Legacy optionData kept for backward compat; new fields extend it.
  optionType?: 'call' | 'put'
  strikePrice?: number
  expirationDate?: string
  premium?: number             // price paid/received per contract
  strategyType?: 'single' | 'vertical_spread' | 'iron_condor' | 'strangle' | 'straddle' | 'butterfly' | 'covered_call' | 'cash_secured_put' | 'calendar_spread' | 'custom'
  greeks?: OptionGreeks
  legs?: OptionLeg[]           // for multi-leg strategies

  // ── Source tracking ───────────────────────────────────────────────────────
  source?: string              // 'webhook' for auto-imported trades
}

interface Note {
  id: string
  title: string
  content: string
  template: string
  createdAt: string
  updatedAt: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SETUP_TAGS = [
  'Breakout', 'Pullback', 'Reversal', 'Trend Follow', 'Gap Fill',
  'VWAP Bounce', 'Support/Resistance', 'Momentum', 'Earnings Play',
  'Scalp', 'Swing', 'News Catalyst', 'Technical Pattern', 'Custom'
]

const MISTAKE_TAGS = [
  'None', 'FOMO', 'Oversize', 'Early Exit', 'Late Entry', 'Revenge Trade',
  'No Stop Loss', 'Chasing', 'Held Too Long', 'Ignored Signal',
  'Poor Risk/Reward', 'Overtrade', 'Custom'
]

const NOTE_TEMPLATES = {
  'Daily Trading Plan': `# Daily Trading Plan — {{date}}

## Market Outlook
- Overall market bias: 
- Key indices: SPY, QQQ, DIA levels to watch:
- VIX level / volatility expectation:

## Watchlist (Top 3-5)
1. {{symbol}} — Setup: | Key level: | Entry trigger:
2. 
3. 

## Key Levels Today
- Support: 
- Resistance: 
- Gap levels: 

## Risk Limits
- Max loss today (daily stop): $
- Max trades per session: 
- Max size per trade: 

## Pre-Market Notes
`,
  'Weekly Recap': `# Weekly Recap — Week of {{date}}

## Stats This Week
- Total trades: 
- Win rate: 
- Gross P&L: 
- Best trade: 
- Worst trade: 

## What Worked
1. 
2. 
3. 

## What Didn't Work
1. 
2. 
3. 

## Lessons Learned
1. 
2. 

## Goals for Next Week
1. 
2. 
3. 
`,
  'Strategy Playbook': `# Strategy Playbook — {{name}}

## Setup Name


## Entry Rules
1. 
2. 
3. 

## Exit Rules
- Take profit target: 
- Stop loss: 
- Time-based exit: 

## Risk Rules
- Max position size: 
- Risk per trade: %
- Max trades with this setup per day: 

## Historical Performance
- Win rate: %
- Avg R-Multiple: 
- Best market conditions: 

## Notes & Tips
`
}

const ASSET_CLASSES: AssetClass[] = ['Stock', 'Option', 'Futures', 'Forex', 'Crypto']

// ── Auto-detect asset class from symbol ──────────────────────────────────────
const FUTURES_SYMBOLS = new Set([
  'ES','NQ','YM','RTY','MES','MNQ','MYM','CL','NG','MCL','RB','HO',
  'GC','SI','HG','PL','MGC','SIL','ZC','ZS','ZW','ZL','CT','KC','SB',
  'LE','HE','ZB','ZN','ZF','ZT','6E','6B','6J','6A','6C','BTC','MBT','ETH',
  'NKD','FDAX','FESX','VX',
])
const FOREX_CURRENCIES = new Set([
  'USD','EUR','GBP','JPY','CAD','AUD','CHF','NZD','CNY','HKD',
  'SEK','NOK','DKK','SGD','MXN','ZAR','BRL','INR','TRY',
])
const CRYPTO_SYMBOLS = new Set([
  'BTC','ETH','SOL','DOGE','XRP','ADA','AVAX','DOT','LINK','MATIC',
  'SHIB','UNI','LTC','BCH','ATOM','NEAR','APT','ARB','OP','FTM',
  'BTCUSD','ETHUSD','SOLUSD','DOGEUSD',
])

function detectAssetClass(symbol: string): AssetClass | null {
  const s = symbol.toUpperCase().trim()
  if (!s) return null

  // Futures: exact match or with month/year suffix (e.g. ESH26, NQM25)
  const base = s.replace(/[FGHJKMNQUVXZ]\d{1,2}$/, '') // strip futures month+year
  if (FUTURES_SYMBOLS.has(base) || FUTURES_SYMBOLS.has(s)) return 'Futures'

  // Forex: 6-letter pair (EURUSD, GBPJPY) or with slash (EUR/USD)
  const cleaned = s.replace('/', '')
  if (cleaned.length === 6) {
    const b = cleaned.slice(0, 3), q = cleaned.slice(3, 6)
    if (FOREX_CURRENCIES.has(b) && FOREX_CURRENCIES.has(q)) return 'Forex'
  }

  // Crypto
  if (CRYPTO_SYMBOLS.has(s)) return 'Crypto'

  // Options: contains date-like pattern or C/P suffix (e.g. AAPL250321C200)
  if (/\d{6}[CP]\d+/.test(s) || /\s+(call|put|c|p)\s*$/i.test(s)) return 'Option'

  // Default: Stock (don't return null — most common)
  return 'Stock'
}

// ─── Storage ──────────────────────────────────────────────────────────────────

const TRADES_KEY = 'cg_journal_trades' // cg_ = legacy prefix from ChartGenius era (now TradVue); kept to avoid breaking existing user data
const NOTES_KEY  = 'cg_journal_notes'  // cg_ = legacy prefix from ChartGenius era (now TradVue); kept to avoid breaking existing user data
const DISMISSED_WEBHOOK_KEY = 'cg_dismissed_webhook_ids'

function getDismissedWebhookIds(): Set<string> {
  try {
    const raw = localStorage.getItem(DISMISSED_WEBHOOK_KEY)
    return raw ? new Set(JSON.parse(raw)) : new Set()
  } catch { return new Set() }
}

function addDismissedWebhookId(id: string) {
  const dismissed = getDismissedWebhookIds()
  dismissed.add(id)
  localStorage.setItem(DISMISSED_WEBHOOK_KEY, JSON.stringify([...dismissed]))
}

function loadTrades(): Trade[] {
  try {
    const raw = localStorage.getItem(TRADES_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

function saveTrades(trades: Trade[]) {
  localStorage.setItem(TRADES_KEY, JSON.stringify(trades))
}

function loadNotes(): Note[] {
  try {
    const raw = localStorage.getItem(NOTES_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

function saveNotes(notes: Note[]) {
  localStorage.setItem(NOTES_KEY, JSON.stringify(notes))
}

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt2(n: number) { return n.toFixed(2) }
function fmtDollar(n: number) { return (n >= 0 ? '+$' : '-$') + Math.abs(n).toFixed(2) }
function fmtPct(n: number) { return (n >= 0 ? '+' : '') + n.toFixed(2) + '%' }
function fmtR(n: number) { return (n >= 0 ? '+' : '') + n.toFixed(2) + 'R' }

function calcPnl(t: Partial<Trade>): number {
  if (!t.entryPrice || !t.exitPrice || !t.positionSize) return 0
  const raw = t.direction === 'Short'
    ? (t.entryPrice - t.exitPrice) * t.positionSize
    : (t.exitPrice - t.entryPrice) * t.positionSize
  return raw - (t.commissions || 0)
}

function calcRMultiple(t: Partial<Trade>): number {
  if (!t.entryPrice || !t.exitPrice || !t.stopLoss || !t.positionSize) return 0
  const riskPerUnit = Math.abs(t.entryPrice - t.stopLoss)
  if (riskPerUnit === 0) return 0
  const rewardPerUnit = t.direction === 'Short'
    ? t.entryPrice - t.exitPrice
    : t.exitPrice - t.entryPrice
  return rewardPerUnit / riskPerUnit
}

function calcPct(t: Partial<Trade>): number {
  if (!t.entryPrice || !t.exitPrice) return 0
  const pct = t.direction === 'Short'
    ? (t.entryPrice - t.exitPrice) / t.entryPrice * 100
    : (t.exitPrice - t.entryPrice) / t.entryPrice * 100
  return pct
}

// ─── Design tokens ────────────────────────────────────────────────────────────

const GREEN = 'var(--green)'
const RED   = 'var(--red)'
const BLUE  = 'var(--blue)'
const YELLOW = 'var(--yellow)'

// ─── Reusable UI ─────────────────────────────────────────────────────────────

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: 'var(--bg-2)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      padding: 20,
      ...style,
    }}>
      {children}
    </div>
  )
}

function SectionHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--text-0)' }}>{title}</h2>
      {sub && <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-2)', lineHeight: 1.5 }}>{sub}</p>}
    </div>
  )
}

function KpiCard({ label, value, sub, color, tooltip, icon }: {
  label: string; value: string; sub?: string; color?: string
  tooltip: string; icon: React.ReactNode
}) {
  return (
    <div className="ds-card" style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      minWidth: 140,
    }}>
      {/* Icon + label row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div className="tv-card-icon" style={{ width: 32, height: 32, fontSize: 15 }}>
          {icon}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--text-3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {label}
          <Tooltip text={tooltip} position="bottom" />
        </div>
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, color: color || 'var(--text-0)', fontFamily: 'var(--mono)' }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-2)' }}>{sub}</div>}
    </div>
  )
}

function FieldLabel({ label, tooltip }: { label: string; tooltip?: string }) {
  return (
    <label style={{
      display: 'flex', alignItems: 'center', gap: 4,
      fontSize: 11, fontWeight: 600, color: 'var(--text-2)',
      marginBottom: 4, letterSpacing: '0.06em', textTransform: 'uppercase',
    }}>
      {label}
      {tooltip && <Tooltip text={tooltip} position="right" />}
    </label>
  )
}

const inputSx: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  background: 'var(--bg-1)', border: '1px solid var(--border)',
  borderRadius: 8, padding: '10px 14px',
  color: 'var(--text-0)', fontSize: 13, fontFamily: 'var(--mono)',
  outline: 'none',
}

// ─── Prop Firm Dropdown ───────────────────────────────────────────────────────

interface PropFirmAccountMin {
  id: string
  accountName: string
  firm: string
  status: string
}

function PropFirmDropdown({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const [accounts, setAccounts] = useState<PropFirmAccountMin[]>([])

  useEffect(() => {
    try {
      const raw = localStorage.getItem('cg_propfirm_accounts')
      if (raw) {
        const all = JSON.parse(raw) as PropFirmAccountMin[]
        setAccounts(all.filter(a => a.status === 'active'))
      }
    } catch { /* ignore */ }
  }, [])

  if (accounts.length === 0) return null

  return (
    <div style={{ marginBottom: 12 }}>
      <FieldLabel label="Prop Firm Account (optional)" tooltip="Link this trade to a prop firm account. P&L will auto-count toward that account's tracker." />
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          width: '100%',
          background: 'var(--bg-1)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          padding: '10px 14px',
          color: value ? 'var(--text-0)' : 'var(--text-3)',
          fontSize: 13,
          fontFamily: 'var(--font)',
          outline: 'none',
          cursor: 'pointer',
        }}
      >
        <option value="">— No prop firm account —</option>
        {accounts.map(a => (
          <option key={a.id} value={a.id}>{a.accountName}</option>
        ))}
      </select>
    </div>
  )
}

// ─── Playbook Dropdown ────────────────────────────────────────────────────────

function PlaybookDropdown({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const [playbooks, setPlaybooks] = useState<Playbook[]>([])

  useEffect(() => {
    const pbs = initPlaybooks(DEFAULT_PLAYBOOKS)
    setPlaybooks(pbs)
  }, [])

  if (playbooks.length === 0) return null

  const selected = playbooks.find(p => p.id === value)

  return (
    <div style={{ marginBottom: 12 }}>
      <FieldLabel label="Playbook (optional)" tooltip="Tag this trade with a playbook strategy. Used to track per-strategy performance over time." />
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          style={{
            flex: 1,
            background: 'var(--bg-1)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: '10px 14px',
            color: value ? 'var(--text-0)' : 'var(--text-3)',
            fontSize: 13,
            fontFamily: 'var(--font)',
            outline: 'none',
            cursor: 'pointer',
          }}
        >
          <option value="">— No playbook —</option>
          {playbooks.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        {selected && (
          <span style={{
            background: CATEGORY_COLORS[selected.category] + '22',
            color: CATEGORY_COLORS[selected.category],
            border: `1px solid ${CATEGORY_COLORS[selected.category]}55`,
            borderRadius: 10,
            padding: '3px 8px',
            fontSize: 10,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            whiteSpace: 'nowrap',
          }}>
            {CATEGORY_LABELS[selected.category]}
          </span>
        )}
      </div>
    </div>
  )
}

// ─── Analytics helpers ────────────────────────────────────────────────────────

function computeStats(trades: Trade[]) {
  if (trades.length === 0) return null
  const wins = trades.filter(t => t.pnl > 0)
  const losses = trades.filter(t => t.pnl <= 0)
  const totalPnl = trades.reduce((s, t) => s + t.pnl, 0)
  const grossWins = wins.reduce((s, t) => s + t.pnl, 0)
  const grossLosses = Math.abs(losses.reduce((s, t) => s + t.pnl, 0))
  const profitFactor = grossLosses === 0 ? Infinity : grossWins / grossLosses
  const winRate = wins.length / trades.length * 100
  const avgWin = wins.length ? grossWins / wins.length : 0
  const avgLoss = losses.length ? grossLosses / losses.length : 0
  const expectancy = (winRate / 100) * avgWin - (1 - winRate / 100) * avgLoss
  const avgR = trades.reduce((s, t) => s + t.rMultiple, 0) / trades.length

  // Daily P&L
  const byDay: Record<string, number> = {}
  trades.forEach(t => {
    byDay[t.date] = (byDay[t.date] || 0) + t.pnl
  })
  const dayPnls = Object.values(byDay)
  const bestDay = Math.max(...dayPnls)
  const worstDay = Math.min(...dayPnls)

  // Streak
  const sorted = [...trades].sort((a, b) => a.date.localeCompare(b.date))
  let curStreak = 0, longestWin = 0, longestLoss = 0, curWin = 0, curLoss = 0
  sorted.forEach(t => {
    if (t.pnl > 0) { curWin++; curLoss = 0; longestWin = Math.max(longestWin, curWin) }
    else            { curLoss++; curWin = 0; longestLoss = Math.max(longestLoss, curLoss) }
  })
  const last = sorted[sorted.length - 1]
  curStreak = last?.pnl > 0 ? curWin : -curLoss

  return {
    totalTrades: trades.length,
    wins: wins.length,
    losses: losses.length,
    winRate,
    totalPnl,
    grossWins,
    grossLosses,
    profitFactor,
    avgWin,
    avgLoss,
    expectancy,
    avgR,
    bestDay,
    worstDay,
    byDay,
    curStreak,
    longestWin,
    longestLoss,
  }
}

// ─── SVG Charts ───────────────────────────────────────────────────────────────

function CumulativePnlChart({ trades }: { trades: Trade[] }) {
  const sorted = useMemo(() => [...trades].sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time)), [trades])
  const points = useMemo(() => {
    let cum = 0
    return sorted.map(t => { cum += t.pnl; return cum })
  }, [sorted])

  if (points.length < 2) return (
    <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-2)', fontSize: 13 }}>
      Add at least 2 trades to see your equity curve
    </div>
  )

  const W = 500, H = 140
  const min = Math.min(0, ...points), max = Math.max(0, ...points)
  const range = max - min || 1
  const xs = points.map((_, i) => (i / (points.length - 1)) * W)
  const ys = points.map(p => H - ((p - min) / range) * H)
  const zeroY = H - ((0 - min) / range) * H

  const path = xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x},${ys[i]}`).join(' ')
  const area = `${path} L${W},${H} L0,${H} Z`
  const lastY = ys[ys.length - 1]
  const lastPnl = points[points.length - 1]
  const color = lastPnl >= 0 ? GREEN : RED

  return (
    <svg viewBox={`0 0 ${W} ${H + 20}`} style={{ width: '100%', maxHeight: 160 }}>
      {/* Zero line */}
      <line x1={0} y1={zeroY} x2={W} y2={zeroY} stroke="rgba(255,255,255,0.1)" strokeWidth={1} strokeDasharray="4 4" />
      {/* Area fill */}
      <defs>
        <linearGradient id="pnlGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.3} />
          <stop offset="100%" stopColor={color} stopOpacity={0.01} />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#pnlGrad)" />
      <path d={path} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" />
      {/* Last value */}
      <circle cx={xs[xs.length - 1]} cy={lastY} r={4} fill={color} />
      <text x={W - 4} y={lastY - 8} textAnchor="end" fill={color} fontSize={10} fontFamily="var(--mono)">
        {fmtDollar(lastPnl)}
      </text>
    </svg>
  )
}

function DailyPnlBar({ trades }: { trades: Trade[] }) {
  const byDay = useMemo(() => {
    const map: Record<string, number> = {}
    trades.forEach(t => { map[t.date] = (map[t.date] || 0) + t.pnl })
    return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0])).slice(-20)
  }, [trades])

  if (byDay.length === 0) return (
    <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-2)', fontSize: 13 }}>No data yet</div>
  )

  const W = 500, H = 100
  const vals = byDay.map(d => d[1])
  const max = Math.max(...vals.map(Math.abs), 1)
  const bw = W / byDay.length * 0.7
  const gap = W / byDay.length * 0.3

  return (
    <svg viewBox={`0 0 ${W} ${H + 20}`} style={{ width: '100%', maxHeight: 130 }}>
      <line x1={0} y1={H / 2} x2={W} y2={H / 2} stroke="rgba(255,255,255,0.1)" strokeWidth={1} />
      {byDay.map(([date, pnl], i) => {
        const x = i * (W / byDay.length) + gap / 2
        const barH = (Math.abs(pnl) / max) * (H / 2 - 4)
        const y = pnl >= 0 ? H / 2 - barH : H / 2
        return (
          <g key={date}>
            <rect x={x} y={y} width={bw} height={barH} fill={pnl >= 0 ? GREEN : RED} rx={2} opacity={0.85} />
          </g>
        )
      })}
    </svg>
  )
}

function WinRatePie({ wins, total }: { wins: number; total: number }) {
  if (total === 0) return <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-2)', fontSize: 13 }}>No trades yet</div>
  const pct = wins / total
  const r = 44, cx = 60, cy = 60
  const angle = pct * 2 * Math.PI
  const x = cx + r * Math.sin(angle)
  const y = cy - r * Math.cos(angle)
  const large = pct > 0.5 ? 1 : 0
  const slice = `M ${cx} ${cy} L ${cx} ${cy - r} A ${r} ${r} 0 ${large} 1 ${x} ${y} Z`

  return (
    <svg viewBox="0 0 120 120" style={{ width: 120, height: 120 }}>
      <circle cx={cx} cy={cy} r={r} fill={RED} opacity={0.7} />
      {pct > 0 && <path d={slice} fill={GREEN} opacity={0.9} />}
      <circle cx={cx} cy={cy} r={28} fill="var(--bg-2)" />
      <text x={cx} y={cy - 6} textAnchor="middle" fill="var(--text-0)" fontSize={13} fontWeight={700}>
        {(pct * 100).toFixed(0)}%
      </text>
      <text x={cx} y={cy + 8} textAnchor="middle" fill="var(--text-2)" fontSize={9}>Win Rate</text>
    </svg>
  )
}

function BarChart({ data, title, formatVal }: {
  data: { label: string; value: number }[]
  title: string
  formatVal?: (n: number) => string
}) {
  if (data.length === 0) return <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-2)', fontSize: 12 }}>No data</div>
  const max = Math.max(...data.map(d => Math.abs(d.value)), 1)
  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{title}</div>
      {data.map(d => (
        <div key={d.label} style={{ marginBottom: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-2)', marginBottom: 2 }}>
            <span>{d.label}</span>
            <span style={{ color: d.value >= 0 ? GREEN : RED, fontFamily: 'var(--mono)' }}>
              {formatVal ? formatVal(d.value) : fmtDollar(d.value)}
            </span>
          </div>
          <div style={{ background: 'var(--bg-1)', borderRadius: 4, height: 8, overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${(Math.abs(d.value) / max) * 100}%`,
              background: d.value >= 0 ? GREEN : RED,
              borderRadius: 4,
              transition: 'width 0.3s',
            }} />
          </div>
        </div>
      ))}
    </div>
  )
}

function DrawdownChart({ trades }: { trades: Trade[] }) {
  const { equity, drawdown } = useMemo(() => {
    const sorted = [...trades].sort((a, b) => a.date.localeCompare(b.date))
    let cum = 0, peak = 0
    const equity: number[] = []
    const drawdown: number[] = []
    sorted.forEach(t => {
      cum += t.pnl
      equity.push(cum)
      if (cum > peak) peak = cum
      drawdown.push(peak > 0 ? ((cum - peak) / peak) * 100 : 0)
    })
    return { equity, drawdown }
  }, [trades])

  if (equity.length < 2) return (
    <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-2)', fontSize: 13 }}>
      Add more trades to see drawdown analysis
    </div>
  )

  const W = 500, H = 120
  const minEq = Math.min(...equity), maxEq = Math.max(...equity, 1)
  const xs = equity.map((_, i) => (i / (equity.length - 1)) * W)
  const eqYs = equity.map(v => H * 0.6 - ((v - minEq) / (maxEq - minEq + 1)) * (H * 0.55))
  const ddMin = Math.min(...drawdown)
  const ddYs = drawdown.map(v => H * 0.65 + ((v - ddMin) / (Math.abs(ddMin) + 1)) * (H * 0.3))

  const eqPath = xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x},${eqYs[i]}`).join(' ')
  const ddPath = xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x},${ddYs[i]}`).join(' ')
  const ddArea = `${ddPath} L${W},${H} L0,${H} Z`

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', maxHeight: 140 }}>
      <defs>
        <linearGradient id="ddGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={RED} stopOpacity={0.4} />
          <stop offset="100%" stopColor={RED} stopOpacity={0.05} />
        </linearGradient>
      </defs>
      <path d={ddArea} fill="url(#ddGrad)" />
      <path d={ddPath} fill="none" stroke={RED} strokeWidth={1} strokeOpacity={0.6} />
      <path d={eqPath} fill="none" stroke={GREEN} strokeWidth={2} strokeLinejoin="round" />
      <text x={4} y={12} fill={GREEN} fontSize={9}>Equity</text>
      <text x={4} y={H - 4} fill={RED} fontSize={9} opacity={0.8}>Drawdown %</text>
    </svg>
  )
}

// ─── Tab 1: Dashboard ─────────────────────────────────────────────────────────

function TabDashboard({ trades }: { trades: Trade[] }) {
  const stats = useMemo(() => computeStats(trades), [trades])

  const byAsset = useMemo(() => {
    const map: Record<string, number> = {}
    trades.forEach(t => { map[t.assetClass] = (map[t.assetClass] || 0) + t.pnl })
    return Object.entries(map).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value)
  }, [trades])

  const bySetup = useMemo(() => {
    const map: Record<string, number> = {}
    trades.forEach(t => { if (t.setupTag) map[t.setupTag] = (map[t.setupTag] || 0) + t.pnl })
    return Object.entries(map).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, 8)
  }, [trades])

  if (trades.length === 0) return (
    <div style={{ maxWidth: 600, margin: '0 auto', textAlign: 'center', padding: '48px 20px' }}>
      <div className="tv-card-icon" style={{ width: 48, height: 48, fontSize: 22, margin: '0 auto 16px' }}><IconClipboard size={22} /></div>
      <h3 style={{ color: 'var(--text-0)', marginBottom: 8, fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em' }}>
        Record your first trade or import from CSV
      </h3>
      <p style={{ color: 'var(--text-2)', fontSize: 14, lineHeight: 1.65, marginBottom: 24 }}>
        Once you have trades logged, this dashboard shows your equity curve, win rate, profit factor, and per-setup analytics — everything you need to identify what works.
      </p>
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
        <div style={{ fontSize: 12, color: 'var(--text-2)', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 16px', textAlign: 'left', maxWidth: 200 }}>
          <div style={{ fontWeight: 700, color: 'var(--text-1)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 5 }}><IconPencil size={12} />Manual Entry</div>
          Go to <strong style={{ color: 'var(--accent)' }}>Trade Log</strong> → <strong style={{ color: 'var(--accent)' }}>+ New Trade</strong>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-2)', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 16px', textAlign: 'left', maxWidth: 200 }}>
          <div style={{ fontWeight: 700, color: 'var(--text-1)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 5 }}><IconFolder size={12} />CSV Import</div>
          Click <strong style={{ color: 'var(--accent)' }}>Import CSV</strong> in the header. Supports Robinhood, IBKR, and Generic formats.
        </div>
      </div>
    </div>
  )

  return (
    <div>
      <SectionHeader
        title="Dashboard"
        sub="Your trading performance at a glance. All metrics update automatically as you log trades."
      />

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12, marginBottom: 24 }}>
        <KpiCard icon={<IconChart size={15} />} label="Total Trades" value={String(stats!.totalTrades)} tooltip="Total number of trades you have logged." />
        <KpiCard icon={<IconTarget size={15} />} label="Win Rate" value={`${stats!.winRate.toFixed(1)}%`}
          color={stats!.winRate >= 50 ? GREEN : RED}
          sub={`${stats!.wins}W / ${stats!.losses}L`}
          tooltip="Percentage of trades that were profitable. Most profitable traders maintain 40-60% win rate — it's about how much you win vs lose, not just how often." />
        <KpiCard icon={<IconDollar size={15} />} label="Total P&L" value={fmtDollar(stats!.totalPnl)}
          color={stats!.totalPnl >= 0 ? GREEN : RED}
          tooltip="Your total net profit or loss across all logged trades, after commissions." />
        <KpiCard icon={<IconTrendingUp size={15} />} label="Avg Win" value={`$${stats!.avgWin.toFixed(2)}`}
          color={GREEN}
          tooltip="Average dollar amount you make on winning trades. Higher is better — aim to make at least 2x your average loss." />
        <KpiCard icon={<IconTrendingDown size={15} />} label="Avg Loss" value={`$${stats!.avgLoss.toFixed(2)}`}
          color={RED}
          tooltip="Average dollar amount you lose on losing trades. Keep this small relative to your avg win." />
        <KpiCard icon={<IconZap size={15} />} label="Profit Factor" value={stats!.profitFactor === Infinity ? '∞' : fmt2(stats!.profitFactor)}
          color={stats!.profitFactor >= 1.5 ? GREEN : stats!.profitFactor >= 1 ? YELLOW : RED}
          tooltip="Gross profits ÷ gross losses. Above 1.0 = profitable overall. Above 1.5 = good. Above 2.0 = excellent. Below 1.0 = losing money." />
        <KpiCard icon={<IconHash size={15} />} label="Avg R-Multiple" value={fmtR(stats!.avgR)}
          color={stats!.avgR >= 0 ? GREEN : RED}
          tooltip="Reward achieved relative to risk taken on average. 2R means you made 2x your risk. Aim for 1R+ average to be consistently profitable." />
        <KpiCard icon={<IconCalculator size={15} />} label="Expectancy" value={fmtDollar(stats!.expectancy)}
          color={stats!.expectancy >= 0 ? GREEN : RED}
          tooltip="Average $ you expect per trade based on your win rate and avg win/loss. Positive = you have a statistical edge. Negative = losing strategy." />
        <KpiCard icon={<IconStar size={15} />} label="Best Day" value={fmtDollar(stats!.bestDay)}
          color={GREEN}
          tooltip="Your single best day of trading P&L (all trades on that day combined)." />
        <KpiCard icon={<IconHeartCrack size={15} />} label="Worst Day" value={fmtDollar(stats!.worstDay)}
          color={RED}
          tooltip="Your single worst day of trading P&L. Use this to set daily stop-loss limits." />
        <KpiCard icon={<IconFlame size={15} />} label="Streak"
          value={stats!.curStreak > 0 ? `${stats!.curStreak}W` : `${Math.abs(stats!.curStreak)}L`}
          color={stats!.curStreak > 0 ? GREEN : RED}
          sub={`Best: ${stats!.longestWin}W / ${stats!.longestLoss}L`}
          tooltip="Your current win or loss streak. Best win streak and best loss streak ever recorded." />
      </div>

      {/* Charts Row 1 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-0)', display: 'flex', alignItems: 'center', gap: 5 }}><IconTrendingUp size={13} />Cumulative P&L Curve</span>
            <Tooltip text="Shows how your total profit/loss has grown (or shrunk) over time. An upward-sloping curve means you're consistently growing your account." position="right" />
          </div>
          <CumulativePnlChart trades={trades} />
        </Card>
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-0)', display: 'flex', alignItems: 'center', gap: 5 }}><IconChart size={13} />Daily P&L (Last 20 Days)</span>
            <Tooltip text="Green bars = profitable days, Red bars = losing days. Taller bars = bigger gains/losses. Aim for more green than red!" position="right" />
          </div>
          <DailyPnlBar trades={trades} />
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 1fr', gap: 16, marginBottom: 16 }}>
        <Card style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <WinRatePie wins={stats!.wins} total={stats!.totalTrades} />
          <div style={{ display: 'flex', gap: 12, marginTop: 8, fontSize: 10, color: 'var(--text-2)' }}>
            <span style={{ color: GREEN }}>● Wins</span>
            <span style={{ color: RED }}>● Losses</span>
          </div>
        </Card>
        <Card>
          <BarChart data={byAsset} title="P&L by Asset Class" />
        </Card>
        <Card>
          <BarChart data={bySetup} title="P&L by Setup Tag" />
        </Card>
      </div>
    </div>
  )
}

// ─── Tab 2: Trade Log ─────────────────────────────────────────────────────────

const EMOTION_TAGS = [
  { label: 'Disciplined', color: '#22c55e', desc: 'Followed the plan, no impulsive decisions' },
  { label: 'Confident', color: '#3b82f6', desc: 'Strong conviction in the setup' },
  { label: 'Patient', color: '#8b5cf6', desc: 'Waited for the right entry' },
  { label: 'Anxious', color: '#f59e0b', desc: 'Felt uncertain or nervous' },
  { label: 'FOMO', color: '#f97316', desc: 'Fear of missing out drove the trade' },
  { label: 'Revenge', color: '#ef4444', desc: 'Traded to recover a loss' },
  { label: 'Overconfident', color: '#dc2626', desc: 'Took too much risk, felt invincible' },
  { label: 'Neutral', color: 'var(--text-3)', desc: 'No strong emotion' },
]

const OPTION_STRATEGY_LABELS: Record<string, string> = {
  single: 'Single Leg',
  vertical_spread: 'Vertical Spread',
  iron_condor: 'Iron Condor',
  strangle: 'Strangle',
  straddle: 'Straddle',
  butterfly: 'Butterfly',
  covered_call: 'Covered Call',
  cash_secured_put: 'Cash-Secured Put',
  calendar_spread: 'Calendar Spread',
  custom: 'Custom / Other',
}

const EMPTY_OPTION_LEG: OptionLeg = {
  optionType: 'call',
  strikePrice: 0,
  expirationDate: '',
  premium: 0,
  side: 'buy',
  quantity: 1,
}

const EMPTY_FORM = {
  date: new Date().toISOString().slice(0, 10),
  time: new Date().toTimeString().slice(0, 5),
  symbol: '',
  assetClass: 'Stock' as AssetClass,
  direction: 'Long' as Direction,
  entryPrice: '',
  exitPrice: '',
  positionSize: '',
  stopLoss: '',
  takeProfit: '',
  commissions: '0',
  setupTag: '',
  mistakeTag: 'None',
  rating: 3,
  notes: '',
  screenshot: '',
  emotionTag: '',
  playbookId: '',
  propFirmAccountId: '',
  // Option fields (legacy)
  strike: '', expiry: '', premium: '', contracts: '',
  // Forex fields
  lotSize: '', pips: '',
  // Futures fields
  contractType: '',
  futuresContracts: '1',
  // Enhanced option fields
  optionType: 'call' as 'call' | 'put',
  strikePrice: '',
  expirationDate: '',
  optionPremium: '',
  strategyType: 'single' as Trade['strategyType'],
  greekDelta: '', greekTheta: '', greekGamma: '', greekVega: '',
}

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          onClick={() => onChange(n)}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 22, color: n <= value ? YELLOW : 'var(--border)',
            padding: 0, lineHeight: 1,
          }}
        >★</button>
      ))}
    </div>
  )
}

// ─── Streak Tracker ───────────────────────────────────────────────────────────
function StreakTracker({ trades }: { trades: Trade[] }) {
  const st = useMemo(() => {
    if (!trades.length) return { cur: 0, bestWin: 0, bestLoss: 0 }
    const sorted = [...trades].sort((a, b) => a.date.localeCompare(b.date))
    let curWin = 0, curLoss = 0, bestWin = 0, bestLoss = 0
    sorted.forEach(t => {
      if (t.pnl > 0) { curWin++; curLoss = 0; bestWin = Math.max(bestWin, curWin) }
      else { curLoss++; curWin = 0; bestLoss = Math.max(bestLoss, curLoss) }
    })
    const last = sorted[sorted.length - 1]
    const cur = last?.pnl > 0 ? curWin : -curLoss
    return { cur, bestWin, bestLoss }
  }, [trades])

  if (!trades.length) return null

  const card: React.CSSProperties = { flex: 1, background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', minWidth: 0 }
  return (
    <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
      <div style={card}>
        <div style={{ fontSize: 10, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Current Streak</div>
        <div style={{ fontSize: 22, fontWeight: 800, color: st.cur > 0 ? 'var(--green)' : st.cur < 0 ? 'var(--red)' : 'var(--text-2)' }}>
          {st.cur > 0 ? `${st.cur}W` : st.cur < 0 ? `${Math.abs(st.cur)}L` : '—'}
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 2 }}>{st.cur > 0 ? 'Win streak' : st.cur < 0 ? 'Loss streak' : 'No streak'}</div>
      </div>
      <div style={card}>
        <div style={{ fontSize: 10, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Best Win Streak</div>
        <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--green)' }}>{st.bestWin ? `${st.bestWin}W` : '—'}</div>
        <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 2 }}>All-time best</div>
      </div>
      <div style={card}>
        <div style={{ fontSize: 10, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Worst Loss Streak</div>
        <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--red)' }}>{st.bestLoss ? `${st.bestLoss}L` : '—'}</div>
        <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 2 }}>All-time worst</div>
      </div>
    </div>
  )
}

function TabTradeLog({ trades, setTrades, customTags, onAddCustomTag, prefill, currentUser, onUpgrade, isDemo = false, onDemoAction }: {
  trades: Trade[]; setTrades: (t: Trade[]) => void
  customTags: TagDefinition[]; onAddCustomTag: (tag: TagDefinition) => void
  prefill?: { symbol?: string; price?: string; asset?: string } | null
  currentUser?: import('../lib/api').AuthUser | null
  onUpgrade?: (name: string, desc?: string) => void
  isDemo?: boolean
  onDemoAction?: () => void
}) {
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [expandedTradeId, setExpandedTradeId] = useState<string | null>(null)
  // Expanded row edit form — initialized when row expands, auto-saved on change
  const [expandedEditForm, setExpandedEditForm] = useState<{
    stopLoss: string; takeProfit: string;
    rating: number; setupTag: string; mistakeTag: string; notes: string;
    screenshot: string; propFirmAccountId: string;
    tags_setup_types: string[]; tags_mistakes: string[]
  }>({ stopLoss: '', takeProfit: '', rating: 3, setupTag: '', mistakeTag: 'None', notes: '', screenshot: '', propFirmAccountId: '', tags_setup_types: [], tags_mistakes: [] })
  const [savedNoticeTradeId, setSavedNoticeTradeId] = useState<string | null>(null)
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [filterAsset, setFilterAsset] = useState('All')
  const [filterDir, setFilterDir] = useState('All')
  const [filterWL, setFilterWL] = useState('All')
  const [filterSymbol, setFilterSymbol] = useState('')
  const [filterSetup, setFilterSetup] = useState('All')
  const [filterEmotion, setFilterEmotion] = useState('All')
  const [sortCol, setSortCol] = useState<string>('date')
  const [sortAsc, setSortAsc] = useState(false)
  // Multi-tag state for form
  const [formSetupTypes, setFormSetupTypes] = useState<string[]>([])
  const [formMistakes, setFormMistakes] = useState<string[]>([])
  const [formStrategies, setFormStrategies] = useState<string[]>([])
  // Tag filters
  const [tagFilters, setTagFilters] = useState({ setup_types: [] as string[], mistakes: [] as string[], strategies: [] as string[] })

  const [livePriceFetching, setLivePriceFetching] = useState(false)
  const [livePriceHint, setLivePriceHint] = useState<{ symbol: string; price: number } | null>(null)
  // Futures contract spec (auto-populated when contractType changes)
  const [futuresSpec, setFuturesSpec] = useState<FuturesContractSpec | null>(null)
  // Show advanced futures contract override fields
  const [showFuturesAdvanced, setShowFuturesAdvanced] = useState(false)
  // Options legs for multi-leg strategies
  const [optionLegs, setOptionLegs] = useState<OptionLeg[]>([])
  const set = (k: string) => (v: string | number) => setForm(f => ({ ...f, [k]: v }))

  // Pre-fill from URL params (watchlist +LOG button)
  useEffect(() => {
    if (!prefill?.symbol) return
    setShowForm(true)
    setForm(f => ({
      ...f,
      symbol: prefill.symbol || '',
      entryPrice: prefill.price || '',
      assetClass: (prefill.asset as AssetClass) || f.assetClass,
    }))
    if (prefill.price) setLivePriceHint({ symbol: prefill.symbol || '', price: parseFloat(prefill.price) })
  }, [prefill])

  // Auto-calc preview
  const preview = useMemo(() => {
    const entry = parseFloat(form.entryPrice) || 0
    const exit = parseFloat(form.exitPrice) || 0
    const size = parseFloat(form.positionSize) || 0
    const partial: Partial<Trade> = {
      direction: form.direction,
      entryPrice: entry,
      exitPrice: exit,
      positionSize: size,
      stopLoss: parseFloat(form.stopLoss) || 0,
      commissions: parseFloat(form.commissions) || 0,
    }
    let pnl = calcPnl(partial)
    let ticks: number | null = null
    if (form.assetClass === 'Futures' && form.contractType && futuresSpec && entry && exit) {
      // Use positionSize as the contracts count (they are kept in sync)
      const numC = parseFloat(form.positionSize) || parseFloat(form.futuresContracts) || 1
      const rawTicks = calculateTicksFromPrices(form.contractType, entry, exit, form.direction)
      ticks = rawTicks * numC
      pnl = calculatePnlFromTicks(form.contractType, rawTicks, numC) - (parseFloat(form.commissions) || 0)
    }
    return {
      pnl,
      rMultiple: calcRMultiple(partial),
      pct: calcPct(partial),
      ticks,
    }
  }, [form, futuresSpec])

  const handleScreenshot = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => set('screenshot')(reader.result as string)
    reader.readAsDataURL(file)
  }

  const submitTrade = () => {
    const entry = parseFloat(form.entryPrice)
    const exit  = parseFloat(form.exitPrice)
    const size  = parseFloat(form.positionSize)
    if (!form.symbol || !entry || !exit || !size) {
      alert('Please fill in Symbol, Entry Price, Exit Price, and Position Size.')
      return
    }
    const partial: Partial<Trade> = {
      direction: form.direction,
      entryPrice: entry, exitPrice: exit, positionSize: size,
      stopLoss: parseFloat(form.stopLoss) || 0,
      commissions: parseFloat(form.commissions) || 0,
    }
    // ── Calculate futures P&L using tick math if applicable ──
    let finalPnl = calcPnl(partial)
    let finalPnlTicks: number | undefined
    if (form.assetClass === 'Futures' && form.contractType && futuresSpec) {
      // positionSize is the canonical contracts count for futures (synced on change)
      const numC = parseFloat(form.positionSize) || parseFloat(form.futuresContracts) || 1
      const ticks = calculateTicksFromPrices(form.contractType, entry, exit, form.direction)
      finalPnlTicks = ticks * numC
      finalPnl = calculatePnlFromTicks(form.contractType, ticks, numC) - (parseFloat(form.commissions) || 0)
    }

    const trade: Trade = {
      id: uid(),
      date: form.date,
      time: form.time,
      symbol: form.symbol.toUpperCase(),
      assetClass: form.assetClass,
      direction: form.direction,
      entryPrice: entry,
      exitPrice: exit,
      positionSize: size,
      stopLoss: parseFloat(form.stopLoss) || 0,
      takeProfit: parseFloat(form.takeProfit) || 0,
      commissions: parseFloat(form.commissions) || 0,
      pnl: finalPnl,
      rMultiple: calcRMultiple(partial),
      pctGainLoss: calcPct(partial),
      holdMinutes: 0,
      setupTag: form.setupTag,
      mistakeTag: form.mistakeTag,
      rating: form.rating,
      notes: form.notes,
      screenshot: form.screenshot,
      ...(form.assetClass === 'Option' ? {
        optionData: { strike: form.strike, expiry: form.expiry, premium: form.premium, contracts: form.contracts }
      } : {}),
      ...(form.assetClass === 'Forex' ? {
        forexData: { lotSize: form.lotSize, pips: form.pips }
      } : {}),
      // ── Futures extended fields ──
      ...(form.assetClass === 'Futures' && form.contractType ? {
        contractType: form.contractType,
        tickSize: futuresSpec?.tickSize,
        tickValue: futuresSpec?.tickValue,
        futuresContracts: parseFloat(form.positionSize) || parseFloat(form.futuresContracts) || 1,
        pnlTicks: finalPnlTicks,
      } : {}),
      // ── Options extended fields ──
      ...(form.assetClass === 'Option' ? {
        optionType: form.optionType,
        strikePrice: parseFloat(form.strikePrice) || undefined,
        expirationDate: form.expirationDate || undefined,
        premium: parseFloat(form.optionPremium) || undefined,
        strategyType: form.strategyType,
        greeks: {
          delta: form.greekDelta ? parseFloat(form.greekDelta) : undefined,
          theta: form.greekTheta ? parseFloat(form.greekTheta) : undefined,
          gamma: form.greekGamma ? parseFloat(form.greekGamma) : undefined,
          vega: form.greekVega ? parseFloat(form.greekVega) : undefined,
        },
        legs: optionLegs.length > 0 ? optionLegs : undefined,
      } : {}),
      tags_setup_types: formSetupTypes,
      tags_mistakes: formMistakes,
      tags_strategies: formStrategies,
      emotionTag: form.emotionTag || '',
      playbookId: form.playbookId || undefined,
      propFirmAccountId: form.propFirmAccountId || undefined,
    }
    const updated = [trade, ...trades]
    setTrades(updated)
    saveTrades(updated)
    // If linked to a prop firm account, update its trades list
    if (trade.propFirmAccountId) {
      try {
        const pfRaw = localStorage.getItem('cg_propfirm_accounts')
        if (pfRaw) {
          const pfAccounts = JSON.parse(pfRaw)
          const pfIdx = pfAccounts.findIndex((a: { id: string }) => a.id === trade.propFirmAccountId)
          if (pfIdx !== -1) {
            const acct = pfAccounts[pfIdx]
            if (!acct.trades.includes(trade.id)) {
              acct.trades = [...acct.trades, trade.id]
              acct.updatedAt = new Date().toISOString()
              pfAccounts[pfIdx] = acct
              localStorage.setItem('cg_propfirm_accounts', JSON.stringify(pfAccounts))
            }
          }
        }
      } catch { /* ignore */ }
    }
    // Save smart defaults for this asset class
    try {
      localStorage.setItem(`cg_journal_defaults_${form.assetClass}`, JSON.stringify({
        stopDistance: Math.abs(entry - (parseFloat(form.stopLoss) || entry)),
        positionSize: size,
        commissions: parseFloat(form.commissions) || 0,
      }))
    } catch {}
    setForm({ ...EMPTY_FORM, date: form.date })
    setFormSetupTypes([])
    setFormMistakes([])
    setFormStrategies([])
    setOptionLegs([])
    setFuturesSpec(null)
    setShowFuturesAdvanced(false)
    setShowForm(false)
  }

  const deleteTrade = (id: string) => {
    if (!confirm('Delete this trade?')) return
    // If it's a webhook trade, track it as dismissed so polling doesn't re-add it
    if (id.startsWith('wh_')) addDismissedWebhookId(id)
    const updated = trades.filter(t => t.id !== id)
    setTrades(updated)
    saveTrades(updated)
  }

  const openExpandedRow = (t: Trade) => {
    setExpandedTradeId(t.id)
    setExpandedEditForm({
      stopLoss: t.stopLoss ? String(t.stopLoss) : '',
      takeProfit: t.takeProfit ? String(t.takeProfit) : '',
      rating: t.rating || 3,
      setupTag: t.setupTag || '',
      mistakeTag: t.mistakeTag || 'None',
      notes: t.notes || '',
      screenshot: t.screenshot || '',
      propFirmAccountId: t.propFirmAccountId || '',
      tags_setup_types: t.tags_setup_types || (t.setupTag ? [t.setupTag] : []),
      tags_mistakes: t.tags_mistakes || (t.mistakeTag && t.mistakeTag !== 'None' ? [t.mistakeTag] : []),
    })
  }

  const applyExpandedEdit = useCallback((tradeId: string, patch: Partial<typeof expandedEditForm>) => {
    setExpandedEditForm(f => {
      const next = { ...f, ...patch }
      // debounced auto-save
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
      autoSaveTimer.current = setTimeout(() => {
        setTrades(
          trades.map((t: Trade) => {
            if (t.id !== tradeId) return t
            return {
              ...t,
              stopLoss: parseFloat(next.stopLoss) || 0,
              takeProfit: parseFloat(next.takeProfit) || 0,
              rating: next.rating,
              setupTag: next.setupTag,
              mistakeTag: next.mistakeTag,
              notes: next.notes,
              screenshot: next.screenshot,
              propFirmAccountId: next.propFirmAccountId || undefined,
              tags_setup_types: next.tags_setup_types,
              tags_mistakes: next.tags_mistakes,
            }
          })
        )
        const updated = trades.map((t: Trade) => {
          if (t.id !== tradeId) return t
          return {
            ...t,
            stopLoss: parseFloat(next.stopLoss) || 0,
            takeProfit: parseFloat(next.takeProfit) || 0,
            rating: next.rating,
            setupTag: next.setupTag,
            mistakeTag: next.mistakeTag,
            notes: next.notes,
            screenshot: next.screenshot,
            propFirmAccountId: next.propFirmAccountId || undefined,
            tags_setup_types: next.tags_setup_types,
            tags_mistakes: next.tags_mistakes,
          }
        })
        saveTrades(updated)
        debouncedSyncJournal(updated, [])
        setSavedNoticeTradeId(tradeId)
        setTimeout(() => setSavedNoticeTradeId((prev: string | null) => prev === tradeId ? null : prev), 2000)
      }, 500)
      return next
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trades])

  // Filter + sort
  const filtered = useMemo(() => {
    let list = trades
    if (filterAsset !== 'All') list = list.filter(t => t.assetClass === filterAsset)
    if (filterDir !== 'All') list = list.filter(t => t.direction === filterDir)
    if (filterWL === 'Win') list = list.filter(t => t.pnl > 0)
    if (filterWL === 'Loss') list = list.filter(t => t.pnl <= 0)
    if (filterSymbol) list = list.filter(t => t.symbol.includes(filterSymbol.toUpperCase()))
    if (filterSetup !== 'All') list = list.filter(t => t.setupTag === filterSetup)
    if (filterEmotion !== 'All') list = list.filter(t => (t.emotionTag || '') === filterEmotion)
    // Tag-based filters
    if (tagFilters.setup_types.length > 0) {
      list = list.filter(t => {
        const tags = t.tags_setup_types || (t.setupTag ? [t.setupTag] : [])
        return tagFilters.setup_types.some(f => tags.includes(f))
      })
    }
    if (tagFilters.mistakes.length > 0) {
      list = list.filter(t => {
        const tags = t.tags_mistakes || (t.mistakeTag && t.mistakeTag !== 'None' ? [t.mistakeTag] : [])
        return tagFilters.mistakes.some(f => tags.includes(f))
      })
    }
    if (tagFilters.strategies.length > 0) {
      list = list.filter(t => {
        const tags = t.tags_strategies || []
        return tagFilters.strategies.some(f => tags.includes(f))
      })
    }
    const dir = sortAsc ? 1 : -1
    return [...list].sort((a, b) => {
      if (sortCol === 'date') return dir * (a.date + a.time).localeCompare(b.date + b.time)
      if (sortCol === 'pnl') return dir * (a.pnl - b.pnl)
      if (sortCol === 'rMultiple') return dir * (a.rMultiple - b.rMultiple)
      if (sortCol === 'symbol') return dir * a.symbol.localeCompare(b.symbol)
      return 0
    })
  }, [trades, filterAsset, filterDir, filterWL, filterSymbol, filterSetup, filterEmotion, tagFilters, sortCol, sortAsc])

  const toggleSort = (col: string) => {
    if (sortCol === col) setSortAsc(a => !a)
    else { setSortCol(col); setSortAsc(false) }
  }

  const thStyle: React.CSSProperties = {
    padding: '8px 12px', fontSize: 11, fontWeight: 600,
    color: 'var(--text-2)', textAlign: 'left', cursor: 'pointer',
    textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid var(--border)',
    userSelect: 'none', whiteSpace: 'nowrap',
  }

  return (
    <div>
      <SectionHeader
        title="Trade Log"
        sub="Record every trade you make — even the bad ones! Honest logging is how you find patterns and improve."
      />

      {/* Weekly Summary */}
      <WeeklySummary trades={trades} />

      {/* Streak Tracker */}
      <StreakTracker trades={trades} />

      {/* Action bar */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <button
          onClick={isDemo ? onDemoAction : () => setShowForm(f => !f)}
          style={{
            background: 'var(--accent)', border: 'none', borderRadius: 'var(--btn-radius)', padding: '10px 20px',
            color: '#0a0a0c', fontSize: 13, fontWeight: 700, cursor: 'pointer',
          }}
        >
          {showForm ? '✕ Cancel' : '+ Log Trade'}
        </button>
        <div style={{ fontSize: 12, color: 'var(--text-2)', alignSelf: 'center' }}>
          {filtered.length} of {trades.length} trades shown
        </div>
      </div>

      {/* Add Trade Form */}
      {showForm && (
        <Card style={{ marginBottom: 24, borderColor: BLUE + '44' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-0)', marginBottom: 16 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><IconPencil size={14} />Log a New Trade</span>
          </div>

          {/* Row 1: Core fields */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12, marginBottom: 12 }}>
            <div>
              <FieldLabel label="Date" tooltip="The date you entered this trade." />
              <input type="date" value={form.date} onChange={e => set('date')(e.target.value)} style={inputSx} />
            </div>
            <div>
              <FieldLabel label="Time" tooltip="The time you entered the trade. Helps identify best/worst trading hours." />
              <input type="time" value={form.time} onChange={e => set('time')(e.target.value)} style={inputSx} />
            </div>
            <div>
              <FieldLabel label="Symbol" tooltip="The ticker symbol — e.g. AAPL, TSLA, EUR/USD, BTC. Use the exchange symbol." />
              <input type="text" value={form.symbol} onChange={e => {
                const sym = e.target.value.toUpperCase()
                set('symbol')(sym)
                const detected = detectAssetClass(sym)
                if (detected) set('assetClass')(detected)
                // Auto-populate futures spec when a known futures symbol is typed
                if (detected === 'Futures') {
                  const spec = getContractSpec(sym)
                  if (spec) {
                    setFuturesSpec(spec)
                    set('contractType')(spec.symbol)
                    setShowFuturesAdvanced(false)
                  }
                } else {
                  // Clear futures spec if user switches away from a futures symbol
                  if (futuresSpec) {
                    setFuturesSpec(null)
                    set('contractType')('')
                  }
                }
              }} placeholder="e.g. AAPL or NQ" style={inputSx} />
            </div>
            <div>
              <FieldLabel label="Asset Class" tooltip="Type of instrument. Each has different characteristics — stocks trade shares, options trade contracts, forex trades lots." />
              <select value={form.assetClass} onChange={e => {
                const ac = e.target.value
                set('assetClass')(ac)
                // Load smart defaults for this asset class
                try {
                  const saved = JSON.parse(localStorage.getItem(`cg_journal_defaults_${ac}`) || '{}')
                  if (saved.commissions !== undefined) set('commissions')(String(saved.commissions))
                } catch {}
              }} style={inputSx}>
                {ASSET_CLASSES.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
              {(() => {
                try {
                  const saved = JSON.parse(localStorage.getItem(`cg_journal_defaults_${form.assetClass}`) || '{}')
                  if (saved.positionSize) return <div style={{ fontSize: 9, color: 'var(--text-3)', marginTop: 2 }}>Using your {form.assetClass} defaults · <button type="button" onClick={() => { try { localStorage.removeItem(`cg_journal_defaults_${form.assetClass}`) } catch {} }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontSize: 9, padding: 0 }}>reset</button></div>
                } catch {}
                return null
              })()}
            </div>
            <div>
              <FieldLabel label="Direction" tooltip="Long = you bought expecting price to go UP. Short = you sold/shorted expecting price to go DOWN." />
              <select value={form.direction} onChange={e => set('direction')(e.target.value)} style={inputSx}>
                <option value="Long">Long (Buy — betting price rises)</option>
                <option value="Short">Short (Sell — betting price falls)</option>
              </select>
            </div>
          </div>

          {/* Row 2: Price fields */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12, marginBottom: 12 }}>
            <div>
              <FieldLabel label="Entry Price" tooltip="The price you bought/shorted at. Be exact — this is your cost basis." />
              <div style={{ position: 'relative' }}>
                <input type="number" value={form.entryPrice} onChange={e => set('entryPrice')(e.target.value)} placeholder="e.g. 150.00" step="any" style={inputSx} />
                {form.symbol && !form.entryPrice && form.assetClass !== 'Futures' && (
                  <button
                    type="button"
                    disabled={livePriceFetching}
                    onClick={async () => {
                      if (!form.symbol) return
                      setLivePriceFetching(true)
                      setLivePriceHint(null)
                      try {
                        const API_BASE_J = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
                        const r = await fetch(`${API_BASE_J}/api/market-data/quote/${form.symbol}`)
                        const j = await r.json()
                        const price = j?.c || j?.regularMarketPrice || j?.price
                        if (price) {
                          set('entryPrice')(String(price.toFixed(2)))
                          setLivePriceHint({ symbol: form.symbol, price })
                        } else {
                          setLivePriceHint(null)
                        }
                      } catch {
                        setLivePriceHint(null)
                      }
                      setLivePriceFetching(false)
                    }}
                    style={{ marginTop: 4, fontSize: 10, padding: '2px 8px', background: 'var(--accent-dim)', border: '1px solid rgba(74,158,255,0.3)', borderRadius: 4, cursor: 'pointer', color: 'var(--accent)' }}
                  >
                    {livePriceFetching ? 'Fetching…' : `Fill ${form.symbol} current price`}
                  </button>
                )}
                {form.symbol && !form.entryPrice && form.assetClass === 'Futures' && (
                  <div style={{ marginTop: 4, fontSize: 10, color: 'var(--text-3)', padding: '2px 0' }}>
                    Live price fill not available for futures — enter manually.
                  </div>
                )}
                {livePriceHint && livePriceHint.symbol === form.symbol && form.assetClass !== 'Futures' && (
                  <div style={{ fontSize: 9, color: 'var(--text-3)', marginTop: 2 }}>
                    Current: <strong style={{ color: 'var(--accent)' }}>${livePriceHint.price.toFixed(2)}</strong> — you can edit above
                  </div>
                )}
              </div>
            </div>
            <div>
              <FieldLabel label="Exit Price" tooltip="The price you sold/covered at. P&L is calculated from entry to exit." />
              <input type="number" value={form.exitPrice} onChange={e => set('exitPrice')(e.target.value)} placeholder="e.g. 157.50" step="any" style={inputSx} />
            </div>
            <div>
              <FieldLabel
                label={form.assetClass === 'Futures' ? 'Contracts' : 'Position Size'}
                tooltip={form.assetClass === 'Futures' ? 'Number of futures contracts traded.' : 'Number of shares (stocks), contracts (options/futures), lots (forex), or coins (crypto). Used to calculate total P&L.'}
              />
              <input type="number" value={form.positionSize} onChange={e => {
                set('positionSize')(e.target.value)
                // Keep futuresContracts in sync so P&L preview uses the right count
                if (form.assetClass === 'Futures') set('futuresContracts')(e.target.value)
              }} placeholder={form.assetClass === 'Futures' ? 'e.g. 1' : 'e.g. 100'} step={form.assetClass === 'Futures' ? '1' : 'any'} style={inputSx} />
            </div>
            <div>
              <FieldLabel label="Stop Loss" tooltip="The price where you would have exited to limit losses. Used to calculate R-Multiple — your risk on this trade." />
              <input type="number" value={form.stopLoss} onChange={e => set('stopLoss')(e.target.value)} placeholder="e.g. 145.00" step="any" style={inputSx} />
            </div>
            <div>
              <FieldLabel label="Take Profit" tooltip="Your original profit target. Compare to where you actually exited — helps identify if you're cutting winners short." />
              <input type="number" value={form.takeProfit} onChange={e => set('takeProfit')(e.target.value)} placeholder="e.g. 165.00" step="any" style={inputSx} />
            </div>
            <div>
              <FieldLabel label="Commissions / Fees" tooltip="Total broker commissions and fees for this round-trip (entry + exit). Deducted from your P&L automatically." />
              <input type="number" value={form.commissions} onChange={e => set('commissions')(e.target.value)} placeholder="e.g. 1.00" step="any" style={inputSx} />
            </div>
          </div>

          {/* ── Futures-specific fields ────────────────────────────────────── */}
          {form.assetClass === 'Futures' && (
            <div style={{ marginBottom: 12 }}>
              {/* Auto-detected contract confirmation banner */}
              {futuresSpec ? (
                <div style={{ padding: '10px 14px', background: BLUE + '18', border: `1px solid ${BLUE}44`, borderRadius: 8, marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <IconChart size={13} style={{ color: BLUE }} />
                    <span style={{ fontSize: 13, fontWeight: 700, color: BLUE }}>{futuresSpec.symbol}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-1)' }}>— {futuresSpec.name}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>
                      tick: {futuresSpec.tickSize} · ${futuresSpec.tickValue}/tick
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowFuturesAdvanced(v => !v)}
                    style={{ fontSize: 11, background: 'none', border: `1px solid ${BLUE}55`, borderRadius: 6, padding: '3px 10px', color: BLUE, cursor: 'pointer' }}
                  >
                    {showFuturesAdvanced ? 'Hide' : 'Override'} contract
                  </button>
                </div>
              ) : (
                /* No auto-detected spec — show manual selector */
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, color: BLUE, fontWeight: 600, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 5, marginBottom: 8 }}>
                    <IconChart size={11} />Select Futures Contract
                  </div>
                  <select
                    value={form.contractType}
                    onChange={e => {
                      const sym = e.target.value
                      set('contractType')(sym)
                      const spec = getContractSpec(sym)
                      setFuturesSpec(spec)
                      if (!form.symbol && sym) set('symbol')(sym)
                    }}
                    style={inputSx}
                  >
                    <option value="">— Select Contract —</option>
                    {FUTURES_SYMBOLS_LIST.map(s => (
                      <option key={s} value={s}>{s} — {getContractSpec(s)?.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Advanced override: contract selector + tick fields */}
              {showFuturesAdvanced && futuresSpec && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12, marginBottom: 10, padding: '12px', background: 'var(--bg-1)', borderRadius: 8, border: '1px solid var(--border)' }}>
                  <div style={{ gridColumn: '1 / -1', fontSize: 10, color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Advanced — Manual Override</div>
                  <div>
                    <FieldLabel label="Contract" tooltip="Change the detected contract type." />
                    <select
                      value={form.contractType}
                      onChange={e => {
                        const sym = e.target.value
                        set('contractType')(sym)
                        const spec = getContractSpec(sym)
                        setFuturesSpec(spec)
                      }}
                      style={inputSx}
                    >
                      <option value="">— Select —</option>
                      {FUTURES_SYMBOLS_LIST.map(s => (
                        <option key={s} value={s}>{s} — {getContractSpec(s)?.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <FieldLabel label="Tick Size" tooltip="Minimum price movement. Auto-populated from contract spec." />
                    <input type="number" value={futuresSpec.tickSize} readOnly style={{ ...inputSx, color: 'var(--text-3)', cursor: 'default' }} />
                  </div>
                  <div>
                    <FieldLabel label="Tick Value ($)" tooltip="Dollar value per tick per contract. Auto-populated." />
                    <input type="number" value={futuresSpec.tickValue} readOnly style={{ ...inputSx, color: 'var(--text-3)', cursor: 'default' }} />
                  </div>
                </div>
              )}

              {/* Tick P&L live preview */}
              {futuresSpec && parseFloat(form.entryPrice) > 0 && parseFloat(form.exitPrice) > 0 && (
                <div style={{ marginTop: 10, padding: '8px 12px', background: 'var(--bg-1)', borderRadius: 8, border: '1px solid var(--border)', display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--text-2)' }}>P&amp;L (Ticks)</div>
                    <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'var(--mono)', color: (preview.ticks ?? 0) >= 0 ? GREEN : RED }}>
                      {preview.ticks !== null ? `${(preview.ticks ?? 0) >= 0 ? '+' : ''}${preview.ticks}` : '—'}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--text-2)' }}>P&amp;L (USD)</div>
                    <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'var(--mono)', color: preview.pnl >= 0 ? GREEN : RED }}>
                      {fmtDollar(preview.pnl)}
                    </div>
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-3)', alignSelf: 'center' }}>
                    {futuresSpec.symbol} · {form.positionSize || 1} contract(s) · ${futuresSpec.tickValue}/tick
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Options-specific fields ────────────────────────────────────── */}
          {form.assetClass === 'Option' && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: BLUE, fontWeight: 600, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 5, marginBottom: 10 }}>
                <IconClipboard size={11} />Option Details
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12, marginBottom: 12 }}>
                <div>
                  <FieldLabel label="Strategy Type" tooltip="Type of options strategy." />
                  <select value={form.strategyType} onChange={e => set('strategyType')(e.target.value)} style={inputSx}>
                    {Object.entries(OPTION_STRATEGY_LABELS).map(([val, label]) => (
                      <option key={val} value={val}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <FieldLabel label="Option Type" tooltip="Call = bullish (right to buy). Put = bearish (right to sell)." />
                  <select value={form.optionType} onChange={e => set('optionType')(e.target.value)} style={inputSx}>
                    <option value="call">Call (Bullish)</option>
                    <option value="put">Put (Bearish)</option>
                  </select>
                </div>
                <div>
                  <FieldLabel label="Strike Price" tooltip="The price at which you have the right to buy (call) or sell (put)." />
                  <input type="number" value={form.strikePrice} onChange={e => set('strikePrice')(e.target.value)} placeholder="e.g. 150.00" step="any" style={inputSx} />
                </div>
                <div>
                  <FieldLabel label="Expiration Date" tooltip="The date the option expires." />
                  <input type="date" value={form.expirationDate} onChange={e => set('expirationDate')(e.target.value)} style={inputSx} />
                </div>
                <div>
                  <FieldLabel label="Premium" tooltip="Price paid/received per share. Each contract = 100 shares." />
                  <input type="number" value={form.optionPremium} onChange={e => set('optionPremium')(e.target.value)} placeholder="e.g. 3.50" step="0.01" style={inputSx} />
                </div>
                <div>
                  <FieldLabel label="Contracts" tooltip="Number of option contracts. 1 contract = 100 shares." />
                  <input type="number" value={form.contracts} onChange={e => set('contracts')(e.target.value)} placeholder="e.g. 2" step="1" style={inputSx} />
                </div>
                {/* Legacy hidden fields for backward compat */}
                <input type="hidden" value={form.strike} onChange={e => set('strike')(e.target.value)} />
                <input type="hidden" value={form.expiry} onChange={e => set('expiry')(e.target.value)} />
                <input type="hidden" value={form.premium} onChange={e => set('premium')(e.target.value)} />
              </div>
              {/* Greeks (optional) */}
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 10, color: 'var(--text-3)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                  Greeks at Entry <span style={{ opacity: 0.7 }}>(optional)</span>
                  <Tooltip text="Delta = directional exposure · Theta = daily time decay · Gamma = rate of delta change · Vega = volatility sensitivity" position="right" />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                  {[
                    { key: 'greekDelta', label: 'Delta', placeholder: '0.45' },
                    { key: 'greekTheta', label: 'Theta', placeholder: '-0.05' },
                    { key: 'greekGamma', label: 'Gamma', placeholder: '0.02' },
                    { key: 'greekVega', label: 'Vega', placeholder: '0.10' },
                  ].map(g => (
                    <div key={g.key}>
                      <FieldLabel label={g.label} />
                      <input
                        type="number"
                        value={(form as Record<string, unknown>)[g.key] as string}
                        onChange={e => set(g.key)(e.target.value)}
                        placeholder={g.placeholder}
                        step="any"
                        style={{ ...inputSx, fontSize: 12 }}
                      />
                    </div>
                  ))}
                </div>
              </div>
              {/* Multi-leg builder for complex strategies */}
              {form.strategyType !== 'single' && form.strategyType !== 'covered_call' && form.strategyType !== 'cash_secured_put' && (
                <div>
                  <div style={{ fontSize: 10, color: 'var(--text-3)', marginBottom: 8 }}>
                    Strategy Legs <span style={{ opacity: 0.7 }}>(optional)</span>
                  </div>
                  {optionLegs.map((leg, idx) => (
                    <div key={idx} style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 8, padding: 10, marginBottom: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: BLUE }}>Leg {idx + 1}</span>
                        <button
                          type="button"
                          onClick={() => setOptionLegs(legs => legs.filter((_, i) => i !== idx))}
                          style={{ background: 'none', border: 'none', color: RED, cursor: 'pointer', fontSize: 11, padding: 0 }}
                        >✕ Remove</button>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 8 }}>
                        {[
                          { label: 'Type', el: <select value={leg.optionType} onChange={e => setOptionLegs(ls => ls.map((l, i) => i === idx ? { ...l, optionType: e.target.value as 'call' | 'put' } : l))} style={{ ...inputSx, fontSize: 12 }}><option value="call">Call</option><option value="put">Put</option></select> },
                          { label: 'Side', el: <select value={leg.side} onChange={e => setOptionLegs(ls => ls.map((l, i) => i === idx ? { ...l, side: e.target.value as 'buy' | 'sell' } : l))} style={{ ...inputSx, fontSize: 12 }}><option value="buy">Buy</option><option value="sell">Sell</option></select> },
                          { label: 'Strike', el: <input type="number" value={leg.strikePrice || ''} onChange={e => setOptionLegs(ls => ls.map((l, i) => i === idx ? { ...l, strikePrice: parseFloat(e.target.value) || 0 } : l))} placeholder="150" step="any" style={{ ...inputSx, fontSize: 12 }} /> },
                          { label: 'Expiry', el: <input type="date" value={leg.expirationDate} onChange={e => setOptionLegs(ls => ls.map((l, i) => i === idx ? { ...l, expirationDate: e.target.value } : l))} style={{ ...inputSx, fontSize: 12 }} /> },
                          { label: 'Premium', el: <input type="number" value={leg.premium || ''} onChange={e => setOptionLegs(ls => ls.map((l, i) => i === idx ? { ...l, premium: parseFloat(e.target.value) || 0 } : l))} placeholder="2.50" step="0.01" style={{ ...inputSx, fontSize: 12 }} /> },
                          { label: 'Qty', el: <input type="number" value={leg.quantity || ''} onChange={e => setOptionLegs(ls => ls.map((l, i) => i === idx ? { ...l, quantity: parseInt(e.target.value) || 1 } : l))} placeholder="1" min="1" step="1" style={{ ...inputSx, fontSize: 12 }} /> },
                        ].map(({ label, el }) => (
                          <div key={label}>
                            <FieldLabel label={label} />
                            {el}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setOptionLegs(legs => [...legs, { ...EMPTY_OPTION_LEG }])}
                    style={{ background: 'var(--bg-1)', border: `1px dashed ${BLUE}44`, borderRadius: 8, padding: '6px 14px', color: BLUE, fontSize: 11, cursor: 'pointer', width: '100%' }}
                  >
                    + Add Leg
                  </button>
                </div>
              )}
            </div>
          )}

          {form.assetClass === 'Forex' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12, marginBottom: 12 }}>
              <div style={{ gridColumn: '1 / -1', fontSize: 11, color: BLUE, fontWeight: 600, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 5 }}><IconDollar size={11} />Forex Details</div>
              <div>
                <FieldLabel label="Lot Size" tooltip="Standard lot = 100,000 units. Mini lot = 10,000. Micro lot = 1,000. Larger lots = more risk and reward per pip." />
                <input type="number" value={form.lotSize} onChange={e => set('lotSize')(e.target.value)} placeholder="e.g. 0.1 (mini lot)" step="0.01" style={inputSx} />
              </div>
              <div>
                <FieldLabel label="Pips Gained/Lost" tooltip="A pip is the smallest price move in forex. For EUR/USD: 1 pip = 0.0001. For USD/JPY: 1 pip = 0.01." />
                <input type="number" value={form.pips} onChange={e => set('pips')(e.target.value)} placeholder="e.g. 35 (positive = profit)" step="0.1" style={inputSx} />
              </div>
            </div>
          )}

          {/* Playbook */}
          <PlaybookDropdown value={form.playbookId} onChange={id => set('playbookId')(id)} />

          {/* Prop Firm Account */}
          <PropFirmDropdown value={form.propFirmAccountId} onChange={id => set('propFirmAccountId')(id)} />

          {/* Tags & Rating — Multi-select */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 12, marginBottom: 12 }}>
            <TagPicker
              category="setup_type"
              selected={formSetupTypes}
              onChange={setFormSetupTypes}
              customTags={customTags}
              onAddCustomTag={onAddCustomTag}
            />
            <TagPicker
              category="mistake"
              selected={formMistakes}
              onChange={setFormMistakes}
              customTags={customTags}
              onAddCustomTag={onAddCustomTag}
            />
            <TagPicker
              category="strategy"
              selected={formStrategies}
              onChange={setFormStrategies}
              customTags={customTags}
              onAddCustomTag={onAddCustomTag}
            />
            <div>
              <FieldLabel label="Rating" tooltip="How well did you execute this trade? 5 stars = followed your plan perfectly. 1 star = broke all your rules. Rate execution, not outcome." />
              <StarRating value={form.rating} onChange={v => set('rating')(v)} />
            </div>

            {/* Emotion tag picker */}
            <div style={{ gridColumn: '1 / -1' }}>
              <FieldLabel label="Emotional State (optional)" tooltip="Tag your emotional state when entering this trade. Over time, you'll see which emotions lead to losses. Patterns like 'FOMO trades lose 78%' change behavior faster than rules." />
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => set('emotionTag')('')}
                  style={{ padding: '4px 10px', borderRadius: 20, border: `1px solid ${!form.emotionTag ? 'var(--accent)' : 'var(--border)'}`, background: !form.emotionTag ? 'var(--accent-dim)' : 'transparent', color: !form.emotionTag ? 'var(--accent)' : 'var(--text-3)', fontSize: 11, cursor: 'pointer' }}
                >
                  None
                </button>
                {EMOTION_TAGS.map(e => (
                  <button
                    key={e.label}
                    type="button"
                    title={e.desc}
                    onClick={() => set('emotionTag')(form.emotionTag === e.label ? '' : e.label)}
                    style={{ padding: '4px 10px', borderRadius: 20, border: `1px solid ${form.emotionTag === e.label ? e.color : 'var(--border)'}`, background: form.emotionTag === e.label ? e.color + '25' : 'transparent', color: form.emotionTag === e.label ? e.color : 'var(--text-2)', fontSize: 11, cursor: 'pointer', fontWeight: form.emotionTag === e.label ? 700 : 400 }}
                  >
                    {e.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Notes */}
          <div style={{ marginBottom: 12 }}>
            <FieldLabel label="Trade Notes" tooltip="Write your reasoning, what you saw, what happened, and lessons learned. Future you will thank present you!" />
            <textarea
              value={form.notes}
              onChange={e => set('notes')(e.target.value)}
              placeholder="e.g. Entered AAPL breakout above $150 resistance on high volume. Stop below $145. Target $165. Thesis: earnings catalyst + sector rotation."
              rows={3}
              style={{ ...inputSx, resize: 'vertical', fontFamily: 'inherit' }}
            />
          </div>

          {/* Screenshot */}
          <div style={{ marginBottom: 16 }}>
            <FieldLabel label="Chart Screenshot" tooltip="Upload a screenshot of the chart at the time of your trade. Visual evidence helps you review your decisions later." />
            <input type="file" accept="image/*" onChange={handleScreenshot} style={{ fontSize: 12, color: 'var(--text-2)' }} />
            {form.screenshot && (
              <img src={form.screenshot} alt="Trade screenshot preview" loading="lazy" style={{ maxWidth: 200, maxHeight: 120, marginTop: 8, borderRadius: 6, border: '1px solid var(--border)' }} />
            )}
          </div>

          {/* Auto-calc preview */}
          <Card style={{ background: 'var(--bg-1)', marginBottom: 16, borderColor: preview.pnl >= 0 ? GREEN + '44' : RED + '44' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-2)', marginBottom: 8, textTransform: 'uppercase' }}>Auto-Calculated Preview</div>
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 10, color: 'var(--text-2)' }}>P&amp;L</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: preview.pnl >= 0 ? GREEN : RED, fontFamily: 'var(--mono)' }}>
                  {fmtDollar(preview.pnl)}
                </div>
              </div>
              {/* Futures: show tick P&L */}
              {form.assetClass === 'Futures' && preview.ticks !== null && (
                <div>
                  <div style={{ fontSize: 10, color: 'var(--text-2)' }}>P&amp;L (Ticks)</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: (preview.ticks ?? 0) >= 0 ? GREEN : RED, fontFamily: 'var(--mono)' }}>
                    {(preview.ticks ?? 0) >= 0 ? '+' : ''}{preview.ticks}
                  </div>
                </div>
              )}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--text-2)' }}>
                  R-Multiple
                  <Tooltip text="R-Multiple shows your reward relative to risk. 1R = you made exactly what you risked. 2R = you made double your risk. This is the most important metric for professional traders." position="top" />
                </div>
                <div style={{ fontSize: 18, fontWeight: 700, color: preview.rMultiple >= 0 ? GREEN : RED, fontFamily: 'var(--mono)' }}>
                  {fmtR(preview.rMultiple)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: 'var(--text-2)' }}>% Gain/Loss</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: preview.pct >= 0 ? GREEN : RED, fontFamily: 'var(--mono)' }}>
                  {fmtPct(preview.pct)}
                </div>
              </div>
            </div>
          </Card>

          <button
            onClick={submitTrade}
            style={{
              background: 'var(--green)', border: 'none', borderRadius: 'var(--btn-radius)', padding: '10px 28px',
              color: '#0a0a0c', fontSize: 14, fontWeight: 700, cursor: 'pointer',
            }}
          >
            ✓ Save Trade
          </button>
        </Card>
      )}

      {/* Filters */}
      <Card style={{ marginBottom: 16, padding: 12 }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: 11, color: 'var(--text-2)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}><IconSearch size={11} />FILTER:</span>
          <input
            type="text" placeholder="Symbol..." value={filterSymbol}
            onChange={e => setFilterSymbol(e.target.value)}
            style={{ ...inputSx, width: 100 }}
          />
          <select value={filterAsset} onChange={e => setFilterAsset(e.target.value)} style={{ ...inputSx, width: 110 }}>
            <option value="All">All Assets</option>
            {ASSET_CLASSES.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <select value={filterDir} onChange={e => setFilterDir(e.target.value)} style={{ ...inputSx, width: 100 }}>
            <option value="All">Both Dirs</option>
            <option value="Long">Long</option>
            <option value="Short">Short</option>
          </select>
          <select value={filterWL} onChange={e => setFilterWL(e.target.value)} style={{ ...inputSx, width: 100 }}>
            <option value="All">All</option>
            <option value="Win">Wins only</option>
            <option value="Loss">Losses only</option>
          </select>
          <select value={filterSetup} onChange={e => setFilterSetup(e.target.value)} style={{ ...inputSx, width: 130 }}>
            <option value="All">All Setups</option>
            {SETUP_TAGS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={filterEmotion} onChange={e => setFilterEmotion(e.target.value)} style={{ ...inputSx, width: 120 }}>
            <option value="All">All Emotions</option>
            {EMOTION_TAGS.map(e => <option key={e.label} value={e.label}>{e.label}</option>)}
          </select>
          <button
            onClick={() => { setFilterAsset('All'); setFilterDir('All'); setFilterWL('All'); setFilterSymbol(''); setFilterSetup('All'); setFilterEmotion('All'); setTagFilters({ setup_types: [], mistakes: [], strategies: [] }) }}
            style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 12px', color: 'var(--text-2)', fontSize: 11, cursor: 'pointer' }}
          >
            Clear
          </button>
        </div>
        <TagFilterBar customTags={customTags} activeFilters={tagFilters} onChange={setTagFilters} />
        {/* Emotion summary */}
        {trades.length >= 5 && (() => {
          const map: Record<string, { w: number; l: number }> = {}
          trades.forEach(t => {
            const e = t.emotionTag; if (!e) return
            if (!map[e]) map[e] = { w: 0, l: 0 }
            if (t.pnl > 0) map[e].w++; else map[e].l++
          })
          const entries = Object.entries(map).filter(([, d]) => d.w + d.l >= 2)
          if (!entries.length) return null
          return (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
              {entries.map(([tag, d]) => {
                const total = d.w + d.l
                const pct = Math.round(d.w / total * 100)
                const color = pct > 55 ? 'var(--green)' : pct < 45 ? 'var(--red)' : 'var(--text-2)'
                return (
                  <span key={tag} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 12, background: 'var(--bg-3)', border: '1px solid var(--border)', color }}>
                    {tag}: {d.w}W/{d.l}L ({pct}%)
                  </span>
                )
              })}
            </div>
          )
        })()}
      </Card>

      {/* Trade Table */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-2)', fontSize: 13 }}>
          No trades match your filters. Try adjusting them above.
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr>
                {[
                  { key: 'date', label: 'Date' },
                  { key: 'symbol', label: 'Symbol' },
                  { key: 'dir', label: 'Dir' },
                  { key: 'asset', label: 'Asset' },
                  { key: 'entry', label: 'Entry' },
                  { key: 'exit', label: 'Exit' },
                  { key: 'size', label: 'Size' },
                  { key: 'pnl', label: 'P&L' },
                  { key: 'rMultiple', label: 'R' },
                  { key: 'tags', label: 'Setup' },
                  { key: 'rating', label: '★' },
                  { key: 'actions', label: '' },
                ].map(col => (
                  <th
                    key={col.key}
                    style={thStyle}
                    onClick={() => ['date', 'symbol', 'pnl', 'rMultiple'].includes(col.key) ? toggleSort(col.key) : undefined}
                  >
                    {col.label}
                    {sortCol === col.key ? (sortAsc ? ' ▲' : ' ▼') : ''}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(t => {
                const locked = isDataLocked(currentUser ?? null, t.date)
                return (
                <>
                  <tr
                    key={t.id}
                    onClick={() => {
                      if (locked) {
                        onUpgrade?.('Full Trade History', 'Upgrade to Pro to view all your trades — your data is saved and waiting.')
                        return
                      }
                      if (expandedTradeId === t.id) {
                        setExpandedTradeId(null)
                      } else {
                        openExpandedRow(t)
                      }
                    }}
                    style={{
                      background: locked
                        ? 'rgba(0,0,0,0.2)'
                        : expandedTradeId === t.id ? 'rgba(99,102,241,0.08)' : t.pnl > 0 ? 'rgba(16,185,129,0.04)' : 'rgba(239,68,68,0.04)',
                      borderBottom: '1px solid var(--border)',
                      cursor: 'pointer',
                      transition: 'background 0.15s',
                      opacity: locked ? 0.55 : 1,
                      filter: locked ? 'blur(1.5px)' : 'none',
                    }}
                    onMouseEnter={e => {
                      if (!locked) e.currentTarget.style.background = 'rgba(99,102,241,0.12)'
                    }}
                    onMouseLeave={e => {
                      if (!locked) e.currentTarget.style.background = expandedTradeId === t.id ? 'rgba(99,102,241,0.08)' : t.pnl > 0 ? 'rgba(16,185,129,0.04)' : 'rgba(239,68,68,0.04)'
                    }}
                    title={locked ? 'Upgrade to Pro to view this trade' : 'Click to expand / collapse'}
                  >
                    <td style={{ padding: '10px 12px' }}>{t.date}</td>
                    <td style={{ padding: '10px 12px', fontWeight: 700, fontFamily: 'var(--mono)', color: BLUE }}>
                      {locked ? '••••' : t.symbol}
                      {!locked && t.source === 'webhook' && (
                        <span title="Auto-imported via webhook" style={{ marginLeft: 4, verticalAlign: 'middle', display: 'inline-flex', alignItems: 'center' }}>
                          <IconLightningBolt size={11} style={{ color: 'var(--accent)' }} />
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '10px 12px', color: t.direction === 'Long' ? GREEN : RED }}>{locked ? '—' : t.direction}</td>
                    <td style={{ padding: '10px 12px', color: 'var(--text-2)' }}>{locked ? '—' : t.assetClass}</td>
                    <td style={{ padding: '10px 12px', fontFamily: 'var(--mono)' }}>{locked ? '••••' : `$${fmt2(t.entryPrice)}`}</td>
                    <td style={{ padding: '10px 12px', fontFamily: 'var(--mono)' }}>{locked ? '••••' : `$${fmt2(t.exitPrice)}`}</td>
                    <td style={{ padding: '10px 12px', fontFamily: 'var(--mono)' }}>{locked ? '—' : t.positionSize}</td>
                    <td style={{ padding: '10px 12px', fontFamily: 'var(--mono)', fontWeight: 700, color: t.pnl >= 0 ? GREEN : RED }}>
                      {locked ? '••••' : fmtDollar(t.pnl)}
                    </td>
                    <td style={{ padding: '10px 12px', fontFamily: 'var(--mono)', color: t.rMultiple >= 0 ? GREEN : RED }}>
                      {locked ? '—' : fmtR(t.rMultiple)}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      {!locked && (
                        <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                          {(t.tags_setup_types || (t.setupTag ? [t.setupTag] : [])).map(tag => (
                            <TagChip key={tag} tag={{ name: tag, color: '#6366f1', category: 'setup_type', id: '', isPreset: true }} size="small" />
                          ))}
                          {(t.tags_strategies || []).map(tag => (
                            <TagChip key={tag} tag={{ name: tag, color: '#10b981', category: 'strategy', id: '', isPreset: true }} size="small" />
                          ))}
                          {t.playbookId && (() => {
                            const pbs = loadPlaybooks()
                            const pb = pbs.find(p => p.id === t.playbookId)
                            if (!pb) return null
                            const col = CATEGORY_COLORS[pb.category]
                            return (
                              <span key={pb.id} style={{
                                background: col + '22', color: col,
                                border: `1px solid ${col}55`,
                                borderRadius: 10, padding: '1px 6px',
                                fontSize: 10, fontWeight: 700,
                                textTransform: 'uppercase', letterSpacing: '0.04em',
                              }}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline', verticalAlign: 'middle', marginRight: 5 }}>
                            <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
                            <rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
                          </svg>{pb.name}
                              </span>
                            )
                          })()}
                        </div>
                      )}
                      {locked && (
                        <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }}>
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                          </svg><span style={{ textDecoration: 'underline', cursor: 'pointer' }}
                            onClick={e => { e.stopPropagation(); onUpgrade?.('Full Trade History', 'Upgrade to Pro to view all your trades — your data is saved and waiting.') }}>
                            Upgrade
                          </span>
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      {locked ? '' : ('★'.repeat(t.rating) + '○'.repeat(5 - t.rating))}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      {!locked && (
                        <button
                          onClick={e => { e.stopPropagation(); deleteTrade(t.id) }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: RED, fontSize: 14, padding: 2 }}
                        >✕</button>
                      )}
                    </td>
                  </tr>
                  {expandedTradeId === t.id && (
                    <tr key={t.id + '-exp'}>
                      <td colSpan={12} style={{ padding: '0', background: 'var(--bg-1)', borderBottom: '2px solid rgba(99,102,241,0.3)' }}>
                        {/* ── Expanded Trade Row — 3-column edit panel ── */}
                        {(() => {
                          const ef = expandedEditForm
                          // R-Multiple auto-calculation
                          const sl = parseFloat(ef.stopLoss) || 0
                          const tp = parseFloat(ef.takeProfit) || 0
                          const rMultipleCalc = (() => {
                            if (!sl || sl === t.entryPrice) return '—'
                            const riskPerShare = Math.abs(t.entryPrice - sl)
                            if (riskPerShare === 0) return '—'
                            let reward: number
                            if (t.direction === 'Long') {
                              reward = t.exitPrice - t.entryPrice
                            } else {
                              reward = t.entryPrice - t.exitPrice
                            }
                            const r = reward / riskPerShare
                            return isFinite(r) ? `${r.toFixed(2)}R` : '—'
                          })()
                          const rrCalc = (() => {
                            if (!sl || sl === t.entryPrice || !tp) return '—'
                            const risk = Math.abs(t.entryPrice - sl)
                            const reward = Math.abs(tp - t.entryPrice)
                            if (risk === 0) return '—'
                            const rr = reward / risk
                            return isFinite(rr) ? `1:${rr.toFixed(2)}` : '—'
                          })()
                          // Hold time
                          const holdTimeStr = (() => {
                            if (!t.date || !t.time || !t.exitPrice) return '—'
                            // open trade (exit=0)
                            if (t.exitPrice === 0) return 'Open'
                            if (t.holdMinutes && t.holdMinutes > 0) {
                              const h = Math.floor(t.holdMinutes / 60)
                              const m = t.holdMinutes % 60
                              return h > 0 ? `${h}h ${m}m` : `${m}m`
                            }
                            return '—'
                          })()
                          const isWebhook = t.source === 'webhook'
                          const colLabel: React.CSSProperties = { fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 5 }
                          const fldLabel: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: 'var(--text-2)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }
                          const roSx: React.CSSProperties = { ...inputSx, color: 'var(--text-3)', cursor: 'default', background: 'var(--bg-3)' }
                          return (
                            <div style={{ padding: '16px 20px 20px' }}>
                              {isWebhook && (
                                <div style={{ marginBottom: 12, padding: '8px 12px', background: 'rgba(99,102,241,0.08)', borderRadius: 8, fontSize: 12, color: 'var(--text-2)', display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <IconLightningBolt size={12} style={{ color: 'var(--accent)' }} />
                                  Auto-imported via webhook. Core data (symbol, price, qty, direction) is read-only — add your metadata below.
                                  {savedNoticeTradeId === t.id && (
                                    <span style={{ marginLeft: 'auto', color: 'var(--green)', fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3 }}>
                                      <IconCheck size={11} /> Saved ✓
                                    </span>
                                  )}
                                </div>
                              )}
                              {!isWebhook && savedNoticeTradeId === t.id && (
                                <div style={{ marginBottom: 8, textAlign: 'right', color: 'var(--green)', fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 3 }}>
                                  <IconCheck size={11} /> Saved ✓
                                </div>
                              )}
                              {/* 3-col grid */}
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 24 }}>
                                {/* ── Column 1: Risk Management ── */}
                                <div>
                                  <div style={colLabel}><IconShield size={12} />Risk Management</div>
                                  <div style={{ marginBottom: 12 }}>
                                    <div style={fldLabel}><IconShield size={11} />Stop Loss</div>
                                    <input
                                      type="number"
                                      value={ef.stopLoss}
                                      onChange={e => applyExpandedEdit(t.id, { stopLoss: e.target.value })}
                                      placeholder="e.g. 145.00"
                                      step="any"
                                      style={isWebhook ? roSx : inputSx}
                                    />
                                  </div>
                                  <div style={{ marginBottom: 12 }}>
                                    <div style={fldLabel}><IconTrendingUp size={11} />Take Profit</div>
                                    <input
                                      type="number"
                                      value={ef.takeProfit}
                                      onChange={e => applyExpandedEdit(t.id, { takeProfit: e.target.value })}
                                      placeholder="e.g. 165.00"
                                      step="any"
                                      style={isWebhook ? roSx : inputSx}
                                    />
                                  </div>
                                  <div style={{ marginBottom: 12 }}>
                                    <div style={fldLabel}>R-Multiple</div>
                                    <input type="text" value={rMultipleCalc} readOnly style={roSx} />
                                  </div>
                                  <div style={{ marginBottom: 12 }}>
                                    <div style={fldLabel}>Risk / Reward</div>
                                    <input type="text" value={rrCalc} readOnly style={roSx} />
                                  </div>
                                  <div>
                                    <div style={fldLabel}>Hold Time</div>
                                    <input type="text" value={holdTimeStr} readOnly style={roSx} />
                                  </div>
                                </div>

                                {/* ── Column 2: Review ── */}
                                <div>
                                  <div style={colLabel}><IconStar size={12} />Review</div>
                                  <div style={{ marginBottom: 14 }}>
                                    <div style={fldLabel}><IconStar size={11} />Rating</div>
                                    <div style={{ display: 'flex', gap: 4 }}>
                                      {[1,2,3,4,5].map(n => (
                                        <button
                                          key={n}
                                          onClick={() => applyExpandedEdit(t.id, { rating: n })}
                                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 1 }}
                                        >
                                          <svg width="22" height="22" viewBox="0 0 24 24" fill={n <= ef.rating ? YELLOW : 'none'} stroke={n <= ef.rating ? YELLOW : 'var(--border)'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                                          </svg>
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                  <div style={{ marginBottom: 12 }}>
                                    <div style={fldLabel}><IconClipboard size={11} />Setup / Strategy</div>
                                    <select
                                      value={ef.setupTag}
                                      onChange={e => applyExpandedEdit(t.id, { setupTag: e.target.value, tags_setup_types: e.target.value ? [e.target.value] : [] })}
                                      style={inputSx}
                                    >
                                      <option value="">— None —</option>
                                      {SETUP_TAGS.map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                  </div>
                                  <div style={{ marginBottom: 12 }}>
                                    <div style={fldLabel}><IconAlert size={11} />Mistake Tag</div>
                                    <select
                                      value={ef.mistakeTag}
                                      onChange={e => applyExpandedEdit(t.id, { mistakeTag: e.target.value, tags_mistakes: e.target.value && e.target.value !== 'None' ? [e.target.value] : [] })}
                                      style={inputSx}
                                    >
                                      {MISTAKE_TAGS.map(m => <option key={m} value={m}>{m}</option>)}
                                    </select>
                                  </div>
                                  <div>
                                    <div style={fldLabel}><IconBuilding size={11} />Prop Firm Account</div>
                                    <PropFirmDropdown value={ef.propFirmAccountId} onChange={id => applyExpandedEdit(t.id, { propFirmAccountId: id })} />
                                  </div>
                                </div>

                                {/* ── Column 3: Notes ── */}
                                <div>
                                  <div style={colLabel}><IconFileText size={12} />Notes</div>
                                  <div style={{ marginBottom: 12 }}>
                                    <div style={fldLabel}><IconFileText size={11} />Trade Notes</div>
                                    <textarea
                                      value={ef.notes}
                                      onChange={e => applyExpandedEdit(t.id, { notes: e.target.value })}
                                      rows={4}
                                      style={{ ...inputSx, resize: 'vertical', fontFamily: 'inherit' }}
                                      placeholder="Reasoning, what happened, lessons learned…"
                                    />
                                  </div>
                                  <div>
                                    <div style={fldLabel}><IconCamera size={11} />Screenshot</div>
                                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontSize: 12, color: 'var(--text-1)' }}>
                                      <IconCamera size={12} />Upload chart
                                      <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => {
                                        const file = e.target.files?.[0]
                                        if (!file) return
                                        const reader = new FileReader()
                                        reader.onload = () => applyExpandedEdit(t.id, { screenshot: reader.result as string })
                                        reader.readAsDataURL(file)
                                      }} />
                                    </label>
                                    {ef.screenshot && (
                                      <div style={{ marginTop: 8 }}>
                                        <img src={ef.screenshot} alt="Screenshot preview" loading="lazy" style={{ maxWidth: '100%', maxHeight: 160, borderRadius: 6, border: '1px solid var(--border)', display: 'block' }} />
                                        <button type="button" onClick={() => applyExpandedEdit(t.id, { screenshot: '' })} style={{ marginTop: 4, background: 'none', border: 'none', color: RED, cursor: 'pointer', fontSize: 11, padding: 0 }}>Remove</button>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          )
                        })()}
                      </td>
                    </tr>
                  )}
                </>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Tab 3: Calendar ──────────────────────────────────────────────────────────

function TabCalendar({ trades }: { trades: Trade[] }) {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth()) // 0-indexed
  const [selectedDay, setSelectedDay] = useState<string | null>(null)

  const byDay = useMemo(() => {
    const map: Record<string, { pnl: number; trades: Trade[] }> = {}
    trades.forEach(t => {
      if (!map[t.date]) map[t.date] = { pnl: 0, trades: [] }
      map[t.date].pnl += t.pnl
      map[t.date].trades.push(t)
    })
    return map
  }, [trades])

  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDow = new Date(year, month, 1).getDay()
  const days: (number | null)[] = Array(firstDow).fill(null)
  for (let d = 1; d <= daysInMonth; d++) days.push(d)

  const maxPnl = Math.max(...Object.values(byDay).map(d => Math.abs(d.pnl)), 1)

  const monthName = new Date(year, month, 1).toLocaleString('default', { month: 'long' })

  // Weekly summary
  const weeklyPnl = useMemo(() => {
    const weeks: Record<number, number> = {}
    trades.forEach(t => {
      const d = new Date(t.date)
      if (d.getFullYear() === year && d.getMonth() === month) {
        const dayOfMonth = d.getDate()
        const dow = (firstDow + dayOfMonth - 1) % 7
        const week = Math.floor((firstDow + dayOfMonth - 1) / 7)
        weeks[week] = (weeks[week] || 0) + t.pnl
      }
    })
    return Object.entries(weeks).sort((a, b) => +a[0] - +b[0]).map(([w, pnl]) => ({ week: +w + 1, pnl }))
  }, [trades, year, month, firstDow])

  const monthPnl = useMemo(() =>
    trades.filter(t => {
      const d = new Date(t.date)
      return d.getFullYear() === year && d.getMonth() === month
    }).reduce((s, t) => s + t.pnl, 0),
    [trades, year, month]
  )

  const selectedTrades = selectedDay ? (byDay[selectedDay]?.trades || []) : []

  return (
    <div>
      <SectionHeader
        title="Calendar"
        sub="See your trading performance by day. Green = profitable, Red = losing. Click any day to see the trades."
      />

      {/* Month navigator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
        <button onClick={() => { if (month === 0) { setMonth(11); setYear(y => y - 1) } else setMonth(m => m - 1) }}
          style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 14px', color: 'var(--text-0)', cursor: 'pointer', fontSize: 14 }}>
          ‹
        </button>
        <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-0)', minWidth: 160, textAlign: 'center' }}>
          {monthName} {year}
        </span>
        <button onClick={() => { if (month === 11) { setMonth(0); setYear(y => y + 1) } else setMonth(m => m + 1) }}
          style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 14px', color: 'var(--text-0)', cursor: 'pointer', fontSize: 14 }}>
          ›
        </button>
        <div style={{ marginLeft: 'auto', fontSize: 15, fontWeight: 700, color: monthPnl >= 0 ? GREEN : RED, fontFamily: 'var(--mono)' }}>
          Month: {fmtDollar(monthPnl)}
        </div>
      </div>

      {/* Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 20 }}>
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
          <div key={d} style={{ textAlign: 'center', fontSize: 11, fontWeight: 600, color: 'var(--text-2)', padding: '4px 0', textTransform: 'uppercase' }}>
            {d}
          </div>
        ))}
        {days.map((d, i) => {
          if (d === null) return <div key={`null-${i}`} />
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
          const dayData = byDay[dateStr]
          const isToday = dateStr === today.toISOString().slice(0, 10)
          const isSelected = selectedDay === dateStr

          let bg = 'var(--bg-2)'
          let borderColor = 'var(--border)'
          if (dayData) {
            const intensity = Math.min(Math.abs(dayData.pnl) / maxPnl, 1) * 0.7 + 0.15
            bg = dayData.pnl >= 0 ? `rgba(16,185,129,${intensity})` : `rgba(239,68,68,${intensity})`
            borderColor = dayData.pnl >= 0 ? GREEN + '66' : RED + '66'
          }
          if (isSelected) borderColor = BLUE

          return (
            <div
              key={dateStr}
              onClick={() => setSelectedDay(isSelected ? null : dateStr)}
              style={{
                background: bg,
                border: `2px solid ${borderColor}`,
                borderRadius: 8,
                padding: '8px 4px',
                minHeight: 60,
                cursor: dayData ? 'pointer' : 'default',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                transition: 'border-color 0.15s',
                boxShadow: isToday ? `0 0 0 2px ${BLUE}` : undefined,
              }}
            >
              <div style={{ fontSize: 11, fontWeight: isToday ? 800 : 500, color: isToday ? BLUE : 'var(--text-0)' }}>{d}</div>
              {dayData && (
                <>
                  <div style={{ fontSize: 9, color: dayData.pnl >= 0 ? '#fff' : '#fff', fontFamily: 'var(--mono)', marginTop: 2, fontWeight: 700 }}>
                    {dayData.pnl >= 0 ? '+' : ''}{Math.round(dayData.pnl)}
                  </div>
                  <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.7)', marginTop: 1 }}>
                    {dayData.trades.length}t
                  </div>
                </>
              )}
            </div>
          )
        })}
      </div>

      {/* Day popup */}
      {selectedDay && selectedTrades.length > 0 && (
        <Card style={{ marginBottom: 16, borderColor: byDay[selectedDay].pnl >= 0 ? GREEN + '44' : RED + '44' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-0)' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><IconCalendar size={14} />{new Date(selectedDay + 'T12:00:00').toLocaleDateString('default', { weekday: 'long', month: 'long', day: 'numeric' })}</span>
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'var(--mono)', color: byDay[selectedDay].pnl >= 0 ? GREEN : RED }}>
              {fmtDollar(byDay[selectedDay].pnl)}
            </div>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Symbol', 'Direction', 'Entry', 'Exit', 'P&L', 'R-Mult', 'Setup'].map(h => (
                  <th key={h} style={{ padding: '4px 8px', textAlign: 'left', color: 'var(--text-2)', fontWeight: 600, fontSize: 10, textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {selectedTrades.map(t => (
                <tr key={t.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '8px', fontWeight: 700, color: BLUE }}>{t.symbol}</td>
                  <td style={{ padding: '8px', color: t.direction === 'Long' ? GREEN : RED }}>{t.direction}</td>
                  <td style={{ padding: '8px', fontFamily: 'var(--mono)' }}>${fmt2(t.entryPrice)}</td>
                  <td style={{ padding: '8px', fontFamily: 'var(--mono)' }}>${fmt2(t.exitPrice)}</td>
                  <td style={{ padding: '8px', fontFamily: 'var(--mono)', fontWeight: 700, color: t.pnl >= 0 ? GREEN : RED }}>{fmtDollar(t.pnl)}</td>
                  <td style={{ padding: '8px', fontFamily: 'var(--mono)', color: t.rMultiple >= 0 ? GREEN : RED }}>{fmtR(t.rMultiple)}</td>
                  <td style={{ padding: '8px', color: 'var(--text-2)' }}>{t.setupTag || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {/* Weekly summary */}
      {weeklyPnl.length > 0 && (
        <Card>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)', marginBottom: 12, textTransform: 'uppercase' }}>
            Weekly Summary — {monthName} {year}
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {weeklyPnl.map(w => (
              <div key={w.week} style={{
                background: 'var(--bg-1)', borderRadius: 8, padding: '10px 16px',
                border: `1px solid ${w.pnl >= 0 ? GREEN + '44' : RED + '44'}`,
              }}>
                <div style={{ fontSize: 10, color: 'var(--text-2)', marginBottom: 4 }}>Week {w.week}</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: w.pnl >= 0 ? GREEN : RED, fontFamily: 'var(--mono)' }}>
                  {fmtDollar(w.pnl)}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}

// ─── Journal Expectancy (auto-populated from trade data) ─────────────────────

function JournalExpectancy({ trades }: { trades: Trade[] }) {
  const calc = useMemo(() => {
    if (trades.length < 3) return null
    const wins = trades.filter(t => t.pnl > 0)
    const losses = trades.filter(t => t.pnl < 0)
    const winRate = wins.length / trades.length
    const avgWin = wins.length > 0 ? wins.reduce((s, t) => s + t.pnl, 0) / wins.length : 0
    const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((s, t) => s + t.pnl, 0) / losses.length) : 0
    const expectancy = winRate * avgWin - (1 - winRate) * avgLoss
    // Estimate trades/month from date range
    const dates = trades.map(t => new Date(t.date).getTime()).sort((a, b) => a - b)
    const spanDays = dates.length > 1 ? (dates[dates.length - 1] - dates[0]) / 86400000 : 30
    const tradesPerMonth = spanDays > 0 ? (trades.length / spanDays) * 30 : trades.length
    const monthlyExpectancy = expectancy * tradesPerMonth
    const annualExpectancy = monthlyExpectancy * 12
    return { winRate, avgWin, avgLoss, expectancy, tradesPerMonth, monthlyExpectancy, annualExpectancy }
  }, [trades])

  if (!calc) return null

  const isPositive = calc.expectancy > 0
  const fmt = (n: number) => `${n >= 0 ? '+$' : '-$'}${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  return (
    <Card style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <div className="tv-card-icon" style={{ width: 32, height: 32, fontSize: 15 }}>
          <IconCalculator size={16} />
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-0)' }}>Trade Expectancy</div>
          <div style={{ fontSize: 11, color: 'var(--text-3)' }}>Auto-calculated from your {trades.length} logged trades</div>
        </div>
        <Tooltip text="Expectancy = (Win Rate × Avg Win) − (Loss Rate × Avg Loss). A positive value means your system has a statistical edge over many trades." position="right" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 14 }}>
        {[
          { label: 'Win Rate', value: `${(calc.winRate * 100).toFixed(1)}%`, color: calc.winRate >= 0.5 ? GREEN : YELLOW },
          { label: 'Avg Win', value: `$${calc.avgWin.toFixed(2)}`, color: GREEN },
          { label: 'Avg Loss', value: `-$${calc.avgLoss.toFixed(2)}`, color: RED },
        ].map(s => (
          <div key={s.label} style={{ background: 'var(--bg-1)', borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: 'var(--text-2)', textTransform: 'uppercase', fontWeight: 600, marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 18, fontWeight: 800, fontFamily: 'var(--mono)', color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>
      <div style={{
        background: isPositive ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
        border: `1px solid ${isPositive ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.4)'}`,
        borderRadius: 10, padding: '14px 16px',
        display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, alignItems: 'center',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 10, color: 'var(--text-3)', textTransform: 'uppercase', fontWeight: 600, marginBottom: 4 }}>Per Trade</div>
          <div style={{ fontSize: 22, fontWeight: 800, fontFamily: 'var(--mono)', color: isPositive ? GREEN : RED }}>{fmt(calc.expectancy)}</div>
          <div style={{ fontSize: 10, color: isPositive ? GREEN : RED, marginTop: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
            {isPositive ? <IconCheck size={11} /> : <IconAlert size={11} />}
            {isPositive ? 'Positive edge' : 'Negative edge'}
          </div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 10, color: 'var(--text-3)', textTransform: 'uppercase', fontWeight: 600, marginBottom: 4 }}>Monthly (~{calc.tradesPerMonth.toFixed(0)} trades)</div>
          <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'var(--mono)', color: calc.monthlyExpectancy >= 0 ? GREEN : RED }}>{fmt(calc.monthlyExpectancy)}</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 10, color: 'var(--text-3)', textTransform: 'uppercase', fontWeight: 600, marginBottom: 4 }}>Annual</div>
          <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'var(--mono)', color: calc.annualExpectancy >= 0 ? GREEN : RED }}>{fmt(calc.annualExpectancy)}</div>
        </div>
      </div>
      <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text-3)' }}>
        Use the standalone <strong>Trade Expectancy Calculator</strong> in Tools to run what-if scenarios with custom inputs.
      </div>
      <p style={{ fontSize: 10, color: 'var(--text-3)', textAlign: 'center', margin: '12px 0 0', fontStyle: 'italic' }}>
        Past trading performance does not guarantee future results. For informational purposes only.
      </p>
    </Card>
  )
}

// ─── Tab 4: Analytics ─────────────────────────────────────────────────────────

function TabAnalytics({ trades }: { trades: Trade[] }) {
  // Asset Type filter for analytics
  const [analyticsAssetFilter, setAnalyticsAssetFilter] = useState<'All' | AssetClass>('All')

  const filteredTrades = useMemo(() =>
    analyticsAssetFilter === 'All' ? trades : trades.filter(t => t.assetClass === analyticsAssetFilter),
    [trades, analyticsAssetFilter]
  )

  // Futures-specific: P&L by contract type (ticks + dollars)
  const futuresStats = useMemo(() => {
    const futures = trades.filter(t => t.assetClass === 'Futures' && t.contractType)
    if (futures.length === 0) return null
    const byContract: Record<string, { pnlDollars: number; pnlTicks: number; count: number; wins: number }> = {}
    futures.forEach(t => {
      const k = t.contractType!
      if (!byContract[k]) byContract[k] = { pnlDollars: 0, pnlTicks: 0, count: 0, wins: 0 }
      byContract[k].pnlDollars += t.pnl
      byContract[k].pnlTicks += t.pnlTicks ?? 0
      byContract[k].count++
      if (t.pnl > 0) byContract[k].wins++
    })
    return Object.entries(byContract).sort((a, b) => b[1].pnlDollars - a[1].pnlDollars)
  }, [trades])

  // Options-specific: P&L by strategy type
  const optionsStrategyStats = useMemo(() => {
    const opts = trades.filter(t => t.assetClass === 'Option')
    if (opts.length === 0) return null
    const byStrategy: Record<string, { pnl: number; count: number; wins: number }> = {}
    opts.forEach(t => {
      const k = t.strategyType || 'single'
      if (!byStrategy[k]) byStrategy[k] = { pnl: 0, count: 0, wins: 0 }
      byStrategy[k].pnl += t.pnl
      byStrategy[k].count++
      if (t.pnl > 0) byStrategy[k].wins++
    })
    return Object.entries(byStrategy).sort((a, b) => b[1].pnl - a[1].pnl)
  }, [trades])

  const stats = useMemo(() => computeStats(filteredTrades), [filteredTrades])

  const byDow = useMemo(() => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    const map: Record<number, { sum: number; count: number }> = {}
    filteredTrades.forEach(t => {
      const dow = new Date(t.date + 'T12:00:00').getDay()
      if (!map[dow]) map[dow] = { sum: 0, count: 0 }
      map[dow].sum += t.pnl
      map[dow].count++
    })
    return [1, 2, 3, 4, 5].map(dow => ({
      label: days[dow].slice(0, 3),
      value: map[dow] ? map[dow].sum / map[dow].count : 0,
    }))
  }, [filteredTrades])

  const byHour = useMemo(() => {
    const map: Record<number, { sum: number; count: number }> = {}
    filteredTrades.forEach(t => {
      if (!t.time) return
      const hour = parseInt(t.time.slice(0, 2))
      if (!map[hour]) map[hour] = { sum: 0, count: 0 }
      map[hour].sum += t.pnl
      map[hour].count++
    })
    return Object.entries(map).sort((a, b) => +a[0] - +b[0]).map(([h, d]) => ({
      label: `${h}:00`,
      value: d.sum / d.count,
    }))
  }, [filteredTrades])

  const bySetup = useMemo(() => {
    const map: Record<string, { sum: number; count: number; wins: number }> = {}
    filteredTrades.forEach(t => {
      const key = t.setupTag || 'Untagged'
      if (!map[key]) map[key] = { sum: 0, count: 0, wins: 0 }
      map[key].sum += t.pnl
      map[key].count++
      if (t.pnl > 0) map[key].wins++
    })
    return Object.entries(map).sort((a, b) => b[1].sum - a[1].sum).map(([label, d]) => ({
      label, value: d.sum,
      winRate: (d.wins / d.count * 100).toFixed(0) + '%',
      count: d.count,
    }))
  }, [filteredTrades])

  const byDirection = useMemo(() => {
    const map: Record<string, { sum: number; count: number; wins: number }> = {}
    filteredTrades.forEach(t => {
      if (!map[t.direction]) map[t.direction] = { sum: 0, count: 0, wins: 0 }
      map[t.direction].sum += t.pnl
      map[t.direction].count++
      if (t.pnl > 0) map[t.direction].wins++
    })
    return Object.entries(map).map(([label, d]) => ({ label, value: d.sum }))
  }, [filteredTrades])

  // Histogram
  const histogram = useMemo(() => {
    if (filteredTrades.length === 0) return []
    const vals = filteredTrades.map(t => t.pnl)
    const min = Math.min(...vals), max = Math.max(...vals)
    const range = max - min || 1
    const bins = 8
    const binSize = range / bins
    const counts = Array(bins).fill(0)
    vals.forEach(v => {
      const i = Math.min(Math.floor((v - min) / binSize), bins - 1)
      counts[i]++
    })
    return counts.map((count, i) => ({
      label: `$${Math.round(min + i * binSize)}`,
      value: count,
      isWin: min + (i + 0.5) * binSize >= 0,
    }))
  }, [filteredTrades])

  if (trades.length < 3) return (
    <div style={{ textAlign: 'center', padding: '60px 20px' }}>
      <div style={{ color: 'var(--text-3)', marginBottom: 16, display: 'flex', justifyContent: 'center' }}><IconChart size={48} /></div>
      <h3 style={{ color: 'var(--text-0)', marginBottom: 8 }}>Need more trades</h3>
      <p style={{ color: 'var(--text-2)', fontSize: 14 }}>Log at least 3 trades to unlock analytics insights.</p>
    </div>
  )

  const maxHist = Math.max(...histogram.map(h => h.value), 1)

  return (
    <div>
      <SectionHeader
        title="Analytics"
        sub="Deep dive into your trading patterns. Find what works, eliminate what doesn't."
      />

      {/* Asset Type Filter */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 11, color: 'var(--text-2)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Asset Type:</span>
        {(['All', ...ASSET_CLASSES] as const).map(ac => (
          <button
            key={ac}
            onClick={() => setAnalyticsAssetFilter(ac as typeof analyticsAssetFilter)}
            style={{
              background: analyticsAssetFilter === ac ? 'var(--accent)' : 'var(--bg-2)',
              border: `1px solid ${analyticsAssetFilter === ac ? 'var(--accent)' : 'var(--border)'}`,
              borderRadius: 20,
              padding: '5px 14px',
              color: analyticsAssetFilter === ac ? '#0a0a0c' : 'var(--text-2)',
              fontSize: 12,
              fontWeight: analyticsAssetFilter === ac ? 700 : 400,
              cursor: 'pointer',
            }}
          >
            {ac} {ac !== 'All' ? `(${trades.filter(t => t.assetClass === ac).length})` : `(${trades.length})`}
          </button>
        ))}
      </div>

      {/* ── Futures panel ── */}
      {(analyticsAssetFilter === 'All' || analyticsAssetFilter === 'Futures') && futuresStats && futuresStats.length > 0 && (
        <Card style={{ marginBottom: 16, borderColor: BLUE + '44' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: BLUE, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
            <IconChart size={13} />Futures Performance by Contract
          </div>
          <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Contract', 'Trades', 'Win%', 'P&L (Ticks)', 'P&L (USD)'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '4px 8px', fontSize: 10, color: 'var(--text-2)', textTransform: 'uppercase', borderBottom: '1px solid var(--border)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {futuresStats.map(([contract, d]) => (
                <tr key={contract} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '8px', fontWeight: 700, fontFamily: 'var(--mono)', color: BLUE }}>{contract}</td>
                  <td style={{ padding: '8px', color: 'var(--text-2)' }}>{d.count}</td>
                  <td style={{ padding: '8px', color: 'var(--text-2)' }}>{(d.wins / d.count * 100).toFixed(0)}%</td>
                  <td style={{ padding: '8px', fontFamily: 'var(--mono)', fontWeight: 700, color: d.pnlTicks >= 0 ? GREEN : RED }}>
                    {d.pnlTicks >= 0 ? '+' : ''}{d.pnlTicks.toFixed(1)} ticks
                  </td>
                  <td style={{ padding: '8px', fontFamily: 'var(--mono)', fontWeight: 700, color: d.pnlDollars >= 0 ? GREEN : RED }}>
                    {fmtDollar(d.pnlDollars)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {/* ── Options panel ── */}
      {(analyticsAssetFilter === 'All' || analyticsAssetFilter === 'Option') && optionsStrategyStats && optionsStrategyStats.length > 0 && (
        <Card style={{ marginBottom: 16, borderColor: YELLOW + '44' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: YELLOW, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
            <IconClipboard size={13} />Options Performance by Strategy
          </div>
          <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Strategy', 'Trades', 'Win%', 'Net P&L'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '4px 8px', fontSize: 10, color: 'var(--text-2)', textTransform: 'uppercase', borderBottom: '1px solid var(--border)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {optionsStrategyStats.map(([strategy, d]) => (
                <tr key={strategy} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '8px', color: 'var(--text-1)' }}>{(OPTION_STRATEGY_LABELS[strategy] || strategy).replace(/_/g, ' ')}</td>
                  <td style={{ padding: '8px', color: 'var(--text-2)' }}>{d.count}</td>
                  <td style={{ padding: '8px', color: 'var(--text-2)' }}>{(d.wins / d.count * 100).toFixed(0)}%</td>
                  <td style={{ padding: '8px', fontFamily: 'var(--mono)', fontWeight: 700, color: d.pnl >= 0 ? GREEN : RED }}>{fmtDollar(d.pnl)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-0)', display: 'flex', alignItems: 'center', gap: 5 }}><IconCalendar size={13} />Avg P&L by Day of Week</span>
            <Tooltip text="Which day of the week is most profitable for you on average? Some traders are better on Mondays (trend continuation), others on Fridays (position squaring). Use this to optimize your schedule." position="right" />
          </div>
          <BarChart data={byDow} title="" />
        </Card>
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-0)', display: 'flex', alignItems: 'center', gap: 5 }}><IconZap size={13} />Avg P&L by Hour</span>
            <Tooltip text="Best and worst trading hours. Many traders find the first hour (9-10 AM) and last hour (3-4 PM) most volatile. The lunch hour (12-1 PM) is often slow." position="right" />
          </div>
          {byHour.length > 0 ? <BarChart data={byHour} title="" /> : <div style={{ color: 'var(--text-2)', fontSize: 12 }}>Log trades with timestamps to see this.</div>}
        </Card>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-0)', display: 'flex', alignItems: 'center', gap: 5 }}><IconTarget size={13} />Performance by Setup</span>
            <Tooltip text="Which setups are actually making you money? Double down on profitable setups, reduce or eliminate losing ones. This is how you refine your edge." position="right" />
          </div>
          {bySetup.map(s => (
            <div key={s.label} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                <span style={{ color: 'var(--text-1)' }}>{s.label} <span style={{ color: 'var(--text-2)', fontSize: 10 }}>({s.count}t, {s.winRate} WR)</span></span>
                <span style={{ fontFamily: 'var(--mono)', color: s.value >= 0 ? GREEN : RED }}>{fmtDollar(s.value)}</span>
              </div>
              <div style={{ background: 'var(--bg-1)', borderRadius: 4, height: 6, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${(Math.abs(s.value) / Math.max(...bySetup.map(x => Math.abs(x.value)), 1)) * 100}%`, background: s.value >= 0 ? GREEN : RED, borderRadius: 4 }} />
              </div>
            </div>
          ))}
        </Card>
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-0)', display: 'flex', alignItems: 'center', gap: 5 }}><IconArrowUpDown size={13} />Long vs Short</span>
            <Tooltip text="Are you better as a Long (buyer) or Short (seller)? Some traders are naturally better at one direction. Focus on your edge." position="right" />
          </div>
          <BarChart data={byDirection} title="" />

          <div style={{ marginTop: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-0)', display: 'flex', alignItems: 'center', gap: 5 }}><IconFlame size={13} />Streak Analysis</span>
              <Tooltip text="Streaks reveal psychological patterns. Long losing streaks may indicate you're breaking rules when frustrated. Long winning streaks often precede overconfidence." position="right" />
            </div>
            {stats && (
              <div style={{ display: 'flex', gap: 16 }}>
                <div style={{ flex: 1, background: 'var(--bg-1)', borderRadius: 8, padding: 12, textAlign: 'center' }}>
                  <div style={{ fontSize: 10, color: 'var(--text-2)', marginBottom: 4 }}>Best Win Streak</div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: GREEN, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}><IconFlame size={18} />{stats.longestWin}</div>
                </div>
                <div style={{ flex: 1, background: 'var(--bg-1)', borderRadius: 8, padding: 12, textAlign: 'center' }}>
                  <div style={{ fontSize: 10, color: 'var(--text-2)', marginBottom: 4 }}>Worst Loss Streak</div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: RED, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}><IconSkull size={18} />{stats.longestLoss}</div>
                </div>
                <div style={{ flex: 1, background: 'var(--bg-1)', borderRadius: 8, padding: 12, textAlign: 'center' }}>
                  <div style={{ fontSize: 10, color: 'var(--text-2)', marginBottom: 4 }}>Current Streak</div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: stats.curStreak > 0 ? GREEN : RED }}>
                    {stats.curStreak > 0 ? `+${stats.curStreak}` : stats.curStreak}
                  </div>
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-0)', display: 'flex', alignItems: 'center', gap: 5 }}><IconTrendingDown size={13} />Drawdown Chart</span>
            <Tooltip text="The equity curve (green) shows cumulative P&L. The red shading shows drawdown — how far you've fallen from peak equity. Deep drawdowns are psychologically difficult. Aim to keep max drawdown under 10-20% of account." position="right" />
          </div>
          <DrawdownChart trades={trades} />
        </Card>
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-0)', display: 'flex', alignItems: 'center', gap: 5 }}><IconChart size={13} />Win/Loss Distribution</span>
            <Tooltip text="A histogram showing the distribution of your trade outcomes. Ideal: most wins cluster on the right (big wins), most losses cluster near zero (small losses). This is 'letting winners run, cutting losers short'." position="right" />
          </div>
          <svg viewBox={`0 0 500 100`} style={{ width: '100%', maxHeight: 120 }}>
            {histogram.map((h, i) => {
              const x = i * (500 / histogram.length) + 4
              const bw = (500 / histogram.length) - 8
              const barH = (h.value / maxHist) * 80
              return (
                <g key={i}>
                  <rect x={x} y={100 - barH} width={bw} height={barH} fill={h.isWin ? GREEN : RED} opacity={0.8} rx={2} />
                  <text x={x + bw / 2} y={98} textAnchor="middle" fill="var(--text-2)" fontSize={7}>{h.label}</text>
                </g>
              )
            })}
          </svg>
        </Card>
      </div>

      {/* Auto-populated Trade Expectancy */}
      <JournalExpectancy trades={trades} />

      {/* By Playbook breakdown */}
      <PlaybookBreakdown trades={trades} />

      {/* Pattern Detection */}
      {trades.length >= 5 && <PatternDetection trades={trades} />}
    </div>
  )
}

// ─── Playbook Breakdown ────────────────────────────────────────────────────────

function PlaybookBreakdown({ trades }: { trades: Trade[] }) {
  const data = useMemo(() => {
    const tagged = trades.filter(t => t.playbookId)
    if (tagged.length === 0) return null

    const pbs = loadPlaybooks()
    const map: Record<string, { pb: Playbook; trades: Trade[] }> = {}
    tagged.forEach(t => {
      if (!t.playbookId) return
      if (!map[t.playbookId]) {
        const pb = pbs.find(p => p.id === t.playbookId)
        if (!pb) return
        map[t.playbookId] = { pb, trades: [] }
      }
      map[t.playbookId].trades.push(t)
    })

    return Object.values(map).map(({ pb, trades: ts }) => {
      const wins = ts.filter(t => t.pnl > 0)
      const winRate = wins.length / ts.length
      const totalPnl = ts.reduce((s, t) => s + t.pnl, 0)
      return {
        pb,
        count: ts.length,
        winRate,
        totalPnl,
      }
    }).sort((a, b) => b.totalPnl - a.totalPnl)
  }, [trades])

  if (!data || data.length === 0) return null

  return (
    <Card style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-0)', display: 'flex', alignItems: 'center', gap: 5 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }}>
            <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
            <rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
          </svg>Performance by Playbook
        </span>
        <Tooltip text="How each of your playbook strategies is performing. Win rate, trade count, and total P&L per strategy." position="right" />
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)' }}>
            {['Playbook', 'Category', 'Trades', 'Win Rate', 'Total P&L'].map(h => (
              <th key={h} style={{ padding: '6px 10px', textAlign: 'left', color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: 10 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map(({ pb, count, winRate, totalPnl }) => {
            const col = CATEGORY_COLORS[pb.category]
            return (
              <tr key={pb.id} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '9px 10px', fontWeight: 600, color: 'var(--text-0)' }}>{pb.name}</td>
                <td style={{ padding: '9px 10px' }}>
                  <span style={{ background: col + '22', color: col, border: `1px solid ${col}55`, borderRadius: 10, padding: '2px 8px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {CATEGORY_LABELS[pb.category]}
                  </span>
                </td>
                <td style={{ padding: '9px 10px', color: 'var(--text-2)' }}>{count}</td>
                <td style={{ padding: '9px 10px', fontFamily: 'var(--mono)', color: winRate >= 0.5 ? GREEN : RED, fontWeight: 700 }}>
                  {(winRate * 100).toFixed(0)}%
                </td>
                <td style={{ padding: '9px 10px', fontFamily: 'var(--mono)', color: totalPnl >= 0 ? GREEN : RED, fontWeight: 700 }}>
                  {totalPnl >= 0 ? '+$' : '-$'}{Math.abs(totalPnl).toFixed(2)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </Card>
  )
}

// ─── Pattern Detection ────────────────────────────────────────────────────────

function PatternDetection({ trades }: { trades: Trade[] }) {
  const patterns = useMemo(() => {
    const findings: { text: string; type: 'positive' | 'negative' | 'neutral'; detail?: string }[] = []
    if (trades.length < 5) return findings

    // Day of week analysis
    const dowMap: Record<number, { wins: number; total: number; pnl: number }> = {}
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    trades.forEach(t => {
      const dow = new Date(t.date + 'T12:00:00').getDay()
      if (!dowMap[dow]) dowMap[dow] = { wins: 0, total: 0, pnl: 0 }
      dowMap[dow].total++
      dowMap[dow].pnl += t.pnl
      if (t.pnl > 0) dowMap[dow].wins++
    })
    const dowEntries = Object.entries(dowMap).filter(([, d]) => d.total >= 3).map(([d, v]) => ({ day: days[parseInt(d)], wr: v.wins / v.total, pnl: v.pnl, count: v.total }))
    const worstDay = dowEntries.sort((a, b) => a.wr - b.wr)[0]
    const bestDay = [...dowEntries].sort((a, b) => b.wr - a.wr)[0]
    if (worstDay && worstDay.wr < 0.35) findings.push({ text: `You lose ${((1 - worstDay.wr) * 100).toFixed(0)}% on ${worstDay.day}s`, type: 'negative', detail: `Consider trading fewer contracts or skipping ${worstDay.day}s entirely.` })
    if (bestDay && bestDay.wr > 0.65) findings.push({ text: `${bestDay.day} is your best day — ${(bestDay.wr * 100).toFixed(0)}% win rate`, type: 'positive' })

    // Asset class analysis
    const assetMap: Record<string, { wins: number; total: number }> = {}
    trades.forEach(t => {
      if (!assetMap[t.assetClass]) assetMap[t.assetClass] = { wins: 0, total: 0 }
      assetMap[t.assetClass].total++
      if (t.pnl > 0) assetMap[t.assetClass].wins++
    })
    Object.entries(assetMap).filter(([, d]) => d.total >= 3).forEach(([ac, d]) => {
      const wr = d.wins / d.total
      if (wr > 0.60) findings.push({ text: `Win rate on ${ac}: ${(wr * 100).toFixed(0)}%`, type: 'positive' })
      if (wr < 0.35) findings.push({ text: `Struggling with ${ac} — only ${(wr * 100).toFixed(0)}% win rate`, type: 'negative', detail: `Consider pausing ${ac} trades to review your edge.` })
    })

    // Time of day analysis
    const hourMap: Record<number, { wins: number; total: number; pnl: number }> = {}
    trades.forEach(t => {
      if (!t.time) return
      const h = parseInt(t.time.slice(0, 2))
      if (isNaN(h)) return
      if (!hourMap[h]) hourMap[h] = { wins: 0, total: 0, pnl: 0 }
      hourMap[h].total++
      hourMap[h].pnl += t.pnl
      if (t.pnl > 0) hourMap[h].wins++
    })
    const hourEntries = Object.entries(hourMap).filter(([, d]) => d.total >= 3)
    const bestHour = hourEntries.sort((a, b) => b[1].pnl / b[1].total - a[1].pnl / a[1].total)[0]
    const worstHour = hourEntries.sort((a, b) => a[1].pnl / a[1].total - b[1].pnl / b[1].total)[0]
    if (bestHour) findings.push({ text: `Most profitable hour: ${bestHour[0]}:00`, type: 'positive' })
    if (worstHour && worstHour[1].pnl < 0) findings.push({ text: `Losing money consistently at ${worstHour[0]}:00`, type: 'negative', detail: `Avoid trading at ${worstHour[0]}:00 — consistent losses in this hour.` })

    // Emotional tag analysis
    const emotionMap: Record<string, { wins: number; total: number }> = {}
    trades.forEach(t => {
      if (!t.emotionTag) return
      if (!emotionMap[t.emotionTag]) emotionMap[t.emotionTag] = { wins: 0, total: 0 }
      emotionMap[t.emotionTag].total++
      if (t.pnl > 0) emotionMap[t.emotionTag].wins++
    })
    Object.entries(emotionMap).filter(([, d]) => d.total >= 3).forEach(([tag, d]) => {
      const wr = d.wins / d.total
      if (wr > 0.65) findings.push({ text: `When ${tag}: ${(wr * 100).toFixed(0)}% win rate`, type: 'positive', detail: `${tag} trades are your most profitable. This mental state works.` })
      if (wr < 0.35) findings.push({ text: `When ${tag}: you lose ${((1 - wr) * 100).toFixed(0)}% of the time`, type: 'negative', detail: `${tag} is costing you money. When you feel this way, step away.` })
    })

    // Hold time analysis
    const shortTrades = trades.filter(t => t.holdMinutes > 0 && t.holdMinutes <= 60)
    const medTrades = trades.filter(t => t.holdMinutes > 60 && t.holdMinutes <= 1440)
    const longTrades = trades.filter(t => t.holdMinutes > 1440)
    const wr = (arr: Trade[]) => arr.length ? arr.filter(t => t.pnl > 0).length / arr.length : -1
    if (shortTrades.length >= 3 && medTrades.length >= 3) {
      const swr = wr(shortTrades); const mwr = wr(medTrades)
      if (swr > mwr + 0.15) findings.push({ text: `Best holding period: under 1 hour (${(swr * 100).toFixed(0)}% win rate)`, type: 'positive' })
      else if (mwr > swr + 0.15) findings.push({ text: `Best holding period: 1–24 hours (${(mwr * 100).toFixed(0)}% win rate)`, type: 'positive' })
    }

    // Size analysis: are bigger positions losing money?
    const sorted = [...trades].filter(t => t.positionSize > 0).sort((a, b) => a.positionSize - b.positionSize)
    if (sorted.length >= 6) {
      const half = Math.floor(sorted.length / 2)
      const smallWR = wr(sorted.slice(0, half))
      const bigWR = wr(sorted.slice(half))
      if (smallWR > bigWR + 0.15) findings.push({ text: `Smaller positions win more (${(smallWR * 100).toFixed(0)}% vs ${(bigWR * 100).toFixed(0)}%)`, type: 'negative', detail: 'You may be oversizing your largest positions. Stick to consistent sizing.' })
    }

    if (findings.length === 0) findings.push({ text: 'Keep logging trades — patterns will emerge after 20+ trades', type: 'neutral' })
    return findings
  }, [trades])

  if (trades.length < 5) return null

  // Card-based day-of-week and asset class win rates
  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const dowMap: Record<number, { w: number; total: number }> = {}
  trades.forEach(t => {
    const d = new Date(t.date + 'T12:00:00').getDay()
    if (!dowMap[d]) dowMap[d] = { w: 0, total: 0 }
    dowMap[d].total++
    if (t.pnl > 0) dowMap[d].w++
  })
  const dowCards = Object.entries(dowMap).filter(([, d]) => d.total >= 3).map(([d, v]) => ({
    label: DAYS[parseInt(d)], pct: Math.round(v.w / v.total * 100), n: v.total
  })).sort((a, b) => a.label.localeCompare(b.label))

  const acMap: Record<string, { w: number; total: number }> = {}
  trades.forEach(t => {
    if (!acMap[t.assetClass]) acMap[t.assetClass] = { w: 0, total: 0 }
    acMap[t.assetClass].total++
    if (t.pnl > 0) acMap[t.assetClass].w++
  })
  const acCards = Object.entries(acMap).filter(([, d]) => d.total >= 3).map(([ac, v]) => ({
    label: ac, pct: Math.round(v.w / v.total * 100), n: v.total
  }))

  const winRateColor = (pct: number) => pct > 55 ? 'var(--green)' : pct < 45 ? 'var(--red)' : 'var(--text-2)'
  const cardSx: React.CSSProperties = { padding: '8px 12px', borderRadius: 8, background: 'var(--bg-3)', border: '1px solid var(--border)', minWidth: 70, textAlign: 'center' }

  return (
    <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 'var(--card-radius)', padding: 20, marginTop: 20 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-0)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
        <IconBrain size={14} />Pattern Detection
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 14 }}>Auto-detected from {trades.length} trades</div>

      {trades.length < 10 ? (
        <div style={{ fontSize: 12, color: 'var(--text-3)', padding: '12px 0' }}>Not enough data — log at least 10 trades to see patterns.</div>
      ) : (
        <>
          {/* Day-of-week win rates */}
          {dowCards.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-2)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Win Rate by Day</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {dowCards.map(c => (
                  <div key={c.label} style={cardSx}>
                    <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 2 }}>{c.label}</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: winRateColor(c.pct) }}>{c.pct}%</div>
                    <div style={{ fontSize: 10, color: 'var(--text-3)' }}>{c.n} trades</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Asset class win rates */}
          {acCards.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-2)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Win Rate by Asset Class</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {acCards.map(c => (
                  <div key={c.label} style={cardSx}>
                    <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 2 }}>{c.label}</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: winRateColor(c.pct) }}>{c.pct}%</div>
                    <div style={{ fontSize: 10, color: 'var(--text-3)' }}>{c.n} trades</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Narrative insights */}
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-2)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Insights</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {patterns.map((p, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, padding: '8px 12px', borderRadius: 8, background: p.type === 'positive' ? 'rgba(34,197,94,0.1)' : p.type === 'negative' ? 'rgba(239,68,68,0.1)' : 'var(--bg-3)', border: `1px solid ${p.type === 'positive' ? 'rgba(34,197,94,0.3)' : p.type === 'negative' ? 'rgba(239,68,68,0.3)' : 'var(--border)'}` }}>
                <span style={{ color: p.type === 'positive' ? 'var(--green)' : p.type === 'negative' ? 'var(--red)' : 'var(--text-3)', flexShrink: 0, marginTop: 1 }}>
                  {p.type === 'positive' ? <IconCheck size={13} /> : p.type === 'negative' ? <IconAlert size={13} /> : <IconInfo size={13} />}
                </span>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-0)' }}>{p.text}</div>
                  {p.detail && <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>{p.detail}</div>}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ─── Tab 5: Notebook ──────────────────────────────────────────────────────────

function RichTextEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const ref = useRef<HTMLTextAreaElement>(null)

  const insertMarkdown = (prefix: string, suffix = '') => {
    const el = ref.current
    if (!el) return
    const start = el.selectionStart, end = el.selectionEnd
    const selected = value.slice(start, end)
    const newVal = value.slice(0, start) + prefix + selected + suffix + value.slice(end)
    onChange(newVal)
    setTimeout(() => {
      el.selectionStart = start + prefix.length
      el.selectionEnd = start + prefix.length + selected.length
      el.focus()
    }, 0)
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
        {[
          { label: 'B', action: () => insertMarkdown('**', '**'), title: 'Bold' },
          { label: 'I', action: () => insertMarkdown('*', '*'), title: 'Italic' },
          { label: '•', action: () => insertMarkdown('\n- '), title: 'Bullet list' },
          { label: '1.', action: () => insertMarkdown('\n1. '), title: 'Numbered list' },
          { label: '#', action: () => insertMarkdown('\n## '), title: 'Heading' },
          { label: '---', action: () => insertMarkdown('\n---\n'), title: 'Divider' },
        ].map(btn => (
          <button
            key={btn.label}
            onClick={btn.action}
            title={btn.title}
            style={{
              background: 'var(--bg-1)', border: '1px solid var(--border)',
              borderRadius: 4, padding: '4px 10px', color: 'var(--text-0)',
              cursor: 'pointer', fontSize: 12, fontWeight: btn.label === 'B' ? 700 : 400,
              fontStyle: btn.label === 'I' ? 'italic' : 'normal',
            }}
          >
            {btn.label}
          </button>
        ))}
      </div>
      <textarea
        ref={ref}
        value={value}
        onChange={e => onChange(e.target.value)}
        rows={16}
        style={{ ...inputSx, resize: 'vertical', fontFamily: 'var(--mono)', fontSize: 12, lineHeight: 1.7 }}
        placeholder="Start writing... Use the toolbar above for formatting."
      />
    </div>
  )
}

function TabNotebook({ notes, setNotes }: { notes: Note[]; setNotes: (n: Note[]) => void }) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [showTemplates, setShowTemplates] = useState(false)

  const today = new Date().toISOString().slice(0, 10)

  const selectNote = (note: Note) => {
    setSelectedId(note.id)
    setTitle(note.title)
    setContent(note.content)
    setEditing(false)
  }

  const newNote = (templateKey?: keyof typeof NOTE_TEMPLATES) => {
    const content = templateKey
      ? NOTE_TEMPLATES[templateKey].replace('{{date}}', today).replace('{{name}}', 'My Strategy')
      : ''
    const note: Note = {
      id: uid(),
      title: templateKey || 'Untitled Note',
      content,
      template: templateKey || 'blank',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    const updated = [note, ...notes]
    setNotes(updated)
    saveNotes(updated)
    selectNote(note)
    setEditing(true)
    setShowTemplates(false)
  }

  const saveNote = () => {
    if (!selectedId) return
    const updated = notes.map(n => n.id === selectedId
      ? { ...n, title, content, updatedAt: new Date().toISOString() }
      : n
    )
    setNotes(updated)
    saveNotes(updated)
    setEditing(false)
  }

  const deleteNote = (id: string) => {
    if (!confirm('Delete this note?')) return
    const updated = notes.filter(n => n.id !== id)
    setNotes(updated)
    saveNotes(updated)
    if (selectedId === id) { setSelectedId(null); setTitle(''); setContent('') }
  }

  const selected = notes.find(n => n.id === selectedId)

  return (
    <div>
      <SectionHeader
        title="Notebook"
        sub="Your trading plan workspace. Use templates to build trading plans, strategy playbooks, and weekly recaps."
      />

      <div className="journal-notebook-grid">
        {/* Sidebar */}
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <button
              onClick={() => setShowTemplates(t => !t)}
              style={{ flex: 1, background: 'var(--accent)', border: 'none', borderRadius: 'var(--btn-radius)', padding: '8px 12px', color: '#0a0a0c', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
            >
              + New Note
            </button>
          </div>

          {showTemplates && (
            <Card style={{ marginBottom: 12, padding: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-2)', marginBottom: 8, textTransform: 'uppercase' }}>Templates</div>
              {(Object.keys(NOTE_TEMPLATES) as Array<keyof typeof NOTE_TEMPLATES>).map(key => (
                <button
                  key={key}
                  onClick={() => newNote(key)}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    background: 'var(--bg-1)', border: '1px solid var(--border)',
                    borderRadius: 6, padding: '8px 10px', color: 'var(--text-0)',
                    fontSize: 12, cursor: 'pointer', marginBottom: 6,
                  }}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    {key === 'Daily Trading Plan' && <IconCalendar size={12} />}
                    {key === 'Weekly Recap' && <IconChart size={12} />}
                    {key === 'Strategy Playbook' && <IconClipboard size={12} />}
                    {key}
                  </span>
                </button>
              ))}
              <button
                onClick={() => newNote()}
                style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  background: 'var(--bg-1)', border: '1px solid var(--border)',
                  borderRadius: 6, padding: '8px 10px', color: 'var(--text-2)',
                  fontSize: 12, cursor: 'pointer',
                }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><IconPencil size={12} />Blank Note</span>
              </button>
            </Card>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {notes.length === 0 && (
              <div style={{ fontSize: 12, color: 'var(--text-2)', textAlign: 'center', padding: 20 }}>
                No notes yet. Click "+ New Note" to start.
              </div>
            )}
            {notes.map(note => (
              <div
                key={note.id}
                onClick={() => selectNote(note)}
                style={{
                  background: selectedId === note.id ? 'rgba(99,102,241,0.15)' : 'var(--bg-2)',
                  border: `1px solid ${selectedId === note.id ? BLUE + '66' : 'var(--border)'}`,
                  borderRadius: 8, padding: '10px 12px', cursor: 'pointer',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                }}
              >
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-0)', marginBottom: 2 }}>{note.title}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-2)' }}>{note.updatedAt.slice(0, 10)}</div>
                </div>
                <button
                  onClick={e => { e.stopPropagation(); deleteNote(note.id) }}
                  style={{ background: 'none', border: 'none', color: 'var(--text-2)', cursor: 'pointer', fontSize: 12, padding: 2 }}
                >✕</button>
              </div>
            ))}
          </div>
        </div>

        {/* Editor */}
        <div>
          {!selectedId ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-2)' }}>
              <div className="tv-card-icon" style={{ width: 48, height: 48, fontSize: 22, margin: '0 auto 12px' }}><IconNotebook size={22} /></div>
              <div>Select a note or create a new one</div>
            </div>
          ) : (
            <Card>
              {editing ? (
                <>
                  <input
                    type="text"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    style={{ ...inputSx, fontSize: 18, fontWeight: 700, marginBottom: 12, fontFamily: 'inherit' }}
                    placeholder="Note title..."
                  />
                  <RichTextEditor value={content} onChange={setContent} />
                  <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                    <button onClick={saveNote} style={{ background: GREEN, border: 'none', borderRadius: 8, padding: '8px 20px', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                      ✓ Save
                    </button>
                    <button onClick={() => { setEditing(false); if (selected) { setTitle(selected.title); setContent(selected.content) } }}
                      style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 20px', color: 'var(--text-0)', fontSize: 13, cursor: 'pointer' }}>
                      Cancel
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--text-0)' }}>{selected?.title}</h2>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => setEditing(true)} style={{ background: BLUE, border: 'none', borderRadius: 8, padding: '6px 16px', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                        ✎ Edit
                      </button>
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 16 }}>
                    Last updated: {selected?.updatedAt.slice(0, 16).replace('T', ' ')}
                  </div>
                  <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: 13, lineHeight: 1.8, color: 'var(--text-1)', margin: 0 }}>
                    {selected?.content || <span style={{ color: 'var(--text-2)', fontStyle: 'italic' }}>Empty note. Click Edit to start writing.</span>}
                  </pre>
                </>
              )}
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Tab 6: Reports ───────────────────────────────────────────────────────────

function TabReports({ trades }: { trades: Trade[] }) {
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30)
    return d.toISOString().slice(0, 10)
  })
  const [toDate, setToDate] = useState(new Date().toISOString().slice(0, 10))

  const filtered = useMemo(() =>
    trades.filter(t => t.date >= fromDate && t.date <= toDate),
    [trades, fromDate, toDate]
  )

  const stats = useMemo(() => computeStats(filtered), [filtered])

  const topWins = useMemo(() => [...filtered].sort((a, b) => b.pnl - a.pnl).slice(0, 5), [filtered])
  const topLosses = useMemo(() => [...filtered].sort((a, b) => a.pnl - b.pnl).slice(0, 5), [filtered])

  const setupRanking = useMemo(() => {
    const map: Record<string, { pnl: number; count: number; wins: number }> = {}
    filtered.forEach(t => {
      const key = t.setupTag || 'Untagged'
      if (!map[key]) map[key] = { pnl: 0, count: 0, wins: 0 }
      map[key].pnl += t.pnl
      map[key].count++
      if (t.pnl > 0) map[key].wins++
    })
    return Object.entries(map).sort((a, b) => b[1].pnl - a[1].pnl)
  }, [filtered])

  const mistakeFreq = useMemo(() => {
    const map: Record<string, number> = {}
    filtered.forEach(t => {
      if (t.mistakeTag && t.mistakeTag !== 'None') {
        map[t.mistakeTag] = (map[t.mistakeTag] || 0) + 1
      }
    })
    return Object.entries(map).sort((a, b) => b[1] - a[1])
  }, [filtered])

  const exportCSV = () => {
    const headers = ['Date', 'Time', 'Symbol', 'Asset', 'Direction', 'Entry', 'Exit', 'Size', 'PnL', 'RMultiple', 'PctGL', 'Setup', 'Mistake', 'Rating', 'Notes']
    const rows = filtered.map(t => [
      t.date, t.time, t.symbol, t.assetClass, t.direction,
      t.entryPrice, t.exitPrice, t.positionSize, t.pnl, t.rMultiple,
      t.pctGainLoss, t.setupTag, t.mistakeTag, t.rating,
      `"${(t.notes || '').replace(/"/g, '""')}"`
    ])
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `journal-${fromDate}-${toDate}.csv`; a.click()
  }

  return (
    <div>
      <SectionHeader
        title="Reports"
        sub="Analyze your performance over any time period. Export data to CSV for deeper analysis."
      />

      {/* Date range */}
      <Card style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <FieldLabel label="From Date" tooltip="Start of the report period." />
            <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} style={{ ...inputSx, width: 160 }} />
          </div>
          <div>
            <FieldLabel label="To Date" tooltip="End of the report period." />
            <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} style={{ ...inputSx, width: 160 }} />
          </div>
          {[
            { label: '7D', days: 7 }, { label: '30D', days: 30 },
            { label: '90D', days: 90 }, { label: 'YTD', days: -1 },
          ].map(p => (
            <button
              key={p.label}
              onClick={() => {
                const to = new Date()
                const from = new Date()
                if (p.days === -1) from.setMonth(0, 1)
                else from.setDate(from.getDate() - p.days)
                setFromDate(from.toISOString().slice(0, 10))
                setToDate(to.toISOString().slice(0, 10))
              }}
              style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 14px', color: 'var(--text-0)', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
            >
              {p.label}
            </button>
          ))}
          <button onClick={exportCSV} style={{ background: GREEN, border: 'none', borderRadius: 8, padding: '8px 16px', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', marginLeft: 'auto' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><IconDownload size={13} />Export CSV</span>
          </button>
        </div>
      </Card>

      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-2)' }}>
          No trades in this date range.
        </div>
      ) : (
        <>
          {/* Summary KPIs */}
          {stats && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12, marginBottom: 20 }}>
              <KpiCard icon={<IconChart size={15} />} label="Trades" value={String(stats.totalTrades)} tooltip="Total trades in period." />
              <KpiCard icon={<IconTarget size={15} />} label="Win Rate" value={`${stats.winRate.toFixed(1)}%`} color={stats.winRate >= 50 ? GREEN : RED} tooltip="Win rate for this period." />
              <KpiCard icon={<IconDollar size={15} />} label="Net P&L" value={fmtDollar(stats.totalPnl)} color={stats.totalPnl >= 0 ? GREEN : RED} tooltip="Net profit/loss for the period." />
              <KpiCard icon={<IconZap size={15} />} label="Profit Factor" value={stats.profitFactor === Infinity ? '∞' : fmt2(stats.profitFactor)} color={stats.profitFactor >= 1 ? GREEN : RED} tooltip="Gross profits ÷ gross losses." />
              <KpiCard icon={<IconHash size={15} />} label="Avg R" value={fmtR(stats.avgR)} color={stats.avgR >= 0 ? GREEN : RED} tooltip="Average R-Multiple for the period." />
              <KpiCard icon={<IconCalculator size={15} />} label="Expectancy" value={fmtDollar(stats.expectancy)} color={stats.expectancy >= 0 ? GREEN : RED} tooltip="Average $ per trade." />
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            {/* Top 5 wins */}
            <Card>
              <div style={{ fontSize: 13, fontWeight: 700, color: GREEN, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 5 }}><IconTrophy size={13} />Top 5 Best Trades</div>
              {topWins.map((t, i) => (
                <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                  <div>
                    <span style={{ color: 'var(--text-2)', fontSize: 11, marginRight: 6 }}>#{i + 1}</span>
                    <span style={{ fontWeight: 700, color: BLUE }}>{t.symbol}</span>
                    <span style={{ color: 'var(--text-2)', fontSize: 11, marginLeft: 6 }}>{t.date}</span>
                    {t.setupTag && <span style={{ color: 'var(--text-2)', fontSize: 10, marginLeft: 6 }}>({t.setupTag})</span>}
                  </div>
                  <span style={{ fontFamily: 'var(--mono)', fontWeight: 700, color: GREEN }}>{fmtDollar(t.pnl)}</span>
                </div>
              ))}
            </Card>

            {/* Top 5 losses */}
            <Card>
              <div style={{ fontSize: 13, fontWeight: 700, color: RED, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 5 }}><IconSkull size={13} />Top 5 Worst Trades</div>
              {topLosses.map((t, i) => (
                <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                  <div>
                    <span style={{ color: 'var(--text-2)', fontSize: 11, marginRight: 6 }}>#{i + 1}</span>
                    <span style={{ fontWeight: 700, color: BLUE }}>{t.symbol}</span>
                    <span style={{ color: 'var(--text-2)', fontSize: 11, marginLeft: 6 }}>{t.date}</span>
                    {t.setupTag && <span style={{ color: 'var(--text-2)', fontSize: 10, marginLeft: 6 }}>({t.setupTag})</span>}
                  </div>
                  <span style={{ fontFamily: 'var(--mono)', fontWeight: 700, color: RED }}>{fmtDollar(t.pnl)}</span>
                </div>
              ))}
            </Card>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {/* Setup ranking */}
            <Card>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-0)', marginBottom: 12 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><IconTarget size={13} />Setup Performance Ranking</span>
                <Tooltip text="Rank your setups by total P&L. Focus your trading on the top setups and consider eliminating the worst performers." position="right" />
              </div>
              {setupRanking.length === 0 ? <div style={{ color: 'var(--text-2)', fontSize: 12 }}>No setups tagged.</div> : (
                <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      {['Setup', 'Trades', 'Win%', 'Net P&L'].map(h => (
                        <th key={h} style={{ textAlign: 'left', padding: '4px 8px', fontSize: 10, color: 'var(--text-2)', textTransform: 'uppercase', borderBottom: '1px solid var(--border)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {setupRanking.map(([setup, d]) => (
                      <tr key={setup} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '8px' }}>{setup}</td>
                        <td style={{ padding: '8px', color: 'var(--text-2)' }}>{d.count}</td>
                        <td style={{ padding: '8px', color: 'var(--text-2)' }}>{(d.wins / d.count * 100).toFixed(0)}%</td>
                        <td style={{ padding: '8px', fontFamily: 'var(--mono)', fontWeight: 700, color: d.pnl >= 0 ? GREEN : RED }}>{fmtDollar(d.pnl)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>

            {/* Mistake analysis */}
            <Card>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-0)', marginBottom: 12 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><IconAlert size={13} />Mistake Frequency Analysis</span>
                <Tooltip text="Your most common trading mistakes. The #1 mistake is what to fix first. Eliminating your top mistake often has the biggest impact on profitability." position="right" />
              </div>
              {mistakeFreq.length === 0 ? (
                <div style={{ color: GREEN, fontSize: 12, display: 'flex', alignItems: 'center', gap: 5 }}><IconCheck size={12} />No mistakes tagged — or all tagged as "None". Be honest and tag your mistakes to improve!</div>
              ) : (
                mistakeFreq.map(([mistake, count]) => (
                  <div key={mistake} style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                      <span style={{ color: 'var(--text-1)' }}>{mistake}</span>
                      <span style={{ color: YELLOW, fontFamily: 'var(--mono)' }}>{count}×</span>
                    </div>
                    <div style={{ background: 'var(--bg-1)', borderRadius: 4, height: 6, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${(count / mistakeFreq[0][1]) * 100}%`, background: YELLOW, borderRadius: 4 }} />
                    </div>
                  </div>
                ))
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const TABS: { id: string; label: string; Icon: React.FC<{ size?: number; className?: string; style?: React.CSSProperties }> }[] = [
  { id: 'dashboard', label: 'Dashboard', Icon: IconChart },
  { id: 'log',       label: 'Trade Log', Icon: IconClipboard },
  { id: 'calendar',  label: 'Calendar',  Icon: IconCalendar },
  { id: 'analytics', label: 'Analytics', Icon: IconMicroscope },
  { id: 'notebook',  label: 'Notebook',  Icon: IconNotebook },
  { id: 'reports',   label: 'Reports',   Icon: IconTrendingUp },
  { id: 'advanced',  label: 'Advanced',  Icon: IconBrain },
]


function JournalPageInner() {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [trades, setTrades] = useState<Trade[]>([])
  const [notes, setNotes] = useState<Note[]>([])
  const [showImportModal, setShowImportModal] = useState(false)
  const [showBackupImport, setShowBackupImport] = useState(false)
  const [showNTConnect, setShowNTConnect] = useState(false)
  const [customTags, setCustomTags] = useState<TagDefinition[]>([])
  // Pre-fill from URL params (from watchlist +LOG button)
  const [prefillParams, setPrefillParams] = useState<{ symbol?: string; price?: string; asset?: string } | null>(null)

  const { token, user, loading: authLoading } = useAuth()
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false)
  const [upgradeFeatureName, setUpgradeFeatureName] = useState('')
  const [upgradeFeatureDesc, setUpgradeFeatureDesc] = useState('')
  const [authModalOpenJournal, setAuthModalOpenJournal] = useState(false)
  const initialSyncDone = useRef(false)
  const initialLoadDone = useRef(false)

  const openUpgrade = (name: string, desc?: string) => {
    setUpgradeFeatureName(name)
    setUpgradeFeatureDesc(desc || '')
    setShowUpgradePrompt(true)
  }

  // Auth gating — tier check (never causes early return; isDemo propagates to write ops)
  const tier = getUserTier(user)
  // Check localStorage token directly to avoid race condition — if a token exists,
  // the user IS logged in even if useAuth() hasn't hydrated yet
  const hasStoredToken = typeof window !== 'undefined' && !!localStorage.getItem('cg_token')
  const isDemo = tier === 'demo' && !hasStoredToken && !authLoading

  // Demo trades — injected into real state when isDemo (prices verified Mar 2026)
  const DEMO_TRADES: Trade[] = [
    { id: 'd1', symbol: 'NVDA', direction: 'Long', assetClass: 'Stock', entryPrice: 183.20, exitPrice: 189.40, positionSize: 20, stopLoss: 178.00, takeProfit: 196.00, commissions: 2.00, pnl: 122.00, rMultiple: 1.19, pctGainLoss: 3.38, holdMinutes: 45, setupTag: 'Breakout', mistakeTag: 'None', rating: 5, notes: 'Clean breakout above $183 resistance on high volume.', screenshot: '', date: '2026-03-14', time: '10:15' },
    { id: 'd2', symbol: 'NQ', direction: 'Long', assetClass: 'Futures', entryPrice: 19680, exitPrice: 19755, positionSize: 1, stopLoss: 19640, takeProfit: 19810, commissions: 8.00, pnl: 1492.00, rMultiple: 1.88, pctGainLoss: 0.38, holdMinutes: 32, setupTag: 'Momentum', mistakeTag: 'None', rating: 4, notes: 'NQ momentum continuation. 75 pts × $20/pt = $1,500 gross - $8 comm = $1,492 net.', screenshot: '', date: '2026-03-14', time: '09:52' },
    { id: 'd3', symbol: 'AAPL', direction: 'Short', assetClass: 'Stock', entryPrice: 254.80, exitPrice: 250.20, positionSize: 50, stopLoss: 257.00, takeProfit: 248.00, commissions: 2.00, pnl: 228.00, rMultiple: 2.09, pctGainLoss: 1.81, holdMinutes: 78, setupTag: 'Reversal', mistakeTag: 'None', rating: 4, notes: 'AAPL rejection at VWAP.', screenshot: '', date: '2026-03-13', time: '11:30' },
    { id: 'd4', symbol: 'ES', direction: 'Short', assetClass: 'Futures', entryPrice: 6658, exitPrice: 6645, positionSize: 1, stopLoss: 6665, takeProfit: 6630, commissions: 4.00, pnl: 646.00, rMultiple: 1.86, pctGainLoss: 0.20, holdMinutes: 22, setupTag: 'Support/Resistance', mistakeTag: 'None', rating: 5, notes: 'ES rejection at key resistance. 13 pts × $50/pt = $650 gross - $4 comm = $646 net.', screenshot: '', date: '2026-03-13', time: '14:20' },
    { id: 'd5', symbol: 'TSLA', direction: 'Long', assetClass: 'Stock', entryPrice: 408.50, exitPrice: 416.80, positionSize: 10, stopLoss: 404.00, takeProfit: 422.00, commissions: 2.00, pnl: 81.00, rMultiple: 1.84, pctGainLoss: 2.03, holdMinutes: 110, setupTag: 'Pullback', mistakeTag: 'Early Exit', rating: 3, notes: 'TSLA pullback to 20 EMA. Exited early.', screenshot: '', date: '2026-03-12', time: '10:45' },
    { id: 'd6', symbol: 'META', direction: 'Long', assetClass: 'Stock', entryPrice: 615.20, exitPrice: 628.40, positionSize: 5, stopLoss: 608.00, takeProfit: 638.00, commissions: 2.00, pnl: 64.00, rMultiple: 1.83, pctGainLoss: 2.15, holdMinutes: 95, setupTag: 'Breakout', mistakeTag: 'None', rating: 4, notes: 'META gap-up continuation.', screenshot: '', date: '2026-03-12', time: '09:42' },
    { id: 'd7', symbol: 'CL', direction: 'Long', assetClass: 'Futures', entryPrice: 67.15, exitPrice: 68.05, positionSize: 1, stopLoss: 66.60, takeProfit: 69.00, commissions: 4.00, pnl: 896.00, rMultiple: 1.64, pctGainLoss: 1.34, holdMinutes: 55, setupTag: 'Trend Follow', mistakeTag: 'None', rating: 4, notes: 'WTI crude trend follow. (68.05-67.15)×1,000 bbl - $4 = $896.', screenshot: '', date: '2026-03-11', time: '10:05' },
    { id: 'd8', symbol: 'SPY', direction: 'Short', assetClass: 'Stock', entryPrice: 665.80, exitPrice: 661.50, positionSize: 30, stopLoss: 668.00, takeProfit: 660.00, commissions: 2.00, pnl: 127.00, rMultiple: 1.95, pctGainLoss: 0.65, holdMinutes: 38, setupTag: 'Reversal', mistakeTag: 'None', rating: 4, notes: 'SPY bearish divergence fade.', screenshot: '', date: '2026-03-11', time: '11:22' },
    { id: 'd9', symbol: 'MSFT', direction: 'Long', assetClass: 'Stock', entryPrice: 399.20, exitPrice: 394.80, positionSize: 10, stopLoss: 395.00, takeProfit: 410.00, commissions: 2.00, pnl: -46.00, rMultiple: -1.05, pctGainLoss: -1.10, holdMinutes: 60, setupTag: 'Pullback', mistakeTag: 'Early Exit', rating: 2, notes: 'MSFT pullback buy stopped out.', screenshot: '', date: '2026-03-10', time: '13:15' },
  ]

  useEffect(() => {
    // Wait for auth to finish loading before deciding demo vs real
    if (authLoading) return

    if (isDemo) {
      setTrades(DEMO_TRADES)
      initialLoadDone.current = true
      return
    }
    setTrades(loadTrades())
    setNotes(loadNotes())
    setCustomTags(loadCustomTags())
    initialLoadDone.current = true
    // Check URL params for pre-fill
    try {
      const params = new URLSearchParams(window.location.search)
      const sym = params.get('symbol')
      const price = params.get('price')
      const asset = params.get('asset')
      if (sym) {
        setPrefillParams({ symbol: sym, price: price || undefined, asset: asset || undefined })
        setActiveTab('log')
        // Clean the URL
        window.history.replaceState({}, '', '/journal')
      }
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user])

  // Initial cloud sync when token becomes available (or on first load if already logged in)
  useEffect(() => {
    if (!token || initialSyncDone.current) return
    initialSyncDone.current = true
    initJournalSync(token).then(() => {
      // Re-load from localStorage after sync (cloud may have updated local data)
      setTrades(loadTrades())
      setNotes(loadNotes())
    })
  }, [token])

  // Debounced cloud sync on every trades/notes change (skip initial empty load)
  const prevTradesRef = useRef<unknown[]>([])
  const prevNotesRef  = useRef<unknown[]>([])
  useEffect(() => {
    if (!initialLoadDone.current) return
    if (!token) return
    const same =
      prevTradesRef.current === trades &&
      prevNotesRef.current  === notes
    if (same) return
    prevTradesRef.current = trades
    prevNotesRef.current  = notes
    debouncedSyncJournal(trades, notes)
  }, [trades, notes, token])

  // Webhook trades polling — fetch trades auto-journaled via TradingView webhooks
  const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://tradvue-api.onrender.com'
  useEffect(() => {
    if (!token || isDemo) return

    async function fetchWebhookTrades() {
      try {
        const res = await fetch(`${API_BASE}/api/webhook-trades`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        if (!res.ok) return
        const data = await res.json()

        if (data.trades?.length > 0) {
          setTrades(prev => {
            const existingWebhookIds = new Set(prev.filter(t => t.source === 'webhook').map(t => t.id))
            const dismissedIds = getDismissedWebhookIds()
            const newWebhookTrades: Trade[] = data.trades
              .filter((t: Record<string, unknown>) => !existingWebhookIds.has(`wh_${t.id}`) && !dismissedIds.has(`wh_${t.id}`))
              .map((t: Record<string, unknown>) => ({
                id: `wh_${t.id}`,
                date: (t.traded_at as string)?.split('T')[0] || new Date().toISOString().split('T')[0],
                time: (t.traded_at as string)?.split('T')[1]?.slice(0, 8) || '',
                symbol: t.symbol as string,
                assetClass: (t.asset_class as AssetClass) || 'Stock',
                direction: t.direction as Direction,
                entryPrice: parseFloat(t.entry_price as string) || 0,
                exitPrice: t.exit_price ? parseFloat(t.exit_price as string) : 0,
                positionSize: parseFloat(t.quantity as string) || 1,
                stopLoss: 0,
                takeProfit: 0,
                commissions: 0,
                pnl: t.exit_price && t.entry_price
                  ? Math.round(
                      (parseFloat(t.exit_price as string) - parseFloat(t.entry_price as string)) *
                      (parseFloat(t.quantity as string) || 1) *
                      (t.direction === 'Short' ? -1 : 1) * 100
                    ) / 100
                  : 0,
                rMultiple: 0,
                pctGainLoss: 0,
                holdMinutes: 0,
                setupTag: (t.strategy as string) || '',
                mistakeTag: 'None',
                rating: 3,
                notes: (t.notes as string) || 'Auto-journaled via NinjaTrader',
                screenshot: '',
                source: 'webhook',
              } as Trade))

            if (newWebhookTrades.length === 0) return prev
            const merged = [...newWebhookTrades, ...prev]
            saveTrades(merged)
            return merged
          })
        }
      } catch {
        // Silent fail — webhook trades are best-effort
      }
    }

    fetchWebhookTrades()
    const interval = setInterval(fetchWebhookTrades, 30000)
    return () => clearInterval(interval)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, isDemo])

  const handleImportTrades = async (importedTrades: Record<string, unknown>[]) => {
    // Apply date filter for free-tier post-trial users
    const dateLimit = getCsvDateLimit(user)
    const filteredImports = dateLimit
      ? importedTrades.filter(t => {
          const d = String(t.date || '')
          if (!d) return true
          return new Date(d + 'T12:00:00') >= dateLimit
        })
      : importedTrades

    if (dateLimit && filteredImports.length < importedTrades.length) {
      const skipped = importedTrades.length - filteredImports.length
      console.info(`[TierAccess] Free tier: filtered ${skipped} trade(s) older than 30 days from CSV import.`)
    }

    // ── Deduplication: build fingerprint set from existing journal trades ──
    // We compare on date+symbol+side+qty+price so the same trade can't be imported twice.
    const existingFingerprints = new Set<string>(
      trades.map(t => tradeFingerprint({
        date: t.date,
        symbol: t.symbol,
        side: (t.direction === 'Long' ? 'buy' : 'sell') as 'buy' | 'sell',
        quantity: t.positionSize,
        price: t.entryPrice,
        total: t.entryPrice * t.positionSize,
        fees: t.commissions,
        broker: '',
        type: t.assetClass === 'Option' ? 'option' : t.assetClass === 'Crypto' ? 'crypto' : 'stock',
      } as ParsedTrade))
    )

    const seen = new Set<string>(existingFingerprints)
    const uniqueImports: typeof filteredImports = []
    let dupCount = 0
    for (const t of filteredImports) {
      const fp = tradeFingerprint({
        date: String(t.date || ''),
        symbol: String(t.symbol || ''),
        side: (String(t.direction || 'Long') === 'Long' ? 'buy' : 'sell') as 'buy' | 'sell',
        quantity: Number(t.positionSize) || 0,
        price: Number(t.entryPrice) || 0,
        total: (Number(t.entryPrice) || 0) * (Number(t.positionSize) || 0),
        fees: Number(t.commissions) || 0,
        broker: '',
        type: 'stock',
      } as ParsedTrade)
      if (seen.has(fp)) { dupCount++; continue }
      seen.add(fp)
      uniqueImports.push(t)
    }

    if (dupCount > 0) {
      console.info(`[CSV Import] Deduplication: skipped ${dupCount} duplicate trade(s).`)
    }

    if (uniqueImports.length === 0) {
      console.info('[CSV Import] No new trades to import (all duplicates).')
      setShowImportModal(false)
      return
    }

    // ── Batch insert: build Trade objects in batches of 50 ──
    const newTrades: Trade[] = []
    await batchInsertTrades(
      uniqueImports,
      async (batch) => {
        const mapped: Trade[] = batch.map(t => ({
          date: String(t.date || ''),
          time: String(t.time || ''),
          symbol: String(t.symbol || ''),
          assetClass: (String(t.assetClass || 'Stock')) as AssetClass,
          direction: (String(t.direction || 'Long')) as Direction,
          entryPrice: Number(t.entryPrice) || 0,
          exitPrice: Number(t.exitPrice) || 0,
          positionSize: Number(t.positionSize) || 0,
          stopLoss: Number(t.stopLoss) || 0,
          takeProfit: Number(t.takeProfit) || 0,
          commissions: Number(t.commissions) || 0,
          pnl: Number(t.pnl) || 0,
          rMultiple: Number(t.rMultiple) || 0,
          pctGainLoss: Number(t.pctGainLoss) || 0,
          holdMinutes: Number(t.holdMinutes) || 0,
          setupTag: String(t.setupTag || ''),
          mistakeTag: String(t.mistakeTag || 'None'),
          rating: Number(t.rating) || 3,
          notes: String(t.notes || 'Imported from CSV'),
          screenshot: '',
          id: uid(),
          tags_setup_types: (t.tags_setup_types as string[]) || [],
          tags_mistakes: (t.tags_mistakes as string[]) || [],
          tags_strategies: (t.tags_strategies as string[]) || [],
        }))
        newTrades.push(...mapped)
      },
      50,  // batch size — no tight one-at-a-time loops
    )

    const updated = [...newTrades, ...trades]
    setTrades(updated)
    saveTrades(updated)
    setShowImportModal(false)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleBackupRestore = (data: any) => {
    if (data.trades) setTrades(data.trades as Trade[])
    if (data.notes) setNotes(data.notes as Note[])
    setCustomTags(loadCustomTags())
  }

  const handleAddCustomTag = (tag: TagDefinition) => {
    const updated = [...customTags, tag]
    setCustomTags(updated)
    saveCustomTags(updated)
  }

  const journalContent = (
    <div style={{ minHeight: '100vh', background: 'var(--bg-0)', color: 'var(--text-0)' }}>
      {/* Persistent Navigation */}
      <PersistentNav />
      {/* Header */}
      <header className="page-header">
        <Link href="/" className="back-link">
          <IconArrowLeft size={16} />
          TradVue
        </Link>
        <span style={{ color: 'var(--border)' }}>|</span>
        <div className="page-header-title">
          <span style={{ color: 'var(--accent)' }}><IconBook size={18} /></span>
          Trading Journal
        </div>
        <div className="page-header-desc">Track and analyze your trading patterns</div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{trades.length} trades</span>
          <button
            onClick={() => {
              if (getUserTier(user) === 'demo') {
                openUpgrade('CSV Import', 'Sign in free to import your trade history.')
                return
              }
              setShowImportModal(true)
            }}
            className="btn btn-secondary btn-sm"
          >
            <IconUpload size={13} /> Import CSV
          </button>
          <ExportButton trades={trades} notes={notes} variant="journal" />
          <button onClick={() => setShowBackupImport(true)} className="btn btn-secondary btn-sm">
            <IconSave size={13} /> Backup
          </button>
          {!isDemo && (
            <button
              onClick={() => setShowNTConnect(true)}
              className="btn btn-secondary btn-sm"
              style={{ color: '#a78bfa', borderColor: 'rgba(139,92,246,0.45)' }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline', verticalAlign: 'middle', marginRight: 5 }}>
                <path d="M3 3l18 18M3 21l18-18" /><rect x="2" y="2" width="20" height="20" rx="4" />
              </svg>
              Setup NinjaTrader
            </button>
          )}
          {!isDemo && token && (
            <button
              onClick={async () => {
                const ok = await forceSyncFromCloud()
                if (ok) {
                  setTrades(loadTrades())
                  setNotes(loadNotes())
                } else {
                  alert('Sync failed — no cloud data or not logged in.')
                }
              }}
              className="btn btn-secondary btn-sm"
              title="Pull your journal from the cloud (overwrites local)"
              style={{ fontSize: 11, opacity: 0.7 }}
            >
              ☁ Sync from Cloud
            </button>
          )}
        </div>
      </header>

      {/* Tab Bar */}
      <div style={{
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg-2)',
        padding: '0 24px',
        display: 'flex',
        gap: 0,
        overflowX: 'auto',
      }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              background: 'none',
              border: 'none',
              borderBottom: `2px solid ${activeTab === tab.id ? BLUE : 'transparent'}`,
              padding: '14px 20px',
              color: activeTab === tab.id ? BLUE : 'var(--text-2)',
              fontSize: 13,
              fontWeight: activeTab === tab.id ? 700 : 400,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'color 0.15s, border-color 0.15s',
            }}
          >
            <tab.Icon size={13} style={{ verticalAlign: 'middle', marginRight: 5, opacity: 0.85 }} />{tab.label}
          </button>
        ))}
      </div>

      {/* Intro banner — shown to new users with no trades */}
      {trades.length === 0 && (
        <div style={{ background: 'rgba(74,158,255,0.05)', borderBottom: '1px solid rgba(74,158,255,0.15)', padding: '16px 24px' }}>
          <div style={{ maxWidth: 900, margin: '0 auto' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-0)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
              <IconBook size={14} />Log, analyze, and improve your trades
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10, marginBottom: 14 }}>
              <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-1)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 5 }}><IconPencil size={12} />Manual Entry</div>
                <div style={{ fontSize: 11, color: 'var(--text-2)', lineHeight: 1.55 }}>
                  Click <strong style={{ color: 'var(--accent)' }}>Trade Log → + New Trade</strong>. Fill in symbol, entry/exit price, shares, and stop loss. P&L and R-Multiple calculate automatically.
                </div>
              </div>
              <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-1)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 5 }}><IconFolder size={12} />CSV Import</div>
                <div style={{ fontSize: 11, color: 'var(--text-2)', lineHeight: 1.55 }}>
                  Click <strong style={{ color: 'var(--accent)' }}>Import CSV</strong> above. Supports <strong>Robinhood</strong>, <strong>IBKR</strong>, and <strong>Generic CSV</strong> formats. Download a sample template from the import dialog.
                </div>
              </div>
              <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-1)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 5 }}><IconTag size={12} />Tags &amp; Analysis</div>
                <div style={{ fontSize: 11, color: 'var(--text-2)', lineHeight: 1.55 }}>
                  Tag each trade with a <strong>setup type</strong> (e.g. Breakout, Pullback) and <strong>mistake tag</strong> (e.g. FOMO, Oversize). Analytics will show which setups are most profitable.
                </div>
              </div>
              <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-1)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 5 }}><IconNotebook size={12} />Notebook</div>
                <div style={{ fontSize: 11, color: 'var(--text-2)', lineHeight: 1.55 }}>
                  Use the <strong>Notebook</strong> tab for daily trading plans, weekly recaps, and strategy playbooks. Templates provided — just fill in the blanks.
                </div>
              </div>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 5 }}>
              <IconSave size={11} />All data saves locally in your browser. Use <strong style={{ color: 'var(--text-2)' }}>Backup</strong> to export a JSON snapshot you can restore anytime.
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '28px 24px' }}>
        {activeTab === 'dashboard' && <TabDashboard trades={trades} />}
        {activeTab === 'log'       && <TabTradeLog  trades={trades} setTrades={setTrades} customTags={customTags} onAddCustomTag={handleAddCustomTag} prefill={prefillParams} currentUser={user} onUpgrade={openUpgrade} isDemo={isDemo} onDemoAction={() => setAuthModalOpenJournal(true)} />}
        {activeTab === 'calendar'  && <TabCalendar  trades={trades} />}
        {activeTab === 'analytics' && <TabAnalytics trades={trades} />}
        {activeTab === 'notebook'  && <TabNotebook  notes={notes}   setNotes={setNotes} />}
        {activeTab === 'reports'   && <TabReports   trades={trades} />}
        {activeTab === 'advanced'  && <AdvancedReports trades={trades} />}
      </div>

      {/* Footer note */}
      <div style={{ textAlign: 'center', padding: '20px 24px 12px', fontSize: 11, color: 'var(--text-2)', borderTop: '1px solid var(--border)' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><IconSave size={11} />Data saved locally in your browser. Export anytime — your data is yours.</span>
      </div>
      {/* Disclaimer */}
      <div style={{ textAlign: 'center', padding: '0 24px 40px', fontSize: 11, color: 'var(--text-3)' }}>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline', verticalAlign: 'middle', marginRight: 3 }}>
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>Performance analytics are based on user-entered data and may not reflect actual trading results. Past performance does not guarantee future results. This is not financial advice.
      </div>

      {/* Modals */}
      {showImportModal && (
        <ImportModal onClose={() => setShowImportModal(false)} onImport={handleImportTrades} />
      )}
      {showBackupImport && (
        <ImportBackupModal onClose={() => setShowBackupImport(false)} onRestore={handleBackupRestore} />
      )}
      <UpgradePrompt
        open={showUpgradePrompt}
        onClose={() => setShowUpgradePrompt(false)}
        featureName={upgradeFeatureName}
        featureDesc={upgradeFeatureDesc}
        lockedCount={getLockedEntryCount(user, trades.map(t => t.date))}
        variant="upgrade"
      />
      {authModalOpenJournal && <AuthModal onClose={() => setAuthModalOpenJournal(false)} />}
      {showNTConnect && <NinjaTraderConnect onClose={() => setShowNTConnect(false)} />}
    </div>
  )

  if (isDemo) {
    return (
      <AuthGate featureName="Trading Journal" featureDesc="Track every trade, analyze your patterns, and improve your consistency.">
        {journalContent}
      </AuthGate>
    )
  }
  return journalContent
}

export default function JournalPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, textAlign: 'center', color: 'var(--text-3)' }}>Loading journal…</div>}>
      <JournalPageInner />
    </Suspense>
  )
}