#!/usr/bin/env node
/**
 * 竖屏视口浏览一遍，把所有运行时请求都记下来（补 `scrape.mjs --browse` 的漏）。
 *
 * 为什么要单独一个脚本：
 *   · `scrape.mjs --browse` 用默认 800×600 **横屏**视口 ⇒ `bg-title-${W<H?'p':'l'}` 只拿到 `-l`，
 *     而宿主是竖屏，缺的正是 `-p`；
 *   · 它的 `goto` 等的是 `networkidle2`，这种一直有请求的页面会 60s 超时
 *     （响应照样被收，但**不能拿「没报错」当跑完了**）。
 *
 * 这个脚本只做三件事：**记 URL、落缺的文件、截图**。不改任何东西。
 *
 *   node scripts/_browse-portrait.mjs
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'

const ROOT = 'E:/plan/test25/task-games/corgi'
const OUT = join(ROOT, '_originals/2026-10-27')
const SHOTS = join(ROOT, 'shots/_browse')
const ENTRY = 'https://hw9mzzjpe2.mkplay.zone/v/1/index.html'
const PROXY = 'http://127.0.0.1:7897'

const { default: puppeteer } = await import(
  pathToFileURL('E:/plan/test25/kid-quest-farm-2d/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js').href
)
const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find((p) => existsSync(p))

await mkdir(SHOTS, { recursive: true })

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--no-sandbox', `--proxy-server=${PROXY}`, '--autoplay-policy=no-user-gesture-required'],
})
const page = await browser.newPage()
// ★ 竖屏 390×844 —— 和宿主手机端一致，才会请求 `bg-title-p`
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true })

const seen = new Map() // url -> { status, bytes, saved }
const failed = []
const jobs = []

page.on('response', (r) => {
  const u = r.url()
  if (!/^https?:/.test(u)) return
  if (seen.has(u)) return
  seen.set(u, null)
  jobs.push(
    (async () => {
      try {
        const buf = Buffer.from(await r.buffer())
        seen.set(u, { status: r.status(), bytes: buf.length })
        // 只落「站内 /v/1/ 下、本地没有」的文件
        const m = u.match(/^https:\/\/hw9mzzjpe2\.mkplay\.zone\/v\/1\/(.+)$/)
        if (!m) return
        const rel = decodeURIComponent(m[1].split('?')[0])
        if (!rel || rel.endsWith('/')) return
        const dest = join(OUT, rel)
        if (existsSync(dest)) return
        await mkdir(dirname(dest), { recursive: true })
        await writeFile(dest, buf)
        console.log(`  + 补抓 ${String(buf.length).padStart(8)}  ${rel}`)
      } catch {
        /* 预检 / 已丢弃 */
      }
    })(),
  )
})
page.on('requestfailed', (r) => {
  if (/^https?:/.test(r.url())) failed.push({ url: r.url(), why: r.failure()?.errorText })
})

console.log('[browse] 打开页面（竖屏 390×844）…')
// ★ 不等 networkidle2（这种页面永远不 idle）—— 用 domcontentloaded + 固定观察窗
await page.goto(ENTRY, { waitUntil: 'domcontentloaded', timeout: 90000 }).catch((e) => console.log('  ! goto', e.message))
await new Promise((r) => setTimeout(r, 12000))

const shot = async (name) => {
  await page.screenshot({ path: join(SHOTS, name) })
  console.log(`  · 截图 ${name}`)
}
await shot('00-title.png')

// 标题屏 → 进游戏。canvas 是全屏的，点中间偏下（「开始」按钮位置）
const click = async (x, y, wait = 1600) => {
  await page.mouse.click(x, y)
  await new Promise((r) => setTimeout(r, wait))
}

console.log('[browse] 试点击进游戏…')
await click(195, 640, 2500)
await shot('01-after-click.png')

// 底栏 5 个 tab：从 drawTabs 的布局估位置（W/2 均分，y 在屏幕底部约 -100）
const tabY = 844 - 60
for (let i = 0; i < 5; i++) {
  const x = 390 * ((i + 0.5) / 5)
  await click(x, tabY, 1800)
  await shot(`02-tab${i}.png`)
}

// 进「衣橱」再点几件，触发 costume/wearf 资源
await click(390 * 0.5, tabY, 1500)
await new Promise((r) => setTimeout(r, 3000))

await Promise.allSettled(jobs)
await new Promise((r) => setTimeout(r, 3000))
await Promise.allSettled(jobs)

const rows = [...seen.entries()].map(([url, v]) => ({ url, ...(v || {}) }))
await writeFile(join(SHOTS, '_requests.json'), JSON.stringify(rows, null, 1))
console.log(`\n[browse] 共 ${rows.length} 个响应，${failed.length} 个请求失败`)
for (const f of failed.slice(0, 20)) console.log('  ✗', f.why, f.url)
await browser.close()
