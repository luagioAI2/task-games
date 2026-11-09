#!/usr/bin/env node
/**
 * 加载页走查：手机竖 / 平板竖 / 平板横 三档，各在几个进度点上出图 + 量几何。
 *
 * 为什么要有这个脚本：加载页只存在 1~3 秒，靠真加载截图拿不到稳定帧，而且
 * `preserveAspectRatio="… slice"` 会按盒子比例裁边 —— 「0% 时吊笼还在不在框里」
 * 这种事**看不出来**（0% 那一帧太快），只能量。
 * 做法：等加载页 DOM 出现 → 把 `#loading` 的 `.done` 摘掉 → 手动设 `--p` → 拍/量。
 *
 * 三个会让读数说谎的坑，脚本里都处理了：
 *   ① `transition` 没跑完就取样 ⇒ 量到的是动画**起点**（p=1 读出来是 p=0 的位置）；
 *   ② App 还在加载时 `setLoading()` 每帧覆盖 `--p` ⇒ 手设的值立刻被改回去；
 *   ③ 「DOM 说可见」≠「画面里真是加载页」—— App 加载完会 `hidden = true`，
 *      而且实测还出现过 DOM 全绿却截到游戏本体（旧合成帧）⇒ 出图后必须再验一次像素。
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
  { tag: 'l', width: 1112, height: 834, label: '平板横 1112x834' },
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

  // ⚠️ App 加载完成后会 `classList.add('done')`（`#loading.done{opacity:0}`）+ 450ms 后
  //    `hidden = true`（节点不删）。截图循环可能正好晚于那一刻 —— 横屏就这么栽了：
  //    那次 `playable=false`，说明它**恰好在截图前一刻**加载完，截出来是游戏本体，
  //    而几何检查照样全过（量的是还在的节点）。复现率不是 100%，所以只能上硬闸。
  //    三道保险：① 废掉 `hidden` 的 setter；② 内联 `opacity:1`（内联压过类，`.done` 里没 !important）；
  //    ③ 观察者一发现 `done` 就摘掉（MO 回调在绘制前跑，不会拍到中间帧）。
  await page.evaluate(() => {
    const el = document.getElementById('loading')
    if (!el || el.__probeLocked) return
    Object.defineProperty(el, 'hidden', { get: () => false, set: () => {}, configurable: true })
    el.style.opacity = '1'
    new MutationObserver(() => {
      if (!el.classList.contains('done')) return
      el.classList.remove('done')
      if (el.style.opacity !== '1') el.style.opacity = '1'
    }).observe(el, { attributes: true, attributeFilter: ['class'] })
    el.__probeLocked = true
  })

  // ⚠️ 量几何之前必须先把过渡关掉：headless 下帧率极低（WebGL 那套更慢），
  //    `transition: transform .42s` 可能一格都没跑，量到的是**起点**值。
  //    实测没关的时候 p=1 读出来是 `matrix(…,0,30)`（就是 p=0 的位置），
  //    看着像「`--p` 没生效」，其实是取样取在了动画开始的那一帧。
  await page.addStyleTag({ content: '*,*::before,*::after{transition:none!important}' })

  // ⚠️ 还要抢过 App 对 `--p` 的写入权：游戏还在加载时 `setLoading()` 会持续把 `#loading`
  //    上的 `--p` 改回真实进度，手设的值被覆盖（实测 p=0 量到进度条 54%，看着像 CSS 坏了）。
  //    两个错误尝试：① 轮询「没人再写」——App 每 300ms 写一次，250ms 采样会误判为静止；
  //    ② 带 `!important` 写内联——App 的 `setProperty(name, value)` 不带优先级，
  //    **会把已有的 important 一起换掉**，200ms 后照样被覆盖。
  //    可靠做法：写到 `.ld-stage`（`#loading` 的子元素）。App 只写 `#loading`，
  //    而 `.ld-stage` 自己的 `--p` 优先于继承来的那份，吊笼和进度条都在它下面。
  const setP = async (p) => {
    const got = await page.evaluate((val) => {
      const el = document.getElementById('loading')
      el.classList.remove('done'); el.removeAttribute('hidden'); el.style.display = 'flex'
      const stage = el.querySelector('.ld-stage')
      stage.style.setProperty('--p', String(val))
      // 百分比文字：App 的 setLoading() 也会写 `.ld-pct`（`q('.ld-pct')` 取文档里第一个），
      // 游戏还没加载完时会把数字改回真实进度 ⇒ 截图出现「99% 配 47% 的条」。
      // 把原来那个藏起来（它仍是第一个匹配，App 继续写它，反正看不见），
      // 旁边放一个同款式的探针专用元素。
      const orig = el.querySelector('.ld-pct')
      orig.style.display = 'none'
      let mine = el.querySelector('.ld-pct-probe')
      if (!mine) {
        mine = document.createElement('b')
        mine.className = 'ld-pct ld-pct-probe'
        orig.after(mine)
      }
      mine.textContent = Math.round(val * 100) + '%'
      return getComputedStyle(stage).getPropertyValue('--p')
    }, p)
    await new Promise((r) => setTimeout(r, 200))
    if (Math.abs(Number(got) - p) > 1e-6) PROBLEMS.push(`${v.label} 设 --p=${p} 没生效（读到 ${got}）`)
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
    // 第一道闸：DOM 层面加载页还在（catch「App 把它 hidden 了」）。
    const vis = await page.evaluate(() => {
      const el = document.getElementById('loading')
      const cs = getComputedStyle(el)
      return { h: el.getBoundingClientRect().height, op: Number(cs.opacity), disp: cs.display }
    })
    if (vis.h < 100 || vis.op < 0.9 || vis.disp === 'none') {
      PROBLEMS.push(`${v.label} p=${p} 截图时加载页不可见（h=${Math.round(vis.h)} opacity=${vis.op} display=${vis.disp}）`)
    }
    const name = `${v.tag}${String(Math.round(p * 100)).padStart(2, '0')}.png`
    const buf = await page.screenshot({ path: path.join(OUT, name) })

    // 第二道闸：**必须验像素**。DOM 全绿和画面里真是加载页是两件事 ——
    // 实测横屏出过一次：rect 满屏 / opacity 1 / display flex / elementFromPoint 还落在
    // 自己的 <path> 上，量几何也全过，截出来却是游戏本体（旧合成帧）。第一道闸拦不住。
    // 判据用「蓝像素占比」：加载页整屏是暖米黄，游戏本体上半屏是蓝天（b 远大于 r）。
    // 标题的靛蓝字占比 <1%，给到 5% 阈值还有很大余量。
    const px = await page.evaluate(async (b64) => {
      const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode()
      const w = 480, h = Math.round((img.height / img.width) * w)
      const c = document.createElement('canvas'); c.width = w; c.height = h
      const ctx = c.getContext('2d', { willReadFrequently: true })
      ctx.drawImage(img, 0, 0, w, h)
      const d = ctx.getImageData(0, 0, w, h).data
      let blue = 0, n = 0; const set = new Set()
      for (let i = 0; i < d.length; i += 4) {
        const r = d[i], g = d[i + 1], b = d[i + 2]
        if (b > r + 40) blue++
        n++
        if ((n & 3) === 0) set.add((r >> 4) + ',' + (g >> 4) + ',' + (b >> 4))
      }
      return { blue: blue / n, colors: set.size }
    }, buf.toString('base64'))
    console.log(`  出图 ${name}  蓝像素 ${(px.blue * 100).toFixed(2)}%  色数 ${px.colors}`)
    if (px.blue > 0.05) PROBLEMS.push(`${v.label} p=${p} 截图里不是加载页（蓝像素 ${(px.blue * 100).toFixed(1)}%，看着像游戏本体）`)
    if (px.colors < 20) PROBLEMS.push(`${v.label} p=${p} 截图几乎空白（色数 ${px.colors}）`)
  }
  await page.close()
}

await browser.close()
server.close()
console.log(PROBLEMS.length ? '\n✗ ' + PROBLEMS.join('\n✗ ') : '\n✓ 几何检查全过')
console.log('→', OUT)
