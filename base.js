/**
 * base.js —— 资源基址。
 *
 * 本作只有**一处**外部文件靠相对路径：`@makeplay/sound` 的音频清单。
 *
 * | 文件 | 原版写法 | 插件里会打到 |
 * | --- | --- | --- |
 * | `sound.manifest.json` | `loadSoundSystem({ manifestUrl: './sound.manifest.json' })` | 宿主根 ⇒ 404 的 HTML 被当 JSON ⇒ `… is not valid JSON` ⇒ **整个 mount 失败** |
 * | `sound.pack` / `assets/audio/*.m4a` | 清单里的**裸相对路径** | 相对清单文件 ⇒ 走同一基址 |
 *
 * 所以**在模块求值那一刻**算好绝对基址：
 *
 * - 独立网页（`http:`）：`import.meta.url` 的目录
 * - 插件（`blob:`）：拼宿主的 `games/<id>/`
 * - Node（`scripts/check-plugin.mjs` 会真 `import()` 一次）：`document` 不存在，给个兜底串
 *
 * ★ 注意这里**没有**碰 `window` —— 模块顶层碰 `window` 会让 Node 里的
 *   `import()` 直接抛，而那个脚本是用来拦「模块顶层写 DOM」的守卫。
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
    return new URL('games/doodlederby/', document.baseURI).href
  } catch {
    return '/games/doodlederby/'
  }
})()
