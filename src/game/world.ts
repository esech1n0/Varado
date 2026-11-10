import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { ARENA, BY0, BY1, COVER_H, D1X, D2X, DOOR_H, FY0, FY1, ROAD_W, ROAD_Y, ROOM_H, SHIP, WORLD, ZC_END } from './config'
import { addStuds, basic, box, buildStuds, cyl, makeLever, mat, type LeverRig } from './gfx'
import { Grid, clamp, seeded, type Rect } from './geom'

export type Pal = { b: number; s: number }
export const PAL = {
  black: { b: 0x2a2d35, s: 0x4a4f5c },
  white: { b: 0xf1efe6, s: 0xfbfaf5 },
  red: { b: 0xc8222e, s: 0xf06b6e },
  rust: { b: 0x7a4a32, s: 0x9a6244 },
  lab: { b: 0xdfe3ea, s: 0xf5f7fa },
  yellow: { b: 0xc9a227, s: 0xe6c34a },
  gray: { b: 0x5b6372, s: 0x7b8493 },
  depot: { b: 0x9b2a2a, s: 0xc8484a },
  fort: { b: 0x3a3347, s: 0x594d70 },
}

export type Site = { id: string; name: string; x: number; y: number; w: number; d: number; visited: boolean }
export type PickupKind = 'medkit' | 'ammo' | 'rifle' | 'shotgun' | 'sniper'
export type PickupSpawn = { kind: PickupKind; x: number; y: number; z?: number }
export type TurretSpawn = { x: number; y: number }
export type FenceSpawn = { ax: number; ay: number; bx: number; by: number; period: number; onTime: number; phase: number }
export type PlateSpawn = { x: number; y: number; w: number; h: number; phase: number }
export type CampSpawn = { x: number; y: number; soldier?: number; shooter?: number; tank?: number; spread: number; name?: string; visited?: boolean }
export type BeaconSpawn = { x: number; y: number; name: string; buggyX?: number; buggyY?: number; buggyH?: number }
export type WreckSpawn = { x: number; y: number; scale: number; rot: number }
export type LegoSpawn = { x: number; y: number; variant: number }

export type DoorRig = { top: THREE.Mesh; bot: THREE.Mesh; lm: THREE.MeshBasicMaterial; x: number }

export type WorldData = {
  grid: Grid
  sites: Site[]
  pickups: PickupSpawn[]
  campLoot: { x: number; y: number }[]
  heightAt: (x: number, y: number) => number
  legos: LegoSpawn[]
  turrets: TurretSpawn[]
  fences: FenceSpawn[]
  plates: PlateSpawn[]
  camps: CampSpawn[]
  beacons: BeaconSpawn[]
  wrecks: WreckSpawn[]
  covers: Rect[]
  endWall: Rect & { on: boolean }
  endWallMesh: THREE.Mesh
  lever: LeverRig & { x: number; y: number }
  doors: { d1: DoorRig; d2: DoorRig }
  sky: THREE.Group
  stars: THREE.Points
  planet: THREE.Mesh
  moon: THREE.Group
  tower: { x: number; y: number }
  shipRect: Rect
}

// Doble de coberturas repartidas a lo ancho del pasillo azul de doble anchura (BY0=-90..BY1=630)
export const covers: Rect[] = [
  { x: 965, y: 120, w: 48, h: 64 },
  { x: 985, y: 360, w: 48, h: 68 },
  { x: 1085, y: -20, w: 52, h: 66 },
  { x: 1100, y: 235, w: 50, h: 72 },
  { x: 1115, y: 490, w: 52, h: 66 },
  { x: 1235, y: 95, w: 54, h: 68 },
  { x: 1255, y: 375, w: 54, h: 68 },
  { x: 1380, y: -15, w: 50, h: 68 },
  { x: 1395, y: 235, w: 56, h: 74 },
  { x: 1410, y: 485, w: 50, h: 68 },
  { x: 1545, y: 105, w: 52, h: 66 },
  { x: 1560, y: 370, w: 52, h: 66 },
  { x: 1695, y: 15, w: 48, h: 64 },
  { x: 1705, y: 240, w: 48, h: 68 },
]

export function setDoor(d: DoorRig, o: number): void {
  const k = 1 - o
  const half = (FY1 - FY0) * 0.5
  const h = half * k
  d.top.visible = d.bot.visible = h >= 2
  d.top.scale.z = d.bot.scale.z = Math.max(0.001, h)
  d.top.position.z = FY0 + h / 2
  d.bot.position.z = FY1 - h / 2
}
export function doorPanels(x: number, o: number): Rect[] {
  const half = (FY1 - FY0) * 0.5
  const h = half * (1 - o)
  if (h < 2) return []
  return [
    { x: x - 10, y: FY0, w: 20, h, top: DOOR_H },
    { x: x - 10, y: FY1 - h, w: 20, h, top: DOOR_H },
  ]
}

