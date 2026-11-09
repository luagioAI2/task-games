/**
 * 资源路径前缀 —— 让同一份代码在「独立网页」和「插件」两种形态下都能找到图。
 *
 * ## 为什么必须有这一层
 *
 * 插件包是以 `blob:` URL 被 `import()` 进来的，**相对路径的基准是那个 blob**，
 * 不是宿主页面 ⇒ `assets/blocks/block-pink.webp` 会变成
 * `blob:http://…/assets/blocks/block-pink.webp`，全部 404。
 * 而报错长得像「资源没抓到」或「打包坏了」，人第一反应不会去查 base。
 *
 * 独立网页里 base 是空串，行为和原版一致（相对 `index.html`）。
 * 插件里 `plugin.js` 传 `ctx.assetUrl('')`（= `/games/stackmeow/assets/`）。
 *
 * ★ 模块顶层只声明、不读 `window`/`document`：`check-plugin.mjs` 会在 Node 里真 `import()`。
 */
let base = ''

export function setAssetBase(b) {
  base = typeof b === 'string' ? b : ''
}

/** `assets/xxx` → `<base>assets/xxx`（base 为空时原样返回） */
export function assetUrl(p) {
  if (!base) return p
  return base + (p.startsWith('./') ? p.slice(2) : p)
}
