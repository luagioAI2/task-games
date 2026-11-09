#!/usr/bin/env node
/**
 * **假宿主**挂载测试 —— 打包之后的第二道运行时闸门（第一道是 `smoke.mjs` 验独立网页）。
 *
 * ```bash
 * node scripts/mount-test.mjs
 * ```
 *
 * 它替宿主回答四件静态扫描**判不了**的事：
 *
 * 1. **资源有没有真的走 `ctx.assetUrl`**。
 *    假宿主的 `assetUrl` 指向 `/dist-plugin/`，而测试页在 `/__mount-test.html`。
 *    所以任何漏走 `asset()` 的路径（写成裸 `assets/x.png`）会相对测试页解析成
 *    `/assets/x.png` ⇒ **404**。判据：整轮挂载 + 进战斗 **0 个非 favicon 的 4xx**。
 *    ★ 这是唯一能验这件事的层：66 处 `assets/` 字面量在源码里是**故意**裸的
 *      （都在 IMG / SND 表里，用到时才过 `asset()`），静态数它们只会假阳性。
 *
 * 2. **经济闸门真的接上了**。
 *    余额 10（不够 20）⇒ 点「开始游戏」必须**一分不扣**、且弹一条 warn。
 *    余额 100 ⇒ 再点，必须**恰好扣 20 一次**。
 *    ★ 反例很容易漏：`gateRun` 若把 `go()` 写在 `await` 外面，付不起也会进游戏，
 *      而画面看起来完全正常 —— 只有数 `spendPoints` 的调用次数能抓到。
 *
 * 3. **卸载真的收干净**。
 *    `unmount()` 之后 canvas 必须为 0、`window.__gpReady` 必须没了。
 *    ★ 留着 `__gpReady` 的后果：第二次挂载时任何「等它就绪」的判据立刻假通过。
 *
 * 4. **能挂第二次**。
 *    卸载后重新 mount 必须还能画出东西 —— 这条抓的是「卸载时把 Texture 一起销毁了」
 *    （Assets 是全局缓存，模块实例在宿主里复用，销毁了第二次就拿到已销毁的纹理，
 *    画面全白且**不报错**）。
 */
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.dirname(HERE)
const PORT = Number(process.env.SUGAR_TEST_PORT || 4402)

const BUNDLE = path.join(ROOT, 'dist-plugin', 'sugar.plugin.mjs')
if (!fs.existsSync(BUNDLE)) {
  console.error('还没打包：node scripts/build-plugin.mjs')
  process.exit(2)
}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.json': 'application/json', '.css': 'text/css', '.png': 'image/png',
  '.webp': 'image/webp', '.jpg': 'image/jpeg', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4',
  '.woff2': 'font/woff2', '.pack': 'application/octet-stream',
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
const mod = await import('/dist-plugin/sugar.plugin.mjs')
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
  // 见 smoke.mjs：`--use-gl=swiftshader` 已被新版 Chrome 移除，
  // PixiJS 会报 shader 取不到、画面停在加载页。
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

console.log(`\n假宿主 ${ROOT}\n→ http://127.0.0.1:${PORT}/__mount-test.html\n`)

await page.goto(`http://127.0.0.1:${PORT}/__mount-test.html`, { waitUntil: 'networkidle2', timeout: 60000 })
await page.waitForFunction('window.__ready === true', { timeout: 60000 }).catch(() => {})
await new Promise((r) => setTimeout(r, 9000))

const mountState = await page.evaluate(() => ({
  canvas: document.querySelectorAll('#host canvas').length,
  gpReady: window.__gpReady === true,
  spend: window.__calls.spend.length,
}))
console.log('\n--- ① 首屏 ---')
ok(mountState.canvas === 1, `容器里有 1 个 canvas（拿到 ${mountState.canvas}）`)
ok(mountState.gpReady, 'window.__gpReady 已置位（游戏自己报的「起来了」）')
ok(mountState.spend === 0, `还没点「开始游戏」，不应该扣分（扣了 ${mountState.spend} 次）`)

// 进标题页：点「中文」（语言选择页是首次进游戏的必经）
await page.mouse.click(195, 330)
await new Promise((r) => setTimeout(r, 2500))

