/**
 * Q2 — merge journal blobs by stable id (conflict retry).
 */

import { mergeByStableId, mergeJournalArrays, mergeJournalBlobs, unwrapUserDataPayload } from '../../app/utils/journalMerge'

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
