"""宿主侧：加 `mintVoucher`（抓到奖品直接发兑换券，不经过游戏币）。

为什么不能拿 `mintGameCoin` + `redeemGameCoin` 凑：
  ① 中间崩一下就留下「币还在」—— 而币能直接开局，正是要堵的那条回路；
  ② 账本上每卖一只娃娃都留一对 +2/-2，家长看到的流水没法读。

用法：python scripts/patch-mint-voucher.py
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
edits = []


def rep(path, old, new, note):
    edits.append((ROOT / path, old, new, note))


# ── 1. db.ts：发券原语 ────────────────────────────────────────────
rep(
    "src/db/db.ts",
    """/* ---------------- 兑换券账本 ---------------- */""",
    """/**
 * **抓到奖品直接发兑换券** —— 不经过游戏币。
 *
 * ## 为什么需要这扇门（而不是复用 `mintGameCoin` + `redeemGameCoins`）
 *
 * 两只娃娃机的玩法不同：
 *   · **内置那台**：玩一局扣 1 币，抓到娃娃**当场发券**（`useApp.settleClawRound`
 *     里和扣币在同一个事务）—— 币永远是「入场券」，不是「战利品」。
 *   · **插件那台（奖品公园）**：原来的回收是「娃娃 → 币」，于是币有了第二个来源。
 *     而币能直接开局 ⇒ 抓娃娃本身能续玩 = 那条「坐着玩」的回路又回来了。
 *
 * 用 `mintGameCoin(n)` + `redeemGameCoins(n)` 凑出来是不行的，两个原因：
 *   ① 两个事务。中间崩一下（或玩家在这几毫秒里关掉 App）就留下**真实的币**，
 *      而币能开局 —— 正是要堵的那条回路；
 *   ② 每卖一只娃娃账本上留一对 `+2 / -2`，家长看到的流水没法读。
 *
 * ## 为什么这条不算印钞机
 *
 * 和内置那台同一个口径：`postHarvest` 是兑换券的**唯一入口**，兑换券 ⇸ 积分
 * （见 `HarvestEntry` 的两条不可逆约束）。一局能出多少券由
 * `economy.expectedPayout`（安装时 `checkPluginEconomy` 把关）钉住。
 *
 * @returns 实际发出的兑换券数量；`0` = 没发（数量非法）。
 */
export async function mintGameVouchers(
  gameId: string,
  count: number,
  memo: string,
): Promise<number> {
  const n = Math.round(count)
  if (!(n > 0)) return 0
  // 走 `postHarvest` —— 和农场卖东西、内置娃娃机兑奖是**同一个入口**，
  // 账目只有一套口径（`balanceAfter` 也由它算）。
  // `source` 复用 `claw_prize`（「娃娃机抓到娃娃兑换」），
  // `refId` 记游戏 id，将来要分「哪台机器发的」也分得开。
  const row = await postHarvest({ delta: n, source: 'claw_prize', refId: gameId, memo })
  return row.delta
}

/* ---------------- 兑换券账本 ---------------- */""",
    "db.ts 加 mintGameVouchers",
)

# ── 2. plugin.ts：契约 + 版本 ────────────────────────────────────
rep(
    "src/games/plugin.ts",
    """  /**
   * **把游戏币换成兑换券** —— 整条链的最后一跳（spec §2.2）。
   *
   * ```
   *   积分 ──buyGameCoin──▶ 游戏币 ──redeemGameCoin──▶ 兑换券
   *                            ▲
   *                            └──mintGameCoin── 抓到奖品
   * ```""",
    """  /**
   * **把游戏币换成兑换券** —— 整条链的最后一跳（spec §2.2）。
   *
   * ```
   *   积分 ──buyGameCoin──▶ 游戏币 ──redeemGameCoin──▶ 兑换券
   *                            ▲
   *                            └──mintVoucher── 抓到奖品（直接发券，不经过币）
   * ```""",
    "plugin.ts 货币链示意图",
)

rep(
    "src/games/plugin.ts",
    """  redeemGameCoin(count: number, memo: string): Promise<number>
""",
    """  redeemGameCoin(count: number, memo: string): Promise<number>

  /**
   * **抓到奖品直接发兑换券** —— 不经过游戏币（HOST_API 4）。
   *
   * 内置娃娃机就是这么结算的（`useApp.settleClawRound`：扣 1 币 + 发券在同一个
   * 事务里）。插件里「娃娃 → 币 → 券」那种写法会让币多一个来源，而币能直接开局
   * ⇒ 抓娃娃本身能续玩，等于把「坐着玩」那条回路又接回来。
   *
   * 所以：**币是入场券（买来的），券是战利品（抓来的）**，两者不互通。
   * 玩家手里剩下的币仍然可以 `redeemGameCoin` 换成券（那是「没用完的入场券」）。
   *
   * @returns 实际发出的兑换券数量。`0` = 没发（数量非法）。
   *
   * ⚠️ 为什么不让插件「自己 mint 币再 redeem」：两个事务，中间崩一下就是
   *   「币还在」—— 而币能开局，正好是要堵的那条回路。
   * ⚠️ 兑换券 ⇸ 积分（spec §2.2），所以这条也只是「有去无回」的终点。
   */
  mintVoucher(count: number, memo: string): Promise<number>
