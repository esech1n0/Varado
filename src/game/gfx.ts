import * as THREE from 'three'
import { seeded } from './geom'
import { skinDef, type SkinId } from './skins'

// ---------- Materiales y piezas ----------
const matCache = new Map<string, THREE.MeshStandardMaterial>()
export function mat(color: number, opts: THREE.MeshStandardMaterialParameters = {}): THREE.MeshStandardMaterial {
  const k = color + JSON.stringify(opts)
  let m = matCache.get(k)
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0, ...opts })
    matCache.set(k, m)
  }
  return m
}

const boxGeo = new THREE.BoxGeometry(1, 1, 1)
export function box(w: number, h: number, d: number, color: number, x = 0, y = 0, z = 0, cast = true): THREE.Mesh {
  const m = new THREE.Mesh(boxGeo, mat(color))
  m.scale.set(w, h, d)
  m.position.set(x, y, z)
  m.castShadow = cast
  m.receiveShadow = true
  return m
}

export function cyl(rt: number, rb: number, h: number, color: number, seg = 12, opts: THREE.MeshStandardMaterialParameters = {}): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat(color, opts))
  m.castShadow = true
  return m
}

export function ball(r: number, color: number, opts: THREE.MeshStandardMaterialParameters = {}, seg = 16): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, seg, Math.max(8, seg - 4)), mat(color, opts))
  m.castShadow = true
  return m
}

export const basic = (color: number, opacity = 1): THREE.MeshBasicMaterial =>
  new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, depthWrite: opacity >= 1 })

// ---------- Tacos instanciados ----------
const studPts = new Map<number, number[][]>()
export function addStuds(color: number, x0: number, z0: number, w: number, d: number, y: number): void {
  let a = studPts.get(color)
  if (!a) studPts.set(color, (a = []))
  for (let x = x0 + 8; x <= x0 + w - 5; x += 16) for (let z = z0 + 8; z <= z0 + d - 5; z += 16) a.push([x, y, z])
}
export function buildStuds(scene: THREE.Object3D): void {
  const g = new THREE.CylinderGeometry(4.4, 4.4, 3, 10)
  const o = new THREE.Object3D()
  for (const [c, pts] of studPts) {
    const m = new THREE.InstancedMesh(g, mat(c), pts.length)
    pts.forEach((p, i) => {
      o.position.set(p[0], p[1] + 1.5, p[2])
      o.updateMatrix()
      m.setMatrixAt(i, o.matrix)
    })
    m.receiveShadow = true
    scene.add(m)
  }
  studPts.clear()
}

// ---------- Armas ----------
export type GunKind = 'pistol' | 'rifle' | 'shotgun' | 'sniper' | 'plasma'

function gbox(w: number, h: number, d: number, color: number, kind: DetailKind, x = 0, y = 0, z = 0, cast = true, opts: THREE.MeshStandardMaterialParameters = {}): THREE.Mesh {
  const m = box(w, h, d, color, x, y, z, cast)
  m.material = detailMat(color, kind, { metalness: kind === 'gunwood' ? 0.05 : 0.38, roughness: kind === 'gunwood' ? 0.65 : 0.42, ...opts })
  return m
}

export function makeGun(kind: GunKind): THREE.Group {
  const g = new THREE.Group()
  if (kind === 'plasma') {
    // granada de plasma: esfera verde brillante con celdas hexagonales, banda metálica y espoleta
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(7, 16, 12),
      detailMat(0x6dff4a, 'gunbody', { emissive: 0x2fbf1a, emissiveIntensity: 0.9, roughness: 0.28, metalness: 0.2 }),
    )
    core.castShadow = true
    const band = new THREE.Mesh(new THREE.TorusGeometry(7.2, 1.4, 6, 18), detailMat(0x1b2a14, 'gungrip', { roughness: 0.5, metalness: 0.4 }))
    band.rotation.x = Math.PI / 2
    const cap = cyl(2.2, 2.6, 3.5, 0x3b414d, 8)
    cap.material = detailMat(0x3b414d, 'gunbarrel', { metalness: 0.5, roughness: 0.35 })
    cap.position.y = 7.6
    const halo = new THREE.Mesh(new THREE.SphereGeometry(10, 12, 8), new THREE.MeshBasicMaterial({ color: 0x6dff4a, transparent: true, opacity: 0.2, depthWrite: false, blending: THREE.AdditiveBlending }))
    g.add(core, band, cap, halo)
    g.userData.muzzle = 0
    return g
  }
  if (kind === 'pistol') {
    g.add(gbox(24, 6, 5, 0x22252b, 'gunbody'))
    g.add(gbox(24, 2.2, 5.2, 0x4c5262, 'gunbarrel', 0, 3, 0, false))
    g.add(gbox(12, 1.4, 5.4, 0xffe27a, 'gunbody', 3, 1.2, 0, false, { emissive: 0x997a10, emissiveIntensity: 0.6 }))
    g.add(gbox(6, 10, 5, 0x22252b, 'gungrip', -5, -7, 0))
    g.add(gbox(10, 4, 4, 0x6a7080, 'gunbarrel', 15, 0, 0))
    g.userData.muzzle = 34
  } else if (kind === 'rifle') {
    g.add(gbox(36, 7, 5, 0x2b2f38, 'gunbody'))
    g.add(gbox(36, 2, 5.2, 0x5a8fb0, 'gunbarrel', 0, 4, 0, false))
    g.add(gbox(14, 1.6, 5.4, 0x8fe3ff, 'gunbody', 4, 1.5, 0, false, { emissive: 0x2a88b0, emissiveIntensity: 0.55 }))
    g.add(gbox(12, 8, 4, 0x3b414d, 'gunbody', -22, -2, 0))
    g.add(gbox(6, 14, 4, 0x22252b, 'gungrip', -2, -9, 0))
    g.add(gbox(8, 10, 5, 0x22252b, 'gungrip', -9, -7, 0))
    g.add(gbox(18, 3, 3, 0x7d8594, 'gunbarrel', 25, 1, 0))
    g.add(gbox(10, 5, 4, 0x8fe3ff, 'gunbody', 2, 7, 0, false, { emissive: 0x2a7090, emissiveIntensity: 0.45 }))
    g.userData.muzzle = 46
  } else if (kind === 'shotgun') {
    g.add(gbox(34, 6, 6, 0x6b3b1e, 'gunwood'))
    g.add(gbox(34, 4, 4, 0x9aa1ad, 'gunbarrel', 6, 5, 0))
    g.add(gbox(34, 4, 4, 0x9aa1ad, 'gunbarrel', 6, 1, 0))
    g.add(gbox(14, 7, 5, 0x4a2a14, 'gunwood', -22, -2, 0))
    g.add(gbox(14, 6, 7, 0xd96b1e, 'gungrip', 14, -4, 0))
    g.add(gbox(6, 9, 5, 0x22252b, 'gungrip', -6, -7, 0))
    g.userData.muzzle = 42
  } else {
    // francotirador de largo alcance (dispara balas de luz)
    g.add(gbox(42, 6.5, 5.2, 0x1e2430, 'gunbody', 0, 0, 0))
    g.add(gbox(38, 2.2, 5.4, 0x4a5568, 'gunbarrel', 2, 3.6, 0, false))
    // cámara de luz energética dorada/cian
    g.add(gbox(20, 2.4, 5.6, 0xfff3a0, 'gunbody', 4, 0.8, 0, false, { emissive: 0xffd24a, emissiveIntensity: 0.9 }))
    // cañón largo estriado y freno de boca
    g.add(gbox(34, 2.8, 2.8, 0x8a93a6, 'gunbarrel', 36, 1.5, 0))
    g.add(gbox(6, 4.2, 4.4, 0x2b313d, 'gunbody', 53, 1.5, 0))
    // culata táctica y empuñadura
    g.add(gbox(16, 7.5, 4.4, 0x2a303c, 'gunbody', -26, -1.5, 0))
    g.add(gbox(4, 9, 4.8, 0x151820, 'gungrip', -34, -2, 0))
    g.add(gbox(6, 10, 4.6, 0x1b1e26, 'gungrip', -10, -7, 0))
    g.add(gbox(7, 11, 4, 0x2c3240, 'gungrip', 1, -8, 0))
    // mira telescópica superior con lentes luminosos
    g.add(gbox(4, 3.5, 3.2, 0x2b313d, 'gunbody', -4, 5.5, 0, false))
    g.add(gbox(4, 3.5, 3.2, 0x2b313d, 'gunbody', 8, 5.5, 0, false))
    const scope = cyl(2.6, 2.6, 22, 0x161a22, 12)
    scope.material = detailMat(0x161a22, 'gunbarrel', { metalness: 0.5, roughness: 0.3 })
    scope.rotation.z = Math.PI / 2
    scope.position.set(2, 8.2, 0)
    const lens = cyl(2.2, 2.2, 1, 0x57f2ff, 12, { emissive: 0x35c0ff, emissiveIntensity: 0.8 })
    lens.rotation.z = Math.PI / 2
    lens.position.set(13.2, 8.2, 0)
    g.add(scope, lens)
    g.userData.muzzle = 58
  }
  return g
}

