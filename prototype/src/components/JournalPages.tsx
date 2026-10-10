import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { ArrowLeft, ArrowRight, Bookmark, Camera, CalendarDays, Columns2, ImagePlus, ImageOff, LockKeyhole, Plus, ScanLine, Upload } from 'lucide-react'
import type { Draft, Journal, Member, Observation, Spot } from '../domain/journal'
import { CHANGES, DEMO_PHOTO, DURATIONS, recordsForSpot, SENSATIONS } from '../domain/journal'
import { dateLabel, shortDate } from '../lib/dates'
import { readLocalImage } from '../lib/images'
import { BodyMap } from './BodyMap'

export function Photo({ photo, source, alt = '本次保存的照片', children }: {
  photo?: string; source?: string; alt?: string; children?: React.ReactNode
}) {
  return <div className={'photo-frame ' + (!photo ? 'is-empty' : '')}>
    {photo ? <><img src={photo} alt={alt} /><span className="photo-caption">{source === 'example' ? '示例影像 · 非真实病例' : '本地照片'}</span></>
      : <div className="photo-empty"><ImageOff size={30} strokeWidth={1.1} /><strong>本次未保存照片</strong><span>症状和文字仍可回顾</span></div>}
    {children}
  </div>
}

export function MemberStrip({ members, activeId, onSelect, onAdd }: {
  members: Member[]; activeId: string; onSelect: (id: string) => void; onAdd: () => void
}) {
  return <div className="member-strip" aria-label="家庭成员">
    {members.map(m => <button key={m.id} className={'member-pill ' + (m.id === activeId ? 'active' : '')}
      aria-label={'切换到' + m.name} aria-pressed={m.id === activeId} onClick={() => onSelect(m.id)}>{m.name}</button>)}
    <button className="member-add" aria-label="添加家庭成员" onClick={onAdd}><Plus size={21} /></button>
  </div>
}

export function HomePage({ journal, member, spot, onSelect, onPick, onList, onNew, onCheck, onCompare, onReminder, onDetail, onHistory, onAddMember }: {
  journal: Journal; member?: Member; spot?: Spot
  onSelect: (id: string) => void
  onPick: React.ComponentProps<typeof BodyMap>['onPick']; onList: () => void
  onNew: () => void; onCheck: () => void; onCompare: () => void
  onReminder: () => void; onDetail: (entry: Observation) => void; onHistory: () => void; onAddMember: () => void
}) {
  const spots = journal.spots.filter(s => s.memberId === member?.id)
  const records = member ? recordsForSpot(journal, member.id, spot?.id) : []
  const current = records[0]
  const reminder = journal.reminders.find(r => r.spotId === spot?.id)
  return <div className="home-grid">
    <BodyMap spots={spots} selectedId={spot?.id} onSelect={onSelect} onPick={onPick} onList={onList} />
    <aside className="journal-pane">
      {!member || !spot ? <div className="welcome-note">
        <span className="eyebrow">YOUR FIRST PAGE</span><Bookmark size={38} strokeWidth={1.1} />
        <h2>{member ? '从第一条观察开始' : '为家人，留下一本手账'}</h2>
        <p>{member ? '在身体上点选一个位置，或从部位列表开始。每一次记录都会留在同一处。' : '只需要一个称呼，就能开始记录。免注册，也不需要登录。'}</p>
        <button className="button primary" onClick={member ? onNew : onAddMember}><Plus size={20} />{member ? '记录第一处变化' : '建立第一位成员'}</button>
        <span className="small-note">照片由你决定是否保存在本地。</span>
      </div> : <>
        <div className="pane-eyebrow"><span className="eyebrow">这一处的手账</span><Bookmark size={23} /></div>
        <h2 data-testid="spot-title">{spot.name}</h2>
        <p className="muted pane-subtitle">{member.name}的记录 <span>/</span> 已观察 {records.length} 次</p>
        <Photo photo={current?.photo} source={current?.source} />
        {current ? <>
          <div className="entry-date"><time>{shortDate(current.createdAt)}</time><span className="badge">{current.source === 'example' ? '示例记录' : '本次记录'}</span></div>
          <p className="entry-symptoms">{current.sensations.join('、')}<span> · </span>{current.duration}<span> · </span>{current.change}</p>
          {current.note && <p className="entry-note">{current.note}</p>}
          <button className="text-button quiet detail-link" onClick={() => onDetail(current)} aria-label="查看本次记录详情">查看记录详情 <ArrowRight size={15} /></button>
          <div className="timeline">
            {records.slice(1, 4).map(entry => <button key={entry.id} className="timeline-row" onClick={() => onDetail(entry)}>
              <span className="timeline-dot" /><time>{shortDate(entry.createdAt)}</time><span>{entry.photo ? '已保存照片' : '文字观察记录'}</span><ArrowRight size={14} />
            </button>)}
            {records.length === 1 && <p className="small-note">下一次观察，将和这一次连在一起。</p>}
            {records.length > 4 && <button className="text-button" onClick={onHistory}>查看全部 {records.length} 条记录 <ArrowRight size={14} /></button>}
          </div>
        </> : <p className="empty-copy">位置已经准备好了，记录下这一次的感受吧。</p>}
        <button className="reminder-strip" onClick={onReminder} aria-label="安排复查">
          <CalendarDays size={20} /><span>{reminder ? dateLabel(reminder.date) + '，再记录一次' : '为这一处安排复查'}</span><small>{reminder ? '改期' : '选择日期'}</small>
        </button>
        <div className="pane-actions">
          <button className="button primary" onClick={onCheck}><Camera size={19} />为这一处复查</button>
          <button className="button" onClick={onCompare} disabled={records.length < 2} title={records.length < 2 ? '记录两次后即可对照' : undefined}><Columns2 size={19} />前后对照</button>
        </div>
      </>}
    </aside>
  </div>
}

