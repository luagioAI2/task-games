#!/usr/bin/env node
/**
 * 拍商城详情页要用的 4 张图（`public/store/minergirl/1..4.webp` 的源图）。
 *
 * ```bash
 * node scripts/build-plugin.mjs && node scripts/capture.mjs
 * python ../kid-quest-farm-2d/scripts/build-store-shots.py
 * ```
 *
 * ## 拍的是「插件形态」
 *
 * 用假宿主挂 `dist-plugin/` 里的包（和 `mount-test.mjs` 同一套壳），只截
 * **容器那一块**。这样拍到的就是孩子真正看到的那棵树 —— 独立网页走的是
 * `index.html` + `<link href="styles.css">`，样式注入路径都不一样。
 *
 * ⚠️ 这里的容器故意做成**整屏**（`#host{inset:0}`，不像 `mount-test.mjs` 那样
 *    留出顶栏底栏）：商城详情页的图要和其他几款一致（纯游戏画面，9:16），
 *    把宿主顶栏的 🪙/🎫 拍进去等于让家长看两遍同一个东西。
 *    「面板不会盖住宿主顶栏」是 `mount-test.mjs` 的断言，不是这里的事。
 *
 * ## 顺序按「是什么 → 怎么玩 → 怎么变强 → 长期目标」
 *
 * 1. 矿道剖面（矿工在挖）2. 点矿道的升级面板 3. 商城·投资人 4. 皮肤阶梯
 *
 * ## 为什么要先 `setup()` 再拍
 *
 * 全新档只有第一条矿道、没有管理员、现金 $0 —— 拍出来是一条**空矿道**，
 * 家长看不出这是个挖矿游戏（melonjar 那张空罐子踩过同一个坑）。
 * `__mng.setup()` 只改**世界状态**（解锁 3 条矿道、雇 1 个管理员、现金 $1M），
 * 玩法一个字都没变，孩子正常玩 20 分钟就能到那儿。
 *
 * 皮肤那张要 `lifetime = 1e7`：门槛表是 $1K…$3T，1e7 刚好是「解锁 5 套 / 还锁着 9 套」，
 * 既看得到解锁的样子，也看得到 `$1.00B` 这样的门槛角标 —— 只拍全解锁或全锁都是半张图。
 */
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.dirname(HERE)
const HOST = path.resolve(ROOT, '..', '..', 'kid-quest-farm-2d')
const PORT = Number(process.env.MNG_CAPTURE_PORT || 4410)

const BUNDLE = path.join(ROOT, 'dist-plugin', 'minergirl.plugin.mjs')
if (!fs.existsSync(BUNDLE)) {
  console.error('还没打包：node scripts/build-plugin.mjs')
  process.exit(2)
}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp',
  '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.m4a': 'audio/mp4', '.pack': 'application/octet-stream',
}

const PAGE = `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="icon" href="data:,">
<style>html,body{margin:0;height:100%;background:#0b0d12}#host{position:absolute;inset:0;overflow:hidden}</style>
</head><body><div id="host"></div>
<script type="module">
  const store = new Map()
  const host = {
    balance: () => 9999,
    spendPoints: async () => true,
    mintGameCoin: async () => {}, spendGameCoin: async () => false, redeemGameCoin: async () => 0,
    mintVoucher: async () => 0, buyGameCoin: async () => false, gameCoinBalance: async () => 0,
    storage: {
      get: async (k) => store.get(k),
      set: async (k, v) => { if (v === null) store.delete(k); else store.set(k, v) },
      list: async () => Object.fromEntries(store),
    },
    pushToast: () => {}, haptic: () => {}, tone: () => {},
  }
  const ctx = { assetBase: '/dist-plugin/', assetUrl: (rel) => '/dist-plugin/' + rel, locale: 'zh' }
  const mod = await import('/dist-plugin/minergirl.plugin.mjs')
  window.__t = { store, mod, c: document.getElementById('host'), unmount: null }
  window.__mount = async () => { window.__t.unmount = await mod.mount(window.__t.c, host, ctx) }
  window.__unmount = async () => { await window.__t.unmount?.(); window.__t.unmount = null }
  await window.__mount()
  window.__ready = true
</script></body></html>`

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x')
  if (url.pathname === '/__capture.html') { res.writeHead(200, { 'content-type': MIME['.html'] }); res.end(PAGE); return }
  const rel = url.pathname.startsWith('/dist-plugin/') ? url.pathname.slice('/dist-plugin/'.length) : null
  const p = rel !== null ? path.resolve(ROOT, 'dist-plugin', decodeURIComponent(rel)) : null
  if (!p || !p.startsWith(path.resolve(ROOT, 'dist-plugin')) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) {
    res.writeHead(404); res.end('not found'); return
  }
  res.writeHead(200, { 'content-type': MIME[path.extname(p).toLowerCase()] ?? 'application/octet-stream' })
  fs.createReadStream(p).pipe(res)
})
await new Promise((r) => server.listen(PORT, '127.0.0.1', r))

