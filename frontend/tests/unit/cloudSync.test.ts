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
 *
 * Q1 2026-09 audit (pull-before-push):
 *  Pull helpers never journal-PUT. Sequenced await-pull-then-push already
 *  holds. A journal-page mount sequence with empty localStorage and a slow
 *  GET still PUTs trades:[] / notes:[] before the pull completes — P0
 *  empty-cloud guards do not cover that. See the Q1 describe block.
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
  initFullSync,
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

// ── Q1 2026-09: mount-push vs login-pull ──────────────────────────────────────
//
// Intended invariant: no journal PUT until a pull (initJournalSync /
// forceSyncFromCloud / initFullSync → initJournalSync) has completed.
//
// Call-site map (every frontend caller):
//
//   initFullSync
//     AuthContext hydrate (stored token+user)     — fire-and-forget
//     AuthContext hydrate (token, /me rehydrate)  — fire-and-forget
//     AuthContext.login                           — fire-and-forget
//     AuthContext.register                        — fire-and-forget
//     PersistentNav SyncIndicator click           — awaited (manual)
//
//   initJournalSync
//     initFullSync (above)
//     journal/page.tsx token effect               — not awaited; then() reloads UI
//
//   forceSyncFromCloud
//     journal/page.tsx "Sync from Cloud" button   — awaited, then reloads UI
//
//   debouncedSyncJournal
//     journal/page.tsx trades/notes effect        — mount + every mutation
//     journal/page.tsx applyExpandedEdit autosave — trade edit (notes omitted)
//
// Pull helpers never journal-PUT. The ungated path is the journal mount
// effect calling debouncedSyncJournal while a pull GET is still in flight.
// 1.5s debounce is a burst coalescer, not a pullComplete gate.

type JournalFetchCtl = {
  journalPuts: { data?: { trades?: unknown[]; notes?: unknown[] } }[]
  journalGets: number
  getCompleted: boolean
  releaseGet: () => void
}

let q1PendingReleases: Array<() => void> = []

function mockJournalFetch(opts: {
  getPayload: unknown
  hangGet?: boolean
}): JournalFetchCtl {
  let releaseGet = () => {}
  const getGate = opts.hangGet
    ? new Promise<void>(resolve => { releaseGet = resolve })
    : Promise.resolve()

  if (opts.hangGet) q1PendingReleases.push(() => releaseGet())

  const ctl: JournalFetchCtl = {
    journalPuts: [],
    journalGets: 0,
    getCompleted: false,
    releaseGet: () => releaseGet(),
  }

  ;(global as any).fetch = jest.fn(async (url: string, init?: { method?: string; body?: string }) => {
    const method = init?.method || 'GET'
    const isJournal = String(url).includes('/api/user/data/journal')
    if (isJournal && method === 'PUT') {
      ctl.journalPuts.push(JSON.parse(init?.body || '{}'))
      return { ok: true, json: async () => ({}) }
    }
    if (isJournal && method === 'GET') {
      ctl.journalGets += 1
      await getGate
      ctl.getCompleted = true
      return { ok: true, json: async () => ({ data: opts.getPayload }) }
    }
    // settings / portfolio / watchlist for initFullSync — never journal.
    return { ok: true, json: async () => ({ data: null }) }
  })

  return ctl
}

