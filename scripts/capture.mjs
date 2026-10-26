#!/usr/bin/env node
/**
 * 拍商城详情页要用的 4 张图（`public/store/melonjar/1..4.webp` 的源图）。
 *
 * ```bash
 * node scripts/build-plugin.mjs && node scripts/capture.mjs
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
 * 1. 标题（是什么）2. 对局中（怎么玩）3. 强化面板（成长）4. 成就（长期目标）
 *
 * ⚠️ 对局中那张**必须真的丢几颗果**：只点「开始游戏」截到的是空罐子，
 *    家长看不出这是个合成游戏（这是 sugar 那张图踩过的坑）。
 */
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.dirname(HERE)
const PORT = Number(process.env.MELONJAR_CAPTURE_PORT || 4408)

const BUNDLE = path.join(ROOT, 'dist-plugin', 'melonjar.plugin.mjs')
if (!fs.existsSync(BUNDLE)) {
  console.error('还没打包：node scripts/build-plugin.mjs')
  process.exit(2)
}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.json': 'application/json', '.css': 'text/css', '.png': 'image/png',
  '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg',
  '.pack': 'application/octet-stream', '.wasm': 'application/wasm',
}

const PAGE = `<!doctype html><html><head><meta charset="utf-8">
<style>html,body{margin:0;height:100%;background:#0b0d12}#host{position:absolute;inset:0}</style>
</head><body><div id="host"></div>
<script type="module">
const c = document.getElementById('host')
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
const mod = await import('/dist-plugin/melonjar.plugin.mjs')
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
  const r = document.getElementById('host').getBoundingClientRect()
  return { x: r.x, y: r.y, width: r.width, height: r.height }
})
const shot = async (name) => {
  const p = path.join(OUT, name)
  await page.screenshot({ path: p, clip: await box() })
  console.log('  出图', path.relative(ROOT, p))
}
const tapText = async (txt) => {
  const b = await page.evaluate((t) => {
    const el = [...document.querySelectorAll('#ui-root button')]
      .find((e) => (e.textContent || '').trim().startsWith(t))
    if (!el) return null
    const r = el.getBoundingClientRect()
    if (!r.width || !r.height) return null
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
  }, txt)
  if (!b) return false
  await page.mouse.click(b.x, b.y)
  return true
}

const boot = async () => {
  await page.goto(`http://127.0.0.1:${PORT}/__capture.html`, { waitUntil: 'networkidle2', timeout: 60000 })
  await page.waitForFunction('window.__gpPlayable === true', { timeout: 120000 }).catch(() => {})
  await sleep(1200)
}

console.log(`\n拍图 ${ROOT}\n→ http://127.0.0.1:${PORT}/__capture.html\n`)

/* ① 标题 */
await boot()
await shot('01-title.png')

/* ② 对局中：真丢十几颗果，让罐子里有堆 */
console.log('  点「开始游戏」…', await tapText('开始游戏'))
await sleep(1800)
// ★ 间隔必须够长：headless 只有 4~6 fps，游戏时钟比墙上时钟慢约 7×，
//   `dropWait = 0.6`（游戏内秒）≈ 4 秒真实时间。间隔太短的话点击被丢掉，
//   截出来是一个**空罐子** —— 家长看不出这是合成游戏。
for (let i = 0; i < 24; i++) {
  const x = 130 + ((i * 53) % 130)
  await page.mouse.click(x, 320)
  await sleep(2100)
}
await sleep(1200)
await shot('02-play.png')

/*
 * ③④ 之前先**播一份「玩过几天」的存档**。
 *
 * 为什么：全新档的强化按钮全是灰的（宝石 0）、成就全是「未解锁」，
 * 拍出来的详情页像一张坏掉的界面。这里塞的是**真实玩家能到的状态**
 * （打过几局、解锁了几个成就），不是改数值骗人 —— 玩法一个字都没变。
 *
 * ★ 播种必须排在 **unmount 之后、mount 之前**：`unmount()` 里会 `store.flush()`
 *   把上一局玩出来的 `achv` 写回存储，先播种就会被它盖掉（症状：图里还是全未解锁）。
 */
const seed = async () => {
  await page.evaluate(() => {
    window.__store.set('achv', {
      first_watermelon: { unlocked: true, progress: 1 },
      double_watermelon: { unlocked: true, progress: 1 },
      chain5: { unlocked: true, progress: 1 },
      score10k: { unlocked: true, progress: 1 },
      merges500: { unlocked: false, progress: 186 },
      daily7: { unlocked: false, progress: 3 },
    })
    window.__store.set('records', {
      __sys_meta: {
        gems: 240,
        up: { warn: 1, starter: 0, luck: 1 },
        consum: { shake: 0, revive: 0 },
        daily: { date: '', best: 8420, streak: 3, lastDate: '' },
      },
    })
  })
}

/** 重新挂载：`store.preload()` 只在 mount 时读一次，改存档必须重挂 */
const remount = async () => {
  await page.evaluate(() => window.__unmount())
  await sleep(600)
  await seed()
  await page.evaluate(() => window.__mount())
  await page.waitForFunction('window.__gpPlayable === true', { timeout: 120000 }).catch(() => {})
  await sleep(1200)
}
await remount()

/* ③ 强化面板 */
console.log('  点「强化」…', await tapText('强化'))
await sleep(900)
await shot('03-upgrade.png')

/* ④ 成就面板 */
await remount()
console.log('  点「成就」…', await tapText('成就'))
await sleep(900)
await shot('04-achv.png')

await browser.close()
server.close()
console.log('\n✓ 4 张图拍完（下一步：python ../kid-quest-farm-2d/scripts/build-store-shots.py）\n')
