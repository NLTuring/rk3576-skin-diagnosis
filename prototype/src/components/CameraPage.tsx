import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, Camera, CameraOff, Check, ImagePlus, RotateCcw, ScanLine } from 'lucide-react'
import type { Draft, Observation } from '../domain/journal'
import { shortDate } from '../lib/dates'

export function CameraPage({ draft, reference, onBack, onCapture }: {
  draft: Draft; reference?: Observation; onBack: () => void; onCapture: (photo: string) => void
}) {
  const video = useRef<HTMLVideoElement>(null)
  const stream = useRef<MediaStream | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [status, setStatus] = useState<'opening' | 'live' | 'error' | 'preview'>('opening')
  const [error, setError] = useState('')
  const [shot, setShot] = useState<string>()
  const [overlay, setOverlay] = useState(Boolean(reference?.photo))
  const [opacity, setOpacity] = useState(28)
  const stop = () => { stream.current?.getTracks().forEach(track => track.stop()); stream.current = null }

  useEffect(() => {
    let cancelled = false
    const currentVideo = video.current
    setStatus('opening')
    setError('')
    setShot(undefined)
    const open = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('当前环境不支持摄像头，请使用本机浏览器打开页面。')
        const next = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1440 } }, audio: false,
        })
        if (cancelled) { next.getTracks().forEach(track => track.stop()); return }
        stream.current = next
        if (currentVideo) { currentVideo.srcObject = next; await currentVideo.play() }
        if (!cancelled) setStatus('live')
      } catch (reason) {
        if (cancelled) return
        stop()
        const name = reason instanceof DOMException ? reason.name : ''
        setError(name === 'NotAllowedError' ? '摄像头权限未开启。你可以在浏览器地址栏中允许访问，或导入已有照片。'
          : name === 'NotFoundError' ? '没有找到可用摄像头，请连接摄像头，或导入已有照片。'
          : name === 'NotReadableError' ? '摄像头可能正被其他应用占用，关闭占用后可以重试。'
          : reason instanceof Error ? reason.message : '摄像头暂时不可用，请重试或导入已有照片。')
        setStatus('error')
      }
    }
    void open()
    return () => {
      cancelled = true
      stop()
      if (currentVideo) currentVideo.srcObject = null
    }
  }, [attempt])

  const capture = () => {
    const frame = video.current
    if (!frame?.videoWidth || !frame.videoHeight) { setError('画面还未就绪，请稍后再拍。'); return }
    const ratio = Math.min(1, 2048 / Math.max(frame.videoWidth, frame.videoHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(frame.videoWidth * ratio)
    canvas.height = Math.round(frame.videoHeight * ratio)
    const context = canvas.getContext('2d')
    if (!context) { setError('当前浏览器无法拍摄，请改用已有照片。'); return }
    // Only the live video is drawn. The reference is a separate DOM image.
    context.drawImage(frame, 0, 0, canvas.width, canvas.height)
    setShot(canvas.toDataURL('image/jpeg', .92))
    stop()
    setStatus('preview')
    setError('')
  }
  return <>
    <div className="page-heading"><div><button className="breadcrumb" onClick={onBack}><ArrowLeft size={14} />返回本次记录</button><h1>{status === 'preview' ? '这一张，看得清楚吗？' : '让下一次，也有迹可循。'}</h1><p>{draft.name} · {status === 'preview' ? '确认后，将照片带回本次观察。' : '对齐位置、距离与角度，慢慢拍一张清晰的照片。'}</p></div><span className="context-pill">复查拍摄向导</span></div>
    <div className="camera-grid">
      <section>
        <div className="camera-viewport" data-testid="camera-viewport">
          <video ref={video} autoPlay muted playsInline aria-label="实时摄像头画面" hidden={status !== 'live'} />
          {status === 'live' && overlay && reference?.photo && <img className="ghost-reference" data-testid="ghost-reference" src={reference.photo} style={{ opacity: opacity / 100 }} alt="上次照片的取景参考叠影" />}
          {status === 'live' && <><div className="viewfinder" /><span className="camera-live"><i />实时画面</span></>}
          {status === 'opening' && <div className="camera-message"><span className="loading-ring" /><h2>正在打开摄像头</h2><p>请在浏览器提示中允许使用摄像头。</p><button className="text-button" onClick={onBack}>改用已有照片 <ArrowLeft size={16} /></button></div>}
          {status === 'error' && <div className="camera-message"><CameraOff size={42} strokeWidth={1.1} /><h2>无法使用摄像头</h2><p>{error}</p><button className="button primary" onClick={onBack}><ImagePlus size={19} />改用已有照片</button><button className="text-button quiet" onClick={() => setAttempt(n => n + 1)}>重新尝试</button></div>}
          {status === 'preview' && shot && <img className="captured-photo" src={shot} alt="本次独立拍摄的照片" />}
        </div>
        {status === 'live' && <div className="capture-controls"><span className="small-note">画面稳定后，再按下快门。</span><button className="shutter" aria-label="拍摄照片" onClick={capture}><Camera size={25} /></button><span className="small-note">只拍摄当前画面</span></div>}
        {status === 'preview' && <div className="capture-controls"><button className="button" onClick={() => setAttempt(n => n + 1)}><RotateCcw size={18} />重新拍摄</button><button className="button primary" onClick={() => shot && onCapture(shot)}><Check size={18} />使用这张照片</button></div>}
        {error && status !== 'error' && <p role="alert" className="inline-error">{error}</p>}
      </section>
      <aside className="camera-guide">
        <span className="eyebrow accent">A LITTLE CLOSER</span><h2>像上次一样，<br />再看这一处。</h2>
        {reference?.photo ? <div className="reference-card"><img src={reference.photo} alt="上一次已保存的参考照片" /><div><span>{shortDate(reference.createdAt)} 的记录</span><small>{reference.source === 'example' ? '示例照片 · 仅演示取景' : '来自你已保存的照片'}</small></div></div> : <p className="inline-notice">这一处还没有保存过照片。本次可按下方提示拍摄，保存照片后，下次便能用来对齐。</p>}
        <div className="shooting-tips">
          <div className="numbered-row"><span>01</span><div><strong>找到同一个位置</strong><p>借助痣、关节等周边特征确定部位。</p></div></div>
          <div className="numbered-row"><span>02</span><div><strong>靠近上次的距离与角度</strong><p>让观察区域在画面中大小接近。</p></div></div>
          <div className="numbered-row"><span>03</span><div><strong>光线均匀，画面清楚</strong><p>避免反光和阴影，拍后再确认。</p></div></div>
        </div>
        <label className="toggle-row"><span><ScanLine size={18} />显示上次照片叠影</span><input type="checkbox" disabled={!reference?.photo || status !== 'live'} checked={overlay} onChange={e => setOverlay(e.target.checked)} /></label>
        {reference?.photo && <label className="opacity-label">参考图透明度 <output>{opacity}%</output><input aria-label="参考图透明度" type="range" min="10" max="70" disabled={!overlay || status !== 'live'} value={opacity} onChange={e => setOpacity(Number(e.target.value))} /></label>}
        <p className="small-note">叠影只用于取景，不会出现在新照片里。<br />拍摄后仍由你决定是否保存在手账中。</p>
      </aside>
    </div>
  </>
}
