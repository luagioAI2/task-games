#!/usr/bin/env node
/**
 * 假宿主挂载测试（五层验收的第 3 层）—— 不开真 App，只验插件本身。
 *
 * ```bash
 * CODEBUDDY_SAFE_DELETE_ENABLED=0 node scripts/build-plugin.mjs && node scripts/mount-test.mjs
 * node scripts/mount-test.mjs --port 4422
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
 * ## 判据（每条都能红）
 *
 * ① 余额 5：进场被挡住 —— 0 次扣款、容器里没有 canvas、门上有「积分不够」
 * ② 余额 100：canvas 恰好 1 个、贴合容器、整轮 **0 个 404**、**恰好扣 10**
 * ③ 点「开始玩」进主界面（`mode === 'play'`）
 * ④ 玩到一半卸载：容器清空、调试钩子全摘、0 个 pageerror
 * ⑤ **10 分钟宽限内重挂：不再扣款**（本作是养成，不是按局收费）
 * ⑥ 把 `paidAt` 往前拨 11 分钟再重挂：**又扣一次**
 * ⑦ 存档真落盘：涨了爱心 → 卸载 → `host.storage` 里有 → 重挂读回来
 * ⑧ 第三次挂载 canvas 恒为 1（模块级状态没被上一次卸载毁掉）
 * ⑨ 不污染宿主：`document.title` / `<html lang>` 挂载前后一模一样
 */
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.dirname(HERE)
const PORT = Number(process.argv[process.argv.indexOf('--port') + 1]) || 4422

const BUNDLE = path.join(ROOT, 'dist-plugin', 'corgi.plugin.mjs')
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
// ★ 包根 = 本站根。真宿主里 assetBase 是 https://host/games/corgi/，
//   图片在 <包根>assets/、音频清单与 sound.pack 在 <包根> 本身。
//   写成 /dist-plugin/ 的话 205 张图全 404 —— 那是**假宿主自己配错**，
//   不是插件的问题（这个坑踩过一次，别再把假 404 当线索）。
//   ⚠️ 这段注释在模板字符串里，**不能出现反引号**（会把外层模板提前闭合）。
const ctx = { assetBase: '/', assetUrl: (rel) => '/' + rel, locale: 'zh' }
const mod = await import('/dist-plugin/corgi.plugin.mjs')
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
  // ★ `--use-gl=swiftshader` 已被新版 Chrome 移除：缺这三件套 Phaser 会停在加载页且 0 报错
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

// `?playtest` ⇒ 游戏会装 `__MAKEPLAY_PLAYTEST__` 桥（真宿主里没有这个参数，桥不会出现）
await page.goto(`http://127.0.0.1:${PORT}/__mount.html?playtest`, { waitUntil: 'networkidle2', timeout: 90000 })
await page.waitForFunction('window.__ready === true', { timeout: 90000 })
await sleep(1200)

/* ---------------- ① 余额不足 ---------------- */
console.log('\n--- ① 余额 5 进场：必须挡在门外，一分不扣、不开 canvas ---')
const denied = await page.evaluate(() => ({
  spend: window.__calls.spend.length,
  balance: window.__state.balance,
  canvases: window.__container.querySelectorAll('canvas').length,
  gate: (window.__container.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 40),
  toast: window.__calls.toast.at(-1) ?? null,
}))
ok(denied.spend === 0, `没有发起扣款（spend 调用 ${denied.spend}）`)
ok(denied.balance === 5, `余额还是 5（实测 ${denied.balance}）`)
ok(denied.canvases === 0, `没开 canvas（实测 ${denied.canvases}）`)
ok(/积分不够/.test(denied.gate), `门上有「积分不够」（「${denied.gate}」）`)
ok(!!denied.toast && /积分/.test(JSON.stringify(denied.toast)), `弹了提示（${JSON.stringify(denied.toast)}）`)

/* ---------------- ② 余额够 ---------------- */
console.log('\n--- ② 余额 100 重挂：canvas 1 个、贴合容器、0 个 404、恰好扣 10 ---')
await page.evaluate(async () => {
  window.__state.balance = 100
  await window.__unmount()
  await new Promise((r) => setTimeout(r, 400))
  await window.__mount()
})
await page.waitForFunction('window.__gpPlayable === true', { timeout: 180000 }).catch(() => {})
await sleep(900)

