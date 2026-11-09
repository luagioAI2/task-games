/**
 * 犬独 · 插件入口（宿主 kid-quest-farm-online，HOST_API 3+）
 *
 * ## 和「独立网页」的差别只有三处
 *
 * | | `index.html`（独立） | 本文件（插件） |
 * | --- | --- | --- |
 * | 容器 | 页面自带的 `#app` | `mount(container)` 给的盒子 |
 * | 资源 | 相对文档 | `ctx.assetUrl()`（插件在 `blob:` 里跑，相对路径必 404） |
 * | 存档 | 内存（刷新即清） | `host.storage`（App 的统一本地存档） |
 *
 * 其余全在 `gp-shim.js` 与 `scripts/patch-game.mjs` 里，玩法代码一行没改。
 *
 * ## 经济：只花积分，不产出兑换券
 *
 * ```
 *   积分 ──开一关扣 1──▶ 玩 ──▶ 什么都不发
 * ```
 *
 * 判据是「**新开一关**」而不是「点一下扣一次」：
 *   · 已通关的关卡重玩**免费**（存档里记着 `lv:<n>`）；
 *   · 同一关失败重来（`retry`）**免费** —— 一局里三次命用完了再收一次钱，
 *     孩子只会关掉游戏；
 *   · 进阶 18 题**不额外收**（主线通关后的加餐）。
 *
 * 这款没有任何内购：原版靠 `gp.pay` 卖命、卖皮肤、卖 BGM，我们不给 `pay`
 * （见 `gp-shim.js` 头注释），皮肤和 BGM 改成**通关解锁**。
 */
import { boot } from './game.js'
import { installGpShim, installAssetCss } from './gp-shim.js'
import { scopeCss } from './css-scope.js'

/** 新开一关扣多少积分。改这里就够了 —— 下面 `charge()` 读的是同一个常量。 */
const PLAY_COST = 1

export const manifest = {
  id: 'inudoku',
  name: '犬独',
  emoji: '🐕',
  /** 底部导航文字，≤5 字 */
  tabLabel: '犬独',
  /**
   * 1.0.0 = 首版。原版是 MakePlay 上的「犬独 ～INUDOKU～」：
   *   36 关主线 + 2 章 16 题进阶 + 8 只狗耳朵皮肤 + 4 首 BGM。
   *   去掉的是：真钱内购（买命 / 买皮肤 / 买 BGM）、平台分享、云端存档、CDN 字体。
   */
  version: '1.0.1',
  /** 用到 `host.storage`（存档）与 `ctx.assetUrl`（资源），两者都在 API 3 落地 */
  minHostApi: 3,

  coin: {
    /**
     * 本作**不发行**游戏币（`mintGameCoin` / `spendGameCoin` 一次都不调），
     * 这里只是 manifest 必填项。余额恒为 0、兑换率 0 ⇒ 家长看不到假的兑换说明。
     */
    id: 'bone',
    name: '骨头',
    emoji: '🦴',
  },

  economy: {
    /** 新开一关扣 1 积分 */
    playCost: PLAY_COST,
    /** 一分券都不产出 */
    expectedPayout: 0,
    /** 没有奖品，但闸门要求 ≥ 1（写 0 会在安装时被拒） */
    capPerPrize: 1,
    /** `0` = 不开放「币 → 券」兑换 */
    voucherPerCoin: 0,
  },
}

/**
 * 挂载。
 *
 * ⚠️ 契约要点（宿主 `src/games/plugin.ts`）：
 *   · 返回值可以是 `Unmount` 或 `Promise<Unmount>`，宿主会 `await`；
 *   · `unmount` **必须能在「刚建好就被调用」时安全执行**（孩子秒切 tab）；
 *   · 资源一律走 `ctx.assetUrl()`。
 */