// ---------- Texturas procedurales del astronauta y armas ----------
// Mapas "de multiplicación" (blanco = sin cambio): añaden costuras, desgaste, suciedad y relieve
// sin alterar los colores ni las formas originales del personaje.
type DetailKind = 'suit' | 'suitworn' | 'pack' | 'trim' | 'boot' | 'helmet' | 'gunbody' | 'gungrip' | 'gunwood' | 'gunbarrel'
const detailCache = new Map<DetailKind, THREE.CanvasTexture>()
const detailMats = new Map<string, THREE.MeshStandardMaterial>()

function detailTex(kind: DetailKind): THREE.CanvasTexture {
  const hit = detailCache.get(kind)
  if (hit) return hit
  const S = 128
  const c = document.createElement('canvas')
  c.width = c.height = S
  const g = c.getContext('2d')!
  const r = seeded(kind.length * 977 + kind.charCodeAt(0))
  g.fillStyle = '#fff'
  g.fillRect(0, 0, S, S)
  // grano fino
  for (let i = 0; i < 1400; i++) {
    g.fillStyle = `rgba(${r() < 0.5 ? '40,40,50' : '255,255,255'},${0.03 + r() * 0.08})`
    g.fillRect(r() * S, r() * S, 1 + r() * 2, 1 + r() * 2)
  }
  const line = (x0: number, y0: number, x1: number, y1: number, col: string, w: number, dash?: number[]): void => {
    g.strokeStyle = col
    g.lineWidth = w
    g.setLineDash(dash ?? [])
    g.beginPath()
    g.moveTo(x0, y0)
    g.lineTo(x1, y1)
    g.stroke()
  }
  if (kind === 'suit') {
    // costuras con puntadas y pliegues de tela
    g.strokeStyle = 'rgba(95,100,115,.55)'
    g.lineWidth = 1.6
    g.setLineDash([4, 4])
    g.strokeRect(9, 9, S - 18, S - 18)
    line(S / 2, 9, S / 2, S - 9, 'rgba(95,100,115,.4)', 1.4, [4, 4])
    g.setLineDash([])
    for (let i = 0; i < 9; i++) {
      const y = 14 + r() * (S - 28)
      g.strokeStyle = `rgba(110,115,130,${0.12 + r() * 0.12})`
      g.lineWidth = 1 + r() * 2
      g.beginPath()
      g.moveTo(r() * 30, y)
      g.bezierCurveTo(S * 0.3, y + (r() - 0.5) * 16, S * 0.6, y + (r() - 0.5) * 16, S - r() * 30, y + (r() - 0.5) * 10)
      g.stroke()
    }
    for (let i = 0; i < 6; i++) line(r() * S, r() * S, r() * S, r() * S, `rgba(120,120,130,${0.2 + r() * 0.15})`, 0.8)
    const dirt = g.createLinearGradient(0, S * 0.55, 0, S)
    dirt.addColorStop(0, 'rgba(160,135,95,0)')
    dirt.addColorStop(1, 'rgba(160,135,95,.28)')
    g.fillStyle = dirt
    g.fillRect(0, 0, S, S)
    for (let i = 0; i < 7; i++) {
      g.fillStyle = `rgba(150,125,90,${0.1 + r() * 0.14})`
      g.beginPath()
      g.arc(r() * S, r() * S, 3 + r() * 9, 0, 7)
      g.fill()
    }
  } else if (kind === 'suitworn') {
    // traje veterano: mugre pesada, quemaduras, desgarros con el aislante a la vista y remiendos cosidos
    for (let i = 0; i < 26; i++) {
      g.fillStyle = `rgba(${r() < 0.5 ? '120,95,60' : '70,60,50'},${0.12 + r() * 0.2})`
      g.beginPath()
      g.ellipse(r() * S, r() * S, 5 + r() * 18, 3 + r() * 10, r() * 3, 0, 7)
      g.fill()
    }
    for (let i = 0; i < 3; i++) {
      const x = 20 + r() * (S - 40)
      const y = 20 + r() * (S - 40)
      const sc = g.createRadialGradient(x, y, 0, x, y, 16 + r() * 10)
      sc.addColorStop(0, 'rgba(20,16,14,.75)')
      sc.addColorStop(1, 'rgba(60,45,30,0)')
      g.fillStyle = sc
      g.fillRect(0, 0, S, S)
    }
    for (let i = 0; i < 5; i++) {
      // desgarro dentado
      let x = 12 + r() * (S - 24)
      let y = 12 + r() * (S - 50)
      const pts: [number, number][] = [[x, y]]
      const n = 5 + Math.floor(r() * 4)
      for (let k = 0; k < n; k++) {
        x += (r() - 0.5) * 12
        y += 4 + r() * 6
        pts.push([x, y])
      }
      const path = (dx: number): void => {
        g.beginPath()
        pts.forEach(([px, py], k) => (k ? g.lineTo(px + (k % 2 ? dx : -dx), py) : g.moveTo(px, py)))
      }
      g.setLineDash([])
      path(2.2)
      g.strokeStyle = 'rgba(205,120,50,.8)'
      g.lineWidth = 5
      g.stroke()
      path(1.2)
      g.strokeStyle = 'rgba(25,20,22,.92)'
      g.lineWidth = 2.6
      g.stroke()
    }
    // remiendo cosido
    g.fillStyle = 'rgba(120,125,135,.55)'
    g.fillRect(S * 0.56, S * 0.58, 30, 22)
    g.strokeStyle = 'rgba(40,40,48,.8)'
    g.lineWidth = 1.4
    g.setLineDash([3, 3])
    g.strokeRect(S * 0.56 + 2, S * 0.58 + 2, 26, 18)
    g.setLineDash([])
    for (let i = 0; i < 14; i++) line(r() * S, r() * S, r() * S, r() * S, `rgba(90,85,80,${0.25 + r() * 0.25})`, 0.9)
  } else if (kind === 'pack') {
    for (let i = 0; i < 7; i++) line(14, 18 + i * 14, S - 14, 18 + i * 14, 'rgba(30,32,40,.5)', 3)
    for (const [x, y] of [[8, 8], [S - 8, 8], [8, S - 8], [S - 8, S - 8]]) {
      g.fillStyle = 'rgba(40,42,52,.6)'
      g.beginPath()
      g.arc(x, y, 3.2, 0, 7)
      g.fill()
    }
    for (let i = 0; i < 10; i++) line(r() * S, r() * S, r() * S, r() * S, 'rgba(210,214,222,.45)', 0.9)
  } else if (kind === 'trim') {
    for (let i = 0; i < 12; i++) {
      const x = r() * S
      const y = r() * S
      line(x, y, x + (r() - 0.5) * 30, y + (r() - 0.5) * 30, `rgba(${r() < 0.5 ? '110,80,10' : '255,255,230'},${0.25 + r() * 0.25})`, 1)
    }
  } else if (kind === 'boot') {
    for (let i = 0; i < 10; i++) line(0, 8 + i * 12, S, 8 + i * 12, 'rgba(60,64,75,.4)', 3)
    for (let i = 0; i < 40; i++) {
      g.fillStyle = 'rgba(120,100,70,.18)'
      g.fillRect(r() * S, r() * S, 4 + r() * 10, 2 + r() * 4)
    }
  } else if (kind === 'gunbody') {
    // paneles mecánicos, ranuras de ventilación, remaches y desgaste en bordes
    g.strokeStyle = 'rgba(20,24,32,.65)'
    g.lineWidth = 2
    g.strokeRect(6, 6, S - 12, S - 12)
    line(6, S * 0.48, S - 6, S * 0.48, 'rgba(25,30,40,.6)', 2)
    line(S * 0.35, 6, S * 0.35, S * 0.48, 'rgba(25,30,40,.5)', 1.6)
    // ranuras de refrigeración
    for (let i = 0; i < 6; i++) {
      g.fillStyle = 'rgba(15,18,25,.7)'
      g.fillRect(16 + i * 15, 18, 9, 20)
      g.fillStyle = 'rgba(255,255,255,.25)'
      g.fillRect(16 + i * 15, 38, 9, 2)
    }
    // remaches y tornillos
    for (const [x, y] of [[12, 12], [S - 12, 12], [12, S - 12], [S - 12, S - 12], [S * 0.5, S * 0.72]]) {
      g.fillStyle = 'rgba(20,22,28,.75)'
      g.beginPath()
      g.arc(x, y, 3.2, 0, 7)
      g.fill()
    }
    // rayones metálicos
    for (let i = 0; i < 18; i++) line(r() * S, r() * S, r() * S, r() * S, 'rgba(255,255,255,.35)', 0.9)
  } else if (kind === 'gungrip') {
    // moleteado antideslizante en rombos (knurling)
    for (let i = -S; i < S * 2; i += 10) {
      line(i, 0, i + S, S, 'rgba(20,22,28,.55)', 1.5)
      line(i + S, 0, i, S, 'rgba(20,22,28,.55)', 1.5)
    }
    g.strokeStyle = 'rgba(255,255,255,.2)'
    g.lineWidth = 2
    g.strokeRect(4, 4, S - 8, S - 8)
  } else if (kind === 'gunwood') {
    // vetas de madera desgastada
    for (let y = 0; y < S; y += 4) {
      const a = 0.14 + (y % 12 === 0 ? 0.22 : 0)
      line(0, y, S, y + (r() - 0.5) * 6, `rgba(35,18,6,${a})`, 1.8)
    }
    for (let i = 0; i < 10; i++) line(r() * S, r() * S, r() * S, r() * S, 'rgba(255,230,190,.2)', 1)
  } else if (kind === 'gunbarrel') {
    // estrías longitudinales y anillos térmicos del cañón
    for (let y = 8; y < S; y += 14) {
      line(0, y, S, y, 'rgba(20,25,35,.55)', 2.4)
      line(0, y + 3, S, y + 3, 'rgba(255,255,255,.35)', 1.2)
    }
    for (let x = 16; x < S; x += 24) line(x, 0, x, S, 'rgba(30,35,45,.45)', 2)
  } else {
    // casco: arañazos finos y manchas de roce
    for (let i = 0; i < 16; i++) {
      const x = r() * S
      const y = r() * S
      g.strokeStyle = `rgba(110,115,130,${0.2 + r() * 0.2})`
      g.lineWidth = 0.8
      g.beginPath()
      g.arc(x, y, 6 + r() * 22, r() * 6, r() * 6 + 1.2)
      g.stroke()
    }
    for (let i = 0; i < 5; i++) {
      g.fillStyle = `rgba(150,130,100,${0.08 + r() * 0.1})`
      g.beginPath()
      g.ellipse(r() * S, r() * S, 8 + r() * 14, 4 + r() * 8, r() * 3, 0, 7)
      g.fill()
    }
  }
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  detailCache.set(kind, t)
  return t
}

