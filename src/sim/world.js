// 世界模拟（确定性，固定步长；浏览器与 Node 共用，不依赖 DOM）。规则照抄《Idle Mining Empire》：
// 时间都按原版录屏测得：
// 矿工：走 2 秒到矿壁 → 挖（容量 ÷ 挖矿速度 = 4 秒）→ 走 2 秒回来 → 放进箱子（0.3 秒）；没雇管理员就睡着，等玩家点一下再干一轮。
// 电梯：从第 1 条往下逐条收箱子，装满或到最深一条就上来，按装货速度卸到电梯楼的矿堆；地面→第 1 条 1.55 秒、每层 1.2 秒（÷ 移动速度）。没管理员时点一下才跑一趟，有管理员就一趟接一趟。
// 推车工：走 5 秒到电梯楼 → 按装货速度装车 → 走 5 秒回仓库 → 按装货速度卸货卖掉。没管理员时点一下才跑一趟。
// 管理员技能：30 秒内速度 ×2，结束后冷却 5 分钟。
import * as E from './economy.js';

export const DT = 1 / 20;
const EPS = 1e-9;

const newShaft = (i) => ({ i, unlocked: false, level: 1, mgr: 0, crate: 0, boostT: 0, cdT: 0, tapped: false, miners: [] });
export function newState(keep = {}) {
  return {
    v: 2, t: 0, cash: 10, lifetime: keep.lifetime ?? 0, runStart: keep.lifetime ?? 0, investors: keep.investors ?? 0,
    shafts: Array.from({ length: E.SHAFT_COUNT }, (_, i) => newShaft(i)),
    barriers: {},
    elev: { level: 1, mgr: 0, ph: 'idle', y: 0, target: 0, load: 0, top: 0, boostT: 0, cdT: 0, tapped: false },
    house: { level: 1, mgr: 0, workers: [], boostT: 0, cdT: 0, tapped: false },
  };
}
export const invBonus = (state) => state.investors * E.INVESTOR.bonus;
export const shaftStatsOf = (state, s, L = s.level) => E.shaftStats(s.i, L, { inv: invBonus(state), mgrLevel: s.mgr, all: E.allProfit(state) });
export const elevStatsOf = (state, L = state.elev.level) => E.elevStats(L, { mgrLevel: state.elev.mgr, n: state.shafts.filter((s) => s.unlocked).length });
export const houseStatsOf = (state, L = state.house.level) => E.houseStats(L, { mgrLevel: state.house.mgr });
export const idleIncome = (state) => E.idleIncome(state, invBonus(state));
const earn = (state, v) => { state.cash += v; state.lifetime += v; };
export const reward = earn;   // 战斗奖励等额外收入（计入累计收入）

function syncCrew(state) {
  for (const s of state.shafts) if (s.unlocked) {
    const n = shaftStatsOf(state, s).miners;
    while (s.miners.length < n) s.miners.push({ ph: s.mgr ? 'out' : 'sleep', t: -s.miners.length * 0.7, load: 0 });
  }
  if (!state.house.workers.length) state.house.workers.push({ ph: 'sleep', t: 0, load: 0 });
}
// 技能计时：生效中倒数，结束后开始 5 分钟冷却；返回当前速度倍数
function tick(o, dt) {
  if (o.boostT > 0) { o.boostT -= dt; if (o.boostT <= 0) { o.boostT = 0; o.cdT = E.SKILL.cooldown; } }
  else if (o.cdT > 0) o.cdT = Math.max(0, o.cdT - dt);
  return o.boostT > 0 ? E.SKILL.mult : 1;
}

