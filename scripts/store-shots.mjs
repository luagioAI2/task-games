#!/usr/bin/env node
/**
 * 拍商城详情页的四张图（`screenshots/store-1..4.png`，DPR 2，420×880）。
 *
 * ## 为什么不用宿主里那几张探针截图
 *
 * 探针图带着 App 的「退出游戏」条、带着爸妈闸门、拍在哪一步是随机的。
 * 商城详情页要的是「这游戏长什么样」，顶上一条「退出游戏」等于在提醒家长
 * 「这是个 App 里的插件」—— 说明不了玩法。
 *
 * ## 为什么先装 `window.gp` 的 shim
 *
 * 原版跑在 MakePlay 宿主里，首页那句「{name}，你好！」和「继续上一局」
 * 都来自 `window.gp.player`。不装 shim 时 `D` 是 `undefined`，
 * 首页会少一行问候、而且存档永远为空（每次刷新都是全新档）。
 * 这里装的是**同一个** `gp-shim.js`，存储换成内存 Map —— 只为拍图，不落盘。
 *
 * ## 摆盘用的是游戏自己的 playtest 钩子
 *
 * 原版自带 `?playtest` 开关（`__MAKEPLAY_PLAYTEST__`），里面有
 * `setSeed(1e9 + 金币数)` 和 `reset()`（往箱子里塞 16 块 2~64）。
 * 用它比改内存安全：走的是游戏自己的赋值路径，拍出来的状态是游戏真能到达的状态。
 * 按钮一律走 `__fall2048Debug.tap(id)` —— 那就是真实的命中表，不是坐标硬编码。
 *
 * ⚠️ 弹层类截图拍之前**先验场景名**（`scene === 'gacha'`）。
 * 一张「标题」被当成「扭蛋」塞进详情页，看图的人根本发现不了 —— 错图比缺图更糟。
 */
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { existsSync, mkdirSync } from 'node:fs'

const GAME = path.resolve(process.argv[2] ?? 'E:/plan/test25/task-games/fall2048')
const OUT = path.join(GAME, 'screenshots')
mkdirSync(OUT, { recursive: true })

const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find((p) => existsSync(p))
if (!CHROME) {
  console.error('✗ 找不到 Chrome/Edge')
  process.exit(2)
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
}

/**
 * 拍图专用入口：先装 shim，再 `boot()`。
 *
 * 用**动态** import：`installGpShim` 必须在 `boot()` 抓 `window.gp` 之前跑完。
 */
const STORE_HTML = `<!doctype html>
<html lang="zh">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no">
<title>下落的2048</title>
<style>
  html, body { margin: 0; height: 100%; overflow: hidden; background: #d9a86a; }
  #app { position: fixed; inset: 0; touch-action: none; user-select: none; -webkit-user-select: none; }
  #app > canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; touch-action: none; }
</style>
</head>
<body>
<div id="app" data-mp-stage data-mp-hud="canvas"></div>
<script type="module">
  import { installGpShim } from './gp-shim.js'
  const mem = new Map()
  installGpShim({
    storage: {
      async get(k) { return mem.has(k) ? mem.get(k) : null },
      async set(k, v) { if (v === null || v === undefined) mem.delete(k); else mem.set(k, v) },
      async list() { return Object.fromEntries(mem) },
    },
    locale: 'zh',
    playerName: '小客人',
  })
  const { boot } = await import('./game.js')
  boot({}).catch((e) => console.error(e))
</script>
</body>
</html>
`

const srv = http.createServer((req, res) => {
  let p = decodeURIComponent((req.url ?? '/').split('?')[0])
  if (/^[\\/]$/.test(p)) p = '/__store.html'
  if (p === '/__store.html') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
    res.end(STORE_HTML)
    return
  }
  const file = path.join(GAME, p)
  if (!file.startsWith(GAME) || !existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404, { 'content-type': 'text/plain' })
    res.end('404')
    return
  }
  res.writeHead(200, { 'content-type': MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream' })
  fs.createReadStream(file).pipe(res)
})
await new Promise((r) => srv.listen(0, '127.0.0.1', r))
const base = `http://127.0.0.1:${srv.address().port}/__store.html?playtest=1`

const { default: puppeteer } = await import(
  'file:///E:/plan/test25/kid-quest-farm-online/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js'
)

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--mute-audio'],
})
const page = await browser.newPage()
const VW = Number(process.env.SHOT_W ?? 390)
const VH = Number(process.env.SHOT_H ?? 844)
await page.setViewport({ width: VW, height: VH, deviceScaleFactor: 2 })

const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const scene = () => page.evaluate(() => window.__fall2048Debug?.scene ?? null)
const tap = (id) => page.evaluate((i) => window.__fall2048Debug?.tap(i) ?? false, id)
const seed = (n) => page.evaluate((v) => window.__MAKEPLAY_PLAYTEST__?.setSeed(v), n)

/** 等场景名变成期望值；超时**带当时的场景名**，别只报一句「超时」 */
async function waitScene(want, timeout = 15000) {
  const t0 = Date.now()
  let now = null
  while (Date.now() - t0 < timeout) {
    now = await scene()
    if (now === want) return true
    await wait(200)
  }
  throw new Error(`等场景 ${want} 超时（现在 ${now}）`)
}