function detailMat(color: number, kind: DetailKind, opts: THREE.MeshStandardMaterialParameters = {}): THREE.MeshStandardMaterial {
  const k = `${color}|${kind}|${JSON.stringify(opts)}`
  let m = detailMats.get(k)
  if (!m) {
    const t = detailTex(kind)
    m = new THREE.MeshStandardMaterial({ color, map: t, bumpMap: t, bumpScale: 0.9, roughness: 0.62, metalness: 0, ...opts })
    detailMats.set(k, m)
  }
  return m
}

// ---------- Astronauta (jugador) ----------
export type PlayerRig = {
  legs: THREE.Group[]
  armR: THREE.Group
  armL: THREE.Group
  handR: THREE.Group
  handL: THREE.Group
  headGroup: THREE.Group
  guns: Record<Exclude<GunKind, 'plasma'>, THREE.Group>
  torso: THREE.Group
  weaponMount: THREE.Group
}

/** Entorno procedural (equirectangular) que refleja el visor: cielo oscuro, horizonte brillante y suelo anaranjado. */
let visorEnv: THREE.CanvasTexture | null = null
function visorEnvMap(): THREE.CanvasTexture {
  if (visorEnv) return visorEnv
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 128
  const g = c.getContext('2d')!
  const sky = g.createLinearGradient(0, 0, 0, 128)
  sky.addColorStop(0, '#0a0d24')
  sky.addColorStop(0.36, '#3b4a86')
  sky.addColorStop(0.49, '#ffe9c2')
  sky.addColorStop(0.53, '#ff9a4a')
  sky.addColorStop(0.7, '#8a4a20')
  sky.addColorStop(1, '#241208')
  g.fillStyle = sky
  g.fillRect(0, 0, 256, 128)
  // soles / focos que dan los brillos del visor
  for (const [x, y, r, a] of [[70, 34, 26, 1], [190, 46, 16, 0.8], [130, 20, 10, 0.6]]) {
    const s = g.createRadialGradient(x, y, 0, x, y, r)
    s.addColorStop(0, `rgba(255,255,255,${a})`)
    s.addColorStop(0.35, `rgba(255,236,190,${a * 0.6})`)
    s.addColorStop(1, 'rgba(255,220,160,0)')
    g.fillStyle = s
    g.fillRect(x - r, y - r, r * 2, r * 2)
  }
  const t = new THREE.CanvasTexture(c)
  t.mapping = THREE.EquirectangularReflectionMapping
  t.colorSpace = THREE.SRGBColorSpace
  visorEnv = t
  return t
}

let visorMatCache: THREE.MeshStandardMaterial | null = null
function visorMat(): THREE.MeshStandardMaterial {
  visorMatCache ??= new THREE.MeshStandardMaterial({
    color: 0xc4560a,
    metalness: 0.92,
    roughness: 0.1,
    envMap: visorEnvMap(),
    envMapIntensity: 1.35,
    emissive: 0x4a1a00,
    emissiveIntensity: 0.75,
  })
  return visorMatCache
}

/**
 * Astronauta con traje presurizado: casco con visor naranja oscuro reflectante que cubre el rostro,
 * mochila de soporte vital, unidad de control en el pecho, anillos de unión y guantes/botas.
 * Mantiene los mismos pivotes que usa la animación (hombros, manos, piernas, cabeza).
 */
