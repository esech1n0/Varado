// Aliens de Bershna, hechos con primitivas: escupidor (verde fosforescente), lengua (morado),
// acorazado (café con armadura de roca) y el coloso final. Todos miran hacia +X.
import * as THREE from 'three'
import { ALIENS, type AlienKind } from './config'
import { seeded } from './geom'

export type Alien2Rig = {
  /** Lengua extensible: se escala en X (longitud) desde la boca. */
  tongue?: THREE.Mesh
  tip?: THREE.Mesh
  mouthX?: number
  /** Trozos de roca que desaparecen al romperse la armadura. */
  armor?: THREE.Group
}

export const isAlien2 = (k: AlienKind): boolean => k === 'acid' || k === 'licker' || k === 'rock' || k === 'colossus'

// ---------- Pieles procedurales (mapas de multiplicación + relieve) ----------
type Skin = 'acid' | 'licker' | 'hide' | 'stone'
const skins = new Map<Skin, THREE.CanvasTexture>()
function skinTex(kind: Skin): THREE.CanvasTexture {
  const hit = skins.get(kind)
  if (hit) return hit
  const S = 256
  const c = document.createElement('canvas')
  c.width = c.height = S
  const g = c.getContext('2d')!
  const q = seeded(kind.length * 53 + kind.charCodeAt(1))
  g.fillStyle = '#fff'
  g.fillRect(0, 0, S, S)
  const blob = (x: number, y: number, r: number, col: string): void => {
    const gr = g.createRadialGradient(x, y, 0, x, y, r)
    gr.addColorStop(0, col)
    gr.addColorStop(1, col.replace(/[\d.]+\)$/, '0)'))
    g.fillStyle = gr
    g.fillRect(x - r, y - r, r * 2, r * 2)
  }
  const crack = (n: number, col: string, w: number, step: number): void => {
    for (let i = 0; i < n; i++) {
      let x = q() * S
      let y = q() * S
      g.strokeStyle = col
      g.lineWidth = w
      g.beginPath()
      g.moveTo(x, y)
      for (let k = 0; k < 6; k++) {
        x += (q() - 0.5) * step
        y += (q() - 0.5) * step
        g.lineTo(x, y)
      }
      g.stroke()
    }
  }
  if (kind === 'acid') {
    // piel translúcida: ampollas oscuras con borde claro y venas brillantes
    for (let i = 0; i < 46; i++) {
      const x = q() * S
      const y = q() * S
      const r = 5 + q() * 16
      blob(x, y, r * 1.5, 'rgba(10,70,10,0.5)')
      g.strokeStyle = 'rgba(240,255,200,.55)'
      g.lineWidth = 1.3
      g.beginPath()
      g.arc(x, y, r * 0.6, 0, 7)
      g.stroke()
    }
    crack(22, 'rgba(20,90,10,.5)', 1.6, 46)
    for (let i = 0; i < 900; i++) {
      g.fillStyle = `rgba(0,60,0,${0.06 + q() * 0.14})`
      g.fillRect(q() * S, q() * S, 2, 2)
    }
  } else if (kind === 'licker') {
    // franjas atigradas, verrugas claras y poros
    for (let i = 0; i < 13; i++) {
      const y = (i / 13) * S + q() * 8
      g.strokeStyle = `rgba(40,6,70,${0.4 + q() * 0.3})`
      g.lineWidth = 5 + q() * 9
      g.beginPath()
      g.moveTo(0, y)
      g.bezierCurveTo(70, y + (q() - 0.5) * 40, 170, y + (q() - 0.5) * 40, S, y)
      g.stroke()
    }
    for (let i = 0; i < 70; i++) {
      const x = q() * S
      const y = q() * S
      const r = 2 + q() * 5
      g.fillStyle = 'rgba(30,0,50,.5)'
      g.beginPath()
      g.arc(x + 1, y + 1.5, r, 0, 7)
      g.fill()
      g.fillStyle = 'rgba(255,220,255,.75)'
      g.beginPath()
      g.arc(x, y, r * 0.75, 0, 7)
      g.fill()
    }
    for (let i = 0; i < 1200; i++) {
      g.fillStyle = `rgba(30,0,50,${0.05 + q() * 0.12})`
      g.fillRect(q() * S, q() * S, 2, 2)
    }
  } else if (kind === 'hide') {
    // cuero agrietado en placas
    for (let i = 0; i < 20; i++) blob(q() * S, q() * S, 20 + q() * 40, 'rgba(50,24,8,0.3)')
    crack(60, 'rgba(30,14,4,.7)', 2, 44)
    crack(30, 'rgba(255,220,180,.25)', 1, 30)
    for (let i = 0; i < 1500; i++) {
      g.fillStyle = `rgba(30,14,4,${0.06 + q() * 0.16})`
      g.fillRect(q() * S, q() * S, 2, 2)
    }
  } else {
    // roca: estratos, grietas y líquenes
    for (let y = 6; y < S; y += 10 + q() * 20) {
      g.strokeStyle = `rgba(${q() < 0.5 ? '20,14,10' : '255,240,220'},${0.18 + q() * 0.2})`
      g.lineWidth = 1.5 + q() * 4
      g.beginPath()
      g.moveTo(0, y)
      g.bezierCurveTo(80, y + (q() - 0.5) * 24, 170, y + (q() - 0.5) * 24, S, y)
      g.stroke()
    }
    crack(34, 'rgba(10,8,6,.75)', 1.6, 40)
    for (let i = 0; i < 16; i++) blob(q() * S, q() * S, 8 + q() * 18, 'rgba(120,150,60,0.35)')
    for (let i = 0; i < 2200; i++) {
      g.fillStyle = `rgba(${q() < 0.5 ? '10,8,6' : '255,255,255'},${0.05 + q() * 0.12})`
      g.fillRect(q() * S, q() * S, 2, 2)
    }
  }
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  skins.set(kind, t)
  return t
}

