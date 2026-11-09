#!/usr/bin/env node
/**
 * 给商城详情页拍 4 张真机截图（`screenshots/store-*.png`）。
 *
 * ```bash
 * node scripts/capture.mjs            # 拍到 screenshots/
 * node scripts/capture.mjs 4411       # 换端口
 * ```
 *
 * 四张的**顺序就是详情页的顺序**：
 *   1 对局（塔 + HUD）· 2 标题页 · 3 结算页 · 4 暂停页
 * 第一张是「这是什么游戏」—— 一块块叠起来的彩色塔，不是标题字。
 *
 * ## 为什么不用 `page.mouse.click(195, 540)` 这种写死的坐标
 *
 * 界面是 **DOM**（`ui.js` 画的），所以按选择器/文字点就行 —— 换视口不会废。
 * 只有「放下积木」这一下必须点画布：那是游戏本体，靠 `window` 上的
 * `pointerdown` 触发。
 *
 * ## 为什么用 `__stackmeow.setDropX()` + 轮询 `stacked`
 *
 * 想让塔堆得高、还要有 PERFECT 连击，就得**控制落点**。等它自己滑到位再点
 * 是随机的（headless 下 4~6 fps，节奏完全对不上）。所以：把当前块的 x 设成
 * 塔顶中心 → 点一下 → 必然 PERFECT。
 *
 * ★ 每块落地都要**轮询 `stacked` 涨了**再点下一块。固定 `sleep` 在 headless 下
 *   不可靠（游戏时钟比墙钟慢约 7×），连发会被同帧合并 ⇒ 塔只长一半。
 *
 * ★ 判据不是「截到了图」，而是**每张图自己看一眼**：结构断言查不出
 *   「图是标题页、说明写的是结算页」。
 */
import { createServer } from 'node:http'
import { mkdir, readFile } from 'node:fs/promises'
import { extname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const PORT = Number(process.argv[2] ?? 4411)
const ROOT = resolve(import.meta.dirname ?? '.', '..')
const OUT = join(ROOT, 'screenshots')
const HOST_REPO = resolve(ROOT, '..', '..', 'kid-quest-farm-2d')

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.m4a': 'audio/mp4',
  '.pack': 'application/octet-stream',
}

const server = createServer(async (req, res) => {
  const url = decodeURIComponent((req.url ?? '/').split('?')[0])
  const file = join(ROOT, url === '/' ? 'index.html' : url)
  try {
    const buf = await readFile(file)
    res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' })
    res.end(buf)
  } catch {
    res.writeHead(404).end('not found')
  }
})
await new Promise((r) => server.listen(PORT, '127.0.0.1', r))

const puppeteer = (
  await import(
    pathToFileURL(join(HOST_REPO, 'node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js')).href
  )
).default

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
})
const page = await browser.newPage()
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 })
const errors = []
page.on('pageerror', (e) => errors.push(`pageerror ${e.message}`))
page.on('response', (r) => {
  if (r.status() >= 400 && !/favicon\.ico/.test(r.url())) errors.push(`${r.status()} ${r.url()}`)
})

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const state = () => page.evaluate(() => window.__stackmeow?.state?.() ?? null)
const waitFor = (fn, arg, timeout = 30000) =>
  page.waitForFunction(fn, { timeout, polling: 120 }, arg)

await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'domcontentloaded' })
await waitFor(() => window.__stackmeow?.state?.().ui === 'title', null, 60000)
await sleep(1200) // 标题页淡入收尾

await mkdir(OUT, { recursive: true })
const shot = async (n) => {
  const file = join(OUT, `store-${n}.png`)
  await page.screenshot({ path: file })
  console.log('  截图', file)
}

/** 按文字点 DOM 按钮（界面是 DOM 画的，别写死坐标） */
const clickBtn = async (label) => {
  const ok = await page.evaluate((text) => {
    const b = [...document.querySelectorAll('.uirt button')].find(
      (x) => x.textContent.trim() === text && x.offsetParent !== null,
    )
    if (!b) return false
    b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    return true
  }, label)
  if (!ok) throw new Error(`找不到按钮「${label}」`)
}

/** 连续 PERFECT：设落点 → 点画布 → 等 stacked 涨了再下一块 */
const stack = async (n) => {
  for (let i = 0; i < n; i++) {
    const before = (await state())?.stacked ?? 0
    const placed = await page.evaluate(() => {
      const b = window.__stackmeow
      if (!b || b.state().mode !== 1) return false
      b.setDropX(b.getCenter())
      return true
    })
    if (!placed) break
    await page.mouse.click(195, 500)
    await waitFor((k) => window.__stackmeow.state().stacked > k, before, 8000).catch(() => {})
    await sleep(420) // 拉开间距，别让「PERFECT」标签叠成一坨
  }
}

/** 把下一块放到塔外 ⇒ 整块落空 ⇒ 结算 */
const forceMiss = async () => {
  await page.evaluate(() => window.__stackmeow.setDropX(-400))
  await page.mouse.click(195, 500)
  await waitFor(() => window.__stackmeow?.state?.().mode === 2, null, 10000)
  await waitFor(() => window.__stackmeow?.state?.().ui === 'results', null, 10000)
  await sleep(900)
}

// ---- 热身一局：先把「最佳」打成 28，后面的图里数字才对得上 ----
await clickBtn('开始')
await waitFor(() => window.__stackmeow?.state?.().ui === 'game')
await stack(14)
await forceMiss()
await clickBtn('主页')
await waitFor(() => window.__stackmeow?.state?.().ui === 'title')
await sleep(900)

// ② 标题页
await shot(2)

// ① 对局：塔高 12 层 + PERFECT 连击
await clickBtn('开始')
await waitFor(() => window.__stackmeow?.state?.().ui === 'game')
await stack(12)
// 浮动文字的生命是 1.2s **游戏内**时间，headless 下约 7× 慢 ⇒ 等够再截
await sleep(9000)
await shot(1)

// ③ 结算页
await forceMiss()
await shot(3)

// ④ 暂停页
await clickBtn('再来一次')
await waitFor(() => window.__stackmeow?.state?.().ui === 'game')
await sleep(600)
await page.evaluate(() => {
  document
    .querySelector('.uirt .cornerbtn.left')
    ?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
})
await waitFor(() => window.__stackmeow?.state?.().ui === 'pause')
await sleep(500)
await shot(4)

console.log('最终状态', JSON.stringify(await state()))
console.log('异常', errors.length ? errors : '（无）')

await browser.close()
server.close()
if (errors.length) process.exit(1)
