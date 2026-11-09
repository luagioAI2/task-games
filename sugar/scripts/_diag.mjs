import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const ROOT = 'E:/plan/test25/task-games/sugar'
const PORT = 4404
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.webp': 'image/webp', '.png': 'image/png', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.woff2': 'font/woff2', '.json': 'application/json' }
const s = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname))
  const q = fs.existsSync(p) && fs.statSync(p).isDirectory() ? path.join(p, 'index.html') : p
  if (!fs.existsSync(q)) { res.writeHead(404); res.end(); return }
  const p2 = q
  res.writeHead(200, { 'content-type': MIME[path.extname(p2)] ?? 'application/octet-stream' })
  fs.createReadStream(p2).pipe(res)
})
await new Promise((r) => s.listen(PORT, '127.0.0.1', r))
const puppeteer = (await import(pathToFileURL('E:/plan/test25/kid-quest-farm-2d/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js').href)).default
const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const p = await b.newPage()
await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 })
p.on('pageerror', (e) => console.log('PAGEERROR', String(e.message).slice(0, 300)))
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)) })
await p.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'networkidle2', timeout: 60000 })
for (const t of [3000, 6000, 10000, 14000]) {
  await new Promise((r) => setTimeout(r, 3000))
  const st = await p.evaluate(() => ({ gp: window.__gpReady, dbg: typeof window.__debug, canvas: document.querySelectorAll('canvas').length }))
  console.log(t, JSON.stringify(st))
}
await b.close(); s.close()
