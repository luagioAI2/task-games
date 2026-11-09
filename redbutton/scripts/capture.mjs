/**
 * 抓商城详情页要用的 4 张图（独立网页形态，390×844 @2x）。
 *
 *   node scripts/capture.mjs
 *
 * 产出 `screenshots/store-1..4.png` —— **必须放这里**（`shots/` 被 gitignore 了，
 * 而 `build-store-shots.py` 的源图必须在已入库的目录里，否则那 4 张图的唯一来源
 * 没有版本控制，清一次就再也生成不出来，且不报错）。
 *
 * ★ 顺序按「家长/孩子点进详情页会怎么读」排：
 *   ① 这是什么（标题 + 那颗大红按钮）
 *   ② 玩起来是什么样（连击 + 宝箱 + 金币）
 *   ③ 有什么可买的（升级面板）
 *   ④ 能收集什么（扭蛋机 / 图鉴）
 */
import { createServer } from 'node:http'
import { readFile, access, mkdir } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'
import { pathToFileURL } from 'node:url'

const ROOT = process.cwd()
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.pack': 'application/octet-stream' }

const srv = createServer(async (req, res) => {
  try {
    const p = normalize(decodeURIComponent(req.url.split('?')[0]))
    // ★ normalize('/') 在 Windows 上是 '\\' ⇒ 只判 '/' 会让根路径走到盘符，静默 404
    const rel = p === '/' || p === '\\' ? 'index.html' : p.replace(/^[\\/]+/, '')
    const buf = await readFile(join(ROOT, rel))
    res.writeHead(200, { 'content-type': MIME[extname(rel)] || 'application/octet-stream' })
    res.end(buf)
  } catch {
    res.writeHead(404).end('404')
  }
})
await new Promise((r) => srv.listen(4403, '127.0.0.1', r))

const puppeteer = (await import(pathToFileURL('E:/plan/test25/kid-quest-farm-2d/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js').href)).default
let exe = ''
for (const c of ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe']) {
  try { await access(c); exe = c; break } catch { /* 下一个 */ }
}
if (!exe) throw new Error('找不到 Chrome / Edge')

const browser = await puppeteer.launch({ executablePath: exe, headless: true, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--force-device-scale-factor=2'] })
const page = await browser.newPage()
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 })
const errs = []
page.on('pageerror', (e) => errs.push(e.message))
page.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text()) })
page.on('requestfailed', (r) => errs.push('404? ' + r.url()))
page.on('response', (r) => { if (r.status() >= 400) console.log('  HTTP', r.status(), r.url()) })

await mkdir('screenshots', { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const shot = async (name) => {
  await page.screenshot({ path: `screenshots/${name}` })
  console.log('  拍', name)
}
const state = () => page.evaluate(() => (window.__redbutton ? window.__redbutton.state() : null))

await page.goto('http://127.0.0.1:4403/', { waitUntil: 'networkidle2' })
await sleep(3500)
await shot('store-1.png')

// ② 按 60 下：连击数 + 掉两个宝箱 + 金币上三位数
for (let i = 0; i < 60; i++) {
  await page.evaluate(() => window.__redbutton.press())
  await sleep(45)
}
/*
 * ★ 先等 2.6 秒让「升级！技能点 +1」的 toast 自己淡出，再快速补 12 下：
 *   连击文字只在按键后 1.2 秒内显示，所以**必须在最后一按下之后立刻截图**，
 *   不能 sleep。等太久 → 没有连击；不等 → 截图被 toast 压住。
 */
await sleep(2600)
for (let i = 0; i < 12; i++) {
  await page.evaluate(() => window.__redbutton.press())
  await sleep(35)
}
console.log('  按完 72 下', JSON.stringify(await state()))
await shot('store-2.png')

// ③ 升级面板：先买几次「指尖力量」，让等级不是 Lv0
await page.evaluate(() => document.querySelector('#ui .tabs .tab[data-tab="up"]')?.click())
await sleep(500)
for (let i = 0; i < 6; i++) {
  /*
   * ★★ 必须用**真鼠标**（`page.click` 会派 pointerdown/pointerup）：
   *   面板的按钮是 `pointerdown` 记目标、`window.pointerup` 才触发（见 ui.js 的
   *   `downEl` / `end()`），所以 `el.click()` 派的那一个 click 事件**完全没反应**，
   *   而且不报错 —— 症状就是「点了 6 次，等级还是 Lv0」。
   */
  const sel = '#ui #shBody [data-a="up"]'
  const found = await page.$(sel)
  if (!found) break
  await page.click(sel)
  await sleep(180)
}
await sleep(600)
await shot('store-3.png')

// ④ 扭蛋机
await page.evaluate(() => document.querySelector('#ui .tabs .tab[data-tab="gacha"]')?.click())
await sleep(700)
await shot('store-4.png')

console.log('  状态', JSON.stringify(await state()))
console.log('  报错', errs.length ? JSON.stringify(errs.slice(0, 8), null, 1) : '无')
await browser.close()
srv.close()
