#!/usr/bin/env node
/**
 * 拍 4 张商城图（390×844 DPR2，直接喂 `scripts/build-store-shots.py`）。
 *
 * ```bash
 * node scripts/capture.mjs
 * ```
 *
 * | 文件 | 画面 | 为什么要它 |
 * | --- | --- | --- |
 * | `store-1.png` | 标题页（笔记本封面 + 「开始」「选关」） | 详情页第一张必须回答「这是什么游戏」 |
 * | `store-2.png` | 第 1 关（球在空中飞向篮筐） | 核心玩法 |
 * | `store-3.png` | 新机关说明卡（「新元素：真空区」） | 40 个笔记本各有一种机关，这张讲清「每关都不一样」 |
 * | `store-4.png` | 后面某个机关关（冰面 / 激光 / 传送门） | 内容量：不是只有基础关 |
 *
 * ★ **不拍选关页**：整屏 5 个圆钮里 4 个是「未解锁」，放进商店像在展示「你玩不到」。
 *
 * ## 两个「看着绿其实没拍到」的坑
 *
 * 1. **等画面不能用固定 sleep**：4.3 MB 包在 headless + swiftshader 下要十几秒才起，
 *    固定 `sleep(6000)` 会拍到加载条（而且颜色数够多，走查也看不出是加载页）。
 *    判据是 `window.__hoopsneak.scene` 变成期望的那一屏。
 * 2. **进关不走收费路径**：这里直接调桥的 `startLevel(i)`（插件里那条收费路径
 *    由 e2e 验）。否则拍一张图就要花 10 积分。
 */
import { createServer } from 'node:http'
import { readFile, access, mkdir } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'
import { pathToFileURL } from 'node:url'

const ROOT = process.cwd()
const PORT = 4405
const OUT = 'screenshots'

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.woff2': 'font/woff2',
  '.m4a': 'audio/mp4',
  '.pack': 'application/octet-stream',
  '.png': 'image/png',
}

const srv = createServer(async (req, res) => {
  try {
    const p = normalize(decodeURIComponent(req.url.split('?')[0]))
    const rel = p === '/' || p === '\\' ? 'index.html' : p.replace(/^[\\/]+/, '')
    const buf = await readFile(join(ROOT, rel))
    res.writeHead(200, { 'content-type': MIME[extname(rel)] || 'application/octet-stream' })
    res.end(buf)
  } catch {
    res.writeHead(404).end('404')
  }
})
await new Promise((r) => srv.listen(PORT, '127.0.0.1', r))

const puppeteer = (
  await import(
    pathToFileURL('E:/plan/test25/kid-quest-farm-2d/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js').href
  )
).default

let exe = ''
for (const c of [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
]) {
  try {
    await access(c)
    exe = c
    break
  } catch {
    /* next */
  }
}
if (!exe) {
  console.error('找不到 Chrome / Edge')
  process.exit(2)
}

const browser = await puppeteer.launch({
  executablePath: exe,
  headless: true,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})
const page = await browser.newPage()
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 })

const errs = []
const notFound = []
page.on('pageerror', (e) => errs.push('pageerror: ' + e.message))
page.on('console', (m) => {
  if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 200))
})
// ★ 控制台那句「Failed to load resource: 404」**不带 URL**，只有 response 事件带。
// 所以这里不按 favicon 过滤，改成全部记下，收尾时把 favicon 单独列出来 ——
// 否则「2 个 404」既不知道是谁，也没法判断要不要修。
page.on('response', (r) => {
  if (r.status() >= 400) notFound.push(r.status() + ' ' + r.url())
})

await mkdir(OUT, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const shot = async (n) => {
  await page.screenshot({ path: join(OUT, n) })
  console.log('  拍', n)
}
const waitScene = (s, timeout = 90000) =>
  page.waitForFunction((x) => window.__hoopsneak?.scene === x, { timeout }, s).then(
    () => true,
    () => false,
  )
const go = (i, intro = false) => page.evaluate(({ i, intro }) => window.__hoopsneak.startLevel(i, intro), { i, intro })

await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'domcontentloaded' })
await waitScene('title')

// ① 标题页：等字体换进来 + 封面上的小人投一球（动画在跑，不是静止帧）
await sleep(2600)
await shot('store-1.png')

// ② 第 1 关：蓄力投一球，等球飞到半空再拍
await go(0)
await waitScene('play')
await sleep(1400)
// ★ 两个坑，都踩过：
//  1. **真实按住鼠标蓄不满力**。蓄力是「1.4 秒游戏时间 = 满」，headless 时钟慢 7×，
//     `sleep(650)` 只等于游戏内 0.09 秒 ⇒ power≈0.06，球基本垂直落地（拍出来还在手边）。
//     ⇒ 用桥的 beginCharge / setPower / release 给一个确定值。
//  2. **`sim.bx/by` 是 32×18 的网格单位，不是 1280×720 设计像素**。
//     拿设计像素当阈值（`x > 620`）永远不成立，而失败是静默的（只是「没等到」）。
await page.evaluate(() => {
  const b = window.__hoopsneak
  b.beginCharge()
  b.setPower(0.62)
  b.release()
})
// 出球点 x≈1.5、篮筐 x≈26（网格）⇒ 过 12 且还在半空（y < 13）就是飞行中
const flying = await page
  .waitForFunction(() => { const b = window.__hoopsneak?.ball; return b && b.x > 12 && b.y < 13 }, { timeout: 20000 })
  .then(() => true, () => false)
if (!flying) console.warn('    ⚠ 没等到球飞到半空（弹道太短 / 已经落地）')
await shot('store-2.png')
console.log('   球位置', await page.evaluate(() => window.__hoopsneak?.ball), 'phase', await page.evaluate(() => window.__hoopsneak?.phase))

// ③ 新机关说明卡（第 3 本笔记本「真空区」的第 1 关，会先弹一张卡）
await go(10, true)
await waitScene('play')
await sleep(2200)
await shot('store-3.png')

// ④ 后面某个机关关：冰面（第 23 本）—— 关卡里能看到冰面 / 机关块
await go(22)
await waitScene('play')
await sleep(2000)
await shot('store-4.png')

const fav = notFound.filter((s) => /favicon/.test(s))
const real = notFound.filter((s) => !/favicon/.test(s))
console.log('  资源 4xx：' + (real.length ? real.join('\n           ') : '无') + '（另有 favicon ' + fav.length + ' 条，无害）')
console.log('  错误', errs.length ? errs.slice(0, 6) : '无')
await browser.close()
srv.close()
