#!/usr/bin/env node
/**
 * 把挖矿少女打成**单文件 ESM**（宿主用 blob: URL import）。
 *
 * ```bash
 * node scripts/build-plugin.mjs
 * ```
 *
 * ## 三个硬要求（缺一个宿主 loader 就拒）
 *
 *   1. **0 个裸模块说明符** —— blob: 模块没有 importmap 可查，`from "pixi.js"` 直接解析失败。
 *   2. **0 个动态 import** —— 打包器会把动态 import 拆成第二个 chunk，那是相对路径，
 *      blob: 下加载不到。
 *   3. **顶层 export `manifest` 和 `mount`** —— 宿主 `mod.default ?? mod`。
 *
 * ## 为什么借宿主的 vite
 *
 * 本机没有全局打包器，而 `kid-quest-farm-2d` 里已经装了 vite（rolldown 版）。
 * 直接用它的 JS API，不额外装依赖。`minify` 不能写 `'esbuild'`（宿主没装，
 * vite 8 已把它变成可选依赖），自带的是 oxc。
 *
 * ## 为什么要把 styles.css 打进包里
 *
 * 样式是**运行时才需要**的（`<style>` 注入）。原版走 `<link href="styles.css">`，
 * 插件里那条相对路径会以 blob: 为基准 ⇒ 404 ⇒ **HUD 完全没样式**（看起来像游戏坏了，
 * 而不是像少了个文件）。所以这里把 CSS 转成一个 JS 字符串模块内联进包：
 * 包自己就是完整的，多一个网络请求都没了，而且它受 bundle 的 sha256 保护。
 *
 * 代价：改 `styles.css` 必须重跑这个脚本。`src/styles-inline.js` 是**生成物**，
 * 不要手改（`.gitignore` 里有它）。
 */
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'
import crypto from 'node:crypto'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.dirname(HERE)
const HOST = path.resolve(ROOT, '..', '..', 'kid-quest-farm-2d')
const VITE_ENTRY = path.join(HOST, 'node_modules', 'vite', 'dist', 'node', 'index.js')

if (!fs.existsSync(VITE_ENTRY)) {
  console.error('找不到宿主那份 vite：', VITE_ENTRY)
  process.exit(2)
}

/* ---------------- ① 把 styles.css 变成字符串模块 ---------------- */

const CSS_SRC = path.join(ROOT, 'styles.css')
const CSS_MOD = path.join(ROOT, 'src', 'styles-inline.js')
const cssText = fs.readFileSync(CSS_SRC, 'utf8')
const cssHash = crypto.createHash('sha256').update(cssText).digest('hex').slice(0, 12)

fs.writeFileSync(
  CSS_MOD,
  '// ⚠️ 生成物 —— 由 scripts/build-plugin.mjs 从 styles.css 生成，不要手改。\n' +
    '// 内联进包是为了少一次网络请求，并且让样式受 bundle 的 sha256 保护（见 build-plugin.mjs 文件头）。\n' +
    `export default ${JSON.stringify(cssText)}\n`,
  'utf8',
)

/* ---------------- ② 样式作用域审计 ---------------- */

/*
 * `styles.css` 是**整页**游戏的样式（49 KB，全是 `.card` / `.btn` / `.num` / `button`
 * 这种通用名字）。宿主用 Tailwind v4，工具类在 `@layer utilities` 里，而**未分层**
 * 的样式胜过 `@layer` ⇒ 漏掉一个选择器，坏的是**宿主**（切走以后农场页的卡片全变样），
 * 而且浏览器不报错。
 *
 * 所以这里把 `buildCss()` 的输出逐条扫一遍：**每条规则的选择器都必须以 `#mng-root` 开头**。
 * 这是唯一能在打包期证明「不会污染宿主」的判据 —— 运行期的对照元素只能抽检。
 */
const ROOT_SEL = '#mng-root'   // ⚠️ 必须和 src/main.js 里 `root.id` 一致
const { buildCss } = await import(pathToFileURL(path.join(ROOT, 'src', 'scoped-css.js')).href)
const scopedCss = buildCss(cssText, { root: ROOT_SEL, assetUrl: (rel) => '/__asset/' + rel })

/** 按 `{}` 配对扫出所有规则（容器型 at-rule 递归进去，其余 at-rule 记成 at 规则） */
function collectRules(css, out = []) {
  let i = 0
  while (i < css.length) {
    const open = css.indexOf('{', i)
    if (open === -1) break
    const sel = css.slice(i, open).trim()
    let depth = 0
    let j = open
    for (; j < css.length; j++) {
      if (css[j] === '{') depth++
      else if (css[j] === '}' && --depth === 0) break
    }
    const body = css.slice(open + 1, j)
    if (/^@(media|supports|container|layer)\b/.test(sel)) collectRules(body, out)
    else out.push({ sel, at: sel.startsWith('@') })
    i = j + 1
  }
  return out
}

