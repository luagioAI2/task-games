/**
 * 卡面文案 ↔ 数值一致性（**真 Chrome + 真页面**，`?rig=myth`）。
 *
 * ## 为什么要单独一份
 *
 * 2026-10-24 把 mythcat / yulong 的 `times` 从 365 降到 22 / 19，
 * 卡面却还写着「永久存活 · ∞ 次产出」——**数字改了、说法没改**。
 * 四层验收全都盖不到这种不一致：
 *
 *   · `check-economy-table` 算的是数值，它不管文案；
 *   · 单测 / E2E 断言的是账本与背包，也不会去读卡面；
 *   · 走查图集（`capture.mjs`）只保证「每屏不一样」，不做文本断言。
 *
 * 当时这条断言只写在一次性的探针脚本里，删掉就没人守了 —— 所以搬成常驻。
 *
 * ## 判据（每条都能真的红）
 *
 * 静态（三种语言全查，不用开浏览器）：
 *   ① `adopt.infoInf` 必须带 `{k}` 且**不含 ∞**
 *   ② `st.leftInf`   必须带 `{n}` 且**不含 ∞**
 *   ③ `ui.js` 真的把 `k: a.times` / `d.times - an.rounds` 传进去了
 *      —— 否则就是「占位符在、没人填」，渲染成 `共 undefined 次`
 *
 * 运行时（真页面）：
 *   ④ 领养卡里每只永久动物都写着**它自己的** `共 N 次`（N 从 catalog 读，不写死）
 *   ⑤ 「我的」页签里写着 `还能产 N 次`，N 在 0 ~ times 之间
 *   ⑥ 三个面板的文字里**不许出现** `∞ 次` / `∞ times` / `∞回`（就是那个坏说法）
 *   ⑦ **对照组**：种子面板必须**仍然有** `∞`（神圣梧桐是真的无限）
 *      —— 没有这一条，「把 ∞ 全删了」也能全绿，而那会把梧桐卡改坏
 *
 * 用法：
 *   node scripts/serve.mjs 4398
 *   node scripts/check-copy.mjs [url]
 */
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { readFileSync } from 'node:fs'
import { ANIMALS } from '../src/data/catalog.js'
import { LANGS } from '../src/i18n.js'

const require = createRequire(join(process.cwd(), 'noop.js'))
const puppeteer = require('E:/plan/test25/kid-quest-farm-2d/node_modules/puppeteer-core')

const URL = process.argv[2] || 'http://127.0.0.1:4398/index.html?rig=myth'

const fails = []
const check = (cond, label, detail) => {
  const tail = detail === undefined ? '' : ' · ' + detail
  if (cond) console.log('  ✓ ' + label + tail)
  else { fails.push(label); console.log('  ✗ ' + label + tail) }
}

const PERM = ANIMALS.filter((a) => a.permanent)
// 坏说法：任何语言下「∞ + 次数」的组合都不该再出现
const BAD = ['∞ 次', '∞次', '∞ times', '∞回']
const hasBad = (s) => BAD.some((b) => s.includes(b))

// ─────────────────────────────── 静态层
console.log('\n【静态】文案占位符（zh / en / ja 各查一遍）')
for (const [code, dict] of Object.entries(LANGS)) {
  for (const [key, ph] of [['adopt.infoInf', '{k}'], ['st.leftInf', '{n}']]) {
    const s = String(dict[key] || '')
    check(s.includes(ph) && !s.includes('∞'), code + '.' + key + ' 带 ' + ph + '、且没有 ∞', s)
  }
}

console.log('\n【静态】调用点真的把数字传进去了（不然渲染成 undefined）')
const ui = readFileSync('src/ui.js', 'utf8')
check(ui.includes('k: a.times'), 'adopt.infoInf 收到 k = a.times')
check(/d\.times\s*-\s*an\.rounds/.test(ui), 'st.leftInf 收到 d.times - an.rounds')

// ─────────────────────────────── 运行时
const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})
const page = await browser.newPage()
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 })
await page.waitForFunction('window.__farm && window.__gpPlayable', { timeout: 60000 })

// 关掉引导层（宿主 onboarding / 插件欢迎层 / 教练卡都可能盖住面板）
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find((b) => {
    const t = (b.textContent || '').trim()
    return t.includes('进入农场') || t.includes('跳过')
  })
  if (btn) btn.click()
  const g = window.__farm
  g.farm.s.onboard = 3
  document.querySelectorAll('.coach, .ring, #onboard').forEach((e) => e.remove())
  g.farm.emit({ type: 'change' })
})
await new Promise((r) => setTimeout(r, 600))

const clickText = (text) => page.evaluate((t) => {
  const b = [...document.querySelectorAll('#ui button')].find((e) => (e.textContent || '').trim().includes(t))
  if (!b) return false
  b.click()
  return true
}, text)

const clickAct = (act, arg) => page.evaluate((a, g) => {
  const b = document.querySelector('#ui [data-act="' + a + '"][data-arg="' + g + '"]')
  if (!b) return false
  b.click()
  return true
}, act, arg)

