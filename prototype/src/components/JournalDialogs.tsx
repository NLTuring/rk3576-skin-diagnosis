import { useState } from 'react'
import { ArrowRight, CalendarDays, Download, Plus } from 'lucide-react'
import type { Journal, Member, Spot, Vec3 } from '../domain/journal'
import { REGIONS } from '../domain/seed'
import { dateLabel } from '../lib/dates'

export function MemberForm({ member, busy, onSubmit }: { member?: Member; busy: boolean; onSubmit: (name: string) => void }) {
  const [name, setName] = useState(member?.name ?? '')
  return <form onSubmit={event => { event.preventDefault(); onSubmit(name) }}>
    <p className="muted">一个熟悉的称呼，就是这本手账的开始。</p>
    <label className="field-label" htmlFor="member-name">成员称呼</label><input id="member-name" autoFocus maxLength={20} required value={name} onChange={e => setName(e.target.value)} placeholder="例如：我、妈妈、小朋友" />
    <p className="small-note">只收集称呼。每位成员的观察位置与记录分别整理。</p>
    <div className="dialog-actions"><button className="button primary" type="submit" disabled={busy || !name.trim()}>{member ? '保存称呼' : '建立手账'}<ArrowRight size={18} /></button></div>
  </form>
}

export type LocationChoice = { name: string; region: string; point: Vec3; normal: Vec3 }
export function LocationForm({ initial, spots, onStart, onContinue }: {
  initial: LocationChoice; spots: Spot[]; onStart: (choice: LocationChoice) => void; onContinue: (spot: Spot) => void
}) {
  const [choice, setChoice] = useState(initial)
  const existing = spots.filter(s => s.region === choice.region)
  const regionNames: string[] = REGIONS.map(r => r.name)
  if (!regionNames.includes(initial.region)) regionNames.push(initial.region)
  return <form onSubmit={e => { e.preventDefault(); onStart({ ...choice, name: choice.name.trim() || choice.region }) }}>
    <p className="muted">左右以身体本人为准。可以修改部位，再为这一处起一个便于回忆的名字。</p>
    <label className="field-label" htmlFor="body-region">观察部位</label><select id="body-region" value={choice.region} onChange={e => {
      const region = REGIONS.find(r => r.name === e.target.value)
      setChoice(region ? { region: region.name, name: region.name, point: [...region.point], normal: [0, 0, region.name.includes('背') ? -1 : 1] } : initial)
    }}>{regionNames.map(name => <option key={name}>{name}</option>)}</select>
    <label className="field-label" htmlFor="spot-name">位置备注 <small>可选</small></label><input id="spot-name" value={choice.name} maxLength={40} onChange={e => setChoice({ ...choice, name: e.target.value })} placeholder="例如：左前臂 · 靠近手腕" />
    {!!existing.length && <div className="existing-spots"><p>这个部位已有手账，也可以接着记录：</p>{existing.map(spot => <button type="button" key={spot.id} onClick={() => onContinue(spot)}>{spot.name}<span>继续观察 <ArrowRight size={14} /></span></button>)}</div>}
    <div className="dialog-actions"><button className="button primary" type="submit"><Plus size={18} />开始记录</button></div>
    {!!existing.length && <p className="small-note">“开始记录”会为这次新变化建立独立位置。</p>}
  </form>
}

export function ReminderForm({ spot, currentDate, busy, onSave, onCancel }: {
  spot: Spot; currentDate?: string; busy: boolean; onSave: (date: string) => void; onCancel: () => void
}) {
  const [date, setDate] = useState(currentDate ?? '')
  return <form onSubmit={e => { e.preventDefault(); onSave(date) }}>
    <p className="muted">{spot.name} · 选择一个方便再次观察的日子。</p><label className="field-label" htmlFor="reminder-date">复查日期</label>
    <input id="reminder-date" type="date" value={date} required onChange={e => setDate(e.target.value)} />
    <p className="small-note">日期由你安排，或遵循医生的建议。计划会显示在网页内，关闭网页后不会推送通知。</p>
    <div className="dialog-actions">{currentDate && <button className="text-button quiet" type="button" onClick={onCancel} disabled={busy}>取消这项计划</button>}<button className="button primary" type="submit" disabled={busy || !date}><CalendarDays size={18} />保存复查计划</button></div>
  </form>
}

export function ExportForm({ journal, onExport }: { journal: Journal; onExport: (photos: boolean) => void }) {
  const [photos, setPhotos] = useState(false)
  return <div>
    <p className="muted">导出全部 {journal.members.length} 位成员的 {journal.observations.length} 条皮肤观察记录与复查计划。</p>
    <div className="export-summary"><span>文件格式</span><strong>JSON · 本地档案</strong><span>导出日期</span><strong>{dateLabel(new Date().toISOString(), true)}</strong><span>默认内容</span><strong>成员、位置、症状、日期与备注</strong></div>
    <label className="save-photo-choice"><input type="checkbox" checked={photos} onChange={e => setPhotos(e.target.checked)} /><div><strong>同时包含已保存的照片</strong><span>照片会放进同一个文件，导出体积会增加。</span></div></label>
    <p className="small-note">文件会下载到你的电脑，可用于备份或查看。当前原型暂未提供导入恢复；导出的文件由你自行保管。</p>
    <div className="dialog-actions"><button className="button primary" onClick={() => onExport(photos)}><Download size={18} />导出观察记录</button></div>
  </div>
}
