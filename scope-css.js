/**
 * scope-css.js —— 把一份**全局样式表**收进一个根选择器里。
 *
 * ## 为什么需要它（真实事故）
 *
 * 这个游戏原来是**整页**跑的，样式直接 `document.head.appendChild(style)`，
 * 里面有一堆通用类名：`.grid` / `.cell` / `.card` / `.overlay` / `.hidden`。
 * 接进宿主（kid-quest-farm-2d）之后，这份样式会**跟着页面活着**：
 *
 *   - 宿主自己用了 **43 处** Tailwind `.grid`；
 *   - 游戏里的 `.grid` 是
 *     `{flex:1;width:100%;overflow-y:auto;padding:8px 16px 24px;
 *       cursor:grab;touch-action:none;grid-template-columns:repeat(auto-fill,minmax(110px,1fr))}`
 *   - 而**未分层（unlayered）的样式胜过 `@layer`** —— Tailwind v4 的工具类在
 *     `@layer utilities` 里，所以这一条会盖掉宿主的 `.grid`。
 *
 * 症状不是"游戏坏了"，是**宿主坏了**：切走以后农场页的网格变成可拖拽的
 * 两列小卡片，还带着 `touch-action:none`（滑不动）。而游戏自己的 `destroy()`
 * 里虽然有 `style.remove()`，但只有卸载路径真的被调用才生效 —— 一旦哪次
 * 卸载被漏掉，样式就永久留在页面上。
 *
 * ## 做法
 *
 * 每个选择器前面加根选择器，`@media` / `@supports` 递归进去，
 * `@keyframes` / `@font-face` **原样保留**（它们的"选择器"是名字，不是元素）。
 *
 * ```
 *   .grid{...}                    →  .pp-root .grid{...}
 *   .pp-root.onSplash .bnav{...}  →  原样（已经带了）
 *   @media (max-height:460px){    →  @media (max-height:460px){
 *     .card{...}                  →    .pp-root .card{...}
 *   }                             →  }
 *   @keyframes fall{...}          →  原样
 * ```
 *
 * ## 为什么不用 Shadow DOM
 *
 * 更干净，但这个游戏有 `document.getElementById`（`$` 就是它）和
 * `document.querySelectorAll("#collection .cat")`。塞进 shadow root 之后
 * 这些调用**全部返回 null**，改造成本远大于给选择器加前缀。
 *
 * ## 为什么不用 CSS 嵌套（`.pp-root{ .card{…} }`）
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

  // 已经带根选择器：`.pp-root` / `.pp-root.onSplash .x`
  if (s === root || s.startsWith(root + '.') || s.startsWith(root + ' ') || s.startsWith(root + ':')) {
    return s
  }

  // `html` / `body` / `:root` 换成根选择器本身 —— 游戏里的"整页"就是 `.pp-root`
  const head = s.match(/^(:root|html|body)\b/)
  if (head) return root + s.slice(head[0].length)

  return root + ' ' + s
}

/**
 * 主函数。`css` 是整份样式表文本，`root` 是根选择器（这里恒为 `.pp-root`）。
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
   * 拼出来是 `.pp-root /* 磁贴… *​/ .tile{...}` —— 整条规则作废，
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
