#!/usr/bin/env node
/**
 * 拍商城用的四张图（`screenshots/store-1..4.png`，DPR 2）。
 *
 * ## 为什么不能直接拿 `shots/probe-*.png`
 *
 * 那些是**走查**图：带引导遮罩、带着「熟了！选手工具」的气泡，
 * 而且拍在引导第几步是随机的。商城详情页要的是「这游戏长什么样」，
 * 带一个盖住半屏的引导框等于什么都没说。
 *
 * ## 为什么要先「把农场摆好」
 *
 * 新档是 6 块空地 —— 拍出来是一片秃地，家长看不出这游戏在玩什么。
 * 所以先用**本地服务端自己的接口**把地种上（不同生长阶段），
 * 再喂一只鸡。这样四张图里每一张都有东西可看。
 *
 * ⚠️ 播种走 `post()` 而不是改内存：改内存就绕过了「种子够不够 / 土力够不够」
 * 这些真实校验，拍出来的状态是**服务器给不出来**的状态。
 */
import path from 'node:path'
import http from 'node:http'
import fs from 'node:fs'
import { existsSync, mkdirSync } from 'node:fs'

const GAME = path.resolve(process.argv[2] ?? 'E:/plan/test25/task-games/farmlord')
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
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.ico': 'image/x-icon',
}

const srv = http.createServer((req, res) => {
  let p = decodeURIComponent((req.url ?? '/').split('?')[0])
  if (/^[\\/]$/.test(p)) p = '/index.html'
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
const base = `http://127.0.0.1:${srv.address().port}/`

const { default: puppeteer } = await import(
  'file:///E:/plan/test25/kid-quest-farm-online/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js'
)

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
})
const page = await browser.newPage()
await page.setViewport({ width: 420, height: 880, deviceScaleFactor: 2 })

const wait = (ms) => new Promise((r) => setTimeout(r, ms))

/**
 * 等引导/提示层自己收起来。
 *
 * 提示是**按条件触发**的（比如「有化肥？」是在有肥又有作物时长出来的），
 * 键名散在 `tutorial.js` 里、还会随版本变，枚举不可靠。
 * 但它一定会自己收（`setTimeout(_t, vn)`）⇒ 等「不可见」比猜键名稳。
 *
 * 判据用 `getComputedStyle().display`：`#tut` 是模块加载时就 append 的，
 * 永远在 DOM 里，`!!querySelector('#tut')` 恒为真。
 */
async function waitTutHidden(timeout = 15000) {
  const t0 = Date.now()
  while (Date.now() - t0 < timeout) {
    const hidden = await page.evaluate(() => {
      const el = document.querySelector('#tut')
      if (!el) return true
      return getComputedStyle(el).display === 'none'
    })
    if (hidden) return true
    await wait(400)
  }
  console.log('  ! 提示层一直没收，照样拍')
  return false
}

const sheetCount = () => page.evaluate(() => document.querySelectorAll('.sheet').length)

/**
 * 打开商店并切到某个页签。
 *
 * ⚠️ **页签是开关，不是单选**：点「已经选中」的那个会把整个弹层关掉。
 * 之前就是这样拍成农场的 —— `点 #btn-shop` → 弹层开（默认已在种子页）→
 * 再点 `[data-tab=seeds]` → 弹层关 → 拍到的是一块地。
 * 所以只在**没选中**时才点。
 *
 * 判据一律用 `.sheet` 的**元素数量**：`#btn-shop` 点完不等于弹层开了
 * （引导气泡、上一张没关掉、点击落在遮罩上都可能吞掉这一下）。
 */
async function openShop(tab) {
  if (await sheetCount()) {
    await page.evaluate(() => document.querySelector('.sheet-h .x')?.click())
    await wait(500)
  }
  await page.evaluate(() => document.querySelector('#btn-shop')?.click())
  await wait(900)
  if (!(await sheetCount())) throw new Error('点了 #btn-shop，商店没开')

  const r = await page.evaluate((t) => {
    const b = document.querySelector(`.tabs button[data-tab="${t}"]`)
    if (!b) return 'missing'
    if (b.classList.contains('on')) return 'already'
    b.click()
    return 'clicked'
  }, tab)
  if (r === 'missing') throw new Error(`商店里没有 ${tab} 页签`)
  if (r === 'clicked') await wait(800)
  if (!(await sheetCount())) throw new Error(`切到 ${tab} 之后弹层被关掉了`)
  return r
}

