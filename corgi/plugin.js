/**
 * 柯基屁屁 · 插件入口（宿主 kid-quest-farm-2d，HOST_API 4）
 *
 * ## 这个文件只管「外壳」
 *
 * 游戏本体是 `game.js` 的 `start(opts)`。独立网页（`index.html`）和这里调的是
 * **同一个函数**，差别全部通过 `opts` 注入 —— 所以 `game.js` 里没有任何
 * `if (isPlugin)` 的玩法分支（那种分支会随版本漂移，而且两种形态永远只有一种被跑到）。
 *
 * | | `index.html` | 本文件 |
 * | --- | --- | --- |
 * | 资源 | 不传（相对文档） | `ctx.assetUrl('')` |
 * | 音频 | 不传（默认 `./sound.manifest.json`） | `manifestUrl` + `baseUrl`（清单在**包根**） |
 * | 存档 | 不传（localStorage） | `host.storage` → `makeHostStore()` |
 * | 容器 | 不传（`#game`） | `mount(container)` 给的那个 |
 * | 开局收费 | 不传（不收费） | `chargePlay()` |
 *
 * ## 经济：C 型 / `chill` —— 纯玩，一分产出都没有
 *
 * ```
 *   积分 ──进场门票──▶ 撸狗 / 投喂 / 换装 / 进阶（爱心、羁绊、毛色全在游戏存档里）
 * ```
 *
 * | 概念 | 落在哪 | 谁能让它变多 |
 * | --- | --- | --- |
 * | 🪙 积分 | App 的 `db.ledger` | **只有 App**（任务 / 打卡 / 家长调整） |
 * | 💗 爱心 | **游戏自己的存档** | 撸狗 / 离线产出，跟宿主账本无关 |
 * | 🐕 毛色 / 装扮 / 装饰 | **游戏自己的存档** | 攒爱心解锁 |
 *
 * 三条设计判断：
 *
 * 1. **不发兑换券**（`expectedPayout: 0`，`voucherPerCoin` 不写）。
 *    这款没有「攒够 N 个换什么」的出口，硬加一条产出线等于凭空造一个经济。
 * 2. **没有宿主游戏币**（不调 `mintGameCoin` / `spendGameCoin`）。
 *    爱心是存档里的一个数字，不是宿主账本 —— 所以 `coin` 只是占位，
 *    声明成「爱心」是为了商城详情页上那一栏不写假话。
 * 3. **原版要拆的东西几乎没有**：平台面只有 `player.saves` / `user.locale` /
 *    `player.ready` / `fonts`（10 处），没有内购、没有排行榜、没有分享、
 *    没有平台成就、没有联网（`fetch` / `WebSocket` / `localStorage` 全 0 命中）。
 *    签到与每日任务是**游戏内玩法**，发的是游戏内爱心，保留。
 *
 * ## 收费点为什么在「进场」，而且有 10 分钟宽限
 *
 * 这是款**放置 / 养成**游戏，没有「开始一局」这个动作：进来就是接着玩。
 * 所以「一局」只能定义成「一次进场」。但孩子切到任务页做个任务再切回来，
 * 不该再收一次 —— 所以 `paidAt` 记在存档里，**10 分钟内回来不重复收**。
 *
 * 宽限窗口写在存档里（不是内存变量）：卸载后内存就没了，
 * 而「切走再回来」恰好是一次卸载 + 一次挂载。
 */

/** 宿主 API 版本。4 = 有 `mintVoucher`（本作没用到，但和另外十一款对齐）。 */
const NEED_HOST_API = 4

// ⚠️ 必须**静态** import：插件在 `blob:` 模块里跑，动态 `import('./x.js')`
//    会以 blob: 为基准解析 ⇒ 加载不到（打包器也会因此拆出第二个文件）。
import { start } from './game.js'
import { makeHostStore } from './src/host.js'

/** 一次进场的票价（积分）。 */
const PLAY_COST = 10

/** 付过之后多久内再进来不重复收（毫秒）。 */
const GRACE_MS = 10 * 60 * 1000

export const manifest = {
  id: 'corgi',
  name: '柯基屁屁',
  emoji: '🐕',
  // 底栏格子放宽到 5 字；商城名 4 字，直接用。
  tabLabel: '柯基屁屁',
  version: '1.0.0',
  minHostApi: NEED_HOST_API,

  // ⚠️ 宿主把 `coin` 当**必填**（`describeManifestProblem` 会拒），但本作
  //    **不发行宿主游戏币** —— `mintGameCoin` / `spendGameCoin` 一次都没调。
  //    游戏里那枚 💗 爱心是存档里的一个数字，不是宿主账本。
  //
  // ★ emoji **不能**用 🪙 / 🎟️ / 💎 / 🕹️ —— 那四个宿主已经占了，
  //   `check-plugin.mjs` 的 TAKEN 表会直接拒。
  coin: {
    id: 'corgi-heart',
    name: '爱心',
    emoji: '💗',
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
  // 容器必须是定位上下文：canvas 按容器尺寸开，背景模糊层是 `position:absolute; inset:0`。
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
  // ★ 优先用 `ctx.assetUrl('')` 而不是直接读 `ctx.assetBase`：契约说得很明确
  //   ——「插件应该**总是**用 `assetUrl()`，不要自己拼」。`assetUrl('')` 恰好
  //   返回带尾斜杠的**包根**（`/games/corgi/`），图片在 `assets/` 下、
  //   音频清单在包根，两者都从这一个根拼出来。
  const assetBase =
    typeof ctx.assetUrl === 'function'
      ? ctx.assetUrl('')
      : typeof ctx.assetBase === 'string'
        ? ctx.assetBase
        : ''

  // ---- 存档 ----
  // ★ 必须 **await 完 preload** 再 start()：`start()` 里读的就是这份缓存。
  //   不 await 的话读到的永远是空档，症状是「进度从来没被恢复过」且不报错。
  const store = makeHostStore(host.storage)
  try {
    await store.preload()
  } catch (e) {
    console.warn('[corgi] 读存档失败，按新档开始', e)
  }

  // ---- 进场收费（10 分钟宽限，见文件头）----
  const chargePlay = async () => {
    const last = Number(store.get('paidAt')) || 0
    if (Date.now() - last < GRACE_MS) return true

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
      const ok = await host.spendPoints(PLAY_COST, '柯基屁屁 · 进场')
      if (!ok) return deny('积分不够啦', `进场要 ${PLAY_COST} 积分 —— 去做个任务攒一点吧`)
    } catch (e) {
      // 扣款失败不能放行（否则就是白玩），但也不该让整块界面崩掉
      console.error('[corgi] 进场扣分失败', e)
      return deny('扣分失败', '稍后再试一次')
    }
    store.set('paidAt', Date.now())
    host.tone?.('coin')
    return true
  }

  let destroyGame = null
  try {
    destroyGame = await start({
      container,
      assetBase,
      store,
      locale: ctx.locale,
      chargePlay,
    })
  } catch (e) {
    console.error('[corgi] mount 失败', e)
    restore()
    throw e
  }

  return async function unmount() {
    try {
      await destroyGame?.()
    } catch (e) {
      console.warn('[corgi] 卸载出错', e)
    }
    // 存档最后落盘：`store` 是内存缓存 + 延迟写，这里不 flush 就丢进度
    try {
      await store.flush()
    } catch (e) {
      console.warn('[corgi] 存档落盘失败', e)
    }
    restore()
  }
}

/** 默认导出 = bundle 形状（宿主两种都收：`mod.default ?? mod`）。 */
export default { manifest, mount }
