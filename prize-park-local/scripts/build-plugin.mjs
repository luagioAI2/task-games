/**
 * 把插件打成**单文件 ESM**（宿主是用 blob: URL import 的）。
 *
 * 三个硬要求，缺一个宿主的 loader 就拒：
 *   1. 0 个裸模块说明符（`from "three"` 这种在 blob 里解析不了）
 *   2. 0 个动态 import（打包器拆出来的 chunk 也是相对路径）
 *   3. 顶层 export 出 `manifest` 和 `mount`
 *
 * 为什么用宿主那份 vite：本机没有全局打包器，而 kid-quest-farm-2d 里已经装了
 * vite 8.3.0（rolldown），直接用它的 JS API，不额外装依赖、不污染两个项目。
 *
 * 用法：node scripts/build-plugin.mjs [--check]
 *   --check  打完只做校验，不打印体积
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
const OUT_NAME = 'prizepark.plugin.mjs'

await build({
  configFile: false,
  root: ROOT,
  logLevel: 'warn',
  // 游戏源码里没有 CSS 文件（样式是运行时 createElement('style') 写的），不用管 css
  resolve: {
    // ⚠️ 必须是数组、且**更具体的前面**：对象形式做的是前缀字符串替换，
    // `three` 写在 `three/addons` 前面会把 "three/addons/x" 替成 "engines/three.module.js/addons/x"。
    alias: [
      { find: 'three/addons', replacement: path.join(ROOT, 'engines', 'three-jsm') },
      { find: /^three$/, replacement: path.join(ROOT, 'engines', 'three.module.js') },
      { find: '@dimforge/rapier3d-compat', replacement: path.join(ROOT, 'engines', 'rapier3d.js') },
      { find: '@makeplay/sound', replacement: path.join(ROOT, 'runtime', 'sound-1.js') },
    ],
  },
  build: {
    target: 'es2022',
    // 不能写 'esbuild'：宿主没装 esbuild（vite 8 已把它变成可选依赖），
    // 而 vite 8 自带的压缩器是 oxc。
    minify: 'oxc',
    emptyOutDir: true,
    outDir: OUT_DIR,
    lib: {
      entry: path.join(ROOT, 'plugin.js'),
      formats: ['es'],
      fileName: () => OUT_NAME,
    },
    rollupOptions: {
      // 动态 import 一律内联，否则会产出第二个文件（blob 里加载不到）
      output: { inlineDynamicImports: true, manualChunks: undefined },
    },
  },
})

// ---------------- 校验 ----------------
const outFile = path.join(OUT_DIR, OUT_NAME)
const code = fs.readFileSync(outFile, 'utf8')
const kb = (n) => (n / 1024).toFixed(1) + ' KB'

// 1) 裸说明符：import/export ... from "x"，x 不以 . / blob: data: http 开头
const bare = [...code.matchAll(/(?:^|[;\n}])\s*(?:import|export)[^;]*?from\s*["']([^"']+)["']/g)]
  .map((m) => m[1])
  .filter((s) => !/^[./]/.test(s) && !/^(blob:|data:|https?:)/.test(s))

// 2) 动态 import
const dyn = [...code.matchAll(/\bimport\s*\(\s*["']([^"']+)["']/g)].map((m) => m[1])

// 3) 顶层导出（打包后是 export{a as mount,b as manifest} 形式，只查名字出现）
const hasMount = /\bmount\b/.test(code)
const hasManifest = /\bmanifest\b/.test(code)

console.log('产物:', path.relative(ROOT, outFile), kb(Buffer.byteLength(code)))
console.log('裸说明符:', bare.length, bare.slice(0, 5))
console.log('动态 import:', dyn.length, dyn.slice(0, 5))
console.log('导出 mount/manifest:', hasMount, hasManifest)

const fail = []
if (bare.length) fail.push('还有裸模块说明符')
if (dyn.length) fail.push('还有动态 import')
if (!hasMount || !hasManifest) fail.push('缺少 mount/manifest 导出')
if (!code.includes('createThreeFx') && !code.includes('local-1')) fail.push('看起来没把自写 fx 打进去')

if (fail.length) {
  console.error('\n=== 校验失败 ===')
  for (const f of fail) console.error(' -', f)
  process.exit(1)
}
console.log('\n=== 打包校验通过 ===')
