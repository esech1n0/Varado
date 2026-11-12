// Planeta Bershna: desierto rojo con viviendas-cúpula abandonadas, monumentos, campamentos,
// zona de aterrizaje amurallada y la torre de control. Vive en la misma escena que el primer
// planeta, muy lejos en X, y comparte su rejilla de colisiones.
import * as THREE from 'three'
import { BERSHNA as B } from './config'
import { Grid, seeded, type Rect } from './geom'
import { makeLever, makeRocket, type LeverRig } from './gfx'

export type Camp2 = { x: number; y: number; name: string; licker: number; acid: number; rock: number; soldier: number; spread: number; visited: boolean; hall?: boolean }
export type Spot = { x: number; y: number }
export type Pickup2 = { kind: 'medkit' | 'ammo' | 'rifle' | 'shotgun' | 'sniper' | 'plasma'; x: number; y: number; z?: number }
export type Site2 = { id: string; name: string; x: number; y: number; w: number; d: number; visited: boolean }
export type VehicleKind = 'buggy' | 'gun' | 'moto'

export type BershnaData = {
  root: THREE.Group
  sky: THREE.Group
  /** Altura fija del suelo (las salas altas de la torre); la escalera se calcula en el juego. */
  heightAt: (x: number, y: number) => number
  camps: Camp2[]
  sites: Site2[]
  pickups: Pickup2[]
  beacons: { x: number; y: number; name: string }[]
  vehicles: { kind: VehicleKind; x: number; y: number; h: number }[]
  /** Mejoras para los vehículos, tiradas por el mapa. */
  upgrades: Spot[]
  /** Zonas techadas (la cámara no atraviesa el techo y dentro no hay tormenta). */
  roofs: { x: number; y: number; w: number; h: number; top: number }[]
  ship: THREE.Group
  tower: {
    cx: number
    cy: number
    hall: Rect
    doorBottom: Rect
    doorTop: Rect
    barBottom: Rect
    barTop: Rect
    storeDoor: Rect
    storeDoorMesh: THREE.Mesh
    lever: LeverRig & Spot
    console: Spot
    screens: THREE.MeshBasicMaterial[]
    stones: Spot[]
    beaconLamp: THREE.MeshBasicMaterial
  }
}

const unit = new THREE.BoxGeometry(1, 1, 1)
const mats = new Map<string, THREE.MeshStandardMaterial>()
function m(color: number, o: THREE.MeshStandardMaterialParameters = {}): THREE.MeshStandardMaterial {
  const k = color + JSON.stringify(o)
  let v = mats.get(k)
  if (!v) mats.set(k, (v = new THREE.MeshStandardMaterial({ color, roughness: 0.88, metalness: 0, ...o })))
  return v
}

function canvasTex(size: number, draw: (g: CanvasRenderingContext2D) => void, repeat = false): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = c.height = size
  draw(c.getContext('2d')!)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.anisotropy = 4
  return t
}


// ---------- Texturas procedurales de Bershna ----------
// Son mapas de multiplicación (base clara): el color lo pone el material.
type TexKind = 'panel' | 'brick' | 'floor' | 'roof' | 'crate' | 'rock' | 'dome'
const texCache = new Map<TexKind, THREE.CanvasTexture>()
function tex(kind: TexKind): THREE.CanvasTexture {
  const hit = texCache.get(kind)
  if (hit) return hit
  const S = 256
  const t = canvasTex(S, g => {
    const q = seeded(kind.length * 97 + kind.charCodeAt(0))
    g.fillStyle = '#fff'
    g.fillRect(0, 0, S, S)
    const grain = (n: number, a: number): void => {
      for (let i = 0; i < n; i++) {
        g.fillStyle = `rgba(${q() < 0.5 ? '30,24,28' : '255,255,255'},${a * (0.4 + q())})`
        g.fillRect(q() * S, q() * S, 1 + q() * 3, 1 + q() * 3)
      }
    }
    const stains = (n: number, col: string): void => {
      for (let i = 0; i < n; i++) {
        const x = q() * S
        const y = q() * S
        const r = 14 + q() * 46
        const gr = g.createRadialGradient(x, y, 0, x, y, r)
        gr.addColorStop(0, `rgba(${col},${0.1 + q() * 0.16})`)
        gr.addColorStop(1, `rgba(${col},0)`)
        g.fillStyle = gr
        g.fillRect(x - r, y - r, r * 2, r * 2)
      }
    }
    const line = (x0: number, y0: number, x1: number, y1: number, col: string, w: number): void => {
      g.strokeStyle = col
      g.lineWidth = w
      g.beginPath()
      g.moveTo(x0, y0)
      g.lineTo(x1, y1)
      g.stroke()
    }
    if (kind === 'panel') {
      // paneles prefabricados con juntas, remaches, chorretones de óxido y arena pegada abajo
      grain(2600, 0.07)
      stains(10, '120,70,50')
      for (const p of [0, 128]) {
        line(p, 0, p, S, 'rgba(20,16,20,.55)', 3)
        line(p + 3, 0, p + 3, S, 'rgba(255,255,255,.25)', 1)
        line(0, p, S, p, 'rgba(20,16,20,.55)', 3)
        line(0, p + 3, S, p + 3, 'rgba(255,255,255,.25)', 1)
      }
      for (const x of [10, 118, 138, 246]) for (const y of [10, 118, 138, 246]) {
        g.fillStyle = 'rgba(25,20,24,.6)'
        g.beginPath()
        g.arc(x, y, 3, 0, 7)
        g.fill()
        g.fillStyle = 'rgba(255,255,255,.3)'
        g.fillRect(x - 1.5, y - 2.5, 2, 1.4)
      }
      for (let i = 0; i < 9; i++) {
        const x = q() * S
        const y = q() * S * 0.6
        const gr = g.createLinearGradient(0, y, 0, y + 50 + q() * 60)
        gr.addColorStop(0, 'rgba(110,50,30,.34)')
        gr.addColorStop(1, 'rgba(110,50,30,0)')
        g.fillStyle = gr
        g.fillRect(x, y, 2 + q() * 5, 110)
      }
      for (let i = 0; i < 12; i++) line(q() * S, q() * S, q() * S, q() * S, 'rgba(255,255,255,.2)', 0.8)
    } else if (kind === 'brick') {
      // sillares de piedra roja, desiguales y erosionados
      grain(2200, 0.09)
      stains(8, '60,20,16')
      const rows = 4
      for (let r = 0; r < rows; r++) {
        const y = (r * S) / rows
        line(0, y, S, y, 'rgba(24,10,10,.6)', 4)
        line(0, y + 4, S, y + 4, 'rgba(255,220,200,.2)', 1.5)
        const off = r % 2 ? 0 : 64
        for (let x = off; x < S + 64; x += 128) {
          const jx = x + (q() - 0.5) * 14
          line(jx, y, jx, y + S / rows, 'rgba(24,10,10,.55)', 4)
        }
      }
      for (let i = 0; i < 14; i++) {
        const x = q() * S
        const y = q() * S
        g.strokeStyle = 'rgba(20,8,8,.45)'
        g.lineWidth = 1
        g.beginPath()
        g.moveTo(x, y)
        g.lineTo(x + (q() - 0.5) * 30, y + q() * 22)
        g.lineTo(x + (q() - 0.5) * 40, y + 22 + q() * 22)
        g.stroke()
      }
    } else if (kind === 'floor') {
      // baldosas metálicas antideslizantes con desgaste
      grain(1800, 0.06)
      for (let p = 0; p <= S; p += 64) {
        line(p, 0, p, S, 'rgba(15,16,22,.6)', 3)
        line(0, p, S, p, 'rgba(15,16,22,.6)', 3)
      }
      for (let y = 8; y < S; y += 16) for (let x = 8 + ((y / 16) % 2) * 8; x < S; x += 16) {
        g.fillStyle = 'rgba(255,255,255,.14)'
        g.fillRect(x - 3, y - 1, 6, 2)
      }
      stains(7, '20,18,24')
      for (let i = 0; i < 16; i++) line(q() * S, q() * S, q() * S, q() * S, 'rgba(255,255,255,.16)', 0.8)
    } else if (kind === 'roof') {
      grain(1400, 0.06)
      for (let p = 0; p <= S; p += 128) {
        line(p, 0, p, S, 'rgba(0,0,0,.55)', 4)
        line(0, p, S, p, 'rgba(0,0,0,.55)', 4)
      }
      for (let x = 20; x < S; x += 20) line(x, 0, x, S, 'rgba(0,0,0,.14)', 2)
      stains(5, '120,70,50')
    } else if (kind === 'crate') {
      grain(1400, 0.08)
      g.strokeStyle = 'rgba(20,14,8,.65)'
      g.lineWidth = 8
      g.strokeRect(6, 6, S - 12, S - 12)
      line(6, 6, S - 6, S - 6, 'rgba(20,14,8,.5)', 7)
      line(S - 6, 6, 6, S - 6, 'rgba(20,14,8,.5)', 7)
      for (let y = 40; y < S; y += 44) line(0, y, S, y + (q() - 0.5) * 6, 'rgba(30,18,8,.25)', 2)
    } else if (kind === 'rock') {
      // estratos, grietas y vetas claras
      grain(3000, 0.1)
      stains(12, '40,14,10')
      for (let y = 10; y < S; y += 14 + q() * 22) {
        g.strokeStyle = `rgba(${q() < 0.5 ? '30,10,8' : '255,210,190'},${0.16 + q() * 0.2})`
        g.lineWidth = 1.5 + q() * 4
        g.beginPath()
        g.moveTo(0, y)
        g.bezierCurveTo(80, y + (q() - 0.5) * 30, 170, y + (q() - 0.5) * 30, S, y + (q() - 0.5) * 16)
        g.stroke()
      }
      for (let i = 0; i < 10; i++) {
        let x = q() * S
        let y = q() * S
        g.strokeStyle = 'rgba(14,6,6,.6)'
        g.lineWidth = 1.2
        g.beginPath()
        g.moveTo(x, y)
        for (let k = 0; k < 5; k++) {
          x += (q() - 0.5) * 26
          y += 6 + q() * 16
          g.lineTo(x, y)
        }
        g.stroke()
      }
    } else {
      // cúpula: gajos de panel, juntas horizontales y arena acumulada / chorretones
      grain(2400, 0.06)
      for (let x = 0; x <= S; x += 32) line(x, 0, x, S, 'rgba(90,40,30,.5)', 2)
      for (const y of [70, 140, 205]) line(0, y, S, y, 'rgba(90,40,30,.45)', 2)
      for (let i = 0; i < 26; i++) {
        const x = q() * S
        const y = q() * S * 0.7
        const gr = g.createLinearGradient(0, y, 0, y + 40 + q() * 70)
        gr.addColorStop(0, 'rgba(120,50,30,.3)')
        gr.addColorStop(1, 'rgba(120,50,30,0)')
        g.fillStyle = gr
        g.fillRect(x, y, 2 + q() * 6, 120)
      }
      const sandUp = g.createLinearGradient(0, S * 0.72, 0, S)
      sandUp.addColorStop(0, 'rgba(150,60,36,0)')
      sandUp.addColorStop(1, 'rgba(150,60,36,.5)')
      g.fillStyle = sandUp
      g.fillRect(0, 0, S, S)
      stains(8, '255,255,255')
    }
  }, true)
  texCache.set(kind, t)
  return t
}

