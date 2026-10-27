#!/usr/bin/env node
/**
 * 假宿主挂载测试（五层验收的第 3 层）—— 不开真 App，只验插件本身。
 *
 * ```bash
 * node scripts/build-plugin.mjs && node scripts/mount-test.mjs
 * node scripts/mount-test.mjs --port 4410
 * ```
 *
 * ⚠️ 端口只能写 `--port <n>`，**位置参数会被静默忽略**
 *    （`indexOf('--port')` 返回 -1 ⇒ `argv[0]` 被当数字 ⇒ NaN ⇒ 回落默认值）。
 *
 * ## 为什么这层不能省
 *
 * 第 1 层（`check-plugin`）是静态的，第 2 层（lint / 单测）跑的是宿主代码 ——
 * **插件产物是另一份构建，两层都碰不到它**。这一层才第一次真的 `import()` 这个包、
 * 真的往容器里挂、真的点按钮扣积分。
 *
 * ## 判据（每条都能红）
 *
 * ① 挂载：容器里有 canvas、`__gpPlayable`、整轮 **0 个 404**
 * ② 余额不足：点「第 1 题」被挡住 —— **0 次扣款、不进对局**
 * ③ 余额够：**恰好扣 10**、进对局
 * ④ 对局中卸载：容器清空、调试钩子摘掉、0 个 pageerror
 * ⑤ 再挂再开：**再扣 10**（本作没有宽限期，这是设计）
 * ⑥ 通关 → 卸载 → 重挂：印章还在（`host.storage` 真的落盘了）
 * ⑦ 挂三次：canvas 数恒为 1（模块级状态没被上一次卸载毁掉）
 */
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.dirname(HERE)
const PORT = Number(process.argv[process.argv.indexOf('--port') + 1]) || 4410

const BUNDLE = path.join(ROOT, 'dist-plugin', 'blockfit.plugin.mjs')
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
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.m4a': 'audio/mp4',
  '.mp3': 'audio/mpeg',
  '.pack': 'application/octet-stream',
  '.wasm': 'application/wasm',
}

const PAGE = `<!doctype html><html><head><meta charset="utf-8">
<style>html,body{margin:0;height:100%;background:#2b2b2b}
#shell{position:absolute;inset:0;display:flex;flex-direction:column}
#top{height:56px;background:#3a3a3a;flex:none}
/* ★ 真宿主的结构：页面区是定位上下文，插件容器是 absolute inset-0。
   写成「容器自己 flex:1」的话，「容器高 == 父容器高」这条断言会误报。 */
#page{position:relative;flex:1;min-height:0}
#stage{position:absolute;inset:0}
#tabs{height:64px;background:#3a3a3a;flex:none}</style>
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
const ctx = { assetBase: '/dist-plugin/', assetUrl: (rel) => '/dist-plugin/' + rel, locale: 'zh' }
const mod = await import('/dist-plugin/blockfit.plugin.mjs')
window.__calls = calls
window.__state = state
window.__store = store
window.__mod = mod
window.__ctx = ctx
window.__container = c
window.__host = host
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
page.on('pageerror', (e) => pageErrors.push(String(e.message).slice(0, 200)))

const fail = []
const ok = (cond, msg) => {
  console.log((cond ? '  ok   ' : '  FAIL ') + msg)
  if (!cond) fail.push(msg)
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

await page.goto(`http://127.0.0.1:${PORT}/__mount.html`, { waitUntil: 'networkidle2', timeout: 60000 })
await page.waitForFunction('window.__ready === true', { timeout: 60000 })
// 等游戏自己报「可玩」：资源 + 音频清单都加载完才会置位
await page.waitForFunction('window.__gpPlayable === true', { timeout: 120000 }).catch(() => {})
await sleep(800)

