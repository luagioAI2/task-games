#!/usr/bin/env node
/**
 * 把云边小农场打成**单文件 ESM**（宿主用 blob: URL import）。
 *
 * 三个硬要求（缺一个宿主的 loader 就拒），以及各自为什么：
 *
 *   1. **0 个裸模块说明符** —— blob: 模块没有 importmap 可查，
 *      `from "pixi.js"` 直接解析失败。
 *   2. **0 个动态 import** —— 打包器会把动态 import 拆成第二个 chunk，
 *      那是相对路径，blob: 下加载不到。
 *   3. **顶层 export `manifest` 和 `mount`** —— 宿主 `mod.default ?? mod`。
 *
 * 为什么借用宿主那份 vite：本机没有全局打包器，而 kid-quest-farm-2d 里
 * 已经装了 vite（rolldown 版）。直接用它的 JS API，不额外装依赖。
 *
 * ## 为什么这个包会很大（约 4MB）
 *
 * 里面塞了 Pixi.js（798KB）+ 福彩 FX 运行时（3.2MB）。FX 是原版就有的
 * 粒子系统（`@makeplay/fx`），**不能删**：删了就没有下雨/浇水/飘字那套表现。
 * 好在 gzip 后约 1MB，而且是一次性下载 + 本地缓存。
 *
 * 用法：node scripts/build-plugin.mjs [--check]
 */
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.dirname(HERE)
const HOST = path.resolve(ROOT, '..', '..', 'kid-quest-farm-2d')
const VITE_ENTRY = path.join(HOST, 'node_modules', 'vite', 'dist', 'node', 'index.js')

if (!fs.existsSync(VITE_ENTRY)) {
  console.error('找不到宿主那份 vite：', VITE_ENTRY)
  process.exit(2)
}

const { build } = await import(pathToFileURL(VITE_ENTRY).href)

const OUT_DIR = path.join(ROOT, 'dist-plugin')
const OUT_NAME = 'cloudfarm.plugin.mjs'

