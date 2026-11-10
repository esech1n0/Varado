// Audio procedural (Web Audio): sin archivos externos.
// Buses: efectos generales (sfx), armas (weapon), buggy y música; todos pasan por el volumen general (master).
import { SETTINGS, saveSettings } from './config'

type BusId = 'sfx' | 'weapon'

let ac: AudioContext | null = null
let master: GainNode | null = null
const bus: { sfx: GainNode | null; weapon: GainNode | null; buggy: GainNode | null; music: GainNode | null } = { sfx: null, weapon: null, buggy: null, music: null }
let engine: { osc: OscillatorNode; osc2: OscillatorNode; gain: GainNode } | null = null
let muted = false

function syncGains(): void {
  if (master) master.gain.value = muted ? 0 : (SETTINGS.masterVolume / 100) * 0.65
  if (bus.sfx) bus.sfx.gain.value = SETTINGS.sfxVolume / 100
  if (bus.weapon) bus.weapon.gain.value = SETTINGS.weaponVolume / 100
  if (bus.buggy) bus.buggy.gain.value = SETTINGS.buggyVolume / 100
  if (bus.music) bus.music.gain.value = SETTINGS.musicVolume / 100
}

export type VolumeKey = 'masterVolume' | 'sfxVolume' | 'weaponVolume' | 'buggyVolume' | 'musicVolume'
export function setVolume(key: VolumeKey, v: number): void {
  SETTINGS[key] = Math.max(0, Math.min(100, Math.round(v)))
  saveSettings()
  syncGains()
}

export function audioInit(): void {
  if (ac) {
    void ac.resume()
    syncGains()
    return
  }
  try {
    ac = new AudioContext()
    master = ac.createGain()
    for (const k of ['sfx', 'weapon', 'buggy', 'music'] as const) {
      const g = ac.createGain()
      g.connect(master)
      bus[k] = g
    }
    master.connect(ac.destination)
    syncGains()
    startMusic()
  } catch {
    ac = null
  }
}

export function setMuted(m: boolean): void {
  muted = m
  syncGains()
}
export const isMuted = (): boolean => muted

type BeepOpts = { type?: OscillatorType; vol?: number; slide?: number; delay?: number; bus?: BusId }
export function beep(freq: number, dur: number, opts: BeepOpts = {}): void {
  const out = bus[opts.bus ?? 'sfx']
  if (!ac || !out || muted) return
  const t = ac.currentTime + (opts.delay ?? 0)
  const o = ac.createOscillator()
  const g = ac.createGain()
  o.type = opts.type ?? 'square'
  o.frequency.setValueAtTime(freq, t)
  if (opts.slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, opts.slide), t + dur)
  g.gain.setValueAtTime(opts.vol ?? 0.1, t)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  o.connect(g)
  g.connect(out)
  o.start(t)
  o.stop(t + dur + 0.02)
}

let lastNoise = 0
export function noise(dur: number, vol = 0.12, hp = 800, busId: BusId = 'sfx'): void {
  const out = bus[busId]
  if (!ac || !out || muted) return
  const now = ac.currentTime
  if (now - lastNoise < 0.012) return
  lastNoise = now
  const n = Math.floor(ac.sampleRate * dur)
  const buf = ac.createBuffer(1, n, ac.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n)
  const s = ac.createBufferSource()
  s.buffer = buf
  const f = ac.createBiquadFilter()
  f.type = 'highpass'
  f.frequency.value = hp
  const g = ac.createGain()
  g.gain.value = vol
  s.connect(f)
  f.connect(g)
  g.connect(out)
  s.start()
}

