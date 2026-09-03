/**
 * cloudSync.test.ts
 *
 * Regression tests for two P0 data-integrity bugs (2026-09):
 *
 *  #1 Cloud pulls (initJournalSync / forceSyncFromCloud) must NOT wipe local
 *     trades/notes when the cloud payload is missing those fields or they are
 *     empty. Previously `cloudData.trades ?? []` overwrote local storage with
 *     an empty array whenever the cloud record existed but lacked trades/notes,
 *     silently destroying the user's journal.
 *
 *  #2 Journal pushes (debouncedSyncJournal) must send the user's CURRENT notes,
 *     never a hardcoded empty array. One call site pushed `notes: []`, which
 *     wiped every note in the cloud on the next mutation.
 */

const TRADES_KEY = 'cg_journal_trades'
const NOTES_KEY  = 'cg_journal_notes'
const TOKEN_KEY  = 'cg_token'

const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (k: string) => (k in store ? store[k] : null),
    setItem: (k: string, v: string) => { store[k] = String(v) },
    removeItem: (k: string) => { delete store[k] },
    clear: () => { store = {} },
    get length() { return Object.keys(store).length },
    key: (i: number) => Object.keys(store)[i] ?? null,
  }
})()
Object.defineProperty(window, 'localStorage', { value: localStorageMock, configurable: true })
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, configurable: true })

import {
  initJournalSync,
  forceSyncFromCloud,
  debouncedSyncJournal,
} from '../../app/utils/cloudSync'

function mockCloudGet(payload: unknown) {
  ;(global as any).fetch = jest.fn(async (_url: string, opts?: { method?: string }) => {
    if (!opts || !opts.method || opts.method === 'GET') {
      return { ok: true, json: async () => ({ data: payload }) }
    }
    return { ok: true, json: async () => ({}) }
  })
}

function lsSetJSON(key: string, val: unknown) {
  localStorageMock.setItem(key, JSON.stringify(val))
}
function lsGetJSON(key: string) {
  const raw = localStorageMock.getItem(key)
  return raw ? JSON.parse(raw) : null
}

beforeEach(() => {
  localStorageMock.clear()
  jest.clearAllMocks()
})

describe('P0 #1 — cloud pull must not wipe local trades/notes', () => {
  test('initJournalSync preserves local trades/notes when cloud omits those fields', async () => {
    lsSetJSON(TRADES_KEY, [{ id: 't1', symbol: 'AAPL' }])
    lsSetJSON(NOTES_KEY, [{ id: 'n1', content: 'keep me' }])
    // Cloud record exists but carries only templates — no trades/notes keys.
    mockCloudGet({ templates: [{ id: 'tpl1' }] })

    await initJournalSync('tok')

    expect(lsGetJSON(TRADES_KEY)).toEqual([{ id: 't1', symbol: 'AAPL' }])
    expect(lsGetJSON(NOTES_KEY)).toEqual([{ id: 'n1', content: 'keep me' }])
  })

  test('forceSyncFromCloud preserves local trades/notes when cloud fields are empty arrays', async () => {
    lsSetJSON(TOKEN_KEY, 'tok')
    lsSetJSON(TRADES_KEY, [{ id: 't1' }, { id: 't2' }])
    lsSetJSON(NOTES_KEY, [{ id: 'n1' }])
    mockCloudGet({ trades: [], notes: [] })

    await forceSyncFromCloud()

    expect(lsGetJSON(TRADES_KEY)).toEqual([{ id: 't1' }, { id: 't2' }])
    expect(lsGetJSON(NOTES_KEY)).toEqual([{ id: 'n1' }])
  })

  test('cloud with real trades/notes still overwrites local (source-of-truth path intact)', async () => {
    lsSetJSON(TRADES_KEY, [{ id: 'local-only' }])
    lsSetJSON(NOTES_KEY, [{ id: 'local-note' }])
    mockCloudGet({ trades: [{ id: 'cloud1' }], notes: [{ id: 'cloudNote' }] })

    await initJournalSync('tok')

    expect(lsGetJSON(TRADES_KEY)).toEqual([{ id: 'cloud1' }])
    expect(lsGetJSON(NOTES_KEY)).toEqual([{ id: 'cloudNote' }])
  })
})

describe('P0 #2 — journal push must send current notes, never hardcoded []', () => {
  beforeEach(() => { jest.useFakeTimers() })
  afterEach(() => { jest.useRealTimers() })

  test('debouncedSyncJournal with notes omitted sends current notes from storage (not [])', async () => {
    lsSetJSON(TOKEN_KEY, 'tok')
    lsSetJSON(NOTES_KEY, [{ id: 'n1', content: 'my note' }])

    let putBody: any = null
    ;(global as any).fetch = jest.fn(async (_url: string, opts?: { method?: string; body?: string }) => {
      if (opts?.method === 'PUT') { putBody = JSON.parse(opts.body || '{}') }
      return { ok: true, json: async () => ({}) }
    })

    // Mirrors the fixed call site: trades pushed without an explicit notes arg.
    debouncedSyncJournal([{ id: 't1' }])
    await jest.advanceTimersByTimeAsync(1600)

    expect(putBody).not.toBeNull()
    expect(putBody.data.notes).toEqual([{ id: 'n1', content: 'my note' }])
    expect(putBody.data.trades).toEqual([{ id: 't1' }])
  })

  test('debouncedSyncJournal respects an explicitly provided notes array', async () => {
    lsSetJSON(TOKEN_KEY, 'tok')
    lsSetJSON(NOTES_KEY, [{ id: 'stale' }])

    let putBody: any = null
    ;(global as any).fetch = jest.fn(async (_url: string, opts?: { method?: string; body?: string }) => {
      if (opts?.method === 'PUT') { putBody = JSON.parse(opts.body || '{}') }
      return { ok: true, json: async () => ({}) }
    })

    debouncedSyncJournal([{ id: 't1' }], [{ id: 'n2', content: 'explicit' }])
    await jest.advanceTimersByTimeAsync(1600)

    expect(putBody.data.notes).toEqual([{ id: 'n2', content: 'explicit' }])
  })
})