/** 重载回首页并给一笔金币 —— 首页那句「开玩」和金币数都来自存档/内存，必须重载才干净 */
async function fresh(coins) {
  await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForFunction('window.__gpPlayable === true', { timeout: 60000 })
  await wait(900)
  await waitScene('title')
  if (coins) await seed(1e9 + coins)
  await wait(600)
}

/**
 * 一直点，直到分数够了（或快溢出了）。
 *
 * ⚠️ 判据不能用「点了几下」：合成是随机的，实测同一份脚本能拍出 8 分和 284 分两种图，
 * 8 分那张看起来像「刚点开还没玩」。所以判据取**分数**。
 * 同时盯 `danger`，别把箱子堆满拍成「要溢出了」。
 * y 取 620 —— 落在井里，不会碰到右上角暂停。
 */
async function playUntil(score, maxDanger = 0.5) {
  let n = 0
  for (let i = 0; i < 40; i++) {
    const s = await page.evaluate(() => window.__MAKEPLAY_PLAYTEST__?.snapshot())
    if (!s || s.scene !== 'play') break
    if (s.score >= score || s.danger >= maxDanger) break
    await page.mouse.click(60 + ((i * 37) % 270), 620)
    n++
    await wait(380)
  }
  return n
}

const shot = async (n, name, mustScene) => {
  const now = await scene()
  if (mustScene && now !== mustScene) throw new Error(`${name}: 拍之前场景是 ${now}，不是 ${mustScene}`)
  const file = path.join(OUT, `store-${n}-${name}.png`)
  await page.screenshot({ path: file })
  console.log(`  ✓ ${path.basename(file)}  (scene=${now})`)
}

try {
  /* ① 首页：金币给到「玩了几天」的量级，别给到 9 位数（那样像作弊） */
  await fresh(1280)
  await shot(1, 'title', 'title')

  /* ② 对局：`reset()` 往箱子里塞 16 块 2~64，比空箱子看得出这是「往下掉、撞一起就合」 */
  await tap('start')
  await waitScene('play')
  await wait(1200)

  /* 热身一局：先把「首次合成 / 做出 128 / 5 连锁」这些称号拿掉。
   * 称号是**一次性**的，第二局不会再弹「获得称号！…」—— 而那条提示正好压在井口，
   * 文案还是原版的「多巴胺小鬼」系列（游戏内收藏品的名字，我们没改）。 */
  await playUntil(260)
  await tap('pause')
  await wait(700)
  if (!(await tap('restart'))) throw new Error('暂停面板上没有 restart')
  await wait(2600)

  await page.evaluate(() => window.__MAKEPLAY_PLAYTEST__?.reset())
  await wait(1200)
  /* 分数只从合成来 ⇒ 真点，点到「像玩过一会儿」为止。
   *
   * ⚠️ 不能固定点几下：合成是随机的，实测同一份脚本能拍出 8 分和 284 分两种图，
   * 8 分那张看起来像「刚点开还没玩」。所以判据取**分数**，够 220 就停；
   * 同时盯 `danger`（>=0.5 就停），别把箱子堆满拍成「要溢出了」。
   * y 取 620 —— 落在井里，不会碰到右上角暂停。 */
  console.log(`  第二局点了 ${await playUntil(260)} 下`)
  /* 再等一会儿：连锁会弹「N连锁！」、破纪录会弹「个人最佳」，还有任务完成的提示条 ——
   * 它们都会自己淡掉，等干净了再拍（分数留在 HUD 上，不会掉）。 */
  await wait(7000)
  const st = await page.evaluate(() => window.__MAKEPLAY_PLAYTEST__?.snapshot())
  console.log(`  对局状态：score=${st?.score} 方块=${st?.tiles} 最高=${st?.max} 危险=${st?.danger}`)
  await shot(2, 'play', 'play')

  /* ③ 扭蛋：抽一次，等翻牌动画走到 `show`（charge → open → show，约 2 秒） */
  await fresh(3000)
  await tap('gacha')
  await waitScene('gacha')
  await wait(700)
  /* 第一抽是「今日免费」，但它一定会弹一条「获得称号！扭蛋出道」的提示，
   * 而那条提示正好压住右上角的金币。所以先抽掉它、等提示走完，再抽第二次拍图。 */
  const pulled = await tap('pull')
  if (!pulled) throw new Error('扭蛋页上没有 pull 这个命中项')
  await wait(6500)
  await tap('pull')
  await wait(3200)
  await shot(3, 'gacha', 'gacha')

  /* ④ 升级商店：买几档，让等级条不是清一色 0 也不是清一色 MAX */
  await fresh(3000)
  await tap('upgrade')
  await waitScene('shop')
  await wait(800)
  for (const [id, times] of [['buy-fall', 3], ['buy-coinMul', 2], ['buy-mergeCoin', 1]]) {
    for (let i = 0; i < times; i++) {
      if (!(await tap(id))) throw new Error(`商店里没有 ${id}`)
      await wait(260)
    }
  }
  await wait(700)
  await shot(4, 'shop', 'shop')
} catch (e) {
  console.error(`✗ 中断：${e.message}`)
  try {
    await page.screenshot({ path: path.join(OUT, 'store-error.png') })
  } catch {}
  process.exitCode = 1
} finally {
  await browser.close()
  srv.close()
}
