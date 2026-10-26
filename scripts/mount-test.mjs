#!/usr/bin/env node
/**
 * 假宿主挂载测试 —— 在**真浏览器**里挂插件，断言 10 条。
 *
 * ```bash
 * node scripts/build-plugin.mjs && node scripts/mount-test.mjs
 * ```
 *
 * ## 为什么需要这一层
 *
 * `smoke.mjs` 验的是独立网页（整页）。孩子看到的是**宿主里那一块容器**：
 * 上面有顶栏、下面有底栏，游戏只占中间。这两件事在独立网页里永远不会暴露：
 *
 *   1. **`position:fixed` 会跑出容器**，盖住宿主顶栏（孩子点不到返回）。
 *      样式里原来有 9 处 `fixed`，靠 `scoped-css.js` 改成 `absolute` 才关得住。
 *   2. **`vw` / `vh` 是视口单位**，不是容器单位。`max-height: calc(100vh - 32px)`
 *      在平板里会让面板比容器还高，底部按钮被裁掉 —— 而「画布 == 容器」照样绿。
 *
 * 所以这里的假宿主故意做成「顶栏 56 + 底栏 64 + 中间容器」的形态，并且断言
 * `elementFromPoint(顶栏中心)` **仍然是顶栏**（不是游戏）。
 *
 * ## 判据为什么是像素
 *
 * PixiJS 把整个场景画在 canvas 里，`innerText` 恒空。只认截图的颜色种类数（< 20 判空白），
 * 而且必须 `clip` 到容器 —— 整页截图里宿主顶栏底栏自带一堆颜色，那个数恒真。
 */
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { countColors } from './lib/png-colors.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.dirname(HERE)
const HOST = path.resolve(ROOT, '..', '..', 'kid-quest-farm-2d')
const PORT = Number(process.env.PORT || 4409)
const BUNDLE = path.join(ROOT, 'dist-plugin', 'minergirl.plugin.mjs')
const OUT = path.join(ROOT, 'shots')
fs.mkdirSync(OUT, { recursive: true })

if (!fs.existsSync(BUNDLE)) { console.error('还没打包：node scripts/build-plugin.mjs'); process.exit(2) }

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp',
  '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.m4a': 'audio/mp4', '.pack': 'application/octet-stream',
}

const PAGE = `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="icon" href="data:,">
<style>
  html,body{margin:0;height:100%;background:#f7f3e8;font:600 14px system-ui,-apple-system,"PingFang SC",sans-serif}
  #top{position:absolute;left:0;right:0;top:0;height:56px;display:flex;align-items:center;justify-content:space-between;padding:0 16px;box-sizing:border-box;background:#fff;border-bottom:1px solid #e6ddc8;z-index:5}
  #nav{position:absolute;left:0;right:0;bottom:0;height:64px;display:flex;align-items:center;justify-content:space-around;background:#fff;border-top:1px solid #e6ddc8;z-index:5}
  /* 宿主真实布局：中间那块是 position:absolute inset:0 + 上下 padding */
  #host{position:absolute;left:0;right:0;top:56px;bottom:64px;overflow:hidden;background:#0b0d12}
  .pill{background:#f2c95c;border-radius:999px;padding:4px 12px}
</style></head><body>
<div id="top"><span class="pill">🪙 120</span><b>小任务农场</b><span class="pill">🎫 3</span></div>
<div id="host"></div>
<div id="nav"><span>任务</span><span>商店</span><span>我的</span></div>
<script type="module">
  const calls = { spend: [], toast: [], tone: [], haptic: 0 }
  const store = new Map()
  const host = {
    balance: () => Number(window.__balance ?? 120),
    spendPoints: async (n, memo) => { calls.spend.push([n, memo]); return true },
    mintGameCoin: async () => {}, spendGameCoin: async () => false, redeemGameCoin: async () => 0,
    mintVoucher: async () => 0, buyGameCoin: async () => false, gameCoinBalance: async () => 0,
    storage: {
      get: async (k) => store.get(k),
      set: async (k, v) => { if (v === null) store.delete(k); else store.set(k, v) },
      list: async () => Object.fromEntries(store),
    },
    pushToast: (t) => calls.toast.push(t), haptic: () => { calls.haptic++ }, tone: (k) => calls.tone.push(k),
  }
  const ctx = { assetBase: '/dist-plugin/', assetUrl: (rel) => '/dist-plugin/' + rel, locale: 'zh' }
  const mod = await import('/dist-plugin/minergirl.plugin.mjs')
  const c = document.getElementById('host')
  window.__t = { calls, store, mod, c, unmount: null }
  window.__mount = async () => { window.__t.unmount = await mod.mount(c, host, ctx) }
  window.__unmount = async () => { await window.__t.unmount?.(); window.__t.unmount = null }
  await window.__mount()
  window.__ready = true
</script></body></html>`

