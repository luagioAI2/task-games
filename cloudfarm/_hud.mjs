import { createRequire } from 'node:module'
import { join } from 'node:path'
const require = createRequire(join(process.cwd(), 'noop.js'))
const puppeteer = require('E:/plan/test25/kid-quest-farm-2d/node_modules/puppeteer-core')
const b = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: 'new',
  args: ['--no-proxy-server','--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'],
})
const p = await b.newPage()
await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
await p.goto('http://127.0.0.1:4397/index.html', { waitUntil: 'domcontentloaded' })
await p.waitForFunction('window.__gpPlayable === true', { timeout: 60000 })
await new Promise(r => setTimeout(r, 1200))
await p.evaluate(() => { document.querySelector('#ui .topbar')?.closest('#ui')?.classList.remove('hidden') })
const el = await p.$('#ui .topbar')
await el.screenshot({ path: 'screenshots/_hud-topbar.png' })
const box = await p.evaluate(() => {
  const bar = document.querySelector('#ui .topbar')
  const r = (s) => { const e = bar.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.right), Math.round(b.width), Math.round(b.height)] }
  return JSON.stringify({
    bar: [Math.round(bar.getBoundingClientRect().width), Math.round(bar.getBoundingClientRect().height)],
    lv: r('.lv'), harv: r('#hp'), spacer: r('.spacer'), log: r('#logBtn'), set: r('#setBtn'),
    sub: (() => { const s = document.querySelector('#ui .subbar .seg'); const b = s.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.right), Math.round(b.width)] })(),
  }, null, 1)
})
console.log(box)
await b.close()
