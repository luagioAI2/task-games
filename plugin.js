/**
 * 轮班守卫 · 插件入口（宿主 kid-quest-farm-2d，HOST_API 4）
 *
 * ## 这个文件只管「外壳」
 *
 * 游戏本体是 `game.js` 的 `start(opts)`。独立网页（`index.html`）和这里调的是
 * **同一个函数**，差别全部通过 `opts` 注入 —— `game.js` 里没有 `if (isPlugin)` 分支。
 *
 * ## 经济：C 型 —— 纯玩，一分产出都没有
 *
 * ```
 *   积分 ──开一关 10 分──▶ 塔防一局 ──▶ 金币（关卡内）/ 钻石（永久强化）
 * ```
 *
 * | 概念 | 落在哪 | 谁能让它变多 |
 * | --- | --- | --- |
 * | 🪙 积分 | App 的 `db.ledger` | **只有 App**（任务 / 打卡 / 家长调整） |
 * | 💰 金币 | 一局之内的资源 | 打死敌人（**出关就没了**，不跨局累计） |
 * | 💠 钻石 | 游戏自己的存档 | 通关、BOSS 关；只能点「永久强化」 |
 *
 * 三条设计判断：
 *
 * 1. **不发兑换券**（`expectedPayout: 0`）。钻石只有一个出口（永久强化），
 *    硬加一条对外产出线等于凭空造一个经济。
 * 2. **没有宿主游戏币**（不调 `mintGameCoin` / `spendGameCoin`）。
 * 3. 原版**本来就没有**体力 / 日常 / 签到 / 抽卡 / 排行榜 —— 唯一要拆的是
 *    「登录后可保存游戏进度」那一行（`window.gp.player.requestLogin`）。
 *
 * ## 收费点为什么在「出阵」
 *
 * 关卡制，一局的边界很清楚：选关 → 卡组页点「出阵」→ 打完（胜/负）→ 返回。
 * 扣费写在 `ui.js` 那个按钮里，**「重试」不收费**（接着同一局打，已经付过）。
 * 进 tab、看关卡列表、看伙伴图鉴、点永久强化**都不收** —— 只是翻菜单。
 */

/** 宿主 API 版本。4 = 有 `mintVoucher`（本作没用到，但和另外十几款对齐）。 */
const NEED_HOST_API = 4

// ⚠️ 必须**静态** import：插件在 `blob:` 模块里跑，动态 `import('./x.js')`
//    会以 blob: 为基准解析 ⇒ 加载不到（打包器也会因此拆出第二个文件）。
import { start } from './game.js'

/** 一关的票价（积分）。 */
const PLAY_COST = 10

export const manifest = {
  id: 'guardshift',
  name: '轮班守卫',
  emoji: '🏰',
  tabLabel: '轮班守卫',
  version: '1.0.0',
  minHostApi: NEED_HOST_API,

  // ⚠️ 宿主把 `coin` 当**必填**（`describeManifestProblem` 会拒），但本作
  //    **不发行宿主游戏币** —— 钻石是游戏存档里的一个数字，不是宿主账本。
  //
  // ★ emoji **不能**用 🪙 / 🎟️ / 💎 / 🕹️ —— 那四个宿主已经占了。
  coin: {
    id: 'gs-gem',
    name: '钻石',
    emoji: '💠',
  },

  economy: {
    /** 一关的积分成本 */
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
 *   · 存档只能走 `host.storage` —— 键固定 `save`。
 */
export async function mount(container, host, ctx = {}) {
  // 容器必须是定位上下文：`.gs` 是 `position:relative`，`.ui` 是 `position:absolute;inset:0`。
  //
  // ★★ 判据用 **computed style**，不能用 inline style：宿主给的是
  //    `<div class="absolute inset-0">`，`position:absolute` 写在**类**里，
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
  // 游戏那边的接口是 `getLatest()` / `putLatest(data, "kv")`（Promise 版），
  // 所以适配层这两个**必须真的返回 Promise**；写成同步返回会在存档时静默丢档。
  //
  // ★ 先把旧档读出来再 start()：不 await 的话第一次 `ft()` 拿到的永远是空，
  //   症状是「每次都从第 1 关开始」而且不报错。
  let saved
  try {
    saved = await host.storage.get('save')
  } catch (e) {
    console.warn('[guardshift] 读存档失败，按新档开始', e)
  }

  let primed = saved && typeof saved === 'object' ? { data: saved } : null
  const store = {
    ready: Promise.resolve(),
    get lastError() {
      return null
    },
    async getLatest() {
      return primed
    },
    async putLatest(data) {
      try {
        await host.storage.set('save', data)
        // 写成功后把内存里那份换掉：宿主重挂载前可能再读一次
        primed = { data }
        return true
      } catch (e) {
        console.warn('[guardshift] 写存档失败', e)
        return false
      }
    },
  }

  // ---- 开局收费（一关 10 积分）----
  const chargePlay = async () => {
    const deny = (title, detail) => {
      host.pushToast?.({ kind: 'warn', title, detail })
      return false
    }
    // 先看余额只是为了省一次事务 + 更快的反馈；**真正的守卫在 spendPoints 里**
    // （读余额和扣款在同一个事务）。
    try {
      if (typeof host.balance === 'function' && host.balance() < PLAY_COST) {
        return deny('积分不够啦', `打一关要 ${PLAY_COST} 积分 —— 去做个任务攒一点吧`)
      }
      const ok = await host.spendPoints(PLAY_COST, '轮班守卫 · 打一关')
      if (!ok) return deny('积分不够啦', `打一关要 ${PLAY_COST} 积分 —— 去做个任务攒一点吧`)
    } catch (e) {
      // 扣款失败不能放行（否则就是白玩），但也不该让整块界面崩掉
      console.error('[guardshift] 开局扣分失败', e)
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
    console.error('[guardshift] mount 失败', e)
    restore()
    throw e
  }

  return async function unmount() {
    try {
      await destroyGame?.()
    } catch (e) {
      console.warn('[guardshift] 卸载出错', e)
    }
    restore()
  }
}

/** 默认导出 = bundle 形状（宿主两种都收：`mod.default ?? mod`）。 */
export default { manifest, mount }
