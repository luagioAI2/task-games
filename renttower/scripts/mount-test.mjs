#!/usr/bin/env node
/**
 * 假宿主挂载测试（五层验收的第 3 层）—— 不开真 App，只验插件本身。
 *
 * ```bash
 * CODEBUDDY_SAFE_DELETE_ENABLED=0 node scripts/build-plugin.mjs && node scripts/mount-test.mjs
 * node scripts/mount-test.mjs --port 4427
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
 * ## 本作的收费点：**进场**（放置经营没有「一局」）
 *
 * 所以判据是：
 *   · 余额不够 ⇒ **不建渲染器**，直接一块「积分不够」说明屏，0 次扣款
 *   · 余额够 ⇒ 恰好扣 1 次 10，游戏起来
 *   · 同一次挂载里不再扣
 *   · **卸载后立刻重挂不扣**（10 分钟宽限，`paidAt` 在存档里）
 *
 * ## 判据（每条都能红）
 *
 * ① 余额 3 挂载：0 次扣款、余额仍 3、容器里没有 canvas、有「积分不够」文案
 * ② 余额 100 挂载：恰好扣 1 次 10、canvas 1 个、贴合容器、截图颜色 ≥ 20
 * ③ 同一次挂载里等 2 秒：不再扣款
 * ④ 卸载 → 立刻重挂：**不扣款**（宽限期读的是存档里的 paidAt）
 * ⑤ 存档真落盘：`host.storage` 里有 save；重挂后 `money` 读回（只增不减）
 * ⑥ 卸载：容器清空、canvas 0、`__debug` 摘掉、宿主 title / lang 没被改、0 个 pageerror
 * ⑦ 第三次挂载：canvas 恒为 1
 */
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.dirname(HERE)
const PORT = Number(process.argv[process.argv.indexOf('--port') + 1]) || 4427

const BUNDLE = path.join(ROOT, 'dist-plugin', 'renttower.plugin.mjs')
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
const state = { balance: 3 }
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
// ★ 包根 = 本站根。真宿主里 assetBase 是 https://host/games/renttower/，
//   图片在 <包根>assets/、音频清单与 sound.pack 在 <包根> 本身。
const ctx = { assetBase: '/', assetUrl: (rel) => '/' + rel, locale: 'zh' }
const mod = await import('/dist-plugin/renttower.plugin.mjs')
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

const HOST_ROOT = path.join(ROOT, '..', '..', 'kid-quest-farm-2d')
const puppeteer = (await import(pathToFileURL(
  path.join(HOST_ROOT, 'node_modules', 'puppeteer-core', 'lib', 'puppeteer', 'puppeteer-core.js'),
).href)).default
const { countColors } = await import(pathToFileURL(
  path.join(HOST_ROOT, 'scripts', 'lib', 'png-colors.mjs'),
).href).catch(() => ({ countColors: null }))

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

/** 等游戏真的就绪：`__debug` 是 boot 最后一行挂的（加载页已经 done） */
async function waitReady(timeout = 120000) {
  await page.waitForFunction('window.__debug && typeof window.__debug.money === "number"', { timeout })
}

async function shotColors() {
  if (!countColors) return null
  const box = await page.evaluate(() => {
    const r = window.__container.getBoundingClientRect()
    return { x: Math.round(r.left), y: Math.round(r.top), width: Math.round(r.width), height: Math.round(r.height) }
  })
  const buf = await page.screenshot({ clip: box })
  return countColors(buf)
}

await page.goto(`http://127.0.0.1:${PORT}/__mount.html`, { waitUntil: 'domcontentloaded', timeout: 90000 })
await page.waitForFunction('window.__ready === true', { timeout: 120000 })
await sleep(800)

/* ---------------- ① 余额不够：不建渲染器 ---------------- */
console.log('\n--- ① 余额 3 挂载：0 次扣款、没有 canvas、看到「积分不够」 ---')
const denied = await page.evaluate(() => ({
  spend: window.__calls.spend.length,
  balance: window.__state.balance,
  canvases: window.__container.querySelectorAll('canvas').length,
  text: window.__container.innerText,
  bridge: typeof window.__debug,
}))
ok(denied.spend === 0, `一分没扣（spend=${denied.spend}）`)
ok(denied.balance === 3, `余额还是 3（实测 ${denied.balance}）`)
ok(denied.canvases === 0, `没建 canvas（实测 ${denied.canvases}）`)
ok(/积分不够/.test(denied.text), `看到「积分不够」说明（${JSON.stringify(denied.text.slice(0, 30))}）`)
ok(denied.bridge === 'undefined', `没挂调试桥（${denied.bridge}）`)

