// Constantes del nivel, armas y enemigos.

// ---------- Corredor inicial (x = largo del pasillo) ----------
export const FY0 = 90
export const FY1 = 450
export const D1X = 900
export const D2X = 1855
export const ZC_END = 2540
export const WALL_H = 46
export const COVER_H = 66
export const DOOR_H = 70
/** Altura de las paredes/techo del cuarto inicial, pasillo azul y garage rojo (ambientes cerrados). */
export const ROOM_H = 130
/** El pasillo azul tiene el doble de ancho (720 en vez de 360): y entre BY0 y BY1. */
export const BY0 = -90
export const BY1 = 630

// ---------- Mundo abierto (el doble de área que antes; la arena sigue en el borde este) ----------
export const WORLD = { x0: ZC_END, x1: 12940, y0: -2515, y1: 3055 }
export const ROAD_Y = 270
export const ROAD_W = 300
export const ARENA = { x: 11840, y: -230, w: 1000, h: 1000 }
export const SHIP = { x: 12460, y: 270 }

export const MAX_HP = 100

export type Config = {
  player: { speed: number }
  buggy: { maxSpeed: number; accel: number }
  horde: { interval: number; size: number; cap: number }
  difficulty: { damageTaken: number }
  camera: { fov: number }
}

/** Valores de jugabilidad base (la dificultad elegida los modifica a través de DIFFICULTIES). */
export const CONFIG: Config = {
  player: { speed: 200 },
  buggy: { maxSpeed: 440, accel: 360 },
  horde: { interval: 24, size: 1, cap: 30 },
  difficulty: { damageTaken: 1 },
  camera: { fov: 62 },
}

// ---------- Dificultad (se aplica sobre los valores base, que son los de 'Moderado') ----------
export type DifficultyId = 'easy' | 'normal' | 'hard' | 'infestation'
export type DifficultyDef = {
  id: DifficultyId
  name: string
  blurb: string
  /** Multiplicador de apariciones (campamentos y hordas). */
  spawn: number
  /** Multiplicador de velocidad de los enemigos. */
  speed: number
  /** Multiplicador del tiempo entre ataques (>1 = ataques más lentos). */
  attack: number
  /** Multiplicador de la probabilidad de drops. */
  drops: number
  /** Multiplicador de vida enemiga. */
  hp: number
}
export const DIFFICULTIES: Record<DifficultyId, DifficultyDef> = {
  easy: { id: 'easy', name: 'Fácil', blurb: 'Una travesía tranquila para explorar el planeta y dominar los controles sin agobios.', spawn: 0.7, speed: 0.9, attack: 1.25, drops: 1.3, hp: 1 },
  normal: { id: 'normal', name: 'Moderado', blurb: 'El desafío original: supervivencia táctica, reflejos y adrenalina en equilibrio.', spawn: 1, speed: 1, attack: 1, drops: 1, hp: 1 },
  hard: { id: 'hard', name: 'Difícil', blurb: 'Peligro constante. Recursos escasos y enemigos hostiles que no perdonan errores.', spawn: 1.1, speed: 1.1, attack: 1, drops: 0.9, hp: 1.05 },
  infestation: { id: 'infestation', name: 'INFESTACIÓN', blurb: 'Mucha suerte.', spawn: 1.25, speed: 1.2, attack: 1, drops: 0.85, hp: 1.1 },
}
export const DIFFICULTY_ORDER: DifficultyId[] = ['easy', 'normal', 'hard', 'infestation']

/** Daño máximo de la granada de plasma contra el jefe (fracción de su vida en el centro). */
export const BOSS_GRENADE_FRAC = 0.35

// ---------- Piedras ignífugas (combustible del cohete) ----------
export const FUEL_TOTAL = 3

// ---------- Armas ----------
export type WeaponId = 'pistol' | 'rifle' | 'shotgun' | 'sniper'
/** Armas que consumen munición. */
export type AmmoWeapon = 'rifle' | 'shotgun' | 'sniper'

export type WeaponDef = {
  id: WeaponId
  name: string
  slot: number
  dmg: number
  rate: number
  pellets: number
  spread: number
  speed: number
  life: number
  maxAmmo: number
  pickupAmmo: number
  color: number
  freq: [number, number]
  shake: number
}

export const WEAPONS: Record<WeaponId, WeaponDef> = {
  pistol: { id: 'pistol', name: 'Pistola láser', slot: 1, dmg: 10, rate: 0.22, pellets: 1, spread: 0.012, speed: 780, life: 0.9, maxAmmo: Infinity, pickupAmmo: 0, color: 0xffe27a, freq: [900, 260], shake: 1.5 },
  rifle: { id: 'rifle', name: 'Rifle de asalto', slot: 2, dmg: 7, rate: 0.085, pellets: 1, spread: 0.05, speed: 920, life: 0.95, maxAmmo: 300, pickupAmmo: 90, color: 0x8fe3ff, freq: [1100, 400], shake: 1.1 },
  shotgun: { id: 'shotgun', name: 'Escopeta', slot: 3, dmg: 9, rate: 0.82, pellets: 8, spread: 0.2, speed: 760, life: 0.34, maxAmmo: 48, pickupAmmo: 14, color: 0xff9a4a, freq: [380, 90], shake: 5 },
  // Francotirador: bala de luz instantánea (hitscan), 200 de daño; speed/life no se usan.
  sniper: { id: 'sniper', name: 'Francotirador', slot: 4, dmg: 200, rate: 1.4, pellets: 1, spread: 0.035, speed: 0, life: 0, maxAmmo: 12, pickupAmmo: 10, color: 0xfff6b0, freq: [2200, 160], shake: 7 },
}
export const WEAPON_ORDER: WeaponId[] = ['pistol', 'rifle', 'shotgun', 'sniper']