export function makePlayer(skinId: SkinId = 'white'): THREE.Group {
  const sk = skinDef(skinId)
  const g = new THREE.Group()
  const armor = sk.style === 'armor'
  const worn = sk.style === 'worn'
  const suitKind: DetailKind = worn ? 'suitworn' : 'suit'
  const under = 0x23272b
  const suitM = detailMat(sk.suit, suitKind)
  // en la armadura, las extremidades son un mono oscuro y las placas llevan el color
  const limbM = armor ? detailMat(under, 'boot') : suitM
  const jointM = detailMat(sk.joint, 'boot')
  const accentM = detailMat(sk.accent, 'trim')
  const packM = detailMat(sk.pack, 'pack')
  const gloveM = detailMat(sk.glove, 'boot')
  const helmM = detailMat(sk.helmet, worn ? 'suitworn' : 'helmet', { roughness: 0.38 })
  const metalM = mat(sk.style === 'outline' ? 0x8d939f : 0xc9ced8, { metalness: 0.75, roughness: 0.3 })
  const darkM = mat(0x16181d, { roughness: 0.7 })
  const hullM = sk.style === 'outline' ? new THREE.MeshBasicMaterial({ color: 0x9aa0ab, side: THREE.BackSide }) : null

  /** Añade una pieza; con el aspecto de contornos le pone además un casco invertido gris alrededor. */
  const put = (parent: THREE.Object3D, geo: THREE.BufferGeometry, material: THREE.Material, x = 0, y = 0, z = 0, hull = true): THREE.Mesh => {
    const m = new THREE.Mesh(geo, material)
    m.position.set(x, y, z)
    m.castShadow = true
    m.receiveShadow = true
    parent.add(m)
    if (hullM && hull) {
      const h = new THREE.Mesh(geo, hullM)
      h.scale.setScalar(1.09)
      m.add(h)
    }
    return m
  }
  const B = (w: number, h: number, d: number): THREE.BoxGeometry => new THREE.BoxGeometry(w, h, d)
  const C = (rt: number, rb: number, h: number, seg = 14): THREE.CylinderGeometry => new THREE.CylinderGeometry(rt, rb, h, seg)
  const S = (r: number, seg = 16): THREE.SphereGeometry => new THREE.SphereGeometry(r, seg, Math.max(8, seg - 4))
  const light = (color: number): THREE.MeshStandardMaterial => mat(color, { emissive: color, emissiveIntensity: 1.1 })

  // ----- Piernas -----
  const legs: THREE.Group[] = []
  for (const s of [-1, 1]) {
    const lg = new THREE.Group()
    lg.position.set(0, 14, s * 5)
    put(lg, C(4.5, 4.3, 12.5, 12), limbM, 0, -5.4, 0)
    put(lg, C(4.75, 4.75, 2.2, 12), jointM, 0, -5.6, 0, false) // rodillera
    put(lg, C(4.7, 4.7, 1.4, 12), metalM, 0, -10.6, 0, false) // anillo de la bota
    put(lg, B(11, 4, 9), gloveM, 1.3, -12.8, 0)
    put(lg, B(11.8, 1.5, 9.6), darkM, 1.3, -14.6, 0, false) // suela
    if (armor) {
      put(lg, B(9.4, 5.2, 9.6), suitM, 0.4, -2.6, 0)
      put(lg, B(9.2, 4.4, 9.4), suitM, 0.6, -8.6, 0)
    }
    if (worn && s === 1) put(lg, B(0.5, 5, 3.2), darkM, 4.5, -3.4, 0.6, false).rotation.x = 0.35 // desgarro en el muslo
    g.add(lg)
    legs.push(lg)
  }

  // ----- Torso -----
  const torso = new THREE.Group()
  g.add(torso)
  const oval = (m: THREE.Mesh): THREE.Mesh => {
    m.scale.set(0.72, m.scale.y, 1.12)
    return m
  }
  oval(put(torso, C(8.6, 8.2, 6, 18), limbM, 0, 16.5, 0)) // cadera
  oval(put(torso, C(9.7, 9.7, 2.2, 18), accentM, 0, 19.8, 0, false)) // cinturón
  oval(put(torso, C(9.4, 9.2, 15.5, 18), suitM, 0, 28, 0)) // tronco
  const shoulders = oval(put(torso, S(9.4, 18), suitM, 0, 35.6, 0))
  shoulders.scale.y = 0.42
  put(torso, C(9.2, 9.2, 2.2, 18), metalM, 0, 36.4, 0, false) // anillo del cuello

  // unidad de control del pecho con indicadores luminosos
  put(torso, B(2.8, 7, 9.5), packM, 6.7, 28.4, 0)
  put(torso, B(0.7, 1.3, 1.3), light(0xff4040), 8.3, 30.2, -2.8, false)
  put(torso, B(0.7, 1.3, 1.3), light(0x40ff80), 8.3, 30.2, 0, false)
  put(torso, B(0.7, 1.3, 1.3), light(0x57f2ff), 8.3, 30.2, 2.8, false)
  put(torso, B(0.6, 2, 6.4), darkM, 8.3, 27, 0, false)
  // franja del color del traje cruzando el pecho
  if (!armor) put(torso, B(0.5, 1.6, 15), accentM, 6.6, 33.2, 0, false)

  // mochila de soporte vital (PLSS) con tanques, placa y antena
  put(torso, B(8, 19, 15.5), packM, -10.6, 28.6, 0)
  put(torso, B(8.3, 2, 15.8), accentM, -10.6, 36.2, 0, false)
  for (const s of [-1, 1]) {
    put(torso, C(2.3, 2.3, 13, 10), metalM, -15.2, 27.4, s * 4.2, false)
    // manguera de la mochila al casco
    const hose = put(torso, new THREE.TorusGeometry(3.6, 0.85, 6, 12, Math.PI), jointM, -12.6, 39.2, s * 4.4, false)
    hose.castShadow = false
  }
  put(torso, C(0.35, 0.35, 11, 5), darkM, -12.6, 43.5, -6.4, false)
  put(torso, S(0.9, 8), light(0xff3b4a), -12.6, 49.2, -6.4, false)

  if (armor) {
    put(torso, B(3.2, 11.5, 18), suitM, 5.6, 29.4, 0) // peto
    put(torso, B(1.2, 2, 12), accentM, 7.4, 33.6, 0, false)
  }
  if (worn) {
    // jirones, parches de cinta y una tira de tela colgando
    put(torso, B(0.5, 6.5, 3), darkM, 6.2, 24, -5.4, false).rotation.x = -0.4
    put(torso, B(0.6, 3, 5), mat(0x7d8087, { roughness: 0.8 }), 6.5, 33, 5.2, false).rotation.x = 0.25
    put(torso, B(0.5, 8, 2.4), suitM, -14.9, 17.5, 5.5, false).rotation.z = 0.25
  }

  // ----- Brazos (el hombro es el pivote; el brazo se extiende hacia +X) -----
  const makeArm = (side: number): { arm: THREE.Group; hand: THREE.Group } => {
    const arm = new THREE.Group()
    arm.position.set(0, 28.5, side * 10.5)
    put(arm, S(3.7, 12), suitM)
    const sleeve = put(arm, new THREE.CapsuleGeometry(2.7, 9.4, 4, 10), limbM, 6.6, 0, 0)
    sleeve.rotation.z = Math.PI / 2
    const band = put(arm, C(2.98, 2.98, 1.7, 10), accentM, 3.7, 0, 0, false)
    band.rotation.z = Math.PI / 2
    const elbow = put(arm, C(3.05, 3.05, 2.3, 10), jointM, 7.4, 0, 0, false)
    elbow.rotation.z = Math.PI / 2
    if (armor) {
      const pauldron = put(arm, S(4.9, 12), suitM, 0.4, 0.8, side * 0.6)
      pauldron.scale.set(1.05, 0.82, 1)
      put(arm, B(4.6, 6, 6), suitM, 10.6, 0, 0)
    }
    if (worn && side === -1) {
      const tape = put(arm, C(3.0, 3.0, 2, 10), mat(0x7d8087, { roughness: 0.8 }), 10.6, 0, 0, false)
      tape.rotation.z = Math.PI / 2
    }
    const hand = new THREE.Group()
    hand.position.set(13.8, 0, 0)
    const wrist = put(hand, C(2.9, 2.9, 1.5, 10), metalM, -0.9, 0, 0, false)
    wrist.rotation.z = Math.PI / 2
    const glove = put(hand, S(2.9, 10), gloveM, 1.5, 0, 0)
    glove.scale.set(1.15, 0.95, 1)
    put(hand, S(1.15, 8), gloveM, 1.6, 1.6, -side * 1.9, false) // pulgar
    arm.add(hand)
    torso.add(arm)
    return { arm, hand }
  }
  const { arm: armR, hand: handR } = makeArm(1)
  const { arm: armL, hand: handL } = makeArm(-1)

  // Soporte de armas montado en torso
  const weaponMount = new THREE.Group()
  weaponMount.position.set(14, 28, 0)
  torso.add(weaponMount)

  const guns = { pistol: makeGun('pistol'), rifle: makeGun('rifle'), shotgun: makeGun('shotgun'), sniper: makeGun('sniper') }
  guns.pistol.position.set(5, 7, 0)
  guns.rifle.position.set(2, 9, 0)
  guns.shotgun.position.set(6, 7, 0)
  guns.sniper.position.set(10, 7, 0)

  for (const k of Object.keys(guns) as Exclude<GunKind, 'plasma'>[]) {
    guns[k].visible = false
    weaponMount.add(guns[k])
  }

  // ----- Casco con visor naranja oscuro reflectante (tapa por completo el rostro) -----
  const headGroup = new THREE.Group()
  headGroup.position.set(0, 44, 0)
  const shell = put(headGroup, S(11, 24), helmM)
  shell.scale.set(1, 1.05, 1)

  const visorPos = new THREE.Vector3(3.5, 0.3, 0)
  const visorScale = new THREE.Vector3(1, 0.93, 1.06)
  const vis = put(headGroup, new THREE.SphereGeometry(9.2, 28, 20), visorMat(), visorPos.x, visorPos.y, visorPos.z, false)
  vis.scale.copy(visorScale)
  vis.castShadow = false

  // reflejos: dos destellos claros pegados a la superficie del visor
  const glintMat = (opacity: number): THREE.MeshBasicMaterial =>
    new THREE.MeshBasicMaterial({ color: 0xfff1d8, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending })
  const glint = (phi0: number, phiLen: number, th0: number, thLen: number, opacity: number): void => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(9.32, 10, 6, phi0, phiLen, th0, thLen), glintMat(opacity))
    m.position.copy(visorPos)
    m.scale.copy(visorScale)
    headGroup.add(m)
  }
  glint(Math.PI + 0.22, 0.42, 0.98, 0.3, 0.62)
  glint(Math.PI + 0.7, 0.12, 1.02, 0.22, 0.5)
  glint(Math.PI - 0.62, 0.3, 1.72, 0.16, 0.28)

  // marco del visor, protectores laterales y cresta superior
  const rim = put(headGroup, new THREE.TorusGeometry(8.55, 0.95, 8, 28), jointM, 7.0, 0.3, 0, false)
  rim.rotation.y = Math.PI / 2
  rim.scale.set(1.06, 0.95, 1)
  for (const s of [-1, 1]) {
    const ear = put(headGroup, C(2.7, 2.7, 1.8, 12), accentM, 0, 0, s * 10.6, false)
    ear.rotation.x = Math.PI / 2
  }
  put(headGroup, B(7, 1.6, 3.2), packM, 0.5, 11.2, 0, false)
  put(headGroup, B(1.6, 1.2, 2.2), light(0xfff3c0), 4.6, 11, 0, false) // foco frontal
  if (armor) put(headGroup, B(12, 2.2, 4.2), suitM, -1, 11.4, 0)

  torso.add(headGroup)

  g.userData = { legs, armR, armL, handR, handL, headGroup, guns, torso, weaponMount } satisfies PlayerRig
  return g
}

