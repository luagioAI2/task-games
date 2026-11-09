/**
 * 独立网页入口（`index.html` 用）。**只给本地调试 / 截图 / 冒烟用**。
 *
 * 插件形态（宿主里）走 `plugin.js`，两者的差别只有三行：
 * 资源根、存档实现、容器。
 *
 * ```bash
 * node ../skills/scrape-game-into-farm/scripts/smoke.mjs . --shot
 * ```
 */
import { boot } from './game.js'
import { installGpShim, installAssetCss } from './gp-shim.js'
import { scopeCss } from './css-scope.js'

/** 内存存档：刷新即清空，够跑一局和截图 */
function memoryStorage() {
  const mem = new Map()
  return {
    async get(k) {
      return mem.has(k) ? mem.get(k) : undefined
    },
    async set(k, v) {
      if (v === null || v === undefined) mem.delete(k)
      else mem.set(k, v)
    },
    async list() {
      return Object.fromEntries(mem)
    },
  }
}

/** 独立跑时资源就在同级目录，相对当前文档即可 */
const assetUrl = (rel) => String(rel).replace(/^\.\//, '')

window.__inudokuStandalone = true
window.__inudokuDead = false
window.__inudokuRoot = document.getElementById('app')
window.__inudokuAsset = assetUrl
/** ui.js 会用它把自带 CSS 收进根节点（见 css-scope.js 头注释） */
window.__inudokuScopeCss = (css) => scopeCss(css, '[data-inudoku-root]')
document.getElementById('app').setAttribute('data-inudoku-root', '')
installAssetCss(assetUrl)

/**
 * 独立页没有积分系统，但**照样把扣分请求记下来**。
 *
 * 这样 `scripts/play-check.mjs` 才能验证「新开一关才扣、已通关重玩不扣、
 * 同一关失败重来不扣」这三条 —— 它们全在 `game.js` 的补丁里，
 * 光看画面是看不出来的（不扣分的 bug 不报错、不影响玩）。
 */
window.__chargeCalls = []
window.__inudokuCharge = async (lv) => {
  window.__chargeCalls.push(lv)
  return true
}

const shim = await installGpShim({
  storage: memoryStorage(),
  locale: (navigator.language || 'zh').toLowerCase().startsWith('ja')
    ? 'ja'
    : (navigator.language || 'zh').toLowerCase().startsWith('zh')
      ? 'zh'
      : 'en',
})

await boot()

/* 独立页关掉就直接落盘（内存版其实不用，留着是为了两条路径行为一致） */
window.addEventListener('pagehide', () => shim.flush())