const mounted = await page.evaluate(() => {
  const c = window.__container
  const cv = c.querySelector('canvas')
  const r = c.getBoundingClientRect()
  const pr = c.parentElement.getBoundingClientRect()
  const b = cv ? cv.getBoundingClientRect() : null
  const snap = window.__MAKEPLAY_PLAYTEST__?.snapshot?.() ?? null
  return {
    playable: window.__gpPlayable === true,
    canvases: c.querySelectorAll('canvas').length,
    canvasW: b ? Math.round(b.width) : 0,
    canvasH: b ? Math.round(b.height) : 0,
    boxW: Math.round(r.width),
    boxH: Math.round(r.height),
    parentH: Math.round(pr.height),
    mode: snap?.mode ?? null,
    loadPct: snap?.loadPct ?? null,
    // ★ 「canvas 在不在最上面」——尺寸全对、DOM 里也有，但被别的层盖住时，
    //   尺寸类断言全绿、画面却是空的。`elementFromPoint` 是唯一便宜的判据。
    topTag: (() => {
      const b = cv ? cv.getBoundingClientRect() : null
      if (!b) return null
      const el = document.elementFromPoint(Math.round(b.left + b.width / 2), Math.round(b.top + b.height / 2))
      return el ? el.tagName : null
    })(),
    spend: window.__calls.spend.length,
    last: window.__calls.spend.at(-1) ?? null,
    balance: window.__state.balance,
  }
})
ok(mounted.playable, '游戏报告可玩（__gpPlayable）')
ok(mounted.canvases === 1, `容器里 canvas 恰好 1 个（实测 ${mounted.canvases}）`)
// ★ 判据跟**父容器**比：跟 canvas 比的话两个数会一起错 ⇒ 全绿
ok(Math.abs(mounted.boxH - mounted.parentH) <= 2, `容器高 ${mounted.boxH} == 父容器高 ${mounted.parentH}（±2）`)
ok(Math.abs(mounted.canvasW - mounted.boxW) <= 2 && Math.abs(mounted.canvasH - mounted.boxH) <= 2,
  `canvas ${mounted.canvasW}×${mounted.canvasH} == 容器 ${mounted.boxW}×${mounted.boxH}（±2）`)
ok(bad.length === 0, `整轮 0 个 404（实测 ${bad.length}${bad.length ? '：' + bad.slice(0, 3).join(' | ') : ''}）`)
ok(mounted.topTag === 'CANVAS', `容器中心最上层是 canvas（实测 ${mounted.topTag}）—— 不是被背景层盖住`)
ok(mounted.mode === 'title', `首屏是标题页（mode=${mounted.mode}）`)
ok(mounted.spend === 1 && mounted.last?.n === 10, `恰好扣 1 次 10（spend=${mounted.spend} · n=${mounted.last?.n}）`)
ok(mounted.balance === 90, `余额 100 → 90（实测 ${mounted.balance}）`)
// ⚠️ `paidAt` 只能**卸载之后**读：`makeHostStore` 是「内存缓存 + 卸载时 flush」，
//    挂载期间宿主的 Map 里根本没有它。在挂载期间读宿主 Map 得到 null 是**正常**的，
//    拿它当「没写进去」的判据会误报（这一条已经误报过一次）。


/* ---------------- ③ 进主界面 ---------------- */
console.log('\n--- ③ 点「开始玩」进主界面 ---')
const played = await page.evaluate(async () => {
  window.__MAKEPLAY_PLAYTEST__.start()
  await new Promise((r) => setTimeout(r, 1200))
  const s = window.__MAKEPLAY_PLAYTEST__.snapshot()
  return { mode: s.mode, tab: s.tab, hearts: s.hearts, hps: s.hps }
})
ok(played.mode === 'play', `进主界面（mode=${played.mode}）`)
ok(played.tab === 0, `默认在第一个 tab（tab=${played.tab}）`)
ok(typeof played.hps === 'number' && played.hps > 0, `每秒产出算出来了（hps=${played.hps}）`)

// 存档诊断（只在失败时看得懂）
const saveDiag = await page.evaluate(() => window.__MAKEPLAY_PLAYTEST__.save())
console.log(`  · 存档诊断：${JSON.stringify(saveDiag)}`)

