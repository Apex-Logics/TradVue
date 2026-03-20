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
    const ok = await cloudPut(token, 'journal', {
      trades,
      notes,
      templates: tpls,
      propFirmAccounts,
      journalDefaults,
      dismissedWebhookIds,
      ...(privacyMode != null ? { privacyMode } : {}),
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
    const cloudSettings = await cloudGet<Record<string, unknown>>(token, 'settings')
    const localSettings = lsGet<Record<string, unknown>>(SETTINGS_KEY, {})

    if (cloudSettings && Object.keys(cloudSettings).length > 0 && Object.keys(localSettings).length === 0) {
      lsSet(SETTINGS_KEY, cloudSettings)
    } else if (Object.keys(localSettings).length > 0 && (!cloudSettings || Object.keys(cloudSettings).length === 0)) {
      await cloudPut(token, 'settings', localSettings)
    }
    // Both have settings → keep local (user's current preferences win)
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
    await cloudPut(token, 'settings', settings)
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
    const cloudHoldings = await cloudGet<unknown[]>(token, 'portfolio')
    const localHoldings = lsGet<unknown[]>(PORTFOLIO_KEY, [])
    const cloud = Array.isArray(cloudHoldings) ? cloudHoldings : []

    if (cloud.length > 0) {
      lsSet(PORTFOLIO_KEY, cloud)
    } else if (localHoldings.length > 0) {
      await cloudPut(token, 'portfolio', localHoldings)
    }
  } catch {
    // Fail silently — localStorage-only flow always works
  }
}

let _portfolioTimer: ReturnType<typeof setTimeout> | null = null

export function debouncedSyncPortfolio(holdings: unknown[]): void {
  const token = getToken()
  if (!token || !holdings.length) return  // Never push empty arrays to cloud
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
