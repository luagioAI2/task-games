#!/usr/bin/env node
/**
 * gen-styles.mjs —— 把七份**整页样式表**收成一份 `#dd-app` 作用域内的 CSS，
 * 生成 `src/styles.gen.js`（一个纯字符串模块，打进插件包）。
 *
 * ```bash
 * node scripts/gen-styles.mjs            # 生成
 * node scripts/gen-styles.mjs --check    # 只校验 src/styles.gen.js 是不是最新的
 * ```
 *
 * ## 为什么在**构建期**做，而不是运行时 `fetch('style.css')`
 *
 * 1. 插件是单文件 ESM（宿主用 `blob:` import）。运行时 `fetch` 七个文件 =
 *    七次可能 404 的请求，而漏一个的症状是**界面隐形**（CSS 一条都不命中），
 *    不是报错。
 * 2. 作用域化是纯字符串变换，构建期做一次，运行时只剩 `style.textContent = SCOPED_CSS`。
 * 3. `styles.gen.js` 是**生成物**，进 git：这样 `npm run lint` / 单测 / 打包
 *    都不依赖「先跑过哪个脚本」。
 *
 * ## 七步替换（顺序不能换）
 *
 * 这份 CSS 是按**整页**写的，`#app` 出现 400 多次、`body[...]` 出现 40 多次。
 * 光靠 `scopeCss()` 补前缀是不够的 —— 它会把 `body[data-portrait] #app .x`
 * 变成 `#dd-app[data-portrait] #dd-app .x`（要求嵌套的 `#dd-app`，永远不匹配）。
 * 所以先把「根元素引用」统一改写成 `#dd-app` **本身**，再让 `scopeCss` 收拾剩下的。
 *
 * | # | 从 | 到 | 为什么 |
 * | --- | --- | --- | --- |
 * | 1 | `html[lang=en] #app` | `#dd-app[lang=en]` | `lang` 现在写在挂载根上（`i18n.js` 改过） |
 * | 2 | `html,body,#app` | `#dd-app` | 整页那三条 reset 合成一条 |
 * | 3 | `body[…] #app` | `#dd-app[…]` | 状态类（portrait / compact / short）现在写在挂载根上 |
 * | 4 | `body:has(…) #app` | `#dd-app:has(…)` | 同上 |
 * | 5 | `#app` | `#dd-app` | 剩下的全部 |
 * | 6 | `body[…]` / `body:has(…)` / `body{` / `:root{` / 裸 `html` | `#dd-app…` | 兜底 |
 * | 7 | `position:fixed` | `position:absolute` | ★ 见下 |
 *
 * ## 为什么 `position:fixed` 必须改掉
 *
 * 原版是整页应用，`#world` / `#race-screen` / `#toast` / `#language-menu` /
 * `#world-board-overlay` / `#archive-status` / 竖屏的 `.launch-area` 一共 7 处
 * `position:fixed`，锚的是**视口**。插件里它们是 `#dd-app` 的后代，而
 * `#dd-app` 只占宿主的游戏内容区 —— `fixed` 会让赛道画布和结算弹层**盖住宿主的
 * 顶栏与底栏**（`z-index` 再高也没用，它根本不在容器那棵树里）。
 *
 * 改成 `absolute` + `#dd-app{position:absolute;inset:0;isolation:isolate}` 之后，
 * 它们锚的是挂载根，`overflow:hidden` 也把它们夹在容器里。
 *
 * ⚠️ 副作用：`positionWorld()` 里 `#world` 的坐标原来是**视口坐标**
 *   （`getBoundingClientRect()` 直接写进 `left/top`），改 absolute 之后必须
 *   减掉挂载根的 `left/top`。那处改动在 `scripts/_patch.mjs` 里，不在这个文件。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { scopeCss } from '../scope-css.js'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.dirname(HERE)
const OUT = path.join(ROOT, 'src', 'styles.gen.js')
const CHECK = process.argv.includes('--check')

/** **按原版的注入顺序**拼。后加载的赢，顺序变了 `tiny-layout` 的覆盖就失效。 */
const FILES = [
  'style.css',
  'responsive.css',
  'world-board.css',
  'async.css',
  'studio-update.css',
  'resolution.css',
  'tiny-layout.css',
]

const ROOT_SEL = '#dd-app'

