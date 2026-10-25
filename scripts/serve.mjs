#!/usr/bin/env node
/**
 * 本地静态服务器（开发用）。
 *
 * ## 为什么不用 `python -m http.server`
 *
 * 实测：这台机器上 Python 把 `.js` 按 **`text/plain`** 返回（Windows 注册表里
 * `.js` 的 Content-Type 被别的软件改过），而浏览器对 `<script type="module">`
 * 做严格 MIME 校验 ⇒ 直接拒绝执行，症状是「一片空白 + 说 MIME 不对」，
 * 看着像代码坏了。`node` 自带正确映射，省掉一类假故障。
 *
 * 用法: node scripts/serve.mjs [port] [root]
 */
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { join, extname, normalize, sep } from 'node:path'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = process.argv[3] || join(dirname(fileURLToPath(import.meta.url)), '..')
const PORT = Number(process.argv[2] || 4397)

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.pack': 'application/octet-stream',
  '.ico': 'image/x-icon',
  '.map': 'application/json; charset=utf-8',
}

const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent((req.url || '/').split('?')[0])
    if (p.endsWith('/')) p += 'index.html'
    // 目录穿越防护：解析后必须仍在 ROOT 里
    const abs = normalize(join(ROOT, p))
    if (!abs.startsWith(normalize(ROOT) + sep) && abs !== normalize(ROOT)) {
      res.writeHead(403).end('forbidden')
      return
    }
    let target = abs
    const st = await stat(target).catch(() => null)
    if (!st) { res.writeHead(404, { 'content-type': 'text/plain' }).end('404 ' + p); return }
    if (st.isDirectory()) target = join(target, 'index.html')
    const buf = await readFile(target)
    res.writeHead(200, {
      'content-type': MIME[extname(target).toLowerCase()] || 'application/octet-stream',
      'cache-control': 'no-store',
      // 共享内存（WebGL / wasm）需要这两个头才不降级
      'cross-origin-opener-policy': 'same-origin',
      'cross-origin-embedder-policy': 'require-corp',
      'cross-origin-resource-policy': 'cross-origin',
    })
    res.end(buf)
  } catch (e) {
    res.writeHead(500, { 'content-type': 'text/plain' }).end('500 ' + e.message)
  }
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`serving ${ROOT}`)
  console.log(`http://127.0.0.1:${PORT}/`)
})
