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
 * Q1 2026-09 (pullComplete gate):
 *  No journal PUT until a pull has settled for the current token. Debounce
 *  is not a pull gate; cloudSync.ts holds a pullComplete flag. See Q1.
 *
 * Q1 residual: failed GET still opens the gate (local data can push) but
 * empty wipe PUTs are skipped until a successful GET marks a cloud snapshot.
 *
 * Q2 2026-09 (updated_at precondition + merge-on-409):
 *  Journal PUT sends expectedUpdatedAt / If-Match from the last GET.
 *  A 409 merges by stable id and retries so two-device edits do not
 *  silently drop trades present on only one side.
 *
 * Q3 2026-09 (tombstones / null sentinels):
 *  Intentional deletes write `_deleted` on the journal blob so the last
 *  template/trade/note stays deleted on the other device. Bare empty
 *  arrays without tombstones still do not wipe non-empty local (Q9).
 */

const TRADES_KEY = 'cg_journal_trades'
const NOTES_KEY  = 'cg_journal_notes'
const TEMPLATES_KEY = 'cg_note_templates'
const TOKEN_KEY  = 'cg_token'
const WATCHLIST_KEY = 'cg_wl'

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
  initWatchlistSync,
  hydrateWatchlistFromApi,
  resetJournalPullGate,
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
function lsSetToken(tok: string) {
  // Auth writes cg_token via setItem (raw), not JSON.stringify.
  localStorageMock.setItem(TOKEN_KEY, tok)
}
function lsGetJSON(key: string) {
  const raw = localStorageMock.getItem(key)
  return raw ? JSON.parse(raw) : null
}

beforeEach(() => {
  localStorageMock.clear()
  jest.clearAllMocks()
  resetJournalPullGate()
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
    lsSetToken('tok')
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
    lsSetToken('tok')
    lsSetJSON(NOTES_KEY, [{ id: 'n1', content: 'my note' }])

    let putBody: any = null
    ;(global as any).fetch = jest.fn(async (_url: string, opts?: { method?: string; body?: string }) => {
      if (opts?.method === 'PUT') { putBody = JSON.parse(opts.body || '{}') }
      return { ok: true, json: async () => ({ data: {} }) }
    })

    await initJournalSync('tok')
    // Mirrors the fixed call site: trades pushed without an explicit notes arg.
    debouncedSyncJournal([{ id: 't1' }])
    await jest.advanceTimersByTimeAsync(1600)

    expect(putBody).not.toBeNull()
    expect(putBody.data.notes).toEqual([{ id: 'n1', content: 'my note' }])
    expect(putBody.data.trades).toEqual([{ id: 't1' }])
  })

  test('debouncedSyncJournal respects an explicitly provided notes array', async () => {
    lsSetToken('tok')
    lsSetJSON(NOTES_KEY, [{ id: 'stale' }])

    let putBody: any = null
    ;(global as any).fetch = jest.fn(async (_url: string, opts?: { method?: string; body?: string }) => {
      if (opts?.method === 'PUT') { putBody = JSON.parse(opts.body || '{}') }
      return { ok: true, json: async () => ({ data: {} }) }
    })

    await initJournalSync('tok')
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
// Pull helpers never journal-PUT. debouncedSyncJournal waits for pullComplete
// (and re-reads localStorage if the call started before the pull settled).

type JournalFetchCtl = {
  journalPuts: { data?: { trades?: unknown[]; notes?: unknown[] } }[]
  journalGets: number
  getCompleted: boolean
  releaseGet: () => void
}

let q1PendingReleases: Array<() => void> = []

function mockJournalFetch(opts: {
  getPayload?: unknown
  hangGet?: boolean
  getFail?: 'http' | 'network' | 'auth'
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
      if (opts.getFail === 'network') {
        throw new Error('network down')
      }
      if (opts.getFail === 'http') {
        return { ok: false, status: 500, json: async () => ({ error: 'server' }) }
      }
      if (opts.getFail === 'auth') {
        return { ok: false, status: 401, json: async () => ({ error: 'unauthorized' }) }
      }
      return { ok: true, json: async () => ({ data: opts.getPayload }) }
    }
    // settings / portfolio / watchlist for initFullSync — never journal.
    return { ok: true, json: async () => ({ data: null }) }
  })

  return ctl
}

