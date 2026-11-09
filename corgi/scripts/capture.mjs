#!/usr/bin/env node
/**
 * 拍商城详情页要用的 4 张图（`public/store/corgi/1..4.webp` 的源图）。
 *
 * ```bash
 * CODEBUDDY_SAFE_DELETE_ENABLED=0 node scripts/build-plugin.mjs && node scripts/capture.mjs
 * python ../kid-quest-farm-2d/scripts/build-store-shots.py
 * ```
 *
 * ## 为什么拍「插件形态」而不是独立网页
 *
 * 孩子看到的是**宿主里那一块容器**，不是整页。独立网页的截图会把 390×844
 * 全给游戏，而宿主里上面有顶栏、下面有底栏 —— 图比实物好看，等于骗人。
 * 所以这里用假宿主（和 `mount-test.mjs` 同一套壳），只截**容器那一块**。
 *
 * ## 顺序按「先看它是什么 → 再看能玩出什么」
 *
 * 1. 标题：柯基 + 云朵 + 「开始玩」
 * 2. 主界面：花园里的柯基 + 升级卡片（这一款的核心玩法）
 * 3. 衣橱：换装（说明有内容可收集）
 * 4. 图鉴：7 种毛色（说明养下去能解锁什么）
 *
 * ⚠️ 第 2 张必须**先给爱心**（`setSeed(-201)`）：新档的卡片全是灰的，
 *    拍出来像「什么都买不起」。给完爱心卡片才会亮起来。
 * ⚠️ 第 3 张要先**把装扮塞进衣柜**（`setSeed(-10-id)` 会把该件设为已拥有并穿上），
 *    否则衣柜是空的 —— 那是「没有内容」，不是「内容还没解锁」。
 * ⚠️ 每次动作后要等**补间跑完**：headless 里游戏时钟比墙上时钟慢约 7×，
 *    固定 sleep 会拍到动画中间（卡片还在飞、柯基还在转身）。
 */
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.dirname(HERE)
const PORT = Number(process.env.CORGI_CAPTURE_PORT || 4423)
const OUT = path.join(ROOT, 'shots')

const BUNDLE = path.join(ROOT, 'dist-plugin', 'corgi.plugin.mjs')
if (!fs.existsSync(BUNDLE)) {
  console.error('还没打包：CODEBUDDY_SAFE_DELETE_ENABLED=0 node scripts/build-plugin.mjs')
  process.exit(2)
}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.json': 'application/json', '.css': 'text/css', '.png': 'image/png',
  '.webp': 'image/webp', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.m4a': 'audio/mp4', '.mp3': 'audio/mpeg', '.pack': 'application/octet-stream',
  '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.wasm': 'application/wasm',
}

