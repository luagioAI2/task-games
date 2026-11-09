/**
 * wallet.js —— 娃娃机币 / 积分的**游戏侧钱包**。
 *
 * ## 为什么需要这一层
 *
 * 宿主的币是**账本**（余额 = 全部 delta 之和，见 kid-quest-farm-2d 的 `db.ts`），
 * 三个入口全是异步的；而这个游戏 3000 行里到处是同步的 `save.coins`。
 * 把每一处都改成 `await` 会牵动几十个调用点，而且每处都要自己处理
 * 「await 期间玩家又点了一次」——那是几十个独立的机会去写错。
 *
 * 所以做法和存档（`gp-bridge.js`）一模一样：
 *   · **挂载前**把余额读成一个快照传进来（同步语义完整保留）；
 *   · 之后内存里这份 `coins` 就是界面读的那一份；
 *   · 每一次**变动**都走宿主的那几扇门，**await 成功才改内存**。
 *
 * ## ⚠️ 为什么不是「先改内存、再异步补一笔」
 *
 * 那等于允许「余额不够也开局」。宿主的每扇门里都有守卫
 * （`spendGameCoin` 在事务里判余额、`buyGameCoin` 在事务里判积分），
 * **守卫挪到事务外面就等于没有** —— 本项目在 `consumeItem` / `spendMall`
 * 上各吃过一次同样的亏（两次并发各自读到同一个「够」，于是都扣）。
 *
 * ## ⚠️ 为什么不需要 `save.coins`
 *
 * 「同一个事实存两份必然走散」是宿主 `db.ts` 头注释里的第一条。
 * 币只在账本里；存档里那个 `coins` 字段**只用于老存档迁移**，迁移完不再写。
 *
 * ## 四扇门（和宿主 HostApi 一一对应）
 *
 * ```
 *   积分 ──buyGameCoin──▶ 娃娃机币 ──spendGameCoin──▶ 一局游玩
 *                              │
 *                              └──redeemGameCoin──▶ 兑换券（没用完的币）
 *
 *   娃娃 ──mintVoucher──▶ 兑换券        ← 回收娃娃，**不经过币**
 * ```
 *
 * ## ★ 币只有一个来源：买。娃娃不产币（2026-10-23 改）
 *
 * 原来是「娃娃 → 币」，于是币有了第二个来源，而币能直接开局
 * ⇒ **抓娃娃本身能续玩**，那条「坐着玩就能刷」的回路又接回来了。
 * 现在币是**入场券**（用积分买），券是**战利品**（抓来的），两者不互通。
 *
 * `mintGameCoin` 仍然保留在钱包里给「旧存档迁移」用（`loadWalletFromHost`），
 * 但**没有任何游戏内动作会调它** —— 别再把 `earn()` 加回来。
 */

/** 币的显示口径。名字和内置娃娃机一致，emoji **故意不同**（内置那台是 🕹️）——
 *  四个币同屏时（积分 🪙 / 兑换券 🎟️ / 钻石 💎 / 娃娃机币），
 *  用同一个图标就分不出在扣哪个（`currency.ts` 里记过这个事故）。 */
export const COIN = Object.freeze({ name: '娃娃机币', emoji: '🧸' })

/**
 * 多少积分买 1 个币。
 *
 * 宿主 `domain/clawEconomy.ts` 里 `CLAW_POINTS_PER_COIN = 1`，和内置娃娃机对齐。
 * **不要在这里单独调** —— 它是那条「一局期望产出 < 1」不变量的分母，
 * 两个娃娃机用不同的汇率，家长看到的账就对不上了。
 */
export const POINTS_PER_COIN = 1

/** 一次最多买多少个（防手滑连点买空积分） */
export const MAX_BUY = 20

/** 一局的价格。宿主 manifest 的 `economy.playCost` 必须和它一致（打包脚本会核对）。 */
export const PLAY_COST = 1

/**
 * **1 个娃娃机币能换几张兑换券**。
 *
 * 这是「积分 → 游戏币 → 兑换券」这条链的**最后一段汇率**，写在 manifest 里，
 * 由宿主校验（`expectedPayout × VOUCHER_PER_COIN < playCost`）。
 *
 * 为什么是 1：兑换券 ≡ 1 积分（兑换商城口径），和内置娃娃机同口径。
 * 调大会直接变成「一局刷出 N 张券」—— 宿主会拒绝安装，不是靠自觉。
 */
export const VOUCHER_PER_COIN = 1

const clamp = (n) => Math.max(0, Math.round(Number.isFinite(n) ? n : 0))

/**
 * 造一个钱包。**所有方法都可能返回 `false`** —— 调用方必须看返回值，
 * 不能假定「调了就等于成功了」。
 *
 * @param {object}   o
 * @param {object}   o.host      宿主的 HostApi（独立运行时是 main.js 的 localHost）
 * @param {number}   o.coins     挂载前的币余额快照
 * @param {number}   o.points    挂载前的积分余额快照
 * @param {Function} o.onChange  余额变了（UI 要重画）
 */
