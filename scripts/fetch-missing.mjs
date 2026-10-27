#!/usr/bin/env node
/**
 * 补抓 `--browse` 漏掉的资源（这个项目一次性用的）
 * ------------------------------------------------------------
 * 症状：`--browse` 把**运行时才请求、那一屏又没加载到**的资源写成了 **0 字节文件**。
 * 而 `ls` / `existsSync` / 抓取日志全都说「成功」—— 只有 `find -size 0` 能抓到。
 *
 * 本作的卡图 / 敌人图是**按 id 拼路径**的（`assets/cards/<id>.webp`），
 * 一局里只会摸到牌库里抽到的那几张 ⇒ 静态扫 + 首屏 browse 都拿不全。
 *
 * 做法：把镜像里**已经是 0 字节**的文件当成「该请求的清单」，按原 URL 直接请求一遍。
 * （0 字节文件的路径本身就等于站上的相对路径，不用再去 data.js 里推 id。）
 *
 * ```bash
 * node scripts/fetch-missing.mjs _originals/2026-10-27 --proxy http://127.0.0.1:7897
 * ```
 */
import fs from 'node:fs'
import path from 'node:path'

import { pathToFileURL } from 'node:url'

const args = process.argv.slice(2)
const dir = args.find((a) => !a.startsWith('--'))
const pi = args.indexOf('--proxy')
const PROXY = pi >= 0 ? args[pi + 1] : ''
const ORIGIN = 'https://k65swyemts.mkplay.zone/v/3/'

if (!dir) {
  console.error('用法: node scripts/fetch-missing.mjs <镜像目录> [--proxy http://127.0.0.1:7897]')
  process.exit(1)
}

// ---- 和 scrape.mjs 同一套：fetch 与 ProxyAgent 必须来自同一个 undici ----
let netFetch = fetch
if (PROXY) {
  const mod = await (async () => {
    const cands = ['undici', 'E:/plan/test25/kid-quest-farm-2d/node_modules/undici/index.js']
    for (const c of cands) {
      try {
        return await import(c.startsWith('undici') ? c : pathToFileURL(c).href)
      } catch { /* 试下一个 */ }
    }
    throw new Error('找不到 undici：npm i undici，或改脚本里的备用路径')
  })()
  const agent = new mod.ProxyAgent(PROXY)
  netFetch = (u, init = {}) => mod.fetch(u, { ...init, dispatcher: agent })
  console.log(`[proxy] 走 ${PROXY}`)
}

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36'

/** 递归找 0 字节文件（favicon 这类本来就可能空，单独排掉） */
function walk(d, out = []) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name)
    if (e.isDirectory()) walk(p, out)
    else if (fs.statSync(p).size === 0) out.push(p)
  }
  return out
}

const zeros = walk(dir).filter((p) => !p.endsWith('favicon.ico'))

/**
 * 音频包：`sound.manifest.json` 的 `packs[*].url` 指向 `sound.pack`，
 * 但**静态扫和 browse 都不会请求它**（运行时才拉，且路径写在清单里）。
 * 判据不看「文件在不在」，看 `payloadBytes` + `payloadSha256` 对不对。
 */
function audioPacks() {
  const mf = path.join(dir, 'sound.manifest.json')
  if (!fs.existsSync(mf)) return []
  try {
    const m = JSON.parse(fs.readFileSync(mf, 'utf8'))
    return Object.entries(m.packs ?? {}).map(([name, p]) => ({
      name,
      url: p.url,
      bytes: p.payloadBytes,
      sha: p.payloadSha256,
    }))
  } catch (e) {
    console.warn('  ! sound.manifest.json 读不动：', e.message)
    return []
  }
}

const packs = audioPacks()
for (const p of packs) {
  const f = path.join(dir, p.url)
  const have = fs.existsSync(f) ? fs.statSync(f).size : -1
  // ★ 不能拿 `have === payloadBytes` 判：包体 = `MPSND1` + 头 + 表，**总比 payload 大**
  //   （实测 139025 vs 137919，多 1106）。按相等判会每次重下整个包。
  if (have >= p.bytes && have - p.bytes <= 8192) continue
  zeros.push(f)
  console.log(`  · 音频包 ${p.name} 要补（现有 ${have} / 应为 ${p.bytes}）`)
}

/**
 * ★ 第二类漏网：**路径由模板拼出来、镜像里连文件都没有**（不是 0 字节，是压根没请求过）。
 * 本作 `game.js` 里写着 `icon: \`assets/achievements/${key}.webp\``，只有打开成就页才加载，
 * 所以静态扫 / 首屏 browse 都摸不到。key 的权威来源是 `i18n.js` 的 `ACH_KEYS`。
 */
function templateAssets() {
  const out = []
  const i18n = path.join(projectRoot(), 'i18n.js')
  if (!fs.existsSync(i18n)) return out
  const src = fs.readFileSync(i18n, 'utf8')
  const m = src.match(/export const ACH_KEYS\s*=\s*\[([^\]]*)\]/)
  if (!m) return out
  const keys = [...m[1].matchAll(/["']([^"']+)["']/g)].map((x) => x[1])
  for (const k of keys) out.push(`assets/achievements/${k}.webp`)
  return out
}

