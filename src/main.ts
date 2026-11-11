import './styles/main.css'
import { audioInit, engineSet, engineStop, setMusicMode, setVolume, type VolumeKey } from './game/audio'
import { FORM_URL, SETTINGS, saveSettings, type DifficultyId, type Quality } from './game/config'
import { achievements } from './game/achievements'
import { Game } from './game/game'
import { Hud } from './game/hud'
import { Input } from './game/input'
import { loadModels } from './game/models'

const $ = <T extends HTMLElement = HTMLElement>(id: string): T => document.getElementById(id) as T

const canvas = $('game') as HTMLCanvasElement
const menuBgCanvas = $('menu-bg') as HTMLCanvasElement
const hud = new Hud()
const input = new Input(canvas)
let game: Game

try {
  game = new Game(canvas, input, hud)
    ; (window as any).__GAME__ = game
} catch (e) {
  console.error(e)
  $('load-hint')!.textContent = 'Este navegador no puede mostrar gráficos 3D (WebGL).'
  throw e
}
game.resetRun()

// Toast de logros emergentes en el juego
achievements.setUnlockHandler(a => hud.toast(a))

let started = false
let inSettings = false
let menuSettingsMode = false

// ==========================================
// Fondo del espacio animado (Menú principal)
// Planeta abajo-izquierda, estrellas y lluvia finita de meteoritos de derecha a izquierda
// ==========================================
interface Star {
  x: number
  y: number
  r: number
  alpha: number
  twinkle: number
  speed: number
}

interface Meteor {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  rot: number
  vrot: number
  pts: number[]
  trail: { x: number; y: number; a: number }[]
  color: string
}

let menuBgActive = true
const ctx = menuBgCanvas.getContext('2d')
let stars: Star[] = []
let meteors: Meteor[] = []

function initSpace(): void {
  const w = (menuBgCanvas.width = window.innerWidth)
  const h = (menuBgCanvas.height = window.innerHeight)

  // Estrellas titilantes
  stars = []
  const count = Math.round(Math.min(220, (w * h) / 7000))
  for (let i = 0; i < count; i++) {
    stars.push({
      x: Math.random() * w,
      y: Math.random() * h,
      r: Math.random() < 0.1 ? 1.8 : Math.random() < 0.3 ? 1.2 : 0.75,
      alpha: 0.3 + Math.random() * 0.7,
      twinkle: Math.random() * Math.PI * 2,
      speed: 1.2 + Math.random() * 2.5,
    })
  }

  // Lluvia finita de meteoritos y piedras espaciales (se agotan gradualmente)
  meteors = []
  const mCount = 28
  for (let i = 0; i < mCount; i++) {
    const pts: number[] = []
    const sides = 5 + Math.floor(Math.random() * 4)
    for (let s = 0; s < sides; s++) {
      pts.push(0.7 + Math.random() * 0.5)
    }
    meteors.push({
      // Distribuidos hacia la derecha de la pantalla para que vayan pasando de uno en uno
      x: w * (0.85 + Math.random() * 2.2),
      y: Math.random() * (h * 0.85),
      vx: -(30 + Math.random() * 65),
      vy: 6 + Math.random() * 18,
      size: 3 + Math.random() * 6.5,
      rot: Math.random() * Math.PI * 2,
      vrot: (Math.random() - 0.5) * 1.5,
      pts,
      trail: [],
      color: Math.random() < 0.3 ? '#8feeff' : Math.random() < 0.6 ? '#ffe494' : '#e0e7f5',
    })
  }
}

