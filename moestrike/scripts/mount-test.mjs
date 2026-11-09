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
 *    测试页在 `/__mount-test.html`。所以任何漏走 `A()` 的路径会相对测试页解析
 *    ⇒ **404**。判据：整轮挂载 **0 个非 favicon 的 4xx**。
 *    ★ 这是唯一能验这件事的层：`data.js` 里那些 `assets/` 字面量是**故意**裸的
 *      （都在 `charArt()` / `GEM_ICON` 里，用到时才过 `A()`），静态数它们只会假阳性。
 *
 * 2. **开局闸门接在「出击」上，不是接在挂载上**。本作是关卡制，
 *    `mount()` **不收钱**（孩子切到这一格看一眼不该扣分）；钱在
 *    `enterBattle(n)` 里扣。所以：
 *      · 余额 5 ⇒ 挂载成功、`spendPoints` 0 次；点「出击」⇒ **一分不扣**、
 *        弹「积分不够」、**不进战斗**；
 *      · 余额 100 ⇒ 点「出击」⇒ 恰好扣 10、进战斗、`battle.turn >= 1`。
 *    ★ 反例很容易漏：把 `await chargePlay()` 的 await 去掉，付不起也会进游戏，
 *      画面看起来完全正常 —— 只有数 `spendPoints` 次数 + 读 `__mgs.battle` 能抓到。
 *
 * 3. **没有宽限期，这是设计**。放置类（蚂蚁搬家）靠「进场收费 + 10 分钟宽限」
 *    避免切 tab 反复扣钱；本作**每一场都是新的一场**，所以卸载再挂、再打一场
 *    必须**再扣一次**。这条断言的方向和 anthill 正好相反 —— 抄错就会把
 *    「重复收费」当成 bug 去修，或者把「该收费没收费」当成绿。
 *
 * 4. **卸载真的收干净**。PixiJS 的坑和 three 不同：这里没有 `forceContextLoss()`，
 *    但 `app.destroy()` **不能**销毁纹理（`core.js` 的 `texCache` 是模块级的，
 *    销毁之后第二次挂载拿到一堆已销毁的 Texture ⇒ 画面全白**且不报错**）。
 *    判据：canvas / `#ui` / 作用域 `<style>` / 容器 inline 样式 / 三个调试钩子全清。
 *
 * 5. **能挂第二次、第三次**。抓的就是第 4 条那个「纹理被一起销毁」的坑 ——
 *    第二次挂载画面空白且零报错，只能靠**截图颜色种类**抓（`<20` 判空白）。
 */
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { countColors } from './lib/png-colors.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.dirname(HERE)
const PORT = Number(process.env.MOESTRIKE_TEST_PORT || 4406)

const BUNDLE = path.join(ROOT, 'dist-plugin', 'moestrike.plugin.mjs')
if (!fs.existsSync(BUNDLE)) {
  console.error('还没打包：node scripts/build-plugin.mjs')
  process.exit(2)
}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.json': 'application/json', '.css': 'text/css', '.png': 'image/png',
  '.webp': 'image/webp', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.woff2': 'font/woff2',
  '.pack': 'application/octet-stream', '.wasm': 'application/wasm',
}

/** 测试页：一个铺满的容器 + 一个假宿主。**故意不注入任何 CSS** —— 宿主也不注入。 */
const PAGE = `<!doctype html><html><head><meta charset="utf-8">
<style>html,body{margin:0;height:100%}#host{position:absolute;inset:0}</style>
</head><body><div id="host"></div>
<script type="module">
const c = document.getElementById('host')
const store = new Map()
const calls = { spend: [], mint: 0, voucher: 0, toast: [] }
const state = { balance: 5 }
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
const mod = await import('/dist-plugin/moestrike.plugin.mjs')
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
// 存 message + 栈：只看 message 常常定不到位置（`reading 'screen'` 这种，
// 报的是库内部字段，光看字面猜不到是哪一行）
page.on('pageerror', (e) => pageErrors.push(`${String(e.message).slice(0, 200)} @ ${String(e.stack || '').split('\n').slice(1, 4).join(' | ')}`))

const fail = []
const ok = (cond, msg) => { console.log((cond ? '  ok   ' : '  FAIL ') + msg); if (!cond) fail.push(msg) }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/**
 * 点一个文字按钮。**必须真鼠标**：游戏 UI 的音效要求「从用户手势里解锁」，
 * 程序化 `el.click()` 没有手势 ⇒ 每次点击抛 `SoundRuntimeError`（pageerror 一片红）。
 * 顺带它走命中测试，被盖住会真的点不到（`el.click()` 会绕过命中测试 ⇒ 遮住也绿）。
 */
const tapText = async (txt, scope = '#ui') => {
  const box = await page.evaluate(([t, sc]) => {
    const el = [...document.querySelectorAll(`${sc} button, ${sc} .st, ${sc} .icon-btn, ${sc} .tap`)]
      .find((e) => { const s = (e.textContent || '').trim(); return s === t || s.startsWith(t) })
    if (!el) return null
    const r = el.getBoundingClientRect()
    if (!r.width || !r.height) return null
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
  }, [txt, scope])
  if (!box) return false
  await page.mouse.click(box.x, box.y)
  return true
}

/** 走到「确认出击」弹层：冒险 → 第 1 关。 */
const openStage1 = async () => {
  const a = await tapText('冒险')
  await sleep(700)
  const b = await tapText('1', '#ui .stages')
  await sleep(700)
  return a && b
}

console.log(`\n假宿主 ${ROOT}\n→ http://127.0.0.1:${PORT}/__mount-test.html\n`)

