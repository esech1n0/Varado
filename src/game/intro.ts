// Viñetas de introducción: cinco paneles de cómic animados en un canvas 2D antes de "despertar".
import { seeded } from './geom'
import { sfx } from './audio'

type G = CanvasRenderingContext2D
export type IntroColors = { suit: string; accent: string; helmet: string }

const W = 1600
const H = 900
const INK = '#1b1838'
const TAU = Math.PI * 2

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v))
const lerp = (a: number, b: number, k: number): number => a + (b - a) * k
const easeOut = (k: number): number => 1 - Math.pow(1 - clamp01(k), 3)
const easeIn = (k: number): number => Math.pow(clamp01(k), 2.2)

// ---------- Piezas reutilizables ----------
function rrect(g: G, x: number, y: number, w: number, h: number, r: number, fill: string, stroke = INK, lw = 5): void {
  g.beginPath()
  g.roundRect(x, y, w, h, r)
  g.fillStyle = fill
  g.fill()
  if (lw > 0) {
    g.lineWidth = lw
    g.strokeStyle = stroke
    g.stroke()
  }
}

function circle(g: G, x: number, y: number, r: number, fill: string, lw = 5): void {
  g.beginPath()
  g.arc(x, y, r, 0, TAU)
  g.fillStyle = fill
  g.fill()
  if (lw > 0) {
    g.lineWidth = lw
    g.strokeStyle = INK
    g.stroke()
  }
}

const STARS = (() => {
  const r = seeded(4711)
  return Array.from({ length: 170 }, () => ({ x: r() * W, y: r() * H, s: 0.8 + r() * 2.2, p: r() * TAU, v: 1 + r() * 3 }))
})()

function stars(g: G, t: number, maxY = H, drift = 0): void {
  for (const s of STARS) {
    if (s.y > maxY) continue
    const a = 0.35 + 0.65 * Math.abs(Math.sin(s.p + t * s.v * 0.5))
    g.fillStyle = `rgba(225,236,255,${a * (1 - s.y / (maxY * 1.15))})`
    const x = (((s.x - drift * s.s) % W) + W) % W
    g.fillRect(x, s.y, s.s, s.s)
  }
}

/** Cielo de atardecer del planeta: azul noche arriba, naranja polvoriento en el horizonte. */
function duskSky(g: G, horizon: number, t: number): void {
  const sky = g.createLinearGradient(0, 0, 0, horizon)
  sky.addColorStop(0, '#080a24')
  sky.addColorStop(0.45, '#3a2350')
  sky.addColorStop(0.8, '#c95a3a')
  sky.addColorStop(1, '#ffb45e')
  g.fillStyle = sky
  g.fillRect(0, 0, W, horizon)
  g.fillStyle = '#ffb45e'
  g.fillRect(0, horizon - 1, W, 90) // las dunas ondulan por debajo del horizonte
  stars(g, t, horizon * 0.55)
  // dos lunas
  circle(g, 1320, 130, 46, '#ffe2b8', 0)
  circle(g, 1338, 120, 40, '#3a2350', 0)
  circle(g, 250, 210, 20, '#ffd0a0', 0)
}

function dunes(g: G, horizon: number, offset: number): void {
  const layer = (y: number, amp: number, len: number, col: string, speed: number): void => {
    g.fillStyle = col
    g.beginPath()
    g.moveTo(0, H)
    for (let x = 0; x <= W; x += 20) {
      const k = (x + offset * speed) / len
      g.lineTo(x, y - Math.sin(k) * amp - Math.sin(k * 2.3 + 1) * amp * 0.4)
    }
    g.lineTo(W, H)
    g.fill()
  }
  layer(horizon + 6, 26, 210, '#a9522a', 0.15)
  layer(horizon + 50, 20, 150, '#cf6f33', 0.4)
  const ground = g.createLinearGradient(0, horizon + 70, 0, H)
  ground.addColorStop(0, '#f0a04e')
  ground.addColorStop(1, '#b4571f')
  g.fillStyle = ground
  g.fillRect(0, horizon + 80, W, H)
}

/** Cohete LEGO: origen en el centro de la base, apuntando hacia arriba. La llama sale centrada del eje. */
function rocket(g: G, x: number, y: number, s: number, rot: number, t: number, flame: number): void {
  g.save()
  g.translate(x, y)
  g.rotate(rot)
  g.scale(s, s)
  g.lineJoin = 'round'
  if (flame > 0) {
    const f = flame * (0.85 + Math.sin(t * 38) * 0.1 + Math.sin(t * 61) * 0.06)
    const cone = (w: number, len: number, c0: string, c1: string): void => {
      const gr = g.createLinearGradient(0, 0, 0, len)
      gr.addColorStop(0, c0)
      gr.addColorStop(1, c1)
      g.fillStyle = gr
      g.beginPath()
      g.moveTo(-w, 0)
      g.quadraticCurveTo(-w * 0.9, len * 0.55, 0, len)
      g.quadraticCurveTo(w * 0.9, len * 0.55, w, 0)
      g.fill()
    }
    cone(34, f, '#ff8a1f', 'rgba(255,90,20,0)')
    cone(20, f * 0.72, '#ffe27a', 'rgba(255,200,60,0)')
    cone(10, f * 0.45, '#ffffff', 'rgba(255,255,220,0)')
    for (const sx of [-58, 58]) {
      g.save()
      g.translate(sx, -6)
      cone(11, f * 0.45, '#57f2ff', 'rgba(60,160,255,0)')
      g.restore()
    }
  }
  // alas
  for (const sd of [-1, 1]) {
    g.beginPath()
    g.moveTo(sd * 36, -150)
    g.lineTo(sd * 118, -70)
    g.lineTo(sd * 118, -20)
    g.lineTo(sd * 36, -44)
    g.closePath()
    g.fillStyle = '#d92b3a'
    g.fill()
    g.lineWidth = 5
    g.strokeStyle = INK
    g.stroke()
    rrect(g, sd * 58 - 9, -22, 18, 22, 3, '#22262f')
  }
  // tobera
  g.beginPath()
  g.moveTo(-22, -42)
  g.lineTo(22, -42)
  g.lineTo(34, 0)
  g.lineTo(-34, 0)
  g.closePath()
  g.fillStyle = '#22262f'
  g.fill()
  g.stroke()
  // fuselaje
  rrect(g, -40, -92, 80, 52, 6, '#d92b3a')
  rrect(g, -38, -240, 76, 152, 6, '#f4f5f0')
  rrect(g, -38, -150, 76, 20, 0, '#d92b3a')
  rrect(g, -38, -226, 76, 12, 0, '#ffc61a')
  // morro
  g.beginPath()
  g.moveTo(-38, -238)
  g.quadraticCurveTo(-30, -300, 0, -326)
  g.quadraticCurveTo(30, -300, 38, -238)
  g.closePath()
  g.fillStyle = '#d92b3a'
  g.fill()
  g.stroke()
  circle(g, 0, -190, 17, '#57f2ff')
  g.restore()
}

