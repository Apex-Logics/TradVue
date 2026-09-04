/**
 * cloudSync.ts — localStorage ↔ cloud sync utility for TradVue
 *
 * Simple model:
 *   - Cloud is the source of truth, always.
 *   - Login / page load  → pull from cloud → overwrite localStorage.
 *   - User change        → push full local state to cloud.
 *   - forceSyncFromCloud → manual pull (same as login).
 *
 * Journal PUTs send updated_at as a precondition (Q2). A 409 merges
 * trades/notes/related arrays by stable id and retries. Q3 tombstones
 * (`_deleted` in the journal blob) propagate intentional deletes without
 * re-enabling silent empty overwrite of non-empty local (Q9). Fails
 * silently — localStorage-only flow always works.
 */

import {
  JOURNAL_DELETED_KEY,
  applyTombstonesToArray,
  compactDeletedMap,
  deletedMapIsEmpty,
  detectNewDeletes,
  extractDeletedMap,
  hasDeletedStamps,
  liveIdsFromBlob,
  mergeDeletedMaps,
  mergeJournalBlobs,
  stripTombstonedRows,
  unwrapUserDataPayload,
  type DeletedMap,
  type JournalBlob,
} from './journalMerge'

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
const WATCHLIST_KEY = 'cg_wl'

// Q3: persist tombstones + last-synced live ids so a delete after reload
// still produces a `_deleted` entry on the next PUT.
const JOURNAL_DELETED_LS_KEY = 'cg_journal_deleted'
const JOURNAL_SYNCED_IDS_KEY = 'cg_journal_synced_ids'

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
    return unwrapUserDataPayload(json) as T
  } catch {
    return null
  }
}

