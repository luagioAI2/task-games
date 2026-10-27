#!/usr/bin/env node
/**
 * 把收租公寓打成**单文件 ESM**（宿主用 blob: URL import）。
 *
 * 三个硬要求（缺一个宿主的 loader 就拒）：
 *
 *   1. **0 个裸模块说明符** —— blob: 模块没有 importmap 可查，
 *      `from "pixi.js"` / `from "@makeplay/display"` 直接解析失败。
 *   2. **0 个动态 import** —— 打包器会把动态 import 拆成第二个 chunk，
 *      那是相对路径，blob: 下加载不到。
 *   3. **顶层 export `manifest` 和 `mount`** —— 宿主 `mod.default ?? mod`。
 *
 * ## 为什么四个依赖都要 alias 进包
 *
 * 独立网页靠 `index.html` 的 importmap 解析 `pixi.js` / `@makeplay/*`；
 * 插件形态**没有 importmap**，所以必须在这里全部内联：
 *
 * | 说明符 | 指向 |
 * | --- | --- |
 * | `pixi.js` | `engines/pixi.min.mjs`（798 KB，ESM 构建） |
 * | `@makeplay/display` | `runtime/display-1.js` |
 * | `@makeplay/sound` | `runtime/sound-1.js` |
 * | `@makeplay/fx` | `runtime/makeplay-fx/game.js` |
 *
 * 漏掉 `pixi.js` 的 alias ⇒ 构建**能过**，但产物里留着裸说明符 ⇒
 * 宿主 import 时抛 `Failed to resolve module specifier "pixi.js"`（整块空白）。
 * 所以下面那条「裸说明符必须为 0」是这份脚本的主闸门。
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
const OUT_NAME = 'renttower.plugin.mjs'

await build({
  configFile: false,
  root: ROOT,
  logLevel: 'warn',
  resolve: {
    alias: {
      'pixi.js': path.join(ROOT, 'engines', 'pixi.min.mjs'),
      '@makeplay/display': path.join(ROOT, 'runtime', 'display-1.js'),
      '@makeplay/sound': path.join(ROOT, 'runtime', 'sound-1.js'),
      '@makeplay/fx': path.join(ROOT, 'runtime', 'makeplay-fx', 'game.js'),
    },
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

// 1) 裸说明符
const bare = [...code.matchAll(/(?:^|[;\n}])\s*(?:import|export)[^;]*?from\s*["']([^"']+)["']/g)]
  .map((m) => m[1])
  .filter((s) => !/^[./]/.test(s) && !/^(blob:|data:|https?:)/.test(s))

// 2) 动态 import
const dyn = [...code.matchAll(/\bimport\s*\(\s*["']([^"']+)["']/g)].map((m) => m[1])

// 3) 导出形状
const hasMount = /export\s*\{[^}]*\bmount\b/.test(code) || /\bas mount\b/.test(code)
const hasManifest = /\bas manifest\b/.test(code) || /export\s*\{[^}]*\bmanifest\b/.test(code)

// 4) 适配层真的打进去了（否则挂载时会 `mountDisplay is not defined`，构建期不报错）
const hasDisplay = /attachPixi|mountDisplay/.test(code)
const hasSound = /manifestDirectoryUrl|setMusicState/.test(code)

// 5) 资源字面量 —— **只作信息**：它们运行时都过 `assetUrl()`，静态判不了
const assetLiterals = [...code.matchAll(/["'`]assets\//g)].length

console.log('产物      :', path.relative(ROOT, outFile), kb(Buffer.byteLength(code)))
console.log('裸说明符  :', bare.length, bare.slice(0, 5))
console.log('动态 import:', dyn.length, dyn.slice(0, 5))
console.log('导出      : mount', hasMount, '· manifest', hasManifest)
console.log('适配层    : display', hasDisplay ? '已内联' : '**没打进去**', '· sound', hasSound ? '已内联' : '**没打进去**')
console.log('assets/ 字面量:', assetLiterals, '（走 assetUrl() 才生效 —— 靠 mount-test 的 0×404 验）')

const fail = []
if (bare.length) fail.push('还有裸模块说明符: ' + bare.join(', '))
if (dyn.length) fail.push('还有动态 import: ' + dyn.join(', '))
if (!hasMount || !hasManifest) fail.push('缺少 mount/manifest 导出')
if (!hasDisplay || !hasSound) fail.push('看起来没把 @makeplay 适配层打进去')

if (fail.length) {
  console.error('\n=== 校验失败 ===')
  for (const f of fail) console.error(' -', f)
  process.exit(1)
}

/* ---------------- 资源 ----------------
 *
 * 插件只产出**一份代码**；贴图必须在 `assetBase` 指向的目录里。
 * 这里顺手把它铺到 `dist-plugin/assets/`，让 `mount-test.mjs` 能直接用。
 *
 * ⚠️ 这是**测试用的拷贝**，不是发布路径。真正发布时走
 *    `scripts/install-to-host.mjs`（拷到 `<host>/public/games/renttower/`）。
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
console.log('资源      :', path.join('dist-plugin', 'assets'), '·', assetCount, '个文件')

/* 包**根目录**的两件东西：音频清单和音效包。
 *
 * ⚠️ 它们不在 `assets/` 里 —— 游戏是拿 `assetUrl('sound.manifest.json')` 取的，
 *    而 `assetBase` 指向**包根**。假宿主把 `dist-plugin/` 当站点根，所以这里
 *    必须也铺一份，否则 `mount-test` 会 404，而真宿主的安装脚本会去拷
 *    一个不存在的源文件（`ENOENT`，看着像磁盘坏了）。
 */
for (const f of ['sound.pack', 'sound.manifest.json']) {
  fs.copyFileSync(path.join(ROOT, f), path.join(OUT_DIR, f))
}
console.log('根文件    :', 'sound.pack + sound.manifest.json')

console.log('\n=== 打包校验通过 ===')