const puppeteer = (await import(pathToFileURL(
  path.join(HOST, 'node_modules', 'puppeteer-core', 'lib', 'puppeteer', 'puppeteer-core.js'),
).href)).default
const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
].find((p) => fs.existsSync(p))
if (!CHROME) { console.error('找不到 Chrome'); process.exit(2) }

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    '--autoplay-policy=no-user-gesture-required'],
})
const page = await browser.newPage()
// DPR 2：详情页是 9:16 的窄图，1x 在平板上会糊
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 })
page.on('pageerror', (e) => console.log('  ! pageerror:', String(e.message).slice(0, 140)))

const OUT = path.join(ROOT, 'shots')
fs.mkdirSync(OUT, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const shot = async (name) => {
  const p = path.join(OUT, name)
  const clip = await page.evaluate(() => {
    const b = document.getElementById('host').getBoundingClientRect()
    return { x: b.x, y: b.y, width: b.width, height: b.height }
  })
  await page.screenshot({ path: p, clip })
  console.log('  出图', path.relative(ROOT, p))
}

/** 等一个「游戏内」条件，绝不等固定秒数（headless 只有 4~6 fps，墙上时钟不可信） */
const until = async (fn, arg, ms = 30000) =>
  page.waitForFunction(fn, { timeout: ms, polling: 250 }, arg).then(() => true, () => false)

console.log(`\n拍图 ${ROOT}\n→ http://127.0.0.1:${PORT}/__capture.html\n`)

await page.goto(`http://127.0.0.1:${PORT}/__capture.html`, { waitUntil: 'domcontentloaded', timeout: 60000 })
await until('window.__ready === true')
const playable = await until('window.__gpPlayable === true', undefined, 120000)
if (!playable) { console.error('没进到可玩状态（__gpPlayable 没起来）'); process.exit(1) }
console.log('  已就绪')

/* ══════════ ① 矿道剖面 ══════════ */
// 3 条矿道 + 管理员 + 现金：让剖面里有矿工在跑、有矿车、有卖矿的房子
await page.evaluate(() => {
  window.__mng.setup({ shafts: 3, level: 20, mgr: 1, cash: 1e6, lifetime: 1e7 })
  window.__mng.scroll(300)
})
// 等矿工真的搬起来（`lifetime` 会因为卖出而涨；说明矿车走完了一整趟）
await until('window.__mng.state.cash > 1e6', undefined, 20000)
await sleep(800)
await shot('01-mine.png')

/* ══════════ ② 升级面板 ══════════ */
await page.evaluate(() => window.__mng.tap('level', 'shaft', 0))
await until('!document.querySelector("#mng-root #panel")?.hidden', undefined, 8000)
await sleep(700)
await shot('02-level.png')

/* ══════════ ③ 商城 · 投资人 ══════════ */
// 投资人（重开矿场）的阶梯：`unit = 4e11/9 ≈ $44.4B` 才出第一位，
// 所以这里把累计收入放到 $200B —— 全新档打开这一页只有一个**灰按钮**，
// 拍出来像坏了。同时给 3 位已有投资人，让「全部产出 +30%」那行有内容。
await page.evaluate(() => document.querySelector('#mng-root [data-act=close]')?.click())
await sleep(400)
await page.evaluate(() => {
  const st = window.__mng.state
  st.lifetime = 2e11; st.investors = 3
  window.__mng.game.persist()
})
await page.evaluate(() => document.querySelector('#mng-root [data-act=shop]')?.click())
await until('!document.querySelector("#mng-root #panel")?.hidden', undefined, 8000)
await sleep(900)
await shot('03-shop.png')

/* ══════════ ④ 皮肤阶梯 ══════════ */
// 累计收入退回 $10M：门槛表是 $1K…$3T，这个点刚好「已解锁 5 套 / 还锁着 9 套」，
// 拍得到 ✓ 也拍得到 `$3.00B` 的门槛角标（全解锁或全锁都只是半张图）。
await page.evaluate(() => {
  const st = window.__mng.state
  st.lifetime = 1e7
  window.__mng.game.persist()
})
await page.evaluate(() => document.querySelector('#mng-root [data-tab=skins]')?.click())
await sleep(1200)   // 预览是逐帧画的（待机 → 招牌动作），多给一点时间到「有动作」的那一帧
await shot('04-skins.png')

const stat = await page.evaluate(() => {
  const locks = [...document.querySelectorAll('#mng-root .sk-pill .p-lock')].map((e) => e.textContent)
  return { tiles: document.querySelectorAll('#mng-root .sk-tile').length, locks: locks.length, sample: locks.slice(0, 3) }
})
console.log(`  皮肤页：${stat.tiles} 格 · ${stat.locks} 个门槛角标 ${stat.sample.join(' ')}`)

await browser.close()
server.close()
console.log('\n✓ 4 张图拍完（下一步：python ../kid-quest-farm-2d/scripts/build-store-shots.py）\n')