// ---------- Buggy ----------
export function makeBuggy(): THREE.Group {
  const g = new THREE.Group()
  const wh = 0xf1f2ee
  g.add(box(70, 9, 34, wh, 0, 14, 0))
  g.add(box(26, 8, 30, wh, 28, 19, 0))
  g.add(box(8, 4, 30, 0xd4d7dc, -34, 19, 0))
  g.add(box(14, 16, 22, 0x3a3f49, -10, 25, 0))
  g.add(box(30, 3, 38, 0xc8222e, 0, 8.5, 0))
  const post = cyl(1.5, 1.5, 14, 0x22252b, 6)
  post.position.set(8, 26, 0)
  post.rotation.z = 0.6
  g.add(post)
  const sw = new THREE.Mesh(new THREE.TorusGeometry(6, 1.4, 6, 14), mat(0x22252b))
  sw.position.set(11, 32, 0)
  sw.rotation.y = Math.PI / 2
  sw.rotation.x = 0.6
  g.add(sw)
  for (const s of [-1, 1]) {
    const hl = new THREE.Mesh(boxGeo, basic(0xffe34a))
    hl.scale.set(5, 6, 8)
    hl.position.set(42, 20, s * 10)
    g.add(hl)
  }
  const wheels: THREE.Group[] = []
  for (const x of [-25, 26]) {
    for (const s of [-1, 1]) {
      const wg = new THREE.Group()
      wg.position.set(x, 11, s * 22)
      const tire = cyl(11, 11, 9, 0x15161a, 16)
      tire.rotation.x = Math.PI / 2
      wg.add(tire)
      const hub = cyl(5, 5, 10, 0x8c919c, 10)
      hub.rotation.x = Math.PI / 2
      wg.add(hub)
      g.add(wg)
      wheels.push(wg)
    }
  }
  g.userData = { wheels }
  return g
}

// ---------- Impostor del pasillo (Among Us azul, jefe del primer tramo) ----------
export type ImpostorRig = { body: THREE.Group; mouth: THREE.Group; tongue: THREE.Mesh; tip: THREE.Mesh; pud: THREE.Mesh; bodyMat: THREE.MeshStandardMaterial; dkMat: THREE.MeshStandardMaterial }
export function makeImpostor(): THREE.Group {
  const g = new THREE.Group()
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x2a78f0, roughness: 0.35, emissive: 0x000000 })
  const dkMat = new THREE.MeshStandardMaterial({ color: 0x1646a8, roughness: 0.4, emissive: 0x000000 })
  const body = new THREE.Group()
  g.add(body)
  const cy = new THREE.Mesh(new THREE.CylinderGeometry(22, 22, 34, 24), bodyMat)
  cy.position.y = 22
  cy.castShadow = true
  body.add(cy)
  const dome = new THREE.Mesh(new THREE.SphereGeometry(22, 24, 16), bodyMat)
  dome.position.y = 39
  dome.scale.y = 0.85
  dome.castShadow = true
  body.add(dome)
  const pack = new THREE.Mesh(new THREE.BoxGeometry(12, 28, 26), dkMat)
  pack.position.set(-24, 28, 0)
  pack.castShadow = true
  body.add(pack)
  for (const s of [-1, 1]) {
    const lg = new THREE.Mesh(new THREE.CylinderGeometry(8, 8, 10, 14), dkMat)
    lg.position.set(0, 5, s * 11)
    body.add(lg)
  }
  const visor = new THREE.Mesh(new THREE.SphereGeometry(10, 16, 12), new THREE.MeshStandardMaterial({ color: 0xcdeeff, emissive: 0x2a5a88, roughness: 0.1 }))
  visor.position.set(16, 42, 0)
  visor.scale.set(0.55, 0.8, 1.5)
  body.add(visor)
  const mouth = new THREE.Group()
  mouth.position.set(19, 24, 0)
  body.add(mouth)
  const cav = new THREE.Mesh(new THREE.SphereGeometry(12, 18, 12), new THREE.MeshBasicMaterial({ color: 0x3e0715 }))
  cav.scale.set(0.4, 1, 1.25)
  mouth.add(cav)
  const toothMat = new THREE.MeshBasicMaterial({ color: 0xffffff })
  const tg = new THREE.ConeGeometry(2.4, 7, 6)
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * 6.283
    const py = Math.cos(a) * 11
    const pz = Math.sin(a) * 14
    const t = new THREE.Mesh(tg, toothMat)
    t.position.set(2, py, pz)
    t.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, -py, -pz).normalize())
    mouth.add(t)
  }
  const tgeo = new THREE.CylinderGeometry(2.6, 2.6, 1, 8)
  tgeo.rotateZ(Math.PI / 2)
  tgeo.translate(0.5, 0, 0)
  const tongue = new THREE.Mesh(tgeo, new THREE.MeshBasicMaterial({ color: 0x38b24a }))
  tongue.position.set(2, -3, 0)
  mouth.add(tongue)
  const tip = new THREE.Mesh(new THREE.SphereGeometry(3.4, 10, 8), new THREE.MeshBasicMaterial({ color: 0xd02a4a }))
  tip.position.set(2, -3, 0)
  mouth.add(tip)
  const pud = new THREE.Mesh(new THREE.CylinderGeometry(42, 46, 2.5, 28), new THREE.MeshStandardMaterial({ color: 0x2f86ff, roughness: 0.15, emissive: 0x0a2a66, transparent: true }))
  pud.position.y = 1.5
  pud.scale.z = 0.62
  pud.receiveShadow = true
  g.add(pud)
  g.userData = { body, mouth, tongue, tip, pud, bodyMat, dkMat } satisfies ImpostorRig
  return g
}

// ---------- Marcadores del mundo ----------
export function makeMedkit(): THREE.Group {
  const g = new THREE.Group()
  g.add(box(20, 13, 15, 0xf4f4f0, 0, 7, 0))
  g.add(box(14, 4, 5, 0xe5384b, 0, 14.5, 0, false))
  g.add(box(5, 4, 14, 0xe5384b, 0, 14.5, 0, false))
  g.add(box(21, 3, 16, 0xe5384b, 0, 2, 0, false))
  return g
}
export function makeAmmo(): THREE.Group {
  const g = new THREE.Group()
  g.add(box(22, 12, 14, 0x4b5a2a, 0, 6, 0))
  g.add(box(23, 3, 15, 0xffc61a, 0, 8, 0, false))
  for (let i = -1; i <= 1; i++) g.add(box(4, 7, 4, 0xe8c36a, i * 6, 15, 0, false))
  return g
}
export function makeBone(): THREE.Group {
  const g = new THREE.Group()
  const b = cyl(2.6, 2.6, 22, 0xf4f1e6, 8)
  b.rotation.z = Math.PI / 2
  g.add(b)
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const k = ball(3.6, 0xf4f1e6, {}, 8)
    k.position.set(sx * 11, 0, sz * 2.4)
    g.add(k)
  }
  g.position.y = 3
  return g
}

