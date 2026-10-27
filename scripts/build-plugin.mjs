#!/usr/bin/env node
/**
 * 把旋转灯泡打成**单文件 ESM**（宿主用 blob: URL import）。
 *
 * 三个硬要求（缺一个宿主的 loader 就拒）：
 *
 *   1. **0 个裸模块说明符** —— blob: 模块没有 importmap 可查，
 *      `from "@makeplay/display"` 直接解析失败。
 *   2. **0 个动态 import** —— 打包器会把动态 import 拆成第二个 chunk，
 *      那是相对路径，blob: 下加载不到。
 *   3. **顶层 export `manifest` 和 `mount`** —— 宿主 `mod.default ?? mod`。
 *
 * 为什么借用宿主那份 vite：本机没有全局打包器，而 kid-quest-farm-2d 里
 * 已经装了 vite（rolldown 版）。直接用它的 JS API，不额外装依赖。
 *
 * ## 为什么 `@makeplay/*` 要 alias
 *
 * 源码里写的是 `import { mountDisplay } from '@makeplay/display'`
 * （独立网页靠 `index.html` 的 importmap 解析）。插件形态没有 importmap，
 * 所以必须在这里把它们**内联**进包：`resolve.alias` 指到 `runtime/*.js`。
 *
 * ## 资源路径的静态判据为什么在这份包上不成立
 *
 * `assets/...` 字面量都在 `IMG_SRC` 里，**用到的时候**才过 `asset()`。
 * 静态扫描看到的是裸字面量，但运行时它们全都走了 `ctx.assetUrl` ——
 * 所以「数裸字面量」在这里只会得到**假阳性**。
 *
 * 真正的闸门是运行时：`scripts/mount-test.mjs` 断言**整轮挂载 0 个 404**。
 * 这份脚本只把它当**信息**打出来。
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
const OUT_NAME = 'sweetspin.plugin.mjs'

await build({
  configFile: false,
  root: ROOT,
  logLevel: 'warn',
  resolve: {
    // 独立网页靠 importmap 解析这两个；插件里没有 importmap ⇒ 这里全部内联
    alias: {
      '@makeplay/display': path.join(ROOT, 'runtime', 'display-1.js'),
      '@makeplay/sound': path.join(ROOT, 'runtime', 'sound-1.js'),
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
const hasDisplay = /mpRotateHint|attachCanvas/.test(code)
const hasSound = /manifestDirectoryUrl|setMusicState/.test(code)

// 5) 资源字面量 —— **只作信息**，见文件头
const assetLiterals = [...code.matchAll(/["'`]assets\//g)].length

console.log('产物      :', path.relative(ROOT, outFile), kb(Buffer.byteLength(code)))
console.log('裸说明符  :', bare.length, bare.slice(0, 5))
console.log('动态 import:', dyn.length, dyn.slice(0, 5))
console.log('导出      : mount', hasMount, '· manifest', hasManifest)
console.log('适配层    : display', hasDisplay ? '已内联' : '**没打进去**', '· sound', hasSound ? '已内联' : '**没打进去**')
console.log('assets/ 字面量:', assetLiterals, '（走 asset() 才生效，静态判不了 —— 靠 mount-test 的 0×404）')

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
 *    `scripts/install-to-host.mjs`（拷到 `<host>/public/games/sweetspin/`）。
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
 * ⚠️ 它们不在 `assets/` 里 —— 游戏是拿 `asset('sound.manifest.json')` 取的，
 *    而 `assetBase` 指向**包根**。假宿主把 `dist-plugin/` 当站点根，所以这里
 *    必须也铺一份，否则 `mount-test` 会 404，而真宿主的安装脚本会去拷
 *    一个不存在的源文件（`ENOENT`，看着像磁盘坏了）。
 */
for (const f of ['sound.pack', 'sound.manifest.json']) {
  fs.copyFileSync(path.join(ROOT, f), path.join(OUT_DIR, f))
}
console.log('根文件    :', 'sound.pack + sound.manifest.json')

console.log('\n=== 打包校验通过 ===')
