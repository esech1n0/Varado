// Entrada unificada: teclado + ratón con pointer lock + controles táctiles.
export class Input {
  keys = new Set<string>()
  private pressed = new Set<string>()
  lookX = 0
  lookY = 0
  mouseFire = false
  touchFire = false
  touchRun = false
  locked = false
  stick = { x: 0, y: 0 }
  touchMode = false
  wheel = 0
  onLockChange: (locked: boolean) => void = () => {}
  onFirstInput: () => void = () => {}
  private rmb = false

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.touchMode = matchMedia('(pointer: coarse)').matches && 'ontouchstart' in window
    addEventListener('keydown', e => {
      if ((e.target as HTMLElement | null)?.tagName === 'INPUT') return
      if (e.repeat) return
      this.onFirstInput()
      this.keys.add(e.code)
      this.pressed.add(e.code)
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault()
    })
    addEventListener('keyup', e => this.keys.delete(e.code))
    addEventListener('blur', () => {
      this.keys.clear()
      this.mouseFire = false
    })
    addEventListener('mousemove', e => {
      if (this.locked || this.rmb) {
        this.lookX += e.movementX
        this.lookY += e.movementY
      }
    })
    canvas.addEventListener('mousedown', e => {
      this.onFirstInput()
      if (e.button === 0) {
        this.mouseFire = true
        if (!this.locked) this.requestLock()
      }
      if (e.button === 2) this.rmb = true
    })
    addEventListener('mouseup', e => {
      if (e.button === 0) this.mouseFire = false
      if (e.button === 2) this.rmb = false
    })
    canvas.addEventListener('contextmenu', e => e.preventDefault())
    canvas.addEventListener(
      'wheel',
      e => {
        this.wheel += Math.sign(e.deltaY)
        e.preventDefault()
      },
      { passive: false },
    )
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas
      this.onLockChange(this.locked)
    })
    this.bindTouch()
  }

  requestLock(): void {
    if (this.touchMode) return
    try {
      const p = this.canvas.requestPointerLock() as unknown as Promise<void> | undefined
      p?.catch?.(() => {})
    } catch {
      /* el navegador puede rechazar el bloqueo; se juega con el ratón libre */
    }
  }
  exitLock(): void {
    if (document.pointerLockElement) document.exitPointerLock()
  }

  /** Eje de movimiento: f = adelante(+)/atrás(−), s = derecha(+)/izquierda(−). */
  axis(): { f: number; s: number } {
    let f = 0
    let s = 0
    if (this.keys.has('KeyW')) f += 1
    if (this.keys.has('KeyS')) f -= 1
    if (this.keys.has('KeyD')) s += 1
    if (this.keys.has('KeyA')) s -= 1
    f += -this.stick.y
    s += this.stick.x
    const m = Math.hypot(f, s)
    if (m > 1) {
      f /= m
      s /= m
    }
    return { f, s }
  }
  get fire(): boolean {
    return this.mouseFire || this.touchFire || this.keys.has('Space')
  }
  /** Devuelve true una sola vez por pulsación. */
  take(code: string): boolean {
    return this.pressed.delete(code)
  }
  consumeLook(): [number, number] {
    const r: [number, number] = [this.lookX, this.lookY]
    this.lookX = this.lookY = 0
    return r
  }
  consumeWheel(): number {
    const w = this.wheel
    this.wheel = 0
    return w
  }
  endFrame(): void {
    this.pressed.clear()
  }
  press(code: string): void {
    this.pressed.add(code)
  }

  private bindTouch(): void {
    const area = document.getElementById('touch')
    if (!area) return
    const stickEl = document.getElementById('stick')!
    const knob = document.getElementById('knob')!
    let sid = -1
    let lid = -1
    let sx = 0
    let sy = 0
    let lx = 0
    let ly = 0
    const R = 55
    document.addEventListener(
      'touchstart',
      e => {
        for (const t of Array.from(e.changedTouches)) {
          const el = t.target as HTMLElement
          if (el.closest?.('.tbtn') || el.closest?.('.ovl')) continue
          if (t.clientX < innerWidth * 0.45 && sid < 0) {
            sid = t.identifier
            sx = t.clientX
            sy = t.clientY
            stickEl.style.left = `${sx - 60}px`
            stickEl.style.top = `${sy - 60}px`
            stickEl.classList.add('on')
          } else if (lid < 0) {
            lid = t.identifier
            lx = t.clientX
            ly = t.clientY
          }
        }
      },
      { passive: true },
    )
    document.addEventListener(
      'touchmove',
      e => {
        for (const t of Array.from(e.changedTouches)) {
          if (t.identifier === sid) {
            const dx = t.clientX - sx
            const dy = t.clientY - sy
            const m = Math.min(1, Math.hypot(dx, dy) / R)
            const a = Math.atan2(dy, dx)
            this.stick.x = Math.cos(a) * m
            this.stick.y = Math.sin(a) * m
            knob.style.transform = `translate(${Math.cos(a) * m * R}px,${Math.sin(a) * m * R}px)`
          } else if (t.identifier === lid) {
            this.lookX += (t.clientX - lx) * 1.6
            this.lookY += (t.clientY - ly) * 1.6
            lx = t.clientX
            ly = t.clientY
          }
        }
      },
      { passive: true },
    )
    const end = (e: TouchEvent): void => {
      for (const t of Array.from(e.changedTouches)) {
        if (t.identifier === sid) {
          sid = -1
          this.stick.x = this.stick.y = 0
          knob.style.transform = ''
          stickEl.classList.remove('on')
        }
        if (t.identifier === lid) lid = -1
      }
    }
    document.addEventListener('touchend', end)
    document.addEventListener('touchcancel', end)
    const bind = (id: string, down: () => void, up?: () => void): void => {
      const b = document.getElementById(id)
      if (!b) return
      b.addEventListener(
        'touchstart',
        e => {
          e.preventDefault()
          this.onFirstInput()
          down()
        },
        { passive: false },
      )
      b.addEventListener('touchend', e => {
        e.preventDefault()
        up?.()
      })
    }
    bind('t-fire', () => (this.touchFire = true), () => (this.touchFire = false))
    bind('t-use', () => this.press('KeyE'))
    bind('t-swap', () => this.press('KeyQ'))
    bind('t-dash', () => this.press('KeyC'))
    bind('t-grenade', () => this.press('KeyG'))
    bind('t-zoom', () => this.press('KeyZ'))
    bind('t-run', () => (this.touchRun = true), () => (this.touchRun = false))
  }
}
