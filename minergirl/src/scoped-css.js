/**
 * 把整页游戏的样式收进**一块容器**里，并把「视口」单位换算成「容器」单位。
 *
 * 三件事，每一件都对应一次真实的翻车：
 *
 * ## ① 选择器收进根选择器（不这么做，坏的是**宿主**）
 *
 * 这份样式原来是整页跑的，里面全是通用类名：`.card` / `.overlay` / `.badge` /
 * `.num` / `.stats` / `button` / `[hidden]`。接进宿主之后它会**跟着页面活着**，
 * 而未分层（unlayered）的样式**胜过 `@layer`** —— 宿主用 Tailwind v4，
 * 工具类都在 `@layer utilities` 里 ⇒ 游戏这条 `.card{padding:0 18px 16px;border-radius:22px}`
 * 会盖掉宿主的 `.card`。
 *
 * 症状不是「游戏坏了」，是**宿主坏了**：切走以后农场页的卡片全变成和纸底 + 藏青描边。
 * 只有卸载路径真的被调用、`style.remove()` 跑了才会恢复 —— 漏一次就永久留在页面上。
 *
 * ## ② `position:fixed` 改成 `absolute`
 *
 * `#app` / `#hud` / `.overlay` / `#loading` 都是 `fixed; inset:0`。在宿主里
 * `fixed` 是相对**视口**的 ⇒ 面板会盖住宿主的顶栏和底栏（孩子点不到返回），
 * 而游戏画布还老老实实待在容器里。改成 `absolute` 之后它们相对 `#app`，
 * `#app` 相对根，根相对宿主容器。
 *
 * ## ③ `vw` / `vh` 改成容器的宽高
 *
 * 样式里有 `calc(100vw - 196px)`、`min(460px, 94vw)`、`max-height: calc(100vh - 32px)`。
 * 宿主里**容器 ≠ 视口**（上面有顶栏、下面有底栏），按视口算出来的面板会比容器还高，
 * 底部按钮直接被裁掉。所以启动时把容器尺寸写进 `--mng-w` / `--mng-h`，
 * 这里把 `Nvw` 换成 `calc(var(--mng-w, 100vw) * N / 100)`。
 *
 * ## 顺带做的两件小事
 *
 * - `@keyframes` 的名字是**全局**的（作用域化管不到），和宿主撞名时动画会互相顶掉，
 *   所以统一加 `mng-` 前缀。**只在 `animation` / `animation-name` 声明里改**，
 *   不能全文替换 —— `toast` 既是动画名也是 `.hud-toast` 类名的一部分。
 * - `@font-face` 的 `url()` 必须换成绝对地址：`<style>` 在 `document.head` 里，
 *   相对 URL 以**文档**为基准（宿主页面根），`assets/fonts/…` 会 404。
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

  if (s === root || s.startsWith(root + '.') || s.startsWith(root + ' ') || s.startsWith(root + ':')) {
    return s
  }

  // `html` / `body` / `:root` 换成根选择器本身 —— 游戏里的「整页」就是这块容器
  const head = s.match(/^(:root|html|body)\b/)
  if (head) return root + s.slice(head[0].length)

  return root + ' ' + s
}

/**
 * 主函数。`css` 是整份样式表文本，`root` 是根选择器（这里恒为 `#mng-root`）。
 *
 * ⚠️ **不校验 CSS 合法性**：按 `{}` 配对扫描，字符串里出现未转义的 `{` / `}`
 *    （比如 `content:"{"`）会被数错。这份样式表里没有这种写法。
 */