async function cloudGetJournal(token: string): Promise<{
  ok: boolean
  payload: CloudJournalData | null
  updated_at: string | null
}> {
  try {
    const res = await fetch(`${API_BASE}/api/user/data/journal`, {
      headers: authHeaders(token),
    })
    if (!res.ok) return { ok: false, payload: null, updated_at: null }
    const json = await res.json()
    const unwrapped = unwrapUserDataPayload(json)
    const payload = unwrapped && typeof unwrapped === 'object' && !Array.isArray(unwrapped)
      ? unwrapped as CloudJournalData
      : null
    const updated_at = typeof json.updated_at === 'string' ? json.updated_at : json.updated_at ?? null
    return { ok: true, payload, updated_at }
  } catch {
    return { ok: false, payload: null, updated_at: null }
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

const JOURNAL_UPDATED_AT_KEY = 'cg_journal_cloud_updated_at'
const JOURNAL_PUT_MAX_ATTEMPTS = 3

let _journalUpdatedAt: string | null | undefined

function rememberJournalUpdatedAt(token: string, updatedAt: string | null): void {
  _journalUpdatedAt = updatedAt
  try {
    localStorage.setItem(JOURNAL_UPDATED_AT_KEY, JSON.stringify({ token, updated_at: updatedAt }))
  } catch {}
}

function readJournalUpdatedAt(token: string): string | null {
  if (_journalUpdatedAt !== undefined && _journalPullToken === token) return _journalUpdatedAt
  try {
    const raw = localStorage.getItem(JOURNAL_UPDATED_AT_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { token?: string; updated_at?: string | null }
    if (parsed && parsed.token === token) {
      _journalUpdatedAt = parsed.updated_at ?? null
      return _journalUpdatedAt
    }
  } catch {}
  return null
}

function clearJournalUpdatedAt(): void {
  _journalUpdatedAt = undefined
  try { localStorage.removeItem(JOURNAL_UPDATED_AT_KEY) } catch {}
}

function readDeletedMap(): DeletedMap {
  return lsGet<DeletedMap>(JOURNAL_DELETED_LS_KEY, {})
}

function persistDeletedMap(map: DeletedMap): void {
  const compact = compactDeletedMap(map)
  if (deletedMapIsEmpty(compact)) {
    try { localStorage.removeItem(JOURNAL_DELETED_LS_KEY) } catch {}
    return
  }
  lsSet(JOURNAL_DELETED_LS_KEY, compact)
}

function readSyncedIds(): Partial<Record<string, string[]>> {
  return lsGet<Partial<Record<string, string[]>>>(JOURNAL_SYNCED_IDS_KEY, {})
}

function persistSyncedIds(ids: Partial<Record<string, string[]>>): void {
  lsSet(JOURNAL_SYNCED_IDS_KEY, ids)
}

function snapshotSyncedIdsFromLocal(): void {
  persistSyncedIds({
    trades: liveIdsFromBlob({ trades: lsGet<unknown[]>(TRADES_KEY, []) }).trades,
    notes: liveIdsFromBlob({ notes: lsGet<unknown[]>(NOTES_KEY, []) }).notes,
    templates: liveIdsFromBlob({ templates: lsGet<unknown[]>(TEMPLATES_KEY, []) }).templates,
    propFirmAccounts: liveIdsFromBlob({ propFirmAccounts: lsGet<unknown[]>(PROP_FIRM_ACCOUNTS_KEY, []) }).propFirmAccounts,
    playbooks: liveIdsFromBlob({ playbooks: lsGet<unknown[]>(PLAYBOOKS_KEY, []) }).playbooks,
    coachSummaries: liveIdsFromBlob({ coachSummaries: lsGet<unknown[]>(COACH_SUMMARIES_KEY, []) }).coachSummaries,
    ritualEntries: liveIdsFromBlob({ ritualEntries: lsGet<unknown[]>(RITUAL_ENTRIES_KEY, []) }).ritualEntries,
    customTags: liveIdsFromBlob({ customTags: lsGet<unknown[]>(CUSTOM_TAGS_KEY, []) }).customTags,
    dismissedWebhookIds: liveIdsFromBlob({ dismissedWebhookIds: lsGet<unknown[]>(DISMISSED_WEBHOOKS_KEY, []) }).dismissedWebhookIds,
    dashboardWatchlist: liveIdsFromBlob({ dashboardWatchlist: lsGet<unknown[]>(WATCHLIST_KEY, []) }).dashboardWatchlist,
  })
}

/** Q9: bare empty/missing cloud array does not wipe local. Q3: tombstones still drop those ids. */
function applyGuardedCloudArray(
  storageKey: string,
  cloudArr: unknown,
  stamps?: Record<string, string | true | null>,
): void {
  if (Array.isArray(cloudArr) && cloudArr.length > 0) {
    lsSet(storageKey, applyTombstonesToArray(cloudArr, stamps))
    return
  }
  if (hasDeletedStamps(stamps)) {
    const local = lsGet<unknown[]>(storageKey, [])
    if (Array.isArray(local) && local.length > 0) {
      lsSet(storageKey, applyTombstonesToArray(local, stamps))
    }
  }
}

/** Existing non-null overwrite, but empty + tombstones filters local instead of wiping everything. */
function applyNullableCloudArray(
  storageKey: string,
  cloudVal: unknown,
  stamps?: Record<string, string | true | null>,
): void {
  if (cloudVal == null) return
  if (Array.isArray(cloudVal)) {
    if (cloudVal.length > 0) {
      lsSet(storageKey, applyTombstonesToArray(cloudVal, stamps))
      return
    }
    if (hasDeletedStamps(stamps)) {
      const local = lsGet<unknown[]>(storageKey, [])
      lsSet(storageKey, applyTombstonesToArray(Array.isArray(local) ? local : [], stamps))
      return
    }
  }
  lsSet(storageKey, cloudVal)
}

function applyPulledJournal(cloudData: CloudJournalData): void {
  const deleted = mergeDeletedMaps(readDeletedMap(), extractDeletedMap(cloudData))
  persistDeletedMap(deleted)

  applyGuardedCloudArray(TRADES_KEY, cloudData.trades, deleted.trades)
  applyGuardedCloudArray(NOTES_KEY, cloudData.notes, deleted.notes)
  applyGuardedCloudArray(TEMPLATES_KEY, cloudData.templates, deleted.templates)
  applyGuardedCloudArray(PROP_FIRM_ACCOUNTS_KEY, cloudData.propFirmAccounts, deleted.propFirmAccounts)
  if (cloudData.journalDefaults && Object.keys(cloudData.journalDefaults).length > 0) {
    setJournalDefaults(cloudData.journalDefaults)
  }
  applyGuardedCloudArray(DISMISSED_WEBHOOKS_KEY, cloudData.dismissedWebhookIds, deleted.dismissedWebhookIds)
  if (cloudData.privacyMode != null && cloudData.privacyMode !== '') {
    try { localStorage.setItem(PRIVACY_KEY, cloudData.privacyMode) } catch {}
  }
  if (cloudData.customTags != null) applyNullableCloudArray(CUSTOM_TAGS_KEY, cloudData.customTags, deleted.customTags)
  if (cloudData.ritualEntries != null) applyNullableCloudArray(RITUAL_ENTRIES_KEY, cloudData.ritualEntries, deleted.ritualEntries)
  if (cloudData.ritualStreak != null) lsSet(RITUAL_STREAK_KEY, cloudData.ritualStreak)
  if (cloudData.ruleCop != null) lsSet(RULE_COP_KEY, cloudData.ruleCop)
  if (cloudData.playbooks != null) applyNullableCloudArray(PLAYBOOKS_KEY, cloudData.playbooks, deleted.playbooks)
  if (cloudData.coachSummaries != null) applyNullableCloudArray(COACH_SUMMARIES_KEY, cloudData.coachSummaries, deleted.coachSummaries)
  applyGuardedCloudArray(WATCHLIST_KEY, cloudData.dashboardWatchlist, deleted.dashboardWatchlist)
  if (cloudData.customTickers != null) lsSet(CUSTOM_TICKERS_KEY, cloudData.customTickers)
  if (cloudData.tickerPrefs != null) lsSet(TICKER_PREFS_KEY, cloudData.tickerPrefs)
  if (cloudData.alertPrefs != null) lsSet(ALERT_PREFS_KEY, cloudData.alertPrefs)

  snapshotSyncedIdsFromLocal()
}

function finalizeJournalPayload(data: CloudJournalData): JournalBlob {
  const extracted = extractDeletedMap(data)
  const detected = detectNewDeletes(readSyncedIds(), data, new Date().toISOString())
  const deleted = mergeDeletedMaps(mergeDeletedMaps(readDeletedMap(), extracted), detected)
  const stripped = stripTombstonedRows({ ...data }, deleted)
  if (!deletedMapIsEmpty(deleted)) {
    stripped[JOURNAL_DELETED_KEY] = deleted
  } else {
    delete stripped[JOURNAL_DELETED_KEY]
  }
  persistDeletedMap(deleted)
  return stripped
}

async function cloudPutJournal(token: string, data: CloudJournalData): Promise<boolean> {
  let payload: JournalBlob = finalizeJournalPayload(data)
  for (let attempt = 0; attempt < JOURNAL_PUT_MAX_ATTEMPTS; attempt++) {
    const expected = readJournalUpdatedAt(token)
    try {
      const headers: Record<string, string> = {
        ...authHeaders(token),
        'X-Expected-Updated-At': expected == null ? 'null' : expected,
      }
      if (expected != null) headers['If-Match'] = `"${expected}"`
      const res = await fetch(`${API_BASE}/api/user/data/journal`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ data: payload, expectedUpdatedAt: expected }),
      })
      if (res.status === 409) {
        const json = await res.json()
        const serverUpdated = typeof json.updated_at === 'string' ? json.updated_at : json.updated_at ?? null
        rememberJournalUpdatedAt(token, serverUpdated)
        const serverPayload = unwrapUserDataPayload(json)
        if (serverPayload && typeof serverPayload === 'object' && !Array.isArray(serverPayload)) {
          payload = mergeJournalBlobs(payload, serverPayload as JournalBlob)
          applyPulledJournal(payload)
        }
        continue
      }
      if (!res.ok) return false
      const json = await res.json().catch(() => ({}))
      rememberJournalUpdatedAt(token, typeof json.updated_at === 'string' ? json.updated_at : expected)
      persistDeletedMap(extractDeletedMap(payload))
      persistSyncedIds(liveIdsFromBlob(payload))
      return true
    } catch {
      return false
    }
  }
  return false
}

