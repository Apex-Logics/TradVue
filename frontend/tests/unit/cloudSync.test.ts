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
