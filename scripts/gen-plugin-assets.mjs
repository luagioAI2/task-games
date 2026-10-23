/**
 * 把 `index.html` 的 `<body>` 和 `src/style.css` 生成成插件能用的字符串模块。
 *
 * ```bash
 * node scripts/gen-plugin-assets.mjs          # 重新生成
 * node scripts/gen-plugin-assets.mjs --check  # 只校验有没有过期（CI / 验收用）
 * ```
 *
 * ## 为什么必须生成，而不是手抄一份
 *
 * 插件跑在宿主的 **blob: 模块**里。那个模块里没有文档路径可言：
 *
 *   · `fetch('index.html')` —— 相对 `blob:` 解析，必然 404；
 *   · `import './style.css'` —— 打包器会把它拆成**第二个文件**，
 *     而宿主只拿到一个 blob URL，第二个文件它根本不知道在哪。
 *
 * 所以只有一条路：**把 HTML 和 CSS 变成字符串常量，跟着 JS 一起进同一个包**。
 *
 * 而手抄一份的下场是**两份源码慢慢走散**：改 `index.html` 忘了改 `html.ts`，
 * 独立版和插件版看起来是两个游戏，而**两边各自的测试都是绿的**
 * （各自测各自的副本）。本项目对这类"双份真相"特别敏感
 * —— `db.ts` 头注释第一条就是「同一个事实存两份必然走散」。
 *
 * 所以：**`index.html` / `src/style.css` 是唯一真相**，本脚本单向生成。
 * `--check` 用逐字节比对，过期就退出码 1（验收脚本会先跑它）。
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.dirname(HERE)
const CHECK = process.argv.includes('--check')

/** 把任意文本塞进 `export const X = \`...\`` —— 三个字符要转义，顺序不能换。 */
function toTemplateLiteral(src) {
  return src
    .replace(/\\/g, '\\\\') // 先反斜杠，否则后面加的反斜杠会被再转一次
    .replace(/`/g, '\\`')
    .replace(/\$\{/g, '\\${')
}

/**
 * 取 `<body>` 的内容，**切到第一个 `<script` 之前**。
 *
 * 只切 `</body>` 是不够的：`index.html` 末尾那个
 * `<script type="module" src="/src/main.ts">` 会被一起带进来 ——
 * 注入到插件容器里之后，浏览器会**真的去加载 `/src/main.ts`**
 * （独立版的主入口），于是插件里又跑起来一台机器，两台一起渲染。
 */
function extractBody(html) {
  const open = html.match(/<body[^>]*>/i)
  if (!open) throw new Error('index.html 里找不到 <body>')
  const start = open.index + open[0].length
  const end = html.indexOf('<script', start)
  const stop = end === -1 ? html.lastIndexOf('</body>') : end
  if (stop === -1) throw new Error('index.html 里找不到 </body>')
  return html.slice(start, stop).trim()
}

const htmlSrc = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8')
const cssSrc = fs.readFileSync(path.join(ROOT, 'src/style.css'), 'utf8')

const body = extractBody(htmlSrc)
if (!body.includes('id="app"')) throw new Error('抽出来的 body 里没有 #app —— 抽取逻辑坏了')
if (/<script/i.test(body)) throw new Error('抽出来的 body 里还有 <script> —— 会把独立版主入口带进插件')

const files = {
  'src/plugin/html.ts': `/**
 * 机器 DOM —— **自动生成，别手改**（\`node scripts/gen-plugin-assets.mjs\`）。
 *
 * 源文件是仓库根目录的 \`index.html\`（独立版也用它）。为什么变成字符串：
 * 插件跑在宿主的 blob: 模块里，那里 \`fetch('index.html')\` 会以 \`blob:\`
 * 为基准解析 —— 必然 404，而且报错是一堆"加载失败"，看着像打包坏了。
 *
 * 于是 HTML 只能跟着 JS 一起进同一个包。生成而不是手抄，是因为手抄一份
 * 迟早和 \`index.html\` 走散，而两边各自的测试都会是绿的。
 *
 * 内容是 \`<body>\` 的**内部**（不含 body 标签本身，也不含末尾的
 * \`<script src="/src/main.ts">\` —— 那个会把独立版主入口又拉起来一次）。
 */
export const HTML = \`${toTemplateLiteral(body)}\`
`,
  'src/plugin/css.ts': `/**
 * 机器样式 —— **自动生成，别手改**（\`node scripts/gen-plugin-assets.mjs\`）。
 *
 * 源文件是 \`src/style.css\`。它原本是**整页**的样式表：
 *
 *   · \`:root\` / \`html, body\` —— 在插件里必须落在根节点上；
 *   · \`#app\` / \`#hud\` / \`.modal\` / \`#win\` / \`#start\` 都是 \`position: fixed\`
 *     —— 直接注入会盖住**整个宿主**（连底部 TabBar 一起），所以插件
 *     那边要补一段把它们改回 \`absolute\` 的覆盖（见 \`plugin/index.ts\`）；
 *   · \`.btn\` / \`.stat\` / \`.panel\` / \`.grid\` / \`.hidden\` 这些通用类名
 *     会和宿主的 Tailwind 撞（未分层的样式**胜过** \`@layer\`）。
 *
 * 所以**不能原样注入**：\`plugin/index.ts\` 会先过一遍 \`scopeCss()\`
 * 给每个选择器加根前缀，再 append 到 \`<style>\`。
 */
export const CSS_RAW = \`${toTemplateLiteral(cssSrc)}\`
`,
}

let stale = []
for (const [rel, content] of Object.entries(files)) {
  const abs = path.join(ROOT, rel)
  const old = fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8') : null
  if (old === content) continue
  if (CHECK) {
    stale.push(rel)
  } else {
    fs.mkdirSync(path.dirname(abs), { recursive: true })
    fs.writeFileSync(abs, content)
    console.log('写入', rel, `(${Buffer.byteLength(content)} 字节)`)
  }
}

if (CHECK) {
  if (stale.length) {
    console.error('以下生成文件已过期，跑 `node scripts/gen-plugin-assets.mjs` 重新生成：')
    for (const s of stale) console.error(' -', s)
    process.exit(1)
  }
  console.log('生成文件与 index.html / style.css 一致')
}
