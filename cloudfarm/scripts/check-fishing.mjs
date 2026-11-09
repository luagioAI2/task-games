/**
 * 钓鱼链路自检（真 Chrome + 真页面，`?rig=pond`）。
 *
 * 为什么单独一份：`e2e-economy.mjs` 只覆盖「种地 → 卖菜」，钓鱼是另一条链
 * （概率表 + 入包数量 + 下竿费）。`check-economy-table.mjs` 只算**期望值**，
 * 它证明不了运行时真的读了 `FISHING.catch` —— 如果 `resolveFishing()` 还在用
 * 旧的 `CATCH_BAG`，静态检查全绿、页面照样可玩，只有数一数背包才知道。
 *
 * 判据（每条都能真的红）：
 *   ① `fishCost()` = `FISHING.cost`（8）
 *   ② 每次上钩后 fishmeat 的增量只有 **0（脱钩）/ 4（fish）/ 8（koi）**
 *      —— `2` 是 v59.1 之前的坏值，出现就说明运行时没读新表
 *   ③ 没钓到意料外的东西（入包只动 fishmeat / turtleegg）
 *   ④ `?rig=` 的 free 模式**不许动积分**（探针不该花钱）
 *   ⑤ 5 次里至少有一次有收获（全脱钩 ⇒ 大概率是概率表坏了）
 *
 * 用法：
 *   node scripts/serve.mjs 4398 &
 *   node scripts/check-fishing.mjs [url]
 *
 * ⚠️ 每次下竿要等 3~7.2s 结算，5 次约 30s，别用短超时去卡它。
 */
import { createRequire } from 'node:module'
import { join } from 'node:path'

const require = createRequire(join(process.cwd(), 'noop.js'))
const puppeteer = require('E:/plan/test25/kid-quest-farm-2d/node_modules/puppeteer-core')

const URL = process.argv[2] || 'http://127.0.0.1:4398/index.html?rig=pond'
const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})
const page = await browser.newPage()
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
await page.goto(URL, { waitUntil: 'domcontentloaded' })
await page.waitForFunction('window.__farm && window.__gpPlayable', { timeout: 60000 })

const fails = []
const check = (name, ok, detail = '') => {
  console.log(ok ? '  ✓' : '  ✗', name, detail ? `· ${detail}` : '')
  if (!ok) fails.push(name)
}

const cost = await page.evaluate(() => window.__farm.fishCost())
check('下竿费来自 FISHING.cost = 8', cost === 8, `fishCost()=${cost}`)

const points0 = await page.evaluate(() => window.__farm.farm.s.points)

const CASTS = 5
const deltas = []
for (let i = 0; i < CASTS; i++) {
  const before = await page.evaluate(() => ({ ...window.__farm.farm.s.bag }))
  const started = await page.evaluate(() => window.__farm.startFishing(200, 500))
  if (!started) {
    fails.push(`第 ${i + 1} 次下竿没成功`)
    break
  }
  // 等它自己结算（3~7.2s）
  await page.waitForFunction('!window.__farm.fishingActive()', { timeout: 15000, polling: 200 })
  const after = await page.evaluate(() => ({ ...window.__farm.farm.s.bag }))
  const d = {}
  for (const k of new Set([...Object.keys(before), ...Object.keys(after)])) {
    const n = (after[k] ?? 0) - (before[k] ?? 0)
    if (n) d[k] = n
  }
  deltas.push(d)
  await new Promise((r) => setTimeout(r, 300))
}

const points1 = await page.evaluate(() => window.__farm.farm.s.points)
check('rig 的 free 模式没扣积分（探针不该动钱）', points0 === points1, `${points0} → ${points1}`)
check(`跑了 ${CASTS} 次下竿`, deltas.length === CASTS, JSON.stringify(deltas))

const fishmeat = deltas.map((d) => d.fishmeat ?? 0)
const other = deltas.map((d) => Object.entries(d).filter(([k]) => k !== 'fishmeat'))
check(
  'fishmeat 增量只有 0（脱钩）/ 4（fish）/ 8（koi），**没有 2**',
  fishmeat.every((n) => n === 0 || n === 4 || n === 8),
  fishmeat.join(', '),
)
check('没钓到意料外的东西', other.every((o) => o.length === 0), JSON.stringify(other))
check('脱钩（0 增量）允许，但不能全脱', fishmeat.filter((n) => n > 0).length > 0, `${fishmeat.filter((n) => n > 0).length}/${CASTS} 次有收获`)

await browser.close()
if (fails.length) {
  console.error(`\n✗ ${fails.length} 项失败`)
  process.exit(1)
}
console.log('\n✓ 钓鱼运行时链路正常')