let hits4xx = 0
const fourOhFour = []
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x')
  if (url.pathname === '/__host.html') { res.writeHead(200, { 'content-type': MIME['.html'] }); res.end(PAGE); return }
  // 假宿主的资源根：/dist-plugin/* → 项目里的 dist-plugin/*
  const rel = url.pathname.startsWith('/dist-plugin/') ? url.pathname.slice('/dist-plugin/'.length) : null
  const p = rel !== null ? path.resolve(ROOT, 'dist-plugin', decodeURIComponent(rel)) : null
  if (!p || !p.startsWith(path.resolve(ROOT, 'dist-plugin')) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) {
    hits4xx++; if (fourOhFour.length < 12) fourOhFour.push(url.pathname)
    res.writeHead(404); res.end('not found'); return
  }
  res.writeHead(200, { 'content-type': MIME[path.extname(p).toLowerCase()] ?? 'application/octet-stream' })
  fs.createReadStream(p).pipe(res)
})
await new Promise((r) => server.listen(PORT, '127.0.0.1', r))

const puppeteer = (await import(pathToFileURL(path.join(HOST, 'node_modules', 'puppeteer-core', 'lib', 'puppeteer', 'puppeteer-core.js')).href)).default
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find((p) => fs.existsSync(p))
if (!CHROME) { console.error('找不到 Chrome'); process.exit(2) }

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'],
})

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const checks = []
const check = (name, ok, extra = '') => { checks.push({ name, ok }); console.log(`  ${ok ? '✓' : '✗'} ${name}${extra ? ' · ' + extra : ''}`) }

const page = await browser.newPage()
const pageErrors = []
page.on('pageerror', (e) => pageErrors.push(String(e.message).slice(0, 200)))

const boot = async () => {
  await page.goto(`http://127.0.0.1:${PORT}/__host.html`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForFunction('window.__ready === true', { timeout: 60000 }).catch(() => {})
  const ok = await page.waitForFunction('window.__gpPlayable === true', { timeout: 120000 }).then(() => true, () => false)
  await sleep(1500)
  return ok
}

const geometry = () => page.evaluate(() => {
  const root = document.getElementById('mng-root')
  const host = document.getElementById('host')
  const stage = root?.querySelector('#stage')
  const cv = stage?.querySelector('canvas')
  const r = (el) => { const b = el?.getBoundingClientRect?.(); return b ? { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) } : null }
  const top = document.getElementById('top').getBoundingClientRect()
  const nav = document.getElementById('nav').getBoundingClientRect()
  // 命中判定要按**祖先**算：顶栏里还有 <b> / <span>，直接比 tagName 会把「命中了顶栏的子节点」
  // 误判成「命中了游戏」（第一版就栽在这儿，红的其实是断言太严）。
  const at = (x, y) => {
    const el = document.elementFromPoint(x, y)
    if (!el) return null
    if (el.closest('#top')) return 'top'
    if (el.closest('#nav')) return 'nav'
    if (el.closest('#mng-root')) return 'game'
    return el.id || el.tagName
  }
  return {
    root: r(root), host: r(host), stage: r(stage), canvas: r(cv),
    rootPos: root ? getComputedStyle(root).position : null,
    hostPos: getComputedStyle(host).position,
    topHit: at(top.width / 2, top.top + top.height / 2),
    navHit: at(nav.width / 2, nav.top + nav.height / 2),
    css: document.querySelectorAll('style[data-mng-css]').length,
    canvases: root?.querySelectorAll('canvas').length ?? 0,
  }
})

