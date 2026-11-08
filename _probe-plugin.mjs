#!/usr/bin/env node
/**
 * 插件契约走查：把 `dist-plugin/farmlord.plugin.mjs` 当成宿主来挂一遍。
 *
 * ## 为什么要单独做这个「假宿主」
 *
 * 真宿主（`PluginGameHost`）要登录、要装包、要跑整个 App，一圈下来十几秒，
 * 而且**契约错在哪它只会报一句「打不开」**。这个假宿主只做契约要求的四件事，
 * 每一件单独断言：
 *
 *   ① `mount(container, host, ctx)` 能挂起来，容器里真的出现 iframe
 *   ② `ctx.assetUrl` 拼出来的资源**跨源也能加载**（两个端口，模拟 App 与 API 分离）
 *   ③ `host.storage` 的读写真的被调用（存档交接成功）
 *   ④ `unmount()` 之后 iframe 被摘掉，并且**最后那次落盘发生了**
 *
 * ## 跨源是故意的
 *
 * 真机上 App 和 API 不同源（`localhost:4401` vs `127.0.0.1:8090`）。
 * 如果这里图省事用同一个端口，就测不出「srcdoc 继承了父页面 origin」这件事 ——
 * 而那正是整个方案能成立的前提。
 */
import path from 'node:path'
import http from 'node:http'
import fs from 'node:fs'
import { existsSync, mkdirSync } from 'node:fs'

const GAME = path.resolve(process.argv[2] ?? 'E:/plan/test25/task-games/farmlord')
const PKG = path.join(GAME, 'dist-plugin')
const OUT = path.join(GAME, 'shots')
mkdirSync(OUT, { recursive: true })

const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find((p) => existsSync(p))
if (!CHROME) {
  console.error('✗ 找不到 Chrome/Edge')
  process.exit(2)
}

