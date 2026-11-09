/* 1× 尺度下的节奏表：一个 10 分钟的会话里，孩子到底能收到什么（2026-11-09）。

   背景：`MS_PER_FARM_MIN` 从 6000 改回 60000 之后，**比率没变**（经济表还是 0.40~0.67），
   但「什么时候到手」全变了。这一份只回答节奏，不改任何数值。

   用法：node scripts/_pacing-report.mjs
*/
import {
  CROPS, ANIMALS, PER_YIELD, MS_PER_FARM_MIN,
  capCrop, capAnimal, fullYieldCrop, fullYieldAnimal,
} from '../src/data/catalog.js'

const MIN = MS_PER_FARM_MIN / 60000 // 1 农场分钟 = 多少现实分钟
const SESSION = 10 // 商城详情页写的是「一次 5~10 分钟」
const h = (min) => (min >= 60 ? `${(min / 60).toFixed(1)} 小时` : `${Math.round(min)} 分`)

console.log(`1 农场分钟 = ${MIN} 现实分钟 · 会话按 ${SESSION} 分钟算\n`)

console.log('【作物】首收 / 之后每轮 / 轮数 / 满产总时长 / 成本→满产券')
for (const c of CROPS) {
  const first = c.growMin * MIN
  const regrow = (c.regrowMin || 0) * MIN
  const rounds = c.times
  const total = first + Math.max(0, rounds - 1) * regrow
  const inSession = Math.floor((SESSION - first) / (regrow || first)) + (first <= SESSION ? 1 : 0)
  const flag = first > SESSION ? '  ← 首收就超出一次会话' : ''
  console.log(
    `  ${c.id.padEnd(11)} ${h(first).padStart(7)} / ${(regrow ? h(regrow) : '—').padStart(7)}` +
    ` / ${String(rounds).padStart(2)} 轮 / ${h(total).padStart(8)}` +
    ` / ${String(c.seed).padStart(4)} → ${String(capCrop(c)).padStart(5)}` +
    ` / 会话内约 ${Math.max(0, inSession)} 次${flag}`,
  )
}

console.log('\n【动物】成年 / 之后每窝 / 窝数 / 满产总时长 / 成本→满产券')
for (const a of ANIMALS) {
  const mature = a.matureMin * MIN
  const every = a.intervalMin * MIN
  const total = mature + a.times * every
  const inSession = Math.floor(SESSION / every)
  const flag = every > 24 * 60 ? '  ← 一窝超过一天' : ''
  console.log(
    `  ${a.id.padEnd(11)} ${h(mature).padStart(7)} / ${h(every).padStart(7)}` +
    ` / ${String(a.times).padStart(2)} 窝 / ${h(total).padStart(9)}` +
    ` / ${String(a.cost).padStart(4)} → ${String(capAnimal(a)).padStart(5)}` +
    ` / 会话内约 ${inSession} 窝${flag}`,
  )
}

/* 一整天（孩子早中晚各开一次 ≈ 3 个会话）能收多少轮 —— 只看「有没有东西可收」 */
console.log('\n【一天 24 小时】满产要几天（= 满产总时长 / 24h）')
const slow = [...CROPS.map((c) => ({
  id: c.id, kind: '作物',
  days: (c.growMin * MIN + Math.max(0, c.times - 1) * (c.regrowMin || 0) * MIN) / 1440,
})), ...ANIMALS.map((a) => ({
  id: a.id, kind: '动物',
  days: (a.matureMin * MIN + a.times * a.intervalMin * MIN) / 1440,
}))].filter((x) => x.days >= 1).sort((a, b) => b.days - a.days)

for (const x of slow) console.log(`  ${x.kind} ${x.id.padEnd(11)} 满产要 ${x.days.toFixed(1)} 天`)
if (!slow.length) console.log('  （都在一天内跑完）')

console.log(`\n满产产量：作物恒 ${PER_YIELD}/次（PER_YIELD），作物单株上限 ${fullYieldCrop(CROPS[0])} 个起`)
console.log(`动物：鸡 ${fullYieldAnimal(ANIMALS[0])} 个 / 神兽猫 ${fullYieldAnimal(ANIMALS.find((a) => a.id === 'mythcat'))} 个`)
