#!/usr/bin/env node
/**
 * 拍商城详情页要用的 4 张图（`public/store/screamchick/1..4.webp` 的源图）。
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
 * 1. 标题：尖叫鸡 + 太阳光芒 + 「开始」
 * 2. 关卡：25 格关卡盘（说明有进度可推）
 * 3. 对局：铺了半张地板的鸡（这一款的核心玩法）
 * 4. 过关：三颗星的结算面板（说明「过关 / 吃光零食 / 一次通过」三个目标）
 *
 * ⚠️ 点按钮**不写像素坐标**：整屏是 canvas，没有选择器。这里用游戏自己暴露的
 *    `__screamchick.buttons()`（只读几何）拿到「当前界面上带文字的按钮」再点，
 *    所以换视口不用改脚本。写死 `SH * 0.63` 在 `Math.min(SH - 150, …)` 夹紧之后就错位了。
 * ⚠️ 每次动作后要等**补间跑完**：headless 里游戏时钟比墙上时钟慢约 7×，
 *    固定 sleep 会拍到动画中间（面板还在弹、鸡还在滑）。
 */
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.dirname(HERE)
const PORT = Number(process.env.SCREAMCHICK_CAPTURE_PORT || 4424)
const OUT = path.join(ROOT, 'shots')

const BUNDLE = path.join(ROOT, 'dist-plugin', 'screamchick.plugin.mjs')
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
// ★ 先塞一份「玩到一半」的存档：新档的关卡盘是 24 个锁，拍出来像「什么都没有」。
//   这不是作弊 —— 拍的是玩家玩了两天之后的样子，而不是第 0 分钟的样子。
//   （corgi 那边同样是先 setSeed 给爱心，否则卡片全灰。）
const seeded = {
  v: 2, unlocked: 13, music: true, sfx: true, last: 12, lang: 'zh',
  stars: [3, 2, 3, 1, 2, 3, 2, 3, 1, 2, 3, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
          0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
}
store.set('save', JSON.stringify(seeded))
const host = {
  balance: () => 999, spendPoints: async () => true,
  mintGameCoin: async () => {}, spendGameCoin: async () => false, redeemGameCoin: async () => 0,
  mintVoucher: async () => 0, buyGameCoin: async () => false, gameCoinBalance: async () => 0,
  storage: { get: async (k) => store.get(k), set: async (k, v) => { if (v === null) store.delete(k); else store.set(k, v) }, list: async () => Object.fromEntries(store) },
  pushToast: () => {}, haptic: () => {}, tone: () => {},
}
const ctx = { assetBase: '/', assetUrl: (rel) => '/' + rel, locale: 'zh' }
const mod = await import('/dist-plugin/screamchick.plugin.mjs')
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
await page.waitForFunction('!!window.__screamchick', { timeout: 120000 })
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

/** 按「按钮上的字」点一下（坐标来自游戏自己暴露的只读几何） */
async function tap(label) {
  const btns = await page.evaluate(() => window.__screamchick.buttons())
  const b = btns.find((x) => x.label === label)
  if (!b) throw new Error(`界面上没有「${label}」，只有：${btns.map((x) => x.label).join(' / ')}`)
  await page.mouse.click(box.x + b.x, box.y + b.y)
  return b
}

// ---- 1) 标题 ----
await shot('01-title.png')

// ---- 2) 关卡盘 ----
await tap('选择关卡')
await settle(2200)
await shot('02-levels.png')

// ---- 3) 对局（点第 1 关进关，先走一步让脖子铺出去） ----
await tap('1')
await settle(2600)
await page.evaluate(() => window.__screamchick.move(0)) // 右
await settle(1600)
await page.evaluate(() => window.__screamchick.move(3)) // 上
await settle(1600)
await shot('03-play.png')

// ---- 4) 过关面板（再走一步就铺满：右 → 上 → 左） ----
await page.evaluate(() => window.__screamchick.move(1)) // 左
// ★ 要等 **7 秒**，不是 3.8 秒：面板本身 1.1s 后弹，但三颗星是
//   `tween(0.4s, delay 0.25 / 0.47 / 0.69)` —— 那是**游戏时钟**。
//   headless 把 delta 钳在 33ms/帧、实际 4~6 fps ⇒ 游戏时钟慢约 7×，
//   0.69s 的延迟 = 墙上 4.8s。等短了拍到的是「只亮了一颗星」，
//   而颜色数判据照样过（这一条踩过一次）。
await settle(14000)
await shot('04-win.png')

const st = await page.evaluate(() => window.__screamchick.state())
console.log(`\n  结束状态：screen=${st.screen} won=${st.won} path=${st.path}/${st.total} stars[0]=${st.stars[0]}`)

await browser.close()
server.close()

if (pageErrors.length) {
  console.log('\npageerror：')
  for (const e of pageErrors.slice(0, 5)) console.log('  · ' + e)
  process.exit(1)
}
console.log('\n下一步：python ../kid-quest-farm-2d/scripts/build-store-shots.py')
