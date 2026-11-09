#!/usr/bin/env node
/**
 * 补抓「运行时才拼出来」的素材。
 *
 * ## 为什么需要这一遍
 *
 * `scrape.mjs` 是静态扫的：只看得见 HTML / CSS 里写死的路径。
 * 这游戏的图标是**运行时拼**的 —— `Ku(u) = assets/${u}.webp`，
 * 而 `u` 来自数据表（`crop_<id>_ripe`、`icon_<id>`、`animal_<id>`…）。
 * 静态扫完 33 张，实际要 100+ 张，`smoke.mjs` 报 111 个 404。
 *
 * 更麻烦的是：这些资源都在**登录墙后面** —— `--browse` 那一遍停在登录页，
 * 一个都没请求过，所以 `_scrape-report.json` 的 `failed` 是空的。
 * 「0 个 404」只证明「请求过的都拿到了」。
 *
 * ## 做法
 *
 * 1. 起静态服务，用真 Chrome 打开（本地 `gp-bridge.js` 已经绕开登录）
 * 2. **把每个面板都点一遍** —— 商店六个页签、谷仓、邻居、动态、设置
 *    （图标是按页签懒加载的，只开首页只能拿到一部分）
 * 3. 记下所有 `assets/*` 的 404
 * 4. 回源站逐个拉（走 7897）
 * 5. 再跑一遍，直到连续两轮没有新 404
 *
 * ## 判据
 *
 * 最后一遍 **0 个 assets 404**，且每张新图 `size > 0`、`file` 头是 RIFF/WEBP。
 * 只写「下载成功」不够 —— 源站对不存在的路径会回 404 + 9 字节纯文本，
 * 不校验就会把 9 字节的 "not found" 当图片存进去，画面上是空白但不报错。
 */
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'

const GAME = path.resolve(process.argv[2] ?? 'E:/plan/test25/task-games/farmlord')
const ORIGIN = process.argv[3] ?? 'https://bh34uhqxcb.mkplay.zone/v/9/'
const PROXY = process.env.HTTPS_PROXY_LOCAL ?? 'http://127.0.0.1:7897'
const ROUNDS = Number(process.env.ROUNDS ?? 4)

const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find((p) => existsSync(p))
if (!CHROME) {
  console.error('✗ 找不到 Chrome/Edge')
  process.exit(2)
}

/* ------------------------------- 静态服务 ------------------------------- */

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.woff2': 'font/woff2',
}

function serve(root, port = 0) {
  const srv = http.createServer((req, res) => {
    let p = decodeURIComponent((req.url ?? '/').split('?')[0])
    if (/^[\\/]$/.test(p)) p = '/index.html'
    const file = path.join(root, p)
    if (!file.startsWith(root) || !existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404, { 'content-type': 'text/plain' })
      res.end('404')
      return
    }
    res.writeHead(200, { 'content-type': MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream' })
    fs.createReadStream(file).pipe(res)
  })
  return new Promise((r) => srv.listen(port, '127.0.0.1', () => r(srv)))
}

/* ------------------------------- 回源下载 ------------------------------- */

/*
 * 用 curl 而不是 fetch：Node 22 的 fetch **不读** HTTPS_PROXY，
 * 想走代理得自己接 undici 的 ProxyAgent —— 而 farmlord 里没有 node_modules。
 * curl 天生认 `-x`，且 `-w` 能直接给出 http 码与字节数。
 *
 * ⚠️ 别用 `-o /dev/null` 判断成败：Windows 上 `-w %{size_download}` 恒为 0
 * （写不进去就记 0），看着像「下载到 0 字节」。一律落到临时文件再 `stat`。
 */
function curlTo(url, dest) {
  const r = spawnSync(
    'curl',
    ['-s', '-x', PROXY, '--max-time', '40', '-o', dest, '-w', '%{http_code}', url],
    { encoding: 'utf8' },
  )
  return { code: (r.stdout ?? '').trim(), err: r.stderr ?? '' }
}

function isWebp(buf) {
  return buf.length > 16 && buf.toString('latin1', 0, 4) === 'RIFF' && buf.toString('latin1', 8, 12) === 'WEBP'
}

async function pull(name) {
  const rel = `assets/${name}`
  const dest = path.join(GAME, rel)
  if (existsSync(dest) && fs.statSync(dest).size > 0) return 'skip'

  const tmp = path.join(GAME, '_probe-assets', `${name}.part`)
  mkdirSync(path.dirname(tmp), { recursive: true })
  const url = new URL(rel, ORIGIN).toString()
  const { code } = curlTo(url, tmp)
  if (code !== '200') {
    try {
      fs.unlinkSync(tmp)
    } catch {}
    return `miss(${code})`
  }
  const buf = fs.readFileSync(tmp)
  const ext = path.extname(name).toLowerCase()
  if (ext === '.webp' && !isWebp(buf)) {
    fs.unlinkSync(tmp)
    return `bad(${buf.length}B)`
  }
  if (buf.length < 64) {
    fs.unlinkSync(tmp)
    return `tiny(${buf.length}B)`
  }
  mkdirSync(path.dirname(dest), { recursive: true })
  fs.renameSync(tmp, dest)
  return `ok(${(buf.length / 1024).toFixed(0)}K)`
}

/* ------------------------------- 主流程 ------------------------------- */

const { default: puppeteer } = await import(
  'file:///E:/plan/test25/kid-quest-farm-online/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js'
)

const srv = await serve(GAME)
const port = srv.address().port
const base = `http://127.0.0.1:${port}/`

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--window-size=420,860'],
})

