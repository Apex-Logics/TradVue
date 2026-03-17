'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { getUserTier } from '../utils/tierAccess'
import AuthGate from '../components/AuthGate'
import PersistentNav from '../components/PersistentNav'
import { IconShield } from '../components/Icons'
import {
  loadRuleCopSettings,
  saveRuleCopSettings,
  acknowledgeViolation,
  saveViolations,
  type TradingRule,
  type RuleViolation,
  RULE_COP_KEY,
} from '../utils/ruleCopData'
import { getDefaultRules, formatRuleDescription, getRuleTypeLabel } from '../utils/ruleCopDefaults'
import {
  checkRulesFromStorage,
  getTodaySummary,
  getRuleStatusToday,
  countViolationsForRule,
} from '../utils/ruleCopEngine'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function genId(): string {
  return `rule-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ─── Circular Progress Gauge ──────────────────────────────────────────────────

function CircularGauge({ value, total }: { value: number; total: number }) {
  const pct = total === 0 ? 1 : value / total
  const r = 36
  const circ = 2 * Math.PI * r
  const offset = circ * (1 - pct)
  const color = pct >= 0.8 ? '#4ade80' : pct >= 0.5 ? '#fb923c' : '#f87171'

  return (
    <svg width="90" height="90" viewBox="0 0 90 90">
      <circle cx="45" cy="45" r={r} fill="none" stroke="var(--border)" strokeWidth="7" />
      <circle
        cx="45"
        cy="45"
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="7"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform="rotate(-90 45 45)"
        style={{ transition: 'stroke-dashoffset 0.6s ease, stroke 0.3s ease' }}
      />
      <text x="45" y="44" textAnchor="middle" dominantBaseline="middle" fill={color} fontSize="14" fontWeight="700">
        {value}/{total}
      </text>
      <text x="45" y="58" textAnchor="middle" dominantBaseline="middle" fill="var(--text-3)" fontSize="9">
        rules ok
      </text>
    </svg>
  )
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: 'following' | 'warning' | 'violated' }) {
  const map = {
    following: { icon: '✅', label: 'Following', color: '#4ade80' },
    warning:   { icon: '⚠️', label: 'Warning',   color: '#fb923c' },
    violated:  { icon: '🚨', label: 'Violated',  color: '#f87171' },
  }
  const cfg = map[status]
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: 11, fontWeight: 600, color: cfg.color,
      background: `${cfg.color}18`, borderRadius: 20,
      padding: '2px 8px', border: `1px solid ${cfg.color}40`,
    }}>
      {cfg.icon} {cfg.label}
    </span>
  )
}

// ─── Toggle Switch ────────────────────────────────────────────────────────────

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      style={{
        width: 40, height: 22, borderRadius: 11,
        background: checked ? 'var(--accent)' : 'var(--border)',
        border: 'none', cursor: 'pointer', position: 'relative',
        transition: 'background 0.2s', flexShrink: 0,
      }}
      title={checked ? 'Disable rule' : 'Enable rule'}
    >
      <span style={{
        position: 'absolute', top: 3, left: checked ? 21 : 3,
        width: 16, height: 16, borderRadius: '50%',
        background: '#fff', transition: 'left 0.2s',
        boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
      }} />
    </button>
  )
}

// ─── Add Custom Rule Modal ────────────────────────────────────────────────────

const RULE_TYPES: Array<{ value: TradingRule['type']; label: string }> = [
  { value: 'max_trades_per_day',      label: 'Max Trades / Day' },
  { value: 'max_loss_per_day',        label: 'Max Daily Loss ($)' },
  { value: 'max_loss_per_trade',      label: 'Max Loss / Trade ($)' },
  { value: 'max_position_size',       label: 'Max Position Size ($)' },
  { value: 'max_consecutive_losses',  label: 'Max Consecutive Losses' },
  { value: 'no_trading_after_time',   label: 'No Trading After Time' },
  { value: 'min_risk_reward',         label: 'Min Risk/Reward Ratio' },
  { value: 'max_daily_profit',        label: 'Max Daily Profit ($)' },
  { value: 'no_revenge_trading',      label: 'No Revenge Trading (minutes)' },
  { value: 'custom',                  label: 'Custom' },
]

interface AddRuleModalProps {
  onAdd: (rule: TradingRule) => void
  onClose: () => void
}

function AddRuleModal({ onAdd, onClose }: AddRuleModalProps) {
  const [name, setName] = useState('')
  const [type, setType] = useState<TradingRule['type']>('custom')
  const [value, setValue] = useState('')
  const [description, setDescription] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    const rule: TradingRule = {
      id: genId(),
      name: name.trim(),
      type,
      enabled: true,
      value: type === 'no_trading_after_time' ? value : (isNaN(Number(value)) ? value : Number(value)),
      description: description.trim() || `Custom rule: ${name}`,
      createdAt: new Date().toISOString(),
    }
    onAdd(rule)
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 12, padding: 24, width: '100%', maxWidth: 480,
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
      }}>
        <h3 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 700 }}>+ Add Custom Rule</h3>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 12, color: 'var(--text-2)', fontWeight: 600 }}>Rule Name</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Stop after big win"
              required
              style={{
                background: 'var(--surface-2)', border: '1px solid var(--border)',
                borderRadius: 6, padding: '8px 12px', color: 'var(--text)', fontSize: 14,
                outline: 'none',
              }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 12, color: 'var(--text-2)', fontWeight: 600 }}>Rule Type</label>
            <select
              value={type}
              onChange={e => setType(e.target.value as TradingRule['type'])}
              style={{
                background: 'var(--surface-2)', border: '1px solid var(--border)',
                borderRadius: 6, padding: '8px 12px', color: 'var(--text)', fontSize: 14,
              }}
            >
              {RULE_TYPES.map(rt => (
                <option key={rt.value} value={rt.value}>{rt.label}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 12, color: 'var(--text-2)', fontWeight: 600 }}>
              Threshold {type === 'no_trading_after_time' ? '(HH:MM)' : type === 'no_revenge_trading' ? '(minutes)' : ''}
            </label>
            <input
              value={value}
              onChange={e => setValue(e.target.value)}
              placeholder={type === 'no_trading_after_time' ? '15:00' : type === 'no_revenge_trading' ? '15' : '5'}
              required
              style={{
                background: 'var(--surface-2)', border: '1px solid var(--border)',
                borderRadius: 6, padding: '8px 12px', color: 'var(--text)', fontSize: 14,
                outline: 'none',
              }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 12, color: 'var(--text-2)', fontWeight: 600 }}>Description (optional)</label>
            <input
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Describe when this rule triggers"
              style={{
                background: 'var(--surface-2)', border: '1px solid var(--border)',
                borderRadius: 6, padding: '8px 12px', color: 'var(--text)', fontSize: 14,
                outline: 'none',
              }}
            />
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 6 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '8px 16px', borderRadius: 6, border: '1px solid var(--border)',
                background: 'transparent', color: 'var(--text-2)', cursor: 'pointer', fontSize: 13,
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              style={{
                padding: '8px 16px', borderRadius: 6, border: 'none',
                background: 'var(--accent)', color: '#fff', cursor: 'pointer',
                fontSize: 13, fontWeight: 600,
              }}
            >
              Add Rule
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Rule Card ────────────────────────────────────────────────────────────────

interface RuleCardProps {
  rule: TradingRule
  status: 'following' | 'warning' | 'violated'
  violationCount: number
  onToggle: (id: string, enabled: boolean) => void
  onValueChange: (id: string, value: number | string) => void
  onDelete: (id: string) => void
}

function RuleCard({ rule, status, violationCount, onToggle, onValueChange, onDelete }: RuleCardProps) {
  const [editing, setEditing] = useState(false)
  const [editVal, setEditVal] = useState(String(rule.value))
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing && inputRef.current) inputRef.current.focus()
  }, [editing])

  const commitEdit = () => {
    const v = rule.type === 'no_trading_after_time' ? editVal : (isNaN(Number(editVal)) ? editVal : Number(editVal))
    onValueChange(rule.id, v)
    setEditing(false)
  }

  const borderColor = status === 'violated' ? 'rgba(248,113,113,0.35)' : status === 'warning' ? 'rgba(251,146,60,0.35)' : 'var(--border)'

  return (
    <div
      data-testid="rule-card"
      style={{
        background: 'var(--surface)',
        border: `1px solid ${borderColor}`,
        borderRadius: 12,
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
          <Toggle checked={rule.enabled} onChange={v => onToggle(rule.id, v)} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 14, color: rule.enabled ? 'var(--text)' : 'var(--text-3)' }}>
              {rule.name}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>
              {getRuleTypeLabel(rule.type)}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {rule.enabled && <StatusBadge status={status} />}
          {violationCount > 0 && (
            <span style={{
              fontSize: 11, color: 'var(--text-3)',
              background: 'var(--surface-2)',
              borderRadius: 20, padding: '2px 8px',
              border: '1px solid var(--border)',
            }}>
              {violationCount} lifetime
            </span>
          )}
          <button
            onClick={() => onDelete(rule.id)}
            aria-label="Delete rule"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-3)', fontSize: 14, padding: '2px 4px',
              lineHeight: 1,
            }}
            title="Delete rule"
          >
            ✕
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ fontSize: 12, color: 'var(--text-2)', flex: 1 }}>
          {formatRuleDescription(rule)}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Threshold:</span>
          {editing ? (
            <input
              ref={inputRef}
              value={editVal}
              onChange={e => setEditVal(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') { setEditVal(String(rule.value)); setEditing(false) } }}
              aria-label="Edit threshold"
              style={{
                width: 80, padding: '3px 8px', fontSize: 13,
                background: 'var(--surface-2)', border: '1px solid var(--accent)',
                borderRadius: 5, color: 'var(--text)', outline: 'none',
              }}
            />
          ) : (
            <button
              onClick={() => { setEditVal(String(rule.value)); setEditing(true) }}
              aria-label="Edit threshold value"
              data-testid="threshold-value"
              style={{
                background: 'var(--surface-2)', border: '1px solid var(--border)',
                borderRadius: 5, padding: '3px 10px', fontSize: 13,
                color: 'var(--accent)', cursor: 'pointer', fontWeight: 600,
              }}
              title="Click to edit threshold"
            >
              {String(rule.value)}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Violation Row ────────────────────────────────────────────────────────────

function ViolationRow({ v, onAck }: { v: RuleViolation; onAck: (id: string) => void }) {
  const isViolation = v.severity === 'violation'
  const color = isViolation ? '#f87171' : '#fb923c'

  return (
    <div style={{
      background: 'var(--surface)',
      border: `1px solid ${color}35`,
      borderRadius: 8, padding: '12px 16px',
      display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12,
      opacity: v.acknowledged ? 0.45 : 1,
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 13 }}>{isViolation ? '🚨' : '⚠️'}</span>
          <span style={{ fontWeight: 600, fontSize: 13, color }}>{v.ruleName}</span>
          <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{formatDate(v.createdAt)}</span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-2)' }}>{v.details}</div>
      </div>
      {!v.acknowledged && (
        <button
          onClick={() => onAck(v.id)}
          style={{
            fontSize: 11, padding: '4px 10px', borderRadius: 5,
            border: '1px solid var(--border)', background: 'var(--surface-2)',
            color: 'var(--text-2)', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
          }}
        >
          Acknowledge
        </button>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function RulesPage() {
  const { user } = useAuth()
  const [rules, setRules] = useState<TradingRule[]>([])
  const [violations, setViolations] = useState<RuleViolation[]>([])
  const [showAddModal, setShowAddModal] = useState(false)
  const [checking, setChecking] = useState(false)
  const [loaded, setLoaded] = useState(false)

  // Load from localStorage on mount
  useEffect(() => {
    const settings = loadRuleCopSettings()
    // If no rules yet, seed with defaults
    if (settings.rules.length === 0) {
      const defaults = getDefaultRules()
      settings.rules = defaults
      saveRuleCopSettings(settings)
    }
    setRules(settings.rules)
    setViolations(settings.violations)
    setLoaded(true)
  }, [])

  // Run rule check
  const runCheck = useCallback(() => {
    setChecking(true)
    try {
      const newViolations = checkRulesFromStorage(rules)
      if (newViolations.length > 0) {
        saveViolations(newViolations)
        const settings = loadRuleCopSettings()
        setViolations(settings.violations)
      }
    } finally {
      setChecking(false)
    }
  }, [rules])

  // Save rules whenever they change
  const persistRules = useCallback((updated: TradingRule[]) => {
    const settings = loadRuleCopSettings()
    settings.rules = updated
    saveRuleCopSettings(settings)
    setRules(updated)
  }, [])

  const handleToggle = useCallback((id: string, enabled: boolean) => {
    setRules(prev => {
      const next = prev.map(r => r.id === id ? { ...r, enabled } : r)
      const settings = loadRuleCopSettings()
      settings.rules = next
      saveRuleCopSettings(settings)
      return next
    })
  }, [])

  const handleValueChange = useCallback((id: string, value: number | string) => {
    setRules(prev => {
      const next = prev.map(r => r.id === id ? { ...r, value } : r)
      const settings = loadRuleCopSettings()
      settings.rules = next
      saveRuleCopSettings(settings)
      return next
    })
  }, [])

  const handleDelete = useCallback((id: string) => {
    setRules(prev => {
      const next = prev.filter(r => r.id !== id)
      const settings = loadRuleCopSettings()
      settings.rules = next
      saveRuleCopSettings(settings)
      return next
    })
  }, [])

  const handleAddRule = useCallback((rule: TradingRule) => {
    setRules(prev => {
      const next = [...prev, rule]
      const settings = loadRuleCopSettings()
      settings.rules = next
      saveRuleCopSettings(settings)
      return next
    })
    setShowAddModal(false)
  }, [])

  const handleAcknowledge = useCallback((violationId: string) => {
    acknowledgeViolation(violationId)
    setViolations(prev => prev.map(v => v.id === violationId ? { ...v, acknowledged: true } : v))
  }, [])

  const summary = getTodaySummary(rules, violations)
  const recentViolations = [...violations]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 20)

  // Auth gating
  const tier = getUserTier(user)
  if (tier === 'demo') {
    return (
      <AuthGate
        featureName="Rule Cop"
        featureDesc="Define your trading rules and get automatic violation alerts. Free account required."
      >
        <div style={{ minHeight: '100vh', background: 'var(--bg-0)', color: 'var(--text-0)' }}>
          <PersistentNav />
          <div style={{ maxWidth: 820, margin: '0 auto', padding: '80px 16px' }}>
            <h1 style={{ fontSize: 24, fontWeight: 800 }}>Rule Cop</h1>
          </div>
        </div>
      </AuthGate>
    )
  }

  if (!loaded) return null

  return (
    <>
      <PersistentNav />
      <main style={{ maxWidth: 820, margin: '0 auto', padding: '80px 16px 60px' }}>

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 42, height: 42, borderRadius: 10,
              background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <IconShield size={22} />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Trading Rules</h1>
              <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
                Your personal rule calculator — self-accountability only
              </div>
            </div>
          </div>
          <button
            onClick={runCheck}
            disabled={checking}
            style={{
              padding: '8px 16px', borderRadius: 7, border: 'none',
              background: 'var(--accent)', color: '#fff', cursor: 'pointer',
              fontSize: 13, fontWeight: 600, opacity: checking ? 0.7 : 1,
            }}
          >
            {checking ? 'Checking…' : 'Check Rules Now'}
          </button>
        </div>

        {/* ── Today's Summary ─────────────────────────────────────────────── */}
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 12, padding: '20px 24px', marginBottom: 24,
          display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap',
        }}>
          <CircularGauge value={summary.followed} total={summary.total} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>
              {summary.followed}/{summary.total} rules followed today
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-2)' }}>
              {summary.total === 0
                ? 'Enable rules below to start tracking your discipline.'
                : summary.followed === summary.total
                  ? '✅ All rules on track today.'
                  : `${summary.total - summary.followed} rule${summary.total - summary.followed !== 1 ? 's' : ''} triggered today.`}
            </div>
            {violations.filter(v => !v.acknowledged && v.severity === 'violation').length > 0 && (
              <div style={{ marginTop: 8, fontSize: 12, color: '#f87171' }}>
                🚨 {violations.filter(v => !v.acknowledged && v.severity === 'violation').length} unacknowledged violation{violations.filter(v => !v.acknowledged && v.severity === 'violation').length !== 1 ? 's' : ''}
              </div>
            )}
          </div>
        </div>

        {/* ── Rules List ──────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Your Rules ({rules.length})</h2>
          <button
            onClick={() => setShowAddModal(true)}
            data-testid="add-rule-btn"
            style={{
              padding: '6px 14px', borderRadius: 6, border: '1px solid var(--accent)',
              background: 'transparent', color: 'var(--accent)', cursor: 'pointer',
              fontSize: 13, fontWeight: 600,
            }}
          >
            + Add Custom Rule
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 32 }}>
          {rules.map(rule => (
            <RuleCard
              key={rule.id}
              rule={rule}
              status={getRuleStatusToday(rule.id, violations)}
              violationCount={countViolationsForRule(rule.id, violations)}
              onToggle={handleToggle}
              onValueChange={handleValueChange}
              onDelete={handleDelete}
            />
          ))}
          {rules.length === 0 && (
            <div style={{
              textAlign: 'center', padding: '40px 20px',
              color: 'var(--text-3)', fontSize: 14,
              border: '1px dashed var(--border)', borderRadius: 10,
            }}>
              No rules yet. Click "+ Add Custom Rule" to get started.
            </div>
          )}
        </div>

        {/* ── Violations Log ───────────────────────────────────────────────── */}
        <h2 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 700 }}>
          Violations Log {violations.length > 0 && <span style={{ color: 'var(--text-3)', fontWeight: 400, fontSize: 13 }}>({violations.length} total)</span>}
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 32 }}>
          {recentViolations.length === 0 ? (
            <div style={{
              textAlign: 'center', padding: '32px 20px',
              color: 'var(--text-3)', fontSize: 13,
              border: '1px dashed var(--border)', borderRadius: 10,
            }}>
              No violations recorded. Keep following your rules! 🎯
            </div>
          ) : (
            recentViolations.map(v => (
              <ViolationRow key={v.id} v={v} onAck={handleAcknowledge} />
            ))
          )}
        </div>

        {/* ── Disclaimer ──────────────────────────────────────────────────── */}
        <div
          data-testid="disclaimer"
          style={{
            fontSize: 11, color: 'var(--text-3)', lineHeight: 1.6,
            padding: '14px 18px', borderRadius: 8,
            border: '1px solid var(--border)',
            background: 'var(--surface)',
          }}
        >
          ⚖️ <strong>Disclaimer:</strong> Trading rules are self-set guidelines for personal discipline. TradVue does not enforce, monitor, or guarantee compliance with any trading rules. This tool is for self-accountability only.
        </div>
      </main>

      {showAddModal && (
        <AddRuleModal onAdd={handleAddRule} onClose={() => setShowAddModal(false)} />
      )}
    </>
  )
}