const panelText = () => page.evaluate(() => (document.querySelector('#ui')?.textContent || ''))

const readItems = () => page.evaluate(() => [...document.querySelectorAll('#ui .item')].map((it) => ({
  name: (it.querySelector('b')?.textContent || '').trim(),
  sub: (it.querySelector('.s')?.textContent || '').trim(),
  all: (it.textContent || '').trim(),
})))

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const zhName = (id) => String(LANGS.zh['n.' + id] || '')
const closePanel = () => page.evaluate(() => { const b = document.querySelector('#ui .xbtn'); if (b) b.click() })
const openSheetBy = (kind) => page.evaluate((k) => {
  const b = document.querySelector('#ui [data-open="' + k + '"]')
  if (!b) return false
  b.click()
  return true
}, kind)

// ④⑤ 按**面板**查 —— 动物面板分「牧场」「鱼塘」两个入口（`[data-open="ranch"|"pond"]`），
// 玉龙的 zone 是 pond，点「动物」（= ranch）永远看不到它。
// ⚠️ 别用 `[data-zone]` 去「切分区」：那个只调 `G.scrollToZone()` **滚镜头**，
//    面板内容一点不变 —— 第一版就是这么误报「玉龙不在领养卡里」的。
console.log('\n【运行时】按面板查永久动物（牧场 / 鱼塘是两个入口）')
for (const zone of [...new Set(PERM.map((a) => a.zone))]) {
  const inZone = PERM.filter((a) => a.zone === zone)
  const shopName = String(LANGS.zh['shop.' + zone] || zone)
  console.log('  — ' + shopName + '：' + inZone.map((a) => zhName(a.id)).join(' / '))
  await closePanel()
  await sleep(400)
  check(await openSheetBy(zone), '打开了「' + shopName + '」面板')
  await sleep(700)
  check((await panelText()).includes(shopName), '确实是「' + shopName + '」这一屏（不是上个面板没关）')
  check(await clickAct('tab', 'adopt'), '切到「领养」页签')
  await sleep(400)

  const rows = await readItems()
  for (const a of inZone) {
    const row = rows.find((r) => r.name === zhName(a.id))
    if (!row) { check(false, '领养卡里有 ' + zhName(a.id), '没找到这一行'); continue }
    check(row.sub.includes('共 ' + a.times + ' 次'), zhName(a.id) + ' 写「共 ' + a.times + ' 次」', row.sub)
    check(!hasBad(row.all), zhName(a.id) + ' 不再出现 ∞ 次数说法')
  }
  check(!hasBad(await panelText()), '「' + shopName + '」领养面板没有 ∞ 次数说法')

  // 我的：先把待收产出收掉 —— 有产出待收时状态走的是「有 1 批产出可以收」那一支，
  // 根本不会渲染「还能产 N 次」。不构造唯一前提，这条断言就会随机红。
  check(await clickAct('tab', 'mine'), '切到「我的」页签')
  await sleep(400)
  const collected = await page.evaluate(() => {
    const bs = [...document.querySelectorAll('#ui [data-act="collect"]')]
    bs.forEach((b) => b.click())
    return bs.length
  })
  if (collected) await sleep(800)
  console.log('    收了 ' + collected + ' 批待收产出（把状态收敛到「下次产出」分支）')

  const mineRows = (await readItems()).filter((r) => inZone.some((a) => r.all.includes(zhName(a.id))))
  check(mineRows.length > 0, '「我的」里有永久动物可查', mineRows.length + ' 只')
  for (const r of mineRows) {
    const def = inZone.find((a) => r.all.includes(zhName(a.id)))
    const m = r.all.match(/还能产 (\d+) 次/)
    const n = m ? Number(m[1]) : NaN
    check(!!m && n >= 0 && n <= def.times, '剩余次数是真实数字（0~' + def.times + '）', m ? m[1] : r.all.replace(/\s+/g, ' ').slice(0, 60))
  }
  check(!hasBad(await panelText()), '「' + shopName + '」我的面板没有 ∞ 次数说法')
}

// ⑥ ⑦ 对照组：梧桐卡的 ∞ 必须还在
console.log('\n【运行时】对照组：神圣梧桐的 ∞ 不能被顺手删掉')
await page.evaluate(() => document.querySelector('#ui .xbtn')?.click())
await new Promise((r) => setTimeout(r, 500))
check(await clickText('种子'), '打开了「种子」面板')
await new Promise((r) => setTimeout(r, 800))
const seedText = await panelText()
check(seedText.includes('∞'), '梧桐卡上仍然有 ∞（真的无限）', seedText.includes('∞') ? '找到 ∞' : '没有 ∞')
check(!hasBad(seedText), '「种子」面板没有 ∞ 次数说法')

await browser.close()

console.log('')
if (fails.length) {
  console.log('✗ ' + fails.length + ' 条不过：')
  for (const f of fails) console.log('   · ' + f)
  process.exit(1)
}
console.log('✓ 卡面文案和数值一致（永久动物写真实次数，梧桐保留 ∞）')
