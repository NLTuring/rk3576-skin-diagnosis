import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Check, CircleHelp, Plus, Settings2, X } from 'lucide-react'
import {
  addMember, makeExport, recordsForSpot, removeMember, removeObservation, removeObservationPhoto,
  removeReminder, renameMember, saveObservation, setReminder,
  type Draft, type Journal, type Member, type Observation, type Spot, type Vec3,
} from './domain/journal'
import { createDemoJournal, REGIONS } from './domain/seed'
import { loadJournal, persistJournal } from './lib/storage'
import { dateLabel, today } from './lib/dates'
import { HomePage, MemberStrip, CheckPage, ResultPage, ComparePage, SavedDetails } from './components/JournalPages'
import { CameraPage } from './components/CameraPage'
import { Modal } from './components/Modal'
import { ExportForm, LocationForm, MemberForm, ReminderForm, type LocationChoice } from './components/JournalDialogs'
import { FamilyPage, PlansPage, SettingsPage } from './components/ManagementPages'

type Page = 'home' | 'check' | 'result' | 'camera' | 'compare' | 'plans' | 'family' | 'settings'
type Dialog =
  | { kind: 'member'; member?: Member }
  | { kind: 'location'; initial: LocationChoice }
  | { kind: 'list' }
  | { kind: 'history'; spotId: string }
  | { kind: 'reminder'; spotId: string }
  | { kind: 'detail'; observationId: string }
  | { kind: 'export' }
  | { kind: 'confirm'; title: string; copy: string; label: string; onConfirm: () => void; danger?: boolean }
const uid = () => crypto.randomUUID()
function storedSelection() {
  try { return JSON.parse(sessionStorage.getItem('dermascope-selection') ?? '{}') as { member?: string; spot?: string } }
  catch { return {} }
}

