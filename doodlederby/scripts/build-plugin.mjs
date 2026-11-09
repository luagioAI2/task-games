#!/usr/bin/env node
/**
 * 把画马赛跑打成**单文件 ESM**（宿主用 blob: URL import）。
 *
 * 三个硬要求（缺一个宿主 loader 就拒）：
 *
 *   1. **0 个裸模块说明符** —— blob: 模块没有 importmap 可查，
 *      `from "three"` 直接解析失败。
 *   2. **0 个动态 import** —— 打包器会把动态 import 拆成第二个 chunk，
 *      那是相对路径，blob: 下加载不到。
 *   3. **顶层 export `manifest` 和 `mount`** —— 宿主 `mod.default ?? mod`。
 *
 * 为什么借用宿主那份 vite：本机没有全局打包器，而 kid-quest-farm-2d 里
 * 已经装了 vite（rolldown 版）。直接用它的 JS API，不额外装依赖。
 *
 * ## 三个引擎都要 alias
 *
 * 源码里写的是 `import * as THREE from 'three'` / `'@makeplay/fx'` / `'@makeplay/sound'`
 * （独立网页靠 `index.html` 的 importmap 解析）。插件形态没有 importmap，
 * 所以必须在这里**内联**进包 —— 用正则 alias，字符串 alias 是前缀匹配
 * （`three` 会把 `three/addons` 一起吃掉，反过来写死就漏）。
 *
 * ★ `src/scene.js` 里有一句 `await import('@makeplay/fx')` —— **动态** import。
 *   靠 `inlineDynamicImports: true` 折成静态引用；下面第 2 条校验会确认它真的没了。
 *
 * 用法：CODEBUDDY_SAFE_DELETE_ENABLED=0 node scripts/build-plugin.mjs
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
  three: path.join(ROOT, 'engines', 'three.module.js'),
  fx: path.join(ROOT, 'runtime', 'makeplay-fx', 'game.js'),
  sound: path.join(ROOT, 'runtime', 'sound-1.js'),
}
for (const [k, p] of Object.entries(ENG)) {
  if (!fs.existsSync(p)) {
    console.error(`找不到引擎 ${k}：${p}`)
    process.exit(2)
  }
}

const { build } = await import(pathToFileURL(VITE_ENTRY).href)

const OUT_DIR = path.join(ROOT, 'dist-plugin')
const OUT_NAME = 'doodlederby.plugin.mjs'

await build({
  configFile: false,
  root: ROOT,
  logLevel: 'warn',
  resolve: {
    alias: [
      { find: /^three$/, replacement: ENG.three },
      { find: /^@makeplay\/fx$/, replacement: ENG.fx },
      { find: /^@makeplay\/sound$/, replacement: ENG.sound },
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
const hasThree = /WebGLRenderer|SRGBColorSpace/.test(code)
const hasFx = /createThreeFx/.test(code)
const hasSound = /loadSoundSystem|musicStates/.test(code)

// 5) 游戏本体（中文标题 / 玩法提示）
const hasGame = /画马赛跑|送它去比赛|随手画匹马/.test(code)

// 6) 样式：7 份 CSS 必须已经收进 `#dd-app`，而且**不能**还有整页的 `:root{font-family:"Segoe UI"`
const hasScopedCss = code.includes('#dd-app')
const hasUnscopedCss = /:root\{font-family:"Segoe UI"/.test(code)

// 7) 联网面必须已经拆掉
const hasCloudSave = /latestSync\s*=\s*gp|putLatest\(JSON\.stringify\(snapshot/.test(code)
/*
 * 只认 `derby-ready!` 这个**协议串**（`archive-client.js` 里服务端握手用的）。
 * ⚠️ 别写 `archiveConnecting` —— 那是 i18n 的**文案 key**，永远在包里，
 *    搜它等于「这条校验永远为真」（hoopsneak 的 `orientation:"landscape"` 同款坑）。
 */
const hasRoom = /derby-ready!/.test(code)

