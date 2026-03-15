/**
 * PropFirmData — Data model and localStorage helpers for Prop Firm Tracker
 * localStorage key: cg_propfirm_accounts (cg_ = legacy prefix, kept for consistency)
 */

// ─── Types ────────────────────────────────────────────────────────────────────

// Verified firms only (March 2026). See propFirmPresets.ts for verification notes.
// Removed: ftmo (forex only), apex (unverified), tpt (amounts unverified),
//          bulenox (amounts unverified), tradeday (amounts unverified),
//          alphafutures (website too sparse), alphafunded (hidden terms),
//          lucidpro/luciddirect (amounts not yet verified)
export type FirmId =
  | 'topstep'     // Verified: $50K/$100K/$150K, trailing EOD, min 0 days
  | '5ers'        // Verified: $25K futures, 3% static, 6%/4% targets
  | 'mff'         // Verified: $50K Rapid, $3K profit, $2K EOD, no DLL, min 2 days
  | 'earn2trade'  // Verified: $50K-$200K, all 4 sizes with exact amounts, min 10 days
  | 'leeloo'      // Verified: $25K/$75K/$100K Foundation, trailing, no DLL, min 10 days
  | 'fundednext'  // Verified: $25K/$50K/$100K Rapid, trailing EOD, no DLL
  | 'lucidflex'   // Verified: $25K-$150K, EOD trailing, NO DLL (eval & funded)
  | 'tradeify'    // Verified: $150K Standard, $9K profit, $4.5K EOD, min 4 days
  | 'custom'
export type PhaseId = 'phase1' | 'phase2' | 'funded' | 'payout'
export type AccountStatus = 'active' | 'passed' | 'failed' | 'withdrawn'
export type DrawdownType = 'static' | 'trailing'

export interface PropFirmRules {
  maxDrawdown: {
    type: DrawdownType
    limit: number       // dollar amount
    current: number     // current drawdown used (positive = loss)
  }
  dailyLossLimit: {
    limit: number       // dollar amount (0 = no limit)
    todayPnl: number    // today's running P&L
  }
  profitTarget: {
    target: number      // dollar amount
    currentPnl: number  // cumulative P&L toward target
  }
  maxContracts?: number
  minTradingDays?: number
  tradingDaysCompleted?: number
  maxDailyProfit?: number
  newsTrading?: boolean // false = news trading restricted
}

export interface PropFirmAccount {
  id: string
  firm: FirmId
  accountName: string   // user label e.g. "FTMO 100K Phase 1"
  accountSize: number   // e.g. 100000
  phase: PhaseId
  status: AccountStatus
  rules: PropFirmRules
  trades: string[]      // linked trade IDs from journal
  createdAt: string
  updatedAt: string
}

// ─── Storage ──────────────────────────────────────────────────────────────────

const PROP_FIRM_KEY = 'cg_propfirm_accounts'

export function loadPropFirmAccounts(): PropFirmAccount[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(PROP_FIRM_KEY)
    if (!raw) return []
    return JSON.parse(raw) as PropFirmAccount[]
  } catch {
    return []
  }
}

export function savePropFirmAccounts(accounts: PropFirmAccount[]): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(PROP_FIRM_KEY, JSON.stringify(accounts))
  } catch {
    // Ignore storage errors
  }
}

export function addPropFirmAccount(account: Omit<PropFirmAccount, 'id' | 'createdAt' | 'updatedAt'>): PropFirmAccount {
  const now = new Date().toISOString()
  const newAccount: PropFirmAccount = {
    ...account,
    id: `pf_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    createdAt: now,
    updatedAt: now,
  }
  const accounts = loadPropFirmAccounts()
  accounts.push(newAccount)
  savePropFirmAccounts(accounts)
  return newAccount
}

export function updatePropFirmAccount(id: string, updates: Partial<PropFirmAccount>): PropFirmAccount | null {
  const accounts = loadPropFirmAccounts()
  const idx = accounts.findIndex(a => a.id === id)
  if (idx === -1) return null
  const updated: PropFirmAccount = {
    ...accounts[idx],
    ...updates,
    id,
    updatedAt: new Date().toISOString(),
  }
  accounts[idx] = updated
  savePropFirmAccounts(accounts)
  return updated
}

export function deletePropFirmAccount(id: string): boolean {
  const accounts = loadPropFirmAccounts()
  const filtered = accounts.filter(a => a.id !== id)
  if (filtered.length === accounts.length) return false
  savePropFirmAccounts(filtered)
  return true
}

// ─── Derived Calculations ─────────────────────────────────────────────────────

/** Returns drawdown used as a percentage (0-100+) */
export function getDrawdownUsedPct(rules: PropFirmRules): number {
  if (rules.maxDrawdown.limit === 0) return 0
  return (rules.maxDrawdown.current / rules.maxDrawdown.limit) * 100
}

/** Returns profit progress as a percentage (0-100) */
export function getProfitPct(rules: PropFirmRules): number {
  if (rules.profitTarget.target === 0) return 0
  return Math.min((rules.profitTarget.currentPnl / rules.profitTarget.target) * 100, 100)
}

/** Returns daily loss used as a percentage (0-100+) */
export function getDailyLossPct(rules: PropFirmRules): number {
  if (rules.dailyLossLimit.limit === 0) return 0
  const loss = -rules.dailyLossLimit.todayPnl // positive when losing
  return Math.max((loss / rules.dailyLossLimit.limit) * 100, 0)
}

/** Returns color for drawdown gauge based on % used */
export function getDrawdownColor(pctUsed: number): string {
  if (pctUsed >= 90) return '#ff4560'  // var(--red)
  if (pctUsed >= 80) return '#f97316'  // orange
  if (pctUsed >= 60) return '#f0a500'  // var(--yellow)
  return '#00c06a'                     // var(--green)
}

/** Returns phase label */
export function getPhaseLabel(phase: PhaseId): string {
  const labels: Record<PhaseId, string> = {
    phase1: 'Phase 1',
    phase2: 'Phase 2',
    funded: 'Funded',
    payout: 'Payout',
  }
  return labels[phase] ?? phase
}

/** Returns status label */
export function getStatusLabel(status: AccountStatus): string {
  const labels: Record<AccountStatus, string> = {
    active: 'Active',
    passed: 'Passed',
    failed: 'Failed',
    withdrawn: 'Withdrawn',
  }
  return labels[status] ?? status
}

/** Returns status color */
export function getStatusColor(status: AccountStatus): string {
  switch (status) {
    case 'active': return '#4a9eff'   // var(--accent)
    case 'passed': return '#00c06a'   // var(--green)
    case 'failed': return '#ff4560'   // var(--red)
    case 'withdrawn': return '#a0a0b0' // var(--text-1)
  }
}
