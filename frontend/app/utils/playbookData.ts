// ─── Playbook Data Model ─────────────────────────────────────────────────────

export interface Playbook {
  id: string
  name: string
  description: string
  category: 'momentum' | 'reversal' | 'breakout' | 'scalp' | 'swing' | 'options' | 'custom'
  assetTypes: ('stock' | 'futures' | 'options')[]
  entryRules: string[]
  exitRules: string[]
  idealConditions: string
  riskParams: {
    maxPositionSize?: number
    maxLossPerTrade?: number
    riskRewardTarget?: string
  }
  isDefault: boolean
  createdAt: string
  updatedAt: string
}

export const PLAYBOOK_STORAGE_KEY = 'cg_playbooks'

export function loadPlaybooks(): Playbook[] {
  try {
    const raw = localStorage.getItem(PLAYBOOK_STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function savePlaybooks(playbooks: Playbook[]): void {
  localStorage.setItem(PLAYBOOK_STORAGE_KEY, JSON.stringify(playbooks))
}

export function initPlaybooks(defaults: Playbook[]): Playbook[] {
  const existing = loadPlaybooks()
  if (existing.length > 0) return existing
  savePlaybooks(defaults)
  return defaults
}

export function upsertPlaybook(playbook: Playbook): Playbook[] {
  const all = loadPlaybooks()
  const idx = all.findIndex(p => p.id === playbook.id)
  if (idx >= 0) {
    all[idx] = playbook
  } else {
    all.push(playbook)
  }
  savePlaybooks(all)
  return all
}

export function deletePlaybook(id: string): Playbook[] {
  const all = loadPlaybooks().filter(p => p.id !== id)
  savePlaybooks(all)
  return all
}

// Category badge colors
export const CATEGORY_COLORS: Record<Playbook['category'], string> = {
  momentum: '#3b82f6',
  reversal:  '#a855f7',
  breakout:  '#22c55e',
  scalp:     '#f97316',
  swing:     '#14b8a6',
  options:   '#ec4899',
  custom:    '#6b7280',
}

// Category labels (title-case)
export const CATEGORY_LABELS: Record<Playbook['category'], string> = {
  momentum: 'Momentum',
  reversal:  'Reversal',
  breakout:  'Breakout',
  scalp:     'Scalp',
  swing:     'Swing',
  options:   'Options',
  custom:    'Custom',
}

export const CATEGORIES: Playbook['category'][] = [
  'momentum', 'reversal', 'breakout', 'scalp', 'swing', 'options', 'custom',
]

export const ASSET_TYPE_LABELS: Record<string, string> = {
  stock:   'Stock',
  futures: 'Futures',
  options: 'Options',
}
