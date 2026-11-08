// Audio procedural (Web Audio): sin archivos externos.
import { SETTINGS, saveSettings } from './config'

let ac: AudioContext | null = null
let master: GainNode | null = null
let sfxBus: GainNode | null = null
let engine: { osc: OscillatorNode; osc2: OscillatorNode; gain: GainNode } | null = null
let muted = false

function syncGains(): void {
  if (master) master.gain.value = muted ? 0 : (SETTINGS.masterVolume / 100) * 0.65
  if (sfxBus) sfxBus.gain.value = SETTINGS.sfxVolume / 100
}

export function setMasterVolume(v: number): void {
  SETTINGS.masterVolume = Math.max(0, Math.min(100, Math.round(v)))
  saveSettings()
  syncGains()
}

export function setSfxVolume(v: number): void {
  SETTINGS.sfxVolume = Math.max(0, Math.min(100, Math.round(v)))
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
    sfxBus = ac.createGain()
    syncGains()
    sfxBus.connect(master)
    master.connect(ac.destination)

    // Ambiente espacial/viento sutil conectado a master (independiente de sfxBus)
    const ambGain = ac.createGain()
    ambGain.gain.value = 0.038
    const d1 = ac.createOscillator()
    const d2 = ac.createOscillator()
    d1.type = 'sine'
    d2.type = 'triangle'
    d1.frequency.value = 55
    d2.frequency.value = 82.4
    const lp = ac.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 180
    d1.connect(lp)
    d2.connect(lp)
    // viento de arena filtrado
    const len = ac.sampleRate * 3
    const wBuf = ac.createBuffer(1, len, ac.sampleRate)
    const wData = wBuf.getChannelData(0)
    for (let i = 0; i < len; i++) wData[i] = (Math.random() * 2 - 1) * 0.35
    const wind = ac.createBufferSource()
    wind.buffer = wBuf
    wind.loop = true
    const bp = ac.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 260
    bp.Q.value = 2.2
    wind.connect(bp)
    bp.connect(ambGain)
    lp.connect(ambGain)
    ambGain.connect(master)
    d1.start()
    d2.start()
    wind.start()
  } catch {
    ac = null
  }
}

export function setMuted(m: boolean): void {
  muted = m
  syncGains()
}
export const isMuted = (): boolean => muted

type BeepOpts = { type?: OscillatorType; vol?: number; slide?: number; delay?: number }
export function beep(freq: number, dur: number, opts: BeepOpts = {}): void {
  if (!ac || !sfxBus || muted) return
  const t = ac.currentTime + (opts.delay ?? 0)
  const o = ac.createOscillator()
  const g = ac.createGain()
  o.type = opts.type ?? 'square'
  o.frequency.setValueAtTime(freq, t)
  if (opts.slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, opts.slide), t + dur)
  g.gain.setValueAtTime(opts.vol ?? 0.1, t)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  o.connect(g)
  g.connect(sfxBus)
  o.start(t)
  o.stop(t + dur + 0.02)
}

let lastNoise = 0
export function noise(dur: number, vol = 0.12, hp = 800): void {
  if (!ac || !sfxBus || muted) return
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
  g.connect(sfxBus)
  s.start()
}

export const sfx = {
  shoot(freq: [number, number], vol = 0.07) {
    beep(freq[0], 0.1, { type: 'square', vol, slide: freq[1] })
  },
  shotgun() {
    noise(0.2, 0.22, 300)
    beep(160, 0.18, { type: 'sawtooth', vol: 0.14, slide: 50 })
  },
  sniper() {
    noise(0.18, 0.2, 1200)
    beep(2400, 0.22, { type: 'sawtooth', vol: 0.16, slide: 140 })
    beep(920, 0.28, { type: 'sine', vol: 0.12, slide: 110, delay: 0.02 })
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
  weapon() {
    beep(300, 0.06, { type: 'square', vol: 0.06 })
    beep(450, 0.08, { type: 'square', vol: 0.06, delay: 0.05 })
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
  checkpoint() {
    beep(523, 0.12, { type: 'triangle', vol: 0.12 })
    beep(659, 0.12, { type: 'triangle', vol: 0.12, delay: 0.1 })
    beep(784, 0.22, { type: 'triangle', vol: 0.12, delay: 0.2 })
  },
  radio() {
    noise(0.18, 0.05, 2500)
    beep(1200, 0.05, { type: 'square', vol: 0.03 })
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
  if (!ac || !sfxBus) return
  if (on && !engine) {
    const osc = ac.createOscillator()
    const osc2 = ac.createOscillator()
    const gain = ac.createGain()
    osc.type = 'sawtooth'
    osc2.type = 'square'
    gain.gain.value = 0
    osc.connect(gain)
    osc2.connect(gain)
    gain.connect(sfxBus)
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
    engine.gain.gain.setTargetAtTime(0, t, 0.1)
  }
}
