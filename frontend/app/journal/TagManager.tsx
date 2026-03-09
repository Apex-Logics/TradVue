'use client'

import { useState, useRef, useEffect } from 'react'
import { IconTag, IconPlus, IconClose } from '../components/Icons'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TagDefinition {
  id: string
  name: string
  category: 'setup_type' | 'mistake' | 'strategy'
  color: string
  isPreset: boolean
}

export interface TradeTagState {
  setup_types: string[]   // tag names
  mistakes: string[]
  strategies: string[]
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  setup_type: '#6366f1',
  mistake: '#f59e0b',
  strategy: '#10b981',
}

const CATEGORY_LABELS: Record<string, string> = {
  setup_type: 'Setup Type',
  mistake: 'Mistake',
  strategy: 'Strategy',
}

export const PRESET_TAGS: TagDefinition[] = [
  // Setup Types
  { id: 'st-breakout', name: 'Breakout', category: 'setup_type', color: '#6366f1', isPreset: true },
  { id: 'st-pullback', name: 'Pullback', category: 'setup_type', color: '#6366f1', isPreset: true },
  { id: 'st-reversal', name: 'Reversal', category: 'setup_type', color: '#6366f1', isPreset: true },
  { id: 'st-trendfollow', name: 'Trend Follow', category: 'setup_type', color: '#6366f1', isPreset: true },
  { id: 'st-gapfill', name: 'Gap Fill', category: 'setup_type', color: '#6366f1', isPreset: true },
  { id: 'st-vwap', name: 'VWAP Bounce', category: 'setup_type', color: '#6366f1', isPreset: true },
  { id: 'st-sr', name: 'Support/Resistance', category: 'setup_type', color: '#6366f1', isPreset: true },
  { id: 'st-momentum', name: 'Momentum', category: 'setup_type', color: '#6366f1', isPreset: true },
  { id: 'st-earnings', name: 'Earnings Play', category: 'setup_type', color: '#6366f1', isPreset: true },
  { id: 'st-scalp', name: 'Scalp', category: 'setup_type', color: '#6366f1', isPreset: true },
  { id: 'st-swing', name: 'Swing', category: 'setup_type', color: '#6366f1', isPreset: true },
  { id: 'st-news', name: 'News Catalyst', category: 'setup_type', color: '#6366f1', isPreset: true },
  { id: 'st-pattern', name: 'Technical Pattern', category: 'setup_type', color: '#6366f1', isPreset: true },
  // Mistakes
  { id: 'mk-fomo', name: 'FOMO', category: 'mistake', color: '#f59e0b', isPreset: true },
  { id: 'mk-oversize', name: 'Oversize', category: 'mistake', color: '#f59e0b', isPreset: true },
  { id: 'mk-earlyexit', name: 'Early Exit', category: 'mistake', color: '#f59e0b', isPreset: true },
  { id: 'mk-lateentry', name: 'Late Entry', category: 'mistake', color: '#f59e0b', isPreset: true },
  { id: 'mk-revenge', name: 'Revenge Trade', category: 'mistake', color: '#f59e0b', isPreset: true },
  { id: 'mk-nostop', name: 'No Stop Loss', category: 'mistake', color: '#f59e0b', isPreset: true },
  { id: 'mk-chasing', name: 'Chasing', category: 'mistake', color: '#f59e0b', isPreset: true },
  { id: 'mk-held', name: 'Held Too Long', category: 'mistake', color: '#f59e0b', isPreset: true },
  { id: 'mk-ignored', name: 'Ignored Signal', category: 'mistake', color: '#f59e0b', isPreset: true },
  { id: 'mk-rr', name: 'Poor Risk/Reward', category: 'mistake', color: '#f59e0b', isPreset: true },
  { id: 'mk-overtrade', name: 'Overtrade', category: 'mistake', color: '#f59e0b', isPreset: true },
  // Strategies
  { id: 'sg-daytrade', name: 'Day Trade', category: 'strategy', color: '#10b981', isPreset: true },
  { id: 'sg-swing', name: 'Swing Trade', category: 'strategy', color: '#10b981', isPreset: true },
  { id: 'sg-position', name: 'Position Trade', category: 'strategy', color: '#10b981', isPreset: true },
  { id: 'sg-scalping', name: 'Scalping', category: 'strategy', color: '#10b981', isPreset: true },
  { id: 'sg-meanrev', name: 'Mean Reversion', category: 'strategy', color: '#10b981', isPreset: true },
  { id: 'sg-momentum', name: 'Momentum', category: 'strategy', color: '#10b981', isPreset: true },
  { id: 'sg-optionsell', name: 'Options Selling', category: 'strategy', color: '#10b981', isPreset: true },
  { id: 'sg-earnings', name: 'Earnings', category: 'strategy', color: '#10b981', isPreset: true },
]