export async function mount(container, host, ctx = {}) {
  const assetUrl =
    typeof ctx.assetUrl === 'function'
      ? (rel) => ctx.assetUrl(rel)
      : (rel) => String(ctx.assetBase || '') + rel

  /*
   * 容器必须是定位上下文。
   * ★ 判据用 computed style，不能读 `container.style.position`：
   *   宿主给的是 `<div class="absolute inset-0">`，定位写在**类**里，
   *   inline 读出来是空串 —— 按 inline 判断会误写 inline `relative`，
   *   而 inline 胜过类，那个盒子就从「铺满」变成「内容高度」。
   */
  const patchedPos = getComputedStyle(container).position === 'static'
  const prevPos = container.style.position
  if (patchedPos) container.style.position = 'relative'
  container.style.overflow = 'hidden'

  // ---- DOM：原版所有东西都往 `#app` 里塞，改造后读 `window.__inudokuRoot` ----
  const root = document.createElement('div')
  root.setAttribute('data-inudoku-root', '')
  root.style.cssText = 'position:absolute;inset:0;overflow:hidden;background:#eee1c4;touch-action:none'
  container.appendChild(root)

  // ---- 每次挂载都要复位「已卸载」闸（上一次卸载会把它置 true）----
  window.__inudokuDead = false
  window.__inudokuRoot = root
  /** 原版写死的相对路径（纸纹 / 狗图 / 金币 / 成就图）统一从这里拼绝对地址 */
  window.__inudokuAsset = assetUrl
  /**
   * 自带 CSS 收进根节点。
   * ★ 不做这一步，`:root` 会改掉宿主的 CSS 变量、`body` 会换掉整个 App 的字体和字色，
   *   而且那份 `<style>` 排在宿主样式之后 ⇒ 一进游戏整个 App 变样，退出也不还原。
   */
  window.__inudokuScopeCss = (css) => scopeCss(css, '[data-inudoku-root]')
  installAssetCss(assetUrl)

  /**
   * 新开一关扣分。`scripts/patch-game.mjs` 把 `qe()` 改成会 `await` 它，
   * 返回 `false` = 不开局（留在原界面）。
   */
  window.__inudokuCharge = async (lv) => {
    try {
      const ok = await host.spendPoints(PLAY_COST, `犬独 · 第 ${lv + 1} 关`)
      if (!ok) {
        host.pushToast?.({
          kind: 'warn',
          title: '积分不够啦',
          detail: `开一关要 ${PLAY_COST} 积分，先去做个任务吧`,
        })
      }
      return ok
    } catch {
      // 扣分接口本身出错时**放行**：孩子已经点进来了，卡在门口更难受。
      return true
    }
  }

  /*
   * 存档 / 成就 / 语言。
   * ★ 必须在 `boot()` 之前：`game.js` 里第一句就读 `gp.player.saves.latestSync`，
   *   而那个值只能是同步的 —— 所以 shim 要先 await 出存档再装。
   */
  let shim
  try {
    shim = await installGpShim({ storage: host.storage, locale: ctx.locale || 'zh' })
    await boot()
  } catch (e) {
    console.error('[inudoku] boot 失败', e)
    // 收干净再抛，否则宿主会留下一个空容器 + 一个还挂着的 shim
    try {
      window.__inudokuTeardown?.()
    } catch {}
    shim?.remove()
    delete window.__inudokuCharge
    delete window.__inudokuAsset
    delete window.__inudokuScopeCss
    delete window.__inudokuRoot
    root.remove()
    if (patchedPos) container.style.position = prevPos
    container.style.overflow = ''
    throw e
  }

  let unmounted = false
  return async function unmount() {
    if (unmounted) return
    unmounted = true
    /*
     * 顺序：先停循环与音频，再摘 DOM，最后还原全局。
     * `__inudokuTeardown` 由 `scripts/patch-game.mjs` 追加在 boot 末尾：
     * 它置 `__inudokuDead`、摘掉 8 个 window 监听、dispose 音频 / 特效 / Pixi。
     */
    try {
      window.__inudokuTeardown?.()
    } catch (e) {
      console.warn('[inudoku] teardown 出错', e)
    }
    window.__inudokuDead = true
    shim?.remove()
    document.documentElement.style.removeProperty('--inudoku-paper')
    delete window.__inudokuCharge
    delete window.__inudokuAsset
    delete window.__inudokuScopeCss
    delete window.__inudokuRoot
    delete window.__inudokuTeardown
    root.remove()
    if (patchedPos) container.style.position = prevPos
    container.style.overflow = ''
  }
}

/** 默认导出 = bundle 形状（宿主 `mod.default ?? mod` 两种都收） */
export default { manifest, mount }
