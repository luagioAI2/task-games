#!/usr/bin/env node
/**
 * **假宿主**挂载测试 —— 打包之后的第二道运行时闸门（第一道是 `smoke.mjs` 验独立网页）。
 *
 * ```bash
 * node scripts/mount-test.mjs
 * ```
 *
 * 它替宿主回答五件静态扫描**判不了**的事：
 *
 * 1. **资源有没有真的走 `ctx.assetUrl`**。假宿主的 `assetUrl` 指向 `/dist-plugin/`，
 *    而测试页在 `/__mount-test.html`。所以任何漏走 `A()` 的路径会相对测试页解析
 *    ⇒ **404**。判据：整轮挂载 **0 个非 favicon 的 4xx**。
 *    ★ 这是唯一能验这件事的层：18 处 `assets/` 字面量在源码里是**故意**裸的
 *      （都在 `IMG` / `GLB_URLS` 表里，用到时才过 `A()`），静态数它们只会假阳性。
 *
 * 2. **开局闸门真的接上了**。余额 10（不够 15）⇒ 挂载必须**一分不扣**、只出一个
 *    「积分不够」的挡板、**不建 3D 场景**；余额 100 ⇒ 恰好扣 15 一次。
 *    ★ 反例很容易漏：把 `chargePlay()` 的 await 去掉，付不起也会进游戏，
 *      而画面看起来完全正常 —— 只有数 `spendPoints` 的调用次数能抓到。
 *
 * 3. **10 分钟宽限**。扣过一次之后卸载再挂，**不能再扣**（切 tab 做个任务就回来
 *    是常态，重复收费是 bug 不是特性）。宽限记在存档里，所以这条同时验了
 *    「`paidAt` 真的落盘了」。
 *
 * 4. **卸载真的收干净**，尤其是 3D 那一步：`forceContextLoss()` 不调的话，
 *    浏览器 WebGL 上下文有上限（通常 16），切几次之后新建上下文直接失败，
 *    **画面全黑而且不报错**。判据不是「canvas 没了」，而是
 *    **拿旧 canvas 的 gl 问 `isContextLost()`** —— canvas 摘掉了但上下文还活着
 *    照样是泄漏，而「canvas 数 = 0」完全看不出来。
 *
 * 5. **能挂第二次**。抓的是「卸载时把 GLB 模板 / 纹理一起销毁了」——
 *    `GLB_TEMPLATES` 是模块级缓存，卸载销毁了第二次就拿到已销毁的几何体，
 *    画面空白且**不报错**。
 */
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { countColors } from './lib/png-colors.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.dirname(HERE)
const PORT = Number(process.env.ANTHILL_TEST_PORT || 4403)

const BUNDLE = path.join(ROOT, 'dist-plugin', 'anthill.plugin.mjs')
if (!fs.existsSync(BUNDLE)) {
  console.error('还没打包：node scripts/build-plugin.mjs')
  process.exit(2)
}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.json': 'application/json', '.css': 'text/css', '.png': 'image/png',
  '.webp': 'image/webp', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.woff2': 'font/woff2',
  '.glb': 'model/gltf-binary', '.pack': 'application/octet-stream',
}

/** 测试页：一个铺满的容器 + 一个假宿主。**故意不注入任何 CSS** —— 宿主也不注入。 */
const PAGE = `<!doctype html><html><head><meta charset="utf-8">
<style>html,body{margin:0;height:100%}#host{position:absolute;inset:0}</style>
</head><body><div id="host"></div>
<script type="module">
const c = document.getElementById('host')
const store = new Map()
const calls = { spend: [], mint: 0, voucher: 0, toast: [] }
const state = { balance: 10 }
const host = {
  balance: () => state.balance,
  spendPoints: async (n, memo) => {
    if (state.balance < n) return false
    state.balance -= n
    calls.spend.push([n, memo])
    return true
  },
  mintGameCoin: async () => { calls.mint++ },
  spendGameCoin: async () => false,
  redeemGameCoin: async () => 0,
  mintVoucher: async () => { calls.voucher++; return 0 },
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

window.__calls = calls
window.__state = state
window.__store = store
const mod = await import('/dist-plugin/anthill.plugin.mjs')
window.__mod = mod
window.__mount = async () => { window.__unmount = await mod.mount(c, host, ctx) }
window.__unmount = await mod.mount(c, host, ctx)
window.__ready = true
</script></body></html>`

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x')
  if (url.pathname === '/__mount-test.html') {
    res.writeHead(200, { 'content-type': MIME['.html'] })
    res.end(PAGE)
    return
  }
  const p = path.join(ROOT, decodeURIComponent(url.pathname))
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) {
    res.writeHead(404)
    res.end('not found')
    return
  }
  res.writeHead(200, { 'content-type': MIME[path.extname(p).toLowerCase()] ?? 'application/octet-stream' })
  fs.createReadStream(p).pipe(res)
})
await new Promise((r) => server.listen(PORT, '127.0.0.1', r))