function groundTexture(size: number, draw: (g: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = c.height = size
  draw(c.getContext('2d')!)
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return t
}

// ---------- Texturas LEGO mejoradas para paredes, ruinas y pisos ----------
type WallStyle = 'brick' | 'ruin' | 'dark'
const wallTexCache = new Map<WallStyle, THREE.CanvasTexture>()
const wallMatCache = new Map<string, THREE.MeshStandardMaterial>()

function getWallTex(style: WallStyle): THREE.CanvasTexture {
  const hit = wallTexCache.get(style)
  if (hit) return hit
  const S = 256
  const r = seeded(style === 'ruin' ? 303 : style === 'dark' ? 409 : 517)
  const t = groundTexture(S, g => {
    g.fillStyle = '#ffffff'
    g.fillRect(0, 0, S, S)
    // grano de plástico/piedra LEGO envejecido
    for (let i = 0; i < 2200; i++) {
      g.fillStyle = `rgba(${r() < 0.5 ? '20,22,28' : '255,255,255'},${0.03 + r() * 0.08})`
      g.fillRect(r() * S, r() * S, 1 + r() * 3, 1 + r() * 3)
    }
    // hiladas de bloques LEGO (ladrillos con bisel superior claro e inferior oscuro)
    const rows = 8
    const rh = S / rows
    for (let row = 0; row < rows; row++) {
      const y = row * rh
      g.fillStyle = 'rgba(255,255,255,.22)'
      g.fillRect(0, y + 2, S, 2)
      g.fillStyle = 'rgba(15,18,26,.42)'
      g.fillRect(0, y + rh - 2, S, 2)
      const cols = 4
      const cw = S / cols
      const off = (row % 2) * (cw / 2)
      for (let col = 0; col <= cols; col++) {
        const x = (col * cw + off) % S
        g.fillStyle = 'rgba(15,18,26,.45)'
        g.fillRect(x - 1, y, 2, rh)
        g.fillStyle = 'rgba(255,255,255,.18)'
        g.fillRect(x + 1, y + 2, 1.5, rh - 4)
        // ligera variación tonal por ladrillo
        g.fillStyle = `rgba(0,0,0,${(r() * 0.1).toFixed(3)})`
        g.fillRect(x + 2, y + 2, cw - 4, rh - 4)
      }
    }
    if (style === 'ruin') {
      // grietas irregulares, desconchados, manchas de humedad/óxido en ruinas blancas y edificios
      for (let i = 0; i < 16; i++) {
        const x = r() * S
        const y = r() * S
        const rad = 10 + r() * 28
        const gr = g.createRadialGradient(x, y, 1, x, y, rad)
        gr.addColorStop(0, r() < 0.45 ? 'rgba(95,82,62,.38)' : 'rgba(65,78,68,.32)')
        gr.addColorStop(1, 'rgba(255,255,255,0)')
        g.fillStyle = gr
        g.beginPath()
        g.arc(x, y, rad, 0, 7)
        g.fill()
      }
      g.strokeStyle = 'rgba(30,28,36,.65)'
      g.lineCap = 'round'
      for (let i = 0; i < 14; i++) {
        let cx = r() * S
        let cy = r() * S
        g.lineWidth = 1.2 + r() * 1.8
        g.beginPath()
        g.moveTo(cx, cy)
        for (let s = 0; s < 5; s++) {
          cx += (r() - 0.5) * 28
          cy += 6 + r() * 16
          g.lineTo(cx, cy)
        }
        g.stroke()
      }
    } else if (style === 'dark') {
      // paneles industriales oscuros con remaches y rejillas para el cuarto inicial
      g.strokeStyle = 'rgba(0,0,0,.55)'
      g.lineWidth = 3
      g.strokeRect(8, 8, S - 16, S - 16)
      for (let i = 0; i < 6; i++) {
        g.fillStyle = 'rgba(0,0,0,.5)'
        g.fillRect(24 + i * 34, S - 36, 22, 8)
      }
    } else {
      // desgaste y manchas de óxido/polvo en la base de los muros
      const gr = g.createLinearGradient(0, S * 0.6, 0, S)
      gr.addColorStop(0, 'rgba(80,55,30,0)')
      gr.addColorStop(1, 'rgba(60,38,18,.32)')
      g.fillStyle = gr
      g.fillRect(0, 0, S, S)
    }
  })
  wallTexCache.set(style, t)
  return t
}

function getWallMat(color: number, style: WallStyle): THREE.MeshStandardMaterial {
  const k = `${color}|${style}`
  let m = wallMatCache.get(k)
  if (!m) {
    const tex = getWallTex(style)
    m = new THREE.MeshStandardMaterial({
      color,
      map: tex,
      bumpMap: tex,
      bumpScale: style === 'ruin' ? 1.8 : 1.2,
      roughness: style === 'dark' ? 0.55 : 0.72,
      metalness: style === 'dark' ? 0.18 : 0.04,
    })
    wallMatCache.set(k, m)
  }
  return m
}

/** Una montaña rocosa irregular de pocos polígonos: cada una tiene forma, picos, inclinación y color propios. */
function mountainGeo(r: () => number, rw: number, rd: number, h: number): THREE.BufferGeometry {
  const geo = new THREE.IcosahedronGeometry(1, 2)
  const pos = geo.attributes.position as THREE.BufferAttribute
  const n = pos.count
  const colors = new Float32Array(n * 3)
  const ph = [r() * 100, r() * 100, r() * 100, r() * 100, r() * 100, r() * 100]
  const skew = (r() - 0.5) * 0.8
  const sharp = 0.3 + r() * 0.55
  const peaks = Array.from({ length: 1 + Math.floor(r() * 3) }, () => ({ x: (r() - 0.5) * 1.1, z: (r() - 0.5) * 1.1, s: 0.22 + r() * 0.4, k: 0.25 + r() * 0.85 }))
  const lowC = new THREE.Color([0x6a5a48, 0x7a5a3a, 0x6e6458, 0x8a6a48, 0x5f5648][Math.floor(r() * 5)])
  const hiC = new THREE.Color([0xa59886, 0x8b93a1, 0xb0a08a, 0x9a8f80, 0x7b8493][Math.floor(r() * 5)])
  const c = new THREE.Color()
  for (let i = 0; i < n; i++) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    const z = pos.getZ(i)
    const f = Math.sin(x * 2.3 + ph[0]) * Math.sin(y * 3.1 + ph[1]) + Math.sin(z * 2.7 + ph[2]) * Math.sin(x * 4.2 + ph[3]) * 0.6 + Math.sin((x + z) * 6.5 + ph[4]) * 0.3
    const jag = 1 + 0.3 * f
    const ny = y < 0 ? -0.06 : y
    const taper = 1 - sharp * Math.max(0, ny)
    let py = Math.max(0, ny) * h * (0.6 + 0.4 * jag)
    for (const p of peaks) {
      const d = Math.hypot(x - p.x, z - p.z)
      py += p.k * h * Math.exp(-(d * d) / (p.s * p.s)) * Math.max(0, ny)
    }
    py *= 1 + 0.16 * Math.sin(x * 9 + ph[5]) * Math.sin(z * 8 + ph[0])
    const px = x * rw * jag * taper + skew * py
    const pz = z * rd * jag * taper
    pos.setXYZ(i, px, py - 6, pz)
    const t = Math.min(1, Math.max(0, py / (h * 1.1)))
    c.copy(lowC).lerp(hiC, Math.pow(t, 0.8))
    const shade = 0.82 + 0.28 * (0.5 + 0.5 * f * 0.6) + (r() - 0.5) * 0.08
    colors[i * 3] = c.r * shade
    colors[i * 3 + 1] = c.g * shade
    colors[i * 3 + 2] = c.b * shade
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  geo.computeVertexNormals()
  // rotación y orientación aleatorias para que no haya dos iguales
  geo.rotateY(r() * 6.283)
  return geo
}

/** Cordillera rocosa alrededor del mapa: dos filas de montañas distintas, fusionadas en una sola malla. */
function buildMountainRim(): THREE.Mesh {
  const r = seeded(2024)
  const geos: THREE.BufferGeometry[] = []
  const place = (cx: number, cz: number, rw: number, rd: number, h: number): void => {
    const g = mountainGeo(r, rw, rd, h)
    g.translate(cx, 0, cz)
    geos.push(g)
  }
  type Side = 'n' | 's' | 'e' | 'w'
  const row = (side: Side, a0: number, a1: number, back: boolean): void => {
    for (let a = a0; a < a1; ) {
      const rw = back ? 110 + r() * 110 : 60 + r() * 80
      const rd = rw * (0.75 + r() * 0.6)
      const h = back ? 230 + r() * 230 : 120 + r() * 200
      const out = back ? rd * 2.1 + r() * 40 : rd * 0.88 + r() * 24
      const along = a + rw * 0.5 + (r() - 0.5) * 30
      if (!(back && r() < 0.12)) {
        if (side === 'n') place(along, WORLD.y0 - out, rw, rd, h)
        else if (side === 's') place(along, WORLD.y1 + out, rw, rd, h)
        else if (side === 'e') place(WORLD.x1 + out, along, rd, rw, h)
        else place(WORLD.x0 - out, along, rd, rw, h)
      }
      a += rw * (back ? 1.35 : 1.15) + r() * 10
    }
  }
  for (const back of [false, true]) {
    row('n', WORLD.x0 - 320, WORLD.x1 + 380, back)
    row('s', WORLD.x0 - 320, WORLD.x1 + 380, back)
    row('e', WORLD.y0 - 320, WORLD.y1 + 320, back)
    row('w', WORLD.y0 - 320, Math.min(FY0, BY0) - 90, back)
    row('w', Math.max(FY1, BY1) + 90, WORLD.y1 + 320, back)
  }
  const merged = mergeGeometries(geos, false)!
  for (const g of geos) g.dispose()
  const mesh = new THREE.Mesh(merged, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1, metalness: 0 }))
  mesh.castShadow = false
  mesh.receiveShadow = false
  return mesh
}

