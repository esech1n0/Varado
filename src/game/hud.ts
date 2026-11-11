import { FUEL_TOTAL, GRENADE, LEGO_TOTAL, WEAPONS, WEAPON_ORDER, type AmmoWeapon, type WeaponId } from './config'
import { ACHIEVEMENTS, achievements, type AchievementDef } from './achievements'

const $ = <T extends HTMLElement = HTMLElement>(id: string): T => document.getElementById(id) as T

export type RadarDot = { x: number; y: number; kind: 'enemy' | 'site' | 'beacon' | 'ship' | 'lego' | 'buggy' | 'boss' | 'pickup' | 'fuel' }
export type OverlayId = 'start' | 'diff' | 'ach' | 'skins' | 'pause' | 'settings' | 'dead' | 'end' | 'space-dead'
const OVERLAYS: OverlayId[] = ['start', 'diff', 'ach', 'skins', 'pause', 'settings', 'dead', 'end', 'space-dead']

export class Hud {
  private capTimer = 0
  private radioTimer = 0
  private toastTimer = 0
  private hintTimer = 0
  private lastHp = -1
  private lastWeapons = ''
  private lastStamina = ''
  private lastObj = ''
  private lastFuel = ''
  private scoped = false
  private radarCtx = $<HTMLCanvasElement>('radar').getContext('2d')!

  constructor() {
    $('legoT').textContent = String(LEGO_TOTAL)
    $('fuelT').textContent = String(FUEL_TOTAL)
  }

  showHud(on: boolean, touch = false): void {
    $('hud').classList.toggle('hidden', !on)
    $('touch').classList.toggle('hidden', !(on && touch))
  }
  overlay(id: OverlayId, on: boolean): void {
    $(`ovl-${id}`).classList.toggle('hidden', !on)
  }
  anyOverlay(): boolean {
    return OVERLAYS.some(i => !$(`ovl-${i}`).classList.contains('hidden'))
  }

  setFuel(carried: number, placed = 0, total = 3): void {
    const val = `${carried}-${placed}`
    if (val === this.lastFuel) return
    this.lastFuel = val
    $('fuelN').textContent = String(carried)
    $('fuelT').textContent = String(total)
    $('fuel').classList.toggle('on', carried > 0 || placed > 0)
  }

  /** Viñeta de despertar: 2 segundos en pantalla negra y luego animación fluida abriendo los ojos. */
  wakeUp(): void {
    const el = $('wake-vignette')
    if (!el) return
    el.className = 'wake-init'
    setTimeout(() => {
      el.className = 'wake-opening'
    }, 2000)
    setTimeout(() => {
      el.className = 'hidden'
    }, 4500)
  }

  /** Muestra sugerencia emergente de controles o recordatorios de misión. */
  showControlHint(html: string, ms = 5000): void {
    const el = $('control-hint')
    if (!el) return
    el.innerHTML = html
    el.classList.remove('hidden')
    clearTimeout(this.hintTimer)
    if (ms > 0) {
      this.hintTimer = window.setTimeout(() => this.hideControlHint(), ms)
    }
  }

  hideControlHint(): void {
    const el = $('control-hint')
    if (el) el.classList.add('hidden')
  }

  /** Aviso emergente al desbloquear un logro. */
  toast(a: AchievementDef): void {
    const el = $('toast')
    el.classList.remove('perk')
    el.querySelector('.toast-head')!.textContent = '¡LOGRO DESBLOQUEADO!'
    $('toastTitle').textContent = a.title
    $('toastDesc').textContent = a.desc
    el.classList.add('on')
    clearTimeout(this.toastTimer)
    this.toastTimer = window.setTimeout(() => el.classList.remove('on'), 4200)
  }

  /** Aviso emergente de beneficio LEGO (reutiliza la tarjeta de logros). */
  perk(head: string, text: string): void {
    const el = $('toast')
    el.querySelector('.toast-head')!.textContent = head
    $('toastTitle').textContent = text
    $('toastDesc').textContent = ''
    el.classList.add('on', 'perk')
    clearTimeout(this.toastTimer)
    this.toastTimer = window.setTimeout(() => el.classList.remove('on'), 5200)
  }

  /** Dibuja la lista de logros con su barra de progreso verde 0/n. */
  renderAchievements(): void {
    const c = achievements.count()
    $('ach-count').textContent = `${c.done} / ${c.total}`
    $('ach-list').innerHTML = ACHIEVEMENTS.map(a => {
      const p = achievements.progress(a.id)
      const done = achievements.done(a.id)
      const pct = Math.round((p / a.goal) * 100)
      return `<div class="ach ${done ? 'done' : ''}"><div class="ach-top"><b>${a.title}</b><span>${done ? '✔ ' : ''}${p}/${a.goal}</span></div><div class="ach-desc">${a.desc}</div><div class="ach-bar"><i style="width:${pct}%"></i></div></div>`
    }).join('')
  }

