#!/usr/bin/env node
/**
 * 假宿主挂载测试 —— 不打真 App，用一只最小宿主去 `mount()` 产物。
 *
 * 三层验的是不同的东西，缺一层就有一类错看不见：
 *
 * | 层 | 能抓到 | 抓不到 |
 * | --- | --- | --- |
 * | `node --check` / 构建校验 | 语法、裸说明符、缺导出 | 运行时 |
 * | **本文件（真 Chrome）** | 404、pageerror、没渲染、卸载没清干净 | 真宿主的外壳布局 |
 * | `e2e-plugin-local.mjs`（真 App） | 挂进真壳子后的遮挡 / 重挂载 / 存档 | —— |
 *
 * ## 判据（四条都要）
 *
 * 1. **整轮挂载 0 个 404**（`assets/` 是相对路径 ⇒ 少一层前缀就全 404，而报错长得像
 *    「JSON 解析失败」）。`favicon.ico` 除外。
 * 2. **0 个 pageerror**（console.error 单独列：Pixi 会打无害警告）。
 * 3. **画面不是空白**：截图整幅的**颜色种类数 ≥ 20**；整屏 WebGL 只用 `innerText`
 *    判会把渲染完好判成失败。
 * 4. **卸载之后数一次 canvas**：容器里应当回到 0，且 `window.__game` 要没。
 *    只验「挂上了」不验「卸干净了」，切 tab 几次之后就是一片黑。
 *
 * ## 为什么每个模式都要给独立的 slot
 *
 * ★★ StrictMode 双挂载会让两次 `mount()` 共用一个容器：先回来的 unmount 那句
 *    `replaceChildren()` 会把后来那份清掉，症状是「ready 是 true 但 DOM 不在容器里」。
 *    所以这里每次挂载先建一个自己的 slot div，清理只 `slot.remove()`。
 *
 * 用法：node scripts/plugin-test.cjs [--port 4395]
 */
const http = require('node:http')
const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '..')
const PORT = Number(process.argv[process.argv.indexOf('--port') + 1]) || 4395
const OUT = path.join(ROOT, 'shots')

const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.cjs': 'text/javascript',
  '.json': 'application/json',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.m4a': 'audio/mp4',
  '.pack': 'application/octet-stream',
}

// dist-plugin/assets 挂在 /assets/ 下，包挂在 /ropeland.plugin.mjs
const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0])
  const file = url === '/' ? null : path.join(ROOT, 'dist-plugin', url)
  if (!file) {
    res.writeHead(200, { 'content-type': 'text/html' })
    res.end(HARNESS)
    return
  }
  fs.readFile(file, (e, d) => {
    if (e) {
      res.writeHead(404)
      res.end('not found')
      return
    }
    res.writeHead(200, { 'content-type': MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream' })
    res.end(d)
  })
})

const HARNESS = `<!doctype html><meta charset="utf-8">
<style>html,body{margin:0;height:100%;background:#111}
#host{position:fixed;inset:0;overflow:hidden}
#host > .host-screen{position:absolute;inset:0}
</style>
<div id="ctlHost"><button class="btn panel" id="ctlBtn" style="padding:4px">宿主自己的按钮</button></div>
<div id="host"><div class="host-screen absolute inset-0"></div></div>
<script type="module">
  const MONEY = { points: 500, coin: 0 }
  const toasts = []
  const store = new Map()
  window.__test = { MONEY, toasts, store, mounts: 0, unmounts: 0, unmount: null }
  const host = {
    balance: () => MONEY.points,
    spendPoints: async (n) => { if (MONEY.points < n) return false; MONEY.points -= n; return true },
    mintGameCoin: async (n) => { MONEY.coin += n },
    gameCoinBalance: () => MONEY.coin,
    pushToast: (t) => toasts.push(t),
    haptic() {},
    tone() {},
    storage: {
      get: async (k) => store.get(k),
      set: async (k, v) => { store.set(k, v) },
      list: async () => Object.fromEntries(store),
    },
  }
  const mod = await import('/ropeland.plugin.mjs')
  const m = mod.default ?? mod
  window.__test.manifest = m.manifest
  // 每次挂载一个自己的 slot —— 清理只摘自己的那个
  window.__test.mountGame = async () => {
    const slot = document.createElement('div')
    slot.className = 'slot'
    slot.style.cssText = 'position:absolute;inset:0'
    document.getElementById('host').appendChild(slot)
    window.__test.mounts++
    const un = await m.mount(slot, host, { assetUrl: (rel) => '/assets/' + String(rel).replace(/^assets\\//, ''), assetBase: '/assets/', locale: 'zh' })
    window.__test.unmount = async () => { window.__test.unmounts++; await un(); slot.remove() }
    return true
  }
  window.__test.ready = true
</script>`

