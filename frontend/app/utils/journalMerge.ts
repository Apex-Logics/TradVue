/**
 * Q2 — merge journal blobs by stable id so a 409 retry does not drop
 * trades/notes present on only one device. Same-id rows: incoming (the
 * device that is retrying) wins.
 *
 * Q3 — blob-level tombstones (`_deleted` map and/or in-array
 * `_deleted` / `deletedAt` / `null` sentinels). Conflict merge unions
 * live rows then drops any id present in the merged tombstone map so a
 * delete on A is not resurrected by an add on B. Bare empty arrays
 * without tombstones are unchanged (Q9).
 */

export interface JournalBlob {
  trades?: unknown[]
  notes?: unknown[]
  templates?: unknown[]
  propFirmAccounts?: unknown[]
  journalDefaults?: Record<string, unknown>
  dismissedWebhookIds?: unknown[]
  privacyMode?: string
  customTags?: unknown
  ritualEntries?: unknown
  ritualStreak?: unknown
  ruleCop?: unknown
  playbooks?: unknown
  coachSummaries?: unknown
  /** Legacy journal-blob field. Live UI watchlist is GET /api/watchlist (Q4/A6). */
  dashboardWatchlist?: unknown[]
  customTickers?: unknown
  tickerPrefs?: unknown
  alertPrefs?: unknown
  [key: string]: unknown
}

/** ISO timestamp, `true`, or `null` — any of these is an explicit delete. */
export type DeletedStamp = string | true | null
export type DeletedMap = Partial<Record<string, Record<string, DeletedStamp>>>

export const JOURNAL_DELETED_KEY = '_deleted'

export const TOMBSTONE_ARRAY_KEYS = [
  'trades',
  'notes',
  'templates',
  'propFirmAccounts',
  'playbooks',
  'coachSummaries',
  'ritualEntries',
  'customTags',
  'dismissedWebhookIds',
  'dashboardWatchlist',
] as const

const ID_ARRAY_KEYS = [
  'trades',
  'notes',
  'templates',
  'propFirmAccounts',
  'playbooks',
  'coachSummaries',
  'ritualEntries',
  'customTags',
] as const

function itemId(item: unknown): string | null {
  if (item && typeof item === 'object' && !Array.isArray(item)) {
    const rec = item as Record<string, unknown>
    if (rec.id != null && String(rec.id) !== '') return String(rec.id)
    if (rec.symbol != null && String(rec.symbol) !== '') return `symbol:${rec.symbol}`
  }
  return null
}

export function collectionItemId(item: unknown): string | null {
  if (item == null) return null
  if (typeof item === 'string' || typeof item === 'number') return String(item)
  return itemId(item)
}

export function isDeletedItem(item: unknown): boolean {
  if (item == null) return true
  if (typeof item !== 'object' || Array.isArray(item)) return false
  const rec = item as Record<string, unknown>
  if (rec._deleted === true || rec._deleted === 1) return true
  if (typeof rec.deletedAt === 'string' && rec.deletedAt !== '') return true
  return false
}

function stampFromItem(item: unknown): DeletedStamp {
  if (item && typeof item === 'object' && !Array.isArray(item)) {
    const rec = item as Record<string, unknown>
    if (typeof rec.deletedAt === 'string' && rec.deletedAt !== '') return rec.deletedAt
  }
  return true
}

function stampRank(s: DeletedStamp | undefined): number {
  if (s == null || s === true) return 0
  const t = Date.parse(s)
  return Number.isFinite(t) ? t : 0
}

export function hasDeletedStamps(stamps?: Record<string, DeletedStamp>): boolean {
  return !!stamps && Object.keys(stamps).length > 0
}

export function isIdDeleted(id: string | null, stamps?: Record<string, DeletedStamp>): boolean {
  if (!id || !stamps) return false
  return Object.prototype.hasOwnProperty.call(stamps, id)
}

export function applyTombstonesToArray(
  items: unknown[],
  stamps?: Record<string, DeletedStamp>,
): unknown[] {
  if (!Array.isArray(items)) return []
  return items.filter(item => {
    if (item == null) return false
    if (isDeletedItem(item)) return false
    return !isIdDeleted(collectionItemId(item), stamps)
  })
}

