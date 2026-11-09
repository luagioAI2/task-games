#!/usr/bin/env node
/**
 * 生成 `assets/manifest.json` —— 发布方据此逐个校验资源没被换过。
 *
 * 宿主 `scripts/check-plugin.mjs` 会读它，把每条的 `sha256` 和磁盘上的文件
 * **逐字节对一遍**。没有这份清单，那条检查只会给一句「发布方就没法逐个校验资源」。
 *
 * ⚠️ **改了资源就要重跑**。清单过期不会在运行时报错 —— 它只会在宿主校验时
 *    报「哈希对不上」，而人第一反应会去查打包 / 网络。
 *
 * 用法：node scripts/make-asset-manifest.mjs [--check]
 *   --check 只比对，不写文件（判据：清单里的 sha256 与磁盘一致）
 */
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.dirname(HERE)
const ASSETS = path.join(ROOT, 'assets')
const OUT = path.join(ASSETS, 'manifest.json')

const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex')

/** PNG 宽高在 IHDR：8 字节签名 + 4 长度 + 4 类型 + 4 宽 + 4 高 */
function pngSize(buf) {
  if (buf.length < 24 || buf.readUInt32BE(0) !== 0x89504e47) return null
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) }
}

function walk(dir, base = '') {
  const out = []
  for (const d of fs.readdirSync(dir, { withFileTypes: true })) {
    if (d.name === 'manifest.json') continue
    const rel = base ? `${base}/${d.name}` : d.name
    const abs = path.join(dir, d.name)
    if (d.isDirectory()) out.push(...walk(abs, rel))
    else out.push(rel)
  }
  return out
}

if (!fs.existsSync(ASSETS)) {
  console.error('没有 assets/ 目录')
  process.exit(2)
}

const files = walk(ASSETS).sort()
const assets = []
let bytes = 0
for (const rel of files) {
  const buf = fs.readFileSync(path.join(ASSETS, rel))
  bytes += buf.length
  const entry = { file: rel, bytes: buf.length, sha256: sha256(buf) }
  const size = pngSize(buf)
  if (size) Object.assign(entry, size)
  assets.push(entry)
}

const manifest = {
  generated: 'scripts/make-asset-manifest.mjs',
  note: '改过资源就要重跑本脚本，否则宿主校验会报「哈希对不上」',
  total: { files: assets.length, bytes },
  assets,
}

if (process.argv.includes('--check')) {
  if (!fs.existsSync(OUT)) {
    console.error('还没生成 assets/manifest.json')
    process.exit(1)
  }
  const old = JSON.parse(fs.readFileSync(OUT, 'utf8'))
  const oldMap = new Map((old.assets ?? []).map((a) => [a.file, a.sha256]))
  const changed = assets.filter((a) => oldMap.get(a.file) !== a.sha256).map((a) => a.file)
  const gone = [...oldMap.keys()].filter((f) => !assets.some((a) => a.file === f))
  if (changed.length || gone.length) {
    console.error(`清单过期：${changed.length} 个哈希变了、${gone.length} 个文件没了`)
    for (const f of [...changed, ...gone].slice(0, 8)) console.error('  -', f)
    process.exit(1)
  }
  console.log(`清单是最新的（${assets.length} 个文件，${(bytes / 1024).toFixed(0)} KB）`)
  process.exit(0)
}

fs.writeFileSync(OUT, JSON.stringify(manifest, null, 1) + '\n')
console.log(`assets/manifest.json: ${assets.length} 个文件，${(bytes / 1024).toFixed(0)} KB`)
