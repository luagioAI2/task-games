/**
 * 把游戏自带的那份 CSS **收进自己的根节点**。
 *
 * ## 为什么必须做
 *
 * `ui.js` 的 `createUI()` 会造一个 `<style>` 直接 `document.head.appendChild()`，
 * 里面的规则是**全局**的。原版它自己就是整页，所以无所谓；进了宿主就不一样：
 *
 * | 原版规则 | 在宿主里会怎样 |
 * | --- | --- |
 * | `:root{--ink:#584f3d;…}` | 改掉**宿主**的 CSS 变量（同名就串味） |
 * | `body{font-family:…;color:var(--ink)}` | 整个 App 的字体和文字颜色被换掉 |
 * | `*{box-sizing:border-box}` | 这条宿主 Tailwind 本来就有，无害 |
 * | `.status` / `.badge` / `.controls` / `.message` … | 宿主里同名类会吃到游戏的样式 |
 *
 * 而且这份 `<style>` 是**挂载时才插**、排在宿主样式之后 —— 同优先级下它赢。
 * 所以症状会像「一进游戏，整个 App 的配色就变了」，退出游戏也不还原。
 *
 * ## 做法
 *
 * 逐块扫描（不是正则替换整串）：`@keyframes` / `@font-face` 整块不动，
 * `@media` / `@supports` / `@layer` 递归进去，其余每条选择器前面加根前缀。
 * `:root` / `html` / `body` 直接换成本身 —— 变量挂在根节点上照样继承下去。
 *
 * ## 为什么不用 Shadow DOM
 *
 * 更彻底，但 `game.js` / `ui.js` 里到处是 `document.querySelector(".breed-card")`
 * 这类查询，`document` 穿不过 shadow 边界 ⇒ 一片 null。改这些查询比给 CSS
 * 加前缀风险大得多。
 *
 * @param {string} css 原始样式
 * @param {string} scope 根选择器，如 `[data-inudoku-root]`
 * @returns {string}
 */
export function scopeCss(css, scope) {
  // 注释先剥掉：留着的话会粘在下一条选择器前面，前缀就加错位置了
  return walk(String(css).replace(/\/\*[\s\S]*?\*\//g, ''), scope)
}

/** 不该加前缀的 at-rule（块内是帧定义，不是选择器） */
const RAW_AT = /^@(-[a-z]+-)?(keyframes|font-face|property|counter-style)/i
/** 块内还是规则的 at-rule（递归） */
const NEST_AT = /^@(media|supports|layer|container|scope)/i

function walk(css, scope) {
  let out = ''
  let i = 0
  while (i < css.length) {
    const open = css.indexOf('{', i)
    if (open < 0) {
      out += css.slice(i)
      break
    }
    const head = css.slice(i, open).trim()
    let depth = 1
    let j = open + 1
    while (j < css.length && depth > 0) {
      const ch = css[j]
      if (ch === '{') depth++
      else if (ch === '}') depth--
      j++
    }
    const body = css.slice(open + 1, j - 1)
    if (!head) {
      out += `{${body}}`
    } else if (RAW_AT.test(head)) {
      out += `${head}{${body}}`
    } else if (NEST_AT.test(head)) {
      out += `${head}{${walk(body, scope)}}`
    } else {
      out += `${prefix(head, scope)}{${body}}`
    }
    i = j
  }
  return out
}

function prefix(selectorList, scope) {
  return selectorList
    .split(',')
    .map((raw) => {
      const s = raw.trim()
      if (!s) return s
      if (s === ':root' || s === 'html' || s === 'body') return scope
      if (s === '*') return `${scope} *`
      if (s.startsWith('html ')) return scope + s.slice(4)
      if (s.startsWith('body ')) return scope + s.slice(4)
      return `${scope} ${s}`
    })
    .join(',')
}
