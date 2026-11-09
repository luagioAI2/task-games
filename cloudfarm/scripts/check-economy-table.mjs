#!/usr/bin/env node
/**
 * 数值闸门：把目录里**每一项**的「满产卖出(券) / 成本(积分)」算出来，任何一项出带就红。
 *
 * ## 为什么要有这个脚本（2026-10-24 的漏报）
 *
 * 宿主 `checkPluginEconomy` 只验 `manifest.economy` 里**申报的那一个数**，而那个数是
 * 「一局」口径（`playCost 10`）。于是一种漏洞它天生抓不到：**长周期**资产。
 * 实测：两只 L6 永久神兽的 `times` 还是玩具时代的 365 轮（那时积分白送），
 * 满产 365×4×6 = 8760 张券 / 1000 积分 = **8.76 倍**；玉龙 10.22 倍。
 * 一局申报 6.7 永远合规，而孩子攒够 1000 分养一只，十几天的产出就是 1 万张券。
 *
 * 所以这里补一条**逐项**的闸门：不看「一局」，看「这一个东西从买到卖完」。
 *
 * ## 判据（四条，各自都能真的红）
 *
 *   ① 每一项 `0.40 ≤ 满产券 / 成本 ≤ 0.67`
 *      —— 上界 0.67 是「最坏那一项」（鸡/鱼 0.667）；下界 0.40 是「买了等于白送」
 *   ② `expectedPayout ≥ 最坏一项 × playCost`
 *      —— **申报必须覆盖最坏一项**。按平均值申报 = 漏报，漏报那一刻闸门就失效了
 *      （这条正是能抓住上面那个 365 轮 bug 的判据）
 *   ③ `expectedPayout ≤ 0.8 × playCost`（宿主那道门的同一条，本地先挡一次）
 *   ④ `capPerPrize ≥ 单笔最大结算`（否则孩子卖一单会被静默截断）
 *
 * ⚠️ 改 `src/data/catalog.js` 里任何一个 `cost` / `seed` / `price` / `times`，都要
 *    同步 `plugin.js` 的 `economy` 申报 —— 这个脚本会告诉你新值是多少。
 *
 * 用法：`node scripts/check-economy-table.mjs [--all]`（`--all` 打印全表，默认只打印出带的）
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { CROPS, ANIMALS, PER_YIELD, FISHING, ITEM_PRICE } from '../src/data/catalog.js'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.dirname(HERE)

const BAND = { min: 0.4, max: 0.67 }
const MAX_PAYOUT_RATIO = 0.8 // 和宿主 `domain/pluginEconomy.ts` 的 MAX_PAYOUT_RATIO 同一个数

/* ---------------- 读申报值 ----------------
 *
 * 用正则读 `plugin.js` 的源码，**不 import 它** —— 那个文件会拉进 Pixi / FX 运行时，
 * 在 Node 里既慢又没必要（而且它只是外壳，数值全在 manifest 字面量里）。
 */
const src = readFileSync(path.join(ROOT, 'plugin.js'), 'utf8')
const pick = (key) => {
  const m = src.match(new RegExp(`\\b${key}\\s*:\\s*(-?[\\d.]+)`))
  if (!m) throw new Error(`plugin.js 里找不到 ${key} —— 申报字段被改名了？`)
  return Number(m[1])
}
const declared = {
  playCost: pick('playCost'),
  expectedPayout: pick('expectedPayout'),
  capPerPrize: pick('capPerPrize'),
  voucherPerCoin: pick('voucherPerCoin'),
}

/* ---------------- 逐项算 ---------------- */
const rows = []
for (const c of CROPS) {
  rows.push({
    kind: 'crop',
    id: c.id,
    cost: c.seed,
    price: c.price,
    times: c.times,
    cap: c.times * PER_YIELD * c.price,
  })
}
for (const a of ANIMALS) {
  rows.push({
    kind: 'animal',
    id: a.id,
    cost: a.cost,
    price: a.price,
    times: a.times,
    cap: a.times * PER_YIELD * a.price,
  })
}
for (const r of rows) r.ratio = r.cap / r.cost
rows.sort((x, y) => y.ratio - x.ratio)