type DraftPageProps = {
  draft: Draft; member: Member; onChange: (draft: Draft) => void
  onNext: () => void; onCamera: () => void; onError: (message: string) => void; onBack: () => void
}
export function CheckPage({ draft, member, onChange, onNext, onCamera, onError, onBack }: DraftPageProps) {
  const input = useRef<HTMLInputElement>(null)
  const latest = useRef(draft)
  latest.current = draft
  const mounted = useRef(true)
  const accepting = useRef(false)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  const [reading, setReading] = useState(false)
  const [dragging, setDragging] = useState(false)
  const accept = async (file?: File) => {
    if (!file || accepting.current) return
    accepting.current = true
    setReading(true)
    try {
      const photo = await readLocalImage(file)
      if (mounted.current) onChange({ ...latest.current, photo, source: 'personal' })
    } catch (error) { if (mounted.current) onError(error instanceof Error ? error.message : '无法读取这张图片，请重新选择。') }
    finally { accepting.current = false; if (mounted.current) setReading(false); if (input.current) input.current.value = '' }
  }
  const toggle = (value: string) => {
    const exclusive = ['无明显不适', '不确定']
    const sensations = exclusive.includes(value) ? [value] : draft.sensations.includes(value)
      ? draft.sensations.filter(v => v !== value) : [...draft.sensations.filter(v => !exclusive.includes(v)), value]
    onChange({ ...draft, sensations })
  }
  const next = () => {
    if (!draft.sensations.length || !draft.duration || !draft.change) { onError('请先点选感受、持续时间和最近变化。'); return }
    onNext()
  }
  return <>
    <div className="page-heading"><div><button className="breadcrumb" onClick={onBack}><ArrowLeft size={14} />我的手账 / {draft.name}</button><h1>记录今天的变化。</h1><p>选一张清晰照片，再用几个选项记下此刻的感受。</p></div><span className="context-pill">{member.name} · {draft.region}</span></div>
    <div className="check-grid">
      <section>
        <div className="source-tabs"><button className="active" onClick={() => input.current?.click()}><ImagePlus size={20} />导入已有照片</button><button onClick={onCamera}><Camera size={20} />摄像头拍摄</button></div>
        <input ref={input} type="file" className="visually-hidden" accept="image/jpeg,image/png,image/webp" aria-label="选择皮肤照片" onChange={e => void accept(e.target.files?.[0])} />
        <div className={'upload-surface ' + (dragging ? 'dragging' : '')} onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)} onDrop={e => { e.preventDefault(); setDragging(false); void accept(e.dataTransfer.files[0]) }}>
          {draft.photo ? <Photo photo={draft.photo} source={draft.source} alt="本次临时照片" /> : <button className="upload-empty" onClick={() => input.current?.click()}>
            <Upload size={33} strokeWidth={1.2} /><strong>把照片放在这里</strong><span>点击选择，或将图片拖入</span><small>JPG / PNG / WebP · 最大 12 MB</small>
          </button>}
          {reading && <div className="processing-overlay"><span className="loading-ring" />正在本机读取照片…</div>}
        </div>
        <div className="photo-tools"><span>请确认清晰、光照均匀，避免过远拍摄。</span><button className="text-button" onClick={() => input.current?.click()}>重新选择 <ArrowRight size={14} /></button></div>
        <div className="example-entry"><span>想先看看完整效果？</span><button disabled={reading} onClick={() => onChange({ ...draft, photo: DEMO_PHOTO, source: 'example' })}>使用内置示例</button><small>会替换当前临时照片，并标记为示例演示。</small></div>
      </section>
      <section className="symptom-form">
        <fieldset><legend>这次有什么感受？</legend><p>可以选择多个，也可以选择“不确定”。</p><div className="choices">{SENSATIONS.map(s => <button key={s} className={draft.sensations.includes(s) ? 'selected' : ''} aria-pressed={draft.sensations.includes(s)} onClick={() => toggle(s)}>{s}</button>)}</div></fieldset>
        <fieldset><legend>大约持续多久了？</legend><div className="choices">{DURATIONS.map(v => <button key={v} className={draft.duration === v ? 'selected' : ''} aria-pressed={draft.duration === v} onClick={() => onChange({ ...draft, duration: v })}>{v}</button>)}</div></fieldset>
        <fieldset><legend>最近有什么变化？</legend><div className="choices">{CHANGES.map(v => <button key={v} className={draft.change === v ? 'selected' : ''} aria-pressed={draft.change === v} onClick={() => onChange({ ...draft, change: v })}>{v}</button>)}</div></fieldset>
        <label className="note-label" htmlFor="observation-note">补充一句话 <small>可选</small></label>
        <textarea id="observation-note" maxLength={1000} value={draft.note} onChange={e => onChange({ ...draft, note: e.target.value })} placeholder="例如：运动后更明显，最近换过护肤用品。" />
        <p className="small-note">{draft.note.length} / 1000</p>
      </section>
    </div>
    <div className="bottom-bar"><span><LockKeyhole size={17} />照片仅在本机处理，稍后由你决定是否保存。</span><button className="button primary" onClick={next} disabled={reading}>查看本次观察 <ArrowRight size={20} /></button></div>
  </>
}

