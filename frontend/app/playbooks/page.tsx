'use client'

import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import { getUserTier } from '../utils/tierAccess'
import AuthGate from '../components/AuthGate'
import PersistentNav from '../components/PersistentNav'
import {
  type Playbook,
  CATEGORY_COLORS,
  CATEGORY_LABELS,
  CATEGORIES,
  ASSET_TYPE_LABELS,
  loadPlaybooks,
  savePlaybooks,
  upsertPlaybook,
  deletePlaybook,
} from '../utils/playbookData'
import { DEFAULT_PLAYBOOKS } from '../utils/playbookDefaults'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function uid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

function getPlaybookStats(playbookId: string): {
  tradeCount: number
  winRate: number
  totalPnl: number
  avgPnl: number
  expectancy: number
} {
  try {
    const raw = localStorage.getItem('cg_journal_trades')
    if (!raw) return { tradeCount: 0, winRate: 0, totalPnl: 0, avgPnl: 0, expectancy: 0 }
    const trades: Array<{ playbookId?: string; pnl?: number }> = JSON.parse(raw)
    const tagged = trades.filter(t => t.playbookId === playbookId)
    if (tagged.length === 0) return { tradeCount: 0, winRate: 0, totalPnl: 0, avgPnl: 0, expectancy: 0 }
    const wins = tagged.filter(t => (t.pnl ?? 0) > 0)
    const winRate = wins.length / tagged.length
    const totalPnl = tagged.reduce((s, t) => s + (t.pnl ?? 0), 0)
    const avgPnl = totalPnl / tagged.length
    const avgWin = wins.length ? wins.reduce((s, t) => s + (t.pnl ?? 0), 0) / wins.length : 0
    const losses = tagged.filter(t => (t.pnl ?? 0) <= 0)
    const avgLoss = losses.length ? Math.abs(losses.reduce((s, t) => s + (t.pnl ?? 0), 0) / losses.length) : 0
    const expectancy = winRate * avgWin - (1 - winRate) * avgLoss
    return { tradeCount: tagged.length, winRate, totalPnl, avgPnl, expectancy }
  } catch {
    return { tradeCount: 0, winRate: 0, totalPnl: 0, avgPnl: 0, expectancy: 0 }
  }
}

// ─── Category Badge ───────────────────────────────────────────────────────────

function CategoryBadge({ category }: { category: Playbook['category'] }) {
  const color = CATEGORY_COLORS[category]
  return (
    <span style={{
      background: color + '22',
      color,
      border: `1px solid ${color}55`,
      borderRadius: 12,
      padding: '2px 8px',
      fontSize: 10,
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: '0.06em',
    }}>
      {CATEGORY_LABELS[category]}
    </span>
  )
}

// ─── Asset Type Badge ─────────────────────────────────────────────────────────

function AssetBadge({ type }: { type: string }) {
  return (
    <span style={{
      background: 'var(--bg-3)',
      color: 'var(--text-2)',
      border: '1px solid var(--border)',
      borderRadius: 10,
      padding: '2px 7px',
      fontSize: 10,
      fontWeight: 600,
    }}>
      {ASSET_TYPE_LABELS[type] ?? type}
    </span>
  )
}

// ─── Stat Chip ────────────────────────────────────────────────────────────────