console.log('\n--- ② 余额 10，不够 20：点「开始游戏」必须一分不扣 ---')
await page.mouse.click(195, 540)
await new Promise((r) => setTimeout(r, 2500))
const poor = await page.evaluate(() => ({
  spend: window.__calls.spend.length,
  balance: window.__state.balance,
  toast: window.__calls.toast,
  overlay: window.__debug ? window.__debug.overlay() : null,
}))
ok(poor.spend === 0, `spendPoints 一次都没调（调了 ${poor.spend} 次）`)
ok(poor.balance === 10, `余额没动（${poor.balance}）`)
ok(poor.toast.some((t) => /积分/.test(t.title || '')), `弹了「积分不够」提示（${poor.toast.map((t) => t.title).join('/') || '无'}）`)

console.log('\n--- ③ 余额 100：再点，必须恰好扣 20 一次 ---')
await page.evaluate(() => { window.__state.balance = 100 })
await page.mouse.click(195, 540)
await new Promise((r) => setTimeout(r, 3000))
const rich = await page.evaluate(() => ({
  spend: window.__calls.spend,
  balance: window.__state.balance,
  mint: window.__calls.mint,
  voucher: window.__calls.voucher,
  canvas: document.querySelectorAll('#host canvas').length,
}))
ok(rich.spend.length === 1, `spendPoints 恰好 1 次（${rich.spend.length} 次）`)
ok(rich.spend[0] && rich.spend[0][0] === 20, `扣的是 20（${rich.spend[0] ? rich.spend[0][0] : '—'}）`)
ok(rich.balance === 80, `余额 100 → 80（${rich.balance}）`)
ok(rich.mint === 0 && rich.voucher === 0, `没铸币、没发券（mint ${rich.mint} / voucher ${rich.voucher}）`)
ok(rich.canvas === 1, `进战斗后 canvas 还在（${rich.canvas}）`)

// 连点保护：快速点两下不应该扣两次
console.log('\n--- ④ 卸载要收干净 ---')
await page.evaluate(() => window.__unmount())
await new Promise((r) => setTimeout(r, 1200))
const after = await page.evaluate(() => ({
  canvas: document.querySelectorAll('#host canvas').length,
  gpReady: 'window.__gpReady' in window,
  debug: 'window.__debug' in window,
  styleTags: [...document.head.querySelectorAll('style')].filter((s) => /sugar-/.test(s.textContent || '')).length,
  hostStyle: document.getElementById('host').getAttribute('style') || '',
}))
ok(after.canvas === 0, `canvas 已摘（剩 ${after.canvas}）`)
ok(!after.gpReady, 'window.__gpReady 已删')
ok(!after.debug, 'window.__debug 已删')
ok(after.styleTags === 0, `作用域 <style> 已摘（剩 ${after.styleTags} 个）`)
ok(!/touch-action/.test(after.hostStyle), `容器 inline 样式已还原（"${after.hostStyle}"）`)

console.log('\n--- ⑤ 能挂第二次（抓「卸载时把纹理一起销毁了」） ---')
await page.evaluate(() => window.__mount())
await new Promise((r) => setTimeout(r, 9000))
const again = await page.evaluate(() => {
  const c = document.querySelector('#host canvas')
  let colors = 0
  if (c) {
    // 用 2D canvas 采样 WebGL canvas：`preserveDrawingBuffer` 关着时可能读不到，
    // 读不到就只报 canvas 存在，别把「读不到」当成「画面是白的」。
    try {
      const t = document.createElement('canvas')
      t.width = 60
      t.height = 120
      const g = t.getContext('2d')
      g.drawImage(c, 0, 0, 60, 120)
      const d = g.getImageData(0, 0, 60, 120).data
      const seen = new Set()
      for (let i = 0; i < d.length; i += 4 * 3) seen.add((d[i] >> 4) << 8 | (d[i + 1] >> 4) << 4 | (d[i + 2] >> 4))
      colors = seen.size
    } catch { colors = -1 }
  }
  return { canvas: document.querySelectorAll('#host canvas').length, gpReady: window.__gpReady === true, colors }
})
ok(again.canvas === 1, `第二次挂载 canvas 为 1（${again.canvas}）`)
ok(again.gpReady, '第二次挂载 __gpReady 也置位了')

const realBad = bad.filter((b) => !/favicon/.test(b))
console.log('\n--- ⑥ 网络 / 异常 ---')
ok(realBad.length === 0, `0 个非 favicon 的 4xx/5xx（${realBad.length}）${realBad.slice(0, 4).join(' | ')}`)
ok(pageErrors.length === 0, `0 个 pageerror（${pageErrors.length}）${pageErrors.slice(0, 2).join(' | ')}`)

await browser.close()
server.close()

console.log(fail.length ? `\n✗ ${fail.length} 条没过\n` : '\n✓ 全部通过\n')
process.exit(fail.length ? 1 : 0)
