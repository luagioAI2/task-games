/**
 * 少女战记 · 插件入口（宿主 kid-quest-farm-2d，HOST_API 4）
 *
 * ## 这个文件只管「外壳」
 *
 * 游戏本体是 `game.js` 的 `start(opts)`。独立网页（`index.html`）和这里调的是
 * **同一个函数**，差别全部通过 `opts` 注入 —— 所以 `game.js` 里没有任何
 * `if (isPlugin)` 分支（那种分支会随版本漂移，而且两种形态永远只有一种被跑到）。
 *
 * ## 经济：B 型 —— 只花积分，不产出
 *
 * ```
 *   积分 ──一场战斗 10 分──▶ 战斗 ──▶ 元素水晶 / 无色水晶 / 通关进度（全在游戏存档里）
 * ```
 *
 * | 概念 | 落在哪 | 谁能让它变多 |
 * | --- | --- | --- |
 * | 🪙 积分 | App 的 `db.ledger` | **只有 App**（任务 / 打卡 / 家长调整） |
 * | 💎 元素水晶 | **游戏自己的存档** | 打关卡掉 |
 * | ◇ 无色水晶 | **游戏自己的存档** | 通关掉（Boss 关 3 个、普通关 1 个） |
 *
 * 三条设计判断：
 *
 * 1. **不发兑换券**（`expectedPayout: 0`，`voucherPerCoin` 不写）。
 *    这游戏没有「攒够 N 个换什么」的出口，硬加一条产出线等于凭空造一个经济。
 * 2. **没有游戏币**（不调 `mintGameCoin` / `spendGameCoin`）。
 *    消除 / 养成类加一层「积分 → 币 → 开局」只会多一次点击。
 * 3. **原版的内购面板整个删掉了**（`purchase.js` 148 行）：
 *    女主角 5 平台币解锁 + 无色水晶三档礼包 + 启动时 `settlePurchases()` 补发。
 *    宿主没有付款通道，留着只会是一个点了必然失败的按钮。
 *    同理删掉的还有**排行榜 + 登录**（要联网，插件里只会转圈）。
 *
 * ## 收费点为什么在「进战斗」
 *
 * 这款是关卡制 RPG，有明确的「开始」动作：`enterBattle(n)`。
 * 首次进关 / 下一关 / 失败重试**三条路都走它**，所以扣费写在那一处
 * （`ui.js` 的 `enterBattle` 顶部），不会漏掉某一条。
 * 和放置类的「进场收费 + 宽限期」不同 —— 这里**每一场都是新的一场**，不设宽限。
 */

/** 宿主 API 版本。4 = 有 `mintVoucher`（本作没用到，但和另外五款对齐）。 */
const NEED_HOST_API = 4

// ⚠️ 必须**静态** import：插件在 `blob:` 模块里跑，动态 `import('./x.js')`
//    会以 blob: 为基准解析 ⇒ 加载不到（打包器也会因此拆出第二个文件）。
import { start } from './game.js'
import { makeHostStore } from './src/host.js'

/** 一场战斗的票价（积分）。 */
const PLAY_COST = 10