const shot = async (name) => {
  const clip = await page.evaluate(() => { const b = document.getElementById('host').getBoundingClientRect(); return { x: b.x, y: b.y, width: b.width, height: b.height } })
  const png = await page.screenshot({ path: path.join(OUT, name), clip })
  return { png, colors: countColors(png) }
}

/* ══════════ ① 手机 390×844 ══════════ */
console.log('\n① 手机 390×844')
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 })
const up1 = await boot()
check('挂载成功（`__gpPlayable`）', up1)

const g1 = await geometry()
check('根在容器里且铺满', g1.root && g1.root.w === g1.host.w && g1.root.h === g1.host.h, `root ${g1.root?.w}×${g1.root?.h} · host ${g1.host?.w}×${g1.host?.h}`)
check('画布 == 容器', g1.canvas && Math.abs(g1.canvas.w - g1.host.w) <= 2 && Math.abs(g1.canvas.h - g1.host.h) <= 2, `canvas ${g1.canvas?.w}×${g1.canvas?.h}`)
check('★ 没盖住宿主顶栏（`fixed` 已改 `absolute`）', g1.topHit === 'top', `顶栏中心命中 ${g1.topHit}`)
check('★ 没盖住宿主底栏', g1.navHit === 'nav', `底栏中心命中 ${g1.navHit}`)
check('样式只注入一份', g1.css === 1, `${g1.css} 份`)

// ⚠️ 这条防的是「HTML 模板字符串被提前闭合」：dom.js 里整页 HTML 是一个反引号模板，
//    在里面写注释时手滑打一个反引号（例如给 slice 加引号）就会把它闭合，
//    后面的标签变成 JS 表达式。**`node --check` 照样通过**（尾部落到合法语法上），
//    症状是加载页只剩上半截、`#boot-error` 整个没了 —— 静默的。
//    所以这里必须查「模板末尾的节点在不在」，不能只查开头。
const domShape = await page.evaluate(() => ({
  loading: !!document.querySelector('#loading'),
  cage: !!document.querySelector('#loading .ld-cage'),
  bar: !!document.querySelector('#loading .ld-bar > i'),
  dust: !!document.querySelector('#loading .ld-dust'),
  bootErr: !!document.querySelector('#boot-error'),
}))
check('加载页结构完整（模板没被截断）',
  domShape.loading && domShape.cage && domShape.bar && domShape.dust && domShape.bootErr, JSON.stringify(domShape))

const s1 = await shot('host-1-phone.png')
check('画面画出来了（颜色种类）', s1.colors >= 20, `${s1.colors} 种 · shots/host-1-phone.png`)

// 进场扣费
const charge = await page.evaluate(() => window.__t.calls.spend.slice())
check('★ 进场扣了 15 积分', charge.length === 1 && charge[0][0] === 15, JSON.stringify(charge))

