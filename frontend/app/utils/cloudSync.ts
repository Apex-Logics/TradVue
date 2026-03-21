/**
 * cloudSync.ts — localStorage ↔ cloud sync utility for TradVue
 *
 * Simple model:
 *   - Cloud is the source of truth, always.
 *   - Login / page load  → pull from cloud → overwrite localStorage.
 *   - User change        → push full local state to cloud.
 *   - forceSyncFromCloud → manual pull (same as login).
 *
 * No timestamp comparisons. No conflict resolution. Just push and pull.
 * Fails silently — localStorage-only flow always works.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://tradvue-api.onrender.com'

// ── Sync status (module-level, subscribable) ──────────────────────────────────

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error' | 'local-only'

let _status: SyncStatus = 'idle'
const _listeners = new Set<(s: SyncStatus) => void>()

function setStatus(s: SyncStatus) {
  _status = s
  _listeners.forEach(fn => fn(s))
}

export function getSyncStatus(): SyncStatus {
  return _status
}

export function subscribeSyncStatus(fn: (s: SyncStatus) => void): () => void {
  _listeners.add(fn)
  return () => _listeners.delete(fn)
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getToken(): string | null {
  try { return localStorage.getItem('cg_token') } catch { return null }
}

function authHeaders(token: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  }
}

function lsGet<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function lsSet<T>(key: string, val: T): void {
  try { localStorage.setItem(key, JSON.stringify(val)) } catch {}
}

// ── Journal keys (matching journal/page.tsx) ──────────────────────────────────

const TRADES_KEY              = 'cg_journal_trades'
const NOTES_KEY               = 'cg_journal_notes'
const TEMPLATES_KEY           = 'cg_note_templates'
const PROP_FIRM_ACCOUNTS_KEY  = 'cg_propfirm_accounts'
const DISMISSED_WEBHOOKS_KEY  = 'cg_dismissed_webhook_ids'
const PRIVACY_KEY             = 'pf_privacy'
const JOURNAL_DEFAULTS_PREFIX = 'cg_journal_defaults_'

// ── Additional keys synced as part of journal payload ─────────────────────────
const CUSTOM_TAGS_KEY      = 'cg_journal_custom_tags'
const RITUAL_ENTRIES_KEY   = 'cg_ritual_entries'
const RITUAL_STREAK_KEY    = 'cg_ritual_streak'
const RULE_COP_KEY         = 'cg_rule_cop'
const PLAYBOOKS_KEY        = 'cg_playbooks'
const COACH_SUMMARIES_KEY  = 'cg_coach_summaries'
const CUSTOM_TICKERS_KEY   = 'cg_ticker'
const TICKER_PREFS_KEY     = 'cg_ticker_prefs'
const ALERT_PREFS_KEY      = 'cg_alert_prefs'

// ── Price alerts key (bundled into settings payload) ──────────────────────────
const PRICE_ALERTS_KEY = 'cg_price_alerts'

/** Collect all cg_journal_defaults_* keys into { AssetClass: {...}, ... } */
function getJournalDefaults(): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith(JOURNAL_DEFAULTS_PREFIX)) {
        const assetClass = key.slice(JOURNAL_DEFAULTS_PREFIX.length)
        try { result[assetClass] = JSON.parse(localStorage.getItem(key) || '') } catch {}
      }
    }
  } catch {}
  return result
}

/** Restore all cg_journal_defaults_* keys from a cloud-sourced object */
function setJournalDefaults(defaults: Record<string, unknown>): void {
  for (const [assetClass, val] of Object.entries(defaults)) {
    if (val !== null && val !== undefined) {
      lsSet(`${JOURNAL_DEFAULTS_PREFIX}${assetClass}`, val)
    }
  }
}

// ── Settings key ──────────────────────────────────────────────────────────────

const SETTINGS_KEY = 'cg_settings'

// ── Cloud API calls ───────────────────────────────────────────────────────────

async function cloudGet<T>(token: string, type: string): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE}/api/user/data/${type}`, {
      headers: authHeaders(token),
    })
    if (!res.ok) return null
    const json = await res.json()
    // Backend returns { type, data: <JSONB>, updated_at }
    // The JSONB column may itself be { data: ... } if cloudPut wrapped it.
    // Unwrap both layers to get the actual payload.
    let payload = json.data ?? json[type] ?? json
    if (payload && typeof payload === 'object' && !Array.isArray(payload) && 'data' in payload) {
      payload = payload.data
    }
    return payload as T
  } catch {
    return null
  }
}

async function cloudPut(token: string, type: string, data: unknown): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/user/data/${type}`, {
      method: 'PUT',
      headers: authHeaders(token),
      body: JSON.stringify({ data }),
    })
    return res.ok
  } catch {
    return false
  }
}

