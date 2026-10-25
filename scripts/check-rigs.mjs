#!/usr/bin/env node
/**
 * **试玩场景（`?rig=`）自检** —— 四个布置场景能不能真的布置出来，而且**不扣积分**。
 *
 * 用法：
 *   node scripts/serve.mjs 4397 &
 *   node scripts/check-rigs.mjs [http://127.0.0.1:4397/index.html]
 *
 * ## 为什么要单独一份
 *
 * `?rig=farm|pond|zoo|myth` 是给走查 / 截图 / 手工试玩用的「一键布置」入口。
 * 它们要买一堆种子和动物 —— 原来的写法是 `farm.addPoints(9999)` **反复打钱**。
 * 2026-10-24 改成「积分只能由 App 发」之后，`addPoints()` 被删了，四处改成
 * `farm.wallet.free = true`（只影响本地判断，**不写宿主账本**）。
 *
 * 这个改动有两个静默失效的可能，`page-check.mjs` 都盖不到：
 *
 *   ① `free` 没生效 ⇒ `adopt()` / `plant()` 因为余额不够**静默返回 false**
 *      ⇒ 场景是空的，而页面照样「可玩」（`__gpPlayable` 为 true、画布尺寸正常）。
 *   ② `free` 生效得太宽 ⇒ 顺手把真实余额也改了，或者扣了积分。
 *
 * 所以判据必须是**状态**：动物数 > 0、积分**一分没少**、`wallet.free === true`。
 * 「页面起得来」证明不了任何一条。
 *
 * ⚠️ 每个场景的动物数**不要写死**：`rig=farm` 里放了 4 只鸡，而「限养 3 只」
 *    会把第 4 只挡掉（实测 7 只而不是 8 只）—— 那是**设计**，不是 bug。
 *    这里只断言「大于 0」，具体数量变了不该红。
 */
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { STANDALONE_START } from '../src/wallet.js'

const require = createRequire(join(process.cwd(), 'noop.js'))
const puppeteer = require('E:/plan/test25/kid-quest-farm-2d/node_modules/puppeteer-core')

const BASE = process.argv[2] || 'http://127.0.0.1:4397/index.html'
const RIGS = ['farm', 'pond', 'zoo', 'myth']

const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find((p) => require('node:fs').existsSync(p))
if (!CHROME) {
  console.error('✗ 找不到 Chrome')
  process.exit(2)
}

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: [
    '--no-proxy-server',
    '--no-sandbox',
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
  ],
})

let failed = 0
for (const rig of RIGS) {
  const page = await browser.newPage()
  const errs = []
  page.on('pageerror', (e) => errs.push(String(e)))
  try {
    await page.goto(`${BASE}?rig=${rig}`, { waitUntil: 'domcontentloaded', timeout: 45000 })
    await page.waitForFunction('window.__gpPlayable === true', { timeout: 60000 })
    await new Promise((r) => setTimeout(r, 900)) // 布置是在 boot 里同步做的，留一点给 UI 刷新
    const s = await page.evaluate(() => {
      const f = window.__farm.farm
      return {
        animals: f.s.animals.length,
        planted: f.s.plots.filter((x) => x.crop).length,
        level: f.level.level,
        points: f.s.points,
        free: f.wallet.free,
      }
    })
    const ok = s.animals > 0 && s.free === true && s.points === STANDALONE_START && errs.length === 0
    if (!ok) failed++
    console.log(
      `${ok ? '✓' : '✗'} rig=${rig.padEnd(5)} 动物 ${s.animals} · 种了 ${s.planted} 块 · Lv.${s.level} · 积分 ${s.points}/${STANDALONE_START} · free=${s.free}${errs.length ? ' · ERR ' + errs[0].slice(0, 80) : ''}`,
    )
  } catch (e) {
    failed++
    console.log(`✗ rig=${rig.padEnd(5)} 起不来：${e.message}`)
  } finally {
    await page.close()
  }
}

await browser.close()
console.log(failed ? `\n✗ ${failed} 个场景有问题` : '\n✓ 四个试玩场景都正常（布置上了、且 free 模式没扣积分）')
process.exit(failed ? 1 : 0)
