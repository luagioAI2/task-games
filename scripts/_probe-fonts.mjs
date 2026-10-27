#!/usr/bin/env node
/**
 * 字体探针：确认 `MpFontDisplay` / 标题字体到底加载了没。
 *
 * 为什么单独查：字体拿不到**不报错**，只是静默退到系统字体 ——
 * 字能看清，但整个观感全变了，截图走查时很容易当成「就这样」。
 *
 *   node scripts/_probe-fonts.mjs            # 独立网页（起 4399）
 */
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const ROOT = path.resolve('E:/plan/test25/task-games/corgi')
const PORT = 4419
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.m4a': 'audio/mp4', '.pack': 'application/octet-stream' }

const server = http.createServer((req, res) => {
  const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html'
  // ★ 两边都要 resolve：`path.join` 在 Windows 下产出反斜杠，而 ROOT 是正斜杠，
  //   直接 `startsWith` 恒为 false ⇒ 连 index.html 都 404，探针在测空气。
  const f = path.resolve(ROOT, rel)
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end('nope'); return }
  res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' })
  fs.createReadStream(f).pipe(res)
})
await new Promise((r) => server.listen(PORT, '127.0.0.1', r))

const { default: puppeteer } = await import(
  pathToFileURL('E:/plan/test25/kid-quest-farm-2d/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js').href
)
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => fs.existsSync(p))
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] })
const page = await browser.newPage()
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true })

const fontReqs = []
const badReqs = []
page.on('response', (r) => {
  if (r.status() >= 400) badReqs.push(`${r.status()} ${r.url()}`)
  if (/\.(woff2?|ttf|otf)(\?|$)/i.test(r.url())) fontReqs.push({ url: r.url().split('/').slice(-2).join('/'), status: r.status() })
})
page.on('console', (m) => { if (m.type() === 'error') console.log('  [console.error]', m.text()) })
page.on('pageerror', (e) => console.log('  [pageerror]', e.message))

await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'domcontentloaded' })
await new Promise((r) => setTimeout(r, 9000))

const info = await page.evaluate(() => {
  const faces = []
  try { document.fonts.forEach((f) => faces.push({ family: f.family, status: f.status })) } catch (e) { /* */ }
  return {
    faces,
    hasMp: document.fonts ? document.fonts.check('24px MpFontDisplay') : null,
    hasRound: document.fonts ? document.fonts.check('24px TtlRound') : null,
    hasPop: document.fonts ? document.fonts.check('24px TtlPop') : null,
    status: document.fonts ? document.fonts.status : null,
    gpKeys: window.gp ? Object.keys(window.gp) : null,
    fontKeys: window.gp?.fonts ? Object.keys(window.gp.fonts) : null,
    gpFonts: typeof window.gp?.fonts?.use,
    playable: !!window.__gpPlayable,
    ready: !!window.__gpReady,
    mode: window.__corgiMode ?? null,
  }
})
console.log('\n404/错误请求：')
for (const b of badReqs) console.log('  ' + b)
console.log('\n字体请求：')
for (const r of fontReqs) console.log(`  ${r.status}  ${r.url}`)
console.log('\ndocument.fonts：')
for (const f of info.faces) console.log(`  ${f.status.padEnd(8)} ${f.family}`)
console.log(`\nstatus=${info.status}  check(MpFontDisplay)=${info.hasMp}  TtlRound=${info.hasRound}  TtlPop=${info.hasPop}`)
console.log(`gp=${JSON.stringify(info.gpKeys)}  gp.fonts=${JSON.stringify(info.fontKeys)}`)
console.log(`gp.fonts.use=${info.gpFonts}  __gpReady=${info.ready}  __gpPlayable=${info.playable}`)

await browser.close()
server.close()