// ── Journal sync ──────────────────────────────────────────────────────────────

interface CloudJournalData {
  trades?: unknown[]
  notes?: unknown[]
  templates?: unknown[]
  propFirmAccounts?: unknown[]
  journalDefaults?: Record<string, unknown>
  dismissedWebhookIds?: unknown[]
  privacyMode?: string
  // NEW fields — 10 additional keys bundled into journal payload
  customTags?: unknown
  ritualEntries?: unknown
  ritualStreak?: unknown
  ruleCop?: unknown
  playbooks?: unknown
  coachSummaries?: unknown
  dashboardWatchlist?: unknown[]
  customTickers?: unknown
  tickerPrefs?: unknown
  alertPrefs?: unknown
}

/**
 * Initial sync on login / app load.
 * Cloud is the source of truth — always pull and overwrite localStorage.
 * No timestamp comparisons, no "is local newer" checks.
 */
export async function initJournalSync(token: string): Promise<void> {
  setStatus('syncing')
  try {
    const cloudData = await cloudGet<CloudJournalData>(token, 'journal')
    if (cloudData) {
      const cloudTrades     = cloudData.trades     ?? []
      const cloudNotes      = cloudData.notes      ?? []
      const cloudTemplates  = cloudData.templates  ?? []
      lsSet(TRADES_KEY,    cloudTrades)
      lsSet(NOTES_KEY,     cloudNotes)
      if (cloudTemplates.length > 0) lsSet(TEMPLATES_KEY, cloudTemplates)
      // Restore extra keys — only if cloud has data (backward compat)
      if (cloudData.propFirmAccounts && cloudData.propFirmAccounts.length > 0)
        lsSet(PROP_FIRM_ACCOUNTS_KEY, cloudData.propFirmAccounts)
      if (cloudData.journalDefaults && Object.keys(cloudData.journalDefaults).length > 0)
        setJournalDefaults(cloudData.journalDefaults)
      if (cloudData.dismissedWebhookIds && cloudData.dismissedWebhookIds.length > 0)
        lsSet(DISMISSED_WEBHOOKS_KEY, cloudData.dismissedWebhookIds)
      if (cloudData.privacyMode != null && cloudData.privacyMode !== '') {
        try { localStorage.setItem(PRIVACY_KEY, cloudData.privacyMode) } catch {}
      }
      // NEW: restore additional keys — only if cloud has non-null/non-empty data (backward compat)
      if (cloudData.customTags != null) lsSet(CUSTOM_TAGS_KEY, cloudData.customTags)
      if (cloudData.ritualEntries != null) lsSet(RITUAL_ENTRIES_KEY, cloudData.ritualEntries)
      if (cloudData.ritualStreak != null) lsSet(RITUAL_STREAK_KEY, cloudData.ritualStreak)
      if (cloudData.ruleCop != null) lsSet(RULE_COP_KEY, cloudData.ruleCop)
      if (cloudData.playbooks != null) lsSet(PLAYBOOKS_KEY, cloudData.playbooks)
      if (cloudData.coachSummaries != null) lsSet(COACH_SUMMARIES_KEY, cloudData.coachSummaries)
      if (cloudData.dashboardWatchlist && cloudData.dashboardWatchlist.length > 0)
        lsSet(WATCHLIST_KEY, cloudData.dashboardWatchlist)
      if (cloudData.customTickers != null) lsSet(CUSTOM_TICKERS_KEY, cloudData.customTickers)
      if (cloudData.tickerPrefs != null) lsSet(TICKER_PREFS_KEY, cloudData.tickerPrefs)
      if (cloudData.alertPrefs != null) lsSet(ALERT_PREFS_KEY, cloudData.alertPrefs)
    }
    setStatus('synced')
  } catch {
    setStatus('error')
  }
}

/**
 * Force pull from cloud, overwriting local data.
 * Identical to initJournalSync but exposed for the manual "Sync from Cloud" button.
 */