export const sfx = {
  shoot(freq: [number, number], vol = 0.07) {
    beep(freq[0], 0.1, { type: 'square', vol, slide: freq[1], bus: 'weapon' })
  },
  shotgun() {
    noise(0.2, 0.22, 300, 'weapon')
    beep(160, 0.18, { type: 'sawtooth', vol: 0.14, slide: 50, bus: 'weapon' })
  },
  sniper() {
    noise(0.18, 0.2, 1200, 'weapon')
    beep(2400, 0.22, { type: 'sawtooth', vol: 0.16, slide: 140, bus: 'weapon' })
    beep(920, 0.28, { type: 'sine', vol: 0.12, slide: 110, delay: 0.02, bus: 'weapon' })
  },
  weapon() {
    beep(300, 0.06, { type: 'square', vol: 0.06, bus: 'weapon' })
    beep(450, 0.08, { type: 'square', vol: 0.06, delay: 0.05, bus: 'weapon' })
  },
  hit() {
    beep(220, 0.06, { type: 'triangle', vol: 0.07, slide: 140 })
  },
  kill() {
    beep(520, 0.16, { type: 'sine', vol: 0.1, slide: 90 })
    beep(180, 0.2, { type: 'square', vol: 0.05, slide: 60, delay: 0.05 })
  },
  hurt() {
    beep(160, 0.28, { type: 'sawtooth', vol: 0.16, slide: 55 })
    noise(0.12, 0.1, 400)
  },
  pickup() {
    beep(660, 0.08, { type: 'triangle', vol: 0.1 })
    beep(990, 0.12, { type: 'triangle', vol: 0.1, delay: 0.07 })
  },
  heal() {
    beep(520, 0.1, { type: 'sine', vol: 0.12 })
    beep(780, 0.1, { type: 'sine', vol: 0.12, delay: 0.09 })
    beep(1040, 0.18, { type: 'sine', vol: 0.12, delay: 0.18 })
  },
  lego() {
    beep(880, 0.08, { type: 'triangle', vol: 0.12 })
    beep(1320, 0.08, { type: 'triangle', vol: 0.12, delay: 0.07 })
    beep(1760, 0.2, { type: 'triangle', vol: 0.12, delay: 0.14 })
  },
  turretLock() {
    beep(500, 0.5, { type: 'sawtooth', vol: 0.06, slide: 1400 })
  },
  turretFire() {
    noise(0.25, 0.2, 500)
    beep(1800, 0.3, { type: 'sawtooth', vol: 0.12, slide: 120 })
  },
  zap() {
    noise(0.3, 0.2, 1500)
    beep(2200, 0.35, { type: 'sawtooth', vol: 0.12, slide: 80 })
  },
  alien() {
    beep(240, 0.3, { type: 'sawtooth', vol: 0.06, slide: 120 })
  },
  roar() {
    beep(90, 0.9, { type: 'sawtooth', vol: 0.16, slide: 45 })
    beep(130, 0.9, { type: 'square', vol: 0.08, slide: 60, delay: 0.05 })
  },
  slam() {
    noise(0.3, 0.25, 120)
    beep(70, 0.35, { type: 'sine', vol: 0.3, slide: 35 })
  },
  door() {
    beep(180, 0.5, { type: 'sawtooth', vol: 0.08, slide: 420 })
  },
  lever() {
    noise(0.12, 0.2, 200)
    beep(110, 0.18, { type: 'square', vol: 0.14, slide: 60 })
    beep(70, 0.9, { type: 'sawtooth', vol: 0.1, slide: 150, delay: 0.2 })
  },
  fuel() {
    beep(330, 0.14, { type: 'sawtooth', vol: 0.09, slide: 660 })
    beep(990, 0.22, { type: 'triangle', vol: 0.12, delay: 0.1 })
  },
  checkpoint() {
    beep(523, 0.12, { type: 'triangle', vol: 0.12 })
    beep(659, 0.12, { type: 'triangle', vol: 0.12, delay: 0.1 })
    beep(784, 0.22, { type: 'triangle', vol: 0.12, delay: 0.2 })
  },
  thought() {
    beep(880, 0.07, { type: 'sine', vol: 0.04 })
    beep(1175, 0.09, { type: 'sine', vol: 0.035, delay: 0.06 })
  },
  achievement() {
    ;[784, 988, 1175, 1568].forEach((f, i) => beep(f, 0.16, { type: 'triangle', vol: 0.12, delay: i * 0.08 }))
  },
  launch() {
    noise(2.2, 0.25, 100)
    beep(70, 3, { type: 'sawtooth', vol: 0.2, slide: 400 })
  },
  win() {
    ;[523, 659, 784, 1047].forEach((f, i) => beep(f, 0.3, { type: 'triangle', vol: 0.14, delay: i * 0.14 }))
  },
  lose() {
    ;[400, 320, 240, 160].forEach((f, i) => beep(f, 0.3, { type: 'sawtooth', vol: 0.1, delay: i * 0.16 }))
  },
}

/** Zumbido del motor del buggy: `speed` 0..1. */
export function engineSet(on: boolean, speed: number): void {
  if (!ac || !bus.buggy) return
  if (on && !engine) {
    const osc = ac.createOscillator()
    const osc2 = ac.createOscillator()
    const gain = ac.createGain()
    osc.type = 'sawtooth'
    osc2.type = 'square'
    gain.gain.value = 0
    osc.connect(gain)
    osc2.connect(gain)
    gain.connect(bus.buggy)
    osc.start()
    osc2.start()
    engine = { osc, osc2, gain }
  }
  if (!engine) return
  const t = ac.currentTime
  if (on) {
    engine.osc.frequency.setTargetAtTime(48 + speed * 90, t, 0.08)
    engine.osc2.frequency.setTargetAtTime(24 + speed * 45, t, 0.08)
    engine.gain.gain.setTargetAtTime(muted ? 0 : 0.035 + speed * 0.035, t, 0.1)
  } else {
    // Corta el volumen inmediatamente para que no siga zumbando en pausa o reinicio
    engine.gain.gain.cancelScheduledValues(t)
    engine.gain.gain.setValueAtTime(0, t)
  }
}