/** Independent hang per journal GET — Auth initFullSync vs page initJournalSync. */
function mockIndependentJournalGets(getPayload: unknown) {
  const releaseGet: Array<() => void> = []
  const getCompleted: boolean[] = []
  const journalPuts: { data?: { trades?: unknown[]; notes?: unknown[] } }[] = []
  let getIndex = 0

  ;(global as any).fetch = jest.fn(async (url: string, init?: { method?: string; body?: string }) => {
    const method = init?.method || 'GET'
    const isJournal = String(url).includes('/api/user/data/journal')
    if (isJournal && method === 'PUT') {
      journalPuts.push(JSON.parse(init?.body || '{}'))
      return { ok: true, json: async () => ({}) }
    }
    if (isJournal && method === 'GET') {
      const idx = getIndex++
      getCompleted[idx] = false
      await new Promise<void>(resolve => {
        releaseGet[idx] = resolve
        q1PendingReleases.push(resolve)
      })
      getCompleted[idx] = true
      return { ok: true, json: async () => ({ data: getPayload }) }
    }
    return { ok: true, json: async () => ({ data: null }) }
  })

  return {
    journalPuts,
    getCompleted,
    releaseGet: (i: number) => { releaseGet[i]?.() },
    journalGets: () => getIndex,
  }
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
    lsSetToken('tok')
    const ctl = mockJournalFetch({
      getPayload: { trades: [{ id: 'cloud1' }], notes: [{ id: 'n1' }] },
    })
    await forceSyncFromCloud()
    expect(ctl.journalGets).toBe(1)
    expect(ctl.journalPuts).toHaveLength(0)
  })

  test('initFullSync does not journal-PUT even when local journal is empty and cloud is slow', async () => {
    jest.useFakeTimers()
    lsSetToken('tok')
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
    lsSetToken('tok')
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
    // Journal page then() reloads from localStorage and re-calls
    // debouncedSyncJournal with cloud data, clearing the empty-local timer.
    jest.useFakeTimers()
    lsSetToken('tok')
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

  test('empty local + slow pull: no journal PUT until pull GET completes (journal mount sequence)', async () => {
    jest.useFakeTimers()
    lsSetToken('tok')
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

  test('pre-pull empty mount-push waits, then PUTs post-pull storage (not [])', async () => {
    jest.useFakeTimers()
    lsSetToken('tok')
    const cloud = { trades: [{ id: 'cloud1' }], notes: [{ id: 'cloudNote' }] }
    const ctl = mockJournalFetch({ getPayload: cloud, hangGet: true })

    const pull = initJournalSync('tok')
    debouncedSyncJournal([], [])
    await jest.advanceTimersByTimeAsync(1600)
    expect(ctl.journalPuts).toHaveLength(0)

    ctl.releaseGet()
    await pull
    await Promise.resolve()
    await Promise.resolve()

    expect(ctl.journalPuts).toHaveLength(1)
    expect(ctl.journalPuts[0].data?.trades).toEqual([{ id: 'cloud1' }])
    expect(ctl.journalPuts[0].data?.notes).toEqual([{ id: 'cloudNote' }])
    jest.useRealTimers()
  })

  test('token change re-closes the gate: hung GET for the new token cannot empty-PUT', async () => {
    jest.useFakeTimers()
    lsSetToken('tok1')
    const first = mockJournalFetch({
      getPayload: { trades: [{ id: 'a' }], notes: [{ id: 'n' }] },
    })
    await initJournalSync('tok1')
    expect(first.journalPuts).toHaveLength(0)

    lsSetToken('tok2')
    const ctl = mockJournalFetch({
      getPayload: { trades: [{ id: 'b' }], notes: [{ id: 'm' }] },
      hangGet: true,
    })
    const remount = initJournalSync('tok2')
    debouncedSyncJournal([], [])
    await jest.advanceTimersByTimeAsync(1600)

    expect(ctl.getCompleted).toBe(false)
    expect(ctl.journalPuts).toHaveLength(0)

    ctl.releaseGet()
    await remount
    jest.useRealTimers()
  })

  test('logout reset + same-token remount: hung GET cannot empty-PUT', async () => {
    jest.useFakeTimers()
    lsSetToken('tok')
    const first = mockJournalFetch({
      getPayload: { trades: [{ id: 'a' }], notes: [{ id: 'n' }] },
    })
    await initJournalSync('tok')
    expect(first.journalPuts).toHaveLength(0)

    resetJournalPullGate()
    const ctl = mockJournalFetch({
      getPayload: { trades: [{ id: 'b' }], notes: [{ id: 'm' }] },
      hangGet: true,
    })
    const remount = initJournalSync('tok')
    debouncedSyncJournal([], [])
    await jest.advanceTimersByTimeAsync(1600)

    expect(ctl.getCompleted).toBe(false)
    expect(ctl.journalPuts).toHaveLength(0)

    ctl.releaseGet()
    await remount
    jest.useRealTimers()
  })

  test('two independent GETs: Auth pull completing must not open the gate while page GET is in flight', async () => {
    // Nova blocker: journal first-paint !token reset zeroed Auth's inFlight.
    // Auth endJournalPull then opened the gate while the page GET still hung.
    // After fix: remount sequence keeps both pulls counted — complete only
    // the first GET, assert 0 PUTs until the second GET settles, and no empty wipe.
    jest.useFakeTimers()
    lsSetToken('tok')
    const cloud = { trades: [{ id: 'cloud1' }], notes: [{ id: 'cloudNote' }] }
    const ctl = mockIndependentJournalGets(cloud)

    const full = initFullSync('tok')
    const pagePull = initJournalSync('tok')
    debouncedSyncJournal([], [])
    await jest.advanceTimersByTimeAsync(1600)

    expect(ctl.journalGets()).toBe(2)
    expect(ctl.getCompleted[0]).toBe(false)
    expect(ctl.getCompleted[1]).toBe(false)
    expect(ctl.journalPuts).toHaveLength(0)

    ctl.releaseGet(0)
    await full
    await Promise.resolve()
    await Promise.resolve()

    expect(ctl.getCompleted[0]).toBe(true)
    expect(ctl.getCompleted[1]).toBe(false)
    expect(ctl.journalPuts).toHaveLength(0)

    ctl.releaseGet(1)
    await pagePull
    await Promise.resolve()
    await Promise.resolve()

    const emptyWipe = ctl.journalPuts.some(p =>
      Array.isArray(p.data?.trades) && p.data.trades.length === 0 &&
      Array.isArray(p.data?.notes) && p.data.notes.length === 0
    )
    expect(emptyWipe).toBe(false)
    if (ctl.journalPuts.length > 0) {
      expect(ctl.journalPuts[0].data?.trades).toEqual([{ id: 'cloud1' }])
      expect(ctl.journalPuts[0].data?.notes).toEqual([{ id: 'cloudNote' }])
    }
    jest.useRealTimers()
  })
})

// ── Q1 residual: failed GET must not empty-wipe cloud ─────────────────────────
//
// PR #9 opens the gate after a failed/empty GET so a user with real local
// data can still push. Residual: empty localStorage + failed journal GET
// → gate opens → debouncedSyncJournal PUTs trades:[] / notes:[] / templates:[]
// and wipes non-empty cloud. Skip that empty wipe until a successful GET
// marks a cloud snapshot (or the user later has real local trades/notes).

describe('Q1 residual — failed GET must not empty-wipe cloud', () => {
  afterEach(() => {
    q1PendingReleases.forEach(fn => fn())
    q1PendingReleases = []
    jest.useRealTimers()
  })

  test.each(['http', 'network', 'auth'] as const)(
    'failed %s GET + empty local: 0 journal PUTs of empty wipe',
    async (getFail) => {
      jest.useFakeTimers()
      lsSetToken('tok')
      const ctl = mockJournalFetch({ getFail })

      const pull = initJournalSync('tok')
      debouncedSyncJournal([], [])
      await pull
      await jest.advanceTimersByTimeAsync(1600)
      await Promise.resolve()
      await Promise.resolve()

      const emptyWipe = ctl.journalPuts.filter(p =>
        Array.isArray(p.data?.trades) && p.data.trades.length === 0 &&
        Array.isArray(p.data?.notes) && p.data.notes.length === 0
      )
      expect(ctl.journalGets).toBe(1)
      expect(ctl.getCompleted).toBe(true)
      expect(ctl.journalPuts).toHaveLength(0)
      expect(emptyWipe).toHaveLength(0)
      jest.useRealTimers()
    },
  )

  test('failed GET + non-empty local: push still allowed after gate settles', async () => {
    jest.useFakeTimers()
    lsSetToken('tok')
    lsSetJSON(TRADES_KEY, [{ id: 'local1', symbol: 'ES' }])
    lsSetJSON(NOTES_KEY, [{ id: 'n1', content: 'keep' }])
    const ctl = mockJournalFetch({ getFail: 'http' })

    await initJournalSync('tok')
    expect(lsGetJSON(TRADES_KEY)).toEqual([{ id: 'local1', symbol: 'ES' }])
    expect(lsGetJSON(NOTES_KEY)).toEqual([{ id: 'n1', content: 'keep' }])
    expect(ctl.journalPuts).toHaveLength(0)

    debouncedSyncJournal(lsGetJSON(TRADES_KEY), lsGetJSON(NOTES_KEY))
    await jest.advanceTimersByTimeAsync(1600)
    await Promise.resolve()
    await Promise.resolve()

    expect(ctl.journalPuts).toHaveLength(1)
    expect(ctl.journalPuts[0].data?.trades).toEqual([{ id: 'local1', symbol: 'ES' }])
    expect(ctl.journalPuts[0].data?.notes).toEqual([{ id: 'n1', content: 'keep' }])
    jest.useRealTimers()
  })

  test('failed GET + empty local, then real local trade: push is allowed', async () => {
    jest.useFakeTimers()
    lsSetToken('tok')
    const ctl = mockJournalFetch({ getFail: 'network' })

    await initJournalSync('tok')
    debouncedSyncJournal([], [])
    await jest.advanceTimersByTimeAsync(1600)
    expect(ctl.journalPuts).toHaveLength(0)

    lsSetJSON(TRADES_KEY, [{ id: 't-new' }])
    debouncedSyncJournal([{ id: 't-new' }], [])
    await jest.advanceTimersByTimeAsync(1600)
    await Promise.resolve()
    await Promise.resolve()

    expect(ctl.journalPuts).toHaveLength(1)
    expect(ctl.journalPuts[0].data?.trades).toEqual([{ id: 't-new' }])
    jest.useRealTimers()
  })

  test('successful empty GET + empty local: empty PUT still allowed (legit empty cloud)', async () => {
    // Distinguishes failed GET (no snapshot) from a 200 with empty trades/notes.
    // P0 overwrite guards still apply on pull; this only locks that a confident
    // empty-cloud snapshot does not inherit the failed-GET empty-PUT skip.
    jest.useFakeTimers()
    lsSetToken('tok')
    const ctl = mockJournalFetch({ getPayload: { trades: [], notes: [], templates: [] } })

    await initJournalSync('tok')
    debouncedSyncJournal([], [])
    await jest.advanceTimersByTimeAsync(1600)
    await Promise.resolve()
    await Promise.resolve()

    expect(ctl.journalGets).toBe(1)
    expect(ctl.journalPuts).toHaveLength(1)
    expect(ctl.journalPuts[0].data?.trades).toEqual([])
    expect(ctl.journalPuts[0].data?.notes).toEqual([])
    jest.useRealTimers()
  })

  test('successful empty GET + non-empty local: P0 pull guard holds, local can still push', async () => {
    jest.useFakeTimers()
    lsSetToken('tok')
    lsSetJSON(TRADES_KEY, [{ id: 'local-keep' }])
    lsSetJSON(NOTES_KEY, [{ id: 'note-keep' }])
    const ctl = mockJournalFetch({ getPayload: { trades: [], notes: [] } })

    await initJournalSync('tok')
    expect(lsGetJSON(TRADES_KEY)).toEqual([{ id: 'local-keep' }])
    expect(lsGetJSON(NOTES_KEY)).toEqual([{ id: 'note-keep' }])

    debouncedSyncJournal(lsGetJSON(TRADES_KEY), lsGetJSON(NOTES_KEY))
    await jest.advanceTimersByTimeAsync(1600)
    await Promise.resolve()
    await Promise.resolve()

    expect(ctl.journalPuts).toHaveLength(1)
    expect(ctl.journalPuts[0].data?.trades).toEqual([{ id: 'local-keep' }])
    expect(ctl.journalPuts[0].data?.notes).toEqual([{ id: 'note-keep' }])
    jest.useRealTimers()
  })
})

// ── Q2: last-write-wins journal blob ──────────────────────────────────────────
//
// GET already returns updated_at (portfolio already reads it; journal did not).
// After Q2, journal PUT sends that stamp. A stale stamp → 409 + server copy;
// client merges by id and retries. Trades present on only one device survive.

type Q2Put = {
  data?: { trades?: unknown[]; notes?: unknown[] }
  expectedUpdatedAt?: string | null
  headers?: Record<string, string>
}

function mockJournalVersioned(opts: {
  getPayload: unknown
  getUpdatedAt: string | null
  conflictOnFirstPut?: { serverPayload: unknown; serverUpdatedAt: string; retryUpdatedAt: string }
}) {
  const puts: Q2Put[] = []
  let putCount = 0
  ;(global as any).fetch = jest.fn(async (url: string, init?: { method?: string; body?: string; headers?: Record<string, string> }) => {
    const method = init?.method || 'GET'
    const isJournal = String(url).includes('/api/user/data/journal')
    if (isJournal && method === 'PUT') {
      putCount += 1
      const body = JSON.parse(init?.body || '{}')
      puts.push({ ...body, headers: init?.headers || {} })
      const conflict = opts.conflictOnFirstPut
      if (conflict && putCount === 1) {
        return {
          ok: false,
          status: 409,
          json: async () => ({
            error: 'version_conflict',
            type: 'journal',
            updated_at: conflict.serverUpdatedAt,
            data: { data: conflict.serverPayload },
          }),
        }
      }
      const updated_at = opts.conflictOnFirstPut && putCount > 1
        ? opts.conflictOnFirstPut.retryUpdatedAt
        : (opts.getUpdatedAt || '2026-09-04T00:00:01.000Z')
      return { ok: true, status: 200, json: async () => ({ type: 'journal', updated_at }) }
    }
    if (isJournal && method === 'GET') {
      return {
        ok: true,
        json: async () => ({ data: opts.getPayload, updated_at: opts.getUpdatedAt }),
      }
    }
    return { ok: true, json: async () => ({ data: null }) }
  })
  return { puts }
}

describe('Q2 — journal PUT version precondition and 409 merge', () => {
  beforeEach(() => { jest.useFakeTimers() })
  afterEach(() => { jest.useRealTimers() })

  test('after GET, journal PUT sends expectedUpdatedAt and If-Match from updated_at', async () => {
    lsSetToken('tok')
    const t0 = '2026-09-03T12:00:00.000Z'
    const ctl = mockJournalVersioned({
      getPayload: { trades: [{ id: 'cloud1' }], notes: [{ id: 'n1' }] },
      getUpdatedAt: t0,
    })

    await initJournalSync('tok')
    debouncedSyncJournal(lsGetJSON(TRADES_KEY), lsGetJSON(NOTES_KEY))
    await jest.advanceTimersByTimeAsync(1600)
    await Promise.resolve()
    await Promise.resolve()

    expect(ctl.puts).toHaveLength(1)
    expect(ctl.puts[0].expectedUpdatedAt).toBe(t0)
    expect(ctl.puts[0].headers?.['X-Expected-Updated-At']).toBe(t0)
    expect(ctl.puts[0].headers?.['If-Match']).toBe(`"${t0}"`)
    expect(ctl.puts[0].data?.trades).toEqual([{ id: 'cloud1' }])
  })

  test('two-device 409: merge-retry keeps trades present on only one side', async () => {
    lsSetToken('tok')
    const t0 = '2026-09-03T12:00:00.000Z'
    const tA = '2026-09-03T12:00:05.000Z'
    const tRetry = '2026-09-03T12:00:09.000Z'
    // Device B pulled shared+B's view as just `shared` at t0, then added trade-B.
    // Device A already wrote shared+trade-A at tA.
    lsSetJSON(TRADES_KEY, [{ id: 'shared' }, { id: 'trade-B' }])
    lsSetJSON(NOTES_KEY, [{ id: 'note-B' }])
    const ctl = mockJournalVersioned({
      getPayload: { trades: [{ id: 'shared' }], notes: [] },
      getUpdatedAt: t0,
      conflictOnFirstPut: {
        serverPayload: {
          trades: [{ id: 'shared' }, { id: 'trade-A' }],
          notes: [{ id: 'note-A' }],
        },
        serverUpdatedAt: tA,
        retryUpdatedAt: tRetry,
      },
    })

    await initJournalSync('tok')
    // P0: non-empty cloud overwrites local with the GET payload (shared only).
    // Restore device-B local edits that happened after the pull (the race).
    lsSetJSON(TRADES_KEY, [{ id: 'shared' }, { id: 'trade-B' }])
    lsSetJSON(NOTES_KEY, [{ id: 'note-B' }])
    debouncedSyncJournal([{ id: 'shared' }, { id: 'trade-B' }], [{ id: 'note-B' }])
    await jest.advanceTimersByTimeAsync(1600)
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()

    expect(ctl.puts.length).toBe(2)
    expect(ctl.puts[0].expectedUpdatedAt).toBe(t0)
    expect(ctl.puts[1].expectedUpdatedAt).toBe(tA)
    const retryIds = (ctl.puts[1].data?.trades as { id: string }[]).map(t => t.id)
    expect(retryIds).toEqual(expect.arrayContaining(['shared', 'trade-A', 'trade-B']))
    expect(retryIds).toHaveLength(3)
    const retryNotes = (ctl.puts[1].data?.notes as { id: string }[]).map(n => n.id)
    expect(retryNotes).toEqual(expect.arrayContaining(['note-A', 'note-B']))
    expect(lsGetJSON(TRADES_KEY).map((t: { id: string }) => t.id)).toEqual(
      expect.arrayContaining(['shared', 'trade-A', 'trade-B']),
    )
  })

  test('409 merge does not re-enable empty overwrite of non-empty local (Q9)', async () => {
    lsSetToken('tok')
    const t0 = '2026-09-03T12:00:00.000Z'
    lsSetJSON(TRADES_KEY, [{ id: 'local-keep' }])
    lsSetJSON(NOTES_KEY, [{ id: 'note-keep' }])
    const ctl = mockJournalVersioned({
      getPayload: { trades: [], notes: [] },
      getUpdatedAt: t0,
      conflictOnFirstPut: {
        serverPayload: { trades: [], notes: [] },
        serverUpdatedAt: '2026-09-03T12:00:06.000Z',
        retryUpdatedAt: '2026-09-03T12:00:07.000Z',
      },
    })

    await initJournalSync('tok')
    expect(lsGetJSON(TRADES_KEY)).toEqual([{ id: 'local-keep' }])
    debouncedSyncJournal(lsGetJSON(TRADES_KEY), lsGetJSON(NOTES_KEY))
    await jest.advanceTimersByTimeAsync(1600)
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()

    expect(lsGetJSON(TRADES_KEY)).toEqual([{ id: 'local-keep' }])
    expect(lsGetJSON(NOTES_KEY)).toEqual([{ id: 'note-keep' }])
    const last = ctl.puts[ctl.puts.length - 1]
    expect(last.data?.trades).toEqual([{ id: 'local-keep' }])
  })
})

// ── Q3: tombstones so intentional deletes propagate ───────────────────────────

type Q3Put = {
  data?: {
    trades?: unknown[]
    notes?: unknown[]
    templates?: unknown[]
    _deleted?: { [coll: string]: Record<string, string | true | null> }
  }
  expectedUpdatedAt?: string | null
  headers?: Record<string, string>
}

function mockJournalQ3(opts: {
  getPayload: unknown
  getUpdatedAt?: string | null
  conflictOnFirstPut?: { serverPayload: unknown; serverUpdatedAt: string; retryUpdatedAt: string }
}) {
  const puts: Q3Put[] = []
  let putCount = 0
  ;(global as any).fetch = jest.fn(async (url: string, init?: { method?: string; body?: string; headers?: Record<string, string> }) => {
    const method = init?.method || 'GET'
    const isJournal = String(url).includes('/api/user/data/journal')
    if (isJournal && method === 'PUT') {
      putCount += 1
      const body = JSON.parse(init?.body || '{}')
      puts.push({ ...body, headers: init?.headers || {} })
      const conflict = opts.conflictOnFirstPut
      if (conflict && putCount === 1) {
        return {
          ok: false,
          status: 409,
          json: async () => ({
            error: 'version_conflict',
            type: 'journal',
            updated_at: conflict.serverUpdatedAt,
            data: { data: conflict.serverPayload },
          }),
        }
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ type: 'journal', updated_at: opts.getUpdatedAt || '2026-09-04T00:00:01.000Z' }),
      }
    }
    if (isJournal && method === 'GET') {
      return {
        ok: true,
        json: async () => ({ data: opts.getPayload, updated_at: opts.getUpdatedAt || '2026-09-04T00:00:00.000Z' }),
      }
    }
    return { ok: true, json: async () => ({ data: null }) }
  })
  return { puts }
}