export function scopeCss(css, root) {
  /*
   * ★ 先把注释删掉。不删的话，注释会跟着「前导文本」一起被当成选择器的一部分：
   *
   *     /* HUD *​/
   *     #hud { … }
   *
   * 拼出来是 `#mng-root /* HUD *​/ #hud{…}` —— 整条规则作废，
   * 而浏览器**不会报错**（未知选择器 = 静默不匹配）。
   */
  const src = String(css).replace(/\/\*[\s\S]*?\*\//g, '')

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
      // @keyframes / @font-face / @page —— 它们的「选择器」不是元素
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

/** `12vw` → `calc(var(--mng-w, 100vw) * 12 / 100)`；`100vw` → `var(--mng-w, 100vw)`。 */
const vwToVar = (css) =>
  css.replace(/(\d+(?:\.\d+)?)v([wh])\b/g, (m, n, ax) => {
    const name = ax === 'w' ? '--mng-w' : '--mng-h'
    return Number(n) === 100
      ? `var(${name}, 100v${ax})`
      : `calc(var(${name}, 100v${ax}) * ${n} / 100)`
  })

/** `@keyframes` 名加前缀（只动 animation 声明里的引用）。 */
function prefixKeyframes(css) {
  const names = new Set([...css.matchAll(/@keyframes\s+([A-Za-z_][\w-]*)/g)].map((m) => m[1]))
  if (!names.size) return css
  return css
    .replace(/@keyframes\s+([A-Za-z_][\w-]*)/g, (m, n) => `@keyframes mng-${n}`)
    .replace(/(animation(?:-name)?\s*:\s*)([^;}]+)/g, (m, prop, val) =>
      prop + val.replace(/[A-Za-z_][\w-]*/g, (w) => (names.has(w) ? `mng-${w}` : w)),
    )
}

/** `url("assets/…")` → `url("<assetUrl('assets/…')>")`。只认 assets/ 开头的相对地址。 */
function absolutizeUrls(css, assetUrl) {
  if (typeof assetUrl !== 'function') return css
  return css.replace(/url\(\s*(['"]?)(assets\/[^'")]+)\1\s*\)/g, (m, q, rel) => `url("${assetUrl(rel)}")`)
}

/**
 * 生成最终样式文本（纯函数，方便单独断言）。
 *
 * @param {string} css        原样式表
 * @param {object} o
 * @param {string} o.root     根选择器
 * @param {(rel: string) => string} [o.assetUrl]
 * @param {boolean} [o.safeArea] `false` ⇒ 把安全区变量清零（宿主已经让出了顶栏/底栏）
 */
export function buildCss(css, { root, assetUrl, safeArea = false }) {
  let out = prefixKeyframes(vwToVar(String(css).replace(/position:\s*fixed/g, 'position: absolute')))
  out = absolutizeUrls(out, assetUrl)
  out = scopeCss(out, root)

  /*
   * 根元素自己的规则，追加在**最后**（同特异性时后写的赢）：
   *   · `position:absolute; inset:0` —— 填满宿主容器，也是所有 `#app` 子层的定位祖先
   *   · `isolation:isolate` —— 游戏里的 z-index 20/60/70 不许跑到宿主底栏上面去
   *   · 安全区清零 —— 宿主已经处理过刘海/手势条，游戏里再来一次会多出一截空白
   */
  out +=
    `\n${root}{position:absolute;inset:0;overflow:hidden;touch-action:none;isolation:isolate;` +
    (safeArea ? '' : '--safe-t:0px;--safe-b:0px;--safe-l:0px;--safe-r:0px;') +
    '}\n'
  return out
}

/**
 * 取样式表 → 转换 → 注入 `<style data-mng-css>`。
 *
 * 返回的元素由调用方在卸载时 `remove()`；**不 remove 就等于把游戏样式
 * 永久留在宿主页面上**（见文件头 ①）。
 *
 * @param {string} url     独立网页：`./styles.css`；插件：`ctx.assetUrl('styles.css')`
 * @param {object} opts    `{ root, assetUrl, safeArea, cssText }`
 *                         ★ `cssText` 有值就直接用（插件把 CSS 内联进包了，见
 *                         `scripts/build-plugin.mjs`）—— 少一次网络请求，也不会 404。
 * @returns {Promise<HTMLStyleElement>}
 */
export async function loadStyles(url, opts) {
  let css = opts.cssText
  if (!css) {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`styles.css ${res.status} ${url}`)
    css = await res.text()
  }
  const el = document.createElement('style')
  el.dataset.mngCss = ''
  el.textContent = buildCss(css, opts)
  document.head.appendChild(el)
  return el
}
