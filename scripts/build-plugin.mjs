#!/usr/bin/env node
/**
 * 把细胞守卫打成**单文件 ESM**（宿主用 blob: URL import）。
 *
 * 三个硬要求（缺一个宿主 loader 就拒）：
 *
 *   1. **0 个裸模块说明符** —— blob: 模块没有 importmap 可查，`from "pixi.js"` 直接解析失败。
 *   2. **0 个动态 import** —— 打包器会把动态 import 拆成第二个 chunk，那是相对路径，blob: 下加载不到。
 *   3. **顶层 export `manifest` 和 `mount`** —— 宿主 `mod.default ?? mod`。
 *
 * ## 这款没有引擎、也没有资源 —— 所以没有 alias 段
 *
 * 原版的 `game.js` 是**已经打好的**单文件包（preact + 游戏逻辑 + 程序化美术全在里面），
 * 只 import 三个本地模块（`i18n.js` / `saves.js` / `scope-css.js`）。importmap 里那十几个
 * 引擎一个都没用上（`grep` 命中 0），所以这里**故意不写 alias** ——
 * 多写一条只会让「引擎没打进去」的判据变成噪音。
 *
 * 美术是**程序化绘制**（`yi()` 生成 SVG data URL，`Dr` 画 canvas），
 * 音频列表 `kn` 是空数组 ⇒ 整包就一个文件，`dist-plugin/` 里没有 assets。
 *
 * 为什么借用宿主那份 vite：本机没有全局打包器，而 kid-quest-farm-2d 里
 * 已经装了 vite（rolldown 版）。直接用它的 JS API，不额外装依赖。
 *
 * 用法：node scripts/build-plugin.mjs
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
const OUT_NAME = 'cellguard.plugin.mjs'

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

// 3) 导出形状
const hasMount = /export\s*\{[^}]*\bmount\b/.test(code) || /\bas mount\b/.test(code)
const hasManifest = /\bas manifest\b/.test(code) || /export\s*\{[^}]*\bmanifest\b/.test(code)

// 4) 游戏本体真的打进去了（否则挂载时才炸，构建期不报错）
const hasGame = /Cell, Not Today|开始战斗/.test(code)
const hasScope = /scopeCss|--u/.test(code)

console.log('产物        :', path.relative(ROOT, outFile), kb(Buffer.byteLength(code)))
console.log('裸说明符    :', bare.length, bare.slice(0, 5))
console.log('动态 import :', dyn.length, dyn.slice(0, 5))
console.log('导出        : mount', hasMount, '· manifest', hasManifest)
console.log('游戏本体    :', hasGame ? '已内联' : '**没打进去**', '· 样式作用域', hasScope ? '在' : '**没了**')

const fail = []
if (bare.length) fail.push('还有裸模块说明符: ' + bare.join(', '))
if (dyn.length) fail.push('还有动态 import: ' + dyn.join(', '))
if (!hasMount || !hasManifest) fail.push('缺少 mount/manifest 导出')
if (!hasGame) fail.push('看起来没把 game.js 打进去')
if (!hasScope) fail.push('看起来没把 scopeCss / --u 打进去')

if (fail.length) {
  console.error('\n=== 校验失败 ===')
  for (const f of fail) console.error(' -', f)
  process.exit(1)
}

console.log('\n=== 打包校验通过 ===')
