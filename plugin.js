/**
 * 别按红按钮 · 插件入口（宿主 kid-quest-farm-2d，HOST_API 4）
 *
 * ## 这个文件只管「外壳」
 *
 * 游戏本体是 `game.js` 的 `start(opts)`。独立网页（`index.html`）和这里调的是
 * **同一个函数**，差别全部通过 `opts` 注入 —— 所以 `game.js` 里没有 `if (isPlugin)` 分支。
 *
 * ## 经济：C 型 —— 纯玩，一分产出都没有
 *
 * ```
 *   积分 ──进场 10 分──▶ 按红按钮 ──▶ 金币 / 宝石（只在游戏自己的存档里）
 * ```
 *
 * | 概念 | 落在哪 | 谁能让它变多 |
 * | --- | --- | --- |
 * | 🪙 积分 | App 的 `db.ledger` | **只有 App**（任务 / 打卡 / 家长调整） |
 * | 💰 金币 / 💠 宝石 / 🎟 转盘券 | **游戏自己的存档** | 按按钮、宝箱、抽奖、转生 |
 *
 * 三条设计判断：
 *
 * 1. **不发兑换券**（`expectedPayout: 0`）。金币只用来买升级 / 抽扭蛋，宝石只用来
 *    抽扭蛋与皮肤，**没有对外的出口**，硬加一条产出线等于凭空造一个经济。
 * 2. **没有宿主游戏币**（不调 `mintGameCoin` / `spendGameCoin`）。
 * 3. **原版的「不上线就亏」全拆了**：内购商店、排行榜与登录、云存档握手、平台字体，
 *    以及幸运转盘「每 4 小时 1 次免费」的倒计时 —— 拆法见 `ONBOARD.md`。
 *
 * ## 收费点为什么是「这一档的第一下按键」
 *
 * 这是**放置点击器**：没有「开始一局」这个动作，进来就是一直按那颗红按钮。
 * 所以把「一局」定义成「一次进场的第一下」——扣费发生在 `game.js` 的 `pressManual()`
 * 里（真实点击与空格键都走它），**收过就不再收**。
 *
 * ★ 宽限期靠**存档里的 `paidAt`**：孩子切去做个任务再切回来不该再收一次。
 *   不能记在内存变量里 —— 切走就是卸载，内存当场没了，宽限期会静默失效（每次都扣）。
 */

/** 宿主 API 版本。4 = 有 `mintVoucher`（本作没用到，但和另外十几款对齐）。 */
const NEED_HOST_API = 4

// ⚠️ 必须**静态** import：插件在 `blob:` 模块里跑，动态 `import('./x.js')`
//    会以 blob: 为基准解析 ⇒ 加载不到（打包器也会因此拆出第二个文件）。
import { start } from './game.js'

/** 一次进场的票价（积分）。 */
const PLAY_COST = 10

/** 付过之后多久内再进来不重复收（毫秒）。 */
const GRACE_MS = 10 * 60 * 1000

/** 存档里记「上次付钱」的那个键。 */
const PAID_KEY = 'paidAt'

export const manifest = {
  id: 'redbutton',
  name: '别按红按钮',
  emoji: '🔴',
  // 底栏一格约 5 个字宽；「别按红按钮」正好 5 个，和「收租公寓」「尖叫鸡」不撞。
  tabLabel: '别按红按钮',
  version: '1.0.1',
  minHostApi: NEED_HOST_API,

  // ⚠️ 宿主把 `coin` 当**必填**（`describeManifestProblem` 会拒），但本作
  //    **不发行宿主游戏币** —— `mintGameCoin` / `spendGameCoin` 一次都没调。
  //    金币是游戏存档里的一个数字，不是宿主账本。
  //
  // ★ emoji **不能**用 🪙 / 🎟️ / 💎 / 🕹️ —— 那四个宿主已经占了。
  coin: {
    id: 'rb-coin',
    name: '金币',
    emoji: '🟡',
  },

  economy: {
    /** 一次进场的积分成本 */
    playCost: PLAY_COST,
    /** 进场**不发任何券**。见文件头第 1 条。 */
    expectedPayout: 0,
    /** 本作没有「单件产出」，占位为 1（闸门要求 ≥ 1） */
    capPerPrize: 1,
    // `voucherPerCoin` 故意不写 = 不开放「币 → 券」兑换。
  },

  /** 完全不产出宿主资源 ⇒ 说明文案不能写「花积分换币」。 */
  kind: 'chill',
}

