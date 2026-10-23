/**
 * 把爪爪乐打成**单文件 ESM 插件包**（宿主是用 `blob:` URL `import()` 的）。
 *
 * ```bash
 * node scripts/build-plugin.mjs          # 打包 + 自检
 * node scripts/build-plugin.mjs --check  # 只自检已有产物（部署前跑）
 * ```
 *
 * ## 三条硬要求，缺一条宿主的 loader 就拒
 *
 *   1. **0 个裸模块说明符** —— `from "three"` 在 blob 模块里解析不了；
 *   2. **0 个动态 `import()`** —— 打包器会拆出第二个文件，而宿主只拿到一个 URL；
 *   3. **顶层导出 `manifest` 和 `mount`**。
 *
 * ## 为什么借宿主那份 vite
 *
 * 本机没有全局打包器，而 `kid-quest-farm-2d` 里已经装了 vite 8（rolldown）。
 * 直接用它的 JS API，不额外装依赖、不污染两个项目 —— 和奖品公园那边同一套做法。
 *
 * ⚠️ `minify` **不能写 `'esbuild'`**：宿主没装 esbuild（vite 8 已把它变成可选
 * 依赖），写了会在 `build()` 里抛「找不到 esbuild」，而报错指向插件项目，
 * 看着像这边配置错了。
 */
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.dirname(HERE)
const HOST = path.resolve(ROOT, '..', 'kid-quest-farm-2d')
const VITE_ENTRY = path.join(HOST, 'node_modules', 'vite', 'dist', 'node', 'index.js')

const OUT_DIR = path.join(ROOT, 'dist-plugin')
const OUT_NAME = 'claw3d.plugin.mjs'
const OUT_FILE = path.join(OUT_DIR, OUT_NAME)

const CHECK_ONLY = process.argv.includes('--check')

/* ---------------- 打包 ---------------- */

if (!CHECK_ONLY) {
  if (!fs.existsSync(VITE_ENTRY)) {
    console.error('找不到宿主那份 vite：', VITE_ENTRY)
    process.exit(2)
  }
  const { build } = await import(pathToFileURL(VITE_ENTRY).href)

  console.log('打包中…（three + rapier 的 wasm 都会内联进来，慢一点是正常的）')
  await build({
    configFile: false,
    root: ROOT,
    logLevel: 'warn',
    // 插件没有独立 CSS 文件：样式是运行时 `document.createElement('style')` 写的
    build: {
      target: 'es2022',
      minify: 'oxc',
      emptyOutDir: true,
      outDir: OUT_DIR,
      // 单文件不需要 sourcemap，而且它会额外产出一个 .map（宿主不认）
      sourcemap: false,
      lib: {
        entry: path.join(ROOT, 'src/plugin/index.ts'),
        formats: ['es'],
        fileName: () => OUT_NAME,
      },
      rollupOptions: {
        // 动态 import 一律内联，否则会产出第二个文件
        output: { inlineDynamicImports: true, manualChunks: undefined },
      },
    },
  })
}

/* ---------------- 自检 ---------------- */

if (!fs.existsSync(OUT_FILE)) {
  console.error('产物不存在:', OUT_FILE)
  process.exit(2)
}

const code = fs.readFileSync(OUT_FILE, 'utf8')
const bytes = Buffer.byteLength(code)
const kb = (n) => (n / 1024).toFixed(1) + ' KB'

// 1) 裸说明符：import/export ... from "x"，x 不以 . / blob: data: http 开头
const bare = [...code.matchAll(/(?:^|[;\n}])\s*(?:import|export)[^;]*?from\s*["']([^"']+)["']/g)]
  .map((m) => m[1])
  .filter((s) => !/^[./]/.test(s) && !/^(blob:|data:|https?:)/.test(s))

// 2) 动态 import
const dyn = [...code.matchAll(/\bimport\s*\(\s*["']([^"']+)["']/g)].map((m) => m[1])

// 3) 顶层导出（打包后是 `export{a as mount,b as manifest}` 形式，只查名字出现）
const hasMount = /\bmount\b/.test(code)
const hasManifest = /\bmanifest\b/.test(code)

// 4) 真东西有没有打进去 —— 光看体积挡不住「打包器把 three 当外部依赖」这种情况
const hasThree = /WebGLRenderer/.test(code)
const hasRapier = /rapier|RigidBodyDesc/i.test(code)
const hasDom = /id="app"|id=\\"app\\"/.test(code)
const hasCss = /claw-root/.test(code)

console.log('产物:', path.relative(ROOT, OUT_FILE), kb(bytes))
console.log('裸说明符:', bare.length, bare.slice(0, 5))
console.log('动态 import:', dyn.length, dyn.slice(0, 5))
console.log('导出 mount/manifest:', hasMount, hasManifest)
console.log('内联 three / rapier / DOM / CSS:', hasThree, hasRapier, hasDom, hasCss)

const fail = []
if (bare.length) fail.push('还有裸模块说明符')
if (dyn.length) fail.push('还有动态 import')
if (!hasMount || !hasManifest) fail.push('缺少 mount / manifest 导出')
if (!hasThree) fail.push('没把 three 打进去（被当成外部依赖了？）')
if (!hasRapier) fail.push('没把 rapier 打进去')
if (!hasDom) fail.push('没把机器 DOM 打进去（html.ts 没生成？）')
if (!hasCss) fail.push('没把样式打进去（css.ts 没生成？）')
if (bytes < 1_000_000) fail.push(`产物只有 ${kb(bytes)}，three + rapier 不可能这么小`)

if (fail.length) {
  console.error('\n=== 打包自检失败 ===')
  for (const f of fail) console.error(' -', f)
  process.exit(1)
}
console.log('\n=== 打包自检通过 ===')