const LEGO_COLORS = [0xe5384b, 0xffc61a, 0x2f86ff, 0x3bd16f, 0xff8a1f, 0xb04aff]
/** Piezas curiosas: ladrillo, cabeza de minifigura, engranaje, casco, rueda, flor, cohete, llave. */
export function makeLego(variant: number): THREE.Group {
  const g = new THREE.Group()
  const c = LEGO_COLORS[variant % LEGO_COLORS.length]
  const em = { emissive: c, emissiveIntensity: 0.45 }
  switch (variant % 8) {
    case 0: {
      // La forma básica se construye abajo como ladrillo con studs.
      break
    }
    default:
      break
  }
  if (g.children.length === 0 || variant % 8 === 0) {
    g.clear()
    const b = box(26, 12, 14, c, 0, 8, 0)
    b.material = mat(c, em)
    g.add(b)
    for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) g.add(cyl(2.6, 2.6, 3, 0xffffff * 0 + c, 8, em).translateX(-9 + i * 6).translateY(15.5).translateZ(-3.5 + j * 7))
  } else if (variant % 8 === 1) {
    const h = cyl(8, 8, 14, 0xffd21f, 14, { emissive: 0x6a5000, emissiveIntensity: 0.5 })
    h.position.y = 10
    g.add(h)
    g.add(cyl(3, 3, 3, 0xffd21f, 10, { emissive: 0x6a5000 }).translateY(18.5))
    for (const s of [-1, 1]) g.add(box(1.4, 3, 1.4, 0x111111, 7.6, 12, s * 3, false))
  } else if (variant % 8 === 2) {
    const gear = cyl(9, 9, 5, 0xc7ccd6, 16, { emissive: 0x555a66, emissiveIntensity: 0.4, metalness: 0.2 })
    gear.position.y = 9
    g.add(gear)
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2
      g.add(box(4, 5, 4, 0xc7ccd6, Math.cos(a) * 10.5, 9, Math.sin(a) * 10.5))
    }
  } else if (variant % 8 === 3) {
    const hm = ball(9, 0xbfe6ff, { transparent: true, opacity: 0.6, emissive: 0x3a7a9a, emissiveIntensity: 0.5 })
    hm.position.y = 14
    g.add(hm)
    g.add(cyl(9.5, 9.5, 4, 0xff8a1f, 14, em).translateY(6))
  } else if (variant % 8 === 4) {
    const tire = new THREE.Mesh(new THREE.TorusGeometry(8, 3.4, 8, 16), mat(0x2f86ff, { emissive: 0x2f86ff, emissiveIntensity: 0.5 }))
    tire.position.y = 12
    tire.rotation.y = Math.PI / 2
    g.add(tire)
    g.add(cyl(3.5, 3.5, 4, 0xf4f4f0, 10).translateY(12).rotateZ(Math.PI / 2))
  } else if (variant % 8 === 5) {
    g.add(cyl(1.6, 1.6, 12, 0x3bd16f, 6, { emissive: 0x1a7a3a }).translateY(7))
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2
      g.add(ball(3.8, 0xff6ab0, { emissive: 0xaa2a70, emissiveIntensity: 0.5 }, 8).translateX(Math.cos(a) * 5.5).translateY(15).translateZ(Math.sin(a) * 5.5))
    }
    const center = ball(3, 0xffd21f, { emissive: 0x6a5000 }, 8)
    center.position.y = 15
    g.add(center)
  } else if (variant % 8 === 6) {
    g.add(cyl(4.5, 4.5, 16, 0xf4f4f0, 10).translateY(11))
    const cone = new THREE.Mesh(new THREE.ConeGeometry(4.5, 8, 10), mat(0xe5384b, em))
    cone.position.y = 23
    g.add(cone)
    for (const s of [-1, 1]) g.add(box(2, 8, 6, 0xe5384b, 0, 6, s * 6))
  } else {
    g.add(cyl(2, 2, 16, 0xffd21f, 8, { emissive: 0x6a5000, emissiveIntensity: 0.5 }).translateY(11))
    g.add(new THREE.Mesh(new THREE.TorusGeometry(5, 1.8, 6, 12), mat(0xffd21f, { emissive: 0x6a5000, emissiveIntensity: 0.5 })).translateY(22))
    g.add(box(6, 2, 2, 0xffd21f, 3, 5, 0))
  }
  g.traverse(o => {
    if ((o as THREE.Mesh).isMesh) o.castShadow = false
  })
  return g
}

export type TurretRig = { head: THREE.Group; eye: THREE.Mesh; line: THREE.Mesh; base: THREE.Group }
export function makeTurret(): THREE.Group {
  const g = new THREE.Group()
  const base = new THREE.Group()
  g.add(base)
  base.add(cyl(14, 17, 10, 0x2a2d35, 12).translateY(5))
  base.add(cyl(15, 15, 3, 0xffc61a, 12).translateY(10))
  const head = new THREE.Group()
  head.position.y = 22
  g.add(head)
  head.add(box(22, 14, 18, 0x6a7080, 0, 0, 0))
  head.add(box(26, 4, 20, 0xc8222e, 0, 8, 0))
  const barrel = cyl(2.6, 2.6, 22, 0x22252b, 8)
  barrel.rotation.z = Math.PI / 2
  barrel.position.set(18, 0, 0)
  head.add(barrel)
  const eye = new THREE.Mesh(new THREE.SphereGeometry(4, 10, 8), new THREE.MeshBasicMaterial({ color: 0x552222 }))
  eye.position.set(11, 3, 0)
  head.add(eye)
  const line = new THREE.Mesh(boxGeo, new THREE.MeshBasicMaterial({ color: 0xff3b3b, transparent: true, opacity: 0.5, depthWrite: false }))
  line.visible = false
  line.position.y = 22
  g.userData = { head, eye, line, base } satisfies TurretRig
  return g
}

export function makeGenerator(): THREE.Group {
  const g = new THREE.Group()
  g.add(box(12, 6, 12, 0x2a2d35, 0, 3, 0))
  g.add(box(8, 30, 8, 0x4a4f5c, 0, 21, 0))
  const core = new THREE.Mesh(new THREE.SphereGeometry(6, 10, 8), new THREE.MeshBasicMaterial({ color: 0x57f2ff }))
  core.position.y = 40
  g.add(core)
  g.userData = { core }
  return g
}

export function makeBeacon(): THREE.Group {
  const g = new THREE.Group()
  g.add(cyl(10, 12, 6, 0x2a2d35, 12).translateY(3))
  g.add(box(5, 50, 5, 0xd4d7dc, 0, 31, 0))
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(8, 12, 10), new THREE.MeshBasicMaterial({ color: 0xff3b4a }))
  lamp.position.y = 62
  g.add(lamp)
  const ring = new THREE.Mesh(new THREE.TorusGeometry(22, 1.4, 6, 28), new THREE.MeshBasicMaterial({ color: 0xff3b4a, transparent: true, opacity: 0.6 }))
  ring.rotation.x = Math.PI / 2
  ring.position.y = 2
  g.add(ring)
  g.userData = { lamp, ring }
  return g
}