describe('Q3 — journal deletion tombstones', () => {
  beforeEach(() => { jest.useFakeTimers() })
  afterEach(() => { jest.useRealTimers() })

  test('delete last template on A: PUT sends empty templates + _deleted tombstone', async () => {
    lsSetToken('tok')
    const ctl = mockJournalQ3({
      getPayload: { templates: [{ id: 'tpl-1', name: 'Plan' }], trades: [{ id: 't1' }], notes: [] },
      getUpdatedAt: '2026-09-04T00:00:00.000Z',
    })

    await initJournalSync('tok')
    expect(lsGetJSON(TEMPLATES_KEY)).toEqual([{ id: 'tpl-1', name: 'Plan' }])

    lsSetJSON(TEMPLATES_KEY, [])
    debouncedSyncJournal([{ id: 't1' }], [], [])
    await jest.advanceTimersByTimeAsync(1600)
    await Promise.resolve()
    await Promise.resolve()

    expect(ctl.puts).toHaveLength(1)
    expect(ctl.puts[0].data?.templates).toEqual([])
    expect(ctl.puts[0].data?._deleted?.templates?.['tpl-1']).toBeTruthy()
  })

  test('device B pull: last-template tombstone removes that id; other local rows stay', async () => {
    lsSetJSON(TEMPLATES_KEY, [{ id: 'tpl-1', name: 'Plan' }, { id: 'tpl-local', name: 'Mine' }])
    lsSetJSON(TRADES_KEY, [{ id: 'local-trade' }])
    mockJournalQ3({
      getPayload: {
        templates: [],
        trades: [],
        notes: [],
        _deleted: { templates: { 'tpl-1': '2026-09-04T00:10:00.000Z' } },
      },
    })

    await initJournalSync('tok-b')

    const templates = lsGetJSON(TEMPLATES_KEY) as { id: string }[]
    expect(templates.map(t => t.id)).toEqual(['tpl-local'])
    expect(lsGetJSON(TRADES_KEY)).toEqual([{ id: 'local-trade' }])
  })

  test('bare empty cloud array without tombstones still does not wipe non-empty local (Q9)', async () => {
    lsSetJSON(TEMPLATES_KEY, [{ id: 'tpl-keep' }])
    lsSetJSON(TRADES_KEY, [{ id: 't-keep' }])
    lsSetJSON(NOTES_KEY, [{ id: 'n-keep' }])
    mockJournalQ3({ getPayload: { templates: [], trades: [], notes: [] } })

    await initJournalSync('tok')

    expect(lsGetJSON(TEMPLATES_KEY)).toEqual([{ id: 'tpl-keep' }])
    expect(lsGetJSON(TRADES_KEY)).toEqual([{ id: 't-keep' }])
    expect(lsGetJSON(NOTES_KEY)).toEqual([{ id: 'n-keep' }])
  })

  test('409 delete on A + add on B: merge-retry does not resurrect A’s id', async () => {
    lsSetToken('tok')
    const t0 = '2026-09-04T00:00:00.000Z'
    const tA = '2026-09-04T00:00:08.000Z'
    lsSetJSON(TRADES_KEY, [{ id: 'trade-A' }])
    const ctl = mockJournalQ3({
      getPayload: { trades: [{ id: 'trade-A' }], notes: [] },
      getUpdatedAt: t0,
      conflictOnFirstPut: {
        serverPayload: {
          trades: [],
          notes: [],
          _deleted: { trades: { 'trade-A': '2026-09-04T00:00:07.000Z' } },
        },
        serverUpdatedAt: tA,
        retryUpdatedAt: '2026-09-04T00:00:09.000Z',
      },
    })

    await initJournalSync('tok')
    // Device B added trade-B after the pull (still has trade-A locally).
    lsSetJSON(TRADES_KEY, [{ id: 'trade-A' }, { id: 'trade-B' }])
    debouncedSyncJournal([{ id: 'trade-A' }, { id: 'trade-B' }], [])
    await jest.advanceTimersByTimeAsync(1600)
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()

    expect(ctl.puts.length).toBe(2)
    const retryIds = (ctl.puts[1].data?.trades as { id: string }[]).map(t => t.id)
    expect(retryIds).toEqual(['trade-B'])
    expect(retryIds).not.toContain('trade-A')
    expect(ctl.puts[1].data?._deleted?.trades?.['trade-A']).toBeTruthy()
    expect(lsGetJSON(TRADES_KEY).map((t: { id: string }) => t.id)).toEqual(['trade-B'])
  })

  test('delete last trade: empty trades + tombstone; B pull drops that id', async () => {
    lsSetToken('tok-a')
    const ctl = mockJournalQ3({
      getPayload: { trades: [{ id: 'last-trade' }], notes: [{ id: 'n1' }] },
      getUpdatedAt: '2026-09-04T00:00:00.000Z',
    })
    await initJournalSync('tok-a')
    lsSetJSON(TRADES_KEY, [])
    debouncedSyncJournal([], [{ id: 'n1' }])
    await jest.advanceTimersByTimeAsync(1600)
    await Promise.resolve()
    await Promise.resolve()
    expect(ctl.puts[0].data?.trades).toEqual([])
    expect(ctl.puts[0].data?._deleted?.trades?.['last-trade']).toBeTruthy()

    resetJournalPullGate()
    localStorageMock.clear()
    lsSetJSON(TRADES_KEY, [{ id: 'last-trade' }, { id: 'other' }])
    mockJournalQ3({
      getPayload: {
        trades: [],
        notes: [{ id: 'n1' }],
        _deleted: { trades: { 'last-trade': '2026-09-04T00:20:00.000Z' } },
      },
    })
    await initJournalSync('tok-b')
    expect(lsGetJSON(TRADES_KEY).map((t: { id: string }) => t.id)).toEqual(['other'])
  })
})