/**
 * 拍一张。**弹层类截图先验「还在」** —— 错图比缺图更糟：
 * 一张「农场」被当成「商店」塞进商品详情页，看图的人根本发现不了。
 */
const shot = async (n, name, mustSheet = false) => {
  await waitTutHidden()
  await wait(400)
  if (mustSheet && !(await sheetCount())) {
    throw new Error(`${name}: 拍之前弹层已经没了`)
  }
  const file = path.join(OUT, `store-${n}-${name}.png`)
  await page.screenshot({ path: file })
  console.log(`  ✓ ${path.basename(file)}`)
}

try {
  await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForFunction('window.__hh && window.__hh.P', { timeout: 45000 })
  await wait(1500)

  /* ① 摆盘：关引导 + 种上不同阶段的作物 + 一只鸡 + 给够钱
   *
   * ⚠️ 这些做完**必须 reload**。两个原因：
   *   · 引导的步进机在页面加载时就把 `player.tut` 读进内存了（`j`），
   *     之后再 `POST /tut {done:1}` 只改了服务端，**正在跑的那一遍不会停**；
   *   · HUD 上的钱来自 `/hello` 那一次响应，改完 `me.money` 不重新拉就是旧值。
   * reload 之后看到的就是「一个回来继续玩的玩家」的界面 —— 也正是要拍的东西。
   */
  const planted = await page.evaluate(async () => {
    const s = window.__farmlord
    const st = s._state()

    await s.post('/tut', { step: 3 })
    await s.post('/tut', { done: 1 })

    /* 拍照用的摆盘，不是给玩家的初始状态 */
    st.me.money = 3000
    st.me.seeds = { wheat: 12, carrot: 8, corn: 6, tomato: 4, strawberry: 3 }
    st.me.feed = 3

    const plan = [
      { i: 0, seed: 'wheat', age: 1.35 },
      { i: 1, seed: 'wheat', age: 0.75 },
      { i: 2, seed: 'carrot', age: 1.5 },
      { i: 3, seed: 'corn', age: 0.5 },
      { i: 4, seed: 'tomato', age: 1.2 },
      { i: 5, seed: 'strawberry', age: 0.3 },
    ]
    const now = Date.now()
    for (const p of plan) {
      const r = await s.post(`/farm/local/plot/${p.i}/sow`, { seed: p.seed })
      if (!r.ok) continue
      const crop = window.__hh.data.crops.find((c) => c.id === p.seed)
      /* 把种下时刻往前拨：`age` 是「已经长了几个生长周期」 */
      st.farm.plots[p.i].p = now - Math.round(crop.grow * 60000 * p.age)
      st.farm.plots[p.i].s = p.age > 0.6 ? 1 : 0
    }

    /* 一只鸡（走商店，别直接塞 pens） */
    await s.post('/shop/buy', { kind: 'animal', id: 'chicken', n: 1 })
    if (st.farm.pens[0]) st.farm.pens[0].born = now - 40 * 60000

    /* 立刻落盘：reload 会从 localStorage 重新读 */
    s._flush()
    return st.farm.plots.filter((p) => p.c).length
  })
  console.log(`  摆好 ${planted} 块地`)

  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForFunction('window.__hh && window.__hh.P', { timeout: 45000 })
  await wait(3000)
  await shot(1, 'farm')

  /* ③ 商店 —— 种子页签（默认就在这一页，openShop 会跳过重复点击） */
  const r2 = await openShop('seeds')
  console.log(`  种子页签：${r2}`)
  await shot(2, 'shop-seeds', true)

  /* ④ 商店 —— 动物页签 */
  await openShop('animals')
  await shot(3, 'shop-animals', true)

  await page.evaluate(() => document.querySelector('.sheet-h .x')?.click())
  await wait(700)
  if (await sheetCount()) throw new Error('商店没关掉，邻居那张会被压在下面')

  /* ⑤ 邻居 */
  await page.evaluate(() => document.querySelector('#btn-friends')?.click())
  await wait(1400)
  await shot(4, 'neighbors', true)
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
