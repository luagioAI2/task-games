#!/usr/bin/env node
/**
 * 拍商城详情页的 4 张图（`screenshots/store-1..4.png`，390×844 容器、DPR 2）。
 *
 * ```bash
 * node scripts/capture.mjs [--port 4395] [--out screenshots]
 * ```
 *
 * 顺序就是详情页的顺序，**第一张必须是「这是什么游戏」**：
 *   1 对局（病毒沿通道往里爬，抗体在打）  2 首页（选章节 + 开始战斗）
 *   3 英雄加点（金币换属性）               4 结算（生存进度 / 消灭病毒 / 奖励）
 *
 * ★ 这些图必须对**当前构建**拍。用原版参考图 ⇒ 机台上的字和现在不一样，
 *   而结构断言（张数 / 能否解码 / 有没有说明）一条都查不出来。
 */
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.dirname(HERE)
const argv = process.argv.slice(2)
const opt = (n, d) => {
  const i = argv.indexOf(n)
  return i >= 0 ? argv[i + 1] : d
}
const PORT = Number(opt('--port', 4395))
const OUT = path.resolve(ROOT, opt('--out', 'screenshots'))
fs.mkdirSync(OUT, { recursive: true })

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.json': 'application/json', '.css': 'text/css', '.png': 'image/png',
  '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2',
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x')
  let p = path.join(ROOT, decodeURIComponent(url.pathname))
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

const puppeteer = (await (async () => {
  for (const c of [
    'puppeteer-core',
    'E:/plan/test25/kid-quest-farm-2d/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js',
  ]) {
    try {
      return (await import(c.startsWith('puppeteer') ? c : pathToFileURL(c).href)).default
    } catch {
      /* 下一个 */
    }
  }
  throw new Error('找不到 puppeteer-core')
})())
const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find((p) => fs.existsSync(p))

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})
const page = await browser.newPage()
// DPR 2：360 宽的 webp 从 780 宽缩下来才不糊（和别的款一致）
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 })

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const shot = async (name) => {
  await page.screenshot({ path: path.join(OUT, name) })
  console.log('  拍好', name)
}
const clickText = (t) =>
  page.evaluate((label) => {
    const els = [...document.querySelectorAll('button')]
    const b = els.find((x) => x.textContent.trim() === label) ?? els.find((x) => x.textContent.includes(label))
    if (!b) return false
    b.click()
    return true
  }, t)
const state = () => page.evaluate(() => (window.__cellguard ? window.__cellguard.state() : null))

await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'load' })
await page.waitForFunction('window.__cellguard && window.__cellguard.ready', { timeout: 20000 })
await sleep(1500)

// ① 对局：先开局，边打边把「宝箱提示 / 选卡」这两个暂停层点掉
await clickText('开始战斗')
await page.waitForFunction('window.__cellguard.state().battle === true', { timeout: 15000 })

/**
 * 让对局自己往前走，直到生存进度到 `targetPct`（或超时）。
 *
 * ★ 两个暂停层必须点掉，否则截到的是一张**静止**的图（游戏被 paused）：
 *   `.tip-back`（宝箱掉落提示）→ 点掉会打开 `.ov-chest`
 *   `.ov-chest`（三选一）→ 点里面那张 `<button class="card">` 继续打
 *   ★ 点 `.card-wrap` 是**没用**的：监听在里面的 `<button class="card">` 上，
 *     外层 div 只是个定位壳 ⇒ 点了没反应、游戏一直停着，而循环看上去在跑。
 */
async function playUntil(targetPct, timeoutMs) {
  const t0 = Date.now()
  while (Date.now() - t0 < timeoutMs) {
    await page.evaluate(() => {
      const tip = document.querySelector('.tip-back')
      if (tip) {
        tip.click()
        return
      }
      const card = document.querySelector('.ov-chest button.card')
      if (card) card.click()
    })
    const s = await state()
    if (s && !s.battle) break
    if ((s?.pct ?? 0) >= targetPct) break
    await sleep(700)
  }
  // 收尾：确保没有暂停层留在画面上
  for (let i = 0; i < 6; i++) {
    const left = await page.evaluate(() => {
      const tip = document.querySelector('.tip-back')
      if (tip) {
        tip.click()
        return 'tip'
      }
      const card = document.querySelector('.ov-chest button.card')
      if (card) {
        card.click()
        return 'chest'
      }
      return ''
    })
    if (!left) break
    await sleep(700)
  }
  await sleep(1500)
}

/*
 * ⚠️ 拍在 **10% 左右**，不是 25%+。
 *   实测 25% 时通道口会堆成一面「病毒墙」（三十来只、每只头上一个四位数血量），
 *   叠在一起像一串数字 —— 那是**打崩了的一局**，不是这一款长什么样。
 *   10% 左右病毒是散在通道上的，一眼能看出「它们在往里爬」。
 */
await playUntil(10, 150000)
console.log('  对局状态:', JSON.stringify(await state()))
await shot('store-2.png')

// ④ 结算：从暂停里退出（先把这一张拍了，退出后进度就结算了）
await page.evaluate(() => document.querySelector('.hud-btn')?.click())
await sleep(900)
await clickText('退出战斗')
await page.waitForFunction(() => !!document.querySelector('.ov-result'), { timeout: 20000 })
await sleep(1200)
await shot('store-4.png')

// ① 首页：章节卡 + 大病毒 + 开始战斗 —— 第一张就靠它说清「这是什么游戏」
await clickText('返回')
await page.waitForFunction('window.__cellguard.state().battle === false', { timeout: 20000 })
await sleep(1500)
await shot('store-1.png')

// ③ 英雄加点：金币换属性（养成那一屏）
await clickText('英雄')
await sleep(1500)
await shot('store-3.png')

console.log('  4 张齐了 →', path.relative(ROOT, OUT))
await browser.close()
server.close()