const std = (color: number, o: THREE.MeshStandardMaterialParameters = {}, skin?: Skin): THREE.MeshStandardMaterial => {
  const tx = skin ? skinTex(skin) : null
  const mt = new THREE.MeshStandardMaterial({ color, roughness: 0.5, ...(tx ? { map: tx, bumpMap: tx, bumpScale: 1.8 } : {}), ...o })
  // en la piel fosforescente las ampollas también apagan el brillo
  if (tx && o.emissive !== undefined) mt.emissiveMap = tx
  if (o.emissive !== undefined) mt.userData.baseGlow = { color: o.emissive as number, intensity: o.emissiveIntensity ?? 1 }
  return mt
}

export function makeAlien2(kind: AlienKind): THREE.Group {
  const def = ALIENS[kind]
  const H = def.height
  const g = new THREE.Group()
  const rig: Alien2Rig = {}
  const put = (geo: THREE.BufferGeometry, mt: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D = g): THREE.Mesh => {
    const mesh = new THREE.Mesh(geo, mt)
    mesh.position.set(x, y, z)
    mesh.castShadow = true
    parent.add(mesh)
    return mesh
  }
  const legs = (mt: THREE.Material, rr: number): void => {
    for (const s of [-1, 1]) put(new THREE.CylinderGeometry(rr, rr * 1.15, H * 0.22, 10), mt, 0, H * 0.11, s * H * 0.17)
  }
  /** Boca abierta con anillo de dientes afilados y lengua puntiaguda. */
  const maw = (x: number, y: number, rad: number, tongueColor: number, cavity = 0x3e0715): void => {
    const cav = put(new THREE.SphereGeometry(rad, 16, 12), new THREE.MeshBasicMaterial({ color: cavity }), x, y, 0)
    cav.scale.set(0.45, 1, 1.15)
    cav.castShadow = false
    const toothM = new THREE.MeshBasicMaterial({ color: 0xfff8e8 })
    const tg = new THREE.ConeGeometry(rad * 0.16, rad * 0.5, 5)
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2
      const py = Math.cos(a) * rad * 0.86
      const pz = Math.sin(a) * rad * 1.0
      const t = put(tg, toothM, x + rad * 0.2, y + py, pz)
      t.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0.25, -py, -pz).normalize())
      t.castShadow = false
    }
    const tgeo = new THREE.CylinderGeometry(rad * 0.16, rad * 0.2, 1, 8)
    tgeo.rotateZ(-Math.PI / 2)
    tgeo.translate(0.5, 0, 0)
    rig.tongue = put(tgeo, new THREE.MeshBasicMaterial({ color: tongueColor }), x, y - rad * 0.25, 0)
    rig.tongue.castShadow = false
    const tipGeo = new THREE.ConeGeometry(rad * 0.24, rad * 0.8, 6)
    tipGeo.rotateZ(-Math.PI / 2)
    rig.tip = put(tipGeo, new THREE.MeshBasicMaterial({ color: 0xf2e6d0 }), x, y - rad * 0.25, 0)
    rig.tip.castShadow = false
    rig.mouthX = x
  }
  const eyes = (x: number, y: number, dz: number, rad: number, color: number): void => {
    for (const s of [-1, 1]) put(new THREE.SphereGeometry(rad, 10, 8), new THREE.MeshBasicMaterial({ color }), x, y, s * dz).castShadow = false
  }

  if (kind === 'acid') {
    const skin = std(0x9dff5a, { emissive: 0x3cff1a, emissiveIntensity: 0.7, roughness: 0.3 }, 'acid')
    const body = put(new THREE.SphereGeometry(H * 0.34, 18, 14), skin, 0, H * 0.52, 0)
    body.scale.set(0.95, 1.2, 0.95)
    legs(std(0x4fc23a, { emissive: 0x1c7a10, emissiveIntensity: 0.5 }, 'acid'), H * 0.1)
    // saco de ácido translúcido y hocico por el que escupe
    const sac = put(new THREE.SphereGeometry(H * 0.2, 14, 10), new THREE.MeshStandardMaterial({ color: 0xd8ff6a, emissive: 0xb8ff3a, emissiveIntensity: 1.1, transparent: true, opacity: 0.8, roughness: 0.2 }), H * 0.2, H * 0.4, 0)
    sac.castShadow = false
    const snout = put(new THREE.CylinderGeometry(H * 0.07, H * 0.11, H * 0.24, 10), std(0x2f8a1e), H * 0.36, H * 0.6, 0)
    snout.rotation.z = -Math.PI / 2
    put(new THREE.TorusGeometry(H * 0.075, H * 0.025, 6, 12), std(0x1c5a12), H * 0.48, H * 0.6, 0).rotation.y = Math.PI / 2
    // ojos sobre tallos
    for (const s of [-1, 1]) {
      const stalk = put(new THREE.CylinderGeometry(H * 0.022, H * 0.03, H * 0.26, 6), skin, H * 0.08, H * 0.98, s * H * 0.13)
      stalk.rotation.x = s * 0.3
      put(new THREE.SphereGeometry(H * 0.07, 10, 8), new THREE.MeshBasicMaterial({ color: 0xfaffc0 }), H * 0.1, H * 1.12, s * H * 0.17).castShadow = false
      put(new THREE.SphereGeometry(H * 0.032, 8, 6), new THREE.MeshBasicMaterial({ color: 0x102a08 }), H * 0.155, H * 1.12, s * H * 0.17).castShadow = false
    }
  } else if (kind === 'licker') {
    const skin = std(0xb45cff, { roughness: 0.38 }, 'licker')
    const body = put(new THREE.SphereGeometry(H * 0.36, 18, 14), skin, 0, H * 0.54, 0)
    body.scale.set(0.95, 1.18, 1)
    legs(std(0x7a34c0, {}, 'licker'), H * 0.1)
    maw(H * 0.25, H * 0.5, H * 0.25, 0xe0306a)
    eyes(H * 0.2, H * 0.88, H * 0.13, H * 0.05, 0xffe14a)
    // púas dorsales
    for (let i = 0; i < 4; i++) {
      const sp = put(new THREE.ConeGeometry(H * 0.05, H * 0.2, 5), std(0x3c1670), -H * 0.12 - i * H * 0.05, H * (0.96 - i * 0.12), 0)
      sp.rotation.z = 0.5 + i * 0.3
    }
  } else {
    // acorazado y coloso: cuerpo café blando bajo una coraza de rocas
    const boss = kind === 'colossus'
    const skin = std(0xa87044, { roughness: 0.7 }, 'hide')
    const body = put(new THREE.SphereGeometry(H * 0.3, 18, 14), skin, 0, H * 0.46, 0)
    body.scale.set(1, 1.15, 1.05)
    legs(std(0x7a5030, { roughness: 0.7 }, 'hide'), H * 0.11)
    if (boss) {
      maw(H * 0.2, H * 0.44, H * 0.2, 0xc8e83a, 0x1a3a08)
      eyes(H * 0.22, H * 0.7, H * 0.13, H * 0.04, 0x9dff3a)
    } else eyes(H * 0.26, H * 0.56, H * 0.1, H * 0.045, 0xffa530)
    const armor = new THREE.Group()
    g.add(armor)
    const q = seeded(kind.length * 31)
    const rockGeo = new THREE.DodecahedronGeometry(1, 0)
    const rockM = [0x8a7462, 0xa08a76, 0x74604f].map(c => new THREE.MeshStandardMaterial({ color: c, map: skinTex('stone'), bumpMap: skinTex('stone'), bumpScale: 2.4, roughness: 1, flatShading: true }))
    const n = boss ? 22 : 11
    for (let i = 0; i < n; i++) {
      // se reparten por la espalda, los costados y la cabeza, dejando libres los ojos (y la boca del coloso)
      const a = 0.75 + (i / n) * (Math.PI * 2 - 1.5)
      const ring = i % 3
      const rr = H * (0.27 + q() * 0.05)
      const chunk = put(rockGeo, rockM[i % 3], Math.cos(a) * rr, H * (0.22 + ring * 0.24 + q() * 0.08), Math.sin(a) * rr, armor)
      chunk.scale.setScalar(H * (0.1 + q() * 0.06))
      chunk.rotation.set(q() * 3, q() * 3, q() * 3)
    }
    const cap = put(rockGeo, rockM[0], -H * 0.04, H * 0.84, 0, armor)
    cap.scale.set(H * 0.24, H * 0.16, H * 0.24)
    if (!boss) {
      const brow = put(rockGeo, rockM[1], H * 0.24, H * 0.72, 0, armor)
      brow.scale.set(H * 0.1, H * 0.08, H * 0.2)
    }
    rig.armor = armor
  }
  g.userData.rig = rig
  return g
}