await page.goto(`http://127.0.0.1:${PORT}/__mount-test.html`, { waitUntil: 'networkidle2', timeout: 60000 })
await page.waitForFunction('window.__ready === true', { timeout: 90000 }).catch(() => {})
await sleep(1500)

console.log('--- ① 余额 5（不够 10）：挂载本身**不收费**，钱在「出击」那一刻 ---')
const mounted = await page.evaluate(() => ({
  canvas: document.querySelectorAll('#host canvas').length,
  spend: window.__calls.spend.length,
  balance: window.__state.balance,
  hasUi: !!document.querySelector('#host #ui'),
  playable: window.__gpPlayable === true,
  text: (document.getElementById('host').innerText || '').replace(/\s+/g, ' ').trim().slice(0, 60),
}))
ok(mounted.canvas === 1, `画布建起来了（${mounted.canvas} 个）`)
ok(mounted.hasUi, 'UI 层挂在**容器里**（不是 document.body）')
ok(mounted.playable, '`__gpPlayable` 已置位（资源加载完）')
ok(mounted.spend === 0, `挂载时一分没扣（spend ${mounted.spend} 次）`)
ok(/冒险/.test(mounted.text), `首页画出来了（"${mounted.text}"）`)

console.log('\n--- ② 余额 5 点「出击」：必须挡在门外，一分不扣、不进战斗 ---')
ok('能走到确认弹层', await openStage1())
const beforeDeny = await page.evaluate(() => ({ spend: window.__calls.spend.length, toast: window.__calls.toast.length }))
ok('点了出击', await tapText('出击', '#ui .modal'))
await sleep(1200)
const denied = await page.evaluate(() => ({
  spend: window.__calls.spend.length,
  balance: window.__state.balance,
  toast: window.__calls.toast.map((t) => t.title),
  battle: !!window.__mgs?.battle,
  text: (document.getElementById('host').innerText || '').replace(/\s+/g, ' ').trim().slice(0, 40),
}))
ok(denied.spend === beforeDeny.spend, `spendPoints 没被调用（${denied.spend} 次）`)
ok(denied.balance === 5, `余额没动（${denied.balance}）`)
ok(denied.toast.some((t) => /积分/.test(t || '')), `弹了「积分不够」提示（${denied.toast.join('/') || '无'}）`)
ok(!denied.battle, '没有建战斗（`__mgs.battle` 为 null）')
ok(/冒险/.test(denied.text), `被退回首页（"${denied.text}"）`)

console.log('\n--- ③ 余额 100 点「出击」：恰好扣 10、进战斗、回合跑起来 ---')
await page.evaluate(() => { window.__state.balance = 100 })
ok('能走到确认弹层', await openStage1())
ok('点了出击', await tapText('出击', '#ui .modal'))
await page.waitForFunction('!!window.__mgs?.battle', { timeout: 30000 }).catch(() => {})
await sleep(1500)
const paid = await page.evaluate(() => ({
  spend: window.__calls.spend,
  balance: window.__state.balance,
  mint: window.__calls.mint,
  voucher: window.__calls.voucher,
  turn: window.__mgs?.battle?.turn ?? -1,
  phase: window.__mgs?.battle?.phase ?? '(无)',
}))
ok(paid.spend.length === 1, `spendPoints 恰好 1 次（${paid.spend.length} 次）`)
ok(paid.spend[0] && paid.spend[0][0] === 10, `扣的是 10（${paid.spend[0] ? paid.spend[0][0] : '—'}）`)
ok(paid.balance === 90, `余额 100 → 90（${paid.balance}）`)
ok(paid.mint === 0 && paid.voucher === 0, `没铸币、没发券（mint ${paid.mint} / voucher ${paid.voucher}）`)
ok(paid.turn >= 1, `战斗第 1 回合已开始（turn=${paid.turn} / phase=${paid.phase}）`)

