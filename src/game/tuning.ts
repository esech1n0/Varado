import { CONFIG, DEFAULT_CONFIG } from './config'

type Mode = 'LIVE' | 'NEXT_RUN'
type Boundary = 'run'
type Control = {
  id: string
  type: 'number'
  category: string
  label: string
  description: string
  unit: string
  default: number
  min: number
  max: number
  step: number
  applyMode: Mode
  integrity: 'COSMETIC' | 'GAMEPLAY'
}
type Binding = { control: Control; boundary?: Boundary; read(): number; write(value: number): void }

const CATEGORY: Record<string, string> = { player: 'Movimiento', buggy: 'Buggy', horde: 'Horda', difficulty: 'Dificultad', camera: 'Cámara' }
const bindings: Binding[] = []

function number<S extends keyof typeof CONFIG>(
  section: S,
  key: keyof (typeof CONFIG)[S] & string,
  label: string,
  min: number,
  max: number,
  step: number,
  unit: string,
  boundary?: Boundary,
): void {
  const values = CONFIG[section] as unknown as Record<string, number>
  const defaults = DEFAULT_CONFIG[section] as unknown as Record<string, number>
  bindings.push({
    control: Object.freeze({
      id: `${section}.${key}`,
      type: 'number',
      category: CATEGORY[section] ?? section,
      label,
      description: boundary ? 'Se aplica al iniciar una nueva partida.' : 'Se actualiza al instante en la vista previa.',
      unit,
      default: defaults[key],
      min,
      max,
      step,
      applyMode: boundary ? 'NEXT_RUN' : 'LIVE',
      integrity: section === 'camera' ? 'COSMETIC' : 'GAMEPLAY',
    }),
    boundary,
    read: () => values[key],
    write: value => {
      values[key] = value
    },
  })
}

number('player', 'speed', 'Velocidad a pie', 120, 320, 10, 'u/s')
number('buggy', 'maxSpeed', 'Velocidad máxima del buggy', 240, 700, 10, 'u/s')
number('buggy', 'accel', 'Aceleración del buggy', 160, 700, 10, 'u/s²')
number('horde', 'interval', 'Segundos entre hordas', 8, 90, 1, 's')
number('horde', 'size', 'Tamaño de las hordas', 0.5, 3, 0.25, '×', 'run')
number('horde', 'cap', 'Máximo de aliens perseguidores', 8, 60, 2, '')
number('difficulty', 'damageTaken', 'Daño recibido', 0.25, 3, 0.25, '×')
number('camera', 'fov', 'Campo de visión', 40, 100, 1, '°')

const byId = new Map(bindings.map(b => [b.control.id, b]))
let requested: Record<string, number> = Object.fromEntries(bindings.map(({ control }) => [control.id, control.default]))
let unranked = false
const gameplayModified = (): boolean => bindings.some(b => b.control.integrity === 'GAMEPLAY' && b.read() !== b.control.default)

export const tuning = {
  get unranked(): boolean {
    return unranked
  },
  controls: Object.freeze(bindings.map(b => b.control)),
  read() {
    return { requested: { ...requested }, active: Object.fromEntries(bindings.map(b => [b.control.id, b.read()])) }
  },
  apply(patch: unknown): void {
    if (!patch || typeof patch !== 'object' || Array.isArray(patch)) throw new Error('Parche inválido')
    const entries = Object.entries(patch)
    if (entries.length > bindings.length) throw new Error('Parche inválido')
    for (const [id, value] of entries) {
      const control = byId.get(id)?.control
      if (!control || typeof value !== 'number' || !Number.isFinite(value) || value < control.min || value > control.max) throw new Error('Valor inválido')
      const steps = (value - control.min) / control.step
      if (value !== control.default && Math.abs(steps - Math.round(steps)) > 1e-7) throw new Error('Incremento inválido')
    }
    requested = { ...requested, ...(patch as Record<string, number>) }
    for (const [id, value] of entries) {
      const b = byId.get(id)!
      if (b.control.applyMode === 'LIVE') b.write(value as number)
    }
    unranked ||= gameplayModified()
  },
  activate(boundary: Boundary): void {
    for (const b of bindings) if (b.boundary === boundary) b.write(requested[b.control.id])
    unranked = boundary === 'run' ? gameplayModified() : unranked || gameplayModified()
  },
}