""",
    "plugin.ts 加 mintVoucher",
)

rep(
    "src/games/plugin.ts",
    """ * ⚠️ 加参数（②）和放宽返回类型（①）本身不破坏老插件：老插件不读第三个
 * 参数、同步返回函数，照样跑。**但 ③ 是真新增**，声明了 `minHostApi: 3`
 * 的插件才敢调它。所以这次 +1 的实际作用是「给新插件一个版本号可用」。
 */
export const HOST_API = 3""",
    """ * ⚠️ 加参数（②）和放宽返回类型（①）本身不破坏老插件：老插件不读第三个
 * 参数、同步返回函数，照样跑。**但 ③ 是真新增**，声明了 `minHostApi: 3`
 * 的插件才敢调它。所以这次 +1 的实际作用是「给新插件一个版本号可用」。
 *
 * 2026-10-23 → **4**：新增 `mintVoucher()`（抓到奖品直接发兑换券）。
 * 同样是「加方法」，同样不算破坏 —— 但奖品公园 1.5.0 起要靠它结算回收，
 * 它必须能声明「宿主至少得有这么一扇门」，否则在老宿主上
 * `host.mintVoucher` 是 undefined → TypeError → 卖娃娃点了没反应。
 */
export const HOST_API = 4""",
    "plugin.ts HOST_API → 4",
)

# ── 3. hostApi.ts：实现 ──────────────────────────────────────────
rep(
    "src/games/hostApi.ts",
    """  listGameKv,
  redeemGameCoins,""",
    """  listGameKv,
  mintGameVouchers,
  redeemGameCoins,""",
    "hostApi.ts import",
)

rep(
    "src/games/hostApi.ts",
    """    /**
     * 用积分买币。走 `db.buyGameCoins` —— 扣积分和记币在**同一个事务**里。""",
    """    /**
     * 抓到奖品直接发兑换券（HOST_API 4）。走 `db.mintGameVouchers` → `postHarvest`。
     *
     * 不经过币：币是「买来的入场券」，券是「抓来的战利品」。混起来的话
     * 娃娃就能变回币、币又能直接开局 —— 抓娃娃本身能续玩。
     */
    mintVoucher: async (count, memo) => {
      const got = await mintGameVouchers(gameId, count, memo)
      if (got > 0) await deps.refresh()
      return got
    },

    /**
     * 用积分买币。走 `db.buyGameCoins` —— 扣积分和记币在**同一个事务**里。""",
    "hostApi.ts 实现 mintVoucher",
)

miss = []
for path, old, new, note in edits:
    s = path.read_text(encoding="utf-8")
    n = s.count(old)
    if n != 1:
        miss.append(f"{note}: 命中 {n} 次")
        continue
    path.write_text(s.replace(old, new, 1), encoding="utf-8")

if miss:
    print("✗ 有锚点没命中（前面的已写入，注意复核）：")
    for m in miss:
        print("   " + m)
    sys.exit(1)

print(f"✓ {len(edits)} 处写入完成")