const puppeteer = await (async () => {
  const cands = [
    'puppeteer-core',
    path.join(ROOT, '..', '..', 'kid-quest-farm-2d', 'node_modules', 'puppeteer-core', 'lib', 'puppeteer', 'puppeteer-core.js'),
  ]
  for (const c of cands) {
    try {
      return (await import(c.startsWith('puppeteer') ? c : pathToFileURL(c).href)).default
    } catch {
      /* 下一个 */
    }
  }
  throw new Error('找不到 puppeteer-core')
})()
const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find((p) => fs.existsSync(p))
if (!CHROME) throw new Error('找不到 Chrome / Edge')

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  // `--use-gl=swiftshader` 已被新版 Chrome 移除（只剩一句 shader 取不到），三件套缺一不可
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    '--autoplay-policy=no-user-gesture-required'],
})
const page = await browser.newPage()
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 })

const bad = []
const pageErrors = []
page.on('response', (r) => { if (r.status() >= 400) bad.push(`${r.status()} ${r.url()}`) })
page.on('pageerror', (e) => pageErrors.push(String(e.message).slice(0, 200)))

const fail = []
const ok = (cond, msg) => { console.log((cond ? '  ok   ' : '  FAIL ') + msg); if (!cond) fail.push(msg) }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

console.log(`\n假宿主 ${ROOT}\n→ http://127.0.0.1:${PORT}/__mount-test.html\n`)

await page.goto(`http://127.0.0.1:${PORT}/__mount-test.html`, { waitUntil: 'networkidle2', timeout: 60000 })
await page.waitForFunction('window.__ready === true', { timeout: 60000 }).catch(() => {})
await sleep(2500)

console.log('--- ① 余额 10（不够 15）：必须挡在门外，一分不扣、不建 3D 场景 ---')
const poor = await page.evaluate(() => ({
  canvas: document.querySelectorAll('#host canvas').length,
  spend: window.__calls.spend.length,
  balance: window.__state.balance,
  toast: window.__calls.toast.map((t) => t.title),
  text: (document.getElementById('host').innerText || '').replace(/\s+/g, ' ').trim().slice(0, 60),
  gpReady: window.__gpReady === true,
}))
ok(poor.spend === 0, `spendPoints 一次都没调（调了 ${poor.spend} 次）`)
ok(poor.balance === 10, `余额没动（${poor.balance}）`)
ok(poor.canvas === 0, `没有建 3D 画布（${poor.canvas} 个）`)
ok(poor.toast.some((t) => /积分/.test(t || '')), `弹了「积分不够」提示（${poor.toast.join('/') || '无'}）`)
ok(/积分不够/.test(poor.text), `挡板上写了原因（"${poor.text}"）`)
ok(!poor.gpReady, '`__gpReady` 没有置位（没假装起来了）')

console.log('\n--- ② 余额 100：挂载必须恰好扣 15 一次 ---')
await page.evaluate(async () => { await window.__unmount(); window.__state.balance = 100 })
await sleep(600)
await page.evaluate(() => window.__mount())
await page.waitForFunction('window.__gpPlayable === true', { timeout: 40000 }).catch(() => {})
await sleep(1200)
const rich = await page.evaluate(() => ({
  spend: window.__calls.spend,
  balance: window.__state.balance,
  mint: window.__calls.mint,
  voucher: window.__calls.voucher,
  canvas: document.querySelectorAll('#host canvas').length,
  playable: window.__gpPlayable === true,
  hasUi: !!document.querySelector('#host #ui'),
}))
ok(rich.spend.length === 1, `spendPoints 恰好 1 次（${rich.spend.length} 次）`)
ok(rich.spend[0] && rich.spend[0][0] === 15, `扣的是 15（${rich.spend[0] ? rich.spend[0][0] : '—'}）`)
ok(rich.balance === 85, `余额 100 → 85（${rich.balance}）`)
ok(rich.mint === 0 && rich.voucher === 0, `没铸币、没发券（mint ${rich.mint} / voucher ${rich.voucher}）`)
ok(rich.canvas === 1, `3D 画布建起来了（${rich.canvas} 个）`)
ok(rich.playable, '`__gpPlayable` 已置位（资源加载完）')
ok(rich.hasUi, 'UI 层挂在**容器里**（不是 document.body）')

