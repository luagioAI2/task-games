/**
 * 资源根前缀 —— 让同一份代码在「独立网页」和「插件」两种形态下都能找到图。
 *
 * ## 为什么必须有这一层
 *
 * 插件包是以 `blob:` URL 被 `import()` 进来的，**相对路径的基准是那个 blob**，
 * 不是宿主页面。`fetch('assets/x.webp')` 会变成 `blob:http://…/assets/x.webp`，
 * 而 Phaser 的 `setPath('assets/')` 用的是 `Image.src`，同样以文档为基准 ——
 * 宿主文档根下没有 `assets/`，于是 205 张图全 404，
 * 报错是一堆 `Texture key not found`，看着像打包坏了。
 *
 * 独立网页里 root 是空串，行为和原版完全一致。
 * 插件里 `plugin.js` 传 `ctx.assetUrl('')` = `<包根>/`。
 *
 * ★ 模块顶层只声明、不读 `window`/`document`：`check-plugin.mjs` 会在 Node 里真 `import()`。
 */
let root = ''

export function setAssetRoot(r) {
  root = typeof r === 'string' ? r : ''
}

/** `assets/x.webp` → `<root>assets/x.webp`（root 为空时原样返回） */
export function assetUrl(p) {
  const rel = String(p).replace(/^\.\//, '').replace(/^\/+/, '')
  if (!root) return rel
  return root + rel
}

/** 当前 root（`sound-1.js` 的 `baseUrl` 要它，且**必须带尾斜杠**） */
export function assetRoot() {
  if (!root) return ''
  return root.endsWith('/') ? root : root + '/'
}
