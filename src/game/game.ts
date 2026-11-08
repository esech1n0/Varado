import * as THREE from 'three'
import { ALIENS, ARENA, BY0, BY1, CONFIG, GRENADE, IMPOSTOR_HP, LEGO_TOTAL, MAX_HP, ROOM_H, SETTINGS, SHIP, SNIPER, STAMINA, WALL_H, WEAPONS, WEAPON_ORDER, WORLD, ZC_END, type AlienKind, type AmmoWeapon, type WeaponId } from './config'
import { beep, engineSet, sfx } from './audio'
import { Fx } from './fx'
import { Grid, angDiff, clamp, distSegPoint, inRect, lerp, losClear, moveCircle, rayDistance, rnd, segEnter, type Rect } from './geom'
import {
  basic, makeAmmo, makeBeacon, makeBone, makeBuggy, makeGenerator, makeGun, makeImpostor, makeLego, makeMedkit, makePlayer, makeTurret,
  type ImpostorRig, type PlayerRig, type TurretRig,
} from './gfx'
import { Hud, type RadarDot } from './hud'
import { Input } from './input'
import { instance, setBaseGlow } from './models'
import { buildWorld, doorPanels, setDoor, type DoorRig, type FenceSpawn, type PlateSpawn, type WorldData } from './world'

export type PickupKind = 'medkit' | 'ammo' | 'rifle' | 'shotgun' | 'pistol' | 'plasma' | 'sniper'
export type Mode = 'menu' | 'play' | 'dead' | 'ending' | 'end'
export type DeathCause = 'soldier' | 'shooter' | 'tank' | 'boss' | 'impostor' | 'turret' | 'fence' | 'plasma' | 'grenade'

export interface Grenade { x: number; y: number; z: number; vx: number; vy: number; vz: number; fuse: number; stuck: null | { type: 'wall' } | { type: 'enemy'; e: Enemy; dx: number; dy: number } | { type: 'imp'; dx: number; dy: number }; mesh: THREE.Group; core: THREE.Mesh; light: THREE.Mesh }
export interface Blast { mesh: THREE.Mesh; t: number; max: number }
export interface Beam { mesh: THREE.Mesh; t: number; max: number }
export interface Pickup { kind: PickupKind; x: number; y: number; z: number; taken: boolean; mesh: THREE.Group; glow: THREE.Mesh; dyn: boolean; camp?: boolean; ph: number }
export interface Lego { x: number; y: number; variant: number; taken: boolean; mesh: THREE.Group; halo: THREE.Mesh; ph: number; spark: number }
export interface Turret { x: number; y: number; hp: number; state: 'idle' | 'lock' | 'cool' | 'dead'; t: number; aim: number; mesh: THREE.Group; rig: TurretRig; beam: THREE.Mesh; beamT: number; flash: number }
export interface Gen { x: number; y: number; hp: number; alive: boolean; mesh: THREE.Group; core: THREE.Mesh }
export interface Fence { spec: FenceSpawn; a: Gen; b: Gen; beams: THREE.Mesh[]; on: boolean; warn: boolean; len: number; ang: number }
export interface Plate { spec: PlateSpawn; mesh: THREE.Mesh; mat: THREE.MeshStandardMaterial; hitCycle: number }
export interface Beacon { x: number; y: number; name: string; active: boolean; mesh: THREE.Group; lamp: THREE.MeshBasicMaterial; ring: THREE.MeshBasicMaterial }
export interface Bullet { x: number; y: number; vx: number; vy: number; life: number; dmg: number; mesh: THREE.Mesh; speed: number }
export interface EProj { x: number; y: number; vx: number; vy: number; life: number; dmg: number; mesh: THREE.Object3D; cause: DeathCause }
export interface Enemy {
  id: number; kind: AlienKind; x: number; y: number; r: number; hp: number; maxHp: number; face: number
  state: 'idle' | 'chase' | 'dead'; roam: boolean; homeX: number; homeY: number; homeFace: number
  cd: number; atk: number; ph: number; flash: number; flashOn: boolean; mv: number; speedMul: number
  stuckT: number; lx: number; ly: number; detour: number; dd: number; t: number; deadT: number; hitCar: number
  wind: null | { type: string; t: number; dir?: number }; strafe: number; charging: number; cdir: number
  stage: number; vis: THREE.Group | null; pulse: number
}

const bulletGeo = new THREE.BoxGeometry(1, 1, 1)
const bulletMats: Record<WeaponId, THREE.MeshBasicMaterial> = {
  pistol: new THREE.MeshBasicMaterial({ color: WEAPONS.pistol.color }),
  rifle: new THREE.MeshBasicMaterial({ color: WEAPONS.rifle.color }),
  shotgun: new THREE.MeshBasicMaterial({ color: WEAPONS.shotgun.color }),
  sniper: new THREE.MeshBasicMaterial({ color: WEAPONS.sniper.color }),
}

export class Game {
  readonly renderer: THREE.WebGLRenderer
  readonly scene = new THREE.Scene()
  readonly camera = new THREE.PerspectiveCamera(CONFIG.camera.fov, 16 / 9, 1, 12000)
  readonly world: WorldData
  readonly fx: Fx
  readonly grid: Grid
  mode: Mode = 'menu'
  paused = false
  failedModels: string[] = []

  // luces
  private amb = new THREE.AmbientLight(0xffffff, 0.6)
  private hemi = new THREE.HemisphereLight(0xbcd2ff, 0x202840, 0.5)
  private sun = new THREE.DirectionalLight(0xffffff, 0.95)
  private torch = new THREE.PointLight(0xdfeaff, 0, 520, 1.1)
  private itemLight = new THREE.PointLight(0x7fe3ff, 0, 300, 1.4)

  // grupos
  private dyn = new THREE.Group()
  private itemsG = new THREE.Group()
  private enemiesG = new THREE.Group()
  private barsG = new THREE.Group()
  private projG = new THREE.Group()

  // modelos
  private playerM = makePlayer()
  private buggyM = makeBuggy()
  private impM = makeImpostor()
  private shipM!: THREE.Group
  private shield!: THREE.Mesh
  private chargeLine!: THREE.Mesh
  private arrowM!: THREE.Mesh
  private door1!: DoorRig
  private door2!: DoorRig
  private wreckMs: THREE.Group[] = []

  // estado de la partida
  t = 0
  runTime = 0
  shake = 0
  hurtFx = 0
  yaw = 0
  pitch = 0.42
  private camPos = new THREE.Vector3(0, 80, 270)
  private camInit = false
  private lastLook = 0
  p = {
    x: 110, y: 270, r: 13, hp: MAX_HP, face: 0, walk: 0, moving: 0, cd: 0, inv: 0, kx: 0, ky: 0, weapon: 'pistol' as WeaponId,
    owned: { pistol: false, rifle: false, shotgun: false, sniper: false } as Record<WeaponId, boolean>,
    ammo: { rifle: 0, shotgun: 0, sniper: 0 } as Record<AmmoWeapon, number>, danger: 0, alive: true,
    stamina: STAMINA.max, exhausted: false, staminaIdle: 0, running: false, dashT: 0, dashCd: 0, dashX: 0, dashY: 0,
    grenades: 0, hasGrenade: false, grenadeCd: 0, zoomed: false,
  }
  buggy = { x: 2260, y: 270, h: 0, v: 0, r: 26, riding: false, spin: 0, boarded: false, bump: 0 }
  cp = { x: 110, y: 270, name: 'Inicio' }
  flags = {
    impDead: false, gate: false, towerMsg: false, arenaMsg: false, bossWoke: false, bossDead: false, hordeMsg: false, hangarMsg: false,
    pistolMsg: false, shipHint: false, boarded: false, d1snd: false, d2snd: false,
  }
  stats = { kills: 0, deaths: 0, lego: 0, ruins: 0, picks: 0 }
  d1 = 0
  d2 = 0
  imp = {
    x: 1500, y: 270, r: 26, hp: IMPOSTOR_HP, state: 'dormant' as 'dormant' | 'forming' | 'chase' | 'dead', t: 0, face: Math.PI, flash: 0, stun: 0,
    spitCd: 2.2, chargeCd: 3.5, biteCd: 0, wind: null as null | { type: string; t: number }, charging: 0, cdir: 0, stuckT: 0, lx: 1500, ly: 270,
    detour: 0, dd: 1, mouth: 0.35,
  }
  spits: EProj[] = []
  pickups: Pickup[] = []
  legos: Lego[] = []
  turrets: Turret[] = []
  fences: Fence[] = []
  plates: Plate[] = []
  beacons: Beacon[] = []
  enemies: Enemy[] = []
  bullets: Bullet[] = []
  grenades: Grenade[] = []
  blasts: Blast[] = []
  beams: Beam[] = []
  eprojs: EProj[] = []
  bones: { mesh: THREE.Group; t: number }[] = []
  private vpool: Record<AlienKind, THREE.Group[]> = { soldier: [], shooter: [], tank: [], boss: [] }
  private nextId = 1
  hordeT = 14
  noiseT = 0
  deadT = 0
  endT = 0
  radioQ: { t: number; text: string }[] = []
  private shownObjective = ''
  private ending = { t: 0, fade: false, shown: false }
  private tmpV = new THREE.Vector3()

  constructor(readonly canvas: HTMLCanvasElement, readonly input: Input, readonly hud: Hud) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFShadowMap
    this.scene.background = new THREE.Color(0x03051a)
    this.scene.fog = new THREE.Fog(0x03051a, 1700, 5200)

    this.scene.add(this.amb, this.hemi, this.sun, this.sun.target, this.torch, this.itemLight)
    this.sun.castShadow = true
    this.sun.shadow.mapSize.set(2048, 2048)
    Object.assign(this.sun.shadow.camera, { left: -520, right: 520, top: 520, bottom: -520, near: 10, far: 1400 })
    this.sun.shadow.bias = -0.0006

    this.world = buildWorld(this.scene)
    this.grid = this.world.grid
    this.door1 = this.world.doors.d1
    this.door2 = this.world.doors.d2
    this.scene.add(this.dyn)
    this.dyn.add(this.itemsG, this.enemiesG, this.projG)
    this.scene.add(this.barsG)
    this.fx = new Fx(this.dyn)