;(async () => {
  const puppeteerUrl = 'file:///E:/plan/test25/kid-quest-farm-2d/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js'
  const puppeteer = (await import(puppeteerUrl)).default
  const CHROME = [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  ].find((p) => fs.existsSync(p))
  if (!CHROME) throw new Error('找不到 Chrome / Edge')

  await new Promise((r) => server.listen(PORT, '127.0.0.1', r))
  console.log(`\n服务 ${path.join(ROOT, 'dist-plugin')}\n→ http://127.0.0.1:${PORT}/\n`)

  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: [
      '--no-sandbox',
      // ★ `--use-gl=swiftshader` 已被移除，只写它 = PixiJS 停在加载页且 0 报错
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
      '--autoplay-policy=no-user-gesture-required',
    ],
  })
  const page = await browser.newPage()
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 })

  const bad = []
  const pageErrors = []
  const consoleErrors = []
  page.on('response', (r) => {
    if (r.status() >= 400) bad.push(`${r.status()} ${r.url().replace(`http://127.0.0.1:${PORT}`, '')}`)
  })
  page.on('pageerror', (e) => pageErrors.push(String(e.message).slice(0, 300)))
  page.on('console', (m) => {
    if (m.type() === 'error') {
      // 带上触发它的 URL：只记一句 "Failed to load resource: 404" 等于什么都没记
      const src = m.location()?.url ?? ''
      consoleErrors.push(`${m.text().slice(0, 120)} @ ${src.replace(`http://127.0.0.1:${PORT}`, '')}`)
    }
  })

  const shot = async (name) => {
    fs.mkdirSync(OUT, { recursive: true })
    const p = path.join(OUT, name)
    await page.screenshot({ path: p })
    return p
  }

  /**
   * 只截插件容器 —— 整页截图里宿主自己的颜色会让「是不是空白」恒真。
   *
   * ★★ 必须走**合成器截图**，不能在页面里 `drawImage` / `readPixels` 读 canvas。
   *    Pixi 用默认的 `preserveDrawingBuffer: false`：它自己那个 rAF 帧画完、
   *    合成器取走之后缓冲就被丢弃，之后主线程任何时刻读都是全黑 ——
   *    `drawImage`、`toDataURL`、`readPixels` 三路全是 0，且 `getError()` 还是 0，
   *    于是一个渲染完好的游戏被判成「空白」。`Page.captureScreenshot` 走合成器，
   *    看到的是真画面。所以这里截图 → 解 PNG → 数量化颜色。
   *
   * 反向验证（确认这个判据真的会红）：把下面 `clip` 换成一个已知全白的盒子，
   * 颜色种类应当只有 1 种。
   */
  const colorsInSlot = async () => {
    const box = await page.evaluate(() => {
      const el = document.querySelector('.slot')
      if (!el) return null
      const r = el.getBoundingClientRect()
      return { x: r.x, y: r.y, width: r.width, height: r.height }
    })
    if (!box || box.width < 2 || box.height < 2) return { colors: 0, err: 'no slot' }
    // 缩小采样：整幅 780×1688 逐像素解太慢，60×130 足够数出「有多少种颜色」
    const b64 = await page.screenshot({
      encoding: 'base64',
      clip: { x: box.x, y: box.y, width: box.width, height: box.height },
      captureBeyondViewport: false,
    })
    return decodePngColors(Buffer.from(b64, 'base64'), 60, 130)
  }

  /**
   * 最小 PNG 解码器 + 颜色直方图。只为了「有没有画面」，不追求还原精度。
   * 支持 8bit RGB / RGBA、非隔行（Chrome 截图就是这个形态）。
   */
  const decodePngColors = (buf, w, h) => {
    const zlib = require('node:zlib')
    if (buf.readUInt32BE(0) !== 0x89504e47) return { colors: 0, err: 'not png' }
    let off = 8
    let W = 0
    let H = 0
    let bitDepth = 0
    let colorType = 0
    const idat = []
    while (off + 8 <= buf.length) {
      const len = buf.readUInt32BE(off)
      const type = buf.toString('ascii', off + 4, off + 8)
      const data = buf.subarray(off + 8, off + 8 + len)
      if (type === 'IHDR') {
        W = data.readUInt32BE(0)
        H = data.readUInt32BE(4)
        bitDepth = data[8]
        colorType = data[9]
        if (data[12] !== 0) return { colors: 0, err: 'interlaced png' }
      } else if (type === 'IDAT') idat.push(data)
      else if (type === 'IEND') break
      off += 12 + len
    }
    if (bitDepth !== 8 || (colorType !== 2 && colorType !== 6)) {
      return { colors: 0, err: `png ${bitDepth}bit type${colorType}` }
    }
    const ch = colorType === 6 ? 4 : 3
    let raw
    try {
      raw = zlib.inflateSync(Buffer.concat(idat))
    } catch (e) {
      return { colors: 0, err: String(e.message) }
    }
    const stride = W * ch
    if (raw.length < (stride + 1) * H) return { colors: 0, err: 'short png' }

    // 反滤波：每行首字节是 filter 类型
    const px = Buffer.alloc(stride * H)
    for (let y = 0; y < H; y++) {
      const ft = raw[y * (stride + 1)]
      const src = raw.subarray(y * (stride + 1) + 1, y * (stride + 1) + 1 + stride)
      const row = px.subarray(y * stride, y * stride + stride)
      const prev = y > 0 ? px.subarray((y - 1) * stride, y * stride) : null
      for (let i = 0; i < stride; i++) {
        const a = i >= ch ? row[i - ch] : 0
        const b = prev ? prev[i] : 0
        const c = prev && i >= ch ? prev[i - ch] : 0
        let v = src[i]
        if (ft === 1) v += a
        else if (ft === 2) v += b
        else if (ft === 3) v += (a + b) >> 1
        else if (ft === 4) {
          const p = a + b - c
          const pa = Math.abs(p - a)
          const pb = Math.abs(p - b)
          const pc = Math.abs(p - c)
          v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c
        }
        row[i] = v & 0xff
      }
    }

    const seen = new Set()
    for (let y = 0; y < h; y++) {
      const sy = Math.min(H - 1, Math.floor((y * H) / h))
      for (let x = 0; x < w; x++) {
        const sx = Math.min(W - 1, Math.floor((x * W) / w))
        const i = sy * stride + sx * ch
        seen.add(((px[i] >> 3) << 10) | ((px[i + 1] >> 3) << 5) | (px[i + 2] >> 3))
      }
    }
    return { colors: seen.size }
  }

  await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'networkidle2', timeout: 60000 })
  await page.waitForFunction(() => window.__test?.ready === true, { timeout: 20000 })

  const mf = await page.evaluate(() => window.__test.manifest)
  console.log(`  清单 ${mf.id} · ${mf.name} · ${mf.emoji} · tab=${mf.tabLabel} · v${mf.version} · minHostApi=${mf.minHostApi}`)
  console.log(`  经济 playCost=${mf.economy.playCost} payout=${mf.economy.expectedPayout} cap=${mf.economy.capPerPrize} rate=${mf.economy.voucherPerCoin}`)

  // ---- 对照元素：宿主自己的 .btn / .panel 在插件挂载前后必须一模一样 ----
  //
  // ★ 这条判的是「样式作用域化」，而且是**唯一**的机器判据：只 grep 源码找
  //   document.head.appendChild 只能证明「注入了」，证明不了「注入的规则不会
  //   改写宿主」。挂载前量一次、挂载后量一次，任何一条没作用域化的
  //   `.btn{border-radius:14px}` 都会让两次数值不同。
  const ctlStyle = () =>
    page.evaluate(() => {
      const el = document.getElementById('ctlBtn')
      if (!el) return null
      const c = getComputedStyle(el)
      return [c.borderRadius, c.backgroundColor, c.fontSize, c.minHeight, c.boxShadow].join('|')
    })
  const ctlBefore = await ctlStyle()

  // ---- 第一次挂载 ----
  await page.evaluate(() => window.__test.mountGame())
  await page.waitForFunction(() => window.__game?.screen === 'title', { timeout: 30000 })
  await new Promise((r) => setTimeout(r, 1200))
  const ctlAfter = await ctlStyle()
  console.log(`  宿主的 .btn/.panel 没被插件改写`, ctlBefore === ctlAfter ? '✓' : `✗ ${ctlBefore} → ${ctlAfter}`)
  const titleColors = await colorsInSlot()
  console.log('  标题页颜色种类', titleColors.colors, `(canvas ${await page.evaluate(() => document.querySelectorAll('.slot canvas').length)})`)
  await shot('plugin-1-title.png')

  // ---- 先把教学跑完（教学局**故意不收费**，所以不能拿第一局验扣票） ----
  //
  // ★ 这条坑值得记住：`[data-act=start]` 第一下进的是**教学局**，而教学局按设计
  //   不收费 —— 断言「点了开始没扣票」会把一个正确的设计判成 bug。
  //   判据要按「这一局是不是教学」分流，不能一律要求扣票。
  const tutDone = await page.evaluate(() => window.__game.P.tutorialDone)
  if (!tutDone) {
    console.log('  首局 = 教学局（教学不收费，符合设计）；先把它跑完再验正式局')
    await page.evaluate(() => document.querySelector('[data-act=start]').click())
    await page.waitForFunction(() => window.__game?.screen === 'play', { timeout: 10000 })
    const tutSim = await page.evaluate(() => window.__game.sim(120, { recruit: () => true }))
    console.log('  教学模拟 →', JSON.stringify(tutSim))
    const tutAfter = await page.evaluate(() => ({ screen: window.__game.screen, overlay: window.__game.overlay, pts: window.__test.MONEY.points }))
    console.log('  教学跑完 →', JSON.stringify(tutAfter), tutAfter.pts === 500 ? '✓ 没扣票' : '✗ 教学不该收费')
    // 点掉 tut-done 弹层上的「去牧场」会**真的开一局新的**（要扣票），
    // 这里不要点它：直接把教学标记写掉，再从结算页回标题页
    await page.evaluate(() => { window.__game.P.tutorialDone = true; window.__game.endRun() })
    await page.waitForFunction(() => window.__game?.screen === 'results', { timeout: 10000 })
  }

  // ---- 回标题页，正式验一次扣票 ----
  await page.evaluate(() => document.querySelector('[data-act=menu]')?.click())
  await page.waitForFunction(() => window.__game?.screen === 'title', { timeout: 10000 })

  const before = await page.evaluate(() => window.__test.MONEY.points)
  await page.evaluate(() => document.querySelector('[data-act=start]').click())
  await page.waitForFunction(() => window.__game?.screen === 'play', { timeout: 10000 })
  // chargePlay 是异步的：等余额真的动了再读，别在 promise 落地前抢
  await page
    .waitForFunction((want) => window.__test.MONEY.points === want, { timeout: 5000 }, before - mf.economy.playCost)
    .catch(() => {})
  const after = await page.evaluate(() => window.__test.MONEY.points)
  console.log(`  正式局扣票 ${before} → ${after}`, after === before - mf.economy.playCost ? '✓' : '✗')
  // 一局只扣一次（递归 chargePlay 会扣两遍）
  await new Promise((r) => setTimeout(r, 400))
  const after2 = await page.evaluate(() => window.__test.MONEY.points)
  console.log(`  只扣一次 ${after2}`, after2 === after ? '✓' : '✗（重复扣费）')
  await new Promise((r) => setTimeout(r, 1500))
  const playColors = await colorsInSlot()
  console.log('  局内颜色种类', playColors.colors)
  await shot('plugin-2-play.png')

  // ---- 结算：拉一局到结束，检查羊毛进账 ----
  const coinBefore = await page.evaluate(() => window.__test.MONEY.coin)
  const sim = await page.evaluate(() => window.__game.sim(90, { recruit: () => true }))
  console.log('  模拟 90 秒 →', JSON.stringify(sim))
  await page.evaluate(() => window.__game.endRun())
  await new Promise((r) => setTimeout(r, 1400))
  const coinAfter = await page.evaluate(() => window.__test.MONEY.coin)
  const earned = await page.evaluate(() => window.__game.P.wool)
  console.log(`  羊毛 mintGameCoin ${coinBefore} → ${coinAfter}`, coinAfter > coinBefore ? '✓' : '✗', `· 存档羊毛 ${earned}`)
  await shot('plugin-3-results.png')

  // ---- 存档：改一个字段，卸载后重挂就读回来 ----
  //
  // ★ 挑字段有讲究：要挑一个「点一下就能改、重挂载后能读回」的键。
  //   `P.latency` 不行 —— 它只在**延迟校准**那局结束时才写，手工赋值不会落盘；
  //   拿它验「存档有没有落盘」会得到一个假红。用 `P.wool`（羊毛，界面上一眼能看见，
  //   且每次结算都会写）。
  const woolBefore = await page.evaluate(() => {
    window.__game.P.wool = 4242
    return window.__game.P.wool
  })
  await page.evaluate(() => window.__game && window.__test.unmount())
  await new Promise((r) => setTimeout(r, 800))
  const canvasAfterUnmount = await page.evaluate(() => document.querySelectorAll('.slot canvas').length)
  const hookAfterUnmount = await page.evaluate(() => typeof window.__game)
  console.log(`  卸载后 canvas ${canvasAfterUnmount} · __game ${hookAfterUnmount}`, canvasAfterUnmount === 0 && hookAfterUnmount === 'undefined' ? '✓' : '✗')

  await page.evaluate(() => window.__test.mountGame())
  await page.waitForFunction(() => window.__game?.screen === 'title', { timeout: 30000 })
  const woolBack = await page.evaluate(() => window.__game.P.wool)
  console.log(`  重挂载读回羊毛 ${woolBefore} → ${woolBack}`, woolBack === woolBefore ? '✓' : '✗（存档没落盘）')

  // ---- 余额不够时不能开局 ----
  await page.evaluate(() => { window.__test.MONEY.points = 3 })
  const refused = await page.evaluate(async () => {
    document.querySelector('[data-act=start]').click()
    await new Promise((r) => setTimeout(r, 700))
    return { screen: window.__game.screen, toasts: window.__test.toasts.length }
  })
  console.log(`  余额 3 时开局 → screen=${refused.screen} toasts=${refused.toasts}`, refused.screen === 'title' ? '✓' : '✗')

  await shot('plugin-4-remount.png')
  await browser.close()
  server.close()

  const realBad = bad.filter((b) => !/favicon\.ico/.test(b))
  // favicon 的 404 会在 console 里也留一条；它跟插件无关，滤掉免得把真错淹掉
  const realConsole = consoleErrors.filter((c) => !/favicon\.ico/.test(c))
  console.log(`\n  4xx/5xx ${realBad.length}${realBad.length ? '：' + realBad.slice(0, 8).join(' | ') : ''}`)
  console.log(`  pageerror ${pageErrors.length}${pageErrors.length ? '：' + pageErrors.slice(0, 3).join(' | ') : ''}`)
  console.log(`  console.error ${realConsole.length}${realConsole.length ? '：' + realConsole.slice(0, 3).join(' | ') : ''}`)

  const ok =
    realBad.length === 0 &&
    pageErrors.length === 0 &&
    titleColors.colors >= 20 &&
    playColors.colors >= 20 &&
    ctlBefore !== null &&
    ctlBefore === ctlAfter &&
    after === before - mf.economy.playCost &&
    after2 === after &&
    coinAfter > coinBefore &&
    canvasAfterUnmount === 0 &&
    hookAfterUnmount === 'undefined' &&
    woolBack === woolBefore &&
    refused.screen === 'title'
  console.log(ok ? '\n✓ 通过\n' : '\n✗ 没通过（看上面哪一条是 ✗）\n')
  process.exit(ok ? 0 : 1)
})()