/** Astronauta de perfil 3/4 mirando a la derecha; origen en los pies. Altura ≈ 250 a escala 1. */
function astronaut(g: G, x: number, y: number, s: number, c: IntroColors, o: { rot?: number; step?: number; arm?: number; gun?: boolean; flip?: boolean; sit?: boolean } = {}): void {
  g.save()
  g.translate(x, y)
  if (o.flip) g.scale(-1, 1)
  g.rotate(o.rot ?? 0)
  g.scale(s, s)
  g.lineJoin = 'round'
  const step = o.step ?? 0
  // mochila
  rrect(g, -70, -178, 44, 104, 10, '#c9ccd3')
  rrect(g, -70, -150, 44, 10, 0, c.accent, INK, 3)
  // piernas
  if (!o.sit) {
    for (const [dx, a, shade] of [[-14, -step, 0.82], [12, step, 1]] as [number, number, number][]) {
      g.save()
      g.translate(dx, -72)
      g.rotate(a * 0.6)
      g.globalAlpha = 1
      rrect(g, -15, 0, 30, 56, 9, c.suit)
      if (shade < 1) {
        g.fillStyle = 'rgba(20,20,40,.18)'
        g.fillRect(-13, 2, 26, 52)
      }
      rrect(g, -18, 50, 44, 22, 8, '#8a909b')
      g.restore()
    }
  }
  // torso
  rrect(g, -38, -172, 76, 106, 24, c.suit)
  rrect(g, -38, -86, 76, 12, 0, c.accent, INK, 3)
  rrect(g, 6, -146, 30, 34, 5, '#c9ccd3', INK, 4)
  for (const [i, col] of ['#ff4040', '#40ff80', '#57f2ff'].entries()) {
    g.fillStyle = col
    g.fillRect(11 + i * 8, -140, 5, 6)
  }
  // brazo delantero
  g.save()
  g.translate(2, -150)
  g.rotate(o.arm ?? 0.25)
  rrect(g, -13, -4, 26, 64, 12, c.suit)
  rrect(g, -13, 16, 26, 9, 0, c.accent, INK, 3)
  circle(g, 0, 66, 15, '#8a909b')
  if (o.gun) {
    g.save()
    g.translate(4, 66)
    g.rotate(-(o.arm ?? 0.25) - 0.05)
    rrect(g, -18, -12, 104, 18, 4, '#2b2f38', INK, 4)
    rrect(g, 86, -8, 34, 8, 2, '#7d8594', INK, 3)
    rrect(g, -6, 4, 16, 26, 3, '#22252b', INK, 4)
    g.fillStyle = '#8fe3ff'
    g.fillRect(20, -8, 36, 5)
    g.restore()
  }
  g.restore()
  // anillo del cuello y casco
  rrect(g, -30, -184, 60, 14, 5, '#c9ced8', INK, 4)
  circle(g, 0, -224, 50, c.helmet)
  // visor naranja oscuro con reflejo
  g.save()
  g.beginPath()
  g.ellipse(16, -224, 34, 31, 0, 0, TAU)
  const vg = g.createLinearGradient(-10, -256, 40, -196)
  vg.addColorStop(0, '#ffb057')
  vg.addColorStop(0.35, '#d2610d')
  vg.addColorStop(1, '#4a1c00')
  g.fillStyle = vg
  g.fill()
  g.lineWidth = 5
  g.strokeStyle = INK
  g.stroke()
  g.clip()
  g.fillStyle = 'rgba(255,244,220,.75)'
  g.beginPath()
  g.ellipse(2, -240, 16, 6, -0.7, 0, TAU)
  g.fill()
  g.fillStyle = 'rgba(255,244,220,.45)'
  g.beginPath()
  g.ellipse(34, -210, 7, 3, -0.7, 0, TAU)
  g.fill()
  g.restore()
  g.restore()
}

/** Alien: saco con patas, un ojo furioso y demasiados dientes. Origen en los pies; altura ≈ 130. */
function alien(g: G, x: number, y: number, s: number, color: string, t: number, ph: number): void {
  const hop = Math.abs(Math.sin(t * 9 + ph)) * 14
  g.save()
  g.translate(x, y - hop * s)
  g.scale(s, s)
  g.lineJoin = 'round'
  const sw = Math.sin(t * 9 + ph) * 8
  rrect(g, -34 + sw, -22, 26, 26, 9, color)
  rrect(g, 8 - sw, -22, 26, 26, 9, color)
  // antenas
  g.lineWidth = 6
  g.strokeStyle = INK
  for (const sd of [-1, 1]) {
    g.beginPath()
    g.moveTo(sd * 16, -118)
    g.quadraticCurveTo(sd * 30, -150, sd * 40 + sw * 0.4, -152)
    g.stroke()
    circle(g, sd * 40 + sw * 0.4, -152, 6, '#d8ff7a', 3)
  }
  g.beginPath()
  g.moveTo(-44, -30)
  g.bezierCurveTo(-56, -130, 56, -130, 46, -30)
  g.quadraticCurveTo(0, -4, -44, -30)
  g.fillStyle = color
  g.fill()
  g.lineWidth = 5
  g.stroke()
  g.fillStyle = 'rgba(20,10,40,.22)'
  g.beginPath()
  g.ellipse(-8, -34, 34, 12, 0, 0, TAU)
  g.fill()
  // ojo
  circle(g, 12, -88, 17, '#fff8d0', 4)
  circle(g, 17, -86, 7, '#1b1838', 0)
  g.lineWidth = 6
  g.beginPath()
  g.moveTo(-8, -110)
  g.lineTo(32, -100)
  g.stroke()
  // boca con dientes
  g.beginPath()
  g.moveTo(-18, -58)
  g.quadraticCurveTo(10, -32, 38, -60)
  g.quadraticCurveTo(10, -50, -18, -58)
  g.fillStyle = '#3e0715'
  g.fill()
  g.lineWidth = 4
  g.stroke()
  g.fillStyle = '#fff'
  for (let i = 0; i < 5; i++) {
    g.beginPath()
    g.moveTo(-10 + i * 10, -55)
    g.lineTo(-5 + i * 10, -44)
    g.lineTo(0 + i * 10, -55)
    g.fill()
  }
  g.restore()
}

