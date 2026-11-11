import * as THREE from 'three'
import { makeSpaceRocket } from './gfx'
import { sfx } from './audio'
import { Input } from './input'
import { SPACE_LEVEL } from './config'

export interface SpaceLaser {
  mesh: THREE.Mesh
  x: number
  y: number
  vx: number
  vy: number
  life: number
  dmg: number
}

export interface Meteorite {
  mesh: THREE.Mesh
  x: number
  y: number
  vx: number
  vy: number
  rotX: number
  rotY: number
  rotZ: number
  vrotX: number
  vrotY: number
  vrotZ: number
  radius: number
  hp: number
  maxHp: number
  kind: 'small' | 'medium' | 'large'
}

export interface SpaceParticle {
  mesh: THREE.Mesh
  x: number
  y: number
  z: number
  vx: number
  vy: number
  vz: number
  life: number
  maxLife: number
  color: number
}

export interface ShootingStar {
  active: boolean
  x: number
  y: number
  vx: number
  vy: number
  t: number
  maxT: number
  mesh: THREE.Line
}

export interface SpaceStats {
  elapsed: number
  score: number
  asteroidsDestroyed: number
}

export class SpaceLevel {
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  rocket: THREE.Group
  thrusters: THREE.Group

  input: Input

  // Estado del nivel
  time = 0
  totalTime = SPACE_LEVEL.duration // 180 segundos (3 minutos)
  hp = SPACE_LEVEL.rocketHp
  maxHp = SPACE_LEVEL.rocketHp
  score = 0
  completed = false
  gameOver = false

  // Posición de la nave
  shipX = 0
  shipY = -150
  shipVx = 0
  shipVy = 0
  shipRoll = 0
  invuln = 0
  shootCd = 0

  // Colecciones
  lasers: SpaceLaser[] = []
  meteors: Meteorite[] = []
  particles: SpaceParticle[] = []

  // Estrellas y fondo
  private starLayers: { mesh: THREE.Points; speed: number; count: number }[] = []
  private jupiterMesh!: THREE.Mesh
  private jupiterGlow!: THREE.Mesh
  private shootingStar: ShootingStar | null = null
  private nextShootingStarT = 60 // Pasan cada minuto (60s, 120s, 180s)

  // Meteor Spawning
  private spawnTimer = 0
  private meteorGeoCache: THREE.BufferGeometry[] = []

  // Callbacks
  asteroidsDestroyed = 0
  onVictory?: (stats: SpaceStats) => void
  onDefeat?: (stats: SpaceStats) => void

  constructor(input: Input) {
    this.input = input
    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0x020410)

    // Cámara cenital con perspectiva amplia estilo Galaga
    this.camera = new THREE.PerspectiveCamera(54, window.innerWidth / window.innerHeight, 1, 2000)
    this.camera.position.set(0, 0, 500)
    this.camera.lookAt(0, 0, 0)

    // Iluminación espacial
    const amb = new THREE.AmbientLight(0x7080a8, 1.4)
    const sun = new THREE.DirectionalLight(0xfff5e6, 2.2)
    sun.position.set(200, 300, 400)
    this.scene.add(amb, sun)

    // Construir fondo estrellado y Júpiter
    this.buildStarfield()
    this.buildJupiter()

    // Nave del jugador (usando el cohete espacial rediseñado con alas y cañones)
    this.rocket = makeSpaceRocket()
    this.rocket.scale.setScalar(0.24)
    this.rocket.position.set(this.shipX, this.shipY, 0)
    this.scene.add(this.rocket)