/* ---------------- ② 余额够：扣一次进场 ---------------- */
console.log('\n--- ② 余额 100 挂载：恰好扣 1 次 10、游戏起来 ---')
await page.evaluate(async () => {
  await window.__unmount()
  window.__state.balance = 100
  await window.__mount()
})
await waitReady()
await sleep(1200)
// 首屏压着教学浮层（1/9），中心点会被它的「开始」按钮占住 ——
// 先跳过教学再量几何，否则「中心最上层是 canvas」这条永远红。
await page.evaluate(() => { window.__debug.tutSkip?.() })
await sleep(900)
const mounted = await page.evaluate(() => {
  const c = window.__container
  const cv = c.querySelector('canvas')
  const r = c.getBoundingClientRect()
  const pr = c.parentElement.getBoundingClientRect()
  const b = cv ? cv.getBoundingClientRect() : null
  return {
    bridge: typeof window.__debug,
    canvases: c.querySelectorAll('canvas').length,
    canvasW: b ? Math.round(b.width) : 0,
    canvasH: b ? Math.round(b.height) : 0,
    boxW: Math.round(r.width),
    boxH: Math.round(r.height),
    parentH: Math.round(pr.height),
    spend: window.__calls.spend.length,
    spendTotal: window.__calls.spend.reduce((n, s) => n + s.n, 0),
    memo: window.__calls.spend.at(-1)?.memo ?? null,
    balance: window.__state.balance,
    money: window.__debug?.money ?? null,
    floors: window.__debug?.state?.floors ?? null,
    topTag: (() => {
      if (!b) return null
      const el = document.elementFromPoint(Math.round(b.left + b.width / 2), Math.round(b.top + b.height / 2))
      return el ? el.tagName : null
    })(),
  }
})
ok(mounted.bridge === 'object', `调试桥装上了（__debug: ${mounted.bridge}）`)
ok(mounted.spend === 1, `恰好扣 1 次（实测 ${mounted.spend}）`)
ok(mounted.spendTotal === 10, `扣了 10 积分（实测 ${mounted.spendTotal} · memo=${mounted.memo}）`)
ok(mounted.balance === 90, `余额 100 → 90（实测 ${mounted.balance}）`)
ok(mounted.canvases === 1, `容器里 canvas 恰好 1 个（实测 ${mounted.canvases}）`)
ok(Math.abs(mounted.boxH - mounted.parentH) <= 2, `容器高 ${mounted.boxH} == 父容器高 ${mounted.parentH}（±2）`)
ok(Math.abs(mounted.canvasW - mounted.boxW) <= 2 && Math.abs(mounted.canvasH - mounted.boxH) <= 2,
  `canvas ${mounted.canvasW}×${mounted.canvasH} == 容器 ${mounted.boxW}×${mounted.boxH}（±2）`)
ok(mounted.topTag === 'CANVAS', `容器中心最上层是 canvas（实测 ${mounted.topTag}）`)
ok(typeof mounted.money === 'number' && mounted.money > 0, `游戏在跑（money=${mounted.money}）`)
ok(bad.length === 0, `整轮 0 个 404（实测 ${bad.length}${bad.length ? '：' + bad.slice(0, 3).join(' | ') : ''}）`)

const colors = await shotColors()
if (colors === null) {
  console.log('  ·· 跳过颜色判据（没找到 png-colors.mjs）')
} else {
  ok(colors >= 20, `截图颜色种类 ${colors}（< 20 判空白）`)
}

/* ---------------- ③ 同一次挂载里不再扣 ---------------- */
console.log('\n--- ③ 同一次挂载里等 2 秒：不再扣款 ---')
await sleep(2000)
const same = await page.evaluate(() => ({ spend: window.__calls.spend.length, balance: window.__state.balance }))
ok(same.spend === 1, `还是 1 次（实测 ${same.spend}）`)
ok(same.balance === 90, `余额还是 90（实测 ${same.balance}）`)