// ── Q4/A6 2026-09: single writer for live watchlist key cg_wl ─────────────────
//
// Authority is GET /api/watchlist (watchlist table). Journal
// dashboardWatchlist and user_data type=watchlist must not overwrite cg_wl
// after hydrate, even when those responses arrive last.

const API_WL = [{ id: 11, symbol: 'AAPL' }, { id: 12, symbol: 'MSFT' }]
const API_SYMBOLS = ['AAPL', 'MSFT']

function isWatchlistTableUrl(url: string): boolean {
  return /\/api\/watchlist(?:\/|\?|$)/.test(String(url)) && !String(url).includes('/api/user/data/')
}

function mockQ4Fetch(opts: {
  apiWatchlist?: { id: number; symbol: string }[]
  hangJournal?: boolean
  journalPayload?: unknown
  hangBlob?: boolean
  blobWatchlist?: unknown[]
  apiEmpty?: boolean
  apiFail?: boolean
}) {
  let releaseJournal = () => {}
  let releaseBlob = () => {}
  const journalGate = opts.hangJournal
    ? new Promise<void>(resolve => { releaseJournal = resolve })
    : Promise.resolve()
  const blobGate = opts.hangBlob
    ? new Promise<void>(resolve => { releaseBlob = resolve })
    : Promise.resolve()

  const order: string[] = []
  const journalPuts: { data?: { dashboardWatchlist?: unknown[] } }[] = []
  const blobPuts: unknown[] = []

  ;(global as unknown as { fetch: typeof fetch }).fetch = jest.fn(async (url: string, init?: { method?: string; body?: string }) => {
    const method = init?.method || 'GET'
    const u = String(url)
    if (isWatchlistTableUrl(u) && method === 'GET') {
      order.push('api')
      if (opts.apiFail) return { ok: false, status: 500, json: async () => ({ error: 'fail' }) }
      const watchlist = opts.apiEmpty ? [] : (opts.apiWatchlist ?? API_WL)
      return { ok: true, json: async () => ({ watchlist, total_items: watchlist.length }) }
    }
    if (u.includes('/api/user/data/journal')) {
      if (method === 'PUT') {
        journalPuts.push(JSON.parse(init?.body || '{}'))
        return { ok: true, json: async () => ({}) }
      }
      await journalGate
      order.push('journal')
      return { ok: true, json: async () => ({ data: opts.journalPayload ?? { dashboardWatchlist: ['TSLA', 'NVDA'] } }) }
    }
    if (u.includes('/api/user/data/watchlist')) {
      if (method === 'PUT') {
        blobPuts.push(JSON.parse(init?.body || '{}'))
        return { ok: true, json: async () => ({}) }
      }
      await blobGate
      order.push('blob')
      return { ok: true, json: async () => ({ data: opts.blobWatchlist ?? ['AMD', 'INTC'] }) }
    }
    return { ok: true, json: async () => ({ data: null }) }
  }) as typeof fetch

  return { order, journalPuts, blobPuts, releaseJournal, releaseBlob }
}

