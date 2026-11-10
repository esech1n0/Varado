import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { ball, box, cyl } from './gfx'
import { seeded } from './geom'

export type ModelKey = 'soldier' | 'shooter' | 'tank' | 'boss' | 'wreck'

// Modelos generados con IA (Tripo, modo Rápido). Cada uno mira hacia +X, como la simulación.
// Rutas relativas a la página: funcionan en itch.io (subruta) y en desarrollo.
const BASE = import.meta.env.BASE_URL
const URLS: Record<ModelKey, string> = {
  soldier: `${BASE}models/alien_soldier.glb`,
  shooter: `${BASE}models/alien_shooter.glb`,
  tank: `${BASE}models/alien_tank.glb`,
  boss: `${BASE}models/alien_boss.glb`,
  wreck: `${BASE}models/wreck_ship.glb`,
}

const protos = new Map<ModelKey, THREE.Object3D>()

// ---------- Texturas grotescas procedurales para los aliens ----------
type Grot = { blotches: number; veins: number; sores: number; slime: number; size: number }
const GROT: Partial<Record<ModelKey, Grot>> = {
  soldier: { blotches: 70, veins: 16, sores: 26, slime: 18, size: 512 },
  shooter: { blotches: 80, veins: 20, sores: 34, slime: 20, size: 512 },
  tank: { blotches: 120, veins: 34, sores: 70, slime: 30, size: 1024 },
  boss: { blotches: 160, veins: 54, sores: 120, slime: 44, size: 1024 },
}

type Drawable = CanvasImageSource & { width: number; height: number }

/**
 * Dibuja sobre la textura original del alien (si existe) manchas enfermizas, venas, llagas/pústulas y babas,
 * y genera un mapa de relieve a juego. Se hace una sola vez por material del prototipo.
 */
