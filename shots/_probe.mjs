import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'
import puppeteer from 'file:///E:/plan/test25/kid-quest-farm-2d/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js'
const ROOT = 'E:/plan/test25/task-games/ropeland'
const MIME = { '.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.webp':'image/webp','.svg':'image/svg+xml','.woff2':'font/woff2','.m4a':'audio/mp4','.pack':'application/octet-stream','.png':'image/png' }
const srv = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split('?')[0]); const f = path.join(ROOT, p === '/' ? 'index.html' : p)
  fs.readFile(f, (e, d) => { if (e) { console.log('SRV-404', req.url, 'REF=', String(req.headers.referer)); res.writeHead(404); res.end('nf'); return }
    res.writeHead(200, { 'content-type': MIME[path.extname(f)] ?? 'application/octet-stream' }); res.end(d) })
}).listen(4397, '127.0.0.1')
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true,
  args: ['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] })
const page = await browser.newPage()
page.on('pageerror', (e) => console.log('PAGEERR', e.message))
page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text()) })
await page.goto('http://127.0.0.1:4397/', { waitUntil: 'load' })
await new Promise((r) => setTimeout(r, 9000))
await browser.close(); srv.close()
