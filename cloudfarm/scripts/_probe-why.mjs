import { createRequire } from 'node:module'
import { join } from 'node:path'
const require = createRequire(join(process.cwd(), 'noop.js'))
const puppeteer = require('E:/plan/test25/kid-quest-farm-2d/node_modules/puppeteer-core')

const b = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: 'new',
  args: ['--no-sandbox', '--enable-unsafe-swiftshader'],
})
const p = await b.newPage()
await p.setViewport({ width: 1024, height: 768, deviceScaleFactor: 1 })
await p.goto('http://127.0.0.1:4398/index.html?rig=farm', { waitUntil: 'domcontentloaded' })
await p.waitForFunction('window.__farm && window.__gpPlayable', { timeout: 60000 })
await new Promise((r) => setTimeout(r, 1500))
const d = await p.evaluate(() => {
  const col = document.querySelector('#ui .col')
  return {
    innerW: window.innerWidth,
    innerH: window.innerHeight,
    outerW: window.outerWidth,
    dpr: window.devicePixelRatio,
    visualW: window.visualViewport ? Math.round(window.visualViewport.width) : null,
    colInline: col ? col.style.width : null,
    colRect: col ? Math.round(col.getBoundingClientRect().width) : null,
    colCss: col ? getComputedStyle(col).width : null,
    metaViewport: document.querySelector('meta[name=viewport]')?.content ?? '(none)',
    landscapeExpr: window.innerWidth > window.innerHeight * 1.05,
    expectBySection: Math.round(window.innerHeight * 0.87),
    expectByPortrait: Math.round(window.innerHeight * 0.62),
  }
})
const served = await p.evaluate(async () => {
  const t = await (await fetch('/src/ui.js')).text()
  return { hasBySection: t.includes('bySection'), hasOldFormula: t.includes('Math.min(600, vh * 0.62)') }
})
console.log(JSON.stringify({ ...d, served }, null, 2))
await b.close()