export async function forceSyncFromCloud(): Promise<boolean> {
  const token = getToken()
  if (!token) return false
  setStatus('syncing')
  try {
    const cloudData = await cloudGet<CloudJournalData>(token, 'journal')
    if (cloudData) {
      const cloudTrades     = cloudData.trades     ?? []
      const cloudNotes      = cloudData.notes      ?? []
      const cloudTemplates  = cloudData.templates  ?? []
      lsSet(TRADES_KEY,    cloudTrades)
      lsSet(NOTES_KEY,     cloudNotes)
      if (cloudTemplates.length > 0) lsSet(TEMPLATES_KEY, cloudTemplates)
      // Restore extra keys — only if cloud has data (backward compat)
      if (cloudData.propFirmAccounts && cloudData.propFirmAccounts.length > 0)
        lsSet(PROP_FIRM_ACCOUNTS_KEY, cloudData.propFirmAccounts)
      if (cloudData.journalDefaults && Object.keys(cloudData.journalDefaults).length > 0)
        setJournalDefaults(cloudData.journalDefaults)
      if (cloudData.dismissedWebhookIds && cloudData.dismissedWebhookIds.length > 0)
        lsSet(DISMISSED_WEBHOOKS_KEY, cloudData.dismissedWebhookIds)
      if (cloudData.privacyMode != null && cloudData.privacyMode !== '') {
        try { localStorage.setItem(PRIVACY_KEY, cloudData.privacyMode) } catch {}
      }
      // NEW: restore additional keys — only if cloud has non-null/non-empty data (backward compat)
      if (cloudData.customTags != null) lsSet(CUSTOM_TAGS_KEY, cloudData.customTags)
      if (cloudData.ritualEntries != null) lsSet(RITUAL_ENTRIES_KEY, cloudData.ritualEntries)
      if (cloudData.ritualStreak != null) lsSet(RITUAL_STREAK_KEY, cloudData.ritualStreak)
      if (cloudData.ruleCop != null) lsSet(RULE_COP_KEY, cloudData.ruleCop)
      if (cloudData.playbooks != null) lsSet(PLAYBOOKS_KEY, cloudData.playbooks)
      if (cloudData.coachSummaries != null) lsSet(COACH_SUMMARIES_KEY, cloudData.coachSummaries)
      if (cloudData.dashboardWatchlist && cloudData.dashboardWatchlist.length > 0)
        lsSet(WATCHLIST_KEY, cloudData.dashboardWatchlist)
      if (cloudData.customTickers != null) lsSet(CUSTOM_TICKERS_KEY, cloudData.customTickers)
      if (cloudData.tickerPrefs != null) lsSet(TICKER_PREFS_KEY, cloudData.tickerPrefs)
      if (cloudData.alertPrefs != null) lsSet(ALERT_PREFS_KEY, cloudData.alertPrefs)
    }
    setStatus('synced')
    return true
  } catch {
    setStatus('error')
    return false
  }
}

/**
 * Push full journal state to cloud after every mutation.
 * Debounced at 1.5 seconds to handle rapid changes gracefully.
 */
let _journalTimer: ReturnType<typeof setTimeout> | null = null

