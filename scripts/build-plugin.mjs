#!/usr/bin/env node
/**
 * 把跳绳羊群打成**单文件 ESM**（宿主用 blob: URL import）。
 *
 * 三个硬要求（缺一个宿主的 loader 就拒）：
 *
 *   1. **0 个裸模块说明符** —— blob: 模块没有 importmap 可查，
 *      `from "pixi.js"` 直接解析失败。
 *   2. **0 个动态 import** —— 打包器会把动态 import 拆成第二个 chunk，
 *      那是相对路径，blob: 下加载不到。
 *   3. **顶层 export `manifest` 和 `mount`** —— 宿主 `mod.default ?? mod`。
 *
 * ## 为什么四个引擎都要 alias
 *
 * 源码里写的是 `import * as PIXI from 'pixi.js'` / `'@makeplay/fx'` / `'@makeplay/sound'`
 * / `'@makeplay/display'`（独立网页靠 `index.html` 的 importmap 解析）。
 * 插件形态没有 importmap，所以必须在这里**内联**进包。
 *
 * ★ `@makeplay/fx` 是 3.2 MB 的粒子运行时 —— 起跳尘烟 / 招募星星真在用
 *   （`fxPlay()` 全走它），不是可选装饰。
 *
 * ## 资源路径的静态判据为什么在这份包上不成立
 *
 * `assets/...` 字面量都在 `TEX_URLS` / `ANIM_PACKS` 里，**用到的时候**才过 `asset()`，
 * 而 `asset()` 前面拼的是运行时才知道的 `ASSET_BASE`。静态扫描看到的是裸字面量，
 * 但运行时它们全都走了 `ctx.assetUrl` —— 所以「数裸字面量」在这里只会得到**假阳性**。
 *
 * 真正的闸门是运行时：`scripts/plugin-test.cjs` 断言**整轮挂载 0 个 404**。
 *
 * 用法：node scripts/build-plugin.mjs
 */
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'
import { execFileSync } from 'node:child_process'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.dirname(HERE)
const HOST = path.resolve(ROOT, '..', '..', 'kid-quest-farm-2d')
const VITE_ENTRY = path.join(HOST, 'node_modules', 'vite', 'dist', 'node', 'index.js')

if (!fs.existsSync(VITE_ENTRY)) {
  console.error('找不到宿主那份 vite：', VITE_ENTRY)
  process.exit(2)
}

const ENG = {
  pixi: path.join(ROOT, 'engines', 'pixi.min.mjs'),
  fx: path.join(ROOT, 'runtime', 'makeplay-fx', 'game.js'),
  sound: path.join(ROOT, 'runtime', 'sound-1.js'),
  display: path.join(ROOT, 'runtime', 'display-1.js'),
}
for (const [k, p] of Object.entries(ENG)) {
  if (!fs.existsSync(p)) {
    console.error(`找不到引擎 ${k}：${p}`)
    process.exit(2)
  }
}

const { build } = await import(pathToFileURL(VITE_ENTRY).href)

const OUT_DIR = path.join(ROOT, 'dist-plugin')
const OUT_NAME = 'ropeland.plugin.mjs'

await build({
  configFile: false,
  root: ROOT,
  logLevel: 'warn',
  resolve: {
    alias: [
      { find: /^pixi\.js$/, replacement: ENG.pixi },
      { find: /^@makeplay\/fx$/, replacement: ENG.fx },
      { find: /^@makeplay\/sound$/, replacement: ENG.sound },
      { find: /^@makeplay\/display$/, replacement: ENG.display },
    ],
  },
  build: {
    target: 'es2022',
    // 不能写 'esbuild'：宿主没装（vite 8 已把它变成可选依赖），自带的是 oxc
    minify: 'oxc',
    emptyOutDir: true,
    outDir: OUT_DIR,
    lib: {
      entry: path.join(ROOT, 'plugin.js'),
      formats: ['es'],
      fileName: () => OUT_NAME,
    },
    rollupOptions: {
      output: { inlineDynamicImports: true, manualChunks: undefined },
    },
  },
})

/* ---------------- 校验 ---------------- */
const outFile = path.join(OUT_DIR, OUT_NAME)
const code = fs.readFileSync(outFile, 'utf8')
const kb = (n) => (n / 1024).toFixed(1) + ' KB'

const bare = [...code.matchAll(/(?:^|[;\n}])\s*(?:import|export)[^;]*?from\s*["']([^"']+)["']/g)]
  .map((m) => m[1])
  .filter((s) => !/^[./]/.test(s) && !/^(blob:|data:|https?:)/.test(s))
