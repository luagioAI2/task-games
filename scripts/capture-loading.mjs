#!/usr/bin/env node
/**
 * 加载页走查：手机竖 / 平板竖 / 平板横 三档，各在几个进度点上出图 + 量几何。
 *
 * 为什么要有这个脚本：加载页只存在 1~3 秒，靠真加载截图拿不到稳定帧，而且
 * `preserveAspectRatio="… slice"` 会按盒子比例裁边 —— 「0% 时吊笼还在不在框里」
 * 这种事**看不出来**（0% 那一帧太快），只能量。
 * 做法：等加载页 DOM 出现 → 把 `#loading` 的 `.done` 摘掉 → 手动设 `--p` → 拍/量。
 *
 * 两个会让读数说谎的坑，脚本里都处理了：
 *   ① `transition` 没跑完就取样 ⇒ 量到的是动画**起点**（p=1 读出来是 p=0 的位置）；
 *   ② App 还在加载时 `setLoading()` 每帧覆盖 `--p` ⇒ 手设的值立刻被改回去。
 *
 * 产物：shots/_loading/（已 gitignore，别当商城截图用）。
 * 用法：node scripts/capture-loading.mjs
 */
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.dirname(HERE)
const HOST = path.resolve(ROOT, '..', '..', 'kid-quest-farm-2d')
const PORT = Number(process.env.PORT || 4412)
const OUT = path.join(ROOT, 'shots', '_loading')
fs.mkdirSync(OUT, { recursive: true })

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp',
  '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.m4a': 'audio/mp4', '.pack': 'application/octet-stream',
}
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x')
  const p = path.resolve(ROOT, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname))
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) {
    res.writeHead(404); res.end('nf'); return
  }
  res.writeHead(200, { 'content-type': MIME[path.extname(p).toLowerCase()] ?? 'application/octet-stream' })
  fs.createReadStream(p).pipe(res)
})
await new Promise((r) => server.listen(PORT, '127.0.0.1', r))

const puppeteer = (await import(pathToFileURL(path.join(HOST, 'node_modules', 'puppeteer-core', 'lib', 'puppeteer', 'puppeteer-core.js')).href)).default
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find((p) => fs.existsSync(p))
const browser = await puppeteer.launch({
  executablePath: CHROME, headless: true,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'],
})

const VIEWS = [
  { tag: 'p', width: 390, height: 844, label: '手机竖 390x844' },
  { tag: 't', width: 834, height: 1112, label: '平板竖 834x1112' },
  { tag: 'l', width: 1112, height: 834, label: '平板横 1112x834', shots: [0.47] },
]
const PROBLEMS = []