const HORDE = (() => {
  const r = seeded(99)
  const cols = ['#ff4a4a', '#ff4a4a', '#ff4a4a', '#35e0ff', '#59c25a']
  return Array.from({ length: 30 }, () => ({ x: r(), y: r(), s: 0.75 + r() * 0.5, c: cols[Math.floor(r() * cols.length)], ph: r() * TAU }))
    .sort((a, b) => a.y - b.y)
})()

function horde(g: G, x0: number, x1: number, y0: number, y1: number, t: number, scale = 1, n = HORDE.length): void {
  for (const a of HORDE.slice(0, n).sort((p, q) => p.y - q.y)) {
    const k = 0.55 + a.y * 0.6
    alien(g, lerp(x0, x1, a.x), lerp(y0, y1, a.y), a.s * k * scale * (a.c === '#59c25a' ? 1.5 : 1), a.c, t, a.ph)
  }
}

function dust(g: G, x: number, y: number, r: number, a: number, col = '236,170,110'): void {
  const gr = g.createRadialGradient(x, y, 0, x, y, r)
  gr.addColorStop(0, `rgba(${col},${a})`)
  gr.addColorStop(1, `rgba(${col},0)`)
  g.fillStyle = gr
  g.fillRect(x - r, y - r, r * 2, r * 2)
}

function buggy(g: G, x: number, y: number, s: number, t: number, a: IntroColors, b: IntroColors, moving: boolean, crew = true): void {
  g.save()
  g.translate(x, y)
  g.scale(s, s)
  g.lineJoin = 'round'
  if (moving) {
    const beam = g.createLinearGradient(140, 0, 520, 0)
    beam.addColorStop(0, 'rgba(255,227,74,.5)')
    beam.addColorStop(1, 'rgba(255,227,74,0)')
    g.fillStyle = beam
    g.beginPath()
    g.moveTo(140, -72)
    g.lineTo(520, -130)
    g.lineTo(520, 10)
    g.closePath()
    g.fill()
  }
  // tripulantes (sólo se ve medio cuerpo)
  if (crew) {
    astronaut(g, -52, -40, 0.62, b, { sit: true, arm: -0.3 })
    astronaut(g, 14, -40, 0.62, a, { sit: true, arm: -1.2 })
  }
  // barra antivuelco y volante
  g.lineWidth = 8
  g.strokeStyle = INK
  g.beginPath()
  g.moveTo(-118, -76)
  g.lineTo(-104, -196)
  g.lineTo(-10, -206)
  g.stroke()
  g.lineWidth = 6
  g.beginPath()
  g.moveTo(74, -84)
  g.lineTo(52, -118)
  g.stroke()
  circle(g, 50, -122, 13, '#22252b', 4)
  // carrocería
  rrect(g, -140, -92, 280, 50, 12, '#f1f2ee')
  rrect(g, 60, -112, 84, 36, 10, '#f1f2ee')
  rrect(g, -108, -46, 216, 14, 5, '#c8222e')
  rrect(g, -146, -108, 22, 28, 5, '#d4d7dc')
  rrect(g, 132, -98, 16, 22, 4, '#ffe34a')
  // ruedas
  for (const wx of [-88, 92]) {
    circle(g, wx, -22, 36, '#15161a')
    circle(g, wx, -22, 16, '#8c919c', 4)
    g.save()
    g.translate(wx, -22)
    g.rotate(moving ? t * 16 : 0)
    g.lineWidth = 5
    for (let i = 0; i < 3; i++) {
      g.rotate(TAU / 6)
      g.beginPath()
      g.moveTo(-15, 0)
      g.lineTo(15, 0)
      g.stroke()
    }
    g.restore()
  }
  g.restore()
}

function comicWord(g: G, text: string, x: number, y: number, size: number, rot: number, fill = '#ffd21f'): void {
  g.save()
  g.translate(x, y)
  g.rotate(rot)
  g.font = `${size}px Bangers, Audiowide, Impact, sans-serif`
  g.textAlign = 'center'
  g.lineJoin = 'round'
  g.lineWidth = size * 0.16
  g.strokeStyle = INK
  g.strokeText(text, 0, 0)
  g.fillStyle = fill
  g.fillText(text, 0, 0)
  g.restore()
}

// ---------- Las cinco viñetas ----------
type Ctx = { a: IntroColors; b: IntroColors }
type Panel = { text: string; dur: number; draw: (g: G, t: number, c: Ctx) => void; cue?: [number, () => void][] }