const dyn = [...code.matchAll(/\bimport\s*\(\s*["']([^"']+)["']/g)].map((m) => m[1])
const hasMount = /export\s*\{[^}]*\bmount\b/.test(code) || /\bas mount\b/.test(code)
const hasManifest = /\bas manifest\b/.test(code) || /export\s*\{[^}]*\bmanifest\b/.test(code)

// 引擎真的打进去了（否则挂载时才炸，构建期不报错）
const hasPixi = /batchMode|batchSize/.test(code)
const hasFx = /referenceSpan|post\.configure/.test(code)
const hasSound = /MPSND1|sound_cue_played/.test(code)
const hasDisplay = /data-mp-rotate|mountDisplay/.test(code)

// 去掉的东西不能偷偷回来
const leaks = [
  ['gp.pay', /\.pay\s*[?.]/],
  ['submitScore', /submitScore/],
  ['topScores', /topScores/],
  ['requestLogin', /requestLogin/],
  ['static.makeplay.ai 外链', /https:\/\/static\.makeplay\.ai/],
].filter(([, re]) => re.test(code)).map(([n]) => n)

const assetLiterals = [...code.matchAll(/["'`]assets\//g)].length

console.log('产物      :', path.relative(ROOT, outFile), kb(Buffer.byteLength(code)))
console.log('裸说明符  :', bare.length, bare.slice(0, 5))
console.log('动态 import:', dyn.length, dyn.slice(0, 5))
console.log('导出      : mount', hasMount, '· manifest', hasManifest)
console.log('引擎      : pixi', hasPixi ? '✓' : '✗', '· fx', hasFx ? '✓' : '✗', '· sound', hasSound ? '✓' : '✗', '· display', hasDisplay ? '✓' : '✗')
console.log('残留泄漏  :', leaks.length ? leaks.join(', ') : '无')
console.log('assets/ 字面量:', assetLiterals, '（走 asset() 才生效，静态判不了 —— 靠 plugin-test 的 0×404）')

const fail = []
if (bare.length) fail.push('还有裸模块说明符: ' + bare.join(', '))
if (dyn.length) fail.push('还有动态 import: ' + dyn.join(', '))
if (!hasMount || !hasManifest) fail.push('缺少 mount/manifest 导出')
if (!hasPixi) fail.push('看起来没把 pixi.js 打进去')
if (!hasFx) fail.push('看起来没把 @makeplay/fx 打进去')
if (!hasSound) fail.push('看起来没把 @makeplay/sound 打进去')
if (!hasDisplay) fail.push('看起来没把 @makeplay/display 打进去')
if (leaks.length) fail.push('已拆除的平台能力又出现了: ' + leaks.join(', '))

if (fail.length) {
  console.error('\n=== 校验失败 ===')
  for (const f of fail) console.error(' -', f)
  process.exit(1)
}

/* ---------------- 资源 ----------------
 *
 * 插件只产出**一份代码**；资源必须在 `assetBase` 指向的目录里。
 * 这里顺手铺到 `dist-plugin/assets/`，让 `plugin-test.cjs` 能直接用
 * `assetBase = '/'` 起跑 —— 不然测试要么自己拼目录，要么验的是另一棵树。
 *
 * ⚠️ 这是**测试用的拷贝**，不是发布路径。发布走 `scripts/install-to-host.mjs`。
 */
const ASSETS_OUT = path.join(OUT_DIR, 'assets')
fs.rmSync(ASSETS_OUT, { recursive: true, force: true })

// ★ `assets/manifest.json` 是「发布方逐个校验资源」的依据（宿主 `check-plugin.mjs`
//   逐字节对 sha256）。它过期**不会在运行时出错** —— 只会在宿主校验时报
//   「哈希对不上」，而人第一反应会去查打包 / 网络。所以每次打包都重算一次，
//   代价只有几十毫秒；忘记重跑这条路直接堵死。
execFileSync(process.execPath, [path.join(HERE, 'make-asset-manifest.mjs')], { stdio: 'inherit' })

fs.cpSync(path.join(ROOT, 'assets'), ASSETS_OUT, { recursive: true })

const count = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).reduce(
    (n, d) => n + (d.isDirectory() ? count(path.join(dir, d.name)) : 1),
    0,
  )
const bytes = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).reduce((n, d) => {
    const p = path.join(dir, d.name)
    return n + (d.isDirectory() ? bytes(p) : fs.statSync(p).size)
  }, 0)

const zero = []
;(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name)
    if (e.isDirectory()) walk(p)
    else if (fs.statSync(p).size === 0) zero.push(path.relative(ASSETS_OUT, p))
  }
})(ASSETS_OUT)

const withSound = count(ASSETS_OUT)
console.log('资源      : dist-plugin/assets ·', withSound, '个文件 ·', kb(bytes(ASSETS_OUT)))
if (zero.length) {
  // 0 字节文件是「抓的时候就没拿到」的典型症状，转格式之后更难发现
  console.error('\n=== 校验失败：有 0 字节资源 ===')
  for (const z of zero.slice(0, 10)) console.error(' -', z)
  process.exit(1)
}

console.log('\n=== 打包校验通过 ===')
