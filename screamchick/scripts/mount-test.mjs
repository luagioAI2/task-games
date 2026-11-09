#!/usr/bin/env node
/**
 * 假宿主挂载测试（五层验收的第 3 层）—— 不开真 App，只验插件本身。
 *
 * ```bash
 * CODEBUDDY_SAFE_DELETE_ENABLED=0 node scripts/build-plugin.mjs && node scripts/mount-test.mjs
 * node scripts/mount-test.mjs --port 4423
 * ```
 *
 * ⚠️ 端口只能写 `--port <n>`，**位置参数会被静默忽略**。
 *
 * ## 为什么这层不能省
 *
 * 第 1 层（`check-plugin`）是静态的，第 2 层（lint / 单测）跑的是宿主代码 ——
 * **插件产物是另一份构建，两层都碰不到它**。这一层才第一次真的 `import()` 这个包、
 * 真的往容器里挂、真的扣积分。
 *
 * ## 本作的收费点：**进关**，不是进场
 *
 * 所以判据跟 corgi / anthill 那种「进场收费 + 宽限期」**正好相反**：
 *   · 挂载本身**一分不扣**（余额 5 也能挂上、也能看到标题页）
 *   · 点「开始」/ 点关卡格才扣，而且余额不够就**进不去**
 *   · 撞死「重玩」不再扣（同一关）
 *
 * 照抄「挂载就扣 10」的断言会把**正确实现判成红的**。
 *
 * ## 判据（每条都能红）
 *
 * ① 余额 5 挂载：canvas 1 个、贴合容器、**0 次扣款**、停在标题页
 * ② 余额 5 点「开始」：进不去 —— 0 次扣款、仍在标题页、弹了「积分不够」
 * ③ 余额 100 点「开始」：**恰好扣 1 次 10**，进对局（`screen === 'game'`）
 * ④ 撞死重玩（`restart`）：**不再扣**（同一关）
 * ⑤ 真的把第 1 关打通：`won === true`、`stars[0] ≥ 1`（说明玩法在插件里是活的）
 * ⑥ 卸载：容器清空、canvas 0、调试桥摘掉、**宿主的 title / lang 没被改**、0 个 pageerror
 * ⑦ 存档真落盘：`host.storage` 里有 `stars[0] ≥ 1`；重挂读回来；**重挂不扣款**
 * ⑧ 第三次挂载 canvas 恒为 1（模块级状态没被上一次卸载毁掉）
 */
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.dirname(HERE)
const PORT = Number(process.argv[process.argv.indexOf('--port') + 1]) || 4423

const BUNDLE = path.join(ROOT, 'dist-plugin', 'screamchick.plugin.mjs')
if (!fs.existsSync(BUNDLE)) {
  console.error('还没打包：CODEBUDDY_SAFE_DELETE_ENABLED=0 node scripts/build-plugin.mjs')
  process.exit(2)
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.json': 'application/json',
  '.css': 'text/css',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.m4a': 'audio/mp4',
  '.mp3': 'audio/mpeg',
  '.pack': 'application/octet-stream',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
}

