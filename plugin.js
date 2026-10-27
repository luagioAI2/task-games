/**
 * 尖叫鸡 · 插件入口（宿主 kid-quest-farm-2d，HOST_API 4）
 *
 * ## 这个文件只管「外壳」
 *
 * 游戏本体是 `game.js` 的 `start(opts)`。独立网页（`index.html`）和这里调的是
 * **同一个函数**，差别全部通过 `opts` 注入（见 `game.js` 顶部那张表）。
 *
 * ## 经济：C 型 —— 纯玩，不产出
 *
 * ```
 *   积分 ──进关门票──▶ 一关（滑到铺满地面）──▶ 什么都没有
 * ```
 *
 * | 概念 | 落在哪 | 谁能让它变多 |
 * | --- | --- | --- |
 * | 🪙 积分 | App 的 `db.ledger` | **只有 App**（任务 / 打卡 / 家长调整） |
 * | ⭐ 星星 | **游戏自己的存档** | 玩出来的（过关 / 吃光零食 / 一次通过），跟 App 的账本无关 |
 *
 * 三条判断：
 *
 * 1. **不发兑换券**（`expectedPayout: 0`）。原版就没有「攒够 N 个换什么」的出口，
 *    硬塞一条产出线等于凭空造经济。
 * 2. **没有游戏币**。一关一次扣款，中间再加一层「积分 → 币 → 门票」只会多一次点击。
 * 3. **收费点在「进关」，不在「每关」**：过关后点『下一关』不收、撞死了『重玩』也不收 ——
 *    前者是奖励，后者是同一个关。只有「从标题页 / 关卡列表主动点进去」才算新的一局。
 *    这也是本作不需要宽限期的原因：没有「一进来就扣一次」的进场费。
 *
 * ## 原版里删掉的东西
 *
 * - **内购**：`window.gp.pay.purchase` 卖「3 星直通券」（1 平台金币/关），
 *   以及待交付订单恢复（`checkPending`）。宿主没有支付能力，而且「花钱跳关」
 *   在一个「用积分换游戏时间」的产品里是多余的一层。
 * - **平台字体服务** `window.gp.fonts.use`：改成包里自带的 woff2。
 * - **`window.__gpReady` / `window.__gpPlayable`**：平台就绪标记，宿主不看，
 *   留着反而会让第二次挂载的「已就绪」判据立刻为真。
 */

/** 宿主 API 版本。4 = 有 `mintVoucher`（本作没用，但和其余几款对齐）。 */
const NEED_HOST_API = 4

/** 一次进关的票价（积分）。 */
const PLAY_COST = 10

// ⚠️ 必须**静态** import：插件在 `blob:` 模块里跑，动态 `import('./x.js')`
//    会以 blob: 为基准解析 ⇒ 加载不到（打包器也会因此拆出第二个文件）。
import { start } from './game.js'
import { makeHostStore } from './src/host.js'

export const manifest = {
  id: 'screamchick',
  name: '尖叫鸡',
  emoji: '🐔',
  // 底栏一格只有约 5 个字宽；「尖叫鸡」三个字，和「农场」「抓娃娃」不撞。
  tabLabel: '尖叫鸡',
  version: '1.0.0',
  minHostApi: NEED_HOST_API,

  // 宿主把 `coin` 当**必填**（`describeManifestProblem` 会拒），但本作不发行游戏币 ——
  // `mintGameCoin` / `spendGameCoin` 一次都没调，币余额恒为 0。
  // 这个名字只出现在设置页那句「期望产出 0 ⭐」里。
  coin: {
    id: 'screamchick-star',
    name: '星星',
    emoji: '⭐',
  },

  economy: {
    /** 一次进关的积分成本 */
    playCost: PLAY_COST,
    /** 一关打完**不发任何券**。见文件头第 1 条。 */
    expectedPayout: 0,
    /** 本作没有「单件产出」，占位为 1（闸门要求 ≥ 1） */
    capPerPrize: 1,
    // `voucherPerCoin` 故意不写 = 不开放「币 → 券」兑换。
  },
}

/**
 * 挂载。
 *
 * ⚠️ 契约要点（宿主 `plugin.ts`）：
 *   · 返回值可以是 `Unmount` 或 `Promise<Unmount>`，宿主会 `await` 它；
 *   · `unmount` **必须能在「刚建好就被调用」时安全执行**（孩子秒切 tab）；
 *   · 所有资源走 `ctx.assetUrl()` —— 相对路径在 `blob:` 模块里以 blob: 为基准 ⇒ 全 404。
 */
