#!/usr/bin/env node
/**
 * 拍商城详情页要用的 4 张图（`public/store/renttower/1..4.webp` 的源图）。
 *
 * ```bash
 * node scripts/build-plugin.mjs && node scripts/capture.mjs
 * python ../kid-quest-farm-2d/scripts/build-store-shots.py
 * ```
 *
 * ## 为什么拍「插件形态」而不是独立网页
 *
 * 孩子看到的是宿主里那一块容器（上面有顶栏、下面有底栏），不是整页。
 * 这里用假宿主（和 `mount-test.mjs` 同一套壳），只截**容器那一块**。
 *
 * ## 四张图的顺序：先看它是什么 → 点开一间房能干什么 → 能盖多高 → 还有什么
 *
 * 1. 楼体全景：一栋 4 层的楼，1 楼住着人、其余招租中，右边是便利店
 * 2. 房间面板：点 1 号房弹出租金 / 满意度 / 装修（这一款的核心循环）
 * 3. 高层：盖到十几层，楼越长越高就是它的「进度条」
 * 4. 便利店收银：这一款唯一「手要动」的地方
 *
 * ⚠️ 不写像素坐标。房间在 canvas 里没有选择器，所以点房间用游戏自己暴露的
 *    只读几何 `__debug.roomScreen(i)`；DOM 按钮一律按 `data-act` 找。
 * ⚠️ 每个动作后要等画面稳定：headless 下游戏时钟慢好几倍，固定 sleep 会拍到
 *    相机还在滑动 / 面板还在弹的中间态。
 * ⚠️ 存档不手搓 JSON（这一款的 `serialize()` 字段多），一律用 `__debug` 的
 *    探针把「玩了两天」的样子摆出来：加钱加口碑 → 加盖 → 塞几个住户。
 */
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.dirname(HERE)
const PORT = Number(process.env.RENTTOWER_CAPTURE_PORT || 4428)
const OUT = path.join(ROOT, 'shots')