let spaceLastT = performance.now()
function renderSpace(now: number): void {
  if (!menuBgActive || !ctx) return
  const dt = Math.min(0.1, (now - spaceLastT) / 1000)
  spaceLastT = now

  const w = menuBgCanvas.width
  const h = menuBgCanvas.height

  // Fondo espacial profundo
  ctx.fillStyle = '#030514'
  ctx.fillRect(0, 0, w, h)

  // Nebulosa sutil en el fondo
  const neb = ctx.createRadialGradient(w * 0.15, h * 0.85, 40, w * 0.15, h * 0.85, Math.max(w, h) * 0.7)
  neb.addColorStop(0, 'rgba(30, 45, 90, 0.45)')
  neb.addColorStop(0.5, 'rgba(15, 20, 50, 0.25)')
  neb.addColorStop(1, 'rgba(3, 5, 20, 0)')
  ctx.fillStyle = neb
  ctx.fillRect(0, 0, w, h)

  // Dibujar estrellas
  for (const s of stars) {
    s.twinkle += dt * s.speed
    const a = Math.max(0.15, Math.min(1, s.alpha + Math.sin(s.twinkle) * 0.35))
    ctx.fillStyle = `rgba(220, 235, 255, ${a})`
    ctx.beginPath()
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
    ctx.fill()
  }

  // Dibujar meteoritos y basura espacial lenta
  for (let i = meteors.length - 1; i >= 0; i--) {
    const m = meteors[i]
    m.x += m.vx * dt
    m.y += m.vy * dt
    m.rot += m.vrot * dt

    // Estela corta
    m.trail.push({ x: m.x, y: m.y, a: 0.6 })
    if (m.trail.length > 7) m.trail.shift()
    for (let t = 0; t < m.trail.length; t++) {
      const tr = m.trail[t]
      tr.a *= 0.82
      const trR = m.size * (0.2 + (t / m.trail.length) * 0.6)
      ctx.fillStyle = `rgba(160, 210, 255, ${tr.a * 0.4})`
      ctx.beginPath()
      ctx.arc(tr.x, tr.y, trR, 0, Math.PI * 2)
      ctx.fill()
    }

    // Piedra irregular
    ctx.save()
    ctx.translate(m.x, m.y)
    ctx.rotate(m.rot)
    ctx.fillStyle = m.color
    ctx.strokeStyle = '#4a597a'
    ctx.lineWidth = 1
    ctx.beginPath()
    const sides = m.pts.length
    for (let s = 0; s < sides; s++) {
      const ang = (s / sides) * Math.PI * 2
      const rad = m.size * m.pts[s]
      const px = Math.cos(ang) * rad
      const py = Math.sin(ang) * rad
      if (s === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    }
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
    ctx.restore()

    // Si sale de la pantalla por la izquierda, se elimina (lluvia finita)
    if (m.x < -80 || m.y > h + 80) {
      meteors.splice(i, 1)
    }
  }

  // Planeta grande en la esquina inferior izquierda
  const planetX = w * 0.08
  const planetY = h * 1.04
  const planetR = Math.min(w, h) * 0.48

  // Atmósfera exterior (halo brillante)
  const glow = ctx.createRadialGradient(planetX, planetY, planetR * 0.92, planetX, planetY, planetR * 1.25)
  glow.addColorStop(0, 'rgba(87, 242, 255, 0.45)')
  glow.addColorStop(0.35, 'rgba(40, 140, 220, 0.22)')
  glow.addColorStop(0.7, 'rgba(20, 60, 140, 0.08)')
  glow.addColorStop(1, 'rgba(3, 5, 20, 0)')
  ctx.fillStyle = glow
  ctx.beginPath()
  ctx.arc(planetX, planetY, planetR * 1.25, 0, Math.PI * 2)
  ctx.fill()

  // Cuerpo del planeta con luz superior derecha y sombras
  const pGrad = ctx.createRadialGradient(planetX + planetR * 0.35, planetY - planetR * 0.45, planetR * 0.1, planetX, planetY, planetR)
  pGrad.addColorStop(0, '#57f2ff')
  pGrad.addColorStop(0.25, '#2874ba')
  pGrad.addColorStop(0.55, '#153a6b')
  pGrad.addColorStop(0.85, '#0a1d3c')
  pGrad.addColorStop(1, '#050d1e')
  ctx.fillStyle = pGrad
  ctx.beginPath()
  ctx.arc(planetX, planetY, planetR, 0, Math.PI * 2)
  ctx.fill()

  // Anillos o franjas tenues de la atmósfera
  ctx.save()
  ctx.beginPath()
  ctx.arc(planetX, planetY, planetR, 0, Math.PI * 2)
  ctx.clip()
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)'
  ctx.lineWidth = 14
  ctx.beginPath()
  ctx.arc(planetX - 40, planetY - 20, planetR * 0.85, 0, Math.PI * 2)
  ctx.stroke()
  ctx.strokeStyle = 'rgba(87, 242, 255, 0.12)'
  ctx.lineWidth = 8
  ctx.beginPath()
  ctx.arc(planetX - 60, planetY - 10, planetR * 0.65, 0, Math.PI * 2)
  ctx.stroke()
  ctx.restore()

  if (menuBgActive) requestAnimationFrame(renderSpace)
}