export function compactDeletedMap(map: DeletedMap): DeletedMap {
  const out: DeletedMap = {}
  for (const [coll, stamps] of Object.entries(map)) {
    if (!stamps || typeof stamps !== 'object') continue
    const keys = Object.keys(stamps)
    if (keys.length > 0) out[coll] = { ...stamps }
  }
  return out
}

export function deletedMapIsEmpty(map: DeletedMap): boolean {
  return Object.keys(compactDeletedMap(map)).length === 0
}

function mergeStampDict(
  a: Record<string, DeletedStamp>,
  b: Record<string, DeletedStamp>,
): Record<string, DeletedStamp> {
  const ids = new Set([...Object.keys(a), ...Object.keys(b)])
  const out: Record<string, DeletedStamp> = {}
  for (const id of ids) {
    const av = a[id]
    const bv = b[id]
    if (av === undefined) out[id] = bv
    else if (bv === undefined) out[id] = av
    else out[id] = stampRank(bv) >= stampRank(av) ? bv : av
  }
  return out
}

export function mergeDeletedMaps(a: DeletedMap, b: DeletedMap): DeletedMap {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)])
  const out: DeletedMap = {}
  for (const k of keys) {
    const merged = mergeStampDict(a[k] || {}, b[k] || {})
    if (Object.keys(merged).length > 0) out[k] = merged
  }
  return out
}

function asDeletedMap(raw: unknown): DeletedMap {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out: DeletedMap = {}
  for (const [coll, stamps] of Object.entries(raw as Record<string, unknown>)) {
    if (!stamps || typeof stamps !== 'object' || Array.isArray(stamps)) continue
    const dict: Record<string, DeletedStamp> = {}
    for (const [id, stamp] of Object.entries(stamps as Record<string, unknown>)) {
      if (id === '') continue
      if (stamp === true || stamp === null || typeof stamp === 'string') dict[id] = stamp
    }
    if (Object.keys(dict).length > 0) out[coll] = dict
  }
  return out
}

/** Pull `_deleted` plus in-array `{ _deleted }` / `{ deletedAt }` sentinels. */
export function extractDeletedMap(blob: JournalBlob | null | undefined): DeletedMap {
  if (!blob || typeof blob !== 'object') return {}
  let out = asDeletedMap(blob[JOURNAL_DELETED_KEY])
  for (const key of TOMBSTONE_ARRAY_KEYS) {
    const arr = blob[key]
    if (!Array.isArray(arr)) continue
    for (const item of arr) {
      if (item == null) continue
      if (!isDeletedItem(item)) continue
      const id = collectionItemId(item)
      if (!id) continue
      out = mergeDeletedMaps(out, { [key]: { [id]: stampFromItem(item) } })
    }
  }
  return compactDeletedMap(out)
}

export function liveIdsFromArray(items: unknown): string[] {
  if (!Array.isArray(items)) return []
  const ids: string[] = []
  for (const item of items) {
    if (item == null || isDeletedItem(item)) continue
    const id = collectionItemId(item)
    if (id) ids.push(id)
  }
  return ids
}

export function liveIdsFromBlob(blob: JournalBlob): Partial<Record<string, string[]>> {
  const out: Partial<Record<string, string[]>> = {}
  for (const key of TOMBSTONE_ARRAY_KEYS) {
    if (blob[key] !== undefined) out[key] = liveIdsFromArray(blob[key])
  }
  return out
}

/**
 * Ids present in the last synced snapshot but missing from this outgoing
 * payload. Only collections the outgoing blob actually includes are diffed
 * (omitted keys are not treated as a mass-delete).
 */
export function detectNewDeletes(
  previousIds: Partial<Record<string, string[]>>,
  outgoing: JournalBlob,
  nowIso: string,
): DeletedMap {
  const out: DeletedMap = {}
  for (const key of TOMBSTONE_ARRAY_KEYS) {
    if (outgoing[key] === undefined) continue
    const prev = previousIds[key] || []
    const current = new Set(liveIdsFromArray(outgoing[key]))
    for (const id of prev) {
      if (!current.has(id)) {
        out[key] = out[key] || {}
        out[key]![id] = nowIso
      }
    }
  }
  return compactDeletedMap(out)
}