console.log('\n--- ③ 10 分钟宽限：卸载再挂，不能再扣一次 ---')
await page.evaluate(() => { window.__oldCanvas = document.querySelector('#host canvas'); window.__oldGl = window.__oldCanvas.getContext('webgl2') || window.__oldCanvas.getContext('webgl') })
await page.evaluate(() => window.__unmount())
await sleep(900)
await page.evaluate(() => window.__mount())
await page.waitForFunction('window.__gpPlayable === true', { timeout: 40000 }).catch(() => {})
await sleep(1200)
const grace = await page.evaluate(() => ({
  spend: window.__calls.spend.length,
  balance: window.__state.balance,
  canvas: document.querySelectorAll('#host canvas').length,
  paidAt: typeof window.__store.get('paidAt'),
}))
ok(grace.spend === 1, `宽限期内没有再扣（累计 ${grace.spend} 次）`)
ok(grace.balance === 85, `余额仍是 85（${grace.balance}）`)
ok(grace.paidAt === 'number', `\`paidAt\` 记在存档里（${grace.paidAt}）`)
ok(grace.canvas === 1, `第二次挂载画布还在（${grace.canvas} 个）`)

console.log('\n--- ④ 卸载要收干净（含 WebGL 上下文）---')
await page.evaluate(() => window.__unmount())
await sleep(1200)
const after = await page.evaluate(() => ({
  canvas: document.querySelectorAll('#host canvas').length,
  ui: document.querySelectorAll('#host #ui').length,
  gpReady: 'window.__gpReady' in window,
  gpPlayable: 'window.__gpPlayable' in window,
  ant: 'window.__ant' in window,
  styleTags: [...document.head.querySelectorAll('style')].filter((s) => /anthill-/.test(s.textContent || '')).length,
  hostStyle: document.getElementById('host').getAttribute('style') || '',
  contextLost: window.__oldGl ? window.__oldGl.isContextLost() : null,
}))
ok(after.canvas === 0, `canvas 已摘（剩 ${after.canvas}）`)
ok(after.ui === 0, `UI 层已摘（剩 ${after.ui}）`)
ok(!after.gpReady && !after.gpPlayable, '`__gpReady` / `__gpPlayable` 都已删')
ok(!after.ant, '`__ant` 调试钩子已删')
ok(after.styleTags === 0, `作用域 <style> 已摘（剩 ${after.styleTags} 个）`)
ok(!/touch-action/.test(after.hostStyle), `容器 inline 样式已还原（"${after.hostStyle}"）`)
ok(after.contextLost === true, `WebGL 上下文已释放（isContextLost = ${after.contextLost}）`)

console.log('\n--- ⑤ 能挂第三次（抓「卸载时把 GLB 模板一起销毁了」）---')
await page.evaluate(() => window.__mount())
await page.waitForFunction('window.__gpPlayable === true', { timeout: 40000 }).catch(() => {})
await sleep(1500)
const again = await page.evaluate(() => ({
  canvas: document.querySelectorAll('#host canvas').length,
  playable: window.__gpPlayable === true,
  items: window.__ant?.items?.length ?? -1,
  ants: window.__ant?.ants?.length ?? -1,
}))
ok(again.canvas === 1, `第三次挂载 canvas 为 1（${again.canvas}）`)
ok(again.playable, '第三次挂载也加载完了')
ok(again.items > 0, `世界重新建起来了（${again.items} 个食物）`)
ok(again.ants > 0, `蚂蚁也回来了（${again.ants} 只）`)

/*
 * ★ 画面「是不是黑的」只能看**合成后**的截图。
 *   three 默认 `preserveDrawingBuffer: false`，帧结束后 `drawImage(glCanvas)`
 *   读到的是未定义的 backbuffer（实测恒为 1 种颜色）—— 用它当判据会把
 *   **渲染完好**判成失败。见 `scripts/lib/png-colors.mjs` 的头注释。
 */
const shotPath = path.join(ROOT, 'shots', 'mount-test-3rd.png')
fs.mkdirSync(path.dirname(shotPath), { recursive: true })
const colors = countColors(await page.screenshot({ path: shotPath }))
ok(colors >= 20, `画面不是空白（截图颜色种类 ${colors}，<20 判空白）→ ${path.relative(ROOT, shotPath)}`)

const realBad = bad.filter((b) => !/favicon/.test(b))
console.log('\n--- ⑥ 网络 / 异常 ---')
ok(realBad.length === 0, `0 个非 favicon 的 4xx/5xx（${realBad.length}）${realBad.slice(0, 4).join(' | ')}`)
ok(pageErrors.length === 0, `0 个 pageerror（${pageErrors.length}）${pageErrors.slice(0, 2).join(' | ')}`)

await browser.close()
server.close()

console.log(fail.length ? `\n✗ ${fail.length} 条没过\n` : '\n✓ 全部通过\n')
process.exit(fail.length ? 1 : 0)
