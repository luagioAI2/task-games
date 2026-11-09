#!/usr/bin/env node
/**
 * 犬独 · 独立页的**玩法自检**（不需要宿主、不需要账号、不花积分）。
 *
 * ```bash
 * node scripts/play-check.mjs [--shots]
 * ```
 *
 * ## 它验的是「补丁还在不在」，不是「好不好玩」
 *
 * `game.js` 是压缩代码 + 一串字符串补丁（见 `scripts/patch-game.mjs`）。
 * 补丁丢了的症状全都**不报错**：
 *
 * | 症状 | 说明 |
 * | --- | --- |
 * | 白玩 | 扣分闸丢了，`__chargeCalls` 一直是空数组 |
 * | 每次都扣 | 闸门写错，重玩已通关的关卡还扣 |
 * | 商店是空的 | `__grant` 丢了，8 只狗永远解锁不了 |
 *
 * 所以这里直接读 `window.__chargeCalls` / `__debug.state`，**不看画面**。
 *
 * ## 判据为什么是「增量」而不是绝对值
 *
 * 存档是持久化的（独立页是内存版，但同一页内会留着）。跑第二遍时
 * `cleared` 里已经有第 1 关了，所以「开第 1 关」第二次**不该再扣**。
 * 因此每条断言都写 `before + 1` 这种增量式，而不是 `=== 1`。
 */
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const SHOTS = process.argv.includes('--shots')
const OUT = path.join(ROOT, 'shots')
if (SHOTS) fs.mkdirSync(OUT, { recursive: true })

const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find((p) => fs.existsSync(p))
if (!CHROME) {
  console.error('✗ 找不到 Chrome/Edge')
  process.exit(2)
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.m4a': 'audio/mp4',
  '.pack': 'application/octet-stream',
}

const srv = http.createServer((req, res) => {
  const url = decodeURIComponent((req.url || '/').split('?')[0])
  const rel = url === '/' ? '/index.html' : url
  const abs = path.join(ROOT, rel)
  if (!abs.startsWith(ROOT) || !fs.existsSync(abs) || fs.statSync(abs).isDirectory()) {
    res.writeHead(404).end('not found')
    return
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(abs)] || 'application/octet-stream' })
  fs.createReadStream(abs).pipe(res)
})
await new Promise((r) => srv.listen(0, '127.0.0.1', r))
const BASE = `http://127.0.0.1:${srv.address().port}`

const { default: puppeteer } = await import(
  'file:///E:/plan/test25/kid-quest-farm-online/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js'
)
const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--autoplay-policy=no-user-gesture-required'],
})

let pass = 0
let fail = 0
const ok = (label, cond, extra = '') => {
  if (cond) {
    pass++
    console.log(`  ✓ ${label}${extra ? `  ${extra}` : ''}`)
  } else {
    fail++
    console.log(`  ✗ ${label}${extra ? `  ${extra}` : ''}`)
  }
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

try {
  const page = await browser.newPage()
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 })
  const errs = []
  page.on('pageerror', (e) => errs.push(String(e.message || e)))
  page.on('requestfailed', (r) => {
    if (!r.url().includes('favicon')) errs.push(`请求失败 ${r.url()}`)
  })
  page.on('response', (r) => {
    if (r.status() >= 400 && !r.url().includes('favicon')) errs.push(`${r.status()} ${r.url()}`)
  })

  await page.goto(`${BASE}/?playtest=1`, { waitUntil: 'domcontentloaded' })
  await page.waitForFunction('window.__gpPlayable === true', { timeout: 30000 })
  await wait(600)

  const snap = () => page.evaluate(() => globalThis.__MAKEPLAY_PLAYTEST__?.snapshot() ?? null)
  const charges = () => page.evaluate(() => (window.__chargeCalls || []).slice())
  const state = () => page.evaluate(() => window.__debug?.state ?? null)
  const click = async (sel) => {
    const el = await page.$(sel)
    if (!el) return false
    await el.click()
    return true
  }
  const tapCell = async (cell) => {
    const p = await page.evaluate((c) => window.__debug?.cellPoint(c) ?? null, cell)
    if (!p) return false
    const box = await page.evaluate(() => {
      const c = document.querySelector('canvas').getBoundingClientRect()
      return { x: c.x, y: c.y }
    })
    await page.mouse.click(box.x + p.x, box.y + p.y)
    return true
  }

  /* ---------------- 首屏 ---------------- */
  console.log('\n=== 首屏 ===')
  let s = await snap()
  ok('进入标题页', s?.home === true, JSON.stringify({ home: s?.home, level: s?.level }))
  ok('12 项成就都渲染出来了', (await page.$$('.home-ach-item')).length === 12)
  if (SHOTS) await page.screenshot({ path: path.join(OUT, 'store-1-title.png') })

  /* ---------------- 开一关：要扣 1 次 ---------------- */
  console.log('\n=== 新开一关 ===')
  const before = (await charges()).length
  ok('点「关卡 1」', await click('[data-action="play"]'))
  await wait(700)
  s = await snap()
  ok('进入对局', s?.home === false, JSON.stringify({ phase: s?.phase, n: s?.n }))
  let after = (await charges()).length
  ok('新开一关扣了 1 次', after === before + 1, `${before} → ${after}`)
  ok('存档里记下了这一关', JSON.stringify((await state())?.paid ?? []).includes('lv:0'))

  /* ---------------- 落一只狗 ---------------- */
  console.log('\n=== 落子 ===')
  await click('[data-action="dog"]')
  await wait(200)
  const sol = await page.evaluate(() => window.__debug.levels[0].solution[0])
  ok('拿到第 1 关的答案格', typeof sol === 'number', `cell=${sol}`)
  await tapCell(sol)
  await wait(500)
  s = await snap()
  ok('放上了一只狗', s?.dogs === 1, `dogs=${s?.dogs}`)
  ok('没有误判', s?.mistakes === 0, `mistakes=${s?.mistakes}`)
  if (SHOTS) await page.screenshot({ path: path.join(OUT, 'store-2-play.png') })

  /* ---------------- 回首页再进同一关：不该再扣 ---------------- */
  console.log('\n=== 重进同一关 ===')
  await click('[data-action="home"]')
  await wait(400)
  const b2 = (await charges()).length
  await click('[data-action="play"]')
  await wait(600)
  const a2 = (await charges()).length
  ok('已付费的关卡重进不扣分', a2 === b2, `${b2} → ${a2}`)

  /* ---------------- 存档真的落了 ---------------- */
  console.log('\n=== 存档 ===')
  const st = await state()
  ok('存档里有 paid 记录', Array.isArray(st?.paid) && st.paid.includes('lv:0'), JSON.stringify(st?.paid))
  ok('存档里有 cleared / boards 字段', Array.isArray(st?.cleared) && !!st?.boards)

  /* ---------------- 页面干净 ---------------- */
  console.log('\n=== 控制台 ===')
  ok('0 个 pageerror', errs.filter((e) => !/请求失败|^4\d\d |^5\d\d /.test(e)).length === 0, errs.join(' | '))
  ok('0 个 4xx/5xx / 请求失败', errs.filter((e) => /请求失败|^4\d\d |^5\d\d /.test(e)).length === 0, errs.join(' | '))

  console.log(`\n结果：${fail === 0 ? '全过' : '有失败'}（${pass} 通过 / ${fail} 失败）`)
  if (SHOTS) console.log('截图目录：', OUT)
} catch (e) {
  console.error('\n✗ 探针中断：', e?.message || e)
  fail++
} finally {
  await browser.close()
  srv.close()
  process.exitCode = fail === 0 ? 0 : 1
}