/* ══════════ ② 开面板：面板也不许盖住顶栏 ══════════ */
console.log('\n② 打开商城面板')
const opened = await page.evaluate(() => {
  const b = document.querySelector('#mng-root [data-act=shop]')
  if (!b) return null
  b.click()
  return true
})
check('商城按钮点得开', !!opened)
await sleep(600)
const panel = await page.evaluate(() => {
  const p = document.querySelector('#mng-root #panel')
  const top = document.getElementById('top').getBoundingClientRect()
  const nav = document.getElementById('nav').getBoundingClientRect()
  const at = (x, y) => {
    const el = document.elementFromPoint(x, y)
    if (!el) return null
    if (el.closest('#top')) return 'top'
    if (el.closest('#nav')) return 'nav'
    if (el.closest('#mng-root')) return 'game'
    return el.id || el.tagName
  }
  const card = p?.querySelector('.card')?.getBoundingClientRect()
  const host = document.getElementById('host').getBoundingClientRect()
  return {
    hidden: p?.hidden, topHit: at(top.width / 2, top.top + top.height / 2), navHit: at(nav.width / 2, nav.top + nav.height / 2),
    card: card ? { y: Math.round(card.y), h: Math.round(card.height) } : null,
    host: { y: Math.round(host.y), h: Math.round(host.height) },
  }
})
check('面板打开了', panel.hidden === false)
check('★ 面板没盖住顶栏', panel.topHit === 'top', `命中 ${panel.topHit}`)
check('★ 面板没盖住底栏', panel.navHit === 'nav', `命中 ${panel.navHit}`)
// 面板高度不能超过容器（`100vh` 换算成 `--mng-h` 的判据）
check('★ 面板没超出容器', panel.card && panel.card.h <= panel.host.h - 20, `卡片 ${panel.card?.h} · 容器 ${panel.host.h}`)
await shot('host-2-panel.png')

/* ══════════ ③ 皮肤页：门槛角标 ══════════ */
console.log('\n③ 皮肤页')
const skins = await page.evaluate(() => {
  const tab = document.querySelector('#mng-root [data-tab=skins]')
  if (!tab) return { ok: false }
  tab.click()
  return { ok: true }
})
await sleep(900)
const skinDom = await page.evaluate(() => {
  const tiles = [...document.querySelectorAll('#mng-root .sk-tile')]
  const locks = [...document.querySelectorAll('#mng-root .sk-pill .p-lock')].map((e) => e.textContent)
  const btn = document.querySelector('#mng-root .sk-act')
  return { tiles: tiles.length, locks, btn: btn?.textContent?.trim() ?? '' }
})
check('皮肤页有格子', skins.ok && skinDom.tiles > 0, `${skinDom.tiles} 格`)
check('★ 未解锁的显示门槛（不是硬币价）', skinDom.locks.length > 0 && skinDom.locks.every((s) => s.startsWith('$')), skinDom.locks.slice(0, 4).join(' '))
check('按钮文案是「还没解锁」', /还没解锁/.test(skinDom.btn), skinDom.btn)
await shot('host-3-skins.png')

/* ══════════ ④ 宽限：10 分钟内重挂不再扣 ══════════ */
console.log('\n④ 重挂（宽限内）')
await page.evaluate(() => window.__unmount())
await sleep(500)
const afterUnmount = await page.evaluate(() => ({
  css: document.querySelectorAll('style[data-mng-css]').length,
  root: !!document.getElementById('mng-root'),
  mng: typeof window.__mng,
  playable: typeof window.__gpPlayable,
}))
check('★ 卸载摘掉了样式', afterUnmount.css === 0, `${afterUnmount.css} 份`)
check('★ 卸载摘掉了根节点', afterUnmount.root === false)
check('★ 卸载摘掉了调试钩子', afterUnmount.mng === 'undefined' && afterUnmount.playable === 'undefined', `__mng=${afterUnmount.mng} __gpPlayable=${afterUnmount.playable}`)

await page.evaluate(() => window.__mount())
const up2 = await page.waitForFunction('window.__gpPlayable === true', { timeout: 120000 }).then(() => true, () => false)
await sleep(1200)
check('第二次挂载成功', up2)
const charge2 = await page.evaluate(() => window.__t.calls.spend.length)
check('★ 宽限内没重复扣（还是一次）', charge2 === 1, `扣了 ${charge2} 次`)
const g2 = await geometry()
check('第二次挂载后画布 == 容器', g2.canvas && Math.abs(g2.canvas.w - g2.host.w) <= 2 && Math.abs(g2.canvas.h - g2.host.h) <= 2, `canvas ${g2.canvas?.w}×${g2.canvas?.h}`)
const s2 = await shot('host-4-remount.png')
check('★ 切回来画面还在（不是白屏）', s2.colors >= 20, `${s2.colors} 种`)

