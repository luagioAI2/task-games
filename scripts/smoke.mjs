/**
 * 独立版冒烟：把 `app.ts` 的改造跑一遍，确认它**还是那个游戏**。
 *
 * ```bash
 * npm run build
 * npx vite preview --port 4394 --strictPort &
 * node scripts/smoke.mjs http://127.0.0.1:4394/claw-machine/
 * ```
 *
 * ## 为什么先跑独立版，而不是直接进宿主
 *
 * 宿主那边一层套一层（React 外壳 → page-col → 插件容器 → 根节点），
 * 出问题时「是插件坏了」和「是宿主给的盒子不对」长得一模一样。
 * 独立版是同一份 `app.ts` 的最短路径，先把它跑绿，再去宿主里看盒子。
 *
 * 断言都是**能失败的**：
 *   · `#coins` 从 10 变 9 —— 证明钱包那条路真的接上了（不是显示了个 10）；
 *   · canvas 的 `clientWidth/Height` 都 > 200 —— 证明 `resize()` 量的是容器；
 *   · `__claw.game.state` 从 idle 变 play —— 证明物理引擎起来了。
 */
import { chromium } from 'playwright-core'
import fs from 'node:fs'

const URL_ = process.argv[2] ?? 'http://127.0.0.1:4394/claw-machine/'
const OUT = process.argv[3] ?? 'shots/smoke'

const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find((p) => fs.existsSync(p))

let pass = 0, fail = 0
const ok = (cond, msg, extra) => {
  if (cond) { pass++; console.log('  ✓', msg) }
  else { fail++; console.log('  ✗', msg, extra !== undefined ? JSON.stringify(extra) : '') }
}

const browser = await chromium.launch({
  executablePath: CHROME,
  args: ['--no-proxy-server', '--use-gl=angle', '--enable-unsafe-swiftshader', '--hide-scrollbars'],
})
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })

const logs = []
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(`[${m.type()}] ${m.text()}`) })
page.on('pageerror', (e) => logs.push('[pageerror] ' + e.message))

console.log('打开', URL_)
await page.goto(URL_, { waitUntil: 'domcontentloaded' })

// 物理引擎要 await 一次 init（wasm base64 解码），给足时间
await page.waitForFunction('window.__claw && window.__claw.ready === true', null, { timeout: 30000 })
ok(true, '物理引擎就绪（window.__claw.ready）')

await page.waitForSelector('#start.ready', { timeout: 10000 })
ok(true, '开场页进入 ready')

await page.screenshot({ path: `${OUT}-0-start.png` })

// ---- 点开始 ----
await page.click('#go')
await page.waitForFunction('window.__claw.intro === false', null, { timeout: 5000 })
ok(true, '开始游戏后 intro 关掉了')

/*
 * 首次进入 650ms 后会弹新手引导，**它会盖住投币按钮**。
 * 走查脚本必须先把引导关掉，否则后面所有点击都打在引导层上
 * （Playwright 报的是 "intercepts pointer events"，看着像按钮坏了）。
 */
await page.waitForTimeout(900)
if (await page.locator('#onboard.show').count()) {
  await page.click('#obSkip')
  ok(true, '新手引导弹出并能跳过')
  await page.waitForTimeout(400)
}

const size = await page.evaluate(() => {
  const c = document.getElementById('c')
  return { w: c.clientWidth, h: c.clientHeight, sw: c.width, sh: c.height }
})
ok(size.w > 200 && size.h > 200, 'canvas 有真实尺寸（不是 0×0）', size)

const coins0 = await page.evaluate(() => Number(document.querySelector('#coins b').textContent))
ok(coins0 === 10, '初始 10 币', coins0)

await page.screenshot({ path: `${OUT}-1-idle.png` })

// ---- 投币：钱要真的少一个，状态要真的进 play ----
await page.click('#insert')
await page.waitForFunction('window.__claw.game.state === "play"', null, { timeout: 5000 })
const coins1 = await page.evaluate(() => Number(document.querySelector('#coins b').textContent))
ok(coins1 === 9, '投币后 10 → 9', { coins0, coins1 })
ok(true, 'game.state 进入 play')

await page.waitForTimeout(600)
await page.screenshot({ path: `${OUT}-2-play.png` })

// ---- 卸不掉的东西：这条只是提醒，独立版本来就不卸载 ----
const errs = logs.filter((l) => l.startsWith('[pageerror]'))
ok(errs.length === 0, '没有未捕获异常', errs.slice(0, 3))
const warns = logs.filter((l) => !l.startsWith('[pageerror]'))
if (warns.length) console.log('  · 控制台提示', warns.slice(0, 5))

await browser.close()
console.log(`\n${fail === 0 ? '通过' : '失败'}: ${pass} 通过 / ${fail} 失败`)
process.exit(fail === 0 ? 0 : 1)