for (const v of VIEWS) {
  const page = await browser.newPage()
  await page.setViewport({ width: v.width, height: v.height, deviceScaleFactor: 2 })
  page.on('pageerror', (e) => console.log('  ! pageerror:', String(e.message).slice(0, 120)))
  await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await new Promise((r) => setTimeout(r, 700))
  if (v.tag === 'p') await page.screenshot({ path: path.join(OUT, 'live-early.png') })

  // 只要加载页的 DOM 就够了，不必等游戏跑起来（等 __gpPlayable 每个视口要多花 40 秒，
  // 三个视口就超时）。真加载中的那一帧上面已经拍过了。
  const ok = await page.waitForFunction("!!document.querySelector('.ld-cage')", { timeout: 45000 }).then(() => true, () => false)
  const playable = await page.evaluate('window.__gpPlayable === true')
  console.log(`${v.label}  加载页 DOM: ${ok}  (此刻 playable=${playable})`)
  if (!ok) { PROBLEMS.push(`${v.label} 加载页没出现`); await page.close(); continue }

  // ⚠️ 量几何之前必须先把过渡关掉：headless 下帧率极低（WebGL 那套更慢），
  //    `transition: transform .42s` 可能一格都没跑，量到的是**起点**值。
  //    实测没关的时候 p=1 读出来是 `matrix(…,0,30)`（就是 p=0 的位置），
  //    看着像「`--p` 没生效」，其实是取样取在了动画开始的那一帧。
  await page.addStyleTag({ content: '*,*::before,*::after{transition:none!important}' })

  // ⚠️ 还要等 App 自己停止写 `--p`：游戏还在加载时 `setLoading()` 每帧都会把它改回真实进度，
  //    手设的值立刻被覆盖（实测 p=0 量到进度条 90%、吊笼几乎没动，看着像 CSS 坏了）。
  //    判据：塞一个哨兵值，250ms 后还是它 ⇒ 没人再写。
  let quiet = false
  for (let i = 0; i < 60 && !quiet; i++) {
    quiet = await page.evaluate(async () => {
      const el = document.getElementById('loading')
      el.style.setProperty('--p', '0.4242')
      await new Promise((r) => setTimeout(r, 250))
      return el.style.getPropertyValue('--p') === '0.4242'
    })
  }
  console.log(`  --p 已交给探针: ${quiet}`)
  if (!quiet) PROBLEMS.push(`${v.label} 等不到 App 停止写 --p（加载一直没结束）`)

  const setP = async (p) => {
    await page.evaluate((val) => {
      const el = document.getElementById('loading')
      el.classList.remove('done'); el.hidden = false
      el.style.setProperty('--p', String(val))
      el.querySelector('.ld-pct').textContent = Math.round(val * 100) + '%'
    }, p)
    await new Promise((r) => setTimeout(r, 200))
  }

  // ── 几何：吊笼在 p=0 / p=1 必须整个落在 .ld-art 里；金块整组不能被裁 ──
  for (const p of [0, 1]) {
    await setP(p)
    const g = await page.evaluate(() => {
      const box = (el) => el.getBoundingClientRect()
      const art = box(document.querySelector('.ld-art'))
      // 绳子从 y=-700 拉到吊笼，直接量 .ld-cage 会把绳子算进去（顶边变成 -899）
      // ⇒ 量的时候把绳子临时藏掉，只留笼体。
      const cage = document.querySelector('.ld-cage')
      const rope = [...cage.children].filter((e) => e.tagName === 'rect' && +e.getAttribute('y') === -700)
      rope.forEach((r) => { r.style.display = 'none' })
      const c = box(cage)
      rope.forEach((r) => { r.style.display = '' })
      const nug = box(document.querySelector('.ld-nugget'))
      const svg = box(document.querySelector('.ld-svg'))
      const bar = box(document.querySelector('.ld-bar'))
      const fill = box(document.querySelector('.ld-bar > i'))
      return {
        art: { t: art.top, b: art.bottom, l: art.left, r: art.right, w: art.width, h: art.height },
        cage: { t: c.top, b: c.bottom }, nug: { l: nug.left, r: nug.right },
        svg: { w: svg.width, h: svg.height }, barW: bar.width, fillW: fill.width,
      }
    })
    const r = (n) => Math.round(n)
    console.log(`  p=${p}  盒子 ${r(g.art.w)}x${r(g.art.h)}  svg ${r(g.svg.w)}x${r(g.svg.h)}` +
      `  笼体 ${r(g.cage.t - g.art.t)}~${r(g.cage.b - g.art.t)}` +
      `  金块 ${r(g.nug.l - g.art.l)}~${r(g.nug.r - g.art.l)}  条 ${r(g.fillW)}/${r(g.barW)}`)
    if (g.cage.t < g.art.t - 1) PROBLEMS.push(`${v.label} p=${p} 吊笼顶被裁 (${r(g.cage.t - g.art.t)})`)
    if (g.cage.b > g.art.b + 1) PROBLEMS.push(`${v.label} p=${p} 吊笼底被裁 (+${r(g.cage.b - g.art.b)})`)
    if (g.nug.l < g.art.l - 1) PROBLEMS.push(`${v.label} p=${p} 金块左边被裁 (${r(g.nug.l - g.art.l)})`)
    if (g.nug.r > g.art.r + 1) PROBLEMS.push(`${v.label} p=${p} 金块右边被裁 (+${r(g.nug.r - g.art.r)})`)
    const ratio = g.fillW / g.barW
    if (Math.abs(ratio - p) > 0.03) PROBLEMS.push(`${v.label} p=${p} 进度条宽度不对 (${ratio.toFixed(2)})`)
  }

  for (const p of v.shots ?? [0.12, 0.47, 0.88]) {
    await setP(p)
    const name = `${v.tag}${String(Math.round(p * 100)).padStart(2, '0')}.png`
    await page.screenshot({ path: path.join(OUT, name) })
    console.log('  出图', name)
  }
  await page.close()
}

await browser.close()
server.close()
console.log(PROBLEMS.length ? '\n✗ ' + PROBLEMS.join('\n✗ ') : '\n✓ 几何检查全过')
console.log('→', OUT)