/**
 * 把**单个选择器**里的「整页根元素」换成挂载根。
 *
 * ⚠️ 为什么不能拿一条正则从头到尾 `replace` 整份 CSS：
 *   这份 CSS 里有 `body[data-compact=true][data-studio-tab=entry][data-tutorial=true] #app .mode-copy`
 *   这种**连写三个属性**的选择器。`/body(\[[^\]]*\])/` 只吃掉第一个 `]`，
 *   剩下两个属性留在原地、后面那个 `#app` 再被换成 `#dd-app` ⇒
 *   变成 `#dd-app[data-compact=true][data-studio-tab=…] #dd-app .mode-copy` ——
 *   **要求嵌套的 `#dd-app`，永远不匹配**，于是手机上的紧凑布局整套失效。
 *   2026-10-28 实测踩过：390×844 下三栏挤成 `35px 35px 280px`，零报错。
 *
 * 所以按「选择器」为单位改，并且一次把连续属性组吃干净。
 */
function scopeSelector(raw) {
  let s = raw.trim()
  if (!s) return ''

  // `html[lang=en] #app h1` / `html[lang="en"] #app h1` → `#dd-app[lang=en] h1`
  s = s.replace(/^html\[lang=["']?en["']?\]\s*#app\b/, `${ROOT_SEL}[lang=en]`)

  // `body` 开头的：连写属性 + `:has(...)`（允许一层括号嵌套，够用）
  const bodyHead = s.match(/^body((?:\[[^\]]*\]|:has\((?:[^()]|\([^()]*\))*\))*)\s*(#app\b)?/)
  if (bodyHead) {
    s = `${ROOT_SEL}${bodyHead[1]}${s.slice(bodyHead[0].length)}`
  } else if (/^(:root|html)\b/.test(s)) {
    s = `${ROOT_SEL}${s.replace(/^(:root|html)\b/, '')}`
  }

  // 剩下的裸 `#app`（`#app .topbar` / `.x #app` 之类）
  s = s.replace(/#app\b/g, ROOT_SEL)
  return s
}

/** 逐条规则改写选择器（`@media` 递归进去；`@keyframes` 等原样保留）。 */
function rewriteRoot(css) {
  let out = ''
  let i = 0
  while (i < css.length) {
    const open = css.indexOf('{', i)
    if (open === -1) {
      out += css.slice(i)
      break
    }
    const prelude = css.slice(i, open)
    let depth = 0
    let j = open
    for (; j < css.length; j++) {
      if (css[j] === '{') depth++
      else if (css[j] === '}' && --depth === 0) break
    }
    const body = css.slice(open + 1, j)
    const sel = prelude.trim()

    if (/^@(media|supports|container|layer)\b/.test(sel)) {
      out += prelude + '{' + rewriteRoot(body) + '}'
    } else if (sel.startsWith('@')) {
      out += prelude + '{' + body + '}'
    } else {
      const sels = splitSelectors(sel)
        .map(scopeSelector)
        .filter(Boolean)
      // `html,body,#app` 拆完会得到三个一样的 `#dd-app` —— 去重
      const uniq = [...new Set(sels)]
      out += uniq.join(',') + '{' + body + '}'
    }
    i = j + 1
  }
  return out
}

/** 只在括号/方括号外的逗号处切 —— `:is(a, b)` 里的逗号不算。 */
function splitSelectors(text) {
  const parts = []
  let depth = 0
  let cur = ''
  for (const ch of text) {
    if (ch === '(' || ch === '[') depth++
    else if (ch === ')' || ch === ']') depth = Math.max(0, depth - 1)
    if (ch === ',' && depth === 0) {
      parts.push(cur)
      cur = ''
    } else cur += ch
  }
  parts.push(cur)
  return parts
}

/**
 * 逐条规则校验选择器。
 *
 * 只看 `{}` 之外的**前导文本**（`@media` 里的规则也递归看），
 * 因为声明块里的 `body` 可能是合法的值（本作没有，但别假设）。
 */
function auditSelectors(css) {
  const bad = []
  let i = 0
  const walk = (src) => {
    let k = 0
    while (k < src.length) {
      const open = src.indexOf('{', k)
      if (open === -1) break
      const prelude = src.slice(k, open).trim()
      let depth = 0
      let j = open
      for (; j < src.length; j++) {
        if (src[j] === '{') depth++
        else if (src[j] === '}' && --depth === 0) break
      }
      const body = src.slice(open + 1, j)
      if (/^@(media|supports|container|layer)\b/.test(prelude)) walk(body)
      else if (!prelude.startsWith('@')) {
        for (const sel of prelude.split(',')) {
          const s = sel.trim()
          if (!s) continue
          if (!s.startsWith(ROOT_SEL)) bad.push(`没有前缀: ${s.slice(0, 80)}`)
          // `#app` 只剩 `#dd-app` 里那一段；用负向断言排除
          if (/(?<!dd-)#app/.test(s)) bad.push(`还有裸 #app: ${s.slice(0, 80)}`)
          // ⚠️ 不能写 `\bbody\b`：`-` 是非单词字符 ⇒ `\b` 在 `.result-body` 里也成立。
          //    只认「作为独立选择器记号出现」的 body/html（前面是开头或空格/,/>/+/~）。
          if (/(^|[\s,>+~])(body|html)\b/.test(s) || /:root/.test(s)) {
            bad.push(`还有 html/body: ${s.slice(0, 80)}`)
          }
        }
      }
      k = j + 1
    }
  }
  walk(css)
  if (/position:\s*fixed/.test(css)) bad.push('还有 position:fixed（会盖住宿主顶栏底栏）')
  // ★ 双前缀：`#dd-app #dd-app[…]` 要求嵌套的挂载根，永远不匹配 ⇒ 整套覆盖静默失效
  if (/#dd-app\s+#dd-app/.test(css)) bad.push('有双重前缀 `#dd-app #dd-app`（那套规则永远不匹配）')
  return bad
}

const parts = []
let rawTotal = 0
for (const f of FILES) {
  const p = path.join(ROOT, f)
  if (!fs.existsSync(p)) {
    console.error('缺样式文件：', p)
    process.exit(2)
  }
  /*
   * ★ 先剥注释再改写选择器。不剥的话注释会跟着前导文本一起被当成选择器：
   *   `/* 磁贴从 4 个减到 3 个 *​/ .tile{}` ⇒ 改写时 `^body` / `^#app` 全匹配不上
   *   ⇒ 拼出来是 `#dd-app /* … *​/ body[x] #dd-app .tile`，整条规则作废，
   *   而浏览器**不报错**（未知选择器 = 静默不匹配）。
   */
  const text = fs.readFileSync(p, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
  rawTotal += Buffer.byteLength(text)
  parts.push(rewriteRoot(text))
}

const merged = parts
  .join('\n')
  // 7 处 fixed 全改成 absolute：锚点是挂载根，不再是视口
  .replace(/position:fixed/g, 'position:absolute')
  // `url('./assets/…')` 原来是相对**样式表**的；内联进 `<style>` 之后会相对**文档**
  // ⇒ 插件里打到宿主根（404，图标不显示且零报错）。留占位，运行时用 `AB` 换掉。
  .replace(/url\('\.\//g, "url('__AB__")

const scoped = scopeCss(merged, ROOT_SEL)

const bad = auditSelectors(scoped)
if (bad.length) {
  console.error('=== 作用域化没做干净 ===')
  for (const b of bad.slice(0, 30)) console.error('  -', b)
  if (bad.length > 30) console.error(`  … 还有 ${bad.length - 30} 条`)
  process.exit(1)
}

const bytes = Buffer.byteLength(scoped)
const header = `/**
 * styles.gen.js —— **生成物，别手改**。
 *
 * 由 \`node scripts/gen-styles.mjs\` 从七份整页样式表生成：
 * ${FILES.map((f) => ' *   - ' + f).join('\n')}
 *
 * 原始 ${(rawTotal / 1024).toFixed(1)} KB → 作用域化后 ${(bytes / 1024).toFixed(1)} KB，
 * 全部规则收在 \`#dd-app\` 之下（宿主是 React + Tailwind，未分层的样式会盖掉它的工具类）。
 * 校验：每条选择器都带前缀、没有裸 \`#app\` / \`body\` / \`html\` / \`:root\`、
 * 没有 \`position:fixed\`。
 */
`
const file = `${header}export const SCOPED_CSS = ${JSON.stringify(scoped)}\n`

if (CHECK) {
  if (!fs.existsSync(OUT)) {
    console.error('src/styles.gen.js 不存在，先跑 node scripts/gen-styles.mjs')
    process.exit(1)
  }
  if (fs.readFileSync(OUT, 'utf8') !== file) {
    console.error('src/styles.gen.js 和源样式不一致 —— 重跑 node scripts/gen-styles.mjs')
    process.exit(1)
  }
  console.log(`styles.gen.js 是最新的（${(bytes / 1024).toFixed(1)} KB）`)
  process.exit(0)
}

fs.writeFileSync(OUT, file)
console.log(`样式  ${FILES.length} 份 · 原始 ${(rawTotal / 1024).toFixed(1)} KB → 作用域化 ${(bytes / 1024).toFixed(1)} KB`)
console.log(`输出  src/styles.gen.js（${(Buffer.byteLength(file) / 1024).toFixed(1)} KB）`)
console.log('校验  ✓ 每条选择器都带 #dd-app 前缀 · 无 body/html/:root · 无 position:fixed')