/** Detiene y destruye por completo los osciladores del motor del buggy. */
export function engineStop(): void {
  if (!engine || !ac) return
  try {
    const t = ac.currentTime
    engine.gain.gain.cancelScheduledValues(t)
    engine.gain.gain.setValueAtTime(0, t)
    engine.osc.stop(t + 0.01)
    engine.osc2.stop(t + 0.01)
    engine.osc.disconnect()
    engine.osc2.disconnect()
    engine.gain.disconnect()
  } catch {
    /* ignore */
  }
  engine = null
}

// ---------- Música ambiental generativa (menú y juego) ----------
export type MusicMode = 'menu' | 'play' | 'boss'
let musicMode: MusicMode = 'menu'
export function setMusicMode(m: MusicMode): void {
  musicMode = m
}

const CHORDS = [
  [57, 60, 64], // Am
  [53, 57, 60], // F
  [48, 52, 55], // C
  [55, 59, 62], // G
]
const mtof = (m: number): number => 440 * Math.pow(2, (m - 69) / 12)

function startMusic(): void {
  if (!ac || !bus.music) return
  const ctx = ac
  const out = bus.music

  // eco largo para dar sensación de vacío
  const delay = ctx.createDelay(1.5)
  delay.delayTime.value = 0.52
  const fb = ctx.createGain()
  fb.gain.value = 0.38
  const dlp = ctx.createBiquadFilter()
  dlp.type = 'lowpass'
  dlp.frequency.value = 1800
  delay.connect(dlp)
  dlp.connect(fb)
  fb.connect(delay)
  const wet = ctx.createGain()
  wet.gain.value = 0.5
  dlp.connect(wet)
  wet.connect(out)

  // drone de fondo (viento y graves)
  const ambGain = ctx.createGain()
  ambGain.gain.value = 0.04
  const d1 = ctx.createOscillator()
  const d2 = ctx.createOscillator()
  d1.type = 'sine'
  d2.type = 'triangle'
  d1.frequency.value = 55
  d2.frequency.value = 82.4
  const lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = 180
  d1.connect(lp)
  d2.connect(lp)
  const len = ctx.sampleRate * 3
  const wBuf = ctx.createBuffer(1, len, ctx.sampleRate)
  const wData = wBuf.getChannelData(0)
  for (let i = 0; i < len; i++) wData[i] = (Math.random() * 2 - 1) * 0.35
  const wind = ctx.createBufferSource()
  wind.buffer = wBuf
  wind.loop = true
  const bp = ctx.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.value = 260
  bp.Q.value = 2.2
  wind.connect(bp)
  bp.connect(ambGain)
  lp.connect(ambGain)
  ambGain.connect(out)
  d1.start()
  d2.start()
  wind.start()

  const note = (midi: number, t: number, dur: number, vol: number, type: OscillatorType, sendDelay: boolean, attack = 0.02): void => {
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = type
    o.frequency.value = mtof(midi)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.linearRampToValueAtTime(vol, t + attack)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    o.connect(g)
    g.connect(out)
    if (sendDelay) g.connect(delay)
    o.start(t)
    o.stop(t + dur + 0.05)
  }

  let nextT = ctx.currentTime + 0.3
  let bar = 0
  window.setInterval(() => {
    if (ctx.state !== 'running' || muted || SETTINGS.musicVolume <= 0 || SETTINGS.masterVolume <= 0) {
      nextT = Math.max(nextT, ctx.currentTime + 0.3)
      return
    }
    while (nextT < ctx.currentTime + 1.2) {
      const chord = CHORDS[bar % CHORDS.length]
      const beat = musicMode === 'boss' ? 0.3 : musicMode === 'play' ? 0.42 : 0.5
      const barDur = beat * 8
      // pad largo
      for (const m of chord) {
        note(m, nextT, barDur * 1.35, 0.05, 'triangle', true, barDur * 0.35)
        note(m - 12, nextT, barDur * 1.35, 0.03, 'sine', false, barDur * 0.35)
      }
      note(chord[0] - 24, nextT, barDur, musicMode === 'menu' ? 0.07 : 0.1, 'sine', false, 0.05)
      // arpegio disperso
      for (let i = 0; i < 8; i++) {
        if (Math.random() < (musicMode === 'menu' ? 0.5 : 0.62)) {
          const m = chord[Math.floor(Math.random() * 3)] + 12 + (Math.random() < 0.3 ? 12 : 0)
          note(m, nextT + i * beat, 1.1, 0.045, 'sine', true)
        }
      }
      // pulso grave en juego y jefe
      if (musicMode !== 'menu') {
        for (let i = 0; i < 8; i += 2) note(chord[0] - 24, nextT + i * beat, 0.28, musicMode === 'boss' ? 0.13 : 0.07, 'triangle', false)
      }
      nextT += barDur
      bar++
    }
  }, 250)
}