const PAGE = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">
<style>html,body{margin:0;height:100%;background:#2b2b2b}
#shell{position:absolute;inset:0;display:flex;flex-direction:column}
#top{height:56px;background:#3a3a3a;flex:none}
#page{position:relative;flex:1;min-height:0}
#stage{position:absolute;inset:0}
#tabs{height:64px;background:#3a3a3a;flex:none}</style>
</head><body>
<div id="shell"><div id="top"></div><div id="page"><div id="stage"></div></div><div id="tabs"></div></div>
<script type="module">
const c = document.getElementById('stage')
const store = new Map()
const host = {
  balance: () => 999, spendPoints: async () => true,
  mintGameCoin: async () => {}, spendGameCoin: async () => false, redeemGameCoin: async () => 0,
  mintVoucher: async () => 0, buyGameCoin: async () => false, gameCoinBalance: async () => 0,
  storage: { get: async (k) => store.get(k), set: async (k, v) => { if (v === null) store.delete(k); else store.set(k, v) }, list: async () => Object.fromEntries(store) },
  pushToast: () => {}, haptic: () => {}, tone: () => {},
}
const ctx = { assetBase: '/', assetUrl: (rel) => '/' + rel, locale: 'zh' }
const mod = await import('/dist-plugin/corgi.plugin.mjs')
window.__unmount = await mod.mount(c, host, ctx)
window.__container = c
window.__ready = true
</script></body></html>`

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x')
  if (url.pathname === '/__cap.html') {
    res.writeHead(200, { 'content-type': MIME['.html'] })
    res.end(PAGE)
    return
  }
  const p = path.resolve(ROOT, '.' + decodeURIComponent(url.pathname))
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) {
    res.writeHead(404)
    res.end('not found')
    return
  }
  res.writeHead(200, { 'content-type': MIME[path.extname(p).toLowerCase()] ?? 'application/octet-stream' })
  fs.createReadStream(p).pipe(res)
})
await new Promise((r) => server.listen(PORT, '127.0.0.1', r))

const puppeteer = (await import(pathToFileURL(
  path.join(ROOT, '..', '..', 'kid-quest-farm-2d', 'node_modules', 'puppeteer-core', 'lib', 'puppeteer', 'puppeteer-core.js'),
).href)).default
const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
].find((p) => fs.existsSync(p))

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    '--autoplay-policy=no-user-gesture-required'],
})
const page = await browser.newPage()
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 })

const pageErrors = []
page.on('pageerror', (e) => pageErrors.push(String(e.message).slice(0, 200)))

await page.goto(`http://127.0.0.1:${PORT}/__cap.html?playtest`, { waitUntil: 'networkidle2', timeout: 90000 })
await page.waitForFunction('window.__ready === true', { timeout: 90000 })
await page.waitForFunction('window.__gpPlayable === true', { timeout: 180000 })
await new Promise((r) => setTimeout(r, 2500))

const stage = await page.$('#stage')
const shot = async (name) => {
  const f = path.join(OUT, name)
  await stage.screenshot({ path: f })
  const kb = (fs.statSync(f).size / 1024).toFixed(0)
  console.log(`  拍好 ${name}  ${kb} KB`)
}

/** 等补间跑完（判据是状态，不是固定 sleep） */
const settle = async (ms = 2200) => {
  await new Promise((r) => setTimeout(r, ms))
}

// ---- 1) 标题 ----
await shot('01-title.png')

// ---- 2) 主界面 ----
await page.evaluate(() => {
  const b = window.__MAKEPLAY_PLAYTEST__
  b.start()
})
await settle(1800)
await page.evaluate(() => {
  const b = window.__MAKEPLAY_PLAYTEST__
  b.setSeed(-201) // gain(1e7)：卡片才会亮起来
  b.tab(0)
})
await settle(2600)
await shot('02-garden.png')

// ---- 3) 衣橱 ----
await page.evaluate(() => {
  const b = window.__MAKEPLAY_PLAYTEST__
  // 给一批装扮（-10-id = 设为已拥有并立刻穿上，正面视图）。
  // ★ **不能给 4~7**：那四件是「上衣」分类下架后的占位（`gone: true`，没有 `st`），
  //   `applyWear` 会读 `WEAR[id].st.l` ⇒ `Cannot read properties of undefined (reading 'l')`。
  //   同理 11（`cx5`）只有 `wing: true`，这里也跳过。
  for (const id of [0, 1, 2, 3, 8, 9, 10, 12, 13, 14]) b.setSeed(-10 - id)
  b.tab(2)
})
await settle(3200)
await shot('03-closet.png')

// ---- 4) 图鉴 ----
await page.evaluate(() => {
  const b = window.__MAKEPLAY_PLAYTEST__
  b.setSeed(-4) // grantRare(3..6)：解锁 4 种稀有毛色
  b.tab(1)
})
await settle(3000)
await shot('04-collection.png')

await browser.close()
server.close()

if (pageErrors.length) {
  console.log('\npageerror：')
  for (const e of pageErrors.slice(0, 5)) console.log('  · ' + e)
}
console.log('\n下一步：python ../kid-quest-farm-2d/scripts/build-store-shots.py')
