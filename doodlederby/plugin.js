/**
 * 画马赛跑 · 插件入口（宿主 kid-quest-farm-2d，HOST_API 4）
 *
 * ## 这个文件只管「外壳」
 *
 * 游戏本体是 `game.js` 的 `start(opts)`。独立网页（`index.html`）和这里调的是
 * **同一个函数**，差别全部通过 `opts` 注入 —— `game.js` 里没有 `if (isPlugin)` 分支。
 *
 * ## 经济：C 型 —— 纯玩，一分产出都没有
 *
 * ```
 *   积分 ──开一场 10 分──▶ 画马 + 跑一场 ──▶ 名次 / 个人最佳（只写游戏存档）
 * ```
 *
 * | 概念 | 落在哪 | 谁能让它变多 |
 * | --- | --- | --- |
 * | 🪙 积分 | App 的 `db.ledger` | **只有 App**（任务 / 打卡 / 家长调整） |
 * | 🏁 名次 / 最佳成绩 | 游戏自己的存档（`records[]`，最多 20 条） | 跑得更快 |
 *
 * 三条设计判断：
 *
 * 1. **不发兑换券**（`expectedPayout: 0`）。名次没有第二个出口 ——
 *    硬加一条对外产出线等于凭空造一个经济。
 * 2. **没有宿主游戏币**（不调 `mintGameCoin` / `spendGameCoin`）。
 * 3. 原版**本来就没有**体力 / 日常 / 签到 / 抽卡 / 内购。要拆的全是
 *    「联网附加功能」：世界排行榜、录像库、名字三语翻译、云存档。
 *
 * ## 收费点为什么在「03 送它去比赛」
 *
 * 一局的边界是**一场比赛**（100 米节奏短跑约 20 秒 / 200 米跨栏乱斗约 35 秒）。
 * 画马、3D 预览、起名、选赛制**全免费** —— 那是这款游戏的核心乐趣，
 * 收钱等于收「进教室」的钱。扣费写在 `game.js` 的 `launchRace()` 里，
 * 「开始」和结算页的「再跑一场」都走它 ⇒ **每场都收一次**（一局 = 一场）。
 */

/** 宿主 API 版本。4 = 有 `mintVoucher`（本作没用到，但和另外十几款对齐）。 */
const NEED_HOST_API = 4

// ⚠️ 必须**静态** import：插件在 `blob:` 模块里跑，动态 `import('./x.js')`
//    会以 blob: 为基准解析 ⇒ 加载不到（打包器也会因此拆出第二个文件）。
import { start } from './game.js'

/** 一场比赛的票价（积分）。 */
const PLAY_COST = 10

export const manifest = {
  id: 'doodlederby',
  name: '画马赛跑',
  emoji: '🐴',
  tabLabel: '画马赛跑',
  version: '1.0.0',
  minHostApi: NEED_HOST_API,

  // ⚠️ 宿主把 `coin` 当**必填**（`describeManifestProblem` 会拒），但本作
  //    **不发行宿主游戏币** —— 名次是游戏存档里的一个数组，不是宿主账本。
  //
  // ★ emoji **不能**用 🪙 / 🎟️ / 💎 / 🕹️ —— 那四个宿主已经占了。
  coin: {
    id: 'dd-rosette',
    name: '奖花',
    emoji: '🎖️',
  },

  economy: {
    /** 一场比赛的积分成本 */
    playCost: PLAY_COST,
    /** 一场结束**不发任何券**。见文件头第 1 条。 */
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
  // 容器必须是定位上下文：`game.js` 会在里面塞一层 `position:absolute;inset:0` 的挂载根。
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
  // `game.js` 那边存的是**一个 JSON 字符串**（`encodeSave()` 的产物，内部带版本号 `v:3`），
  // 所以这里原样存取，不做二次序列化 —— 多包一层 JSON 会让 `decodeSave()` 解不出来，
  // 而它的防御分支是 `return null` ⇒ 症状是「每次都从头开始」，零报错。
  //
  // ★ 先把旧档读出来再 start()：不 await 的话第一次读到的永远是空。
  let saved = null
  try {
    saved = await host.storage.get('save')
  } catch (e) {
    console.warn('[doodlederby] 读存档失败，按新档开始', e)
  }

  let primed = typeof saved === 'string' && saved.length > 0 ? saved : null
  const store = {
    async getLatest() {
      return primed
    },
    async putLatest(text) {
      try {
        await host.storage.set('save', text)
        primed = text
        return true
      } catch (e) {
        console.warn('[doodlederby] 写存档失败', e)
        return false
      }
    },
  }

  // ---- 开赛收费（一场 10 积分）----
  const chargePlay = async () => {
    const deny = (title, detail) => {
      host.pushToast?.({ kind: 'warn', title, detail })
      return false
    }
    // 先看余额只是为了省一次事务 + 更快的反馈；**真正的守卫在 spendPoints 里**
    // （读余额和扣款在同一个事务）。
    try {
      if (typeof host.balance === 'function' && host.balance() < PLAY_COST) {
        return deny('积分不够啦', `跑一场要 ${PLAY_COST} 积分 —— 去做个任务攒一点吧`)
      }
      const ok = await host.spendPoints(PLAY_COST, '画马赛跑 · 跑一场')
      if (!ok) return deny('积分不够啦', `跑一场要 ${PLAY_COST} 积分 —— 去做个任务攒一点吧`)
    } catch (e) {
      // 扣款失败不能放行（否则就是白玩），但也不该让整块界面崩掉
      console.error('[doodlederby] 开赛扣分失败', e)
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
    console.error('[doodlederby] mount 失败', e)
    restore()
    throw e
  }

  return async function unmount() {
    try {
      await destroyGame?.()
    } catch (e) {
      console.warn('[doodlederby] 卸载出错', e)
    }
    restore()
  }
}

/** 默认导出 = bundle 形状（宿主两种都收：`mod.default ?? mod`）。 */
export default { manifest, mount }
