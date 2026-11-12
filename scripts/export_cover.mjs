import { chromium } from 'playwright'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const srcPath = 'C:/Users/Edson/.gemini/antigravity/brain/1b3995c5-9f68-43fc-bb6c-1b7f56d6a007/varado_game_cover_art_1794464460688.jpg'
const imgBuffer = readFileSync(srcPath)
const base64Img = `data:image/jpeg;base64,${imgBuffer.toString('base64')}`

const htmlContent = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      width: 630px;
      height: 500px;
      overflow: hidden;
      background: #05050e;
    }
    .cover-container {
      width: 630px;
      height: 500px;
      position: relative;
      overflow: hidden;
    }
    .cover-img {
      width: 630px;
      height: 500px;
      object-fit: cover;
      object-position: center 48%;
      display: block;
    }
  </style>
</head>
<body>
  <div class="cover-container">
    <img class="cover-img" src="${base64Img}" alt="VARADO Cover Art" />
  </div>
</body>
</html>
`

async function main() {
  const args = ['--ignore-gpu-blocklist', '--use-gl=angle', '--use-angle=swiftshader']
  const browser = await chromium.launch({ args }).catch(() => chromium.launch({ args, channel: 'chrome' }))
  const context = await browser.newContext({
    viewport: { width: 630, height: 500 },
    deviceScaleFactor: 1, // exact 630x500
  })
  const page = await context.newPage()
  await page.setContent(htmlContent)
  await page.waitForLoadState('networkidle')

  const outTargets = [
    resolve('cover.png'),
    resolve('cover.jpg'),
    resolve('public/cover.png'),
    'C:/Users/Edson/.gemini/antigravity/brain/1b3995c5-9f68-43fc-bb6c-1b7f56d6a007/cover_630x500.png',
    'C:/Users/Edson/.gemini/antigravity/brain/1b3995c5-9f68-43fc-bb6c-1b7f56d6a007/cover_630x500.jpg',
  ]

  const pngBuf = await page.screenshot({ type: 'png' })
  const jpgBuf = await page.screenshot({ type: 'jpeg', quality: 95 })

  for (const target of outTargets) {
    if (target.endsWith('.png')) {
      writeFileSync(target, pngBuf)
      console.log(`Saved PNG (630x500) to: ${target}`)
    } else if (target.endsWith('.jpg')) {
      writeFileSync(target, jpgBuf)
      console.log(`Saved JPG (630x500) to: ${target}`)
    }
  }

  await browser.close()
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