const rules = collectRules(scopedCss)
const leaked = []
for (const r of rules) {
  if (r.at) continue
  for (const one of r.sel.split(',')) {
    const s = one.trim()
    if (s && !s.startsWith(ROOT_SEL)) leaked.push(s.slice(0, 60))
  }
}
const kf = [...scopedCss.matchAll(/@keyframes\s+([A-Za-z_][\w-]*)/g)].map((m) => m[1])
const kfBad = kf.filter((n) => !n.startsWith('mng-'))
const rawUrl = (scopedCss.match(/url\(\s*['"]?assets\//g) ?? []).length

/* ---------------- ③ 打包 ---------------- */

const ENG = {
  sound: path.join(ROOT, 'runtime', 'sound-1.js'),
  pixi: path.join(ROOT, 'lib', 'pixi.min.js'),
}
for (const [k, p] of Object.entries(ENG)) {
  if (!fs.existsSync(p)) { console.error(`找不到引擎 ${k}：${p}`); process.exit(2) }
}

const { build } = await import(pathToFileURL(VITE_ENTRY).href)

const OUT_DIR = path.join(ROOT, 'dist-plugin')
const OUT_NAME = 'minergirl.plugin.mjs'

await build({
  configFile: false,
  root: ROOT,
  logLevel: 'warn',
  resolve: {
    alias: [
      // 源码里写的是 `@makeplay/sound`（独立网页靠 index.html 的 importmap 解析）。
      // 插件形态没有 importmap，所以在这里内联进包。
      { find: /^@makeplay\/sound$/, replacement: ENG.sound },
    ],
  },
  build: {
    target: 'es2022',
    minify: 'oxc',
    emptyOutDir: true,
    outDir: OUT_DIR,
    lib: { entry: path.join(ROOT, 'plugin.js'), formats: ['es'], fileName: () => OUT_NAME },
    rollupOptions: { output: { inlineDynamicImports: true, manualChunks: undefined } },
  },
})

/* ---------------- ④ 校验 ---------------- */

const outFile = path.join(OUT_DIR, OUT_NAME)
const code = fs.readFileSync(outFile, 'utf8')
const kb = (n) => (n / 1024).toFixed(1) + ' KB'

const bare = [...code.matchAll(/(?:^|[;\n}])\s*(?:import|export)[^;]*?from\s*["']([^"']+)["']/g)]
  .map((m) => m[1])
  .filter((s) => !/^[./]/.test(s) && !/^(blob:|data:|https?:)/.test(s))
const dyn = [...code.matchAll(/\bimport\s*\(\s*["']([^"']+)["']/g)].map((m) => m[1])
const hasMount = /export\s*\{[^}]*\bmount\b/.test(code) || /\bas mount\b/.test(code)
const hasManifest = /\bas manifest\b/.test(code) || /export\s*\{[^}]*\bmanifest\b/.test(code)
const hasPixi = /WebGLRenderer|Application/.test(code)
const hasSound = /musicStates|duckRules/.test(code)
// 内联样式：抽一个只可能来自 styles.css 的令牌
const hasCss = code.includes('--vermilion') && code.includes('seigaiha')

console.log('产物        :', path.relative(ROOT, outFile), kb(Buffer.byteLength(code)))
console.log('裸说明符    :', bare.length, bare.slice(0, 5))
console.log('动态 import :', dyn.length, dyn.slice(0, 5))
console.log('导出        : mount', hasMount, '· manifest', hasManifest)
console.log('引擎        : pixi', hasPixi ? '已内联' : '**没打进去**', '· sound', hasSound ? '已内联' : '**没打进去**')
console.log('样式        : 内联', hasCss ? `是（styles.css ${kb(Buffer.byteLength(cssText))} · ${cssHash}）` : '**没打进去**')
console.log('作用域      :', rules.length, '条规则 · 漏网', leaked.length, '· keyframes', kf.length, `（不带 mng- 前缀的 ${kfBad.length} 个）`, '· 没换绝对地址的 url', rawUrl)

const fail = []
if (bare.length) fail.push('还有裸模块说明符: ' + bare.join(', '))
if (dyn.length) fail.push('还有动态 import: ' + dyn.join(', '))
if (!hasMount || !hasManifest) fail.push('缺少 mount/manifest 导出')
if (!hasPixi) fail.push('看起来没把 pixi 打进去')
if (!hasSound) fail.push('看起来没把 @makeplay/sound 打进去')
if (!hasCss) fail.push('styles.css 没内联进包（HUD 会完全没样式）')
if (leaked.length) fail.push(`有 ${leaked.length} 条选择器没收进 ${ROOT_SEL}（会污染宿主）: ` + leaked.slice(0, 5).join(' | '))
if (kfBad.length) fail.push('@keyframes 名没加 mng- 前缀（和宿主撞名时动画会互相顶掉）: ' + kfBad.join(', '))
if (rawUrl) fail.push(`有 ${rawUrl} 处 url(assets/…) 没换成绝对地址（以宿主页面为基准 ⇒ 404）`)
if (fail.length) {
  console.error('\n=== 校验失败 ===')
  for (const f of fail) console.error(' -', f)
  process.exit(1)
}

/* ---------------- ⑤ 铺资源（给假宿主测试用） ---------------- */

// 站点根这几样要一起搬：`sound.manifest.json` 里的 `packs.main.url` 是裸的 `sound.pack`，
// 音乐变体是 `assets/audio/…`。样式已经内联，不用再搬。
const ASSETS_OUT = path.join(OUT_DIR, 'assets')
fs.rmSync(ASSETS_OUT, { recursive: true, force: true })
fs.cpSync(path.join(ROOT, 'assets'), ASSETS_OUT, { recursive: true })
fs.copyFileSync(path.join(ROOT, 'sound.pack'), path.join(OUT_DIR, 'sound.pack'))
fs.copyFileSync(path.join(ROOT, 'sound.manifest.json'), path.join(OUT_DIR, 'sound.manifest.json'))

const count = (dir) => fs.readdirSync(dir, { withFileTypes: true }).reduce((n, d) => n + (d.isDirectory() ? count(path.join(dir, d.name)) : 1), 0)
console.log('资源        : dist-plugin/assets ·', count(ASSETS_OUT), '个文件 · + sound.pack + sound.manifest.json')

console.log('\n=== 打包校验通过 ===\n')