initSpace()
requestAnimationFrame(renderSpace)
window.addEventListener('resize', () => {
  if (menuBgActive) initSpace()
})

function showMenuBackground(show: boolean): void {
  menuBgActive = show
  menuBgCanvas.style.display = show ? 'block' : 'none'
  if (show) {
    spaceLastT = performance.now()
    requestAnimationFrame(renderSpace)
  }
}

// ==========================================
// Control de pausa y ventanas
// ==========================================
function pause(): void {
  if (!started || (game.mode !== 'play' && game.mode !== 'space') || game.paused) return
  game.paused = true
  engineSet(false, 0)
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
  if (game.mode === 'play') input.requestLock()
}

input.onLockChange = locked => {
  if (!locked && started && game.mode === 'play' && !game.paused && !input.touchMode) pause()
}

addEventListener('keydown', e => {
  const isInput = (e.target as HTMLElement | null)?.tagName === 'INPUT'
  if (e.code === 'Escape' && started && (game.mode === 'play' || game.mode === 'space')) {
    if (isInput) (e.target as HTMLElement).blur()
    if (inSettings) {
      inSettings = false
      hud.overlay('settings', false)
      hud.overlay(menuSettingsMode ? 'start' : 'pause', true)
      return
    }
    if (game.paused) resume()
    else pause()
    return
  }
  if (isInput) return
  if (e.code === 'KeyP' && started && (game.mode === 'play' || game.mode === 'space')) {
    if (inSettings) return
    game.paused ? resume() : pause()
  }
})

document.addEventListener('visibilitychange', () => document.hidden && pause())

// ==========================================
// Botones del menú principal y flujo de inicio
// ==========================================
// 1. "Jugar" abre la pantalla de dificultad
$('btn-play').addEventListener('click', () => {
  audioInit()
  hud.overlay('start', false)
  hud.overlay('diff', true)
})

// Volver de selección de dificultad al menú principal
$('btn-diff-back').addEventListener('click', () => {
  hud.overlay('diff', false)
  hud.overlay('start', true)
})

// Seleccionar dificultad e iniciar partida
document.querySelectorAll<HTMLButtonElement>('.diff-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const diff = (btn.dataset.diff as DifficultyId) || 'normal'
    audioInit()
    game.setDifficulty(diff)
    hud.overlay('diff', false)
    hud.overlay('start', false)
    showMenuBackground(false)
    started = true
    setMusicMode('play')
    game.start()
    input.requestLock()
  })
})

// Configuración desde el menú principal
$('btn-menu-settings').addEventListener('click', () => {
  menuSettingsMode = true
  inSettings = true
  hud.overlay('start', false)
  hud.overlay('settings', true)
})

// Configuración desde la pausa
$('btn-settings').addEventListener('click', () => {
  menuSettingsMode = false
  inSettings = true
  hud.overlay('pause', false)
  hud.overlay('settings', true)
})

// Volver de configuración
$('btn-settings-back').addEventListener('click', () => {
  inSettings = false
  hud.overlay('settings', false)
  if (menuSettingsMode) {
    hud.overlay('start', true)
  } else {
    hud.overlay('pause', true)
  }
})

// Menú de logros
$('btn-menu-ach').addEventListener('click', () => {
  hud.renderAchievements()
  hud.overlay('start', false)
  hud.overlay('ach', true)
})

$('btn-ach-back').addEventListener('click', () => {
  hud.overlay('ach', false)
  hud.overlay('start', true)
})

$('btn-ach-reset').addEventListener('click', () => {
  if (window.confirm('¿Deseas reiniciar el progreso de todos tus logros?')) {
    achievements.reset()
    hud.renderAchievements()
  }
})

// ==========================================
// Botones de pausa, muerte y final
// ==========================================
$('btn-resume').addEventListener('click', resume)

$('btn-cp').addEventListener('click', () => {
  audioInit()
  engineStop()
  game.paused = false
  inSettings = false
  hud.overlay('pause', false)
  hud.overlay('settings', false)
  game.respawn()
})

$('btn-restart').addEventListener('click', () => {
  audioInit()
  engineStop()
  game.paused = false
  inSettings = false
  hud.overlay('pause', false)
  hud.overlay('settings', false)
  game.start()
  input.requestLock()
})