function grotesqueMaps(src: Drawable | null, key: ModelKey, cfg: Grot): { map: THREE.CanvasTexture; bump: THREE.CanvasTexture } {
  const S = cfg.size
  const r = seeded(key.charCodeAt(0) * 131 + key.length * 17)
  const mk = (): [HTMLCanvasElement, CanvasRenderingContext2D] => {
    const c = document.createElement('canvas')
    c.width = c.height = S
    return [c, c.getContext('2d')!]
  }
  const [cMap, g] = mk()
  const [cBump, b] = mk()
  if (src) g.drawImage(src, 0, 0, S, S)
  else {
    g.fillStyle = '#fff'
    g.fillRect(0, 0, S, S)
  }
  b.fillStyle = '#808080'
  b.fillRect(0, 0, S, S)

  const sc = S / 512
  // 1) manchas de piel enferma (verde bilis, morado de moretón, rojo de herida)
  const sick = ['#8aa23c', '#6b3c80', '#8e3a3a', '#a89a3a', '#4a6a58']
  g.globalCompositeOperation = 'multiply'
  for (let i = 0; i < cfg.blotches; i++) {
    const x = r() * S
    const y = r() * S
    const rad = (14 + r() * 46) * sc
    const col = sick[Math.floor(r() * sick.length)]
    const gr = g.createRadialGradient(x, y, 0, x, y, rad)
    gr.addColorStop(0, col)
    gr.addColorStop(1, 'rgba(255,255,255,0)')
    g.globalAlpha = 0.35 + r() * 0.35
    g.fillStyle = gr
    g.beginPath()
    g.arc(x, y, rad, 0, 7)
    g.fill()
  }
  // 2) mugre moteada
  g.globalAlpha = 1
  for (let i = 0; i < S * 3; i++) {
    g.fillStyle = `rgba(40,20,30,${0.05 + r() * 0.12})`
    g.fillRect(r() * S, r() * S, (1 + r() * 3) * sc, (1 + r() * 3) * sc)
  }
  g.globalCompositeOperation = 'source-over'

  // 3) venas ramificadas, abultadas en el mapa de relieve
  const vein = (x: number, y: number, a: number, len: number, w: number, depth: number): void => {
    if (depth <= 0 || len < 6 * sc || w < 0.4) return
    const nx = x + Math.cos(a) * len
    const ny = y + Math.sin(a) * len
    const cx = (x + nx) / 2 + (r() - 0.5) * len * 0.6
    const cy = (y + ny) / 2 + (r() - 0.5) * len * 0.6
    g.strokeStyle = 'rgba(70,8,40,.75)'
    g.lineWidth = w
    g.lineCap = 'round'
    g.beginPath()
    g.moveTo(x, y)
    g.quadraticCurveTo(cx, cy, nx, ny)
    g.stroke()
    g.strokeStyle = 'rgba(190,60,90,.35)'
    g.lineWidth = Math.max(0.6, w * 0.35)
    g.beginPath()
    g.moveTo(x, y - w * 0.3)
    g.quadraticCurveTo(cx, cy - w * 0.3, nx, ny - w * 0.3)
    g.stroke()
    b.strokeStyle = 'rgba(210,210,210,.9)'
    b.lineWidth = w
    b.lineCap = 'round'
    b.beginPath()
    b.moveTo(x, y)
    b.quadraticCurveTo(cx, cy, nx, ny)
    b.stroke()
    const kids = r() < 0.8 ? 2 : 1
    for (let k = 0; k < kids; k++) vein(nx, ny, a + (r() - 0.5) * 1.5, len * (0.62 + r() * 0.2), w * 0.72, depth - 1)
  }
  for (let i = 0; i < cfg.veins; i++) vein(r() * S, r() * S, r() * 6.283, (30 + r() * 50) * sc, (2.2 + r() * 2.4) * sc, 5)

  // 4) llagas y pústulas: aro pálido, carne roja, centro oscuro y brillo húmedo
  for (let i = 0; i < cfg.sores; i++) {
    const x = r() * S
    const y = r() * S
    const rad = (4 + r() * 13) * sc
    const gr = g.createRadialGradient(x, y, 0, x, y, rad)
    gr.addColorStop(0, '#2c0410')
    gr.addColorStop(0.35, '#8a1424')
    gr.addColorStop(0.75, '#d9c97a')
    gr.addColorStop(1, 'rgba(235,225,170,0)')
    g.fillStyle = gr
    g.beginPath()
    g.ellipse(x, y, rad, rad * (0.75 + r() * 0.3), r() * 3, 0, 7)
    g.fill()
    g.fillStyle = 'rgba(255,255,255,.7)'
    g.beginPath()
    g.arc(x - rad * 0.3, y - rad * 0.3, rad * 0.16, 0, 7)
    g.fill()
    const bg = b.createRadialGradient(x, y, 0, x, y, rad)
    const dome = r() < 0.6
    bg.addColorStop(0, dome ? '#ffffff' : '#101010')
    bg.addColorStop(0.7, dome ? '#d0d0d0' : '#505050')
    bg.addColorStop(1, 'rgba(128,128,128,0)')
    b.fillStyle = bg
    b.beginPath()
    b.arc(x, y, rad, 0, 7)
    b.fill()
  }

  // 5) babas brillantes
  for (let i = 0; i < cfg.slime; i++) {
    const x = r() * S
    const y = r() * S
    const len = (30 + r() * 90) * sc
    const gr = g.createLinearGradient(x, y, x, y + len)
    gr.addColorStop(0, 'rgba(190,255,150,.0)')
    gr.addColorStop(0.2, 'rgba(190,255,150,.32)')
    gr.addColorStop(1, 'rgba(190,255,150,0)')
    g.fillStyle = gr
    g.fillRect(x, y, (3 + r() * 5) * sc, len)
  }

  // grano de relieve general (piel rugosa)
  for (let i = 0; i < S * 4; i++) {
    b.fillStyle = `rgba(${r() < 0.5 ? '0,0,0' : '255,255,255'},${0.05 + r() * 0.1})`
    b.fillRect(r() * S, r() * S, (1 + r() * 2) * sc, (1 + r() * 2) * sc)
  }

  const finish = (c: HTMLCanvasElement, srgb: boolean): THREE.CanvasTexture => {
    const t = new THREE.CanvasTexture(c)
    t.flipY = false // los GLB usan UV sin voltear
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    if (srgb) t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = 4
    return t
  }
  return { map: finish(cMap, true), bump: finish(cBump, false) }
}