describe('Q4/A6 — cg_wl is hydrated only from GET /api/watchlist', () => {
  test('hydrateWatchlistFromApi writes cg_wl from the watchlist table', async () => {
    lsSetJSON(WATCHLIST_KEY, ['LOCAL'])
    mockQ4Fetch({})
    const result = await hydrateWatchlistFromApi('tok')
    expect(result.symbols).toEqual(API_SYMBOLS)
    expect(lsGetJSON(WATCHLIST_KEY)).toEqual(API_SYMBOLS)
  })

  test('empty /api/watchlist does not wipe non-empty local cg_wl (Q9)', async () => {
    lsSetJSON(WATCHLIST_KEY, ['LOCAL'])
    mockQ4Fetch({ apiEmpty: true })
    const result = await hydrateWatchlistFromApi('tok')
    expect(result.symbols).toEqual([])
    expect(lsGetJSON(WATCHLIST_KEY)).toEqual(['LOCAL'])
  })

  test('initJournalSync does not write dashboardWatchlist into cg_wl', async () => {
    lsSetJSON(WATCHLIST_KEY, ['LOCAL'])
    mockQ4Fetch({ journalPayload: { dashboardWatchlist: ['TSLA', 'NVDA'], trades: [{ id: 't1' }] } })
    await initJournalSync('tok')
    expect(lsGetJSON(WATCHLIST_KEY)).toEqual(['LOCAL'])
    expect(lsGetJSON(TRADES_KEY)).toEqual([{ id: 't1' }])
  })

  test('initWatchlistSync is a no-op and does not overwrite cg_wl from the user_data blob', async () => {
    lsSetJSON(WATCHLIST_KEY, ['LOCAL'])
    const ctl = mockQ4Fetch({ blobWatchlist: ['AMD', 'INTC'] })
    await initWatchlistSync('tok')
    expect(lsGetJSON(WATCHLIST_KEY)).toEqual(['LOCAL'])
    expect(ctl.order).not.toContain('blob')
  })

  test('journal PUT does not bundle live cg_wl as dashboardWatchlist', async () => {
    jest.useFakeTimers()
    lsSetToken('tok')
    lsSetJSON(WATCHLIST_KEY, ['NVDA', 'AMD'])
    const ctl = mockQ4Fetch({ journalPayload: { trades: [{ id: 't1' }] } })
    await initJournalSync('tok')
    debouncedSyncJournal([{ id: 't1' }], [{ id: 'n1' }])
    await jest.advanceTimersByTimeAsync(1600)
    expect(ctl.journalPuts).toHaveLength(1)
    expect(ctl.journalPuts[0].data?.dashboardWatchlist).toBeUndefined()
    jest.useRealTimers()
  })

  test('journal PUT echoes legacy dashboardWatchlist from the last pull, not live cg_wl', async () => {
    jest.useFakeTimers()
    lsSetToken('tok')
    lsSetJSON(WATCHLIST_KEY, ['NVDA'])
    const ctl = mockQ4Fetch({ journalPayload: { trades: [{ id: 't1' }], dashboardWatchlist: ['MSFT'] } })
    await initJournalSync('tok')
    expect(lsGetJSON(WATCHLIST_KEY)).toEqual(['NVDA'])
    debouncedSyncJournal([{ id: 't1' }], [{ id: 'n1' }])
    await jest.advanceTimersByTimeAsync(1600)
    expect(ctl.journalPuts[0].data?.dashboardWatchlist).toEqual(['MSFT'])
    expect(lsGetJSON(WATCHLIST_KEY)).toEqual(['NVDA'])
    jest.useRealTimers()
  })

  test('initFullSync: late journal blob does not overwrite /api/watchlist authority', async () => {
    lsSetJSON(WATCHLIST_KEY, ['LOCAL'])
    const ctl = mockQ4Fetch({
      hangJournal: true,
      journalPayload: { dashboardWatchlist: ['TSLA', 'NVDA'], trades: [{ id: 'cloud-trade' }] },
    })

    const done = initFullSync('tok')
    await Promise.resolve()
    await Promise.resolve()
    expect(ctl.order).toContain('api')
    expect(lsGetJSON(WATCHLIST_KEY)).toEqual(API_SYMBOLS)

    ctl.releaseJournal()
    await done
    expect(ctl.order[ctl.order.length - 1]).toBe('journal')
    expect(lsGetJSON(WATCHLIST_KEY)).toEqual(API_SYMBOLS)
    expect(lsGetJSON(TRADES_KEY)).toEqual([{ id: 'cloud-trade' }])
  })

  test('after full sync, a later journal pull and blob no-op cannot replace API watchlist', async () => {
    lsSetJSON(WATCHLIST_KEY, ['LOCAL'])
    mockQ4Fetch({
      journalPayload: { dashboardWatchlist: ['FROM-JOURNAL'] },
      blobWatchlist: ['FROM-BLOB'],
    })

    await initFullSync('tok')
    expect(lsGetJSON(WATCHLIST_KEY)).toEqual(API_SYMBOLS)

    await initJournalSync('tok')
    await initWatchlistSync('tok')
    expect(lsGetJSON(WATCHLIST_KEY)).toEqual(API_SYMBOLS)
  })

  test('failed /api/watchlist leaves local cg_wl (Q9) and blobs still cannot write it', async () => {
    lsSetJSON(WATCHLIST_KEY, ['LOCAL'])
    mockQ4Fetch({
      apiFail: true,
      journalPayload: { dashboardWatchlist: ['TSLA'] },
      blobWatchlist: ['AMD'],
    })
    await initFullSync('tok')
    await initJournalSync('tok')
    await initWatchlistSync('tok')
    expect(lsGetJSON(WATCHLIST_KEY)).toEqual(['LOCAL'])
  })
})

