/**
 * 细胞守卫 · 插件入口（宿主 kid-quest-farm-2d，HOST_API 4）
 *
 * ## 这个文件只管「外壳」
 *
 * 游戏本体是 `game.js` 的 `start(opts)`。独立网页（`index.html`）和这里调的是
 * **同一个函数**，差别全部通过 `opts` 注入 —— 所以 `game.js` 里没有 `if (isPlugin)` 分支。
 *
 * ## 经济：C 型 —— 纯玩，一分产出都没有
 *
 * ```
 *   积分 ──开一局 10 分──▶ 打完一波一波的病毒 ──▶ 金币 / 钻石（只在游戏自己的存档里）
 * ```
 *
 * | 概念 | 落在哪 | 谁能让它变多 |
 * | --- | --- | --- |
 * | 🪙 积分 | App 的 `db.ledger` | **只有 App**（任务 / 打卡 / 家长调整） |
 * | 💰 金币 / 💠 钻石 / 🔑 钥匙 | **游戏自己的存档** | 打赢关卡、领进度宝箱 |
 *
 * 三条设计判断：
 *
 * 1. **不发兑换券**（`expectedPayout: 0`）。金币与钻石只在游戏内买武器箱 / 钥匙 /
 *    升级英雄，**没有对外的出口**，硬加一条产出线等于凭空造一个经济。
 * 2. **没有宿主游戏币**（不调 `mintGameCoin` / `spendGameCoin`）。
 * 3. **原版的「不上线就亏」全拆了**：体力（能量）与它的恢复计时、每日任务、
 *    七日签到、挂机宝箱、商店里的「每日免费补给」—— 这些是把手游留在孩子手机上的钩子，
 *    和这个 App 的目的（用游戏换任务）正好相反。拆法见 `ONBOARD.md`。
 *
 * ## 收费点为什么在「开始战斗」
 *
 * 这款的一局边界很清楚：点「开始战斗」→ 打一关 → 结算页「返回」。
 * 扣费写在 `game.js` 的 `i`（开始按钮的处理函数）一处，**「继续战斗」不收费**
 * （那是接着同一局打，已经付过）。每局都收，不设宽限期 —— 不是放置类，
 * 没有「挂机也被收」的问题。
 */

/** 宿主 API 版本。4 = 有 `mintVoucher`（本作没用到，但和另外十几款对齐）。 */
const NEED_HOST_API = 4

// ⚠️ 必须**静态** import：插件在 `blob:` 模块里跑，动态 `import('./x.js')`
//    会以 blob: 为基准解析 ⇒ 加载不到（打包器也会因此拆出第二个文件）。
import { start } from './game.js'

/** 一局的票价（积分）。 */
const PLAY_COST = 10

export const manifest = {
  id: 'cellguard',
  name: '细胞守卫',
  emoji: '🦠',
  tabLabel: '细胞守卫',
  version: '1.0.0',
  minHostApi: NEED_HOST_API,

  // ⚠️ 宿主把 `coin` 当**必填**（`describeManifestProblem` 会拒），但本作
  //    **不发行宿主游戏币** —— `mintGameCoin` / `spendGameCoin` 一次都没调。
  //    钻石是游戏存档里的一个数字，不是宿主账本。
  //
  // ★ emoji **不能**用 🪙 / 🎟️ / 💎 / 🕹️ —— 那四个宿主已经占了。
  coin: {
    id: 'cg-gem',
    name: '钻石',
    emoji: '💠',
  },

  economy: {
    /** 一局的积分成本 */
    playCost: PLAY_COST,
    /** 一局结束**不发任何券**。见文件头第 1 条。 */
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
 *   · 存档只能走 `host.storage` —— 键固定 `save`（整份进度 + 战斗快照）。
 */
export async function mount(container, host, ctx = {}) {
  // 容器必须是定位上下文：`.root` 是 `position:absolute; inset:0`。
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
  // `createAutosave` 要一个**同步**的 `latestSync`（挂载时读一次），所以先把整份
  // 进度 await 出来再 start()。不 await 的话读到的永远是空档，症状是
  // 「每次都从第 1 章开始」而且不报错。
  //
  // ★ 适配层里被 `.then()` 调的方法**必须返回 Promise**（`saves.js` 里
  //   `await api.putLatest(...)`，写错成同步返回 undefined 会在存档时静默丢档）。
  let saved
  try {
    saved = await host.storage.get('save')
  } catch (e) {
    console.warn('[cellguard] 读存档失败，按新档开始', e)
  }
  const store = {
    latestSync: saved ?? null,
    putLatest: async (data) => {
      try {
        await host.storage.set('save', data)
        return true
      } catch (e) {
        console.warn('[cellguard] 写存档失败', e)
        return false
      }
    },
    clearLatest: async () => {
      try {
        await host.storage.set('save', null)
        return true
      } catch (e) {
        console.warn('[cellguard] 清存档失败', e)
        return false
      }
    },
  }

  // ---- 开局收费（一局 10 积分）----
  const chargePlay = async () => {
    const deny = (title, detail) => {
      host.pushToast?.({ kind: 'warn', title, detail })
      return false
    }
    // 先看余额只是为了省一次事务 + 更快的反馈；**真正的守卫在 spendPoints 里**
    // （读余额和扣款在同一个事务）。
    try {
      if (typeof host.balance === 'function' && host.balance() < PLAY_COST) {
        return deny('积分不够啦', `玩一局要 ${PLAY_COST} 积分 —— 去做个任务攒一点吧`)
      }
      const ok = await host.spendPoints(PLAY_COST, '细胞守卫 · 打一局')
      if (!ok) return deny('积分不够啦', `玩一局要 ${PLAY_COST} 积分 —— 去做个任务攒一点吧`)
    } catch (e) {
      // 扣款失败不能放行（否则就是白玩），但也不该让整块界面崩掉
      console.error('[cellguard] 开局扣分失败', e)
      return deny('扣分失败', '稍后再试一次')
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
    console.error('[cellguard] mount 失败', e)
    restore()
    throw e
  }

  return async function unmount() {
    try {
      await destroyGame?.()
    } catch (e) {
      console.warn('[cellguard] 卸载出错', e)
    }
    restore()
  }
}

/** 默认导出 = bundle 形状（宿主两种都收：`mod.default ?? mod`）。 */
export default { manifest, mount }