/* ---------------- ④ 卸载 → 立刻重挂：宽限期 ---------------- */
console.log('\n--- ④ 卸载 → 立刻重挂：宽限期内不扣款 ---')
await page.evaluate(async () => {
  await window.__unmount()
  await new Promise((r) => setTimeout(r, 400))
  await window.__mount()
})
await waitReady()
await sleep(800)
const grace = await page.evaluate(() => ({
  spend: window.__calls.spend.length,
  balance: window.__state.balance,
  paidAt: window.__store.get('paidAt') ?? null,
  canvases: window.__container.querySelectorAll('canvas').length,
}))
ok(grace.spend === 1, `重挂**不再扣款**（spend=${grace.spend}）`)
ok(grace.balance === 90, `余额还是 90（实测 ${grace.balance}）`)
ok(!!grace.paidAt && Number(grace.paidAt) > 0, `paidAt 写在存档里（${grace.paidAt}）`)
ok(grace.canvases === 1, `重挂后 canvas 恰好 1 个（实测 ${grace.canvases}）`)

/* ---------------- ⑤ 存档真的落盘 ---------------- */
console.log('\n--- ⑤ 存档：改一个字段 → 卸载 → 重挂读回 ---')
const MARK = 7654321
await page.evaluate((v) => { window.__debug.setMoney(v); window.__debug.save() }, MARK)
await sleep(700)
const saved = await page.evaluate(async () => {
  await window.__unmount()
  await new Promise((r) => setTimeout(r, 600))
  return { raw: window.__store.get('save') ?? null }
})
ok(!!saved.raw, `host.storage 里有 save（${saved.raw ? String(saved.raw).slice(0, 50) + '…' : 'null'}）`)
await page.evaluate(async () => { await window.__mount() })
await waitReady()
await sleep(600)
const back = await page.evaluate(() => ({
  money: window.__debug.money,
  spend: window.__calls.spend.length,
}))
ok(back.money >= MARK, `重挂后 money 读回来了（${back.money} ≥ ${MARK}）`)
ok(back.spend === 1, `全程只扣过 1 次（spend=${back.spend}）`)

/* ---------------- ⑥ 卸载收干净 ---------------- */
console.log('\n--- ⑥ 卸载：容器清空、调试桥摘掉、宿主 title/lang 不变 ---')
const errBefore = pageErrors.length
const un = await page.evaluate(async () => {
  await window.__unmount()
  await new Promise((r) => setTimeout(r, 800))
  return {
    children: window.__container.childElementCount,
    canvases: window.__container.querySelectorAll('canvas').length,
    bridge: typeof window.__debug,
    playable: typeof window.__gpPlayable,
    title: document.title,
    titleBefore: window.__titleBefore,
    lang: document.documentElement.lang,
    langBefore: window.__langBefore,
    rootClass: window.__container.className,
  }
})
ok(un.children === 0, `容器清空（剩 ${un.children} 个子节点）`)
ok(un.canvases === 0, `canvas 已移除（剩 ${un.canvases}）`)
ok(un.bridge === 'undefined', `调试桥已摘（${un.bridge}）`)
ok(un.playable === 'undefined', `__gpPlayable 已摘（${un.playable}）`)
ok(un.title === un.titleBefore, `宿主的 document.title 没被改（「${un.title}」）`)
ok(un.lang === un.langBefore, `宿主的 <html lang> 没被改（${un.lang}）`)
ok(!/\bmp-root\b/.test(un.rootClass), `容器上的 mp-root 已摘（「${un.rootClass}」）`)
ok(pageErrors.length === errBefore, `卸载过程 0 个 pageerror（+${pageErrors.length - errBefore}）`)

/* ---------------- ⑦ 第三次挂载 ---------------- */
console.log('\n--- ⑦ 再挂一次：canvas 恒为 1 ---')
await page.evaluate(async () => { await window.__mount() })
await waitReady()
await sleep(800)
const third = await page.evaluate(() => ({
  canvases: window.__container.querySelectorAll('canvas').length,
  money: window.__debug.money,
  spend: window.__calls.spend.length,
  balance: window.__state.balance,
}))
ok(third.canvases === 1, `canvas 恰好 1 个（实测 ${third.canvases}）`)
ok(third.money >= MARK, `进度还在（money=${third.money}）`)
ok(third.spend === 1, `全程只扣过 1 次（spend=${third.spend}）`)

/* ---------------- 汇总 ---------------- */
console.log('\n=== 结果 ===')
if (bad.length) console.log('4xx/5xx：', bad.slice(0, 6))
if (pageErrors.length) console.log('pageerror：', pageErrors.slice(0, 3))
console.log(fail.length ? `✗ ${fail.length} 条失败` : '✓ 全部通过')

await browser.close()
server.close()
process.exit(fail.length ? 1 : 0)
