import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { loadJournal, persistJournal } from './storage'
import type { Journal } from '../domain/journal'

describe('local persistence', () => {
  it('roundtrips only the explicitly committed snapshot in IndexedDB', async () => {
    const name = 'test-' + crypto.randomUUID()
    expect(await loadJournal(name)).toBeNull()
    const state: Journal = { version: 1, members: [{ id: 'a', name: '我' }], spots: [], observations: [], reminders: [] }
    await persistJournal(state, name)
    expect(await loadJournal(name)).toEqual(state)
    state.members[0].name = '内存里的未保存修改'
    expect((await loadJournal(name))?.members[0].name).toBe('我')
  })
  it('refuses malformed data instead of replacing a valid archive', async () => {
    const name = 'test-' + crypto.randomUUID()
    const state: Journal = { version: 1, members: [], spots: [], observations: [], reminders: [] }
    await persistJournal(state, name)
    await expect(persistJournal({ ...state, version: 99 } as unknown as Journal, name)).rejects.toThrow()
    expect(await loadJournal(name)).toEqual(state)
  })
})
