export type Vec3 = [number, number, number]
export type Member = { id: string; name: string }
export type Spot = { id: string; memberId: string; name: string; region: string; point: Vec3; normal: Vec3 }
export type Observation = {
  id: string; memberId: string; spotId: string; createdAt: string
  sensations: string[]; duration: string; change: string; note: string
  source: 'personal' | 'example'; analysis: 'not-analyzed' | 'example'; photo?: string
}
export type Reminder = { id: string; memberId: string; spotId: string; date: string }
export type Journal = { version: 1; members: Member[]; spots: Spot[]; observations: Observation[]; reminders: Reminder[] }
export type Draft = {
  memberId: string; spotId?: string; name: string; region: string; point: Vec3; normal: Vec3
  photo?: string; source: 'personal' | 'example'
  sensations: string[]; duration: string; change: string; note: string
}
export const DEMO_PHOTO = '/media/arm-reference.png'
export const SENSATIONS = ['无明显不适', '痒', '痛', '灼热', '不确定']
export const DURATIONS = ['刚出现', '几天', '几周', '更久', '记不清']
export const CHANGES = ['基本不变', '范围扩大', '有所缓解', '反复出现', '不确定']

function ensure(value: unknown, message = '这份记录不完整，请检查后重试。'): asserts value {
  if (!value) throw new Error(message)
}
const text = (value: unknown, max: number, empty = false): value is string =>
  typeof value === 'string' && value.length <= max && (empty || value.trim().length > 0)
const vector = (value: unknown): value is Vec3 =>
  Array.isArray(value) && value.length === 3 && value.every(n => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= 30)
const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
const validPhoto = (value: unknown): value is string =>
  value === DEMO_PHOTO || (typeof value === 'string' && value.length < 18 * 1024 * 1024 && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(value))
export function validDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(value + 'T12:00:00Z')
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}
function symptoms(value: { sensations: unknown; duration: unknown; change: unknown; note: unknown }) {
  ensure(Array.isArray(value.sensations) && value.sensations.length > 0 && value.sensations.length <= 5 &&
    value.sensations.every(s => SENSATIONS.includes(s)), '请选择本次的感受。')
  ensure(typeof value.duration === 'string' && DURATIONS.includes(value.duration), '请选择持续时间。')
  ensure(typeof value.change === 'string' && CHANGES.includes(value.change), '请选择最近的变化。')
  ensure(text(value.note, 1000, true), '补充文字请保持在 1000 字以内。')
}

export function addMember(state: Journal, name: string, id: string): Journal {
  ensure(text(name, 20), '请填写 1–20 字的称呼。')
  ensure(text(id, 100) && !state.members.some(m => m.id === id), '成员已经存在。')
  return { ...state, members: [...state.members, { id, name: name.trim() }] }
}

export function saveObservation(
  state: Journal, draft: Draft, keepPhoto: boolean,
  ids: { observationId: string; newSpotId: string; now: string },
): Journal {
  ensure(state.members.some(m => m.id === draft.memberId), '请先选择一位家人。')
  ensure(text(draft.name, 40) && text(draft.region, 40), '请确认观察部位。')
  ensure(vector(draft.point) && vector(draft.normal), '请重新选择身体位置。')
  symptoms(draft)
  ensure(draft.source === 'personal' || draft.source === 'example')
  ensure(!draft.photo || validPhoto(draft.photo), '照片格式不可用，请重新选择。')
  ensure(draft.source !== 'example' || draft.photo === DEMO_PHOTO, '请重新选择示例内容。')
  ensure(text(ids.observationId, 100) && !state.observations.some(o => o.id === ids.observationId), '记录已经保存，请勿重复提交。')
  ensure(Number.isFinite(Date.parse(ids.now)), '记录日期不可用。')
  let spot = state.spots.find(s => s.id === draft.spotId)
  if (draft.spotId) {
    ensure(spot && spot.memberId === draft.memberId, '这处记录属于另一位成员，请重新选择。')
  } else {
    ensure(text(ids.newSpotId, 100) && !state.spots.some(s => s.id === ids.newSpotId))
    spot = {
      id: ids.newSpotId, memberId: draft.memberId, name: draft.name.trim(),
      region: draft.region, point: [...draft.point], normal: [...draft.normal],
    }
  }
  ensure(spot)
  const observation: Observation = {
    id: ids.observationId, memberId: draft.memberId, spotId: spot.id, createdAt: ids.now,
    sensations: [...draft.sensations], duration: draft.duration, change: draft.change, note: draft.note.trim(),
    source: draft.source, analysis: draft.source === 'example' ? 'example' : 'not-analyzed',
    ...(keepPhoto && draft.photo ? { photo: draft.photo } : {}),
  }
  return {
    ...state,
    spots: draft.spotId ? state.spots : [...state.spots, spot],
    observations: [...state.observations, observation],
    // Completing a follow-up clears this location's old pending reminder.
    reminders: state.reminders.filter(r => r.spotId !== spot.id),
  }
}

