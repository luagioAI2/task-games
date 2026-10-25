/**
 * 界面走查截图（新版 UI）。**只出图 + 量尺寸，不做断言** ——
 * 断言在 scripts/plugin-test.cjs（契约）和宿主 scripts/e2e-plugin-local.mjs（真 App 链路）。
 *
 * 用法：node scripts/capture-ui.mjs [port]
 * 产物：shots/ui-*.png
 *
 * 为什么在 `_plugin-test.html`（假宿主）上拍：这里的容器就是 390×780 的定高盒子，
 * 和真宿主的插件容器一样；起一个静态服务就能跑，不用先 build 整个 App。
 */
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { mkdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const HOST_APP = 'E:/plan/test25/kid-quest-farm-2d'
// puppeteer-core 装在宿主工程里（这个工程没有 package.json）
const require = createRequire(join(HOST_APP, 'noop.js'))
const puppeteer = require('puppeteer-core')

const CHROME_CANDIDATES = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
]
const chrome = process.env.CHROME_PATH ?? CHROME_CANDIDATES.find((p) => existsSync(p))
if (!chrome) {
  console.error('✗ 找不到 Chrome / Edge —— 设 CHROME_PATH 指过去')
  process.exit(2)
}

const PORT = Number(process.argv[2] ?? 4397)
const OUT = join(ROOT, 'shots')
mkdirSync(OUT, { recursive: true })

const srv = spawn(process.execPath, ['server.js', String(PORT)], { cwd: ROOT, stdio: 'ignore' })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: 'new',
  args: ['--no-proxy-server', '--proxy-bypass-list=*', '--enable-unsafe-swiftshader', '--hide-scrollbars'],
})

let exitCode = 0
try {
  await sleep(900)
  const page = await browser.newPage()
  await page.setViewport({ width: 430, height: 860, deviceScaleFactor: 2 })
  await page.goto(`http://127.0.0.1:${PORT}/_plugin-test.html`, { waitUntil: 'load' })
  // 这个测试页**不会自动挂载**（plugin-test.cjs 也是显式调一次），这里照着来
  await page.waitForFunction('window.__ready === true', { timeout: 20000 })
  await page.evaluate('window.__t.loadAndMount()')
  await page.waitForFunction('window.__gpPlayable === true', { timeout: 45000 })
  await sleep(700)

  const box = await page.$('#host')
  const shot = async (name) => {
    await sleep(350)
    await box.screenshot({ path: join(OUT, `ui-${name}.png`) })
  }

  const tap = async (sel) => {
    const ok = await page.evaluate((s) => {
      const el = document.querySelector(s)
      if (!el) return false
      el.click()
      return true
    }, sel)
    if (!ok) throw new Error(`点不到 ${sel}`)
    await sleep(400)
  }

  /* ① 首页 = 机台选择 */
  await shot('01-home')

  const metrics = await page.evaluate(() => {
    const r = (el) => (el ? el.getBoundingClientRect() : null)
    const cards = [...document.querySelectorAll('#mGrid .mcell')]
    const c0 = r(cards[0])
    const bar = r(document.querySelector('.ppBar'))
    const box = r(document.querySelector('#host'))
    const scroller = document.querySelector('#cards')
    return {
      cards: cards.length,
      cardW: c0 && Math.round(c0.width),
      cardH: c0 && Math.round(c0.height),
      rowsVisible: c0 ? Math.floor((scroller.clientHeight - 90) / (c0.height + 8)) : 0,
      barH: bar && Math.round(bar.height),
      barTop: bar && Math.round(bar.top - box.top),
      boxH: box && Math.round(box.height),
      barVisible: !!(bar && bar.bottom <= box.bottom + 0.5),
      scrollable: scroller.scrollHeight > scroller.clientHeight,
      scrollH: scroller.scrollHeight,
      clientH: scroller.clientHeight,
      barLabels: [...document.querySelectorAll('.barTile b')].map((b) => b.textContent),
      badges: [...document.querySelectorAll('.barTile .cnt')].map((b) => ({
        txt: b.textContent,
        shown: getComputedStyle(b).display !== 'none',
      })),
    }
  })
  console.log('首页尺寸:', JSON.stringify(metrics, null, 0))

  /* 滚到底看一排半 */
  await page.evaluate(() => { document.querySelector('#cards').scrollTop = 9999 })
  await shot('02-home-bottom')

  /* ② 背包
   *
   * 先塞几只娃娃进去（`__debug.grant`）：空背包的走查图里 5 个组合全是
   * 「还缺 N 种」，看不出「可兑换」长什么样 —— 那张图等于没走查。
   * 给的是**玩家真能拿到**的 id，不是假数据。
   */
  await page.evaluate(() => {
    const g = window.__debug?.grant
    if (!g) return
    for (const id of ['bear', 'pillow_pig', 'pillow_rabbit', 'pillow_dog', 'cake_set', 'cake_parfait']) g(id, 1)
  })
  await tap('#colBtn')
  await shot('03-collection')
  await tap('#colBack')

  /* ③ 背包里的卖出面板（没抓到娃娃就跳过 —— 截图脚本不该因为库存为空而失败） */
  await tap('#colBtn')
  const sellOpened = await page.evaluate(() => {
    const c = document.querySelector('#colGrid .cell[data-owned]:not([data-owned="0"])')
    if (!c) return false
    c.click()
    return true
  })
  if (sellOpened) {
    await shot('04-bag-sell')
    await tap('#rcCancel')
  } else {
    console.log('  （背包里没有可卖的娃娃，跳过卖出面板）')
  }
  await tap('#colBack')

  /* ④ 排行 */
  await tap('#rankBtn')
  await shot('05-rank')
  await tap('#rankBack')

  /* ⑤ 进机台 */
  const entered = await page.evaluate(() => {
    const c = document.querySelector('#mGrid .mcell:not(.wip)')
    if (!c) return false
    c.click()
    return true
  })
  if (!entered) throw new Error('没有可玩的机台')
  await page.waitForFunction('!document.querySelector("#play").classList.contains("hidden")', { timeout: 20000 })
  await sleep(1800)
  await shot('06-play')

  const play = await page.evaluate(() => {
    const r = (el) => (el ? el.getBoundingClientRect() : null)
    const vp = r(document.querySelector('#viewport'))
    const btn = r(document.querySelector('#btnPlay'))
    const box = r(document.querySelector('#host'))
    return {
      vp: vp && { w: Math.round(vp.width), h: Math.round(vp.height) },
      btn: btn && { w: Math.round(btn.width), h: Math.round(btn.height) },
      vpRatio: vp && +(vp.height / box.height).toFixed(2),
      hud: document.querySelector('#hudName')?.textContent,
      step: document.querySelector('#step')?.textContent,
    }
  })
  console.log('机台页尺寸:', JSON.stringify(play))

  /* ⑥ 设置面板（从首页齿轮进） */
  await tap('#backBtn')
  await tap('#settingsBtn')
  await shot('07-settings')
} catch (e) {
  exitCode = 1
  console.error('FAIL', e)
} finally {
  await browser.close().catch(() => {})
  srv.kill()
}
process.exit(exitCode)