// ── Journal pullComplete gate (Q1) ────────────────────────────────────────────
//
// No journal PUT until a pull has settled for the current token/session.
// 1.5s debounce is only a burst coalescer — this flag is the actual gate.
// Token change or a new idle pull (login remount / initFullSync / forceSync)
// re-closes the gate so a hung GET past 1.5s cannot empty-PUT.
// Failed GET still opens the gate (local data can push) but empty wipe PUTs
// are skipped until a successful GET marks a cloud snapshot.
// resetJournalPullGate is logout-only (AuthContext.logout) — never first-paint
// / authLoading / !token on the journal page, or Auth's in-flight pull is
// uncounted and its endJournalPull can open the gate while the page GET hangs.

type JournalPullDeferred = { promise: Promise<void>; resolve: () => void }

let _journalPullToken: string | null = null
let _journalPullComplete = false
let _journalPullInFlight = 0
let _journalPullHadCloudSnapshot = false
let _journalPullDeferred: JournalPullDeferred | null = null
let _journalTimer: ReturnType<typeof setTimeout> | null = null

function createJournalPullDeferred(): JournalPullDeferred {
  let resolve = () => {}
  const promise = new Promise<void>(r => { resolve = r })
  return { promise, resolve }
}

function beginJournalPull(token: string): void {
  if (_journalPullToken !== token) {
    _journalPullDeferred?.resolve()
    _journalPullToken = token
    _journalPullComplete = false
    _journalPullHadCloudSnapshot = false
    _journalUpdatedAt = undefined
    _journalPullInFlight = 0
    _journalPullDeferred = createJournalPullDeferred()
  } else if (_journalPullInFlight === 0) {
    // New pull after the previous one settled (login remount, initFullSync,
    // forceSyncFromCloud). Re-close so a remount cannot empty-PUT.
    _journalPullComplete = false
    _journalPullHadCloudSnapshot = false
    _journalPullDeferred = createJournalPullDeferred()
  }
  _journalPullInFlight++
}