export function ResultPage({ draft, member, onSave, onBack, busy }: {
  draft: Draft; member: Member; onSave: (keep: boolean) => void; onBack: () => void; busy: boolean
}) {
  const [keep, setKeep] = useState(false)
  const example = draft.source === 'example'
  return <>
    <div className="page-heading"><div><button className="breadcrumb" onClick={onBack}><ArrowLeft size={14} />返回补充信息</button><h1>把这一次，清楚地记下来。</h1><p>{member.name} · {draft.name} · {dateLabel(new Date().toISOString(), true)}</p></div><span className={'context-pill ' + (example ? 'example-pill' : '')}>{example ? '示例结果 · 非诊断' : '个人观察 · 未进行识别'}</span></div>
    <div className="result-grid">
      <section><Photo photo={draft.photo} source={draft.source} alt="本次临时照片" /><div className="result-sensations"><span>我的感受</span>{draft.sensations.map(s => <span className="badge" key={s}>{s}</span>)}</div>{draft.note && <blockquote>“{draft.note}”</blockquote>}<p className="small-note">感受和补充内容由你记录。</p></section>
      <section className="result-content">
        <span className="eyebrow accent">{example ? '可能的方向 / 示例' : '本次观察'}</span>
        <h2>{example ? '湿疹 / 皮炎类表现' : '本次尚未进行 AI 识别'}</h2>
        <p className="muted">{example ? '以下用于演示报告的阅读方式，不来自真实诊断。' : '检测服务尚未接入。你仍可保存照片、感受和变化，留待复查。'}</p>
        <div className="result-section"><h3>{example ? '为什么会这样提示' : '你留下的信息'}</h3>
          {example ? <><p className="bullet-line">示例提示结合了皮肤表现与填写的瘙痒感受。</p><p className="bullet-line">仍需了解病程、是否反复及近期接触情况。</p></>
            : <><p className="bullet-line">{draft.sensations.join('、')} · 持续{draft.duration}</p><p className="bullet-line">最近变化：{draft.change}</p></>}
          <p className="small-note">{example ? '仅凭照片无法确认病因，需要时可带记录就医。' : '本次不会生成病名、置信度或治疗建议。'}</p>
        </div>
        <div className="result-section"><h3>下一步，可以这样做</h3><div className="numbered-row"><span>01</span><div><strong>留下一次观察</strong><p>把照片、感受与发生时间联系起来。</p></div></div><div className="numbered-row"><span>02</span><div><strong>安排复查或就医沟通</strong><p>保存后可选择复查日期，也可导出观察记录。</p></div></div></div>
        <label className="save-photo-choice"><input type="checkbox" checked={keep} disabled={!draft.photo} onChange={e => setKeep(e.target.checked)} /><div><strong>将本次照片保存在本地手账</strong><span>{draft.photo ? '不勾选也可以保存症状和文字记录。' : '本次没有照片，仅保存文字观察。'}</span></div></label>
        <div className="result-actions"><button className="text-button quiet" onClick={onBack} disabled={busy}>返回修改</button><button className="button primary" onClick={() => onSave(keep)} disabled={busy}><Bookmark size={18} />{busy ? '正在保存…' : '保存本次记录'}</button></div>
      </section>
    </div>
  </>
}