function StatChip({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
      <span style={{ fontSize: 16, fontWeight: 800, color: color ?? 'var(--text-0)', fontFamily: 'var(--mono)' }}>{value}</span>
      <span style={{ fontSize: 10, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
    </div>
  )
}

// ─── Playbook Card ────────────────────────────────────────────────────────────

function PlaybookCard({ playbook, onClick }: { playbook: Playbook; onClick: () => void }) {
  const stats = useMemo(() => getPlaybookStats(playbook.id), [playbook.id])
  const previewRules = playbook.entryRules.slice(0, 3)

  return (
    <div
      onClick={onClick}
      style={{
        background: 'var(--bg-2)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: '18px 20px',
        cursor: 'pointer',
        transition: 'border-color 0.15s, transform 0.1s',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
      onMouseEnter={e => {
        const el = e.currentTarget
        el.style.borderColor = CATEGORY_COLORS[playbook.category] + '88'
        el.style.transform = 'translateY(-1px)'
      }}
      onMouseLeave={e => {
        const el = e.currentTarget
        el.style.borderColor = 'var(--border)'
        el.style.transform = 'translateY(0)'
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-0)', marginBottom: 6 }}>
            {playbook.name}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <CategoryBadge category={playbook.category} />
            {playbook.isDefault && (
              <span style={{ fontSize: 9, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 10, padding: '2px 6px' }}>
                Built-in
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Description */}
      <p style={{
        fontSize: 12,
        color: 'var(--text-2)',
        lineHeight: 1.55,
        margin: 0,
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
      }}>
        {playbook.description}
      </p>

      {/* Asset types */}
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
        {playbook.assetTypes.map(t => <AssetBadge key={t} type={t} />)}
      </div>

      {/* Stats row */}
      {stats.tradeCount > 0 && (
        <div style={{
          background: 'var(--bg-1)',
          borderRadius: 8,
          padding: '10px 0',
          display: 'flex',
          justifyContent: 'space-around',
        }}>
          <StatChip label="Trades" value={String(stats.tradeCount)} />
          <StatChip
            label="Win Rate"
            value={(stats.winRate * 100).toFixed(0) + '%'}
            color={stats.winRate >= 0.5 ? 'var(--green)' : 'var(--red)'}
          />
          <StatChip
            label="Total P&L"
            value={(stats.totalPnl >= 0 ? '+$' : '-$') + Math.abs(stats.totalPnl).toFixed(0)}
            color={stats.totalPnl >= 0 ? 'var(--green)' : 'var(--red)'}
          />
        </div>
      )}
      {stats.tradeCount === 0 && (
        <div style={{ fontSize: 11, color: 'var(--text-3)', fontStyle: 'italic' }}>
          No trades tagged yet
        </div>
      )}

      {/* Entry rules preview */}
      <div>
        <div style={{ fontSize: 10, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6, fontWeight: 700 }}>
          Entry Rules
        </div>
        <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {previewRules.map((rule, i) => (
            <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 11, color: 'var(--text-2)', lineHeight: 1.4 }}>
              <span style={{ color: CATEGORY_COLORS[playbook.category], fontWeight: 700, flexShrink: 0, marginTop: 1 }}>✓</span>
              <span>{rule}</span>
            </li>
          ))}
          {playbook.entryRules.length > 3 && (
            <li style={{ fontSize: 10, color: 'var(--text-3)', fontStyle: 'italic' }}>
              +{playbook.entryRules.length - 3} more rules…
            </li>
          )}
        </ul>
      </div>
    </div>
  )
}

// ─── Detail View ──────────────────────────────────────────────────────────────

function PlaybookDetail({
  playbook,
  onBack,
  onEdit,
  onDelete,
}: {
  playbook: Playbook
  onBack: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const stats = useMemo(() => getPlaybookStats(playbook.id), [playbook.id])
  const catColor = CATEGORY_COLORS[playbook.category]

  return (
    <div>
      {/* Back nav */}
      <button
        onClick={onBack}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--text-2)',
          fontSize: 13,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '0 0 16px 0',
        }}
      >
        ← Back to Playbooks
      </button>

      {/* Header card */}
      <div style={{
        background: 'var(--bg-2)',
        border: `1px solid ${catColor}44`,
        borderRadius: 12,
        padding: '24px 28px',
        marginBottom: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-0)', margin: '0 0 8px 0' }}>
              {playbook.name}
            </h1>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <CategoryBadge category={playbook.category} />
              {playbook.assetTypes.map(t => <AssetBadge key={t} type={t} />)}
              {playbook.isDefault && (
                <span style={{ fontSize: 9, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 10, padding: '2px 6px' }}>
                  Built-in Template
                </span>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={onEdit}
              style={{
                background: catColor + '22',
                border: `1px solid ${catColor}55`,
                borderRadius: 8,
                color: catColor,
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 600,
                padding: '7px 16px',
              }}
            >
              ✎ Edit
            </button>
            {!playbook.isDefault && (
              <button
                onClick={onDelete}
                style={{
                  background: 'var(--bg-3)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  color: 'var(--red)',
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: 600,
                  padding: '7px 16px',
                }}
              >
                Delete
              </button>
            )}
          </div>
        </div>

        <p style={{ fontSize: 14, color: 'var(--text-1)', lineHeight: 1.65, margin: 0 }}>
          {playbook.description}
        </p>
      </div>

      {/* Stats row */}
      {stats.tradeCount > 0 && (
        <div style={{
          background: 'var(--bg-2)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: '16px 24px',
          marginBottom: 16,
          display: 'flex',
          gap: 32,
          flexWrap: 'wrap',
        }}>
          <StatChip label="Trades" value={String(stats.tradeCount)} />
          <StatChip
            label="Win Rate"
            value={(stats.winRate * 100).toFixed(1) + '%'}
            color={stats.winRate >= 0.5 ? 'var(--green)' : 'var(--red)'}
          />
          <StatChip
            label="Total P&L"
            value={(stats.totalPnl >= 0 ? '+$' : '-$') + Math.abs(stats.totalPnl).toFixed(2)}
            color={stats.totalPnl >= 0 ? 'var(--green)' : 'var(--red)'}
          />
          <StatChip
            label="Avg P&L"
            value={(stats.avgPnl >= 0 ? '+$' : '-$') + Math.abs(stats.avgPnl).toFixed(2)}
            color={stats.avgPnl >= 0 ? 'var(--green)' : 'var(--red)'}
          />
          <StatChip
            label="Expectancy"
            value={(stats.expectancy >= 0 ? '+$' : '-$') + Math.abs(stats.expectancy).toFixed(2)}
            color={stats.expectancy >= 0 ? 'var(--green)' : 'var(--red)'}
          />
        </div>
      )}
      {stats.tradeCount === 0 && (
        <div style={{
          background: 'var(--bg-2)',
          border: '1px dashed var(--border)',
          borderRadius: 12,
          padding: '16px 24px',
          marginBottom: 16,
          fontSize: 13,
          color: 'var(--text-3)',
          textAlign: 'center',
        }}>
          No trades tagged with this playbook yet. Tag your trades in the Journal to see performance stats here.
        </div>
      )}

      {/* Rules & Conditions */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        {/* Entry rules */}
        <div style={{
          background: 'var(--bg-2)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: '20px 24px',
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--green)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
            ✓ Entry Rules
          </div>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {playbook.entryRules.map((rule, i) => (
              <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, color: 'var(--text-1)', lineHeight: 1.5 }}>
                <span style={{ background: 'var(--green)22', color: 'var(--green)', borderRadius: 4, width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, flexShrink: 0, marginTop: 1 }}>
                  {i + 1}
                </span>
                {rule}
              </li>
            ))}
          </ul>
        </div>

        {/* Exit rules */}
        <div style={{
          background: 'var(--bg-2)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: '20px 24px',
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--red)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
            ✗ Exit Rules
          </div>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {playbook.exitRules.map((rule, i) => (
              <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, color: 'var(--text-1)', lineHeight: 1.5 }}>
                <span style={{ background: 'var(--red)22', color: 'var(--red)', borderRadius: 4, width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, flexShrink: 0, marginTop: 1 }}>
                  {i + 1}
                </span>
                {rule}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Conditions + Risk */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div style={{
          background: 'var(--bg-2)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: '20px 24px',
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
            🌤 Ideal Market Conditions
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-1)', lineHeight: 1.6, margin: 0 }}>
            {playbook.idealConditions}
          </p>
        </div>

        <div style={{
          background: 'var(--bg-2)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: '20px 24px',
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--yellow)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
            ⚡ Risk Parameters
          </div>
          {playbook.riskParams.riskRewardTarget && (
            <div style={{ marginBottom: 8, fontSize: 13, color: 'var(--text-1)' }}>
              <span style={{ color: 'var(--text-3)', marginRight: 6 }}>R:R Target:</span>
              <strong>{playbook.riskParams.riskRewardTarget}</strong>
            </div>
          )}
          {playbook.riskParams.maxPositionSize !== undefined && (
            <div style={{ marginBottom: 8, fontSize: 13, color: 'var(--text-1)' }}>
              <span style={{ color: 'var(--text-3)', marginRight: 6 }}>Max Position Size:</span>
              <strong>${playbook.riskParams.maxPositionSize.toLocaleString()}</strong>
            </div>
          )}
          {playbook.riskParams.maxLossPerTrade !== undefined && (
            <div style={{ fontSize: 13, color: 'var(--text-1)' }}>
              <span style={{ color: 'var(--text-3)', marginRight: 6 }}>Max Loss/Trade:</span>
              <strong>${playbook.riskParams.maxLossPerTrade.toLocaleString()}</strong>
            </div>
          )}
          {!playbook.riskParams.riskRewardTarget && playbook.riskParams.maxPositionSize === undefined && playbook.riskParams.maxLossPerTrade === undefined && (
            <p style={{ fontSize: 13, color: 'var(--text-3)', fontStyle: 'italic', margin: 0 }}>
              No risk parameters set. Click Edit to add them.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Create/Edit Modal ────────────────────────────────────────────────────────

function PlaybookModal({
  playbook,
  onSave,
  onClose,
}: {
  playbook: Partial<Playbook> | null
  onSave: (p: Playbook) => void
  onClose: () => void
}) {
  const isNew = !playbook?.id
  const [name, setName] = useState(playbook?.name ?? '')
  const [description, setDescription] = useState(playbook?.description ?? '')
  const [category, setCategory] = useState<Playbook['category']>(playbook?.category ?? 'momentum')
  const [assetTypes, setAssetTypes] = useState<Playbook['assetTypes']>(playbook?.assetTypes ?? ['stock'])
  const [entryRules, setEntryRules] = useState<string[]>(playbook?.entryRules ?? [''])
  const [exitRules, setExitRules] = useState<string[]>(playbook?.exitRules ?? [''])
  const [idealConditions, setIdealConditions] = useState(playbook?.idealConditions ?? '')
  const [rrTarget, setRrTarget] = useState(playbook?.riskParams?.riskRewardTarget ?? '')
  const [maxPos, setMaxPos] = useState(playbook?.riskParams?.maxPositionSize?.toString() ?? '')
  const [maxLoss, setMaxLoss] = useState(playbook?.riskParams?.maxLossPerTrade?.toString() ?? '')

  const inputSx: React.CSSProperties = {
    background: 'var(--bg-1)',
    border: '1px solid var(--border)',
    borderRadius: 6,
    color: 'var(--text-0)',
    fontSize: 13,
    padding: '7px 10px',
    width: '100%',
    boxSizing: 'border-box',
    outline: 'none',
  }
  const labelSx: React.CSSProperties = {
    fontSize: 10,
    color: 'var(--text-3)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.06em',
    fontWeight: 700,
    marginBottom: 4,
    display: 'block',
  }

  const toggleAssetType = (t: 'stock' | 'futures' | 'options') => {
    setAssetTypes(prev =>
      prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]
    )
  }

  const updateEntry = (i: number, val: string) => {
    setEntryRules(r => r.map((x, idx) => idx === i ? val : x))
  }
  const updateExit = (i: number, val: string) => {
    setExitRules(r => r.map((x, idx) => idx === i ? val : x))
  }

  const handleSave = () => {
    if (!name.trim()) return
    const now = new Date().toISOString()
    const p: Playbook = {
      id: playbook?.id ?? uid(),
      name: name.trim(),
      description: description.trim(),
      category,
      assetTypes: assetTypes.length ? assetTypes : ['stock'],
      entryRules: entryRules.filter(r => r.trim()),
      exitRules: exitRules.filter(r => r.trim()),
      idealConditions: idealConditions.trim(),
      riskParams: {
        riskRewardTarget: rrTarget.trim() || undefined,
        maxPositionSize: maxPos ? parseFloat(maxPos) : undefined,
        maxLossPerTrade: maxLoss ? parseFloat(maxLoss) : undefined,
      },
      isDefault: playbook?.isDefault ?? false,
      createdAt: playbook?.createdAt ?? now,
      updatedAt: now,
    }
    onSave(p)
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.7)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        background: 'var(--bg-2)',
        border: '1px solid var(--border)',
        borderRadius: 14,
        width: '100%',
        maxWidth: 680,
        maxHeight: '90vh',
        overflowY: 'auto',
        padding: '28px 32px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: 'var(--text-0)' }}>
            {isNew ? '+ Create Playbook' : '✎ Edit Playbook'}
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-2)', fontSize: 18, lineHeight: 1, padding: 4 }}>✕</button>
        </div>

        {/* Name */}
        <div style={{ marginBottom: 16 }}>
          <label style={labelSx}>Playbook Name *</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. My ORB Setup" style={inputSx} />
        </div>

        {/* Category */}
        <div style={{ marginBottom: 16 }}>
          <label style={labelSx}>Category</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {CATEGORIES.map(cat => {
              const color = CATEGORY_COLORS[cat]
              const active = category === cat
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  style={{
                    background: active ? color + '22' : 'var(--bg-1)',
                    border: `1px solid ${active ? color + '88' : 'var(--border)'}`,
                    borderRadius: 8,
                    color: active ? color : 'var(--text-2)',
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: active ? 700 : 400,
                    padding: '5px 12px',
                  }}
                >
                  {CATEGORY_LABELS[cat]}
                </button>
              )
            })}
          </div>
        </div>

        {/* Asset types */}
        <div style={{ marginBottom: 16 }}>
          <label style={labelSx}>Asset Types</label>
          <div style={{ display: 'flex', gap: 10 }}>
            {(['stock', 'futures', 'options'] as const).map(t => (
              <label key={t} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13, color: 'var(--text-1)' }}>
                <input
                  type="checkbox"
                  checked={assetTypes.includes(t)}
                  onChange={() => toggleAssetType(t)}
                  style={{ cursor: 'pointer' }}
                />
                {ASSET_TYPE_LABELS[t]}
              </label>
            ))}
          </div>
        </div>

        {/* Description */}
        <div style={{ marginBottom: 16 }}>
          <label style={labelSx}>Description / Strategy Thesis</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Describe the strategy, why it works, and your edge..."
            rows={4}
            style={{ ...inputSx, resize: 'vertical', lineHeight: 1.55 }}
          />
        </div>

        {/* Entry rules */}
        <div style={{ marginBottom: 16 }}>
          <label style={labelSx}>Entry Rules</label>
          {entryRules.map((rule, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
              <input
                value={rule}
                onChange={e => updateEntry(i, e.target.value)}
                placeholder={`Entry rule ${i + 1}`}
                style={{ ...inputSx, flex: 1 }}
              />
              <button
                type="button"
                onClick={() => setEntryRules(r => r.filter((_, idx) => idx !== i))}
                style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--red)', cursor: 'pointer', fontSize: 13, padding: '0 8px' }}
              >✕</button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setEntryRules(r => [...r, ''])}
            style={{ background: 'var(--bg-1)', border: '1px dashed var(--border)', borderRadius: 6, color: 'var(--text-2)', cursor: 'pointer', fontSize: 12, padding: '6px 12px', marginTop: 2 }}
          >
            + Add Entry Rule
          </button>
        </div>

        {/* Exit rules */}
        <div style={{ marginBottom: 16 }}>
          <label style={labelSx}>Exit Rules</label>
          {exitRules.map((rule, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
              <input
                value={rule}
                onChange={e => updateExit(i, e.target.value)}
                placeholder={`Exit rule ${i + 1}`}
                style={{ ...inputSx, flex: 1 }}
              />
              <button
                type="button"
                onClick={() => setExitRules(r => r.filter((_, idx) => idx !== i))}
                style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--red)', cursor: 'pointer', fontSize: 13, padding: '0 8px' }}
              >✕</button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setExitRules(r => [...r, ''])}
            style={{ background: 'var(--bg-1)', border: '1px dashed var(--border)', borderRadius: 6, color: 'var(--text-2)', cursor: 'pointer', fontSize: 12, padding: '6px 12px', marginTop: 2 }}
          >
            + Add Exit Rule
          </button>
        </div>

        {/* Ideal conditions */}
        <div style={{ marginBottom: 16 }}>
          <label style={labelSx}>Ideal Market Conditions</label>
          <textarea
            value={idealConditions}
            onChange={e => setIdealConditions(e.target.value)}
            placeholder="e.g. Trending day, high relative volume, first 30 min of session..."
            rows={2}
            style={{ ...inputSx, resize: 'vertical' }}
          />
        </div>

        {/* Risk params */}
        <div style={{ marginBottom: 24 }}>
          <label style={labelSx}>Risk Parameters (optional)</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <div>
              <label style={{ ...labelSx, fontSize: 9 }}>R:R Target</label>
              <input value={rrTarget} onChange={e => setRrTarget(e.target.value)} placeholder="e.g. 2:1" style={inputSx} />
            </div>
            <div>
              <label style={{ ...labelSx, fontSize: 9 }}>Max Position Size ($)</label>
              <input type="number" value={maxPos} onChange={e => setMaxPos(e.target.value)} placeholder="e.g. 5000" step="100" style={inputSx} />
            </div>
            <div>
              <label style={{ ...labelSx, fontSize: 9 }}>Max Loss/Trade ($)</label>
              <input type="number" value={maxLoss} onChange={e => setMaxLoss(e.target.value)} placeholder="e.g. 200" step="10" style={inputSx} />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-2)', cursor: 'pointer', fontSize: 13, padding: '9px 20px' }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim()}
            style={{
              background: name.trim() ? 'var(--accent)' : 'var(--bg-3)',
              border: 'none',
              borderRadius: 8,
              color: name.trim() ? '#0a0a0c' : 'var(--text-3)',
              cursor: name.trim() ? 'pointer' : 'not-allowed',
              fontSize: 13,
              fontWeight: 700,
              padding: '9px 24px',
            }}
          >
            {isNew ? 'Create Playbook' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PlaybooksPage() {
  const { user } = useAuth()
  const [playbooks, setPlaybooks] = useState<Playbook[]>([])
  const [selected, setSelected] = useState<Playbook | null>(null)
  const [editing, setEditing] = useState<Partial<Playbook> | null>(null)
  const [filterCat, setFilterCat] = useState<Playbook['category'] | 'all'>('all')

  // Load or initialize playbooks on mount
  useEffect(() => {
    const existing = loadPlaybooks()
    if (existing.length > 0) {
      setPlaybooks(existing)
    } else {
      savePlaybooks(DEFAULT_PLAYBOOKS)
      setPlaybooks(DEFAULT_PLAYBOOKS)
    }
  }, [])

  const filtered = useMemo(() =>
    filterCat === 'all' ? playbooks : playbooks.filter(p => p.category === filterCat),
    [playbooks, filterCat]
  )

  const handleSave = (p: Playbook) => {
    upsertPlaybook(p)
    setPlaybooks(loadPlaybooks())
    setEditing(null)
    setSelected(p)
  }

  const handleDelete = (id: string) => {
    if (!confirm('Delete this playbook? This cannot be undone.')) return
    deletePlaybook(id)
    setPlaybooks(loadPlaybooks())
    setSelected(null)
  }

  // Auth gating — demo/unauthenticated users see a sign-in prompt
  const tier = getUserTier(user)
  if (tier === 'demo') {
    return (
      <AuthGate
        featureName="Trade Playbooks"
        featureDesc="Define your strategies, tag your trades, and track what works. Create a free account to get started."
      >
        <div style={{ minHeight: '100vh', background: 'var(--bg-0)', color: 'var(--text-0)' }}>
          <PersistentNav />
          <div style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 20px' }}>
            <h1 style={{ fontSize: 24, fontWeight: 800 }}>Playbook Templates</h1>
          </div>
        </div>
      </AuthGate>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-0)', color: 'var(--text-0)' }}>
      <PersistentNav />

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 20px' }}>

        {selected ? (
          <PlaybookDetail
            playbook={selected}
            onBack={() => setSelected(null)}
            onEdit={() => setEditing(selected)}
            onDelete={() => handleDelete(selected.id)}
          />
        ) : (
          <>
            {/* Page header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
              <div>
                <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-0)', margin: '0 0 4px 0' }}>
                  Playbook Templates
                </h1>
                <p style={{ fontSize: 13, color: 'var(--text-2)', margin: 0 }}>
                  Define your strategies. Tag trades. Track what works.
                </p>
              </div>
              <button
                onClick={() => setEditing({})}
                style={{
                  background: 'var(--accent)',
                  border: 'none',
                  borderRadius: 8,
                  color: '#0a0a0c',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: 700,
                  padding: '10px 20px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                + Create Playbook
              </button>
            </div>

            {/* Pro notice */}
            <div style={{
              background: 'var(--accent)11',
              border: '1px solid var(--accent)33',
              borderRadius: 10,
              padding: '10px 16px',
              marginBottom: 20,
              fontSize: 12,
              color: 'var(--text-2)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}>
              <span style={{ color: 'var(--accent)', fontWeight: 700 }}>PRO</span>
              All playbook features included with Pro. Free during your trial — create unlimited custom playbooks, tag trades, and track performance.
            </div>

            {/* Category filter */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
              <button
                onClick={() => setFilterCat('all')}
                style={{
                  background: filterCat === 'all' ? 'var(--accent)' : 'var(--bg-2)',
                  border: `1px solid ${filterCat === 'all' ? 'var(--accent)' : 'var(--border)'}`,
                  borderRadius: 20,
                  color: filterCat === 'all' ? '#0a0a0c' : 'var(--text-2)',
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: filterCat === 'all' ? 700 : 400,
                  padding: '5px 14px',
                }}
              >
                All ({playbooks.length})
              </button>
              {CATEGORIES.map(cat => {
                const count = playbooks.filter(p => p.category === cat).length
                if (count === 0) return null
                const color = CATEGORY_COLORS[cat]
                const active = filterCat === cat
                return (
                  <button
                    key={cat}
                    onClick={() => setFilterCat(cat)}
                    style={{
                      background: active ? color + '22' : 'var(--bg-2)',
                      border: `1px solid ${active ? color + '88' : 'var(--border)'}`,
                      borderRadius: 20,
                      color: active ? color : 'var(--text-2)',
                      cursor: 'pointer',
                      fontSize: 12,
                      fontWeight: active ? 700 : 400,
                      padding: '5px 14px',
                    }}
                  >
                    {CATEGORY_LABELS[cat]} ({count})
                  </button>
                )
              })}
            </div>

            {/* Grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
              gap: 16,
            }}>
              {filtered.map(p => (
                <PlaybookCard
                  key={p.id}
                  playbook={p}
                  onClick={() => setSelected(p)}
                />
              ))}
              {filtered.length === 0 && (
                <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '60px 20px', color: 'var(--text-3)', fontSize: 14 }}>
                  No playbooks in this category yet.
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Create/Edit Modal */}
      {editing !== null && (
        <PlaybookModal
          playbook={editing}
          onSave={handleSave}
          onClose={() => setEditing(null)}
        />
      )}

      {/* ── Disclaimer ─────────────────────────────────────────────────────── */}
      <div style={{ padding: '12px 24px', borderTop: '1px solid var(--border)', marginTop: 16 }}>
        <p style={{ fontSize: 11, color: 'var(--text-3)', margin: 0, lineHeight: 1.5 }}>
          ⚠️ Strategy templates are for educational purposes only and do not constitute trading advice. Past performance of any strategy does not guarantee future results. Always do your own research before trading.
        </p>
      </div>
    </div>
  )
}