/**
 * 挂载。
 *
 * ⚠️ 契约要点（宿主 `plugin.ts`）：
 *   · 返回值可以是 `Unmount` 或 `Promise<Unmount>`，宿主会 `await` 它；
 *   · `unmount` **必须能在「刚建好就被调用」时安全执行**（孩子秒切 tab）；
 *   · 存档只能走 `host.storage` —— 键 `save`（整份进度）+ `paidAt`（宽限期）。
 */
export async function mount(container, host, ctx = {}) {
  // 容器必须是定位上下文：`#rb-root` 是 `position:absolute; inset:0`。
  //
  // ★★ 判据用 **computed style**，不能用 inline style：
  //    宿主给的是 `<div class="absolute inset-0">`，`position:absolute` 写在**类**里，
  //    `container.style.position` 读出来是空字符串。按 inline 判断会误以为「没定位」
  //    ⇒ 补 `relative`，而 inline **胜过**类 ⇒ `inset-0` 的 bottom 失效，
  //    盒子退回内容高度，平板下游戏只占上半屏，而「canvas 高度 == 容器高度」照样绿。
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

  // ---- 存档 ----
  // `game.js` 里 `decodeSave(saveApi?.latestSync)` 是**同步**读的（挂载时读一次），
  // 所以必须先把整份进度 await 出来再 start()。不 await 的话读到的永远是空档，
  // 症状是「每次都从 0 金币开始」而且不报错。
  //
  // ★ 适配层里被 `.then()` 调的方法**必须返回 Promise**：`save()` 里是
  //   `void sv.putLatest(...).then(...)`，写错成同步返回 undefined 会在存档时静默丢档。
  let saved = null
  let paidAt = 0
  try {
    saved = (await host.storage.get('save')) ?? null
    paidAt = Number(await host.storage.get(PAID_KEY)) || 0
  } catch (e) {
    console.warn('[redbutton] 读存档失败，按新档开始', e)
  }
  const store = {
    latestSync: saved,
    putLatest: async (data) => {
      try {
        await host.storage.set('save', data)
        return true
      } catch (e) {
        console.warn('[redbutton] 写存档失败', e)
        return false
      }
    },
    clearLatest: async () => {
      try {
        await host.storage.set('save', null)
        return true
      } catch (e) {
        console.warn('[redbutton] 清存档失败', e)
        return false
      }
    },
  }

  // ---- 进场收费（10 分钟宽限，见文件头）----
  const chargePlay = async () => {
    if (Date.now() - paidAt < GRACE_MS) return true

    const deny = (title, detail) => {
      host.pushToast?.({ kind: 'warn', title, detail })
      return false
    }
    // 先看余额只是为了省一次事务 + 更快的反馈；**真正的守卫在 spendPoints 里**
    // （读余额和扣款在同一个事务）。
    try {
      if (typeof host.balance === 'function' && host.balance() < PLAY_COST) {
        return deny('积分不够啦', `进场要 ${PLAY_COST} 积分 —— 去做个任务攒一点吧`)
      }
      const ok = await host.spendPoints(PLAY_COST, '别按红按钮 · 进场')
      if (!ok) return deny('积分不够啦', `进场要 ${PLAY_COST} 积分 —— 去做个任务攒一点吧`)
    } catch (e) {
      // 扣款失败不能放行（否则就是白玩），但也不该让整块界面崩掉
      console.error('[redbutton] 进场扣分失败', e)
      return deny('扣分失败', '稍后再试一次')
    }
    paidAt = Date.now()
    try {
      await host.storage.set(PAID_KEY, paidAt)
    } catch (e) {
      // 落盘失败不影响这一档继续玩，只是下次进来会再收一次
      console.warn('[redbutton] paidAt 落盘失败', e)
    }
    host.tone?.('coin')
    return true
  }

  let destroyGame = null
  try {
    destroyGame = await start({
      container,
      store,
      chargePlay,
    })
  } catch (e) {
    console.error('[redbutton] mount 失败', e)
    restore()
    throw e
  }

  return async function unmount() {
    try {
      await destroyGame?.()
    } catch (e) {
      console.warn('[redbutton] 卸载出错', e)
    }
    restore()
  }
}

/** 默认导出 = bundle 形状（宿主两种都收：`mod.default ?? mod`）。 */
export default { manifest, mount }
