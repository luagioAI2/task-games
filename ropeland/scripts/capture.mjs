#!/usr/bin/env node
/**
 * 拍商城详情页要用的截图（`shots/store-*.png`，390×844，2× DPR）。
 *
 * ```bash
 * node scripts/capture.mjs            # 全拍一遍
 * node scripts/capture.mjs --only 3   # 只补第 3 张
 * ```
 *
 * ## 为什么这个脚本和 plugin-test.cjs 分开
 *
 * `plugin-test.cjs` 只出「过 / 不过」，它的截图是为了**出问题时有图可看**；
 * 这里只出图，不带任何断言。混在一起的老毛病是：图是给详情页用的，
 * 却因为某条断言红了就一张都不写。
 *
 * ## 怎么定位「现在在哪一屏」
 *
 * 这个游戏的 UI 是 **DOM**（`[data-act]` 按钮）叠在 WebGL canvas 上，所以能直接点。
 * 但**判断在哪一屏仍然用 `__game.screen`**，不靠「点完等一秒」：
 * 等固定时长在 headless 下是随机的（SwiftShader 只有 4~6 fps）。
 *
 * ## 拍完要自己看图
 *
 * 结构断言只能证明「文件存在、尺寸对」，证明不了「这一屏是不是我想拍的」。
 * 一张「加载中」的图看着也像正常页面。
 */
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.dirname(HERE)
const OUT = path.join(ROOT, 'shots')
const PORT = Number(process.env.ROPELAND_SHOT_PORT || 4404)
const ONLY = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : null

const VW = 390
const VH = 844

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.json': 'application/json',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.m4a': 'audio/mp4',
  '.woff2': 'font/woff2',
  '.pack': 'application/octet-stream',
}

const serve = (root) =>
  http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x')
    let p = path.join(root, decodeURIComponent(url.pathname))
    if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, 'index.html')
    if (!p.startsWith(root) || !fs.existsSync(p)) {
      res.writeHead(404)
      res.end('not found')
      return
    }
    res.writeHead(200, { 'content-type': MIME[path.extname(p).toLowerCase()] ?? 'application/octet-stream' })
    fs.createReadStream(p).pipe(res)
  })

// 假宿主：只够让插件跑起来（截图不需要真账本）
const HARNESS = `<!doctype html><meta charset="utf-8">
<style>html,body{margin:0;height:100%;background:#0f1115}#host{position:fixed;inset:0}
.slot{position:absolute;inset:0}</style>
<div id="host"></div>
<script type="module">
  const MONEY = { points: 500, coin: 0 }
  const store = new Map()
  const host = {
    balance: () => MONEY.points,
    spendPoints: async (n) => { if (MONEY.points < n) return false; MONEY.points -= n; return true },
    mintGameCoin: async () => {},
    gameCoinBalance: () => MONEY.coin,
    pushToast() {}, haptic() {}, tone() {},
    storage: { get: async (k) => store.get(k), set: async (k, v) => { store.set(k, v) }, list: async () => Object.fromEntries(store) },
  }
  const mod = await import('/ropeland.plugin.mjs')
  const m = mod.default ?? mod
  const slot = document.createElement('div')
  slot.className = 'slot'
  document.getElementById('host').appendChild(slot)
  await m.mount(slot, host, { assetUrl: (r) => '/assets/' + String(r).replace(/^assets\\//, ''), assetBase: '/assets/', locale: 'zh' })
  window.__shotReady = true
</script>`

;(async () => {
  const puppeteer = (await import(
    'file:///E:/plan/test25/kid-quest-farm-2d/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js'
  )).default
  const CHROME = [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  ].find((p) => fs.existsSync(p))

  const server = serve(path.join(ROOT, 'dist-plugin'))
  server.on('request', (req) => {
    if (req.url === '/') req.url = '/__harness'
  })
  // `/` 要返回 HARNESS 而不是目录里的 404
  const origEmit = server.emit.bind(server)
  server.emit = (name, req, res) => {
    if (name === 'request' && (req.url === '/' || req.url === '/__harness')) {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
      res.end(HARNESS)
      return true
    }
    return origEmit(name, req, res)
  }
  await new Promise((r) => server.listen(PORT, '127.0.0.1', r))

  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'],
  })
  const page = await browser.newPage()
  await page.setViewport({ width: VW, height: VH, deviceScaleFactor: 2 })
  page.on('pageerror', (e) => console.log('  pageerror', String(e.message).slice(0, 200)))

  await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'networkidle2', timeout: 60000 })
  await page.waitForFunction(() => window.__shotReady === true, { timeout: 30000 })
  await page.waitForFunction(() => window.__game?.screen === 'title', { timeout: 40000 })

  fs.mkdirSync(OUT, { recursive: true })
  const shot = async (name) => {
    const p = path.join(OUT, name)
    await page.screenshot({ path: p })
    console.log('  →', path.relative(ROOT, p))
  }
  const click = async (act) => {
    const ok = await page.evaluate((a) => {
      const el = document.querySelector(`[data-act="${a}"]`)
      if (!el) return false
      el.click()
      return true
    }, act)
    if (!ok) throw new Error(`找不到 [data-act=${act}]`)
  }
  const want = (n) => !ONLY || String(n) === ONLY

  // ---- 1 标题页 ----
  if (want(1)) {
    await new Promise((r) => setTimeout(r, 900))
    await shot('store-1.png')
  }

  // ---- 2 对局：先跑完教学（教学不收钱），再进正式局并模拟一段 ----
  await click('start')
  await page.waitForFunction(() => window.__game?.screen === 'play', { timeout: 20000 })
  await page.evaluate(() => window.__game.sim(120, { recruit: () => true }))
  await page.evaluate(() => { window.__game.P.tutorialDone = true; window.__game.endRun() })
  await page.waitForFunction(() => window.__game?.screen === 'results', { timeout: 20000 })
  await click('menu')
  await page.waitForFunction(() => window.__game?.screen === 'title', { timeout: 20000 })
  await click('start')
  await page.waitForFunction(() => window.__game?.screen === 'play', { timeout: 20000 })
  // 羊群攒到七八只再拍 —— 只有两三只的话看不出「跟来的羊」这件事
  await page.evaluate(() => window.__game.sim(38, { recruit: () => true }))
  await new Promise((r) => setTimeout(r, 1400))
  if (want(2)) await shot('store-2.png')

  // ---- 3 结算 ----
  await page.evaluate(() => window.__game.endRun())
  await page.waitForFunction(() => window.__game?.screen === 'results', { timeout: 20000 })
  await new Promise((r) => setTimeout(r, 1200))
  if (want(3)) await shot('store-3.png')

  // ---- 4 牧场（羊毛够多了才拍得出「买得起」的样子） ----
  // ★ 260 会让「第4枚铃铛（300 羊毛）」是灰的 —— 那是**真的买不起**，不是坏了，
  //   但家长看详情页只会觉得按钮点了没反应。给到 420：三行升级都能买，衣橱也都能买，
  //   一眼能看出这是个「攒羊毛换升级」的循环。
  await page.evaluate(() => { window.__game.P.wool = Math.max(window.__game.P.wool, 420) })
  await click('ranch')
  await page.waitForFunction(() => window.__game?.overlay === 'ranch', { timeout: 20000 })
  await new Promise((r) => setTimeout(r, 800))
  if (want(4)) await shot('store-4.png')

  await browser.close()
  server.close()
  console.log('\n拍完了 —— 自己看图，别只看文件在不在。\n')
})()
