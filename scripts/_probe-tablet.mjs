/**
 * 平板体检（云边小农场，独立网页形态）。
 *
 * 只量、不改。要回答的问题：
 *   · 画布 / 世界在平板尺寸下是「按比例放大」还是「被切掉」？
 *   · HUD 那一条、底部 rail、弹层，宽度分别是多少、占视口多少？
 *   · 游戏世界的关键元素（田地 / 动物）有没有跑到屏幕外或挤成一坨？
 *
 * 用法：
 *   node scripts/serve.mjs 4398
 *   node scripts/_probe-tablet.mjs [url]
 */
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { mkdirSync } from 'node:fs'

const require = createRequire(join(process.cwd(), 'noop.js'))
const puppeteer = require('E:/plan/test25/kid-quest-farm-2d/node_modules/puppeteer-core')

const URL = process.argv.find((a) => a.startsWith('http')) || 'http://127.0.0.1:4398/index.html'
const OUT = join(process.cwd(), 'shots')
mkdirSync(OUT, { recursive: true })

const SIZES = [
  { name: 'phone-390x844', width: 390, height: 844 },
  { name: 'ipad-portrait-834x1112', width: 834, height: 1112 },
  { name: 'ipad-landscape-1024x768', width: 1024, height: 768 },
  { name: 'ipad-pro-1024x1366', width: 1024, height: 1366 },
]

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})

for (const size of SIZES) {
  const page = await browser.newPage()
  await page.setViewport({ width: size.width, height: size.height, deviceScaleFactor: 1 })
  // ⚠️ 独立页的 `#app` 自己写着 `max-width: min(100vw, 100vh*0.62)`（桌面宽屏时模拟手机框）。
  //    那个框会把容器限成 476 宽，于是量到的永远不是插件的真实行为。
  //    这里去掉它，**模拟宿主的全宽容器**；最终仍要在真宿主里复核一遍。
  await page.evaluateOnNewDocument(() => {
    const s = document.createElement('style')
    s.textContent = '#app{max-width:none!important}'
    document.addEventListener('DOMContentLoaded', () => document.head.appendChild(s))
  })
  await page.goto(URL + '?rig=farm', { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForFunction('window.__farm && window.__gpPlayable', { timeout: 60000 })
  // 关引导（三层都关）
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('进入农场'))
    if (btn) btn.click()
    const g = window.__farm
    g.farm.s.onboard = 3
    document.querySelectorAll('.coach, .ring, #onboard').forEach((e) => e.remove())
    g.farm.emit({ type: 'change' })
  })
  await new Promise((r) => setTimeout(r, 1200))

  const m = await page.evaluate(() => {
    const q = (s) => document.querySelector(s)
    const box = (el) => {
      if (!el) return null
      const r = el.getBoundingClientRect()
      return { w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.left), y: Math.round(r.top) }
    }
    const canvas = q('#ui')?.parentElement?.querySelector('canvas') || q('canvas')
    const col = q('#ui .col')
    const hud = q('#ui .hud')
    const rail = q('#ui .rail')
    // 田地：从游戏里问每块地的屏幕坐标
    let plots = null
    try {
      const f = window.__farm.farm
      plots = f.s.plots.slice(0, 12).map((_, i) => {
        const p = window.__farm.plotScreen(i)
        return p ? { x: Math.round(p.x), y: Math.round(p.y) } : null
      }).filter(Boolean)
    } catch { /* 没这个 API 就算了 */ }
    return {
      vw: window.innerWidth,
      vh: window.innerHeight,
      canvas: box(canvas),
      col: box(col),
      hud: box(hud),
      rail: box(rail),
      scrollW: document.documentElement.scrollWidth,
      scrollH: document.documentElement.scrollHeight,
      plots,
      colCss: col ? { width: getComputedStyle(col).width, maxWidth: getComputedStyle(col).maxWidth } : null,
      railCss: rail ? { flexDirection: getComputedStyle(rail).flexDirection, width: getComputedStyle(rail).width } : null,
    }
  })

  const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0)
  console.log('\n=== ' + size.name + ' ===')
  console.log('  视口        ', m.vw + '×' + m.vh, '· 溢出', m.scrollW - m.vw, '×', m.scrollH - m.vh)
  console.log('  canvas      ', m.canvas ? m.canvas.w + '×' + m.canvas.h : '(无)')
  console.log('  UI 列 (.col)', m.col ? m.col.w + '×' + m.col.h + ' · 占宽 ' + pct(m.col.w, m.vw) + '%' : '(无)', m.colCss || '')
  console.log('  HUD         ', m.hud ? m.hud.w + '×' + m.hud.h : '(无)')
  console.log('  rail        ', m.rail ? m.rail.w + '×' + m.rail.h + ' @x=' + m.rail.x + ',y=' + m.rail.y : '(无)', m.railCss || '')
  if (m.plots) {
    const xs = m.plots.map((p) => p.x); const ys = m.plots.map((p) => p.y)
    console.log('  田地 12 块   x ' + Math.min(...xs) + '~' + Math.max(...xs) + ' · y ' + Math.min(...ys) + '~' + Math.max(...ys))
    const outside = m.plots.filter((p) => p.x < 0 || p.x > m.vw || p.y < 0 || p.y > m.vh).length
    console.log('  出屏的田地   ' + outside + ' / ' + m.plots.length)
  }
  await page.screenshot({ path: join(OUT, 'pad-' + size.name + '.png') })

  // 再开一次「市场」弹层量一下（平板上铺满整宽会很难看）
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('#ui button')].find((e) => (e.textContent || '').trim().includes('市场'))
    if (b) b.click()
  })
  await new Promise((r) => setTimeout(r, 900))
  const sh = await page.evaluate(() => {
    const el = document.querySelector('#ui .sheet')
    if (!el) return null
    const r = el.getBoundingClientRect()
    const grid = el.querySelector('.grid, .sh-b')
    const gr = grid ? grid.getBoundingClientRect() : null
    return {
      w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.left),
      gridW: gr ? Math.round(gr.width) : null,
      items: el.querySelectorAll('.item').length,
    }
  })
  console.log('  市场弹层    ', sh ? sh.w + '×' + sh.h + ' @x=' + sh.x + ' · 内容区 ' + sh.gridW + ' · ' + sh.items + ' 项' : '(没打开)')
  await page.screenshot({ path: join(OUT, 'pad-' + size.name + '-market.png') })
  await page.close()
}

await browser.close()
console.log('\n图在 shots/')
