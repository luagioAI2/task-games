// 经济公式（纯函数，浏览器与 Node 共用）。玩法与数值照抄 Poki《Idle Mining Empire》（MarketJS），仅作本机学习对照。
// 来源标注：[看] = 2026-10-03/05 在参考作界面上亲眼读到的数；[推] = 按看到的规律外推（参考作里没玩到那么深）。
// 逐项对账见 tools/ref-check.mjs，过程见 docs/research.md。所有数值单位都是“钱”：矿工背回来的矿直接按价值计。
//
// 三段链条：矿道（矿工走 2 秒 → 挖 4 秒 → 走 2 秒 → 放进箱子）→ 电梯（逐条矿道收箱子，送到地面）→ 仓库（推车工走 5 秒去电梯楼装货，再走 5 秒回仓库卖掉）。
// 注意：面板上的“总产量 / 总运量”是照抄原版界面的显示公式（会比实际跑出来的快），实际动作时间按原版录屏测得（[录]）。
// 没雇管理员的工人干完一轮就睡着，要点一下才再干；雇了管理员才会自动循环，也才算“闲置收入”（离线收益）。

export const SHAFT_COUNT = 9, SHAFTS_PER_LAYER = 3;      // 3 种矿各 3 条矿道；第 3、6 条之后各有一道岩障 [看 第一道] [推 共 9 条]

// —— 矿道 ——
// 第 4 版经济（用户要求：所有设施上限 200 级，金额仍控制在 T 量级）：
// 在第 3 版的基础上把每级成长“拉伸”——200 级的数值 ≈ 第 3 版的满级（矿道 60 级 / 电梯仓库 100 级），
// 并按比例调低 1→2 级升级价，让“升到同样强度的总花费”不变：节奏不变，只是每级更细、可升的级数更多。
// 满级后收入封顶约 10^10/秒（由满级电梯的运力决定）。
// 模拟（.tmp/tools/econv4b.mjs）：第 9 条矿道约 3.5 小时；认真玩 8 小时累计约 32T；连续 24 小时约 640T；最贵的单次升级约 52T。
const STRETCH_S = 59 / 199, STRETCH_E = 99 / 199;   // 第 3 版 60 级 / 100 级 → 第 4 版 200 级
const V3 = { mineGrow: 1.06, mineCost: 1.15, ehGrow: 1.22, ehCost: 1.19 };
export const MINE = {
  walk: 2,              // 矿工单程 2 秒（来回 4 秒）
  drop: 0.3,            // 走回箱子后放矿、转身约 0.3 秒（一轮约 8.3 秒）
  mineTime: 4,          // 容量 ÷ 挖矿速度 = 4 秒
  grow: Math.pow(V3.mineGrow, STRETCH_S),       // 容量、挖矿速度每级 ×1.0174
  costGrow: Math.pow(V3.mineCost, STRETCH_S),   // 升级价每级 ×1.0423
  minersAt: [80, 160],  // Lv 80 两名、Lv 160 三名矿工
};
// 等级上限（到了就是 MAX，不能再升）
export const MAX_LEVEL = { shaft: 200, elev: 200, house: 200 };
// 低档升级价的折算：等比数列总和跟第 3 版一致
const K_S = (1 - 1 / MINE.costGrow) / (1 - 1 / V3.mineCost);
const EH_COST = Math.pow(V3.ehCost, STRETCH_E), K_E = (1 - 1 / EH_COST) / (1 - 1 / V3.ehCost);
// buy 开拓价、cap 1 级容量、up 1→2 级升级价、mgr 管理员雇佣价、train 管理员 1→2 级培训价
const SHAFT_TABLE = [
  { buy: 10, cap: 20, mgr: 100, train: 250e3 },
  { buy: 1e3, cap: 1e3, mgr: 3e3, train: 500e3 },
  { buy: 3e4, cap: 1e4, mgr: 2e4, train: 1e6 },
  { buy: 4e5, cap: 8e4, mgr: 2e5, train: 5e6 },
  { buy: 5e6, cap: 6e5, mgr: 2.5e6, train: 3e7 },
  { buy: 6e7, cap: 4e6, mgr: 3e7, train: 2e8 },
  { buy: 7e8, cap: 2.5e7, mgr: 3.5e8, train: 1.5e9 },
  { buy: 4e9, cap: 1.2e8, mgr: 2e9, train: 1e10 },
  { buy: 4e10, cap: 6e8, mgr: 2e10, train: 8e10 },
];
export const SHAFTS = SHAFT_TABLE.map((s) => ({ ...s, up: s.buy * V3.mineCost * K_S }));
export const BARRIERS = { 3: 1.5e5, 6: 2.5e8 };   // 岩障：第 4、第 7 条矿道前面