export function createWallet({ host, coins = 0, points = 0, onChange = () => {} } = {}) {
  let _coins = clamp(coins)
  let _points = clamp(points)

  /**
   * 同一时刻只允许一笔变动在飞。
   *
   * 不是为了性能，是为了**正确性**：`startPlay` 里 `await pay()` 之后才把
   * `crane.phase` 从 ready 改掉，这中间有 1~2 帧。连点两下就会两次都通过
   * 那句 `phase === "ready"` 的守卫 —— 于是付两次钱、只玩一局（或者反过来）。
   */
  let busy = false

  async function serial(fn) {
    if (busy) return false
    busy = true
    try {
      return await fn()
    } finally {
      busy = false
    }
  }

  /**
   * 和宿主对一次账。
   *
   * 什么时候会用到：`spendGameCoin` 返回 false（说明我们内存里以为够、账本上不够，
   * 比如另一个标签页花掉了）。这时候**不能**相信内存，也不能自己补一笔，
   * 只能重新读一遍账本 —— 读失败就保持原值（宁可显示旧余额，也不要显示 0 让人以为钱没了）。
   */
  async function resync() {
    try {
      const [c, p] = await Promise.all([
        host.gameCoinBalance(),
        Promise.resolve(typeof host.balance === 'function' ? host.balance() : _points),
      ])
      if (typeof c === 'number' && Number.isFinite(c)) _coins = clamp(c)
      if (typeof p === 'number' && Number.isFinite(p)) _points = clamp(p)
      onChange()
    } catch (e) {
      console.warn('[pp] 钱包对账失败，保持内存余额', e)
    }
  }

  return {
    get coins() {
      return _coins
    },
    get points() {
      return _points
    },
    /** 正在飞一笔变动（UI 可以把按钮置灰） */
    get busy() {
      return busy
    },

    /** 一局要多少币 */
    get playCost() {
      return PLAY_COST
    },

    /** 积分够买几个币（一次能买的量，不是余额） */
    affordable() {
      return Math.min(MAX_BUY, Math.floor(_points / POINTS_PER_COIN))
    },

    /** 能不能自己掏钱玩这一局 */
    canPlay() {
      return _coins >= PLAY_COST
    },

    /**
     * 花积分买币。返回 `true` = 真的买到了。
     *
     * 走宿主的 `buyGameCoin`（**扣积分和记币在同一个事务里**）。
     * 不用 `spendPoints` + `mintGameCoin` 两步 —— 那是两个独立事务，
     * 中间崩一下就是「积分扣了、币没到」，孩子白丢积分而且没有任何报错。
     */
    async buy(count = 1) {
      const n = clamp(count)
      if (n <= 0 || n > MAX_BUY) return false
      return serial(async () => {
        const cost = n * POINTS_PER_COIN
        if (_points < cost) return false
        try {
          const ok = await host.buyGameCoin(n, POINTS_PER_COIN, `买 ${n} 个${COIN.name}`)
          if (!ok) {
            await resync()
            return false
          }
        } catch (e) {
          console.warn('[pp] 买币失败', e)
          await resync()
          return false
        }
        _coins += n
        _points -= cost
        onChange()
        return true
      })
    },

    /** 付一局的币。返回 `true` = 可以开局。 */
    async pay(cost = PLAY_COST) {
      const n = clamp(cost)
      if (n <= 0) return true
      return serial(async () => {
        if (_coins < n) return false
        try {
          const ok = await host.spendGameCoin(n, '玩一局')
          if (!ok) {
            await resync()
            return false
          }
        } catch (e) {
          console.warn('[pp] 扣币失败', e)
          await resync()
          return false
        }
        _coins -= n
        onChange()
        return true
      })
    },

    /**
     * 回收娃娃 → **直接发兑换券**（走 `host.mintVoucher`，不经过币）。
     *
     * 返回**宿主实际发出的券数**（`> 0` 才算成功）—— 不要在界面里自己乘，
     * 那样插件算的和宿主发的一不一致，玩家看到的就是假数。
     *
     * ⚠️ 这条路径**不碰 `_coins`**：娃娃不产币。币的入口只有 `buy()`。
     */
    async redeemPrize(amount, memo = '回收娃娃') {
      const n = clamp(amount)
      if (n <= 0) return 0
      let got = 0
      const ok = await serial(async () => {
        try {
          got = await host.mintVoucher(n, memo)
        } catch (e) {
          console.warn('[pp] 发兑换券失败', e)
          await resync()
          return false
        }
        return true
      })
      if (!ok) return 0
      onChange()
      return typeof got === 'number' && got > 0 ? got : 0
    },

    /** 手动对账（切回前台、窗口重新可见时调一次） */
    refresh: resync,
  }
}

/**
 * 挂载前把余额读出来。**必须在 `createGame` 之前 await 完** ——
 * 游戏在求值阶段就会同步读 `wallet.coins`（`refreshTexts` 在 boot 段直接调用）。
 *
 * 顺带做一次**老存档迁移**：旧版本的币单位是「1 局 = 100 币」
 * （`config.js` 里每台机 `price: 100`），所以按 100:1 折算成新币。
 * 上限 50 —— 旧档里 `startCoins: 3000` 折出来正好 30，够玩一阵但不会一开局就通胀。
 *
 * ⚠️ 迁移**只做一次**（`save.coinMigrated`）。不做这个标记的话，
 * 每次挂载都会把旧档里的 `coins` 再铸一遍 —— 关一次页面多一份钱。
 */
export async function loadWalletFromHost(host, save = null) {
  let coins = 0
  let points = 0
  try {
    coins = await host.gameCoinBalance()
  } catch (e) {
    console.warn('[pp] 读币余额失败，按 0 开局', e)
  }
  try {
    points = typeof host.balance === 'function' ? host.balance() : 0
  } catch (e) {
    console.warn('[pp] 读积分余额失败', e)
  }

  if (save && !save.coinMigrated) {
    save.coinMigrated = true
    const legacy = Math.round((save.coins ?? 0) / 100)
    if (legacy > 0 && coins === 0) {
      const grant = Math.min(legacy, 50)
      try {
        await host.mintGameCoin(grant, '旧存档迁移')
        coins += grant
      } catch (e) {
        console.warn('[pp] 旧存档迁移失败（不重试，避免重复铸币）', e)
      }
    }
  }

  return { coins: clamp(coins), points: clamp(points) }
}
