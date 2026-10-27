#!/usr/bin/env node
/**
 * 一次性排查：把页面的**全部** 4xx/5xx 和 console 消息原样打出来（smoke.mjs 会截断 200 字）。
 *
 * ```bash
 * node scripts/_debug-load.mjs 4417 8000
 * ```
 */
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.dirname(HERE)
const PORT = Number(process.argv[2] || 4417)
const WAIT = Number(process.argv[3] || 12000)
const HOST = 'E:/plan/test25/kid-quest-farm-2d'

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.ttf': 'font/ttf',
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.pack': 'application/octet-stream',
  '.ico': 'image/x-icon',
}

const srv = http.createServer((req, res) => {
  const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname)
  const f = path.join(ROOT, rel === '/' ? 'index.html' : rel)
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) {
    res.writeHead(404).end('404 ' + rel)
    return
  }
  res.writeHead(200, { 'content-type': MIME[path.extname(f)] ?? 'application/octet-stream' })
  fs.createReadStream(f).pipe(res)
})
await new Promise((r) => srv.listen(PORT, '127.0.0.1', r))

const puppeteer = await import(
  pathToFileURL(path.join(HOST, 'node_modules', 'puppeteer-core', 'lib', 'puppeteer', 'puppeteer-core.js')).href
).then((m) => m.default)

const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find((p) => fs.existsSync(p))

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: [
    '--no-sandbox',
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--autoplay-policy=no-user-gesture-required',
  ],
})
const page = await browser.newPage()
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 })

page.on('response', (r) => {
  if (r.status() >= 400) console.log('HTTP', r.status(), r.url())
  else if (!/\.(webp|mp3|m4a|ttf|pack|ico)/.test(r.url())) console.log('OK  ', r.status(), r.url())
})
page.on('requestfailed', (r) => console.log('FAILED', r.url(), r.failure()?.errorText))
page.on('console', (m) => console.log('CONSOLE', m.type(), '::', m.text().slice(0, 600)))
page.on('pageerror', (e) => console.log('PAGEERROR ::', e.message, '\n', (e.stack || '').slice(0, 900)))

await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'load' })
await new Promise((r) => setTimeout(r, WAIT))
console.log(
  'canvas',
  await page.$$eval('canvas', (n) => n.length),
  '#app 子节点',
  await page.$$eval('#app > *', (n) => n.length),
)
console.log(await page.evaluate(() => ({
  readyState: document.readyState,
  title: document.title,
  htmlLen: document.documentElement.outerHTML.length,
  scripts: [...document.querySelectorAll('script')].map((s) => s.src || s.type),
  gpReady: window.__gpReady ?? null,
  dbg: !!window.__dbg,
  bodyText: document.body.innerText.slice(0, 120),
})))
await page.screenshot({ path: path.join(ROOT, 'shots', '_debug.png') })

await browser.close()
srv.close()