const found = new Map() // name -> 第一次见到的轮次
let lastRound404 = []

for (let round = 1; round <= ROUNDS; round++) {
  const page = await browser.newPage()
  await page.setViewport({ width: 420, height: 860, deviceScaleFactor: 1 })

  const miss = new Set()
  page.on('response', (res) => {
    const u = res.url()
    if (res.status() < 400) return
    if (!u.includes('/assets/')) return
    const name = u.split('/assets/')[1].split('?')[0]
    if (name === 'favicon.ico') return
    miss.add(name)
  })

  await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 60000 })
  /* 等 `hh:ready`：那之后 `__hh` 才挂上，UI 才能点 */
  await page
    .waitForFunction('window.__hh && window.__hh.P', { timeout: 45000 })
    .catch(() => console.log(`  ! 第 ${round} 轮没等到 __hh`))
  await new Promise((r) => setTimeout(r, 1200))

  /* 把面板逐个点开 —— 图标是按页签懒加载的 */
  const click = async (sel) => {
    const el = await page.$(sel)
    if (el) {
      await el.click().catch(() => {})
      await new Promise((r) => setTimeout(r, 700))
    }
  }
  await click('#btn-shop')
  for (const tab of ['seeds', 'animals', 'supplies', 'dogs', 'decor', 'expand']) {
    await click(`[data-tab="${tab}"]`)
  }
  await click('.sheet .x')
  await click('#btn-barn')
  await click('.sheet .x')
  await click('#btn-friends')
  await click('.sheet .x')
  await click('#btn-log')
  await click('.sheet .x')
  await click('#hh-gear')
  await new Promise((r) => setTimeout(r, 600))

  lastRound404 = [...miss]
  for (const name of miss) if (!found.has(name)) found.set(name, round)

  console.log(`第 ${round} 轮：新 404 ${miss.size} 个`)
  await page.close()
  if (!miss.size) break
}

await browser.close()
srv.close()

if (!found.size) {
  console.log('\n✓ 没有缺失素材（已经齐了）')
  process.exit(0)
}

console.log(`\n共发现 ${found.size} 个缺失素材，开始回源下载……`)
const tally = { ok: 0, skip: 0, miss: 0, bad: 0 }
const missing = []
for (const name of [...found.keys()].sort()) {
  const r = await pull(name)
  if (r.startsWith('ok')) tally.ok++
  else if (r === 'skip') tally.skip++
  else {
    if (r.startsWith('miss')) tally.miss++
    else tally.bad++
    missing.push(`${name}  ${r}`)
  }
  console.log(`  ${r.padEnd(12)} ${name}`)
}

console.log(`\n汇总：下载 ${tally.ok} · 已有 ${tally.skip} · 源站没有 ${tally.miss} · 内容不对 ${tally.bad}`)
if (missing.length) {
  console.log('\n以下没拿到（源站也没有，或不是真图）：')
  for (const m of missing) console.log('  ' + m)
}
console.log('\n下一步：重跑 smoke.mjs 看 404 是否清零')
