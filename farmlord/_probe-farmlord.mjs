#!/usr/bin/env node
/**
 * farmlord 走查：新手引导能不能走完、农场到底有没有真的在跑。
 *
 * ## 为什么必须真点一遍
 *
 * `smoke.mjs` 只证明「首屏不是空白」。这一版把服务端换成了本地实现，
 * 最容易出的错不是崩，而是**静默算错**：
 *
 * - 地块没铺出来（服务端 `plots` 长度不对）⇒ 画面一片草，但 0 报错
 * - 播种成功但 `out` 永远是 null ⇒ 收了 0 个，还弹「+0」
 * - 引导卡在「等它熟」⇒ 看着像卡死，其实是小麦要 10 分钟
 *
 * 所以判据必须是**状态**，不是画面：
 * 引导走到 `done`、背包里真有麦子、刷新后引导不再重播。
 *
 * ## 点击为什么按 `.tut-ring` 而不是算坐标
 *
 * 引导每步会在目标上画一个高亮环（`tutorial.js` 的 `Qt()` 返回 `{x,y,w,h}`）。
 * 自己按 `plotPos + toScreen` 算一遍等于把相机公式抄第二份，
 * 相机一变（缩放 / 平移）就全错，而且错得很难看出来 —— 点了没反应。
 * 环是**游戏自己算的**，跟着它点永远对。
 */
import path from 'node:path'
import http from 'node:http'
import fs from 'node:fs'
import { existsSync, mkdirSync } from 'node:fs'

const GAME = path.resolve(process.argv[2] ?? 'E:/plan/test25/task-games/farmlord')
const OUT = path.join(GAME, 'shots')
mkdirSync(OUT, { recursive: true })

const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find((p) => existsSync(p))
if (!CHROME) {
  console.error('✗ 找不到 Chrome/Edge')
  process.exit(2)
}

let pass = 0
let fail = 0
const ok = (label, cond, detail = '') => {
  if (cond) {
    pass++
    console.log(`  ✓ ${label}${detail ? ` — ${detail}` : ''}`)
  } else {
    fail++
    console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`)
  }
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

/* ------------------------------- 静态服务 ------------------------------- */

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
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

/* ------------------------------- 浏览器 ------------------------------- */

const { default: puppeteer } = await import(
  'file:///E:/plan/test25/kid-quest-farm-online/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js'
)

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--window-size=420,880'],
})
const page = await browser.newPage()
await page.setViewport({ width: 420, height: 880, deviceScaleFactor: 1 })

const errors = []
page.on('pageerror', (e) => errors.push(String(e.message).slice(0, 200)))

/** 点高亮环的中心（引导当前步的目标） */
async function tapRing(tag) {
  const box = await page.evaluate(() => {
    const el = document.querySelector('.tut-ring')
    if (!el) return null
    const r = el.getBoundingClientRect()
    if (!r.width || !r.height) return null
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
  })
  if (!box) {
    console.log(`    · ${tag}: 没有 .tut-ring`)
    return false
  }
  await page.mouse.click(box.x, box.y)
  await wait(900)
  return true
}

/** 引导里的主按钮：`data-b="next"`。
 *  文案会变（中间是「下一步」、最后一步是「开始游戏」/`letsGo`），
 *  所以判据只能是这个属性，不能按文字找 —— 按文字找最后一步永远点不到。 */
async function next(tag) {
  const hit = await page.evaluate(() => {
    const btn = document.querySelector('#tut [data-b="next"]')
    if (!btn) return false
    btn.click()
    return true
  })
  if (!hit) console.log(`    · ${tag}: 没有 [data-b=next]`)
  await wait(1000)
  return hit
}

const state = () =>
  page.evaluate(() => {
    const h = window.__hh
    if (!h) return null
    const p = h.P
    const f = h.F
    return {
      tut: p?.tut ?? null,
      money: p?.money,
      gems: p?.gems,
      items: p?.items ?? {},
      seeds: p?.seeds ?? {},
      plots: f?.plots?.length ?? 0,
      planted: (f?.plots ?? []).filter((x) => x?.c).length,
      crop0: f?.plots?.[0]?.c ?? '',
      out0: f?.plots?.[0]?.out ?? null,
      /* `#tut` 是模块加载时就 append 的，**永远在 DOM 里**；
         显隐靠 `style.display`。所以判据只能是「可见性」，不是「存在」 */
      tutVisible: (() => {
        const el = document.querySelector('#tut')
        if (!el) return false
        return getComputedStyle(el).display !== 'none'
      })(),
      hudMoney: document.querySelector('#money')?.textContent,
    }
  })

