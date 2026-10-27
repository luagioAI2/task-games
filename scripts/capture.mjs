#!/usr/bin/env node
/**
 * 拍商城详情页要用的 4 张图（`public/store/blockfit/1..4.webp` 的源图）。
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
 * ## 顺序按「先看它是什么 → 再看怎么玩」
 *
 * 1. 标题（是什么）2. 对局中（怎么玩）3. 题目列表（有多少内容）4. 过关结算（玩完得到什么）
 *
 * ⚠️ 对局中那张**必须真的摆上几块**：只点进第一题截到的是空棋盘，
 *    家长看不出这是个「把拼片塞进方框」的游戏。
 */
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.dirname(HERE)
const PORT = Number(process.env.BLOCKFIT_CAPTURE_PORT || 4411)

const BUNDLE = path.join(ROOT, 'dist-plugin', 'blockfit.plugin.mjs')
if (!fs.existsSync(BUNDLE)) {
  console.error('还没打包：CODEBUDDY_SAFE_DELETE_ENABLED=0 node scripts/build-plugin.mjs')
  process.exit(2)
}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.json': 'application/json', '.css': 'text/css', '.png': 'image/png',
  '.webp': 'image/webp', '.svg': 'image/svg+xml', '.m4a': 'audio/mp4', '.mp3': 'audio/mpeg',
  '.pack': 'application/octet-stream', '.wasm': 'application/wasm',
}

const PAGE = `<!doctype html><html><head><meta charset="utf-8">
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
  balance: () => 9999,
  spendPoints: async () => true,
  mintGameCoin: async () => {},
  spendGameCoin: async () => false,
  redeemGameCoin: async () => 0,
  mintVoucher: async () => 0,
  buyGameCoin: async () => false,
  gameCoinBalance: async () => 0,
  storage: {
    get: async (k) => store.get(k),
    set: async (k, v) => { if (v === null) store.delete(k); else store.set(k, v) },
    list: async () => Object.fromEntries(store),
  },
  pushToast: () => {}, haptic: () => {}, tone: () => {},
}
const ctx = { assetBase: '/dist-plugin/', assetUrl: (rel) => '/dist-plugin/' + rel, locale: 'zh' }
const mod = await import('/dist-plugin/blockfit.plugin.mjs')
window.__store = store
window.__unmount = await mod.mount(c, host, ctx)
window.__mount = async () => { window.__unmount = await mod.mount(c, host, ctx) }
window.__ready = true
</script></body></html>`

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x')
  if (url.pathname === '/__capture.html') {
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
// DPR 2：详情页是 9:16 的窄图，1x 在平板上会糊
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 })
page.on('pageerror', (e) => console.log('  ! pageerror:', String(e.message).slice(0, 120)))

const OUT = path.join(ROOT, 'shots')
fs.mkdirSync(OUT, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const box = async () => page.evaluate(() => {
  const r = document.getElementById('stage').getBoundingClientRect()
  return { x: r.x, y: r.y, width: r.width, height: r.height }
})
const shot = async (name) => {
  const p = path.join(OUT, name)
  await page.screenshot({ path: p, clip: await box() })
  console.log('  出图', path.relative(ROOT, p))
}
/** 轮询游戏状态（★ headless 只有 4~6 fps，游戏时钟比墙上时钟慢约 7×，绝不能 sleep 固定值） */
const waitState = async (fn, label, timeout = 60000) => {
  const t0 = Date.now()
  while (Date.now() - t0 < timeout) {
    if (await page.evaluate(fn)) return true
    await sleep(250)
  }
  console.log(`  ! 等超时：${label}`)
  return false
}

const boot = async () => {
  await page.goto(`http://127.0.0.1:${PORT}/__capture.html`, { waitUntil: 'networkidle2', timeout: 60000 })
  await page.waitForFunction('window.__ready === true', { timeout: 60000 })
  await page.waitForFunction('window.__gpPlayable === true', { timeout: 120000 }).catch(() => {})
  await sleep(1200)
}

console.log(`\n拍图 ${ROOT}\n→ http://127.0.0.1:${PORT}/__capture.html\n`)

/* ① 标题 */
await boot()
await shot('01-title.png')

/* ② 对局中：真摆上几块（空棋盘看不出玩法） */
console.log('  进第 1 题…')
await page.evaluate(() => window.__debug.start(0))
await waitState(() => window.__debug.state.scene === 'play', '进对局')
await sleep(900)
// 摆 2 块：棋盘上有了实心色块、托盘里还剩两块，一眼看出「把拼片塞进方框」
for (let i = 0; i < 2; i++) {
  await page.evaluate(() => window.__debug.solveStep())
  await sleep(700)
}
await shot('02-play.png')

/* ③ 题目列表：解完这一题，第 1 张卡上才会有印章 */
console.log('  解完第 1 题…')
await page.evaluate(async () => {
  for (let i = 0; i < 40; i++) {
    if (!window.__debug.solveStep()) break
    await new Promise((r) => setTimeout(r, 80))
  }
})
await waitState(() => window.__debug.state.solved === true, '解开')
// ★ 过关面板是 `after(1.4)` 之后的补间 —— 等它真的出现，不要 sleep 猜
await waitState(() => window.__debug.overlayCount() > 0, '过关面板')
// ★★ 面板里的三枚印章是 `alpha: 0 → 1` 的补间（延迟 0.25 + i*0.22 游戏秒）。
//    headless 只有 4~6 fps、游戏时钟比墙上时钟慢约 7× ⇒ 1.1 游戏秒 ≈ 8 秒真实时间。
//    只等 0.5 秒拍出来是**三枚全透明**的空面板（第一次就拍成了那样）。
await sleep(9000)
await shot('04-clear.png')

/* ④ 题目列表 */
await page.evaluate(() => window.__debug.select())
await sleep(1200)
await shot('03-select.png')

await browser.close()
server.close()
console.log('\n✓ 4 张图拍完（下一步：python ../kid-quest-farm-2d/scripts/build-store-shots.py）\n')
