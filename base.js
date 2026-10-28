/**
 * base.js —— 资源基址。
 *
 * 原版所有资源都是**相对路径**（`assets/bg-meadow.webp`、`fetch(\`${dir}/manifest.json\`)`），
 * 靠「页面就是站点根」成立。接进宿主后包是从 `blob:` 求值的，`document.baseURI`
 * 指向宿主页面 ⇒ 相对路径会打到宿主的 `/assets/...`（404，而且画面只是「没有图」，
 * 比整页白屏更难发现）。
 *
 * 所以**在模块求值那一刻**算好绝对基址：
 *
 * - 独立网页（`http:`）：`import.meta.url` 的目录，`assets/` 就在同级
 * - 插件（`blob:`）：拼宿主的 `games/<id>/`
 * - Node（`check-plugin.mjs` 会真 `import()` 一次）：`document` 不存在，给个兜底串
 *
 * ★ 必须在模块级算：`ui.js` / `game.js` 里有一堆模块级常量是 import 时拼出来的
 *   （`k` 的 58 条路径、`cs` / `ds` 的走路目录），mount 时再改已经晚了。
 */
export const AB = (() => {
  let self = ''
  try {
    self = import.meta.url || ''
  } catch {
    /* 某些打包器会把 import.meta 换掉 */
  }
  if (self.startsWith('http')) return new URL('./', self).href
  try {
    return new URL('games/guardshift/', document.baseURI).href
  } catch {
    return '/games/guardshift/'
  }
})()
