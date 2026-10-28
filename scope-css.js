/**
 * scope-css.js —— 把一份**全局样式表**收进一个根选择器里。
 *
 * ## 为什么需要它（画马赛跑）
 *
 * 这款原来是**整页**跑的（`index.html` 里就一个 `<div id="app">`），
 * 七份样式表加起来 76 KB，里面有：
 *
 *   - `:root{font-family:…;color:#263b2f;background:#f5f2e9;--orange:…}` —— 直接改宿主整页字体配色；
 *   - `*{box-sizing:border-box}` / `body{margin:0}` / `[hidden]{display:none!important}` —— 命中宿主全部元素；
 *   - `.topbar` / `.paper` / `.toolbar` / `.overlay` / `.modal` / `main` / `h1` / `footer` —— 全是通用名。
 *
 * 而**未分层（unlayered）的样式胜过 `@layer`** —— Tailwind v4 的工具类在
 * `@layer utilities` 里，所以这些规则会盖掉宿主的同名类。症状不是"游戏坏了"，
 * 是**宿主坏了**：切走以后农场页的顶栏变成涂鸦教室的米色、`h1` 变成 60px 黑体。
 *
 * 好消息是这份 CSS 本来就有 **80% 的规则已经带 `#app` 前缀**（作者按整页写的），
 * 所以只要把 `#app` 换成插件根 id，剩下的交给这个函数补前缀。
 *
 * ## 做法
 *
 * 每个选择器前面加根选择器，`@media` / `@supports` 递归进去，
 * `@keyframes` / `@font-face` **原样保留**（它们的"选择器"是名字，不是元素）。
 *
 * ```
 *   .toolbar{...}                 →  #dd-app .toolbar{...}
 *   #dd-app .paper{...}           →  原样（已经带了）
 *   @media (max-height:460px){    →  @media (max-height:460px){
 *     .card{...}                  →    #dd-app .card{...}
 *   }                             →  }
 *   @keyframes fall{...}          →  原样（本作没有 keyframes）
 * ```
 *
 * ⚠️ 调用时**第二个参数不能漏**（`scopeCss(css, '#dd-app')`）。漏了前缀就是
 * 字面量 `undefined` ⇒ 整套 CSS 一条都不命中 ⇒ **界面隐形、零报错**，
 * 而 `innerText` 还有内容（容器判据照样绿）。
 *
 * ## 为什么不用 Shadow DOM
 *
 * 更干净，但这个游戏到处都是 `document.getElementById`（`$` 就是它）和
 * `document.querySelector('.paper')`。塞进 shadow root 之后这些调用
 * **全部返回 null**，改造成本远大于给选择器加前缀。
 *
 * ## 为什么不用 CSS 嵌套（`#dd-app{ .card{…} }`）
 *
 * 嵌套是 2023 年才稳定的特性，Capacitor 的 WebView 版本由系统决定。
 * 这里的包要能跑在"比 App 最低版本更老"的 WebView 上 —— 用嵌套等于
 * 把兼容性押在用户没更新系统上。字符串改写没有这个问题。
 */

/** 拆分选择器列表，**只在括号外**的逗号处分。`:is(a, b)` 里的逗号不算。 */
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
    } else {
      cur += ch
    }
  }
  parts.push(cur)
  return parts
}

/** 给单个选择器加前缀。已经带根选择器的**原样返回**（否则会叠成两层）。 */
function scopeOne(sel, root) {
  const s = sel.trim()
  if (!s) return ''

  // 已经带根选择器：`#dd-app` / `#dd-app.onSplash .x` / `#dd-app[data-compact=true] .x`
  //
  // ★ 必须认 `root + '['`：本作的排版开关是**属性**选择器（`#dd-app[data-portrait=true]`），
  //   漏了这一条就会被当成「没带前缀」再补一层 ⇒ `#dd-app #dd-app[data-…]`，
  //   要求嵌套的 `#dd-app`，**永远不匹配** ⇒ 手机上三栏挤成 `35px 35px 280px`，零报错。
  if (
    s === root ||
    s.startsWith(root + '.') ||
    s.startsWith(root + ' ') ||
    s.startsWith(root + ':') ||
    s.startsWith(root + '[')
  ) {
    return s
  }

  // `html` / `body` / `:root` 换成根选择器本身 —— 游戏里的"整页"就是 `#dd-app`
  const head = s.match(/^(:root|html|body)\b/)
  if (head) return root + s.slice(head[0].length)

  return root + ' ' + s
}

/**
 * 主函数。`css` 是整份样式表文本，`root` 是根选择器（这里恒为 `#dd-app`）。
 *
 * ⚠️ 这个函数**不校验 CSS 合法性**。它按 `{}` 配对扫描，所以
 *    字符串里出现未转义的 `{` / `}`（比如 `content:"{"`）会被数错。
 *    这个游戏的样式表里没有这种写法；将来加的时候要么转义，要么别用它。
 */
export function scopeCss(css, root) {
  /*
   * ★ 先把注释删掉。不删的话，注释会跟着"前导文本"一起被当成选择器的一部分：
   *
   *     /* 磁贴从 4 个减到 3 个 *​/
   *     .tile{...}
   *
   * 拼出来是 `#dd-app /* 磁贴… *​/ .tile{...}` —— 整条规则作废，
   * 而浏览器**不会报错**（未知选择器 = 静默不匹配）。
   * 这个游戏的样式表里有 5 处这种注释（第 40/42/117/219/252 行）。
   */
  const src = css.replace(/\/\*[\s\S]*?\*\//g, '')

  let out = ''
  let i = 0

  while (i < src.length) {
    const open = src.indexOf('{', i)
    if (open === -1) {
      // 末尾剩下的（通常只有空白）原样带上
      out += src.slice(i)
      break
    }

    const prelude = src.slice(i, open)
    const sel = prelude.trim()

    // 找配对的 `}`
    let depth = 0
    let j = open
    for (; j < src.length; j++) {
      if (src[j] === '{') depth++
      else if (src[j] === '}') {
        depth--
        if (depth === 0) break
      }
    }
    const body = src.slice(open + 1, j)

    if (/^@(media|supports|container|layer)\b/.test(sel)) {
      // 容器型 at-rule：**里面的规则**要继续收进根选择器
      out += prelude + '{' + scopeCss(body, root) + '}'
    } else if (sel.startsWith('@')) {
      // @keyframes / @font-face / @page / @import —— 它们的"选择器"不是元素
      out += prelude + '{' + body + '}'
    } else {
      const scoped = splitSelectors(sel)
        .map((s) => scopeOne(s, root))
        .filter(Boolean)
        .join(',')
      out += scoped + '{' + body + '}'
    }

    i = j + 1
  }

  return out
}
