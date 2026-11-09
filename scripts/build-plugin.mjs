#!/usr/bin/env node
/**
 * 把「下落的2048」打成**单文件 ESM**（宿主用 `blob:` URL import）。
 *
 * 用法：`node scripts/build-plugin.mjs [--check]`
 *
 * ## 三个硬要求（缺一个宿主的 loader 就拒）
 *
 * 1. **0 个裸模块说明符** —— `blob:` 模块没有 importmap 可查
 * 2. **0 个动态 import** —— 打包器会把它拆成第二个 chunk，`blob:` 下加载不到
 * 3. **顶层 export `manifest` 和 `mount`** —— 宿主 `mod.default ?? mod`
 *
 * ## 为什么借用宿主那份 vite
 *
 * 本机没有全局打包器。宿主 `kid-quest-farm-online/node_modules/vite` 已经装了，
 * 直接用它的 JS API，不额外装依赖（和 `cloudfarm` 同一套做法）。
 *
 * ## ★ 这个脚本还兼一个「补丁守卫」
 *
 * `game.js` 是**原版压缩代码 + 我们的四个补丁**。补丁是字符串替换上去的，
 * 一旦有人重新从镜像里拷一份 `game.js` 过来，补丁会**静默消失** ——
 * 症状分别是：
 *
 * | 丢的补丁 | 症状 |
 * | --- | --- |
 * | `__fall2048Dead` | 切走 tab 后 rAF 还在跑（发热、掉帧，不报错） |
 * | `__fall2048Teardown` | 卸载不 dispose 音频/display（监听器越积越多） |
 * | `ie0` | 开局不扣积分（白玩，而且没人发现） |
 * | `__fall2048SoundManifest` | 音频清单按文档相对路径找 ⇒ 404，全程无声 |
 *
 * 所以这里**逐条 grep**，缺一条就 `exit 1`。这比事后查「为什么没声音」便宜得多。
 */
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.dirname(HERE)
/** 工程在 `task-games/fall2048`，宿主在仓库根下一层 —— 要退两级 */
const HOST = path.resolve(ROOT, '..', '..', 'kid-quest-farm-online')
const VITE_ENTRY = path.join(HOST, 'node_modules', 'vite', 'dist', 'node', 'index.js')

const checkOnly = process.argv.includes('--check')

if (!fs.existsSync(VITE_ENTRY)) {
  console.error('找不到宿主那份 vite：', VITE_ENTRY)
  process.exit(2)
}

/* ---------------- 0) 补丁守卫（先查源码，早失败） ---------------- */
const gameSrc = fs.readFileSync(path.join(ROOT, 'game.js'), 'utf8')
const PATCHES = [
  ['__fall2048Dead', '主循环闸（卸载后停 rAF）'],
  ['__fall2048Teardown', 'teardown（dispose 音频 / display）'],
  ['function ie0(', '开局扣分闸（ie → ie0）'],
  ['__fall2048SoundManifest', '音频清单绝对地址'],
  ['__fall2048Asset', '金币图标的绝对地址（原版是写死的相对路径）'],
]
const missing = PATCHES.filter(([needle]) => !gameSrc.includes(needle))
if (missing.length) {
  console.error('=== 补丁缺失（game.js 可能被原版覆盖了） ===')
  for (const [needle, why] of missing) console.error(` - 缺 ${needle}：${why}`)
  process.exit(1)
}

/* ---------------- 1) 打包 ---------------- */
const OUT_DIR = path.join(ROOT, 'dist-plugin')
const OUT_NAME = 'fall2048.plugin.mjs'

if (!checkOnly) {
  const { build } = await import(pathToFileURL(VITE_ENTRY).href)

  await build({
    configFile: false,
    root: ROOT,
    logLevel: 'warn',
    build: {
      target: 'es2022',
      // 宿主没装 esbuild（vite 8 已把它变成可选依赖），自带的是 oxc
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

  /* ---------------- 2) 资源 ---------------- */
  // `assetUrl('sound.manifest.json')` 会拼成 `<assetBase>sound.manifest.json`，
  // 而清单里的 `sound.pack` / `assets/audio/*.m4a` 都是**相对清单**解析的，
  // 所以三者必须保持原版的相对位置：清单在根、pack 在根、音乐在 assets/audio/。
  const copy = (rel) => {
    const src = path.join(ROOT, rel)
    const dst = path.join(OUT_DIR, rel)
    if (!fs.existsSync(src)) {
      console.error('资源缺失：', rel)
      process.exit(1)
    }
    fs.mkdirSync(path.dirname(dst), { recursive: true })
    fs.cpSync(src, dst, { recursive: true })
  }
  copy('assets')
  copy('sound.pack')
  copy('sound.manifest.json')
}

/* ---------------- 3) 校验 ---------------- */
const outFile = path.join(OUT_DIR, OUT_NAME)
if (!fs.existsSync(outFile)) {
  console.error('产物不存在：', outFile)
  process.exit(1)
}
const code = fs.readFileSync(outFile, 'utf8')
const kb = (n) => (n / 1024).toFixed(1) + ' KB'
const fail = []

// 1) 裸说明符
const bare = [...code.matchAll(/(?:^|[;\n}])\s*(?:import|export)[^;]*?from\s*["']([^"']+)["']/g)]
  .map((m) => m[1])
  .filter((s) => !/^[./]/.test(s) && !/^(blob:|data:|https?:)/.test(s))
if (bare.length) fail.push(`还有裸说明符：${[...new Set(bare)].join(', ')}`)

// 2) 动态 import
const dyn = [...code.matchAll(/\bimport\s*\(\s*["']([^"']+)["']/g)].map((m) => m[1])
if (dyn.length) fail.push(`还有动态 import：${[...new Set(dyn)].join(', ')}`)

// 3) 导出形状
if (!/\bmanifest\b/.test(code)) fail.push('产物里没有 manifest')
if (!/\bmount\b/.test(code)) fail.push('产物里没有 mount')

// 4) 绝对路径泄漏（会指向发布机上的目录）
if (/[A-Za-z]:\\\\|\/Users\/|\/home\//.test(code)) fail.push('产物里出现了绝对文件路径')

// 5) 原版残留：MakePlay 平台桥 / 水印
if (code.includes('makeplay.ai')) fail.push('产物里还有 makeplay.ai 的外部地址')

// 6) 资源清单必须和磁盘一致（`assetUrl()` 拼错名字时这里是唯一能提前发现的地方）
for (const rel of ['sound.pack', 'sound.manifest.json', 'assets/audio/bgm-neon.m4a']) {
  if (!fs.existsSync(path.join(OUT_DIR, rel))) fail.push(`产物缺资源：${rel}`)
}

/* ---------------- 4) 报告 ---------------- */
const outBytes = fs.statSync(outFile).size
const assetBytes = (function walk(d) {
  let n = 0
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name)
    n += e.isDirectory() ? walk(p) : fs.statSync(p).size
  }
  return n
})(OUT_DIR)

console.log('\n=== 下落的2048 · 插件包 ===')
console.log('入口 :', path.relative(ROOT, outFile), '·', kb(outBytes))
console.log('资源 :', 'dist-plugin/', '· 合计', kb(assetBytes))
console.log('裸说明符 :', bare.length)
console.log('动态 import :', dyn.length)
if (fail.length) {
  console.error('\n=== 校验失败 ===')
  for (const f of fail) console.error(' -', f)
  process.exit(1)
}
console.log('=== 打包校验通过 ===')
