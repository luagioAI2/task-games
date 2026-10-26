import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'
import puppeteer from 'file:///E:/plan/test25/kid-quest-farm-2d/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js'
const ROOT = 'E:/plan/test25/task-games/ropeland'
const MIME = { '.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.webp':'image/webp','.svg':'image/svg+xml','.woff2':'font/woff2','.m4a':'audio/mp4','.pack':'application/octet-stream','.png':'image/png' }
const srv = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split('?')[0]); const f = path.join(ROOT, p === '/' ? 'index.html' : p)
  fs.readFile(f, (e, d) => { if (e) { console.log('SRV-404', req.url); res.writeHead(404); res.end('nf'); return }
    res.writeHead(200, { 'content-type': MIME[path.extname(f)] ?? 'application/octet-stream' }); res.end(d) })
}).listen(4396, '127.0.0.1')
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true,
  args: ['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required'] })
const page = await browser.newPage()
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 })
page.on('pageerror', (e) => console.log('PAGEERR', e.message.split('\n')[0]))
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log(m.type().toUpperCase(), m.text().slice(0,160)) })
await page.goto('http://127.0.0.1:4396/', { waitUntil: 'networkidle2' })
await new Promise((r) => setTimeout(r, 9000))
console.log('screen', await page.evaluate(() => window.__game?.screen))
console.log('btn count', await page.$$eval('[data-act=start]', (e) => e.length))
const r = await page.evaluate(() => { const b = document.querySelector('[data-act=start]'); if (!b) return null; const q = b.getBoundingClientRect(); return { x: q.x, y: q.y, w: q.width, h: q.height, cx: q.x + q.width/2, cy: q.y + q.height/2 } })
console.log('btn rect', r)
await page.mouse.click(r.cx, r.cy)
await new Promise((r) => setTimeout(r, 2500))
console.log('screen after click', await page.evaluate(() => window.__game?.screen), 'coach', await page.evaluate(() => JSON.stringify(window.__game?.coach)))
await page.screenshot({ path: ROOT + '/shots/smoke-5.png' })
await browser.close(); srv.close()
