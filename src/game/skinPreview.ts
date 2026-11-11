// Vista previa 3D del astronauta para el menú "Aspecto": un modelo girando y miniaturas de cada skin.
import * as THREE from 'three'
import { makePlayer, type PlayerRig } from './gfx'
import { SKINS, skinDef, type SkinId } from './skins'

export class SkinPreview {
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera = new THREE.PerspectiveCamera(30, 3 / 4, 1, 600)
  private pivot = new THREE.Group()
  private model: THREE.Group | null = null
  private ring: THREE.Mesh
  private raf = 0
  private last = 0
  private angle = 0.55
  private current: SkinId | null = null

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
    this.renderer.setClearColor(0x000000, 0)
    this.camera.position.set(0, 36, 150)
    this.camera.lookAt(0, 27, 0)
    const key = new THREE.DirectionalLight(0xffffff, 2.1)
    key.position.set(60, 90, 120)
    const rim = new THREE.DirectionalLight(0x57f2ff, 1.3)
    rim.position.set(-80, 50, -90)
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.75), new THREE.HemisphereLight(0xcfe0ff, 0x402a18, 0.7), key, rim, this.pivot)
    // peana
    const base = new THREE.Mesh(new THREE.CylinderGeometry(24, 27, 3, 32), new THREE.MeshStandardMaterial({ color: 0x1b1f33, roughness: 0.6 }))
    base.position.y = -2.2
    this.ring = new THREE.Mesh(new THREE.TorusGeometry(24.5, 0.9, 8, 40), new THREE.MeshBasicMaterial({ color: 0xffd21f }))
    this.ring.rotation.x = Math.PI / 2
    this.ring.position.y = -0.6
    this.scene.add(base, this.ring)
  }

  private build(id: SkinId): void {
    if (this.model) this.pivot.remove(this.model)
    const m = makePlayer(id)
    const rig = m.userData as PlayerRig
    rig.weaponMount.visible = false
    rig.armR.rotation.set(0, 0, -1.22)
    rig.armL.rotation.set(0, 0, -1.22)
    this.model = m
    this.current = id
    this.pivot.add(m)
    ;(this.ring.material as THREE.MeshBasicMaterial).color.setHex(id === 'white' ? 0xffd21f : skinDef(id).suit)
  }

  private fit(w: number, h: number, ratio: number): void {
    this.renderer.setPixelRatio(ratio)
    this.renderer.setSize(w, h, false)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
  }

  private draw(): void {
    // el modelo mira a +X: -PI/2 lo pone de frente a la cámara
    this.pivot.rotation.y = -Math.PI / 2 + this.angle
    this.renderer.render(this.scene, this.camera)
  }

  /** Renderiza una miniatura (PNG en data URL) de cada aspecto. */
  thumbnails(): Record<string, string> {
    const out: Record<string, string> = {}
    const keep = this.current
    const a = this.angle
    this.fit(150, 200, 1)
    this.angle = 0.55
    for (const s of SKINS) {
      this.build(s.id)
      this.draw()
      out[s.id] = this.canvas.toDataURL('image/png')
    }
    this.angle = a
    if (keep) this.build(keep)
    return out
  }

  show(id: SkinId): void {
    if (id !== this.current) this.build(id)
  }

  start(): void {
    cancelAnimationFrame(this.raf)
    this.last = performance.now()
    const tick = (now: number): void => {
      const dt = Math.min(0.05, (now - this.last) / 1000)
      this.last = now
      this.angle += dt * 0.7
      const w = this.canvas.clientWidth || 280
      const h = this.canvas.clientHeight || 360
      const ratio = Math.min(window.devicePixelRatio || 1, 2)
      if (this.canvas.width !== Math.round(w * ratio) || this.canvas.height !== Math.round(h * ratio)) this.fit(w, h, ratio)
      if (this.model) {
        const rig = this.model.userData as PlayerRig
        rig.headGroup.rotation.y = Math.sin(now / 900) * 0.18
        this.model.position.y = Math.sin(now / 520) * 0.5
      }
      this.draw()
      this.raf = requestAnimationFrame(tick)
    }
    this.raf = requestAnimationFrame(tick)
  }

  stop(): void {
    cancelAnimationFrame(this.raf)
  }
}