// —— 电梯 / 仓库 ——（1 级数值；成长 / 升级价同样按 200 级拉伸：×1.104 / 级、×1.090 / 级）
const EH_GROW = Math.pow(V3.ehGrow, STRETCH_E);
export const ELEV = { load: 600, loadSpeed: 125, move: 1, grow: EH_GROW, up: 300 * K_E, costGrow: EH_COST, mgr: 400, train: 5e5, first: 1.55, floor: 1.2 };   // 移动速度 1 时：地面→第 1 条 1.55 秒、每层 1.2 秒
export const HOUSE = { load: 1000, loadSpeed: 250, walk: 2, grow: EH_GROW, up: 480 * K_E, costGrow: EH_COST, mgr: 400, train: 1e6, leg: 5 };   // 推车单程 5 秒

// —— 管理员 ——
export const SKILL = { mult: 2, time: 30, cooldown: 300 };   // “Double speed for 30s (cooldown 5 min)”，三种管理员相同
// 管理员等级：设施达到 at 级后才能花钱培训。效果累计。（三档；门槛随 200 级拉伸）
export const MGR_TIERS = {
  shaft: [{ at: 1, profit: 1 }, { at: 80, profit: 2 }, { at: 160, profit: 4 }],
  elev: [{ at: 1 }, { at: 50, all: 1.5 }, { at: 100, speed: 0.5 }],
  house: [{ at: 1 }, { at: 50, all: 1.5 }, { at: 100, speed: 0.5 }],
};
// 第 3 版存档的等级 → 第 4 版等级（数值强度不变）
export const levelFromV3 = (kind, L) => Math.min(MAX_LEVEL[kind], Math.max(1, Math.round(1 + (L - 1) / (kind === 'shaft' ? STRETCH_S : STRETCH_E))));
const TRAIN_STEP = 60;   // 培训价每升一档 ×60
// 培训到第 k+1 级（k = 当前等级，1 起）的价钱
export const trainCost = (kind, i, k) => (kind === 'shaft' ? SHAFTS[i].train : kind === 'elev' ? ELEV.train : HOUSE.train) * Math.pow(TRAIN_STEP, k - 1);
export const managerCost = (kind, i = 0) => (kind === 'shaft' ? SHAFTS[i].mgr : kind === 'elev' ? ELEV.mgr : HOUSE.mgr);
// 当前等级的累计效果
export function mgrEffect(kind, lvl) {
  const out = { profit: 1, speed: 0, all: 1 };
  for (const t of MGR_TIERS[kind].slice(0, Math.max(0, lvl))) { if (t.profit) out.profit = t.profit; if (t.speed) out.speed += t.speed; if (t.all) out.all *= t.all; }
  return out;
}

// —— 投资人（重开加成）——
// 累计收入越多，重开时入股的投资人越多：人数 = ⌊√(累计 ÷ 4.44×10^10)⌋ − 上次重开时已结算的部分；每位让矿道产出 +2%。
// 每位投资人：全部产出 +10%（用户要求，原 +2%）。收入仍被满级电梯运力封顶约 10^10/秒，只是重开后追回来更快
export const INVESTOR = { unit: 4e11 / 9, bonus: 0.1 };
// 商城：用平台硬币招募 1 位投资人的价格（用户定：10 硬币）。itemId 不要改，补发未到账的购买靠它识别
export const SHOP = { investorItem: 'investor', investorCoins: 10 };

const count = (arr, L) => arr.filter((m) => L >= m).length;
const countBelow = (arr, L) => arr.filter((m) => L > m).length;

