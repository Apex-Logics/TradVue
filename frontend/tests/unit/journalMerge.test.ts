/**
 * Q2 — merge journal blobs by stable id (conflict retry).
 * Q3 — tombstones drop deleted ids so a 409 union cannot resurrect them.
 */

import {
  applyTombstonesToArray,
  detectNewDeletes,
  extractDeletedMap,
  mergeByStableId,
  mergeDeletedMaps,
  mergeJournalArrays,
  mergeJournalBlobs,
  unwrapUserDataPayload,
} from '../../app/utils/journalMerge'

describe('mergeByStableId', () => {
  test('keeps rows present on only one side', () => {
    const merged = mergeByStableId(
      [{ id: 'shared', symbol: 'ES', notes: 'B' }, { id: 'trade-B' }],
      [{ id: 'shared', symbol: 'ES', notes: 'A' }, { id: 'trade-A' }],
    )
    expect(merged.map((t: any) => t.id).sort()).toEqual(['shared', 'trade-A', 'trade-B'])
    expect((merged.find((t: any) => t.id === 'shared') as { notes: string }).notes).toBe('B')
  })

  test('empty incoming does not drop server trades (conflict vs wipe)', () => {
    const merged = mergeByStableId([], [{ id: 'server-only' }])
    expect(merged).toEqual([{ id: 'server-only' }])
  })
})

describe('mergeJournalArrays', () => {
  test('unions primitive id lists (dismissed webhooks)', () => {
    expect(mergeJournalArrays(['a', 'b'], ['b', 'c'])).toEqual(['a', 'b', 'c'])
  })
})

describe('mergeJournalBlobs', () => {
  test('two-device journal: trades and notes from both sides survive', () => {
    const incoming = {
      trades: [{ id: 'shared' }, { id: 'trade-B' }],
      notes: [{ id: 'note-B', content: 'b' }],
      templates: [{ id: 'tpl-B' }],
    }
    const server = {
      trades: [{ id: 'shared' }, { id: 'trade-A' }],
      notes: [{ id: 'note-A', content: 'a' }],
      templates: [{ id: 'tpl-A' }],
    }
    const merged = mergeJournalBlobs(incoming, server)
    expect((merged.trades as { id: string }[]).map(t => t.id).sort()).toEqual(['shared', 'trade-A', 'trade-B'])
    expect((merged.notes as { id: string }[]).map(n => n.id).sort()).toEqual(['note-A', 'note-B'])
    expect((merged.templates as { id: string }[]).map(t => t.id).sort()).toEqual(['tpl-A', 'tpl-B'])
  })

  test('prop firm accounts and playbooks merge by id', () => {
    const merged = mergeJournalBlobs(
      { propFirmAccounts: [{ id: 'pf-b' }], playbooks: [{ id: 'pb-b' }] },
      { propFirmAccounts: [{ id: 'pf-a' }], playbooks: [{ id: 'pb-a' }] },
    )
    expect((merged.propFirmAccounts as { id: string }[]).map(a => a.id).sort()).toEqual(['pf-a', 'pf-b'])
    expect((merged.playbooks as { id: string }[]).map(p => p.id).sort()).toEqual(['pb-a', 'pb-b'])
  })
})

describe('unwrapUserDataPayload', () => {
  test('peels GET / 409 double data wrap', () => {
    expect(unwrapUserDataPayload({
      type: 'journal',
      data: { data: { trades: [{ id: 't1' }] } },
      updated_at: 'T1',
    })).toEqual({ trades: [{ id: 't1' }] })
  })
})

describe('Q3 — tombstones', () => {
  test('extractDeletedMap reads _deleted plus in-array sentinels', () => {
    const map = extractDeletedMap({
      trades: [{ id: 'live' }, { id: 'sent-1', _deleted: true }, { id: 'sent-2', deletedAt: '2026-09-04T00:00:00.000Z' }],
      _deleted: { templates: { 'tpl-1': '2026-09-04T00:01:00.000Z' } },
    })
    expect(map.templates?.['tpl-1']).toBe('2026-09-04T00:01:00.000Z')
    expect(map.trades?.['sent-1']).toBe(true)
    expect(map.trades?.['sent-2']).toBe('2026-09-04T00:00:00.000Z')
  })

  test('applyTombstonesToArray drops stamped ids and sentinel rows', () => {
    const out = applyTombstonesToArray(
      [{ id: 'keep' }, { id: 'gone' }, { id: 'sent', _deleted: true }, null],
      { gone: '2026-09-04T00:00:00.000Z' },
    )
    expect(out).toEqual([{ id: 'keep' }])
  })

  test('detectNewDeletes only diffs collections present on the outgoing blob', () => {
    const deleted = detectNewDeletes(
      { trades: ['t1', 't2'], templates: ['tpl-1'] },
      { trades: [{ id: 't2' }] },
      '2026-09-04T12:00:00.000Z',
    )
    expect(deleted.trades).toEqual({ t1: '2026-09-04T12:00:00.000Z' })
    expect(deleted.templates).toBeUndefined()
  })

  test('409 delete on A + add on B does not resurrect A’s id', () => {
    // A deleted trade-A (tombstone); B added trade-B and still has trade-A locally.
    const incoming = {
      trades: [{ id: 'trade-A' }, { id: 'trade-B' }],
    }
    const server = {
      trades: [],
      _deleted: { trades: { 'trade-A': '2026-09-04T00:10:00.000Z' } },
    }
    const merged = mergeJournalBlobs(incoming, server)
    const ids = (merged.trades as { id: string }[]).map(t => t.id)
    expect(ids).toEqual(['trade-B'])
    expect((merged._deleted as { trades: Record<string, string> }).trades['trade-A']).toBeTruthy()
  })

  test('409 reverse: A retries delete after B added — B’s new id kept, A’s deleted id stays gone', () => {
    const incoming = {
      trades: [],
      _deleted: { trades: { 'trade-A': '2026-09-04T00:10:00.000Z' } },
    }
    const server = {
      trades: [{ id: 'trade-A' }, { id: 'trade-B' }],
    }
    const merged = mergeJournalBlobs(incoming, server)
    const ids = (merged.trades as { id: string }[]).map(t => t.id)
    expect(ids).toEqual(['trade-B'])
    expect((merged._deleted as { trades: Record<string, string> }).trades['trade-A']).toBeTruthy()
  })

  test('empty incoming without tombstones still keeps server rows (Q2 / Q9)', () => {
    const merged = mergeJournalBlobs({ trades: [] }, { trades: [{ id: 'server-only' }] })
    expect(merged.trades).toEqual([{ id: 'server-only' }])
    expect(merged._deleted).toBeUndefined()
  })

  test('mergeDeletedMaps unions collections; later timestamp wins', () => {
    const merged = mergeDeletedMaps(
      { trades: { a: '2026-09-04T00:00:00.000Z' } },
      { trades: { a: '2026-09-04T00:05:00.000Z', b: true }, templates: { t: null } },
    )
    expect(merged.trades?.a).toBe('2026-09-04T00:05:00.000Z')
    expect(merged.trades?.b).toBe(true)
    expect(merged.templates?.t).toBeNull()
  })
})