/* ---------------- ④ 玩到一半卸载 ---------------- */
console.log('\n--- ④ 玩到一半卸载：要收干净 ---')
const errBefore = pageErrors.length
const un = await page.evaluate(async () => {
  await window.__unmount()
  await new Promise((r) => setTimeout(r, 700))
  return {
    children: window.__container.childElementCount,
    canvases: window.__container.querySelectorAll('canvas').length,
    playable: typeof window.__gpPlayable,
    ready: typeof window.__gpReady,
    bridge: typeof window.__MAKEPLAY_PLAYTEST__,
    bgfill: document.querySelectorAll('#bgfill').length,
    // 卸载会 flush，这时候宿主的 Map 里才有东西
    paidAt: window.__store.get('paidAt') ?? null,
    slots: window.__store.get('slots') ?? null,
  }
})
ok(un.children === 0, `容器清空（剩 ${un.children} 个子节点）`)
ok(un.canvases === 0, `canvas 已移除（剩 ${un.canvases}）`)
ok(un.playable === 'undefined', `__gpPlayable 已摘（${un.playable}）`)
ok(un.ready === 'undefined', `__gpReady 已摘（${un.ready}）`)
ok(un.bridge === 'undefined', `__MAKEPLAY_PLAYTEST__ 已摘（${un.bridge}）`)
ok(un.bgfill === 0, `自己建的 #bgfill 已移除（剩 ${un.bgfill}）`)
ok(typeof un.paidAt === 'number' && Date.now() - un.paidAt < 120000,
  `paidAt 落盘了（${un.paidAt}，距今 ${un.paidAt ? Math.round((Date.now() - un.paidAt) / 1000) : '?'}s）`)
ok(Array.isArray(un.slots) && un.slots.some((s) => s.kind === 'auto'),
  `卸载时把游戏进度存进了 auto 槽（${Array.isArray(un.slots) ? un.slots.length : 0} 个槽位）`)
await sleep(400)
ok(pageErrors.length === errBefore, `卸载过程 0 个 pageerror（+${pageErrors.length - errBefore}）`)

/* ---------------- ⑤ 宽限期内重挂：不再扣 ---------------- */
console.log('\n--- ⑤ 10 分钟宽限内重挂：**不再扣款** ---')
const grace = await page.evaluate(async () => {
  const before = window.__calls.spend.length
  await window.__mount()
  await new Promise((r) => setTimeout(r, 2500))
  return {
    spendDelta: window.__calls.spend.length - before,
    balance: window.__state.balance,
    canvases: window.__container.querySelectorAll('canvas').length,
  }
})
ok(grace.spendDelta === 0, `没有重复扣款（spend +${grace.spendDelta}）`)
ok(grace.balance === 90, `余额还是 90（实测 ${grace.balance}）`)
ok(grace.canvases === 1, `画面正常（canvas ${grace.canvases}）`)

/* ---------------- ⑥ 宽限期过了：再扣一次 ---------------- */
console.log('\n--- ⑥ 把 paidAt 往前拨 11 分钟再重挂：又扣一次 ---')
const expired = await page.evaluate(async () => {
  // ★ 顺序不能反：**先卸载（flush）再写宿主 Map**。反过来的话下一次 flush
  //   会用插件缓存里的新值把它盖回去，测试会「过了但其实没测到」。
  await window.__unmount()
  await new Promise((r) => setTimeout(r, 400))
  window.__store.set('paidAt', Date.now() - 11 * 60 * 1000)
  const before = window.__calls.spend.length
  await window.__mount()
  await new Promise((r) => setTimeout(r, 2500))
  const spendDelta = window.__calls.spend.length - before
  const last = window.__calls.spend.at(-1) ?? null
  const balance = window.__state.balance
  // 新的 paidAt 要等这次卸载 flush 之后才在宿主 Map 里
  await window.__unmount()
  await new Promise((r) => setTimeout(r, 600))
  return { spendDelta, last, balance, paidAt: window.__store.get('paidAt') ?? 0 }
})
ok(expired.spendDelta === 1 && expired.last?.n === 10, `又扣了 1 次 10（+${expired.spendDelta} · n=${expired.last?.n}）`)
ok(expired.balance === 80, `余额 90 → 80（实测 ${expired.balance}）`)
ok(Date.now() - expired.paidAt < 60000, `paidAt 被刷新成现在（差 ${Math.round((Date.now() - expired.paidAt) / 1000)}s）`)

