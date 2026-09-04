/**
 * Q2 — merge journal blobs by stable id so a 409 retry does not drop
 * trades/notes present on only one device. Same-id rows: incoming (the
 * device that is retrying) wins. Deletion sync is Q3 (tombstones) — a
 * conflict merge unions rows; it does not apply tombstones.
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
  dashboardWatchlist?: unknown[]
  customTickers?: unknown
  tickerPrefs?: unknown
  alertPrefs?: unknown
  [key: string]: unknown
}

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

export function mergeByStableId(incoming: unknown[], server: unknown[]): unknown[] {
  const serverById = new Map<string, unknown>()
  for (const item of server) {
    const id = itemId(item)
    if (id) serverById.set(id, item)
  }
  const seen = new Set<string>()
  const out: unknown[] = []
  for (const item of incoming) {
    const id = itemId(item)
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
  return merged
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
