#!/usr/bin/env node
/**
 * 拍商城详情页要用的 4 张图 → `screenshots/store-1..4.png`。
 *
 * ```bash
 * node scripts/capture.mjs                # 390×844（手机竖屏，商城详情就是按这个比例看的）
 * node scripts/capture.mjs --size 390x844 --wait 12000
 * ```
 *
 * ## 为什么这几张图必须进 git
 *
 * `build-store-shots.py` 的 `PLAN` 只读**已入库**的目录。源图放在 `shots/`（走查临时目录）
 * 的话，一旦被清就再也生成不出来，而且**不会有任何报错** —— 详情页只是静默停在旧图上。
 * claw-machine 踩过这个坑（见宿主的 PLAN 注释）。
 *
 * ## 为什么不用固定 sleep
 *
 * headless 只有 4~6 fps，游戏时钟慢约 7×。所以每一步都**轮询游戏内状态**
 * （`window.__qa.scene()` / `#world` 的 `data-diagnostics`），等状态到了再拍。
 *
 * ## 四张图讲什么
 *
 * | # | 画面 | 为什么选它 |
 * | --- | --- | --- |
 * | 1 | 画室：纸上已经有一匹马，左边是笔和颜色 | 一眼看出「先画」这件事 |
 * | 2 | 02 预览：3D 马站在草坡上 | 这是这款游戏最反直觉的一步 —— 画的线真的变成 3D |
 * | 3 | 03 参赛：名字 + 两种赛制 + 六维性格条 | 说明「你的每一笔都算数」 |
 * | 4 | 比赛中：四匹马在赛道上，倒计时刚过 | 说明它是个跑起来的游戏，不是画板 |
 */
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const argv = process.argv.slice(2)
const WITH_VALUE = new Set(['--port', '--size', '--wait'])
const opt = (n, d) => {
  const i = argv.indexOf(n)
  const v = i < 0 ? undefined : argv[i + 1]
  return v && !v.startsWith('--') ? v : d
}
const ROOT = path.resolve(argv.find((a, i) => !a.startsWith('--') && !WITH_VALUE.has(argv[i - 1])) ?? '.')
const PORT = Number(opt('--port', 5401))
const [VW, VH] = String(opt('--size', '390x844')).split('x').map(Number)
const OUT = path.join(ROOT, 'screenshots')
fs.mkdirSync(OUT, { recursive: true })

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.json': 'application/json', '.css': 'text/css', '.png': 'image/png',
  '.webp': 'image/webp', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.m4a': 'audio/mp4', '.wav': 'audio/wav', '.pack': 'application/octet-stream',
}
const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x')
  let p = path.join(ROOT, decodeURIComponent(u.pathname))
  if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, 'index.html')
  if (!fs.existsSync(p)) {
    res.writeHead(404)
    res.end('not found')
    return
  }
  res.writeHead(200, { 'content-type': MIME[path.extname(p).toLowerCase()] ?? 'application/octet-stream' })
  fs.createReadStream(p).pipe(res)
})
await new Promise((r) => server.listen(PORT, '127.0.0.1', r))

const puppeteer = (
  await import(pathToFileURL('E:/plan/test25/kid-quest-farm-2d/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js').href)
).default
const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})
const page = await browser.newPage()
await page.setViewport({ width: VW, height: VH, deviceScaleFactor: 2 })
const problems = []
page.on('pageerror', (e) => problems.push('pageerror: ' + String(e.message).slice(0, 160)))
page.on('response', (r) => {
  if (r.status() >= 400 && !r.url().includes('favicon')) problems.push(`${r.status()} ${r.url()}`)
})

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const waitFor = async (fn, label, timeout = 60000) => {
  const t0 = Date.now()
  while (Date.now() - t0 < timeout) {
    if (await fn()) return
    await sleep(200)
  }
  throw new Error('等不到：' + label)
}
const click = (sel) =>
  page.evaluate((s) => {
    const el = document.querySelector(s)
    if (!el) throw new Error('找不到 ' + s)
    el.click()
  }, sel)

await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'load' })
await waitFor(() => page.evaluate(() => !!window.__qa?.ready), '游戏就绪')
await sleep(1200)

// ---- 1) 画室：先领养一匹预设马（空画布那张什么都不好看） ----
await click('#adopt')
/*
 * 等「领养成功」那条 toast 自己收掉（`toast()` 是 2800ms 后摘 `.show`）。
 * 不等的话它会正好压在底部的「领养一匹」上，图里多一块跟玩法无关的绿条。
 */
await waitFor(
  () => page.evaluate(() => !document.getElementById('toast').classList.contains('show')),
  '领养 toast 收掉',
  8000,
)
await sleep(300)
await page.screenshot({ path: path.join(OUT, 'store-1.png') })

// 起名（预览页和参赛页都要它；领养会清空名字）
await page.evaluate(() => {
  const el = document.getElementById('horse-name')
  el.value = '小闪电'
  el.dispatchEvent(new Event('input', { bubbles: true }))
})
await sleep(400)

// ---- 2) 3D 预览 ----
await click('#preview-tab')
await waitFor(
  () =>
    page.evaluate(() => {
      const w = document.getElementById('world')
      const r = w.getBoundingClientRect()
      return !w.hidden && r.width > 100 && r.height > 100
    }),
  '3D 画布出现',
)
await sleep(2200) // 让马转到一个能看清侧面的角度
await page.screenshot({ path: path.join(OUT, 'store-2.png') })

// ---- 3) 参赛页（名字 + 赛制 + 六维） ----
await click('#entry-tab')
await sleep(900)
await page.screenshot({ path: path.join(OUT, 'store-3.png') })

// ---- 4) 比赛中 ----
await click('#start')
await waitFor(async () => (await page.evaluate(() => window.__qa.scene())) === 'play', '进入比赛')
// 等倒计时走完（time >= 0），此时马已经在跑
await waitFor(
  () =>
    page.evaluate(() => {
      const d = JSON.parse(document.getElementById('world').dataset.diagnostics || '{}')
      return typeof d.time === 'number' && d.time > 1.2
    }),
  '比赛开始跑起来',
  120000,
)
await sleep(600)
await page.screenshot({ path: path.join(OUT, 'store-4.png') })

const stats = await page.evaluate(() => window.__qa.stats())
console.log('拍了 4 张 →', path.relative(ROOT, OUT))
console.log('赛后状态:', JSON.stringify(stats))
if (problems.length) {
  console.log('--- 问题 ---')
  for (const p of [...new Set(problems)].slice(0, 10)) console.log(' ', p)
} else {
  console.log('0 个 pageerror / 0 个 4xx')
}
await browser.close()
server.close()