  setHp(hp: number, max: number): void {
    const v = Math.max(0, Math.ceil(hp))
    if (v === this.lastHp) return
    this.lastHp = v
    const f = Math.max(0, hp / max)
    const fill = $('hpfill')
    fill.style.width = `${f * 100}%`
    fill.className = f < 0.3 ? 'low' : f < 0.6 ? 'mid' : ''
    $('hpnum').textContent = `${v} / ${max}`
  }

  setLego(n: number, pop = false): void {
    $('legoN').textContent = String(n)
    document.querySelectorAll<HTMLElement>('#legoPerks i').forEach(el => el.classList.toggle('on', n >= Number(el.dataset.n)))
    if (pop) {
      const el = $('lego')
      el.classList.remove('pop')
      void el.offsetWidth
      el.classList.add('pop')
    }
  }

  setObjective(html: string): void {
    if (html === this.lastObj) return
    this.lastObj = html
    $('objective').innerHTML = html
  }

  setStamina(v: number, max: number, exhausted: boolean, boosted = false, free = false): void {
    const f = Math.max(0, Math.min(1, v / max))
    const key = `${Math.round(f * 200)}|${exhausted}|${boosted}|${free}`
    if (key === this.lastStamina) return
    this.lastStamina = key
    const fill = $('stfill')
    fill.style.width = `${f * 100}%`
    fill.className = free ? 'free' : exhausted ? 'tired' : f < 0.3 ? 'low' : ''
    $('stam').classList.toggle('boost', boosted)
  }

  setScope(on: boolean): void {
    if (this.scoped === on) return
    this.scoped = on
    $('scope').classList.toggle('hidden', !on)
  }

  /** Sólo se muestran las armas que el jugador ya recogió; las demás no aparecen. */
  setWeapons(owned: Record<WeaponId, boolean>, ammo: Record<AmmoWeapon, number>, sel: WeaponId, show: boolean, hasGrenade: boolean, grenades: number, infinite = false): void {
    const key = JSON.stringify([owned, ammo, sel, show, hasGrenade, grenades, this.scoped, infinite])
    if (key === this.lastWeapons) return
    this.lastWeapons = key
    const anyGun = owned.pistol || owned.rifle || owned.shotgun || owned.sniper
    $('cross').classList.toggle('off', !anyGun || this.scoped)
    const slots = show
      ? WEAPON_ORDER.filter(id => owned[id]).map(id => {
          const w = WEAPONS[id]
          const a = id === 'pistol' || infinite ? '∞' : String(ammo[id as AmmoWeapon])
          const empty = id !== 'pistol' && !infinite && ammo[id as AmmoWeapon] <= 0
          return `<div class="slot have ${sel === id ? 'sel' : ''} ${empty ? 'empty' : ''}"><b>${w.slot} · ${w.name}</b><small>${a}</small></div>`
        })
      : []
    if (hasGrenade) {
      slots.push(`<div class="slot have grenade ${grenades <= 0 && !infinite ? 'empty' : ''}"><b>G · ${GRENADE.name}</b><small>${infinite ? '∞' : `${grenades} / ${GRENADE.max}`}</small></div>`)
    }
    $('weapons').innerHTML = slots.join('')
  }

  prompt(text: string): void {
    const el = $('prompt')
    if (el.textContent !== text) el.textContent = text
  }

  caption(text: string, ms = 2600): void {
    const el = $('caption')
    el.textContent = text
    el.classList.add('on')
    clearTimeout(this.capTimer)
    this.capTimer = window.setTimeout(() => el.classList.remove('on'), ms)
  }

  radio(text: string, ms = 5200): void {
    $('radioText').textContent = text
    $('radio').classList.add('on')
    clearTimeout(this.radioTimer)
    this.radioTimer = window.setTimeout(() => $('radio').classList.remove('on'), ms)
  }

  boss(name: string | null, frac = 1): void {
    const el = $('boss')
    el.classList.toggle('hidden', name === null)
    if (name === null) return
    $('bossName').textContent = name
    $('bossFill').style.width = `${Math.max(0, frac) * 100}%`
  }

  hitMarker(): void {
    const c = $('cross')
    c.classList.add('hit')
    setTimeout(() => c.classList.remove('hit'), 80)
  }
  hurt(v: number): void {
    $('hurt').style.opacity = String(Math.min(1, v))
  }
  fade(on: boolean): void {
    $('fade').classList.toggle('on', on)
  }

  setPlayButton(ready: boolean, text: string): void {
    const b = $<HTMLButtonElement>('btn-play')
    b.disabled = !ready
    b.textContent = text
  }
  loadHint(text: string): void {
    $('load-hint').textContent = text
  }

