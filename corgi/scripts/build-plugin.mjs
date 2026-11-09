#!/usr/bin/env node
/**
 * 把柯基屁屁打成**单文件 ESM**（宿主用 blob: URL import）。
 *
 * 三个硬要求（缺一个宿主 loader 就拒）：
 *
 *   1. **0 个裸模块说明符** —— blob: 模块没有 importmap 可查，
 *      `from "@makeplay/sound"` 直接解析失败。
 *   2. **0 个动态 import** —— 打包器会把动态 import 拆成第二个 chunk，
 *      那是相对路径，blob: 下加载不到。
 *   3. **顶层 export `manifest` 和 `mount`** —— 宿主 `mod.default ?? mod`。
 *
 * 为什么借用宿主那份 vite：本机没有全局打包器，而 kid-quest-farm-2d 里
 * 已经装了 vite（rolldown 版）。直接用它的 JS API，不额外装依赖。
 *
 * ## 本作的引擎清单只有两个
 *
 * | 说明符 | 落到哪 |
 * | --- | --- |
 * | `@makeplay/sound` | `runtime/sound-1.js`（ES 模块，直接 alias） |
 * | `Phaser` | `engines/phaser.min.js`（**UMD 全局**，靠 `game.js` 顶部的副作用 import 拉进来） |
 *
 * ★ Phaser 不是靠 alias 进来的 —— 源码里没有 `import ... from 'phaser'`，
 *   用的是全局 `Phaser`。所以判据不能查「有没有 alias 命中」，
 *   只能查**产物里有没有 Phaser 的特征串**（见下面 `hasPhaser`）。
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

const ENG = {
  sound: path.join(ROOT, 'runtime', 'sound-1.js'),
  phaser: path.join(ROOT, 'engines', 'phaser.min.js'),
}
for (const [k, p] of Object.entries(ENG)) {
  if (!fs.existsSync(p)) {
    console.error(`找不到引擎 ${k}：${p}`)
    process.exit(2)
  }
}

const { build } = await import(pathToFileURL(VITE_ENTRY).href)

const OUT_DIR = path.join(ROOT, 'dist-plugin')
const OUT_NAME = 'corgi.plugin.mjs'

await build({
  configFile: false,
  root: ROOT,
  logLevel: 'warn',
  resolve: {
    alias: [{ find: /^@makeplay\/sound$/, replacement: ENG.sound }],
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

// 4) 引擎真的打进去了（否则挂载时才炸，构建期不报错）
//    ★ 别用 `Phaser.Game` —— 会被 minify 改名。找 Phaser 内部稳定的常量串。
const hasPhaser = /WEBGL1_MAX_TEXTURES|Phaser 3|blendModes|input\.activePointers/.test(code) || code.length > 900_000
const hasSound = /musicStates|duckRules|loadSoundSystem/.test(code)

const fails = []
if (bare.length) fails.push(`裸说明符 ${bare.length} 个：${bare.slice(0, 5).join(', ')}`)
if (dyn.length) fails.push(`动态 import ${dyn.length} 个：${dyn.slice(0, 5).join(', ')}`)
if (!hasMount) fails.push('产物里找不到 mount 导出')
if (!hasManifest) fails.push('产物里找不到 manifest 导出')
if (!hasPhaser) fails.push('Phaser 没打进去（挂载时才炸）')
if (!hasSound) fails.push('@makeplay/sound 没打进去（整局没声音）')

console.log(`\n产物：${path.relative(ROOT, outFile)}  ${kb(fs.statSync(outFile).size)}`)
console.log(`  裸说明符 ${bare.length} · 动态 import ${dyn.length} · mount ${hasMount} · manifest ${hasManifest}`)
console.log(`  Phaser ${hasPhaser} · sound ${hasSound}`)

if (fails.length) {
  console.error('\n✗ 校验没过：')
  for (const f of fails) console.error('  · ' + f)
  process.exit(2)
}

/* ---------------- 资源 ----------------
 *
 * 插件只产出**一份代码**；资源必须在 `assetBase` 指向的目录里。
 * 这里顺手铺到 `dist-plugin/`，让 `mount-test.mjs` 能直接用 `assetBase = '/'`
 * 起跑 —— 不然测试要么自己拼目录，要么验的是另一棵树。
 *
 * ⚠️ 这是**测试用的拷贝**，不是发布路径。发布走 `scripts/install-to-host.mjs`。
 *
 * 本作**包根**上有四样（不是只有 `assets/`）：
 *   assets/  · 图片 205 张 + `audio/bgm.m4a`（流式音乐，**不在** sound.pack 里）
 *   sound.manifest.json / sound.pack  · 音频清单与音效包
 *   fonts/   · 正文圆体 + 两个标题字体（`gp.fonts.url()` 拼出来的路径）
 */
const ASSETS_OUT = path.join(OUT_DIR, 'assets')
fs.rmSync(ASSETS_OUT, { recursive: true, force: true })
fs.cpSync(path.join(ROOT, 'assets'), ASSETS_OUT, { recursive: true })
for (const f of ['sound.pack', 'sound.manifest.json']) {
  fs.copyFileSync(path.join(ROOT, f), path.join(OUT_DIR, f))
}
const FONTS_OUT = path.join(OUT_DIR, 'fonts')
fs.rmSync(FONTS_OUT, { recursive: true, force: true })
fs.cpSync(path.join(ROOT, 'fonts'), FONTS_OUT, { recursive: true })

const count = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).reduce(
    (n, d) => n + (d.isDirectory() ? count(path.join(dir, d.name)) : 1),
    0,
  )
console.log(`资源  dist-plugin/assets ${count(ASSETS_OUT)} 个 · fonts ${count(FONTS_OUT)} 个 · + sound.pack + sound.manifest.json`)

console.log('\n✓ 打包校验通过')
