/**
 * `scope-css` —— 把一份**整页样式表**收进一个根选择器里。
 *
 * ## 为什么必须收（这是真事故，不是洁癖）
 *
 * 这台机器的样式表原来是给整页用的，里面有一批**通用类名**：
 * `.btn` / `.stat` / `.panel` / `.grid` / `.hidden` / `.toast` / `.pop`。
 * 接进宿主（kid-quest-farm-2d）之后，这份样式会跟着页面一起活着，而
 * **未分层的样式胜过 `@layer`** —— 宿主的 Tailwind v4 工具类在
 * `@layer utilities` 里，所以这里每一条都能盖掉宿主。
 *
 * 症状不是「游戏坏了」，是**宿主坏了**：切回农场页，格子变成 40px 的圆角按钮、
 * 弹窗定位全乱，而游戏自己的测试是绿的（它测的是游戏）。
 *
 * ## 做法
 *
 * 每个选择器前面加根选择器；`@media` / `@supports` / `@layer` 递归进去；
 * `@keyframes` / `@font-face` 原样保留（它们的"选择器"是名字，不是元素）。
 *
 * ```
 *   .btn{…}                  →  .claw-root .btn{…}
 *   body.wide #deck{…}       →  .claw-root.wide #deck{…}
 *   :root{--accent:…}        →  .claw-root{--accent:…}
 *   @media (…) { .x{…} }     →  @media (…) { .claw-root .x{…} }
 *   @keyframes pop{…}        →  原样
 * ```
 *
 * ## 为什么不用 Shadow DOM
 *
 * 更干净，但这台机器有几十处 `document.getElementById` 和
 * `document.querySelectorAll('#qseg button')`。塞进 shadow root 之后它们
 * **全部返回 null**，而报错是 `Cannot read properties of null`，
 * 指不到"因为你用了 shadow DOM"。改造成本远大于给选择器加前缀。
 *
 * ## 为什么不用 CSS 嵌套（`.claw-root{ .btn{…} }`）
 *
 * 嵌套是 2023 年才稳定的特性，而宿主还要跑在 Capacitor 的 WebView 上，
 * 版本由用户系统决定。字符串改写没有这个兼容性问题。
 */

/** 拆分选择器列表，**只在括号外**的逗号处分。`:is(a, b)` 里的逗号不算。 */
function splitSelectors(text: string): string[] {
  const parts: string[] = []
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
function scopeOne(sel: string, root: string): string {
  const s = sel.trim()
  if (!s) return ''

  // 已经带根选择器：`.claw-root` / `.claw-root.wide .x`
  if (s === root || s.startsWith(root + '.') || s.startsWith(root + ' ') || s.startsWith(root + ':')) {
    return s
  }

  // `html` / `body` / `:root` 换成根选择器本身 —— 这台机器的"整页"就是根节点
  const head = s.match(/^(:root|html|body)\b/)
  if (head) return root + s.slice(head[0].length)

  return root + ' ' + s
}

/**
 * 主函数。`css` 是整份样式表文本，`root` 是根选择器（这里恒为 `.claw-root`）。
 *
 * ⚠️ 这个函数**不校验 CSS 合法性**：它按 `{}` 配对扫描，所以
 *    字符串里出现未转义的 `{` / `}`（比如 `content:"{"`）会被数错。
 *    这台机器的样式表里没有这种写法；将来加的时候要么转义，要么别用它。
 */
export function scopeCss(css: string, root: string): string {
  /*
   * ★ 先把注释删掉。不删的话，注释会跟着"前导文本"一起被当成选择器的一部分：
   *
   *     /* 磁贴从 4 个减到 3 个 *​/
   *     .tile{…}
   *
   * 拼出来是 `.claw-root /* 磁贴… *​/ .tile{…}` —— 整条规则作废，
   * 而浏览器**不会报错**（未知选择器 = 静默不匹配）。
   */
  const src = css.replace(/\/\*[\s\S]*?\*\//g, '')

  let out = ''
  let i = 0

  while (i < src.length) {
    const open = src.indexOf('{', i)
    if (open === -1) {
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
      const scoped = splitSelectors(sel).map((s) => scopeOne(s, root)).filter(Boolean).join(',')
      out += scoped + '{' + body + '}'
    }

    i = j + 1
  }

  return out
}
