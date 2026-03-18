'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import { getUserTier } from '../utils/tierAccess'
import dynamic from 'next/dynamic'
const AuthModal = dynamic(() => import('../components/AuthModal'), { ssr: false })
import AuthGate from '../components/AuthGate'
import PersistentNav from '../components/PersistentNav'
import { IconTarget } from '../components/Icons'
import {
  loadPropFirmAccounts,
  addPropFirmAccount,
  updatePropFirmAccount,
  deletePropFirmAccount,
  getDrawdownUsedPct,
  getProfitPct,
  getDailyLossPct,
  getDrawdownColor,
  getPhaseLabel,
  getStatusLabel,
  getStatusColor,
  type PropFirmAccount,
  type PropFirmRules,
  type DrawdownType,
  type FirmId,
  type PhaseId,
  type AccountStatus,
} from '../utils/propFirmData'
import {
  FIRM_LIST,
  getFirmPreset,
  getPresetRules,
  formatAccountSize,
  type FirmPreset,
} from '../utils/propFirmPresets'

// ─── Journal Trade Interface (minimal, for linking) ───────────────────────────

interface JournalTrade {
  id: string
  date: string      // YYYY-MM-DD
  symbol: string
  pnl: number
  propFirmAccountId?: string
}

function loadJournalTrades(): JournalTrade[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem('cg_journal_trades')
    if (!raw) return []
    const trades = JSON.parse(raw) as JournalTrade[]
    return Array.isArray(trades) ? trades : []
  } catch {
    return []
  }
}

function saveJournalTrades(trades: JournalTrade[]): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem('cg_journal_trades', JSON.stringify(trades))
  } catch { /* ignore */ }
}

/** Compute auto-stats for a prop firm account from linked journal trades */
function computeLinkedStats(accountId: string, allTrades: JournalTrade[], accountSize: number) {
  const linked = allTrades.filter(t => t.propFirmAccountId === accountId)
  const today = new Date().toISOString().slice(0, 10)
  const todayTrades = linked.filter(t => t.date === today)
  const todayPnl = todayTrades.reduce((s, t) => s + t.pnl, 0)
  const totalPnl = linked.reduce((s, t) => s + t.pnl, 0)

  // Distinct trading days
  const uniqueDays = new Set(linked.map(t => t.date))
  const tradingDays = uniqueDays.size

  // Peak equity tracking for trailing drawdown
  let equity = accountSize
  let peak = accountSize
  let maxDrawdownUsed = 0
  // Sort by date to compute peak properly
  const sortedLinked = [...linked].sort((a, b) => a.date.localeCompare(b.date))
  for (const t of sortedLinked) {
    equity += t.pnl
    if (equity > peak) peak = equity
    const dd = peak - equity
    if (dd > maxDrawdownUsed) maxDrawdownUsed = dd
  }

  return { todayPnl, totalPnl, tradingDays, maxDrawdownUsed }
}

// ─── Drawdown Gauge (SVG semicircle) ─────────────────────────────────────────

function DrawdownGauge({ pctUsed, limit, current }: { pctUsed: number; limit: number; current: number }) {
  const clampedPct = Math.min(pctUsed, 100)
  const color = getDrawdownColor(pctUsed)
  const remaining = Math.max(limit - current, 0)

  // SVG arc params: semicircle, radius=40, stroke=8
  const r = 40
  const cx = 52
  const cy = 52
  const strokeW = 9
  // Full arc length (180° semicircle)
  const arcLen = Math.PI * r  // ≈125.66
  // Used portion of arc
  const usedArc = (clampedPct / 100) * arcLen
  const gapArc = arcLen - usedArc

  // Track arc: starts at left (180°) sweeping right (0°) — rotate the coordinate system
  // Path: from 180° to 0° (left to right)
  const startX = cx - r
  const startY = cy
  const endX   = cx + r
  const endY   = cy

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      <svg width="104" height="60" viewBox="0 0 104 60" style={{ overflow: 'visible' }}>
        {/* Track (background) */}
        <path
          d={`M ${startX} ${startY} A ${r} ${r} 0 0 1 ${endX} ${endY}`}
          fill="none"
          stroke="var(--bg-4)"
          strokeWidth={strokeW}
          strokeLinecap="round"
        />
        {/* Used portion */}
        {clampedPct > 0 && (
          <path
            d={`M ${startX} ${startY} A ${r} ${r} 0 0 1 ${endX} ${endY}`}
            fill="none"
            stroke={color}
            strokeWidth={strokeW}
            strokeLinecap="round"
            strokeDasharray={`${usedArc} ${gapArc + 999}`}
            style={{ transition: 'stroke-dasharray 0.4s ease, stroke 0.3s ease' }}
          />
        )}
        {/* Center label */}
        <text x={cx} y={cy - 4} textAnchor="middle" fontSize="13" fontWeight="600" fill={color}>
          {pctUsed.toFixed(0)}%
        </text>
        <text x={cx} y={cy + 10} textAnchor="middle" fontSize="9" fill="var(--text-2)">
          used
        </text>
      </svg>
      <div style={{ fontSize: 11, color: 'var(--text-1)', textAlign: 'center', lineHeight: 1.3 }}>
        <span style={{ color: color, fontWeight: 600 }}>${remaining.toLocaleString()}</span>
        <span style={{ color: 'var(--text-3)' }}> remaining</span>
      </div>
    </div>
  )
}

// ─── Progress Bar ─────────────────────────────────────────────────────────────

