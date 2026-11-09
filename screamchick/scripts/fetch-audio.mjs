#!/usr/bin/env node
/**
 * 补抓音频（这个项目一次性用的，也可以当通用工具抄走）
 * ------------------------------------------------------------
 * ## 为什么静态扫 + `--browse` 都拿不到
 *
 * `loadSoundSystem({ manifestUrl: './sound.manifest.json' })` 是**运行时**才发的请求：
 *   · `sound.manifest.json` 本身：`--browse` 能拿到（首屏就请求了）
 *   · `sound.pack`（容器包）：要等 sound 系统初始化完才请求，`--wait` 短一点就错过
 *   · `assets/audio/bgm.m4a`（`music.main` 的 stream 变体）：**进对局才加载**
 *     ⇒ 首屏停 12 秒根本不会请求它
 *
 * 症状是**整局没有音乐、而且 0 个 404**（没人请求，当然不 404）。
 * 所以判据不能是「请求过的都拿到了」，得**照着清单把该有的补齐**。
 *
 * ## 判据（两条）
 *
 * 1. 每个 `variants[*].url` 的字节数 == 清单里的 `bytes`（逐字节核）
 * 2. `packs[*].url` 的字节数 **≥** `payloadBytes`，且差值 ≤ 8192
 *    （容器包有头部 + 对齐，实测 95584 payload → 91329 文件…也可能反过来，
 *     所以两个方向都要容差，见下面的 check）
 *
 * ```bash
 * node scripts/fetch-audio.mjs _originals/2026-10-27 --proxy http://127.0.0.1:7897
 * ```
 */
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const args = process.argv.slice(2)
const dir = args.find((a) => !a.startsWith('--'))
const pi = args.indexOf('--proxy')
const PROXY = pi >= 0 ? args[pi + 1] : ''
const ORIGIN = 'https://xruzbtmnsf.mkplay.zone/v/7/'

if (!dir) {
  console.error('用法: node scripts/fetch-audio.mjs <镜像目录> [--proxy http://127.0.0.1:7897]')
  process.exit(1)
}

// ---- fetch 与 ProxyAgent 必须来自同一个 undici（两代 handler API 不兼容）----
let netFetch = fetch
if (PROXY) {
  const mod = await (async () => {
    const cands = ['undici', 'E:/plan/test25/kid-quest-farm-2d/node_modules/undici/index.js']
    for (const c of cands) {
      try {
        return await import(c.startsWith('undici') ? c : pathToFileURL(c).href)
      } catch {
        /* 试下一个 */
      }
    }
    throw new Error('找不到 undici')
  })()
  const agent = new mod.ProxyAgent(PROXY)
  netFetch = (u, init = {}) => mod.fetch(u, { ...init, dispatcher: agent })
  console.log(`[proxy] 走 ${PROXY}`)
}

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36'

const mfPath = path.join(dir, 'sound.manifest.json')
if (!fs.existsSync(mfPath)) {
  console.error('镜像里没有 sound.manifest.json —— 先跑 scrape 的 --browse')
  process.exit(1)
}
const mf = JSON.parse(fs.readFileSync(mfPath, 'utf8'))

/** 要补的清单：{ rel, expect, tol } —— tol = 允许的字节差（容器包才有） */
const want = []
for (const [id, p] of Object.entries(mf.packs ?? {})) {
  if (p.url) want.push({ rel: p.url, expect: p.payloadBytes, tol: 8192, kind: 'pack', id })
}
for (const [id, a] of Object.entries(mf.assets ?? {})) {
  for (const [codec, v] of Object.entries(a.variants ?? {})) {
    if (!v.url || v.pack) continue // 打包进 sound.pack 的由上面那个负责
    want.push({ rel: v.url, expect: v.bytes, tol: 0, kind: 'stream', id: id + '/' + codec })
  }
}

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
for (const w of want) {
  const file = path.join(dir, w.rel)
  const have = fs.existsSync(file) ? fs.statSync(file).size : -1
  const good =
    w.tol === 0
      ? have === w.expect
      : have >= w.expect - w.tol && have <= w.expect + w.tol
  if (good) {
    console.log(`  = ${String(have).padStart(9)}  ${w.kind} ${w.id}  ${w.rel}`)
    ok++
    continue
  }
  const url = ORIGIN + w.rel
  try {
    const r = await get(url)
    if (!r.ok) throw new Error('HTTP ' + r.status)
    const buf = Buffer.from(await r.arrayBuffer())
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, buf)
    const good2 =
      w.tol === 0
        ? buf.length === w.expect
        : buf.length >= w.expect - w.tol && buf.length <= w.expect + w.tol
    if (!good2) {
      bad.push(`${w.rel}: 下到 ${buf.length}，清单写 ${w.expect}`)
      console.log(`  ✗ ${String(buf.length).padStart(9)}  ${w.rel}（清单 ${w.expect}）`)
    } else {
      ok++
      console.log(`  ✓ ${String(buf.length).padStart(9)}  ${w.kind} ${w.id}  ${w.rel}`)
    }
  } catch (e) {
    bad.push(`${w.rel}: ${e.message}`)
    console.log(`  ✗ ${w.rel}: ${e.message}`)
  }
}

console.log(`\n${ok}/${want.length} 条就位`)
if (bad.length) {
  console.error('对不上的：')
  for (const b of bad) console.error('  ' + b)
  process.exit(1)
}
