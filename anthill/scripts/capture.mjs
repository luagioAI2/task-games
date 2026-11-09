#!/usr/bin/env node
/**
 * 走查截图 —— 商城详情页的图就来自这里（`shots/*.png` → `build-store-shots.py` 的 PLAN）。
 *
 * ```bash
 * node scripts/capture.mjs            # 出 4 张到 shots/
 * ```
 *
 * ## 为什么用 DOM 按钮而不是按坐标点
 *
 * 这游戏的 UI 是 **DOM**（`#shopBtn` / `#setBtn` / 卡片都是真 `<button>`），
 * 只有 3D 场景在 canvas 里。所以不需要 sugar 那套「按 420×800 设计空间换算坐标」——
 * 直接对按钮派发 `pointerdown` 就行（游戏监听的是 pointerdown，不是 click）。
 *
 * ## 判据
 *
 * 每张图都要**颜色种类 ≥ 20**（纯色 = 没画出来）。这条用合成后的截图算，
 * 不能用 `drawImage(glCanvas)`（`preserveDrawingBuffer: false` ⇒ 恒为空白）。
 */
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { countColors } from './lib/png-colors.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.dirname(HERE)
const PORT = Number(process.env.ANTHILL_SHOT_PORT || 4404)
const OUT = path.join(ROOT, 'shots')

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.json': 'application/json', '.css': 'text/css', '.png': 'image/png',
  '.svg': 'image/svg+xml', '.m4a': 'audio/mp4', '.mp3': 'audio/mpeg',
  '.glb': 'model/gltf-binary', '.pack': 'application/octet-stream',
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x')
  const p = path.join(ROOT, decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname))
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) {
    res.writeHead(404)
    res.end('not found')
    return
  }
  res.writeHead(200, { 'content-type': MIME[path.extname(p).toLowerCase()] ?? 'application/octet-stream' })
  fs.createReadStream(p).pipe(res)
})
await new Promise((r) => server.listen(PORT, '127.0.0.1', r))

const puppeteer = await (async () => {
  for (const c of ['puppeteer-core', path.join(ROOT, '..', '..', 'kid-quest-farm-2d', 'node_modules', 'puppeteer-core', 'lib', 'puppeteer', 'puppeteer-core.js')]) {
    try {
      return (await import(c.startsWith('puppeteer') ? c : pathToFileURL(c).href)).default
    } catch { /* 下一个 */ }
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
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

fs.mkdirSync(OUT, { recursive: true })
const fails = []
const shot = async (name, label) => {
  await sleep(700)
  const file = path.join(OUT, `${name}.png`)
  const colors = countColors(await page.screenshot({ path: file }))
  const ok = colors >= 20
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name}.png · 颜色 ${colors} · ${label}`)
  if (!ok) fails.push(`${name}（颜色 ${colors}）`)
}

const tap = (sel) =>
  page.evaluate((s) => {
    const el = document.querySelector(s)
    if (!el) return false
    el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    return true
  }, sel)

await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'domcontentloaded', timeout: 60000 })
await page.waitForFunction('window.__gpPlayable === true', { timeout: 60000 }).catch(() => {})
await sleep(2500)

console.log('\n走查截图：')
await shot('01-main', '首屏：花园草地，蚂蚁在搬叶子')

// 商店：特殊蚂蚁（兵蚁 / 大力蚁 / 金蚁）
if (!(await tap('#shopBtn'))) console.log('  ! 找不到 #shopBtn')
await shot('02-shop', '商店：三种特殊蚂蚁和价格')

// 关掉商店 → 设置
await tap('#modal [data-close]')
await sleep(500)
if (!(await tap('#setBtn'))) console.log('  ! 找不到 #setBtn')
await shot('03-settings', '设置：语言 / 音乐 / 音效')

await tap('#modal [data-close]')
await sleep(500)

// 第 2 世界（野餐垫）：走 nextWorld（和真通关同一条路径）。
// ⚠️ 只调**一次**：`S.world` 从 0 起算，0 = 世界 1，调一次就是世界 2。
//    调两次会到「世界 3 · 厨房台面」—— 图对、说明错，而断言看不出来（踩过一次）。
await page.evaluate(() => window.__ant.nextWorld())
await sleep(2500)
await shot('04-world2', '第 2 世界「野餐垫」：地面和食物都换了')

const state = await page.evaluate(() => ({ world: window.__ant.S.world, items: window.__ant.items.length }))
console.log(`\n状态：world=${state.world} · items=${state.items}`)

await browser.close()
server.close()
console.log(fails.length ? `\n✗ ${fails.length} 张不达标：${fails.join(' / ')}\n` : '\n✓ 4 张都画出来了\n')
process.exit(fails.length ? 1 : 0)
