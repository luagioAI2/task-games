/**
 * base.js —— 资源基址（`assets/...` 前面要拼的那一段）。
 *
 * 插件包是被宿主用 **`blob:`** 加载的，**相对路径按宿主页面的 `baseURI` 解析**，
 * 不是按包的地址。所以 `url(assets/sheets/x.webp)`、`PIXI.Assets.load('assets/...')`
 * 全都会指到宿主根目录 ⇒ 一片 404，而报错长得像「图没打进包里」。
 *
 * ★ 必须在**模块求值那一刻**就算好：`ui.js` / `fxui.js` 里有一堆**模块级常量**
 *   （`HAND` / `ITEM_SHEETS` / `GEN_ICON` …）是 import 时就算出来的 CSS 串，
 *   晚一步（比如 mount 时才 set）那些串已经定格成相对路径了 ⇒ 只能靠 import 时的值。
 *
 * ## 怎么知道自己在哪种形态
 *
 * `import.meta.url`：
 *   · 独立网页 ⇒ `http://127.0.0.1:4399/base.js`  ⇒ 资源就在同级的 `assets/` 下
 *   · 插件     ⇒ `blob:http://…/uuid`             ⇒ 资源在 `<宿主>/games/redbutton/`
 *   · Node     ⇒ `file:///…`（`check-plugin.mjs` 会真 import 一次）⇒ 给个占位值
 *
 * ★ 独立网页不能也拼 `games/redbutton/`：那里没有这个目录，8 张图会全 404，
 *   而画面只是「没有图标」，看起来像美术资源漏打了。
 * ★ 插件侧用 `new URL('games/redbutton/', document.baseURI)` 而不是写死 `/games/redbutton/`：
 *   部署到子路径（GitHub Pages 的 `/kid-quest-farm/`）时写死的那份会 404。
 */
export const AB = (() => {
  let self = ''
  try {
    self = import.meta.url || ''
  } catch {
    /* 极老的打包器会把它换掉，当插件处理 */
  }
  if (self.startsWith('http')) return new URL('./', self).href
  try {
    return new URL('games/redbutton/', document.baseURI).href
  } catch {
    return '/games/redbutton/'
  }
})()
