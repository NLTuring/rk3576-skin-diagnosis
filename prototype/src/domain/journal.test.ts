import { describe, expect, it } from 'vitest'
import {
  addMember, saveObservation, removeMember, removeObservationPhoto, removeObservation,
  recordsForSpot, makeExport, setReminder, removeReminder, validateJournal,
  type Draft, type Journal,
} from './journal'

const makeJournal = (): Journal => ({
  version: 1,
  members: [{ id: 'a', name: '我' }, { id: 'b', name: '家人' }],
  spots: [
    { id: 'arm', memberId: 'a', name: '左前臂', region: '左前臂', point: [3, 2, 1], normal: [0, 0, 1] },
    { id: 'leg', memberId: 'b', name: '左小腿', region: '左小腿', point: [1, -6, 1], normal: [0, 0, 1] },
  ],
  observations: [],
  reminders: [],
})
const draft = (extra: Partial<Draft> = {}): Draft => ({
  memberId: 'a', spotId: 'arm', region: '左前臂', name: '左前臂',
  point: [3, 2, 1], normal: [0, 0, 1],
  photo: 'data:image/jpeg;base64,AA==', source: 'personal',
  sensations: ['痒'], duration: '几天', change: '基本不变', note: '测试观察', ...extra,
})
const stamp = { observationId: 'entry-1', newSpotId: 'new-spot', now: '2026-10-09T08:00:00.000Z' }

describe('observation consent and ownership', () => {
  it('retains text but excludes a photo unless consent is explicitly true', () => {
    const original = makeJournal()
    const next = saveObservation(original, draft(), false, stamp)
    expect(next.observations[0]).not.toHaveProperty('photo')
    expect(next.observations[0].note).toBe('测试观察')
    expect(next.observations[0].analysis).toBe('not-analyzed')
    expect(original.observations).toHaveLength(0)
  })
  it('retains a consented personal image without assigning a disease', () => {
    const next = saveObservation(makeJournal(), draft(), true, stamp)
    expect(next.observations[0].photo).toBe(draft().photo)
    expect(next.observations[0].analysis).toBe('not-analyzed')
  })
  it('only permits example output when using the explicit built-in example', () => {
    const sample = saveObservation(makeJournal(), draft({ source: 'example', photo: '/media/arm-reference.png' }), true, stamp)
    expect(sample.observations[0].analysis).toBe('example')
    expect(() => saveObservation(makeJournal(), draft({ source: 'example' }), true, stamp)).toThrow()
  })
  it('rejects cross-member attachments and unknown members', () => {
    expect(() => saveObservation(makeJournal(), draft({ spotId: 'leg' }), false, stamp)).toThrow()
    expect(() => saveObservation(makeJournal(), draft({ memberId: 'missing' }), false, stamp)).toThrow()
    expect(() => saveObservation(makeJournal(), draft({ spotId: 'missing' }), false, stamp)).toThrow()
  })
  it('creates a fresh body bookmark and permits notes without an image', () => {
    const next = saveObservation(makeJournal(), draft({ spotId: undefined, photo: undefined, source: 'personal' }), false, stamp)
    expect(next.spots.at(-1)?.memberId).toBe('a')
    expect(next.observations[0].spotId).toBe('new-spot')
    expect(next.observations[0]).not.toHaveProperty('photo')
  })
  it('validates input length, coordinates and selected symptom options', () => {
    for (const update of [
      { note: 'x'.repeat(1001) }, { name: '' }, { point: [NaN, 2, 3] as [number, number, number] },
      { sensations: ['invalid'] }, { duration: 'invalid' }, { change: 'invalid' },
    ]) expect(() => saveObservation(makeJournal(), draft(update), false, stamp)).toThrow()
  })
  it('rejects duplicate record identifiers', () => {
    const first = saveObservation(makeJournal(), draft(), false, stamp)
    expect(() => saveObservation(first, draft(), false, stamp)).toThrow()
  })
  it('restricts record selection to the current member and sorts newest first', () => {
    let state = saveObservation(makeJournal(), draft(), false, stamp)
    state = saveObservation(state, draft(), false, { ...stamp, observationId: 'entry-2', now: '2026-10-10T08:00:00.000Z' })
    expect(recordsForSpot(state, 'a', 'arm').map(x => x.id)).toEqual(['entry-2', 'entry-1'])
    expect(recordsForSpot(state, 'b', 'arm')).toEqual([])
  })
})

