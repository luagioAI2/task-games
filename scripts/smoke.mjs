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

// ---- 机位：只有两档，点哪档就是哪档 ----
const cam0 = await page.evaluate(() => ({
  mode: window.__claw.camMode,
  x: +window.__claw.camera.position.x.toFixed(2),
  on: [...document.querySelectorAll('#views [data-cam]')].map((b) => b.dataset.cam + (b.classList.contains('on') ? '*' : '')),
}))
ok(cam0.mode === 'front' && Math.abs(cam0.x) < 0.05, '默认在正面机位（相机 x≈0）', cam0)
ok(cam0.on.join(',') === 'front*,side', '正面按钮高亮', cam0.on)

await page.click('#views [data-cam="side"]')
await page.waitForFunction('window.__claw.camMode === "side" && !window.__claw.camAnimating()', null, { timeout: 8000 })
const cam1 = await page.evaluate(() => ({
  x: +window.__claw.camera.position.x.toFixed(2),
  z: +window.__claw.camera.position.z.toFixed(2),
  on: [...document.querySelectorAll('#views [data-cam]')].map((b) => b.dataset.cam + (b.classList.contains('on') ? '*' : '')),
}))
/*
 * 断言「真的站到侧面了」，而不是「点了没报错」：直接算方位角 az = atan2(x, z)，
 * 要求它落在 1.40 rad（≈80°）附近。
 * 这条能抓住一个真踩过的坑 —— OrbitControls 的 maxAzimuthAngle 原来写死 ±1.0，
 * 相机会被**悄悄夹回 57°**（1.0 rad）：按钮看着生效了、机位却没到位。
 * 只断言「x 变大了」抓不住（夹到 57° 时 x 也大），所以必须量角度。
 */
const az = Math.atan2(cam1.x, cam1.z)
ok(Math.abs(az - 1.4) < 0.06, '侧面机位真的转到 80°（az≈1.40）', { ...cam1, az: +az.toFixed(3) })
ok(cam1.on.join(',') === 'front,side*', '侧面按钮高亮', cam1.on)
await page.screenshot({ path: `${OUT}-3-side.png` })

await page.keyboard.press('KeyV')
await page.waitForFunction('window.__claw.camMode === "front" && !window.__claw.camAnimating()', null, { timeout: 8000 })
ok(true, 'V 键切回正面')

// ---- 取景：机台必须整个在「顶栏以下、控制台以上」那块可视区里 ----
/*
 * 只断言「按钮高亮了 / 角度对了」是不够的：机位**到位**不等于**框得住**。
 * 实测翻车过一次 —— 相机的远平面写的是 30，而按取景公式站在 5.1，
 * 3.34 处（相机真实位置）反而在 far 之外，机台先被长焦拉小到 15% 又在 far 处
 * 被裁掉，屏幕上只剩一小块白 —— 而「角度」断言全绿。
 * 所以这里量投影：机台主体的四个角投到屏幕上，要求
 *   ① 上下都落在 [顶栏底, 控制台顶] 之间（负像素 = 被挡住）
 * ② 左右都在画面内
 * ③ 高度占比 ≥ 0.5（不是「被拉远成一个小点」）
 */
async function framing(mode) {
  return page.evaluate((m) => {
    window.__claw.goView(m, true)
    const c = window.__claw.camera, cv = window.__claw.renderer.domElement
    const V = c.position.constructor
    c.updateMatrixWorld()
    const raw = window.__claw.bboxOf(window.__claw.machineRoot)
    // 主体轮廓（不含控制杆按钮、轮子这类 1~2cm 凸起）
    const lo = [Math.max(raw.min[0], -0.6), Math.max(raw.min[1], -1.02), raw.min[2]]
    const hi = [Math.min(raw.max[0], 0.6), Math.min(raw.max[1], 1.53), raw.max[2]]
    const pts = []
    for (const x of [lo[0], hi[0]]) for (const y of [lo[1], hi[1]]) for (const z of [lo[2], hi[2]]) {
      const p = new V(x, y, z).project(c)
      pts.push({ x: ((p.x + 1) / 2) * cv.clientWidth, y: ((1 - p.y) / 2) * cv.clientHeight })
    }
    const board = document.getElementById('board').getBoundingClientRect()
    const deckEl = document.getElementById('deck')
    const wide = document.body.classList.contains('wide')
    const deck = deckEl.getBoundingClientRect()
    const visBottom = !wide && deck.height > 0 ? deck.top : cv.clientHeight
    const minX = Math.min(...pts.map((p) => p.x)), maxX = Math.max(...pts.map((p) => p.x))
    const minY = Math.min(...pts.map((p) => p.y)), maxY = Math.max(...pts.map((p) => p.y))
    return {
      gapTop: Math.round(minY - board.bottom), gapBottom: Math.round(visBottom - maxY),
      gapLeft: Math.round(minX), gapRight: Math.round(cv.clientWidth - maxX),
      hFill: +((maxY - minY) / (visBottom - board.bottom)).toFixed(2),
      wFill: +((maxX - minX) / cv.clientWidth).toFixed(2),
    }
  }, mode)
}
const fr = await framing('front')
ok(fr.gapTop > -2 && fr.gapBottom > -2, '正面：机台整个落在顶栏与控制台之间', fr)
ok(fr.gapLeft > -2 && fr.gapRight > -2, '正面：左右没出画', fr)
ok(fr.hFill > 0.5, '正面：机台确实占满高度（不是被拉远）', fr)
const fm = await framing('side')
ok(fm.gapTop > -2 && fm.gapBottom > -2, '侧面：机台整个落在顶栏与控制台之间', fm)
ok(fm.gapLeft > -2 && fm.gapRight > -2, '侧面：左右没出画', fm)
ok(fm.hFill > 0.5, '侧面：机台确实占满高度', fm)
await page.evaluate(() => window.__claw.goView('front'))

// ---- 卸不掉的东西：这条只是提醒，独立版本来就不卸载 ----
const errs = logs.filter((l) => l.startsWith('[pageerror]'))
ok(errs.length === 0, '没有未捕获异常', errs.slice(0, 3))
const warns = logs.filter((l) => !l.startsWith('[pageerror]'))
if (warns.length) console.log('  · 控制台提示', warns.slice(0, 5))

await browser.close()
console.log(`\n${fail === 0 ? '通过' : '失败'}: ${pass} 通过 / ${fail} 失败`)
process.exit(fail === 0 ? 0 : 1)
