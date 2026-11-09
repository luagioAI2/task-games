#!/usr/bin/env node
/**
 * 补抓音频：清单里声明了、但静态扫描永远看不见的那几个文件。
 *
 * `sound.manifest.json` 的 `packs.main.url = "sound.pack"` 与
 * `assets.*.variants.*.url` 是**运行时**才拼出来的路径 —— 静态扫不会去请求，
 * 所以 `_scrape-report.json` 的 `failed` 是空的、404 也是 0 个。
 * 症状是「整局没有声音，而且一切指标全绿」。
 *
 * 判据不是「下载成功」，是**哈希对得上**：清单里有 `payloadSha256` / `sha256`，
 * 对不上就说明拿到的是错误页或旧版本。
 */
import path from 'node:path'
import fs from 'node:fs'
import crypto from 'node:crypto'
import { existsSync, mkdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

const GAME = path.resolve(process.argv[2] ?? 'E:/plan/test25/task-games/farmlord')
const ORIGIN = process.argv[3] ?? 'https://bh34uhqxcb.mkplay.zone/v/9/'
const PROXY = process.env.HTTPS_PROXY_LOCAL ?? 'http://127.0.0.1:7897'

const manifest = JSON.parse(fs.readFileSync(path.join(GAME, 'sound.manifest.json'), 'utf8'))

/** rel -> 期望 sha256（有就校验） */
const want = new Map()
for (const a of Object.values(manifest.assets ?? {})) {
  for (const v of Object.values(a.variants ?? {})) {
    if (v.url) want.set(v.url, v.sha256 ?? null)
  }
}
for (const p of Object.values(manifest.packs ?? {})) {
  if (p.url) want.set(p.url, p.payloadSha256 ?? null)
}

const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex')

function fetchTo(url, dest) {
  const r = spawnSync('curl', ['-s', '-x', PROXY, '--max-time', '120', '-o', dest, '-w', '%{http_code}', url], {
    encoding: 'utf8',
  })
  return (r.stdout ?? '').trim()
}

let okCount = 0
let bad = 0
for (const [rel, expect] of want) {
  const dest = path.join(GAME, rel)
  if (existsSync(dest) && fs.statSync(dest).size > 0) {
    const got = sha(fs.readFileSync(dest))
    const fine = !expect || got === expect
    console.log(`  ${fine ? '已有' : '哈希不符'}  ${rel}  ${(fs.statSync(dest).size / 1024).toFixed(0)}K`)
    if (fine) okCount++
    else bad++
    continue
  }
  const url = new URL(rel, ORIGIN).toString()
  mkdirSync(path.dirname(dest), { recursive: true })
  const code = fetchTo(url, dest)
  if (code !== '200') {
    console.log(`  ✗ ${rel}  http=${code}`)
    bad++
    try {
      fs.unlinkSync(dest)
    } catch {}
    continue
  }
  const buf = fs.readFileSync(dest)
  const got = sha(buf)
  if (expect && got !== expect) {
    console.log(`  ✗ ${rel}  哈希不符  ${got.slice(0, 12)} != ${expect.slice(0, 12)}`)
    bad++
    continue
  }
  console.log(`  ✓ ${rel}  ${(buf.length / 1024).toFixed(0)}K${expect ? '  哈希对上' : ''}`)
  okCount++
}

console.log(`\n汇总：${okCount} 就绪 / ${bad} 有问题`)
process.exit(bad ? 1 : 0)