console.log('\n--- ④ 战斗中卸载：要收干净（含模块级纹理缓存那一坑）---')
await page.evaluate(() => window.__unmount())
await sleep(1500)
const after = await page.evaluate(() => ({
  canvas: document.querySelectorAll('#host canvas').length,
  ui: document.querySelectorAll('#host #ui').length,
  gpReady: 'window.__gpReady' in window,
  gpPlayable: 'window.__gpPlayable' in window,
  mgs: 'window.__mgs' in window,
  styleTags: [...document.head.querySelectorAll('style')].filter((s) => /moestrike-/.test(s.textContent || '')).length,
  hostStyle: document.getElementById('host').getAttribute('style') || '',
}))
ok(after.canvas === 0, `canvas 已摘（剩 ${after.canvas}）`)
ok(after.ui === 0, `UI 层已摘（剩 ${after.ui}）`)
ok(!after.gpReady && !after.gpPlayable, '`__gpReady` / `__gpPlayable` 都已删')
ok(!after.mgs, '`__mgs` 调试钩子已删')
ok(after.styleTags === 0, `作用域 <style> 已摘（剩 ${after.styleTags} 个）`)
ok(!/touch-action/.test(after.hostStyle), `容器 inline 样式已还原（"${after.hostStyle}"）`)

console.log('\n--- ⑤ 再挂一次 + 再打一场：**没有宽限期**，必须再扣一次（这是设计）---')
await page.evaluate(() => window.__mount())
await page.waitForFunction('window.__gpPlayable === true', { timeout: 60000 }).catch(() => {})
await sleep(1200)
const remount = await page.evaluate(() => ({
  canvas: document.querySelectorAll('#host canvas').length,
  spend: window.__calls.spend.length,
  balance: window.__state.balance,
}))
ok(remount.canvas === 1, `第二次挂载画布为 1（${remount.canvas}）`)
ok(remount.spend === 1, `重新挂载本身没有再扣（累计 ${remount.spend} 次）`)
ok('能走到确认弹层', await openStage1())
ok('点了出击', await tapText('出击', '#ui .modal'))
await page.waitForFunction('!!window.__mgs?.battle', { timeout: 30000 }).catch(() => {})
await sleep(1200)
const paid2 = await page.evaluate(() => ({ spend: window.__calls.spend.length, balance: window.__state.balance }))
ok(paid2.spend === 2, `第二场又扣了一次（累计 ${paid2.spend} 次）—— 本作没有宽限期`)
ok(paid2.balance === 80, `余额 90 → 80（${paid2.balance}）`)

/*
 * ★ 画面「是不是白的」只能看**合成后**的截图，而且**必须裁到容器**。
 *   · `drawImage(glCanvas)` 读到的是未定义 backbuffer（实测恒 1 种颜色）；
 *   · 不裁的话宿主顶栏 / 底栏的颜色会把计数撑起来 ⇒ **永远是绿的**。
 *   见 `scripts/lib/png-colors.mjs` 的头注释。
 */
const box = await page.evaluate(() => {
  const r = document.getElementById('host').getBoundingClientRect()
  return { x: r.x, y: r.y, width: r.width, height: r.height }
})
const shotPath = path.join(ROOT, 'shots', 'mount-test-2nd.png')
fs.mkdirSync(path.dirname(shotPath), { recursive: true })
const png = await page.screenshot({ path: shotPath, clip: box })
const colors = countColors(png)
ok(colors >= 20, `第二次挂载画面不是空白（裁到容器的颜色种类 ${colors}，<20 判空白）→ ${path.relative(ROOT, shotPath)}`)

console.log('\n--- ⑥ 第三次挂载（抓「卸载时把纹理一起销毁了」）---')
await page.evaluate(() => window.__unmount())
await sleep(900)
await page.evaluate(() => window.__mount())
await page.waitForFunction('window.__gpPlayable === true', { timeout: 60000 }).catch(() => {})
await sleep(1500)
const third = await page.evaluate(() => ({
  canvas: document.querySelectorAll('#host canvas').length,
  text: (document.getElementById('host').innerText || '').replace(/\s+/g, ' ').trim().slice(0, 40),
}))
const png3 = await page.screenshot({ path: path.join(ROOT, 'shots', 'mount-test-3rd.png'), clip: box })
const colors3 = countColors(png3)
ok(third.canvas === 1, `第三次挂载 canvas 为 1（${third.canvas}）`)
ok(/冒险/.test(third.text), `首页又画出来了（"${third.text}"）`)
ok(colors3 >= 20, `第三次挂载画面不是空白（颜色种类 ${colors3}）`)

const realBad = bad.filter((b) => !/favicon/.test(b))
console.log('\n--- ⑦ 网络 / 异常 ---')
ok(realBad.length === 0, `0 个非 favicon 的 4xx/5xx（${realBad.length}）${realBad.slice(0, 4).join(' | ')}`)
ok(pageErrors.length === 0, `0 个 pageerror（${pageErrors.length}）${pageErrors.slice(0, 2).join(' | ')}`)

await browser.close()
server.close()

console.log(fail.length ? `\n✗ ${fail.length} 条没过\n` : '\n✓ 全部通过\n')
process.exit(fail.length ? 1 : 0)