const PANELS: Panel[] = [
  {
    text: 'Tras meses a la deriva, el cohete de la expedición alcanza por fin su destino: un planeta naranja y arenoso que no aparece en ningún mapa.',
    dur: 7.5,
    cue: [[0.2, () => sfx.launch()]],
    draw(g, t) {
      g.fillStyle = '#030514'
      g.fillRect(0, 0, W, H)
      const neb = g.createRadialGradient(300, 200, 20, 300, 200, 900)
      neb.addColorStop(0, 'rgba(60,50,120,.5)')
      neb.addColorStop(1, 'rgba(3,5,20,0)')
      g.fillStyle = neb
      g.fillRect(0, 0, W, H)
      stars(g, t, H, t * 5)
      // planeta naranja arenoso
      const px = 1180 - t * 12
      const py = 640 - t * 4
      const pr = 360 + t * 16
      dust(g, px, py, pr * 1.3, 0.28, '255,150,70')
      g.save()
      g.beginPath()
      g.arc(px, py, pr, 0, TAU)
      g.clip()
      const pg = g.createRadialGradient(px - pr * 0.45, py - pr * 0.5, pr * 0.1, px, py, pr * 1.05)
      pg.addColorStop(0, '#ffd08a')
      pg.addColorStop(0.35, '#ee8a3c')
      pg.addColorStop(0.7, '#a94c1c')
      pg.addColorStop(1, '#2c1006')
      g.fillStyle = pg
      g.fillRect(px - pr, py - pr, pr * 2, pr * 2)
      // bandas de dunas y cráteres
      g.lineCap = 'round'
      const r = seeded(31)
      for (let i = 0; i < 9; i++) {
        g.strokeStyle = `rgba(${i % 2 ? '120,50,15' : '255,215,150'},${0.16 + r() * 0.12})`
        g.lineWidth = pr * (0.03 + r() * 0.05)
        g.beginPath()
        const yy = py - pr + (i + 0.6) * (pr * 2) / 9
        g.moveTo(px - pr, yy + 30)
        g.bezierCurveTo(px - pr * 0.4, yy - 40 * r(), px + pr * 0.3, yy + 50 * r(), px + pr, yy - 20)
        g.stroke()
      }
      for (let i = 0; i < 7; i++) {
        const cx = px + (r() - 0.6) * pr * 1.3
        const cy = py + (r() - 0.6) * pr * 1.3
        const cr = pr * (0.03 + r() * 0.06)
        g.fillStyle = 'rgba(110,45,14,.35)'
        g.beginPath()
        g.ellipse(cx, cy, cr * 1.3, cr, 0.4, 0, TAU)
        g.fill()
      }
      g.restore()
      // cohete acercándose al planeta
      const k = easeOut(t / 7)
      const rx = lerp(-160, 760, k)
      const ry = lerp(150, 430, k)
      rocket(g, rx, ry, lerp(0.95, 0.42, k), Math.atan2(280, 920) + Math.PI / 2, t, 190)
    },
  },
  {
    text: 'El cohete aterriza en una explanada amurallada. Parece desierta... pero algo enorme los observa desde las sombras.',
    dur: 7.5,
    cue: [[0.1, () => sfx.launch()], [4.7, () => sfx.slam()], [5.6, () => sfx.roar()]],
    draw(g, t) {
      const hz = 560
      duskSky(g, hz, t)
      dunes(g, hz, 0)
      // muros de la arena (bloques con tacos)
      const wall = (x: number, w: number, top: number): void => {
        rrect(g, x, top, w, hz + 110 - top, 0, '#4a4f5c')
        g.fillStyle = 'rgba(15,16,30,.28)'
        for (let yy = top + 46; yy < hz + 100; yy += 46) g.fillRect(x, yy, w, 5)
        for (let xx = x + 14; xx < x + w - 30; xx += 46) rrect(g, xx, top - 14, 30, 14, 3, '#5d6472', INK, 4)
      }
      // el jefe acecha tras el muro derecho
      const peek = easeOut((t - 4.6) / 1.6)
      g.save()
      g.translate(1390, 640 - peek * 250)
      g.beginPath()
      g.moveTo(-190, 200)
      g.bezierCurveTo(-220, -200, 220, -200, 190, 200)
      g.fillStyle = '#2a0e45'
      g.fill()
      g.lineWidth = 6
      g.strokeStyle = INK
      g.stroke()
      const eye = 0.5 + 0.5 * Math.sin(t * 6)
      for (const sx of [-60, 70]) {
        dust(g, sx, -40, 70, 0.5 * peek, '200,90,255')
        circle(g, sx, -40, 20, `rgba(${220 + eye * 35},120,255,${peek})`, 0)
      }
      g.restore()
      wall(-10, 330, 380)
      wall(1230, 380, 420)
      // plataforma de aterrizaje
      g.fillStyle = '#22262f'
      g.beginPath()
      g.ellipse(760, 742, 250, 44, 0, 0, TAU)
      g.fill()
      g.lineWidth = 8
      g.strokeStyle = '#ffc61a'
      g.stroke()
      const k = easeOut(t / 4.6)
      const ry = lerp(-140, 736, k)
      const landed = t > 4.6
      const near = clamp01(1 - (736 - ry) / 420)
      const shake = landed ? 0 : Math.sin(t * 70) * 3
      rocket(g, 760 + shake, ry, 0.95, 0, t, landed ? Math.max(0, 80 - (t - 4.6) * 200) : lerp(300, 150, k))
      // polvo levantado por el chorro, simétrico a ambos lados del eje del cohete
      const settle = landed ? clamp01(1 - (t - 4.6) / 2.4) : 1
      for (let i = 0; i < 7; i++) {
        const grow = 60 + i * 74 + Math.sin(t * 3 + i) * 14
        const r = (70 + i * 22) * near
        for (const sd of [-1, 1]) dust(g, 760 + sd * grow * near, 748 - i * 6, r, 0.5 * near * settle)
      }
    },
  },
  {
    text: '¡Emboscada! Una horda de aliens se abalanza sobre ellos. Los astronautas huyen en el buggy rumbo a la vieja armería.',
    dur: 7.5,
    cue: [[0.1, () => sfx.alien()], [1.4, () => sfx.roar()], [3.2, () => sfx.alien()]],
    draw(g, t, c) {
      const hz = 520
      duskSky(g, hz, t)
      dunes(g, hz, t * 900)
      // la armería a lo lejos
      const bx = 1340 - t * 26
      rrect(g, bx, 380, 330, 190, 0, '#5d6472')
      rrect(g, bx - 16, 362, 362, 26, 0, '#3a3f49')
      rrect(g, bx + 40, 450, 120, 120, 0, '#c8222e')
      for (let i = 0; i < 4; i++) rrect(g, bx + 200 + i * 28, 420, 18, 18, 0, '#ffe98a', INK, 3)
      // rocas que pasan
      const r = seeded(8)
      for (let i = 0; i < 6; i++) {
        const sx = ((r() * 2400 - t * 1100) % 2400 + 2400) % 2400 - 400
        rrect(g, sx, 800 + r() * 60, 60 + r() * 80, 22 + r() * 20, 10, '#8e4a22', INK, 4)
      }
      // el jefe gigante al fondo, entre la bruma
      g.save()
      g.globalAlpha = 0.75
      g.translate(150 + t * 6, 600)
      g.beginPath()
      g.moveTo(-170, 0)
      g.bezierCurveTo(-200, -420, 200, -420, 170, 0)
      g.fillStyle = '#3a1460'
      g.fill()
      for (const sx of [-50, 60]) circle(g, sx, -230, 18, '#e9a0ff', 0)
      g.restore()
      for (let i = 0; i < 9; i++) dust(g, 60 + i * 70 + t * 30, 770 + (i % 3) * 30, 150, 0.35)
      horde(g, -120 + t * 34, 560 + t * 34, 590, 850, t)
      // estela del buggy
      const bxx = 1010 + Math.sin(t * 2.1) * 26
      const by = 800 + Math.abs(Math.sin(t * 13)) * -10
      for (let i = 0; i < 6; i++) dust(g, bxx - 170 - i * 60, 800 - i * 10, 50 + i * 26, 0.5 - i * 0.07)
      buggy(g, bxx, by, 1.15, t, c.a, c.b, true)
      // líneas de velocidad
      g.strokeStyle = 'rgba(255,240,210,.5)'
      g.lineWidth = 4
      const rs = seeded(5)
      for (let i = 0; i < 12; i++) {
        const ly = 590 + rs() * 280
        const lx = ((rs() * 2000 - t * 1700) % 2000 + 2000) % 2000 - 200
        g.beginPath()
        g.moveTo(lx, ly)
        g.lineTo(lx + 110 + rs() * 120, ly)
        g.stroke()
      }
      if (t > 0.5 && t < 3) comicWord(g, '¡CORRE!', 1120, 300, 110, -0.1)
    },
  },
  {
    text: 'Entran al edificio y bajan el portón del garaje en el último segundo. Los golpes retumban al otro lado.',
    dur: 7.5,
    cue: [[0.1, () => sfx.lever()], [0.3, () => sfx.door()], [4.3, () => sfx.slam()], [5.2, () => sfx.hit()], [5.9, () => sfx.hit()]],
    draw(g, t, c) {
      const closed = t > 4.3
      const sh = closed && t < 4.9 ? Math.sin(t * 90) * 10 * (1 - (t - 4.3) / 0.6) : 0
      g.save()
      g.translate(sh, 0)
      // exterior visto a través del portón
      const dx = 150
      const dy = 170
      const dw = 760
      const dh = 520
      g.save()
      g.beginPath()
      g.rect(dx, dy, dw, dh)
      g.clip()
      const sky = g.createLinearGradient(0, dy, 0, dy + dh)
      sky.addColorStop(0, '#3a2350')
      sky.addColorStop(0.5, '#ff9a4a')
      sky.addColorStop(0.5, '#e08a40')
      sky.addColorStop(1, '#b4571f')
      g.fillStyle = sky
      g.fillRect(dx, dy, dw, dh)
      for (let i = 0; i < 6; i++) dust(g, dx + 80 + i * 130, dy + 380, 150, 0.4)
      horde(g, dx + 40, dx + dw - 40, dy + 330, dy + dh + 20, t, 0.9 + easeIn(t / 4.3) * 0.7, 20)
      g.restore()
      // persiana metálica bajando
      const bottom = lerp(dy + 40, dy + dh, easeIn(t / 4.3))
      g.save()
      g.beginPath()
      g.rect(dx, dy, dw, bottom - dy)
      g.clip()
      g.fillStyle = '#8c919c'
      g.fillRect(dx, dy, dw, dh)
      for (let yy = bottom; yy > dy - 40; yy -= 40) {
        g.fillStyle = 'rgba(20,22,40,.3)'
        g.fillRect(dx, yy - 8, dw, 8)
        g.fillStyle = 'rgba(255,255,255,.18)'
        g.fillRect(dx, yy - 36, dw, 5)
      }
      rrect(g, dx, bottom - 26, dw, 26, 0, '#ffc61a', INK, 5)
      if (closed) {
        // abolladuras de los golpes
        for (const [bx, by, at] of [[420, 420, 5.2], [660, 520, 5.9], [300, 560, 6.5]] as [number, number, number][]) {
          if (t < at) continue
          const pulse = 1 + Math.max(0, 0.25 - (t - at)) * 2
          g.fillStyle = 'rgba(20,22,40,.35)'
          g.beginPath()
          g.ellipse(bx, by, 60 * pulse, 46 * pulse, 0, 0, TAU)
          g.fill()
          g.strokeStyle = 'rgba(255,255,255,.35)'
          g.lineWidth = 4
          g.beginPath()
          g.ellipse(bx - 6, by - 6, 52 * pulse, 38 * pulse, 0, 3.4, 5.4)
          g.stroke()
        }
      }
      g.restore()
      // paredes del garaje rojo alrededor del hueco
      g.fillStyle = '#5a1f26'
      g.fillRect(0, 0, W, dy)
      g.fillRect(0, dy, dx, H)
      g.fillRect(dx + dw, dy, W, H)
      g.fillStyle = 'rgba(0,0,0,.22)'
      for (let x = dx + dw + 110; x < W; x += 170) g.fillRect(x, 0, 8, 700)
      g.lineWidth = 12
      g.strokeStyle = '#ffc61a'
      g.strokeRect(dx, dy, dw, dh)
      g.lineWidth = 5
      g.strokeStyle = INK
      g.strokeRect(dx - 8, dy - 8, dw + 16, dh + 16)
      // suelo con líneas de aparcamiento
      const fl = g.createLinearGradient(0, 690, 0, H)
      fl.addColorStop(0, '#4a4f5c')
      fl.addColorStop(1, '#2a2d35')
      g.fillStyle = fl
      g.fillRect(0, 690, W, H - 690)
      g.fillStyle = '#ffc61a'
      for (const x of [980, 1480]) {
        g.beginPath()
        g.moveTo(x, 700)
        g.lineTo(x + 20, 700)
        g.lineTo(x + 70, H)
        g.lineTo(x + 30, H)
        g.fill()
      }
      // lámparas del techo
      for (const x of [520, 1250]) {
        rrect(g, x - 60, 40, 120, 22, 4, '#22252b')
        const cone = g.createLinearGradient(0, 62, 0, 620)
        cone.addColorStop(0, 'rgba(255,240,190,.32)')
        cone.addColorStop(1, 'rgba(255,240,190,0)')
        g.fillStyle = cone
        g.beginPath()
        g.moveTo(x - 50, 62)
        g.lineTo(x + 50, 62)
        g.lineTo(x + 280, 700)
        g.lineTo(x - 280, 700)
        g.fill()
      }
      // palanca junto al portón y compañero accionándola
      rrect(g, 950, 380, 70, 110, 6, '#2a2d35')
      rrect(g, 944, 372, 82, 16, 3, '#ffc61a', INK, 4)
      circle(g, 985, 410, 10, closed ? '#3bff8a' : '#ff3b4a', 4)
      const lv = lerp(-0.9, 0.9, easeOut(t / 0.9))
      g.save()
      g.translate(985, 450)
      g.rotate(lv)
      rrect(g, -5, -70, 10, 70, 4, '#c7ccd6', INK, 4)
      rrect(g, -18, -84, 36, 20, 8, '#e5384b', INK, 4)
      g.restore()
      astronaut(g, 1090, 800, 1.05, c.b, { flip: true, arm: lerp(2.6, 1.7, easeOut(t / 0.9)) })
      buggy(g, 1340, 850, 0.9, 0, c.a, c.b, false, false)
      // el protagonista, en primer plano, mira cómo se cierra el portón
      astronaut(g, 800, 930, 1.5, c.a, { flip: true, arm: 0.2, step: 0.25 })
      g.restore()
      if (closed && t < 5.4) comicWord(g, '¡CLANG!', 560, 320, 150, -0.12)
      if (t > 5.2 && t < 6.9) comicWord(g, '¡BUM!', 420 + (t > 5.9 ? 240 : 0), t > 5.9 ? 420 : 330, 96, 0.1, '#ff7a22')
    },
  },
  {
    text: 'Llegan a la armería y se arman hasta los dientes. Pero el oxígeno escasea... y uno de los astronautas se desmaya.',
    dur: 8,
    cue: [[0.4, () => sfx.weapon()], [1.3, () => sfx.pickup()], [3.0, () => sfx.turretLock()], [5.2, () => sfx.slam()]],
    draw(g, t, c) {
      // armería: paneles metálicos, armeros y cajas
      const bg = g.createLinearGradient(0, 0, 0, 700)
      bg.addColorStop(0, '#1d2740')
      bg.addColorStop(1, '#34446a')
      g.fillStyle = bg
      g.fillRect(0, 0, W, 700)
      g.fillStyle = 'rgba(0,0,0,.22)'
      for (let x = 0; x < W; x += 200) g.fillRect(x, 0, 8, 700)
      const fl = g.createLinearGradient(0, 700, 0, H)
      fl.addColorStop(0, '#59607a')
      fl.addColorStop(1, '#2b3044')
      g.fillStyle = fl
      g.fillRect(0, 700, W, 200)
      rrect(g, -10, 690, W + 20, 18, 0, '#ffc61a', INK, 4)
      const gunShape = (x: number, y: number, kind: number): void => {
        rrect(g, x, y, kind === 2 ? 190 : 150, 20, 4, kind === 1 ? '#6b3b1e' : '#2b2f38', INK, 4)
        rrect(g, x + (kind === 2 ? 190 : 150), y + 4, kind === 2 ? 90 : 50, 10, 2, '#8a93a6', INK, 3)
        rrect(g, x + 30, y + 18, 18, 30, 3, '#22252b', INK, 4)
        rrect(g, x - 36, y + 2, 40, 24, 4, kind === 1 ? '#4a2a14' : '#3b414d', INK, 4)
        if (kind !== 1) {
          g.fillStyle = kind === 2 ? '#ffd24a' : '#8fe3ff'
          g.fillRect(x + 60, y + 5, 50, 5)
        }
      }
      for (const [rx, ry] of [[90, 150], [620, 110], [1130, 150]]) {
        rrect(g, rx, ry, 400, 330, 8, '#252c44')
        for (let i = 0; i < 3; i++) {
          rrect(g, rx + 16, ry + 86 + i * 96, 368, 12, 3, '#5d6472', INK, 4)
          // el compañero se lleva las armas del armero central
          const taken = rx === 620 && t > 0.5 + i * 0.5
          if (!taken) gunShape(rx + 96, ry + 34 + i * 96, (i + rx) % 3)
        }
      }
      // pedestal con la pistola láser
      rrect(g, 730, 600, 180, 110, 6, '#3a3f49')
      rrect(g, 716, 586, 208, 22, 4, '#57f2ff', INK, 4)
      dust(g, 820, 560, 110, 0.45, '255,226,122')
      rrect(g, 780, 548, 80, 20, 4, '#22252b', INK, 4)
      rrect(g, 790, 566, 20, 28, 3, '#22252b', INK, 4)
      g.fillStyle = '#ffe27a'
      g.fillRect(800, 553, 44, 5)
      // cajas de munición
      rrect(g, 60, 610, 170, 100, 6, '#4b5a2a')
      rrect(g, 60, 640, 170, 16, 0, '#ffc61a', INK, 4)
      rrect(g, 1390, 590, 150, 120, 6, '#4b5a2a')
      rrect(g, 1390, 624, 150, 16, 0, '#ffc61a', INK, 4)
      // compañero armado
      astronaut(g, 430, 850, 1.45, c.b, { arm: -1.25, gun: true })
      // protagonista: se tambalea y cae
      const sway = t > 2.6 && t < 4.4 ? Math.sin((t - 2.6) * 5) * 0.09 * (t - 2.6) : 0
      const fall = easeIn((t - 4.4) / 0.9)
      astronaut(g, 1120 - fall * 150, 850 - fall * 10, 1.5, c.a, { flip: true, rot: sway - fall * 1.5, arm: t < 2.6 ? 0.9 : lerp(0.9, 0.1, clamp01(t - 2.6)), step: sway * 2 })
      if (t > 5.2 && t < 7) comicWord(g, '¡PLOF!', 1150, 610, 110, 0.08, '#fff7d6')
      // medidor de oxígeno
      const o2 = clamp01(1 - t / 4.4) * 0.32
      const blink = t > 2.2 && Math.floor(t * 5) % 2 === 0
      rrect(g, 1080, 40, 480, 110, 12, 'rgba(10,14,34,.9)', blink ? '#ff3b4a' : '#57f2ff', 6)
      g.font = '44px Audiowide, sans-serif'
      g.textAlign = 'left'
      g.fillStyle = blink ? '#ff3b4a' : '#57f2ff'
      g.fillText('O₂', 1104, 108)
      rrect(g, 1190, 70, 340, 44, 8, '#1b1838', '#0b0d1c', 4)
      rrect(g, 1196, 76, Math.max(6, 328 * o2), 32, 5, o2 < 0.12 ? '#ff3b4a' : '#ffc61a', INK, 0)
      if (t > 2.2) {
        g.font = '26px Audiowide, sans-serif'
        g.fillStyle = '#ff3b4a'
        g.fillText(blink ? '¡OXÍGENO AGOTADO!' : '', 1190, 142)
      }
      // la vista se apaga
      const dark = easeIn((t - 3.2) / 3.6)
      if (dark > 0) {
        const vg = g.createRadialGradient(W / 2, H / 2, 900 * (1 - dark * 0.92), W / 2, H / 2, 950)
        vg.addColorStop(0, `rgba(0,0,0,${dark * 0.75})`)
        vg.addColorStop(1, 'rgba(0,0,0,1)')
        g.fillStyle = vg
        g.fillRect(0, 0, W, H)
      }
    },
  },
]