/* ---------------- ① 挂载 ---------------- */
console.log('\n--- ① 挂载：容器里有画面、整轮 0 个 404 ---')
const mounted = await page.evaluate(() => {
  const c = window.__container
  const cv = c.querySelector('canvas')
  const r = c.getBoundingClientRect()
  const pr = c.parentElement.getBoundingClientRect()
  return {
    playable: window.__gpPlayable === true,
    canvases: c.querySelectorAll('canvas').length,
    canvasW: cv ? Math.round(cv.getBoundingClientRect().width) : 0,
    canvasH: cv ? Math.round(cv.getBoundingClientRect().height) : 0,
    boxW: Math.round(r.width),
    boxH: Math.round(r.height),
    parentH: Math.round(pr.height),
    scene: window.__debug?.state?.scene ?? null,
  }
})
ok(mounted.playable, '游戏报告可玩（__gpPlayable）')
ok(mounted.canvases === 1, `容器里 canvas 恰好 1 个（实测 ${mounted.canvases}）`)
// ★ 判据跟**父容器**比：跟 canvas 比的话两个数会一起错 ⇒ 全绿
ok(Math.abs(mounted.boxH - mounted.parentH) <= 2, `容器高 ${mounted.boxH} == 父容器高 ${mounted.parentH}（±2）`)
ok(Math.abs(mounted.canvasW - mounted.boxW) <= 2 && Math.abs(mounted.canvasH - mounted.boxH) <= 2,
  `canvas ${mounted.canvasW}×${mounted.canvasH} == 容器 ${mounted.boxW}×${mounted.boxH}（±2）`)
ok(bad.length === 0, `整轮 0 个 404（实测 ${bad.length}${bad.length ? '：' + bad.slice(0, 3).join(' | ') : ''}）`)
ok(mounted.scene === 'title', `首屏是标题页（scene=${mounted.scene}）`)

/* ---------------- ② 余额不足 ---------------- */
console.log('\n--- ② 余额 5 点「第 1 题」：必须挡在门外，一分不扣、不进对局 ---')
const denied = await page.evaluate(async () => {
  const before = window.__calls.spend.length
  await window.__debug.start(0)
  await new Promise((r) => setTimeout(r, 900))
  return {
    spendDelta: window.__calls.spend.length - before,
    balance: window.__state.balance,
    scene: window.__debug.state.scene,
    toast: window.__calls.toast.at(-1) ?? null,
  }
})
ok(denied.spendDelta === 0, `没有发起扣款（spend 调用 +${denied.spendDelta}）`)
ok(denied.balance === 5, `余额还是 5（实测 ${denied.balance}）`)
ok(denied.scene !== 'play', `没进对局（scene=${denied.scene}）`)
ok(!!denied.toast && /积分/.test(JSON.stringify(denied.toast)), `弹了「积分不够」提示（${JSON.stringify(denied.toast)}）`)

/* ---------------- ③ 余额够 ---------------- */
console.log('\n--- ③ 余额 100 点「第 1 题」：恰好扣 10、进对局 ---')
const paid = await page.evaluate(async () => {
  window.__state.balance = 100
  const before = window.__calls.spend.length
  await window.__debug.start(0)
  await new Promise((r) => setTimeout(r, 1400))
  return {
    spendDelta: window.__calls.spend.length - before,
    lastSpend: window.__calls.spend.at(-1) ?? null,
    balance: window.__state.balance,
    scene: window.__debug.state.scene,
    qIndex: window.__debug.state.qIndex,
    pieces: window.__debug.state.placed.length,
  }
})
ok(paid.spendDelta === 1, `只扣了 1 次（实测 ${paid.spendDelta}）`)
ok(paid.lastSpend?.n === 10, `扣的是 10 积分（实测 ${paid.lastSpend?.n}）`)
ok(paid.balance === 90, `余额 100 → 90（实测 ${paid.balance}）`)
ok(paid.scene === 'play', `进对局了（scene=${paid.scene}）`)
ok(paid.pieces >= 3, `棋盘上有 ${paid.pieces} 块拼片（不是空棋盘）`)

/* ---------------- ④ 对局中卸载 ---------------- */
console.log('\n--- ④ 对局中卸载：要收干净 ---')
const errBefore = pageErrors.length
const un = await page.evaluate(async () => {
  await window.__unmount()
  await new Promise((r) => setTimeout(r, 500))
  return {
    children: window.__container.childElementCount,
    playable: typeof window.__gpPlayable,
    ready: typeof window.__gpReady,
    debug: typeof window.__debug,
    app: typeof window.__app,
  }
})
ok(un.children === 0, `容器清空（剩 ${un.children} 个子节点）`)
ok(un.playable === 'undefined', `__gpPlayable 已摘（${un.playable}）`)
ok(un.ready === 'undefined', `__gpReady 已摘（${un.ready}）`)
ok(un.debug === 'undefined' && un.app === 'undefined', `调试钩子已摘（__debug=${un.debug} · __app=${un.app}）`)
await sleep(400)
ok(pageErrors.length === errBefore, `卸载过程 0 个 pageerror（+${pageErrors.length - errBefore}）`)

