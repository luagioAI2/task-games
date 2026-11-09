#!/usr/bin/env node
/**
 * 经济链路自检（**真 Chrome + 真包**，跑 `_plugin-test.html` 的假宿主）。
 *
 * 验的是这一版最核心的四件事，每一条都能真的红：
 *
 *   ① 「＋」按钮没了 —— 积分不能再由游戏发
 *   ② 买种子扣的是**宿主的积分账本**（`pointsLedger` 真的多了一笔负数）
 *   ③ 积分不够时**一分不扣**（fail-closed，账本行数不变）
 *   ④ 卖出农产品 → `mintVoucher` 真的入账（`vouchers` 数组真的多了一行）
 *
 * ⚠️ 每条断言都要能构造出「它会红」的情形，否则等于没测：
 *    · ② 的判据是**宿主账本**，不是 `farm.s.points` —— 后者只是镜像，
 *      插件自己印钱也能让镜像好看，账本才是事实。
 *    · ④ 的判据是 `vouchers.length`，不是 `s.harvest` —— 同理。
 *
 * 用法: node scripts/e2e-economy.mjs [url]
 */
import { createRequire } from 'node:module'
import { join } from 'node:path'

const require = createRequire(join(process.cwd(), 'noop.js'))
const puppeteer = require('E:/plan/test25/kid-quest-farm-2d/node_modules/puppeteer-core')

const URL = process.argv[2] || 'http://127.0.0.1:4397/_plugin-test.html'

const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find((p) => require('node:fs').existsSync(p))
if (!CHROME) {
  console.error('找不到 Chrome')
  process.exit(2)
}

let pass = 0
const fails = []
const check = (name, ok, detail = '') => {
  if (ok) {
    pass++
    console.log('  ✓', name, detail ? `· ${detail}` : '')
  } else {
    fails.push(name + (detail ? ` · ${detail}` : ''))
    console.log('  ✗', name, detail ? `· ${detail}` : '')
  }
}

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: [
    '--no-proxy-server',
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
  ],
})