export function recordsForSpot(state: Journal, memberId: string, spotId?: string): Observation[] {
  if (!spotId || !state.spots.some(s => s.id === spotId && s.memberId === memberId)) return []
  return state.observations.filter(o => o.spotId === spotId && o.memberId === memberId)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
}
export function removeMember(state: Journal, id: string): Journal {
  ensure(state.members.some(m => m.id === id), '这位成员已经不存在。')
  return {
    ...state, members: state.members.filter(m => m.id !== id),
    spots: state.spots.filter(s => s.memberId !== id),
    observations: state.observations.filter(o => o.memberId !== id),
    reminders: state.reminders.filter(r => r.memberId !== id),
  }
}
export function renameMember(state: Journal, id: string, name: string): Journal {
  ensure(state.members.some(m => m.id === id) && text(name, 20), '请填写 1–20 字的称呼。')
  return { ...state, members: state.members.map(m => m.id === id ? { ...m, name: name.trim() } : m) }
}
export function removeObservationPhoto(state: Journal, id: string): Journal {
  ensure(state.observations.some(o => o.id === id), '这条记录已经不存在。')
  return { ...state, observations: state.observations.map(o => {
    if (o.id !== id) return o
    const { photo: _photo, ...rest } = o
    return rest
  }) }
}
export function removeObservation(state: Journal, id: string): Journal {
  ensure(state.observations.some(o => o.id === id), '这条记录已经不存在。')
  return { ...state, observations: state.observations.filter(o => o.id !== id) }
}
export function setReminder(state: Journal, memberId: string, spotId: string, date: string, id: string): Journal {
  ensure(state.spots.some(s => s.id === spotId && s.memberId === memberId), '请确认复查对应的成员和部位。')
  ensure(validDate(date), '请选择有效的日期。')
  const existing = state.reminders.find(r => r.spotId === spotId)
  return {
    ...state,
    reminders: [...state.reminders.filter(r => r.spotId !== spotId), { id: existing?.id ?? id, memberId, spotId, date }],
  }
}
export function removeReminder(state: Journal, id: string): Journal {
  return { ...state, reminders: state.reminders.filter(r => r.id !== id) }
}
export function makeExport(state: Journal, includePhotos = false): Journal {
  return {
    ...state,
    observations: state.observations.map(o => {
      const { photo, ...rest } = o
      return includePhotos && photo ? { ...rest, photo } : rest
    }),
  }
}

export function validateJournal(value: unknown): Journal {
  ensure(object(value) && value.version === 1, '本地档案版本或格式不可用。')
  for (const key of ['members', 'spots', 'observations', 'reminders']) ensure(Array.isArray(value[key]))
  const { members, spots, observations, reminders } = value as unknown as Journal
  const ids = (items: { id: string }[]) => items.every(x => object(x) && text(x.id, 100)) && new Set(items.map(x => x.id)).size === items.length
  ensure(ids(members) && ids(spots) && ids(observations) && ids(reminders))
  members.forEach(m => ensure(text(m.name, 20)))
  spots.forEach(s => {
    ensure(members.some(m => m.id === s.memberId) && text(s.name, 40) && text(s.region, 40))
    ensure(vector(s.point) && vector(s.normal))
  })
  observations.forEach(o => {
    ensure(spots.some(s => s.id === o.spotId && s.memberId === o.memberId))
    ensure(text(o.createdAt, 40) && Number.isFinite(Date.parse(o.createdAt)))
    ensure(o.source === 'personal' || o.source === 'example')
    ensure(o.analysis === (o.source === 'example' ? 'example' : 'not-analyzed'))
    ensure(o.photo === undefined || validPhoto(o.photo))
    if (o.source === 'example') ensure(o.photo === undefined || o.photo === DEMO_PHOTO)
    symptoms(o)
  })
  reminders.forEach(r => ensure(validDate(r.date) && spots.some(s => s.id === r.spotId && s.memberId === r.memberId)))
  return value as unknown as Journal
}