export function step(state, dt = DT) {
  const ev = [];
  state.t += dt;
  syncCrew(state);

  // —— 矿道 ——
  for (const s of state.shafts) {
    if (!s.unlocked) continue;
    // 被晶簇魔物占据（s.blocked 由 src/combat.js 在线时设置，不进存档）：矿工停在原地，这条矿道停产
    if (s.blocked) { s.tapped = false; continue; }
    const sdt = dt * tick(s, dt), st = shaftStatsOf(state, s), half = st.walk;
    if (s.tapped || s.mgr) for (const m of s.miners) if (m.ph === 'sleep') { m.ph = 'out'; m.t = Math.min(0, m.t); }
    s.tapped = false;
    for (const m of s.miners) {
      if (m.ph === 'sleep') continue;
      m.t += sdt;
      if (m.ph === 'out' && m.t >= half) { m.ph = 'mine'; m.t -= half; }
      if (m.ph === 'mine' && m.t >= st.mine) { m.ph = 'back'; m.t -= st.mine; m.load = st.cap; }
      if (m.ph === 'back' && m.t >= half) { s.crate += m.load; ev.push({ type: 'deposit', shaft: s.i, amount: m.load }); m.load = 0; m.ph = 'drop'; m.t -= half; }
      if (m.ph === 'drop' && m.t >= st.drop) { if (s.mgr) { m.ph = 'out'; m.t -= st.drop; } else { m.ph = 'sleep'; m.t = 0; } }
    }
  }

  // —— 电梯（y：0 = 地面电梯楼，第 i 条矿道在 y = i + 1）——
  const el = state.elev, edt = dt * tick(el, dt), es = elevStatsOf(state);
  const open = state.shafts.filter((s) => s.unlocked), last = open.length - 1;
  if (el.ph === 'idle' && open.length && (el.tapped || el.mgr)) { el.target = 0; el.ph = 'down'; }
  el.tapped = false;
  const rowsPerSec = (el.y < 1 ? 1 / es.first : 1 / es.floor);   // 地面到第 1 条那段更长
  if (el.ph === 'down') {
    el.y += edt * rowsPerSec;
    if (el.y >= el.target + 1) { el.y = el.target + 1; el.ph = 'load'; }
  } else if (el.ph === 'load') {
    const s = state.shafts[el.target], take = Math.min(s.crate, es.load - el.load, es.loadSpeed * edt);
    s.crate -= take; el.load += take;
    if (s.crate <= EPS || el.load >= es.load - EPS) {
      if (el.load < es.load - EPS && el.target < last) { el.target++; el.ph = 'down'; } else el.ph = 'up';
    }
  } else if (el.ph === 'up') {
    el.y -= edt * rowsPerSec;
    if (el.y <= 0) { el.y = 0; el.ph = 'unload'; if (el.load > 0) ev.push({ type: 'elevUp', amount: el.load }); }
  } else if (el.ph === 'unload') {
    const give = Math.min(el.load, es.loadSpeed * edt);
    el.load -= give; el.top += give;
    if (el.load <= EPS) { el.top += el.load; el.load = 0; el.ph = 'idle'; }
  }

  // —— 仓库推车员（t：走路计时；x 由渲染按阶段插值）——
  const h = state.house, hdt = dt * tick(h, dt), hs = houseStatsOf(state), half = hs.leg;
  for (const w of h.workers) {
    if (w.ph === 'sleep' && (h.tapped || (h.mgr && el.top > EPS))) { w.ph = 'go'; w.t = 0; }
    if (w.ph === 'sleep') continue;
    w.t += hdt;
    if (w.ph === 'go' && w.t >= half) { w.ph = 'load'; w.t = 0; }
    if (w.ph === 'load') {
      const take = Math.min(el.top, hs.load - w.load, hs.loadSpeed * hdt);
      el.top -= take; w.load += take;
      if (w.load >= hs.load - EPS || el.top <= EPS) { w.ph = 'return'; w.t = 0; }
    } else if (w.ph === 'return' && w.t >= half) { w.ph = 'sell'; w.t = 0; w.sold = w.load; }
    else if (w.ph === 'sell' && w.t >= w.sold / hs.loadSpeed) {
      if (w.load > 0) { earn(state, w.load); ev.push({ type: 'sell', amount: w.load }); }
      w.load = 0; w.ph = 'sleep'; w.t = 0;
    }
  }
  h.tapped = false;
  return ev;
}

