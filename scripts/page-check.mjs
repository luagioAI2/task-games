#!/usr/bin/env node
/**
 * 独立网页自检：真的用 Chrome 打开页面，报告
 *   ① 控制台 error / 未捕获异常
 *   ② 任何 4xx/5xx 请求（**这是插件化最容易漏的**：相对路径在 blob: 里全 404）
 *   ③ 游戏是否真的到了可玩状态（画布有尺寸、加载进度跑完）
 *
 * ⚠️ 判据要能区分「还在加载」和「卡住了」：只等固定毫秒会两头不讨好。
 *   这里等 window.__gpPlayable（游戏自己在首帧可玩时置 true），
 *   超时则报告卡在哪个阶段。
 *
 * 用法: node scripts/page-check.mjs [url] [--shot out.png]
 */
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { writeFileSync } from 'node:fs'

const require = createRequire(join(process.cwd(), 'noop.js'))
const puppeteer = require('E:/plan/test25/kid-quest-farm-2d/node_modules/puppeteer-core')

const URL = process.argv.find((a) => a.startsWith('http')) || 'http://127.0.0.1:4397/index.html'
const shotIdx = process.argv.indexOf('--shot')
const SHOT = shotIdx > 0 ? process.argv[shotIdx + 1] : null
const TIMEOUT = 60000

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})

const page = await browser.newPage()
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true })

const errors = []
const failed = []
const warnings = []
page.on('console', (m) => {
  const t = m.type()
  const txt = m.text()
  if (t === 'error') errors.push(txt)
  else if (t === 'warning') warnings.push(txt)
})
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message))
page.on('requestfailed', (r) => failed.push(`${r.failure()?.errorText} ${r.url()}`))
page.on('response', (r) => {
  const s = r.status()
  if (s >= 400) failed.push(`HTTP ${s} ${r.url()}`)
})

const t0 = Date.now()
let ok = false
let reason = ''
try {
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 })
  // 先确认页面自己没在 boot 阶段就抛错
  ok = await page.waitForFunction('window.__gpPlayable === true', { timeout: TIMEOUT }).then(() => true).catch(() => false)
  if (!ok) {
    // 卡住时报告它卡在哪
    const st = await page.evaluate(() => ({
      ready: !!window.__gpReady,
      playable: !!window.__gpPlayable,
      canvas: !!document.querySelector('#app canvas'),
      canvasSize: (() => {
        const c = document.querySelector('#app canvas')
        return c ? [c.width, c.height] : null
      })(),
      bootError: document.getElementById('boot-error')?.textContent || null,
    }))
    reason = '未在 ' + TIMEOUT + 'ms 内可玩；状态 ' + JSON.stringify(st)
  }
} catch (e) {
  reason = '导航失败: ' + e.message
}
const ms = Date.now() - t0

// 画布有真实尺寸 = 渲染确实起来了（只是「元素存在」证明不了）
const canvasInfo = await page.evaluate(() => {
  const c = document.querySelector('#app canvas')
  if (!c) return null
  const r = c.getBoundingClientRect()
  return { w: Math.round(r.width), h: Math.round(r.height), bufW: c.width, bufH: c.height }
})
const uiPresent = await page.evaluate(() => !!document.getElementById('ui') && !!document.querySelector('#ui .col'))
const title = await page.title()

if (SHOT) {
  await page.screenshot({ path: SHOT })
  console.log('截图:', SHOT)
}

await browser.close()

console.log(`\n页面: ${URL}`)
console.log(`标题: ${title}`)
console.log(`耗时: ${ms}ms`)
console.log(`可玩: ${ok ? '✓' : '✗'} ${reason}`)
console.log(`画布: ${canvasInfo ? `${canvasInfo.w}x${canvasInfo.h} css / ${canvasInfo.bufW}x${canvasInfo.bufH} 缓冲` : '（无）'}`)
console.log(`UI 层: ${uiPresent ? '✓' : '✗'}`)
console.log(`控制台 error: ${errors.length}`)
for (const e of errors.slice(0, 10)) console.log('   ✗', e.slice(0, 300))
console.log(`失败请求: ${failed.length}`)
for (const f of failed.slice(0, 15)) console.log('   ✗', f.slice(0, 200))
if (warnings.length) {
  console.log(`警告: ${warnings.length}（前 3）`)
  for (const w of warnings.slice(0, 3)) console.log('   ·', w.slice(0, 200))
}

process.exit(ok && errors.length === 0 && failed.length === 0 ? 0 : 1)
