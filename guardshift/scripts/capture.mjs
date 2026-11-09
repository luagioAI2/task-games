#!/usr/bin/env node
/**
 * 拍 4 张商城图（390×844 DPR2，直接喂 `scripts/build-store-shots.py`）。
 *
 * ```bash
 * node scripts/capture.mjs
 * ```
 *
 * | 文件 | 画面 | 为什么要它 |
 * | --- | --- | --- |
 * | `store-1.png` | 标题页（Guardshift / 防卫模式 / 进攻模式） | 详情页第一张必须回答「这是什么游戏」 |
 * | `store-2.png` | 战斗进行中（路上有兵、有敌人、HUD 有金币和波次） | 核心玩法，放第二张 |
 * | `store-3.png` | 伙伴图鉴（14 防守 + 12 进攻，带远程/近战/范围/增益标签） | 内容量 |
 * | `store-4.png` | 卡组页（选兵 + 出阵） | 策略层：带哪几个兵是玩家自己决定的 |
 *
 * ★ 关卡列表那张**故意不拍**：整屏都是「未解锁」，放进商店像在展示「你玩不到」。
 *
 * ## 三个「看着绿其实没拍到」的坑
 *
 * 1. **等资源加载不能用固定 sleep**：8 MB 资源在 headless + swiftshader 下要 20 秒左右，
 *    固定 `sleep(8000)` 会拍到加载条（而且颜色数够多，走查也看不出是加载页）。
 *    判据是 `state().assetsReady === true` 再等画面稳定。
 * 2. **放兵不能写死像素**：棋盘随容器缩放，写死坐标换个视口就放到界外。
 *    这里从调试桥拿 `route()`（路径格），再试它四邻——那才是「贴着路」的合法格。
 * 3. **波次要等它真的开打**：`wave()` 之后立刻截图，画面上只有空地和「准备中」。
 *    判据是 `mobs > 0` 且 `phase === 'battle'`。
 */
import { createServer } from 'node:http'
import { readFile, access, mkdir } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'
import { pathToFileURL } from 'node:url'

const ROOT = process.cwd()
const PORT = 4403
const OUT = 'screenshots'

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webp': 'image/webp',
  '.m4a': 'audio/mp4',
  '.pack': 'application/octet-stream',
  '.png': 'image/png',
}

const srv = createServer(async (req, res) => {
  try {
    const p = normalize(decodeURIComponent(req.url.split('?')[0]))
    const rel = p === '/' || p === '\\' ? 'index.html' : p.replace(/^[\\/]+/, '')
    const buf = await readFile(join(ROOT, rel))
    res.writeHead(200, { 'content-type': MIME[extname(rel)] || 'application/octet-stream' })
    res.end(buf)
  } catch {
    res.writeHead(404).end('404')
  }
})
await new Promise((r) => srv.listen(PORT, '127.0.0.1', r))

// 用宿主仓库里的 puppeteer-core + 本机 Chrome（不额外装依赖）
const puppeteer = (
  await import(
    pathToFileURL('E:/plan/test25/kid-quest-farm-2d/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js').href
  )
).default

let exe = ''
for (const c of [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
]) {
  try {
    await access(c)
    exe = c
    break
  } catch {
    /* 下一个 */
  }
}
if (!exe) {
  console.error('找不到 Chrome / Edge')
  process.exit(2)
}

const browser = await puppeteer.launch({
  executablePath: exe,
  headless: true,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})
const page = await browser.newPage()
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 })

const errs = []
page.on('pageerror', (e) => errs.push('pageerror: ' + e.message))
page.on('console', (m) => {
  if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 200))
})
page.on('response', (r) => {
  // favicon 的 404 是常驻噪声（原站就没有），其余都要报
  if (r.status() >= 400 && !/favicon/.test(r.url())) errs.push('HTTP ' + r.status() + ' ' + r.url())
})

