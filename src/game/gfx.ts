import * as THREE from 'three'
import { seeded } from './geom'

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
type DetailKind = 'suit' | 'pack' | 'trim' | 'boot' | 'helmet' | 'gunbody' | 'gungrip' | 'gunwood' | 'gunbarrel'
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

/** Caja del astronauta con el mismo color y forma que `box`, pero con textura de detalle. */
function tbox(w: number, h: number, d: number, color: number, kind: DetailKind, x = 0, y = 0, z = 0): THREE.Mesh {
  const m = box(w, h, d, color, x, y, z)
  m.material = detailMat(color, kind)
  return m
}

// ---------- Astronauta (jugador) ----------
export type PlayerRig = { legs: THREE.Group[]; guns: Record<Exclude<GunKind, 'plasma'>, THREE.Group>; torso: THREE.Group }
export function makePlayer(): THREE.Group {
  const g = new THREE.Group()
  const w = 0xf6f6f2
  const ye = 0xffc61a
  const legs: THREE.Group[] = []
  for (const s of [-1, 1]) {
    const lg = new THREE.Group()
    lg.position.set(0, 14, s * 5)
    lg.add(tbox(8, 14, 8, w, 'suit', 0, -7, 0))
    lg.add(tbox(10, 3, 9, 0xbfc3cc, 'boot', 1, -14.5, 0))
    g.add(lg)
    legs.push(lg)
  }
  const torso = new THREE.Group()
  g.add(torso)
  torso.add(tbox(13, 5, 19, w, 'suit', 0, 16.5, 0))
  torso.add(tbox(12, 17, 21, w, 'suit', 0, 27, 0))
  torso.add(box(0.6, 6, 6, 0x6e7480, 6.2, 30, 3))
  torso.add(tbox(7, 17, 14, 0x8c919c, 'pack', -9.5, 28, 0))
  for (const s of [-1, 1]) {
    torso.add(tbox(15, 5, 5, w, 'suit', 8, 29, s * 11))
    const h = cyl(3, 3, 5, ye, 10)
    h.material = detailMat(ye, 'trim')
    h.rotation.x = Math.PI / 2
    h.position.set(17, 29, s * 8)
    torso.add(h)
  }
  const guns = { pistol: makeGun('pistol'), rifle: makeGun('rifle'), shotgun: makeGun('shotgun'), sniper: makeGun('sniper') }
  for (const k of Object.keys(guns) as Exclude<GunKind, 'plasma'>[]) {
    guns[k].position.set(23, 28, 0)
    guns[k].visible = false
    torso.add(guns[k])
  }
  const head = ball(11, 0xffffff, {}, 22)
  head.material = detailMat(0xffffff, 'helmet')
  head.position.set(0, 44, 0)
  head.scale.set(1, 1.05, 1)
  torso.add(head)
  const face = ball(7, ye, { emissive: 0x553a00 })
  face.position.set(7.2, 44, 0)
  face.scale.set(0.55, 0.95, 1.1)
  torso.add(face)
  const vis = new THREE.Mesh(new THREE.SphereGeometry(7.6, 16, 12), new THREE.MeshStandardMaterial({ color: 0x9fd8ff, transparent: true, opacity: 0.28, roughness: 0.1 }))
  vis.position.copy(face.position)
  vis.scale.copy(face.scale)
  torso.add(vis)
  g.userData = { legs, guns, torso } satisfies PlayerRig
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
export function makeRocket(): THREE.Group {
  const g = new THREE.Group()
  const white = 0xf4f5f0
  const red = 0xd92b3a
  const dark = 0x252932
  const gray = 0x6e7585
  const yellow = 0xffc61a

  // Plataforma de lanzamiento LEGO octogonal con tacos
  const pad = cyl(58, 64, 8, dark, 16)
  pad.position.y = 4
  g.add(pad)
  const padRim = cyl(50, 52, 3, yellow, 16)
  padRim.position.y = 9.5
  g.add(padRim)
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2
    const st = cyl(4, 4, 3, gray, 10)
    st.position.set(Math.cos(a) * 42, 12, Math.sin(a) * 42)
    g.add(st)
  }

  // Tobera / propulsor inferior
  const nozzle = cyl(18, 28, 22, dark, 18, { metalness: 0.45, roughness: 0.35 })
  nozzle.position.y = 18
  g.add(nozzle)
  const nozzleGlow = cyl(14, 22, 6, 0xff7a1f, 16, { emissive: 0xff5500, emissiveIntensity: 1.1 })
  nozzleGlow.position.y = 10
  g.add(nozzleGlow)

  // Cuerpo cilíndrico escalonado estilo bloques LEGO
  const b1 = cyl(31, 33, 28, red, 22)
  b1.position.y = 42
  g.add(b1)
  const b2 = cyl(31, 31, 56, white, 22)
  b2.position.y = 84
  g.add(b2)
  const band1 = cyl(31.8, 31.8, 10, red, 22)
  band1.position.y = 66
  g.add(band1)
  const band2 = cyl(31.8, 31.8, 8, dark, 22)
  band2.position.y = 110
  g.add(band2)
  const b3 = cyl(27, 31, 36, white, 22)
  b3.position.y = 130
  g.add(b3)

  // Punta cónica roja clásica con antena y taco superior
  const nose = new THREE.Mesh(new THREE.ConeGeometry(27, 48, 22), mat(red, { roughness: 0.4 }))
  nose.position.y = 172
  nose.castShadow = true
  g.add(nose)
  const noseStud = cyl(6, 6, 5, red, 12)
  noseStud.position.y = 197
  g.add(noseStud)
  const spire = cyl(1.8, 2.5, 18, gray, 8)
  spire.position.y = 208
  g.add(spire)
  const tipLight = ball(3.8, 0x57f2ff, { emissive: 0x35d0ff, emissiveIntensity: 1.2 }, 10)
  tipLight.position.y = 218
  g.add(tipLight)

  // Ventanilla circular (ojo de buey) mirando al oeste (hacia donde llega el jugador)
  const portFrame = cyl(13, 13, 8, dark, 18)
  portFrame.rotation.z = Math.PI / 2
  portFrame.position.set(-29, 92, 0)
  g.add(portFrame)
  const portRim = cyl(11, 11, 9, yellow, 18)
  portRim.rotation.z = Math.PI / 2
  portRim.position.set(-29.5, 92, 0)
  g.add(portRim)
  const portGlass = cyl(8.8, 8.8, 10, 0x7ef4ff, 18, { emissive: 0x1ca8d8, emissiveIntensity: 0.75, roughness: 0.15 })
  portGlass.rotation.z = Math.PI / 2
  portGlass.position.set(-30, 92, 0)
  g.add(portGlass)

  // 3 aletas rojas escalonadas estilo bloques LEGO a 120°
  for (let i = 0; i < 3; i++) {
    const fin = new THREE.Group()
    fin.rotation.y = (i * Math.PI * 2) / 3
    fin.add(box(28, 46, 8, red, 38, 36, 0))
    fin.add(box(18, 30, 8, red, 52, 26, 0))
    fin.add(box(10, 18, 10, dark, 58, 14, 0))
    // tacos LEGO sobre el borde superior de cada aleta
    for (const sx of [30, 42, 54]) {
      const st = cyl(2.8, 2.8, 3, red, 8)
      st.position.set(sx, sx === 54 ? 42 : 60, 0)
      fin.add(st)
    }
    g.add(fin)
  }

  // Tanques de combustible externos (donde se cargan las 3 piedras ignífugas)
  for (let i = 0; i < 3; i++) {
    const a = (i * Math.PI * 2) / 3 + Math.PI / 3
    const tx = Math.cos(a) * 32
    const tz = Math.sin(a) * 32
    const tank = cyl(6.5, 6.5, 32, gray, 12)
    tank.position.set(tx, 46, tz)
    const cell = cyl(5.2, 5.2, 12, 0xff8a1f, 12, { emissive: 0xff5500, emissiveIntensity: 0.7 })
    cell.position.set(tx, 46, tz)
    g.add(tank, cell)
  }

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