/* ---------------- ⑤ 再挂再开 ---------------- */
console.log('\n--- ⑤ 再挂一次 + 再开一局：**没有宽限期**，必须再扣 10 ---')
const again = await page.evaluate(async () => {
  window.__state.balance = 100
  const before = window.__calls.spend.length
  await window.__mount()
  await new Promise((r) => setTimeout(r, 1500))
  await window.__debug.start(0)
  await new Promise((r) => setTimeout(r, 1400))
  return {
    canvases: window.__container.querySelectorAll('canvas').length,
    spendDelta: window.__calls.spend.length - before,
    balance: window.__state.balance,
    scene: window.__debug?.state?.scene ?? null,
  }
})
ok(again.canvases === 1, `重挂后 canvas 仍恰好 1 个（实测 ${again.canvases}）`)
ok(again.scene === 'play', `重挂后能进对局（scene=${again.scene}）`)
ok(again.spendDelta === 1 && again.balance === 90, `再扣一次 10（spend +${again.spendDelta} · 余额 ${again.balance}）`)

/* ---------------- ⑥ 存档真的落盘 ---------------- */
console.log('\n--- ⑥ 通关 → 卸载 → 重挂：印章还在（host.storage 真落盘）---')
const solved = await page.evaluate(async () => {
  for (let i = 0; i < 40; i++) {
    if (!window.__debug.solveStep()) break
    await new Promise((r) => setTimeout(r, 60))
  }
  await new Promise((r) => setTimeout(r, 1200))
  return {
    solved: window.__debug.state.solved,
    stamps: window.__debug.state.stamps.slice(0, 3),
  }
})
ok(solved.solved, '第 1 题解开了')
ok((solved.stamps[0] ?? 0) > 0, `第 1 题拿到印章（${JSON.stringify(solved.stamps)}）`)

const persisted = await page.evaluate(async () => {
  await window.__unmount()          // ★ 卸载里才会 store.flush() 落盘
  await new Promise((r) => setTimeout(r, 500))
  const raw = window.__store.get('save') ?? null
  await window.__mount()
  await new Promise((r) => setTimeout(r, 1600))
  return {
    // ★ 印章在**玩家档案**里（`profiles[i].stamps`），顶层的 `save.stamps`
    //   是「有档案之前」的老档遗留字段 —— 读错了会得到一片 0，看着像没落盘。
    disk: raw ? (raw.profiles?.[0]?.stamps ?? null)?.slice(0, 3) ?? null : null,
    afterRemount: window.__debug?.state?.stamps?.slice(0, 3) ?? null,
  }
})
ok((persisted.disk?.[0] ?? 0) > 0, `落盘的那份存档里有印章（${JSON.stringify(persisted.disk)}）`)
ok((persisted.afterRemount?.[0] ?? 0) > 0, `重挂后读回来还在（${JSON.stringify(persisted.afterRemount)}）`)

/* ---------------- ⑦ 挂第三次 ---------------- */
console.log('\n--- ⑦ 再挂一次：canvas 数不涨 ---')
const third = await page.evaluate(async () => {
  await window.__unmount()
  await new Promise((r) => setTimeout(r, 400))
  await window.__mount()
  await new Promise((r) => setTimeout(r, 1500))
  return {
    canvases: window.__container.querySelectorAll('canvas').length,
    playable: window.__gpPlayable === true,
  }
})
ok(third.canvases === 1, `第三次挂载后 canvas 仍 1 个（实测 ${third.canvases}）`)
ok(third.playable, '第三次挂载仍然可玩')

ok(pageErrors.length === 0, `整轮 0 个 pageerror（实测 ${pageErrors.length}${pageErrors.length ? '：' + pageErrors.slice(0, 2).join(' | ') : ''}）`)
ok(bad.length === 0, `整轮 0 个 404（实测 ${bad.length}${bad.length ? '：' + bad.slice(0, 3).join(' | ') : ''}）`)

await browser.close()
server.close()

console.log(fail.length ? `\n✗ ${fail.length} 条不通过\n` : '\n=== 假宿主挂载测试全部通过 ===\n')
process.exit(fail.length ? 1 : 0)
