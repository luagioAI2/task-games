#!/usr/bin/env node
/**
 * 界面走查：进入游戏、逐屏截图。
 *
 * 判据不是「图拍到了」而是「每一屏都和上一屏不一样」—— 截图全一样说明
 * 点击没生效（或被遮挡吞掉了），而文件照样生成，看着很像成功。
 *
 * 用法: node scripts/capture.mjs [url] [outDir]
 */
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { mkdirSync, readFileSync } from 'node:fs'

const require = createRequire(join(process.cwd(), 'noop.js'))
const puppeteer = require('E:/plan/test25/kid-quest-farm-2d/node_modules/puppeteer-core')

const URL = process.argv.find((a) => a.startsWith('http')) || 'http://127.0.0.1:4397/index.html'
const OUT = process.argv[3] || join(process.cwd(), 'screenshots')
mkdirSync(OUT, { recursive: true })

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: 'new',
  args: ['--no-sandbox', '--enable-unsafe-swiftshader'],
})
const page = await browser.newPage()
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true })

const errors = []
const badRes = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('response', (r) => { if (r.status() >= 400) badRes.push(r.status() + ' ' + r.url()) })
page.on('console', (m) => {
  if (m.type() !== 'error') return
  const t = m.text()
  // 「Failed to load resource」**不带 URL** —— 以前它就一条条记进 errors，
  // 结果每轮都报 `error: 1`（其实只是 favicon.ico），报得多了就没人看红了。
  // 资源失败交给上面那一路，那里有 URL、也能把 favicon 单独排掉。
  if (t.startsWith('Failed to load resource')) return
  errors.push(t)
})

const shots = []
const shoot = async (name) => {
  const p = join(OUT, name + '.png')
  await page.screenshot({ path: p })
  shots.push(p)
  console.log('  拍', name)
  return p
}

/** 用 DOM click（不用坐标）：固定底栏会静默拦截坐标点击。 */
const clickText = async (text, sel = 'button') => {
  return page.evaluate((t, s) => {
    const els = [...document.querySelectorAll(s)]
    const hit = els.find((e) => (e.textContent || '').trim().includes(t))
    if (!hit) return false
    hit.click()
    return true
  }, text, sel)
}

await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 })
await page.waitForFunction('window.__gpPlayable === true', { timeout: 60000 })
await new Promise((r) => setTimeout(r, 700))
await shoot('10-welcome')

// 进入农场
const entered = await clickText('进入农场')
console.log('   点「进入农场」:', entered ? '✓' : '✗ 找不到按钮')
await new Promise((r) => setTimeout(r, 1400))
await shoot('11-farm')

// 各工具栏
for (const [label, name] of [['种子', '12-seeds'], ['动物', '13-animals'], ['市场', '14-market'], ['背包', '15-bag']]) {
  const ok = await clickText(label)
  await new Promise((r) => setTimeout(r, 800))
  console.log(`   点「${label}」:`, ok ? '✓' : '✗')
  await shoot(name)
  // 关掉弹层：点遮罩
  await page.evaluate(() => document.querySelector('#ui .scrim')?.click())
  await new Promise((r) => setTimeout(r, 500))
}

// 设置
await page.evaluate(() => document.querySelector('[data-open="settings"]')?.click())
await new Promise((r) => setTimeout(r, 900))
await shoot('16-settings')
await page.evaluate(() => document.querySelector('#ui .scrim')?.click())
await new Promise((r) => setTimeout(r, 400))

// 切到牧场 / 鱼塘
await page.evaluate(() => document.querySelector('[data-zone="ranch"]')?.click())
await new Promise((r) => setTimeout(r, 900))
await shoot('17-ranch')
await page.evaluate(() => document.querySelector('[data-zone="pond"]')?.click())
await new Promise((r) => setTimeout(r, 900))
await shoot('18-pond')

// 收起状态（HUD 藏起来后的小胶囊）—— 独立网页形态应该还能看到 🪙 余额
// ⚠️ 必须先关掉新手引导：`coachUpdate()` 里有一条「引导进行中就把栏**强制展开**」
//    （要指向栏上的按钮）。不关的话点「收起」会被立刻弹回来，
//    拍到的还是完整 HUD —— 一张**看起来像收起、其实没收起**的图。
await page.evaluate(() => {
  const g = window.__farm
  g.farm.s.onboard = 3
  document.querySelectorAll('.coach, .ring').forEach((e) => e.remove())
  g.farm.emit({ type: 'change' })
})
await new Promise((r) => setTimeout(r, 400))
await page.evaluate(() => document.getElementById('foldBtn')?.click())
await new Promise((r) => setTimeout(r, 900))
await shoot('19-collapsed')
await page.evaluate(() => document.getElementById('unfoldBtn')?.click())
await new Promise((r) => setTimeout(r, 900))

// 状态
const state = await page.evaluate(() => ({
  points: window.__farm?.farm?.s?.points,
  level: window.__farm?.farm?.level?.level,
  plots: window.__farm?.farm?.s?.plots?.length,
  animals: window.__farm?.farm?.s?.animals?.length,
}))

await browser.close()

// 判据：截图不能两两相同（相同 = 点击没生效）
const hashes = shots.map((p) => {
  const b = readFileSync(p)
  let h = 0
  for (let i = 0; i < b.length; i += 997) h = (h * 31 + b[i]) | 0
  return h
})
const dup = new Set(hashes).size !== hashes.length

console.log('\n游戏状态:', JSON.stringify(state))
console.log('截图数:', shots.length, '不同帧:', new Set(hashes).size)
if (dup) console.log('⚠️ 有完全相同的帧 —— 某次点击很可能没生效')
// 独立网页没有 favicon.ico，浏览器会自动请求一次 404 —— 这不是缺陷，别计入
const realBad = badRes.filter((s) => !s.includes('favicon'))
console.log('error:', errors.length, '· 资源 4xx/5xx:', realBad.length, '（favicon 已排除 ' + (badRes.length - realBad.length) + ' 条）')
for (const e of errors.slice(0, 8)) console.log('  ✗', e.slice(0, 200))
for (const s of realBad.slice(0, 8)) console.log('  ✗', s.slice(0, 200))

process.exit(errors.length === 0 && realBad.length === 0 && !dup ? 0 : 1)