await build({
  configFile: false,
  root: ROOT,
  logLevel: 'warn',
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

// 1) 裸说明符
const bare = [...code.matchAll(/(?:^|[;\n}])\s*(?:import|export)[^;]*?from\s*["']([^"']+)["']/g)]
  .map((m) => m[1])
  .filter((s) => !/^[./]/.test(s) && !/^(blob:|data:|https?:)/.test(s))

// 2) 动态 import
const dyn = [...code.matchAll(/\bimport\s*\(\s*["']([^"']+)["']/g)].map((m) => m[1])

// 3) blob: 下会 404 的裸资源路径。
//
// ⚠️ 不能简单数 `"assets/` 字面量 —— 源码里有个**兜底分支**：
//     `__cfAsset ? __cfAsset(rel) : "assets/" + rel`
//   插件形态下 `__cfAsset` 必然存在，兜底永远走不到。把它当问题会得到
//   **假阳性**，然后有人会去"修"一个没坏的地方。
//
//   真正有害的是「**没有**包在 `__cfAsset ? … :` 里的 `"assets/`」。所以判据是
//   看字面量前面 120 字符内有没有 `__cfAsset ?`。
//
//   第二种**合法**形态（v1.1 加）：`"assets/"` 作为 `assetUrl(...)` / `assetBase(...)`
//   的**入参**，用来给调用方的相对路径补上资源根 —— 也就是
//   `__cfAsset = (rel) => assetBase("assets/" + rel)`。
//   它本身就是"走 assetUrl"的那一步，不是裸路径。
//   压缩后函数名会被改写（`assetUrl` → `i`），所以只能认**形状**：
//   整个字符串字面量恰好是 `"assets/"`，且紧跟在 `(` 后面 ⇒ 是某个调用的第一个实参前缀。
//
//   ⚠️ 这条形状规则理论上也能放过 `fetch("assets/" + p)`。静态扫描在压缩产物上
//   判不了这个语义，所以**真正的闸门是运行时**：`scripts/e2e-economy.mjs` 断言
//   「整轮挂载 0 个 404」。2026-10-24 那个
//   `SyntaxError: Unexpected non-whitespace character after JSON at position 4`
//   （= `res.json()` 吃进 404 正文 `404 Not Found`）就是这条运行时断言抓出来的。
const FALLBACK = /__cfAsset\s*\?/;
// ctx 截到**引号之前**（m.index 指在引号上），所以这里只能要求以 `(` / `,` 收尾
const CALL_ARG_PREFIX = /[,(]\s*$/;
const assetHits = [...code.matchAll(/["'`]assets\//g)].map((m) => ({
  at: m.index,
  ctx: code.slice(Math.max(0, m.index - 120), m.index),
  // 这个字面量是不是**整个**字符串（`"assets/"` 后面紧跟引号）
  whole: /^["'`]assets\/["'`]/.test(code.slice(m.index, m.index + 12)),
}));
const isOk = (h) => FALLBACK.test(h.ctx) || (h.whole && CALL_ARG_PREFIX.test(h.ctx));
const rawAsset = assetHits.filter((h) => !isOk(h))

const hasMount = /export\s*\{[^}]*\bmount\b/.test(code) || /\bas mount\b/.test(code)
const hasManifest = /\bas manifest\b/.test(code) || /export\s*\{[^}]*\bmanifest\b/.test(code)

console.log('产物  :', path.relative(ROOT, outFile), kb(Buffer.byteLength(code)))
console.log('裸说明符:', bare.length, bare.slice(0, 5))
console.log('动态 import:', dyn.length, dyn.slice(0, 5))
console.log('未走 assetUrl 的裸 "assets/":', rawAsset.length,
  rawAsset.length ? rawAsset.map((h) => JSON.stringify(h.ctx.slice(-60))).slice(0, 3) : '')
// 放过的每一处都打出来，方便人眼复核（形状规则只是代理判据，别让它悄悄放宽）
for (const h of assetHits.filter(isOk)) {
  const why = FALLBACK.test(h.ctx) ? '兜底分支' : 'assetUrl 入参前缀'
  console.log('  · 放过（' + why + '）:', JSON.stringify(h.ctx.slice(-50) + code.slice(h.at, h.at + 12)))
}
console.log('导出 mount/manifest:', hasMount, hasManifest)

const fail = []
if (bare.length) fail.push('还有裸模块说明符: ' + bare.join(', '))
if (dyn.length) fail.push('还有动态 import: ' + dyn.join(', '))
if (!hasMount || !hasManifest) fail.push('缺少 mount/manifest 导出')
if (rawAsset.length) fail.push(`有 ${rawAsset.length} 处裸 "assets/" 没走 ctx.assetUrl —— blob: 下会 404`)
if (!code.includes('WebGLRenderer') && !code.includes('PIXI')) fail.push('看起来没把 Pixi 打进去')

/* ★ 时间尺度守卫（2026-11-09）：`MS_PER_FARM_MIN` 曾经为了跑测试被调成 6000
   （10× 加速），结果正式包里小萝卜 12 秒就熟、跟 App 自带农场（2 分钟）差一个量级，
   而 UI 上的「几分」全部变成了「几秒」。这种「测试时顺手改的常量」只有在打包那一刻
   拦得住 —— 人眼不会去比一个 5 位数的常量。
   要真的做加速版，得走 `?rig=` 那套查询参数，不许改这里。 */
const CATALOG_SRC = fs.readFileSync(path.join(ROOT, 'src/data/catalog.js'), 'utf8')
const scale = Number((CATALOG_SRC.match(/MS_PER_FARM_MIN\s*=\s*(\d+)/) ?? [])[1])
if (scale !== 60000) {
  fail.push(`MS_PER_FARM_MIN = ${scale ?? '(没读到)'}，必须是 60000（1 农场分钟 = 1 现实分钟）`)
}

if (fail.length) {
  console.error('\n=== 校验失败 ===')
  for (const f of fail) console.error(' -', f)
  process.exit(1)
}

/* ---------------- 资源 ----------------
 *
 * 插件只产出**一份代码**；贴图必须在 `assetBase` 指向的目录里。
 * 这里顺手把它铺到 `dist-plugin/assets/`，让 `plugin-test` 能直接
 * 用 `assetBase = /dist-plugin/` 起跑 —— 不然测试要么自己拼目录，
 * 要么验的是一个和发布物不一样的树。
 *
 * ⚠️ 这是**测试用的拷贝**，不是发布路径。真正发布时要放到
 *    `<host>/public/games/cloudfarm/assets/`（见 `scripts/install-to-host.mjs`）。
 */
const ASSETS_OUT = path.join(OUT_DIR, 'assets')
fs.rmSync(ASSETS_OUT, { recursive: true, force: true })
fs.cpSync(path.join(ROOT, 'assets'), ASSETS_OUT, { recursive: true })
const assetCount = (function count(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).reduce(
    (n, d) => n + (d.isDirectory() ? count(path.join(dir, d.name)) : 1),
    0,
  )
})(ASSETS_OUT)
console.log('资源  :', path.join('dist-plugin', 'assets'), '·', assetCount, '个文件')

console.log('\n=== 打包校验通过 ===')