// ---------- Llegada a Bershna (dos viñetas, tras el nivel del cohete) ----------
function paleMoon(g: G, x: number, y: number, rad: number): void {
  circle(g, x, y, rad, '#e2dbd4', 0)
  const q = seeded(77)
  for (let i = 0; i < 16; i++) {
    const a = q() * TAU
    const d = q() * rad * 0.82
    g.fillStyle = `rgba(120,118,128,${0.14 + q() * 0.2})`
    g.beginPath()
    g.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, rad * (0.04 + q() * 0.1), 0, TAU)
    g.fill()
  }
}

const BERSHNA_PANELS: Panel[] = [
  {
    text: 'El cinturón de meteoritos queda atrás. Ante el cohete aparece Bershna: un mundo rojo y silencioso, con una luna enorme vigilando su cielo.',
    dur: 7.5,
    cue: [[0.2, () => sfx.launch()]],
    draw(g, t) {
      g.fillStyle = '#04051a'
      g.fillRect(0, 0, W, H)
      const neb = g.createRadialGradient(400, 250, 20, 400, 250, 900)
      neb.addColorStop(0, 'rgba(110,40,70,.45)')
      neb.addColorStop(1, 'rgba(4,5,26,0)')
      g.fillStyle = neb
      g.fillRect(0, 0, W, H)
      stars(g, t, H, t * 5)
      paleMoon(g, 1330 - t * 5, 210, 130)
      const px = 1060 - t * 11
      const py = 700 - t * 4
      const pr = 400 + t * 15
      dust(g, px, py, pr * 1.28, 0.3, '255,110,80')
      g.save()
      g.beginPath()
      g.arc(px, py, pr, 0, TAU)
      g.clip()
      const pg = g.createRadialGradient(px - pr * 0.45, py - pr * 0.5, pr * 0.1, px, py, pr * 1.05)
      pg.addColorStop(0, '#ffb894')
      pg.addColorStop(0.35, '#d8553a')
      pg.addColorStop(0.7, '#8a2a1c')
      pg.addColorStop(1, '#1c0604')
      g.fillStyle = pg
      g.fillRect(px - pr, py - pr, pr * 2, pr * 2)
      const r = seeded(53)
      g.lineCap = 'round'
      for (let i = 0; i < 8; i++) {
        g.strokeStyle = `rgba(${i % 2 ? '90,20,12' : '255,190,160'},${0.14 + r() * 0.12})`
        g.lineWidth = pr * (0.03 + r() * 0.05)
        const yy = py - pr + (i + 0.6) * (pr * 2) / 8
        g.beginPath()
        g.moveTo(px - pr, yy + 20)
        g.bezierCurveTo(px - pr * 0.4, yy - 50 * r(), px + pr * 0.3, yy + 50 * r(), px + pr, yy - 20)
        g.stroke()
      }
      g.restore()
      const k = easeOut(t / 7)
      rocket(g, lerp(-160, 720, k), lerp(170, 470, k), lerp(0.95, 0.42, k), Math.atan2(300, 880) + Math.PI / 2, t, 190)
    },
  },
  {
    text: 'El cohete se posa sobre su soporte, dentro de un perímetro amurallado. A lo lejos, cúpulas abandonadas. Ni una sola luz encendida.',
    dur: 7.4,
    cue: [[0.1, () => sfx.launch()], [4.7, () => sfx.slam()]],
    draw(g, t) {
      const hz = 560
      duskSky(g, hz, t)
      paleMoon(g, 800, 300, 250)
      dunes(g, hz, 0)
      g.fillStyle = 'rgba(170,30,24,.22)'
      g.fillRect(0, hz - 30, W, H)
      // viviendas-cúpula abandonadas al fondo
      for (const [x, rad] of [[410, 84], [540, 56], [1120, 100], [1250, 66]]) {
        g.beginPath()
        g.arc(x, hz + 64, rad, Math.PI, 0)
        g.closePath()
        g.fillStyle = '#d9987a'
        g.fill()
        g.lineWidth = 5
        g.strokeStyle = INK
        g.stroke()
        g.beginPath()
        g.arc(x, hz + 64, rad * 0.66, Math.PI, 0)
        g.closePath()
        g.fillStyle = '#2c2230'
        g.fill()
        g.stroke()
      }
      const wall = (x: number, w: number, top: number): void => {
        rrect(g, x, top, w, hz + 110 - top, 0, '#5a2a26')
        g.fillStyle = 'rgba(15,6,10,.3)'
        for (let yy = top + 46; yy < hz + 100; yy += 46) g.fillRect(x, yy, w, 5)
        for (let xx = x + 14; xx < x + w - 30; xx += 60) rrect(g, xx, top - 20, 34, 20, 0, '#7a3a30', INK, 4)
      }
      wall(-10, 300, 390)
      wall(1310, 300, 420)
      g.fillStyle = '#3a2422'
      g.beginPath()
      g.ellipse(760, 742, 260, 44, 0, 0, TAU)
      g.fill()
      g.lineWidth = 8
      g.strokeStyle = '#ffc61a'
      g.stroke()
      // soporte: torre de celosía con dos brazos
      for (const x of [890, 940]) rrect(g, x, 400, 12, 340, 0, '#ffc61a', INK, 4)
      for (let y = 420; y < 720; y += 60) rrect(g, 884, y, 74, 10, 0, '#22262f', INK, 3)
      const k = easeOut(t / 4.6)
      const ry = lerp(-140, 736, k)
      const landed = t > 4.6
      const near = clamp01(1 - (736 - ry) / 420)
      rocket(g, 760 + (landed ? 0 : Math.sin(t * 70) * 3), ry, 0.95, 0, t, landed ? Math.max(0, 80 - (t - 4.6) * 200) : lerp(300, 150, k))
      if (landed) for (const y of [520, 620]) rrect(g, 800, y, 96, 12, 0, '#22262f', INK, 3)
      const settle = landed ? clamp01(1 - (t - 4.6) / 2) : 1
      for (let i = 0; i < 7; i++) {
        const grow = 60 + i * 74 + Math.sin(t * 3 + i) * 14
        for (const sd of [-1, 1]) dust(g, 760 + sd * grow * near, 748 - i * 6, (70 + i * 22) * near, 0.5 * near * settle, '230,120,90')
      }
      // la escena se funde a negro antes de empezar el nivel
      const dark = clamp01((t - 5.7) / 1.2)
      if (dark > 0) {
        g.fillStyle = `rgba(0,0,0,${dark})`
        g.fillRect(0, 0, W, H)
      }
    },
  },
]

