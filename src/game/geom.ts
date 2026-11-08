// Geometría 2D de la simulación: x = largo del mapa, y = z en 3D.
export type Rect = { x: number; y: number; w: number; h: number; on?: boolean; los?: boolean; s?: number; top?: number }
export type Circle = { x: number; y: number; r: number }

export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t
export const rnd = (a: number, b: number) => a + Math.random() * (b - a)
export const dist = (ax: number, ay: number, bx: number, by: number) => Math.hypot(ax - bx, ay - by)

export function seeded(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

/** Diferencia angular más corta de a hacia b, en (-PI, PI]. */
export function angDiff(a: number, b: number): number {
  let d = b - a
  while (d > Math.PI) d -= Math.PI * 2
  while (d < -Math.PI) d += Math.PI * 2
  return d
}

export function resolveCircle(c: Circle, r: Rect): boolean {
  const nx = clamp(c.x, r.x, r.x + r.w)
  const ny = clamp(c.y, r.y, r.y + r.h)
  const dx = c.x - nx
  const dy = c.y - ny
  const d2 = dx * dx + dy * dy
  if (d2 >= c.r * c.r) return false
  if (d2 < 1e-6) {
    const l = c.x - r.x
    const rr = r.x + r.w - c.x
    const t = c.y - r.y
    const b = r.y + r.h - c.y
    const m = Math.min(l, rr, t, b)
    if (m === l) c.x = r.x - c.r
    else if (m === rr) c.x = r.x + r.w + c.r
    else if (m === t) c.y = r.y - c.r
    else c.y = r.y + r.h + c.r
    return true
  }
  const d = Math.sqrt(d2)
  const push = c.r - d
  c.x += (dx / d) * push
  c.y += (dy / d) * push
  return true
}

export function segHit(x0: number, y0: number, x1: number, y1: number, r: Rect): boolean {
  let t0 = 0
  let t1 = 1
  const dx = x1 - x0
  const dy = y1 - y0
  const p = [-dx, dx, -dy, dy]
  const q = [x0 - r.x, r.x + r.w - x0, y0 - r.y, r.y + r.h - y0]
  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) {
      if (q[i] < 0) return false
    } else {
      const t = q[i] / p[i]
      if (p[i] < 0) {
        if (t > t1) return false
        if (t > t0) t0 = t
      } else {
        if (t < t0) return false
        if (t < t1) t1 = t
      }
    }
  }
  return true
}

/** Primer punto de impacto (0..1) del segmento contra un rectángulo, o -1 si no lo toca. */
export function segEnter(x0: number, y0: number, x1: number, y1: number, r: Rect): number {
  let t0 = 0
  let t1 = 1
  const dx = x1 - x0
  const dy = y1 - y0
  const p = [-dx, dx, -dy, dy]
  const q = [x0 - r.x, r.x + r.w - x0, y0 - r.y, r.y + r.h - y0]
  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) {
      if (q[i] < 0) return -1
    } else {
      const t = q[i] / p[i]
      if (p[i] < 0) {
        if (t > t1) return -1
        if (t > t0) t0 = t
      } else {
        if (t < t0) return -1
        if (t < t1) t1 = t
      }
    }
  }
  return t0
}

export const inRect = (x: number, y: number, r: Rect) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h

/** Distancia de un punto a un segmento. */
export function distSegPoint(px: number, py: number, x0: number, y0: number, x1: number, y1: number): number {
  const dx = x1 - x0
  const dy = y1 - y0
  const l2 = dx * dx + dy * dy
  const t = l2 === 0 ? 0 : clamp(((px - x0) * dx + (py - y0) * dy) / l2, 0, 1)
  return Math.hypot(px - (x0 + dx * t), py - (y0 + dy * t))
}

/** Rejilla uniforme para consultar sólidos cercanos sin recorrer todo el mapa. */
export class Grid {
  private cells = new Map<number, Rect[]>()
  private stamp = 0
  constructor(private readonly size = 256) {}
  private key(ix: number, iy: number) {
    return (ix + 128) * 512 + (iy + 128)
  }
  add(r: Rect): void {
    const x0 = Math.floor(r.x / this.size)
    const x1 = Math.floor((r.x + r.w) / this.size)
    const y0 = Math.floor(r.y / this.size)
    const y1 = Math.floor((r.y + r.h) / this.size)
    for (let ix = x0; ix <= x1; ix++) {
      for (let iy = y0; iy <= y1; iy++) {
        const k = this.key(ix, iy)
        const list = this.cells.get(k)
        if (list) list.push(r)
        else this.cells.set(k, [r])
      }
    }
  }
  query(x0: number, y0: number, x1: number, y1: number, out: Rect[]): Rect[] {
    out.length = 0
    const st = ++this.stamp
    const ax = Math.floor(Math.min(x0, x1) / this.size)
    const bx = Math.floor(Math.max(x0, x1) / this.size)
    const ay = Math.floor(Math.min(y0, y1) / this.size)
    const by = Math.floor(Math.max(y0, y1) / this.size)
    for (let ix = ax; ix <= bx; ix++) {
      for (let iy = ay; iy <= by; iy++) {
        const list = this.cells.get(this.key(ix, iy))
        if (!list) continue
        for (const r of list) {
          if (r.s === st || r.on === false) continue
          r.s = st
          out.push(r)
        }
      }
    }
    return out
  }
}

const tmp: Rect[] = []

/** Mueve un círculo contra la rejilla y rectángulos dinámicos extra. Devuelve si chocó. */
export function moveCircle(grid: Grid, extra: Rect[], c: Circle, dx: number, dy: number): boolean {
  let hit = false
  const step = (): void => {
    const list = grid.query(c.x - c.r - 1, c.y - c.r - 1, c.x + c.r + 1, c.y + c.r + 1, tmp)
    for (const r of list) if (resolveCircle(c, r)) hit = true
    for (const r of extra) if (r.on !== false && resolveCircle(c, r)) hit = true
  }
  c.x += dx
  step()
  c.y += dy
  step()
  return hit
}

/** ¿Hay línea de visión libre entre dos puntos? */
export function losClear(grid: Grid, extra: Rect[], x0: number, y0: number, x1: number, y1: number): boolean {
  const list = grid.query(x0, y0, x1, y1, tmp)
  for (const r of list) if (r.los !== false && segHit(x0, y0, x1, y1, r)) return false
  for (const r of extra) if (r.on !== false && segHit(x0, y0, x1, y1, r)) return false
  return true
}

/** Distancia hasta el primer sólido a lo largo de un rayo (o `max` si no hay). */
export function rayDistance(grid: Grid, extra: Rect[], x: number, y: number, dx: number, dy: number, max: number): number {
  const x1 = x + dx * max
  const y1 = y + dy * max
  let best = 1
  const list = grid.query(x, y, x1, y1, tmp)
  for (const r of list) {
    if (r.los === false) continue
    const t = segEnter(x, y, x1, y1, r)
    if (t >= 0 && t < best) best = t
  }
  for (const r of extra) {
    if (r.on === false) continue
    const t = segEnter(x, y, x1, y1, r)
    if (t >= 0 && t < best) best = t
  }
  return best * max
}