const texMats = new Map<string, THREE.MeshStandardMaterial>()
function texMat(color: number, kind: TexKind, o: THREE.MeshStandardMaterialParameters = {}): THREE.MeshStandardMaterial {
  const k = `${color}|${kind}|${JSON.stringify(o)}`
  let v = texMats.get(k)
  if (!v) {
    const t = tex(kind)
    v = new THREE.MeshStandardMaterial({ color, map: t, bumpMap: t, bumpScale: 1.6, roughness: kind === 'floor' ? 0.6 : 0.9, metalness: kind === 'floor' ? 0.25 : 0, ...o })
    texMats.set(k, v)
  }
  return v
}

/** Ajusta las UV de una caja para que la textura se repita cada `tile` unidades en vez de estirarse. */
function scaleBoxUV(geo: THREE.BoxGeometry, w: number, h: number, d: number, tile: number): void {
  const uv = geo.attributes.uv as THREE.BufferAttribute
  // orden de caras de BoxGeometry: +x, −x, +y, −y, +z, −z (4 vértices cada una)
  const sizes: [number, number][] = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]]
  for (let f = 0; f < 6; f++) {
    for (let i = 0; i < 4; i++) {
      const k = f * 4 + i
      uv.setXY(k, (uv.getX(k) * sizes[f][0]) / tile, (uv.getY(k) * sizes[f][1]) / tile)
    }
  }
  uv.needsUpdate = true
}
const boxGeos = new Map<string, THREE.BoxGeometry>()
function texBox(w: number, h: number, d: number): THREE.BoxGeometry {
  const k = `${Math.round(w)}|${Math.round(h)}|${Math.round(d)}`
  let g = boxGeos.get(k)
  if (!g) {
    g = new THREE.BoxGeometry(w, h, d)
    scaleBoxUV(g, w, h, d, 110)
    boxGeos.set(k, g)
  }
  return g
}
/** Textura que le toca a cada color de bloque. */
function kindOf(color: number): TexKind {
  if (color === 0x9a8c84 || color === 0x3a3238 || color === 0x7c706a || color === 0x2a2d3a || color === 0x23262f) return 'panel'
  if (color === 0x4a4248 || color === 0x3f4352) return 'floor'
  if (color === 0x2c2a32) return 'roof'
  if (color === 0x7a5c28 || color === 0x6b4e22 || color === 0x5d5560) return 'crate'
  if (color === 0x2a2030) return 'rock'
  return 'brick'
}