try {
  await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForFunction('window.__hh && window.__hh.P', { timeout: 45000 })
  await wait(1500)

  console.log('\n【A】启动态')
  const s0 = await state()
  ok('农场铺出 6 块地', s0.plots === 6, `plots=${s0.plots}`)
  ok('启动资金 400 / 宝石 50', s0.money === 400 && s0.gems === 50, `${s0.money}/${s0.gems}`)
  ok('HUD 显示 400', s0.hudMoney === '400', `HUD=${s0.hudMoney}`)
  ok('引导层可见', s0.tutVisible === true)
  await page.screenshot({ path: path.join(OUT, 'probe-1-start.png') })

  console.log('\n【B】走引导')
  await next('welcome')
  await page.evaluate(() => document.querySelector('#tools [data-tool="seeds"]')?.click())
  await wait(900)
  await page.evaluate(() => document.querySelector('.pop .seed[data-id="wheat"]')?.click())
  await wait(900)
  await tapRing('plot')
  await wait(1200)

  const s1 = await state()
  ok('第一茬已经种下', s1.planted >= 1, `planted=${s1.planted} crop0=${s1.crop0}`)
  ok('种子扣掉了（6 → 5）', s1.seeds.wheat === 5, `seeds.wheat=${s1.seeds.wheat}`)
  await page.screenshot({ path: path.join(OUT, 'probe-2-planted.png') })

  /* 等「熟」那步 —— 本地服务端把第一茬的 p 往前拨了，所以应当立刻可收 */
  await wait(2500)
  await page.evaluate(() => document.querySelector('#tools [data-tool="hand"]')?.click())
  await wait(900)
  await tapRing('harvest')
  await wait(1500)

  const s2 = await state()
  ok('收成进了背包', (s2.items.wheat ?? 0) >= 1, `items.wheat=${s2.items.wheat ?? 0}`)
  ok('地清空了（一季作物收完就腾地）', s2.planted === 0, `planted=${s2.planted}`)
  await page.screenshot({ path: path.join(OUT, 'probe-3-harvested.png') })

  await next('done')
  /* 最后一步点完是 `Ce()`：先隐藏，再 1500ms 后才真正收尾 ⇒ 得等过它 */
  await wait(2600)
  const s3 = await state()
  ok('引导标记 done', s3.tut?.done === 1, `tut=${JSON.stringify(s3.tut)}`)
  ok('引导层已经收起', s3.tutVisible === false)
  await page.screenshot({ path: path.join(OUT, 'probe-4-done.png') })

  console.log('\n【C】刷新后不重播')
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForFunction('window.__hh && window.__hh.P', { timeout: 45000 })
  await wait(2000)
  const s4 = await state()
  ok('引导没重播（层不可见）', s4.tutVisible === false)
  ok('进度还在（tut.done=1）', s4.tut?.done === 1)
  ok('背包还在（麦子没丢）', (s4.items.wheat ?? 0) >= 1, `items.wheat=${s4.items.wheat ?? 0}`)
  ok('农场还是 6 块地', s4.plots === 6)
  await page.screenshot({ path: path.join(OUT, 'probe-5-reload.png') })

  console.log('\n【D】没有 JS 报错')
  ok('pageerror 为 0', errors.length === 0, errors.slice(0, 3).join(' | '))
} catch (e) {
  fail++
  console.log(`\n✗ 探针中断：${e.message}`)
  try {
    await page.screenshot({ path: path.join(OUT, 'probe-error.png') })
  } catch {}
} finally {
  await browser.close()
  srv.close()
  console.log(`\n结果：${pass} 通过 / ${fail} 失败`)
  process.exit(fail ? 1 : 0)
}