// ─── Storage ──────────────────────────────────────────────────────────────────

const CUSTOM_TAGS_KEY = 'cg_journal_custom_tags'

export function loadCustomTags(): TagDefinition[] {
  try {
    const raw = localStorage.getItem(CUSTOM_TAGS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

export function saveCustomTags(tags: TagDefinition[]) {
  localStorage.setItem(CUSTOM_TAGS_KEY, JSON.stringify(tags))
}

export function getAllTags(customTags: TagDefinition[]): TagDefinition[] {
  return [...PRESET_TAGS, ...customTags]
}

export function getTagsByCategory(customTags: TagDefinition[], category: TagDefinition['category']): TagDefinition[] {
  return getAllTags(customTags).filter(t => t.category === category)
}

// ─── TagChip ──────────────────────────────────────────────────────────────────

export function TagChip({ tag, onRemove, size = 'normal' }: {
  tag: TagDefinition | string
  onRemove?: () => void
  size?: 'small' | 'normal'
}) {
  const tagDef = typeof tag === 'string'
    ? { name: tag, color: '#6366f1', category: 'setup_type' as const }
    : tag
  
  const padding = size === 'small' ? '1px 6px' : '3px 10px'
  const fontSize = size === 'small' ? 10 : 11

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      background: tagDef.color + '20',
      color: tagDef.color,
      border: `1px solid ${tagDef.color}33`,
      borderRadius: 6, padding, fontSize, fontWeight: 600,
      whiteSpace: 'nowrap',
    }}>
      {tagDef.name}
      {onRemove && (
        <button onClick={(e) => { e.stopPropagation(); onRemove() }} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: tagDef.color, padding: 0, lineHeight: 1, fontSize: fontSize + 2,
          display: 'flex', alignItems: 'center',
        }}>×</button>
      )}
    </span>
  )
}

// ─── Multi-Select Tag Picker ─────────────────────────────────────────────────

export function TagPicker({ category, selected, onChange, customTags, onAddCustomTag }: {
  category: TagDefinition['category']
  selected: string[]
  onChange: (tags: string[]) => void
  customTags: TagDefinition[]
  onAddCustomTag: (tag: TagDefinition) => void
}) {
  const [open, setOpen] = useState(false)
  const [newTagName, setNewTagName] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  const allTags = getTagsByCategory(customTags, category)
  const color = CATEGORY_COLORS[category]
  const label = CATEGORY_LABELS[category]

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const toggle = (name: string) => {
    if (selected.includes(name)) onChange(selected.filter(t => t !== name))
    else onChange([...selected, name])
  }

  const addCustom = () => {
    const name = newTagName.trim()
    if (!name || allTags.some(t => t.name.toLowerCase() === name.toLowerCase())) return
    const tag: TagDefinition = {
      id: `custom-${category}-${Date.now()}`,
      name,
      category,
      color,
      isPreset: false,
    }
    onAddCustomTag(tag)
    onChange([...selected, name])
    setNewTagName('')
  }

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <label style={{
        display: 'flex', alignItems: 'center', gap: 4,
        fontSize: 11, fontWeight: 600, color: 'var(--text-2)',
        marginBottom: 4, letterSpacing: '0.06em', textTransform: 'uppercase',
      }}>
        <IconTag size={12} style={{ color }} /> {label}
      </label>

      {/* Selected chips + add button */}
      <div onClick={() => setOpen(true)} style={{
        minHeight: 38, padding: '6px 10px',
        background: 'var(--bg-1)', border: `1px solid ${open ? color : 'var(--border)'}`,
        borderRadius: 8, cursor: 'pointer',
        display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center',
        transition: 'border-color 0.15s',
      }}>
        {selected.length === 0 && (
          <span style={{ fontSize: 12, color: 'var(--text-2)' }}>Click to add {label.toLowerCase()}s...</span>
        )}
        {selected.map(name => {
          const tag = allTags.find(t => t.name === name)
          return <TagChip key={name} tag={tag || name} onRemove={() => toggle(name)} size="small" />
        })}
      </div>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
          background: 'var(--bg-2)', border: '1px solid var(--border)',
          borderRadius: 10, marginTop: 4, padding: 8,
          boxShadow: '0 8px 24px rgba(0,0,0,0.3)', maxHeight: 240, overflowY: 'auto',
        }}>
          {/* Existing tags */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
            {allTags.map(tag => {
              const isSelected = selected.includes(tag.name)
              return (
                <button key={tag.id} onClick={() => toggle(tag.name)} style={{
                  background: isSelected ? color + '25' : 'var(--bg-1)',
                  border: `1px solid ${isSelected ? color : 'var(--border)'}`,
                  borderRadius: 6, padding: '4px 10px', fontSize: 11,
                  color: isSelected ? color : 'var(--text-1)',
                  cursor: 'pointer', fontWeight: isSelected ? 700 : 400,
                  transition: 'all 0.1s',
                }}>
                  {isSelected && '✓ '}{tag.name}
                </button>
              )
            })}
          </div>

          {/* Create custom */}
          <div style={{ display: 'flex', gap: 6, borderTop: '1px solid var(--border)', paddingTop: 8 }}>
            <input
              type="text"
              value={newTagName}
              onChange={e => setNewTagName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addCustom() }}
              placeholder={`New ${label.toLowerCase()}...`}
              style={{
                flex: 1, background: 'var(--bg-1)', border: '1px solid var(--border)',
                borderRadius: 6, padding: '6px 10px', fontSize: 11,
                color: 'var(--text-0)', outline: 'none',
              }}
            />
            <button onClick={addCustom} disabled={!newTagName.trim()} style={{
              background: newTagName.trim() ? color : 'var(--bg-1)',
              border: 'none', borderRadius: 6, padding: '6px 10px',
              color: newTagName.trim() ? '#fff' : 'var(--text-2)',
              fontSize: 11, fontWeight: 600, cursor: newTagName.trim() ? 'pointer' : 'not-allowed',
              display: 'flex', alignItems: 'center', gap: 4,
            }}>
              <IconPlus size={12} /> Add
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Tag Filter Bar (for trade list filtering) ───────────────────────────────