$('btn-quit-eval').addEventListener('click', () => {
  window.open(FORM_URL, '_blank', 'noopener,noreferrer')
  engineStop()
  game.paused = false
  inSettings = false
  started = false
  hud.overlay('pause', false)
  hud.overlay('settings', false)
  hud.showHud(false)
  game.resetRun()
  showMenuBackground(true)
  hud.overlay('start', true)
  input.exitLock()
})

$('btn-retry').addEventListener('click', () => {
  audioInit()
  engineStop()
  game.respawn()
})

$('btn-again').addEventListener('click', () => {
  audioInit()
  engineStop()
  hud.overlay('end', false)
  game.spaceLevel.showHud(false)
  showMenuBackground(true)
  game.resetRun()
  hud.overlay('start', true)
})

const btnSpaceRetry = $('btn-space-retry')
if (btnSpaceRetry) {
  btnSpaceRetry.addEventListener('click', () => {
    audioInit()
    hud.overlay('space-dead', false)
    game.startLevel2()
  })
}

const btnSpaceMenu = $('btn-space-menu')
if (btnSpaceMenu) {
  btnSpaceMenu.addEventListener('click', () => {
    audioInit()
    hud.overlay('space-dead', false)
    game.spaceLevel.showHud(false)
    showMenuBackground(true)
    game.resetRun()
    hud.overlay('start', true)
  })
}

// ==========================================
// Configuración: Volúmenes, Sensibilidad y Calidad
// ==========================================
function bindVolumeSlider(sliderId: string, valId: string, key: VolumeKey): void {
  const slider = $<HTMLInputElement>(sliderId)
  const val = $(valId)
  if (!slider || !val) return
  const initial = Math.round(SETTINGS[key] as number)
  slider.value = String(initial)
  val.textContent = String(initial)

  slider.addEventListener('input', () => {
    const v = Number(slider.value)
    setVolume(key, v)
    val.textContent = String(Math.round(v))
  })
}

bindVolumeSlider('vol-master', 'vol-master-val', 'masterVolume')
bindVolumeSlider('vol-sfx', 'vol-sfx-val', 'sfxVolume')
bindVolumeSlider('vol-weapon', 'vol-weapon-val', 'weaponVolume')
bindVolumeSlider('vol-buggy', 'vol-buggy-val', 'buggyVolume')
bindVolumeSlider('vol-music', 'vol-music-val', 'musicVolume')

// Sensibilidad
const sensRange = $<HTMLInputElement>('sens-range')
const sensVal = $('sens-val')
const fmtSens = (v: number): string => v.toFixed(1)

if (sensRange && sensVal) {
  sensRange.value = String(SETTINGS.sensitivity)
  sensVal.textContent = fmtSens(SETTINGS.sensitivity)

  sensRange.addEventListener('input', () => {
    const v = Math.max(0.1, Math.min(10, Math.round(Number(sensRange.value) * 10) / 10))
    SETTINGS.sensitivity = v
    sensVal.textContent = fmtSens(v)
    saveSettings()
  })
}

// Botones de calidad gráfica horizontal
const qBtns = document.querySelectorAll<HTMLButtonElement>('.q-btn')
function updateQualityUI(current: Quality): void {
  qBtns.forEach(b => {
    b.classList.toggle('active', b.dataset.q === current)
  })
}
updateQualityUI(SETTINGS.quality)
qBtns.forEach(b => {
  b.addEventListener('click', () => {
    const q = (b.dataset.q as Quality) || 'auto'
    SETTINGS.quality = q
    updateQualityUI(q)
    game.applyQuality(q)
    saveSettings()
  })
})

// ==========================================
// Carga de modelos GLB
// ==========================================
hud.setPlayButton(false, 'Cargando modelos…')
loadModels((d, t) => hud.loadHint(`Preparando el planeta… ${d}/${t}`))
  .then(failed => {
    game.failedModels = failed
    game.resetRun()
    hud.loadHint(failed.length ? 'Modelos listos (con respaldos locales).' : '¡Buena suerte, astronauta!')
    hud.setPlayButton(true, 'JUGAR')
  })
  .catch(e => {
    console.error(e)
    hud.setPlayButton(true, 'JUGAR')
  })

// ==========================================
// Bucle principal de juego (WebGL)
// ==========================================
let last = performance.now()
function loop(now: number): void {
  const dt = (now - last) / 1000
  last = now
  game.frame(dt)
  requestAnimationFrame(loop)
}
requestAnimationFrame(loop)