const worst = rows[0]
const fails = []
const fmt = (n) => (Number.isInteger(n) ? String(n) : n.toFixed(3))

// ① 逐项在带内
const outOfBand = rows.filter((r) => r.ratio < BAND.min - 1e-9 || r.ratio > BAND.max + 1e-9)
for (const r of outOfBand) {
  fails.push(
    `${r.kind} ${r.id}：满产 ${r.cap} 券 / 成本 ${r.cost} 积分 = ${r.ratio.toFixed(3)}，` +
      `出带 [${BAND.min}, ${BAND.max}]`,
  )
}

// ② 申报覆盖最坏一项
const needDeclared = worst.ratio * declared.playCost
if (declared.expectedPayout < needDeclared - 1e-9) {
  fails.push(
    `申报漏了最坏一项：expectedPayout ${declared.expectedPayout} < ` +
      `${worst.kind} ${worst.id} 的 ${worst.ratio.toFixed(3)} × playCost ${declared.playCost} = ${fmt(+needDeclared.toFixed(3))}`,
  )
}

// ③ 宿主那道门
if (declared.expectedPayout > declared.playCost * MAX_PAYOUT_RATIO + 1e-9) {
  fails.push(
    `expectedPayout ${declared.expectedPayout} 超过 playCost ${declared.playCost} 的 ${MAX_PAYOUT_RATIO * 100}%` +
      `（上限 ${fmt(+(declared.playCost * MAX_PAYOUT_RATIO).toFixed(3))}）`,
  )
}

// ④ 单笔结算上限
const maxCap = Math.max(...rows.map((r) => r.cap))
if (declared.capPerPrize < maxCap) {
  fails.push(`capPerPrize ${declared.capPerPrize} < 单笔最大结算 ${maxCap}（${worst.id}）—— 会被静默截断`)
}

// ⑤ 本作不发行游戏币（形态约束，不是算术）
if (declared.voucherPerCoin !== 0) {
  fails.push(`voucherPerCoin 应为 0（本作不设游戏币），现在是 ${declared.voucherPerCoin}`)
}

/* ---------------- 钓鱼（概率表，不是目录项） ----------------
 *
 * 它同样是「积分 → 券」的一条路：下竿花 `FISHING.cost`，钓上来的东西卖券。
 * 所以也要过同一条带。**判据是期望值，不是某一档**：脱钩（fail）那一档产出 0，
 * 只看「钓到鱼」的档会算得比实际好看。
 *
 * 档位随等级变（低等级钓不到稀有的），所以按等级逐个算，任何一档出带都红。
 */
function fishingOdds(level) {
  const out = new Map() // catch id → 概率
  let prev = 0
  for (const roll of FISHING.rolls) {
    const p = roll.below - prev
    prev = roll.below
    if (roll.catch === 'fail') continue
    // 等级不够就退回 fallback（和 game.js 的 rollCatch 同一条规则）
    const id = roll.minLevel == null || level >= roll.minLevel ? roll.catch : FISHING.fallback
    out.set(id, (out.get(id) ?? 0) + p)
  }
  const tail = FISHING.fallback
  out.set(tail, (out.get(tail) ?? 0) + (1 - prev))
  return out
}

/** 一个档位钓上来的东西值几张券（item 不在 ITEM_PRICE 里就抛 —— 卖不出价等于静默白送） */
function fishingWorth(id) {
  const c = FISHING.catch[id]
  if (!c) throw new Error(`FISHING.rolls 指向了 catch 表里没有的档位 "${id}"`)
  const price = ITEM_PRICE[c.item]
  if (!Number.isFinite(price)) {
    throw new Error(`FISHING.catch.${id}.item = "${c.item}" 不在 ITEM_PRICE 里 —— 钓上来卖不出价`)
  }
  return c.n * price
}