function endJournalPull(token: string): void {
  if (_journalPullToken !== token) return
  _journalPullInFlight = Math.max(0, _journalPullInFlight - 1)
  if (_journalPullInFlight === 0) {
    _journalPullComplete = true
    _journalPullDeferred?.resolve()
    _journalPullDeferred = null
  }
}

function markJournalCloudSnapshot(token: string): void {
  if (_journalPullToken === token) _journalPullHadCloudSnapshot = true
}

function hasJournalCloudSnapshot(token: string): boolean {
  return _journalPullToken === token && _journalPullHadCloudSnapshot
}

function isEmptyJournalWipe(trades: unknown, notes: unknown): boolean {
  const t = Array.isArray(trades) ? trades : []
  const n = Array.isArray(notes) ? notes : []
  return t.length === 0 && n.length === 0
}

function isJournalPullComplete(token: string): boolean {
  return _journalPullToken === token && _journalPullComplete
}

async function waitForJournalPull(token: string): Promise<boolean> {
  if (_journalPullToken !== token) return false
  if (_journalPullComplete) return true
  if (!_journalPullDeferred) return false
  await _journalPullDeferred.promise
  return _journalPullToken === token && _journalPullComplete
}

/** Logout / test helper. Do not call on first paint or while auth is loading. */
export function resetJournalPullGate(): void {
  _journalPullDeferred?.resolve()
  _journalPullToken = null
  _journalPullComplete = false
  _journalPullHadCloudSnapshot = false
  _journalPullInFlight = 0
  _journalPullDeferred = null
  clearJournalUpdatedAt()
  if (_journalTimer) {
    clearTimeout(_journalTimer)
    _journalTimer = null
  }
}

// ── Journal sync ──────────────────────────────────────────────────────────────

interface CloudJournalData extends JournalBlob {
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
  _deleted?: DeletedMap
}

/**
 * Initial sync on login / app load.
 * Cloud is the source of truth — always pull and overwrite localStorage
 * (P0 empty-cloud guards still apply). Remembers updated_at for Q2 PUTs.
 */
export async function initJournalSync(token: string): Promise<void> {
  beginJournalPull(token)
  setStatus('syncing')
  try {
    const result = await cloudGetJournal(token)
    if (result.ok) {
      markJournalCloudSnapshot(token)
      rememberJournalUpdatedAt(token, result.updated_at)
    }
    const cloudData = result.payload
    if (cloudData) {
      // P0/Q9 empty-array guards + Q3 tombstones (applyPulledJournal).
      applyPulledJournal(cloudData)
    }
    setStatus('synced')
  } catch {
    setStatus('error')
  } finally {
    endJournalPull(token)
  }
}

/**
 * Force pull from cloud, overwriting local data.
 * Identical to initJournalSync but exposed for the manual "Sync from Cloud" button.
 */
