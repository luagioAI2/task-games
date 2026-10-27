#!/usr/bin/env node
/**
 * 拍商城详情页要用的 4 张图（`public/store/deckrush/1..4.webp` 的源图）。
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
 * 1. 标题（是什么 + 三档难度）
 * 2. 构筑：60 秒里三选一抽牌（这一款的核心玩法，别用标题屏当唯一一张）
 * 3. 战斗：手牌 + 能量 + 敌人意图
 * 4. 卡牌图鉴：32 张牌，说明「有多少内容」
 *
 * ⚠️ 第 2 张必须**先抽满 10 张再拍**：
 *    · 刚进构筑时 `offer` 是 null（要先点「召唤！」才摊开三张），拍出来只有倒计时；
 *    · 卡组不足 10 张就 `finishBuild` 会弹「自动补充了 10 张基础牌」的横幅，
 *      那条横幅会压在战斗画面上（第一次就拍成了那样）。
 * ⚠️ 第 4 张**要在标题屏拍**：战斗中点「卡牌图鉴」不会换屏（战斗 UI 优先级更高），
 *    拍出来还是战斗画面，而且零报错。
 */
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.dirname(HERE)
const PORT = Number(process.env.DECKRUSH_CAPTURE_PORT || 4413)

const BUNDLE = path.join(ROOT, 'dist-plugin', 'deckrush.plugin.mjs')
if (!fs.existsSync(BUNDLE)) {
  console.error('还没打包：CODEBUDDY_SAFE_DELETE_ENABLED=0 node scripts/build-plugin.mjs')
  process.exit(2)
}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.json': 'application/json', '.css': 'text/css', '.png': 'image/png',
  '.webp': 'image/webp', '.svg': 'image/svg+xml', '.m4a': 'audio/mp4', '.mp3': 'audio/mpeg',
  '.pack': 'application/octet-stream', '.ttf': 'font/ttf', '.wasm': 'application/wasm',
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
const mod = await import('/dist-plugin/deckrush.plugin.mjs')
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
const waitState = async (fn, label, timeout = 90000) => {
  const t0 = Date.now()
  while (Date.now() - t0 < timeout) {
    if (await page.evaluate(fn)) return true
    await sleep(250)
  }
  console.log(`  ! 等超时：${label}`)
  return false
}
/**
 * 等**补间全部跑完**（`tweens` 为空且不在动作中）。
 *
 * ★ 只等「状态位」（`offer` 有 3 张 / `hand` 有 3 张）是不够的：卡片是补间飞进来的，
 *   状态位在动画**开始**时就变了 ⇒ 拍出来是三张叠在一起、还在飞。
 * ★ 横幅（`banner()`）也走 `tween` ⇒ 这一条顺带把「STAGE 1 史莱姆」那种压在
 *   画面正中的横幅等掉。
 */
const waitIdle = async (label, extra = 1200) => {
  await waitState(() => !!window.__dbg && !window.__dbg.busy && (window.__dbg.snap().tweens ?? 0) === 0, label)
  await sleep(extra)
}

const boot = async () => {
  await page.goto(`http://127.0.0.1:${PORT}/__capture.html`, { waitUntil: 'networkidle2', timeout: 90000 })
  await page.waitForFunction('window.__ready === true', { timeout: 90000 })
  await page.waitForFunction('window.__gpPlayable === true', { timeout: 180000 }).catch(() => {})
  await sleep(1200)
}

console.log(`\n拍图 ${ROOT}\n→ http://127.0.0.1:${PORT}/__capture.html\n`)

/* ① 标题 */
await boot()
await shot('01-title.png')

/* ② 卡牌图鉴（必须在标题屏拍：战斗里点它不换屏） */
console.log('  打开卡牌图鉴…')
await page.evaluate(() => window.__dbg.ui.onOpenCardList())
await waitState(() => window.__dbg.model?.screen === 'cardlist', '图鉴换屏')
// 图鉴是滚动列表（`.mp-deck[data-mp-scroll]`），32 张要等首屏铺好
await waitState(() => document.querySelectorAll('.mp-ui [data-mp-scroll] *').length > 20, '卡面铺好')
await sleep(900)
await shot('04-cards.png')
await page.evaluate(() => window.__dbg.ui.onCloseScreen())
await sleep(600)

/* ③ 构筑：先抽满 10 张，再摊开三张备选 */
console.log('  开局 → 构筑：抽 10 张…')
await page.evaluate(() => window.__dbg.ui.onStart(true))
await waitState(() => window.__dbg.run?.phase === 'build', '进构筑')
for (let i = 0; i < 10; i++) {
  await page.evaluate(() => window.__dbg.summon())
  await waitState(() => (window.__dbg.offer?.length ?? 0) === 3, `第 ${i + 1} 次抽牌摊开`)
  await page.evaluate(() => window.__dbg.pickOffer(0))
  await sleep(250)
}
console.log('  卡组', await page.evaluate(() => window.__dbg.run?.deck?.length ?? 0), '张')
// 再抽一次，让三张备选留在画面上（这时候卡组列表也是满的）
await page.evaluate(() => window.__dbg.summon())
await waitState(() => (window.__dbg.offer?.length ?? 0) === 3, '三张备选摊开')
// ★ 抽卡会放一次 `magic-area-pulse`（中间那团白光），是 fx 不是 tween ⇒ 多等一会儿
await waitIdle('抽卡动画跑完', 3500)
await shot('02-build.png')

/* ④ 战斗：手牌 + 能量 + 敌人意图 */
console.log('  收尾进战斗…')
await page.evaluate(() => window.__dbg.finishBuild(false))
await waitState(() => window.__dbg.run?.phase === 'battle', '进战斗')
// 等手牌发到手 + 发牌补间跑完（★ 只等数量会拍到三张叠在一起还在飞）
await waitState(() => (window.__dbg.hand?.length ?? 0) >= 3, '手牌发完')
await waitIdle('发牌动画 + STAGE 横幅跑完', 1500)
await shot('03-battle.png')

await browser.close()
server.close()
console.log('\n✓ 4 张图拍完（下一步：python ../kid-quest-farm-2d/scripts/build-store-shots.py）\n')