export type IntroSet = 'start' | 'bershna'

export class Intro {
  private g: G
  private raf = 0
  private idx = 0
  private t0 = 0
  private last = 0
  private active = false
  private panels: Panel[] = PANELS
  /** Las viñetas de llegada terminan solas (acaban fundidas a negro). */
  private auto = false
  private ctx: Ctx = { a: { suit: '#f2f2ee', accent: '#d9342b', helmet: '#fff' }, b: { suit: '#f2c21a', accent: '#1b1d24', helmet: '#f4f4f0' } }
  private onDone: () => void = () => {}
  private readonly root: HTMLElement
  private readonly caption: HTMLElement
  private readonly count: HTMLElement
  private readonly hint: HTMLElement

  constructor() {
    const $ = (id: string): HTMLElement => document.getElementById(id) as HTMLElement
    this.root = $('intro')
    this.caption = $('intro-caption')
    this.count = $('intro-count')
    this.hint = $('intro-hint')
    const canvas = $('intro-canvas') as HTMLCanvasElement
    canvas.width = W
    canvas.height = H
    this.g = canvas.getContext('2d')!
    $('intro-skip').addEventListener('click', e => {
      e.stopPropagation()
      this.finish()
    })
    this.root.addEventListener('click', () => this.next())
    addEventListener('keydown', e => {
      if (!this.active) return
      if (e.code === 'Escape') this.finish()
      else if (e.code === 'Space' || e.code === 'Enter' || e.code === 'ArrowRight') this.next()
      else return
      e.preventDefault()
      e.stopImmediatePropagation()
    }, true)
  }

