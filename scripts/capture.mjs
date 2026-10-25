#!/usr/bin/env node
/**
 * 拍商城详情页要用的截图（`shots/*.png`，9:16 竖屏，2× DPR）。
 *
 * ```bash
 * node scripts/capture.mjs            # 全拍一遍
 * node scripts/capture.mjs --only 3   # 只补第 3 张
 * ```
 *
 * ## 为什么必须按坐标点
 *
 * 这游戏的 UI **全部是 PixiJS 画进 canvas 的**：DOM 里一个 button 都没有，
 * `page.click('button')` 永远找不到。所以这里用设计坐标 → 屏幕坐标换算：
 * 设计稿 420×800 等比缩放居中，`screen = origin + design * scale`。
 *
 * ★ 换算写死在 `DESIGN` 常量里，**不要手调像素**：手调的坐标在改了视口之后
 *   会静默点到空白处（截图里还是上一屏），而且不会报错。
 *
 * ## 「现在在哪一屏」不要靠猜
 *
 * 语言选择页和标题页的 `phase` 都是 `PHASE.Title`，靠 phase 分不开。
 * 判据用 `__debug.lang()`：空串 = 还没选语言 = 语言选择页。
 * 猜错的后果是**静默点空**，然后拍下一张的时候画面还是上一屏。
 *
 * ## 拍完要自己看图
 *
 * 结构断言只能证明「文件存在、尺寸对」，证明不了「这一屏是不是我想拍的那一屏」。
 * 2026-10-25 就吃过这个亏：一张「加载中」的图看着也像正常的奶油底页面。
 */
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.dirname(HERE)
const OUT = path.join(ROOT, 'shots')
const PORT = Number(process.env.SUGAR_SHOT_PORT || 4403)

const VW = 390
const VH = 844
/** 游戏内部设计尺寸（`game.js` 的 W / H） */
const DW = 420
const DH = 800

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.json': 'application/json', '.css': 'text/css', '.webp': 'image/webp',
  '.png': 'image/png', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4',
  '.woff2': 'font/woff2', '.pack': 'application/octet-stream',
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x')
  let p = path.join(ROOT, decodeURIComponent(url.pathname))
  // `/` 是目录 —— 必须落到 index.html。漏了这一步的话页面根本打不开，
  // 而症状是「等 __debug 超时」，看着像游戏没起来。
  if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, 'index.html')
  if (!p.startsWith(ROOT) || !fs.existsSync(p)) {
    res.writeHead(404)
    res.end('not found')
    return
  }
  res.writeHead(200, { 'content-type': MIME[path.extname(p).toLowerCase()] ?? 'application/octet-stream' })
  fs.createReadStream(p).pipe(res)
})
await new Promise((r) => server.listen(PORT, '127.0.0.1', r))

const puppeteer = await (async () => {
  const cands = [
    'puppeteer-core',
    path.join(ROOT, '..', '..', 'kid-quest-farm-2d', 'node_modules', 'puppeteer-core', 'lib', 'puppeteer', 'puppeteer-core.js'),
  ]
  for (const c of cands) {
    try {
      return (await import(c.startsWith('puppeteer') ? c : pathToFileURL(c).href)).default
    } catch {
      /* 下一个 */
    }
  }
  throw new Error('找不到 puppeteer-core')
})()
const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find((p) => fs.existsSync(p))

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    '--autoplay-policy=no-user-gesture-required'],
})
const page = await browser.newPage()
await page.setViewport({ width: VW, height: VH, deviceScaleFactor: 2 })

const scale = Math.min(VW / DW, VH / DH)
const ox = (VW - DW * scale) / 2
const oy = (VH - DH * scale) / 2
const at = (dx, dy) => [Math.round(ox + dx * scale), Math.round(oy + dy * scale)]

const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const tap = async (dx, dy) => {
  const [x, y] = at(dx, dy)
  await page.mouse.click(x, y)
  await wait(900)
}
const shot = async (name) => {
  fs.mkdirSync(OUT, { recursive: true })
  const p = path.join(OUT, name + '.png')
  await page.screenshot({ path: p })
  console.log(`  ${path.relative(ROOT, p)}  ${(fs.statSync(p).size / 1024).toFixed(0)} KB`)
}

const only = (() => {
  const i = process.argv.indexOf('--only')
  return i > 0 ? Number(process.argv[i + 1]) : null
})()
const want = (n) => only === null || only === n

const bad = []
page.on('response', (r) => { if (r.status() >= 400 && !/favicon/.test(r.url())) bad.push(`${r.status()} ${r.url()}`) })
page.on('pageerror', (e) => bad.push('PAGEERROR ' + String(e.message).slice(0, 120)))

/** 加载并停在「标题页」。语言选择页会自动选中文。 */
async function bootToTitle() {
  await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'networkidle2', timeout: 60000 })
  await page.waitForFunction('window.__debug && window.__gpReady === true', { timeout: 60000 })
  await wait(2500)
  const lang = await page.evaluate(() => window.__debug.lang())
  if (!lang) {
    await tap(210, 330) // 语言选择页的「中文」
    await wait(1800)
  }
  const phase = await page.evaluate(() => window.__debug.state().phase)
  if (phase !== 0) throw new Error(`没停在标题页（phase=${phase}）`)
}

console.log(`\n服务 ${ROOT}\n→ http://127.0.0.1:${PORT}/\n`)

if (want(1)) {
  await bootToTitle()
  await shot('01-title')
}

if (want(2)) {
  if (!want(1)) await bootToTitle()
  await tap(210, 632) // 标题页第二行第二格「角色进化」
  await wait(2000)
  await shot('02-evolve')
}

if (want(3)) {
  if (!want(1) && !want(2)) await bootToTitle()
  else await bootToTitle()
  await tap(99, 632) // 标题页第二行第一格「选择关卡」
  await wait(2000)
  await shot('03-map')
}

if (want(4)) {
  await bootToTitle()
  await tap(210, 532) // 开始游戏
  await wait(2200)
  // 剧情 / 教学：连点推进（点按继续在下方）
  for (let i = 0; i < 8; i++) await tap(210, 700)
  await wait(2500)
  // 开局那一次教学气泡会盖住敌人血条 —— 点两下让它走完，拍到的才是「纯玩法」
  await tap(210, 239)
  await tap(210, 239)
  await wait(1800)
  const st = await page.evaluate(() => window.__debug.state())
  if (st.phase === 0) throw new Error('还在标题页 —— 「开始游戏」没点中')
  await shot('04-board')
}

await browser.close()
server.close()

if (bad.length) {
  console.error('\n有问题：')
  for (const b of bad.slice(0, 6)) console.error('  -', b)
  process.exit(1)
}
console.log('\n✓ 拍完（自己看一眼图，结构断言证明不了「拍的是那一屏」）\n')