let pass = 0
let fail = 0
const ok = (label, cond, detail = '') => {
  if (cond) {
    pass++
    console.log(`  ✓ ${label}${detail ? ` — ${detail}` : ''}`)
  } else {
    fail++
    console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`)
  }
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.ico': 'image/x-icon',
  '.pack': 'application/octet-stream',
}

/** 包服务器：带 CORS（真后端有全局 CORS 中间件），故意跑在**另一个端口** */
function servePackage(root) {
  const srv = http.createServer((req, res) => {
    let p = decodeURIComponent((req.url ?? '/').split('?')[0])
    if (/^[\\/]$/.test(p)) p = '/index.html'
    const file = path.join(root, p)
    const cors = {
      'access-control-allow-origin': '*',
      'access-control-allow-headers': '*',
    }
    if (!file.startsWith(root) || !existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404, { ...cors, 'content-type': 'text/plain' })
      res.end('404')
      return
    }
    res.writeHead(200, {
      ...cors,
      'content-type': MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream',
    })
    fs.createReadStream(file).pipe(res)
  })
  return new Promise((r) => srv.listen(0, '127.0.0.1', () => r(srv)))
}

/** 宿主页：一个 420×820 的容器 + 一份内存版 hostApi */
const HOST_PAGE = `<!doctype html><html><head><meta charset="utf-8">
<style>html,body{margin:0;height:100%;background:#0f172a}
#box{position:relative;width:420px;height:820px;margin:0 auto;background:#111}</style>
</head><body><div id="box"></div>
<script type="module">
const PKG = window.__PKG__
const log = { saves: [], toasts: [], coins: [] }
window.__log = log
const coin = { balance: 0 }
const host = {
  balance: () => 1000,
  spendPoints: async (n, m) => { log.coins.push(['spend', n, m]); return true },
  mintGameCoin: async (n, m) => { coin.balance += n; log.coins.push(['mint', n, m]) },
  spendGameCoin: async (n, m) => { coin.balance -= n; log.coins.push(['spendCoin', n, m]); return true },
  redeemGameCoin: async (n, m) => { log.coins.push(['redeem', n, m]); return 0 },
  mintVoucher: async (n, m) => { log.coins.push(['voucher', n, m]); return 0 },
  buyGameCoin: async (n, p, m) => { log.coins.push(['buy', n, p, m]); return true },
  gameCoinBalance: async () => coin.balance,
  storage: {
    get: async (k) => { const v = window.__store.get(k); log.get = k; return v },
    set: async (k, v) => { window.__store.set(k, v); log.saves.push({ k, bytes: JSON.stringify(v).length }) },
    list: async () => Object.fromEntries(window.__store),
  },
  pushToast: (t) => log.toasts.push(t),
  haptic: () => {},
  tone: () => {},
}
window.__store = new Map()
window.__host = host

const ctx = {
  assetBase: PKG,
  assetUrl: (rel) => PKG + String(rel).replace(/^\\.\\//, ''),
  locale: 'zh',
}
const mod = await import(PKG + 'farmlord.plugin.mjs')
window.__manifest = mod.manifest
const el = document.getElementById('box')
window.__unmount = await mod.mount(el, host, ctx)
window.__mounted = true
<\/script></body></html>`

const srvPkg = await servePackage(PKG)
const pkgBase = `http://127.0.0.1:${srvPkg.address().port}/`

/* 宿主页也单独起一个端口 —— 这样 iframe 的资源是**跨源**加载的 */
const srvHost = http.createServer((req, res) => {
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
  res.end(HOST_PAGE.replace('window.__PKG__', JSON.stringify(pkgBase)))
})
await new Promise((r) => srvHost.listen(0, '127.0.0.1', r))
const hostBase = `http://127.0.0.1:${srvHost.address().port}/`

console.log(`包服务 ${pkgBase}\n宿主页 ${hostBase}\n`)

const { default: puppeteer } = await import(
  'file:///E:/plan/test25/kid-quest-farm-online/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js'
)

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--autoplay-policy=no-user-gesture-required'],
})
const page = await browser.newPage()
await page.setViewport({ width: 460, height: 860, deviceScaleFactor: 1 })

const errors = []
const bad = []
page.on('pageerror', (e) => errors.push(String(e.message).slice(0, 200)))
page.on('response', (r) => {
  if (r.status() >= 400 && !r.url().includes('favicon')) bad.push(`${r.status()} ${r.url()}`)
})

try {
  await page.goto(hostBase, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForFunction('window.__mounted === true', { timeout: 60000 })
  await wait(4000)

  console.log('【A】契约')
  const m = await page.evaluate(() => window.__manifest)
  ok('manifest.id = farmlord', m?.id === 'farmlord', JSON.stringify(m?.id))
  ok('minHostApi ≤ 4', (m?.minHostApi ?? 99) <= 4, String(m?.minHostApi))
  ok('economy.voucherPerCoin = 0（不开放兑换）', m?.economy?.voucherPerCoin === 0)

  console.log('\n【B】挂载')
  const frameInfo = await page.evaluate(() => {
    const box = document.getElementById('box')
    const f = box.querySelector('iframe')
    if (!f) return null
    const r = f.getBoundingClientRect()
    return { w: Math.round(r.width), h: Math.round(r.height), hasSrcdoc: !!f.srcdoc }
  })
  ok('容器里有 iframe', !!frameInfo)
  ok('iframe 铺满容器（420×820）', frameInfo && frameInfo.w === 420 && frameInfo.h === 820, JSON.stringify(frameInfo))

  const inner = await page.evaluate(() => {
    const f = document.querySelector('#box iframe')
    const w = f && f.contentWindow
    if (!w) return { sameOrigin: false }
    let same = true
    try {
      void w.document.title
    } catch {
      same = false
    }
    const h = w.__hh
    return {
      sameOrigin: same,
      title: (() => {
        try {
          return w.document.title
        } catch {
          return ''
        }
      })(),
      hasHh: !!h,
      plots: h?.F?.plots?.length ?? 0,
      money: h?.P?.money,
      hasGp: !!w.gp,
      hasUseStorage: typeof w.__farmlordUseStorage === 'function',
    }
  })
  ok('srcdoc 与宿主同源（contentWindow 可读）', inner.sameOrigin === true)
  ok('游戏真的起来了（__hh 存在）', inner.hasHh === true)
  ok('农场铺出 6 块地', inner.plots === 6, `plots=${inner.plots}`)
  ok('本地 gp 已注入', inner.hasGp === true)
  ok('存储交接口子存在', inner.hasUseStorage === true)

  await page.screenshot({ path: path.join(OUT, 'plugin-1-mounted.png') })

  console.log('\n【C】存档交接')
  const saves = await page.evaluate(() => window.__log.saves)
  ok('host.storage.set 被调用过', saves.length > 0, `${saves.length} 次`)
  const stored = await page.evaluate(() => {
    const v = window.__store.get('save')
    return v ? { v: v.v, plots: v.farm?.plots?.length, money: v.me?.money } : null
  })
  ok('存档里有农场状态', stored && stored.plots === 6, JSON.stringify(stored))

  /* 在游戏里做一次动作，确认它会写回宿主存储 */
  const before = await page.evaluate(() => window.__log.saves.length)
  await page.evaluate(() => {
    const w = document.querySelector('#box iframe').contentWindow
    const s = w.__farmlordGetServer()
    return s.post('/farm/local/plot/0/sow', { seed: 'wheat' })
  })
  await wait(1500)
  const after = await page.evaluate(() => window.__log.saves.length)
  ok('动作之后写回了宿主存储（增量 > 0）', after > before, `${before} → ${after}`)
  const planted = await page.evaluate(() => {
    const v = window.__store.get('save')
    return (v?.farm?.plots ?? []).filter((p) => p && p.c).length
  })
  ok('宿主存档里能看到种下的作物', planted >= 1, `planted=${planted}`)
  await page.screenshot({ path: path.join(OUT, 'plugin-2-sowed.png') })

  console.log('\n【D】卸载')
  await page.evaluate(() => window.__unmount())
  await wait(800)
  const gone = await page.evaluate(() => document.querySelectorAll('#box iframe').length)
  ok('iframe 被摘掉', gone === 0, `剩 ${gone} 个`)

  console.log('\n【E】资源与报错')
  ok('没有 4xx/5xx', bad.length === 0, bad.slice(0, 3).join(' | '))
  ok('pageerror 为 0', errors.length === 0, errors.slice(0, 2).join(' | '))
} catch (e) {
  fail++
  console.log(`\n✗ 探针中断：${e.message}`)
  try {
    await page.screenshot({ path: path.join(OUT, 'plugin-error.png') })
  } catch {}
} finally {
  await browser.close()
  srvPkg.close()
  srvHost.close()
  console.log(`\n结果：${pass} 通过 / ${fail} 失败`)
  process.exit(fail ? 1 : 0)
}
