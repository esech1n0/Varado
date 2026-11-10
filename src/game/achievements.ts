// Logros: progreso persistente en localStorage, con títulos graciosos y barras 0/n.
import type { DifficultyId } from './config'

export type AchievementDef = { id: string; title: string; desc: string; goal: number }

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'pistol', title: 'Armado y (poco) peligroso', desc: 'Recoge la pistola láser.', goal: 1 },
  { id: 'impostor', title: 'Muy sospechoso, ¿no?', desc: 'Derrota al impostor del pasillo azul.', goal: 1 },
  { id: 'lever', title: 'Palanca 1 · Puerta 0', desc: 'Baja la palanca del garage rojo.', goal: 1 },
  { id: 'buggy', title: 'Mi primer coche (robado)', desc: 'Sube al buggy.', goal: 1 },
  { id: 'beacon', title: 'Guardar partida, versión real', desc: 'Activa tu primera baliza.', goal: 1 },
  { id: 'roadkill', title: 'Peatón alienígena, ¡cuidado!', desc: 'Atropella a 5 aliens con el buggy.', goal: 5 },
  { id: 'shotgun', title: 'Esto es mi escopeta', desc: 'Encuentra la escopeta.', goal: 1 },
  { id: 'shotgunKills', title: 'Cazador de bolas verdes', desc: 'Elimina a 25 aliens con la escopeta.', goal: 25 },
  { id: 'otherWeapon', title: 'Coleccionista de cosas que hacen pum', desc: 'Encuentra el rifle o el francotirador.', goal: 1 },
  { id: 'otherKills', title: 'Gatillo alegre', desc: 'Elimina a 25 aliens con la pistola, el rifle o el francotirador.', goal: 25 },
  { id: 'wave', title: 'Eso no era una ola, era un tsunami', desc: 'Derrota por completo una oleada de aliens.', goal: 1 },
  { id: 'grenade', title: 'Pequeño regalo explosivo', desc: 'Elimina a 3 aliens con granadas de plasma.', goal: 3 },
  { id: 'fuel', title: 'Gasolinera de roca', desc: 'Recoge las 3 piedras ignífugas.', goal: 3 },
  { id: 'bossReach', title: 'Hola, ¿es usted el jefe?', desc: 'Llega hasta el jefe impostor.', goal: 1 },
  { id: 'boss', title: 'Despido procedente', desc: 'Derrota al jefe impostor.', goal: 1 },
  { id: 'win', title: 'Varado... ya no tanto', desc: 'Completa el juego.', goal: 1 },
  { id: 'winEasy', title: 'Modo vacaciones', desc: 'Completa el juego en Fácil.', goal: 1 },
  { id: 'winNormal', title: 'Ni mucho ni poco', desc: 'Completa el juego en Moderado.', goal: 1 },
  { id: 'winHard', title: 'Piel de acero, nervios también', desc: 'Completa el juego en Difícil.', goal: 1 },
  { id: 'winInfestation', title: 'Sobreviviente profesional', desc: 'Completa el juego en INFESTACIÓN.', goal: 1 },
  { id: 'legos', title: 'Pisar un LEGO nunca fue tan feliz', desc: 'Consigue todas las piezas LEGO coleccionables.', goal: 14 },
  { id: 'armory', title: 'Armería ambulante', desc: 'Consigue pistola, rifle, escopeta, francotirador y granadas.', goal: 5 },
  { id: 'deaths', title: 'Cardio forzado', desc: 'Cae 10 veces (en total).', goal: 10 },
  { id: 'dash', title: 'Más rápido que mi sombra', desc: 'Haz dash 20 veces.', goal: 20 },
  { id: 'exhaust', title: 'Mañana sí voy al gimnasio', desc: 'Agota por completo tu estamina corriendo.', goal: 1 },
  { id: 'sniperKills', title: 'Ojo de halcón (con lentes)', desc: 'Elimina a 10 aliens con el francotirador.', goal: 10 },
  { id: 'zoom', title: 'Acércate un poquito más', desc: 'Usa la mira del francotirador.', goal: 1 },
  { id: 'camps', title: 'Turista de campamentos', desc: 'Visita los 5 campamentos enemigos.', goal: 5 },
  { id: 'ruins', title: 'Arqueólogo sin título', desc: 'Explora 10 ruinas distintas.', goal: 10 },
  { id: 'kills100', title: 'Control de plagas', desc: 'Derrota a 100 aliens.', goal: 100 },
]

const KEY = 'varado_achievements_v1'
type Save = { progress: Record<string, number>; unlocked: Record<string, boolean> }

const BY_ID = new Map(ACHIEVEMENTS.map(a => [a.id, a]))

function load(): Save {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const p = JSON.parse(raw) as Partial<Save>
      return { progress: p.progress ?? {}, unlocked: p.unlocked ?? {} }
    }
  } catch {
    /* localStorage puede estar deshabilitado */
  }
  return { progress: {}, unlocked: {} }
}

let state = load()
let onUnlock: (a: AchievementDef) => void = () => {}

function persist(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    /* ignorar */
  }
}

export const achievements = {
  setUnlockHandler(fn: (a: AchievementDef) => void): void {
    onUnlock = fn
  },
  progress(id: string): number {
    return state.progress[id] ?? 0
  },
  done(id: string): boolean {
    return !!state.unlocked[id]
  },
  /** Suma progreso (acumulativo entre partidas). */
  add(id: string, n = 1): void {
    const a = BY_ID.get(id)
    if (!a || state.unlocked[id]) return
    this.set(id, (state.progress[id] ?? 0) + n)
  },
  /** Fija el progreso a un valor (sólo si es mayor que el actual). */
  set(id: string, value: number): void {
    const a = BY_ID.get(id)
    if (!a || state.unlocked[id]) return
    const v = Math.min(a.goal, Math.max(state.progress[id] ?? 0, value))
    if (v === state.progress[id]) return
    state.progress[id] = v
    if (v >= a.goal) {
      state.unlocked[id] = true
      onUnlock(a)
    }
    persist()
  },
  completeRun(diff: DifficultyId): void {
    this.add('win')
    this.add({ easy: 'winEasy', normal: 'winNormal', hard: 'winHard', infestation: 'winInfestation' }[diff])
  },
  reset(): void {
    state = { progress: {}, unlocked: {} }
    persist()
  },
  count(): { done: number; total: number } {
    return { done: Object.keys(state.unlocked).length, total: ACHIEVEMENTS.length }
  },
}
