#!/usr/bin/env node
/**
 * 走查截图 —— 商城详情页的图就来自这里（`shots/*.png` → `build-store-shots.py` 的 PLAN）。
 *
 * ```bash
 * node scripts/capture.mjs            # 出 4 张到 shots/
 * ```
 *
 * ## 为什么用 DOM 按钮而不是按坐标点
 *
 * 这游戏的 UI 是 **DOM**（`#ui` 里的 `button` / `.st` / `.icon-btn` 都是真元素），
 * 只有场景在 canvas 里。所以不需要按设计空间换算坐标。
 *
 * ⚠️ 但**必须用真鼠标**（`page.mouse.click`），不能 `el.click()`：
 *   · 音效运行时要求「从用户手势里解锁」，程序化 click 没有手势 ⇒
 *     每次点击抛 `SoundRuntimeError`（pageerror 一片红，看着像游戏坏了）；
 *   · 真鼠标走命中测试，被盖住会真的点不到 —— `el.click()` 绕过它，遮住也绿。
 *
 * ## 判据
 *
 * 每张图都要**颜色种类 ≥ 20**（纯色 = 没画出来）。这条用合成后的截图算，
 * 不能用 `drawImage(glCanvas)`（`preserveDrawingBuffer: false` ⇒ 恒为空白）。
 * ★ 结构断言只能证明「有图」，证明不了「图对」—— 出完图必须自己看一遍。
 */
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { countColors } from './lib/png-colors.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.dirname(HERE)
const PORT = Number(process.env.MOESTRIKE_SHOT_PORT || 4407)
const OUT = path.join(ROOT, 'shots')

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.json': 'application/json', '.css': 'text/css', '.png': 'image/png',
  '.webp': 'image/webp', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.m4a': 'audio/mp4', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2',
  '.pack': 'application/octet-stream', '.wasm': 'application/wasm',
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x')
  const p = path.join(ROOT, decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname))
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) {
    res.writeHead(404)
    res.end('not found')
    return
  }
  res.writeHead(200, { 'content-type': MIME[path.extname(p).toLowerCase()] ?? 'application/octet-stream' })
  fs.createReadStream(p).pipe(res)
})
await new Promise((r) => server.listen(PORT, '127.0.0.1', r))

const puppeteer = await (async () => {
  for (const c of ['puppeteer-core', path.join(ROOT, '..', '..', 'kid-quest-farm-2d', 'node_modules', 'puppeteer-core', 'lib', 'puppeteer', 'puppeteer-core.js')]) {
    try {
      return (await import(c.startsWith('puppeteer') ? c : pathToFileURL(c).href)).default
    } catch { /* 下一个 */ }
  }
  throw new Error('找不到 puppeteer-core')
})()
const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find((p) => fs.existsSync(p))

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    '--autoplay-policy=no-user-gesture-required'],
})
const page = await browser.newPage()
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

fs.mkdirSync(OUT, { recursive: true })
const fails = []
const shot = async (name, label) => {
  await sleep(700)
  const file = path.join(OUT, `${name}.png`)
  const colors = countColors(await page.screenshot({ path: file }))
  const ok = colors >= 20
  console.log(`  ${ok ? '✓' : '✗'} ${label.padEnd(18)} 颜色 ${String(colors).padStart(4)}  → ${path.relative(ROOT, file)}`)
  if (!ok) fails.push(`${label}（颜色只有 ${colors}）`)
}

/** 真鼠标点一个文字按钮 */
const tapText = async (txt, scope = '#ui') => {
  const box = await page.evaluate(([t, sc]) => {
    const el = [...document.querySelectorAll(`${sc} button, ${sc} .st, ${sc} .icon-btn, ${sc} .tap`)]
      .find((e) => { const s = (e.textContent || '').trim(); return s === t || s.startsWith(t) })
    if (!el) return null
    const r = el.getBoundingClientRect()
    if (!r.width || !r.height) return null
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
  }, [txt, scope])
  if (!box) return false
  await page.mouse.click(box.x, box.y)
  return true
}

const pageErrors = []
page.on('pageerror', (e) => pageErrors.push(String(e.message).slice(0, 160)))

await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'networkidle2', timeout: 60000 })
await page.waitForFunction('window.__gpPlayable === true', { timeout: 90000 }).catch(() => {})
await sleep(1800)

// ① 首页：标题 + 主视觉少女 + 两个入口
await shot('01-home', '首页')

// ② 关卡列表：20 个区域、每区 5 关、第一关可点
if (!(await tapText('冒险'))) fails.push('点不到「冒险」')
await sleep(900)
await shot('02-stages', '关卡列表')

// ③ 战斗：敌人、血条、底部四张头像卡
if (!(await tapText('1', '#ui .stages'))) fails.push('点不到「第 1 关」')
await sleep(800)
if (!(await tapText('出击', '#ui .modal'))) fails.push('点不到「出击」')
/*
 * ★ 不能写死 sleep。`Battle.tickFn` 里 `real = Math.min(deltaMS/1000, 1/30)`，
 *   而 headless + swiftshader 只有 4~6 fps ⇒ **游戏时间比墙钟慢 7 倍**。
 *   实测等 3.2 秒时 WAVE 横幅还在、敌人还没长出来（一张空场地）。
 *   所以这里**轮询状态**：等敌人真的出现、并且轮到玩家瞄准。
 */
let battleOk = false
for (let i = 0; i < 60; i++) {
  await sleep(500)
  battleOk = await page.evaluate(() => {
    const b = window.__mgs?.battle
    return !!b && b.enemies.length > 0 && b.phase === 'aim'
  })
  if (battleOk) break
}
if (!battleOk) fails.push('等不到「敌人出现 + 轮到玩家」')
await sleep(900)   // 让 WAVE 横幅淡出
await shot('03-battle', '战斗')

/*
 * ④ 角色：**要先把战斗拆掉**。
 *    `showChars()` 不会自动 `battle.destroy()`（正常流程是结算弹层里那个按钮），
 *    从战斗直接跳角色页会看到两层画面叠着 —— 那是脚本的问题，不是游戏的问题。
 *    正确路径：暂停 → 撤退（它会 `battle.destroy()` + `showHome()`）→ 角色。
 *
 * ⚠️ 暂停键是**画在 canvas 上**的（`Battle.onDown` 里判的是
 *    `hypot(p.x-(W-42), p.y-42) < 34`），DOM 里没有这个元素，
 *    所以只能按坐标点 —— 坐标由 `core.scale / offX / offY` 现算，别写死。
 */
const pauseAt = await page.evaluate(() => {
  const c = window.__mgs?.core
  if (!c?.app) return null
  const r = c.app.canvas.getBoundingClientRect()
  return { x: r.left + c.offX + (540 - 42) * c.scale, y: r.top + c.offY + 42 * c.scale }
})
if (!pauseAt) fails.push('读不到 core，算不出暂停键位置')
else {
  await page.mouse.click(pauseAt.x, pauseAt.y)
  await sleep(900)
}
if (!(await tapText('撤退', '#ui .modal'))) fails.push('点不到「撤退」')
await sleep(1400)
if (!(await tapText('角色'))) fails.push('点不到「角色」')
await sleep(1400)
await shot('04-chars', '角色页')

console.log('')
if (pageErrors.length) console.log(`  pageerror ${pageErrors.length}：${pageErrors.slice(0, 2).join(' | ')}`)
await browser.close()
server.close()

console.log(fails.length ? `\n✗ ${fails.length} 张有问题：${fails.join(' / ')}\n` : '\n✓ 4 张都出来了\n')
process.exit(fails.length ? 1 : 0)