describe('family records and local data operations', () => {
  it('validates names and adds members without mutating earlier state', () => {
    const state = makeJournal()
    expect(addMember(state, ' 爸爸 ', 'c').members.at(-1)?.name).toBe('爸爸')
    expect(state.members).toHaveLength(2)
    for (const name of ['', '   ', '很'.repeat(21)]) expect(() => addMember(state, name, 'c')).toThrow()
    expect(() => addMember(state, '重复', 'a')).toThrow()
  })
  it('removes a photo while preserving the observation and rejects an unknown record', () => {
    const state = saveObservation(makeJournal(), draft(), true, stamp)
    const next = removeObservationPhoto(state, 'entry-1')
    expect(next.observations[0]).not.toHaveProperty('photo')
    expect(next.observations[0].note).toBe('测试观察')
    expect(state.observations[0].photo).toBeTruthy()
    expect(() => removeObservationPhoto(state, 'unknown')).toThrow()
  })
  it('exports no images by default; including them is an explicit option', () => {
    const state = saveObservation(makeJournal(), draft(), true, stamp)
    expect(makeExport(state).observations[0]).not.toHaveProperty('photo')
    expect(makeExport(state, true).observations[0].photo).toBeTruthy()
  })
  it('creates and reschedules a valid user-chosen reminder', () => {
    const state = setReminder(makeJournal(), 'a', 'arm', '2026-10-12', 'rem-1')
    expect(state.reminders[0].date).toBe('2026-10-12')
    expect(setReminder(state, 'a', 'arm', '2026-10-15', 'rem-2').reminders).toHaveLength(1)
    for (const date of ['2026-02-30', 'tomorrow', '2026-1-2']) expect(() => setReminder(state, 'a', 'arm', date, 'x')).toThrow()
    expect(() => setReminder(state, 'b', 'arm', '2026-10-12', 'x')).toThrow()
    expect(removeReminder(state, 'rem-1').reminders).toEqual([])
  })
  it('cascades removal of a member only to that member’s entries and reminders', () => {
    let state = saveObservation(makeJournal(), draft(), true, stamp)
    state = setReminder(state, 'a', 'arm', '2026-10-12', 'rem-1')
    const next = removeMember(state, 'a')
    expect(next.members.map(x => x.id)).toEqual(['b'])
    expect(next.spots.map(x => x.id)).toEqual(['leg'])
    expect(next.observations).toHaveLength(0)
    expect(next.reminders).toHaveLength(0)
    expect(() => removeMember(state, 'missing')).toThrow()
  })
  it('removes an entry without silently deleting its whole body bookmark', () => {
    const state = saveObservation(makeJournal(), draft(), false, stamp)
    const next = removeObservation(state, 'entry-1')
    expect(next.spots).toHaveLength(2)
    expect(next.observations).toHaveLength(0)
  })
  it('validates stored data before displaying it', () => {
    expect(validateJournal(makeJournal())).toEqual(makeJournal())
    for (const bad of [null, {}, { ...makeJournal(), version: 99 }, { ...makeJournal(), members: [{id:'a', name:''}] }]) {
      expect(() => validateJournal(bad)).toThrow()
    }
    const state = saveObservation(makeJournal(), draft(), true, stamp)
    state.observations[0].photo = 'https://external.invalid/pixel'
    expect(() => validateJournal(state)).toThrow()
  })
})
