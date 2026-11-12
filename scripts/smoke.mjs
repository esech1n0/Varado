// End-to-end smoke test for Varado.
// Serves dist/ via vite preview, launches headless browser, checks main menu,
// menus navigation, difficulty selection, gameplay HUD, and pause.
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { chromium } from 'playwright'

const port = 4300 + Math.floor(Math.random() * 500)
const url = `http://127.0.0.1:${port}/`
const out = process.env.SHOTS_DIR ?? 'shots'
mkdirSync(out, { recursive: true })

const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--port', String(port), '--strictPort', '--host', '127.0.0.1'], { stdio: 'ignore', detached: false })
let browser
const guard = setTimeout(() => fail('timed out after 60s'), 60_000)

function cleanup() {
  clearTimeout(guard)
  try { server.kill('SIGTERM') } catch {}
}
async function fail(msg) {
  console.error(`smoke: FAIL — ${msg}`)
  await browser?.close().catch(() => {})
  cleanup()
  process.exit(1)
}

async function waitForServer() {
  for (let i = 0; i < 60; i += 1) {
    try {
      if ((await fetch(url)).ok) return
    } catch {}
    await new Promise(r => setTimeout(r, 250))
  }
  throw new Error('preview server did not start')
}

try {
  await waitForServer()
  const args = ['--ignore-gpu-blocklist', '--use-gl=angle', '--use-angle=swiftshader']
  browser = await chromium.launch({ args }).catch(() => chromium.launch({ args, channel: 'chrome' }))
  const errors = []

  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } })
  const page = await context.newPage()

  page.on('console', m => {
    if (m.type() === 'error') {
      console.warn('Browser console error:', m.text())
      errors.push(m.text())
    }
  })
  page.on('pageerror', e => {
    console.warn('Browser page error:', e)
    errors.push(String(e))
  })
  page.on('response', r => {
    if (r.status() >= 400) errors.push(`HTTP ${r.status()} ${r.url()}`)
  })

  console.log('smoke: navigating to', url)
  await page.goto(url)
  await page.waitForSelector('#ovl-start:not(.hidden)', { timeout: 15_000 })
  await page.waitForSelector('#btn-play:not([disabled])', { timeout: 20_000 })
  await page.screenshot({ path: `${out}/01-main-menu.png` })
  console.log('smoke: main menu ready')

  // Check achievements modal
  await page.click('#btn-menu-ach')
  await page.waitForSelector('#ovl-ach:not(.hidden)')
  const achCount = await page.locator('.ach').count()
  if (achCount < 20) throw new Error(`expected >= 20 achievements rendered, got ${achCount}`)
  await page.screenshot({ path: `${out}/02-achievements.png` })
  await page.click('#btn-ach-back')
  await page.waitForSelector('#ovl-ach', { state: 'hidden' })
  console.log(`smoke: achievements modal verified (${achCount} achievements)`)

  // Check settings modal
  await page.click('#btn-menu-settings')
  await page.waitForSelector('#ovl-settings:not(.hidden)')
  await page.screenshot({ path: `${out}/03-settings.png` })
  await page.click('#btn-settings-back')
  await page.waitForSelector('#ovl-settings', { state: 'hidden' })
  console.log('smoke: settings modal verified')

  // Check skins (Aspecto) modal: 10 skins, 6 of them locked behind achievements
  await page.click('#btn-menu-skins')
  await page.waitForSelector('#ovl-skins:not(.hidden)')
  const skinCount = await page.locator('.skin-card').count()
  const lockedCount = await page.locator('.skin-card.locked').count()
  if (skinCount !== 10 || lockedCount !== 6) throw new Error(`expected 10 skins / 6 locked, got ${skinCount} / ${lockedCount}`)
  await page.click('.skin-card[data-skin="blue"]')
  await page.waitForSelector('.skin-card.sel[data-skin="blue"]')
  await page.screenshot({ path: `${out}/03b-skins.png` })
  await page.click('#btn-skins-back')
  await page.waitForSelector('#ovl-skins', { state: 'hidden' })
  console.log('smoke: skins modal verified')

  // Click JUGAR to open difficulty selection
  await page.click('#btn-play')
  await page.waitForSelector('#ovl-diff:not(.hidden)')
  await page.screenshot({ path: `${out}/04-difficulty.png` })
  console.log('smoke: difficulty modal verified')

  // Select Normal difficulty
  await page.click('button[data-diff="normal"]')

  // Intro comic panels: advance through the five panels, then the game starts
  await page.waitForSelector('#intro:not(.hidden)')
  await page.waitForTimeout(1200)
  await page.screenshot({ path: `${out}/04b-intro.png` })
  for (let i = 0; i < 5; i += 1) {
    await page.waitForTimeout(450)
    await page.keyboard.press('Space')
  }
  await page.waitForSelector('#hud:not(.hidden)', { timeout: 10_000 })
  console.log('smoke: HUD active')

  // Wait for wake-up sequence (2s black + 2.4s eyelid opening)
  await page.waitForTimeout(4600)

  // Simulate gameplay input
  await page.keyboard.down('KeyW')
  await page.waitForTimeout(600)
  await page.keyboard.up('KeyW')
  await page.screenshot({ path: `${out}/05-gameplay.png` })

  // Pause
  await page.keyboard.press('KeyP')
  await page.waitForSelector('#ovl-pause:not(.hidden)')
  await page.screenshot({ path: `${out}/06-pause.png` })
  console.log('smoke: pause verified')

  // Resume
  await page.click('#btn-resume')
  await page.waitForSelector('#ovl-pause', { state: 'hidden' })
  console.log('smoke: resume verified')

  if (errors.length > 0) {
    throw new Error(`Errors during smoke test:\n${errors.join('\n')}`)
  }

  console.log('smoke: SUCCESS — all checks passed cleanly!')
  await browser.close()
  cleanup()
  process.exit(0)
} catch (e) {
  await fail(e instanceof Error ? e.message : String(e))
}