export async function mount(container, host, ctx = {}) {
  // 容器必须是定位上下文：游戏按容器尺寸排版，canvas 铺满它。
  //
  // ★★ 判据用 **computed style**，不能用 inline style：
  //    宿主给的是 `<div class="absolute inset-0">`，`position:absolute` 写在**类**里，
  //    `container.style.position` 读出来是空字符串。按 inline 判断会误以为「没定位」
  //    ⇒ 补 `relative`，而 inline **胜过**类 ⇒ 盒子退回内容高度（平板实测 966 → 600），
  //    底部多一条空白带，而所有「canvas 高度 == 容器高度」的断言照样绿。
  const patchedPos = getComputedStyle(container).position === 'static'
  const prevPos = container.style.position
  const prevOverflow = container.style.overflow
  const prevTouch = container.style.touchAction
  const prevSelect = container.style.userSelect
  if (patchedPos) container.style.position = 'relative'
  container.style.overflow = 'hidden'
  // 滑屏是核心操作：不禁掉浏览器手势的话，竖滑会被当成滚动页面
  container.style.touchAction = 'none'
  container.style.userSelect = 'none'

  // ---- 样式作用域 ----
  // 独立网页的 `html,body,#app{...}` 在插件形态下**不能**注入（那会改宿主的页面）。
  // 这里只补一条真正需要的：canvas 默认是 inline，底部会多出几像素基线间隙。
  const scope = 'screamchick-' + Math.random().toString(36).slice(2, 8)
  container.classList.add(scope)
  const styleEl = document.createElement('style')
  styleEl.textContent = `.${scope} canvas{display:block}`
  document.head.appendChild(styleEl)

  // ---- 资源 ----
  const assetUrl =
    typeof ctx.assetUrl === 'function' ? (rel) => ctx.assetUrl(rel) : (rel) => String(ctx.assetBase || '') + rel

  // ---- 存档 ----
  // ★ 必须 **await 完** 再 start()：`start()` 里「读存档决定初始状态」的那几句
  //   跑在注入之后，但它们读的是这份缓存。不 await 的话读到的永远是空 Map，
  //   症状是「进度从来没被恢复过」且不报错。
  const store = makeHostStore(host.storage)
  try {
    await store.preload()
  } catch (e) {
    console.warn('[screamchick] 读存档失败，按新档开始', e)
  }

  // ---- 进关收费 ----
  let paid = 0
  const chargePlay = async () => {
    // 先看余额只是为了省一次事务 + 给出更快的反馈；
    // **真正的守卫在 spendPoints 里**（读余额和扣款在同一个事务）。
    try {
      if (typeof host.balance === 'function' && host.balance() < PLAY_COST) {
        host.pushToast?.({
          kind: 'warn',
          title: '积分不够啦',
          detail: `进一关要 ${PLAY_COST} 积分 —— 去做个任务攒一点吧`,
        })
        return false
      }
      const ok = await host.spendPoints(PLAY_COST, '尖叫鸡 · 进关')
      if (!ok) {
        host.pushToast?.({
          kind: 'warn',
          title: '积分不够啦',
          detail: `进一关要 ${PLAY_COST} 积分 —— 去做个任务攒一点吧`,
        })
        return false
      }
    } catch (e) {
      // 扣款失败不能放行（否则就是「白玩」），但也不该让整局崩掉
      console.error('[screamchick] 进关扣分失败', e)
      host.pushToast?.({ kind: 'warn', title: '扣分失败', detail: '稍后再试一次' })
      return false
    }
    paid++
    host.tone?.('coin')
    return true
  }

  let unmountGame = null
  try {
    unmountGame = await start({
      mountTo: container,
      asset: assetUrl,
      assetBase: typeof ctx.assetBase === 'string' ? ctx.assetBase : '',
      store,
      chargePlay,
      locale: ctx.locale,
    })
  } catch (e) {
    // 挂载失败也要把容器还原，否则宿主看到的是一块被改过的空白
    console.error('[screamchick] mount 失败', e)
    try {
      styleEl.remove()
    } catch {
      /* 已摘 */
    }
    container.classList.remove(scope)
    if (patchedPos) container.style.position = prevPos
    container.style.overflow = prevOverflow
    container.style.touchAction = prevTouch
    container.style.userSelect = prevSelect
    throw e
  }

  return async function unmount() {
    try {
      await unmountGame?.()
    } catch (e) {
      console.warn('[screamchick] 卸载出错', e)
    }
    // 存档最后落盘：`store` 是内存缓存 + 延迟写，这里不 flush 就丢进度
    try {
      await store.flush()
    } catch (e) {
      console.warn('[screamchick] 存档落盘失败', e)
    }
    try {
      styleEl.remove()
    } catch {
      /* 已摘 */
    }
    container.classList.remove(scope)
    // 只还原**我们改过的那几项**；宿主自己的 inline 值一律不碰
    if (patchedPos) container.style.position = prevPos
    container.style.overflow = prevOverflow
    container.style.touchAction = prevTouch
    container.style.userSelect = prevSelect
  }
}

/** 默认导出 = bundle 形状（宿主两种都收：`mod.default ?? mod`）。 */
export default { manifest, mount }
