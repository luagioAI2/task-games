/**
 * 爆汁瓜瓜罐 · 插件入口（宿主 kid-quest-farm-2d，HOST_API 4）
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
 *   积分 ──开局 8 分──▶ 一局合成 ──▶ 宝石 / 最高分 / 成就（全在游戏存档里）
 * ```
 *
 * | 概念 | 落在哪 | 谁能让它变多 |
 * | --- | --- | --- |
 * | 🪙 积分 | App 的 `db.ledger` | **只有 App**（任务 / 打卡 / 家长调整） |
 * | 🔷 宝石 | **游戏自己的存档** | 每局结算按分数发 |
 *
 * 三条设计判断：
 *
 * 1. **不发兑换券**（`expectedPayout: 0`）。这游戏没有「攒够 N 个换什么」的出口，
 *    硬加一条产出线等于凭空造一个经济。
 * 2. **没有宿主游戏币**（不调 `mintGameCoin` / `spendGameCoin`）。
 *    宝石是存档里的一个数字，不是宿主账本 —— 和少女战记的元素水晶同理。
 * 3. **原版的内购整个拆掉了**：复活（4 平台币）/ 摇一摇（2 平台币）/ 金币商店 /
 *    启动补发 `settlePendingPurchases()`。宿主没有「插件扣平台币」这条通道
 *    （HOST_API 里没有任何方法能让插件花掉正数积分以外的东西），留着只会是
 *    点了必然失败的按钮。**替代方案**：两项便利改花**宝石**（只能靠玩挣），
 *    所以「便利」依旧是挣来的，而不是白送。
 *    同理删掉的还有**排行榜 + 登录**（要联网，插件里只会转圈）。
 *
 * ## 收费点为什么在「开局」
 *
 * 这款有清晰的「一局」边界（罐口溢出就结算），三个开局动作 ——
 * `开始游戏` / `再来一局` / `每日挑战` —— 都过 `game.js` 里的 `gate()`，
 * 扣费写在那一个地方，不会漏掉某一条。**每一局都扣，不设宽限期。**
 */

/** 宿主 API 版本。4 = 有 `mintVoucher`（本作没用到，但和另外六款对齐）。 */
const NEED_HOST_API = 4

// ⚠️ 必须**静态** import：插件在 `blob:` 模块里跑，动态 `import('./x.js')`
//    会以 blob: 为基准解析 ⇒ 加载不到（打包器也会因此拆出第二个文件）。
import { start } from './game.js'
import { makeStore } from './src/host.js'

/** 一局的票价（积分）。 */
const PLAY_COST = 8

export const manifest = {
  id: 'melonjar',
  name: '爆汁瓜瓜罐',
  emoji: '🍉',
  // 底栏格子：2026-10-26 起宿主放宽到 5 字，这里直接用商城名。
  tabLabel: '爆汁瓜瓜罐',
  version: '1.0.0',
  minHostApi: NEED_HOST_API,

  // ⚠️ 宿主把 `coin` 当**必填**（`describeManifestProblem` 会拒），但本作
  //    **不发行宿主游戏币** —— `mintGameCoin` / `spendGameCoin` 一次都没调。
  //    游戏里那颗钻石是存档里的一个数字，不是宿主账本。
  //
  // ★ emoji **不能**用 🪙 / 🎟️ / 💎 / 🕹️ —— 那四个宿主已经占了，
  //   `check-plugin.mjs` 的 TAKEN 表会直接拒（同屏会看不出在扣哪个币）。
  //   游戏里的宝石是**浅蓝菱形**，🔷 最接近，且没被占。
  coin: {
    id: 'mj-gem',
    name: '宝石',
    emoji: '🔷',
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
  // `game.js` 里所有资源都过 `A()`，所以这里只要一个**以 `/` 结尾**的根。
  // ★ 优先用 `ctx.assetUrl('')` 而不是直接读 `ctx.assetBase`：契约说得很明确
  //   ——「插件应该**总是**用 `assetUrl()`，不要自己拼」。`assetUrl('')` 恰好
  //   返回带尾斜杠的根（`assetUrlFor` 里 `clean=''` 那一条），本地 / CDN / file:// 三种形态都对。
  const assetBase =
    typeof ctx.assetUrl === 'function'
      ? ctx.assetUrl('')
      : typeof ctx.assetBase === 'string'
        ? ctx.assetBase
        : ''

  // ---- 存档 ----
  // ★ 必须 **await 完 preload** 再 start()：`start()` 里读的就是这份缓存。
  //   不 await 的话读到的永远是空 Map，症状是「进度从来没被恢复过」且不报错。
  const store = makeStore(host.storage)
  try {
    await store.preload()
  } catch (e) {
    console.warn('[melonjar] 读存档失败，按新档开始', e)
  }

  // ---- 开局收费（一局 8 积分）----
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
      const ok = await host.spendPoints(PLAY_COST, '爆汁瓜瓜罐 · 玩一局')
      if (!ok) return deny('积分不够啦', `玩一局要 ${PLAY_COST} 积分 —— 去做个任务攒一点吧`)
    } catch (e) {
      // 扣款失败不能放行（否则就是白玩），但也不该让整块界面崩掉
      console.error('[melonjar] 开局扣分失败', e)
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
    console.error('[melonjar] mount 失败', e)
    restore()
    throw e
  }

  return async function unmount() {
    try {
      await destroyGame?.()
    } catch (e) {
      console.warn('[melonjar] 卸载出错', e)
    }
    // 存档最后落盘：`store` 是内存缓存 + 延迟写，这里不 flush 就丢进度
    try {
      await store.flush()
    } catch (e) {
      console.warn('[melonjar] 存档落盘失败', e)
    }
    restore()
  }
}

/** 默认导出 = bundle 形状（宿主两种都收：`mod.default ?? mod`）。 */
export default { manifest, mount }