function ProgressBar({ pct, color, label, current, limit, noLimit }: {
  pct: number
  color: string
  label: string
  current: number
  limit: number
  noLimit?: boolean
}) {
  const clampedPct = Math.min(Math.max(pct, 0), 100)
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <span style={{ fontSize: 10, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
        {noLimit ? (
          <span style={{ fontSize: 10, color: 'var(--text-3)' }}>No limit</span>
        ) : (
          <span style={{ fontSize: 10, color: 'var(--text-1)' }}>
            ${Math.abs(current).toLocaleString()} / ${limit.toLocaleString()}
          </span>
        )}
      </div>
      <div style={{ height: 5, background: 'var(--bg-4)', borderRadius: 99, overflow: 'hidden' }}>
        {!noLimit && (
          <div style={{
            height: '100%',
            width: `${clampedPct}%`,
            background: color,
            borderRadius: 99,
            transition: 'width 0.3s ease',
          }} />
        )}
      </div>
    </div>
  )
}

// ─── Account Card ─────────────────────────────────────────────────────────────

function AccountCard({ account, onSelect, onDelete }: {
  account: PropFirmAccount
  onSelect: (acc: PropFirmAccount) => void
  onDelete: (id: string) => void
}) {
  const firm = getFirmPreset(account.firm)
  const drawdownPct = getDrawdownUsedPct(account.rules)
  const profitPct   = getProfitPct(account.rules)
  const dailyPct    = getDailyLossPct(account.rules)
  const statusColor = getStatusColor(account.status)
  const drawdownColor = getDrawdownColor(drawdownPct)
  const profitColor = profitPct >= 100 ? 'var(--green)' : 'var(--accent)'
  const dailyColor  = getDrawdownColor(dailyPct)
  const firmColor   = firm?.color ?? 'var(--accent)'
  const [confirmDel, setConfirmDel] = useState(false)

  const hasMinDays = !!(account.rules.minTradingDays && account.rules.minTradingDays > 0)

  return (
    <div
      style={{
        background: 'var(--card-bg)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: '20px',
        cursor: 'pointer',
        transition: 'border-color 0.15s, box-shadow 0.15s',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}
      onClick={() => onSelect(account)}
      onMouseEnter={e => {
        ;(e.currentTarget as HTMLDivElement).style.borderColor = firmColor
        ;(e.currentTarget as HTMLDivElement).style.boxShadow = `0 0 0 1px ${firmColor}22, 0 4px 20px rgba(0,0,0,0.3)`
      }}
      onMouseLeave={e => {
        ;(e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border)'
        ;(e.currentTarget as HTMLDivElement).style.boxShadow = 'none'
      }}
    >
      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
          {/* Firm color dot */}
          <div style={{
            width: 10, height: 10, borderRadius: '50%',
            background: firmColor, flexShrink: 0, marginTop: 2,
          }} />
          <div style={{ minWidth: 0 }}>
            <div style={{
              fontSize: 14, fontWeight: 600, color: 'var(--text-0)',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {account.accountName}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-2)', marginTop: 1 }}>
              {firm?.displayName ?? account.firm} · {formatAccountSize(account.accountSize)}
            </div>
          </div>
        </div>
        {/* Badges */}
        <div style={{ display: 'flex', gap: 6, flexShrink: 0, marginLeft: 8 }}>
          <span style={{
            fontSize: 10, padding: '2px 8px', borderRadius: 99,
            background: `${firmColor}22`, color: firmColor, fontWeight: 500,
          }}>
            {getPhaseLabel(account.phase)}
          </span>
          <span style={{
            fontSize: 10, padding: '2px 8px', borderRadius: 99,
            background: `${statusColor}18`, color: statusColor, fontWeight: 500,
          }}>
            {getStatusLabel(account.status)}
          </span>
        </div>
      </div>

      {/* Gauge + bars row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
        {/* Drawdown Gauge */}
        <div style={{ flexShrink: 0 }}>
          <DrawdownGauge
            pctUsed={drawdownPct}
            limit={account.rules.maxDrawdown.limit}
            current={account.rules.maxDrawdown.current}
          />
          <div style={{ fontSize: 9, color: 'var(--text-3)', textAlign: 'center', marginTop: 2 }}>
            {account.rules.maxDrawdown.type === 'trailing' ? '▼ trailing' : '▼ static'}
          </div>
        </div>

        {/* Progress bars */}
        <div style={{ flex: 1, minWidth: 0, paddingTop: 4 }}>
          {/* Profit Target */}
          <ProgressBar
            label="Profit Target"
            pct={profitPct}
            color={profitColor}
            current={account.rules.profitTarget.currentPnl}
            limit={account.rules.profitTarget.target}
            noLimit={account.rules.profitTarget.target === 0}
          />
          {/* Daily Loss */}
          <ProgressBar
            label="Daily Loss"
            pct={dailyPct}
            color={dailyColor}
            current={Math.max(-account.rules.dailyLossLimit.todayPnl, 0)}
            limit={account.rules.dailyLossLimit.limit}
            noLimit={account.rules.dailyLossLimit.limit === 0}
          />
          {/* Trading days */}
          {hasMinDays && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-2)', marginTop: 4 }}>
              <span>Trading Days</span>
              <span style={{ color: 'var(--text-0)' }}>
                {account.rules.tradingDaysCompleted ?? 0} / {account.rules.minTradingDays}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Delete button */}
      <div
        style={{ position: 'absolute', bottom: 12, right: 14 }}
        onClick={e => e.stopPropagation()}
      >
        {confirmDel ? (
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={() => onDelete(account.id)}
              style={{
                fontSize: 10, padding: '2px 8px', borderRadius: 4,
                background: 'var(--red-dim)', color: 'var(--red)',
                border: '1px solid var(--red)', cursor: 'pointer',
              }}
            >Confirm</button>
            <button
              onClick={() => setConfirmDel(false)}
              style={{
                fontSize: 10, padding: '2px 8px', borderRadius: 4,
                background: 'var(--bg-3)', color: 'var(--text-2)',
                border: '1px solid var(--border)', cursor: 'pointer',
              }}
            >Cancel</button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmDel(true)}
            style={{
              fontSize: 10, padding: '2px 8px', borderRadius: 4,
              background: 'none', color: 'var(--text-3)',
              border: '1px solid transparent', cursor: 'pointer',
            }}
            onMouseEnter={e => {
              ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--red)'
              ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--red)'
            }}
            onMouseLeave={e => {
              ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--text-3)'
              ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'transparent'
            }}
          >
            ✕
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Add Account Modal ────────────────────────────────────────────────────────

function AddAccountModal({ onClose, onAdd }: {
  onClose: () => void
  onAdd: (account: Omit<PropFirmAccount, 'id' | 'createdAt' | 'updatedAt'>) => void
}) {
  const [firmId, setFirmId]         = useState<FirmId>('topstep')
  const [accountSize, setAccountSize] = useState<number>(100000)
  const [customSize, setCustomSize]  = useState<string>('')
  const [useCustomSize, setUseCustomSize] = useState(false)
  const [phase, setPhase]           = useState<PhaseId>('phase1')
  const [accountName, setAccountName] = useState('')
  const [error, setError]           = useState<string | null>(null)

  // Custom rule overrides (for custom firm or if user wants to tweak)
  const [customRules, setCustomRules] = useState<{
    drawdownLimit: string
    drawdownType: DrawdownType
    dailyLimit: string
    profitTarget: string
    minTradingDays: string
    maxContracts: string
  }>({
    drawdownLimit: '',
    drawdownType: 'static',
    dailyLimit: '',
    profitTarget: '',
    minTradingDays: '',
    maxContracts: '',
  })

  const firm = getFirmPreset(firmId)
  const isCustomFirm = firmId === 'custom'

  // Auto-set default account size when firm changes
  useEffect(() => {
    if (firm) {
      const defaultSize = firm.accountSizes.includes(100000)
        ? 100000
        : firm.accountSizes[Math.floor(firm.accountSizes.length / 2)]
      setAccountSize(defaultSize)
      setUseCustomSize(false)
      setCustomSize('')
      setPhase(firm.phases[0])
      setAccountName(`${firm.shortName} ${formatAccountSize(defaultSize)} ${getPhaseLabel(firm.phases[0])}`)
      if (firmId === 'custom') {
        const presetRules = getPresetRules('custom', defaultSize, firm.phases[0])
        setCustomRules({
          drawdownLimit: String(presetRules.maxDrawdown.limit),
          drawdownType: presetRules.maxDrawdown.type,
          dailyLimit: String(presetRules.dailyLossLimit.limit),
          profitTarget: String(presetRules.profitTarget.target),
          minTradingDays: '',
          maxContracts: '',
        })
      }
    }
  }, [firmId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Update name when size or phase changes
  useEffect(() => {
    const knownPrefixes = FIRM_LIST.map(f => f.shortName)
    const startsWithKnown = knownPrefixes.some(p => accountName.startsWith(p))
    if (!accountName || startsWithKnown) {
      const size = useCustomSize ? (parseInt(customSize) || accountSize) : accountSize
      setAccountName(`${firm?.shortName ?? firmId} ${formatAccountSize(size)} ${getPhaseLabel(phase)}`)
    }
  }, [accountSize, phase, useCustomSize, customSize]) // eslint-disable-line react-hooks/exhaustive-deps

  // Update custom rules when size changes (for custom firm)
  useEffect(() => {
    if (isCustomFirm) {
      const size = useCustomSize ? (parseInt(customSize) || accountSize) : accountSize
      const presetRules = getPresetRules('custom', size, phase)
      setCustomRules(prev => ({
        ...prev,
        drawdownLimit: String(presetRules.maxDrawdown.limit),
        dailyLimit: String(presetRules.dailyLossLimit.limit),
        profitTarget: String(presetRules.profitTarget.target),
      }))
    }
  }, [accountSize, useCustomSize, customSize, phase]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = () => {
    setError(null)
    const finalSize = useCustomSize ? parseInt(customSize) : accountSize
    if (!finalSize || finalSize <= 0 || !isFinite(finalSize)) {
      setError('Account size must be a positive number.')
      return
    }
    if (finalSize > 10_000_000) {
      setError('Account size seems too large. Max is $10,000,000.')
      return
    }
    const trimmedName = accountName.trim()
    if (!trimmedName) {
      setError('Account name is required.')
      return
    }
    if (trimmedName.length > 60) {
      setError('Account name must be 60 characters or less.')
      return
    }

    let rules: PropFirmRules
    if (isCustomFirm) {
      const ddLimit = parseFloat(customRules.drawdownLimit) || 0
      const dailyLimit = parseFloat(customRules.dailyLimit) || 0
      const profitTarget = parseFloat(customRules.profitTarget) || 0
      const minDays = parseInt(customRules.minTradingDays) || undefined
      const maxContracts = parseInt(customRules.maxContracts) || undefined
      rules = {
        maxDrawdown: { type: customRules.drawdownType, limit: ddLimit, current: 0 },
        dailyLossLimit: { limit: dailyLimit, todayPnl: 0 },
        profitTarget: { target: profitTarget, currentPnl: 0 },
        minTradingDays: minDays,
        tradingDaysCompleted: 0,
        ...(maxContracts ? { maxContracts } : {}),
        newsTrading: true,
      }
    } else {
      rules = getPresetRules(firmId, finalSize, phase)
    }

    onAdd({
      firm: firmId,
      accountName: trimmedName,
      accountSize: finalSize,
      phase,
      status: 'active',
      rules,
      trades: [],
    })
    onClose()
  }

  // Close on Escape
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [onClose])

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: 'var(--bg-3)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    color: 'var(--text-0)',
    fontSize: 13,
    padding: '9px 12px',
    outline: 'none',
  }

  const labelStyle: React.CSSProperties = {
    fontSize: 11,
    color: 'var(--text-2)',
    marginBottom: 5,
    display: 'block',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  }

  const setCustomRule = (key: keyof typeof customRules, val: string) =>
    setCustomRules(prev => ({ ...prev, [key]: val }))

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--bg-2)',
          border: '1px solid var(--border)',
          borderRadius: 16,
          width: '100%',
          maxWidth: 480,
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-0)' }}>Add Prop Firm Account</h2>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', color: 'var(--text-2)',
              cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 4,
            }}
          >✕</button>
        </div>

        {/* Firm selector */}
        <div>
          <label style={labelStyle}>Prop Firm</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
            {FIRM_LIST.map(f => (
              <button
                key={f.id}
                onClick={() => setFirmId(f.id)}
                style={{
                  padding: '7px 4px',
                  border: `1px solid ${firmId === f.id ? f.color : 'var(--border)'}`,
                  borderRadius: 8,
                  background: firmId === f.id ? `${f.color}18` : 'var(--bg-3)',
                  color: firmId === f.id ? f.color : 'var(--text-1)',
                  cursor: 'pointer',
                  fontSize: 11,
                  fontWeight: firmId === f.id ? 600 : 400,
                  transition: 'all 0.15s',
                }}
              >
                {f.shortName}
              </button>
            ))}
          </div>
        </div>

        {/* Account Size */}
        <div>
          <label style={labelStyle}>Account Size</label>
          {firm && !useCustomSize ? (
            <select
              value={accountSize}
              onChange={e => setAccountSize(Number(e.target.value))}
              style={{ ...inputStyle, cursor: 'pointer' }}
            >
              {firm.accountSizes.map(s => (
                <option key={s} value={s}>{formatAccountSize(s)}</option>
              ))}
            </select>
          ) : (
            <input
              type="number"
              min={1}
              max={10000000}
              value={customSize}
              onChange={e => setCustomSize(e.target.value)}
              placeholder="e.g. 100000"
              style={inputStyle}
            />
          )}
          {firm && (
            <button
              onClick={() => {
                setUseCustomSize(v => !v)
                setCustomSize(String(accountSize))
              }}
              style={{
                marginTop: 6, background: 'none', border: 'none',
                color: 'var(--accent)', fontSize: 11, cursor: 'pointer', padding: 0,
              }}
            >
              {useCustomSize ? '← Use preset sizes' : 'Enter custom size →'}
            </button>
          )}
        </div>

        {/* Phase */}
        <div>
          <label style={labelStyle}>Phase</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {(firm?.phases ?? (['phase1', 'phase2', 'funded', 'payout'] as PhaseId[])).map(p => (
              <button
                key={p}
                onClick={() => setPhase(p)}
                style={{
                  padding: '7px 14px',
                  border: `1px solid ${phase === p ? 'var(--accent)' : 'var(--border)'}`,
                  borderRadius: 8,
                  background: phase === p ? 'var(--accent-dim)' : 'var(--bg-3)',
                  color: phase === p ? 'var(--accent)' : 'var(--text-1)',
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: phase === p ? 600 : 400,
                  transition: 'all 0.15s',
                }}
              >
                {getPhaseLabel(p)}
              </button>
            ))}
          </div>
        </div>

        {/* Account name */}
        <div>
          <label style={labelStyle}>Account Label</label>
          <input
            type="text"
            maxLength={60}
            value={accountName}
            onChange={e => setAccountName(e.target.value)}
            placeholder="e.g. FTMO 100K Phase 1"
            style={inputStyle}
          />
        </div>

        {/* Rules section — editable for Custom, preview for others */}
        <div style={{
          background: 'var(--bg-3)', borderRadius: 8, padding: '12px 14px',
          border: `1px solid ${isCustomFirm ? 'var(--accent)' : 'var(--border)'}`,
        }}>
          <div style={{ fontSize: 10, color: 'var(--text-2)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {isCustomFirm ? 'Rules (enter your firm\'s rules)' : 'Rules Preview (auto-populated)'}
          </div>
          {isCustomFirm ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* Drawdown */}
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-2)', marginBottom: 4 }}>Max Drawdown Limit ($)</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="number"
                    min={0}
                    value={customRules.drawdownLimit}
                    onChange={e => setCustomRule('drawdownLimit', e.target.value)}
                    placeholder="e.g. 3000"
                    style={{ ...inputStyle, flex: 1 }}
                  />
                  <select
                    value={customRules.drawdownType}
                    onChange={e => setCustomRule('drawdownType', e.target.value as DrawdownType)}
                    style={{ ...inputStyle, width: 'auto', flex: '0 0 110px' }}
                  >
                    <option value="static">Static</option>
                    <option value="trailing">Trailing</option>
                  </select>
                </div>
              </div>
              {/* Daily Loss */}
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-2)', marginBottom: 4 }}>Daily Loss Limit ($, 0 = no limit)</div>
                <input
                  type="number"
                  min={0}
                  value={customRules.dailyLimit}
                  onChange={e => setCustomRule('dailyLimit', e.target.value)}
                  placeholder="e.g. 1000"
                  style={inputStyle}
                />
              </div>
              {/* Profit Target */}
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-2)', marginBottom: 4 }}>Profit Target ($, 0 = no target)</div>
                <input
                  type="number"
                  min={0}
                  value={customRules.profitTarget}
                  onChange={e => setCustomRule('profitTarget', e.target.value)}
                  placeholder="e.g. 6000"
                  style={inputStyle}
                />
              </div>
              {/* Min Trading Days */}
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-2)', marginBottom: 4 }}>Min Trading Days (0 = no minimum)</div>
                <input
                  type="number"
                  min={0}
                  value={customRules.minTradingDays}
                  onChange={e => setCustomRule('minTradingDays', e.target.value)}
                  placeholder="e.g. 5"
                  style={inputStyle}
                />
              </div>
              {/* Max Contracts */}
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-2)', marginBottom: 4 }}>Max Contracts (optional)</div>
                <input
                  type="number"
                  min={0}
                  value={customRules.maxContracts}
                  onChange={e => setCustomRule('maxContracts', e.target.value)}
                  placeholder="e.g. 5"
                  style={inputStyle}
                />
              </div>
            </div>
          ) : (
            (() => {
              const finalSize = useCustomSize ? (parseInt(customSize) || accountSize) : accountSize
              const rules = getPresetRules(firmId, finalSize, phase)
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <RuleRow label="Max Drawdown" value={`$${rules.maxDrawdown.limit.toLocaleString()} (${rules.maxDrawdown.type})`} />
                  <RuleRow label="Daily Loss Limit" value={rules.dailyLossLimit.limit === 0 ? 'None' : `$${rules.dailyLossLimit.limit.toLocaleString()}`} />
                  <RuleRow label="Profit Target" value={rules.profitTarget.target === 0 ? 'N/A' : `$${rules.profitTarget.target.toLocaleString()}`} />
                  {rules.minTradingDays && <RuleRow label="Min Trading Days" value={String(rules.minTradingDays)} />}
                  {rules.newsTrading === false && <RuleRow label="News Trading" value="Restricted" />}
                </div>
              )
            })()
          )}
        </div>

        {/* Disclaimer */}
        <div style={{ fontSize: 10, color: 'var(--text-3)', fontStyle: 'italic' }}>
          Rules are sourced from official prop firm websites as of March 2026. Firms update rules frequently — always verify current rules on your firm&apos;s website before trading.
        </div>

        {error && (
          <div style={{
            background: 'var(--red-dim)', border: '1px solid var(--red)',
            borderRadius: 8, padding: '8px 12px', fontSize: 12, color: 'var(--red)',
          }}>
            {error}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
          <button
            onClick={onClose}
            style={{
              padding: '9px 18px', borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'var(--bg-3)', color: 'var(--text-1)',
              cursor: 'pointer', fontSize: 13,
            }}
          >Cancel</button>
          <button
            onClick={handleSubmit}
            style={{
              padding: '9px 20px', borderRadius: 8,
              border: 'none', background: 'var(--accent)',
              color: '#fff', cursor: 'pointer',
              fontSize: 13, fontWeight: 600,
            }}
          >Create Account</button>
        </div>
      </div>
    </div>
  )
}

function RuleRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
      <span style={{ color: 'var(--text-2)' }}>{label}</span>
      <span style={{ color: 'var(--text-0)', fontWeight: 500 }}>{value}</span>
    </div>
  )
}

// ─── Inline Edit Field ────────────────────────────────────────────────────────

function InlineEditNumber({
  value,
  onSave,
  displayValue,
  inputStyle,
}: {
  value: number
  onSave: (v: number) => void
  displayValue: React.ReactNode
  inputStyle: React.CSSProperties
}) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(String(value))

  const save = () => {
    const v = parseFloat(val)
    if (isFinite(v)) onSave(v)
    setEditing(false)
  }

  useEffect(() => {
    setVal(String(value))
  }, [value])

  if (editing) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <input
          type="number"
          value={val}
          onChange={e => setVal(e.target.value)}
          style={inputStyle}
          autoFocus
          onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false) }}
        />
        <button onClick={save} style={{ fontSize: 10, color: 'var(--green)', background: 'none', border: 'none', cursor: 'pointer' }}>✓</button>
        <button onClick={() => setEditing(false)} style={{ fontSize: 10, color: 'var(--text-3)', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      {displayValue}
      <button
        onClick={() => setEditing(true)}
        style={{ fontSize: 10, color: 'var(--text-3)', background: 'none', border: 'none', cursor: 'pointer', padding: '1px 4px' }}
      >
Edit
      </button>
    </div>
  )
}