/** 工程根：镜像目录形如 `<项目>/_originals/<日期>` */
function projectRoot() {
  const parent = path.dirname(dir)
  return path.basename(parent) === '_originals' ? path.dirname(parent) : dir
}

for (const rel of templateAssets()) {
  const f = path.join(dir, rel)
  if (fs.existsSync(f) && fs.statSync(f).size > 0) continue
  zeros.push(f)
  console.log(`  · 模板资源缺 ${rel}`)
}

/**
 * ★ 第三类漏网：**清单里列出的音频变体**（`assets[*].variants[*].url`）。
 *
 * 音乐是**流式**的（`mode: "stream"`），只在 `unlockAudio()` 之后才请求 ——
 * 静态扫看不到（清单是运行时才拉），`--browse` 也不会替用户点一下解锁音频。
 * 症状：整轮 e2e 全绿、没有任何 404，**只是没有音乐**（`preload` 失败被 catch 掉了）。
 *
 * 判据不看「文件在不在」，看清单里写着的 `bytes`（每个变体都有确切字节数）。
 */
function manifestAudio() {
  const mf = path.join(dir, 'sound.manifest.json')
  if (!fs.existsSync(mf)) return []
  let m
  try {
    m = JSON.parse(fs.readFileSync(mf, 'utf8'))
  } catch (e) {
    console.warn('  ! sound.manifest.json 读不动：', e.message)
    return []
  }
  const out = []
  for (const [id, a] of Object.entries(m.assets ?? {})) {
    for (const [codec, v] of Object.entries(a.variants ?? {})) {
      if (!v.url || v.pack) continue // 包内的由 sound.pack 负责
      const f = path.join(dir, v.url)
      const have = fs.existsSync(f) ? fs.statSync(f).size : -1
      if (have === v.bytes) continue
      out.push({ file: f, rel: v.url, bytes: v.bytes })
      console.log(`  · 音频变体缺 ${id}/${codec}（现有 ${have} / 应为 ${v.bytes}）`)
    }
  }
  return out
}

/** 期望字节数（下载完逐字节核对，别只看「下载成功」） */
const expectBytes = new Map()
for (const a of manifestAudio()) {
  zeros.push(a.file)
  expectBytes.set(a.rel, a.bytes)
}

if (!zeros.length) {
  console.log('没有 0 字节文件，不用补')
  process.exit(0)
}
console.log(`要补 ${zeros.length} 个`)

async function get(u) {
  let lastErr
  for (let i = 0; i < 4; i++) {
    try {
      return await netFetch(u, { headers: { 'user-agent': UA }, redirect: 'follow' })
    } catch (e) {
      lastErr = e
      await new Promise((r) => setTimeout(r, 600 * (i + 1)))
    }
  }
  throw lastErr
}

let ok = 0
const bad = []
for (const file of zeros) {
  const rel = path.relative(dir, file).split(path.sep).join('/')
  // 镜像里 `_ext/<host>/...` 是站外资源，按原 host 拼回去；其余按站内相对路径
  const url = rel.startsWith('_ext/')
    ? 'https://' + rel.slice('_ext/'.length)
    : ORIGIN + rel
  try {
    const r = await get(url)
    if (!r.ok) {
      bad.push(`${r.status} ${rel}`)
      continue
    }
    const buf = Buffer.from(await r.arrayBuffer())
    if (!buf.length) {
      bad.push(`0 字节 ${rel}`)
      continue
    }
    // 音频包校验：★ 不能用 payloadSha256 —— 它算的是**解密后**的 payload
    // （包体 = `MPSND1` + 14 字节头 + 4096 字节密钥流异或），而且 sound-1.js 里
    // 根本没有 `payloadSha256` 这个字段（0 次出现）⇒ 运行时也不校验。
    // 能验的只有：魔数 + 比 payload 大一点（头部/表）。
    const pack = packs.find((p) => p.url === rel)
    if (pack) {
      const magic = buf.subarray(0, 6).toString('latin1')
      const overhead = buf.length - pack.bytes
      if (magic !== 'MPSND1' || overhead < 0 || overhead > 8192) {
        bad.push(`音频包不对劲 ${rel}（magic=${magic} 多出 ${overhead} 字节）`)
        continue
      }
    }
    // 音频变体校验：清单里有确切字节数，差一个字节就是没抓对
    const want = expectBytes.get(rel)
    if (want != null && buf.length !== want) {
      bad.push(`字节数不对 ${rel}（${buf.length} ≠ ${want}）`)
      continue
    }
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, buf)
    ok++
    console.log(`  ✓ ${String(buf.length).padStart(8)}  ${rel}`)
  } catch (e) {
    bad.push(`${e.message} ${rel}`)
  }
}

console.log(`\n补上 ${ok} / ${zeros.length}`)
if (bad.length) {
  console.log('失败：')
  for (const b of bad) console.log('  ✗ ' + b)
  process.exit(1)
}
