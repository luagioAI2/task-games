/**
 * 兑换券桥 —— 把「卖出农产品」接到宿主的**兑换券账本**上。
 *
 * ## 这一版和上一版的区别（别走回头路）
 *
 * 上一版是「收成自动折成券」：收获时按 `amount × 市价` 算出游戏积分，
 * 每 `SEASON_POINTS`(3000) 折 1 张券，余数结转。那时候 🪙 是**游戏自己的钱**
 * （靠「＋」按钮打钱），卖货只记一个「丰收币」计数器，所以必须另开一条
 * 折算链，否则孩子永远见不到券。
 *
 * 现在 🪙 就是 App 的积分（见 `src/wallet.js`），而**卖出直接给兑换券**：
 *
 * ```
 *   种子（积分）──▶ 长出来 ──▶ 收获 ──▶ 卖出 ──▶ 兑换券（mintVoucher）
 * ```
 *
 * 于是「折率」这件事整个消失了 —— 市价表（`ITEM_PRICE`）的单位**就是券**，
 * `quote()` 出来的整数就是这一单该发几张券。和宿主内置农场同一个口径
 * （那边也是「产出物 → 兑换券」，`capFor = 满产 × 整数单价`）。
 *
 * ## 为什么还要 carry
 *
 * `mintVoucher` 是异步的、可能失败（宿主在忙、事务被中断）。失败的券**不能丢** ——
 * 那是孩子种出来、卖出去的。所以：
 *
 * ```
 *   pay(n) → pending += n → 串行尝试 mintVoucher(pending)
 *             成功：pending -= 实际发出去的
 *             失败：pending 原样留着，下一次卖出一起发
 * ```
 *
 * `pending` 存在存档的 settings 里（`voucherCarry`），**卸载 / 重启都不丢**。
 * 这和 MEMORY 里那条「实体离开时挂在它身上的累计量必须显式搬走」是同一件事。
 *
 * ⚠️ 键名从 `carry` 改成了 `voucherCarry`，而且**没有做迁移**：
 *    老 `carry` 的单位是「游戏积分」（可能几千），当成券发出去就是凭空印钱。
 *    宁可丢掉那个不到一张券的零头。
 *
 * ## 独立网页（没有宿主）
 *
 * `enabled === false`：不发券，但 `pending` 照常累积并落盘 ——
 * 同一份存档拿到插件里会把该给的补上，不会因为「先在网页上玩过」就吞掉。
 */

/**
 * 一次结算最多发几张券。
 *
 * 卖出是**手动**动作，而且被 `quotas`（每块地 / 每只动物的满产上限）夹住，
 * 单笔最大就是「一颗魔法豆满产」= 24 × 15 = 360 张。所以这里只留一个
 * 「防手滑」的量级上限，正常玩法碰不到。
 *
 * （上一版那个 2 张的上限是为「离线一周回来自动结算」准备的，现在没有
 *   自动结算了，留着它反而会静默压掉孩子卖货的收入。）
 */
export const MAX_VOUCHERS_PER_PAY = 2000

export class Economy {
  /**
   * @param {object|null} host 宿主 HostApi；null = 独立网页
   * @param {{ loadSettings: () => Promise<any>, saveSettings: (o: any) => Promise<boolean> }} store
   */
  constructor(host, store) {
    this.host = host
    this.store = store
    /** 还没发出去的券（结转量）。单位：张。 */
    this.pending = 0
    /** 已经发出去的券数（给探针 / 断言用） */
    this.paid = 0
    /** 串行链：两次结算不能读到同一个 pending */
    this.chain = Promise.resolve()
  }

  get enabled() {
    return !!this.host && typeof this.host.mintVoucher === 'function'
  }

  /** 从存档恢复未发出去的券。读不到当 0。 */
  async load() {
    try {
      const raw = await this.store.loadSettings()
      const v = Number(raw?.voucherCarry)
      if (Number.isFinite(v) && v > 0) this.pending = Math.floor(v)
    } catch {
      /* 没存过就是 0 */
    }
    return this
  }

  /**
   * 卖出所得 → 兑换券。
   *
   * @param {number} vouchers 这一单该发几张（`quote()` 的结果，整数）
   * @param {string} memo     宿主账本上的一行说明（家长在流水里看得见）
   * @returns {Promise<number>} 这一单**实际**发出几张（含之前欠的）
   */
  pay(vouchers, memo = '农场卖出') {
    const n = Math.floor(Number(vouchers) || 0)
    if (!(n > 0)) return Promise.resolve(0)
    this.pending += n

    const task = this.chain.then(async () => {
      if (this.pending <= 0) return 0
      if (!this.enabled) return 0 // 独立网页：留着，等进插件再发
      const want = Math.min(this.pending, MAX_VOUCHERS_PER_PAY)
      let got = 0
      try {
        got = Math.floor(Number(await this.host.mintVoucher(want, memo)) || 0)
      } catch (e) {
        console.warn('[cloudfarm] 发券失败，先记着', e)
        return 0
      }
      if (!(got > 0)) return 0
      got = Math.min(got, want)
      this.pending = Math.max(0, this.pending - got)
      this.paid += got
      return got
    })
    this.chain = task.catch(() => 0)
    return task
  }

  /** 落盘未发出去的券。卸载时 await（`storage.set` 是异步的，必须在 destroy 之前）。 */
  async flush() {
    try {
      const prev = (await this.store.loadSettings()) || {}
      await this.store.saveSettings({ ...prev, voucherCarry: this.pending })
    } catch {
      /* 落不下就算了，下一次卖出会把它算进去（只是重启后可能少这一笔） */
    }
  }

  /** 只读快照，给探针 / 断言用 */
  snapshot() {
    return { paid: this.paid, pending: this.pending, enabled: this.enabled }
  }
}