export function stripTombstonedRows(blob: JournalBlob, deleted: DeletedMap): JournalBlob {
  const next: JournalBlob = { ...blob }
  for (const key of TOMBSTONE_ARRAY_KEYS) {
    if (!Array.isArray(next[key])) continue
    next[key] = applyTombstonesToArray(next[key] as unknown[], deleted[key])
  }
  return next
}

export function mergeByStableId(incoming: unknown[], server: unknown[]): unknown[] {
  const serverById = new Map<string, unknown>()
  for (const item of server) {
    const id = collectionItemId(item)
    if (id) serverById.set(id, item)
  }
  const seen = new Set<string>()
  const out: unknown[] = []
  for (const item of incoming) {
    const id = collectionItemId(item)
    if (id) seen.add(id)
    out.push(item)
  }
  for (const [id, item] of serverById) {
    if (!seen.has(id)) out.push(item)
  }
  return out
}

function mergePrimitiveUnion(incoming: unknown[], server: unknown[]): unknown[] {
  const seen = new Set(incoming.map(x => String(x)))
  return [...incoming, ...server.filter(x => !seen.has(String(x)))]
}

export function mergeJournalArrays(incoming: unknown, server: unknown): unknown {
  const a = Array.isArray(incoming) ? incoming : []
  const b = Array.isArray(server) ? server : []
  if (a.length === 0 && b.length === 0) {
    if (Array.isArray(incoming)) return incoming
    if (Array.isArray(server)) return server
    return incoming ?? server
  }
  const aPrim = a.every(x => typeof x === 'string' || typeof x === 'number')
  const bPrim = b.length === 0 || b.every(x => typeof x === 'string' || typeof x === 'number')
  if (aPrim && bPrim) return mergePrimitiveUnion(a, b)
  return mergeByStableId(a, b)
}

export function mergeJournalBlobs(incoming: JournalBlob, server: JournalBlob): JournalBlob {
  const deleted = mergeDeletedMaps(extractDeletedMap(incoming), extractDeletedMap(server))
  const merged: JournalBlob = { ...server, ...incoming }
  for (const key of ID_ARRAY_KEYS) {
    const inc = incoming[key]
    const srv = server[key]
    if (inc !== undefined || srv !== undefined) {
      merged[key] = mergeJournalArrays(inc, srv) as unknown[]
    }
  }
  if (incoming.dismissedWebhookIds !== undefined || server.dismissedWebhookIds !== undefined) {
    merged.dismissedWebhookIds = mergeJournalArrays(
      incoming.dismissedWebhookIds,
      server.dismissedWebhookIds,
    ) as unknown[]
  }
  if (incoming.dashboardWatchlist !== undefined || server.dashboardWatchlist !== undefined) {
    merged.dashboardWatchlist = mergeJournalArrays(
      incoming.dashboardWatchlist,
      server.dashboardWatchlist,
    ) as unknown[]
  }
  if (incoming.journalDefaults || server.journalDefaults) {
    merged.journalDefaults = {
      ...(server.journalDefaults || {}),
      ...(incoming.journalDefaults || {}),
    }
  }
  const stripped = stripTombstonedRows(merged, deleted)
  if (deletedMapIsEmpty(deleted)) {
    delete stripped[JOURNAL_DELETED_KEY]
  } else {
    stripped[JOURNAL_DELETED_KEY] = deleted
  }
  return stripped
}

/** Unwrap GET / 409 `{ data }` the same way cloudGet does (double `data` wrap). */
export function unwrapUserDataPayload(json: unknown): unknown {
  if (!json || typeof json !== 'object' || Array.isArray(json)) return json
  const rec = json as Record<string, unknown>
  const first = rec.data ?? rec.journal ?? json
  if (first && typeof first === 'object' && !Array.isArray(first) && 'data' in first) {
    return (first as { data: unknown }).data
  }
  return first
}
