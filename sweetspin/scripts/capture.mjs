#!/usr/bin/env node
/**
 * 拍商城详情页要用的 4 张图（`public/store/sweetspin/1..4.webp` 的源图）。
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
 * 1. 关卡盘：20 个六边形，前 12 关已通、第 13 关待打（说明有进度可推）
 * 2. 对局开局：一片没接通的灰管道（这一关长什么样）
 * 3. 对局中局：转了一半，灯泡亮起来一半（这一款的核心爽点）
 * 4. 过关：三颗星 + 步数（说明「按步数给星」）
 *
 * ⚠️ 点按钮**不写像素坐标**：整屏是 canvas，没有选择器。这里用游戏自己暴露的
 *    `__sweetspin.buttons()`（只读几何）拿到「当前界面上带标签的按钮」再点，
 *    所以换视口不用改脚本。
 * ⚠️ 每次动作后要等**补间跑完**：headless 里游戏时钟比墙上时钟慢约 7×，
 *    固定 sleep 会拍到动画中间（灯泡还在渐亮、过关面板还在弹）。
 */
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.dirname(HERE)
const PORT = Number(process.env.SWEETSPIN_CAPTURE_PORT || 4426)
const OUT = path.join(ROOT, 'shots')

const BUNDLE = path.join(ROOT, 'dist-plugin', 'sweetspin.plugin.mjs')
if (!fs.existsSync(BUNDLE)) {
  console.error('还没打包：CODEBUDDY_SAFE_DELETE_ENABLED=0 node scripts/build-plugin.mjs')
  process.exit(2)
}
fs.mkdirSync(OUT, { recursive: true })

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
// ★ 先塞一份「玩到一半」的存档：新档的关卡盘是 19 个锁，拍出来像「什么都没有」。
//   这不是作弊 —— 拍的是玩家玩了两天之后的样子，而不是第 0 分钟的样子。
const stars = new Array(100).fill(0)
for (let i = 0; i < 12; i++) stars[i] = [3, 2, 3, 1, 2, 3, 2, 3, 1, 2, 3, 2][i]
const seeded = { v: 1, unlocked: 13, stars, hints: 5, lang: 'zh', muted: true, cur: null }
store.set('save', JSON.stringify(seeded))
const host = {
  balance: () => 999, spendPoints: async () => true,
  mintGameCoin: async () => {}, spendGameCoin: async () => false, redeemGameCoin: async () => 0,
  mintVoucher: async () => 0, buyGameCoin: async () => false, gameCoinBalance: async () => 0,
  storage: { get: async (k) => store.get(k), set: async (k, v) => { if (v === null) store.delete(k); else store.set(k, v) }, list: async () => Object.fromEntries(store) },
  pushToast: () => {}, haptic: () => {}, tone: () => {},
}
const ctx = { assetBase: '/', assetUrl: (rel) => '/' + rel, locale: 'zh' }
const mod = await import('/dist-plugin/sweetspin.plugin.mjs')
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

await page.goto(`http://127.0.0.1:${PORT}/__cap.html`, { waitUntil: 'networkidle2', timeout: 90000 })
await page.waitForFunction('window.__ready === true', { timeout: 90000 })
await page.waitForFunction('!!window.__sweetspin && window.__sweetspin.state().screen === "levels"', { timeout: 120000 })
await new Promise((r) => setTimeout(r, 2500))

const stage = await page.$('#stage')
const box = await stage.boundingBox()
const shot = async (name) => {
  const f = path.join(OUT, name)
  await stage.screenshot({ path: f })
  const kb = (fs.statSync(f).size / 1024).toFixed(0)
  console.log(`  拍好 ${name}  ${kb} KB`)
}
const settle = (ms = 2400) => new Promise((r) => setTimeout(r, ms))

/** 按「按钮上的标签」点一下（坐标来自游戏自己暴露的只读几何） */
async function tap(label) {
  const btns = await page.evaluate(() => window.__sweetspin.buttons())
  const b = btns.find((x) => x.label === label)
  if (!b) throw new Error(`界面上没有「${label}」，只有：${btns.map((x) => x.label).join(' / ')}`)
  // ★ 点**中心**，不点左上角：关卡盘的六边形按钮矩形是互相重叠的，
  //   而命中检测是「从后往前」取第一个 —— 点角落会落到后画的邻格上，
  //   症状是「点了没反应、还停在关卡盘」（不报错）。
  await page.mouse.click(box.x + b.x + b.w / 2, box.y + b.y + b.h / 2)
  return b
}

// ---- 1) 关卡盘 ----
await shot('01-levels.png')

// ---- 2) 对局开局（第 13 关） ----
await tap('L13')
await settle(2600)
await shot('02-play.png')

// ---- 3) 转一半：灯泡亮起来一半 ----
// 关卡是确定性生成的，所以「每格顺时针转几下」可以算出来 —— 不靠运气。
const plan = await page.evaluate(async () => {
  const { generateLevel, rotMask } = await import('/levels.js')
  const def = generateLevel(13)
  const tiles = window.__sweetspin.state().tiles
  // 用 (q,r) 对齐，不依赖数组顺序
  const at = new Map(tiles.map((t) => [t.q + ',' + t.r, t]))
  const steps = []
  for (const cell of def.cells) {
    const t = at.get(cell.q + ',' + cell.r)
    if (!t) continue
    let k = 0
    for (let s = 0; s < 6; s++) if (rotMask(cell.mask, cell.start + s) === cell.mask) { k = s; break }
    for (let j = 0; j < k; j++) steps.push(t)
  }
  return { cells: def.cells.length, tiles: tiles.length, steps }
})
console.log(`  第 13 关：${plan.cells} 格 / 屏幕上 ${plan.tiles} 格 / 要点 ${plan.steps.length} 下`)
if (!plan.steps.length) throw new Error('算不出解，别拍「过关」那一张')

// ★ 不拍「转一半」：管道没接通时**一盏灯都不亮**，那张图和开局那张几乎一样。
//   拍「差最后 3 下」—— 灯泡已经亮了一片，才是这一款的爽点。
const cut = Math.max(1, plan.steps.length - 3)
for (const t of plan.steps.slice(0, cut)) {
  await page.mouse.click(box.x + t.x, box.y + t.y)
  await new Promise((r) => setTimeout(r, 90))
}
await settle(2600)
await shot('03-half.png')

// ---- 4) 过关面板 ----
for (const t of plan.steps.slice(cut)) {
  await page.mouse.click(box.x + t.x, box.y + t.y)
  await new Promise((r) => setTimeout(r, 90))
}
// 面板 650ms 后弹（游戏时钟），三颗星再各延迟一点 ⇒ headless 慢约 7×，等足。
await settle(12000)
await shot('04-win.png')

const st = await page.evaluate(() => window.__sweetspin.state())
console.log(`\n  结束状态：screen=${st.screen} won=${st.won} moves=${st.moves} 第13关星星=${st.stars[12]} · 总星星=${st.totalStars}`)

await browser.close()
server.close()

if (pageErrors.length) {
  console.log('\npageerror：')
  for (const e of pageErrors.slice(0, 5)) console.log('  · ' + e)
  process.exit(1)
}
console.log('\n下一步：python ../kid-quest-farm-2d/scripts/build-store-shots.py')