export function buildBershna(scene: THREE.Scene, grid: Grid): BershnaData {
  const root = new THREE.Group()
  scene.add(root)
  const r = seeded(7331)
  const camps: Camp2[] = []
  const sites: Site2[] = []
  const pickups: Pickup2[] = []
  const reserved: { x: number; y: number; r: number }[] = []
  const H = B.towerTop

  const solid = (x: number, y: number, w: number, d: number, top: number): Rect => {
    const rc: Rect = { x, y, w, h: d, top }
    grid.add(rc)
    return rc
  }
  /** Bloque: x,y = esquina en el plano de simulación. */
  const blk = (x: number, y: number, w: number, d: number, h: number, color: number, o: { y0?: number; solid?: boolean; mat?: THREE.Material; cast?: boolean } = {}): THREE.Mesh => {
    const y0 = o.y0 ?? 0
    const mesh = new THREE.Mesh(texBox(w, h, d), o.mat ?? texMat(color, kindOf(color)))
    mesh.position.set(x + w / 2, y0 + h / 2, y + d / 2)
    mesh.castShadow = o.cast !== false
    mesh.receiveShadow = true
    root.add(mesh)
    if (o.solid !== false) solid(x, y, w, d, y0 + h)
    return mesh
  }
  const add = (geo: THREE.BufferGeometry, material: THREE.Material, x: number, h: number, y: number, parent: THREE.Object3D = root): THREE.Mesh => {
    const mesh = new THREE.Mesh(geo, material)
    mesh.position.set(x, h, y)
    mesh.castShadow = true
    mesh.receiveShadow = true
    parent.add(mesh)
    return mesh
  }

  // ---------- Suelo de arena roja ----------
  const GW = B.x1 - B.x0 + 1600
  const GH = B.y1 - B.y0 + 1600
  const sand = canvasTex(512, g => {
    const q = seeded(21)
    const S = 512
    g.fillStyle = '#c4573a'
    g.fillRect(0, 0, S, S)
    // manchas grandes de tono (arena más clara y más oscura)
    for (let i = 0; i < 40; i++) {
      const x = q() * S
      const y = q() * S
      const r = 40 + q() * 120
      const gr = g.createRadialGradient(x, y, 0, x, y, r)
      const c = q() < 0.5 ? '232,128,88' : '120,40,26'
      gr.addColorStop(0, `rgba(${c},${0.1 + q() * 0.14})`)
      gr.addColorStop(1, `rgba(${c},0)`)
      g.fillStyle = gr
      for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) g.fillRect(x - r + ox, y - r + oy, r * 2, r * 2)
    }
    // grano fino
    for (let i = 0; i < 14000; i++) {
      g.fillStyle = `rgba(${q() < 0.5 ? '110,36,22' : '250,170,130'},${0.05 + q() * 0.14})`
      g.fillRect(q() * S, q() * S, 1 + q() * 2, 1 + q() * 2)
    }
    // ondas de viento
    for (let y = 6; y < S; y += 13 + q() * 9) {
      g.strokeStyle = `rgba(96,30,18,${0.14 + q() * 0.14})`
      g.lineWidth = 1.2 + q() * 2
      g.beginPath()
      g.moveTo(0, y)
      g.bezierCurveTo(S * 0.3, y - 10 * q(), S * 0.65, y + 12 * q(), S, y)
      g.stroke()
      g.strokeStyle = 'rgba(255,190,150,.1)'
      g.lineWidth = 1
      g.beginPath()
      g.moveTo(0, y + 3)
      g.bezierCurveTo(S * 0.3, y - 7, S * 0.65, y + 14, S, y + 3)
      g.stroke()
    }
    // guijarros y grietas secas
    for (let i = 0; i < 130; i++) {
      const x = q() * S
      const y = q() * S
      const r = 1.5 + q() * 4.5
      g.fillStyle = 'rgba(70,24,16,.5)'
      g.beginPath()
      g.ellipse(x + 1, y + 1.5, r, r * 0.7, q() * 3, 0, 7)
      g.fill()
      g.fillStyle = `rgba(${150 + q() * 60},${70 + q() * 30},${50 + q() * 20},.9)`
      g.beginPath()
      g.ellipse(x, y, r, r * 0.7, q() * 3, 0, 7)
      g.fill()
    }
    for (let i = 0; i < 16; i++) {
      let x = q() * S
      let y = q() * S
      g.strokeStyle = 'rgba(70,20,12,.4)'
      g.lineWidth = 1
      g.beginPath()
      g.moveTo(x, y)
      for (let k = 0; k < 6; k++) {
        x += (q() - 0.5) * 34
        y += (q() - 0.5) * 34
        g.lineTo(x, y)
      }
      g.stroke()
    }
  }, true)
  sand.repeat.set(GW / 640, GH / 640)
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(GW, GH), new THREE.MeshStandardMaterial({ map: sand, bumpMap: sand, bumpScale: 1.2, roughness: 0.95 }))
  ground.rotation.x = -Math.PI / 2
  ground.position.set((B.x0 + B.x1) / 2, -0.3, (B.y0 + B.y1) / 2)
  ground.receiveShadow = true
  root.add(ground)
  // límites invisibles y cordillera roja alrededor
  solid(B.x0 - 400, B.y0 - 400, GW, 400, 400)
  solid(B.x0 - 400, B.y1, GW, 400, 400)
  solid(B.x0 - 400, B.y0, 400, B.y1 - B.y0, 400)
  solid(B.x1, B.y0, 400, B.y1 - B.y0, 400)
  const peakTex = tex('rock').clone()
  peakTex.needsUpdate = true
  peakTex.repeat.set(3, 2)
  const peakM = new THREE.MeshStandardMaterial({ color: 0xb04a34, map: peakTex, roughness: 1, flatShading: true })
  const peak = (x: number, y: number): void => {
    const hh = 420 + r() * 620
    const p = add(new THREE.ConeGeometry(300 + r() * 320, hh, 5 + Math.floor(r() * 3)), peakM, x, hh / 2 - 30, y)
    p.rotation.y = r() * 6
    p.castShadow = false
  }
  for (let x = B.x0 - 300; x <= B.x1 + 300; x += 420) {
    peak(x + r() * 160, B.y0 - 320 - r() * 260)
    peak(x + r() * 160, B.y1 + 320 + r() * 260)
  }
  for (let y = B.y0; y <= B.y1; y += 420) {
    peak(B.x0 - 330 - r() * 240, y + r() * 160)
    peak(B.x1 + 330 + r() * 240, y + r() * 160)
  }

  // ---------- Zona de aterrizaje amurallada con el cohete sobre su soporte ----------
  const SX = B.ship.x
  const SY = B.ship.y
  const L = B.lzHalf
  const wallC = 0x5a2a26
  const wallTop = 0x7a3a30
  const rampart = (x: number, y: number, w: number, d: number): void => {
    blk(x, y, w, d, 84, wallC)
    const along = w > d
    const len = along ? w : d
    for (let a = 10; a < len - 30; a += 64) {
      if (along) blk(x + a, y - 3, 34, d + 6, 22, wallTop, { y0: 84, solid: false })
      else blk(x - 3, y + a, w + 6, 34, 22, wallTop, { y0: 84, solid: false })
    }
  }
  rampart(SX - L, SY - L, 2 * L, 30)
  rampart(SX - L, SY + L - 30, 2 * L, 30)
  rampart(SX - L, SY - L + 30, 30, 2 * L - 60)
  rampart(SX + L - 30, SY - L + 30, 30, L - 30 - B.gateHalf)
  rampart(SX + L - 30, SY + B.gateHalf, 30, L - 30 - B.gateHalf)
  for (const s of [-1, 1]) {
    blk(SX + L - 44, s < 0 ? SY - B.gateHalf - 58 : SY + B.gateHalf, 58, 58, 130, 0x3a1a1a)
    const lamp = add(new THREE.SphereGeometry(9, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffb060 }), SX + L - 15, 140, SY + s * (B.gateHalf + 29))
    lamp.castShadow = false
  }
  const pad = add(new THREE.CylinderGeometry(300, 300, 3, 40), m(0x3a2422), SX, 1, SY)
  pad.castShadow = false
  const ship = makeRocket()
  ship.position.set(SX, 0, SY)
  root.add(ship)
  solid(SX - 70, SY - 70, 140, 140, 310)
  solid(SX + 46, SY - 20, 40, 40, 260)
  sites.push({ id: 'lz', name: 'Zona de aterrizaje', x: SX - L, y: SY - L, w: 2 * L, d: 2 * L, visited: true })
  reserved.push({ x: SX, y: SY, r: L + 420 })

  // ---------- Vegetación del desierto (decoración sin colisión) ----------
  const tufts: [number, number, number][] = []
  const cacti: [number, number, number][] = []
  const plantAt = (x: number, y: number, s = 1): void => {
    if (r() < 0.22) cacti.push([x, y, s])
    else tufts.push([x, y, s])
  }

  // ---------- Viviendas-cúpula abandonadas ----------
  const shellC = [0xd9987a, 0xcf8a6e, 0xe2a488, 0xc98470]
  const glassM = new THREE.MeshStandardMaterial({ color: 0x16131c, emissive: 0xff9a50, emissiveIntensity: 0.1, metalness: 0.85, roughness: 0.14 })
  const frameM = m(0x7a4638, { roughness: 0.6 })
  let domeN = 0
  const domeTex = tex('dome').clone()
  domeTex.needsUpdate = true
  domeTex.repeat.set(2, 1)
  const domeMats = new Map<number, THREE.MeshStandardMaterial>()
  const domeMat = (c: number): THREE.MeshStandardMaterial => {
    let v = domeMats.get(c)
    if (!v) domeMats.set(c, (v = new THREE.MeshStandardMaterial({ color: c + 0x141410, map: domeTex, bumpMap: domeTex, bumpScale: 1.2, roughness: 0.6 })))
    return v
  }
  const dome = (x: number, y: number, rad: number, rot: number, twin: boolean, name?: string): void => {
    const g = new THREE.Group()
    g.position.set(x, 0, y)
    g.rotation.y = -rot
    root.add(g)
    const col = shellC[domeN++ % shellC.length]
    const one = (ox: number, oz: number, rr: number, squash: number): void => {
      const shell = add(new THREE.SphereGeometry(rr, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), domeMat(col), ox, 0, oz, g)
      shell.scale.y = squash
      const base = add(new THREE.CylinderGeometry(rr * 1.05, rr * 1.1, 12, 30), texMat(0x9a6050, 'brick'), ox, 6, oz, g)
      base.castShadow = false
      // gran ventanal arqueado al frente (+X local) con su marco grueso y montantes
      const glass = add(new THREE.SphereGeometry(rr * 1.012, 18, 10, Math.PI - 0.72, 1.44, 0.3, Math.PI / 2 - 0.3), glassM, ox, 0, oz, g)
      glass.scale.y = squash
      glass.castShadow = false
      const arch = add(new THREE.TorusGeometry(rr * 0.66, rr * 0.07, 8, 22, Math.PI), m(col + 0x0c0c08, { roughness: 0.5 }), ox + rr * 0.75, 0, oz, g)
      arch.rotation.y = Math.PI / 2
      arch.scale.y = squash * 1.08
      for (const a of [-0.36, 0, 0.36]) {
        const bar = add(unit, frameM, ox + Math.cos(a) * rr * 0.99, rr * squash * 0.36, oz + Math.sin(a) * rr * 0.99, g)
        bar.scale.set(rr * 0.035, rr * squash * 0.72, rr * 0.035)
        bar.castShadow = false
      }
      const sill = add(unit, frameM, ox + rr * 0.93, rr * 0.16, oz, g)
      sill.scale.set(rr * 0.06, rr * 0.05, rr * 1.2)
    }
    one(0, 0, rad, 0.82)
    solidCircle(x, y, rad * 0.86, rad * 0.82)
    if (twin) {
      const tr = rad * 0.72
      const ox = -rad * 0.55
      const oz = rad * 1.05
      one(ox, oz, tr, 0.86)
      const wx = x + Math.cos(rot) * ox - Math.sin(rot) * oz
      const wy = y + Math.sin(rot) * ox + Math.cos(rot) * oz
      solidCircle(wx, wy, tr * 0.86, tr * 0.86)
    }
    for (let i = 0; i < 9; i++) {
      const a = rot + (r() - 0.5) * 2.6
      const d = rad * (1.15 + r() * 0.9)
      plantAt(x + Math.cos(a) * d, y + Math.sin(a) * d, 0.8 + r() * 0.9)
    }
    reserved.push({ x, y, r: rad * 2.4 })
    if (name) sites.push({ id: `dome${domeN}`, name, x: x - rad * 2, y: y - rad * 2, w: rad * 4, d: rad * 4, visited: false })
  }
  /** Colisión aproximada de un círculo con tres rectángulos. */
  function solidCircle(x: number, y: number, rad: number, top: number): void {
    solid(x - rad, y - rad * 0.55, rad * 2, rad * 1.1, top)
    solid(x - rad * 0.55, y - rad, rad * 1.1, rad * 2, top)
    solid(x - rad * 0.78, y - rad * 0.78, rad * 1.56, rad * 1.56, top)
  }

  // ---------- Rocas grandes ----------
  const rockM = [0x8a3a2a, 0x74402e, 0xa04a34, 0x6a3428].map(c => new THREE.MeshStandardMaterial({ color: c + 0x181008, map: tex('rock'), bumpMap: tex('rock'), bumpScale: 2.5, roughness: 1, flatShading: true }))
  const rockGeo = new THREE.DodecahedronGeometry(1, 0)
  const rock = (x: number, y: number, s: number): void => {
    const sx = s * (0.8 + r() * 0.6)
    const sz = s * (0.8 + r() * 0.6)
    const sy = s * (0.6 + r() * 0.9)
    const mesh = add(rockGeo, rockM[Math.floor(r() * rockM.length)], x, sy * 0.55, y)
    mesh.scale.set(sx, sy, sz)
    mesh.rotation.set(r() * 0.5, r() * 6, r() * 0.5)
    solid(x - sx * 0.72, y - sz * 0.72, sx * 1.44, sz * 1.44, sy * 1.3)
  }

  // ---------- Monumentos extraños ----------
  const stoneM = new THREE.MeshStandardMaterial({ color: 0x4a3c58, map: tex('rock'), bumpMap: tex('rock'), bumpScale: 2, roughness: 0.7, flatShading: true })
  const glow = (c: number): THREE.MeshStandardMaterial => m(c, { emissive: c, emissiveIntensity: 1.3, roughness: 0.3 })
  const monument = (x: number, y: number, type: number, name: string): void => {
    if (type === 0) {
      // obeliscos inclinados con una banda de glifos luminosos
      for (const [dx, dy, hh, tilt] of [[0, 0, 300, 0.05], [90, 40, 210, -0.14], [-70, 80, 170, 0.18], [30, -90, 130, -0.1]]) {
        const o = add(new THREE.CylinderGeometry(9, 26, hh, 4), stoneM, x + dx, hh / 2, y + dy)
        o.rotation.set(tilt, 0.6, tilt * 0.7)
        const band = add(new THREE.CylinderGeometry(20, 21, 9, 4), glow(0x57f2ff), x + dx, hh * 0.42, y + dy)
        band.rotation.copy(o.rotation)
        band.castShadow = false
        solid(x + dx - 24, y + dy - 24, 48, 48, hh)
      }
    } else if (type === 1) {
      // portal: un gran anillo de piedra con un cristal flotando en el centro
      const ring = add(new THREE.TorusGeometry(120, 17, 6, 22), stoneM, x, 150, y)
      ring.rotation.y = 0.5
      const gem = add(new THREE.OctahedronGeometry(30, 0), glow(0xff5ad0), x, 150, y)
      gem.castShadow = false
      for (const s of [-1, 1]) blk(x + s * Math.cos(0.5) * 118 - 26, y - s * Math.sin(0.5) * 118 - 26, 52, 52, 60, 0x2a2030)
    } else if (type === 2) {
      // cubos apilados en equilibrio imposible
      let hh = 0
      for (let i = 0; i < 5; i++) {
        const s = 96 - i * 15
        const c = add(unit, i === 4 ? glow(0xffc61a) : stoneM, x + (i % 2 ? 14 : -10), hh + s / 2 + (i === 4 ? 26 : 0), y + (i % 2 ? -12 : 9))
        c.scale.setScalar(s)
        c.rotation.y = i * 0.55
        hh += s
      }
      solid(x - 56, y - 56, 112, 112, 260)
    } else {
      // triple arco de piedra con un ojo luminoso
      for (const [dx, s] of [[-150, 0.7], [0, 1], [150, 0.7]]) {
        blk(x + dx - 62 * s, y - 18, 26 * s, 36, 150 * s, 0x2a2030, { mat: stoneM })
        blk(x + dx + 36 * s, y - 18, 26 * s, 36, 150 * s, 0x2a2030, { mat: stoneM })
        blk(x + dx - 70 * s, y - 22, 140 * s, 44, 30 * s, 0x2a2030, { y0: 150 * s, solid: false, mat: stoneM })
      }
      const eye = add(new THREE.SphereGeometry(20, 14, 10), glow(0x7dff3a), x, 215, y)
      eye.castShadow = false
    }
    sites.push({ id: `mon${type}${Math.round(x)}`, name, x: x - 220, y: y - 220, w: 440, d: 440, visited: false })
    reserved.push({ x, y, r: 330 })
  }

  // ---------- Campamentos ----------
  const camp = (x: number, y: number, name: string, n: { licker: number; acid: number; rock: number; soldier: number }): void => {
    camps.push({ x, y, name, ...n, spread: 185, visited: false })
    sites.push({ id: `camp${camps.length}`, name, x: x - 270, y: y - 250, w: 540, d: 500, visited: false })
    const c = 0x6a2e28
    blk(x - 220, y - 200, 130, 26, 44, c)
    blk(x + 80, y - 200, 140, 26, 58, c)
    blk(x - 220, y + 174, 140, 26, 62, c)
    blk(x + 90, y + 174, 130, 26, 40, c)
    blk(x - 246, y - 80, 26, 150, 50, c)
    blk(x - 70, y - 40, 44, 44, 38, 0x7a5c28)
    blk(x + 50, y + 44, 50, 40, 46, 0x6b4e22)
    // hoguera alienígena
    const fire = add(new THREE.ConeGeometry(16, 44, 6), glow(0x7dff3a), x + 6, 22, y - 4)
    fire.castShadow = false
    const loot: Pickup2['kind'][] = ['ammo', 'medkit', 'ammo', r() < 0.5 ? 'medkit' : 'ammo']
    ;[[-140, -130], [140, -130], [-140, 130], [140, 130]].forEach(([dx, dy], i) => pickups.push({ kind: loot[i], x: x + dx, y: y + dy }))
    reserved.push({ x, y, r: 420 })
  }

  // ---------- Torre de control ----------
  const HX = B.hallX
  const cx = B.towerX
  const cy = 0
  const RX = cx + 185
  const towerC = 0x9a8c84
  const darkC = 0x3a3238
  const roofC = 0x2c2a32
  const HALL_H = 150
  /** Altura interior de las salas altas: dos franjas de pared y de ventanas. */
  const RH = 220
  const roofs: BershnaData['roofs'] = []
  const lightM = new THREE.MeshBasicMaterial({ color: 0xfff0c8 })
  const ceilingLight = (x: number, y: number, top: number, w = 70, d = 16): void => {
    const lp = add(unit, lightM, x, top - 2.5, y)
    lp.scale.set(w, 3, d)
    lp.castShadow = false
  }
  reserved.push({ x: (HX + RX + 440) / 2, y: 150, r: 1050 })
  // vestíbulo (planta baja), ahora techado
  const hall: Rect = { x: HX, y: -236, w: 700, h: 472 }
  blk(HX, -260, 700, 24, HALL_H, towerC)
  blk(HX, 236, 700, 24, HALL_H, towerC)
  blk(HX - 24, -260, 24, 200, HALL_H, towerC)
  blk(HX - 24, 60, 24, 200, HALL_H, towerC)
  blk(HX - 24, -60, 24, 120, HALL_H - 104, towerC, { y0: 104, solid: false })
  blk(HX - 34, -74, 12, 148, 12, darkC, { y0: 104, solid: false })
  blk(HX + 676, -260, 24, 205, HALL_H, towerC)
  blk(HX + 676, 55, 24, 205, HALL_H, towerC)
  blk(HX + 676, -55, 24, 110, HALL_H - 110, towerC, { y0: 110, solid: false })
  const hallFloor = blk(HX, -236, 700, 472, 2, 0x4a4248, { solid: false, cast: false })
  hallFloor.position.y = 0.6
  // el techo termina en la pared del fuste (cx − 196): no debe meterse en la escalera
  const hallRoofW = cx - 198 - (HX - 30)
  blk(HX - 30, -266, hallRoofW, 532, 10, roofC, { y0: HALL_H, solid: false })
  blk(HX - 36, -272, hallRoofW + 6, 544, 8, darkC, { y0: HALL_H - 8, solid: false, cast: false })
  roofs.push({ x: HX - 24, y: -260, w: 724, h: 520, top: HALL_H })
  for (let i = 0; i < 4; i++) {
    blk(HX + 80 + i * 170, -236, 14, 472, 10, darkC, { y0: HALL_H - 10, solid: false, cast: false })
    ceilingLight(HX + 165 + i * 170, -90, HALL_H)
    ceilingLight(HX + 165 + i * 170, 90, HALL_H)
  }
  // ventanas altas del vestíbulo (franjas de vidrio oscuro en los muros largos)
  const slitM = new THREE.MeshStandardMaterial({ color: 0x20262e, emissive: 0xffb070, emissiveIntensity: 0.25, metalness: 0.7, roughness: 0.2 })
  for (let i = 0; i < 5; i++) {
    for (const y of [-261.5, 260.5]) {
      const sl = add(unit, slitM, HX + 90 + i * 130, 104, y)
      sl.scale.set(84, 34, 4)
      sl.castShadow = false
    }
  }
  blk(HX + 150, -150, 60, 46, 40, 0x5d5560)
  blk(HX + 330, 90, 70, 50, 46, 0x5d5560)
  blk(HX + 470, -120, 50, 70, 38, 0x6b4e22)
  blk(HX + 240, 170, 110, 30, 34, darkC)
  sites.push({ id: 'tower', name: 'Torre de control de Bershna', x: HX - 260, y: -420, w: 1000, d: 840, visited: false })
  camps.push({ x: HX + 360, y: 0, name: '', licker: 5, acid: 3, rock: 1, soldier: 0, spread: 190, visited: true, hall: true })
  pickups.push({ kind: 'medkit', x: HX + 620, y: -190 }, { kind: 'ammo', x: HX + 620, y: 190 })

  // fuste cilíndrico con la escalera de caracol
  const shaftH = H + RH + 20
  const shellTex = tex('panel').clone()
  shellTex.needsUpdate = true
  shellTex.repeat.set(12, 1)
  const shellM = new THREE.MeshStandardMaterial({ color: towerC, map: shellTex, bumpMap: shellTex, bumpScale: 1.4, roughness: 0.85, side: THREE.DoubleSide })
  const gap = 0.3
  const arc = (y0: number, hh: number, doorTheta: number | null): void => {
    const geo = doorTheta === null
      ? new THREE.CylinderGeometry(196, 196, hh, 40, 1, true)
      : new THREE.CylinderGeometry(196, 196, hh, 40, 1, true, doorTheta + gap, Math.PI * 2 - gap * 2)
    const s = add(geo, shellM, cx, y0 + hh / 2, cy)
    s.castShadow = false
  }
  // en CylinderGeometry, theta=3π/2 apunta a −X (oeste) y π/2 a +X (este)
  arc(0, 110, Math.PI * 1.5)
  arc(110, H - 110, null)
  arc(H, 100, Math.PI * 0.5)
  arc(H + 100, shaftH - H - 100, null)
  for (const y of [110, H, H + 100, shaftH]) {
    const band = add(new THREE.TorusGeometry(198, 5, 6, 40), m(darkC), cx, y, cy)
    band.rotation.x = Math.PI / 2
    band.castShadow = false
  }
  const cap = add(new THREE.CylinderGeometry(204, 204, 10, 40), texMat(roofC, 'roof'), cx, shaftH + 5, cy)
  cap.castShadow = false
  roofs.push({ x: cx - 200, y: cy - 200, w: 400, h: 400, top: shaftH })
  for (let i = 0; i < 30; i++) {
    const a = (i / 30) * Math.PI * 2
    const dWest = Math.abs(Math.atan2(Math.sin(a - Math.PI), Math.cos(a - Math.PI)))
    const dEast = Math.abs(Math.atan2(Math.sin(a), Math.cos(a)))
    if (dWest < 0.36 || dEast < 0.36) continue
    solid(cx + Math.cos(a) * 190 - 21, cy + Math.sin(a) * 190 - 21, 42, 42, shaftH)
  }
  solid(cx - 40, cy - 40, 80, 80, shaftH)
  const pillarTex = tex('panel').clone()
  pillarTex.needsUpdate = true
  pillarTex.repeat.set(3, 6)
  add(new THREE.CylinderGeometry(44, 44, shaftH, 18), new THREE.MeshStandardMaterial({ color: darkC, map: pillarTex, bumpMap: pillarTex, roughness: 0.8 }), cx, shaftH / 2, cy)
  const shaftFloor = add(new THREE.CylinderGeometry(194, 194, 2, 36), texMat(0x4a4248, 'floor'), cx, 0.8, cy)
  shaftFloor.castShadow = false
  // peldaños: suben en sentido de ángulo creciente desde la puerta oeste hasta la puerta este
  const steps = 84
  const stepM = texMat(0xb0a49a, 'floor')
  const stepM2 = texMat(0x8f837a, 'floor')
  for (let i = 0; i <= steps; i++) {
    const a = Math.PI + (i / steps) * B.stairTurns * Math.PI * 2
    const st = add(unit, i % 2 ? stepM : stepM2, cx + Math.cos(a) * 110, (i / steps) * H - 3, cy + Math.sin(a) * 110)
    st.scale.set(124, 6, 30)
    st.rotation.y = -a
    st.castShadow = false
  }
  for (let i = 0; i < 9; i++) {
    const a = i * 1.9
    const lp = add(new THREE.SphereGeometry(5, 8, 6), lightM, cx + Math.cos(a) * 184, 60 + i * 55, cy + Math.sin(a) * 184)
    lp.castShadow = false
  }
  const doorBottom: Rect = { x: cx - 200, y: cy - 48, w: 34, h: 96, top: shaftH, on: true }
  const doorTop: Rect = { x: cx + 166, y: cy - 48, w: 34, h: 96, top: shaftH, on: true }
  const barBottom: Rect = { x: cx - 172, y: cy + 44, w: 126, h: 14, top: shaftH, on: true }
  const barTop: Rect = { x: cx + 46, y: cy + 44, w: 126, h: 14, top: shaftH, on: false }
  for (const d of [doorBottom, doorTop, barBottom, barTop]) grid.add(d)
  // antena y baliza en la cima
  add(new THREE.CylinderGeometry(3, 6, 190, 6), m(darkC), cx, shaftH + 105, cy)
  const dish = add(new THREE.SphereGeometry(46, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2.4), m(0xd4d7dc, { side: THREE.DoubleSide, metalness: 0.4, roughness: 0.4 }), cx + 30, shaftH + 120, cy)
  dish.rotation.z = -1.9
  const beaconLamp = new THREE.MeshBasicMaterial({ color: 0xff3b4a })
  add(new THREE.SphereGeometry(9, 10, 8), beaconLamp, cx, shaftH + 204, cy).castShadow = false

  // salas altas: sala de control (norte) y almacén de piedras de ignición (sur)
  const RW = 440
  const roomsY0 = -244
  const roomsY1 = 568
  // la base maciza y su zócalo empiezan fuera del fuste (RX + 12 = cx + 197)
  const baseW = RW + 12
  const baseGeo = new THREE.BoxGeometry(baseW, H - 2, roomsY1 - roomsY0)
  scaleBoxUV(baseGeo, baseW, H - 2, roomsY1 - roomsY0, 150)
  add(baseGeo, texMat(0x7c706a, 'panel'), RX + 12 + baseW / 2, H / 2 - 1, (roomsY0 + roomsY1) / 2)
  blk(RX + 12, roomsY0 - 6, baseW + 6, roomsY1 - roomsY0 + 12, 12, darkC, { y0: H - 12, solid: false, cast: false })
  const upper = (x: number, y: number, w: number, d: number, hh = RH, color = towerC, y0 = 0): Rect => {
    blk(x, y, w, d, hh, color, { y0: H + y0, solid: false })
    return solid(x, y, w, d, H + RH)
  }
  upper(RX - 24, roomsY0, RW + 48, 24) // norte
  upper(RX - 24, -220, 24, 172) // oeste, a ambos lados de la puerta del fuste
  upper(RX - 24, 48, 24, 520)
  blk(RX - 24, -48, 24, 96, RH - 100, towerC, { y0: H + 100, solid: false })
  upper(RX - 24, roomsY1 - 24, RW + 48, 24) // sur
  upper(RX + RW, 244, 24, 300) // este del almacén
  // pared este de la sala de control: antepecho y dos franjas de ventanal separadas por una faja
  solid(RX + RW, -220, 24, 464, H + RH)
  blk(RX + RW, -220, 24, 464, 34, towerC, { y0: H, solid: false })
  blk(RX + RW, -220, 24, 464, 14, towerC, { y0: H + 112, solid: false })
  blk(RX + RW, -220, 24, 464, RH - 204, towerC, { y0: H + 204, solid: false })
  const paneM = new THREE.MeshStandardMaterial({ color: 0x9fd8ff, transparent: true, opacity: 0.16, roughness: 0.05, metalness: 0.3 })
  for (const y0 of [34, 126]) {
    const pane = add(unit, paneM, RX + RW + 12, H + y0 + 39, 12)
    pane.scale.set(3, 78, 464)
    pane.castShadow = false
  }
  for (const y of [-220, -105, 8, 122, 236]) blk(RX + RW + 4, y, 16, 8, 170, darkC, { y0: H + 34, solid: false })
  // ventanas altas en la pared norte (segunda franja)
  for (let i = 0; i < 4; i++) {
    const wn = add(unit, slitM, RX + 70 + i * 100, H + 165, roomsY0 + 25)
    wn.scale.set(70, 60, 3)
    wn.castShadow = false
  }
  // tabique entre las dos salas, con la puerta del almacén
  upper(RX, 220, 170, 24)
  upper(RX + 270, 220, 170, 24)
  blk(RX + 170, 220, 100, 24, RH - 88, towerC, { y0: H + 88, solid: false })
  blk(RX + 164, 216, 112, 32, 10, darkC, { y0: H + 88, solid: false })
  const storeDoor: Rect = { x: RX + 170, y: 222, w: 100, h: 20, top: H + RH, on: true }
  grid.add(storeDoor)
  const storeDoorMesh = add(unit, m(0xc8222e, { roughness: 0.5 }), RX + 220, H + 44, 232)
  storeDoorMesh.scale.set(100, 88, 14)
  // suelos y techo
  const fl = blk(RX - 24, roomsY0, RW + 48, roomsY1 - roomsY0, 2, 0x3f4352, { y0: H - 1, solid: false, cast: false })
  fl.receiveShadow = true
  blk(cx + 150, -50, RX - cx - 150, 100, 4, 0x3f4352, { y0: H - 3, solid: false, cast: false })
  blk(RX - 34, roomsY0 - 10, RW + 68, roomsY1 - roomsY0 + 20, 12, roofC, { y0: H + RH, solid: false })
  roofs.push({ x: RX - 24, y: roomsY0, w: RW + 48, h: roomsY1 - roomsY0, top: H + RH })
  for (const y of [-130, 0, 130, 330, 460]) {
    ceilingLight(RX + 120, y, H + RH, 90, 18)
    ceilingLight(RX + 320, y, H + RH, 90, 18)
    blk(RX, y - 50, RW, 10, 12, darkC, { y0: H + RH - 12, solid: false, cast: false })
  }
  // consolas y pantallas de la sala de operaciones
  const screens: THREE.MeshBasicMaterial[] = []
  const desk = (x: number, y: number, w: number, d: number): void => {
    blk(x, y, w, d, 30, 0x2a2d3a, { y0: H, solid: false })
    solid(x, y, w, d, H + 30)
  }
  desk(RX + 340, -170, 70, 340)
  for (let i = 0; i < 5; i++) {
    const sm = new THREE.MeshBasicMaterial({ color: 0x57f2ff })
    screens.push(sm)
    const sc = add(unit, sm, RX + 392, H + 48, -136 + i * 68)
    sc.scale.set(3, 30, 52)
    sc.rotation.z = 0.22
    sc.castShadow = false
    const key = add(unit, m(0x1b1d28), RX + 362, H + 31.5, -136 + i * 68)
    key.scale.set(26, 2, 44)
    key.castShadow = false
  }
  desk(RX + 20, -214, 240, 44)
  for (let i = 0; i < 3; i++) {
    const sm = new THREE.MeshBasicMaterial({ color: 0x3bff8a })
    screens.push(sm)
    const sc = add(unit, sm, RX + 60 + i * 80, H + 56, -206)
    sc.scale.set(60, 36, 3)
    sc.castShadow = false
  }
  // armarios de servidores con luces junto a la pared oeste
  for (let i = 0; i < 3; i++) {
    blk(RX + 2, 70 + i * 46, 30, 40, 96, 0x23262f, { y0: H, solid: false })
    solid(RX + 2, 70 + i * 46, 30, 40, H + 96)
    for (let k = 0; k < 4; k++) {
      const led = add(unit, k % 2 ? screens[5] : screens[0], RX + 33, H + 24 + k * 18, 90 + i * 46)
      led.scale.set(2, 4, 22)
      led.castShadow = false
    }
  }
  // silla del operador
  blk(RX + 280, -22, 34, 44, 18, 0x5a2a26, { y0: H, solid: false })
  blk(RX + 268, -22, 10, 44, 46, 0x5a2a26, { y0: H, solid: false })
  const consoleSpot = { x: RX + 300, y: 0 }
  // palanca del almacén
  const leverRig = makeLever()
  leverRig.group.position.set(RX + 320, H, 216)
  leverRig.group.rotation.y = Math.PI
  root.add(leverRig.group)
  const lever = { ...leverRig, x: RX + 320, y: 196 }
  // piedras de ignición sobre pedestales
  const stones: Spot[] = []
  for (let j = 0; j < 2; j++) {
    for (let i = 0; i < 4; i++) {
      const sx = RX + 70 + i * 100
      const sy = 340 + j * 130
      stones.push({ x: sx, y: sy })
      const ped = add(new THREE.CylinderGeometry(16, 20, 8, 10), m(0x2a2d3a), sx, H + 4, sy)
      ped.castShadow = false
    }
  }
  // ---------- Detalles de bodega en el almacén de piedras ----------
  {
    const wr = seeded(4242)
    const crateC = [0x7a5c28, 0x6b4e22, 0x5d5560]
    const frameM = m(0x3a3f49, { metalness: 0.5, roughness: 0.5 })
    /** Estantería metálica de tres baldas pegada a una pared este/oeste, cargada de cajas. */
    const rack = (x: number, y: number, len: number): void => {
      solid(x, y, 30, len, H + 150)
      for (let k = 0; k <= 3; k++) {
        for (const dx of [2, 24]) {
          const post = add(unit, frameM, x + dx + 2, H + 75, y + 2 + (k * (len - 4)) / 3)
          post.scale.set(4, 150, 4)
          post.castShadow = false
        }
      }
      for (const sy of [4, 50, 96, 142]) {
        const shelf = add(unit, frameM, x + 15, H + sy, y + len / 2)
        shelf.scale.set(30, 3, len)
        shelf.castShadow = false
      }
      for (const sy of [6, 52, 98]) {
        for (let cy = y + 8; cy < y + len - 30; ) {
          const w = 22 + wr() * 16
          const hh = 18 + wr() * 20
          if (wr() < 0.82) blk(x + 4, cy, 22, w, hh, crateC[Math.floor(wr() * 3)], { y0: H + sy, solid: false, cast: false })
          cy += w + 6 + wr() * 14
        }
      }
    }
    rack(RX, 258, 262)
    rack(RX + RW - 30, 258, 262)
    // fila de barriles contra la pared sur
    solid(RX + 60, 516, 320, 28, H + 44)
    const barrelC = [0xd96b1e, 0x2f6fe0, 0xd96b1e, 0x8c919c, 0xd96b1e, 0x2f6fe0]
    for (let i = 0; i < 6; i++) {
      const bx = RX + 86 + i * 54
      const barrel = add(new THREE.CylinderGeometry(13, 13, 40, 14), m(barrelC[i], { roughness: 0.5, metalness: 0.3 }), bx, H + 20, 530)
      barrel.castShadow = false
      for (const ry of [10, 30]) {
        const ring = add(new THREE.TorusGeometry(13.3, 1, 5, 16), frameM, bx, H + ry, 530)
        ring.rotation.x = Math.PI / 2
        ring.castShadow = false
      }
      if (i % 2 === 0) {
        const lid = add(new THREE.CylinderGeometry(4, 4, 3, 8), m(0x1b1d24), bx + 4, H + 41, 528)
        lid.castShadow = false
      }
    }
    // palé central con cajas apiladas (deja paso libre a las ocho piedras)
    blk(RX + 198, 390, 44, 30, 6, 0x6b4e22, { y0: H, solid: false, cast: false })
    blk(RX + 202, 393, 36, 24, 26, 0x7a5c28, { y0: H + 6, solid: false })
    blk(RX + 208, 396, 24, 18, 18, 0x5d5560, { y0: H + 32, solid: false })
    solid(RX + 200, 392, 40, 26, H + 50)
    // carretilla apoyada junto a la puerta
    blk(RX + 300, 262, 26, 20, 4, 0xd9482b, { y0: H + 4, solid: false, cast: false, mat: m(0xd9482b, { roughness: 0.5 }) })
    blk(RX + 300, 262, 3, 20, 44, 0xd9482b, { y0: H + 4, solid: false, cast: false, mat: m(0xd9482b, { roughness: 0.5 }) })
    // franjas de seguridad alrededor de la zona de pedestales
    const stripe = canvasTex(64, g => {
      g.fillStyle = '#ffc61a'
      g.fillRect(0, 0, 64, 64)
      g.fillStyle = '#1b1d24'
      for (let i = -64; i < 128; i += 32) {
        g.beginPath()
        g.moveTo(i, 0)
        g.lineTo(i + 16, 0)
        g.lineTo(i + 80, 64)
        g.lineTo(i + 64, 64)
        g.fill()
      }
    }, true)
    const hazard = (x: number, y: number, w: number, d: number): void => {
      const t = stripe.clone()
      t.needsUpdate = true
      t.repeat.set(Math.max(w, d) / 24, 1)
      if (d > w) t.rotation = Math.PI / 2
      const s = add(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ map: t }), x + w / 2, H + 1.4, y + d / 2)
      s.rotation.x = -Math.PI / 2
      s.castShadow = false
    }
    hazard(RX + 40, 306, 360, 7)
    hazard(RX + 40, 497, 360, 7)
    hazard(RX + 40, 306, 7, 198)
    hazard(RX + 393, 306, 7, 198)
    // aro luminoso bajo cada pedestal
    const ringM = new THREE.MeshBasicMaterial({ color: 0xff8a1f })
    for (const st of stones) {
      const ring = add(new THREE.TorusGeometry(24, 1.4, 5, 24), ringM, st.x, H + 1.6, st.y)
      ring.rotation.x = Math.PI / 2
      ring.castShadow = false
    }
    // tuberías y conducto de ventilación en el techo
    for (const [py, pr, pc] of [[300, 5, 0x8c919c], [316, 3.5, 0xd96b1e], [500, 5, 0x8c919c]] as [number, number, number][]) {
      const pipe = add(new THREE.CylinderGeometry(pr, pr, RW, 10), m(pc, { metalness: 0.5, roughness: 0.4 }), RX + RW / 2, H + RH - 30, py)
      pipe.rotation.z = Math.PI / 2
      pipe.castShadow = false
    }
    blk(RX + 150, 380, 140, 44, 20, 0x5d6472, { y0: H + RH - 36, solid: false, cast: false, mat: m(0x5d6472, { metalness: 0.4, roughness: 0.5 }) })
    // rótulos en el tabique norte
    const sign = (text: string, sub: string, x: number, w: number, bg: string, fg: string): void => {
      const c = document.createElement('canvas')
      c.width = 512
      c.height = 128
      const g = c.getContext('2d')!
      g.fillStyle = bg
      g.fillRect(0, 0, 512, 128)
      g.strokeStyle = fg
      g.lineWidth = 8
      g.strokeRect(8, 8, 496, 112)
      g.fillStyle = fg
      g.textAlign = 'center'
      g.font = 'bold 50px Audiowide, Arial, sans-serif'
      g.fillText(text, 256, 66)
      g.font = '26px Audiowide, Arial, sans-serif'
      g.fillText(sub, 256, 104)
      const t = new THREE.CanvasTexture(c)
      t.colorSpace = THREE.SRGBColorSpace
      const p = add(new THREE.PlaneGeometry(w, w / 4), new THREE.MeshBasicMaterial({ map: t }), x, H + 150, 245.2)
      p.castShadow = false
    }
    sign('ALMACÉN 02', 'PIEDRAS DE IGNICIÓN', RX + 90, 130, '#1b1d24', '#ffc61a')
    sign('¡PELIGRO!', 'MATERIAL INFLAMABLE', RX + 360, 120, '#c8222e', '#fff7d6')
    // extintor junto a la puerta
    const ext = add(new THREE.CylinderGeometry(4, 4, 18, 10), m(0xc8222e, { roughness: 0.4 }), RX + 150, H + 60, 248)
    ext.castShadow = false
  }

  pickups.push({ kind: 'medkit', x: RX + 40, y: 290, z: H }, { kind: 'medkit', x: RX + 400, y: 290, z: H }, { kind: 'ammo', x: RX + 40, y: 510, z: H }, { kind: 'ammo', x: RX + 400, y: 510, z: H }, { kind: 'ammo', x: RX + 220, y: 510, z: H })

  const heightAt = (x: number, y: number): number => (x >= cx + 160 && x <= RX + RW + 24 && y >= roomsY0 && y <= roomsY1 ? H : 0)

  // ---------- Distribución del mapa ----------
  const ox = B.x0
  camp(ox + 2700, 950, 'Campamento de la Duna Roja', { licker: 5, acid: 3, rock: 1, soldier: 2 })
  camp(ox + 4300, -1350, 'Campamento del Cráter', { licker: 4, acid: 5, rock: 1, soldier: 2 })
  camp(ox + 5700, 1500, 'Campamento de los Colmillos', { licker: 6, acid: 3, rock: 2, soldier: 1 })
  camp(ox + 7000, -750, 'Campamento Ácido', { licker: 4, acid: 6, rock: 1, soldier: 2 })
  camp(ox + 8100, 1150, 'Campamento de la Torre', { licker: 6, acid: 4, rock: 2, soldier: 2 })

  dome(ox + 2200, -650, 150, 0.4, true, 'Vivienda abandonada')
  dome(ox + 3400, 300, 110, 2.6, false, 'Refugio abandonado')
  dome(ox + 3600, -1900, 180, 1.2, true, 'Colonia abandonada')
  dome(ox + 3800, -1640, 95, 2.2, false)
  dome(ox + 4900, 600, 130, 3.6, false, 'Vivienda abandonada')
  dome(ox + 5200, 2100, 170, 4.4, true, 'Invernadero abandonado')
  dome(ox + 6300, -1800, 120, 0.9, false, 'Puesto abandonado')
  dome(ox + 6500, 350, 200, 3.1, true, 'Gran cúpula abandonada')
  dome(ox + 7700, -1900, 140, 1.7, true, 'Vivienda abandonada')
  dome(ox + 8400, -300, 105, 2.9, false, 'Refugio abandonado')
  dome(ox + 9300, 1900, 150, 4.0, true, 'Vivienda abandonada')
  dome(ox + 10300, -1500, 125, 2.4, false, 'Observatorio abandonado')

  monument(ox + 3000, -1300, 0, 'Los obeliscos susurrantes')
  monument(ox + 4500, 1700, 1, 'El portal de piedra')
  monument(ox + 6000, -400, 2, 'El equilibrio imposible')
  monument(ox + 7500, 2000, 3, 'El arco del ojo')
  monument(ox + 8900, -1500, 1, 'El anillo silencioso')
  monument(ox + 10500, 1300, 0, 'Las agujas del este')

  // armas y granadas de plasma abandonadas por el planeta
  pickups.push(
    { kind: 'rifle', x: ox + 1860, y: 240 }, { kind: 'shotgun', x: ox + 3500, y: -1760 }, { kind: 'sniper', x: ox + 6180, y: -250 },
    { kind: 'rifle', x: ox + 7560, y: -1760 }, { kind: 'shotgun', x: ox + 9180, y: 1760 },
    { kind: 'plasma', x: ox + 2060, y: -420 }, { kind: 'plasma', x: ox + 4140, y: 520 }, { kind: 'plasma', x: ox + 5560, y: -1500 },
    { kind: 'plasma', x: ox + 7240, y: 1300 }, { kind: 'plasma', x: ox + 8760, y: 300 }, { kind: 'plasma', x: HX - 320, y: -260 },
  )
  // suministros junto a algunas viviendas
  pickups.push(
    { kind: 'medkit', x: ox + 2400, y: -520 }, { kind: 'ammo', x: ox + 3540, y: 380 }, { kind: 'ammo', x: ox + 3860, y: -1800 },
    { kind: 'medkit', x: ox + 5060, y: 700 }, { kind: 'ammo', x: ox + 5440, y: 2060 }, { kind: 'medkit', x: ox + 6760, y: 420 },
    { kind: 'ammo', x: ox + 6440, y: -1700 }, { kind: 'medkit', x: ox + 7900, y: -1800 }, { kind: 'ammo', x: ox + 8540, y: -260 },
    { kind: 'medkit', x: ox + 9500, y: 1860 }, { kind: 'ammo', x: ox + 10460, y: -1440 }, { kind: 'medkit', x: HX - 200, y: -180 },
  )

  const vehicles: BershnaData['vehicles'] = [
    { kind: 'buggy', x: SX + L + 190, y: SY - 230, h: 0 },
    { kind: 'moto', x: ox + 3520, y: 190, h: 0.6 },
    { kind: 'gun', x: ox + 5020, y: 780, h: -0.4 },
  ]
  for (const v of vehicles) reserved.push({ x: v.x, y: v.y, r: 150 })
  const upgrades: Spot[] = [
    { x: ox + 2460, y: -900 },
    { x: ox + 4760, y: 1500 },
    { x: ox + 6850, y: 700 },
    { x: ox + 8700, y: -560 },
  ]
  for (const u of upgrades) reserved.push({ x: u.x, y: u.y, r: 130 })

  const free = (x: number, y: number, pad: number): boolean => reserved.every(q => Math.hypot(x - q.x, y - q.y) > q.r + pad)
  for (let i = 0; i < 95; i++) {
    const x = B.x0 + 200 + r() * (B.x1 - B.x0 - 400)
    const y = B.y0 + 200 + r() * (B.y1 - B.y0 - 400)
    const s = 34 + r() * r() * 150
    // se deja libre un corredor central para conducir
    if (!free(x, y, s) || Math.abs(y) < 170) continue
    rock(x, y, s)
  }
  for (let i = 0; i < 420; i++) {
    const x = B.x0 + 100 + r() * (B.x1 - B.x0 - 200)
    const y = B.y0 + 100 + r() * (B.y1 - B.y0 - 200)
    if (free(x, y, -200)) plantAt(x, y, 0.7 + r() * 1.2)
  }
  // matas espinosas (9 púas por mata), cactus con brazos y guijarros, instanciados y con color variado
  const o3 = new THREE.Object3D()
  const tint = new THREE.Color()
  const spike = new THREE.ConeGeometry(2.8, 32, 5)
  spike.translate(0, 16, 0)
  const tuftMesh = new THREE.InstancedMesh(spike, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 }), tufts.length * 9)
  let nt = 0
  for (const [x, y, s] of tufts) {
    const dark = r() < 0.35
    const base = dark ? [0.48, 0.16, 0.15] : [0.7, 0.76, 0.62]
    for (let k = 0; k < 9; k++) {
      o3.position.set(x, 0, y)
      o3.rotation.set((r() - 0.5) * 1.7, r() * 6, (r() - 0.5) * 1.7)
      o3.scale.setScalar(s * (0.6 + r() * 0.7))
      o3.updateMatrix()
      tuftMesh.setMatrixAt(nt, o3.matrix)
      const v = 0.75 + r() * 0.4
      tuftMesh.setColorAt(nt++, tint.setRGB(base[0] * v, base[1] * v, base[2] * v))
    }
  }
  tuftMesh.count = nt
  const cactusTex = canvasTex(64, g => {
    g.fillStyle = '#fff'
    g.fillRect(0, 0, 64, 64)
    for (let x = 0; x < 64; x += 8) {
      g.fillStyle = 'rgba(10,40,20,.5)'
      g.fillRect(x, 0, 3, 64)
      g.fillStyle = 'rgba(255,255,230,.6)'
      for (let y = 4; y < 64; y += 8) g.fillRect(x + 5, y, 1.5, 2)
    }
  }, true)
  const cactusGeo = new THREE.CapsuleGeometry(5.5, 50, 4, 10)
  cactusGeo.translate(0, 30, 0)
  const cactusMesh = new THREE.InstancedMesh(cactusGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, map: cactusTex, bumpMap: cactusTex, bumpScale: 1.5, roughness: 0.9 }), cacti.length * 3)
  let nc = 0
  for (const [x, y, s0] of cacti) {
    // en campo abierto crecen hasta la altura del cohete (y entonces son sólidos); cerca de algo importante se quedan pequeños
    const clear = free(x, y, 70) && pickups.every(k => Math.hypot(k.x - x, k.y - y) > 140)
    const s = clear ? 2.2 + r() * 2.9 : Math.min(s0, 1.5)
    if (s > 1.8) solid(x - 5 * s, y - 5 * s, 10 * s, 10 * s, 60 * s)
    const v = 0.8 + r() * 0.35
    for (let k = 0; k < 3; k++) {
      // el primero es el tronco; los otros dos, brazos más cortos pegados a él
      const a = r() * 6.28
      o3.position.set(x + (k ? Math.cos(a) * 9 * s : 0), k ? (12 + r() * 14) * s : 0, y + (k ? Math.sin(a) * 9 * s : 0))
      o3.rotation.set(0, r() * 6, 0)
      o3.scale.set(s * (k ? 0.62 : 1), s * (k ? 0.42 + r() * 0.2 : 1), s * (k ? 0.62 : 1))
      o3.updateMatrix()
      cactusMesh.setMatrixAt(nc, o3.matrix)
      cactusMesh.setColorAt(nc++, tint.setRGB(0.3 * v, 0.52 * v, 0.34 * v))
    }
  }
  const pebbleN = 900
  const pebbles = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: true }), pebbleN)
  for (let i = 0; i < pebbleN; i++) {
    const s = 2.5 + r() * r() * 11
    o3.position.set(B.x0 + r() * (B.x1 - B.x0), s * 0.3, B.y0 + r() * (B.y1 - B.y0))
    o3.rotation.set(r() * 3, r() * 6, r() * 3)
    o3.scale.set(s, s * (0.5 + r() * 0.5), s * (0.7 + r() * 0.6))
    o3.updateMatrix()
    pebbles.setMatrixAt(i, o3.matrix)
    const v = 0.7 + r() * 0.5
    pebbles.setColorAt(i, tint.setRGB(0.55 * v, 0.24 * v, 0.17 * v))
  }
  for (const im of [tuftMesh, cactusMesh, pebbles]) {
    im.frustumCulled = false
    im.castShadow = false
    im.receiveShadow = true
    if (im.instanceColor) im.instanceColor.needsUpdate = true
    root.add(im)
  }

  // ---------- Cielo de Bershna: atardecer, luna gigante y la Tierra, diminuta, al este ----------
  const sky = new THREE.Group()
  scene.add(sky)
  const skyTex = canvasTex(256, g => {
    const gr = g.createLinearGradient(0, 0, 0, 256)
    gr.addColorStop(0, '#0a1326')
    gr.addColorStop(0.3, '#1e2a40')
    gr.addColorStop(0.44, '#6a4050')
    gr.addColorStop(0.5, '#f29a5e')
    gr.addColorStop(0.56, '#c9603c')
    gr.addColorStop(1, '#8a3a26')
    g.fillStyle = gr
    g.fillRect(0, 0, 256, 256)
  })
  const skyDome = new THREE.Mesh(new THREE.SphereGeometry(6400, 24, 16), new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false, depthWrite: false }))
  skyDome.renderOrder = -2
  sky.add(skyDome)
  const sp = new Float32Array(500 * 3)
  for (let i = 0; i < 500; i++) {
    const a = r() * Math.PI * 2
    const e = 0.18 + r() * 1.3
    sp.set([Math.cos(a) * Math.cos(e) * 6000, Math.sin(e) * 6000, Math.sin(a) * Math.cos(e) * 6000], i * 3)
  }
  const sg = new THREE.BufferGeometry()
  sg.setAttribute('position', new THREE.BufferAttribute(sp, 3))
  sky.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.85 })))
  const moonTex = canvasTex(256, g => {
    const q = seeded(5)
    g.fillStyle = '#d8d6d2'
    g.fillRect(0, 0, 256, 256)
    for (let i = 0; i < 60; i++) {
      g.fillStyle = `rgba(110,112,120,${0.12 + q() * 0.25})`
      g.beginPath()
      g.arc(q() * 256, q() * 256, 4 + q() * 26, 0, 7)
      g.fill()
    }
  })
  const moon = new THREE.Mesh(new THREE.SphereGeometry(780, 32, 22), new THREE.MeshBasicMaterial({ map: moonTex, fog: false, color: 0xe8ddd4 }))
  moon.position.set(-2200, 2300, -4600)
  sky.add(moon)
  const earthTex = canvasTex(128, g => {
    const q = seeded(8)
    g.fillStyle = '#2a6fe0'
    g.fillRect(0, 0, 128, 128)
    g.fillStyle = '#3bb86a'
    for (let i = 0; i < 9; i++) {
      g.beginPath()
      g.ellipse(q() * 128, 20 + q() * 88, 8 + q() * 16, 5 + q() * 12, q() * 3, 0, 7)
      g.fill()
    }
    g.fillStyle = 'rgba(255,255,255,.75)'
    for (let i = 0; i < 12; i++) {
      g.beginPath()
      g.ellipse(q() * 128, q() * 128, 6 + q() * 16, 2 + q() * 4, 0, 0, 7)
      g.fill()
    }
  })
  const earth = new THREE.Mesh(new THREE.SphereGeometry(84, 20, 14), new THREE.MeshBasicMaterial({ map: earthTex, fog: false }))
  earth.position.set(4500, 3300, -500) // alta sobre la cordillera: se ve desde el ventanal de la torre
  const halo = new THREE.Mesh(new THREE.SphereGeometry(102, 16, 12), new THREE.MeshBasicMaterial({ color: 0x8fd0ff, transparent: true, opacity: 0.25, side: THREE.BackSide, fog: false, depthWrite: false }))
  halo.position.copy(earth.position)
  sky.add(earth, halo)

  const beacons = [
    { x: SX + L + 120, y: SY + 210, name: 'Baliza de la zona de aterrizaje' },
    { x: ox + 5400, y: 60, name: 'Baliza del desierto' },
    { x: HX - 230, y: 190, name: 'Baliza de la torre' },
  ]

  root.visible = false
  sky.visible = false
  return {
    root, sky, heightAt, camps, sites, pickups, beacons, vehicles, upgrades, roofs, ship,
    tower: { cx, cy, hall, doorBottom, doorTop, barBottom, barTop, storeDoor, storeDoorMesh, lever, console: consoleSpot, screens, stones, beaconLamp },
  }
}