/* ---------------- ⑦ 存档真落盘 ---------------- */
console.log('\n--- ⑦ 涨爱心 → 卸载 → host.storage 里有 → 重挂读回来 ---')
// ⑥ 结尾卸载了，这里先挂回来
await page.evaluate(async () => { await window.__mount() })
await page.waitForFunction('window.__gpPlayable === true', { timeout: 180000 }).catch(() => {})
await sleep(600)
const before = await page.evaluate(async () => {
  window.__MAKEPLAY_PLAYTEST__.start()
  await new Promise((r) => setTimeout(r, 800))
  // setSeed(-201) = gain(1e7)，把爱心推到一个一眼能认出来的量级
  window.__MAKEPLAY_PLAYTEST__.setSeed(-201)
  await new Promise((r) => setTimeout(r, 1200))
  return { hearts: window.__MAKEPLAY_PLAYTEST__.snapshot().hearts }
})
const persisted = await page.evaluate(async () => {
  await window.__unmount() // ★ 卸载里才会「saveNow() + store.flush()」落盘
  await new Promise((r) => setTimeout(r, 700))
  const slots = window.__store.get('slots') ?? null
  const auto = Array.isArray(slots) ? slots.find((s) => s.kind === 'auto') : null
  await window.__mount()
  await new Promise((r) => setTimeout(r, 3000))
  const snap = window.__MAKEPLAY_PLAYTEST__?.snapshot?.() ?? null
  return {
    diskHearts: auto?.data?.hearts ?? null,
    diskSlots: Array.isArray(slots) ? slots.length : 0,
    hearts: snap?.hearts ?? null,
  }
})
ok(persisted.diskSlots > 0, `落盘了 ${persisted.diskSlots} 个槽位`)
ok(typeof persisted.diskHearts === 'number' && persisted.diskHearts >= before.hearts,
  `磁盘上的爱心 ${persisted.diskHearts} ≥ 卸载前 ${before.hearts}`)
ok(typeof persisted.hearts === 'number' && persisted.hearts >= before.hearts * 0.99,
  `重挂后读回 ${persisted.hearts}（卸载前 ${before.hearts}）`)

/* ---------------- ⑧ 第三次挂载 ---------------- */
console.log('\n--- ⑧ 第三次挂载：canvas 恒为 1（模块级状态没被毁） ---')
const third = await page.evaluate(async () => {
  await window.__unmount()
  await new Promise((r) => setTimeout(r, 500))
  await window.__mount()
})
// ★ 轮询状态，不写固定 sleep：headless 里游戏时钟比墙上时钟慢约 7×，
//   固定 3000ms 会偶发红（红的时候看着像「第三次挂载坏了」）。
await page.waitForFunction('window.__gpPlayable === true', { timeout: 120000 }).catch(() => {})
const thirdState = await page.evaluate(() => ({
  canvases: window.__container.querySelectorAll('canvas').length,
  playable: window.__gpPlayable === true,
}))
ok(thirdState.canvases === 1, `canvas 仍恰好 1 个（实测 ${thirdState.canvases}）`)
ok(thirdState.playable, `第三次挂载也可玩（__gpPlayable=${thirdState.playable}）`)

/* ---------------- ⑨ 不污染宿主 ---------------- */
console.log('\n--- ⑨ 不污染宿主页面 ---')
const hostClean = await page.evaluate(() => ({
  title: document.title,
  titleBefore: window.__titleBefore,
  lang: document.documentElement.lang,
  langBefore: window.__langBefore,
}))
ok(hostClean.title === hostClean.titleBefore, `document.title 没被改（「${hostClean.title}」）`)
ok(hostClean.lang === hostClean.langBefore, `<html lang> 没被改（${hostClean.lang}）`)

/* ---------------- 汇总 ---------------- */
await browser.close()
server.close()

console.log(`\n${fail.length ? '✗' : '✓'} ${fail.length ? fail.length + ' 条失败' : '全部通过'}`)
if (pageErrors.length) {
  console.log('\npageerror：')
  for (const e of pageErrors.slice(0, 8)) console.log('  · ' + e)
}
if (fail.length) {
  console.log('\n失败项：')
  for (const f of fail) console.log('  · ' + f)
  process.exit(1)
}