export function debouncedSyncJournal(trades: unknown[], notes: unknown[], templates?: unknown[]): void {
  // ── All localStorage keys synced to cloud via this function ──────────────
  // cg_journal_trades, cg_journal_notes, cg_note_templates,
  // cg_propfirm_accounts, cg_journal_defaults_*, cg_dismissed_webhook_ids,
  // pf_privacy,
  // cg_journal_custom_tags, cg_ritual_entries, cg_ritual_streak,
  // cg_rule_cop, cg_playbooks, cg_coach_summaries,
  // cg_wl, cg_ticker, cg_ticker_prefs, cg_alert_prefs
  // ─────────────────────────────────────────────────────────────────────────
  const token = getToken()
  if (!token) {
    setStatus('local-only')
    return
  }
  if (_journalTimer) clearTimeout(_journalTimer)
  setStatus('syncing')
  _journalTimer = setTimeout(async () => {
    _journalTimer = null
    // Always include templates in the payload (read from localStorage if not passed)
    let tpls = templates
    if (tpls === undefined) {
      try { tpls = JSON.parse(localStorage.getItem(TEMPLATES_KEY) || '[]') } catch { tpls = [] }
    }
    const propFirmAccounts    = lsGet<unknown[]>(PROP_FIRM_ACCOUNTS_KEY, [])
    const journalDefaults     = getJournalDefaults()
    const dismissedWebhookIds = lsGet<unknown[]>(DISMISSED_WEBHOOKS_KEY, [])
    let privacyMode: string | null = null
    try { privacyMode = localStorage.getItem(PRIVACY_KEY) } catch {}
    // NEW: collect additional keys
    const customTags         = lsGet<unknown>(CUSTOM_TAGS_KEY, null)
    const ritualEntries      = lsGet<unknown>(RITUAL_ENTRIES_KEY, null)
    const ritualStreak       = lsGet<unknown>(RITUAL_STREAK_KEY, null)
    const ruleCop            = lsGet<unknown>(RULE_COP_KEY, null)
    const playbooks          = lsGet<unknown>(PLAYBOOKS_KEY, null)
    const coachSummaries     = lsGet<unknown>(COACH_SUMMARIES_KEY, null)
    const dashboardWatchlist = lsGet<unknown[]>(WATCHLIST_KEY, [])
    const customTickers      = lsGet<unknown>(CUSTOM_TICKERS_KEY, null)
    const tickerPrefs        = lsGet<unknown>(TICKER_PREFS_KEY, null)
    const alertPrefs         = lsGet<unknown>(ALERT_PREFS_KEY, null)
    const ok = await cloudPut(token, 'journal', {
      trades,
      notes,
      templates: tpls,
      propFirmAccounts,
      journalDefaults,
      dismissedWebhookIds,
      ...(privacyMode != null ? { privacyMode } : {}),
      // NEW fields
      ...(customTags != null ? { customTags } : {}),
      ...(ritualEntries != null ? { ritualEntries } : {}),
      ...(ritualStreak != null ? { ritualStreak } : {}),
      ...(ruleCop != null ? { ruleCop } : {}),
      ...(playbooks != null ? { playbooks } : {}),
      ...(coachSummaries != null ? { coachSummaries } : {}),
      ...(dashboardWatchlist.length > 0 ? { dashboardWatchlist } : {}),
      ...(customTickers != null ? { customTickers } : {}),
      ...(tickerPrefs != null ? { tickerPrefs } : {}),
      ...(alertPrefs != null ? { alertPrefs } : {}),
    })
    setStatus(ok ? 'synced' : 'error')
  }, 1500)
}

// ── Settings sync ─────────────────────────────────────────────────────────────

/**
 * Initial sync for settings on login.
 * Pull from cloud if available; push local if cloud is empty.
 */
export async function initSettingsSync(token: string): Promise<void> {
  try {
    const cloudSettings = await cloudGet<Record<string, unknown> & { priceAlerts?: unknown }>(token, 'settings')
    const localSettings = lsGet<Record<string, unknown>>(SETTINGS_KEY, {})

    if (cloudSettings && Object.keys(cloudSettings).length > 0 && Object.keys(localSettings).length === 0) {
      lsSet(SETTINGS_KEY, cloudSettings)
    } else if (Object.keys(localSettings).length > 0 && (!cloudSettings || Object.keys(cloudSettings).length === 0)) {
      await cloudPut(token, 'settings', localSettings)
    }
    // Both have settings → keep local (user's current preferences win)

    // Restore price alerts backup — only if cloud has data (backward compat)
    if (cloudSettings?.priceAlerts != null) {
      lsSet(PRICE_ALERTS_KEY, cloudSettings.priceAlerts)
    }
  } catch {
    // Fail silently
  }
}

let _settingsTimer: ReturnType<typeof setTimeout> | null = null

export function debouncedSyncSettings(settings: Record<string, unknown>): void {
  const token = getToken()
  if (!token) return
  if (_settingsTimer) clearTimeout(_settingsTimer)
  _settingsTimer = setTimeout(async () => {
    _settingsTimer = null
    // Bundle price alerts as backup into settings payload
    const priceAlerts = lsGet<unknown>(PRICE_ALERTS_KEY, null)
    await cloudPut(token, 'settings', {
      ...settings,
      ...(priceAlerts != null ? { priceAlerts } : {}),
    })
  }, 1500)
}

// ── Portfolio sync ────────────────────────────────────────────────────────────

const PORTFOLIO_KEY = 'cg_portfolio_holdings'

/**
 * Initial sync for portfolio holdings on login/app load.
 * Pull from cloud if available; push local if cloud is empty.
 */