const PAGE = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">
<title>HOST PAGE TITLE</title>
<style>html,body{margin:0;height:100%;background:#2b2b2b}
#shell{position:absolute;inset:0;display:flex;flex-direction:column}
#top{height:56px;background:#3a3a3a;flex:none}
/* ★ 真宿主的结构：页面区是定位上下文，插件容器是 absolute inset-0。
   写成「容器自己 flex:1」的话，「容器高 == 父容器高」这条断言会误报。 */
#page{position:relative;flex:1;min-height:0}
#stage{position:absolute;inset:0}
#tabs{height:64px;background:#3a3a3a;flex:none}
</style>
</head><body>
<div id="shell"><div id="top"></div><div id="page"><div id="stage"></div></div><div id="tabs"></div></div>
<script type="module">
const c = document.getElementById('stage')
const store = new Map()
const calls = { spend: [], toast: [] }
const state = { balance: 5 }
const host = {
  balance: () => state.balance,
  spendPoints: async (n, memo) => {
    calls.spend.push({ n, memo })
    if (state.balance < n) return false
    state.balance -= n
    return true
  },
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
  pushToast: (t) => calls.toast.push(t),
  haptic: () => {},
  tone: () => {},
}
// ★ 包根 = 本站根。真宿主里 assetBase 是 https://host/games/screamchick/，
//   图片在 <包根>assets/、音频清单与 sound.pack 在 <包根> 本身。
//   写成 /dist-plugin/ 的话所有图全 404 —— 那是**假宿主自己配错**，不是插件的问题。
//   ⚠️ 这段注释在模板字符串里，**不能出现反引号**（会把外层模板提前闭合）。
const ctx = { assetBase: '/', assetUrl: (rel) => '/' + rel, locale: 'zh' }
const mod = await import('/dist-plugin/screamchick.plugin.mjs')
window.__calls = calls
window.__state = state
window.__store = store
window.__mod = mod
window.__ctx = ctx
window.__container = c
window.__host = host
window.__titleBefore = document.title
window.__langBefore = document.documentElement.lang
window.__unmount = await mod.mount(c, host, ctx)
window.__mount = async () => { window.__unmount = await mod.mount(c, host, ctx) }
window.__ready = true
</script></body></html>`

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x')
  if (url.pathname === '/__mount.html') {
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
  // ★ `--use-gl=swiftshader` 已被新版 Chrome 移除：缺这三件套 Pixi 会停在加载页且 0 报错
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    '--autoplay-policy=no-user-gesture-required'],
})
const page = await browser.newPage()
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 })

const bad = []
const pageErrors = []
page.on('response', (r) => {
  const u = r.url()
  if (r.status() >= 400 && !u.includes('favicon')) bad.push(`${r.status()} ${u}`)
})
page.on('pageerror', (e) => pageErrors.push(String(e.stack || e.message).slice(0, 400)))

const fail = []
const ok = (cond, msg) => {
  console.log((cond ? '  ok   ' : '  FAIL ') + msg)
  if (!cond) fail.push(msg)
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

await page.goto(`http://127.0.0.1:${PORT}/__mount.html`, { waitUntil: 'networkidle2', timeout: 90000 })
await page.waitForFunction('window.__ready === true', { timeout: 90000 })
await sleep(1500)

/* ---------------- ① 挂载本身不收费 ---------------- */
console.log('\n--- ① 余额 5 挂载：不收费、canvas 1 个、停在标题页 ---')
const mounted = await page.evaluate(() => {
  const c = window.__container
  const cv = c.querySelector('canvas')
  const r = c.getBoundingClientRect()
  const pr = c.parentElement.getBoundingClientRect()
  const b = cv ? cv.getBoundingClientRect() : null
  const g = window.__screamchick
  return {
    bridge: !!g,
    canvases: c.querySelectorAll('canvas').length,
    canvasW: b ? Math.round(b.width) : 0,
    canvasH: b ? Math.round(b.height) : 0,
    boxW: Math.round(r.width),
    boxH: Math.round(r.height),
    parentH: Math.round(pr.height),
    screen: g?.state().screen ?? null,
    spend: window.__calls.spend.length,
    balance: window.__state.balance,
    // ★ 「canvas 在不在最上面」——尺寸全对、DOM 里也有，但被别的层盖住时尺寸类断言全绿、画面是空的
    topTag: (() => {
      if (!b) return null
      const el = document.elementFromPoint(Math.round(b.left + b.width / 2), Math.round(b.top + b.height / 2))
      return el ? el.tagName : null
    })(),
  }
})
ok(mounted.bridge, '调试桥装上了（__screamchick）')
ok(mounted.canvases === 1, `容器里 canvas 恰好 1 个（实测 ${mounted.canvases}）`)
// ★ 判据跟**父容器**比：跟 canvas 比的话两个数会一起错 ⇒ 全绿
ok(Math.abs(mounted.boxH - mounted.parentH) <= 2, `容器高 ${mounted.boxH} == 父容器高 ${mounted.parentH}（±2）`)
ok(Math.abs(mounted.canvasW - mounted.boxW) <= 2 && Math.abs(mounted.canvasH - mounted.boxH) <= 2,
  `canvas ${mounted.canvasW}×${mounted.canvasH} == 容器 ${mounted.boxW}×${mounted.boxH}（±2）`)
ok(mounted.topTag === 'CANVAS', `容器中心最上层是 canvas（实测 ${mounted.topTag}）`)
ok(mounted.screen === 'title', `首屏是标题页（screen=${mounted.screen}）`)
ok(mounted.spend === 0, `挂载本身**一分没扣**（spend=${mounted.spend}）`)
ok(mounted.balance === 5, `余额还是 5（实测 ${mounted.balance}）`)
ok(bad.length === 0, `整轮 0 个 404（实测 ${bad.length}${bad.length ? '：' + bad.slice(0, 3).join(' | ') : ''}）`)

/* ---------------- ② 余额不够进不去 ---------------- */
console.log('\n--- ② 余额 5 点「开始」：进不去，0 次扣款 ---')
const denied = await page.evaluate(async () => {
  await window.__screamchick.startLevel(0)
  await new Promise((r) => setTimeout(r, 600))
  return {
    screen: window.__screamchick.state().screen,
    spend: window.__calls.spend.length,
    balance: window.__state.balance,
    toast: window.__calls.toast.at(-1) ?? null,
  }
})
ok(denied.screen === 'title', `还停在标题页（screen=${denied.screen}）`)
ok(denied.spend === 0, `没发起扣款（spend=${denied.spend}）`)
ok(denied.balance === 5, `余额还是 5（实测 ${denied.balance}）`)
ok(!!denied.toast && /积分/.test(JSON.stringify(denied.toast)), `弹了提示（${JSON.stringify(denied.toast)}）`)

/* ---------------- ③ 余额够：扣一次进对局 ---------------- */
console.log('\n--- ③ 余额 100 点「开始」：恰好扣 1 次 10、进对局 ---')
const entered = await page.evaluate(async () => {
  window.__state.balance = 100
  await window.__screamchick.startLevel(0)
  await new Promise((r) => setTimeout(r, 1500))
  const s = window.__screamchick.state()
  return {
    screen: s.screen, levelIdx: s.levelIdx, total: s.total,
    spend: window.__calls.spend.length,
    last: window.__calls.spend.at(-1) ?? null,
    balance: window.__state.balance,
  }
})
ok(entered.screen === 'game', `进对局了（screen=${entered.screen}）`)
ok(entered.levelIdx === 0, `是第 1 关（levelIdx=${entered.levelIdx}）`)
ok(entered.spend === 1 && entered.last?.n === 10, `恰好扣 1 次 10（spend=${entered.spend} · n=${entered.last?.n}）`)
ok(entered.balance === 90, `余额 100 → 90（实测 ${entered.balance}）`)

/* ---------------- ④ 重玩不再扣 ---------------- */
console.log('\n--- ④ 撞死重玩：同一关，不再扣 ---')
const retried = await page.evaluate(async () => {
  const before = window.__calls.spend.length
  window.__screamchick.restart()
  await new Promise((r) => setTimeout(r, 800))
  return { delta: window.__calls.spend.length - before, balance: window.__state.balance, screen: window.__screamchick.state().screen }
})
ok(retried.delta === 0, `重玩没有扣款（spend +${retried.delta}）`)
ok(retried.balance === 90, `余额还是 90（实测 ${retried.balance}）`)

/* ---------------- ⑤ 真打通第 1 关 ---------------- */
// 第 1 关地图 `#..` / `##.` / `...`，起点 (0,2)，par 3 ——
// 右(0) → 上(3) → 左(1) 正好铺满 6 格。用固定解，不靠运气。
console.log('\n--- ⑤ 真的打通第 1 关（右 → 上 → 左） ---')
const won = await page.evaluate(async () => {
  const g = window.__screamchick
  for (const d of [0, 3, 1]) {
    g.move(d)
    await new Promise((r) => setTimeout(r, 900))
  }
  await new Promise((r) => setTimeout(r, 1200))
  const s = g.state()
  return { won: s.won, stars: s.stars[0], path: s.path, total: s.total }
})
ok(won.won === true, `过关了（won=${won.won}）`)
ok(won.path === won.total, `铺满了全部 ${won.total} 格（path=${won.path}）`)
ok((won.stars ?? 0) >= 1, `第 1 关拿到星星（stars[0]=${won.stars}）`)

/* ---------------- ⑥ 卸载要收干净 ---------------- */
console.log('\n--- ⑥ 卸载：容器清空、调试桥摘掉、宿主 title/lang 不变 ---')
const errBefore = pageErrors.length
const un = await page.evaluate(async () => {
  await window.__unmount()
  await new Promise((r) => setTimeout(r, 800))
  return {
    children: window.__container.childElementCount,
    canvases: window.__container.querySelectorAll('canvas').length,
    bridge: typeof window.__screamchick,
    title: document.title,
    titleBefore: window.__titleBefore,
    lang: document.documentElement.lang,
    langBefore: window.__langBefore,
    saved: window.__store.get('save') ?? null,
  }
})
ok(un.children === 0, `容器清空（剩 ${un.children} 个子节点）`)
ok(un.canvases === 0, `canvas 已移除（剩 ${un.canvases}）`)
ok(un.bridge === 'undefined', `调试桥已摘（${un.bridge}）`)
ok(un.title === un.titleBefore, `宿主的 document.title 没被改（「${un.title}」）`)
ok(un.lang === un.langBefore, `宿主的 <html lang> 没被改（${un.lang}）`)
ok(pageErrors.length === errBefore, `卸载过程 0 个 pageerror（+${pageErrors.length - errBefore}）`)

/* ---------------- ⑦ 存档落盘 + 重挂读回 ---------------- */
console.log('\n--- ⑦ 存档真的落盘了（卸载后才在宿主 Map 里） ---')
let parsed = null
try {
  parsed = un.saved ? JSON.parse(un.saved) : null
} catch (e) {
  parsed = null
}
ok(!!parsed, `host.storage 里有 save（${un.saved ? String(un.saved).slice(0, 60) + '…' : 'null'}）`)
ok(!!parsed && Array.isArray(parsed.stars) && parsed.stars[0] >= 1,
  `存档里第 1 关有星星（stars[0]=${parsed?.stars?.[0]}）`)

const remount = await page.evaluate(async () => {
  const before = window.__calls.spend.length
  await window.__mount()
  await new Promise((r) => setTimeout(r, 1800))
  const s = window.__screamchick.state()
  return {
    spendDelta: window.__calls.spend.length - before,
    balance: window.__state.balance,
    stars0: s.stars[0],
    unlocked: s.unlocked,
    canvases: window.__container.querySelectorAll('canvas').length,
  }
})
ok(remount.spendDelta === 0, `重挂**不再扣款**（spend +${remount.spendDelta}）`)
ok(remount.balance === 90, `余额还是 90（实测 ${remount.balance}）`)
ok(remount.stars0 >= 1, `进度读回来了（stars[0]=${remount.stars0}）`)
ok(remount.canvases === 1, `重挂后 canvas 恰好 1 个（实测 ${remount.canvases}）`)

/* ---------------- ⑧ 第三次挂载 ---------------- */
console.log('\n--- ⑧ 再卸再挂一次：canvas 恒为 1 ---')
const third = await page.evaluate(async () => {
  await window.__unmount()
  await new Promise((r) => setTimeout(r, 600))
  await window.__mount()
  await new Promise((r) => setTimeout(r, 1800))
  return {
    canvases: window.__container.querySelectorAll('canvas').length,
    screen: window.__screamchick.state().screen,
    spend: window.__calls.spend.length,
    balance: window.__state.balance,
  }
})
ok(third.canvases === 1, `canvas 恰好 1 个（实测 ${third.canvases}）`)
ok(third.screen === 'title', `还是从标题页进（screen=${third.screen}）`)
ok(third.spend === 1, `全程只扣过 1 次（spend=${third.spend}）`)

/* ---------------- 汇总 ---------------- */
console.log('\n=== 结果 ===')
if (bad.length) console.log('4xx/5xx：', bad.slice(0, 6))
if (pageErrors.length) console.log('pageerror：', pageErrors.slice(0, 3))
console.log(fail.length ? `✗ ${fail.length} 条失败` : `✓ 全部通过`)

await browser.close()
server.close()
process.exit(fail.length ? 1 : 0)