    // Fuego de los propulsores
    this.thrusters = new THREE.Group()
    // Una llama por tobera, centrada en su eje y con la base pegada a la boca de la tobera
    const flame = (x: number, r: number, len: number, color: number, opacity: number): void => {
      const geo = new THREE.ConeGeometry(r, len, 12)
      geo.rotateX(Math.PI)
      geo.translate(0, -len / 2, 0) // el origen queda en la base: al escalar, la llama crece hacia atrás
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending }))
      m.position.set(x, 0, 0)
      this.thrusters.add(m)
    }
    flame(0, 18, 95, 0xff8a1f, 0.85)
    flame(0, 9, 60, 0xfff2b0, 0.9)
    for (const sx of [-22, 22]) {
      flame(sx, 11, 55, 0x35b8ff, 0.8)
      flame(sx, 5, 34, 0xd8f6ff, 0.85)
    }
    this.thrusters.position.y = 3
    this.rocket.add(this.thrusters)

    // Geometrías para meteoritos
    for (let i = 0; i < 5; i++) {
      const geo = new THREE.DodecahedronGeometry(1, 1)
      const pos = geo.attributes.position
      for (let j = 0; j < pos.count; j++) {
        const u = 0.85 + Math.random() * 0.35
        pos.setXYZ(j, pos.getX(j) * u, pos.getY(j) * u, pos.getZ(j) * u)
      }
      geo.computeVertexNormals()
      this.meteorGeoCache.push(geo)
    }
  }

  /** Construye las capas de estrellas en paralaje para dar sensación de viaje a hipervelocidad */
  private buildStarfield(): void {
    const counts = [450, 250, 120]
    const speeds = [40, 95, 180]
    const colors = [0x9ab8ff, 0xffffff, 0xffdca8]
    const sizes = [1.6, 2.4, 3.8]

    for (let c = 0; c < 3; c++) {
      const count = counts[c]
      const geo = new THREE.BufferGeometry()
      const pos = new Float32Array(count * 3)
      for (let i = 0; i < count; i++) {
        pos[i * 3] = (Math.random() - 0.5) * 800
        pos[i * 3 + 1] = (Math.random() - 0.5) * 800
        pos[i * 3 + 2] = -50 - c * 80 - Math.random() * 50
      }
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
      const mat = new THREE.PointsMaterial({
        color: colors[c],
        size: sizes[c],
        transparent: true,
        opacity: 0.75 + c * 0.1,
      })
      const mesh = new THREE.Points(geo, mat)
      this.scene.add(mesh)
      this.starLayers.push({ mesh, speed: speeds[c], count })
    }
  }

  /** Crea el planeta vecino similar a Júpiter con bandas atmosféricas y Gran Mancha Roja */
  private buildJupiter(): void {
    const size = 512
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')!

    // Gradiente base de fondo
    ctx.fillStyle = '#c88c52'
    ctx.fillRect(0, 0, size, size)

    // Bandas horizontales de gas características de Júpiter
    const bands: { y0: number; y1: number; col: string }[] = [
      { y0: 0, y1: 45, col: '#8d5c36' },
      { y0: 45, y1: 85, col: '#deb88c' },
      { y0: 85, y1: 130, col: '#a66236' },
      { y0: 130, y1: 180, col: '#eed5b2' },
      { y0: 180, y1: 235, col: '#9c532b' }, // Banda ecuatorial oscura
      { y0: 235, y1: 275, col: '#e8c99e' },
      { y0: 275, y1: 340, col: '#b86d3e' }, // Banda templada sur
      { y0: 340, y1: 390, col: '#e5d3bc' },
      { y0: 390, y1: 440, col: '#9e6238' },
      { y0: 440, y1: 512, col: '#6d4325' },
    ]

    for (const b of bands) {
      ctx.fillStyle = b.col
      ctx.fillRect(0, b.y0, size, b.y1 - b.y0)
      // Turbulencias y filamentos atmosféricos
      for (let i = 0; i < 8; i++) {
        const py = b.y0 + Math.random() * (b.y1 - b.y0)
        ctx.strokeStyle = Math.random() < 0.5 ? 'rgba(255,255,255,0.18)' : 'rgba(80,30,10,0.22)'
        ctx.lineWidth = 1 + Math.random() * 3
        ctx.beginPath()
        ctx.moveTo(0, py)
        for (let x = 0; x <= size; x += 32) {
          ctx.lineTo(x, py + Math.sin(x * 0.04 + i) * 3)
        }
        ctx.stroke()
      }
    }

    // Gran Mancha Roja (Great Red Spot) icónica de Júpiter
    const spotX = size * 0.62
    const spotY = size * 0.64
    const spotR1 = 48
    const spotR2 = 28
    const spotGrad = ctx.createRadialGradient(spotX, spotY, 4, spotX, spotY, spotR1)
    spotGrad.addColorStop(0, '#c93924')
    spotGrad.addColorStop(0.45, '#a8301c')
    spotGrad.addColorStop(0.8, '#d47248')
    spotGrad.addColorStop(1, 'rgba(212,114,72,0)')
    ctx.fillStyle = spotGrad
    ctx.beginPath()
    ctx.ellipse(spotX, spotY, spotR1, spotR2, 0.08, 0, Math.PI * 2)
    ctx.fill()

    // Ojo central de la mancha
    ctx.fillStyle = '#ff7b5a'
    ctx.beginPath()
    ctx.ellipse(spotX - 4, spotY, 14, 8, 0, 0, Math.PI * 2)
    ctx.fill()

    const tex = new THREE.CanvasTexture(canvas)
    tex.wrapS = THREE.RepeatWrapping
    tex.wrapT = THREE.ClampToEdgeWrapping

    const jupGeo = new THREE.SphereGeometry(90, 32, 28)
    const jupMat = new THREE.MeshStandardMaterial({
      map: tex,
      roughness: 0.65,
      metalness: 0.05,
    })
    this.jupiterMesh = new THREE.Mesh(jupGeo, jupMat)
    // Se sitúa en la parte superior del espacio al fondo
    this.jupiterMesh.position.set(0, 220, -180)
    // Inicialmente lejano y escala moderada
    this.jupiterMesh.scale.setScalar(0.7)
    this.scene.add(this.jupiterMesh)

    // Halo atmosférico brillante
    const glowGeo = new THREE.SphereGeometry(96, 28, 24)
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0xdeb88c,
      transparent: true,
      opacity: 0.22,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
    })
    this.jupiterGlow = new THREE.Mesh(glowGeo, glowMat)
    this.jupiterGlow.position.copy(this.jupiterMesh.position)
    this.jupiterGlow.scale.copy(this.jupiterMesh.scale)
    this.scene.add(this.jupiterGlow)
  }

  /** Reinicia el nivel para comenzar la travesía espacial */
  start(callbacks?: { onVictory?: (stats: SpaceStats) => void; onDefeat?: (stats: SpaceStats) => void }): void {
    if (callbacks) {
      if (callbacks.onVictory) this.onVictory = callbacks.onVictory
      if (callbacks.onDefeat) this.onDefeat = callbacks.onDefeat
    }
    this.time = 0
    this.completed = false
    this.gameOver = false
    this.hp = this.maxHp
    this.score = 0
    this.asteroidsDestroyed = 0
    this.shipX = 0
    this.shipY = -150
    this.shipVx = 0
    this.shipVy = 0
    this.shipRoll = 0
    this.invuln = 1.2
    this.nextShootingStarT = 60

    // Limpiar proyectiles y meteoritos
    for (const l of this.lasers) this.scene.remove(l.mesh)
    for (const m of this.meteors) this.scene.remove(m.mesh)
    for (const p of this.particles) this.scene.remove(p.mesh)
    if (this.shootingStar) this.scene.remove(this.shootingStar.mesh)

    this.lasers = []
    this.meteors = []
    this.particles = []
    this.shootingStar = null

    this.showHud(true)
    this.updateHud()
  }

  resize(w: number, h: number): void {
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
  }

  /** Dispara ráfaga doble de cañones láser desde las puntas de las alas */
  private shootLasers(): void {
    if (this.shootCd > 0 || this.gameOver || this.completed) return
    this.shootCd = 0.16 // Cadencia rápida tipo Galaga

    const laserGeo = new THREE.BoxGeometry(2.4, 18, 2.4)
    const laserMat = new THREE.MeshBasicMaterial({ color: 0x57f2ff })

    // Dos disparos simultáneos desde los laterales de las alas
    for (const sx of [-25, 25]) {
      const mesh = new THREE.Mesh(laserGeo, laserMat)
      mesh.position.set(this.shipX + sx, this.shipY + 22, 0)
      this.scene.add(mesh)
      this.lasers.push({
        mesh,
        x: this.shipX + sx,
        y: this.shipY + 22,
        vx: 0,
        vy: SPACE_LEVEL.bulletSpeed,
        life: 1.4,
        dmg: SPACE_LEVEL.bulletDamage,
      })
    }

    sfx.shoot([850, 420], 0.08)
  }

  /** Activa una estrella fugaz deslumbrante atravesando el espacio */
  private triggerShootingStar(): void {
    if (this.shootingStar) this.scene.remove(this.shootingStar.mesh)

    const points = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(70, -35, -20)]
    const lineGeo = new THREE.BufferGeometry().setFromPoints(points)
    const lineMat = new THREE.LineBasicMaterial({
      color: 0x9fe8ff,
      linewidth: 3,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
    })
    const line = new THREE.Line(lineGeo, lineMat)

    const startX = -260 + Math.random() * 120
    const startY = 160 + Math.random() * 80
    line.position.set(startX, startY, -60)
    this.scene.add(line)

    this.shootingStar = {
      active: true,
      x: startX,
      y: startY,
      vx: 460 + Math.random() * 140,
      vy: -230 - Math.random() * 80,
      t: 0,
      maxT: 1.6,
      mesh: line,
    }

    // Efecto sonoro de estrella fugaz pasando
    sfx.pickup()
  }

  /** Genera meteoritos entrantes desde la parte superior */
  private spawnMeteor(): void {
    const r = Math.random()
    const kind = r < 0.5 ? 'small' : r < 0.85 ? 'medium' : 'large'
    const radius = kind === 'small' ? 9 : kind === 'medium' ? 18 : 30
    const hp = kind === 'small' ? 25 : kind === 'medium' ? 70 : 150
    const geo = this.meteorGeoCache[Math.floor(Math.random() * this.meteorGeoCache.length)]

    // Textura y color rocoso espacial
    const colors = [0x787268, 0x5a544c, 0x8a705a, 0x666e7a]
    const col = colors[Math.floor(Math.random() * colors.length)]
    const mat = new THREE.MeshStandardMaterial({
      color: col,
      roughness: 0.88,
      metalness: 0.15,
      flatShading: true,
    })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.scale.setScalar(radius)

    const startX = (Math.random() - 0.5) * 520
    const startY = 240
    mesh.position.set(startX, startY, 0)
    this.scene.add(mesh)

    this.meteors.push({
      mesh,
      x: startX,
      y: startY,
      vx: (Math.random() - 0.5) * 60,
      vy: -(90 + Math.random() * 120) * (kind === 'small' ? 1.3 : 1),
      rotX: Math.random() * 6,
      rotY: Math.random() * 6,
      rotZ: Math.random() * 6,
      vrotX: (Math.random() - 0.5) * 2,
      vrotY: (Math.random() - 0.5) * 2,
      vrotZ: (Math.random() - 0.5) * 2,
      radius,
      hp,
      maxHp: hp,
      kind,
    })
  }

  /** Explota un meteorito creando fragmentos de roca y chispas */
  private explodeMeteor(m: Meteorite): void {
    this.asteroidsDestroyed++
    this.score += m.kind === 'small' ? 100 : m.kind === 'medium' ? 250 : 500
    sfx.kill()

    // Partículas de roca
    const count = m.kind === 'small' ? 8 : m.kind === 'medium' ? 16 : 28
    const pGeo = new THREE.BoxGeometry(1.8, 1.8, 1.8)
    for (let i = 0; i < count; i++) {
      const pMat = new THREE.MeshBasicMaterial({ color: Math.random() < 0.6 ? 0x8f7a65 : 0xffa033 })
      const pMesh = new THREE.Mesh(pGeo, pMat)
      pMesh.position.set(m.x, m.y, 0)
      this.scene.add(pMesh)
      const a = Math.random() * Math.PI * 2
      const spd = 60 + Math.random() * 180
      this.particles.push({
        mesh: pMesh,
        x: m.x,
        y: m.y,
        z: 0,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd,
        vz: (Math.random() - 0.5) * 60,
        life: 0,
        maxLife: 0.4 + Math.random() * 0.4,
        color: 0xffa033,
      })
    }
  }

  /** Daña al cohete espacial */
  private hurtRocket(dmg: number): void {
    if (this.invuln > 0 || this.gameOver || this.completed) return
    this.hp = Math.max(0, this.hp - dmg)
    this.invuln = 1.0
    sfx.hurt()

    if (this.hp <= 0) {
      this.gameOver = true
      sfx.lose()
      if (this.onDefeat) this.onDefeat({ elapsed: this.time, score: this.score, asteroidsDestroyed: this.asteroidsDestroyed })
    }
  }

  update(dt: number): void {
    if (this.gameOver) return

    // Actualizar tiempo total del nivel (3 minutos = 180s)
    if (!this.completed) {
      this.time += dt
      if (this.time >= this.totalTime) {
        this.time = this.totalTime
        this.completed = true
        sfx.launch()
        if (this.onVictory) this.onVictory({ elapsed: this.time, score: this.score, asteroidsDestroyed: this.asteroidsDestroyed })
      }
    }

    const progress = Math.min(1, this.time / this.totalTime)

    // Acercamiento de Júpiter conforme avanza el progreso hacia el 100%
    // Inicia en el fondo y se va haciendo imponente hasta llegar a él
    const jupScale = 0.7 + progress * 0.75
    this.jupiterMesh.scale.setScalar(jupScale)
    this.jupiterGlow.scale.setScalar(jupScale)
    this.jupiterMesh.rotation.y += dt * 0.1
    this.jupiterMesh.position.y = 220 - progress * 40

    // Comprobación de estrellas fugaces (cada minuto: 60s, 120s, 178s)
    if (this.time >= this.nextShootingStarT) {
      this.triggerShootingStar()
      this.nextShootingStarT += 60
    }

    // Actualizar estrella fugaz activa
    if (this.shootingStar) {
      const ss = this.shootingStar
      ss.t += dt
      ss.x += ss.vx * dt
      ss.y += ss.vy * dt
      ss.mesh.position.set(ss.x, ss.y, -60)
      const fade = Math.max(0, 1 - ss.t / ss.maxT)
      ;(ss.mesh.material as THREE.LineBasicMaterial).opacity = fade
      if (ss.t >= ss.maxT || ss.x > 380 || ss.y < -260) {
        this.scene.remove(ss.mesh)
        this.shootingStar = null
      }
    }

    // Rotar estrellas de fondo hacia abajo
    for (const layer of this.starLayers) {
      const pos = layer.mesh.geometry.attributes.position as THREE.BufferAttribute
      for (let i = 0; i < layer.count; i++) {
        let py = pos.getY(i) - layer.speed * dt
        if (py < -380) py += 760
        pos.setY(i, py)
      }
      pos.needsUpdate = true
    }

    // 1. Manejo con WASD
    const { f, s } = this.input.axis()
    const spd = SPACE_LEVEL.playerSpeed
    this.shipVx = s * spd
    this.shipVy = f * spd

    this.shipX += this.shipVx * dt
    this.shipY += this.shipVy * dt

    // Bounding box en pantalla
    const limitX = 220
    const limitYTop = 160
    const limitYBottom = -180
    this.shipX = Math.max(-limitX, Math.min(limitX, this.shipX))
    this.shipY = Math.max(limitYBottom, Math.min(limitYTop, this.shipY))

    // Inclinación bancaria al moverse a los lados (roll)
    const targetRoll = -s * 0.28
    this.shipRoll += (targetRoll - this.shipRoll) * Math.min(1, dt * 10)

    this.rocket.position.set(this.shipX, this.shipY, 0)
    this.rocket.rotation.z = this.shipRoll

    // Efecto de parpadeo si es invulnerable
    this.invuln = Math.max(0, this.invuln - dt)
    this.rocket.visible = this.invuln <= 0 || Math.floor(this.time * 16) % 2 === 0

    // Animación de propulsores
    this.thrusters.scale.set(
      1 + (Math.random() - 0.5) * 0.2,
      1 + f * 0.4 + Math.random() * 0.3,
      1 + (Math.random() - 0.5) * 0.2
    )

    // 2. Disparo de armas
    this.shootCd = Math.max(0, this.shootCd - dt)
    const wantsFire = this.input.fire || this.input.keys.has('Space') || this.input.touchFire
    if (wantsFire) {
      this.shootLasers()
    }

    // Actualizar láseres
    for (let i = this.lasers.length - 1; i >= 0; i--) {
      const l = this.lasers[i]
      l.life -= dt
      l.x += l.vx * dt
      l.y += l.vy * dt
      l.mesh.position.set(l.x, l.y, 0)

      let hit = false
      for (const m of this.meteors) {
        if (Math.hypot(m.x - l.x, m.y - l.y) < m.radius + 4) {
          hit = true
          m.hp -= l.dmg
          sfx.hit()
          if (m.hp <= 0) {
            this.explodeMeteor(m)
            const idx = this.meteors.indexOf(m)
            if (idx >= 0) {
              this.scene.remove(m.mesh)
              this.meteors.splice(idx, 1)
            }
          }
          break
        }
      }

      if (hit || l.life <= 0 || l.y > 250) {
        this.scene.remove(l.mesh)
        this.lasers.splice(i, 1)
      }
    }

    // 3. Generación y movimiento de meteoritos
    this.spawnTimer -= dt
    if (this.spawnTimer <= 0 && !this.completed) {
      this.spawnMeteor()
      // Dificultad escalonada a medida que avanza el tiempo
      const minInterval = Math.max(0.35, 1.1 - progress * 0.65)
      this.spawnTimer = minInterval + Math.random() * 0.4
    }

    for (let i = this.meteors.length - 1; i >= 0; i--) {
      const m = this.meteors[i]
      m.x += m.vx * dt
      m.y += m.vy * dt
      m.rotX += m.vrotX * dt
      m.rotY += m.vrotY * dt
      m.rotZ += m.vrotZ * dt

      m.mesh.position.set(m.x, m.y, 0)
      m.mesh.rotation.set(m.rotX, m.rotY, m.rotZ)

      // Colisión contra el cohete del jugador
      if (Math.hypot(m.x - this.shipX, m.y - this.shipY) < m.radius + 18) {
        this.hurtRocket(m.kind === 'small' ? 20 : m.kind === 'medium' ? 35 : 55)
        this.explodeMeteor(m)
        this.scene.remove(m.mesh)
        this.meteors.splice(i, 1)
        continue
      }

      // Eliminar meteoritos que salieron por abajo de la pantalla
      if (m.y < -250 || m.x < -320 || m.x > 320) {
        this.scene.remove(m.mesh)
        this.meteors.splice(i, 1)
      }
    }

    // Actualizar partículas
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]
      p.life += dt
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.z += p.vz * dt
      p.mesh.position.set(p.x, p.y, p.z)
      p.mesh.scale.setScalar(Math.max(0.1, 1 - p.life / p.maxLife))
      if (p.life >= p.maxLife) {
        this.scene.remove(p.mesh)
        this.particles.splice(i, 1)
      }
    }

    this.updateHud()
  }

  /** Actualiza los elementos visuales del HUD del nivel espacial */
  updateHud(): void {
    const progress = Math.min(1, this.time / this.totalTime)
    const pct = Math.round(progress * 100)

    // Barra y mini cohete
    const fillEl = document.getElementById('space-fill')
    const miniEl = document.getElementById('space-mini-rocket')
    if (fillEl) fillEl.style.width = `${pct}%`
    if (miniEl) miniEl.style.left = `${pct}%`

    // Tiempo restante (3:00 decrementando)
    const rem = Math.max(0, this.totalTime - this.time)
    const mins = Math.floor(rem / 60)
    const secs = Math.floor(rem % 60)
    const timeEl = document.getElementById('space-time')
    if (timeEl) timeEl.textContent = `${mins}:${secs < 10 ? '0' : ''}${secs}`

    // Casco del cohete
    const hpPct = Math.round((this.hp / this.maxHp) * 100)
    const hullFill = document.getElementById('spaceHullFill')
    const hullNum = document.getElementById('spaceHullNum')
    if (hullFill) {
      hullFill.style.width = `${hpPct}%`
      hullFill.className = hpPct < 30 ? 'low' : ''
    }
    if (hullNum) hullNum.textContent = `${hpPct}%`

    // Puntuación
    const scoreNum = document.getElementById('spaceScoreNum')
    if (scoreNum) scoreNum.textContent = String(this.score)
  }

  showHud(on: boolean): void {
    const el = document.getElementById('space-hud')
    if (el) el.classList.toggle('hidden', !on)
  }

  render(renderer: THREE.WebGLRenderer): void {
    renderer.render(this.scene, this.camera)
  }
}