try {
  const page = await browser.newPage()
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true })

  const errors = []
  page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message))
  page.on('console', (m) => {
    // 「Failed to load resource」由下面的 badReq 更精确地记账（带 URL），这里不重复收
    if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text())
  })

  /**
   * 资源 404 / 请求失败 —— **这条是真正的闸门**。
   *
   * 2026-10-24 的 `SyntaxError: Unexpected non-whitespace character after JSON
   * at position 4` 就是它该抓的：插件里 `A("chicken-walk/manifest.json")` 少补了
   * `assets/` ⇒ 12 个 manifest 全 404，`res.json()` 吃进 `404 Not Found` 正文
   * （`404` 当数字解析完，第 4 个字符 'N' 成了"多余内容"）。报错完全不像 404，
   * 静态扫描在压缩产物上也判不出这种语义 —— 只能靠运行时。
   */
  const badReq = []
  page.on('response', (r) => {
    if (r.status() >= 400 && !/\/favicon\.ico$/.test(r.url())) badReq.push(`${r.status()} ${r.url()}`)
  })
  page.on('requestfailed', (r) => {
    // 字体 CDN 连不通是**预期**：字体没随包发布，见 src/ui.js 顶部注释
    if (/makeplay|fonts/i.test(r.url())) return
    badReq.push(`FAIL ${r.url()} ${r.failure()?.errorText || ''}`)
  })

  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForFunction('window.__t && typeof window.__t.loadAndMount === "function"', { timeout: 15000 })

  // 只回传 JSON 字符串：直接把对象交回 puppeteer 时，CDP 的序列化
  // 遇到 undefined / 循环引用会抛一个和真实原因无关的 JSON 解析错。
  const manRaw = await page.evaluate(async () => JSON.stringify(await window.__t.loadAndMount()))
  const man = JSON.parse(manRaw)
  console.log(`\n包: ${man.name} · economy=${JSON.stringify(man.economy)}`)

  // 首帧可玩
  const ready = await page
    .waitForFunction('window.__farm && window.__farm.farm', { timeout: 60000 })
    .then(() => true, () => false)
  check('挂载后游戏就绪（window.__farm 存在）', ready)
  if (!ready) throw new Error('游戏没起来')
  check(
    '挂载期间没有资源 404（所有资源都走了 assetUrl）',
    badReq.length === 0,
    badReq.length ? badReq.slice(0, 4).join(' | ') : 'favicon 已排除',
  )

  // 跳过开场卡片 + 教练标记，避免遮住 HUD
  await page.evaluate(() => {
    const g = window.__farm
    g.farm.s.onboard = 3
    document.querySelectorAll('.modal, .scrim, .coach').forEach((e) => e.remove())
    g.farm.emit({ type: 'change' })
  })
  await new Promise((r) => setTimeout(r, 400))

  /* ---------------- ① HUD 只留等级 + 两个按钮 ---------------- */
  const noPlus = await page.evaluate(() => {
    const box = document.getElementById('host')
    const bar = box.querySelector('#ui .topbar')
    const cs = bar ? getComputedStyle(bar) : null
    return {
      plusBtn: !!box.querySelector('#plusBtn'),
      plusClass: box.querySelectorAll('.plus').length,
      hasCoinPill: !!box.querySelector('#pp'),
      hasVoucherPill: !!box.querySelector('#hp'),
      hudText: (box.querySelector('#ui')?.innerText || '').replace(/\s+/g, ' ').slice(0, 80),
      // 通栏玻璃底：有了就会在「等级」和「两个按钮」之间留出一条空栏
      barBg: cs ? `${cs.backgroundImage}|${cs.backgroundColor}` : '(没有 .topbar)',
      barShadow: cs ? cs.boxShadow : '',
      // 2026-10-24 第二轮：分区切换（牧场/田地/鱼塘）搬进上栏，不再单独占一行
      subbar: !!box.querySelector('#ui .subbar'),
      zoneInBar: box.querySelectorAll('#ui .topbar [data-zone]').length,
      hudH: Math.round(box.querySelector('#ui .hud')?.getBoundingClientRect().height || 0),
      barH: Math.round(bar?.getBoundingClientRect().height || 0),
    }
  })
  check('HUD 上没有「＋」按钮', !noPlus.plusBtn && noPlus.plusClass === 0, `plus=${noPlus.plusClass}`)
  check('HUD 上没有 🪙 积分胶囊（宿主顶栏有，不重复画）', !noPlus.hasCoinPill)
  // 2026-10-24：兑换券也交给宿主顶栏（同一张 db.harvestLedger），插件不再画
  check('HUD 上没有 🎟️ 兑换券胶囊（宿主顶栏画）', !noPlus.hasVoucherPill && !noPlus.hudText.includes('🎟️'), noPlus.hudText)
  check(
    '★ 顶栏不再有通栏底（不留一条空栏）',
    /none/.test(noPlus.barBg) && noPlus.barShadow === 'none',
    `bg=${noPlus.barBg} shadow=${noPlus.barShadow}`,
  )
  // 「上面空了一块」= 上栏中间那条 spacer 空着 + 分区自己占一行。
  // 判据要同时钉住两件事：分区**在上栏里**，且上栏**只有一行高**（48）。
  // 只断言「.subbar 不存在」是不够的 —— 分区被挪到别处也会让那条断言变绿。
  check('★ 分区切换在上栏里（3 个按钮）', !noPlus.subbar && noPlus.zoneInBar === 3, `subbar=${noPlus.subbar} zone=${noPlus.zoneInBar}`)
  check('★ 上栏只有一行（hud 高度 = 48，原来 48+36）', noPlus.hudH === noPlus.barH && noPlus.hudH === 48, `hud=${noPlus.hudH} bar=${noPlus.barH}`)

  // 分区按钮搬了家，**功能不能丢**：点「田地」要真的切过去。
  // 只量几何的话，「按钮还在、点了没反应」照样全绿。
  const zoneClick = await page.evaluate(() => {
    const b = document.querySelector('#ui .topbar [data-zone="field"]')
    if (!b) return false
    b.click()
    return true
  })
  await new Promise((r) => setTimeout(r, 900)) // 滚动是动画，syncZoneSeg 每 300ms 才校一次
  const zoneOn = await page.evaluate(() =>
    [...document.querySelectorAll('#ui .topbar [data-zone]')].filter((b) => b.classList.contains('on')).map((b) => b.dataset.zone),
  )
  check('★ 点「田地」真的切过去（.on 跟着走）', zoneClick && zoneOn.length === 1 && zoneOn[0] === 'field', `on=${zoneOn.join(',') || '(无)'}`)

  // 收起状态的小胶囊：宿主形态**只留一个箭头**。
  // 🪙 由宿主顶栏常驻显示，这里再画一遍就是同一个数画两遍（和 HUD 上删掉 🪙 同一条理由）。
  await page.evaluate(() => document.getElementById('foldBtn')?.click())
  await new Promise((r) => setTimeout(r, 700))
  const unfold = await page.evaluate(() => {
    const u = document.getElementById('unfoldBtn')
    const r = u?.getBoundingClientRect()
    return {
      visible: !!u && getComputedStyle(u).visibility === 'visible' && (r?.width || 0) > 0,
      text: (u?.innerText || '').replace(/\s+/g, ''),
      hasCoin: !!u?.querySelector('img'),
      solo: !!u?.classList.contains('solo'),
      cls: u?.className,
    }
  })
  check(
    '★ 收起后的小胶囊只留箭头（宿主形态不重复画 🪙）',
    unfold.visible && unfold.hasCoin === false && !/[0-9]/.test(unfold.text) && unfold.solo,
    JSON.stringify(unfold),
  )
  await page.evaluate(() => document.getElementById('unfoldBtn')?.click())
  await new Promise((r) => setTimeout(r, 700))

  // 同一件事往下推一层：**弹层头部**也别再画 🎟️。
  // 判据必须落在「打开市场之后量到的 .sh-h 文本」上 —— 只查 HUD 的话，
  // 弹层里换个地方长回来的那枚胶囊照样能全绿。
  const openedMarket = await page.evaluate(() => {
    const b = document.querySelector('#host [data-open="market"]')
    if (!b) return false
    b.click()
    return true
  })
  await new Promise((r) => setTimeout(r, 400))
  const marketHead = await page.evaluate(() => {
    const h = document.querySelector('#host .sh-h')
    const t = (h?.innerText || '').replace(/\s+/g, ' ').trim()
    return { found: !!h, text: t }
  })
  check('市场弹层打得开（否则下一条是假绿）', openedMarket && marketHead.found, marketHead.text.slice(0, 40))
  check('★ 市场弹层头部不画 🎟️（宿主顶栏常驻，同一个数不画两遍）', marketHead.found && !marketHead.text.includes('🎟️'), marketHead.text)
  // 关掉，别让模态层挡住后面买种子 / 卖出的点击
  await page.evaluate(() => document.querySelector('#host .sh-h [data-act="close"]')?.click())
  await new Promise((r) => setTimeout(r, 300))

  /* ---------------- ② 买种子扣宿主积分 ---------------- */
  const before = await page.evaluate(() => window.__ledger())
  const plant = await page.evaluate(() => {
    const farm = window.__farm.farm
    const i = farm.s.plots.findIndex((p) => p.unlocked && !p.crop)
    const ok = farm.plant(i, 'rose') // 玫瑰：25 积分，Lv.1 就能种
    return { ok, i, seed: 25 }
  })
  await new Promise((r) => setTimeout(r, 500))
  const afterPlant = await page.evaluate(() => window.__ledger())
  check('种下一株玫瑰', plant.ok, `plot=${plant.i}`)
  check(
    '宿主积分账本真的多了一笔（-25）',
    afterPlant.points === before.points - 25 && afterPlant.pointsRows === before.pointsRows + 1,
    `${before.points}→${afterPlant.points} · rows ${before.pointsRows}→${afterPlant.pointsRows}`,
  )
  check('没有偷发游戏币（illegal = 0）', afterPlant.illegal === 0)

  /* ---------------- ③ 积分不够时一分不扣 ---------------- */
  const poor = await page.evaluate(() => {
    const w = window.__farm.farm.wallet
    const b = w.balance()
    const ok = w.spend(b + 1, '测试：余额不足')
    return { b, ok, snap: w.snapshot() }
  })
  await new Promise((r) => setTimeout(r, 300))
  const afterPoor = await page.evaluate(() => window.__ledger())
  check('余额不足时 spend() 返回 false', poor.ok === false, `balance=${poor.b}`)
  check(
    '余额不足时账本一行都没多（fail-closed）',
    afterPoor.pointsRows === afterPlant.pointsRows && afterPoor.points === afterPlant.points,
  )

  /* ---------------- ④ 卖出 → 兑换券 ---------------- */
  const sold = await page.evaluate(async () => {
    const farm = window.__farm.farm
    // ★ 再种两株（共三株）。**只种一株时这条用例会随机红**：
    //   `pickTier` 有 1% 的「枯萎」档，命中时 `amount = 0`，于是
    //   「收获进背包」和后面两条卖出断言一起变红 —— 而产品是对的。
    //   一个 1% 概率变红的用例，跑上几十次就会教会所有人「红色可以忽略」，
    //   那比没有用例更糟。三株同时全枯 ≈ 1e-6，工程上当作不会发生。
    const extra = []
    for (let k = 0; k < 2; k++) {
      const idx = farm.s.plots.findIndex((p) => p.unlocked && !p.crop)
      if (idx >= 0 && farm.plant(idx, 'rose')) extra.push(idx)
    }
    // 把已种下的玫瑰推到成熟并收进背包（收成本身不发票）
    // 顺手清掉 pest：带虫的权重表枯萎率 12%，那是另一条链路（捉虫），不该混进来。
    for (const p of farm.s.plots) {
      if (!p.crop) continue
      p.crop.readyAt = farm.now() - 1
      p.crop.pest = false
    }
    let harvested = 0
    for (let i = 0; i < farm.s.plots.length; i++) {
      const r = farm.harvest(i, 'store')
      if (r && r.amount > 0) harvested += r.amount
    }
    const vouchersBeforeSell = window.__ledger().vouchers
    const bagBefore = farm.s.bag.rose || 0
    const r = farm.sell('rose', bagBefore)
    await new Promise((res) => setTimeout(res, 700))
    return { extra: extra.length, harvested, bagBefore, sold: r, vouchersBeforeSell, led: window.__ledger(), eco: window.__farm.economy?.() }
  })
  check('三株都种下了（单株有 1% 枯萎档，见上面注释）', sold.extra === 2, `额外 ${sold.extra} 株`)
  check('收获进背包（收成不发券）', sold.harvested > 0 && sold.vouchersBeforeSell === 0, `收了 ${sold.harvested} 个`)
  check('卖出一批玫瑰', sold.sold.count > 0, `count=${sold.sold.count} earned=${sold.sold.earned}`)
  check(
    '卖出后兑换券真的进了宿主账本',
    sold.led.vouchers === sold.sold.earned && sold.led.voucherRows === 1,
    `vouchers=${sold.led.vouchers} rows=${sold.led.voucherRows}`,
  )
  check('兑换券桥没有欠账（pending = 0）', sold.eco && sold.eco.pending === 0, JSON.stringify(sold.eco))

  /* ---------------- 卸载干净 ---------------- */
  const un = await page.evaluate(async () => {
    await window.__t.unmountIt()
    const box = document.getElementById('host')
    return { canvas: box.querySelectorAll('canvas').length, ui: box.querySelectorAll('#ui').length, style: box.querySelectorAll('style').length }
  })
  check('卸载后容器清空（canvas / #ui / style 都没了）', un.canvas === 0 && un.ui === 0 && un.style === 0, JSON.stringify(un))

  check('没有未捕获异常', errors.length === 0, errors.slice(0, 3).join(' | '))
} finally {
  await browser.close()
}

console.log(`\n${fails.length ? '✗ 失败 ' + fails.length + ' 项' : '✓ 全部通过'}（${pass} 项通过）`)
if (fails.length) {
  for (const f of fails) console.log('  -', f)
  process.exit(1)
}
