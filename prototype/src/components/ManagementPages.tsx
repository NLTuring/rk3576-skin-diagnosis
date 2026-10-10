import { ArrowRight, Bookmark, CalendarDays, Download, FileText, Plus, Settings2, Trash2, Users } from 'lucide-react'
import type { Journal, Member, Spot } from '../domain/journal'
import { today } from '../lib/dates'

export function PlansPage({ journal, onFollowup, onEdit, onHome }: {
  journal: Journal; onFollowup: (spot: Spot) => void; onEdit: (spot: Spot) => void; onHome: () => void
}) {
  const reminders = [...journal.reminders].sort((a, b) => a.date.localeCompare(b.date))
  return <>
    <div className="page-heading"><div><span className="eyebrow">COME BACK, WITH CARE</span><h1>给下一次观察，留个日期。</h1><p>一家人的复查计划，按时间轻轻排好。</p></div><span className="context-pill"><CalendarDays size={17} />{reminders.length} 项待记录</span></div>
    <div className="management-intro"><span>日期由你安排，完成记录后会自动移除这一项计划。</span><span className="small-note">仅网页内提醒</span></div>
    <div className="plan-list">
      {reminders.map(reminder => {
        const spot = journal.spots.find(s => s.id === reminder.spotId)!
        const member = journal.members.find(m => m.id === reminder.memberId)!
        const past = reminder.date < today()
        return <article className="plan-row" key={reminder.id}>
          <div className="date-block"><span>{reminder.date.slice(5, 7)} 月</span><strong>{reminder.date.slice(8)}</strong></div>
          <div className="plan-main"><span className="eyebrow">{member.name}的手账</span><h2>{spot.name}</h2><time>{reminder.date}</time>{past && <span className="badge warm">待补充观察</span>}</div>
          <div className="row-actions"><button className="text-button quiet" onClick={() => onEdit(spot)}>调整计划</button><button className="button" onClick={() => onFollowup(spot)}>开始复查 <ArrowRight size={17} /></button></div>
        </article>
      })}
      {!reminders.length && <div className="large-empty"><CalendarDays size={44} strokeWidth={1} /><h2>下一次，由你决定。</h2><p>打开某一处手账，就能为它安排复查日期。</p><button className="button primary" onClick={onHome}>回到身体手账 <ArrowRight size={18} /></button></div>}
    </div>
    <div className="margin-note"><span>小记 /</span><p>时间让细微变化有了参照。<br />每一次记录，都不必很复杂。</p></div>
  </>
}

export function FamilyPage({ journal, onOpen, onAdd, onRename, onDelete }: {
  journal: Journal; onOpen: (id: string) => void; onAdd: () => void; onRename: (member: Member) => void; onDelete: (member: Member) => void
}) {
  return <>
    <div className="page-heading"><div><span className="eyebrow">A JOURNAL FOR EVERYONE</span><h1>各自的手账，共同的关心。</h1><p>一个称呼，一本手账。把家人的记录好好分开。</p></div><button className="button primary" onClick={onAdd}><Plus size={19} />添加家庭成员</button></div>
    <div className="family-list">{journal.members.map((member, index) => <article className="family-row" key={member.id}>
      <span className="member-number">{String(index + 1).padStart(2, '0')}</span><div className="member-avatar">{member.name.slice(0, 1)}</div><div className="family-main"><h2>{member.name}</h2><p>{journal.spots.filter(s => s.memberId === member.id).length} 处位置 <span>·</span> {journal.observations.filter(o => o.memberId === member.id).length} 条观察记录</p></div>
      <div className="row-actions"><button className="text-button quiet" onClick={() => onRename(member)}>修改称呼</button><button className="icon-button" aria-label={'删除成员' + member.name} onClick={() => onDelete(member)}><Trash2 size={18} /></button><button className="button" onClick={() => onOpen(member.id)}>翻开手账 <ArrowRight size={17} /></button></div>
    </article>)}</div>
    {!journal.members.length && <div className="large-empty"><Users size={44} strokeWidth={1} /><h2>从你，或你关心的人开始。</h2><button className="button primary" onClick={onAdd}>建立第一位成员</button></div>}
    <div className="margin-note"><Bookmark size={23} strokeWidth={1.2} /><p>无需注册或登录。家庭成员用于整理记录；<br />能使用这台电脑和浏览器的人，也能打开这些手账。</p></div>
  </>
}

export function SettingsPage({ journal, onExport, onClear }: { journal: Journal; onExport: () => void; onClear: () => void }) {
  return <>
    <div className="page-heading"><div><span className="eyebrow">KEPT CLOSE TO HOME</span><h1>你的记录，留在身边。</h1><p>了解本地档案，也决定怎样保存与带走。</p></div><Settings2 size={32} strokeWidth={1.1} /></div>
    <div className="settings-grid"><section className="settings-story"><span className="big-index">LOCAL<br />FIRST.</span><p>这是一个可交互的产品原型。<br />我们从真实的记录习惯开始。</p><span className="context-pill">识别模型与 RK3576 尚未连接</span></section><section>
      <article className="setting-item"><h2>保存在当前浏览器</h2><p>目前使用这台电脑、当前浏览器的本地存储。清除网站数据、更换浏览器或地址后，原记录可能无法访问；请主动导出需要保留的内容。</p><span className="small-note">{journal.observations.length} 条观察 · {journal.observations.filter(o => o.photo).length} 张已保存影像（含示例）</span></article>
      <article className="setting-item"><h2>照片由你选择留存</h2><p>新照片默认不保存，确认勾选后才写入手账。导入与拍摄在本机处理，不上传云端。照片会缩小为最长边 2048 像素的本地副本，原始文件不受影响。</p><p className="small-note">当前版本没有账号或加密访问控制，成员切换用于整理记录。</p></article>
      <article className="setting-item"><h2>导出观察记录</h2><p>主动下载一份 JSON 档案。默认仅导出结构化信息，照片需单独勾选。</p><button className="button" onClick={onExport}><Download size={17} />导出本地档案</button></article>
      <article className="setting-item"><h2>原型与素材</h2><p>初次打开包含清楚标注的示例手账。示例画面只演示交互，个人照片不会生成模拟病名。摄像头取景与参考叠影需要浏览器授权。</p><a className="text-button" href="/models/sources.json" target="_blank" rel="noreferrer"><FileText size={16} />人体素材来源与许可</a></article>
      <article className="setting-item"><h2>清空当前手账</h2><p>移除这个网站中所有家庭成员、观察记录、已保存照片与复查计划。</p><button className="text-button danger-text" onClick={onClear}><Trash2 size={17} />清空本地记录</button></article>
    </section></div>
  </>
}
