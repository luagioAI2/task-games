/**
 * 下落的2048 · 插件入口（宿主 kid-quest-farm-online，HOST_API 4）
 *
 * ## 这个文件和 `index.html` 的关系
 *
 * | | `index.html`（独立网页） | `plugin.js`（本文件） |
 * | --- | --- | --- |
 * | 资源 | 相对文档 | `ctx.assetUrl()` |
 * | 存档 | 没有（`window.gp` 不存在 ⇒ 原版走内存） | `host.storage`（经 `gp-shim.js`） |
 * | 容器 | `<div id="app">` 铺满窗口 | `mount(container)` 给的，`#app` 铺满它 |
 * | 经济 | 无 | 开一局扣 1 积分 |
 *
 * ## 为什么改造面这么小
 *
 * 原版对 `window.gp` 的每一处引用都是可选链，`window.gp` 为 `undefined` 时
 * 游戏照样能跑完整一局（只是没存档、没名字、没排行榜、没内购）。
 * 所以我们**没有改玩法代码**，只做了四件事：
 *
 * 1. `gp-shim.js` 补一个 `window.gp`（存档 / 名字 / 语言）
 * 2. `game.js` 里加「已卸载」闸 + 暴露 teardown（不然切走 tab 后 rAF 还在跑）
 * 3. `game.js` 里把「开奖 / 新游戏」套一层扣分闸（`ie` → `ie0`）
 * 4. 排行榜数据源从 `topScores` 换成 `myScores`（本地成绩）
 *
 * 内购**一行都没删**：原版自己写着 `if (!window.gp?.pay?.available) return`，
 * 我们不给 `pay`，真钱续关就走不到；前面那条免费续关仍然保留。
 *
 * ## 经济：只花积分，不产出券
 *
 * ```
 *   积分 ──开一局扣 1──▶ 玩 ──▶ 什么都没发
 * ```
 *
 * 所以 `expectedPayout: 0`、`voucherPerCoin: 0`，商城分类用 `chill`
 * （和「甜点魔法学院」「蚂蚁搬家」同一类：花积分换一段时间，不发券）。
 *
 * 游戏里那枚 🪙 是**它自己的金币**（打方块掉、买升级/皮肤用），
 * 和 App 的积分是两套账 —— 它不进 `gameKv` 的币账本，也不走 `mintGameCoin`。
 * 这一点很重要：`playCost: 1` 已经收过钱了，再让它的金币能换券就是二次变现。
 */
import { boot } from './game.js'
import { installGpShim } from './gp-shim.js'

/** 一局要扣多少积分。改这里就够了 —— 下面 `charge()` 读的是同一个常量。 */
const PLAY_COST = 1