/* ══════════ ⑤ 存档：改了要能读回来 ══════════ */
console.log('\n⑤ 存档往返')
const round = await page.evaluate(async () => {
  // 挑一个「点一下就能改、重挂载后能读回」的字段：语言
  window.__mng.game.setLanguage('en')
  await window.__unmount()
  const saved = window.__t.store.get('save')
  await window.__mount()
  await new Promise((r) => setTimeout(r, 1500))
  const got = window.__mng?.game?.save?.data?.lang
  return { saved: saved?.lang, got, text: document.querySelector('#mng-root .hud-cash small')?.textContent ?? '' }
})
check('★ 存档真的落盘了（语言）', round.saved === 'en' && round.got === 'en', `存 ${round.saved} · 读回 ${round.got}`)
check('★ 读回后界面真的换了语言', /idle income/i.test(round.text), round.text.slice(0, 40))

/* ══════════ ⑥ 平板 1024×768 ══════════ */
console.log('\n⑥ 平板 1024×768')
await page.evaluate(() => window.__unmount())
await page.setViewport({ width: 1024, height: 768, deviceScaleFactor: 2 })
await sleep(300)
await page.evaluate(() => window.__mount())
const up3 = await page.waitForFunction('window.__gpPlayable === true', { timeout: 120000 }).then(() => true, () => false)
await sleep(1500)
check('平板上挂载成功', up3)
const g3 = await geometry()
check('平板上画布 == 容器', g3.canvas && Math.abs(g3.canvas.w - g3.host.w) <= 2 && Math.abs(g3.canvas.h - g3.host.h) <= 2, `canvas ${g3.canvas?.w}×${g3.canvas?.h} · host ${g3.host?.w}×${g3.host?.h}`)
check('★ 平板上没盖住宿主顶栏', g3.topHit === 'top', `命中 ${g3.topHit}`)
const s3 = await shot('host-5-tablet.png')
check('平板上画面画出来了', s3.colors >= 20, `${s3.colors} 种 · shots/host-5-tablet.png`)

// 平板上的面板高度（vw/vh 换算的判据）
await page.evaluate(() => document.querySelector('#mng-root [data-act=shop]')?.click())
await sleep(700)
const padPanel = await page.evaluate(() => {
  const host = document.getElementById('host').getBoundingClientRect()
  const card = document.querySelector('#mng-root .card')?.getBoundingClientRect()
  const nav = document.getElementById('nav').getBoundingClientRect()
  const el = document.elementFromPoint(nav.width / 2, nav.top + nav.height / 2)
  return { host: Math.round(host.height), card: card ? Math.round(card.height) : null, navHit: el ? (el.closest('#nav') ? 'nav' : 'game') : null }
})
check('★ 平板上面板没超出容器', padPanel.card && padPanel.card <= padPanel.host - 20, `卡片 ${padPanel.card} · 容器 ${padPanel.host}`)
check('★ 平板上面板没盖住底栏', padPanel.navHit === 'nav', `命中 ${padPanel.navHit}`)
await shot('host-6-tablet-panel.png')

/* ══════════ ⑦ 网络 / 异常 ══════════ */
check('整轮 0 个 4xx/5xx', hits4xx === 0, hits4xx ? fourOhFour.join(' ') : '')
check('整轮 0 个未捕获异常', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '))

await browser.close()
server.close()

const bad = checks.filter((c) => !c.ok)
console.log(`\n${checks.length - bad.length}/${checks.length} 通过`)
if (bad.length) { console.error('=== 失败 ===\n' + bad.map((b) => ' - ' + b.name).join('\n') + '\n'); process.exit(1) }
console.log('=== 挂载测试通过 ===\n')