export function ComparePage({ records, member, spot, onBack, onCheck }: {
  records: Observation[]; member: Member; spot: Spot; onBack: () => void; onCheck: () => void
}) {
  const [leftId, setLeftId] = useState(records.at(-1)?.id ?? '')
  const [rightId, setRightId] = useState(records[0]?.id ?? '')
  const [mode, setMode] = useState<'parallel' | 'slider'>('parallel')
  const [split, setSplit] = useState(50)
  const left = records.find(r => r.id === leftId), right = records.find(r => r.id === rightId)
  const comparable = Boolean(left?.photo && right?.photo && left.id !== right.id)
  const selector = (value: string, change: (id: string) => void, label: string) => <label className="compare-date-label">{label}<select value={value} aria-label={label} onChange={e => { change(e.target.value); setMode('parallel') }}>
    {records.map(r => <option key={r.id} value={r.id}>{dateLabel(r.createdAt, true)} · {r.photo ? '有照片' : '文字记录'}</option>)}
  </select></label>
  return <>
    <div className="page-heading"><div><button className="breadcrumb" onClick={onBack}><ArrowLeft size={14} />返回手账</button><h1>同一处，慢慢看见变化。</h1><p>{member.name} · {spot.name} · 把照片与感受放在一起看。</p></div><div className="segmented"><button className={mode === 'parallel' ? 'active' : ''} onClick={() => setMode('parallel')}>并排对照</button><button disabled={!comparable} className={mode === 'slider' ? 'active' : ''} onClick={() => setMode('slider')}>滑动对照</button></div></div>
    <div className="compare-selectors">{selector(leftId, setLeftId, '较早的记录')}{selector(rightId, setRightId, '较新的记录')}</div>
    {leftId === rightId && <p className="inline-notice">请选择两条不同的观察记录。</p>}
    {mode === 'slider' && comparable ? <div className="slide-comparison" style={{ '--split': split + '%' } as CSSProperties}>
      <div className="compare-image-layer"><img src={right!.photo} alt="较新记录的照片" /></div>
      <div className="compare-image-layer comparison-reveal" data-testid="comparison-reveal" style={{ '--split': split + '%' } as CSSProperties}><img src={left!.photo} alt="较早记录的照片" /></div>
      <span className="split-divider"><Columns2 size={18} /></span>
      <div className="slider-dates"><span>{shortDate(left!.createdAt)}</span><span>{shortDate(right!.createdAt)}</span></div>
      <span className="comparison-source">{left?.source === 'example' || right?.source === 'example' ? '包含示例影像 · 非真实病例对照' : '两次已保存的本地照片'}</span>
      <label className="comparison-range">移动分界线<input aria-label="对照分界线" type="range" min="5" max="95" value={split} onChange={e => setSplit(Number(e.target.value))} /></label>
    </div> : <div className="compare-photos"><Photo photo={left?.photo} source={left?.source} alt="较早记录的照片" /><Photo photo={right?.photo} source={right?.source} alt="较新记录的照片" /></div>}
    <p className="comparison-note"><ScanLine size={18} />{comparable ? '拍摄角度与光线会影响观感；照片对照不等同于病情结论。' : '仍可对照感受与文字。两次照片都保存后，可使用滑动对照。'}</p>
    <div className="symptom-comparison"><div><h3>我的感受，也在变化</h3><p>以下来自用户填写的两次记录</p></div>{[
      ['感受', left?.sensations.join('、'), right?.sensations.join('、')],
      ['持续时间', left?.duration, right?.duration],
      ['自己的观察', left?.change, right?.change],
    ].map(([label, before, after]) => <div className="comparison-stat" key={label}><span>{label}</span><p>{before || '未记录'}<ArrowRight size={17} />{after || '未记录'}</p></div>)}</div>
    <div className="bottom-bar"><button className="text-button quiet" onClick={onBack}><ArrowLeft size={16} />返回这一处的手账</button><button className="button primary" onClick={onCheck}><Camera size={19} />为这一处再记录</button></div>
  </>
}

export function SavedDetails({ observation, member, spot, onDeletePhoto, onDelete }: {
  observation: Observation; member?: Member; spot?: Spot; onDeletePhoto: () => void; onDelete: () => void
}) {
  return <div className="record-details">
    <p className="muted">{member?.name} · {spot?.name} · {dateLabel(observation.createdAt, true)}</p>
    <Photo photo={observation.photo} source={observation.source} />
    <div className="record-values"><span>感受</span><strong>{observation.sensations.join('、')}</strong><span>持续时间</span><strong>{observation.duration}</strong><span>变化</span><strong>{observation.change}</strong></div>
    {observation.note && <p className="record-note">{observation.note}</p>}
    <p className="small-note">{observation.analysis === 'example' ? '这是一条内置示例记录。' : '本条为个人观察，尚未进行 AI 识别。'}</p>
    <div className="dialog-actions">{observation.photo && <button className="button" onClick={onDeletePhoto}>仅删除照片</button>}<button className="button danger" onClick={onDelete}>删除这条记录</button></div>
  </div>
}