export async function forceSyncFromCloud(): Promise<boolean> {
  const token = getToken()
  if (!token) return false
  beginJournalPull(token)
  setStatus('syncing')
  try {
    const result = await cloudGetJournal(token)
    if (result.ok) {
      markJournalCloudSnapshot(token)
      rememberJournalUpdatedAt(token, result.updated_at)
    }
    const cloudData = result.payload
    if (cloudData) {
      // P0/Q9 empty-array guards + Q3 tombstones (applyPulledJournal).
      applyPulledJournal(cloudData)
    }
    setStatus('synced')
    return true
  } catch {
    setStatus('error')
    return false
  } finally {
    endJournalPull(token)
  }
}

/**
 * Push full journal state to cloud after every mutation.
 * Debounced at 1.5 seconds to handle rapid changes gracefully.
 *
 * Q1: no journal PUT until a pull (initJournalSync / forceSyncFromCloud /
 * initFullSync → initJournalSync) has completed for this token. A pre-pull
 * invocation waits, then re-reads localStorage so an empty mount snapshot
 * cannot wipe cloud after a hung GET.
 * Failed GET + empty local: skip the empty wipe PUT (no confident snapshot).
 * Failed GET + real local trades/notes: still push (gate is open).
 */
export function debouncedSyncJournal(trades: unknown[], notes?: unknown[], templates?: unknown[]): void {
  // ── All localStorage keys synced to cloud via this function (17 keys) ──────
  // 1.  cg_journal_trades
  // 2.  cg_journal_notes
  // 3.  cg_note_templates
  // 4.  cg_propfirm_accounts
  // 5.  cg_journal_defaults_*  (dynamic prefix, stored as one payload)
  // 6.  cg_dismissed_webhook_ids
  // 7.  pf_privacy
  // 8.  cg_journal_custom_tags
  // 9.  cg_ritual_entries
  // 10. cg_ritual_streak
  // 11. cg_rule_cop
  // 12. cg_playbooks
  // 13. cg_coach_summaries
  // 14. cg_wl              (dashboard watchlist, bundled as dashboardWatchlist)
  // 15. cg_ticker          (custom tickers)
  // 16. cg_ticker_prefs
  // 17. cg_alert_prefs
  // ─────────────────────────────────────────────────────────────────────────
  const token = getToken()
  if (!token) {
    setStatus('local-only')
    return
  }
  if (_journalTimer) clearTimeout(_journalTimer)
  setStatus('syncing')
  const startedComplete = isJournalPullComplete(token)
  _journalTimer = setTimeout(async () => {
    _journalTimer = null
    const currentToken = getToken()
    if (!currentToken) {
      setStatus('local-only')
      return
    }
    if (!isJournalPullComplete(currentToken)) {
      const ready = await waitForJournalPull(currentToken)
      if (!ready || getToken() !== currentToken || !isJournalPullComplete(currentToken)) {
        setStatus(getToken() ? 'idle' : 'local-only')
        return
      }
    }
    // Pre-pull callers captured empty/stale snapshots. After the gate opens,
    // push whatever localStorage now holds (cloud restore or preserved local).
    const outTrades = startedComplete ? trades : lsGet<unknown[]>(TRADES_KEY, [])
    // Always include templates in the payload (read from localStorage if not passed)
    let tpls = startedComplete ? templates : lsGet<unknown[]>(TEMPLATES_KEY, [])
    if (tpls === undefined) {
      try { tpls = JSON.parse(localStorage.getItem(TEMPLATES_KEY) || '[]') } catch { tpls = [] }
    }
    // P0 2026-09 #2: never push a hardcoded empty notes array. When a caller
    // omits notes (e.g. the trade-edit auto-save path), read the user's CURRENT
    // notes from storage so an unrelated mutation can't wipe the cloud notes.
    let nts = startedComplete ? notes : lsGet<unknown[]>(NOTES_KEY, [])
    if (nts === undefined) {
      try { nts = JSON.parse(localStorage.getItem(NOTES_KEY) || '[]') } catch { nts = [] }
    }
    // Q1 residual: failed/empty-error GET opens the gate so real local data
    // can still push, but do not PUT trades:[] / notes:[] without a successful
    // cloud snapshot — that would wipe non-empty cloud.
    if (!hasJournalCloudSnapshot(currentToken) && isEmptyJournalWipe(outTrades, nts)) {
      setStatus('idle')
      return
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
    const ok = await cloudPutJournal(currentToken, {
      trades: outTrades,
      notes: nts,
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