export function TagFilterBar({ customTags, activeFilters, onChange }: {
  customTags: TagDefinition[]
  activeFilters: { setup_types: string[]; mistakes: string[]; strategies: string[] }
  onChange: (filters: { setup_types: string[]; mistakes: string[]; strategies: string[] }) => void
}) {
  const hasFilters = activeFilters.setup_types.length > 0 || activeFilters.mistakes.length > 0 || activeFilters.strategies.length > 0

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      <span style={{ fontSize: 11, color: 'var(--text-2)', fontWeight: 600 }}>
        <IconTag size={12} /> TAGS:
      </span>
      
      {(['setup_type', 'mistake', 'strategy'] as const).map(cat => {
        const tags = getTagsByCategory(customTags, cat)
        const key = cat === 'setup_type' ? 'setup_types' : cat === 'mistake' ? 'mistakes' : 'strategies'
        const active = activeFilters[key]
        
        return (
          <div key={cat} style={{ position: 'relative' }}>
            <select
              value=""
              onChange={e => {
                const val = e.target.value
                if (!val) return
                const updated = active.includes(val) ? active.filter(t => t !== val) : [...active, val]
                onChange({ ...activeFilters, [key]: updated })
              }}
              style={{
                background: active.length > 0 ? CATEGORY_COLORS[cat] + '15' : 'var(--bg-1)',
                border: `1px solid ${active.length > 0 ? CATEGORY_COLORS[cat] + '44' : 'var(--border)'}`,
                borderRadius: 6, padding: '4px 8px', fontSize: 11,
                color: 'var(--text-1)', cursor: 'pointer', outline: 'none',
              }}
            >
              <option value="">{CATEGORY_LABELS[cat]} {active.length > 0 ? `(${active.length})` : ''}</option>
              {tags.map(t => (
                <option key={t.id} value={t.name}>{active.includes(t.name) ? '✓ ' : ''}{t.name}</option>
              ))}
            </select>
          </div>
        )
      })}

      {/* Active filter chips */}
      {hasFilters && (
        <>
          {Object.entries(activeFilters).flatMap(([key, names]) =>
            (names as string[]).map(name => {
              const cat = key === 'setup_types' ? 'setup_type' : key === 'mistakes' ? 'mistake' : 'strategy'
              const tag = getAllTags(customTags).find(t => t.name === name && t.category === cat)
              return (
                <TagChip
                  key={`${key}-${name}`}
                  tag={tag || { name, color: CATEGORY_COLORS[cat], category: cat, id: '', isPreset: false }}
                  onRemove={() => {
                    onChange({ ...activeFilters, [key]: (activeFilters[key as keyof typeof activeFilters] as string[]).filter(t => t !== name) })
                  }}
                  size="small"
                />
              )
            })
          )}
          <button onClick={() => onChange({ setup_types: [], mistakes: [], strategies: [] })} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-2)', fontSize: 10, padding: '2px 6px',
          }}>Clear all</button>
        </>
      )}
    </div>
  )
}