export const manifest = {
  id: 'fall2048',
  name: '下落的2048',
  emoji: '🔢',
  /** 底部导航上的文字，≤5 字 */
  tabLabel: '2048',
  /**
   * 1.0.1 = 金币图标改走 `window.__fall2048Asset`（原版写死的相对路径在插件里 404，
   *         而且**不报错**，症状只是「金币变成一个纯色圆」）。
   * 1.0.2 = 设置里「重置数据」的说明不再说「排行榜最高分保存在服务器上」——
   *         排行榜早就换成本地成绩了，那句话是假话。实际行为是重置前先存一份
   *         「重置前的记录」（`sn()` 里 push 进 `a.history`）。
   */
  version: '1.0.2',
  /**
   * 用到 `host.storage`（存档）和 `ctx.assetUrl`（资源），两者都在 API 3 落地。
   * 宿主当前是 4，写 3 表示「3 及以上都能跑」。
   */
  minHostApi: 3,

  coin: {
    /**
     * 本作**不发行**游戏币（`mintGameCoin` / `spendGameCoin` 一次都不调），
     * 这里只是 manifest 的必填项。余额恒为 0，兑换率 0 ⇒ 家长看不到假的兑换说明。
     */
    id: 'tile',
    name: '方块',
    emoji: '🧩',
  },

  economy: {
    /** 一局扣 1 积分 */
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
 * ⚠️ 契约要点（宿主 `plugin.ts`）：
 *   · 返回值可以是 `Unmount` 或 `Promise<Unmount>`，宿主会 `await`；
 *   · `unmount` **必须能在「刚建好就被调用」时安全执行**（孩子秒切 tab）；
 *   · 资源一律走 `ctx.assetUrl()` —— 插件跑在 `blob:` 模块里，相对路径会以
 *     `blob:` 为基准解析 ⇒ 全 404。
 */
export async function mount(container, host, ctx = {}) {
  const assetUrl =
    typeof ctx.assetUrl === 'function'
      ? (rel) => ctx.assetUrl(rel)
      : (rel) => String(ctx.assetBase || '') + rel

  /*
   * 容器必须是定位上下文。
   *
   * ★ 判据用 **computed style**，不能用 `container.style.position`：
   *   宿主给的是 `<div class="absolute inset-0">`，定位写在**类**里，
   *   inline 读出来是空串。按 inline 判断会误以为「没定位」，然后写 inline
   *   `relative` —— inline 胜过类，于是这个盒子从「绝对定位铺满」变成
   *   「普通流里的相对定位」，`inset-0` 的 `bottom` 失效、高度退回内容高度。
   */
  const patchedPos = getComputedStyle(container).position === 'static'
  const prevPos = container.style.position
  if (patchedPos) container.style.position = 'relative'
  container.style.overflow = 'hidden'

  // ---- DOM：原版用 `document.getElementById("app")` 找舞台 ----
  const root = document.createElement('div')
  root.setAttribute('data-fall2048-root', '')
  root.style.cssText =
    'position:absolute;inset:0;overflow:hidden;touch-action:none;background:#1a0638'
  const app = document.createElement('div')
  app.id = 'app'
  app.setAttribute('data-mp-stage', '')
  app.setAttribute('data-mp-hud', 'canvas')
  app.style.cssText =
    'position:absolute;inset:0;touch-action:none;user-select:none;-webkit-user-select:none'
  root.appendChild(app)
  container.appendChild(root)

  // ---- 每次挂载都要把「已卸载」闸复位（上一次卸载会把它置 true）----
  window.__fall2048Dead = false
  /** 音频清单必须是绝对地址：sound-1.js 会拿它当 base 去拼 `sound.pack` */
  window.__fall2048SoundManifest = assetUrl('sound.manifest.json')
  /**
   * 给游戏里那条**写死的相对路径**用。
   *
   * 原版画金币时是 `new Image().src = "assets/ui/icon_coin_selected.svg"` ——
   * 相对**文档**解析。插件挂在 `/` 下，它就变成 `/assets/ui/...`：
   * 本地预览会拿到 SPA 兜底的 index.html（200 但解码失败），线上直接 404。
   * 两种都不报错，症状只是「金币变成一个纯色圆」。
   */
  window.__fall2048Asset = assetUrl

  /** 开局扣分。原版 `ie()` 的补丁会 `await` 它，`false` = 不开局。 */
  const charge = async () => {
    try {
      const ok = await host.spendPoints(PLAY_COST, '下落的2048 · 开一局')
      if (!ok) {
        host.pushToast?.({
          kind: 'warn',
          title: '积分不够啦',
          detail: `开一局要 ${PLAY_COST} 积分，先去做个任务吧`,
        })
      }
      return ok
    } catch {
      // 扣分接口本身出错时**放行**：孩子已经点进来了，卡在门口更难受。
      return true
    }
  }
  window.__fall2048 = { charge }

  // ---- 存档 / 名字 / 语言 ----
  // 必须在 `boot()` 之前装：原版第一行就把 `window.gp` 抓进局部变量了。
  const removeShim = installGpShim({
    storage: host.storage,
    locale: ctx.locale || 'zh',
    playerName: '小客人',
  })

  let unmounted = false
  try {
    await boot({})
  } catch (e) {
    console.error('[fall2048] boot 失败', e)
    // 收干净再抛，否则宿主会留下一个空容器 + 一个跑着的 shim
    removeShim()
    root.remove()
    if (patchedPos) container.style.position = prevPos
    container.style.overflow = ''
    throw e
  }

  return async function unmount() {
    if (unmounted) return
    unmounted = true
    /*
     * 顺序：先停循环与音频，再摘 DOM，最后还原全局。
     *
     * `__fall2048Teardown` 是 `game.js` 在 `__gpReady` 那一拍挂上的：
     * 它把 `__fall2048Dead` 置 true（`ws()` 每帧开头就 return），
     * 并 dispose 掉 sound 与 display（display 会摘 window resize / DPR 监听）。
     */
    try {
      window.__fall2048Teardown?.()
    } catch (e) {
      console.warn('[fall2048] teardown 出错', e)
    }
    window.__fall2048Dead = true
    removeShim()
    delete window.__fall2048
    delete window.__fall2048SoundManifest
    delete window.__fall2048Asset
    root.remove()
    if (patchedPos) container.style.position = prevPos
    container.style.overflow = ''
  }
}

/** 默认导出 = bundle 形状（宿主 `mod.default ?? mod` 两种都收）。 */
export default { manifest, mount }
