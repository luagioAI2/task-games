#!/usr/bin/env node
/**
 * 犬独 · 商城截图（4 张，直接从游戏里拍，不用手画）。
 *
 * ```bash
 * node scripts/store-shots.mjs
 * ```
 *
 * 产物：`screenshots/store-{1..4}-*.png`，再由宿主的
 * `scripts/build-store-shots.py` 转成 `public/store/inudoku/*.webp`。
 *
 * ## 为什么不用「摆拍」
 *
 * 商城详情页那 4 张图是家长决定买不买的地方。手画的示意图会被当成
 * 实际画面，家长点进来发现不是那样，就是不信任 —— 所以**一律从真游戏里拍**。
 *
 * ## 每一张的等待判据
 *
 * 只等「元素出现」不够：Pixi 是逐帧画的，DOM 按钮先出来、画布可能还没画完。
 * 所以每张都等 `__MAKEPLAY_PLAYTEST__.snapshot()` 里的**状态字段**
 * （`home` / `phase` / `modal`），再额外等 400 ms 让 tween 落定。
 */
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const OUT = path.join(ROOT, 'screenshots')
fs.mkdirSync(OUT, { recursive: true })

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
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
})

const wait = (ms) => new Promise((r) => setTimeout(r, ms))

try {
  const page = await browser.newPage()
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 })
  await page.goto(`${BASE}/?playtest=1`, { waitUntil: 'domcontentloaded' })
  await page.waitForFunction('window.__gpPlayable === true', { timeout: 30000 })
  await wait(900)

  const snap = () => page.evaluate(() => globalThis.__MAKEPLAY_PLAYTEST__?.snapshot() ?? null)
  const click = async (sel) => {
    const el = await page.$(sel)
    if (!el) throw new Error(`点不到 ${sel}`)
    await el.click()
    await wait(450)
  }
  const tapCell = async (cell) => {
    const p = await page.evaluate((c) => window.__debug.cellPoint(c), cell)
    const box = await page.evaluate(() => {
      const c = document.querySelector('canvas').getBoundingClientRect()
      return { x: c.x, y: c.y }
    })
    await page.mouse.click(box.x + p.x, box.y + p.y)
    await wait(260)
  }

  /* ---------- 1) 标题页 ---------- */
  let s = await snap()
  if (!s?.home) throw new Error('没停在标题页')
  /*
   * ★ 等成就图标真的解码完再拍。
   * 那 12 张是 `loading="lazy"` 的 webp，DOM 已经在了但位图还没到 ——
   * 早拍会得到「名字在、图标是空白」的一张，而且**每次跑空白的位置还不一样**
   * （看起来像 CSS 坏了，其实只是拍早了）。
   */
  await page
    .waitForFunction(
      () => {
        const imgs = [...document.querySelectorAll('.home-ach-item img')]
        return imgs.length > 0 && imgs.every((i) => i.complete && i.naturalWidth > 0)
      },
      { timeout: 8000 },
    )
    .catch(() => console.warn('  ! 成就图标没在 8 秒内全部解码，照拍'))
  await wait(200)
  await page.screenshot({ path: path.join(OUT, 'store-1-title.png') })
  console.log('  ✓ store-1-title.png  (标题：完成度 / 成就墙 / 三颗入口按钮)')

  /* ---------- 2) 对局：落 3 只狗（留一格没落，不然就通关弹结算了），画面才不空 ---------- */
  await click('[data-action="play"]')
  const sol = await page.evaluate(() => {
    const lv = window.__debug.levels[0]
    // solution[col] = row ⇒ cell = col*n + row
    return lv.solution.map((row, col) => col * lv.n + row)
  })
  for (const cell of sol.slice(0, 3)) {
    /*
     * ★ 每落一只狗都要**重新点一次「放小狗」**。
     * 原版放对一只之后会把模式自动切回「笔记」（`en()` 里 `t.mode="note"`），
     * 不切回去的话后面几下全变成画叉 —— 截图里就只有一只狗。
     */
    await click('[data-action="dog"]')
    await tapCell(cell)
  }
  s = await snap()
  if (s?.dogs !== 3) throw new Error(`只落了 ${s?.dogs} 只狗`)
  await page.screenshot({ path: path.join(OUT, 'store-2-play.png') })
  console.log('  ✓ store-2-play.png  (对局：区域配色 / 小狗 / 生命 / 规则条)')

  /* ---------- 3) 皮肤 ---------- */
  /* 对局页没有「首页」按钮 —— 要先进设置，那里才有 */
  await click('[data-action="settings"]')
  await click('[data-action="home"]')
  await click('[data-action="breeds"]')
  s = await snap()
  if (s?.modal !== 'breeds') throw new Error(`没打开皮肤面板（modal=${s?.modal}）`)
  await page.screenshot({ path: path.join(OUT, 'store-3-breeds.png') })
  console.log('  ✓ store-3-breeds.png  (8 只狗耳朵皮肤 + 解锁说明)')

  /* ---------- 4) 设置：BGM 列表 ---------- */
  await click('[data-action="close"]')
  await click('[data-action="settings"]')
  s = await snap()
  if (s?.modal !== 'settings') throw new Error(`没打开设置（modal=${s?.modal}）`)
  await page.screenshot({ path: path.join(OUT, 'store-4-settings.png') })
  console.log('  ✓ store-4-settings.png  (设置：音乐 / 音效 / 4 首 BGM / 语言)')

  console.log('\n截图目录：', OUT)
} catch (e) {
  console.error('\n✗ 截图中断：', e?.message || e)
  process.exitCode = 1
} finally {
  await browser.close()
  srv.close()
}
