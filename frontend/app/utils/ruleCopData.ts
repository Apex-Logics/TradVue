// ─── AI Rule Cop Data Model ───────────────────────────────────────────────────
// All data stays client-side — zero network calls, localStorage only.

export type RuleType =
  | 'max_trades_per_day'
  | 'max_loss_per_day'
  | 'max_loss_per_trade'
  | 'max_position_size'
  | 'max_consecutive_losses'
  | 'no_trading_after_time'
  | 'min_risk_reward'
  | 'max_daily_profit'
  | 'no_revenge_trading'
  | 'custom'

export interface TradingRule {
  id: string
  name: string
  type: RuleType
  enabled: boolean
  value: number | string   // threshold value
  description: string
  createdAt: string
}

export interface RuleViolation {
  id: string
  ruleId: string
  ruleName: string
  tradeId?: string
  date: string             // YYYY-MM-DD
  details: string          // e.g. "You set a limit of 5 trades/day. Today: 6 trades."
  severity: 'warning' | 'violation'
  acknowledged: boolean
  createdAt: string
}

export interface RuleCopSettings {
  rules: TradingRule[]
  violations: RuleViolation[]
  lastChecked: string
}

// ─── Storage ──────────────────────────────────────────────────────────────────

export const RULE_COP_KEY = 'cg_rulecop'

export function loadRuleCopSettings(): RuleCopSettings {
  try {
    if (typeof window === 'undefined') return getEmptySettings()
    const raw = localStorage.getItem(RULE_COP_KEY)
    return raw ? JSON.parse(raw) : getEmptySettings()
  } catch {
    return getEmptySettings()
  }
}

export function saveRuleCopSettings(settings: RuleCopSettings): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(RULE_COP_KEY, JSON.stringify(settings))
}

function getEmptySettings(): RuleCopSettings {
  return {
    rules: [],
    violations: [],
    lastChecked: new Date().toISOString(),
  }
}

export function upsertRule(rule: TradingRule): void {
  const settings = loadRuleCopSettings()
  const idx = settings.rules.findIndex(r => r.id === rule.id)
  if (idx >= 0) {
    settings.rules[idx] = rule
  } else {
    settings.rules.push(rule)
  }
  saveRuleCopSettings(settings)
}

export function deleteRule(ruleId: string): void {
  const settings = loadRuleCopSettings()
  settings.rules = settings.rules.filter(r => r.id !== ruleId)
  saveRuleCopSettings(settings)
}

export function acknowledgeViolation(violationId: string): void {
  const settings = loadRuleCopSettings()
  const v = settings.violations.find(v => v.id === violationId)
  if (v) v.acknowledged = true
  saveRuleCopSettings(settings)
}

export function saveViolations(violations: RuleViolation[]): void {
  const settings = loadRuleCopSettings()
  // Merge new violations, avoiding duplicates by id
  const existingIds = new Set(settings.violations.map(v => v.id))
  const newOnes = violations.filter(v => !existingIds.has(v.id))
  settings.violations = [...settings.violations, ...newOnes]
  settings.lastChecked = new Date().toISOString()
  saveRuleCopSettings(settings)
}
