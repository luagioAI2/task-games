#!/usr/bin/env node
/**
 * 把「犬独」打成**单文件 ESM**（宿主用 `blob:` URL import）。
 *
 * 用法：`node scripts/build-plugin.mjs [--check]`
 *
 * ## 三个硬要求（缺一个宿主的 loader 就拒）
 *
 * 1. **0 个裸模块说明符** —— `blob:` 模块没有 importmap 可查
 * 2. **0 个动态 import** —— 打包器会把它拆成第二个 chunk，`blob:` 下加载不到
 * 3. **顶层 export `manifest` 和 `mount`** —— 宿主取 `mod.default ?? mod`
 *
 * ## 为什么借用宿主那份 vite
 *
 * 本机没有全局打包器。宿主 `kid-quest-farm-online/node_modules/vite` 已经装了，
 * 直接用它的 JS API，不额外装依赖（和 `cloudfarm` / `fall2048` 同一套做法）。
 *
 * ## ★ 这个脚本兼一个「补丁守卫」
 *
 * `game.js` 是**原版压缩代码 + `scripts/patch-game.mjs` 打的补丁**。
 * 一旦有人重新从镜像拷一份 `game.js` 过来，补丁会**静默消失** ——
 * 症状分别是：
 *
 * | 丢的补丁 | 症状 |
 * | --- | --- |
 * | `export async function boot(` | 模块顶层就读 `gp`，`window.gp` 还没装 ⇒ 整屏空白 |
 * | `__addW(` | 每次挂载留 8 个 window 监听（切 tab 十次积一堆） |
 * | `__inudokuTeardown` | 卸载不 dispose 音频 / Pixi（WebGL context 泄漏） |
 * | `__inudokuCharge` | 开局不扣积分（白玩，而且没人发现） |
 * | `__inudokuAsset` | 所有图按文档相对路径找 ⇒ 全 404，而且不报错 |
 * | `function __grant(` | 8 只狗 / 4 首 BGM 永远解锁不了（商店是空的） |
 *
 * 所以这里**逐条 grep**，缺一条就 `exit 1`。
 */
import { fileURLToPath, pathToFileURL } from 'node:url'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import fs from 'node:fs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.dirname(HERE)
/** 工程在 `task-games/inudoku`，宿主在仓库根下一层 —— 要退两级 */
const HOST = path.resolve(ROOT, '..', '..', 'kid-quest-farm-online')
const VITE_ENTRY = path.join(HOST, 'node_modules', 'vite', 'dist', 'node', 'index.js')

const checkOnly = process.argv.includes('--check')

if (!fs.existsSync(VITE_ENTRY)) {
  console.error('找不到宿主那份 vite：', VITE_ENTRY)
  process.exit(2)
}

/* ---------------- 0) 补丁守卫（先查源码，早失败） ---------------- */
const gameSrc = fs.readFileSync(path.join(ROOT, 'game.js'), 'utf8')
const uiSrc = fs.readFileSync(path.join(ROOT, 'ui.js'), 'utf8')
const PATCHES = [
  ['export async function boot(', gameSrc, 'boot() 包裹（先装 gp 再启动）'],
  ['__addW(', gameSrc, 'window 监听改可回收'],
  ['__inudokuTeardown', gameSrc, 'teardown（dispose 音频 / 特效 / Pixi）'],
  ['__inudokuCharge', gameSrc, '开局扣分闸'],
  ['function __grant(', gameSrc, '通关解锁皮肤 / BGM'],
  ['window.__inudokuRoot', gameSrc, '根节点外部传入'],
  ['window.__inudokuAsset', gameSrc, '资源绝对地址'],
  ['window.__inudokuRoot', uiSrc, 'ui.js 的 UI 层挂到外部根节点'],
  ['window.__inudokuAsset', uiSrc, 'ui.js 的纸纹 / 心形 / 成就图标绝对地址'],
]
const miss = PATCHES.filter(([needle, src]) => !src.includes(needle))
if (miss.length) {
  console.error('=== 补丁缺失（game.js / ui.js 可能被原版覆盖了） ===')
  for (const [needle, , why] of miss) console.error(` - 缺 ${needle}：${why}`)
  console.error('\n  修：node scripts/patch-game.mjs')
  process.exit(1)
}

/* ---------------- 1) 打包 ---------------- */
const OUT_DIR = path.join(ROOT, 'dist-plugin')
const OUT_NAME = 'inudoku.plugin.mjs'

if (!checkOnly) {
  const { build } = await import(pathToFileURL(VITE_ENTRY).href)

  await build({
    configFile: false,
    root: ROOT,
    logLevel: 'warn',
    /**
     * 原版靠 `index.html` 的 importmap 把裸说明符映射到本地文件。
     * 打包器不认 importmap，这里要把同一张表再说一遍 —— 而且**必须指到本地文件**
     * （指向 CDN 就等于把游戏的一半挂在别人服务器上）。
     */
    resolve: {
      alias: [
        { find: /^pixi\.js$/, replacement: path.join(ROOT, 'engines/pixi.min.mjs') },
        { find: '@makeplay/display', replacement: path.join(ROOT, 'runtime/display-1.js') },
        { find: '@makeplay/fx', replacement: path.join(ROOT, 'runtime/makeplay-fx/game.js') },
        { find: '@makeplay/sound', replacement: path.join(ROOT, 'runtime/sound-1.js') },
      ],
    },
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
  /* ★ 先证明 `assets/manifest.json` 没过期：清单过期**不会在运行时报错**，
   * 只会在宿主/发布方逐个校验时报「哈希对不上」，而人第一反应会去查打包和网络。 */
  {
    const r = spawnSync(process.execPath, [path.join(HERE, 'make-asset-manifest.mjs'), '--check'], {
      stdio: 'inherit',
    })
    if (r.status !== 0) {
      console.error('\n✗ assets/manifest.json 过期（或还没生成）')
      console.error('  修：node scripts/make-asset-manifest.mjs')
      process.exit(1)
    }
  }

  // `assetUrl('sound.manifest.json')` 会拼成 `<assetBase>sound.manifest.json`，
  // 而清单里的 `sound.pack` 是**相对清单**解析的，所以两者必须保持原版的相对位置。
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

// 5) 原版残留：外部 CDN / 平台桥
if (code.includes('makeplay.ai')) fail.push('产物里还有 makeplay.ai 的外部地址')

// 6) 资源必须真的在 dist-plugin 里
for (const rel of ['sound.pack', 'sound.manifest.json', 'assets/paper.webp', 'assets/dogs/shiba.webp']) {
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

console.log('\n=== 犬独 · 插件包 ===')
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
