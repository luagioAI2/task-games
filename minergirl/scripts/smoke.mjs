#!/usr/bin/env node
/**
 * 独立网页的冒烟测试：起一个静态服务，跑 `index.html?qa`，断言六条。
 *
 * ```bash
 * node scripts/smoke.mjs            # 默认 4392
 * PORT=4395 node scripts/smoke.mjs
 * ```
 *
 * ## 为什么要单开一个（不直接用宿主那套 e2e）
 *
 * 宿主那套验的是**插件形态**，一次跑 3~5 分钟，而且挂了以后分不清是「游戏坏了」
 * 还是「宿主集成坏了」。这一份只验游戏本体：改一行 `ui.js` 就能 20 秒看到结果。
 *
 * ## 判据为什么是「颜色种类数」而不是 innerText
 *
 * 这是 PixiJS 游戏，**整个场景画在 canvas 里**，`innerText` 恒空、DOM 里也没有按钮。
 * 用文本判据会把「渲染完好」判成失败。反过来「加载中」三个字又能骗过容器判据 ——
 * 所以只认像素：整块容器截图的颜色种类数 < 20 就是空白。
 *
 * ## headless WebGL 三件套
 *
 * `--use-gl=swiftshader` 在新版 Chrome 里已被移除，症状是**停在加载页 + 0 报错**。
 * 必须 `--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader`。
 */
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { countColors } from './lib/png-colors.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.dirname(HERE)
const HOST = path.resolve(ROOT, '..', '..', 'kid-quest-farm-2d')
const PORT = Number(process.env.PORT || 4392)
const OUT = path.join(ROOT, 'shots')
fs.mkdirSync(OUT, { recursive: true })

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp',
  '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.m4a': 'audio/mp4', '.pack': 'application/octet-stream',
}

let hits4xx = 0
const fourOhFour = []
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x')
  const p = path.resolve(ROOT, '.' + decodeURIComponent(url.pathname))
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) {
    hits4xx++
    if (fourOhFour.length < 12) fourOhFour.push(url.pathname)
    res.writeHead(404); res.end('not found'); return
  }
  res.writeHead(200, { 'content-type': MIME[path.extname(p).toLowerCase()] ?? 'application/octet-stream' })
  fs.createReadStream(p).pipe(res)
})
await new Promise((r) => server.listen(PORT, '127.0.0.1', r))

const puppeteer = (await import(pathToFileURL(path.join(HOST, 'node_modules', 'puppeteer-core', 'lib', 'puppeteer', 'puppeteer-core.js')).href)).default
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find((p) => fs.existsSync(p))
if (!CHROME) { console.error('找不到 Chrome'); process.exit(2) }

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'],
})
const page = await browser.newPage()
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 })

const pageErrors = []
const consoleErrors = []
page.on('pageerror', (e) => pageErrors.push(String(e.message).slice(0, 200)))
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 200)) })

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const checks = []
const check = (name, ok, extra = '') => { checks.push({ name, ok, extra }); console.log(`  ${ok ? '✓' : '✗'} ${name}${extra ? ' · ' + extra : ''}`) }

console.log(`\n冒烟 ${ROOT}\n→ http://127.0.0.1:${PORT}/index.html?qa\n`)

await page.goto(`http://127.0.0.1:${PORT}/index.html?qa`, { waitUntil: 'domcontentloaded', timeout: 60000 })
const ready = await page.waitForFunction('window.__gpReady === true', { timeout: 60000 }).then(() => true, () => false)
check('① 起来了（`__gpReady`）', ready)
const playable = await page.waitForFunction('window.__gpPlayable === true', { timeout: 120000 }).then(() => true, () => false)
check('② 资源加载完（`__gpPlayable`）', playable)
await sleep(1500)

// ③ 结构：根在 body 里、#app 在根里、canvas 在 #app 里
const dom = await page.evaluate(() => {
  const root = document.getElementById('mng-root')
  const app = root?.querySelector('#app')
  const stage = root?.querySelector('#stage')
  const cv = stage?.querySelector('canvas')
  const rb = root?.getBoundingClientRect()
  const sb = stage?.getBoundingClientRect()
  const cb = cv?.getBoundingClientRect()
  const r = (b) => (b ? { w: Math.round(b.width), h: Math.round(b.height) } : null)
  return {
    hasRoot: !!root, hasApp: !!app, canvases: root?.querySelectorAll('canvas').length ?? 0,
    root: r(rb), stage: r(sb), canvas: r(cb),
    css: document.querySelectorAll('style[data-mng-css]').length,
    title: document.title,
    txt: (root?.innerText || '').replace(/\s+/g, ' ').slice(0, 120),
  }
})
check('③ 结构（根 → #app → canvas）', dom.hasRoot && dom.hasApp && dom.canvases >= 1, `canvas ${dom.canvases}`)
check('③ 样式只注入了一份', dom.css === 1, `${dom.css} 份`)
// 画布必须铺满容器：差 2px 以上就说明 vw/vh 换算或 inset 出了问题
const fit = dom.stage && dom.canvas && Math.abs(dom.stage.w - dom.canvas.w) <= 2 && Math.abs(dom.stage.h - dom.canvas.h) <= 2
check('④ 画布 == 容器', !!fit, `stage ${dom.stage?.w}×${dom.stage?.h} · canvas ${dom.canvas?.w}×${dom.canvas?.h}`)

// ⑤ 像素：颜色种类数（< 20 判空白）
const png = await page.screenshot({ path: path.join(OUT, 'smoke-1.png'), clip: await page.evaluate(() => { const r = document.getElementById('mng-root').getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height } }) })
const colors = countColors(png)
check('⑤ 画面画出来了（颜色种类）', colors >= 20, `${colors} 种 · shots/smoke-1.png`)

// ⑥ 网络 / 脚本：0 个 4xx、0 个 pageerror
check('⑥ 没有 4xx/5xx', hits4xx === 0, hits4xx ? fourOhFour.join(' ') : '')
check('⑥ 没有未捕获异常', pageErrors.length === 0, pageErrors.slice(0, 2).join(' | '))
if (consoleErrors.length) console.log('    console.error:', consoleErrors.slice(0, 3).join(' | '))

console.log(`\n文字取样：${JSON.stringify(dom.txt)}\n`)

await browser.close()
server.close()

const bad = checks.filter((c) => !c.ok)
if (bad.length) { console.error(`=== 冒烟失败（${bad.length} 条）===\n`); process.exit(1) }
console.log('=== 冒烟通过 ===\n')