  /** Dibuja un instante concreto de una viñeta (para revisarlas en desarrollo). */
  still(i: number, t: number, set: IntroSet = 'start'): void {
    const PANELS = set === 'bershna' ? BERSHNA_PANELS : this.panels
    this.root.classList.remove('hidden', 'out')
    this.caption.textContent = PANELS[i].text
    this.caption.classList.add('in')
    this.g.save()
    this.g.clearRect(0, 0, W, H)
    PANELS[i].draw(this.g, t, this.ctx)
    this.g.restore()
  }

  get playing(): boolean {
    return this.active
  }

  /** `player` son los colores del aspecto elegido; el compañero viste de otro color. */
  play(player: IntroColors, onDone: () => void, set: IntroSet = 'start'): void {
    this.panels = set === 'bershna' ? BERSHNA_PANELS : PANELS
    this.auto = set === 'bershna'
    const mate: IntroColors = player.suit.toLowerCase() === '#f2c21a' ? { suit: '#f2f2ee', accent: '#d9342b', helmet: '#fff' } : { suit: '#f2c21a', accent: '#1b1d24', helmet: '#f4f4f0' }
    this.ctx = { a: player, b: mate }
    this.onDone = onDone
    this.active = true
    this.root.classList.remove('hidden', 'out')
    this.show(0)
    cancelAnimationFrame(this.raf)
    this.raf = requestAnimationFrame(this.tick)
  }