/** Zoom del francotirador (tecla Z): campo de visión, alcance máximo y daño crítico de cerca. */
export const SNIPER = {
  zoomFov: 17,
  range: 3200,
  closeRange: 220,
  bossCloseDmg: 300,
  ammoBoxPickup: 4,
}

// ---------- Ajustes de usuario (menú de configuración) ----------
export type Quality = 'auto' | 'high' | 'medium' | 'low'
export type UserSettings = {
  masterVolume: number
  sfxVolume: number
  weaponVolume: number
  buggyVolume: number
  musicVolume: number
  sensitivity: number
  quality: Quality
}

const SETTINGS_KEY = 'varado_settings_v2'

const clampN = (v: unknown, lo: number, hi: number, def: number): number => {
  const n = typeof v === 'number' && Number.isFinite(v) ? v : def
  return Math.max(lo, Math.min(hi, n))
}

export const SETTINGS: UserSettings = (() => {
  let parsed: Partial<UserSettings> = {}
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (raw) parsed = JSON.parse(raw) as Partial<UserSettings>
  } catch {
    /* localStorage puede estar deshabilitado */
  }
  const q = parsed.quality
  return {
    masterVolume: clampN(parsed.masterVolume, 0, 100, 100),
    sfxVolume: clampN(parsed.sfxVolume, 0, 100, 100),
    weaponVolume: clampN(parsed.weaponVolume, 0, 100, 100),
    buggyVolume: clampN(parsed.buggyVolume, 0, 100, 100),
    musicVolume: clampN(parsed.musicVolume, 0, 100, 60),
    sensitivity: clampN(parsed.sensitivity, 0.1, 10, 1),
    quality: q === 'high' || q === 'medium' || q === 'low' || q === 'auto' ? q : 'auto',
  }
})()

export function saveSettings(): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(SETTINGS))
  } catch {
    /* localStorage puede estar deshabilitado */
  }
}

// ---------- Granadas de plasma (se lanzan con G, no ocupan ranura de arma) ----------
export const GRENADE = {
  name: 'Granada de plasma',
  max: 5,
  pickupAmount: 2,
  fuse: 1.0, // Bajado a 1 segundo según petición
  radius: 140,
  /** Radio interior (centro) donde el daño es el 100% de la vida. */
  core: 22,
  throwSpeed: 430,
  cooldown: 0.6,
  /** Cuántas granadas aparecen por partida en posiciones aleatorias. */
  spawns: 5,
}

// ---------- Estamina, correr y dash ----------
export const STAMINA = {
  max: 100,
  runCost: 20,
  runMul: 1.6,
  dashCost: 25,
  dashDist: 120,
  dashTime: 0.16,
  dashCooldown: 0.8,
  regen: 18,
  regenDelay: 0.8,
  /** Tras agotarse, hace falta recuperar este mínimo para volver a correr. */
  exhaustRecover: 20,
}

// ---------- Enemigos Among Us ----------
export type AlienKind = 'soldier' | 'shooter' | 'tank' | 'boss'

export type AlienDef = {
  kind: AlienKind
  label: string
  hp: number
  speed: number
  r: number
  height: number
  melee: number
  meleeCd: number
  aggro: number
  /** Distancia de visibilidad del radar / activación por ruido. */
  color: string
}

export const ALIENS: Record<AlienKind, AlienDef> = {
  soldier: { kind: 'soldier', label: 'Soldadito', hp: 30, speed: 158, r: 13, height: 40, melee: 8, meleeCd: 0.75, aggro: 560, color: '#ff4a4a' },
  shooter: { kind: 'shooter', label: 'Tirador', hp: 55, speed: 96, r: 14, height: 44, melee: 6, meleeCd: 1.2, aggro: 700, color: '#35e0ff' },
  tank: { kind: 'tank', label: 'Tanque', hp: 420, speed: 62, r: 31, height: 78, melee: 36, meleeCd: 1.3, aggro: 620, color: '#59c25a' },
  boss: { kind: 'boss', label: 'Jefe Impostor', hp: 1700, speed: 84, r: 66, height: 190, melee: 45, meleeCd: 1.2, aggro: 1000, color: '#b04aff' },
}

export const IMPOSTOR_HP = 200
export const LEGO_TOTAL = 14
export const FORM_URL = 'https://docs.google.com/forms/d/1OGeIBWHcGsGwSCpw-GX3O-HOwJxN4AePnH-cYvA4_M0/edit'
