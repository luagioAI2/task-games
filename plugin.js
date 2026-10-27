/**
 * 一分钟卡组 · 插件入口（宿主 kid-quest-farm-2d，HOST_API 4）
 *
 * ## 这个文件只管「外壳」
 *
 * 游戏本体是 `game.js` 的 `start(opts)`。独立网页（`index.html`）和这里调的是
 * **同一个函数**，差别全部通过 `opts` 注入 —— 所以 `game.js` 里没有任何
 * `if (isPlugin)` 分支（那种分支会随版本漂移，而且两种形态永远只有一种被跑到）。
 *
 * ## 经济：C 型 —— 纯玩，一分产出都没有
 *
 * ```
 *   积分 ──开一局 10 分──▶ 60 秒构筑 + 6 关战斗 ──▶ 最高关卡 / 8 个成就（全在游戏存档里）
 * ```
 *
 * | 概念 | 落在哪 | 谁能让它变多 |
 * | --- | --- | --- |
 * | 🪙 积分 | App 的 `db.ledger` | **只有 App**（任务 / 打卡 / 家长调整） |
 * | 🏆 成就 | **游戏自己的存档**（`ach` 键，8 个） | 打出来 |
 * | 📈 最高关卡 | **游戏自己的存档**（`best` 键） | 打出来 |
 *
 * 三条设计判断：
 *
 * 1. **不发兑换券**（`expectedPayout: 0`）。这游戏没有「攒够 N 个换什么」的出口，
 *    硬加一条产出线等于凭空造一个经济。
 * 2. **没有宿主游戏币**（不调 `mintGameCoin` / `spendGameCoin`）。
 *    成就和最高关卡是存档里的数据，不是宿主账本。
 * 3. **原版的在线排行榜与分享整个删掉了**：一个要账号、一个要分享目标，
 *    宿主里两样都没有，留着只会是「点了必然失败」的按钮。
 *    原版的**平台成就改成了本地成就**（`src/host.js` 的 `installGp`），
 *    否则成就页永远是 8 个灰图标 —— 打穿了也不亮，而且不报错。
 *
 * ## 收费点为什么在「开始游戏」
 *
 * 这款有清晰的「一局」边界：60 秒构筑 + 6 关战斗，结算就是这一局结束。
 * 扣费写在 `uiHost.onStart(fresh)` 一个地方，**「继续」不收费**
 * （那是接着上一局，不是新的一局）。每一局都扣，不设宽限期。
 */

/** 宿主 API 版本。4 = 有 `mintVoucher`（本作没用到，但和另外十款对齐）。 */
const NEED_HOST_API = 4

// ⚠️ 必须**静态** import：插件在 `blob:` 模块里跑，动态 `import('./x.js')`
//    会以 blob: 为基准解析 ⇒ 加载不到（打包器也会因此拆出第二个文件）。
import { start } from './game.js'
import { makeStore } from './src/host.js'

/** 一局的票价（积分）。 */
const PLAY_COST = 10

export const manifest = {
  id: 'deckrush',
  name: '一分钟卡组',
  emoji: '🃏',
  // 底栏格子：宿主放宽到 5 字，商城名正好 5 字，直接用。
  tabLabel: '一分钟卡组',
  version: '1.0.0',
  minHostApi: NEED_HOST_API,

  // ⚠️ 宿主把 `coin` 当**必填**（`describeManifestProblem` 会拒），但本作
  //    **不发行宿主游戏币** —— `mintGameCoin` / `spendGameCoin` 一次都没调。
  //    成就是存档里的一个数组，不是宿主账本。
  //
  // ★ emoji **不能**用 🪙 / 🎟️ / 💎 / 🕹️ —— 那四个宿主已经占了，
  //   `check-plugin.mjs` 的 TAKEN 表会直接拒。
  coin: {
    id: 'dr-trophy',
    name: '通关星',
    emoji: '🏆',
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

  /** 完全不产出宿主资源（积分 / 券 / 币都不会多）⇒ 说明文案不能写「花积分换币」。 */
  kind: 'chill',
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
  // 容器必须是定位上下文：游戏画布按容器尺寸开，DOM 界面层是 `position:absolute; inset:0`。
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

  // ---- 资源 ----
  // `game.js` 里所有资源都过 `A()`，所以这里只要一个**以 `/` 结尾**的根。
  // ★ 优先用 `ctx.assetUrl('')` 而不是直接读 `ctx.assetBase`：契约说得很明确
  //   ——「插件应该**总是**用 `assetUrl()`，不要自己拼」。`assetUrl('')` 恰好
  //   返回带尾斜杠的根（`assetUrlFor` 里 `clean=''` 那一条），本地 / CDN / file:// 三种形态都对。
  //
  // ★ 声音清单也在这一层：`A("sound.manifest.json")` → `<root>/sound.manifest.json`，
  //   清单里的 `assets/lib/…mp3` 与 `sound.pack` 都相对**清单**解析 ⇒ 两者同级才对。
  const assetBase =
    typeof ctx.assetUrl === 'function'
      ? ctx.assetUrl('')
      : typeof ctx.assetBase === 'string'
        ? ctx.assetBase
        : ''

  // ---- 存档 ----
  // ★ 必须 **await 完 preload** 再 start()：`start()` 里读的就是这份缓存。
  //   不 await 的话读到的永远是空档，症状是「进度从来没被恢复过」且不报错。
  const store = makeStore(host.storage)
  try {
    await store.preload()
  } catch (e) {
    console.warn('[deckrush] 读存档失败，按新档开始', e)
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
      const ok = await host.spendPoints(PLAY_COST, '一分钟卡组 · 玩一局')
      if (!ok) return deny('积分不够啦', `玩一局要 ${PLAY_COST} 积分 —— 去做个任务攒一点吧`)
    } catch (e) {
      // 扣款失败不能放行（否则就是白玩），但也不该让整块界面崩掉
      console.error('[deckrush] 开局扣分失败', e)
      return deny('扣分失败', '稍后再试一次')
    }
    host.tone?.('coin')
    return true
  }

  let destroyGame = null
  try {
    destroyGame = await start({
      container,
      assetBase,
      store,
      chargePlay,
    })
  } catch (e) {
    console.error('[deckrush] mount 失败', e)
    restore()
    throw e
  }

  return async function unmount() {
    try {
      await destroyGame?.()
    } catch (e) {
      console.warn('[deckrush] 卸载出错', e)
    }
    // 存档最后落盘：`store` 是内存缓存 + 延迟写，这里不 flush 就丢进度
    try {
      await store.flush()
    } catch (e) {
      console.warn('[deckrush] 存档落盘失败', e)
    }
    restore()
  }
}

/** 默认导出 = bundle 形状（宿主两种都收：`mod.default ?? mod`）。 */
export default { manifest, mount }