describe('Q1 — journal pull must complete before any journal push', () => {
  afterEach(() => {
    q1PendingReleases.forEach(fn => fn())
    q1PendingReleases = []
    jest.useRealTimers()
  })

  test('initJournalSync issues journal GET only (never PUT)', async () => {
    const ctl = mockJournalFetch({
      getPayload: { trades: [{ id: 'cloud1' }], notes: [{ id: 'cloudNote' }] },
    })
    await initJournalSync('tok')
    expect(ctl.journalGets).toBe(1)
    expect(ctl.journalPuts).toHaveLength(0)
  })

  test('forceSyncFromCloud issues journal GET only (never PUT)', async () => {
    lsSetJSON(TOKEN_KEY, 'tok')
    const ctl = mockJournalFetch({
      getPayload: { trades: [{ id: 'cloud1' }], notes: [{ id: 'n1' }] },
    })
    await forceSyncFromCloud()
    expect(ctl.journalGets).toBe(1)
    expect(ctl.journalPuts).toHaveLength(0)
  })

  test('initFullSync does not journal-PUT even when local journal is empty and cloud is slow', async () => {
    jest.useFakeTimers()
    lsSetJSON(TOKEN_KEY, 'tok')
    const ctl = mockJournalFetch({
      getPayload: { trades: [{ id: 'cloud1' }], notes: [{ id: 'cloudNote' }] },
      hangGet: true,
    })

    const pull = initFullSync('tok')
    await jest.advanceTimersByTimeAsync(1600)
    expect(ctl.getCompleted).toBe(false)
    expect(ctl.journalPuts).toHaveLength(0)

    ctl.releaseGet()
    await pull
    await jest.advanceTimersByTimeAsync(1600)
    expect(ctl.journalPuts).toHaveLength(0)
    jest.useRealTimers()
  })

  test('sequenced callers already hold the order: await pull, then push → GET before PUT', async () => {
    jest.useFakeTimers()
    lsSetJSON(TOKEN_KEY, 'tok')
    const cloud = { trades: [{ id: 'cloud1' }], notes: [{ id: 'cloudNote' }] }
    const ctl = mockJournalFetch({ getPayload: cloud })

    await initJournalSync('tok')
    expect(ctl.getCompleted).toBe(true)
    expect(ctl.journalPuts).toHaveLength(0)

    debouncedSyncJournal(lsGetJSON(TRADES_KEY), lsGetJSON(NOTES_KEY))
    await jest.advanceTimersByTimeAsync(1600)

    expect(ctl.journalPuts).toHaveLength(1)
    expect(ctl.journalPuts[0].data?.trades).toEqual([{ id: 'cloud1' }])
    jest.useRealTimers()
  })

  test('fast pull + post-pull UI reload cancels the empty mount-push (debounce reset)', async () => {
    // Lucky path today: GET returns before 1.5s, journal page reloads from
    // localStorage and re-calls debouncedSyncJournal with cloud data, which
    // clears the empty-local timer. Not a gate — just debounce winning.
    jest.useFakeTimers()
    lsSetJSON(TOKEN_KEY, 'tok')
    const cloud = { trades: [{ id: 'cloud1' }], notes: [{ id: 'cloudNote' }] }
    const ctl = mockJournalFetch({ getPayload: cloud })

    const pull = initJournalSync('tok')
    debouncedSyncJournal([], [])
    await pull
    debouncedSyncJournal(lsGetJSON(TRADES_KEY), lsGetJSON(NOTES_KEY))
    await jest.advanceTimersByTimeAsync(1600)

    expect(ctl.journalPuts).toHaveLength(1)
    expect(ctl.journalPuts[0].data?.trades).toEqual([{ id: 'cloud1' }])
    expect(ctl.journalPuts[0].data?.notes).toEqual([{ id: 'cloudNote' }])
    jest.useRealTimers()
  })

  test('Q1 hole reproduced: empty local + slow pull PUTs empty journal while GET is in flight', async () => {
    // Observed current behavior (not the spec). Invert / delete this when a
    // pullComplete gate lands; the test.failing below is the intended lock.
    jest.useFakeTimers()
    lsSetJSON(TOKEN_KEY, 'tok')
    const cloud = { trades: [{ id: 'cloud1' }], notes: [{ id: 'cloudNote' }] }
    const ctl = mockJournalFetch({ getPayload: cloud, hangGet: true })

    const full = initFullSync('tok')
    const pagePull = initJournalSync('tok')
    debouncedSyncJournal([], [])
    await jest.advanceTimersByTimeAsync(1600)

    expect(ctl.getCompleted).toBe(false)
    expect(ctl.journalPuts).toHaveLength(1)
    expect(ctl.journalPuts[0].data?.trades).toEqual([])
    expect(ctl.journalPuts[0].data?.notes).toEqual([])

    ctl.releaseGet()
    await full
    await pagePull
    jest.useRealTimers()
  })

  // Intended invariant — FAILS on current code (Q1 hole). Jest test.failing
  // keeps CI green until Bolt/Erick ship a pullComplete gate; remove .failing
  // when the assertion starts passing.
  //
  // Repro (empty localStorage, cold start, slow cloud GET > 1.5s):
  //   AuthContext fires initFullSync (not awaited) and the journal page
  //   token effect fires initJournalSync (not awaited), then the trades/notes
  //   effect calls debouncedSyncJournal(local, possibly []). After 1.5s a
  //   journal PUT goes out while GET is still in flight. P0 empty-cloud
  //   guards do not stop an empty-local PUT from wiping cloud.
  test.failing('empty local + slow pull: no journal PUT until pull GET completes (journal mount sequence)', async () => {
    jest.useFakeTimers()
    lsSetJSON(TOKEN_KEY, 'tok')
    // Cold start / fresh device: no local trades or notes.
    const cloud = { trades: [{ id: 'cloud1' }], notes: [{ id: 'cloudNote' }] }
    const ctl = mockJournalFetch({ getPayload: cloud, hangGet: true })

    // AuthContext hydrate / login / register: pull in background.
    const full = initFullSync('tok')
    // journal/page.tsx token effect: second pull, also not awaited.
    const pagePull = initJournalSync('tok')
    // journal/page.tsx trades/notes effect after initialLoadDone (local []).
    debouncedSyncJournal([], [])

    await jest.advanceTimersByTimeAsync(1600)

    expect(ctl.getCompleted).toBe(false)
    expect(ctl.journalPuts).toHaveLength(0)

    ctl.releaseGet()
    await full
    await pagePull
    jest.useRealTimers()
  })
})
