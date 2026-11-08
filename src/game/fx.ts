import * as THREE from 'three'

type P = { m: THREE.Mesh; vx: number; vy: number; vz: number; t: number; life: number }
const partGeo = new THREE.BoxGeometry(1, 1, 1)
const rnd = (a: number, b: number) => a + Math.random() * (b - a)

/** Partículas ligeras (cubitos) en el plano de simulación (x, y) con altura h. */
export class Fx {
  private parts: P[] = []
  private pool: THREE.Mesh[] = []
  constructor(private readonly root: THREE.Object3D, private readonly cap = 320) {}

  burst(x: number, y: number, n: number, color: number, sp = 140, life = 0.4, sz = 3, h = 24): void {
    for (let i = 0; i < n && this.parts.length < this.cap; i++) {
      const m = this.pool.pop() ?? new THREE.Mesh(partGeo, new THREE.MeshBasicMaterial({ transparent: true }))
      const mt = m.material as THREE.MeshBasicMaterial
      mt.color.setHex(color)
      mt.opacity = 1
      const s = sz * rnd(0.6, 1.2) * 0.9
      m.scale.set(s, s, s)
      m.position.set(x, h + rnd(-6, 6), y)
      this.root.add(m)
      const a = rnd(0, 6.283)
      const v = rnd(0.3, 1) * sp
      this.parts.push({ m, vx: Math.cos(a) * v, vy: rnd(0.1, 0.9) * sp * 0.9, vz: Math.sin(a) * v, t: 0, life: life * rnd(0.6, 1.2) })
    }
  }

  /** Chorro dirigido (escape de la nave, polvo, chispas). */
  jet(x: number, y: number, h: number, n: number, color: number, down = 260, spread = 40, life = 0.5, sz = 5): void {
    for (let i = 0; i < n && this.parts.length < this.cap; i++) {
      const m = this.pool.pop() ?? new THREE.Mesh(partGeo, new THREE.MeshBasicMaterial({ transparent: true }))
      const mt = m.material as THREE.MeshBasicMaterial
      mt.color.setHex(color)
      mt.opacity = 1
      const s = sz * rnd(0.6, 1.3)
      m.scale.set(s, s, s)
      m.position.set(x + rnd(-8, 8), h, y + rnd(-8, 8))
      this.root.add(m)
      this.parts.push({ m, vx: rnd(-spread, spread), vy: -rnd(0.5, 1) * down, vz: rnd(-spread, spread), t: 0, life: life * rnd(0.6, 1.2) })
    }
  }

  step(dt: number): void {
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const q = this.parts[i]
      q.t += dt
      q.vy -= 520 * dt
      q.m.position.x += q.vx * dt
      q.m.position.y += q.vy * dt
      q.m.position.z += q.vz * dt
      q.vx *= 0.95
      q.vz *= 0.95
      if (q.m.position.y < 1) {
        q.m.position.y = 1
        q.vy *= -0.3
      }
      ;(q.m.material as THREE.MeshBasicMaterial).opacity = Math.min(1, Math.max(0, 1 - q.t / q.life))
      if (q.t > q.life) {
        this.root.remove(q.m)
        this.pool.push(q.m)
        this.parts.splice(i, 1)
      }
    }
  }

  clear(): void {
    for (const q of this.parts) {
      this.root.remove(q.m)
      this.pool.push(q.m)
    }
    this.parts.length = 0
  }
}
