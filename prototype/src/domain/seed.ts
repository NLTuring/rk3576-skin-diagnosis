import { DEMO_PHOTO, type Journal, type Spot } from './journal'

const days = (offset: number) => {
  const date = new Date(Date.now() - 300_000)
  date.setDate(date.getDate() + offset)
  return date.toISOString()
}
export const REGIONS = [
  { name: '左前臂', point: [3.7206, 2.9725, 1.3475] },
  { name: '右前臂', point: [-3.7206, 2.9725, 1.3475] },
  { name: '左上臂', point: [2.4032, 4.3695, .5869] },
  { name: '右上臂', point: [-2.4032, 4.3695, .5869] },
  { name: '左小腿', point: [1.8887, -5.5713, .4155] },
  { name: '右小腿', point: [-1.8887, -5.5713, .4155] },
  { name: '左大腿', point: [1.3, -2.7, 1] },
  { name: '右大腿', point: [-1.3, -2.7, 1] },
  { name: '面部', point: [0, 7.15, 1.4] },
  { name: '颈部', point: [0, 5.4, .9] },
  { name: '胸部', point: [0, 3.7, 1.3] },
  { name: '腹部', point: [0, 1.4, 1.3] },
  { name: '背部', point: [0, 3.8817, -.3763] },
  { name: '腰背部', point: [0, .6, -1] },
  { name: '左手', point: [4.6093, 1.8329, 1.9541] },
  { name: '右手', point: [-4.6093, 1.8329, 1.9541] },
  { name: '左足', point: [2.1, -8, 1.4] },
  { name: '右足', point: [-2.1, -8, 1.4] },
] as const
export function inferRegion(point: [number, number, number]): string {
  const [x, y, z] = point
  const side = x > 0 ? '左' : '右'
  if (y > 6) return z < 0 ? '头部后侧' : '面部'
  if (y > 5) return '颈部'
  if (Math.abs(x) > 2 && y > .7) return side + (Math.abs(x) > 4.4 ? '手' : y > 3.5 ? '上臂' : '前臂')
  if (y < -1.3) return side + (y < -7.3 ? '足' : y < -4.5 ? '小腿' : '大腿')
  return z < -.05 ? y > 2.3 ? '背部' : '腰背部' : y > 2.3 ? '胸部' : '腹部'
}
export function createDemoJournal(): Journal {
  const spot = (id: string, memberId: string, name: string, index: number): Spot => ({
    id, memberId, name, region: REGIONS[index].name,
    point: [...REGIONS[index].point], normal: [0, 0, 1],
  })
  const spots = [
    spot('me-arm', 'me', '左前臂 · 外侧', 0),
    spot('me-upper', 'me', '右上臂', 3),
    spot('me-shin', 'me', '左小腿', 4),
    spot('mom-arm', 'mom', '右上臂', 3),
  ]
  return {
    version: 1, members: [{ id: 'me', name: '我' }, { id: 'mom', name: '妈妈' }, { id: 'dad', name: '爸爸' }], spots,
    observations: [
      { id: 'demo-1', memberId: 'me', spotId: 'me-arm', createdAt: days(-3), sensations: ['痒'], duration: '刚出现', change: '不确定', note: '第一次留下这处皮肤的观察。', source: 'example', analysis: 'example', photo: DEMO_PHOTO },
      { id: 'demo-2', memberId: 'me', spotId: 'me-arm', createdAt: days(0), sensations: ['痒'], duration: '几天', change: '基本不变', note: '运动后更明显。', source: 'example', analysis: 'example', photo: DEMO_PHOTO },
      { id: 'demo-3', memberId: 'mom', spotId: 'mom-arm', createdAt: days(-1), sensations: ['无明显不适'], duration: '几天', change: '基本不变', note: '先记下这个位置，下次方便找到。', source: 'example', analysis: 'example' },
    ],
    reminders: [{ id: 'demo-reminder', memberId: 'me', spotId: 'me-shin', date: days(3).slice(0, 10) }],
  }
}