  deadScreen(text: string, stats: string[]): void {
    $('dead-text').textContent = text
    $('dead-stats').innerHTML = stats.map(s => `<span>${s}</span>`).join('')
    this.overlay('dead', true)
  }
  endScreen(stats: string[]): void {
    $('end-stats').innerHTML = stats.map(s => `<span>${s}</span>`).join('')
    this.overlay('end', true)
  }

  spaceDeadScreen(stats: string[]): void {
    const el = $('space-dead-stats')
    if (el) el.innerHTML = stats.map(s => `<span>${s}</span>`).join('')
    this.overlay('space-dead', true)
  }

  updateBuggyMarker(screenX: number, screenY: number, distanceM: number, visible: boolean): void {
    const el = $('buggy-marker')
    if (!el) return
    if (!visible) {
      el.classList.add('hidden')
      return
    }
    el.classList.remove('hidden')
    el.style.left = `${Math.round(screenX)}px`
    el.style.top = `${Math.round(screenY)}px`
    const num = $('buggyDstNum')
    if (num) num.textContent = `${distanceM}m`
  }

  /** Radar centrado en el jugador; arriba = hacia donde mira la cámara. */
  radar(cx: number, cy: number, yaw: number, dots: RadarDot[], range = 950): void {
    const g = this.radarCtx
    const W = 168
    const R = W / 2
    g.clearRect(0, 0, W, W)
    g.save()
    g.beginPath()
    g.arc(R, R, R - 2, 0, 7)
    g.clip()
    g.fillStyle = 'rgba(10,16,40,.62)'
    g.fillRect(0, 0, W, W)
    g.strokeStyle = 'rgba(120,200,255,.25)'
    g.lineWidth = 1
    for (const r of [R * 0.33, R * 0.66]) {
      g.beginPath()
      g.arc(R, R, r, 0, 7)
      g.stroke()
    }
    const s = (R - 6) / range
    const fx = Math.cos(yaw)
    const fy = Math.sin(yaw)
    for (const d of dots) {
      const dx = d.x - cx
      const dy = d.y - cy
      const f = dx * fx + dy * fy
      const r = -dx * fy + dy * fx
      let px = R + r * s
      let py = R - f * s
      const dd = Math.hypot(px - R, py - R)
      const edge = R - 8
      if (dd > edge) {
        if (d.kind !== 'ship' && d.kind !== 'beacon' && d.kind !== 'buggy' && d.kind !== 'lego') continue
        px = R + ((px - R) / dd) * edge
        py = R + ((py - R) / dd) * edge
      }
      switch (d.kind) {
        case 'enemy':
          g.fillStyle = '#ff4a4a'
          g.fillRect(px - 2, py - 2, 4, 4)
          break
        case 'boss':
          g.fillStyle = '#c05cff'
          g.beginPath()
          g.arc(px, py, 5, 0, 7)
          g.fill()
          break
        case 'site':
          g.fillStyle = '#ffd21f'
          g.fillRect(px - 3.5, py - 3.5, 7, 7)
          break
        case 'beacon':
          g.fillStyle = '#57f2ff'
          g.beginPath()
          g.moveTo(px, py - 5)
          g.lineTo(px + 4, py)
          g.lineTo(px, py + 5)
          g.lineTo(px - 4, py)
          g.fill()
          break
        case 'ship':
          g.fillStyle = '#3bd16f'
          g.beginPath()
          g.arc(px, py, 5.5, 0, 7)
          g.fill()
          g.strokeStyle = '#fff'
          g.lineWidth = 1.5
          g.stroke()
          break
        case 'lego':
          g.fillStyle = '#ff6ab0'
          g.beginPath()
          g.arc(px, py, 3, 0, 7)
          g.fill()
          break
        case 'pickup':
          g.fillStyle = '#9fe8ff'
          g.fillRect(px - 1.5, py - 1.5, 3, 3)
          break
        case 'fuel':
          g.fillStyle = '#ff9a2a'
          g.beginPath()
          g.moveTo(px, py - 5)
          g.lineTo(px + 4, py + 4)
          g.lineTo(px - 4, py + 4)
          g.fill()
          break
        case 'buggy':
          g.fillStyle = '#ffffff'
          g.fillRect(px - 3, py - 3, 6, 6)
          break
      }
    }
    g.restore()
    g.fillStyle = '#ffd21f'
    g.strokeStyle = '#1b1838'
    g.lineWidth = 2
    g.beginPath()
    g.moveTo(R, R - 7)
    g.lineTo(R + 5.5, R + 5)
    g.lineTo(R - 5.5, R + 5)
    g.closePath()
    g.fill()
    g.stroke()
  }
}