// —— 玩家操作（都返回是否成功）——
const objOf = (state, kind, i) => (kind === 'shaft' ? state.shafts[i] : kind === 'elev' ? state.elev : state.house);
export function tap(state, kind, i) {
  if (kind === 'shaft') { const s = state.shafts[i]; if (!s?.unlocked) return false; const woke = s.miners.some((m) => m.ph === 'sleep'); s.tapped = true; return woke; }
  if (kind === 'elev') { const ok = state.elev.ph === 'idle'; state.elev.tapped = true; return ok; }
  if (kind === 'house') { const ok = state.house.workers.some((w) => w.ph === 'sleep'); state.house.tapped = true; return ok; }
  return false;
}
export const nextLockedShaft = (state) => state.shafts.find((s) => !s.unlocked) ?? null;
// 下一条矿道前面是不是还挡着岩障
export const barrierAhead = (state) => { const s = nextLockedShaft(state); return s && E.BARRIERS[s.i] && !state.barriers[s.i] ? s.i : null; };
export function clearBarrier(state) {
  const i = barrierAhead(state); if (i === null) return false;
  const c = E.BARRIERS[i]; if (state.cash < c) return false;
  state.cash -= c; state.barriers[i] = true; return true;
}
export function buyShaft(state) {
  const s = nextLockedShaft(state); if (!s || barrierAhead(state) !== null) return null;
  const c = E.SHAFTS[s.i].buy; if (state.cash < c) return null;
  state.cash -= c; s.unlocked = true; return s.i;
}
const levelOf = (state, kind, i) => objOf(state, kind, i).level;
export function costOf(state, kind, i, n = 1) {
  const L = levelOf(state, kind, i);
  if (n === 'max') return E.maxAffordable(kind, i, L, state.cash);
  const k = Math.min(n, E.levelsLeft(kind, L));   // 不超过等级上限；满级时 n = 0
  return k < 1 ? { n: 0, cost: Infinity } : { n: k, cost: E.bulkCost(kind, i, L, k) };
}
export const isMaxed = (state, kind, i = 0) => E.levelsLeft(kind, levelOf(state, kind, i)) < 1;
export function upgrade(state, kind, i, n = 1) {
  const { n: k, cost } = costOf(state, kind, i, n);
  if (state.cash < cost || k < 1) return false;
  state.cash -= cost; objOf(state, kind, i).level += k;
  return true;
}
export function hire(state, kind, i = 0) {
  const o = objOf(state, kind, i);
  if (!o || o.mgr || (kind === 'shaft' && !o.unlocked)) return false;
  const c = E.managerCost(kind, i); if (state.cash < c) return false;
  state.cash -= c; o.mgr = 1; return true;
}
// 管理员培训：设施达到下一级的门槛后花钱升级管理员
export function trainInfo(state, kind, i = 0) {
  const o = objOf(state, kind, i), tiers = E.MGR_TIERS[kind];
  if (!o?.mgr || o.mgr >= tiers.length) return null;
  const next = tiers[o.mgr];
  return { level: o.mgr + 1, need: next.at, have: o.level, ready: o.level >= next.at, cost: E.trainCost(kind, i, o.mgr), tier: next };
}
export function train(state, kind, i = 0) {
  const t = trainInfo(state, kind, i); if (!t || !t.ready || state.cash < t.cost) return false;
  state.cash -= t.cost; objOf(state, kind, i).mgr += 1; return true;
}
export function useBoost(state, kind, i = 0) {
  const o = objOf(state, kind, i);
  if (!o?.mgr || o.boostT > 0 || o.cdT > 0) return false;
  o.boostT = E.SKILL.time; return true;
}
// 投资人：重开矿场时按累计收入结算；之后每位 +2% 产出
export const investorsClaimable = (state) => Math.max(0, Math.floor(Math.sqrt(state.lifetime / E.INVESTOR.unit) - Math.sqrt(state.runStart / E.INVESTOR.unit)));
export function prestige(state) {
  const n = investorsClaimable(state); if (n < 1) return null;
  return newState({ lifetime: state.lifetime, investors: state.investors + n });
}

// 离线收益（用户定的规则）：按正常闲置收入的 OFFLINE_RATE 倍运行，离开时间最多算 OFFLINE_CAP_H 小时
export const OFFLINE_RATE = 0.05, OFFLINE_CAP_H = 24;
export function offlineIncome(state, seconds) {
  const sec = Math.max(0, seconds), used = Math.min(sec, OFFLINE_CAP_H * 3600), full = idleIncome(state).income, r = full * OFFLINE_RATE;
  return { sec, used, capped: sec > used, rate: r, fullRate: full, cash: r * used };
}
export const collectOffline = (state, cash) => earn(state, cash);