    this.dyn.add(this.playerM, this.buggyM, this.impM)
    this.playerM.traverse(o => (o.castShadow = true))
    this.buildEntities()
    this.resize()
    addEventListener('resize', () => this.resize())
  }

  resize(): void {
    const w = innerWidth
    const h = innerHeight
    this.renderer.setSize(w, h, false)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
  }

  // ---------- Construcción de entidades ----------
  private glowRing(color: number, r = 14): THREE.Mesh {
    const m = new THREE.Mesh(new THREE.RingGeometry(r * 0.7, r, 28), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false }))
    m.rotation.x = -Math.PI / 2
    return m
  }

  private makePickup(kind: PickupKind, x: number, y: number, dyn: boolean, z = 0, camp = false): Pickup {
    let mesh: THREE.Group
    let color = 0x9fe8ff
    if (kind === 'medkit') { mesh = makeMedkit(); color = 0x6dff9a }
    else if (kind === 'ammo') { mesh = makeAmmo(); color = 0xffd21f }
    else {
      mesh = new THREE.Group()
      const g = makeGun(kind === 'pistol' ? 'pistol' : kind)
      g.scale.setScalar(kind === 'plasma' ? 2.2 : kind === 'sniper' ? 1.85 : 1.7)
      g.position.y = 14
      mesh.add(g)
      color = kind === 'rifle' ? 0x8fe3ff : kind === 'shotgun' ? 0xff9a4a : kind === 'sniper' ? 0xfff6b0 : kind === 'plasma' ? 0x6dff4a : 0xffe27a
    }
    const glow = this.glowRing(color, 20)
    glow.position.set(x, z + 2.5, y)
    this.itemsG.add(mesh, glow)
    mesh.position.set(x, z + 8, y)
    return { kind, x, y, z, taken: false, mesh, glow, dyn, camp, ph: Math.random() * 6 }
  }

  dropPickup(kind: PickupKind, x: number, y: number): void {
    this.pickups.push(this.makePickup(kind, x, y, true))
  }

  /** Genera el botín aleatorio de los 5 campamentos (menor probabilidad de encontrar arma). */
  private randomizeCampLoot(): void {
    this.pickups = this.pickups.filter(p => {
      if (p.camp) {
        this.itemsG.remove(p.mesh, p.glow)
        return false
      }
      return true
    })
    for (const s of this.world.campLoot) {
      const r = Math.random()
      const kind: PickupKind = r < 0.15 ? (Math.random() < 0.5 ? 'rifle' : 'shotgun') : r < 0.6 ? 'ammo' : 'medkit'
      this.pickups.push(this.makePickup(kind, s.x, s.y, false, 0, true))
    }
  }

  /** Reubica las granadas de plasma en puntos libres al azar del mundo abierto. */
  private randomizePlasma(): void {
    const free = (x: number, y: number): boolean => {
      for (let i = 0; i < 9; i++) {
        const a = (i / 8) * 6.283
        const rr = i === 8 ? 0 : 44
        if (this.solidAt(x + Math.cos(a) * rr, y + Math.sin(a) * rr)) return false
      }
      return true
    }
    for (const k of this.pickups) {
      if (k.kind !== 'plasma' || k.dyn) continue
      let x = 0
      let y = 0
      for (let tries = 0; tries < 200; tries++) {
        x = rnd(WORLD.x0 + 250, WORLD.x1 - 250)
        y = rnd(WORLD.y0 + 250, WORLD.y1 - 250)
        if (free(x, y)) break
      }
      k.x = x
      k.y = y
      k.mesh.position.set(x, 8, y)
      k.glow.position.set(x, 2.5, y)
    }
  }

  private makeGen(x: number, y: number): Gen {
    const mesh = makeGenerator()
    mesh.position.set(x, 0, y)
    this.dyn.add(mesh)
    return { x, y, hp: 12, alive: true, mesh, core: mesh.userData.core as THREE.Mesh }
  }

  private buildEntities(): void {
    const W = this.world
    // armas y suministros
    this.pickups.push(this.makePickup('pistol', 560, 335, false))
    for (const s of W.pickups) this.pickups.push(this.makePickup(s.kind, s.x, s.y, false, s.z ?? 0))
    // granadas de plasma: posiciones aleatorias en el mapa (se reubican en cada partida)
    for (let i = 0; i < GRENADE.spawns; i++) this.pickups.push(this.makePickup('plasma', 0, 0, false))
    this.randomizePlasma()
    this.randomizeCampLoot()
    // piezas LEGO
    for (const s of W.legos) {
      const mesh = makeLego(s.variant)
      mesh.scale.setScalar(1.45)
      const halo = new THREE.Mesh(new THREE.SphereGeometry(20, 14, 10), new THREE.MeshBasicMaterial({ color: 0xffe98a, transparent: true, opacity: 0.18, depthWrite: false, blending: THREE.AdditiveBlending }))
      this.itemsG.add(mesh, halo)
      this.legos.push({ x: s.x, y: s.y, variant: s.variant, taken: false, mesh, halo, ph: Math.random() * 6, spark: 0 })
    }
    // torretas
    for (const s of W.turrets) {
      const mesh = makeTurret()
      mesh.position.set(s.x, 0, s.y)
      const rig = mesh.userData as TurretRig
      const beam = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0xff4040 }))
      beam.visible = false
      this.dyn.add(mesh, beam)
      this.dyn.add(rig.line)
      this.turrets.push({ x: s.x, y: s.y, hp: 40, state: 'idle', t: 0, aim: 0, mesh, rig, beam, beamT: 0, flash: 0 })
    }
    // vallas láser
    for (const s of W.fences) {
      const len = Math.hypot(s.bx - s.ax, s.by - s.ay)
      const ang = Math.atan2(s.by - s.ay, s.bx - s.ax)
      const beams: THREE.Mesh[] = []
      for (const h of [12, 30]) {
        const b = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0xff3b5a, transparent: true, opacity: 0.95 }))
        b.scale.set(len, 4, 4)
        b.position.set((s.ax + s.bx) / 2, h, (s.ay + s.by) / 2)
        b.rotation.y = -ang
        this.dyn.add(b)
        beams.push(b)
      }
      this.fences.push({ spec: s, a: this.makeGen(s.ax, s.ay), b: this.makeGen(s.bx, s.by), beams, on: false, warn: false, len, ang })
    }
    // placas de plasma
    for (const s of W.plates) {
      const m = new THREE.MeshStandardMaterial({ color: 0x4a4f5c, emissive: 0x000000, roughness: 0.6 })
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(s.w, 3, s.h), m)
      mesh.position.set(s.x + s.w / 2, 1.8, s.y + s.h / 2)
      mesh.receiveShadow = true
      this.dyn.add(mesh)
      this.plates.push({ spec: s, mesh, mat: m, hitCycle: -1 })
    }
    // balizas
    for (const s of W.beacons) {
      const mesh = makeBeacon()
      mesh.position.set(s.x, 0, s.y)
      const lamp = (mesh.userData.lamp as THREE.Mesh).material as THREE.MeshBasicMaterial
      const ring = (mesh.userData.ring as THREE.Mesh).material as THREE.MeshBasicMaterial
      this.dyn.add(mesh)
      this.beacons.push({ x: s.x, y: s.y, name: s.name, active: false, mesh, lamp, ring })
    }
    // naves siniestradas (modelos generados)
    for (const w of W.wrecks) {
      const m = instance('wreck', w.scale, 'length', 0x666a74)
      m.position.set(w.x, -w.scale * 0.07, w.y)
      m.rotation.y = -w.rot
      this.dyn.add(m)
      this.wreckMs.push(m)
    }
    // nave de escape
    this.shipM = new THREE.Group()
    const ship = instance('ship', 230, 'length', 0xf1f2ee)
    ship.rotation.y = Math.PI
    this.shipM.add(ship)
    this.shipM.position.set(SHIP.x, 0, SHIP.y)
    this.dyn.add(this.shipM)
    this.shield = new THREE.Mesh(new THREE.SphereGeometry(150, 28, 18), new THREE.MeshBasicMaterial({ color: 0x57f2ff, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide }))
    this.shield.position.set(SHIP.x, 40, SHIP.y)
    this.dyn.add(this.shield)
    // marcadores varios
    this.chargeLine = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 22), new THREE.MeshBasicMaterial({ color: 0xff3b4a, transparent: true, opacity: 0.4, depthWrite: false }))
    this.chargeLine.scale.y = 0.6
    this.chargeLine.visible = false
    this.dyn.add(this.chargeLine)
    this.arrowM = new THREE.Mesh(new THREE.ConeGeometry(11, 24, 4), new THREE.MeshBasicMaterial({ color: 0xffd21f }))
    this.arrowM.rotation.x = Math.PI
    this.arrowM.visible = false
    this.dyn.add(this.arrowM)
  }

  // ---------- Reinicio de partida ----------
  resetRun(): void {
    this.t = 0
    this.runTime = 0
    this.shake = 0
    this.hurtFx = 0
    this.yaw = 0
    this.pitch = 0.42
    this.camInit = false
    this.mode = 'menu'
    Object.assign(this.p, {
      x: 110, y: 270, hp: MAX_HP, face: 0, walk: 0, moving: 0, cd: 0, inv: 0, kx: 0, ky: 0, weapon: 'pistol', danger: 99, alive: true,
    })
    this.p.owned = { pistol: false, rifle: false, shotgun: false, sniper: false }
    this.p.ammo = { rifle: 0, shotgun: 0, sniper: 0 }
    Object.assign(this.p, { stamina: STAMINA.max, exhausted: false, staminaIdle: 0, running: false, dashT: 0, dashCd: 0, dashX: 0, dashY: 0, grenades: 0, hasGrenade: false, grenadeCd: 0, zoomed: false })
    for (const g of this.grenades) this.projG.remove(g.mesh)
    for (const b of this.blasts) this.projG.remove(b.mesh)
    for (const b of this.beams) this.projG.remove(b.mesh)
    this.grenades = []
    this.blasts = []
    this.beams = []
    Object.assign(this.buggy, { x: 2260, y: 270, h: 0, v: 0, riding: false, spin: 0, boarded: false, bump: 0 })
    this.cp = { x: 110, y: 270, name: 'Inicio' }
    this.flags = {
      impDead: false, gate: false, towerMsg: false, arenaMsg: false, bossWoke: false, bossDead: false, hordeMsg: false, hangarMsg: false,
      pistolMsg: false, shipHint: false, boarded: false, d1snd: false, d2snd: false,
    }
    this.stats = { kills: 0, deaths: 0, lego: 0, ruins: 0, picks: 0 }
    this.d1 = this.d2 = 0
    Object.assign(this.imp, {
      x: 1500, y: 270, hp: IMPOSTOR_HP, state: 'dormant', t: 0, face: Math.PI, flash: 0, stun: 0, spitCd: 2.2, chargeCd: 3.5, biteCd: 0, wind: null,
      charging: 0, cdir: 0, stuckT: 0, lx: 1500, ly: 270, detour: 0, dd: 1, mouth: 0.35,
    })
    this.world.endWall.on = true
    this.world.endWallMesh.visible = true
    for (const s of this.world.sites) s.visited = false
    // proyectiles y efectos
    for (const b of this.bullets) this.projG.remove(b.mesh)
    for (const b of this.spits) this.projG.remove(b.mesh)
    for (const b of this.eprojs) this.projG.remove(b.mesh)
    this.bullets = []
    this.spits = []
    this.eprojs = []
    for (const b of this.bones) this.dyn.remove(b.mesh)
    this.bones = []
    this.fx.clear()
    // suministros
    this.pickups = this.pickups.filter(p => {
      if (p.dyn) {
        this.itemsG.remove(p.mesh, p.glow)
        return false
      }
      p.taken = false
      return true
    })
    this.randomizePlasma()
    this.randomizeCampLoot()
    this.hud.setScope(false)
    for (const l of this.legos) l.taken = false
    for (const t of this.turrets) {
      t.hp = 40
      t.state = 'idle'
      t.t = 0
      t.beam.visible = false
      t.rig.line.visible = false
      t.mesh.rotation.set(0, 0, 0)
      t.rig.head.rotation.set(0, 0, 0)
        ; (t.rig.eye.material as THREE.MeshBasicMaterial).color.setHex(0x552222)
    }
    for (const f of this.fences) {
      for (const g of [f.a, f.b]) {
        g.hp = 12
        g.alive = true
        g.core.visible = true
      }
    }
    for (const pl of this.plates) pl.hitCycle = -1
    for (const b of this.beacons) this.setBeacon(b, false)
    // enemigos
    for (const e of this.enemies) this.releaseVisual(e)
    this.enemies = []
    for (const c of this.world.camps) {
      const kinds: [AlienKind, number][] = [['soldier', c.soldier ?? 0], ['shooter', c.shooter ?? 0], ['tank', c.tank ?? 0]]
      for (const [k, n] of kinds) {
        for (let i = 0; i < n; i++) {
          const a = Math.random() * 6.283
          const d = Math.sqrt(Math.random()) * c.spread
          this.placeEnemy(k, c.x + Math.cos(a) * d, c.y + Math.sin(a) * d, false)
        }
      }
    }
    this.placeEnemy('boss', SHIP.x - 260, SHIP.y, false)
    this.hordeT = 16
    this.noiseT = 0
    this.shield.visible = true
    this.shipM.position.set(SHIP.x, 0, SHIP.y)
    this.ending = { t: 0, fade: false, shown: false }
    this.radioQ = []
    this.hud.fade(false)
    this.hud.boss(null)
    this.hud.setLego(0)
    this.hud.setHp(MAX_HP, MAX_HP)
    this.hud.setStamina(STAMINA.max, STAMINA.max, false)
    this.shownObjective = ''
  }

  setBeacon(b: Beacon, on: boolean): void {
    b.active = on
    b.lamp.color.setHex(on ? 0x3bff8a : 0xff3b4a)
    b.ring.color.setHex(on ? 0x3bff8a : 0xff3b4a)
  }

  // ---------- Enemigos: creación y visuales ----------
  placeEnemy(kind: AlienKind, x: number, y: number, roam: boolean): Enemy {
    const def = ALIENS[kind]
    const e: Enemy = {
      id: this.nextId++, kind, x, y, r: def.r, hp: def.hp, maxHp: def.hp, face: rnd(0, 6.283), state: 'idle', roam, homeX: x, homeY: y, homeFace: 0,
      cd: rnd(0.2, 1), atk: 0, ph: rnd(0, 6), flash: 0, flashOn: false, mv: 0, speedMul: rnd(0.9, 1.15), stuckT: 0, lx: x, ly: y, detour: 0, dd: 1,
      t: 0, deadT: 0, hitCar: 0, wind: null, strafe: Math.random() < 0.5 ? 1 : -1, charging: 0, cdir: 0, stage: 0, vis: null, pulse: 0,
    }
    e.homeFace = e.face
    // sacar al enemigo de cualquier sólido
    const c = { x: e.x, y: e.y, r: e.r }
    for (let i = 0; i < 3; i++) {
      const q = this.grid.query(c.x - c.r, c.y - c.r, c.x + c.r, c.y + c.r, [])
      let moved = false
      for (const r of q) {
        const before = c.x + c.y
        this.pushOut(c, r)
        if (c.x + c.y !== before) moved = true
      }
      if (!moved) break
    }
    e.x = e.homeX = c.x
    e.y = e.homeY = c.y
    this.enemies.push(e)
    return e
  }

  private pushOut(c: { x: number; y: number; r: number }, r: Rect): void {
    const nx = clamp(c.x, r.x, r.x + r.w)
    const ny = clamp(c.y, r.y, r.y + r.h)
    const dx = c.x - nx
    const dy = c.y - ny
    const d2 = dx * dx + dy * dy
    if (d2 >= c.r * c.r) return
    if (d2 < 1e-6) {
      c.x = r.x - c.r - 2
      return
    }
    const d = Math.sqrt(d2)
    c.x += (dx / d) * (c.r - d + 1)
    c.y += (dy / d) * (c.r - d + 1)
  }

  acquireVisual(kind: AlienKind): THREE.Group {
    const v = this.vpool[kind].pop()
    if (v) {
      v.visible = true
      return v
    }
    const def = ALIENS[kind]
    const vis = new THREE.Group()
    const body = instance(kind, def.height, 'height', 0xcc2222)
    vis.add(body)
    if (kind === 'boss') setBaseGlow(body, 0x3a1060, 0.55)
    if (kind === 'tank') setBaseGlow(body, 0x0a2a0a, 0.25)
    if (kind === 'shooter') {
      const gun = makeGun('rifle')
      gun.scale.setScalar(def.height / 52)
      gun.position.set(def.r * 0.55, def.height * 0.38, def.r * 0.45)
      body.add(gun)
    }
    // anillo de telegrafía (embestidas de tanque / jefe)
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.88, 1, 48), new THREE.MeshBasicMaterial({ color: 0xff3b4a, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false }))
    ring.rotation.x = -Math.PI / 2
    ring.position.y = 1.5
    ring.visible = false
    vis.add(ring)
    // barra de vida (se orienta hacia la cámara)
    const bar = new THREE.Group()
    const w = kind === 'boss' ? 150 : kind === 'tank' ? 54 : 34
    const back = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), basic(0x1b1838))
    back.scale.set(w + 4, 8, 1)
    const fill = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), basic(0x46e07a))
    fill.position.z = 0.2
    fill.scale.set(w, 4.5, 1)
    bar.add(back, fill)
    bar.visible = false
    this.barsG.add(bar)
    vis.userData = { body, ring, bar, fill, barW: w }
    this.enemiesG.add(vis)
    return vis
  }

  releaseVisual(e: Enemy): void {
    if (!e.vis) return
    const v = e.vis
    v.visible = false
      ; (v.userData.bar as THREE.Object3D).visible = false
      ; (v.userData.ring as THREE.Object3D).visible = false
    const body = v.userData.body as THREE.Object3D
    body.scale.set(1, 1, 1)
    body.rotation.set(0, 0, 0)
    body.position.y = 0
    this.setFlash(v, 0)
    this.vpool[e.kind].push(v)
    e.vis = null
    e.flashOn = false
  }

  setFlash(v: THREE.Group, f: number): void {
    ; (v.userData.body as THREE.Object3D).traverse(o => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      const mt = m.material as THREE.MeshStandardMaterial
      if (!mt.emissive) return
      const bg = mt.userData.baseGlow as { color: number; intensity: number } | undefined
      if (f > 0) {
        mt.emissive.setHex(0xffffff)
        mt.emissiveIntensity = f
      } else if (bg) {
        mt.emissive.setHex(bg.color)
        mt.emissiveIntensity = bg.intensity
      } else mt.emissiveIntensity = 0
    })
  }

  // ================= Flujo principal =================
  extra: Rect[] = []
  lastCause: DeathCause = 'soldier'
  deadShown = false
  private objTimer = 0
  private radarDots: RadarDot[] = []

  say(text: string, delay = 0): void {
    this.radioQ.push({ t: delay, text })
  }
  private setDoors(): void {
    setDoor(this.door1, this.d1)
    setDoor(this.door2, this.d2)
  }
  private updateRadio(dt: number): void {
    for (let i = this.radioQ.length - 1; i >= 0; i--) {
      const q = this.radioQ[i]
      q.t -= dt
      if (q.t <= 0) {
        this.radioQ.splice(i, 1)
        this.hud.radio(q.text)
        sfx.radio()
      }
    }
  }

  start(): void {
    this.resetRun()
    this.mode = 'play'
    this.hud.showHud(true, this.input.touchMode)
    this.hud.caption('1. El descubrimiento', 2800)
    this.say('Aquí el sargento… estación, ¿me copian? …Nada. Sólo estática.', 1.2)
    this.say('Hay una infestación alienígena en este planeta. Repito: infestación. Sin respuesta de la estación.', 7)
    sfx.door()
  }

  frame(dt: number): void {
    dt = Math.min(dt, 0.05)
    if (!this.paused) this.update(dt)
    this.sync(dt)
    this.renderer.render(this.scene, this.camera)
    this.input.endFrame()
  }

  private update(dt: number): void {
    this.t += dt
    this.fx.step(dt)
    this.shake = Math.max(0, this.shake - dt * 30)
    this.hurtFx = Math.max(0, this.hurtFx - dt * 2.2)
    this.extra = [...doorPanels(900, this.d1), ...doorPanels(1855, this.d2)]
    this.updateRadio(dt)

    if (this.mode === 'menu') {
      this.yaw += dt * 0.12
      this.input.consumeLook()
      return
    }
    if (this.mode === 'dead') {
      this.deadT += dt
      this.input.consumeLook()
      if (this.deadT > 0.9 && !this.deadShown) {
        this.deadShown = true
        this.hud.deadScreen(DEAD_TEXT[this.lastCause], this.statLines())
        this.input.exitLock()
      }
      this.updateBones(dt)
      this.updateEnemies(dt * 0.4)
      return
    }
    if (this.mode === 'ending' || this.mode === 'end') {
      this.updateEnding(dt)
      return
    }

    this.runTime += dt
    this.p.inv = Math.max(0, this.p.inv - dt)
    this.p.danger += dt
    this.noiseT = Math.max(0, this.noiseT - dt)
    this.updateCamInput(dt)
    if (this.buggy.riding) this.updateBuggy(dt)
    else this.updateFoot(dt)
    this.updateStamina(dt)
    this.handleWeaponKeys()
    this.interact()
    this.tryFire(dt)
    this.tryThrowGrenade(dt)
    this.updateGrenades(dt)
    this.updateCorridor(dt)
    this.updatePickups()
    this.updateLegos(dt)
    this.updateBeacons()
    this.updateSites()
    this.updateHazards(dt)
    this.updateEnemies(dt)
    this.spawnHorde(dt)
    this.updateBullets(dt)
    this.updateEProj(dt)
    this.updateBones(dt)
    // recuperación ligera si no hay peligro cerca
    if (this.p.danger > 4 && this.p.hp < 60) this.p.hp = Math.min(60, this.p.hp + 6 * dt)
    this.objTimer -= dt
    if (this.objTimer <= 0) {
      this.objTimer = 0.25
      this.updateObjective()
    }
  }

  private updateCamInput(dt: number): void {
    const [lx, ly] = this.input.consumeLook()
    if (lx || ly) this.lastLook = this.t
    const sens = SETTINGS.sensitivity * (this.p.zoomed ? 0.32 : 1)
    this.yaw += lx * 0.0032 * sens
    this.pitch += ly * 0.0028 * sens
    const ts = 2.3 * dt * sens
    const k = this.input.keys
    if (k.has('ArrowLeft')) { this.yaw -= ts; this.lastLook = this.t }
    if (k.has('ArrowRight')) { this.yaw += ts; this.lastLook = this.t }
    if (k.has('ArrowUp')) this.pitch -= ts * 0.5
    if (k.has('ArrowDown')) this.pitch += ts * 0.5
    this.pitch = this.p.zoomed ? clamp(this.pitch, -0.45, 0.55) : clamp(this.pitch, 0.2, 0.8)
  }

  private updateFoot(dt: number): void {
    const p = this.p
    const { f, s } = this.input.axis()
    const fx = Math.cos(this.yaw)
    const fz = Math.sin(this.yaw)
    const mx = fx * f + -fz * s
    const my = fz * f + fx * s
    const hasInput = f !== 0 || s !== 0

    // correr (Shift): consume estamina mientras te mueves
    const k = this.input.keys
    const wantRun = (k.has('ShiftLeft') || k.has('ShiftRight') || this.input.touchRun) && hasInput
    p.running = wantRun && !p.exhausted && p.stamina > 0 && p.dashT <= 0
    if (p.running) {
      p.stamina = Math.max(0, p.stamina - STAMINA.runCost * dt)
      p.staminaIdle = 0
      if (p.stamina <= 0) {
        p.exhausted = true
        p.running = false
      }
    }

    // dash (C): impulso corto en la dirección de movimiento (o hacia donde miras)
    p.dashCd = Math.max(0, p.dashCd - dt)
    if (this.input.take('KeyC') && p.dashT <= 0 && p.dashCd <= 0 && p.stamina >= STAMINA.dashCost) {
      const m = Math.hypot(mx, my)
      p.dashX = hasInput ? mx / m : fx
      p.dashY = hasInput ? my / m : fz
      p.dashT = STAMINA.dashTime
      p.dashCd = STAMINA.dashCooldown
      p.stamina -= STAMINA.dashCost
      p.staminaIdle = 0
      sfx.weapon()
      this.fx.burst(p.x - p.dashX * 10, p.y - p.dashY * 10, 8, 0xd8c79a, 120, 0.35, 4, 8)
    }

    const base = CONFIG.player.speed
    const sp = base * (p.running ? STAMINA.runMul : 1)
    const kx = p.kx * dt
    const ky = p.ky * dt
    p.kx *= 0.86
    p.ky *= 0.86
    const ox = p.x
    const oy = p.y
    let dx = mx * sp * dt + kx
    let dy = my * sp * dt + ky
    if (p.dashT > 0) {
      const step = (STAMINA.dashDist / STAMINA.dashTime) * Math.min(dt, p.dashT)
      dx = p.dashX * step + kx
      dy = p.dashY * step + ky
      p.dashT -= dt
      if (Math.random() < 0.7) this.fx.burst(p.x, p.y, 1, 0xd8c79a, 40, 0.4, 4, 6)
    }
    moveCircle(this.grid, this.extra, p, dx, dy)
    p.moving = clamp(Math.hypot(p.x - ox, p.y - oy) / (base * dt + 1e-6), 0, 1.6)
    p.walk += p.moving * dt * 11
    p.face = this.yaw
  }

  /** Regeneración de estamina: sólo cuando no corres ni haces dash. */
  private updateStamina(dt: number): void {
    const p = this.p
    if (this.buggy.riding) p.running = false
    if (p.running || p.dashT > 0) return
    p.staminaIdle += dt
    if (p.staminaIdle < STAMINA.regenDelay) return
    p.stamina = Math.min(STAMINA.max, p.stamina + STAMINA.regen * dt)
    if (p.exhausted && p.stamina >= STAMINA.exhaustRecover) p.exhausted = false
  }

  private updateBuggy(dt: number): void {
    const b = this.buggy
    const p = this.p
    const { f, s } = this.input.axis()
    const max = CONFIG.buggy.maxSpeed
    if (f > 0) b.v += CONFIG.buggy.accel * f * dt * (b.v < 0 ? 2.2 : 1)
    else if (f < 0) b.v -= (b.v > 8 ? 560 : 260) * -f * dt
    else b.v -= Math.sign(b.v) * Math.min(Math.abs(b.v), 170 * dt)
    b.v = clamp(b.v, -150, max)
    const steer = s * 2.1 * clamp(Math.abs(b.v) / 140, 0, 1) * (b.v < 0 ? -1 : 1)
    b.h += steer * dt
    const c = { x: b.x, y: b.y, r: b.r }
    const hit = moveCircle(this.grid, this.extra, c, Math.cos(b.h) * b.v * dt, Math.sin(b.h) * b.v * dt)
    const moved = Math.hypot(c.x - b.x, c.y - b.y)
    if (hit && Math.abs(b.v) > 60 && moved < Math.abs(b.v) * dt * 0.7) {
      if (Math.abs(b.v) > 200) {
        this.shake = Math.max(this.shake, 9)
        sfx.slam()
        this.fx.burst(c.x, c.y, 10, 0xd8c79a, 180, 0.5, 4, 14)
      }
      b.v *= 0.35
    }
    b.x = c.x
    b.y = c.y
    b.spin += (b.v * dt) / 11
    p.x = b.x
    p.y = b.y
    p.face = b.h
    p.moving = 0
    if (Math.abs(b.v) > 60 && Math.random() < 0.8) this.fx.burst(b.x - Math.cos(b.h) * 36, b.y - Math.sin(b.h) * 36 + rnd(-10, 10), 1, 0xd8c79a, 50, 0.7, 5, 6)
    // la cámara se alinea con el rumbo si no estás moviendo el ratón
    if (this.t - this.lastLook > 1.1 && Math.abs(b.v) > 50) {
      this.yaw += angDiff(this.yaw, b.h) * (1 - Math.pow(0.12, dt))
      this.pitch = lerp(this.pitch, 0.34, 1 - Math.pow(0.3, dt))
    }
    engineSet(true, Math.abs(b.v) / max)
  }

  // ---------- Armas ----------
  private handleWeaponKeys(): void {
    const inp = this.input
    if (inp.take('Digit1')) this.selectWeapon('pistol')
    if (inp.take('Digit2')) this.selectWeapon('rifle')
    if (inp.take('Digit3')) this.selectWeapon('shotgun')
    if (inp.take('Digit4')) this.selectWeapon('sniper')
    if (inp.take('KeyQ')) this.cycleWeapon(1)
    if (inp.take('KeyZ')) {
      if (this.p.weapon === 'sniper' && this.p.owned.sniper && !this.buggy.riding && this.p.alive) {
        this.p.zoomed = !this.p.zoomed
        sfx.weapon()
      } else {
        this.p.zoomed = false
      }
    }
    if (this.p.weapon !== 'sniper' || this.buggy.riding || !this.p.alive) this.p.zoomed = false
    const w = inp.consumeWheel()
    if (w) this.cycleWeapon(w > 0 ? 1 : -1)
  }
  selectWeapon(w: WeaponId): void {
    if (!this.p.owned[w] || this.p.weapon === w) return
    this.p.weapon = w
    if (w !== 'sniper') this.p.zoomed = false
    this.p.cd = Math.max(this.p.cd, 0.18)
    sfx.weapon()
  }
  private cycleWeapon(dir: number): void {
    const owned = WEAPON_ORDER.filter(w => this.p.owned[w])
    if (owned.length < 2) return
    const i = owned.indexOf(this.p.weapon)
    this.selectWeapon(owned[(i + dir + owned.length) % owned.length])
  }

  private tryFire(dt: number): void {
    const p = this.p
    p.cd = Math.max(0, p.cd - dt)
    if (this.buggy.riding || !p.alive || !this.input.fire) return
    const w = WEAPONS[p.weapon]
    if (!p.owned[w.id] || p.cd > 0) return
    if (w.id !== 'pistol') {
      if (p.ammo[w.id] <= 0) {
        p.cd = 0.3
        p.zoomed = false
        beep(120, 0.05, { type: 'square', vol: 0.05 })
        if (p.owned.pistol) this.selectWeapon('pistol')
        this.hud.caption('¡Sin munición!', 900)
        return
      }
      p.ammo[w.id]--
    }
    p.cd = w.rate
    if (w.id === 'sniper') {
      this.fireSniper()
      return
    }
    const fx = Math.cos(this.yaw)
    const fz = Math.sin(this.yaw)
    const rx = -fz
    const rz = fx
    const gz = this.world.heightAt(p.x, p.y)
    const mxp = p.x + fx * 36 + rx * 4
    const myp = p.y + fz * 36 + rz * 4
    const ax = p.x + rx * 26 + fx * 620
    const ay = p.y + rz * 26 + fz * 620
    const base = Math.atan2(ay - myp, ax - mxp)
    for (let i = 0; i < w.pellets; i++) {
      const a = base + (Math.random() - 0.5) * 2 * w.spread
      const spd = w.speed * (w.pellets > 1 ? rnd(0.9, 1.08) : 1)
      const m = new THREE.Mesh(bulletGeo, bulletMats[w.id])
      m.scale.set(w.id === 'shotgun' ? 8 : 15, 2.6, 2.6)
      m.position.set(mxp, gz + 28, myp)
      m.rotation.y = -a
      this.projG.add(m)
      this.bullets.push({ x: mxp, y: myp, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, life: w.life, dmg: w.dmg, mesh: m, speed: spd })
    }
    this.fx.burst(mxp, myp, w.id === 'shotgun' ? 8 : 3, w.color, 130, 0.12, 2.6, gz + 28)
    if (w.id === 'shotgun') sfx.shotgun()
    else sfx.shoot(w.freq, w.id === 'rifle' ? 0.04 : 0.05)
    this.shake = Math.max(this.shake, w.shake)
    this.noiseT = 0.7
    if (w.id === 'shotgun') {
      p.kx -= fx * 70
      p.ky -= fz * 70
    }
  }

  /** Disparo del Francotirador: bala de luz instantánea (200 daño; de cerca mata al instante). */
  private fireSniper(): void {
    const p = this.p
    const w = WEAPONS.sniper
    const fx = Math.cos(this.yaw)
    const fz = Math.sin(this.yaw)
    const rx = -fz
    const rz = fx
    const gz = this.world.heightAt(p.x, p.y)
    const mxp = p.x + fx * (p.zoomed ? 12 : 38) + rx * (p.zoomed ? 0 : 4)
    const myp = p.y + fz * (p.zoomed ? 12 : 38) + rz * (p.zoomed ? 0 : 4)
    const ax = p.x + rx * 26 + fx * 620
    const ay = p.y + rz * 26 + fz * 620
    const a = p.zoomed ? this.yaw : Math.atan2(ay - myp, ax - mxp) + (Math.random() - 0.5) * 2 * w.spread
    const dx = Math.cos(a)
    const dy = Math.sin(a)
    let bestD = rayDistance(this.grid, this.extra, mxp, myp, dx, dy, SNIPER.range)
    let hitKind: 'wall' | 'enemy' | 'imp' | 'turret' | 'gen' = 'wall'
    let hitEnemy: Enemy | null = null
    let hitTurret: Turret | null = null
    let hitGen: Gen | null = null

    const testCircle = (cx: number, cy: number, r: number): number => {
      const vx = cx - mxp
      const vy = cy - myp
      const proj = vx * dx + vy * dy
      if (proj < 0 || proj > bestD + r) return -1
      const px = vx - dx * proj
      const py = vy - dy * proj
      const d2 = px * px + py * py
      if (d2 > r * r) return -1
      return Math.max(0, proj - Math.sqrt(Math.max(0, r * r - d2)))
    }

    for (const e of this.enemies) {
      if (e.state === 'dead') continue
      const hd = testCircle(e.x, e.y, e.r + 5)
      if (hd >= 0 && hd < bestD) {
        bestD = hd
        hitKind = 'enemy'
        hitEnemy = e
      }
    }
    const im = this.imp
    if (im.state === 'chase' || (im.state === 'forming' && im.t > 0.6)) {
      const hd = testCircle(im.x, im.y, im.r + 5)
      if (hd >= 0 && hd < bestD) {
        bestD = hd
        hitKind = 'imp'
      }
    }
    for (const t of this.turrets) {
      if (t.state === 'dead') continue
      const hd = testCircle(t.x, t.y, 18)
      if (hd >= 0 && hd < bestD) {
        bestD = hd
        hitKind = 'turret'
        hitTurret = t
      }
    }
    for (const f of this.fences) {
      for (const g of [f.a, f.b]) {
        if (!g.alive) continue
        const hd = testCircle(g.x, g.y, 13)
        if (hd >= 0 && hd < bestD) {
          bestD = hd
          hitKind = 'gen'
          hitGen = g
        }
      }
    }

    const endX = mxp + dx * bestD
    const endY = myp + dy * bestD
    const close = bestD < SNIPER.closeRange
    if (hitKind === 'enemy' && hitEnemy) {
      const dmg = close ? (hitEnemy.kind === 'boss' ? SNIPER.bossCloseDmg : hitEnemy.hp + 1) : w.dmg
      this.damageEnemy(hitEnemy, dmg)
    } else if (hitKind === 'imp') {
      this.damageImpostor(close ? SNIPER.bossCloseDmg : w.dmg)
    } else if (hitKind === 'turret' && hitTurret) {
      this.damageTurret(hitTurret, w.dmg)
    } else if (hitKind === 'gen' && hitGen) {
      this.damageGen(hitGen, w.dmg)
    }

    // Bala de luz (haz luminoso con núcleo brillante)
    const startZ = gz + (p.zoomed ? 36 : 29)
    const endZ = hitKind === 'enemy' && hitEnemy ? ALIENS[hitEnemy.kind].height * 0.55 : 26
    const midX = (mxp + endX) * 0.5
    const midY = (myp + endY) * 0.5
    const midZ = (startZ + endZ) * 0.5
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0xfff6b0,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
    const beam = new THREE.Mesh(bulletGeo, beamMat)
    beam.scale.set(Math.max(8, bestD), 3.4, 3.4)
    beam.position.set(midX, midZ, midY)
    beam.rotation.y = -a
    this.projG.add(beam)
    this.beams.push({ mesh: beam, t: 0, max: 0.22 })

    this.fx.burst(mxp, myp, 6, 0xfff6b0, 150, 0.16, 3, startZ)
    this.fx.burst(endX, endY, 14, 0x8feeff, 200, 0.32, 3.5, endZ)
    sfx.sniper()
    this.shake = Math.max(this.shake, w.shake)
    this.noiseT = 1
    p.kx -= fx * 45
    p.ky -= fz * 45
  }

  // ---------- Granadas de plasma ----------
  private tryThrowGrenade(dt: number): void {
    const p = this.p
    p.grenadeCd = Math.max(0, p.grenadeCd - dt)
    if (!this.input.take('KeyG')) return
    if (this.buggy.riding || !p.alive) return
    if (!p.hasGrenade) {
      this.hud.caption('Aún no tienes granadas de plasma', 1100)
      return
    }
    if (p.grenades <= 0) {
      beep(120, 0.05, { type: 'square', vol: 0.05 })
      this.hud.caption('¡Sin granadas!', 900)
      return
    }
    if (p.grenadeCd > 0) return
    p.grenades--
    p.grenadeCd = GRENADE.cooldown
    const fx = Math.cos(this.yaw)
    const fz = Math.sin(this.yaw)
    const x = p.x + fx * 22
    const y = p.y + fz * 22
    const mesh = new THREE.Group()
    const core = new THREE.Mesh(projGeo, new THREE.MeshBasicMaterial({ color: 0x6dff4a }))
    core.scale.setScalar(5.5)
    const light = new THREE.Mesh(projGeo, new THREE.MeshBasicMaterial({ color: 0x6dff4a, transparent: true, opacity: 0.32, depthWrite: false, blending: THREE.AdditiveBlending }))
    light.scale.setScalar(10)
    const band = new THREE.Mesh(new THREE.TorusGeometry(5.8, 1.1, 6, 14), new THREE.MeshBasicMaterial({ color: 0x1b2a14 }))
    mesh.add(core, light, band)
    mesh.position.set(x, 26, y)
    this.projG.add(mesh)
    this.grenades.push({ x, y, z: 26, vx: fx * GRENADE.throwSpeed + 0, vy: fz * GRENADE.throwSpeed, vz: 150, fuse: GRENADE.fuse, stuck: null, mesh, core, light })
    beep(300, 0.08, { type: 'triangle', vol: 0.06, slide: 120 })
    this.noiseT = Math.max(this.noiseT, 0.4)
  }

  private updateGrenades(dt: number): void {
    const im = this.imp
    for (let i = this.grenades.length - 1; i >= 0; i--) {
      const g = this.grenades[i]
      g.fuse -= dt
      const st = g.stuck
      if (st && st.type === 'enemy') {
        if (st.e.state === 'dead') {
          g.stuck = null
          g.vx = g.vy = 0
          g.vz = 0
        } else {
          g.x = st.e.x + st.dx
          g.y = st.e.y + st.dy
        }
      } else if (st && st.type === 'imp') {
        if (im.state === 'dead') {
          g.stuck = null
          g.vx = g.vy = 0
          g.vz = 0
        } else {
          g.x = im.x + st.dx
          g.y = im.y + st.dy
        }
      }
      if (!g.stuck) {
        g.vz -= 520 * dt
        g.z += g.vz * dt
        const floorZ = this.world.heightAt(g.x, g.y) + 5
        if (g.z <= floorZ) {
          g.z = floorZ
          g.stuck = { type: 'wall' }
          g.vx = g.vy = g.vz = 0
        }
        const sp = Math.hypot(g.vx, g.vy)
        const steps = Math.max(1, Math.ceil((sp * dt) / 6))
        for (let k = 0; k < steps && !g.stuck; k++) {
          const px = g.x
          const py = g.y
          g.x += (g.vx * dt) / steps
          g.y += (g.vy * dt) / steps
          if (this.solidAt(g.x, g.y)) {
            g.x = px
            g.y = py
            g.stuck = { type: 'wall' }
            break
          }
          for (const e of this.enemies) {
            if (e.state === 'dead' || !e.vis) continue
            const dx = g.x - e.x
            const dy = g.y - e.y
            if (dx * dx + dy * dy < (e.r + 5) * (e.r + 5)) {
              g.stuck = { type: 'enemy', e, dx, dy }
              break
            }
          }
          if (g.stuck) break
          if ((im.state === 'chase' || im.state === 'forming') && Math.hypot(g.x - im.x, g.y - im.y) < im.r + 5) {
            g.stuck = { type: 'imp', dx: g.x - im.x, dy: g.y - im.y }
            break
          }
          for (const t of this.turrets) {
            if (t.state !== 'dead' && Math.hypot(g.x - t.x, g.y - t.y) < 19) {
              g.stuck = { type: 'wall' }
              break
            }
          }
        }
        if (g.stuck) {
          g.vx = g.vy = g.vz = 0
          if (g.stuck.type === 'wall') this.fx.burst(g.x, g.y, 4, 0x6dff4a, 60, 0.2, 2.5, g.z)
        }
      }
      // parpadeo cada vez más rápido al acercarse la explosión
      const rate = 5 + (GRENADE.fuse - Math.max(0, g.fuse)) * 9
      const on = Math.floor(this.t * rate) % 2 === 0
        ; (g.core.material as THREE.MeshBasicMaterial).color.setHex(on ? 0xeaffd8 : 0x3fd12a)
      g.light.scale.setScalar(10 + (on ? 4 : 0) + (GRENADE.fuse - g.fuse) * 2)
      g.mesh.position.set(g.x, g.z, g.y)
      if (g.fuse <= 0) {
        this.explodeGrenade(g)
        this.projG.remove(g.mesh)
        this.grenades.splice(i, 1)
      }
    }
    for (let i = this.blasts.length - 1; i >= 0; i--) {
      const b = this.blasts[i]
      b.t += dt
      const k = Math.min(1, b.t / b.max)
      b.mesh.scale.setScalar(Math.max(1, GRENADE.radius * (0.2 + 0.8 * (1 - Math.pow(1 - k, 3)))))
        ; (b.mesh.material as THREE.MeshBasicMaterial).opacity = 0.6 * (1 - k)
      if (k >= 1) {
        this.projG.remove(b.mesh)
        this.blasts.splice(i, 1)
      }
    }
  }

  /** Daño de la explosión: 100% de la vida en el centro y decae linealmente hasta 0 en el borde del radio. */
  private blastFalloff(d: number): number {
    if (d <= GRENADE.core) return 1
    if (d >= GRENADE.radius) return 0
    return 1 - (d - GRENADE.core) / (GRENADE.radius - GRENADE.core)
  }

  private explodeGrenade(g: Grenade): void {
    const { x, y } = g
    const direct = g.stuck && g.stuck.type === 'enemy' ? g.stuck.e : null
    for (const e of [...this.enemies]) {
      if (e.state === 'dead') continue
      const d = Math.max(0, Math.hypot(e.x - x, e.y - y) - e.r * 0.5)
      const f = e === direct ? 1 : this.blastFalloff(d)
      if (f > 0) this.damageEnemy(e, e.maxHp * f)
    }
    const im = this.imp
    if (im.state === 'chase' || im.state === 'forming') {
      const f = g.stuck && g.stuck.type === 'imp' ? 1 : this.blastFalloff(Math.max(0, Math.hypot(im.x - x, im.y - y) - im.r * 0.5))
      if (f > 0) this.damageImpostor(IMPOSTOR_HP * f)
    }
    for (const t of this.turrets) {
      if (t.state === 'dead') continue
      const f = this.blastFalloff(Math.hypot(t.x - x, t.y - y))
      if (f > 0) this.damageTurret(t, 40 * f)
    }
    for (const f of this.fences) {
      for (const gen of [f.a, f.b]) {
        if (!gen.alive) continue
        const k = this.blastFalloff(Math.hypot(gen.x - x, gen.y - y))
        if (k > 0) this.damageGen(gen, 12 * k)
      }
    }
    const p = this.p
    if (p.alive && this.mode === 'play') {
      const pr = this.buggy.riding ? this.buggy.r : p.r
      const f = this.blastFalloff(Math.max(0, Math.hypot(p.x - x, p.y - y) - pr * 0.5))
      if (f > 0) {
        p.inv = 0
        this.hurtPlayer((MAX_HP * f) / Math.max(0.01, CONFIG.difficulty.damageTaken), x, y, 180, 'grenade')
      }
    }
    // efectos
    const R = GRENADE.radius
    this.fx.burst(x, y, 46, 0x6dff4a, 340, 0.75, 5, 22)
    this.fx.burst(x, y, 20, 0xffffff, 260, 0.5, 4, 26)
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * 6.283
      this.fx.burst(x + Math.cos(a) * R * 0.7, y + Math.sin(a) * R * 0.7, 1, 0x9dff7a, 120, 0.5, 4, 10)
    }
    const m = new THREE.Mesh(projGeo, new THREE.MeshBasicMaterial({ color: 0x6dff4a, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending }))
    m.position.set(x, Math.max(10, g.z), y)
    this.projG.add(m)
    this.blasts.push({ mesh: m, t: 0, max: 0.45 })
    sfx.slam()
    beep(90, 0.5, { type: 'sawtooth', vol: 0.09, slide: 40 })
    this.shake = Math.max(this.shake, 18)
    this.noiseT = 1
  }

  // ---------- Interacción ----------
  private nearBuggy(): boolean {
    return !this.buggy.riding && Math.hypot(this.p.x - this.buggy.x, this.p.y - this.buggy.y) < 80
  }
  private nearShip(): boolean {
    return !this.buggy.riding && Math.hypot(this.p.x - SHIP.x, this.p.y - SHIP.y) < 200
  }

  private interact(): void {
    const used = this.input.take('KeyE')
    const b = this.buggy
    const p = this.p
    // texto de ayuda contextual
    let prompt = ''
    if (b.riding) prompt = Math.abs(b.v) < 150 ? 'E · Bajar del buggy' : ''
    else if (this.nearBuggy() && this.flags.impDead) prompt = 'E · Subir al buggy'
    else if (this.nearShip()) prompt = this.flags.bossDead ? 'E · ¡Abordar la nave!' : 'Escudo activo: derrota al jefe impostor'
    this.hud.prompt(prompt)
    if (!used) return

    if (b.riding) {
      if (Math.abs(b.v) >= 150) return
      // bajar a un costado libre del buggy
      const rx = -Math.sin(b.h)
      const ry = Math.cos(b.h)
      for (const side of [1, -1, 0]) {
        const c = { x: b.x + rx * 46 * side - Math.cos(b.h) * (side === 0 ? 46 : 0), y: b.y + ry * 46 * side - Math.sin(b.h) * (side === 0 ? 46 : 0), r: p.r }
        const hits = this.grid.query(c.x - 20, c.y - 20, c.x + 20, c.y + 20, []).some(r => c.x > r.x - c.r && c.x < r.x + r.w + c.r && c.y > r.y - c.r && c.y < r.y + r.h + c.r)
        if (!hits || side === 0) {
          p.x = c.x
          p.y = c.y
          break
        }
      }
      b.riding = false
      b.v = 0
      engineSet(false, 0)
      sfx.door()
      this.hud.caption('A pie: explora las ruinas', 1600)
      return
    }
    if (this.nearBuggy() && this.flags.impDead) {
      b.riding = true
      b.v = 0
      engineSet(true, 0)
      sfx.door()
      if (!this.flags.boarded) {
        this.flags.boarded = true
        b.boarded = true
        this.world.endWall.on = false
        this.world.endWallMesh.visible = false
        this.hud.caption('4. ¡Misión de supervivencia!', 3200)
        this.say('El mundo se abre ante ti. Hay una nave de escape en algún lugar al este… con combustible sólo para el planeta más cercano.', 1.5)
        this.say('Explora ruinas, busca armas y botiquines. Y cuidado con las torretas.', 9)
        this.shake = 8
      }
      return
    }
    if (this.nearShip()) {
      if (this.flags.bossDead) this.launch()
      else {
        this.hud.caption('¡Escudo activo!', 1600)
        sfx.hit()
      }
    }
  }

  private launch(): void {
    this.mode = 'ending'
    this.ending = { t: 0, fade: false, shown: false }
    this.hud.prompt('')
    this.hud.caption('¡Despegue!', 3500)
    sfx.launch()
    engineSet(false, 0)
    this.p.alive = false
  }

  private updateEnding(dt: number): void {
    const e = this.ending
    this.input.consumeLook()
    if (this.mode === 'end') return
    e.t += dt
    const lift = e.t > 0.9 ? Math.pow(e.t - 0.9, 2) * 90 : 0
    this.shipM.position.set(SHIP.x + (e.t > 0.2 ? Math.sin(this.t * 60) * 1.2 : 0), lift, SHIP.y)
    if (e.t > 0.4) {
      this.fx.jet(SHIP.x + 70, SHIP.y, lift + 22, 5, 0xffa530, 320, 36, 0.6, 7)
      this.fx.jet(SHIP.x + 70, SHIP.y, lift + 22, 3, 0xfff2b0, 360, 20, 0.4, 5)
      this.fx.jet(SHIP.x + 70, SHIP.y, 4, 2, 0xd8c79a, 80, 120, 0.9, 8)
    }
    this.shake = e.t > 0.4 && e.t < 3 ? 4 : 0
    if (e.t > 3.3 && !e.fade) {
      e.fade = true
      this.hud.fade(true)
    }
    if (e.t > 5 && !e.shown) {
      e.shown = true
      this.mode = 'end'
      this.hud.showHud(false)
      this.hud.endScreen(this.statLines())
      this.input.exitLock()
      sfx.win()
    }
  }

  statLines(): string[] {
    const m = Math.floor(this.runTime / 60)
    const s = Math.floor(this.runTime % 60).toString().padStart(2, '0')
    return [
      `Tiempo <b>${m}:${s}</b>`,
      `Caídas <b>${this.stats.deaths}</b>`,
      `Aliens derrotados <b>${this.stats.kills}</b>`,
      `Piezas LEGO <b>${this.stats.lego}/${LEGO_TOTAL}</b>`,
      `Ruinas exploradas <b>${this.stats.ruins}/${this.world.sites.length}</b>`,
    ]
  }

  // ---------- Pasillo inicial (puertas, impostor) ----------
  private updateCorridor(dt: number): void {
    const p = this.p
    const im = this.imp
    const near1 = Math.abs(p.x - 900) < 130
    const near2 = Math.abs(p.x - 1855) < 150 && im.state === 'dead'
    if (near1) {
      if (!this.flags.d1snd) { this.flags.d1snd = true; sfx.door() }
      this.d1 = Math.min(1, this.d1 + dt * 1.6)
    }
    if (near2) {
      if (!this.flags.d2snd) { this.flags.d2snd = true; sfx.door() }
      this.d2 = Math.min(1, this.d2 + dt * 1.6)
    }
    if (p.x > 960 && p.x < 1900 && this.cp.x < 960 && p.alive) this.cp = { x: 960, y: 270, name: 'Pasillo' }
    if (im.state === 'dead' && p.x > 1900 && p.x < 2500 && this.cp.x < 1990) this.cp = { x: 1990, y: 270, name: 'Zona roja' }
    if (im.state === 'dormant' && p.x > 1120) {
      im.state = 'forming'
      im.t = 0
      this.shake = 10
      this.hud.caption('¡El impostor se transforma!', 2600)
      beep(80, 1.1, { type: 'sawtooth', vol: 0.08, slide: 260 })
    }
    this.updateImpostor(dt)
  }

  private updateImpostor(dt: number): void {
    const e = this.imp
    const p = this.p
    e.flash = Math.max(0, e.flash - dt)
    e.biteCd = Math.max(0, e.biteCd - dt)
    if (e.state === 'dormant') return
    e.t += dt
    if (e.state === 'forming') {
      if (e.t > 1.3) { e.state = 'chase'; e.t = 0; e.stun = 0.4; this.hud.caption('La persecución', 2200) }
      return
    }
    if (e.state === 'dead') return
    const dx = p.x - e.x
    const dy = p.y - e.y
    const d = Math.hypot(dx, dy) || 1
    e.face += angDiff(e.face, Math.atan2(dy, dx)) * Math.min(1, dt * (e.charging > 0 ? 0 : 7))
    const los = losClear(this.grid, this.extra, e.x, e.y, p.x, p.y)
    let mouthT = 0.35
    if (e.stun > 0) { e.stun -= dt; mouthT = 0.1 }
    else if (e.wind) {
      e.wind.t -= dt
      mouthT = 1
      if (e.wind.t <= 0) {
        if (e.wind.type === 'spit') {
          const a = Math.atan2(p.y - e.y, p.x - e.x)
          const grp = new THREE.Group()
          const bd = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.4, 16, 8), new THREE.MeshBasicMaterial({ color: 0x38b24a }))
          bd.rotation.z = Math.PI / 2
          bd.position.x = -5
          grp.add(bd)
          const tp = new THREE.Mesh(new THREE.SphereGeometry(5.5, 10, 8), new THREE.MeshBasicMaterial({ color: 0xd02a4a }))
          tp.position.x = 4
          grp.add(tp)
          grp.rotation.y = -a
          this.projG.add(grp)
          this.spits.push({ x: e.x + Math.cos(a) * e.r, y: e.y + Math.sin(a) * e.r, vx: Math.cos(a) * 350, vy: Math.sin(a) * 350, life: 2, dmg: 20, mesh: grp, cause: 'impostor' })
          beep(300, 0.2, { type: 'sawtooth', vol: 0.05, slide: 120 })
        } else {
          e.charging = 0.6
          e.cdir = Math.atan2(p.y - e.y, p.x - e.x)
          beep(100, 0.4, { type: 'sawtooth', vol: 0.06, slide: 300 })
        }
        e.wind = null
      }
    } else if (e.charging > 0) {
      mouthT = 1
      e.charging -= dt
      e.face = e.cdir
      const c = { x: e.x, y: e.y, r: e.r }
      const hit = moveCircle(this.grid, this.extra, c, Math.cos(e.cdir) * 370 * dt, Math.sin(e.cdir) * 370 * dt)
      e.x = c.x
      e.y = c.y
      if (Math.hypot(e.x - p.x, e.y - p.y) < e.r + p.r) {
        this.hurtPlayer(20, e.x, e.y, 90, 'impostor')
        e.charging = 0
        e.stun = 0.5
      } else if (hit) {
        e.charging = 0
        e.stun = 1.2
        this.shake = 12
        this.fx.burst(e.x + Math.cos(e.cdir) * e.r, e.y + Math.sin(e.cdir) * e.r, 18, 0xffffff, 220, 0.45, 3, 30)
        beep(90, 0.3, { type: 'square', vol: 0.09, slide: 40 })
      }
    } else {
      const speed = lerp(125, 95, e.hp / IMPOSTOR_HP)
      let ux = dx / d
      let uy = dy / d
      if (e.detour > 0) {
        e.detour -= dt
        const px = -uy * e.dd
        const py = ux * e.dd
        ux += px * 1.6
        uy += py * 1.6
        const l = Math.hypot(ux, uy)
        ux /= l
        uy /= l
      }
      const c = { x: e.x, y: e.y, r: e.r }
      if (d > e.r + p.r - 2) moveCircle(this.grid, this.extra, c, ux * speed * dt, uy * speed * dt)
      e.x = c.x
      e.y = c.y
      e.stuckT += dt
      if (e.stuckT > 0.45) {
        const moved = Math.hypot(e.x - e.lx, e.y - e.ly)
        if (moved < speed * 0.45 * 0.3 && d > 70 && e.detour <= 0) { e.detour = 0.9; e.dd = Math.random() < 0.5 ? 1 : -1 }
        e.lx = e.x
        e.ly = e.y
        e.stuckT = 0
      }
      e.spitCd -= dt
      e.chargeCd -= dt
      if (los && d < 640) {
        if (e.chargeCd <= 0 && d > 150 && d < 520) { e.wind = { type: 'charge', t: 0.55 }; e.chargeCd = 4.6 }
        else if (e.spitCd <= 0) { e.wind = { type: 'spit', t: 0.45 }; e.spitCd = 2.4 + rnd(0, 0.8) }
      }
      if (d < e.r + p.r + 5 && e.biteCd <= 0) {
        this.hurtPlayer(20, e.x, e.y, 50, 'impostor')
        e.biteCd = 0.9
        mouthT = 1
      }
    }
    e.mouth = lerp(e.mouth, mouthT, Math.min(1, dt * 14))
    e.x = clamp(e.x, 945, 1815)
    e.y = clamp(e.y, BY0 + e.r + 4, BY1 - e.r - 4)
  }

  damageImpostor(dmg: number): void {
    const e = this.imp
    e.hp -= dmg
    e.flash = 0.12
    sfx.hit()
    this.hud.hitMarker()
    this.fx.burst(e.x, e.y, 6, 0x7db7ff, 150, 0.3)
    if (e.hp <= 0) {
      e.state = 'dead'
      e.t = 0
      e.wind = null
      e.charging = 0
      for (const s of this.spits) this.projG.remove(s.mesh)
      this.spits = []
      this.shake = 14
      this.fx.burst(e.x, e.y, 44, 0x2f7bff, 280, 0.9, 5)
      sfx.kill()
      this.flags.impDead = true
      this.stats.kills++
      this.hud.caption('El escape', 2400)
      this.dropPickup('medkit', e.x, e.y + 30)
      this.say('El impostor cayó. Hay un buggy al final del pasillo: úsalo (E).', 2)
    }
  }

  // ================= Recolección =================
  private updatePickups(): void {
    const p = this.p
    const reach = this.buggy.riding ? 50 : 32
    const pz = this.world.heightAt(p.x, p.y)
    for (const k of this.pickups) {
      if (k.taken) continue
      if (Math.abs(pz - k.z) > 28) continue
      if (Math.hypot(p.x - k.x, p.y - k.y) > reach) continue
      const wp = WEAPONS[k.kind === 'rifle' || k.kind === 'shotgun' || k.kind === 'sniper' ? k.kind : 'pistol']
      switch (k.kind) {
        case 'medkit':
          if (p.hp >= MAX_HP - 1) continue
          p.hp = Math.min(MAX_HP, p.hp + 45)
          sfx.heal()
          this.hud.caption('+ Salud', 900)
          break
        case 'ammo':
          p.ammo.rifle = Math.min(WEAPONS.rifle.maxAmmo, p.ammo.rifle + 40)
          p.ammo.shotgun = Math.min(WEAPONS.shotgun.maxAmmo, p.ammo.shotgun + 8)
          if (p.owned.sniper) p.ammo.sniper = Math.min(WEAPONS.sniper.maxAmmo, p.ammo.sniper + SNIPER.ammoBoxPickup)
          if (p.hasGrenade) p.grenades = Math.min(GRENADE.max, p.grenades + GRENADE.pickupAmount)
          sfx.pickup()
          this.hud.caption(p.hasGrenade ? '+ Munición  (+2 granadas)' : '+ Munición', 900)
          break
        case 'plasma':
          if (p.hasGrenade && p.grenades >= GRENADE.max) continue
          p.grenades = Math.min(GRENADE.max, p.grenades + GRENADE.pickupAmount)
          if (!p.hasGrenade) this.hud.caption('¡Granadas de plasma!  (tecla G)', 2400)
          else this.hud.caption('+ 2 granadas de plasma', 1200)
          p.hasGrenade = true
          sfx.pickup()
          break
        case 'pistol':
          p.owned.pistol = true
          p.weapon = 'pistol'
          sfx.pickup()
          this.hud.caption('Pistola láser', 1800)
          if (!this.flags.pistolMsg) {
            this.flags.pistolMsg = true
            this.say('Armado. Algo se mueve más adelante… sigue por el pasillo.', 1)
          }
          break
        case 'rifle':
        case 'shotgun': {
          const had = p.owned[k.kind]
          p.owned[k.kind] = true
          p.ammo[k.kind] = Math.min(wp.maxAmmo, p.ammo[k.kind] + (had ? Math.ceil(wp.pickupAmmo / 2) : wp.pickupAmmo))
          if (!had) p.weapon = k.kind
          sfx.pickup()
          this.hud.caption(k.kind === 'rifle' ? '¡Rifle de asalto!  (tecla 2)' : '¡Escopeta!  (tecla 3)', 2200)
          break
        }
        case 'sniper': {
          const had = p.owned.sniper
          p.owned.sniper = true
          p.ammo.sniper = Math.min(WEAPONS.sniper.maxAmmo, p.ammo.sniper + (had ? Math.ceil(WEAPONS.sniper.pickupAmmo / 2) : WEAPONS.sniper.pickupAmmo))
          if (!had) p.weapon = 'sniper'
          sfx.pickup()
          this.hud.caption('¡Francotirador!  (tecla 4 · Z mira)', 2600)
          break
        }
      }
      k.taken = true
      this.stats.picks++
      this.fx.burst(k.x, k.y, 14, 0xffffff, 150, 0.5, 3, k.z + 10)
    }
  }

  private updateLegos(dt: number): void {
    const p = this.p
    for (const l of this.legos) {
      if (l.taken) continue
      const d = Math.hypot(p.x - l.x, p.y - l.y)
      if (d < (this.buggy.riding ? 55 : 34)) {
        l.taken = true
        this.stats.lego++
        this.hud.setLego(this.stats.lego, true)
        this.hud.caption(`¡Pieza curiosa de LEGO!  ${this.stats.lego}/${LEGO_TOTAL}`, 1800)
        sfx.lego()
        this.fx.burst(l.x, l.y, 26, 0xffe98a, 220, 0.8, 3.5, 20)
        if (this.stats.lego === LEGO_TOTAL) this.say('¡Colección completa de piezas LEGO! Eres un explorador legendario.', 0.6)
      } else if (d < 380) {
        l.spark -= dt
        if (l.spark <= 0) {
          l.spark = 0.35
          this.fx.burst(l.x, l.y, 1, 0xfff3b0, 40, 0.8, 2.4, 22)
        }
      }
    }
  }

  private updateBeacons(): void {
    const p = this.p
    for (const b of this.beacons) {
      if (b.active || Math.hypot(p.x - b.x, p.y - b.y) > 80) continue
      this.setBeacon(b, true)
      this.cp = { x: b.x, y: b.y + 56, name: b.name }
      p.hp = Math.min(MAX_HP, p.hp + 30)
      sfx.checkpoint()
      this.hud.caption('Punto de control', 1800)
      this.say(`${b.name} activada. Si caes, volverás aquí.`, 0.3)
      this.fx.burst(b.x, b.y, 24, 0x3bff8a, 200, 0.8, 3.5, 30)
    }
  }

  private updateSites(): void {
    const p = this.p
    for (const s of this.world.sites) {
      if (s.visited || p.x < s.x || p.x > s.x + s.w || p.y < s.y || p.y > s.y + s.d) continue
      s.visited = true
      this.stats.ruins++
      this.hud.caption(s.name, 1700)
      if (s.id === 'hangar' && !this.flags.hangarMsg) {
        this.flags.hangarMsg = true
        this.say('Torretas láser en el fondo. Quédate tras las cajas, avanza entre disparos o destrúyelas.', 1)
      }
      if (s.id === 'arena' && !this.flags.arenaMsg) {
        this.flags.arenaMsg = true
        this.say('¡Ahí está la nave! Y algo gigantesco la custodia…', 0.6)
      }
    }
    if (!this.flags.towerMsg && Math.hypot(p.x - this.world.tower.x, p.y - this.world.tower.y) < 130) {
      this.flags.towerMsg = true
      this.say('Intento transmitir desde la torre… sólo estática. La estación sigue sin responder.', 0.3)
      sfx.radio()
    }
    if (!this.flags.shipHint && p.x > ARENA.x - 500) {
      this.flags.shipHint = true
      this.say('Detecto una nave de escape al este, dentro del cráter. Combustible justo para el planeta más cercano.', 0.6)
    }
  }

  // ================= Peligros =================
  private updateHazards(dt: number): void {
    const p = this.p
    // --- torretas láser ---
    for (const t of this.turrets) {
      if (t.state === 'dead') continue
      t.flash = Math.max(0, t.flash - dt)
      t.beamT = Math.max(0, t.beamT - dt)
      t.t += dt
      const d = Math.hypot(p.x - t.x, p.y - t.y)
      const sees = d < 620 && p.alive && losClear(this.grid, this.extra, t.x, t.y, p.x, p.y)
      if (t.state === 'idle') {
        if (sees) { t.state = 'lock'; t.t = 0; sfx.turretLock() }
      } else if (t.state === 'lock') {
        if (t.t < 0.7) t.aim += angDiff(t.aim, Math.atan2(p.y - t.y, p.x - t.x)) * Math.min(1, dt * 9)
        if (!sees && t.t > 0.35) { t.state = 'idle'; t.rig.line.visible = false }
        else if (t.t >= 1.15) {
          const len = rayDistance(this.grid, this.extra, t.x, t.y, Math.cos(t.aim), Math.sin(t.aim), 760)
          const dd = distSegPoint(p.x, p.y, t.x, t.y, t.x + Math.cos(t.aim) * len, t.y + Math.sin(t.aim) * len)
          t.beam.scale.set(len, 5, 5)
          t.beam.position.set(t.x + Math.cos(t.aim) * len / 2, 24, t.y + Math.sin(t.aim) * len / 2)
          t.beam.rotation.y = -t.aim
          t.beam.visible = true
          t.beamT = 0.2
          t.rig.line.visible = false
          sfx.turretFire()
          this.shake = Math.max(this.shake, 6)
          this.fx.burst(t.x + Math.cos(t.aim) * len, t.y + Math.sin(t.aim) * len, 10, 0xff6a3a, 200, 0.4, 3, 20)
          if (dd < p.r + 5) this.hurtPlayer(58, t.x, t.y, 70, 'turret')
          t.state = 'cool'
          t.t = 0
        }
      } else if (t.state === 'cool' && t.t > 1.5) {
        t.state = 'idle'
      }
      if (t.beamT <= 0) t.beam.visible = false
      // línea de puntería
      const ln = t.rig.line
      if (t.state === 'lock') {
        const len = rayDistance(this.grid, this.extra, t.x, t.y, Math.cos(t.aim), Math.sin(t.aim), 760)
        ln.visible = true
        ln.scale.set(len, 1.6, 1.6)
        ln.position.set(t.x + Math.cos(t.aim) * len / 2, 24, t.y + Math.sin(t.aim) * len / 2)
        ln.rotation.y = -t.aim
          ; (ln.material as THREE.MeshBasicMaterial).opacity = 0.25 + (t.t / 1.15) * 0.65
      }
    }

    // --- vallas láser ---
    for (const f of this.fences) {
      const dead = !f.a.alive || !f.b.alive
      const cyc = (this.t + f.spec.phase) % f.spec.period
      f.on = !dead && cyc < f.spec.onTime
      f.warn = !dead && !f.on && cyc > f.spec.period - 0.7
      if (f.on && p.alive) {
        const d = distSegPoint(p.x, p.y, f.spec.ax, f.spec.ay, f.spec.bx, f.spec.by)
        if (d < p.r + 3) this.die('fence', true)
      }
      if (f.on) {
        for (const e of this.enemies) {
          if (e.state === 'dead' || e.kind === 'tank' || e.kind === 'boss') continue
          if (distSegPoint(e.x, e.y, f.spec.ax, f.spec.ay, f.spec.bx, f.spec.by) < e.r + 2) {
            this.damageEnemy(e, 999, false)
            sfx.zap()
          }
        }
      }
    }

    // --- placas de plasma ---
    for (const pl of this.plates) {
      const tt = this.t + pl.spec.phase * 0.9
      const c = tt % 3.4
      const idx = Math.floor(tt / 3.4)
      const burst = c >= 2.4 && c < 2.9
      if (burst && p.alive) {
        const s = pl.spec
        const nx = clamp(p.x, s.x, s.x + s.w)
        const ny = clamp(p.y, s.y, s.y + s.h)
        if (Math.hypot(p.x - nx, p.y - ny) < p.r + 1 && pl.hitCycle !== idx) {
          pl.hitCycle = idx
          this.hurtPlayer(48, nx, ny, 40, 'plasma')
        }
      }
      if (burst && Math.random() < 0.5) this.fx.burst(pl.spec.x + rnd(0, pl.spec.w), pl.spec.y + rnd(0, pl.spec.h), 1, 0xff8a2a, 90, 0.4, 3, 8)
    }
  }

  damageTurret(t: Turret, dmg: number): void {
    t.hp -= dmg
    t.flash = 0.1
    sfx.hit()
    this.hud.hitMarker()
    this.fx.burst(t.x, t.y, 5, 0xffc61a, 140, 0.3, 2.5, 26)
    if (t.hp <= 0) {
      t.state = 'dead'
      t.beam.visible = false
      t.rig.line.visible = false
      t.rig.head.rotation.z = -0.5
        ; (t.rig.eye.material as THREE.MeshBasicMaterial).color.setHex(0x111111)
      this.fx.burst(t.x, t.y, 30, 0xff8a2a, 260, 0.8, 4, 24)
      this.fx.burst(t.x, t.y, 12, 0x333333, 140, 1, 5, 30)
      sfx.kill()
      this.shake = Math.max(this.shake, 6)
    }
  }

  damageGen(g: Gen, dmg: number): void {
    g.hp -= dmg
    sfx.hit()
    this.hud.hitMarker()
    this.fx.burst(g.x, g.y, 4, 0x57f2ff, 120, 0.3, 2.5, 36)
    if (g.hp <= 0 && g.alive) {
      g.alive = false
      g.core.visible = false
      this.fx.burst(g.x, g.y, 24, 0x57f2ff, 240, 0.7, 3.5, 36)
      sfx.zap()
      this.hud.caption('Valla desactivada', 1200)
    }
  }

  // ================= Daño y muerte del jugador =================
  hurtPlayer(dmg: number, sx: number, sy: number, push: number, cause: DeathCause): void {
    const p = this.p
    if (!p.alive || this.mode !== 'play' || p.inv > 0) return
    p.hp -= dmg * CONFIG.difficulty.damageTaken
    p.inv = dmg >= 30 ? 0.6 : 0.3
    p.danger = 0
    this.shake = Math.max(this.shake, dmg >= 30 ? 14 : 8)
    this.hurtFx = 1
    if (!this.buggy.riding) {
      const dx = p.x - sx
      const dy = p.y - sy
      const d = Math.hypot(dx, dy) || 1
      p.kx = (dx / d) * push * 6
      p.ky = (dy / d) * push * 6
    } else this.buggy.v *= 0.6
    this.fx.burst(p.x, p.y, 10, 0xff5a5a, 160, 0.35)
    sfx.hurt()
    if (p.hp <= 0) this.die(cause, false)
  }

  die(cause: DeathCause, disintegrate: boolean): void {
    const p = this.p
    if (!p.alive || this.mode !== 'play') return
    p.alive = false
    p.zoomed = false
    p.hp = 0
    this.lastCause = cause
    this.mode = 'dead'
    this.deadT = 0
    this.deadShown = false
    this.stats.deaths++
    if (this.buggy.riding) {
      this.buggy.riding = false
      this.buggy.v = 0
    }
    engineSet(false, 0)
    if (disintegrate) {
      this.fx.burst(p.x, p.y, 60, 0xffffff, 260, 1.1, 3.5, 30)
      this.fx.burst(p.x, p.y, 40, 0x57f2ff, 200, 1.2, 3, 30)
      sfx.zap()
    } else this.fx.burst(p.x, p.y, 26, 0xffffff, 240, 0.7, 4)
    sfx.lose()
    this.hud.prompt('')
    this.hud.boss(null)
  }

  respawn(): void {
    const p = this.p
    const cp = this.cp
    p.x = cp.x
    p.y = cp.y
    p.hp = MAX_HP
    p.alive = true
    p.zoomed = false
    p.inv = 1.5
    p.kx = p.ky = 0
    p.danger = 99
    p.cd = 0.3
    this.yaw = 0
    this.pitch = 0.42
    this.camInit = false
    this.mode = 'play'
    this.deadShown = false
    for (const b of this.eprojs) this.projG.remove(b.mesh)
    for (const b of this.spits) this.projG.remove(b.mesh)
    for (const b of this.bullets) this.projG.remove(b.mesh)
    this.eprojs = []
    this.spits = []
    this.bullets = []
    // el buggy te espera en la baliza
    if (this.flags.boarded && cp.x > ZC_END) {
      this.buggy.x = cp.x + 70
      this.buggy.y = cp.y - 10
      this.buggy.h = 0
      this.buggy.v = 0
    }
    this.buggy.riding = false
    // aleja a la horda del punto de reaparición
    for (const e of this.enemies) {
      if (e.state === 'dead') continue
      if (Math.hypot(e.x - p.x, e.y - p.y) < 700) {
        if (e.roam) { e.hp = 0; e.state = 'dead'; e.deadT = 9; this.releaseVisual(e) }
        else if (e.kind !== 'boss' || !this.flags.bossWoke) {
          e.state = 'idle'
          e.x = e.homeX
          e.y = e.homeY
          e.wind = null
          e.charging = 0
        }
      }
    }
    const im = this.imp
    if (im.state === 'chase' || im.state === 'forming') {
      Object.assign(im, { state: 'chase', x: 1500, y: 270, wind: null, charging: 0, stun: 1, spitCd: 2.5, chargeCd: 4, hp: Math.max(im.hp, IMPOSTOR_HP * 0.6) })
    }
    this.hud.overlay('dead', false)
    this.hud.showHud(true, this.input.touchMode)
    this.hud.caption(`Punto de control: ${cp.name}`, 1600)
    this.input.requestLock()
  }

  // ================= Objetivo en pantalla =================
  private updateObjective(): void {
    const f = this.flags
    const p = this.p
    let o: string
    if (!p.owned.pistol && !f.boarded) o = 'Encuentra un <b>arma</b>'
    else if (!f.impDead) o = 'Sobrevive al <b>impostor</b> y abre paso'
    else if (!f.boarded) o = 'Sube al <b>buggy</b> al final del pasillo (E)'
    else if (f.bossDead) o = 'Aborda la <b>nave de escape</b> (E)'
    else {
      const d = Math.round(Math.hypot(SHIP.x - p.x, SHIP.y - p.y) / 10)
      const inArena = p.x > ARENA.x
      o = inArena ? 'Derrota al <b>jefe impostor</b> que protege la nave' : `Explora ruinas y encuentra la <b>nave de escape</b> · ${d} m al este`
    }
    if (o !== this.shownObjective) {
      this.shownObjective = o
      this.hud.setObjective(o)
    }
  }

  // ================= Enemigos Among Us =================
  private inArena(x: number, y: number): boolean {
    return x > ARENA.x - 500 && x < ARENA.x + ARENA.w + 100 && y > ARENA.y - 200 && y < ARENA.y + ARENA.h + 200
  }

  wake(e: Enemy): void {
    if (e.state !== 'idle') return
    e.state = 'chase'
    e.cd = rnd(0.2, 0.8)
    if (e.kind === 'boss') {
      e.cd = 2.2
      e.atk = 5
      e.t = 3
      if (!this.flags.bossWoke) {
        this.flags.bossWoke = true
        this.hud.caption('¡IMPOSTOR GIGANTE!', 3000)
        sfx.roar()
        this.shake = 14
        this.say('Eso es… un impostor del tamaño de un hangar. Aguanta y no dejes de moverte.', 1.5)
      }
      return
    }
    // la alarma contagia a los vecinos: así se forma la horda
    let n = 0
    for (const o of this.enemies) {
      if (o.state === 'idle' && o.kind !== 'boss' && Math.hypot(o.x - e.x, o.y - e.y) < 380) {
        o.state = 'chase'
        o.cd = rnd(0.1, 0.9)
        n++
      }
    }
    if (n >= 4 && !this.flags.hordeMsg) {
      this.flags.hordeMsg = true
      this.hud.caption('¡UNA HORDA SE ACERCA!', 2400)
      sfx.roar()
    } else sfx.alien()
  }

  damageEnemy(e: Enemy, dmg: number, mark = true): void {
    if (e.state === 'dead') return
    e.hp -= dmg
    e.flash = 0.1
    if (mark) {
      sfx.hit()
      this.hud.hitMarker()
    }
    this.fx.burst(e.x, e.y, e.kind === 'boss' ? 4 : 5, 0xb4f0ff, 140, 0.3, 3, 22)
    if (e.state === 'idle') this.wake(e)
    if (e.hp <= 0) this.killEnemy(e)
  }

  private killEnemy(e: Enemy): void {
    e.state = 'dead'
    e.deadT = 0
    e.wind = null
    e.charging = 0
    this.stats.kills++
    const def = ALIENS[e.kind]
    const col = parseInt(def.color.slice(1), 16)
    this.fx.burst(e.x, e.y, e.kind === 'boss' ? 70 : e.kind === 'tank' ? 30 : 14, col, e.kind === 'boss' ? 320 : 200, 0.8, e.kind === 'boss' ? 6 : 4, 24)
    this.fx.burst(e.x, e.y, 8, 0xffffff, 150, 0.5, 3, 24)
    sfx.kill()
    if (e.kind === 'tank') this.shake = Math.max(this.shake, 8)
    // huesito, como en Among Us
    const bone = makeBone()
    bone.position.set(e.x, 0, e.y)
    bone.rotation.y = rnd(0, 6.28)
    bone.scale.setScalar(e.kind === 'boss' ? 3 : e.kind === 'tank' ? 1.6 : 1)
    this.dyn.add(bone)
    this.bones.push({ mesh: bone, t: 0 })
    // botín
    const r = Math.random()
    if (e.kind === 'soldier') {
      if (r < 0.07) this.dropPickup('medkit', e.x, e.y)
      else if (r < 0.17) this.dropPickup('ammo', e.x, e.y)
    } else if (e.kind === 'shooter') {
      if (r < 0.3) this.dropPickup('ammo', e.x, e.y)
      else if (r < 0.4) this.dropPickup('medkit', e.x, e.y)
    } else if (e.kind === 'tank') {
      this.dropPickup('medkit', e.x - 20, e.y)
      if (r < 0.7) this.dropPickup('ammo', e.x + 20, e.y)
    } else if (e.kind === 'boss') {
      this.flags.bossDead = true
      this.shield.visible = false
      this.shake = 20
      this.hud.boss(null)
      this.hud.caption('¡JEFE DERROTADO!', 3200)
      this.dropPickup('medkit', e.x - 40, e.y - 30)
      this.dropPickup('medkit', e.x - 40, e.y + 30)
      this.dropPickup('ammo', e.x - 80, e.y)
      this.say('¡El escudo de la nave cayó! Aborda y larguémonos de este planeta.', 1.5)
      this.fx.burst(SHIP.x, SHIP.y, 50, 0x57f2ff, 300, 1, 5, 40)
    }
  }

  private steer(e: Enemy, ux: number, uy: number, speed: number, dt: number, d: number): void {
    if (e.detour > 0) {
      e.detour -= dt
      const px = -uy * e.dd
      const py = ux * e.dd
      ux += px * 1.6
      uy += py * 1.6
      const l = Math.hypot(ux, uy) || 1
      ux /= l
      uy /= l
    }
    const ox = e.x
    const oy = e.y
    moveCircle(this.grid, this.extra, e, ux * speed * dt, uy * speed * dt)
    e.stuckT += dt
    if (e.stuckT > 0.45) {
      const moved = Math.hypot(e.x - e.lx, e.y - e.ly)
      if (moved < speed * 0.45 * 0.3 && d > 60 && e.detour <= 0) {
        e.detour = 0.9
        e.dd = Math.random() < 0.5 ? 1 : -1
      }
      e.lx = e.x
      e.ly = e.y
      e.stuckT = 0
    }
    e.mv = lerp(e.mv, clamp(Math.hypot(e.x - ox, e.y - oy) / (speed * dt + 1e-6), 0, 1), 0.3)
  }

  spawnEProj(x: number, y: number, ang: number, speed: number, dmg: number, cause: DeathCause, color: number, size = 5): void {
    const m = new THREE.Mesh(projGeo, new THREE.MeshBasicMaterial({ color }))
    m.scale.setScalar(size)
    m.position.set(x, 26, y)
    this.projG.add(m)
    this.eprojs.push({ x, y, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed, life: 3, dmg, mesh: m, cause })
  }

  private shockwave(x: number, y: number, R: number, dmg: number, cause: DeathCause): void {
    const p = this.p
    for (let i = 0; i < 28; i++) {
      const a = (i / 28) * 6.283
      this.fx.burst(x + Math.cos(a) * R * 0.85, y + Math.sin(a) * R * 0.85, 1, 0xd8c79a, 90, 0.6, 5, 8)
    }
    this.fx.burst(x, y, 12, 0xffffff, 200, 0.5, 4, 14)
    sfx.slam()
    this.shake = Math.max(this.shake, R > 150 ? 18 : 12)
    const pr = this.buggy.riding ? this.buggy.r : p.r
    if (p.alive && Math.hypot(p.x - x, p.y - y) < R + pr) this.hurtPlayer(dmg, x, y, 120, cause)
  }

  private updateEnemies(dt: number): void {
    const p = this.p
    const b = this.buggy
    const noiseR = this.noiseT > 0 ? 1000 : b.riding ? 650 * Math.min(1, Math.abs(b.v) / 300) : 0
    let nearest = 1e9
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i]
      const dx = p.x - e.x
      const dy = p.y - e.y
      const d = Math.hypot(dx, dy)
      if (e.state === 'dead') {
        e.deadT += dt
        if (e.deadT > 0.7) {
          this.releaseVisual(e)
          this.enemies.splice(i, 1)
        }
        continue
      }
      e.flash = Math.max(0, e.flash - dt)
      // nivel de detalle: sólo hay modelo cerca de la cámara
      if (d < 2100) {
        if (!e.vis) e.vis = this.acquireVisual(e.kind)
      } else if (e.vis) this.releaseVisual(e)
      if (e.roam && e.state === 'chase' && d > 3000) {
        this.releaseVisual(e)
        this.enemies.splice(i, 1)
        continue
      }
      // arrollamiento con el buggy
      if (b.riding && Math.abs(b.v) > 110 && d < e.r + b.r + 6 && e.hitCar <= 0) {
        const dmg = Math.abs(b.v) * (e.kind === 'boss' ? 0.1 : 0.3)
        e.hitCar = 0.45
        e.x += Math.cos(b.h) * 28
        e.y += Math.sin(b.h) * 28
        b.v *= e.kind === 'soldier' || e.kind === 'shooter' ? 0.93 : e.kind === 'tank' ? 0.6 : 0.45
        this.shake = Math.max(this.shake, 7)
        sfx.slam()
        this.damageEnemy(e, dmg)
        if ((e.state as string) === 'dead') continue
      }
      e.hitCar = Math.max(0, e.hitCar - dt)
      if (e.state === 'idle') {
        e.mv = lerp(e.mv, 0, 0.3)
        const def = ALIENS[e.kind]
        if (e.kind === 'boss') {
          if (p.alive && (this.inArena(p.x, p.y) || d < def.aggro) && p.x > ARENA.x - 200) this.wake(e)
        } else if (p.alive && (d < def.aggro || d < noiseR)) this.wake(e)
        continue
      }
      if (!p.alive) {
        e.mv = lerp(e.mv, 0, 0.1)
        continue
      }
      nearest = Math.min(nearest, d)
      this.chase(e, dt, d, dx, dy)
    }
    this.separate()
    if (nearest < 750) this.p.danger = 0
  }

  private chase(e: Enemy, dt: number, d: number, dx: number, dy: number): void {
    const p = this.p
    const def = ALIENS[e.kind]
    const want = Math.atan2(dy, dx)
    const turn = Math.min(1, dt * 8)
    const ridingFast = this.buggy.riding && Math.abs(this.buggy.v) >= 110
    const pr = this.buggy.riding ? this.buggy.r : p.r
    e.cd -= dt
    e.atk -= dt
    e.pulse = Math.max(0, e.pulse - dt)
    const ux = dx / (d || 1)
    const uy = dy / (d || 1)

    if (e.kind === 'soldier') {
      let speed = def.speed * e.speedMul
      if (d < 220) speed *= 1.15
      e.face += angDiff(e.face, want) * turn
      // reparto lateral: la horda rodea en vez de hacer fila
      const fl = d > 140 ? ((e.id % 3) - 1) * 0.3 : 0
      const sx = ux - uy * fl
      const sy = uy + ux * fl
      const sl = Math.hypot(sx, sy) || 1
      if (d > e.r + pr + 3) this.steer(e, sx / sl, sy / sl, speed, dt, d)
      else e.mv = lerp(e.mv, 0, 0.3)
      if (d < e.r + pr + 9 && e.atk <= 0 && !ridingFast) {
        this.hurtPlayer(def.melee, e.x, e.y, 40, 'soldier')
        e.atk = def.meleeCd * rnd(0.9, 1.2)
        e.pulse = 0.25
      }
      return
    }

    if (e.kind === 'shooter') {
      const los = losClear(this.grid, this.extra, e.x, e.y, p.x, p.y)
      const spd = def.speed * e.speedMul
      e.face += angDiff(e.face, want) * turn
      if (e.wind) {
        e.wind.t -= dt
        e.mv = lerp(e.mv, 0, 0.3)
        if (e.wind.t <= 0) {
          const a = want + rnd(-0.06, 0.06)
          this.spawnEProj(e.x + Math.cos(a) * e.r * 1.4, e.y + Math.sin(a) * e.r * 1.4, a, 340, 11, 'shooter', 0xff7a2a, 5)
          sfx.shoot([700, 300], 0.04)
          e.wind = null
        }
      } else {
        if (d > 440 || !los) this.steer(e, ux, uy, spd, dt, d)
        else if (d < 250) this.steer(e, -ux, -uy, spd * 0.9, dt, d)
        else {
          this.steer(e, -uy * e.strafe, ux * e.strafe, spd * 0.6, dt, d)
          if (Math.random() < dt * 0.4) e.strafe *= -1
        }
        if (los && d < 680 && e.cd <= 0) {
          e.wind = { type: 'shoot', t: 0.4 }
          e.cd = 1.5 + rnd(0, 0.8)
        }
      }
      if (d < e.r + pr + 8 && e.atk <= 0 && !ridingFast) {
        this.hurtPlayer(def.melee, e.x, e.y, 40, 'shooter')
        e.atk = def.meleeCd
      }
      return
    }

    if (e.kind === 'tank') {
      e.face += angDiff(e.face, want) * Math.min(1, dt * 4)
      if (e.wind) {
        e.wind.t -= dt
        e.mv = lerp(e.mv, 0, 0.3)
        if (e.wind.t <= 0) {
          this.shockwave(e.x, e.y, 135, 38, 'tank')
          e.wind = null
        }
      } else {
        if (d > e.r + pr + 2) this.steer(e, ux, uy, def.speed * e.speedMul, dt, d)
        else e.mv = lerp(e.mv, 0, 0.3)
        if (d < 125 && e.cd <= 0) {
          e.wind = { type: 'slam', t: 0.75 }
          e.cd = 2.8
        }
        if (d < e.r + pr + 7 && e.atk <= 0 && !ridingFast) {
          this.hurtPlayer(def.melee, e.x, e.y, 90, 'tank')
          e.atk = def.meleeCd
        }
      }
      return
    }

    // ---- Jefe impostor ----
    e.t -= dt
    const frac = e.hp / e.maxHp
    if (e.stage === 0 && frac < 0.66) { e.stage = 1; this.summon(e, 5, 0) }
    if (e.stage === 1 && frac < 0.33) { e.stage = 2; this.summon(e, 6, 2) }
    if (e.wind) {
      e.wind.t -= dt
      e.mv = lerp(e.mv, 0, 0.2)
      if (e.wind.type !== 'charge' && e.wind.type !== 'stun') e.face += angDiff(e.face, want) * turn
      if (e.wind.type === 'charge') e.face += angDiff(e.face, want) * Math.min(1, dt * 3)
      if (e.wind.t <= 0) {
        const type = e.wind.type
        e.wind = null
        if (type === 'fan') {
          for (let i = 0; i < 9; i++) {
            const a = want + (i - 4) * 0.12
            this.spawnEProj(e.x + Math.cos(a) * e.r, e.y + Math.sin(a) * e.r, a, 300, 12, 'boss', 0xc05cff, 7)
          }
          sfx.roar()
        } else if (type === 'charge') {
          e.charging = 0.75
          e.cdir = want
          sfx.roar()
        } else if (type === 'stomp') this.shockwave(e.x, e.y, 235, 40, 'boss')
      }
      return
    }
    if (e.charging > 0) {
      e.charging -= dt
      e.face = e.cdir
      const hit = moveCircle(this.grid, this.extra, e, Math.cos(e.cdir) * 540 * dt, Math.sin(e.cdir) * 540 * dt)
      e.mv = 1
      if (Math.hypot(e.x - p.x, e.y - p.y) < e.r + pr) {
        this.hurtPlayer(46, e.x, e.y, 130, 'boss')
        e.charging = 0
        e.wind = { type: 'stun', t: 0.8 }
      } else if (hit) {
        e.charging = 0
        e.wind = { type: 'stun', t: 1.3 }
        this.shake = 16
        sfx.slam()
        this.fx.burst(e.x + Math.cos(e.cdir) * e.r, e.y + Math.sin(e.cdir) * e.r, 22, 0xffffff, 240, 0.5, 4, 30)
      }
      return
    }
    e.face += angDiff(e.face, want) * Math.min(1, dt * 5)
    const spd = def.speed * (1 + (1 - frac) * 0.5)
    if (d > e.r + pr + 4) this.steer(e, ux, uy, spd, dt, d)
    else e.mv = lerp(e.mv, 0, 0.3)
    const los = losClear(this.grid, this.extra, e.x, e.y, p.x, p.y)
    if (los && d < 950 && e.cd <= 0) { e.wind = { type: 'fan', t: 0.8 }; e.cd = 4.4 }
    else if (los && d > 220 && d < 760 && e.atk <= 0) { e.wind = { type: 'charge', t: 0.9 }; e.atk = 7.5 }
    else if (d < 210 && e.t <= 0) { e.wind = { type: 'stomp', t: 0.9 }; e.t = 4 }
    if (d < e.r + pr + 10 && e.pulse <= 0 && !ridingFast) {
      this.hurtPlayer(def.melee, e.x, e.y, 110, 'boss')
      e.pulse = 1.2
    }
    // el jefe custodia la nave: no sale del cráter
    e.x = clamp(e.x, ARENA.x + 90, ARENA.x + ARENA.w - 100)
    e.y = clamp(e.y, ARENA.y + 90, ARENA.y + ARENA.h - 90)
  }

  private summon(boss: Enemy, soldiers: number, shooters: number): void {
    this.hud.caption('¡El jefe llama refuerzos!', 2200)
    sfx.roar()
    this.shake = 10
    const n = soldiers + shooters
    for (let i = 0; i < n; i++) {
      const a = (i / n) * 6.283
      const e = this.placeEnemy(i < soldiers ? 'soldier' : 'shooter', boss.x + Math.cos(a) * (boss.r + 60), boss.y + Math.sin(a) * (boss.r + 60), true)
      e.state = 'chase'
      this.fx.burst(e.x, e.y, 8, 0xc05cff, 160, 0.5, 3, 20)
    }
  }

  /** Separación: los aliens se amontonan sin atravesarse, y los grandes empujan a los pequeños. */
  private separate(): void {
    const list = this.enemies.filter(e => e.state !== 'dead' && e.vis)
    const mass = (k: AlienKind) => (k === 'soldier' ? 1 : k === 'shooter' ? 1.2 : k === 'tank' ? 4 : 14)
    for (let i = 0; i < list.length; i++) {
      const a = list[i]
      for (let j = i + 1; j < list.length; j++) {
        const o = list[j]
        const dx = o.x - a.x
        if (dx > 140 || dx < -140) continue
        const dy = o.y - a.y
        const min = a.r + o.r + 2
        const d2 = dx * dx + dy * dy
        if (d2 >= min * min) continue
        const d = Math.sqrt(d2) || 0.01
        const push = min - d
        const ma = mass(a.kind)
        const mo = mass(o.kind)
        const ux = d < 0.02 ? 1 : dx / d
        const uy = d < 0.02 ? 0 : dy / d
        a.x -= ux * push * (mo / (ma + mo))
        a.y -= uy * push * (mo / (ma + mo))
        o.x += ux * push * (ma / (ma + mo))
        o.y += uy * push * (ma / (ma + mo))
      }
    }
    for (const e of list) moveCircle(this.grid, this.extra, e, 0, 0)
  }

  private spawnHorde(dt: number): void {
    const p = this.p
    if (!this.flags.boarded || p.x < ZC_END + 250 || this.inArena(p.x, p.y) || !p.alive) return
    this.hordeT -= dt
    if (this.hordeT > 0) return
    this.hordeT = (CONFIG.horde.interval + rnd(-4, 6)) * (this.buggy.riding ? 0.8 : 1)
    let live = 0
    for (const e of this.enemies) if (e.roam && e.state === 'chase') live++
    if (live >= CONFIG.horde.cap) return
    const progress = clamp((p.x - ZC_END) / (ARENA.x - ZC_END), 0, 1)
    const n = Math.round((4 + progress * 6 + rnd(0, 3)) * CONFIG.horde.size)
    const a0 = rnd(0, 6.283)
    const dist = rnd(850, 1100)
    const cx = clamp(p.x + Math.cos(a0) * dist, WORLD.x0 + 200, ARENA.x - 300)
    const cy = clamp(p.y + Math.sin(a0) * dist, WORLD.y0 + 150, WORLD.y1 - 150)
    for (let i = 0; i < n; i++) this.mkRoamer('soldier', cx + rnd(-90, 90), cy + rnd(-90, 90))
    if (progress > 0.2) for (let i = 0; i < 1 + Math.floor(progress * 2.5); i++) this.mkRoamer('shooter', cx + rnd(-110, 110), cy + rnd(-110, 110))
    if (progress > 0.5 && Math.random() < 0.4) this.mkRoamer('tank', cx, cy)
    if (!this.flags.hordeMsg) {
      this.flags.hordeMsg = true
      this.hud.caption('¡UNA HORDA SE ACERCA!', 2400)
    }
    sfx.roar()
  }

  private mkRoamer(kind: AlienKind, x: number, y: number): void {
    const e = this.placeEnemy(kind, x, y, true)
    e.state = 'chase'
  }

  // ================= Proyectiles =================
  private solidAt(x: number, y: number): boolean {
    const q = this.grid.query(x - 1, y - 1, x + 1, y + 1, this.qbuf)
    for (const r of q) if (inRect(x, y, r)) return true
    for (const r of this.extra) if (r.on !== false && inRect(x, y, r)) return true
    return false
  }
  private qbuf: Rect[] = []

  private updateBullets(dt: number): void {
    const im = this.imp
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i]
      let dead = false
      b.life -= dt
      const steps = Math.ceil((b.speed * dt) / 8)
      for (let k = 0; k < steps && !dead; k++) {
        b.x += (b.vx * dt) / steps
        b.y += (b.vy * dt) / steps
        if (this.solidAt(b.x, b.y)) {
          dead = true
          this.fx.burst(b.x, b.y, 4, 0xffe27a, 100, 0.18, 2.2, 28)
          break
        }
        for (const e of this.enemies) {
          if (e.state === 'dead' || !e.vis) continue
          const dx = b.x - e.x
          const dy = b.y - e.y
          if (dx > e.r + 6 || dx < -e.r - 6 || dy > e.r + 6 || dy < -e.r - 6) continue
          if (dx * dx + dy * dy < (e.r + 4) * (e.r + 4)) {
            dead = true
            this.damageEnemy(e, b.dmg)
            break
          }
        }
        if (dead) break
        if ((im.state === 'chase' || (im.state === 'forming' && im.t > 0.6)) && Math.hypot(b.x - im.x, b.y - im.y) < im.r + 3) {
          dead = true
          this.damageImpostor(b.dmg)
          break
        }
        for (const t of this.turrets) {
          if (t.state !== 'dead' && Math.hypot(b.x - t.x, b.y - t.y) < 17) {
            dead = true
            this.damageTurret(t, b.dmg)
            break
          }
        }
        if (dead) break
        for (const f of this.fences) {
          for (const g of [f.a, f.b]) {
            if (g.alive && Math.hypot(b.x - g.x, b.y - g.y) < 11) {
              dead = true
              this.damageGen(g, b.dmg)
            }
          }
        }
      }
      b.mesh.position.set(b.x, 28, b.y)
      if (dead || b.life <= 0) {
        this.projG.remove(b.mesh)
        this.bullets.splice(i, 1)
      }
    }
    for (let i = this.beams.length - 1; i >= 0; i--) {
      const bm = this.beams[i]
      bm.t += dt
      const k = Math.min(1, bm.t / bm.max)
      const mat = bm.mesh.material as THREE.MeshBasicMaterial
      mat.opacity = 0.95 * (1 - k)
      bm.mesh.scale.y = bm.mesh.scale.z = 3.4 * (1 - k * 0.65)
      if (k >= 1) {
        this.projG.remove(bm.mesh)
        this.beams.splice(i, 1)
      }
    }
  }

  private stepProj(list: EProj[], dt: number): void {
    const p = this.p
    const pr = (this.buggy.riding ? this.buggy.r : p.r) + 6
    for (let i = list.length - 1; i >= 0; i--) {
      const b = list[i]
      b.life -= dt
      b.x += b.vx * dt
      b.y += b.vy * dt
      let dead = b.life <= 0
      if (!dead && this.solidAt(b.x, b.y)) {
        dead = true
        this.fx.burst(b.x, b.y, 6, 0xff9a4a, 120, 0.25, 2.6, 26)
      }
      if (!dead && p.alive && Math.hypot(b.x - p.x, b.y - p.y) < pr) {
        dead = true
        this.hurtPlayer(b.dmg, b.x - b.vx * 0.1, b.y - b.vy * 0.1, 45, b.cause)
      }
      b.mesh.position.set(b.x, 26, b.y)
      if (dead) {
        this.projG.remove(b.mesh)
        list.splice(i, 1)
      }
    }
  }
  private updateEProj(dt: number): void {
    this.stepProj(this.eprojs, dt)
    this.stepProj(this.spits, dt)
  }

  private updateBones(dt: number): void {
    for (let i = this.bones.length - 1; i >= 0; i--) {
      const b = this.bones[i]
      b.t += dt
      if (b.t > 6) b.mesh.scale.multiplyScalar(Math.max(0.01, 1 - dt * 2))
      if (b.t > 7.2) {
        this.dyn.remove(b.mesh)
        this.bones.splice(i, 1)
      }
    }
  }

  // ================= Sincronización de la escena =================
  private sync(dt: number): void {
    const p = this.p
    const b = this.buggy
    const im = this.imp
    const ending = this.mode === 'ending' || this.mode === 'end'
    const riding = b.riding
    const W = this.world

    // oscuridad de la habitación inicial y penumbra del pasillo azul y garage rojo cerrados
    const dark = p.x < 920 ? clamp((920 - p.x) / 150, 0, 1) : p.x < ZC_END ? 0.32 : 0
    this.amb.intensity = lerp(0.62, 0.16, dark)
    this.hemi.intensity = lerp(0.5, 0.1, dark)
    this.sun.intensity = lerp(0.95, 0.1, dark)
    this.torch.intensity = 2.4 * dark
    this.torch.position.set(p.x, 70, p.y)
      ; (this.scene.background as THREE.Color).setRGB(0.012 * (1 - dark * 0.8), 0.02 * (1 - dark * 0.8), 0.1 * (1 - dark * 0.8))
      ; (this.scene.fog as THREE.Fog).color.copy(this.scene.background as THREE.Color)
      ; (W.stars.material as THREE.PointsMaterial).opacity = 1 - dark * 0.9
      ; ((W.planet.material as THREE.MeshBasicMaterial).color).setScalar(1 - dark * 0.9)
    this.sun.position.set(p.x - 220, 520, p.y + 260)
    this.sun.target.position.set(p.x, 0, p.y)
    this.sun.target.updateMatrixWorld()

    // puertas
    this.setDoors()
    this.door2.lm.color.setHex(im.state === 'dead' ? 0x3bff8a : Math.floor(this.t * 3) % 2 ? 0xff3b4a : 0x6e1018)

    // suministros y piezas LEGO
    let nearD = 260
    let nearX = 0
    let nearY = 0
    let nearC = 0x7fe3ff
    for (const k of this.pickups) {
      k.mesh.visible = k.glow.visible = !k.taken
      if (k.taken) continue
      k.mesh.position.y = k.z + 8 + Math.sin(this.t * 3 + k.ph) * 2.5
      k.mesh.rotation.y = this.t * 1.2 + k.ph
      k.glow.scale.setScalar(1 + Math.sin(this.t * 3 + k.ph) * 0.12)
      const d = Math.hypot(p.x - k.x, p.y - k.y)
      if (d < nearD) { nearD = d; nearX = k.x; nearY = k.y; nearC = k.kind === 'medkit' ? 0x6dff9a : k.kind === 'ammo' ? 0xffd21f : 0x8fe3ff }
    }
    for (const l of this.legos) {
      l.mesh.visible = l.halo.visible = !l.taken
      if (l.taken) continue
      const y = 16 + Math.sin(this.t * 2.5 + l.ph) * 3.5
      l.mesh.position.set(l.x, y, l.y)
      l.mesh.rotation.y = this.t * 1.6 + l.ph
      l.halo.position.set(l.x, y, l.y)
      l.halo.scale.setScalar(1 + Math.sin(this.t * 4 + l.ph) * 0.18)
      const d = Math.hypot(p.x - l.x, p.y - l.y)
      if (d < nearD) { nearD = d; nearX = l.x; nearY = l.y; nearC = 0xffe98a }
    }
    if (nearD < 260) {
      this.itemLight.color.setHex(nearC)
      this.itemLight.position.set(nearX, 34, nearY)
      this.itemLight.intensity = 1.1 + Math.sin(this.t * 3) * 0.35
    } else this.itemLight.intensity = 0

    // torretas
    for (const t of this.turrets) {
      if (t.state === 'idle') t.aim += dt * 0.7
      t.rig.head.rotation.y = -t.aim
      const eye = t.rig.eye.material as THREE.MeshBasicMaterial
      if (t.state === 'lock') eye.color.setHex(Math.floor(this.t * 14) % 2 ? 0xff2a2a : 0xffffff)
      else if (t.state === 'idle') eye.color.setHex(0xcc3333)
      else if (t.state === 'cool') eye.color.setHex(0x553333)
    }
    // vallas
    for (const f of this.fences) {
      const vis = f.on || (f.warn && Math.floor(this.t * 16) % 2 === 0)
      for (const bm of f.beams) {
        bm.visible = vis
        const m = bm.material as THREE.MeshBasicMaterial
        m.color.setHex(f.on ? 0xff3b5a : 0xffaa55)
        m.opacity = f.on ? 0.95 : 0.45
      }
      for (const g of [f.a, f.b]) (g.core.material as THREE.MeshBasicMaterial).color.setHex(f.on ? 0xff3b5a : f.warn ? 0xffaa55 : 0x57f2ff)
    }
    // placas de plasma
    for (const pl of this.plates) {
      const c = (this.t + pl.spec.phase * 0.9) % 3.4
      if (c >= 2.4 && c < 2.9) {
        pl.mat.emissive.setHex(0xff8a2a)
        pl.mat.emissiveIntensity = 2.6
      } else if (c >= 1.5 && c < 2.4) {
        pl.mat.emissive.setHex(0xff2a2a)
        pl.mat.emissiveIntensity = Math.floor(this.t * 9) % 2 ? 1.2 : 0.2
      } else pl.mat.emissiveIntensity = 0
    }
    // balizas
    for (const bc of this.beacons) {
      const ring = bc.mesh.userData.ring as THREE.Mesh
      ring.rotation.y += dt * 1.5
    }

    // jugador
    const rig = this.playerM.userData as PlayerRig
    const flick = p.inv > 0 && Math.floor(this.t * 18) % 2 === 0 && !riding && this.mode === 'play'
    const inScope = p.zoomed && !riding && p.alive && this.mode === 'play'
    this.playerM.visible = p.alive && !ending && !flick && !inScope
    const gz = W.heightAt(p.x, p.y)
    if (riding) {
      this.playerM.position.set(b.x - Math.cos(b.h) * 8, 12, b.y - Math.sin(b.h) * 8)
      this.playerM.rotation.y = -b.h
      rig.legs.forEach(l => (l.rotation.z = 0))
    } else {
      this.playerM.position.set(p.x, gz + Math.abs(Math.sin(p.walk)) * 1.2 * p.moving, p.y)
      this.playerM.rotation.y = -this.yaw
      const sw = Math.sin(p.walk) * 0.7 * p.moving
      rig.legs[0].rotation.z = sw
      rig.legs[1].rotation.z = -sw
    }
    for (const k of WEAPON_ORDER) rig.guns[k].visible = !riding && p.owned[k] && p.weapon === k

    // buggy
    const bg = this.buggyM.userData as { wheels: THREE.Group[] }
    this.buggyM.position.set(b.x, riding ? Math.sin(this.t * 30) * Math.min(0.8, Math.abs(b.v) / 400) : 0, b.y)
    this.buggyM.rotation.y = -b.h
    bg.wheels.forEach(w => (w.rotation.z = -b.spin))
    this.arrowM.visible = !riding && this.flags.impDead && !this.flags.boarded
    this.arrowM.position.set(b.x, 70 + Math.sin(this.t * 5) * 5, b.y)

    // escudo de la nave
    if (this.shield.visible) (this.shield.material as THREE.MeshBasicMaterial).opacity = 0.13 + Math.sin(this.t * 3) * 0.05

    // impostor del pasillo
    this.chargeLine.visible = false
    const ud = this.impM.userData as ImpostorRig
    this.impM.visible = true
    this.impM.position.set(im.x, 0, im.y)
    const shk = im.wind ? Math.sin(this.t * 60) * 2 : 0
    if (im.state === 'dormant') {
      ud.body.visible = false
      ud.pud.visible = true
      ud.pud.scale.set(1 + Math.sin(this.t * 2) * 0.04, 1, 0.62 * (1 + Math.sin(this.t * 2.3) * 0.04))
    } else if (im.state === 'forming') {
      const t = clamp(im.t / 1.3, 0, 1)
      const k = 0.15 + 0.85 * (1 - Math.pow(1 - t, 3))
      ud.body.visible = true
      ud.body.scale.set(0.7 + 0.3 * k, k, 0.7 + 0.3 * k)
      ud.body.rotation.z = Math.sin(im.t * 30) * (1 - t) * 0.08
      ud.pud.visible = true
      ud.pud.scale.set(1 - t * 0.4, 1, 0.62 * (1 - t * 0.4))
      this.impM.rotation.y = -im.face
    } else if (im.state === 'dead') {
      const k = clamp(1 - im.t / 0.5, 0, 1)
      ud.body.visible = k > 0.02
      ud.body.scale.set(1 + (1 - k) * 0.5, Math.max(0.02, k), 1 + (1 - k) * 0.5)
      ud.pud.visible = true
      ud.pud.scale.set(1.1, 1, 0.7)
    } else {
      ud.body.visible = true
      ud.body.scale.set(1, 1, 1)
      ud.body.rotation.z = 0
      ud.pud.visible = false
      this.impM.rotation.y = -im.face
      this.impM.position.z += shk
      ud.body.position.y = Math.abs(Math.sin(this.t * 8)) * (im.stun > 0 ? 0 : 2.5)
    }
    const open = im.state === 'forming' ? 0.1 : im.mouth
    ud.mouth.scale.set(1, 0.55 + 0.9 * open, 0.55 + 0.9 * open)
    const tl = 4 + open * (im.wind && im.wind.type === 'spit' ? 30 : 14)
    ud.tongue.scale.x = tl
    ud.tip.position.x = 2 + tl
    ud.tongue.visible = ud.tip.visible = open > 0.25
    const fl = im.flash > 0
    ud.bodyMat.emissive.setHex(fl ? 0xffffff : 0x000000)
    ud.bodyMat.color.setHex(fl ? 0xffffff : 0x2a78f0)
    if (im.wind && im.wind.type === 'charge' && im.state === 'chase') {
      const a = Math.atan2(p.y - im.y, p.x - im.x)
      const L = 230
      this.chargeLine.visible = true
      this.chargeLine.scale.set(L, 0.6, 1)
      this.chargeLine.position.set(im.x + Math.cos(a) * L / 2, 1.2, im.y + Math.sin(a) * L / 2)
      this.chargeLine.rotation.y = -a
        ; (this.chargeLine.material as THREE.MeshBasicMaterial).opacity = 0.3 + Math.sin(this.t * 40) * 0.15
    }

    // horda
    this.syncEnemies(dt)

    // cámara
    this.updateCamera(dt, ending)

    // HUD
    this.hud.setScope(inScope)
    if (this.mode === 'play' || this.mode === 'dead') {
      this.hud.setHp(p.hp, MAX_HP)
      this.hud.hurt(this.hurtFx * 0.8)
      const anyGun = p.owned.pistol || p.owned.rifle || p.owned.shotgun || p.owned.sniper
      this.hud.setWeapons(p.owned, p.ammo, p.weapon, anyGun, p.hasGrenade, p.grenades)
      this.hud.setStamina(p.stamina, STAMINA.max, p.exhausted)
      this.hud.speed(riding ? `${Math.round(Math.abs(b.v) * 0.36)} km/h` : '')
      const boss = this.enemies.find(e => e.kind === 'boss' && e.state === 'chase')
      if (this.mode === 'play' && boss) this.hud.boss('Jefe Impostor', boss.hp / boss.maxHp)
      else if (this.mode === 'play' && im.state === 'chase') this.hud.boss('Impostor', im.hp / IMPOSTOR_HP)
      else this.hud.boss(null)
      this.hud.radar(p.x, p.y, this.yaw, this.collectRadar())
    }
  }

  private syncEnemies(dt: number): void {
    const p = this.p
    let bossLine = false
    for (const e of this.enemies) {
      const v = e.vis
      if (!v) continue
      const ud = v.userData as { body: THREE.Object3D; ring: THREE.Mesh; bar: THREE.Group; fill: THREE.Mesh; barW: number }
      const def = ALIENS[e.kind]
      const body = ud.body
      v.position.set(e.x, 0, e.y)
      v.rotation.y = -e.face
      if (e.state === 'dead') {
        // expulsión estilo Among Us: gira, salta y se encoge
        const k = clamp(e.deadT / 0.7, 0, 1)
        body.rotation.y = k * 14
        body.position.y = Math.sin(k * Math.PI) * def.height * 0.6
        body.scale.setScalar(Math.max(0.01, 1 - k * k))
        ud.bar.visible = false
        ud.ring.visible = false
        continue
      }
      // contoneo: balanceo lateral y rebote de los tripulantes
      e.ph += dt * (e.state === 'idle' ? 1.4 : 6 + e.mv * 8)
      const mv = e.mv
      body.rotation.x = Math.sin(e.ph) * 0.17 * mv
      body.rotation.z = -0.04 - mv * 0.08
      body.position.y = Math.abs(Math.sin(e.ph)) * def.height * 0.05 * mv
      let sc = 1 + Math.sin(e.ph * 0.5) * 0.012
      if (e.pulse > 0 && e.kind !== 'boss') sc += Math.sin((e.pulse / 0.25) * Math.PI) * 0.25
      if (e.wind && e.wind.type !== 'stun') sc += Math.sin(this.t * 40) * 0.05
      body.scale.setScalar(sc)
      const want = e.flash > 0
      if (want !== e.flashOn) {
        e.flashOn = want
        this.setFlash(v, want ? 0.9 : 0)
      }
      // telegrafía
      const slam = e.wind && (e.wind.type === 'slam' || e.wind.type === 'stomp')
      ud.ring.visible = !!slam
      if (slam) {
        const R = e.kind === 'boss' ? 235 : 135
        ud.ring.scale.setScalar(R)
          ; (ud.ring.material as THREE.MeshBasicMaterial).opacity = 0.3 + Math.sin(this.t * 30) * 0.2
      }
      if (e.kind === 'boss' && e.wind?.type === 'charge') {
        bossLine = true
        const a = Math.atan2(p.y - e.y, p.x - e.x)
        const L = 640
        this.chargeLine.visible = true
        this.chargeLine.scale.set(L, 0.6, 5)
        this.chargeLine.position.set(e.x + Math.cos(a) * L / 2, 1.2, e.y + Math.sin(a) * L / 2)
        this.chargeLine.rotation.y = -a
          ; (this.chargeLine.material as THREE.MeshBasicMaterial).opacity = 0.3 + Math.sin(this.t * 40) * 0.15
      }
      // barra de vida flotante
      const showBar = e.kind !== 'boss' && e.hp < e.maxHp && (e.kind === 'tank' || e.kind === 'shooter')
      ud.bar.visible = showBar
      if (showBar) {
        const f = clamp(e.hp / e.maxHp, 0, 1)
        ud.bar.position.set(e.x, def.height + 16, e.y)
        ud.bar.quaternion.copy(this.camera.quaternion)
        ud.fill.scale.x = ud.barW * f
        ud.fill.position.x = -(ud.barW * (1 - f)) / 2
      }
    }
    void bossLine
  }

  private updateCamera(dt: number, ending: boolean): void {
    const p = this.p
    const b = this.buggy
    const cam = this.camera
    const ride = b.riding
    const inScope = p.zoomed && !ride && p.alive && this.mode === 'play'
    const wantFov = inScope ? SNIPER.zoomFov : CONFIG.camera.fov
    if (Math.abs(cam.fov - wantFov) > 0.01) {
      cam.fov = wantFov
      cam.updateProjectionMatrix()
    }
    if (ending) {
      const sp = this.shipM.position
      const tx = SHIP.x - 300
      const ty = 130 + sp.y * 0.7
      const tz = SHIP.y + 260
      if (!this.camInit) { this.camPos.set(tx, ty, tz); this.camInit = true }
      const k = 1 - Math.pow(0.04, dt)
      this.camPos.lerp(this.tmpV.set(tx, ty, tz), k)
      cam.position.copy(this.camPos)
      cam.lookAt(sp.x, sp.y + 40, sp.z)
      this.world.sky.position.copy(cam.position)
      return
    }
    const px = p.x
    const pz = p.y
    const gz = ride ? 0 : this.world.heightAt(px, pz)
    const fx = Math.cos(this.yaw)
    const fz = Math.sin(this.yaw)
    const rx = -fz
    const rz = fx
    const cp = Math.cos(this.pitch)
    const sp = Math.sin(this.pitch)
    if (inScope) {
      const ex = px + fx * 10
      const ey = gz + 42
      const ez = pz + fz * 10
      this.camPos.set(ex, ey, ez)
      const sk = this.shake * 0.15
      cam.position.set(ex + (sk ? rnd(-sk, sk) : 0), ey + (sk ? rnd(-sk, sk) : 0), ez + (sk ? rnd(-sk, sk) : 0))
      cam.lookAt(ex + fx * cp * 600, ey - sp * 420, ez + fz * cp * 600)
      this.world.sky.position.copy(cam.position)
      return
    }
    const D = ride ? 210 : 150
    const sh = ride ? 0 : 26
    const pivX = px + rx * sh
    const pivY = gz + (ride ? 36 : 42)
    const pivZ = pz + rz * sh
    let tx = pivX - fx * cp * D
    let ty = pivY + sp * D
    let tz = pivZ - fz * cp * D

    // Techo en el cuarto inicial, pasillo azul y garage rojo: mantener la cámara por debajo del techo
    if (px < ZC_END + 40 && ty > ROOM_H - 12) {
      ty = ROOM_H - 12
    }

    // Colisión adaptable de cámara de 3ª persona contra construcciones, muros y puertas
    let bestT = 1
    const pad = 7
    const checkRect = (r: Rect): void => {
      if (r.on === false) return
      const rTop = r.top ?? WALL_H
      if (rTop <= pivY - 6) return
      const expanded: Rect = { x: r.x - pad, y: r.y - pad, w: r.w + pad * 2, h: r.h + pad * 2 }
      const t = segEnter(pivX, pivZ, tx, tz, expanded)
      if (t >= 0 && t < bestT) {
        const hitY = pivY + (ty - pivY) * t
        if (hitY < rTop + 6) bestT = t
      }
    }
    const list = this.grid.query(pivX, pivZ, tx, tz, this.qbuf)
    for (const r of list) checkRect(r)
    for (const r of this.extra) checkRect(r)

    if (bestT < 1) {
      const pull = Math.max(0.12, bestT - 0.04)
      tx = pivX + (tx - pivX) * pull
      ty = pivY + (ty - pivY) * pull
      tz = pivZ + (tz - pivZ) * pull
    }

    if (!this.camInit) { this.camPos.set(tx, ty, tz); this.camInit = true }
    const k = bestT < 1 ? 1 - Math.pow(0.00001, dt) : 1 - Math.pow(0.0008, dt)
    this.camPos.x = lerp(this.camPos.x, tx, k)
    this.camPos.y = lerp(this.camPos.y, ty, k)
    this.camPos.z = lerp(this.camPos.z, tz, k)
    const sk = this.shake * 0.35
    cam.position.set(this.camPos.x + (sk ? rnd(-sk, sk) : 0), this.camPos.y + (sk ? rnd(-sk, sk) : 0), this.camPos.z + (sk ? rnd(-sk, sk) : 0))
    cam.lookAt(pivX + fx * 260, pivY - sp * 60 + 8, pivZ + fz * 260)
    this.world.sky.position.copy(cam.position)
  }

  private collectRadar(): RadarDot[] {
    const p = this.p
    const dots = this.radarDots
    dots.length = 0
    for (const e of this.enemies) {
      if (e.state === 'dead') continue
      const d = Math.hypot(e.x - p.x, e.y - p.y)
      if (e.kind === 'boss') { dots.push({ x: e.x, y: e.y, kind: 'boss' }); continue }
      if (d < 1000 && (e.state === 'chase' || d < 520)) dots.push({ x: e.x, y: e.y, kind: 'enemy' })
    }
    const im = this.imp
    if (im.state === 'chase' || im.state === 'forming') dots.push({ x: im.x, y: im.y, kind: 'enemy' })
    for (const s of this.world.sites) dots.push({ x: s.x + s.w / 2, y: s.y + s.d / 2, kind: 'site' })
    for (const b of this.beacons) dots.push({ x: b.x, y: b.y, kind: 'beacon' })
    for (const l of this.legos) if (!l.taken && Math.hypot(l.x - p.x, l.y - p.y) < 340) dots.push({ x: l.x, y: l.y, kind: 'lego' })
    for (const k of this.pickups) if (!k.taken && Math.hypot(k.x - p.x, k.y - p.y) < 300) dots.push({ x: k.x, y: k.y, kind: 'pickup' })
    if (this.flags.boarded) dots.push({ x: SHIP.x, y: SHIP.y, kind: 'ship' })
    if (!this.buggy.riding) dots.push({ x: this.buggy.x, y: this.buggy.y, kind: 'buggy' })
    return dots
  }

  /** Estado resumido para pruebas automáticas (sólo con ?debug en la URL). */
  snapshot(): Record<string, unknown> {
    const p = this.p
    return {
      mode: this.mode,
      x: Math.round(p.x),
      y: Math.round(p.y),
      hp: Math.round(p.hp),
      weapon: p.weapon,
      owned: p.owned,
      ammo: p.ammo,
      riding: this.buggy.riding,
      boarded: this.flags.boarded,
      impDead: this.flags.impDead,
      bossDead: this.flags.bossDead,
      enemies: this.enemies.filter(e => e.state !== 'dead').length,
      chasing: this.enemies.filter(e => e.state === 'chase').length,
      stats: this.stats,
      lego: this.legos.filter(l => l.taken).length,
      cause: this.lastCause,
    }
  }

  /** Atajos para pruebas (sólo con ?debug). */
  debug = {
    tp: (x: number, y: number) => {
      this.p.x = x
      this.p.y = y
      if (this.buggy.riding) { this.buggy.x = x; this.buggy.y = y }
    },
    give: () => {
      this.p.owned = { pistol: true, rifle: true, shotgun: true, sniper: true }
      this.p.ammo = { rifle: 300, shotgun: 48, sniper: 12 }
    },
    god: (on: boolean) => { this.p.inv = on ? 1e9 : 0 },
    killImp: () => { this.imp.state === 'dormant' && (this.imp.state = 'chase'); this.damageImpostor(9999) },
    boardBuggy: () => { this.flags.impDead = true; this.imp.state = 'dead'; this.d1 = this.d2 = 1; this.buggy.x = this.p.x + 20; this.buggy.y = this.p.y },
    killBoss: () => { const b = this.enemies.find(e => e.kind === 'boss'); if (b) this.damageEnemy(b, 99999) },
    yaw: (v: number) => { this.yaw = v },
  }
}

const projGeo = new THREE.SphereGeometry(1, 10, 8)

const DEAD_TEXT: Record<DeathCause, string> = {
  soldier: 'El enjambre te devoró entre risas de impostor.',
  shooter: 'Un tirador te dejó fuera de combate.',
  tank: 'Un tanque te aplastó como a una pieza de LEGO.',
  boss: 'El jefe impostor te eyectó al vacío.',
  impostor: 'El impostor del pasillo te atrapó.',
  turret: 'Una torreta láser te redujo a polvo espacial.',
  fence: 'Te desintegraste al cruzar una valla láser.',
  plasma: 'Una trampa de plasma te frió el traje.',
  grenade: 'Tu propia granada de plasma te hizo volar en pedazos.',
}