/** Cohete espacial clásico estilo LEGO (cuerpo cilíndrico blanco/rojo, punta cónica, 3 aletas, ventanilla y propulsor). */
/** Cohete espacial mejorado estilo LEGO con alas laterales, disparadores láser y estante de lanzamiento. */
export function makeSpaceRocket(): THREE.Group {
  const g = new THREE.Group()
  const white = 0xf4f5f0
  const red = 0xd92b3a
  const dark = 0x22262f
  const gray = 0x5d6472
  const yellow = 0xffc61a
  const cyan = 0x57f2ff

  // 1. Toberas / Propulsores de alta potencia (3 propulsores)
  const nozzleCenter = cyl(16, 26, 26, dark, 18, { metalness: 0.5, roughness: 0.35 })
  nozzleCenter.position.y = 16
  const glowCenter = cyl(12, 20, 6, 0xff7a1f, 16, { emissive: 0xff5500, emissiveIntensity: 1.4 })
  glowCenter.position.y = 6
  g.add(nozzleCenter, glowCenter)

  for (const sx of [-22, 22]) {
    const sideNozzle = cyl(10, 18, 20, dark, 14, { metalness: 0.5, roughness: 0.35 })
    sideNozzle.position.set(sx, 14, 0)
    const sideGlow = cyl(8, 14, 5, 0x57f2ff, 14, { emissive: 0x22aaff, emissiveIntensity: 1.3 })
    sideGlow.position.set(sx, 6, 0)
    g.add(sideNozzle, sideGlow)
  }

  // 2. Fuselaje principal escalonado (altura y tamaño aumentados a ~305 unidades)
  // Etapa 1: Base roja reforzada con tacos LEGO
  const s1 = cyl(38, 41, 42, red, 24)
  s1.position.y = 48
  g.add(s1)
  const band1 = cyl(39.5, 39.5, 10, dark, 24)
  band1.position.y = 70
  g.add(band1)

  // Etapa 2: Fuselaje blanco con franja central y tacos de ensamble
  const s2 = cyl(36, 38, 75, white, 24)
  s2.position.y = 112
  g.add(s2)
  const stripe = cyl(36.8, 36.8, 16, red, 24)
  stripe.position.y = 115
  g.add(stripe)

  // Etapa 3: Módulo de aviónica superior
  const s3 = cyl(32, 36, 55, white, 24)
  s3.position.y = 175
  g.add(s3)
  const band2 = cyl(32.8, 32.8, 8, yellow, 24)
  band2.position.y = 155
  g.add(band2)

  // 3. Cono de morro aerodinámico y mástil superior
  const nose = new THREE.Mesh(new THREE.ConeGeometry(32, 65, 24), mat(red, { roughness: 0.35 }))
  nose.position.y = 235
  nose.castShadow = true
  g.add(nose)

  const noseStud = cyl(8, 8, 6, red, 14)
  noseStud.position.y = 270
  g.add(noseStud)

  const antenna = cyl(2.2, 3.2, 26, gray, 8)
  antenna.position.y = 286
  g.add(antenna)

  const beacon = ball(4.5, cyan, { emissive: 0x35d0ff, emissiveIntensity: 1.5 }, 12)
  beacon.position.y = 301
  g.add(beacon)

  // 4. Cabina / Visor de mando frontal estilo LEGO espacial
  const canopyFrame = box(26, 30, 14, dark, 0, 185, 28)
  const canopyGlass = box(22, 26, 15, cyan, 0, 185, 29, false)
  canopyGlass.material = mat(cyan, { emissive: 0x1ca8d8, emissiveIntensity: 0.85, roughness: 0.15 })
  g.add(canopyFrame, canopyGlass)

  // 5. ALAS LATERALES (Left & Right Wings estilo LEGO)
  for (const side of [-1, 1]) {
    const wing = new THREE.Group()

    // Placa de ala principal en declive
    const mainPlate = box(52, 60, 6, red, side * 58, 70, 0)
    // Borde exterior biselado
    const tipPlate = box(28, 42, 6, white, side * 92, 58, 0)
    // Refuerzo estructural inferior
    const strut = box(40, 8, 8, dark, side * 55, 45, 0)

    wing.add(mainPlate, tipPlate, strut)

    // Tacos LEGO sobre las alas
    for (const offX of [45, 65, 85]) {
      for (const offY of [55, 75]) {
        const st = cyl(3, 3, 2.5, red, 8)
        st.rotation.x = Math.PI / 2
        st.position.set(side * offX, offY, 3.5)
        wing.add(st)
      }
    }

    // 6. DISPARADORES LÁSER EN LA PUNTA DE LAS ALAS (Wingtip Laser Cannons)
    const cannon = new THREE.Group()
    cannon.position.set(side * 106, 68, 0)

    // Alojamiento blindado del cañón
    const housing = box(10, 36, 12, dark, 0, 0, 0)
    const cooler = box(12, 18, 14, gray, 0, -4, 0)
    // Tubo del cañón doble apuntando hacia el frente (+Y)
    const b1 = cyl(3, 3, 34, dark, 10, { metalness: 0.6, roughness: 0.3 })
    b1.position.set(-3, 18, 0)
    const b2 = cyl(3, 3, 34, dark, 10, { metalness: 0.6, roughness: 0.3 })
    b2.position.set(3, 18, 0)
    // Puntas / cristales emisores de plasma láser cian brillante
    const tip1 = cyl(3.2, 1.5, 8, cyan, 10, { emissive: 0x35d0ff, emissiveIntensity: 1.6 })
    tip1.position.set(-3, 37, 0)
    const tip2 = cyl(3.2, 1.5, 8, cyan, 10, { emissive: 0x35d0ff, emissiveIntensity: 1.6 })
    tip2.position.set(3, 37, 0)

    cannon.add(housing, cooler, b1, b2, tip1, tip2)
    wing.add(cannon)

    g.add(wing)
  }

  // 7. Aletas estabilizadoras dorsales (frente y dorso en Z)
  for (const sz of [-1, 1]) {
    const fin = box(8, 50, 24, red, 0, 68, sz * 44)
    g.add(fin)
  }

  // 8. Celdas de combustible ignífugas laterales
  for (const sx of [-28, 28]) {
    const tank = cyl(7, 7, 38, gray, 12)
    tank.position.set(sx, 75, 26)
    const cell = cyl(5.8, 5.8, 16, 0xff8a1f, 12, { emissive: 0xff5500, emissiveIntensity: 0.85 })
    cell.position.set(sx, 75, 26)
    g.add(tank, cell)
  }

  return g
}

export function makeRocket(): THREE.Group {
  const g = new THREE.Group()
  const yellow = 0xffc61a
  const dark = 0x22262f
  const gray = 0x5d6472

  // Estante / torre de lanzamiento que sostiene el cohete
  const stand = new THREE.Group()

  // Plataforma octogonal
  const pad = cyl(78, 86, 14, dark, 16)
  pad.position.y = 7
  const padRim = cyl(70, 72, 4, yellow, 16)
  padRim.position.y = 15
  stand.add(pad, padRim)

  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2
    const st = cyl(4.5, 4.5, 3.5, gray, 10)
    st.position.set(Math.cos(a) * 58, 18, Math.sin(a) * 58)
    stand.add(st)
  }

  // Torre de celosía vertical en el lateral este (+X)
  const towerX = 66
  const towerZ = 0
  const towerH = 240
  for (const dx of [-14, 14]) {
    for (const dz of [-14, 14]) {
      stand.add(box(5, towerH, 5, yellow, towerX + dx, towerH / 2 + 12, towerZ + dz))
    }
  }
  for (let y = 30; y <= towerH; y += 40) {
    stand.add(box(32, 4, 32, dark, towerX, y + 12, towerZ))
    stand.add(box(38, 3, 38, gray, towerX, y + 14, towerZ))
  }

  // Brazos de soporte / estantes que sostienen la nave
  const arm1 = new THREE.Group()
  arm1.position.set(towerX, 90, towerZ)
  arm1.add(box(44, 8, 10, dark, -22, 0, 0))
  arm1.add(box(12, 10, 18, yellow, -44, 0, -22))
  arm1.add(box(12, 10, 18, yellow, -44, 0, 22))
  stand.add(arm1)

  const arm2 = new THREE.Group()
  arm2.position.set(towerX, 175, towerZ)
  arm2.add(box(44, 7, 8, dark, -22, 0, 0))
  arm2.add(box(10, 8, 16, yellow, -44, 0, -20))
  arm2.add(box(10, 8, 16, yellow, -44, 0, 20))
  stand.add(arm2)

  g.add(stand)

  // La nave con su nuevo diseño incorporando alas y cañones láser
  const ship = makeSpaceRocket()
  g.add(ship)
  g.userData = { stand, ship }

  return g
}