export function buildWorld(scene: THREE.Scene): WorldData {
  const grid = new Grid(256)
  const world = new THREE.Group()
  scene.add(world)
  const sites: Site[] = []
  const pickups: PickupSpawn[] = []
  const campLoot: { x: number; y: number }[] = []
  const ramps: { x0: number; x1: number; y0: number; y1: number; z0: number; z1: number }[] = []
  const legos: LegoSpawn[] = []
  const turrets: TurretSpawn[] = []
  const fences: FenceSpawn[] = []
  const plates: PlateSpawn[] = []
  const camps: CampSpawn[] = []
  const beacons: BeaconSpawn[] = []
  const wrecks: WreckSpawn[] = []
  const solidList: Rect[] = []

  const heightAt = (x: number, y: number): number => {
    let h = 0
    for (const r of ramps) {
      if (x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1) {
        const t = r.x1 > r.x0 ? clamp((x - r.x0) / (r.x1 - r.x0), 0, 1) : 1
        h = Math.max(h, r.z0 + (r.z1 - r.z0) * t)
      }
    }
    return h
  }

  const solid = (r: Rect): Rect => {
    grid.add(r)
    solidList.push(r)
    return r
  }
  /** Pared o bloque: x,y = esquina (plano de simulación), con textura LEGO según paleta. */
  function wall(x: number, y: number, w: number, d: number, h: number, pal: Pal, o: { solid?: boolean; studs?: boolean; style?: WallStyle; y0?: number } = {}): THREE.Mesh {
    const y0 = o.y0 ?? 0
    const m = box(w, h, d, pal.b, x + w / 2, y0 + h / 2, y + d / 2)
    const style: WallStyle = o.style ?? (pal.b === PAL.white.b || pal.b === PAL.lab.b ? 'ruin' : pal.b === PAL.black.b ? 'dark' : 'brick')
    m.material = getWallMat(pal.b, style)
    world.add(m)
    if (o.studs !== false) addStuds(pal.s, x, y, w, d, y0 + h)
    if (o.solid !== false) solid({ x, y, w, h: d, top: y0 + h })
    return m
  }

  // ---------- Suelo del pasillo con textura de placas LEGO ----------
  const FLOOR = {
    A: { b: 0x161820, s: 0x262a35, hex: '#181b24', detail: '#0d0f15', stripe: '#b88614' },
    B: { b: 0x1f5fbf, s: 0x3b82e6, hex: '#1d56ad', detail: '#123873', stripe: '#8ab8ff' },
    C: { b: 0xc01f2b, s: 0xe04a4f, hex: '#b51d28', detail: '#6e0e16', stripe: '#ffaa3b' },
  }
  const floor = (x0: number, x1: number, y0: number, y1: number, k: keyof typeof FLOOR): void => {
    const w = x1 - x0
    const d = y1 - y0
    const cfg = FLOOR[k]
    const tex = groundTexture(256, g => {
      const r = seeded(k.charCodeAt(0) * 71)
      g.fillStyle = cfg.hex
      g.fillRect(0, 0, 256, 256)
      // uniones de placas LEGO y desgaste
      g.strokeStyle = cfg.detail
      g.lineWidth = 2
      for (let i = 0; i <= 256; i += 64) {
        g.beginPath()
        g.moveTo(i, 0)
        g.lineTo(i, 256)
        g.moveTo(0, i)
        g.lineTo(256, i)
        g.stroke()
      }
      for (let i = 0; i < 600; i++) {
        g.fillStyle = `rgba(0,0,0,${0.05 + r() * 0.14})`
        g.fillRect(r() * 256, r() * 256, 2 + r() * 6, 2 + r() * 6)
      }
      if (k === 'B') {
        // grietas de ruina en el pasillo azul
        g.strokeStyle = 'rgba(10,20,42,.55)'
        g.lineWidth = 1.6
        for (let i = 0; i < 10; i++) {
          g.beginPath()
          let cx = r() * 256
          let cy = r() * 256
          g.moveTo(cx, cy)
          for (let s = 0; s < 4; s++) {
            cx += (r() - 0.5) * 40
            cy += (r() - 0.5) * 40
            g.lineTo(cx, cy)
          }
          g.stroke()
        }
      } else {
        g.fillStyle = cfg.stripe
        g.globalAlpha = 0.25
        for (let i = 0; i < 8; i++) g.fillRect(i * 32, 0, 14, 10)
        g.globalAlpha = 1
      }
    })
    tex.repeat.set(w / 160, d / 160)
    const fl = box(w, 16, d, cfg.b, x0 + w / 2, -8, y0 + d / 2, false)
    fl.material = new THREE.MeshStandardMaterial({ map: tex, bumpMap: tex, bumpScale: 0.9, roughness: 0.68 })
    world.add(fl)
    addStuds(cfg.s, x0, y0, w, d, 0)
  }
  floor(0, D1X, FY0, FY1, 'A')
  floor(D1X, D2X, BY0, BY1, 'B')
  floor(D2X, ZC_END, FY0, FY1, 'C')

  // ---------- 1) Cuarto de aparición: cerrado, oscuro y con techo ----------
  wall(0, FY0 - 24, D1X, 24, ROOM_H, PAL.black, { style: 'dark' })
  wall(0, FY1, D1X, 24, ROOM_H, PAL.black, { style: 'dark' })
  wall(-40, FY0 - 24, 40, FY1 - FY0 + 48, ROOM_H, PAL.black, { style: 'dark' })
  // columnas interiores del cuarto oscuro
  for (let x = 140; x < D1X - 100; x += 220) {
    wall(x, FY0, 22, 18, ROOM_H, PAL.black, { style: 'dark', studs: false })
    wall(x, FY1 - 18, 22, 18, ROOM_H, PAL.black, { style: 'dark', studs: false })
  }
  // techo cerrado del cuarto inicial + vigas y luces tenues de emergencia
  {
    const roof = box(D1X + 40, 14, FY1 - FY0 + 48, 0x12141b, (D1X - 40) / 2, ROOM_H + 7, (FY0 + FY1) / 2, false)
    roof.material = getWallMat(0x161922, 'dark')
    world.add(roof)
    for (let x = 120; x < D1X; x += 240) {
      const beam = box(18, 10, FY1 - FY0, 0x222632, x, ROOM_H - 4, (FY0 + FY1) / 2, false)
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(8, 2, 54), new THREE.MeshBasicMaterial({ color: 0xff4a2a }))
      lamp.position.set(x, ROOM_H - 9, (FY0 + FY1) / 2)
      world.add(beam, lamp)
    }
  }

  // ---------- Armería vacía inicial (todos los estantes despojados salvo la pistola láser) ----------
  // Mesa/pedestal tecnológico central donde descansa la pistola láser (x=560, y=335)
  {
    const desk = box(48, 16, 28, 0x1f232b, 560, 8, 335)
    desk.material = getWallMat(0x1f232b, 'dark')
    const deskRim = box(50, 2, 30, 0x3d4454, 560, 16, 335)
    const cradlePad = new THREE.Mesh(new THREE.BoxGeometry(32, 1, 16), new THREE.MeshBasicMaterial({ color: 0x4df0ff }))
    cradlePad.position.set(560, 17, 335)
    world.add(desk, deskRim, cradlePad)
    solid({ x: 560 - 24, y: 335 - 14, w: 48, h: 28, top: 18 })
  }
  // Estantes de armas vacíos montados en la pared norte y sur (armeros metálicos sin armas)
  for (const rx of [260, 480, 720]) {
    const rackN = box(44, 38, 6, 0x242832, rx, 24, FY0 + 3)
    const ledN = new THREE.Mesh(new THREE.BoxGeometry(40, 2, 2), new THREE.MeshBasicMaterial({ color: 0xff2828 }))
    ledN.position.set(rx, 42, FY0 + 6)
    world.add(rackN, ledN)
    const rackS = box(44, 38, 6, 0x242832, rx + 40, 24, FY1 - 3)
    const ledS = new THREE.Mesh(new THREE.BoxGeometry(40, 2, 2), new THREE.MeshBasicMaterial({ color: 0xff2828 }))
    ledS.position.set(rx + 40, 42, FY1 - 6)
    world.add(rackS, ledS)
  }
  // Cajas de armamento abiertas y vacías (tapas abiertas, interior desvalijado)
  {
    const makeOpenCrate = (cx: number, cz: number, rot = 0, col = 0x354030): void => {
      const g = new THREE.Group()
      g.position.set(cx, 0, cz)
      g.rotation.y = rot
      g.add(box(32, 14, 2, col, 0, 7, -9))
      g.add(box(32, 14, 2, col, 0, 7, 9))
      g.add(box(2, 14, 16, col, -15, 7, 0))
      g.add(box(2, 14, 16, col, 15, 7, 0))
      g.add(box(32, 2, 20, col, 0, 1, 0))
      const lid = box(34, 2, 22, col + 0x080808, 0, 14, 12)
      lid.rotation.x = 0.55
      g.add(lid)
      world.add(g)
      solid({ x: cx - 18, y: cz - 14, w: 36, h: 28, top: 16 })
    }
    makeOpenCrate(340, FY0 + 32, 0.2, 0x2f3a2b)
    makeOpenCrate(420, FY0 + 40, -0.3, 0x283038)
    makeOpenCrate(640, FY1 - 42, -0.15, 0x3a3028)
    makeOpenCrate(760, FY1 - 36, 0.35, 0x2f3a2b)
  }
  // Banco de mantenimiento desvalijado y latas de munición vacías
  {
    const bench = box(56, 15, 22, 0x2c3038, 180, 7.5, FY1 - 32)
    bench.material = getWallMat(0x2c3038, 'dark')
    world.add(bench)
    solid({ x: 180 - 28, y: FY1 - 32 - 11, w: 56, h: 22, top: 16 })
    for (const [mx, mz] of [[220, FY1 - 48], [390, FY0 + 26], [690, FY1 - 28]]) {
      const can = cyl(4.5, 4.5, 9, 0x444d3c, 10)
      can.position.set(mx, 4.5, mz)
      world.add(can)
    }
  }

  // muros de cierre que conectan el cuarto inicial (FY0..FY1) con el pasillo azul del doble de ancho (BY0..BY1)
  wall(D1X - 24, BY0 - 24, 36, FY0 - (BY0 - 24), ROOM_H, PAL.white, { style: 'ruin' })
  wall(D1X - 24, FY1, 36, BY1 + 24 - FY1, ROOM_H, PAL.white, { style: 'ruin' })

  // ---------- 2) Pasillo azul: doble de ancho (BY0..BY1), cerrado, paredes blancas de ruina, techo con aberturas y más coberturas ----------
  wall(D1X, BY0 - 24, D2X - D1X, 24, ROOM_H, PAL.white, { style: 'ruin' })
  wall(D1X, BY1, D2X - D1X, 24, ROOM_H, PAL.white, { style: 'ruin' })
  {
    // Columnas / pilares que sobresalen hacia el interior, sin caras coplanares para eliminar Z-fighting y parpadeos
    for (let x = 960; x < 1820; x += 110) {
      wall(x, BY0, 24, 6, ROOM_H, PAL.white, { solid: false, studs: false, style: 'ruin' })
      wall(x, BY1 - 6, 24, 6, ROOM_H, PAL.white, { solid: false, studs: false, style: 'ruin' })
      wall(x - 4, BY0 - 26, 32, 28, 16, PAL.white, { solid: false, y0: ROOM_H, style: 'ruin' })
      wall(x - 4, BY1 - 2, 32, 28, 16, PAL.white, { solid: false, y0: ROOM_H, style: 'ruin' })
    }
    // techo de ruina con aberturas (tragaluces rotos por donde entra luz)
    const spanZ = BY1 - BY0 + 48
    const cz = (BY0 + BY1) / 2
    let curX = D1X
    const skylights: [number, number][] = [
      [980, 1065],
      [1145, 1235],
      [1320, 1420],
      [1505, 1600],
      [1685, 1775],
    ]
    for (const [sx0, sx1] of skylights) {
      if (sx0 > curX) {
        const w = sx0 - curX
        const slab = box(w, 12, spanZ, PAL.white.b, curX + w / 2, ROOM_H + 6, cz, true)
        slab.material = getWallMat(PAL.white.b, 'ruin')
        world.add(slab)
      }
      // bordes laterales de la abertura y vigas rotas cruzando el hueco
      const openW = sx1 - sx0
      const rimN = box(openW, 12, 74, PAL.white.b, sx0 + openW / 2, ROOM_H + 6, BY0 + 13, true)
      const rimS = box(openW, 12, 74, PAL.white.b, sx0 + openW / 2, ROOM_H + 6, BY1 - 13, true)
      const beam = box(14, 10, spanZ - 80, 0xd8d5ca, sx0 + openW * 0.5, ROOM_H + 4, cz, true)
      rimN.material = rimS.material = beam.material = getWallMat(PAL.white.b, 'ruin')
      world.add(rimN, rimS, beam)
      curX = sx1
    }
    if (curX < D2X) {
      const w = D2X - curX
      const slab = box(w, 12, spanZ, PAL.white.b, curX + w / 2, ROOM_H + 6, cz, true)
      slab.material = getWallMat(PAL.white.b, 'ruin')
      world.add(slab)
    }
  }
  // muros de transición del pasillo azul (BY0..BY1) al cuarto/garage rojo (FY0..FY1)
  wall(D2X - 12, BY0 - 24, 36, FY0 - (BY0 - 24), ROOM_H, PAL.white, { style: 'ruin' })
  wall(D2X - 12, FY1, 36, BY1 + 24 - FY1, ROOM_H, PAL.white, { style: 'ruin' })

  // ---------- 3) Cuarto tipo Garage Rojo (donde está estacionado el buggy) ----------
  wall(D2X, FY0 - 24, ZC_END - D2X, 24, ROOM_H, PAL.red, { style: 'brick' })
  wall(D2X, FY1, ZC_END - D2X, 24, ROOM_H, PAL.red, { style: 'brick' })
  {
    const gw = ZC_END - D2X
    const gd = FY1 - FY0
    const gcx = D2X + gw / 2
    const gcz = (FY0 + FY1) / 2
    // columnas industriales internas del garage
    for (let x = D2X + 95; x < ZC_END - 50; x += 175) {
      wall(x, FY0, 22, 16, ROOM_H, PAL.red, { style: 'brick', studs: false })
      wall(x, FY1 - 16, 22, 16, ROOM_H, PAL.red, { style: 'brick', studs: false })
    }
    // techo cerrado del garage rojo + vigas metálicas y lámparas de taller sobre el buggy
    const roof = box(gw + 36, 14, gd + 48, 0x7c1620, gcx, ROOM_H + 7, gcz, false)
    roof.material = getWallMat(0x8f1b26, 'brick')
    world.add(roof)
    for (let x = D2X + 110; x < ZC_END - 40; x += 170) {
      const beam = box(18, 10, gd, 0x382026, x, ROOM_H - 4, gcz, false)
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(12, 2.5, 76), new THREE.MeshBasicMaterial({ color: 0xffe08a }))
      lamp.position.set(x, ROOM_H - 10, gcz)
      world.add(beam, lamp)
    }
    // pórtico / grúa de mantenimiento sobre la bahía del buggy (x=2260, y=270)
    const gantryL = box(14, 78, 14, 0xd8a020, 2260, 39, 142)
    const gantryR = box(14, 78, 14, 0xd8a020, 2260, 39, 398)
    const gantryTop = box(18, 12, 270, 0xd8a020, 2260, 82, 270)
    world.add(gantryL, gantryR, gantryTop)
    // líneas pintadas de bahía de estacionamiento en el suelo del garage
    const stripeMat = new THREE.MeshBasicMaterial({ color: 0xffc82a })
    for (const sz of [195, 345]) {
      const s = new THREE.Mesh(new THREE.BoxGeometry(190, 0.8, 6), stripeMat)
      s.position.set(2260, 0.5, sz)
      world.add(s)
    }
    for (const sx of [2165, 2355]) {
      const s = new THREE.Mesh(new THREE.BoxGeometry(6, 0.8, 156), stripeMat)
      s.position.set(sx, 0.5, 270)
      world.add(s)
    }
    // mobiliario de garage junto a las paredes (gabinetes de herramientas, banco de trabajo, barriles y neumáticos)
    wall(1985, FY0 + 18, 86, 28, 44, PAL.red, { style: 'brick' })
    wall(2150, FY1 - 46, 96, 28, 38, PAL.yellow, { style: 'brick' })
    wall(2365, FY0 + 18, 68, 28, 40, PAL.gray, { style: 'brick' })
    for (const [bx, bz, col] of [
      [1940, FY1 - 36, 0xd63031],
      [1968, FY1 - 36, 0xe6b822],
      [2390, FY1 - 36, 0xd63031],
      [2418, FY1 - 36, 0x3b6fd8],
    ] as [number, number, number][]) {
      const br = cyl(11, 11, 28, col, 14)
      br.position.set(bx, 14, bz)
      world.add(br)
      solid({ x: bx - 11, y: bz - 11, w: 22, h: 22, top: 28 })
    }
    // pilas de neumáticos de repuesto del buggy
    for (const [tx, tz, n] of [
      [2105, FY0 + 32, 3],
      [2325, FY1 - 34, 2],
    ] as [number, number, number][]) {
      for (let i = 0; i < n; i++) {
        const tire = cyl(14, 14, 9, 0x1c1e26, 16)
        tire.position.set(tx, 4.5 + i * 9.5, tz)
        world.add(tire)
      }
      solid({ x: tx - 14, y: tz - 14, w: 28, h: 28, top: n * 10 })
    }
    // Cajón / estructura superior hueca sobre el portón de salida donde se oculta la puerta al deslizarse hacia arriba
    const headerH = ROOM_H - (DOOR_H + 14)
    const casingY = DOOR_H + 14 + headerH / 2
    // Fascia frontal interior (lado garage)
    const fasciaIn = box(8, headerH, gd + 48, PAL.red.b, ZC_END - 4, casingY, gcz, false)
    fasciaIn.material = getWallMat(PAL.red.b, 'brick')
    // Fascia trasera exterior (lado desierto)
    const fasciaOut = box(8, headerH, gd + 48, PAL.red.b, ZC_END + 34, casingY, gcz, false)
    fasciaOut.material = getWallMat(PAL.red.b, 'brick')
    // Tapa superior del cajón
    const casingCap = box(46, 8, gd + 48, PAL.red.b, ZC_END + 15, ROOM_H + 4, gcz, false)
    world.add(fasciaIn, fasciaOut, casingCap)
  }
  const endWall = { x: ZC_END, y: FY0, w: 30, h: FY1 - FY0, on: true, top: DOOR_H + 14 } as Rect & { on: boolean }
  grid.add(endWall)
  const endWallMesh = wall(endWall.x, endWall.y, endWall.w, endWall.h, DOOR_H + 14, PAL.red, { solid: false, studs: false })
  // Palanca empotrada a ras de la pared sur del garage rojo junto al portón de salida
  const leverRig = makeLever()
  const leverX = 2485
  const leverY = FY0 + 4
  leverRig.group.position.set(leverX, 0, leverY)
  // Caja eléctrica de montaje empotrada en la pared y conducto vertical hacia el techo
  const leverWallPlate = box(30, 44, 4, 0x1a1d24, leverX, 32, FY0 - 1)
  const conduit = cyl(2, 2, 85, 0x5a6270, 8)
  conduit.position.set(leverX + 11, 75, FY0 + 1)
  world.add(leverRig.group, leverWallPlate, conduit)
  const lever = { ...leverRig, x: leverX, y: FY0 + 16 }
  {
    const rc = seeded(19)
    for (const c of covers) {
      const ch = COVER_H + Math.round((rc() - 0.3) * 18)
      wall(c.x, c.y, c.w, c.h, ch, PAL.white, { style: 'ruin' })
    }
  }

  // puertas (en los vanos FY0..FY1 de entrada y salida del pasillo azul)
  const makeDoor = (x: number, pal: Pal, lightColor: number): DoorRig => {
    const top = box(20, DOOR_H, 1, pal.b, x, DOOR_H / 2, FY0 + 90)
    const bot = box(20, DOOR_H, 1, pal.b, x, DOOR_H / 2, FY1 - 90)
    top.material = bot.material = getWallMat(pal.b, 'dark')
    world.add(top, bot)
    const f1 = box(34, DOOR_H + 18, 26, pal.b, x, (DOOR_H + 18) / 2, FY0 - 10)
    const f2 = box(34, DOOR_H + 18, 26, pal.b, x, (DOOR_H + 18) / 2, FY1 + 10)
    f1.material = f2.material = getWallMat(pal.b, 'ruin')
    world.add(f1, f2)
    // dintel sobre la puerta hasta el techo
    const lintel = box(32, ROOM_H - DOOR_H, FY1 - FY0 + 24, pal.b, x, DOOR_H + (ROOM_H - DOOR_H) / 2, (FY0 + FY1) / 2)
    lintel.material = getWallMat(pal.b, 'ruin')
    world.add(lintel)
    const lm = new THREE.MeshBasicMaterial({ color: lightColor })
    const l1 = new THREE.Mesh(new THREE.SphereGeometry(5, 12, 8), lm)
    const l2 = l1.clone()
    l1.position.set(x, DOOR_H + 12, FY0 - 10)
    l2.position.set(x, DOOR_H + 12, FY1 + 10)
    world.add(l1, l2)
    return { top, bot, lm, x }
  }
  const doors = { d1: makeDoor(D1X, PAL.white, 0x3bff8a), d2: makeDoor(D2X, PAL.red, 0xff3b4a) }

  // ---------- Pasillo: loot y piezas (ajustados dentro del pasillo azul de doble ancho) ----------
  pickups.push({ kind: 'medkit', x: 1320, y: -45 }, { kind: 'medkit', x: 1680, y: 575 })
  legos.push({ x: 42, y: 428, variant: 0 }, { x: 1210, y: 585, variant: 5 })

  // ---------- Mundo abierto: suelo, carretera y arena con texturas LEGO detalladas ----------
  const GW = WORLD.x1 - WORLD.x0 + 400
  const GH = WORLD.y1 - WORLD.y0 + 400
  const sandTex = groundTexture(256, g => {
    const r = seeded(101)
    g.fillStyle = '#b99c6b'
    g.fillRect(0, 0, 256, 256)
    // dunas suaves y parches de roca arenisca
    for (let i = 0; i < 28; i++) {
      const x = r() * 256
      const y = r() * 256
      const rad = 18 + r() * 48
      const gr = g.createRadialGradient(x, y, 2, x, y, rad)
      gr.addColorStop(0, r() < 0.5 ? 'rgba(145,112,68,.36)' : 'rgba(218,195,148,.34)')
      gr.addColorStop(1, 'rgba(185,156,107,0)')
      g.fillStyle = gr
      g.beginPath()
      g.arc(x, y, rad, 0, 7)
      g.fill()
    }
    // cuadrícula de placas base LEGO y grietas del desierto
    g.strokeStyle = 'rgba(75,52,22,.22)'
    g.lineWidth = 1.5
    for (let k = 0; k <= 256; k += 64) {
      g.beginPath()
      g.moveTo(k, 0)
      g.lineTo(k, 256)
      g.moveTo(0, k)
      g.lineTo(256, k)
      g.stroke()
    }
    g.strokeStyle = 'rgba(68,46,18,.35)'
    g.lineWidth = 1.2
    for (let i = 0; i < 8; i++) {
      let cx = r() * 256
      let cy = r() * 256
      g.beginPath()
      g.moveTo(cx, cy)
      for (let s = 0; s < 4; s++) {
        cx += (r() - 0.5) * 32
        cy += (r() - 0.5) * 32
        g.lineTo(cx, cy)
      }
      g.stroke()
    }
    // tacos LEGO con sombra, bisel y brillo superior
    for (let i = 0; i < 16; i++)
      for (let j = 0; j < 16; j++) {
        const cx = i * 16 + 8
        const cy = j * 16 + 8
        g.fillStyle = 'rgba(55,36,10,.32)'
        g.beginPath()
        g.arc(cx + 0.6, cy + 1.6, 5.7, 0, 7)
        g.fill()
        g.fillStyle = (i + j) % 5 === 0 ? '#c7ae7e' : '#d2ba8a'
        g.beginPath()
        g.arc(cx, cy, 5.4, 0, 7)
        g.fill()
        g.strokeStyle = 'rgba(255,245,215,.35)'
        g.lineWidth = 1
        g.beginPath()
        g.arc(cx - 0.6, cy - 0.6, 4.4, 3.4, 5.8)
        g.stroke()
      }
  })
  sandTex.repeat.set(GW / 256, GH / 256)
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(GW, GH),
    new THREE.MeshStandardMaterial({ map: sandTex, bumpMap: sandTex, bumpScale: 1.1, roughness: 0.84 }),
  )
  ground.rotation.x = -Math.PI / 2
  ground.position.set(WORLD.x0 + GW / 2 - 200, -0.3, (WORLD.y0 + WORLD.y1) / 2)
  ground.receiveShadow = true
  world.add(ground)

  const roadTex = groundTexture(256, g => {
    const r = seeded(202)
    g.fillStyle = '#464a55'
    g.fillRect(0, 0, 256, 256)
    // bordes con arena acumulada y marcas de neumáticos
    const edgeN = g.createLinearGradient(0, 0, 0, 38)
    edgeN.addColorStop(0, 'rgba(185,156,107,.65)')
    edgeN.addColorStop(1, 'rgba(185,156,107,0)')
    g.fillStyle = edgeN
    g.fillRect(0, 0, 256, 38)
    const edgeS = g.createLinearGradient(0, 218, 0, 256)
    edgeS.addColorStop(0, 'rgba(185,156,107,0)')
    edgeS.addColorStop(1, 'rgba(185,156,107,.65)')
    g.fillStyle = edgeS
    g.fillRect(0, 218, 256, 38)
    g.fillStyle = 'rgba(25,27,34,.35)'
    g.fillRect(0, 72, 256, 16)
    g.fillRect(0, 168, 256, 16)
    for (let i = 0; i < 16; i++)
      for (let j = 0; j < 16; j++) {
        g.fillStyle = 'rgba(0,0,0,.28)'
        g.beginPath()
        g.arc(i * 16 + 8, j * 16 + 9.5, 5.6, 0, 7)
        g.fill()
        g.fillStyle = r() < 0.2 ? '#595e6b' : '#656a78'
        g.beginPath()
        g.arc(i * 16 + 8, j * 16 + 8, 5.4, 0, 7)
        g.fill()
      }
    g.fillStyle = '#ffd21f'
    g.fillRect(20, 122, 120, 12)
    g.fillStyle = 'rgba(70,74,85,.45)'
    for (let i = 0; i < 8; i++) g.fillRect(24 + r() * 110, 122 + r() * 10, 6 + r() * 10, 3)
  })
  const roadLen = WORLD.x1 - WORLD.x0
  roadTex.repeat.set(roadLen / 256, ROAD_W / 256)
  const road = new THREE.Mesh(
    new THREE.PlaneGeometry(roadLen, ROAD_W),
    new THREE.MeshStandardMaterial({ map: roadTex, bumpMap: roadTex, bumpScale: 0.9, roughness: 0.88, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
  )
  road.rotation.x = -Math.PI / 2
  road.position.set(WORLD.x0 + roadLen / 2, 0.2, ROAD_Y)
  road.receiveShadow = true
  world.add(road)

  // límites del mundo
  const T = 300
  solid({ x: WORLD.x0 - 20, y: WORLD.y0 - T, w: WORLD.x1 - WORLD.x0 + 60, h: T, los: false })
  solid({ x: WORLD.x0 - 20, y: WORLD.y1, w: WORLD.x1 - WORLD.x0 + 60, h: T, los: false })
  solid({ x: WORLD.x1, y: WORLD.y0 - T, w: T, h: WORLD.y1 - WORLD.y0 + 2 * T, los: false })
  // borde oeste del mundo abierto (deja libre la boca del pasillo)
  solid({ x: WORLD.x0 - T, y: WORLD.y0 - T, w: T, h: FY0 - 24 - (WORLD.y0 - T), los: false })
  solid({ x: WORLD.x0 - T, y: FY1 + 24, w: T, h: WORLD.y1 + T - (FY1 + 24), los: false })
  world.add(buildMountainRim())

  // ---------- Constructores de estructuras (ruinas LEGO con distintas alturas y proporciones) ----------
  type DoorSpec = { side: 'n' | 's' | 'e' | 'w'; at: number; width: number }
  let ruinSeed = 401
  function compound(x: number, y: number, w: number, d: number, h: number, pal: Pal, ds: DoorSpec[], th = 24): Rect {
    const r = seeded(ruinSeed++)
    const segs = (len: number, gaps: [number, number][]): [number, number][] => {
      const out: [number, number][] = []
      let cur = 0
      for (const [a, b] of [...gaps].sort((p, q) => p[0] - q[0])) {
        if (a > cur) out.push([cur, a])
        cur = Math.max(cur, b)
      }
      if (cur < len) out.push([cur, len])
      return out
    }
    // subdivide cada tramo de muro en secciones con alturas irregulares/escalonadas de estilo ruina LEGO
    const buildSpan = (sx: number, sy: number, sw: number, sd: number, alongX: boolean): void => {
      const len = alongX ? sw : sd
      if (len <= 110) {
        wall(sx, sy, sw, sd, Math.round(h * (0.82 + r() * 0.42)), pal, { style: 'ruin' })
        return
      }
      const parts = Math.max(2, Math.min(5, Math.floor(len / 95)))
      const step = len / parts
      for (let i = 0; i < parts; i++) {
        const a = i * step
        const segLen = i === parts - 1 ? len - a : step
        const sh = Math.round(h * (0.72 + r() * 0.62))
        if (alongX) wall(sx + a, sy, segLen, sd, sh, pal, { style: 'ruin' })
        else wall(sx, sy + a, sw, segLen, sh, pal, { style: 'ruin' })
      }
    }
    const gapsOf = (side: DoorSpec['side'], len: number): [number, number][] =>
      ds.filter(s => s.side === side).map(s => [s.at * len - s.width / 2, s.at * len + s.width / 2])
    for (const [a, b] of segs(w, gapsOf('n', w))) buildSpan(x + a, y, b - a, th, true)
    for (const [a, b] of segs(w, gapsOf('s', w))) buildSpan(x + a, y + d - th, b - a, th, true)
    for (const [a, b] of segs(d - 2 * th, gapsOf('w', d).map(([p, q]) => [p - th, q - th] as [number, number]))) buildSpan(x, y + th + a, th, b - a, false)
    for (const [a, b] of segs(d - 2 * th, gapsOf('e', d).map(([p, q]) => [p - th, q - th] as [number, number]))) buildSpan(x + w - th, y + th + a, th, b - a, false)
    // torreones/contrafuertes en las esquinas con diferentes alturas
    const corners: [number, number][] = [
      [x - 6, y - 6],
      [x + w - th - 6, y - 6],
      [x - 6, y + d - th - 6],
      [x + w - th - 6, y + d - th - 6],
    ]
    for (const [cx, cy] of corners) {
      if (r() < 0.78) {
        const thH = Math.round(h * (1.18 + r() * 0.55))
        wall(cx, cy, th + 12, th + 12, thH, pal, { solid: false, style: 'ruin' })
      }
    }
    // suelo interior con textura de losas LEGO
    const inFloor = box(w - 2 * th, 2, d - 2 * th, pal.b === PAL.lab.b ? 0x9aa3b2 : 0x3a3f4c, x + w / 2, 0.8, y + d / 2, false)
    inFloor.material = getWallMat(pal.b === PAL.lab.b ? 0x9aa3b2 : 0x3a3f4c, 'ruin')
    world.add(inFloor)
    return { x: x + th, y: y + th, w: w - 2 * th, h: d - 2 * th }
  }
  const crate = (x: number, y: number, w: number, d: number, h: number, color: number): void => {
    wall(x, y, w, d, h, { b: color, s: color + 0x181818 }, { style: 'brick' })
  }
  const site = (id: string, name: string, x: number, y: number, w: number, d: number): void => {
    sites.push({ id, name, x, y, w, d, visited: false })
  }
  const fence = (ax: number, ay: number, bx: number, by: number, phase: number, period = 4.2, onTime = 2.3): void => {
    fences.push({ ax, ay, bx, by, period, onTime, phase })
  }

  /** Construye una Torre de Francotirador escalable por rampa con el arma 'sniper' en la cima. */
  const buildSniperTower = (tx: number, ty: number, pal: Pal): void => {
    const H = 56
    const W = 110
    const RAMP_L = 115
    // 4 pilares de soporte y estructura central
    wall(tx, ty, 24, 24, H, pal, { style: 'ruin' })
    wall(tx + W - 24, ty, 24, 24, H, pal, { style: 'ruin' })
    wall(tx, ty + W - 24, 24, 24, H, pal, { style: 'ruin' })
    wall(tx + W - 24, ty + W - 24, 24, 24, H, pal, { style: 'ruin' })
    // plataforma superior caminable
    wall(tx, ty, W, W, 8, pal, { solid: false, y0: H - 8, style: 'ruin' })
    // parapetos bajos en la cima (dejan vista para disparar y hueco al oeste para la rampa)
    wall(tx, ty, W, 14, 22, pal, { solid: false, y0: H, style: 'ruin' })
    wall(tx, ty + W - 14, W, 14, 22, pal, { solid: false, y0: H, style: 'ruin' })
    wall(tx + W - 14, ty + 14, 14, W - 28, 22, pal, { solid: false, y0: H, style: 'ruin' })
    // antena/mirador alto en una esquina de la torre
    wall(tx + W - 22, ty, 22, 22, 42, PAL.gray, { solid: false, y0: H + 22, style: 'dark' })
    // muros guía a nivel de suelo (obligan a subir por la rampa oeste)
    solid({ x: tx, y: ty, w: W, h: 16, top: H + 20 })
    solid({ x: tx, y: ty + W - 16, w: W, h: 16, top: H + 20 })
    solid({ x: tx + W - 16, y: ty, w: 16, h: W, top: H + 20 })
    // rampa escalonada al oeste (tx - RAMP_L .. tx, ty + 20 .. ty + W - 20)
    const steps = 10
    const sw = RAMP_L / steps
    for (let i = 0; i < steps; i++) {
      const sh = ((i + 1) / steps) * H
      wall(tx - RAMP_L + i * sw, ty + 20, sw + 1, W - 40, sh, PAL.gray, { solid: false, style: 'ruin' })
    }
    // barandillas sólidas de la rampa
    solid({ x: tx - RAMP_L, y: ty + 10, w: RAMP_L, h: 10, top: H })
    solid({ x: tx - RAMP_L, y: ty + W - 20, w: RAMP_L, h: 10, top: H })
    ramps.push({ x0: tx - RAMP_L, x1: tx, y0: ty + 16, y1: ty + W - 16, z0: 0, z1: H })
    ramps.push({ x0: tx, x1: tx + W, y0: ty + 14, y1: ty + W - 14, z0: H, z1: H })
    // francotirador en lo alto de la torre
    pickups.push({ kind: 'sniper', x: tx + W / 2, y: ty + W / 2, z: H })
  }

  // S1 Hangar Oxidado (estructura ancha de altura media-alta)
  site('hangar', 'Hangar Oxidado', 3250, 580, 500, 360)
  compound(3250, 580, 500, 360, 64, PAL.rust, [{ side: 'n', at: 0.5, width: 130 }])
  crate(3370, 730, 64, 44, 48, 0x8c6a2a)
  crate(3550, 730, 64, 44, 54, 0x8c6a2a)
  crate(3460, 815, 54, 54, 46, 0x8c6a2a)
  turrets.push({ x: 3305, y: 895 }, { x: 3695, y: 895 })
  pickups.push({ kind: 'rifle', x: 3500, y: 880 }, { kind: 'medkit', x: 3685, y: 635 }, { kind: 'ammo', x: 3315, y: 635 })
  legos.push({ x: 3300, y: 755, variant: 1 })

  // S2 Cementerio de Naves
  site('wrecks', 'Cementerio de Naves', 4450, -760, 1080, 520)
  wrecks.push({ x: 4660, y: -480, scale: 260, rot: 0.3 }, { x: 5060, y: -400, scale: 310, rot: -0.4 }, { x: 5340, y: -610, scale: 240, rot: 0.9 })
  pickups.push({ kind: 'shotgun', x: 5060, y: -250 }, { kind: 'medkit', x: 4660, y: -300 }, { kind: 'ammo', x: 5360, y: -420 }, { kind: 'ammo', x: 4880, y: -620 })
  legos.push({ x: 5210, y: -735, variant: 3 })
  camps.push({ x: 5000, y: -580, soldier: 7, shooter: 1, spread: 150 })

  // S3 Laboratorio Alfa (complejo alto con torre científica)
  site('lab', 'Laboratorio Alfa', 6100, 560, 600, 450)
  compound(6100, 560, 600, 450, 82, PAL.lab, [{ side: 'n', at: 0.22, width: 110 }, { side: 'e', at: 0.8, width: 110 }])
  fence(6130, 690, 6530, 690, 0)
  fence(6280, 830, 6670, 830, 2.1)
  turrets.push({ x: 6645, y: 615 }, { x: 6150, y: 970 })
  pickups.push({ kind: 'medkit', x: 6210, y: 940 }, { kind: 'ammo', x: 6300, y: 945 }, { kind: 'ammo', x: 6630, y: 750 })
  legos.push({ x: 6650, y: 960, variant: 4 })

  // S4 Taller de Trampas (bajo y alargado)
  site('trap', 'Taller de Trampas', 7650, -780, 560, 390)
  compound(7650, -780, 560, 390, 46, PAL.yellow, [{ side: 's', at: 0.5, width: 130 }])
  for (let i = 0; i < 5; i++) for (let j = 0; j < 2; j++) plates.push({ x: 7700 + i * 102, y: -530 - j * 92, w: 80, h: 70, phase: i * 0.55 + j * 1.1 })
  turrets.push({ x: 7930, y: -730 })
  pickups.push({ kind: 'ammo', x: 7740, y: -725 }, { kind: 'medkit', x: 8120, y: -725 }, { kind: 'ammo', x: 7995, y: -715 })
  legos.push({ x: 7700, y: -730, variant: 6 })

  // S5 Torre de Radio (esbelta y elevada)
  site('tower', 'Torre de Radio', 8950, 680, 390, 390)
  compound(8950, 680, 390, 390, 74, PAL.gray, [{ side: 'n', at: 0.5, width: 115 }])
  const tower = { x: 9145, y: 865 }
  {
    wall(9125, 845, 40, 40, 42, PAL.gray, { style: 'ruin' })
    const mast = box(10, 175, 10, 0xd4d7dc, 9145, 120, 865)
    world.add(mast)
    const dish = cyl(18, 4, 9, 0xe5384b, 14)
    dish.position.set(9145, 205, 865)
    dish.rotation.z = 0.6
    world.add(dish)
  }
  fence(8976, 790, 9230, 790, 1.2)
  turrets.push({ x: 9010, y: 1015 }, { x: 9280, y: 1015 })
  pickups.push({ kind: 'medkit', x: 9145, y: 1010 }, { kind: 'ammo', x: 9020, y: 735 }, { kind: 'medkit', x: 9280, y: 735 })
  legos.push({ x: 9145, y: 910, variant: 7 })

  // S6 Depósito Central (fortaleza pesada de muros altos)
  site('depot', 'Depósito Central', 10200, -880, 660, 450)
  compound(10200, -880, 660, 450, 92, PAL.depot, [{ side: 's', at: 0.25, width: 125 }, { side: 'w', at: 0.5, width: 125 }])
  fence(10470, -854, 10470, -580, 0.6)
  turrets.push({ x: 10810, y: -830 }, { x: 10810, y: -490 })
  pickups.push({ kind: 'medkit', x: 10795, y: -660 }, { kind: 'ammo', x: 10680, y: -835 }, { kind: 'medkit', x: 10260, y: -530 }, { kind: 'ammo', x: 10680, y: -500 })
  legos.push({ x: 10250, y: -830, variant: 0 })
  camps.push({ x: 10680, y: -660, tank: 2, shooter: 3, spread: 100 })

  // ---------- 5 NUEVOS CAMPAMENTOS CON VARIEDAD DE ENEMIGOS, LOOT ALEATORIO Y 2 TORRES DE FRANCOTIRADOR ----------
  const buildEnemyCamp = (
    id: string,
    name: string,
    cx: number,
    cy: number,
    enemies: { soldier: number; shooter: number; tank: number },
    hasSniperTower: boolean,
    pal: Pal,
  ): void => {
    site(id, name, cx - 260, cy - 240, 520, 480)
    camps.push({ x: cx, y: cy, ...enemies, spread: 175, name, visited: false })
    // barricadas de ruina de distintas alturas alrededor del campamento
    wall(cx - 210, cy - 190, 120, 24, 38, pal, { style: 'ruin' })
    wall(cx + 90, cy - 190, 130, 24, 52, pal, { style: 'ruin' })
    wall(cx - 210, cy + 165, 135, 24, 60, pal, { style: 'ruin' })
    wall(cx + 85, cy + 165, 125, 24, 42, pal, { style: 'ruin' })
    crate(cx - 75, cy - 45, 42, 42, 36, 0x7a5c28)
    crate(cx + 45, cy + 40, 48, 38, 44, 0x6b4e22)
    // 4 puntos de loot aleatorio por campamento
    campLoot.push(
      { x: cx - 135, y: cy - 125 },
      { x: cx + 135, y: cy - 125 },
      { x: cx - 135, y: cy + 125 },
      { x: cx + 135, y: cy + 125 },
    )
    if (hasSniperTower) {
      buildSniperTower(cx + 150, cy - 55, pal)
    }
  }

  buildEnemyCamp('camp1', 'Campamento Vigía Norte', 4850, -1720, { soldier: 6, shooter: 3, tank: 1 }, true, PAL.fort)
  buildEnemyCamp('camp2', 'Campamento del Cañón', 6250, 1820, { soldier: 7, shooter: 3, tank: 1 }, false, PAL.rust)
  buildEnemyCamp('camp3', 'Campamento Bastión Este', 9450, -1750, { soldier: 6, shooter: 4, tank: 2 }, true, PAL.depot)
  buildEnemyCamp('camp4', 'Campamento de las Dunas', 9100, 1950, { soldier: 8, shooter: 3, tank: 1 }, false, PAL.yellow)
  buildEnemyCamp('camp5', 'Campamento de Vanguardia', 10950, 1180, { soldier: 7, shooter: 4, tank: 2 }, false, PAL.gray)

  // ---------- Arena de la nave (en el borde este, con textura volcánica/cráter LEGO mejorada) ----------
  site('arena', 'Cráter de la Nave', ARENA.x, ARENA.y, ARENA.w, ARENA.h)
  compound(ARENA.x, ARENA.y, ARENA.w, ARENA.h, 105, PAL.fort, [{ side: 'w', at: 0.5, width: 240 }], 30)
  {
    const arenaTex = groundTexture(256, g => {
      const r = seeded(808)
      g.fillStyle = '#261e34'
      g.fillRect(0, 0, 256, 256)
      for (let i = 0; i < 20; i++) {
        const x = r() * 256
        const y = r() * 256
        const rad = 16 + r() * 44
        const gr = g.createRadialGradient(x, y, 2, x, y, rad)
        gr.addColorStop(0, r() < 0.5 ? 'rgba(95,45,140,.42)' : 'rgba(40,30,55,.5)')
        gr.addColorStop(1, 'rgba(38,30,52,0)')
        g.fillStyle = gr
        g.beginPath()
        g.arc(x, y, rad, 0, 7)
        g.fill()
      }
      // grietas de energía púrpura en el cráter
      g.strokeStyle = 'rgba(185,95,255,.5)'
      g.lineWidth = 1.6
      for (let i = 0; i < 10; i++) {
        let cx = r() * 256
        let cy = r() * 256
        g.beginPath()
        g.moveTo(cx, cy)
        for (let s = 0; s < 4; s++) {
          cx += (r() - 0.5) * 38
          cy += (r() - 0.5) * 38
          g.lineTo(cx, cy)
        }
        g.stroke()
      }
      for (let i = 0; i < 16; i++)
        for (let j = 0; j < 16; j++) {
          g.fillStyle = 'rgba(10,6,18,.45)'
          g.beginPath()
          g.arc(i * 16 + 8, j * 16 + 9.5, 5.6, 0, 7)
          g.fill()
          g.fillStyle = '#392f4d'
          g.beginPath()
          g.arc(i * 16 + 8, j * 16 + 8, 5.3, 0, 7)
          g.fill()
        }
    })
    arenaTex.repeat.set((ARENA.w - 60) / 192, (ARENA.h - 60) / 192)
    const arenaFloor = new THREE.Mesh(
      new THREE.PlaneGeometry(ARENA.w - 60, ARENA.h - 60),
      new THREE.MeshStandardMaterial({ map: arenaTex, bumpMap: arenaTex, bumpScale: 1.3, roughness: 0.72, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }),
    )
    arenaFloor.rotation.x = -Math.PI / 2
    arenaFloor.position.set(ARENA.x + ARENA.w / 2, 1.9, ARENA.y + ARENA.h / 2)
    arenaFloor.receiveShadow = true
    world.add(arenaFloor)
  }
  legos.push({ x: ARENA.x + 955, y: 735, variant: 3 })
  pickups.push({ kind: 'medkit', x: ARENA.x + 100, y: 130 }, { kind: 'medkit', x: ARENA.x + 100, y: 410 }, { kind: 'ammo', x: ARENA.x + 130, y: 270 })
  const shipRect: Rect = { x: SHIP.x - 56, y: SHIP.y - 56, w: 112, h: 112, top: 215 }
  solid(shipRect)
  camps.push({ x: ARENA.x + 350, y: 270, soldier: 6, shooter: 2, spread: 220 })

  // Refugios sueltos con distintas proporciones y alturas
  const shack = (id: string, name: string, x: number, y: number, w: number, d: number, h: number, side: DoorSpec['side'], pal = PAL.rust): void => {
    site(id, name, x, y, w, d)
    compound(x, y, w, d, h, pal, [{ side, at: 0.5, width: 92 }])
  }
  shack('shack1', 'Refugio Abandonado', 4100, 1280, 230, 175, 42, 'n', PAL.rust)
  pickups.push({ kind: 'medkit', x: 4210, y: 1400 }, { kind: 'ammo', x: 4145, y: 1420 })
  shack('shack2', 'Refugio de Carga', 7250, 2100, 270, 200, 68, 'w', PAL.yellow)
  pickups.push({ kind: 'ammo', x: 7360, y: 2200 })
  legos.push({ x: 7470, y: 2255, variant: 5 })
  shack('shack3', 'Refugio Sur', 10550, 1850, 240, 185, 56, 'n', PAL.depot)
  pickups.push({ kind: 'medkit', x: 10660, y: 1970 }, { kind: 'rifle', x: 10600, y: 1990 })

  // Rincones secretos y piezas LEGO distribuidas por todo el nuevo mapa (doble de tamaño)
  const nook = (x: number, y: number, open: 'n' | 's' | 'e' | 'w'): void => {
    const big = (rx: number, ry: number, w: number, d: number, h: number): void => {
      wall(rx, ry, w, d, h, PAL.gray, { style: 'ruin' })
    }
    if (open !== 'n') big(x - 50, y - 62, 100, 30, 62)
    if (open !== 's') big(x - 50, y + 32, 100, 30, 52)
    if (open !== 'w') big(x - 62, y - 50, 30, 100, 68)
    if (open !== 'e') big(x + 32, y - 50, 30, 100, 58)
  }
  nook(3350, -2180, 's')
  legos.push({ x: 3350, y: -2180, variant: 2 })
  nook(12350, -2180, 's')
  legos.push({ x: 12350, y: -2180, variant: 2 })
  nook(3100, 2720, 'e')
  legos.push({ x: 3100, y: 2720, variant: 4 })
  nook(11350, 2720, 'w')
  legos.push({ x: 11350, y: 2720, variant: 6 })

  // Naves siniestradas sueltas repartidas por el mapa ampliado
  wrecks.push(
    { x: 3850, y: 1950, scale: 260, rot: 0.8 },
    { x: 7900, y: 1450, scale: 280, rot: -0.5 },
    { x: 11200, y: 2250, scale: 250, rot: 0.2 },
    { x: 3350, y: -1350, scale: 250, rot: 2 },
    { x: 8550, y: -1750, scale: 300, rot: 0.6 },
    { x: 6600, y: -1850, scale: 270, rot: -1.1 },
    { x: 11400, y: -1650, scale: 260, rot: 1.4 },
  )
  for (const w of wrecks) {
    const hx = 0.5 * w.scale * 0.72
    const hz = 0.45 * w.scale * 0.72
    const ex = Math.abs(Math.cos(w.rot)) * hx + Math.abs(Math.sin(w.rot)) * hz
    const ez = Math.abs(Math.sin(w.rot)) * hx + Math.abs(Math.cos(w.rot)) * hz
    solid({ x: w.x - ex, y: w.y - ez, w: ex * 2, h: ez * 2, top: w.scale * 0.36 })
  }

  // Patrullas de aliens en ruta
  camps.push(
    { x: 3950, y: 380, soldier: 5, spread: 120 },
    { x: 5450, y: 230, soldier: 4, shooter: 2, spread: 130 },
    { x: 6980, y: 180, soldier: 6, tank: 1, spread: 140 },
    { x: 8350, y: 380, soldier: 4, shooter: 3, spread: 130 },
    { x: 9750, y: 200, soldier: 8, tank: 1, spread: 160 },
    { x: 11150, y: 330, soldier: 5, shooter: 4, tank: 2, spread: 180 },
    { x: 3650, y: 1550, soldier: 4, spread: 110 },
    { x: 5500, y: 1250, soldier: 3, shooter: 2, spread: 110 },
    { x: 8300, y: 1650, soldier: 5, tank: 1, spread: 130 },
    { x: 4300, y: -1250, soldier: 4, spread: 110 },
    { x: 7400, y: -1350, soldier: 4, shooter: 2, spread: 120 },
  )

  // Balizas (puntos de control) en las 3 estructuras principales y los 5 campamentos alienígenas
  beacons.push(
    // Estructuras de puzzle
    { x: 3380, y: 510, name: 'Baliza Hangar', buggyX: 3380, buggyY: 410, buggyH: -Math.PI / 2 },
    { x: 6240, y: 520, name: 'Baliza Laboratorio', buggyX: 6240, buggyY: 420, buggyH: -Math.PI / 2 },
    { x: 9145, y: 640, name: 'Baliza Torre', buggyX: 9145, buggyY: 530, buggyH: -Math.PI / 2 },
    // Los 5 campamentos alienígenas
    { x: 4850, y: -1480, name: 'Baliza Vigía Norte', buggyX: 4850, buggyY: -1360, buggyH: Math.PI / 2 },
    { x: 6250, y: 1580, name: 'Baliza del Cañón', buggyX: 6250, buggyY: 1460, buggyH: -Math.PI / 2 },
    { x: 9450, y: -1510, name: 'Baliza Bastión Este', buggyX: 9450, buggyY: -1390, buggyH: Math.PI / 2 },
    { x: 9100, y: 1710, name: 'Baliza de las Dunas', buggyX: 9100, buggyY: 1590, buggyH: -Math.PI / 2 },
    { x: 10950, y: 940, name: 'Baliza de Vanguardia', buggyX: 10950, buggyY: 820, buggyH: -Math.PI / 2 },
  )

  // ---------- Rocas dispersas, placas de dunas escalonadas y guijarros ----------
  {
    const r = seeded(31)
    const keepOut: { x: number; y: number; w: number; h: number }[] = []
    for (const s of sites) keepOut.push({ x: s.x - 160, y: s.y - 160, w: s.w + 320, h: s.d + 320 })
    for (const w of wrecks) keepOut.push({ x: w.x - w.scale * 0.7, y: w.y - w.scale * 0.7, w: w.scale * 1.4, h: w.scale * 1.4 })
    for (const c of camps) keepOut.push({ x: c.x - c.spread - 50, y: c.y - c.spread - 50, w: c.spread * 2 + 100, h: c.spread * 2 + 100 })
    for (const l of legos) keepOut.push({ x: l.x - 90, y: l.y - 90, w: 180, h: 180 })
    for (const b of beacons) keepOut.push({ x: b.x - 120, y: b.y - 120, w: 240, h: 240 })
    keepOut.push({ x: ZC_END, y: ROAD_Y - 400, w: 600, h: 800 })
    keepOut.push({ x: WORLD.x0, y: ROAD_Y - ROAD_W / 2 - 40, w: WORLD.x1 - WORLD.x0, h: ROAD_W + 80 })
    const items: { x: number; y: number; w: number; d: number; h: number; c: number }[] = []
    const colors = [0x5b6372, 0x7b8493, 0xc9702a, 0x6a5a48, 0x8c6a2a]
    let tries = 0
    while (items.length < 340 && tries++ < 7000) {
      const w = 40 + r() * 100
      const d = 34 + r() * 80
      const x = WORLD.x0 + 60 + r() * (WORLD.x1 - WORLD.x0 - 120)
      const y = WORLD.y0 + 60 + r() * (WORLD.y1 - WORLD.y0 - 120)
      if (keepOut.some(k => x + w > k.x && x < k.x + k.w && y + d > k.y && y < k.y + k.h)) continue
      const h = 18 + r() * 72
      const c = colors[Math.floor(r() * colors.length)]
      items.push({ x, y, w, d, h, c })
      solid({ x, y, w, h: d, top: h })
    }
    const rockTex = getWallTex('ruin')
    const inst = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({ color: 0xffffff, map: rockTex, bumpMap: rockTex, bumpScale: 1.4, roughness: 0.86 }),
      items.length,
    )
    const o = new THREE.Object3D()
    const col = new THREE.Color()
    items.forEach((it, i) => {
      o.position.set(it.x + it.w / 2, it.h / 2, it.y + it.d / 2)
      o.scale.set(it.w, it.h, it.d)
      o.updateMatrix()
      inst.setMatrixAt(i, o.matrix)
      inst.setColorAt(i, col.setHex(it.c))
    })
    inst.castShadow = true
    inst.receiveShadow = true
    world.add(inst)

    // Placas de dunas areniscas escalonadas estilo LEGO (desnivel natural en el desierto sin bloquear el buggy)
    const dunePlates: { x: number; y: number; w: number; d: number; h: number; c: number }[] = []
    const duneColors = [0xc2a675, 0xd4ba8a, 0xaf9364, 0xb89c6b]
    let duneTries = 0
    while (dunePlates.length < 110 && duneTries++ < 3000) {
      const w = 130 + r() * 160
      const d = 100 + r() * 130
      const x = WORLD.x0 + 80 + r() * (WORLD.x1 - WORLD.x0 - 260)
      const y = WORLD.y0 + 80 + r() * (WORLD.y1 - WORLD.y0 - 260)
      if (keepOut.some(k => x + w > k.x && x < k.x + k.w && y + d > k.y && y < k.y + k.h)) continue
      const h = 2.5 + r() * 4.5
      const c = duneColors[Math.floor(r() * duneColors.length)]
      dunePlates.push({ x, y, w, d, h, c })
    }
    if (dunePlates.length > 0) {
      const duneInst = new THREE.InstancedMesh(
        new THREE.BoxGeometry(1, 1, 1),
        new THREE.MeshStandardMaterial({ color: 0xffffff, map: rockTex, bumpMap: rockTex, bumpScale: 0.8, roughness: 0.88 }),
        dunePlates.length,
      )
      dunePlates.forEach((it, i) => {
        o.position.set(it.x + it.w / 2, it.h / 2, it.y + it.d / 2)
        o.scale.set(it.w, it.h, it.d)
        o.updateMatrix()
        duneInst.setMatrixAt(i, o.matrix)
        duneInst.setColorAt(i, col.setHex(it.c))
      })
      duneInst.receiveShadow = true
      world.add(duneInst)
    }

    // Pequeñas rocas y montículos de cascotes alrededor de formaciones rocosas
    const pebbles: { x: number; y: number; w: number; d: number; h: number; c: number }[] = []
    const pebColors = [0x50483f, 0x6e6557, 0x857665, 0x423d38]
    for (const it of items.slice(0, 180)) {
      if (r() < 0.65) {
        const pw = 14 + r() * 18
        const pd = 14 + r() * 18
        const ph = 6 + r() * 12
        const px = it.x + (r() - 0.5) * (it.w + 30)
        const py = it.y + (r() - 0.5) * (it.d + 30)
        if (!keepOut.some(k => px + pw > k.x && px < k.x + k.w && py + pd > k.y && py < k.y + k.h)) {
          pebbles.push({ x: px, y: py, w: pw, d: pd, h: ph, c: pebColors[Math.floor(r() * pebColors.length)] })
        }
      }
    }
    if (pebbles.length > 0) {
      const pebInst = new THREE.InstancedMesh(
        new THREE.BoxGeometry(1, 1, 1),
        new THREE.MeshStandardMaterial({ color: 0xffffff, map: rockTex, bumpMap: rockTex, bumpScale: 1.2, roughness: 0.9 }),
        pebbles.length,
      )
      pebbles.forEach((it, i) => {
        o.position.set(it.x + it.w / 2, it.h / 2, it.y + it.d / 2)
        o.scale.set(it.w, it.h, it.d)
        o.updateMatrix()
        pebInst.setMatrixAt(i, o.matrix)
        pebInst.setColorAt(i, col.setHex(it.c))
      })
      pebInst.castShadow = true
      pebInst.receiveShadow = true
      world.add(pebInst)
    }
  }

  buildStuds(world)

  // ---------- Cielo ----------
  const sky = new THREE.Group()
  scene.add(sky)
  const n = 700
  const pos = new Float32Array(n * 3)
  const rr = seeded(99)
  for (let i = 0; i < n; i++) {
    const u = rr() * 6.283
    const v = Math.acos(2 * rr() - 1)
    const R = 5200
    pos[i * 3] = R * Math.sin(v) * Math.cos(u)
    pos[i * 3 + 1] = Math.abs(R * Math.cos(v)) * 0.8 + 60
    pos[i * 3 + 2] = R * Math.sin(v) * Math.sin(u)
  }
  const sg = new THREE.BufferGeometry()
  sg.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  const stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 2.6, sizeAttenuation: false, transparent: true, fog: false }))
  sky.add(stars)
  const pc = document.createElement('canvas')
  pc.width = 512
  pc.height = 256
  const px = pc.getContext('2d')!
  const gr = px.createLinearGradient(0, 0, 0, 256)
  gr.addColorStop(0, '#74c0ff')
  gr.addColorStop(0.5, '#2a6fd0')
  gr.addColorStop(1, '#14357c')
  px.fillStyle = gr
  px.fillRect(0, 0, 512, 256)
  px.fillStyle = 'rgba(255,255,255,.4)'
  const cr = seeded(4)
  for (let i = 0; i < 26; i++) {
    px.beginPath()
    px.ellipse(cr() * 512, cr() * 256, 30 + cr() * 70, 5 + cr() * 10, 0, 0, 7)
    px.fill()
  }
  const planet = new THREE.Mesh(new THREE.SphereGeometry(520, 40, 28), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(pc), fog: false }))
  planet.position.set(3600, 1100, -1900)
  sky.add(planet)
  const halo = new THREE.Mesh(new THREE.SphereGeometry(560, 32, 20), new THREE.MeshBasicMaterial({ color: 0x5ab0ff, transparent: true, opacity: 0.2, side: THREE.BackSide, depthWrite: false, fog: false }))
  halo.position.copy(planet.position)
  sky.add(halo)
  // planeta de destino (el más cercano)
  const dc = document.createElement('canvas')
  dc.width = 256
  dc.height = 128
  const dx = dc.getContext('2d')!
  const dg = dx.createLinearGradient(0, 0, 0, 128)
  dg.addColorStop(0, '#ffb15a')
  dg.addColorStop(1, '#a8421c')
  dx.fillStyle = dg
  dx.fillRect(0, 0, 256, 128)
  dx.fillStyle = 'rgba(255,230,180,.35)'
  for (let i = 0; i < 12; i++) {
    dx.beginPath()
    dx.ellipse(cr() * 256, cr() * 128, 20 + cr() * 40, 4 + cr() * 6, 0, 0, 7)
    dx.fill()
  }
  const dest = new THREE.Mesh(new THREE.SphereGeometry(300, 32, 22), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(dc), fog: false }))
  dest.position.set(-3800, 1500, 2500)
  sky.add(dest)
  const ring = new THREE.Mesh(new THREE.TorusGeometry(430, 14, 4, 60), new THREE.MeshBasicMaterial({ color: 0xffd9a0, fog: false, transparent: true, opacity: 0.7 }))
  ring.position.copy(dest.position)
  ring.rotation.x = 1.25
  sky.add(ring)

  // luna lejana bajo la plataforma
  const moon = new THREE.Group()
  const mm = new THREE.Mesh(new THREE.CircleGeometry(30000, 48), new THREE.MeshStandardMaterial({ color: 0x4a526b, roughness: 1 }))
  mm.rotation.x = -Math.PI / 2
  mm.position.y = -520
  moon.add(mm)
  const mr = seeded(12)
  for (let i = 0; i < 80; i++) {
    const c = new THREE.Mesh(new THREE.CircleGeometry(70 + mr() * 380, 28), new THREE.MeshBasicMaterial({ color: 0x323850 }))
    c.rotation.x = -Math.PI / 2
    c.position.set((mr() - 0.5) * 20000, -519, (mr() - 0.5) * 20000)
    moon.add(c)
  }
  scene.add(moon)

  // referencias a materiales usados en el mundo (evita limpieza prematura)
  void mat
  void basic

  return { grid, sites, pickups, campLoot, heightAt, legos, turrets, fences, plates, camps, beacons, wrecks, covers, endWall, endWallMesh, lever, doors, sky, stars, planet, moon, tower, shipRect }
}
