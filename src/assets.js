/**
 * 资源路径解析 —— 插件在 `blob:` 模块里跑，**相对路径会以 blob: 为基准解析**，
 * 所以每一条 `assets/...` 都必须过这里换成宿主的绝对路径。
 *
 * ## 为什么是一个模块级的可变 base，而不是层层传参
 *
 * 资源路径散在 5 个文件里（`data.js` 的角色立绘 / 元素图标 / 怪物贴图、
 * `core.js` 的贴图缓存、`ui.js` 的 `<img src>`、`game.js` 的背景与音频清单）。
 * 逐个加参数要改几十处，而且**漏一处就是 404**，报错还是
 * `Unexpected non-whitespace character after JSON` 那种不像 404 的。
 *
 * 所以：挂载时 `setAssetBase(ctx.assetBase)` 一次，之后所有地方都写 `A('assets/…')`。
 *
 * ## ★ `A()` 必须**幂等**
 *
 * 同一个路径会经过两条路：`charArt()` 里过了一次，`loadTex()` 里又过一次。
 * 不做幂等就会拼成 `/games/moestrike/assets//games/moestrike/assets/chara/…`。
 * 判据写在函数里：**已经以 base 开头的原样返回**。
 */
let base = ''

/** 挂载时设一次。`''` = 独立网页（路径相对文档，原样返回）。 */
export function setAssetBase(b) {
  base = typeof b === 'string' ? b : ''
}

const ABS = /^(https?:|data:|blob:|\/\/)/

/** `assets/x.png` → `/games/moestrike/assets/x.png`（已经是绝对路径 / 已带 base 的原样返回）。 */
export function A(rel) {
  if (!rel) return rel
  if (!base) return rel
  const s = String(rel)
  if (ABS.test(s) || s.startsWith(base)) return s
  return base + s.replace(/^\.?\//, '')
}

/** 当前 base（`loadSoundSystem` 要拿它当 baseUrl）。 */
export function assetBase() {
  return base
}