  private show(i: number): void {
    this.idx = i
    this.t0 = performance.now()
    this.last = 0
    const PANELS = this.panels
    this.caption.textContent = PANELS[i].text
    this.caption.classList.remove('in')
    void this.caption.offsetWidth
    this.caption.classList.add('in')
    this.count.innerHTML = PANELS.map((_, k) => `<i class="${k === i ? 'on' : k < i ? 'done' : ''}"></i>`).join('')
    this.hint.textContent = i === PANELS.length - 1 && !this.auto ? 'Clic o Espacio para despertar' : 'Clic o Espacio para continuar'
    this.hint.classList.remove('on')
  }

  private next(): void {
    if (!this.active) return
    if (performance.now() - this.t0 < 350) return // evita saltos dobles por el clic que abrió la intro
    if (this.idx >= this.panels.length - 1) this.finish()
    else this.show(this.idx + 1)
  }

  private finish(): void {
    if (!this.active) return
    this.active = false
    cancelAnimationFrame(this.raf)
    this.root.classList.add('out')
    const done = this.onDone
    this.onDone = () => {}
    done()
    window.setTimeout(() => this.root.classList.add('hidden'), 450)
  }

  private tick = (now: number): void => {
    if (!this.active) return
    const PANELS = this.panels
    const p = PANELS[this.idx]
    const t = (now - this.t0) / 1000
    for (const [at, fn] of p.cue ?? []) {
      if (this.last <= at && t > at) {
        try { fn() } catch { /* el audio puede no estar listo */ }
      }
    }
    this.last = t
    const last = this.idx === PANELS.length - 1
    const g = this.g
    g.save()
    g.clearRect(0, 0, W, H)
    p.draw(g, Math.min(t, last ? p.dur : p.dur + 1), this.ctx)
    g.restore()
    // fundido de entrada (y de salida en las viñetas intermedias)
    const fade = Math.max(1 - t / 0.35, last ? 0 : (t - (p.dur - 0.35)) / 0.35)
    if (fade > 0) {
      g.fillStyle = `rgba(5,8,22,${Math.min(1, fade)})`
      g.fillRect(0, 0, W, H)
    }
    if (t > 2.2) this.hint.classList.add('on')
    if (!last && t >= p.dur) this.show(this.idx + 1)
    else if (last && this.auto && t >= p.dur) {
      this.finish()
      return
    }
    this.raf = requestAnimationFrame(this.tick)
  }
}