function applyGrotesque(root: THREE.Object3D, key: ModelKey): void {
  const cfg = GROT[key]
  if (!cfg) return
  const done = new Map<THREE.Material, boolean>()
  root.traverse(o => {
    const m = o as THREE.Mesh
    if (!m.isMesh || !m.geometry.getAttribute('uv')) return
    const mt = m.material as THREE.MeshStandardMaterial
    if (!mt || done.has(mt)) return
    done.set(mt, true)
    const src = (mt.map?.image ?? null) as Drawable | null
    const { map, bump } = grotesqueMaps(src, key, cfg)
    mt.map = map
    mt.bumpMap = bump
    mt.bumpScale = key === 'boss' || key === 'tank' ? 2.2 : 1.6
    mt.roughness = Math.min(mt.roughness ?? 0.6, 0.55)
    mt.needsUpdate = true
  })
}

export async function loadModels(onProgress?: (done: number, total: number) => void): Promise<string[]> {
  const loader = new GLTFLoader()
  const failed: string[] = []
  let done = 0
  const keys = Object.keys(URLS) as ModelKey[]
  await Promise.all(
    keys.map(async k => {
      try {
        const g = await loader.loadAsync(URLS[k])
        applyGrotesque(g.scene, k)
        protos.set(k, g.scene)
      } catch (e) {
        console.warn('No se pudo cargar el modelo', k, e)
        failed.push(k)
      }
      onProgress?.(++done, keys.length)
    }),
  )
  return failed
}

/** Tripulante de respaldo, sólo si el GLB no se pudo descargar. */
function fallbackCrew(color: number): THREE.Group {
  const g = new THREE.Group()
  const b = cyl(0.3, 0.3, 0.7, color, 16)
  b.position.y = 0.45
  const top = ball(0.3, color, {}, 16)
  top.position.y = 0.8
  const visor = ball(0.16, 0x9fd8ff, {}, 12)
  visor.position.set(0.22, 0.78, 0)
  visor.scale.set(0.6, 0.8, 1.5)
  g.add(b, top, visor, box(0.2, 0.5, 0.5, color, -0.3, 0.55, 0))
  return g
}

/**
 * Clona un modelo escalándolo a `size` en la dimensión indicada, con la base en y=0
 * y centrado en x/z. Cada clon recibe sus propios materiales (para el destello al recibir daño).
 */
export function instance(key: ModelKey, size: number, by: 'height' | 'length' = 'height', fallbackColor = 0xcc2222): THREE.Group {
  const root = new THREE.Group()
  const proto = protos.get(key)
  const obj = proto ? proto.clone(true) : fallbackCrew(fallbackColor)
  obj.updateMatrixWorld(true)
  const bb = new THREE.Box3().setFromObject(obj)
  const sz = bb.getSize(new THREE.Vector3())
  const s = size / (by === 'height' ? sz.y : sz.x)
  obj.scale.multiplyScalar(s)
  obj.updateMatrixWorld(true)
  const b2 = new THREE.Box3().setFromObject(obj)
  const c = b2.getCenter(new THREE.Vector3())
  obj.position.set(-c.x, -b2.min.y, -c.z)
  obj.traverse(o => {
    const m = o as THREE.Mesh
    if (m.isMesh) {
      m.castShadow = true
      m.receiveShadow = true
      m.material = (m.material as THREE.Material).clone()
    }
  })
  root.add(obj)
  return root
}

export function flashMaterials(root: THREE.Object3D, amount: number, tint = 0xffffff): void {
  root.traverse(o => {
    const m = o as THREE.Mesh
    if (!m.isMesh) return
    const mt = m.material as THREE.MeshStandardMaterial
    if (!mt.emissive) return
    mt.emissive.setHex(tint)
    mt.emissiveIntensity = amount
  })
}

export function setBaseGlow(root: THREE.Object3D, color: number, intensity: number): void {
  root.traverse(o => {
    const m = o as THREE.Mesh
    if (!m.isMesh) return
    const mt = m.material as THREE.MeshStandardMaterial
    if (!mt.emissive) return
    mt.emissive.setHex(color)
    mt.emissiveIntensity = intensity
    mt.userData.baseGlow = { color, intensity }
  })
}
