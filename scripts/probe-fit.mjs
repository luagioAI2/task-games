/**
 * 机位取景占用率探针 —— 回答「机台在画面里到底有多大、有没有被底栏压住」。
 *
 * 这些只在几何上量得出来（截图上只能靠肉眼「感觉有点小」）：
 *   1. 机台包围盒投影到屏幕后的**宽度占用**（w / 画布宽）、**高度占用**（h / 可视高度）
 *   2. 机台底边离「控制台面板顶边」多少像素（负数 = 被压住）
 *   3. 机台左右离画布边缘多少像素（负数 = 出画）
 *
 * 可视高度 = 画布高 - 顶栏(board) - 控制台(deck) —— 取景本来就是围绕这块做的
 * （`camera.setViewOffset` + `visFrac`）。
 */
import { chromium } from 'playwright-core'
import fs from 'node:fs'

const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => fs.existsSync(p))
const URL_ = (process.argv[2] ?? 'http://localhost:4394/claw-machine/').replace('127.0.0.1', 'localhost')
const browser = await chromium.launch({
  executablePath: CHROME,
  args: ['--no-proxy-server', '--use-gl=angle', '--enable-unsafe-swiftshader', '--hide-scrollbars'],
})

for (const [w, h, tag] of [[375, 667, 'phone'], [390, 844, 'phone2'], [1024, 768, 'desk']]) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 })
  const errs = []
  page.on('pageerror', (e) => errs.push(e.message))
  await page.goto(URL_ + '?noguide', { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => window.__claw?.ready && !document.getElementById('go').disabled, null, { timeout: 120000 })
  // 用 DOM click：开场有遮罩 / 出奖卡片会拦住坐标点击（Playwright 默认点坐标）
  await page.evaluate(() => document.getElementById('go').click())
  await page.waitForFunction(() => !window.__claw.camAnimating(), null, { timeout: 60000 })
  await page.waitForTimeout(2500)
  for (const mode of ['front', 'side']) {
    await page.evaluate((m) => document.querySelector(`#views [data-cam="${m}"]`).click(), mode)
    await page.waitForFunction(() => !window.__claw.camAnimating(), null, { timeout: 30000 }).catch(() => {})
    await page.waitForTimeout(1800)
    const r = await page.evaluate(() => {
      const c = window.__claw.camera
      const s = window.__claw.scene
      const cv = window.__claw.renderer.domElement
      // 机台 root：scene 里孩子最多的那个 Group（room 只有 floor+wall，机台有几十个）
      let machine = null
      for (const o of s.children) if (o.type === 'Group' && (!machine || o.children.length > machine.children.length)) machine = o
      // 娃娃会滚到格外（带颜色的小球），只框「壳体」= 机台 root 里不带名字的静态件

      // 包围盒手里的 Vector3 构造器 —— 不额外 import three
      const V3 = c.position.constructor
      // 包围盒只取「静止部分」= 去掉吊爪 / 钢缆 / 三个爪臂（它们会随游戏上下动）
      // 只框「机台本体」：吊爪 / 钢缆 / 三个爪臂会随游戏上下动，不算取景目标
      // 控制台的**控制杆 / 红色按钮 / LCD** 是为了「看得见在操作」而突出的，取景时要它们进画，
      // 但它们超出柜体 1.4cm 就会把整机顶出画面（取紧后 1px 也是溢出）。
      // 这里分段量：壳体（不含控制杆）决定「主体有没有被裁」，几个突出的挑出来单列。
      const braw = window.__claw.bboxOf(window.__claw.machineRoot ?? machine)
      const shellMaxY = 1.53
      // 「主体」= 柜体 + 玻璃罩 + 灯箱（y 1.52 / x ±0.6 / z 0.70）；控制杆按钮 2cm、轮子 1cm 的凸起不算
      const bb = { min: { x: Math.max(braw.min[0], -0.6), y: Math.max(braw.min[1], -1.02), z: braw.min[2] }, max: { x: Math.min(braw.max[0], 0.6), y: Math.min(braw.max[1], 1.53), z: braw.max[2] } }
      c.updateMatrixWorld() // 不调用的话 matrixWorld 是上一帧的，量出来差几像素到几十像素
      const toScreen = (x, y, z) => {
        const p = new V3(x, y, z).project(c)
        return { x: ((p.x + 1) / 2) * cv.clientWidth, y: ((1 - p.y) / 2) * cv.clientHeight }
      }
      const pts = []
      for (const X of [bb.min.x, bb.max.x]) for (const Y of [bb.min.y, bb.max.y]) for (const Z of [bb.min.z, bb.max.z]) pts.push(toScreen(X, Y, Z))
      const minX = Math.min(...pts.map((p) => p.x)), maxX = Math.max(...pts.map((p) => p.x))
      const minY = Math.min(...pts.map((p) => p.y)), maxY = Math.max(...pts.map((p) => p.y))
      const board = document.getElementById('board').getBoundingClientRect()
      const deckEl = document.getElementById('deck')
      const deck = deckEl ? deckEl.getBoundingClientRect() : null
      // 宽屏时控制台是右侧栏（不压画布），可视上下界就是整个画布
      const wide = document.body.classList.contains('wide')
      const visTop = board.bottom, visBottom = !wide && deck && deck.height > 0 ? deck.top : cv.clientHeight
      const r2 = (n) => Math.round(n)
      return {
        cam: [c.position.x, c.position.y, c.position.z].map((n) => +n.toFixed(2)),
        canvas: [cv.clientWidth, cv.clientHeight],
        box: { x: r2(minX), y: r2(minY), w: r2(maxX - minX), h: r2(maxY - minY) },
        vis: { top: r2(visTop), bottom: r2(visBottom), h: r2(visBottom - visTop) },
        wFill: +((maxX - minX) / cv.clientWidth).toFixed(3),
        hFill: +((maxY - minY) / (visBottom - visTop)).toFixed(3),
        gapTop: r2(minY - visTop),
        gapBottom: r2(visBottom - maxY),
        gapLeft: r2(minX),
        gapRight: r2(cv.clientWidth - maxX),
      }
    })
    console.log(tag, mode, JSON.stringify(r))
  }
  if (errs.length) console.log(tag, 'errs', errs.slice(0, 2))
  await page.close()
}
await browser.close()