const BUNDLE = path.join(ROOT, 'dist-plugin', 'renttower.plugin.mjs')
if (!fs.existsSync(BUNDLE)) {
  console.error('还没打包：node scripts/build-plugin.mjs')
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
const host = {
  balance: () => 999, spendPoints: async () => true,
  mintGameCoin: async () => {}, spendGameCoin: async () => false, redeemGameCoin: async () => 0,
  mintVoucher: async () => 0, buyGameCoin: async () => false, gameCoinBalance: async () => 0,
  storage: { get: async (k) => store.get(k), set: async (k, v) => { if (v === null) store.delete(k); else store.set(k, v) }, list: async () => Object.fromEntries(store) },
  pushToast: () => {}, haptic: () => {}, tone: () => {},
}
const ctx = { assetBase: '/', assetUrl: (rel) => '/' + rel, locale: 'zh' }
const mod = await import('/dist-plugin/renttower.plugin.mjs')
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
await page.waitForFunction('!!window.__debug && !!window.__debug.rooms', { timeout: 120000 })
await new Promise((r) => setTimeout(r, 2000))

const stage = await page.$('#stage')
const box = await stage.boundingBox()
const shot = async (name) => {
  const f = path.join(OUT, name)
  await stage.screenshot({ path: f })
  const kb = (fs.statSync(f).size / 1024).toFixed(0)
  console.log(`  拍好 ${name}  ${kb} KB`)
}
const settle = (ms = 2400) => new Promise((r) => setTimeout(r, ms))

/** 摆出「玩了两天」的样子：钱、口碑、楼层、住户 */
const seed = await page.evaluate(() => {
  const d = window.__debug
  d.tutSkip()
  d.setMoney(5e8)   // 先给够，加盖要花钱
  d.setRep(820)     // 口碑决定能盖到几层；1000 是上限，别摆成满分
  for (let i = 0; i < 3; i++) d.build()   // 1F + 3 层 = 16 间房
  const kinds = ['baker', 'office', 'student', 'nurse', 'family', 'athlete', 'retiree', 'manga']
  ;[0, 1, 3, 4, 5, 6, 7, 9].forEach((i, k) => d.fill(i, kinds[k], 3 + (k % 3)))
  // 加盖之后把余额调成「刚够再盖一层」的量级：5 亿会显得这游戏不要钱
  d.setMoney(3.2e7)
  d.tick(30)                              // 让住户 / 状态走一会儿，画面不是刚生成的死图
  return { rooms: d.rooms.length, occupied: d.rooms.filter((r) => r.occupied).length, floors: d.floors }
})
console.log(`  布景：${seed.floors} 层 / ${seed.rooms} 间房 / 住 ${seed.occupied} 户`)
await settle(2600)

// ---- 1) 楼体全景 ----
await shot('01-tower.png')

// ---- 2) 房间面板：点 1 号房（坐标来自游戏自己的只读几何）----
const r0 = await page.evaluate(() => window.__debug.roomScreen(0))
if (!r0) throw new Error('拿不到 1 号房坐标')
await page.mouse.click(box.x + r0.x, box.y + r0.y)
await settle(2200)
const sheetOpen = await page.evaluate(() => !!document.querySelector('#mpSheet')?.offsetHeight)
if (!sheetOpen) throw new Error('点了 1 号房但房间面板没打开')
await shot('02-room.png')

// ---- 3) 高层：关掉面板，再盖到 10 层，相机拉到最上面 ----
await page.evaluate(() => {
  const close = [...document.querySelectorAll('button')].find((b) => b.dataset.act === 'close' || b.getAttribute('aria-label') === '关闭')
  if (close) close.click()
})
await settle(1200)
const tall = await page.evaluate(() => {
  const d = window.__debug
  d.setMoney(5e8)
  for (let i = 0; i < 7; i++) d.build()   // 4 层 → 11 层
  // ★ 新盖的楼层全是空房，不塞人的话整栋楼看着像烂尾 —— 这一张要的是「住满的高楼」
  const kinds = ['student', 'freeter', 'office', 'nurse', 'baker', 'couple', 'teacher', 'chef',
    'artist', 'family', 'singer', 'monk', 'delivery', 'reporter', 'model', 'comedian']
  for (let i = 12; i < d.rooms.length; i++) d.fill(i, kinds[i % kinds.length], 2 + (i % 4))
  d.setMoney(8.6e7)
  d.setCam(1)                             // 1 = 相机拉到顶
  d.tick(10)
  return { floors: d.floors, rooms: d.rooms.length, occupied: d.rooms.filter((r) => r.occupied).length }
})
console.log(`  加盖后：${tall.floors} 层 / ${tall.rooms} 间房 / 住 ${tall.occupied} 户`)
await settle(3000)
await shot('03-tall.png')

// ---- 4) 便利店收银 ----
await page.evaluate(() => { window.__debug.setCam(0) })
await settle(1500)
await page.evaluate(() => window.__debug.startShift())
await settle(3500)
// 先把「开店！」按掉：停在说明卡上只能拍到规则，拍不到柜台。
// 按钮坐标来自游戏自己的只读探针（整屏 canvas，没有选择器）。
const btns = await page.evaluate(() => window.__debug.shiftButtons())
console.log('  收银界面按钮：' + btns.map((b) => b.label).join(' / '))
const open = btns.find((b) => b.label.includes('开店'))
if (!open) throw new Error('收银界面没有「开店」按钮')
await page.mouse.click(box.x + open.x + open.w / 2, box.y + open.y + open.h / 2)
// 等第一个顾客把商品摆上柜台（游戏时钟慢，等足）
await settle(6000)
const shiftOn = await page.evaluate(() => window.__debug.shiftButtons().length > 0)
if (!shiftOn) throw new Error('点了开店但收银界面没了')
await shot('04-shift.png')

const st = await page.evaluate(() => ({
  money: Math.round(window.__debug.money), rep: window.__debug.rep,
  floors: window.__debug.floors, rooms: window.__debug.rooms.length,
}))
console.log(`\n  结束状态：¥${st.money} · 口碑 ${st.rep} · ${st.floors} 层 / ${st.rooms} 间房`)

await browser.close()
server.close()

if (pageErrors.length) {
  console.log('\npageerror：')
  for (const e of pageErrors.slice(0, 5)) console.log('  · ' + e)
  process.exit(1)
}
console.log('\n下一步：python ../kid-quest-farm-2d/scripts/build-store-shots.py')