export const manifest = {
  id: 'moestrike',
  name: '少女战记',
  emoji: '⚔️',
  // 底栏格子：2026-10-26 起宿主放宽到 5 字，这里直接用商城名。
  tabLabel: '少女战记',
  version: '1.0.0',
  minHostApi: NEED_HOST_API,

  // ⚠️ 宿主把 `coin` 当**必填**（`describeManifestProblem` 会拒），但本作
  //    **不发行游戏币** —— `mintGameCoin` / `spendGameCoin` 一次都没调。
  //    游戏里那枚 💎 是存档里的一个数字，不是宿主账本。
  coin: {
    id: 'mgs-gem',
    name: '元素水晶',
    emoji: '💎',
  },

  economy: {
    /** 一场战斗的积分成本 */
    playCost: PLAY_COST,
    /** 一场结束**不发任何券**。见文件头第 1 条。 */
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
  // 容器必须是定位上下文：游戏的画布和 UI 层都是 `position:absolute; inset:0`。
  //
  // ★★ 判据用 **computed style**，不能用 inline style：
  //    宿主给的是 `<div class="absolute inset-0">`，`position:absolute` 写在**类**里，
  //    `container.style.position` 读出来是空字符串。按 inline 判断会误以为「没定位」
  //    ⇒ 补 `relative`，而 inline **胜过**类 ⇒ 盒子退回内容高度，
  //    平板下游戏只占上半屏，而「canvas 高度 == 容器高度」的断言照样绿。
  const patchedPos = getComputedStyle(container).position === 'static'
  const prev = {
    position: container.style.position,
    overflow: container.style.overflow,
    touchAction: container.style.touchAction,
    userSelect: container.style.userSelect,
  }
  if (patchedPos) container.style.position = 'relative'
  container.style.overflow = 'hidden'
  container.style.touchAction = 'none'
  container.style.userSelect = 'none'

  const restore = () => {
    if (patchedPos) container.style.position = prev.position
    container.style.overflow = prev.overflow
    container.style.touchAction = prev.touchAction
    container.style.userSelect = prev.userSelect
  }

  // ---- 资源 ----
  // `ctx.assetBase` 形如 `/games/moestrike/`；`game.js` 里所有 `assets/…` 都过 `A()`。
  const assetBase = typeof ctx.assetBase === 'string' ? ctx.assetBase : ''

  // ---- 存档 ----
  // ★ 必须 **await 完 preload** 再 start()：`start()` 里 `loadSave()` 读的就是这份缓存。
  //   不 await 的话读到的永远是空 Map，症状是「进度从来没被恢复过」且不报错。
  const store = makeHostStore(host.storage)
  try {
    await store.preload()
  } catch (e) {
    console.warn('[moestrike] 读存档失败，按新档开始', e)
  }

  // ---- 开局收费（一场战斗 10 积分）----
  const chargePlay = async () => {
    const deny = (title, detail) => {
      host.pushToast?.({ kind: 'warn', title, detail })
      return false
    }
    // 先看余额只是为了省一次事务 + 更快的反馈；**真正的守卫在 spendPoints 里**
    // （读余额和扣款在同一个事务）。
    try {
      if (typeof host.balance === 'function' && host.balance() < PLAY_COST) {
        return deny('积分不够啦', `打一场要 ${PLAY_COST} 积分 —— 去做个任务攒一点吧`)
      }
      const ok = await host.spendPoints(PLAY_COST, '少女战记 · 一场战斗')
      if (!ok) return deny('积分不够啦', `打一场要 ${PLAY_COST} 积分 —— 去做个任务攒一点吧`)
    } catch (e) {
      // 扣款失败不能放行（否则就是白玩），但也不该让整块界面崩掉
      console.error('[moestrike] 开局扣分失败', e)
      return deny('扣分失败', '稍后再试一次')
    }
    host.tone?.('coin')
    return true
  }

  let destroyGame = null
  try {
    destroyGame = await start({
      mountTo: container,
      assetBase,
      store,
      chargePlay,
    })
  } catch (e) {
    console.error('[moestrike] mount 失败', e)
    restore()
    throw e
  }

  return async function unmount() {
    try {
      await destroyGame?.()
    } catch (e) {
      console.warn('[moestrike] 卸载出错', e)
    }
    // 存档最后落盘：`store` 是内存缓存 + 延迟写，这里不 flush 就丢进度
    try {
      await store.flush()
    } catch (e) {
      console.warn('[moestrike] 存档落盘失败', e)
    }
    restore()
  }
}

/** 默认导出 = bundle 形状（宿主两种都收：`mod.default ?? mod`）。 */
export default { manifest, mount }