// ─── Detail View ──────────────────────────────────────────────────────────────

function AccountDetail({ account, onBack, onUpdate }: {
  account: PropFirmAccount
  onBack: () => void
  onUpdate: (updates: Partial<PropFirmAccount>) => void
}) {
  const firm = getFirmPreset(account.firm)
  const firmColor = firm?.color ?? 'var(--accent)'
  const statusColor = getStatusColor(account.status)

  // Edit Rules mode
  const [editingRules, setEditingRules] = useState(false)
  const [ruleEdit, setRuleEdit] = useState({
    drawdownLimit: String(account.rules.maxDrawdown.limit),
    drawdownType: account.rules.maxDrawdown.type as DrawdownType,
    dailyLimit: String(account.rules.dailyLossLimit.limit),
    profitTarget: String(account.rules.profitTarget.target),
    minTradingDays: String(account.rules.minTradingDays ?? ''),
    maxContracts: String(account.rules.maxContracts ?? ''),
  })

  // Sync ruleEdit when account changes
  useEffect(() => {
    setRuleEdit({
      drawdownLimit: String(account.rules.maxDrawdown.limit),
      drawdownType: account.rules.maxDrawdown.type,
      dailyLimit: String(account.rules.dailyLossLimit.limit),
      profitTarget: String(account.rules.profitTarget.target),
      minTradingDays: String(account.rules.minTradingDays ?? ''),
      maxContracts: String(account.rules.maxContracts ?? ''),
    })
  }, [account.rules])

  const handleSaveRules = () => {
    const ddLimit = parseFloat(ruleEdit.drawdownLimit) || 0
    const dailyLimit = parseFloat(ruleEdit.dailyLimit) || 0
    const profitTarget = parseFloat(ruleEdit.profitTarget) || 0
    const minTradingDays = parseInt(ruleEdit.minTradingDays) || undefined
    const maxContracts = parseInt(ruleEdit.maxContracts) || undefined

    const updatedRules: PropFirmRules = {
      ...account.rules,
      maxDrawdown: { ...account.rules.maxDrawdown, type: ruleEdit.drawdownType, limit: ddLimit },
      dailyLossLimit: { ...account.rules.dailyLossLimit, limit: dailyLimit },
      profitTarget: { ...account.rules.profitTarget, target: profitTarget },
      minTradingDays,
      ...(maxContracts ? { maxContracts } : { maxContracts: undefined }),
    }
    onUpdate({ rules: updatedRules })
    setEditingRules(false)
  }

  const handleUpdateRules = useCallback((partial: Partial<PropFirmRules>) => {
    onUpdate({ rules: { ...account.rules, ...partial } })
  }, [account.rules, onUpdate])

  // Journal trade linking
  const [allJournalTrades, setAllJournalTrades] = useState<JournalTrade[]>([])
  const [showLinkPanel, setShowLinkPanel] = useState(false)

  useEffect(() => {
    setAllJournalTrades(loadJournalTrades())
  }, [showLinkPanel])

  // Recompute linked stats when trades change
  const linkedStats = useMemo(() =>
    computeLinkedStats(account.id, allJournalTrades, account.accountSize),
    [account.id, account.accountSize, allJournalTrades]
  )

  const linkedTrades = useMemo(() =>
    allJournalTrades.filter(t => t.propFirmAccountId === account.id),
    [account.id, allJournalTrades]
  )

  const unlinkedTrades = useMemo(() =>
    allJournalTrades.filter(t => !t.propFirmAccountId),
    [allJournalTrades]
  )

  // When there are linked trades, use auto-calculated values for display
  const hasLinkedTrades = linkedTrades.length > 0

  const displayRules = useMemo((): PropFirmRules => {
    if (!hasLinkedTrades) return account.rules
    return {
      ...account.rules,
      profitTarget: {
        ...account.rules.profitTarget,
        currentPnl: linkedStats.totalPnl,
      },
      dailyLossLimit: {
        ...account.rules.dailyLossLimit,
        todayPnl: linkedStats.todayPnl,
      },
      maxDrawdown: {
        ...account.rules.maxDrawdown,
        current: linkedStats.maxDrawdownUsed,
      },
      tradingDaysCompleted: linkedStats.tradingDays,
    }
  }, [account.rules, hasLinkedTrades, linkedStats])

  const drawdownPct = getDrawdownUsedPct(displayRules)
  const profitPct   = getProfitPct(displayRules)
  const dailyPct    = getDailyLossPct(displayRules)
  const drawdownColor = getDrawdownColor(drawdownPct)

  const handleLinkTrade = (tradeId: string) => {
    const trades = loadJournalTrades()
    const updated = trades.map(t => t.id === tradeId ? { ...t, propFirmAccountId: account.id } : t)
    saveJournalTrades(updated)
    // Update account's trade list
    const updatedAccountTrades = [...new Set([...account.trades, tradeId])]
    onUpdate({ trades: updatedAccountTrades })
    setAllJournalTrades(loadJournalTrades())
  }

  const handleUnlinkTrade = (tradeId: string) => {
    const trades = loadJournalTrades()
    const updated = trades.map(t => t.id === tradeId ? { ...t, propFirmAccountId: undefined } : t)
    saveJournalTrades(updated)
    const updatedAccountTrades = account.trades.filter(id => id !== tradeId)
    onUpdate({ trades: updatedAccountTrades })
    setAllJournalTrades(loadJournalTrades())
  }

  const sectionStyle: React.CSSProperties = {
    background: 'var(--card-bg)',
    border: '1px solid var(--border)',
    borderRadius: 12,
    padding: '20px',
    marginBottom: 16,
  }

  const inputStyle: React.CSSProperties = {
    background: 'var(--bg-3)',
    border: '1px solid var(--accent)',
    borderRadius: 6,
    color: 'var(--text-0)',
    fontSize: 13,
    padding: '4px 8px',
    outline: 'none',
    width: 100,
  }

  const ruleInputStyle: React.CSSProperties = {
    background: 'var(--bg-2)',
    border: '1px solid var(--border)',
    borderRadius: 6,
    color: 'var(--text-0)',
    fontSize: 12,
    padding: '6px 10px',
    outline: 'none',
    flex: 1,
  }

  return (
    <div style={{ maxWidth: 700, margin: '0 auto' }}>
      {/* Back + header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button
          onClick={onBack}
          style={{
            background: 'none', border: '1px solid var(--border)',
            borderRadius: 8, color: 'var(--text-1)', cursor: 'pointer',
            padding: '6px 12px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          ← Back
        </button>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-0)' }}>{account.accountName}</h1>
          <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 2 }}>
            {firm?.displayName ?? account.firm} · {formatAccountSize(account.accountSize)} · {getPhaseLabel(account.phase)}
          </div>
        </div>
        {/* Status selector */}
        <select
          value={account.status}
          onChange={e => onUpdate({ status: e.target.value as AccountStatus })}
          style={{
            background: `${statusColor}18`,
            border: `1px solid ${statusColor}`,
            borderRadius: 8, color: statusColor,
            fontSize: 12, fontWeight: 600, padding: '6px 10px', cursor: 'pointer', outline: 'none',
          }}
        >
          {(['active', 'passed', 'failed', 'withdrawn'] as AccountStatus[]).map(s => (
            <option key={s} value={s}>{getStatusLabel(s)}</option>
          ))}
        </select>
      </div>

      {/* Journal trade auto-calc notice */}
      {hasLinkedTrades && (
        <div style={{
          marginBottom: 16,
          padding: '8px 14px',
          borderRadius: 8,
          background: `${firmColor}14`,
          border: `1px solid ${firmColor}44`,
          fontSize: 11,
          color: 'var(--text-1)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="18" y="3" width="4" height="18" rx="1"/><rect x="10" y="8" width="4" height="13" rx="1"/><rect x="2" y="13" width="4" height="8" rx="1"/>
          </svg>
          <span>Stats auto-calculated from {linkedTrades.length} linked journal trade{linkedTrades.length !== 1 ? 's' : ''}.
            {' '}Today: <strong style={{ color: linkedStats.todayPnl >= 0 ? 'var(--green)' : 'var(--red)' }}>${linkedStats.todayPnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
            {' '}Total: <strong style={{ color: linkedStats.totalPnl >= 0 ? 'var(--green)' : 'var(--red)' }}>${linkedStats.totalPnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
          </span>
        </div>
      )}

      {/* Drawdown */}
      <div style={sectionStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-0)' }}>Drawdown</h3>
          <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
            {displayRules.maxDrawdown.type === 'trailing' ? '▼ Trailing from peak' : '▼ Static from start'}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <DrawdownGauge
            pctUsed={drawdownPct}
            limit={displayRules.maxDrawdown.limit}
            current={displayRules.maxDrawdown.current}
          />
          <div style={{ flex: 1 }}>
            <RuleRow label="Max Drawdown Limit" value={`$${displayRules.maxDrawdown.limit.toLocaleString()}`} />
            <div style={{ height: 8 }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11 }}>
              <span style={{ color: 'var(--text-2)' }}>Current Drawdown Used</span>
              {hasLinkedTrades ? (
                <span style={{ color: drawdownColor, fontWeight: 600 }}>
                  ${displayRules.maxDrawdown.current.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  <span style={{ color: 'var(--text-3)', fontWeight: 400 }}> (auto)</span>
                </span>
              ) : (
                <InlineEditNumber
                  value={account.rules.maxDrawdown.current}
                  onSave={v => handleUpdateRules({ maxDrawdown: { ...account.rules.maxDrawdown, current: v } })}
                  inputStyle={inputStyle}
                  displayValue={<span style={{ color: drawdownColor, fontWeight: 600 }}>${account.rules.maxDrawdown.current.toLocaleString()}</span>}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Profit Target */}
      <div style={sectionStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-0)' }}>Profit Target</h3>
          <span style={{ fontSize: 12, color: profitPct >= 100 ? 'var(--green)' : 'var(--text-2)' }}>
            {profitPct.toFixed(1)}%
          </span>
        </div>
        {displayRules.profitTarget.target > 0 ? (
          <>
            <ProgressBar
              label=""
              pct={profitPct}
              color={profitPct >= 100 ? 'var(--green)' : 'var(--accent)'}
              current={displayRules.profitTarget.currentPnl}
              limit={displayRules.profitTarget.target}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
              <RuleRow label="Target" value={`$${displayRules.profitTarget.target.toLocaleString()}`} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 11, color: 'var(--text-2)' }}>Current P&L: </span>
                {hasLinkedTrades ? (
                  <span style={{ fontSize: 11, fontWeight: 600, color: linkedStats.totalPnl >= 0 ? 'var(--green)' : 'var(--red)' }}>
                    ${linkedStats.totalPnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    <span style={{ color: 'var(--text-3)', fontWeight: 400 }}> (auto)</span>
                  </span>
                ) : (
                  <InlineEditNumber
                    value={account.rules.profitTarget.currentPnl}
                    onSave={v => handleUpdateRules({ profitTarget: { ...account.rules.profitTarget, currentPnl: v } })}
                    inputStyle={inputStyle}
                    displayValue={
                      <span style={{ fontSize: 11, fontWeight: 600, color: account.rules.profitTarget.currentPnl >= 0 ? 'var(--green)' : 'var(--red)' }}>
                        ${account.rules.profitTarget.currentPnl.toLocaleString()}
                      </span>
                    }
                  />
                )}
              </div>
            </div>
          </>
        ) : (
          <div style={{ fontSize: 12, color: 'var(--text-3)' }}>No profit target for this phase.</div>
        )}
      </div>

      {/* Daily Loss Limit */}
      <div style={sectionStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-0)' }}>Daily Loss Limit</h3>
          {displayRules.dailyLossLimit.limit > 0 && (
            <span style={{ fontSize: 12, color: getDrawdownColor(dailyPct) }}>
              {dailyPct.toFixed(1)}% used today
            </span>
          )}
        </div>
        {displayRules.dailyLossLimit.limit > 0 ? (
          <>
            <ProgressBar
              label=""
              pct={dailyPct}
              color={getDrawdownColor(dailyPct)}
              current={Math.max(-displayRules.dailyLossLimit.todayPnl, 0)}
              limit={displayRules.dailyLossLimit.limit}
            />
            {/* Alert zones */}
            {dailyPct >= 75 && (
              <div style={{
                marginTop: 8,
                padding: '6px 10px',
                borderRadius: 6,
                background: dailyPct >= 90 ? 'var(--red-dim)' : 'var(--yellow-dim)',
                border: `1px solid ${dailyPct >= 90 ? 'var(--red)' : 'var(--yellow)'}`,
                fontSize: 11,
                color: dailyPct >= 90 ? 'var(--red)' : 'var(--yellow)',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }}>
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>{dailyPct >= 90
                  ? 'DANGER: Over 90% of daily loss limit reached. Consider stopping.'
                  : 'WARNING: Over 75% of daily loss limit reached.'}
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
              <RuleRow label="Limit" value={`$${displayRules.dailyLossLimit.limit.toLocaleString()}`} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 11, color: 'var(--text-2)' }}>Today&apos;s P&L: </span>
                {hasLinkedTrades ? (
                  <span style={{ fontSize: 11, fontWeight: 600, color: linkedStats.todayPnl >= 0 ? 'var(--green)' : 'var(--red)' }}>
                    ${linkedStats.todayPnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    <span style={{ color: 'var(--text-3)', fontWeight: 400 }}> (auto)</span>
                  </span>
                ) : (
                  <InlineEditNumber
                    value={account.rules.dailyLossLimit.todayPnl}
                    onSave={v => handleUpdateRules({ dailyLossLimit: { ...account.rules.dailyLossLimit, todayPnl: v } })}
                    inputStyle={inputStyle}
                    displayValue={
                      <span style={{ fontSize: 11, fontWeight: 600, color: account.rules.dailyLossLimit.todayPnl >= 0 ? 'var(--green)' : 'var(--red)' }}>
                        ${account.rules.dailyLossLimit.todayPnl.toLocaleString()}
                      </span>
                    }
                  />
                )}
              </div>
            </div>
          </>
        ) : (
          <div style={{ fontSize: 12, color: 'var(--text-3)' }}>No daily loss limit for this firm.</div>
        )}
      </div>

      {/* Edit Rules Section */}
      <div style={{ ...sectionStyle, borderColor: editingRules ? 'var(--accent)' : 'var(--border)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: editingRules ? 16 : 0 }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-0)' }}>Account Rules</h3>
          <button
            onClick={() => { setEditingRules(v => !v); if (!editingRules) {
              setRuleEdit({
                drawdownLimit: String(account.rules.maxDrawdown.limit),
                drawdownType: account.rules.maxDrawdown.type,
                dailyLimit: String(account.rules.dailyLossLimit.limit),
                profitTarget: String(account.rules.profitTarget.target),
                minTradingDays: String(account.rules.minTradingDays ?? ''),
                maxContracts: String(account.rules.maxContracts ?? ''),
              })
            }}}
            style={{
              fontSize: 11, padding: '4px 10px', borderRadius: 6,
              border: `1px solid ${editingRules ? 'var(--accent)' : 'var(--border)'}`,
              background: editingRules ? 'var(--accent-dim)' : 'var(--bg-3)',
              color: editingRules ? 'var(--accent)' : 'var(--text-1)',
              cursor: 'pointer',
            }}
          >
            {editingRules ? 'Cancel' : 'Edit Rules'}
          </button>
        </div>

        {editingRules ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Drawdown */}
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-2)', marginBottom: 4 }}>Max Drawdown Limit ($)</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="number"
                  min={0}
                  value={ruleEdit.drawdownLimit}
                  onChange={e => setRuleEdit(p => ({ ...p, drawdownLimit: e.target.value }))}
                  style={{ ...ruleInputStyle }}
                />
                <select
                  value={ruleEdit.drawdownType}
                  onChange={e => setRuleEdit(p => ({ ...p, drawdownType: e.target.value as DrawdownType }))}
                  style={{ ...ruleInputStyle, flex: '0 0 120px' }}
                >
                  <option value="static">Static</option>
                  <option value="trailing">Trailing</option>
                </select>
              </div>
            </div>
            {/* Daily Loss */}
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-2)', marginBottom: 4 }}>Daily Loss Limit ($, 0 = no limit)</div>
              <input
                type="number"
                min={0}
                value={ruleEdit.dailyLimit}
                onChange={e => setRuleEdit(p => ({ ...p, dailyLimit: e.target.value }))}
                style={{ ...ruleInputStyle, display: 'block' }}
              />
            </div>
            {/* Profit Target */}
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-2)', marginBottom: 4 }}>Profit Target ($, 0 = no target)</div>
              <input
                type="number"
                min={0}
                value={ruleEdit.profitTarget}
                onChange={e => setRuleEdit(p => ({ ...p, profitTarget: e.target.value }))}
                style={{ ...ruleInputStyle, display: 'block' }}
              />
            </div>
            {/* Min Trading Days */}
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-2)', marginBottom: 4 }}>Min Trading Days (blank = no minimum)</div>
              <input
                type="number"
                min={0}
                value={ruleEdit.minTradingDays}
                onChange={e => setRuleEdit(p => ({ ...p, minTradingDays: e.target.value }))}
                placeholder="e.g. 5"
                style={{ ...ruleInputStyle, display: 'block' }}
              />
            </div>
            {/* Max Contracts */}
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-2)', marginBottom: 4 }}>Max Contracts (optional)</div>
              <input
                type="number"
                min={0}
                value={ruleEdit.maxContracts}
                onChange={e => setRuleEdit(p => ({ ...p, maxContracts: e.target.value }))}
                placeholder="e.g. 5"
                style={{ ...ruleInputStyle, display: 'block' }}
              />
            </div>
            <button
              onClick={handleSaveRules}
              style={{
                padding: '8px 18px', borderRadius: 8,
                border: 'none', background: 'var(--accent)',
                color: '#fff', cursor: 'pointer',
                fontSize: 12, fontWeight: 600, alignSelf: 'flex-end',
              }}
            >
              Save Rules
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
            <RuleRow label="Max Drawdown" value={`$${account.rules.maxDrawdown.limit.toLocaleString()} (${account.rules.maxDrawdown.type})`} />
            <RuleRow label="Daily Loss Limit" value={account.rules.dailyLossLimit.limit === 0 ? 'None' : `$${account.rules.dailyLossLimit.limit.toLocaleString()}`} />
            <RuleRow label="Profit Target" value={account.rules.profitTarget.target === 0 ? 'None' : `$${account.rules.profitTarget.target.toLocaleString()}`} />
            {account.rules.minTradingDays ? (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: 'var(--text-2)' }}>Min Trading Days</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ height: 4, width: 80, background: 'var(--bg-4)', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      width: `${Math.min(((displayRules.tradingDaysCompleted ?? 0) / account.rules.minTradingDays) * 100, 100)}%`,
                      background: 'var(--accent)',
                      borderRadius: 99,
                    }} />
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--text-0)', fontWeight: 600 }}>
                    {displayRules.tradingDaysCompleted ?? 0} / {account.rules.minTradingDays}
                  </span>
                  {!hasLinkedTrades && (
                    <button
                      onClick={() => handleUpdateRules({ tradingDaysCompleted: Math.min((account.rules.tradingDaysCompleted ?? 0) + 1, account.rules.minTradingDays!) })}
                      style={{ fontSize: 10, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px' }}
                    >+1</button>
                  )}
                </div>
              </div>
            ) : null}
            {account.rules.maxContracts ? (
              <RuleRow label="Max Contracts" value={String(account.rules.maxContracts)} />
            ) : null}
            {account.rules.maxDailyProfit ? (
              <RuleRow label="Max Daily Profit" value={`$${account.rules.maxDailyProfit.toLocaleString()}`} />
            ) : null}
            {account.rules.newsTrading === false && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
                <span style={{ color: 'var(--text-2)' }}>News Trading</span>
                <span style={{ color: 'var(--yellow)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                    <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                  </svg>Restricted
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Linked Trades Section */}
      <div style={sectionStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-0)' }}>
            Linked Journal Trades
            {linkedTrades.length > 0 && (
              <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--text-3)', fontWeight: 400 }}>
                ({linkedTrades.length} linked)
              </span>
            )}
          </h3>
          <button
            onClick={() => setShowLinkPanel(v => !v)}
            style={{
              fontSize: 11, padding: '4px 10px', borderRadius: 6,
              border: `1px solid ${showLinkPanel ? 'var(--accent)' : 'var(--border)'}`,
              background: showLinkPanel ? 'var(--accent-dim)' : 'var(--bg-3)',
              color: showLinkPanel ? 'var(--accent)' : 'var(--text-1)',
              cursor: 'pointer',
            }}
          >
            {showLinkPanel ? 'Done' : '+ Link Trades'}
          </button>
        </div>

        {linkedTrades.length === 0 && !showLinkPanel && (
          <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
            No trades linked yet. Click &quot;+ Link Trades&quot; to assign journal trades to this account, or add a trade in the Journal with this account selected.
          </div>
        )}

        {/* Linked trades list */}
        {linkedTrades.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: showLinkPanel ? 12 : 0 }}>
            {linkedTrades.map(t => (
              <div key={t.id} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '6px 10px', borderRadius: 6, background: 'var(--bg-3)',
                fontSize: 12,
              }}>
                <span style={{ color: 'var(--text-1)' }}>{t.date} — {t.symbol}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontWeight: 600, color: t.pnl >= 0 ? 'var(--green)' : 'var(--red)' }}>
                    {t.pnl >= 0 ? '+' : ''}${t.pnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <button
                    onClick={() => handleUnlinkTrade(t.id)}
                    style={{ fontSize: 10, color: 'var(--text-3)', background: 'none', border: 'none', cursor: 'pointer' }}
                    title="Unlink trade"
                  >✕</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Unlinked trades panel */}
        {showLinkPanel && (
          <div style={{ borderTop: linkedTrades.length > 0 ? '1px solid var(--border)' : 'none', paddingTop: linkedTrades.length > 0 ? 12 : 0 }}>
            <div style={{ fontSize: 11, color: 'var(--text-2)', marginBottom: 8 }}>
              Unlinked journal trades — click to link:
            </div>
            {unlinkedTrades.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
                No unlinked trades found. Add trades in the Journal first.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 240, overflowY: 'auto' }}>
                {unlinkedTrades.map(t => (
                  <div
                    key={t.id}
                    onClick={() => handleLinkTrade(t.id)}
                    style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '7px 10px', borderRadius: 6,
                      border: '1px solid var(--border)',
                      background: 'var(--bg-3)',
                      cursor: 'pointer',
                      fontSize: 12,
                      transition: 'border-color 0.15s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
                  >
                    <span style={{ color: 'var(--text-1)' }}>{t.date} — {t.symbol}</span>
                    <span style={{ fontWeight: 600, color: t.pnl >= 0 ? 'var(--green)' : 'var(--red)' }}>
                      {t.pnl >= 0 ? '+' : ''}${t.pnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Meta */}
      <div style={{ fontSize: 10, color: 'var(--text-3)', textAlign: 'right', marginTop: -8 }}>
        Created {new Date(account.createdAt).toLocaleDateString()} · Updated {new Date(account.updatedAt).toLocaleDateString()}
      </div>
    </div>
  )
}

// ─── Drawdown Disclaimer Banner ───────────────────────────────────────────────

function DrawdownDisclaimer() {
  const [dismissed, setDismissed] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    try {
      if (localStorage.getItem('cg_propfirm_disclaimer_dismissed') === 'true') {
        setDismissed(true)
      }
    } catch { /* ignore */ }
  }, [])

  const handleDismiss = () => {
    try { localStorage.setItem('cg_propfirm_disclaimer_dismissed', 'true') } catch { /* ignore */ }
    setDismissed(true)
  }

  if (dismissed) return null

  return (
    <div style={{
      marginBottom: 20,
      borderRadius: 8,
      border: '1px solid var(--accent)',
      background: 'var(--bg-2)',
      overflow: 'hidden',
    }}>
      <div style={{
        display: 'flex',
        alignItems: collapsed ? 'center' : 'flex-start',
        gap: 10,
        padding: '10px 14px',
      }}>
        <span style={{ fontSize: 14, flexShrink: 0, marginTop: collapsed ? 0 : 1 }}>ℹ️</span>
        {collapsed ? (
          <span style={{ fontSize: 12, color: 'var(--text-2)', flex: 1, fontStyle: 'italic' }}>
            Intraday drawdown disclaimer (click ▼ to expand)
          </span>
        ) : (
          <p style={{
            fontSize: 12,
            color: 'var(--text-2)',
            flex: 1,
            margin: 0,
            lineHeight: 1.55,
          }}>
            TradVue tracks drawdown from closed/logged trades only. Intraday drawdown on open positions is calculated by your prop firm&apos;s platform in real-time and may differ from values shown here. Always monitor your firm&apos;s official dashboard for live account status. TradVue&apos;s tracking is supplementary — not a replacement for your firm&apos;s official numbers.
          </p>
        )}
        <div style={{ display: 'flex', gap: 4, flexShrink: 0, alignItems: 'center' }}>
          <button
            onClick={() => setCollapsed(v => !v)}
            style={{
              background: 'none', border: 'none',
              color: 'var(--text-3)', cursor: 'pointer',
              fontSize: 11, padding: '2px 6px', lineHeight: 1,
            }}
            title={collapsed ? 'Expand' : 'Collapse'}
          >
            {collapsed ? '▼' : '▲'}
          </button>
          <button
            onClick={handleDismiss}
            style={{
              background: 'none', border: 'none',
              color: 'var(--text-3)', cursor: 'pointer',
              fontSize: 11, padding: '2px 6px', lineHeight: 1,
            }}
            title="Dismiss"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PropFirmPage() {
  const { user } = useAuth()
  const [accounts, setAccounts]       = useState<PropFirmAccount[]>([])
  const [showAddModal, setShowAddModal] = useState(false)
  const [selectedAccount, setSelectedAccount] = useState<PropFirmAccount | null>(null)
  const [mounted, setMounted]         = useState(false)
  const [authModalOpenProp, setAuthModalOpenProp] = useState(false)

  // Load from localStorage on mount
  useEffect(() => {
    setAccounts(loadPropFirmAccounts())
    setMounted(true)
  }, [])

  const handleAdd = useCallback((accountData: Omit<PropFirmAccount, 'id' | 'createdAt' | 'updatedAt'>) => {
    const created = addPropFirmAccount(accountData)
    setAccounts(loadPropFirmAccounts())
    setSelectedAccount(created)
  }, [])

  const handleDelete = useCallback((id: string) => {
    deletePropFirmAccount(id)
    setAccounts(loadPropFirmAccounts())
    if (selectedAccount?.id === id) setSelectedAccount(null)
  }, [selectedAccount])

  const handleUpdate = useCallback((id: string, updates: Partial<PropFirmAccount>) => {
    const updated = updatePropFirmAccount(id, updates)
    if (updated) {
      setAccounts(loadPropFirmAccounts())
      setSelectedAccount(updated)
    }
  }, [])

  const handleSelect = useCallback((acc: PropFirmAccount) => {
    setSelectedAccount(acc)
  }, [])

  // Auth gating
  const tier = getUserTier(user)
  if (tier === 'demo') {
    const DEMO_PROP_ACCOUNTS = [
      {
        id: 'demo-1',
        firm: 'TopStep',
        accountName: 'TopStep Combine 150K',
        accountSize: 150000,
        phase: 'Combine',
        status: 'active' as const,
        maxDailyLoss: 3000,
        dailyLossUsed: 450,
        maxDrawdown: 4500,
        drawdownUsed: 1200,
        profitTarget: 9000,
        profitEarned: 2340,
        rules: [
          'Daily loss limit: $3,000',
          'Max trailing drawdown: $4,500',
          'Profit target: $9,000',
          'Minimum trading days: 10',
          'No news trading within 2 minutes',
        ],
        trades: [
          { date: '2026-03-14', symbol: 'NQ', direction: 'Long', contracts: 2, pnl: 1500 },
          { date: '2026-03-13', symbol: 'ES', direction: 'Short', contracts: 1, pnl: 650 },
          { date: '2026-03-12', symbol: 'NQ', direction: 'Long', contracts: 1, pnl: -320 },
          { date: '2026-03-11', symbol: 'MES', direction: 'Long', contracts: 5, pnl: 510 },
        ],
      },
      {
        id: 'demo-2',
        firm: 'Apex Trader Funding',
        accountName: 'Apex 50K — Evaluation',
        accountSize: 50000,
        phase: 'Evaluation',
        status: 'active' as const,
        maxDailyLoss: 1000,
        dailyLossUsed: 0,
        maxDrawdown: 2500,
        drawdownUsed: 380,
        profitTarget: 3000,
        profitEarned: 1850,
        rules: [
          'Daily loss limit: $1,000',
          'Max trailing drawdown: $2,500',
          'Profit target: $3,000',
          'No position over weekend',
          'Max contracts: 5 (NQ/ES)',
        ],
        trades: [
          { date: '2026-03-14', symbol: 'ES', direction: 'Long', contracts: 3, pnl: 1125 },
          { date: '2026-03-13', symbol: 'NQ', direction: 'Short', contracts: 1, pnl: 725 },
        ],
      },
    ]

    return (
      <AuthGate featureName="Prop Firm Tracker" featureDesc="Track your prop firm account rules, drawdown limits, and daily loss caps.">
        <div style={{ minHeight: '100vh', background: 'var(--bg-0)', color: 'var(--text-0)' }}>
          <PersistentNav />
          {authModalOpenProp && <AuthModal onClose={() => setAuthModalOpenProp(false)} />}
          <main style={{ maxWidth: 960, margin: '0 auto', padding: '32px 20px 60px', fontFamily: 'var(--font)' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
              <div>
                <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-0)', display: 'flex', alignItems: 'center', gap: 10, margin: '0 0 4px' }}>
                  <span style={{ color: 'var(--accent)' }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
                  </span>
                  Prop Firm Tracker
                </h1>
                <p style={{ fontSize: 13, color: 'var(--text-2)', margin: 0 }}>Track your prop firm challenges and funded account rules in one place.</p>
              </div>
              <button onClick={() => setAuthModalOpenProp(true)} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--accent)', border: 'none', borderRadius: 8, padding: '10px 18px', color: '#0a0a0c', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Add Account
              </button>
            </div>

            {/* Account cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {DEMO_PROP_ACCOUNTS.map(acct => {
                const drawdownPct = (acct.drawdownUsed / acct.maxDrawdown) * 100
                const dailyPct = (acct.dailyLossUsed / acct.maxDailyLoss) * 100
                const profitPct = (acct.profitEarned / acct.profitTarget) * 100
                return (
                  <div key={acct.id} style={{ background: 'var(--bg-2)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 12, padding: 24 }}>
                    {/* Account header */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
                      <div>
                        <div style={{ fontSize: 18, fontWeight: 800 }}>{acct.accountName}</div>
                        <div style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 2 }}>{acct.firm} · ${acct.accountSize.toLocaleString()} · {acct.phase}</div>
                      </div>
                      <span style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 20, padding: '4px 14px', fontSize: 12, fontWeight: 700, textTransform: 'capitalize' as const }}>
                        {acct.status}
                      </span>
                    </div>

                    {/* Progress bars */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14, marginBottom: 20 }}>
                      {[
                        { label: 'Max Daily Loss', limit: acct.maxDailyLoss, used: acct.dailyLossUsed, pct: dailyPct, color: dailyPct > 70 ? '#ef4444' : '#f59e0b', isLoss: true },
                        { label: 'Max Drawdown', limit: acct.maxDrawdown, used: acct.drawdownUsed, pct: drawdownPct, color: drawdownPct > 70 ? '#ef4444' : '#f59e0b', isLoss: true },
                        { label: 'Profit Target', limit: acct.profitTarget, used: acct.profitEarned, pct: profitPct, color: '#10b981', isLoss: false },
                      ].map(m => (
                        <div key={m.label} style={{ background: 'var(--bg-1)', borderRadius: 10, padding: '14px 16px' }}>
                          <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 8 }}>{m.label}</div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                            <span style={{ fontSize: 16, fontWeight: 700, color: m.color, fontFamily: 'var(--mono)' }}>
                              {m.isLoss ? '-' : '+'}${m.used.toLocaleString()}
                            </span>
                            <span style={{ fontSize: 11, color: 'var(--text-3)' }}>/ ${m.limit.toLocaleString()}</span>
                          </div>
                          <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 6, height: 8, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${Math.min(m.pct, 100)}%`, background: m.color, borderRadius: 6, transition: 'width 0.4s' }} />
                          </div>
                          <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 4 }}>{m.pct.toFixed(0)}% {m.isLoss ? 'used' : 'achieved'}</div>
                        </div>
                      ))}
                    </div>

                    {/* Rules */}
                    <div style={{ marginBottom: 20 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-2)', textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 8 }}>Account Rules</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {acct.rules.map((r, i) => (
                          <span key={i} style={{ fontSize: 11, color: 'var(--text-2)', background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 10px' }}>{r}</span>
                        ))}
                      </div>
                    </div>

                    {/* Recent trades */}
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-2)', textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 8 }}>Recent Trades</div>
                      <table style={{ width: '100%', borderCollapse: 'collapse' as const, fontSize: 12 }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid var(--border)' }}>
                            {['Date', 'Symbol', 'Direction', 'Contracts', 'P&L'].map(h => (
                              <th key={h} style={{ padding: '6px 10px', textAlign: 'left' as const, color: 'var(--text-3)', fontWeight: 600, fontSize: 10, textTransform: 'uppercase' as const }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {acct.trades.map((t, i) => (
                            <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                              <td style={{ padding: '8px 10px', color: 'var(--text-2)' }}>{t.date}</td>
                              <td style={{ padding: '8px 10px', fontWeight: 700, color: 'var(--blue)', fontFamily: 'var(--mono)' }}>{t.symbol}</td>
                              <td style={{ padding: '8px 10px', color: t.direction === 'Long' ? '#10b981' : '#ef4444' }}>{t.direction}</td>
                              <td style={{ padding: '8px 10px', color: 'var(--text-2)', fontFamily: 'var(--mono)' }}>{t.contracts}</td>
                              <td style={{ padding: '8px 10px', fontFamily: 'var(--mono)', fontWeight: 700, color: t.pnl >= 0 ? '#10b981' : '#ef4444' }}>
                                {t.pnl >= 0 ? '+' : '-'}${Math.abs(t.pnl).toLocaleString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )
              })}
            </div>
            <div style={{ marginTop: 20, fontSize: 11, color: 'var(--text-3)', textAlign: 'center' as const, fontStyle: 'italic' }}>Sample data — create an account to track your real prop firm accounts</div>
          </main>
        </div>
      </AuthGate>
    )
  }

  if (!mounted) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-0)' }}>
        <PersistentNav />
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-0)', color: 'var(--text-0)' }}>
      <PersistentNav />

      <main style={{
        maxWidth: 960,
        margin: '0 auto',
        padding: '32px 20px 60px',
        fontFamily: 'var(--font)',
      }}>
        {selectedAccount ? (
          <AccountDetail
            account={selectedAccount}
            onBack={() => setSelectedAccount(null)}
            onUpdate={updates => handleUpdate(selectedAccount.id, updates)}
          />
        ) : (
          <>
            {/* Page Header */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              marginBottom: 28,
            }}>
              <div>
                <h1 style={{
                  fontSize: 24, fontWeight: 700, color: 'var(--text-0)',
                  display: 'flex', alignItems: 'center', gap: 10,
                }}>
                  <span style={{ color: 'var(--accent)' }}><IconTarget size={22} /></span>
                  Prop Firm Tracker
                </h1>
                <p style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 4 }}>
                  Track your prop firm challenges and funded account rules in one place.
                </p>
                <p style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 4, fontStyle: 'italic' }}>
                  Rules are sourced from official prop firm websites as of March 2026. Firms update rules frequently — always verify current rules on your firm&apos;s website before trading.
                </p>
              </div>
              <button
                onClick={() => setShowAddModal(true)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '9px 18px', borderRadius: 8,
                  border: 'none', background: 'var(--accent)',
                  color: '#fff', cursor: 'pointer',
                  fontSize: 13, fontWeight: 600,
                  transition: 'opacity 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
                onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
              >
                + Add Account
              </button>
            </div>

            {/* Intraday drawdown disclaimer */}
            <DrawdownDisclaimer />

            {/* Accounts grid */}
            {accounts.length === 0 ? (
              <div style={{
                textAlign: 'center', padding: '80px 20px',
                border: '1px dashed var(--border)', borderRadius: 12,
              }}>
                <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'center' }}>
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/>
                    <circle cx="12" cy="12" r="6"/>
                    <circle cx="12" cy="12" r="2"/>
                  </svg>
                </div>
                <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-0)', marginBottom: 8 }}>
                  No prop firm accounts yet
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 24 }}>
                  Add your first prop firm challenge to start tracking drawdown, profit targets, and daily limits.
                </div>
                <button
                  onClick={() => setShowAddModal(true)}
                  style={{
                    padding: '10px 22px', borderRadius: 8,
                    border: 'none', background: 'var(--accent)',
                    color: '#fff', cursor: 'pointer',
                    fontSize: 13, fontWeight: 600,
                  }}
                >
                  + Add First Account
                </button>
              </div>
            ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                gap: 16,
              }}>
                {accounts.map(acc => (
                  <AccountCard
                    key={acc.id}
                    account={acc}
                    onSelect={handleSelect}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            )}

            {/* Summary stats (when accounts exist) */}
            {accounts.length > 0 && (
              <div style={{
                marginTop: 32, display: 'flex', gap: 12, flexWrap: 'wrap',
              }}>
                {[
                  { label: 'Total Accounts', value: String(accounts.length) },
                  { label: 'Active', value: String(accounts.filter(a => a.status === 'active').length), color: 'var(--accent)' },
                  { label: 'Passed', value: String(accounts.filter(a => a.status === 'passed').length), color: 'var(--green)' },
                  { label: 'Failed', value: String(accounts.filter(a => a.status === 'failed').length), color: 'var(--red)' },
                  { label: 'Capital at Risk', value: `$${accounts.filter(a => a.status === 'active').reduce((s, a) => s + a.accountSize, 0).toLocaleString()}` },
                ].map(stat => (
                  <div key={stat.label} style={{
                    background: 'var(--card-bg)',
                    border: '1px solid var(--border)',
                    borderRadius: 12,
                    padding: '12px 18px',
                    minWidth: 120,
                  }}>
                    <div style={{ fontSize: 10, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                      {stat.label}
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: stat.color ?? 'var(--text-0)' }}>
                      {stat.value}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>

      {showAddModal && (
        <AddAccountModal
          onClose={() => setShowAddModal(false)}
          onAdd={handleAdd}
        />
      )}
      <div style={{ padding: '12px 24px', borderTop: '1px solid var(--border)', marginTop: 8 }}>
        <p style={{ fontSize: 11, color: 'var(--text-3)', textAlign: 'center', margin: 0 }}>
          Calculations are based on published contract specifications and user-entered data. Actual P&amp;L may differ due to commissions, fees, slippage, and market conditions. Always verify with your broker.
        </p>
      </div>
    </div>
  )
}
