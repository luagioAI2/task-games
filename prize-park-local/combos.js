/**
 * combos.js —— **娃娃组合**：凑齐一套，一起兑换，多给一点券。
 *
 * ## 为什么要有「组合」而不是单纯提高回收价
 *
 * 提高单价是**对所有人生效**的（抓到一只就多拿），组合是**对收集生效**的：
 * 缺一只就换不了，玩家会为了凑齐去玩平时不碰的机台。
 * 前者是通胀，后者是目标 —— 而且组合的加成只落在「凑齐」这一个动作上，
 * 天然是低频的。
 *
 * ## ★ 加成不能随便加：它会抬高「一局期望产出」
 *
 * `recycle.js` 头注释里那条不变量（`期望产出 < 一局成本`）对组合**同样成立**，
 * 而且组合会把整条曲线按「加成率」整体抬起来：
 *
 * ```
 *   每个娃娃最终都会被卖掉（卖一只少一只），所以
 *   实际期望产出 = 基础期望 × (1 + 加成率)
 * ```
 *
 * 现在最高的一档加成是 `cake2` / `bear2` 的 4 → 5（+25%），
 * 基础申报 0.6 ⇒ 最坏 0.75，仍在宿主闸门的 0.8 以内。
 * **加新组合之前先算这一格**：只要有一条 +25% 以上的组合，就得回头压基础价。
 *
 * ## 为什么按 id 列表而不是按稀有度分组
 *
 * 按稀有度分组（「任意 3 只 2 星」）看着更灵活，但它会让「凑齐」变成
 * 「攒够 3 只」，跟直接卖没区别 —— 那就没有收集目标了。这里要的是
 * **具体的几只**（枕头三兄弟、吉祥物全家福）。
 */

import { PRIZE_META } from './config.js'
import { recycleValue } from './recycle.js'

/**
 * 组合表。
 *
 * - `ids`：必须**各有一只**。同一只娃娃可以同时属于多个组合
 *   （`mascot_bear` 在 `bear2` 和 `mascot6` 里），兑换时按需消耗 ——
 *   玩家的取舍就发生在这里，这是设计的一部分，不是漏洞。
 * - `bonus`：额外多给的券。**必须是整数**（券没有小数）。
 * - 名字在 `i18n.js` 的 `EXTRA` 里，键名 `cb_<id>`。
 */
export const COMBOS = [
  { id: 'pillow3', ids: ['pillow_pig', 'pillow_rabbit', 'pillow_dog'], bonus: 1 },
  { id: 'cake2', ids: ['cake_set', 'cake_parfait'], bonus: 1 },
  { id: 'bear2', ids: ['bear', 'mascot_bear'], bonus: 1 },
  { id: 'legend2', ids: ['figure', 'noctis'], bonus: 2 },
  {
    id: 'mascot6',
    ids: ['mascot_bear', 'mascot_rabbit', 'mascot_cat', 'mascot_dog', 'mascot_chick', 'mascot_panda'],
    bonus: 2,
  },
]

/** 组合里每样一只，按单只回收价加起来（不含加成）。 */
export function comboBase(c) {
  return c.ids.reduce((sum, id) => sum + recycleValue(id), 0)
}

/** 一起兑换实际到手的券数（含加成）。 */
export function comboTotal(c) {
  return comboBase(c) + c.bonus
}

/**
 * 组合里单只最高折合多少券 —— 宿主的 `economy.capPerPrize` 必须 ≥ 这个数。
 *
 * 2 件的组合最容易顶到上限（`legend2` 是 12 / 2 = 6）。
 * 不校验的话，家长看到的「单件最高」会比实际能拿到的少，那是骗人。
 */
export function comboMaxPerPrize() {
  let max = 0
  for (const c of COMBOS) max = Math.max(max, comboTotal(c) / c.ids.length)
  return max
}

/**
 * 组合里的 id 是不是都真实存在。**加载时校验一次**。
 *
 * 写错一个 id 的后果是 `recycleValue` 兜底成 1、`prizeImg` 拿到空图，
 * 界面上就是一张破图 + 一个永远凑不齐的组合 —— 而且不报错。
 */
export function validateCombos() {
  const bad = []
  for (const c of COMBOS) {
    for (const id of c.ids) if (!PRIZE_META[id]) bad.push(`${c.id}:${id}`)
    if (!Number.isInteger(c.bonus) || c.bonus < 0) bad.push(`${c.id}:bonus=${c.bonus}`)
  }
  return bad
}