// 8) 收费点接上了（`chargePlay` 被调用过，且不是只声明）
const hasCharge = /chargePlay/.test(code) && /spendPoints/.test(code)

// 9) 存档走 host.storage（不是 gp.player.saves）
const hasHostStorage = /storage\.set/.test(code) && /storage\.get/.test(code)

console.log('产物        :', path.relative(ROOT, outFile), kb(Buffer.byteLength(code)))
console.log('裸说明符    :', bare.length, bare.slice(0, 5))
console.log('动态 import :', dyn.length, dyn.slice(0, 5))
console.log('导出        : mount', hasMount, '· manifest', hasManifest)
console.log(
  '引擎        : three', hasThree ? '已内联' : '**没打进去**',
  '· fx', hasFx ? '已内联' : '**没打进去**',
  '· sound', hasSound ? '已内联' : '**没打进去**',
)
console.log('游戏本体    :', hasGame ? '已内联' : '**没打进去**')
console.log('样式        :', hasScopedCss ? '#dd-app 作用域已内联' : '**没有作用域样式**', hasUnscopedCss ? '· **还有整页 :root**' : '')
console.log('联网面      : 云存档', hasCloudSave ? '**还在**' : '已拆', '· 房间', hasRoom ? '**还在**' : '已拆')
console.log('收费 / 存档 : chargePlay', hasCharge ? '已接' : '**没接**', '· host.storage', hasHostStorage ? '已接' : '**没接**')

const fail = []
if (bare.length) fail.push('还有裸模块说明符: ' + bare.join(', '))
if (dyn.length) fail.push('还有动态 import: ' + dyn.join(', '))
if (!hasMount || !hasManifest) fail.push('缺少 mount/manifest 导出')
if (!hasThree) fail.push('看起来没把 three 打进去')
if (!hasFx) fail.push('看起来没把 @makeplay/fx 打进去')
if (!hasSound) fail.push('看起来没把 @makeplay/sound 打进去')
if (!hasGame) fail.push('看起来没把游戏本体打进去')
if (!hasScopedCss) fail.push('样式没有收进 #dd-app（会污染宿主整页）')
if (hasUnscopedCss) fail.push('样式里还有整页 `:root{font-family:"Segoe UI"}`（会改宿主字体）')
if (hasCloudSave) fail.push('云存档没拆干净（还在用 gp.player.saves）')
if (hasRoom) fail.push('房间/录像库没拆干净（还有 derby-ready! 协议串）')
if (!hasCharge) fail.push('收费点没接上（chargePlay / spendPoints 不在包里）')
if (!hasHostStorage) fail.push('存档没接 host.storage')

if (fail.length) {
  console.error('\n=== 校验失败 ===')
  for (const f of fail) console.error(' -', f)
  process.exit(1)
}

/* ---------------- 资源 ----------------
 *
 * ⚠️ 这是**测试用的拷贝**，不是发布路径。发布走 `scripts/install-to-host.mjs`。
 *
 * ★★ 包根这几样必须一起搬：`sound.manifest.json` 里的 `packs.main.url` 就是裸的
 *    `sound.pack`，音乐变体是裸的 `assets/audio/doodle-percussion.m4a`。
 *    假宿主如果把 `dist-plugin/` 当站点根，缺了根文件会报
 *    「is not valid JSON」（音频清单）—— 看着完全不像缺文件。
 *
 * 本作**没有贴图**（马、赛道、树全是 three 几何体），`assets/` 里只有
 * 3 张 Kenney 图标 + 1 条 m4a。
 */
const ASSETS_OUT = path.join(OUT_DIR, 'assets')
fs.rmSync(ASSETS_OUT, { recursive: true, force: true })
fs.cpSync(path.join(ROOT, 'assets'), ASSETS_OUT, { recursive: true })
for (const f of ['sound.pack', 'sound.manifest.json']) {
  fs.copyFileSync(path.join(ROOT, f), path.join(OUT_DIR, f))
}

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