await mkdir(OUT, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const shot = async (n) => {
  await page.screenshot({ path: join(OUT, n) })
  console.log('  拍', n)
}
const st = () => page.evaluate(() => (window.__guardshift ? window.__guardshift.state() : null))
const clickText = (txt) =>
  page.evaluate((t) => {
    const b = [...document.querySelectorAll('.ui button')].find((x) => x.textContent.includes(t))
    if (!b) return false
    b.click()
    return true
  }, txt)

/**
 * 等提示条自己消失。
 *
 * ★ 放兵是「试四邻」的：试到不能放的格子时 `tapCell` 会弹一条红色「不能放在这里」。
 *   它**正好落在画面正中**，拍进去就成了「这游戏一进去就报错」。
 *   别用 `el.remove()` 硬删 —— UI 每帧重渲染，删了还会回来，而且删完立刻截图会拍到半透明残影。
 */
const waitToastGone = async () => {
  await page
    .waitForFunction(
      () =>
        [...document.querySelectorAll('.ui .toast')].every((e) => {
          const cs = getComputedStyle(e)
          return cs.display === 'none' || Number(cs.opacity) === 0
        }),
      { timeout: 8000 },
    )
    .catch(() => {})
  await sleep(350)
}

await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'domcontentloaded' })
await page.waitForFunction(() => window.__guardshift?.state().assetsReady === true, { timeout: 60000 })
await sleep(1500)
console.log('① 标题页', JSON.stringify(await st()))
await shot('store-1.png')

console.log('② 防卫模式 → 1-1（进卡组页）', await clickText('防卫模式'))
await sleep(1000)
console.log('③ 点 1-1', await clickText('1-1'))
await sleep(1000)
console.log('   ', JSON.stringify(await st()))
await shot('store-4.png')

console.log('④ 出阵', await clickText('出阵'))
await sleep(1800)
console.log('   ', JSON.stringify(await st()))

/*
 * 放兵：从路径格出发试四邻。`place()` 返回 `{placed:true}` 才算放上，
 * 所以不用猜哪格能放、也不会因为「看着放上了其实没放」而拍出一张空战场。
 */
const placed = await page.evaluate(() => {
  const g = window.__guardshift
  const route = g.act.route()
  const kinds = ['archer', 'spear', 'bomb', 'gummy', 'spike']
  const out = []
  let ki = 0
  // 从路径中段开始，往两边铺 —— 兵要贴着路才看得出「在拦」
  for (const key of route.slice(Math.floor(route.length * 0.35), Math.floor(route.length * 0.85))) {
    if (out.length >= 4) break
    const [c, r] = key.split(',').map(Number)
    for (const [dc, dr] of [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [-1, -1]]) {
      if (out.length >= 4) break
      const res = g.act.place(kinds[ki % kinds.length], c + dc, r + dr)
      if (res && res.placed) {
        out.push({ kind: kinds[ki % kinds.length], c: c + dc, r: r + dr })
        ki++
        break
      }
    }
  }
  return out
})
console.log('   放兵', JSON.stringify(placed))
await waitToastGone()

// 开波，然后按帧推进到「有敌人 + 打起来了」
await page.evaluate(() => window.__guardshift.act.wave())
for (let i = 0; i < 60; i++) {
  await page.evaluate(() => window.__guardshift.act.step(60))
  const s = await st()
  if (s && s.phase === 'battle' && s.mobs >= 3) break
  await sleep(80)
}
// 再推一点：让敌人走到兵跟前，画面上才有交战特效
for (let i = 0; i < 12; i++) {
  await page.evaluate(() => window.__guardshift.act.step(30))
  await sleep(60)
}
await waitToastGone()
await sleep(700)
console.log('⑤ 战斗中', JSON.stringify(await st()))
await shot('store-2.png')

/*
 * ⑥ 伙伴图鉴：换一张「内容量」的图。
 *    ★ 关卡列表那张整屏都是「未解锁」，放进商店像在展示「你玩不到」；
 *      图鉴里有 14 个防守伙伴 + 12 个进攻伙伴，还有远程/近战/范围/增益四种标签。
 *    重载一次比「从战场点退出→回标题」稳：战场有暂停层、结算层、返回确认，
 *    点错一步就会拍到半透明遮罩。
 */
await page.reload({ waitUntil: 'domcontentloaded' })
await page.waitForFunction(() => window.__guardshift?.state().assetsReady === true, { timeout: 60000 })
await sleep(1200)
console.log('⑥ 伙伴图鉴', await clickText('伙伴图鉴'))
await sleep(1200)
console.log('   ', JSON.stringify(await st()))
await shot('store-3.png')

console.log('--- 报错 ---')
console.log(errs.slice(0, 8).join('\n') || '（无）')
await browser.close()
srv.close()
