/**
 * base.js —— 资源基址。
 *
 * 本作只有三处外部文件，但**三处都靠相对路径**：
 *
 * | 文件 | 原版写法 | 插件里会打到 |
 * | --- | --- | --- |
 * | `sound.manifest.json` | `loadSoundSystem({ manifestUrl: './sound.manifest.json' })` | 宿主根 ⇒ 404 的 HTML 被当 JSON ⇒ 整个 mount 不出现 |
 * | 字体 | `https://static.makeplay.ai/fonts/v1/...` | 外网（离线 App 拿不到）⇒ 换成本地 `assets/fonts/` |
 * | bgm | 清单里的 `assets/audio/bgm_doodle.m4a` | 相对**清单文件**，走同一基址 |
 *
 * 所以**在模块求值那一刻**算好绝对基址：
 *
 * - 独立网页（`http:`）：`import.meta.url` 的目录
 * - 插件（`blob:`）：拼宿主的 `games/<id>/`
 * - Node（`check-plugin.mjs` 会真 `import()` 一次）：`document` 不存在，给个兜底串
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
    return new URL('games/hoopsneak/', document.baseURI).href
  } catch {
    return '/games/hoopsneak/'
  }
})()