export function App() {
  const [journal, setJournal] = useState<Journal | null>(null)
  const snapshot = useRef<Journal | null>(null)
  const [bootError, setBootError] = useState('')
  const [page, setPage] = useState<Page>('home')
  const [activeId, setActiveId] = useState(() => storedSelection().member ?? 'me')
  const [spotId, setSpotId] = useState<string | undefined>(() => storedSelection().spot ?? 'me-arm')
  const [draft, setDraft] = useState<Draft | null>(null)
  const [dialog, setDialog] = useState<Dialog | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const committing = useRef(false)
  const main = useRef<HTMLElement>(null)
  const member = journal?.members.find(m => m.id === activeId) ?? journal?.members[0]
  const spot = journal?.spots.find(s => s.id === spotId && s.memberId === member?.id)
  const draftMember = journal?.members.find(m => m.id === draft?.memberId)
  const unsaved = Boolean(draft)

  useEffect(() => {
    let mounted = true
    void loadJournal().then(stored => {
      if (mounted) { const initial = stored ?? createDemoJournal(); snapshot.current = initial; setJournal(initial) }
    }).catch(reason => { if (mounted) setBootError(reason instanceof Error ? reason.message : '暂时无法读取本地档案。') })
    return () => { mounted = false }
  }, [])
  useEffect(() => {
    if (!journal) return
    try { sessionStorage.setItem('dermascope-selection', JSON.stringify({ member: member?.id, spot: spotId })) } catch { /* optional UI preference */ }
  }, [member?.id, spotId, journal])
  useEffect(() => {
    if (!unsaved && !busy) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [unsaved, busy])
  useEffect(() => { window.scrollTo(0, 0); main.current?.focus({ preventScroll: true }); setError('') }, [page])
  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(''), 5500)
    return () => clearTimeout(timer)
  }, [notice])

  const commit = async (change: (state: Journal) => Journal, after?: (next: Journal) => void, message = '已保存在本地手账。') => {
    if (committing.current || !snapshot.current) return
    committing.current = true
    setBusy(true)
    setError('')
    try {
      const write = async () => {
        const latest = await loadJournal() ?? snapshot.current!
        const next = change(latest)
        await persistJournal(next)
        return next
      }
      // Read and write under the same browser lock to avoid clobbering another tab's save.
      const next = navigator.locks ? await navigator.locks.request('dermascope-journal-write', write) : await write()
      snapshot.current = next
      setJournal(next)
      after?.(next)
      setNotice(message)
    } catch (reason) { setError(reason instanceof Error ? reason.message : '这次操作未能保存，请重试。') }
    finally { committing.current = false; setBusy(false) }
  }
  const guarded = (action: () => void) => {
    if (busy) return
    setError('')
    if (draft) setDialog({
      kind: 'confirm', title: '先把这一页留好', copy: '本次观察尚未保存。离开后，临时照片与填写的内容会被放弃；已保存的记录不受影响。',
      label: '放弃本次记录并离开', onConfirm: () => { setDraft(null); setDialog(null); action() },
    })
    else action()
  }
  const navigate = (next: Page) => { if (next === page) return; guarded(() => { setPage(next); setDialog(null) }) }
  const selectMember = (id: string) => guarded(() => {
    setActiveId(id)
    setSpotId(journal?.spots.find(s => s.memberId === id)?.id)
    setPage('home')
  })
  const begin = (choice: LocationChoice, owner: string, existing?: string) => {
    setDraft({ ...choice, memberId: owner, spotId: existing, sensations: [], duration: '', change: '', note: '', source: 'personal' })
    setActiveId(owner)
    setSpotId(existing)
    setDialog(null)
    setPage('check')
    setError('')
  }
  const followup = (target: Spot) => begin(target, target.memberId, target.id)
  const newLocation = (point?: Vec3, normal?: Vec3, region?: string) => {
    if (!member) { setDialog({ kind: 'member' }); return }
    const fallback = REGIONS[0]
    setDialog({ kind: 'location', initial: {
      point: point ?? [...fallback.point], normal: normal ?? [0, 0, 1],
      name: region ?? fallback.name, region: region ?? fallback.name,
    } })
  }
  const save = (keep: boolean) => {
    if (!draft) return
    const newSpotId = uid()
    void commit(state => saveObservation(state, draft, keep, { observationId: uid(), newSpotId, now: new Date().toISOString() }), () => {
      setSpotId(draft.spotId ?? newSpotId)
      setActiveId(draft.memberId)
      setDraft(null)
      setPage('home')
    }, keep && draft.photo ? '照片与观察记录已保存在本地。' : '观察记录已保存，本次照片未留存。')
  }
  const openDetail = (entry: Observation) => { setError(''); setDialog({ kind: 'detail', observationId: entry.id }) }
  const deleteMember = (target: Member) => {
    const count = journal!.observations.filter(o => o.memberId === target.id).length
    setDialog({
      kind: 'confirm', title: '删除' + target.name + '的手账？', copy: '将删除这位成员的全部观察位置、' + count + ' 条记录、已保存照片及复查计划。此操作无法撤销。',
      label: '确认删除这位成员', danger: true, onConfirm: () => { void commit(state => removeMember(state, target.id), next => {
        setDialog(null)
        if (member?.id === target.id) { setActiveId(next.members[0]?.id ?? ''); setSpotId(next.spots.find(s => s.memberId === next.members[0]?.id)?.id) }
      }, '这位成员的本地手账已删除。') },
    })
  }
  const exportArchive = (photos: boolean) => {
    if (!journal) return
    const url = URL.createObjectURL(new Blob([JSON.stringify(makeExport(journal, photos), null, 2)], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = url
    link.download = '肤镜-皮肤观察记录-' + today() + (photos ? '-含照片' : '') + '.json'
    document.body.append(link)
    link.click()
    link.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    setDialog(null)
    setNotice('已开始下载' + (photos ? '包含照片的' : '不含照片的') + '观察档案。')
  }
  const closeDialog = () => { if (!busy) { setDialog(null); setError('') } }
  if (!journal) return <div className="boot-screen"><span className="brand-mark" />{bootError ? <><h1>本地手账暂时无法打开</h1><p role="alert">{bootError}</p><p className="small-note">现有内容未被自动清空或替换。</p><button className="button primary" onClick={() => location.reload()}>重新读取</button></> : <><span className="loading-ring" /><p>正在翻开你的皮肤手账…</p></>}</div>

  const selectedEntry = dialog?.kind === 'detail' ? journal.observations.find(o => o.id === dialog.observationId) : undefined
  const reminderSpot = dialog?.kind === 'reminder' ? journal.spots.find(s => s.id === dialog.spotId) : undefined
  const reminder = journal.reminders.find(r => r.spotId === reminderSpot?.id)
  const pageName = page === 'home' ? '身体手账' : page === 'plans' ? '复查计划' : page === 'family' ? '家庭成员' : page === 'settings' ? '本地档案' : '本次观察'
  const dialogTitle = dialog?.kind === 'member' ? dialog.member ? '修改成员称呼' : '给家人，一本自己的手账'
    : dialog?.kind === 'location' ? '确认观察位置' : dialog?.kind === 'list' ? '找到身体上的这一处'
    : dialog?.kind === 'reminder' ? '安排下一次观察' : dialog?.kind === 'detail' ? '这一次的记录'
    : dialog?.kind === 'export' ? '把观察记录带走' : dialog?.kind === 'history' ? '这一处的全部观察'
    : dialog?.kind === 'confirm' ? dialog.title : ''
  const errorBox = error && <div className="error-toast" role="alert"><span>{error}</span><button className="icon-button" aria-label="关闭提示" onClick={() => setError('')}><X size={17} /></button></div>
  return <div className="app-shell">
    <a href="#main-content" className="skip-link">跳到主要内容</a>
    <header className="site-header">
      <button className="brand" aria-label="肤镜，返回身体手账" onClick={() => navigate('home')}><span className="brand-mark"><i /></span><span><strong>肤镜</strong><small>DERMASCOPE</small></span></button>
      <nav aria-label="主导航">{([['home', '身体手账'], ['plans', '复查计划'], ['family', '家庭成员']] as const).map(([key, name]) => <button key={key} className={page === key || key === 'home' && ['check', 'camera', 'result', 'compare'].includes(page) ? 'active' : ''} aria-current={page === key ? 'page' : undefined} onClick={() => navigate(key)} disabled={busy}>{name}</button>)}</nav>
      <div className="header-tools"><button className="local-indicator" onClick={() => navigate('settings')}><i />本地档案</button><button className="icon-button" aria-label="本地档案与设置" onClick={() => navigate('settings')}><Settings2 size={20} strokeWidth={1.4} /></button></div>
    </header>
    <main ref={main} id="main-content" tabIndex={-1}>
      {page === 'home' && <>
        <div className="page-heading home-heading"><div><span className="eyebrow">FAMILY SKIN JOURNAL</span><h1>每一次观察，都有迹可循。</h1><p>从身体上的一个位置，翻开属于这一处的记录。</p></div><button className="button primary new-observation" onClick={() => newLocation()}><Plus size={21} />记录新变化</button></div>
        <MemberStrip members={journal.members} activeId={member?.id ?? ''} onSelect={selectMember} onAdd={() => setDialog({ kind: 'member' })} />
        <HomePage journal={journal} member={member} spot={spot} onSelect={setSpotId} onPick={newLocation} onList={() => setDialog({ kind: 'list' })} onNew={() => newLocation()}
          onCheck={() => spot && followup(spot)} onCompare={() => setPage('compare')} onReminder={() => spot && setDialog({ kind: 'reminder', spotId: spot.id })}
          onDetail={openDetail} onHistory={() => spot && setDialog({ kind: 'history', spotId: spot.id })} onAddMember={() => setDialog({ kind: 'member' })} />
      </>}
      {page === 'check' && draft && draftMember && <CheckPage draft={draft} member={draftMember} onChange={setDraft} onNext={() => { setError(''); setPage('result') }} onCamera={() => setPage('camera')} onError={setError} onBack={() => navigate('home')} />}
      {page === 'result' && draft && draftMember && <ResultPage draft={draft} member={draftMember} onSave={save} onBack={() => setPage('check')} busy={busy} />}
      {page === 'camera' && draft && <CameraPage draft={draft} reference={recordsForSpot(journal, draft.memberId, draft.spotId).find(r => r.photo)} onBack={() => setPage('check')} onCapture={photo => { setDraft({ ...draft, photo, source: 'personal' }); setPage('check') }} />}
      {page === 'compare' && member && spot && <ComparePage key={spot.id} records={recordsForSpot(journal, member.id, spot.id)} member={member} spot={spot} onBack={() => setPage('home')} onCheck={() => followup(spot)} />}
      {page === 'plans' && <PlansPage journal={journal} onFollowup={followup} onEdit={target => setDialog({ kind: 'reminder', spotId: target.id })} onHome={() => navigate('home')} />}
      {page === 'family' && <FamilyPage journal={journal} onOpen={selectMember} onAdd={() => setDialog({ kind: 'member' })} onRename={target => setDialog({ kind: 'member', member: target })} onDelete={deleteMember} />}
      {page === 'settings' && <SettingsPage journal={journal} onExport={() => setDialog({ kind: 'export' })} onClear={() => setDialog({
        kind: 'confirm', title: '清空这台浏览器中的手账？', copy: '全部成员、观察位置、文字记录、保存的照片和复查计划都会被删除，无法撤销。电脑中导入前的原始照片不受影响。', label: '确认清空所有记录', danger: true,
        onConfirm: () => { void commit(() => ({ version: 1, members: [], spots: [], observations: [], reminders: [] }), () => { setDialog(null); setActiveId(''); setSpotId(undefined); setPage('home') }, '所有本地手账已清空。') },
      })} />}
    </main>
    <footer className="site-footer"><span><i />交互原型 · AI 识别尚未接入</span><button onClick={() => navigate('settings')}><CircleHelp size={14} />关于本地保存</button><span>{pageName} / 01</span></footer>
    {notice && <div className="notice-toast" role="status"><Check size={17} />{notice}</div>}
    {!dialog && errorBox}
    {dialog && <Modal title={dialogTitle} onClose={closeDialog}>
      {dialog.kind === 'member' && <MemberForm member={dialog.member} busy={busy} onSubmit={name => {
        const id = dialog.member?.id ?? uid()
        void commit(state => dialog.member ? renameMember(state, id, name) : addMember(state, name, id), next => {
          setDialog(null)
          if (!dialog.member) { setActiveId(id); setSpotId(next.spots.find(s => s.memberId === id)?.id); setPage('home') }
        })
      }} />}
      {dialog.kind === 'location' && member && <LocationForm initial={dialog.initial} spots={journal.spots.filter(s => s.memberId === member.id)} onStart={choice => begin(choice, member.id)} onContinue={followup} />}
      {dialog.kind === 'list' && <div className="spot-list"><p className="muted">{member?.name ?? '家庭'}的观察位置，也可新建一个部位。</p>
        {journal.spots.filter(s => s.memberId === member?.id).map(s => <button key={s.id} className="spot-list-row" onClick={() => { setSpotId(s.id); setDialog(null) }}><div><strong>{s.name}</strong><span>{recordsForSpot(journal, s.memberId, s.id).length} 条观察记录</span></div><ArrowRight size={18} /></button>)}
        <button className="button primary" onClick={() => newLocation()}><Plus size={18} />选择新部位</button>
      </div>}
      {dialog.kind === 'history' && <div className="history-list">{journal.observations.filter(o => o.spotId === dialog.spotId).sort((a,b) => b.createdAt.localeCompare(a.createdAt)).map(o => <button key={o.id} className="spot-list-row" onClick={() => openDetail(o)}><div><strong>{dateLabel(o.createdAt, true)}</strong><span>{o.sensations.join('、')} · {o.change} · {o.source === 'example' ? '示例' : o.photo ? '有照片' : '文字记录'}</span></div><ArrowRight size={18} /></button>)}</div>}
      {dialog.kind === 'reminder' && reminderSpot && <ReminderForm spot={reminderSpot} currentDate={reminder?.date} busy={busy}
        onSave={date => { void commit(state => setReminder(state, reminderSpot.memberId, reminderSpot.id, date, uid()), () => setDialog(null), '复查日期已记好。') }}
        onCancel={() => { if (reminder) void commit(state => removeReminder(state, reminder.id), () => setDialog(null), '这项复查计划已取消。') }} />}
      {dialog.kind === 'detail' && selectedEntry && <SavedDetails observation={selectedEntry} member={journal.members.find(m => m.id === selectedEntry.memberId)} spot={journal.spots.find(s => s.id === selectedEntry.spotId)}
        onDeletePhoto={() => setDialog({ kind: 'confirm', title: '仅删除这张照片？', copy: '删除手账中保存的照片，保留本条的日期、症状和文字。电脑中的原始文件不受影响。', label: '确认删除照片', danger: true, onConfirm: () => { void commit(state => removeObservationPhoto(state, selectedEntry.id), () => setDialog(null), '照片已删除，文字观察仍然保留。') } })}
        onDelete={() => setDialog({ kind: 'confirm', title: '删除这条观察记录？', copy: '本条文字与保存的照片会一起删除，其他日期的记录不受影响。此操作无法撤销。', label: '确认删除记录', danger: true, onConfirm: () => { void commit(state => removeObservation(state, selectedEntry.id), () => setDialog(null), '这条记录已删除。') } })} />}
      {dialog.kind === 'export' && <ExportForm journal={journal} onExport={exportArchive} />}
      {dialog.kind === 'confirm' && <><p className="confirm-copy">{dialog.copy}</p><div className="dialog-actions"><button className="button" disabled={busy} onClick={closeDialog}>返回</button><button className={'button ' + (dialog.danger ? 'danger' : 'primary')} disabled={busy} onClick={dialog.onConfirm}>{busy ? '正在处理…' : dialog.label}</button></div></>}
      {errorBox}
    </Modal>}
  </div>
}