const fishRows = []
for (const level of [1, 2, 3, 4, 5, 6, 7, 8, 10]) {
  const odds = fishingOdds(level)
  let ev = 0
  for (const [id, p] of odds) ev += p * fishingWorth(id)
  fishRows.push({ level, ev, ratio: ev / FISHING.cost })
}

const fishWorst = fishRows.reduce((a, b) => (b.ratio > a.ratio ? b : a))
const fishBest = fishRows.reduce((a, b) => (b.ratio < a.ratio ? b : a))

/*
 * 结构判据：`game.js` 必须**真的在用**这张表。
 *
 * 只断言「有」不断言「没有」—— 因为 game.js 里别的随机逻辑也会写 `r < 0.x`，
 * 断言「不许出现」会误伤。这里的意义是：如果有人把概率表又抄回 `rollCatch()`、
 * 顺手删掉了 FISHING 的引用，上面那些期望值就变成了「算一张没人用的表」，必须红。
 */
const gameSrc = readFileSync(path.join(ROOT, 'src/game.js'), 'utf8')
for (const [needle, why] of [
  ['FISHING.rolls', '档位表（rollCatch 必须读 FISHING.rolls）'],
  ['FISHING.catch[out]', '产出表（入包必须读 FISHING.catch）'],
  ['FISHING.cost', '下竿费（FISH_COST 必须来自 FISHING.cost）'],
]) {
  if (!gameSrc.includes(needle)) fails.push(`src/game.js 里找不到 ${needle} —— ${why}`)
}
for (const r of fishRows) {
  if (r.ratio < BAND.min - 1e-9 || r.ratio > BAND.max + 1e-9) {
    fails.push(
      `fishing L${r.level}：期望 ${+r.ev.toFixed(2)} 券 / 成本 ${FISHING.cost} 积分 = ${r.ratio.toFixed(3)}，` +
        `出带 [${BAND.min}, ${BAND.max}]`,
    )
  }
}

/* ---------------- 输出 ---------------- */
console.log(
  `申报：playCost ${declared.playCost} · expectedPayout ${declared.expectedPayout}` +
    ` · capPerPrize ${declared.capPerPrize} · voucherPerCoin ${declared.voucherPerCoin}`,
)
console.log(
  `全表：${rows.length} 项 · 比率 ${rows[rows.length - 1].ratio.toFixed(3)} ~ ${worst.ratio.toFixed(3)}` +
    `（带 ${BAND.min} ~ ${BAND.max}）`,
)

const showAll = process.argv.includes('--all')
const show = showAll ? rows : outOfBand
if (show.length) {
  console.log('\n  项                    成本    满产券   比率')
  for (const r of show) {
    console.log(
      `  ${(r.kind + ' ' + r.id).padEnd(20)} ${String(r.cost).padStart(5)} ${String(r.cap).padStart(8)}` +
        `  ${r.ratio.toFixed(3)}${outOfBand.includes(r) ? '  ← 出带' : ''}`,
    )
  }
}

if (showAll) {
  console.log(`\n  钓鱼（概率表）· 每竿 ${FISHING.cost} 积分`)
  for (const r of fishRows) {
    console.log(`  L${String(r.level).padEnd(3)} 期望 ${r.ev.toFixed(2).padStart(5)} 券   ${r.ratio.toFixed(3)}`)
  }
}

if (fails.length) {
  console.error('\n✗ 数值不合规：')
  for (const f of fails) console.error('  -', f)
  process.exit(1)
}
console.log(
  `\n✓ 全部在带内（目录 ${rows.length} 项 + 钓鱼 ${fishRows.length} 档 ` +
    `${fishBest.ratio.toFixed(3)}~${fishWorst.ratio.toFixed(3)}），且申报覆盖最坏一项`,
)
