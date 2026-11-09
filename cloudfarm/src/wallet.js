/**
 * 积分钱包 —— 把游戏里的 🪙 接到**宿主的积分账本**上。
 *
 * ## 这一层存在的理由（以及它替代了什么）
 *
 * 原版是个「玩具」：积分靠 `addPoints()` 那个「＋」按钮凭空打钱，
 * 捉虫 / 气球 / 消毒再撒一点。接进宿主后这条路必须断掉 ——
 * 宿主的 `HostApi` 里**没有任何一扇门能往积分账本写正数**
 * （见 `src/economy.js` 顶部那张表）。积分只能来自任务 / 打卡 / 家长手动调整。
 *
 * 所以游戏里看到的 🪙 不再是「游戏内积分」，它就是 App 的积分：
 *
 * ```
 *   显示余额 = host.balance() − 在途扣款 + 调试额度
 *   每一次花钱 = host.spendPoints(n, memo)   ← 宿主写一笔 game_spend（负数）
 * ```
 *
 * ## 为什么 `spend()` 是**同步**的
 *
 * `Farm` 的 `plant()` / `adopt()` / `unlockPlot()` / `buyWutong()` 全是同步返回
 * 布尔的，UI 靠这个布尔立刻决定「关面板还是弹提示」。把它们改成 async 会
 * 一路传染到点击处理、教练标记、面板重绘 —— 收益为零，风险很大。
 *
 * 而 `host.balance()` **本来就是同步的**（读 store，`hostApi.ts` 里是
 * `() => deps.getBalance()`）。于是：
 *
 * ```
 *   spend(n):  ① 同步判断够不够（balance() ≥ n）
 *              ② 够 → 立刻记账到「在途」pending，返回 true
 *              ③ 把 host.spendPoints 排进串行队列，落地后 pending -= n
 * ```
 *
 * `balance()` 减掉 pending，所以**镜像永远 ≤ 真实余额** —— 这是故意偏保守的方向：
 * 宁可多拦一次「积分不够」，也不会出现「镜像以为够、宿主拒绝」。
 *
 * ## 万一宿主还是拒绝了
 *
 * 只可能发生在「同一个账号在别处把积分花掉了」（余额被外部改动）。
 * 这时**不回滚游戏动作** —— 回滚一棵已经种下的作物、一只已经领养的动物，
 * 比白送一次更糟（孩子看到的是「我的菜消失了」）。改为：
 *   · 把镜像拉回真值（下一次购买就恢复正常）；
 *   · 通过 `onReject` 让上层提示一次。
 * 代价是极端情况下白送一次投入，收益是账本永远以宿主为准。
 *
 * ## 独立网页（没有宿主）
 *
 * `enabled === false`，`state.points` 就是账本本身（存在存档里）。
 * 那边没有 App 的积分，所以给一笔启动资金，纯粹为了能试玩 / 截图。
 */

/** 独立网页的启动资金（只有 `enabled === false` 时才会用到）。 */
export const STANDALONE_START = 200

export class Wallet {
  /**
   * @param {object|null} host 宿主 HostApi；null = 独立网页
   * @param {{ points: number }} state 农场存档对象（`points` 是显示镜像）
   */
  constructor(host, state) {
    this.host = host
    this.state = state
    /** 已经发起、还没 await 回来的扣款合计（单位：积分） */
    this.pending = 0
    /** 调试额度：只由 `?rig=` 布置场景时给，不写宿主账本 */
    this.dev = 0
    /** `?rig=` 专用：开了就完全不扣币（布置场景不该花钱） */
    this.free = false
    /** 串行链：两次扣款不能同时改 `pending` */
    this.chain = Promise.resolve()
    /** 宿主拒绝扣款时回调（上层拿去弹提示） */
    this.onReject = null
  }

  /** 有没有真的账本可写。false = 独立网页。 */
  get enabled() {
    return !!this.host && typeof this.host.spendPoints === 'function' && typeof this.host.balance === 'function'
  }

  /** 当前可用积分。宿主形态下 = 真实余额 − 在途扣款（≤ 真值，偏保守）。 */
  balance() {
    if (!this.enabled) return Math.max(0, Math.floor(Number(this.state.points) || 0))
    let n = 0
    try {
      n = Math.floor(Number(this.host.balance()) || 0)
    } catch {
      n = 0
    }
    return Math.max(0, n - this.pending + this.dev)
  }

  canAfford(n) {
    if (this.free) return true
    return this.balance() >= Math.floor(Number(n) || 0)
  }

  /**
   * 花掉 `n` 积分。**同步**返回是否成功（钱够不够）。
   *
   * @param {number} n
   * @param {string} memo 宿主流水上的一行说明（家长在账本里看得见）
   */
  spend(n, memo = '农场') {
    let cost = Math.floor(Number(n) || 0)
    if (!(cost > 0)) return true
    if (this.free) return true
    if (!this.canAfford(cost)) return false

    // 独立网页：没有账本，直接扣存档里的数
    if (!this.enabled) {
      this.state.points = Math.max(0, Math.floor(Number(this.state.points) || 0) - cost)
      return true
    }

    // 调试额度（`?rig=`）先本地消化：这部分不写宿主账本
    const dev = Math.min(this.dev, cost)
    if (dev > 0) {
      this.dev -= dev
      cost -= dev
    }
    if (cost <= 0) {
      this.commit()
      return true
    }

    this.pending += cost
    const post = this.post(cost, memo)
    // 串行：上一笔落地（不管成败）再走下一笔。不串行的话 `pending`
    // 会被并发读写，镜像和真值就会走散。
    this.chain = this.chain.then(() => post, () => post)
    this.commit()
    return true
  }

  /** @private 真正落到宿主账本上的一笔扣款 */
  async post(cost, memo) {
    let ok = false
    try {
      ok = (await this.host.spendPoints(cost, memo)) !== false
    } catch (e) {
      console.warn('[cloudfarm] spendPoints 失败', e)
    }
    this.pending = Math.max(0, this.pending - cost)
    if (!ok) {
      // 见文件头「万一宿主还是拒绝了」：不回滚动作，只把镜像拉回真值
      console.warn('[cloudfarm] 宿主拒绝了这笔扣款', cost, memo)
      try {
        this.onReject?.(cost)
      } catch {
        /* 提示失败不影响账本 */
      }
    }
    this.commit()
    return ok
  }

  /**
   * 把镜像写回存档。宿主形态下 `state.points` 只是**显示缓存**
   * （`refreshHud` 每秒调一次，孩子看到的数不会停在旧值）。
   */
  commit() {
    if (!this.enabled) return
    this.state.points = this.balance()
  }

  /** 布置试玩场景用（`?rig=`）：给一笔不写账本的额度。 */
  grant(n) {
    const v = Math.floor(Number(n) || 0)
    if (v > 0) this.dev += v
    this.commit()
    return v
  }

  /** 卸载前等所有扣款落地（否则关掉页面那一刻的扣款可能没写完）。 */
  async drain() {
    try {
      await this.chain
    } catch {
      /* 已经在 post 里吞过 */
    }
  }

  /** 只读快照，给探针 / 断言用 */
  snapshot() {
    return { enabled: this.enabled, balance: this.balance(), pending: this.pending, dev: this.dev, free: this.free }
  }
}