/** Piedra ignífuga: cristal ígneo brillante sobre base de roca volcánica LEGO. */
export function makeFuelStone(): THREE.Group {
  const g = new THREE.Group()
  const base = cyl(14, 17, 6, 0x2b2628, 10)
  base.position.y = 3
  g.add(base)
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4
    const st = cyl(2.6, 2.6, 2.2, 0x3d3538, 8)
    st.position.set(Math.cos(a) * 8, 7, Math.sin(a) * 8)
    g.add(st)
  }
  const gemMat = mat(0xff8a1f, { emissive: 0xff4500, emissiveIntensity: 0.95, roughness: 0.2, metalness: 0.1 })
  const coreMat = mat(0xffe680, { emissive: 0xffaa00, emissiveIntensity: 1.1, roughness: 0.15 })
  const main = new THREE.Mesh(new THREE.OctahedronGeometry(10, 0), gemMat)
  main.scale.set(0.85, 1.65, 0.85)
  main.position.y = 18
  main.castShadow = true
  g.add(main)
  for (const [dx, dz, rotZ, rotX, sc] of [
    [-6, 3, 0.35, -0.15, 0.65],
    [6, -2, -0.38, 0.2, 0.6],
    [1, -6, 0.1, 0.4, 0.52],
  ] as [number, number, number, number, number][]) {
    const shard = new THREE.Mesh(new THREE.OctahedronGeometry(9, 0), coreMat)
    shard.scale.set(0.7 * sc, 1.5 * sc, 0.7 * sc)
    shard.position.set(dx, 13, dz)
    shard.rotation.set(rotX, 0, rotZ)
    g.add(shard)
  }
  const halo = new THREE.Mesh(
    new THREE.SphereGeometry(17, 12, 10),
    new THREE.MeshBasicMaterial({ color: 0xff7a1f, transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending }),
  )
  halo.position.y = 17
  g.add(halo)
  return g
}

export type LeverRig = { group: THREE.Group; arm: THREE.Group; lamp: THREE.MeshBasicMaterial }
/** Palanca industrial LEGO montada en pared para abrir el portón del garage rojo. */
export function makeLever(): LeverRig {
  const group = new THREE.Group()
  // Caja de control en la pared
  group.add(box(18, 28, 8, 0x2a2d35, 0, 32, 0))
  group.add(box(20, 4, 9, 0xffc61a, 0, 45, 0))
  group.add(box(20, 4, 9, 0xffc61a, 0, 19, 0))
  group.add(box(8, 14, 10, 0x161820, 0, 30, 1))
  // Luz indicadora de estado (roja cerrada, verde abierta)
  const lamp = new THREE.MeshBasicMaterial({ color: 0xff3b4a })
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(3.4, 10, 8), lamp)
  bulb.position.set(0, 40, 5)
  group.add(bulb)
  // Brazo articulado de la palanca
  const arm = new THREE.Group()
  arm.position.set(0, 28, 5)
  arm.rotation.x = -0.65 // hacia arriba inicialmente
  const rod = cyl(1.6, 1.6, 18, 0xc7ccd6, 8)
  rod.position.set(0, 9, 0)
  arm.add(rod)
  const grip = cyl(3.4, 3.4, 12, 0xe5384b, 10)
  grip.rotation.z = Math.PI / 2
  grip.position.set(0, 18, 0)
  arm.add(grip)
  group.add(arm)
  return { group, arm, lamp }
}


// ---------- Vehículos de Bershna ----------
/** Buggy de metal oscuro con una ametralladora giratoria en la parte trasera. */
export function makeGunBuggy(): THREE.Group {
  const g = new THREE.Group()
  const dk = 0x2a2e36
  const steel = { metalness: 0.55, roughness: 0.42 }
  const part = (w: number, h: number, d: number, color: number, x: number, y: number, z: number): THREE.Mesh => {
    const m = box(w, h, d, color, x, y, z)
    m.material = mat(color, steel)
    g.add(m)
    return m
  }
  part(72, 9, 34, dk, 0, 14, 0)
  part(26, 8, 30, 0x353a44, 28, 19, 0)
  part(8, 5, 32, 0x1b1e24, -35, 19, 0)
  part(14, 14, 22, 0x1b1e24, -6, 24, 0)
  part(30, 3, 38, 0xb8451f, 0, 8.5, 0)
  part(4, 10, 36, 0x3f4551, 39, 17, 0) // defensa delantera
  const post = cyl(1.5, 1.5, 14, 0x15161a, 6)
  post.position.set(10, 26, 0)
  post.rotation.z = 0.6
  g.add(post)
  const sw = new THREE.Mesh(new THREE.TorusGeometry(6, 1.4, 6, 14), mat(0x15161a))
  sw.position.set(13, 32, 0)
  sw.rotation.y = Math.PI / 2
  sw.rotation.x = 0.6
  g.add(sw)
  for (const s of [-1, 1]) {
    const hl = new THREE.Mesh(boxGeo, basic(0xff7a22))
    hl.scale.set(4, 5, 7)
    hl.position.set(42.5, 20, s * 10)
    g.add(hl)
  }
  // torreta trasera
  const turret = new THREE.Group()
  turret.position.set(-24, 24, 0)
  const ring = cyl(8, 9, 5, 0x3f4551, 12, steel)
  ring.position.y = 2
  const mount = cyl(2.4, 2.4, 16, 0x15161a, 8)
  mount.position.y = 12
  const body = box(16, 8, 9, 0x1b1e24, 2, 22, 0)
  body.material = mat(0x1b1e24, steel)
  const shield = box(2, 16, 22, 0x3f4551, 9, 24, 0)
  shield.material = mat(0x3f4551, steel)
  turret.add(ring, mount, body, shield)
  for (const s of [-1, 1]) {
    const barrel = cyl(1.5, 1.5, 30, 0x0f1014, 8, steel)
    barrel.rotation.z = Math.PI / 2
    barrel.position.set(24, 22, s * 2.4)
    turret.add(barrel)
  }
  const tipGlow = new THREE.Mesh(boxGeo, basic(0x8fe3ff))
  tipGlow.scale.set(3, 3, 8)
  tipGlow.position.set(39, 22, 0)
  const ammoBox = box(8, 9, 7, 0x4b5a2a, -2, 21, 9)
  turret.add(tipGlow, ammoBox)
  g.add(turret)
  const wheels: THREE.Group[] = []
  for (const x of [-25, 26]) {
    for (const s of [-1, 1]) {
      const wg = new THREE.Group()
      wg.position.set(x, 11, s * 22)
      const tire = cyl(11.5, 11.5, 10, 0x0f1014, 16)
      tire.rotation.x = Math.PI / 2
      wg.add(tire)
      const hub = cyl(5, 5, 11, 0x5d6472, 8, steel)
      hub.rotation.x = Math.PI / 2
      wg.add(hub)
      g.add(wg)
      wheels.push(wg)
    }
  }
  g.userData = { wheels, turret }
  return g
}

/** Moto del desierto: dos ruedas anchas con tacos para la arena, ligera y más rápida que los buggys. */
export function makeMoto(): THREE.Group {
  const g = new THREE.Group()
  const red = 0xd9482b
  const dk = 0x1b1e24
  g.add(box(34, 7, 9, red, 0, 19, 0))
  g.add(box(16, 5, 11, dk, -8, 24.5, 0)) // asiento
  g.add(box(14, 9, 8, 0x5d6472, 4, 12, 0)) // motor
  g.add(box(12, 6, 7, red, 15, 23, 0)) // depósito
  const fork = cyl(1.6, 1.6, 22, 0x9aa1ad, 6)
  fork.position.set(22, 20, 0)
  fork.rotation.z = -0.5
  g.add(fork)
  const bar = cyl(1.2, 1.2, 22, dk, 6)
  bar.rotation.x = Math.PI / 2
  bar.position.set(17, 31, 0)
  g.add(bar)
  const hl = new THREE.Mesh(boxGeo, basic(0xffe34a))
  hl.scale.set(3, 5, 6)
  hl.position.set(26, 25, 0)
  g.add(hl)
  const ex = cyl(1.6, 2, 20, 0x9aa1ad, 6)
  ex.rotation.z = Math.PI / 2 - 0.2
  ex.position.set(-12, 14, 6)
  g.add(ex)
  const fender = box(14, 2, 10, red, -22, 24, 0)
  g.add(fender)
  const wheels: THREE.Group[] = []
  for (const x of [-22, 26]) {
    const wg = new THREE.Group()
    wg.position.set(x, 12, 0)
    const tire = cyl(12, 12, 12, 0x15161a, 16)
    tire.rotation.x = Math.PI / 2
    wg.add(tire)
    // tacos de paleta para la arena
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2
      const pad = box(3, 2.4, 13, 0x2a2d35, Math.cos(a) * 12.6, Math.sin(a) * 12.6, 0, false)
      pad.rotation.z = a + Math.PI / 2
      wg.add(pad)
    }
    const hub = cyl(4, 4, 13, 0xffc61a, 8)
    hub.rotation.x = Math.PI / 2
    wg.add(hub)
    g.add(wg)
    wheels.push(wg)
  }
  g.userData = { wheels }
  return g
}
