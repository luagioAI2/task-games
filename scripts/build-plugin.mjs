#!/usr/bin/env node
/**
 * 把轮班守卫打成**单文件 ESM**（宿主用 blob: URL import）。
 *
 * 三个硬要求（缺一个宿主 loader 就拒）：
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
 * ## 四个引擎都要 alias
 *
 * 源码里写的是 `import ... from 'pixi.js'` / `'@makeplay/fx'` / `'@makeplay/sound'`
 * / `'@makeplay/display'`（独立网页靠 `index.html` 的 importmap 解析）。
 * 插件形态没有 importmap，所以必须在这里**内联**进包 —— 用正则 alias，
 * 字符串 alias 是前缀匹配（`pixi.js` 会把 `pixi.js/x` 一起吃掉，反过来写死就漏）。
 *
 * ★ `@makeplay/fx` 一个人 3.2 MB（里面 2.9 MB 是内嵌的粒子纹理 base64）。
 *   这是这一款体积的大头，**不能省**：v.play() 被调了 27 次（命中/爆炸/金币）。
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
const OUT_NAME = 'guardshift.plugin.mjs'

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
const hasPixi = /WebGLRenderer|Application/.test(code)
const hasFx = /referenceSpan|post\.configure/.test(code)
const hasSound = /musicStates|duckRules/.test(code)
const hasDisplay = /mpRotateHint|PHONE_MAX_PIXEL_RATIO|effectiveMaxPixelRatio/.test(code)

// 5) 游戏本体（`Cell, Not Today` 那种特征串找不到就用「出阵」+ 关卡表）
const hasGame = /出阵|防卫关卡/.test(code)
/*
 * 6) CSS 定位改造。
 * ★ 不能静态断言「已经收进 .gs」—— `scopeCss(css, ".gs")` 是**运行时**拼的，
 *   打包产物里只有 `scopeCss` 这个函数和原始 CSS 串。静态能查的是
 *   「`.ui` 不再是 fixed」；作用域真的生效由 e2e 验（宿主切走以后农场页没变样）。
 */
const hasAbs = /\.ui\{position:absolute/.test(code)
const stillFixed = /\.ui\{position:fixed/.test(code)

console.log('产物        :', path.relative(ROOT, outFile), kb(Buffer.byteLength(code)))
console.log('裸说明符    :', bare.length, bare.slice(0, 5))
console.log('动态 import :', dyn.length, dyn.slice(0, 5))
console.log('导出        : mount', hasMount, '· manifest', hasManifest)
console.log(
  '引擎        : pixi', hasPixi ? '已内联' : '**没打进去**',
  '· fx', hasFx ? '已内联' : '**没打进去**',
  '· sound', hasSound ? '已内联' : '**没打进去**',
  '· display', hasDisplay ? '已内联' : '**没打进去**',
)
console.log('游戏本体    :', hasGame ? '已内联' : '**没打进去**')
console.log('CSS 定位    :', hasAbs && !stillFixed ? '已改 absolute' : '**还是 fixed**')

const fail = []
if (bare.length) fail.push('还有裸模块说明符: ' + bare.join(', '))
if (dyn.length) fail.push('还有动态 import: ' + dyn.join(', '))
if (!hasMount || !hasManifest) fail.push('缺少 mount/manifest 导出')
if (!hasPixi) fail.push('看起来没把 pixi.js 打进去')
if (!hasFx) fail.push('看起来没把 @makeplay/fx 打进去')
if (!hasSound) fail.push('看起来没把 @makeplay/sound 打进去')
if (!hasDisplay) fail.push('看起来没把 @makeplay/display 打进去')
if (!hasGame) fail.push('看起来没把游戏本体打进去')
if (!hasAbs || stillFixed) fail.push('CSS 的 .ui 还是 position:fixed（会按视口铺，盖住宿主）')

if (fail.length) {
  console.error('\n=== 校验失败 ===')
  for (const f of fail) console.error(' -', f)
  process.exit(1)
}

/* ---------------- 资源 ----------------
 *
 * ⚠️ 这是**测试用的拷贝**，不是发布路径。发布走 `scripts/install-to-host.mjs`。
 *
 * ★★ 站点根这几样必须一起搬：`sound.manifest.json` 里的 `packs.main.url`
 *   就是裸的 `sound.pack`，音乐变体是裸的 `assets/music-battle.m4a`。
 *   假宿主如果把 `dist-plugin/` 当站点根，缺了根文件会报「is not valid JSON」。
 */
const ASSETS_OUT = path.join(OUT_DIR, 'assets')
fs.rmSync(ASSETS_OUT, { recursive: true, force: true })
fs.cpSync(path.join(ROOT, 'assets'), ASSETS_OUT, { recursive: true })
fs.copyFileSync(path.join(ROOT, 'sound.pack'), path.join(OUT_DIR, 'sound.pack'))
fs.copyFileSync(path.join(ROOT, 'sound.manifest.json'), path.join(OUT_DIR, 'sound.manifest.json'))

const count = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).reduce(
    (n, d) => n + (d.isDirectory() ? count(path.join(dir, d.name)) : 1),
    0,
  )
const size = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).reduce((n, d) => {
    const p = path.join(dir, d.name)
    return n + (d.isDirectory() ? size(p) : fs.statSync(p).size)
  }, 0)
console.log(
  '资源        : dist-plugin/assets ·',
  count(ASSETS_OUT),
  '个文件 ·',
  kb(size(ASSETS_OUT)),
  '· + sound.pack + sound.manifest.json',
)

console.log('\n=== 打包校验通过 ===')