export async function initPortfolioSync(token: string): Promise<void> {
  try {
    const cloudResponse = await fetch(`${API_BASE}/api/user/data/portfolio`, {
      headers: authHeaders(token),
    })
    let cloudHoldings: unknown[] | null = null
    let cloudUpdatedAt: string | null = null
    if (cloudResponse.ok) {
      const json = await cloudResponse.json()
      let payload = json.data ?? json.portfolio ?? json
      if (payload && typeof payload === 'object' && !Array.isArray(payload) && 'data' in payload) {
        payload = payload.data
      }
      cloudHoldings = Array.isArray(payload) ? payload : null
      cloudUpdatedAt = json.updated_at ?? null
    }
    const localHoldings = lsGet<unknown[]>(PORTFOLIO_KEY, [])
    const cloud = Array.isArray(cloudHoldings) ? cloudHoldings : []

    if (cloud.length > 0 && localHoldings.length === 0) {
      // Cloud has data, local is empty — check if user intentionally cleared
      const clearedAt = (() => { try { return localStorage.getItem('portfolio_cleared_at') } catch { return null } })()
      if (clearedAt && cloudUpdatedAt && new Date(clearedAt) > new Date(cloudUpdatedAt)) {
        // User cleared after last cloud update — respect the deletion, push empty to cloud
        await cloudPut(token, 'portfolio', [])
      } else {
        // Fresh device or no clear record — restore from cloud (cloud wins)
        lsSet(PORTFOLIO_KEY, cloud)
      }
    } else if (cloud.length > 0) {
      // Both have data — cloud wins (existing behavior)
      lsSet(PORTFOLIO_KEY, cloud)
    } else if (localHoldings.length > 0) {
      // Cloud empty, local has data — push local to cloud
      await cloudPut(token, 'portfolio', localHoldings)
    }
  } catch {
    // Fail silently — localStorage-only flow always works
  }
}

let _portfolioTimer: ReturnType<typeof setTimeout> | null = null

export function debouncedSyncPortfolio(holdings: unknown[], prevHoldings?: unknown[]): void {
  const token = getToken()
  if (!token) return
  // Track intentional clearing: if going from non-empty → empty, record cleared timestamp
  if (prevHoldings && prevHoldings.length > 0 && holdings.length === 0) {
    try { localStorage.setItem('portfolio_cleared_at', new Date().toISOString()) } catch {}
  }
  if (_portfolioTimer) clearTimeout(_portfolioTimer)
  _portfolioTimer = setTimeout(async () => {
    _portfolioTimer = null
    await cloudPut(token, 'portfolio', holdings)
  }, 1500)
}

// ── Watchlist sync ────────────────────────────────────────────────────────────

const WATCHLIST_KEY = 'cg_wl'

/**
 * Initial sync for watchlist on login/app load.
 * Pull from cloud if available; push local if cloud is empty.
 */
export async function initWatchlistSync(token: string): Promise<void> {
  try {
    const cloudWatchlist = await cloudGet<unknown[]>(token, 'watchlist')
    const localWatchlist = lsGet<unknown[]>(WATCHLIST_KEY, [])
    const cloud = Array.isArray(cloudWatchlist) ? cloudWatchlist : []

    if (cloud.length > 0) {
      lsSet(WATCHLIST_KEY, cloud)
    } else if (localWatchlist.length > 0) {
      await cloudPut(token, 'watchlist', localWatchlist)
    }
  } catch {
    // Fail silently — localStorage-only flow always works
  }
}

let _watchlistTimer: ReturnType<typeof setTimeout> | null = null

export function debouncedSyncWatchlist(tickers: unknown[]): void {
  const token = getToken()
  if (!token) return
  if (_watchlistTimer) clearTimeout(_watchlistTimer)
  _watchlistTimer = setTimeout(async () => {
    _watchlistTimer = null
    await cloudPut(token, 'watchlist', tickers)
  }, 1500)
}

// ── Full initial sync (journal + settings + portfolio + watchlist) ─────────────

export async function initFullSync(token: string): Promise<void> {
  if (!token) {
    setStatus('local-only')
    return
  }
  // Run all 4 syncs in parallel
  await Promise.all([
    initJournalSync(token),
    initSettingsSync(token),
    initPortfolioSync(token),
    initWatchlistSync(token),
  ])
}
