import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { RotateCcw, ZoomIn, ZoomOut, List, Move } from 'lucide-react'
import type { Spot, Vec3 } from '../domain/journal'
import { inferRegion } from '../domain/seed'

type Props = {
  spots: Spot[]; selectedId?: string
  onSelect: (id: string) => void
  onPick: (point: Vec3, normal: Vec3, region: string) => void
  onList: () => void
}
type Controller = { orient: (back: boolean) => void; zoom: (factor: number) => void }

export function BodyMap(props: Props) {
  const host = useRef<HTMLDivElement>(null)
  const pins = useRef(new Map<string, HTMLButtonElement>())
  const latest = useRef(props)
  latest.current = props
  const control = useRef<Controller | null>(null)
  const [flat, setFlat] = useState(() => new URLSearchParams(location.search).get('view') === '2d')
  const [ready, setReady] = useState(false)
  const [view, setView] = useState<'front' | 'back'>('front')
  const [fallbackReason, setFallbackReason] = useState('')

  useEffect(() => {
    if (flat || !host.current) return
    const container = host.current
    let disposed = false
    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' })
    } catch {
      setFallbackReason('已切换到二维视图，仍可通过部位列表记录。')
      setFlat(true)
      return
    }
    setReady(false)
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75))
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.05
    renderer.domElement.setAttribute('aria-label', '可旋转的三维身体地图')
    renderer.domElement.tabIndex = 0
    container.prepend(renderer.domElement)
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(32, 1, .1, 110)
    camera.position.set(0, .3, 34)
    const orbit = new OrbitControls(camera, renderer.domElement)
    orbit.target.set(0, .0, 0)
    orbit.enableDamping = true
    orbit.dampingFactor = .13
    orbit.enablePan = false
    orbit.minDistance = 14
    orbit.maxDistance = 44
    orbit.minPolarAngle = .62
    orbit.maxPolarAngle = 2.28
    orbit.rotateSpeed = .62
    scene.add(new THREE.HemisphereLight(0xfffcf6, 0x9f9584, 2.2))
    const key = new THREE.DirectionalLight(0xfff7e9, 2.7)
    key.position.set(-7, 14, 10)
    scene.add(key)
    const fill = new THREE.DirectionalLight(0xffffff, .65)
    fill.position.set(9, 3, -8)
    scene.add(fill)
    const shadowCanvas = document.createElement('canvas')
    shadowCanvas.width = 128
    shadowCanvas.height = 128
    const paint = shadowCanvas.getContext('2d')!
    const shadow = paint.createRadialGradient(64, 64, 6, 64, 64, 64)
    shadow.addColorStop(0, 'rgba(94,79,57,0.2)')
    shadow.addColorStop(.55, 'rgba(94,79,57,0.1)')
    shadow.addColorStop(1, 'rgba(94,79,57,0)')
    paint.fillStyle = shadow
    paint.fillRect(0, 0, 128, 128)
    const shadowTexture = new THREE.CanvasTexture(shadowCanvas)
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(8, 5), new THREE.MeshBasicMaterial({ map: shadowTexture, transparent: true, depthWrite: false }))
    ground.rotation.x = -Math.PI / 2
    ground.position.y = -8.48
    scene.add(ground)
    const material = new THREE.MeshStandardMaterial({ color: 0xded9cc, roughness: .86, metalness: 0 })
    const bodyMeshes: THREE.Mesh[] = []
    const ray = new THREE.Raycaster()
    let tween: { from: THREE.Vector3; to: THREE.Vector3; start: number } | null = null
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches
    const orient = (back: boolean) => {
      setView(back ? 'back' : 'front')
      const to = new THREE.Vector3(0, .3, back ? -34 : 34)
      if (reducedMotion) { camera.position.copy(to); orbit.update() }
      else tween = { from: camera.position.clone(), to, start: performance.now() }
    }
    control.current = { orient, zoom: factor => { camera.position.multiplyScalar(factor); orbit.update() } }
    const onResize = () => {
      const width = container.clientWidth, height = container.clientHeight
      if (!width || !height) return
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      renderer.setSize(width, height)
    }
    const resize = new ResizeObserver(onResize)
    resize.observe(container)
    onResize()
    new GLTFLoader().load('/models/body.glb', gltf => {
      if (disposed) {
        gltf.scene.traverse(node => { if (node instanceof THREE.Mesh) node.geometry.dispose() })
        return
      }
      gltf.scene.traverse(node => {
        if (node instanceof THREE.Mesh) {
          const old = Array.isArray(node.material) ? node.material : [node.material]
          old.forEach(m => m.dispose())
          node.geometry.computeVertexNormals()
          node.material = material
          bodyMeshes.push(node)
        }
      })
      scene.add(gltf.scene)
      setReady(true)
    }, undefined, () => {
      if (!disposed) {
        setFallbackReason('人体资源暂时不可用，已为你打开二维部位图。')
        setFlat(true)
      }
    })
    let down = { x: 0, y: 0 }
    const onDown = (event: PointerEvent) => { down = { x: event.clientX, y: event.clientY }; tween = null }
    const onUp = (event: PointerEvent) => {
      if (event.button !== 0 || Math.hypot(event.clientX - down.x, event.clientY - down.y) > 5 || !bodyMeshes.length) return
      const rect = renderer.domElement.getBoundingClientRect()
      ray.setFromCamera(new THREE.Vector2((event.clientX - rect.left)/rect.width*2-1, 1-(event.clientY-rect.top)/rect.height*2), camera)
      const hit = ray.intersectObjects(bodyMeshes, false)[0]
      if (!hit?.face) return
      const normal = hit.face.normal.clone().transformDirection(hit.object.matrixWorld).normalize()
      const point = hit.point.clone().addScaledVector(normal, .035).toArray() as Vec3
      latest.current.onPick(point, normal.toArray() as Vec3, inferRegion(point))
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault()
        camera.position.applyAxisAngle(new THREE.Vector3(0, 1, 0), event.key === 'ArrowLeft' ? -.15 : .15)
        orbit.update()
      }
      if (event.key === '+' || event.key === '-') { event.preventDefault(); control.current?.zoom(event.key === '+' ? .9 : 1.1) }
    }
    const onContextLost = (event: Event) => {
      event.preventDefault()
      if (!disposed) { setFallbackReason('三维视图已暂停，可以继续使用部位列表。'); setFlat(true) }
    }
    renderer.domElement.addEventListener('pointerdown', onDown)
    renderer.domElement.addEventListener('pointerup', onUp)
    renderer.domElement.addEventListener('keydown', onKey)
    renderer.domElement.addEventListener('webglcontextlost', onContextLost)
    const projected = new THREE.Vector3()
    const toCamera = new THREE.Vector3()
    let lastOcclusion = 0
    const visibility = new Map<string, boolean>()
    renderer.setAnimationLoop(time => {
      if (disposed) return
      if (tween) {
        const t = Math.min((time - tween.start)/300, 1)
        // Orbit around the model, rather than crossing through its center.
        const fromAngle = Math.atan2(tween.from.x, tween.from.z)
        let difference = Math.atan2(tween.to.x, tween.to.z) - fromAngle
        if (difference > Math.PI) difference -= Math.PI*2
        if (difference < -Math.PI) difference += Math.PI*2
        const angle = fromAngle + difference*(1-Math.pow(1-t, 3))
        const radius = THREE.MathUtils.lerp(tween.from.length(), 34, t)
        camera.position.set(Math.sin(angle)*radius, .3, Math.cos(angle)*radius)
        if (t === 1) tween = null
      }
      orbit.update()
      const checkOcclusion = time-lastOcclusion > 100
      if (checkOcclusion) lastOcclusion = time
      for (const spot of latest.current.spots) {
        const button = pins.current.get(spot.id)
        if (!button) continue
        projected.fromArray(spot.point)
        toCamera.copy(camera.position).sub(projected).normalize()
        const facing = toCamera.dot(new THREE.Vector3().fromArray(spot.normal)) > .03
        if (checkOcclusion && facing && bodyMeshes.length) {
          const direction = projected.clone().sub(camera.position)
          const distance = direction.length()
          ray.set(camera.position, direction.normalize())
          const nearest = ray.intersectObjects(bodyMeshes, false)[0]
          visibility.set(spot.id, !nearest || nearest.distance >= distance - .22)
        }
        projected.project(camera)
        button.hidden = !facing || visibility.get(spot.id) === false || Math.abs(projected.x)>1 || Math.abs(projected.y)>1 || projected.z>1
        button.style.left = ((projected.x + 1) / 2 * 100) + '%'
        button.style.top = ((1 - projected.y) / 2 * 100) + '%'
      }
      renderer.render(scene, camera)
    })
    return () => {
      disposed = true
      control.current = null
      renderer.setAnimationLoop(null)
      resize.disconnect()
      orbit.dispose()
      renderer.domElement.removeEventListener('pointerdown', onDown)
      renderer.domElement.removeEventListener('pointerup', onUp)
      renderer.domElement.removeEventListener('keydown', onKey)
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost)
      scene.traverse(node => { if (node instanceof THREE.Mesh) node.geometry.dispose() })
      material.dispose()
      ground.material.dispose()
      shadowTexture.dispose()
      renderer.dispose()
      renderer.forceContextLoss()
      renderer.domElement.remove()
    }
  }, [flat])

  useEffect(() => {
    const spot = props.spots.find(s => s.id === props.selectedId)
    if (spot && !flat) control.current?.orient(spot.normal[2] < 0)
  }, [props.selectedId, flat]) // model state remains mounted across family/record changes

  return <section className="body-map" data-testid="body-map" data-renderer={flat ? '2d' : ready ? '3d' : 'loading'} data-view={view}>
    <div className="map-index"><span className="eyebrow">01 / 身体地图</span><strong>{props.spots.length} 处观察位置</strong></div>
    <div ref={host} className="three-host">
      {!flat && !ready && <div className="model-loading"><span className="loading-ring" />正在展开身体地图…</div>}
      {!flat && props.spots.map(spot => <button key={spot.id}
        ref={node => { if (node) pins.current.set(spot.id, node); else pins.current.delete(spot.id) }}
        className={'body-pin ' + (spot.id === props.selectedId ? 'selected' : '')}
        style={{ left: '50%', top: '50%' }} data-side={spot.point[0] < 0 ? 'left' : 'right'} aria-label={'查看' + spot.name}
        onClick={() => props.onSelect(spot.id)}>
        <span className="pin-ring"><span /></span><span className="pin-label">{spot.name}<small>打开这一处的手账</small></span>
      </button>)}
      {flat && <div className="flat-frame">
        <img src="/media/body-front.png" alt="身体正面示意图，可通过部位列表选择" />
        {props.spots.filter(s => s.normal[2] >= 0).map(spot => <button key={spot.id}
          className={'body-pin ' + (spot.id === props.selectedId ? 'selected' : '')}
          style={{ left: (50+spot.point[0]/11.55*100)+'%', top: ((8.5-spot.point[1])/17*100)+'%' }}
          data-side={spot.point[0] < 0 ? 'left' : 'right'} aria-label={'查看' + spot.name} onClick={() => props.onSelect(spot.id)}>
          <span className="pin-ring"><span /></span><span className="pin-label">{spot.name}</span>
        </button>)}
      </div>}
    </div>
    <div className="map-caption"><span><Move size={14} />{flat ? '二维示意 · 通过列表选择部位' : '拖动旋转 · 滚轮缩放 · 点选记录'}</span>
      <button className="text-button" onClick={props.onList}><List size={16} />按部位列表查找</button>
      {fallbackReason && <small>{fallbackReason}</small>}
    </div>
    <div className="map-controls">
      {!flat && <>
        <button className={view === 'front' ? 'active' : ''} onClick={() => control.current?.orient(false)}>正面</button>
        <button className={view === 'back' ? 'active' : ''} onClick={() => control.current?.orient(true)}>背面</button>
        <i />
        <button className="icon-button" aria-label="放大人体" onClick={() => control.current?.zoom(.88)}><ZoomIn size={19} /></button>
        <button className="icon-button" aria-label="缩小人体" onClick={() => control.current?.zoom(1.12)}><ZoomOut size={19} /></button>
        <button className="icon-button" aria-label="复位人体" onClick={() => control.current?.orient(false)}><RotateCcw size={18} /></button>
      </>}
      <button onClick={() => { setFlat(!flat); setFallbackReason('') }}>{flat ? '切换 3D' : '2D 视图'}</button>
    </div>
  </section>
}
