import './styles/main.css'
import { audioInit, isMuted, setMasterVolume, setMuted, setSfxVolume } from './game/audio'
import { FORM_URL, SETTINGS, saveSettings } from './game/config'
import { Game } from './game/game'
import { Hud } from './game/hud'
import { Input } from './game/input'
import { loadModels } from './game/models'
import { tuning } from './game/tuning'

const canvas = document.getElementById('game') as HTMLCanvasElement
const hud = new Hud()
const input = new Input(canvas)
let game: Game
try {
  game = new Game(canvas, input, hud)
} catch (e) {
  console.error(e)
  document.getElementById('load-hint')!.textContent = 'Este navegador no puede mostrar gráficos 3D (WebGL).'
  throw e
}
game.resetRun()

const $ = <T extends HTMLElement = HTMLElement>(id: string): T => document.getElementById(id) as T
let started = false
let inSettings = false

function pause(): void {
  if (!started || game.mode !== 'play' || game.paused) return
  game.paused = true
  inSettings = false
  hud.overlay('settings', false)
  hud.overlay('pause', true)
  input.exitLock()
}
function resume(): void {
  if (!game.paused) return
  game.paused = false
  inSettings = false
  hud.overlay('settings', false)
  hud.overlay('pause', false)
  input.requestLock()
}

input.onLockChange = locked => {
  // al soltar el ratón (Esc) en plena partida, se pausa
  if (!locked && started && game.mode === 'play' && !game.paused && !input.touchMode) pause()
}
addEventListener('keydown', e => {
  const isInput = (e.target as HTMLElement | null)?.tagName === 'INPUT'
  if (e.code === 'Escape' && started && game.mode === 'play') {
    if (isInput) (e.target as HTMLElement).blur()
    if (inSettings) {
      inSettings = false
      hud.overlay('settings', false)
      hud.overlay('pause', true)
      return
    }
    if (game.paused) resume()
    else pause()
    return
  }
  if (isInput) return
  if (e.code === 'KeyP' && started && game.mode === 'play') {
    if (inSettings) return
    game.paused ? resume() : pause()
  }
})
document.addEventListener('visibilitychange', () => document.hidden && pause())

$('btn-play').addEventListener('click', () => {
  audioInit()
  started = true
  hud.overlay('start', false)
  tuning.activate('run')
  tuning.activate('run')
  game.start()
  input.requestLock()
})
$('btn-resume').addEventListener('click', resume)
$('btn-settings').addEventListener('click', () => {
  inSettings = true
  hud.overlay('pause', false)
  hud.overlay('settings', true)
})
$('btn-settings-back').addEventListener('click', () => {
  inSettings = false
  hud.overlay('settings', false)
  hud.overlay('pause', true)
})
$('btn-cp').addEventListener('click', () => {
  audioInit()
  game.paused = false
  inSettings = false
  hud.overlay('pause', false)
  hud.overlay('settings', false)
  game.respawn()
})
$('btn-restart').addEventListener('click', () => {
  audioInit()
  game.paused = false
  inSettings = false
  hud.overlay('pause', false)
  hud.overlay('settings', false)
  game.start()
  input.requestLock()
})
$('btn-quit-eval').addEventListener('click', () => {
  window.open(FORM_URL, '_blank', 'noopener,noreferrer')
  game.paused = false
  inSettings = false
  started = false
  hud.overlay('pause', false)
  hud.overlay('settings', false)
  hud.showHud(false)
  game.resetRun()
  hud.overlay('start', true)
  input.exitLock()
})
$('btn-retry').addEventListener('click', () => {
  audioInit()
  game.respawn()
})
$('btn-again').addEventListener('click', () => {
  audioInit()
  hud.overlay('end', false)
  game.start()
  input.requestLock()
})
$('mute').addEventListener('click', () => {
  setMuted(!isMuted())
  $('mute').textContent = isMuted() ? 'SILENCIADO' : 'SONIDO'
})

// ----- Controles del menú de configuración -----
const volMaster = $<HTMLInputElement>('vol-master')
const volMasterVal = $('vol-master-val')
const volSfx = $<HTMLInputElement>('vol-sfx')
const volSfxVal = $('vol-sfx-val')
const sensRange = $<HTMLInputElement>('sens-range')
const sensInput = $<HTMLInputElement>('sens-input')
const fmtSens = (v: number): string => Number(v.toFixed(2)).toString()

volMaster.value = String(Math.round(SETTINGS.masterVolume))
volMasterVal.textContent = String(Math.round(SETTINGS.masterVolume))
volSfx.value = String(Math.round(SETTINGS.sfxVolume))
volSfxVal.textContent = String(Math.round(SETTINGS.sfxVolume))
sensRange.value = fmtSens(SETTINGS.sensitivity)
sensInput.value = fmtSens(SETTINGS.sensitivity)

volMaster.addEventListener('input', () => {
  setMasterVolume(Number(volMaster.value))
  volMasterVal.textContent = String(Math.round(SETTINGS.masterVolume))
})
volSfx.addEventListener('input', () => {
  setSfxVolume(Number(volSfx.value))
  volSfxVal.textContent = String(Math.round(SETTINGS.sfxVolume))
})
sensRange.addEventListener('input', () => {
  const v = Math.max(0.1, Math.min(10, Math.round(Number(sensRange.value) * 10) / 10))
  SETTINGS.sensitivity = v
  sensInput.value = fmtSens(v)
  saveSettings()
})
const applySensFromInput = (clampToBounds: boolean): void => {
  const raw = sensInput.value.replace(',', '.').trim()
  const parsed = Number.parseFloat(raw)
  if (!Number.isFinite(parsed)) {
    if (clampToBounds) sensInput.value = fmtSens(SETTINGS.sensitivity)
    return
  }
  const v = Math.max(0.1, Math.min(10, Math.round(parsed * 100) / 100))
  SETTINGS.sensitivity = v
  sensRange.value = String(v)
  if (clampToBounds) sensInput.value = fmtSens(v)
  saveSettings()
}
sensInput.addEventListener('input', () => applySensFromInput(false))
sensInput.addEventListener('change', () => applySensFromInput(true))
sensInput.addEventListener('blur', () => applySensFromInput(true))

// ----- carga de modelos -----
hud.setPlayButton(false, 'Cargando modelos…')
loadModels((d, t) => hud.loadHint(`Preparando el planeta… ${d}/${t}`))
  .then(failed => {
    game.failedModels = failed
    game.resetRun()
    hud.loadHint(failed.length ? 'Algunos modelos no cargaron; se usarán versiones simples.' : 'Todo listo. ¡Buena suerte, astronauta!')
    hud.setPlayButton(true, 'JUGAR')
  })
  .catch(e => {
    console.error(e)
    hud.setPlayButton(true, 'JUGAR')
  })

if (new URLSearchParams(location.search).has('debug')) {
  ;(window as unknown as Record<string, unknown>).__game = game
}

let last = performance.now()
function loop(now: number): void {
  const dt = (now - last) / 1000
  last = now
  game.frame(dt)
  requestAnimationFrame(loop)
}
requestAnimationFrame(loop)
