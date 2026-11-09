/**
 * 独立网页入口（`npm run dev` / 远程静态站点）。
 *
 * 插件入口在 `src/plugin.js`，两者共用同一份游戏代码（`src/game.js` 的
 * `start()`），区别只在**资源地址怎么拼**和**存档存在哪**：
 *
 * | | 独立网页（本文件） | 插件（plugin.js） |
 * | --- | --- | --- |
 * | 资源 | `assets/<rel>`（相对文档） | `ctx.assetUrl(rel)` |
 * | 存档 | `localStorage` | `host.storage` |
 * | 容器 | `<div id="app">` | 宿主给的 container |
 *
 * 这样做的好处：游戏本体没有「插件专用分支」，本地能跑通就说明代码是好的，
 * 排查插件问题时可以先把宿主排除掉。
 */
import { start } from './game.js'
import { Store, localStorageBackend } from './store.js'

const app = document.getElementById('app')
const errBox = document.getElementById('boot-error')

// 存档后端：localStorage。前缀带上，免得和同域别的应用撞。
const store = new Store(localStorageBackend('cloudfarm:'), navigator.language)

// 触感：网页没有真实马达，用 `navigator.vibrate` 兜一下（多数桌面浏览器没有，静默）
const haptic = () => {
  try {
    if (navigator.vibrate) navigator.vibrate(8)
  } catch { /* 不支持就算了 */ }
}

start({
  mountTo: app,
  store,
  haptic,
  locale: null, // 让游戏按 navigator.language 自己挑
  onReady() {
    // 入场遮罩：游戏自己的 loading 画面接管后就可以撤掉这张静态图
    document.getElementById('splash')?.remove()
  },
}).then((unmount) => {
  // 网页形态没有「切 tab 卸载」这回事，但暴露出来方便调试（控制台里能手动拆）
  window.__cfUnmount = unmount
}).catch((e) => {
  console.error(e)
  if (errBox) {
    errBox.hidden = false
    errBox.textContent = '启动失败：' + (e?.message || e)
  }
  document.getElementById('splash')?.remove()
})