// 存档：只存需要持久的字段。econ = 经济版本（3 = 压缩到 T 量级；4 = 所有设施上限 200 级）
export const ECON = 4;
export function serialize(state) {
  return {
    v: 2, econ: ECON, t: state.t, cash: state.cash, lifetime: state.lifetime, runStart: state.runStart, investors: state.investors, barriers: state.barriers,
    shafts: state.shafts.filter((s) => s.unlocked).map((s) => ({ i: s.i, level: s.level, mgr: s.mgr, crate: s.crate, cdT: s.cdT, boostT: s.boostT })),
    elev: { level: state.elev.level, mgr: state.elev.mgr, top: state.elev.top + state.elev.load, cdT: state.elev.cdT, boostT: state.elev.boostT },
    house: { level: state.house.level, mgr: state.house.mgr, carry: state.house.workers.reduce((a, w) => a + w.load, 0), cdT: state.house.cdT, boostT: state.house.boostT },
  };
}
export function deserialize(d) {
  const st = newState();
  if (!d || d.v !== 2) return st;
  Object.assign(st, { t: d.t ?? 0, cash: d.cash ?? 10, lifetime: d.lifetime ?? 0, runStart: d.runStart ?? 0, investors: d.investors ?? 0, barriers: d.barriers ?? {} });
  for (const s of d.shafts ?? []) Object.assign(st.shafts[s.i], { unlocked: true, level: s.level, mgr: s.mgr ?? 0, crate: s.crate ?? 0, cdT: s.cdT ?? 0, boostT: s.boostT ?? 0 });
  Object.assign(st.elev, { level: d.elev?.level ?? 1, mgr: d.elev?.mgr ?? 0, top: (d.elev?.top ?? 0) + (d.house?.carry ?? 0), cdT: d.elev?.cdT ?? 0, boostT: d.elev?.boostT ?? 0 });
  Object.assign(st.house, { level: d.house?.level ?? 1, mgr: d.house?.mgr ?? 0, cdT: d.house?.cdT ?? 0, boostT: d.house?.boostT ?? 0 });
  if (d.econ !== ECON) {
    if (!(d.econ >= 3)) migrateEcon(st);   // 更早的膨胀经济 → 第 3 版（金额压到 T，等级收到 60 / 100）
    if (!(d.econ >= 4)) migrateTo200(st);   // 第 3 版 → 第 4 版：等级换算到 200 级制，强度不变
  }
  return st;
}
// 第 3 版等级（矿道 ≤60、电梯仓库 ≤100）→ 第 4 版（≤200）。管理员档位保留，其门槛也是按同样比例拉伸的。
function migrateTo200(st) {
  for (const s of st.shafts) if (s.unlocked) s.level = E.levelFromV3('shaft', s.level);
  st.elev.level = E.levelFromV3('elev', st.elev.level);
  st.house.level = E.levelFromV3('house', st.house.level);
}
// 旧经济（金额会膨胀到 10^20 以上）的存档搬到新经济：
// 保留开过的矿道、岩障、管理员（等级收到新上限）；金额按对数压缩（旧第 9 条矿道价 4.3×10^16 → 新的 4×10^10）；
// 投资人不超过压缩后的累计收入应得的人数；箱子 / 电梯里在途的矿清空。
const SQUASH = Math.log10(4e10) / Math.log10(4.32e16);
const squash = (v) => (v > 1 ? Math.pow(10, Math.log10(v) * SQUASH) : Math.max(0, v || 0));
const MIGRATE_CAP = 1e14;   // 搬过来的金额最多 100T，保证落在 T 量级
const V3_CAP = { shaft: 60, elev: 100, house: 100 };   // 第 3 版的等级上限（之后再由 migrateTo200 换算）
function migrateEcon(st) {
  st.lifetime = Math.min(MIGRATE_CAP, squash(st.lifetime)); st.cash = Math.min(st.lifetime / 10, squash(st.cash)); st.runStart = Math.min(st.lifetime, squash(st.runStart));
  st.investors = Math.min(st.investors, Math.floor(Math.sqrt(st.lifetime / E.INVESTOR.unit)));   // 硬币买的投资人由 main.js 按 paidInv 补回
  for (const s of st.shafts) { s.level = Math.min(s.level, V3_CAP.shaft); s.mgr = Math.min(s.mgr, E.MGR_TIERS.shaft.length); s.crate = 0; }
  st.elev.level = Math.min(st.elev.level, V3_CAP.elev); st.elev.mgr = Math.min(st.elev.mgr, E.MGR_TIERS.elev.length); st.elev.top = 0; st.elev.load = 0;
  st.house.level = Math.min(st.house.level, V3_CAP.house); st.house.mgr = Math.min(st.house.mgr, E.MGR_TIERS.house.length);
}