// mods：{ inv 投资人加成（0.02×人数）, mgrLevel 本矿道管理员等级（0 = 没雇）, all 电梯 / 仓库管理员给的全矿道倍数 }
export function shaftStats(i, L, mods = {}) {
  const S = SHAFTS[i], g = Math.pow(MINE.grow, L - 1), inv = 1 + (mods.inv ?? 0);
  const pm = (mods.mgrLevel ? mgrEffect('shaft', mods.mgrLevel).profit : 1) * (mods.all ?? 1);
  const miners = 1 + count(MINE.minersAt, L);
  const cap = S.cap * g * pm * inv;
  const speed = (S.cap / MINE.mineTime) * g * pm * inv;      // 挖矿速度（钱 / 秒）
  const cycle = cap / speed + MINE.walk;
  // 闲置收入按真实节奏算：矿工数 × 容量 ÷ 一趟的真实用时（走 2 + 挖 4 + 走 2 + 放 0.3 秒）
  const trip = cap / speed + 2 * MINE.walk + MINE.drop;
  const perSec = miners * cap / trip;
  return { miners, cap, speed, walk: MINE.walk, mine: cap / speed, drop: MINE.drop, cycle, perSec, pm };
}
// 电梯总运量：装、卸各一次 + 下到最深一条再上来（mods.n = 已开的矿道数）
export function elevStats(L, mods = {}) {
  const g = Math.pow(ELEV.grow, L - 1), sp = 1 + (mods.mgrLevel ? mgrEffect('elev', mods.mgrLevel).speed : 0);
  const load = ELEV.load * g, loadSpeed = ELEV.loadSpeed * g * sp, move = ELEV.move * sp, n = Math.max(1, mods.n ?? 1);
  const trip = 2 * load / loadSpeed + 2 * (ELEV.first + ELEV.floor * (n - 1)) / move;
  return { load, loadSpeed, move, first: ELEV.first / move, floor: ELEV.floor / move, perSec: load / trip };
}
export function houseStats(L, mods = {}) {
  const g = Math.pow(HOUSE.grow, L - 1), sp = 1 + (mods.mgrLevel ? mgrEffect('house', mods.mgrLevel).speed : 0);
  const load = HOUSE.load * g, loadSpeed = HOUSE.loadSpeed * g * sp, walk = HOUSE.walk / sp, leg = HOUSE.leg / sp;
  return { workers: 1, load, loadSpeed, walk, leg, perSec: load / (2 * load / loadSpeed + 2 * leg) };
}

// 升级价：从 L 级连升 n 级 = base·c^(L−1)·(c^n − 1)/(c − 1)
const upBase = (kind, i) => (kind === 'shaft' ? [SHAFTS[i].up, MINE.costGrow] : kind === 'elev' ? [ELEV.up, ELEV.costGrow] : [HOUSE.up, HOUSE.costGrow]);
// 还能升几级（到上限为止）
export const levelsLeft = (kind, L) => Math.max(0, MAX_LEVEL[kind] - L);
export function bulkCost(kind, i, L, n) { const [b, c] = upBase(kind, i); return b * Math.pow(c, L - 1) * (Math.pow(c, n) - 1) / (c - 1); }
// MAX：钱够买到的最多级（至少 1 级，用于显示价钱；不超过上限；已满级时 n = 0）
export function maxAffordable(kind, i, L, cash) {
  const left = levelsLeft(kind, L); if (left < 1) return { n: 0, cost: Infinity };
  const [b, c] = upBase(kind, i), first = b * Math.pow(c, L - 1);
  const n = Math.min(left, Math.max(1, Math.floor(Math.log10(Math.max(0, cash) * (c - 1) / first + 1) / Math.log10(c))));
  return { n, cost: bulkCost(kind, i, L, n) };
}
export const upCost = (kind, i, L) => bulkCost(kind, i, L, 1);

// 全矿道倍数：电梯、仓库管理员的等级效果相乘
export const allProfit = (state) => (state.elev.mgr ? mgrEffect('elev', state.elev.mgr).all : 1) * (state.house.mgr ? mgrEffect('house', state.house.mgr).all : 1);
// 闲置收入（HUD、离线收益）：有管理员的矿道总产量、电梯总运量、仓库总运量三者取最小；电梯和仓库都要有管理员
export function idleIncome(state, inv = 0) {
  const e = state.elev, h = state.house;
  if (!e.mgr || !h.mgr) return { supply: 0, elev: 0, house: 0, income: 0 };
  const all = allProfit(state);
  const supply = state.shafts.filter((s) => s.unlocked && s.mgr && !s.blocked).reduce((a, s) => a + shaftStats(s.i, s.level, { inv, mgrLevel: s.mgr, all }).perSec, 0);   // 被魔物占据的矿道不算
  const elev = elevStats(e.level, { mgrLevel: e.mgr, n: state.shafts.filter((s) => s.unlocked).length }).perSec, house = houseStats(h.level, { mgrLevel: h.mgr }).perSec;
  return { supply, elev, house, income: Math.min(supply, elev, house) };
}
